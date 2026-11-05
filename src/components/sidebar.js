import { css, html } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { ComponentElement, emit } from './shared.js';

export class WpSidebar extends ComponentElement {
  static properties = {
    formats: { attribute: false },
    format: { attribute: false },
    size: { attribute: false },
    meta: { attribute: false },
    targets: { attribute: false },
    mergeMode: { type: Boolean, attribute: 'merge-mode' },
    disabled: { type: Boolean }
  };

  static styles = [ComponentElement.styles, css`
    .controls-panel {
      display: flex;
      flex-direction: column;
      gap: var(--block-gap);
      height: calc(100vh - 280px);
      padding: var(--panel-padding);
      border: 1px solid var(--border-color-subtle);
      border-radius: var(--radius-panel);
      background: rgba(15, 23, 42, 0.75);
      box-shadow: var(--shadow);
    }
    .group-box {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }
    .target-folder-group-box {
      flex: 1 1 0;
      min-height: 0;
    }
    .group-label {
      color: var(--muted);
      font-size: 0.76rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .button-grid, .output-size-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: var(--space-2);
    }
    .button-grid > wp-button,
    .output-size-grid > wp-button,
    .target-group-buttons > wp-button,
    .action-row > wp-button {
      width: 100%;
    }
    .target-buttons {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: var(--space-1);
      min-height: 0;
      overflow-y: auto;
    }
    .target-folder-group {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      padding-right: 2px;
    }
    .target-group-label {
      display: flex;
      align-items: center;
      gap: 1em;
      color: var(--muted);
      font-size: 0.72rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .target-group-label::before, .target-group-label::after {
      height: 1px;
      flex: 1;
      background: var(--muted);
      content: '';
    }
    .target-group-buttons {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--space-2);
    }
    .action-row {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: var(--space-2);
      margin-top: auto;
    }
    @media (max-height: 700px) {
      .controls-panel { height: auto; min-height: 320px; }
      .target-folder-group-box, .target-buttons { flex: none; }
      .target-buttons { overflow: visible; }
    }
  `];

  constructor() {
    super();
    this.formats = [];
    this.format = null;
    this.size = null;
    this.meta = null;
    this.targets = [];
    this.mergeMode = false;
    this.disabled = false;
  }

  render() {
    const sizes = this.format?.sizes || [];
    const grouped = new Map();
    for (const target of this.targets) {
      const group = target.group?.trim() || 'ungrouped';
      if (!grouped.has(group)) grouped.set(group, []);
      grouped.get(group).push(target);
    }
    return html`
      <aside class="controls-panel">
        <div class="group-box">
          <label class="group-label">${this.mergeMode ? 'Merge format' : 'Crop format'}</label>
          <div class="button-grid">
            ${repeat(this.formats, (format) => format.id, (format) => html`
              <wp-button color="neutral" toggle
                ?disabled=${this.disabled} ?pressed=${this.format?.id === format.id}
                @click=${() => emit(this, 'format-selected', { format })}>${format.id}</wp-button>
            `)}
          </div>
        </div>
        <div class="group-box">
          <label class="group-label">Output size</label>
          <div class="output-size-grid">
            ${sizes.length && this.meta ? repeat(sizes, (size) => `${size[0]}x${size[1]}`, (size) => {
              const [width, height] = size;
              const unavailable = width > this.meta.width || height > this.meta.height || this.disabled;
              return html`<wp-button color="neutral" toggle
                ?disabled=${unavailable}
                ?pressed=${this.size?.width === width && this.size?.height === height}
                @click=${() => emit(this, 'size-selected', { size: { width, height } })}>
                ${width} × ${height}
              </wp-button>`;
            }) : html`<wp-button color="neutral" disabled>No size available</wp-button>`}
          </div>
        </div>
        <div class="group-box target-folder-group-box">
          <label class="group-label">Target folder</label>
          <div class="target-buttons">
            ${repeat([...grouped], ([group]) => group, ([group, targets]) => html`
              <div class="target-folder-group">
                <div class="target-group-label">${group}</div>
                <div class="target-group-buttons">
                  ${repeat(targets, (target) => target.path, (target) => html`
                    <wp-button color="neutral"
                      ?disabled=${this.disabled} @click=${() => emit(this, 'target-selected', { target })}>
                      ${target.name}
                    </wp-button>
                  `)}
                </div>
              </div>
            `)}
          </div>
        </div>
        <div class="action-row">
          <wp-button color="neutral" @click=${() => emit(this, 'skip-requested')}>Skip</wp-button>
          <wp-button color="neutral" @click=${() => emit(this, 'edit-requested')}>Edit</wp-button>
          <wp-button color="danger" @click=${() => emit(this, 'delete-requested')}>Delete</wp-button>
        </div>
      </aside>
    `;
  }
}
customElements.define('wp-sidebar', WpSidebar);

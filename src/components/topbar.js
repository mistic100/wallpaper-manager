import { css, html } from 'lit';
import { ComponentElement, emit } from './shared.js';
import '@icons/refresh-cw.js';
import '@icons/settings.js';

export class WpTopbar extends ComponentElement {
  static properties = {
    filename: { type: String },
    metaLabel: { type: String, attribute: 'meta-label' },
    status: { type: String },
    tone: { type: String }
  };

  static styles = [ComponentElement.styles, css`
    .topbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: var(--block-padding);
      margin-bottom: var(--block-padding);
    }
    .title-wrap {
      display: flex;
      align-items: flex-end;
      gap: var(--space-1);
      min-width: 0;
    }
    h1 {
      margin: 0;
      font-size: 1.8rem;
      font-weight: 700;
    }
    .filename-title, .filename-text {
      display: block;
      min-width: 0;
      margin: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .meta-size {
      flex-shrink: 0;
      color: var(--muted);
      font-size: 1.4em;
      font-weight: 500;
      white-space: nowrap;
    }
    .topbar-actions {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }
    .topbar-actions > wp-button {
      width: 40px;
      height: 40px;
      flex: 0 0 40px;
    }
    .status-pill {
      padding: 8px 14px;
      border: 1px solid rgba(34, 197, 94, 0.4);
      border-radius: var(--radius-pill);
      background: rgba(34, 197, 94, 0.12);
      color: #bbf7d0;
      font-size: 0.8rem;
      white-space: nowrap;
    }
    .status-pill.neutral {
      background: rgba(59, 130, 246, 0.12);
      border-color: rgba(96, 165, 250, 0.5);
      color: #93c5fd;
    }
    .status-pill.success {
      background: rgba(34, 197, 94, 0.12);
      border-color: rgba(74, 222, 128, 0.5);
      color: #86efac;
    }
    .status-pill.warn {
      background: rgba(245, 158, 11, 0.12);
      border-color: rgba(251, 191, 36, 0.55);
      color: #fcd34d;
    }
    .status-pill.danger {
      background: rgba(239, 68, 68, 0.12);
      border-color: rgba(248, 113, 113, 0.55);
      color: #fca5a5;
    }
  `];

  constructor() {
    super();
    this.filename = 'Loading…';
    this.metaLabel = '';
    this.status = '';
    this.tone = 'neutral';
  }

  render() {
    return html`
      <header class="topbar">
        <div class="title-wrap">
          <h1 class="filename-title"><span class="filename-text">${this.filename}</span></h1>
          <span class="meta-size">${this.metaLabel}</span>
        </div>
        <div class="topbar-actions">
          <span class="status-pill ${this.tone}">${this.status}</span>
          <wp-button color="neutral" round title="Refresh image list"
            aria-label="Refresh image list" @click=${() => emit(this, 'refresh-requested')}>
            <lucide-refresh-cw></lucide-refresh-cw>
          </wp-button>
          <wp-button color="neutral" round title="Open configuration"
            aria-label="Open configuration" @click=${() => emit(this, 'config-requested')}>
            <lucide-settings></lucide-settings>
          </wp-button>
        </div>
      </header>
    `;
  }
}
customElements.define('wp-topbar', WpTopbar);

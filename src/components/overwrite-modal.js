import { css, html } from 'lit';
import { ComponentElement, emit } from './shared.js';

export class WpOverwriteModal extends ComponentElement {
  static properties = {
    open: { type: Boolean, reflect: true },
    mergeMode: { type: Boolean, attribute: 'merge-mode' },
    newPreview: { type: String, attribute: 'new-preview' },
    existingPreview: { type: String, attribute: 'existing-preview' }
  };

  static styles = [ComponentElement.styles, css`
    .overwrite-modal {
      position: fixed;
      z-index: 40;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      background: rgba(2, 6, 23, 0.72);
    }
    .overwrite-modal.hidden { display: none; }
    .overwrite-panel {
      display: flex;
      flex-direction: column;
      gap: var(--block-gap);
      width: min(1000px, 92vw);
      padding: calc(var(--block-padding) + 6px);
      border: 1px solid var(--border-color-subtle);
      border-radius: var(--radius-modal);
      background: rgba(15, 23, 42, 0.97);
      box-shadow: var(--shadow);
    }
    .overwrite-panel.merge-mode { width: min(600px, 92vw); }
    .overwrite-header h2 { margin: 0; }
    .overwrite-compare {
      display: grid;
      grid-template-columns: repeat(2, minmax(220px, 1fr));
      gap: var(--block-gap);
    }
    .overwrite-compare.merge-mode { grid-template-columns: minmax(0, 1fr); }
    .overwrite-side {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      padding: 14px;
      border: 1px solid var(--border-color-subtle);
      border-radius: var(--radius-card);
      background: rgba(15, 23, 42, 0.58);
    }
    .overwrite-side-label {
      color: var(--muted);
      font-size: 0.85rem;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .overwrite-side img {
      width: 100%;
      height: 320px;
      border: 1px solid var(--border-color-subtle);
      border-radius: var(--radius-control);
      background: rgba(2, 6, 23, 0.9);
      object-fit: contain;
    }
    .overwrite-actions { display: flex; justify-content: flex-end; gap: var(--space-3); }
  `];

  constructor() {
    super();
    this.open = false;
    this.mergeMode = false;
    this.newPreview = '';
    this.existingPreview = '';
  }

  render() {
    return html`
      <div class="overwrite-modal ${this.open ? '' : 'hidden'}" aria-hidden=${String(!this.open)}>
        <div class="overwrite-panel ${this.mergeMode ? 'merge-mode' : ''}" role="dialog" aria-modal="true" aria-labelledby="overwrite-title">
          <div class="overwrite-header"><h2 id="overwrite-title">${this.mergeMode ? 'Existing collage found' : 'Existing file found'}</h2></div>
          <div class="overwrite-compare ${this.mergeMode ? 'merge-mode' : ''}" aria-live="polite">
            ${this.mergeMode ? '' : html`
              <div class="overwrite-side">
                <div class="overwrite-side-label">New file</div>
                <img src=${this.newPreview} alt="Generated replacement preview" />
              </div>
            `}
            <div class="overwrite-side">
              <div class="overwrite-side-label">Existing file</div>
              <img src=${this.existingPreview} alt="Current file in target folder" />
            </div>
          </div>
          <div class="overwrite-actions">
            <wp-button color="neutral"
              @click=${() => emit(this, 'overwrite-cancelled')}>Cancel</wp-button>
            ${this.mergeMode ? '' : html`
              <wp-button color="neutral"
                @click=${() => emit(this, 'overwrite-keep-both')}>Keep both</wp-button>
            `}
            <wp-button color="danger"
              @click=${() => emit(this, 'overwrite-confirmed')}>Overwrite</wp-button>
          </div>
        </div>
      </div>
    `;
  }
}
customElements.define('wp-overwrite-modal', WpOverwriteModal);

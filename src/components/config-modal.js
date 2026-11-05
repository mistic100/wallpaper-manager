import { css, html } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { ComponentElement, emit, normalizeFolderPath, isSafeTargetPath, parseRatio } from './shared.js';
import '@icons/x.js';
import '@icons/trash.js';

export class WpConfigModal extends ComponentElement {
  static properties = {
    open: { type: Boolean, reflect: true },
    config: { attribute: false },
    selectedBaseFolder: { type: String, attribute: 'selected-base-folder', hasChanged: () => true },
    selectedTargetFolder: { type: String, attribute: 'selected-target-folder', hasChanged: () => true },
    _draft: { state: true },
    _ratioDrafts: { state: true },
    _tab: { state: true },
    _message: { state: true },
    _messageTone: { state: true }
  };

  static styles = [ComponentElement.styles, css`
    .config-modal {
      position: fixed;
      z-index: 30;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      background: rgba(2, 6, 23, 0.72);
    }
    .config-modal.hidden, .hidden { display: none !important; }
    .config-panel {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      width: min(1100px, 95vw);
      height: 90vh;
      overflow: auto;
      padding: calc(var(--block-padding) + 6px);
      border: 1px solid var(--border-color-subtle);
      border-radius: var(--radius-modal);
      background: rgba(15, 23, 42, 0.97);
      box-shadow: var(--shadow);
    }
    .config-header, .config-section-header, .config-actions, .base-folder-row,
    .config-format-row, .config-target-row {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }
    .config-header, .config-section-header, .config-actions {
      justify-content: space-between;
    }
    .config-header h2, .config-section-header h3 { margin: 0; }
    .config-header > wp-button { width: 40px; min-width: 40px; flex: 0 0 40px; }
    .config-form {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: var(--block-gap);
      overflow-y: auto;
    }
    .config-tabs {
      display: flex;
      gap: var(--space-2);
      padding: var(--space-1);
      border: 1px solid var(--border-color-subtle);
      border-radius: var(--radius-control);
      background: rgba(15, 23, 42, 0.5);
    }
    .config-tabs > wp-button { flex: 1; }
    .config-format-row > wp-button,
    .config-size-row > wp-button,
    .config-target-row > wp-button {
      width: 40px;
      min-width: 40px;
      flex: 0 0 40px;
    }
    .config-section {
      padding: var(--block-padding);
      border: 1px solid var(--border-color-subtle);
      border-radius: var(--radius-card);
      background: rgba(15, 23, 42, 0.52);
    }
    .config-tab-panel { display: none; }
    .config-tab-panel.active { display: block; }
    .base-folder-row { margin-top: var(--space-2); }
    .base-folder-row input, .config-format-row input, .config-target-row input,
    .config-size-row input, .config-target-item input {
      box-sizing: border-box;
      width: 100%;
      min-width: 0;
      min-height: 40px;
      padding: 0 var(--space-2);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-control);
      background: rgba(15, 23, 42, 0.6);
      color: var(--text);
      font: inherit;
    }
    .config-list {
      display: flex;
      flex: 1 1 calc(50% - var(--space-2));
      flex-direction: column;
      gap: var(--space-2);
      min-width: min(100%, 280px);
      margin-top: var(--space-2);
    }
    #format-config-list, #target-config-list {
      flex-direction: row;
      flex-wrap: wrap;
    }
    .config-format-item, .config-target-item {
      flex: 0 1 calc(50% - var(--space-2));
      min-width: min(100%, 280px);
      padding: var(--space-2);
      border: 1px solid var(--border-color-subtle);
      border-radius: var(--radius-control);
      background: rgba(2, 6, 23, 0.35);
    }
    .config-format-row > * { flex: 1 1 auto; }
    .config-inline-label, .config-format-row > .config-inline-label,
    .config-size-row > .config-inline-label {
      flex: 0 0 auto;
      color: var(--muted);
      font-size: 0.8rem;
      white-space: nowrap;
    }
    .config-target-item { display: flex; flex-direction: column; gap: var(--space-2); }
    .config-target-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; }
    .config-target-meta-row {
      display: grid;
      grid-template-columns: auto minmax(120px, 1fr) auto minmax(120px, 1fr);
      align-items: center;
      gap: var(--space-1) var(--space-2);
    }
    .config-target-label { color: var(--muted); font-size: 0.85rem; white-space: nowrap; }
    .config-target-row > * { min-width: 0; }
    .config-target-path {
      overflow: hidden;
      padding: 0;
      color: var(--muted);
      font-size: 1.1rem;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .config-format-separator {
      height: 1px;
      margin: var(--space-2) 0;
      background: linear-gradient(to bottom, rgba(148, 163, 184, 0.1), rgba(148, 163, 184, 0.28), rgba(148, 163, 184, 0.1));
    }
    .config-sizes-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-2);
      margin: var(--space-2) 0;
    }
    .config-sizes-title { margin: 0; color: var(--muted); font-size: 0.9rem; font-weight: 600; }
    .config-size-list { display: flex; flex-direction: column; gap: var(--space-1); }
    .config-size-row {
      display: grid;
      grid-template-columns: auto minmax(120px, 1fr) auto minmax(120px, 1fr) auto;
      align-items: center;
      gap: var(--space-2);
    }
    .config-message { min-height: 20px; margin: 0; color: #fca5a5; }
    .config-message.success { color: #86efac; }
    .config-empty { padding: var(--space-1) 0; color: var(--muted); }
  `];

  constructor() {
    super();
    this.open = false;
    this.config = { baseFolder: '', formats: [], targetFolders: [] };
    this.selectedBaseFolder = '';
    this.selectedTargetFolder = '';
    this._draft = { baseFolder: '', formats: [], targetFolders: [] };
    this._ratioDrafts = [];
    this._tab = 'baseFolder';
    this._message = '';
    this._messageTone = 'error';
  }

  willUpdate(changed) {
    if (changed.has('open') && this.open) {
      this._draft = structuredClone(this.config || { baseFolder: '', formats: [], targetFolders: [] });
      this._ratioDrafts = this._draft.formats.map((format) => format.ratio?.join(':') || '');
      this._tab = 'baseFolder';
      this._message = '';
    }
    if (changed.has('selectedBaseFolder') && this.selectedBaseFolder) {
      this._draft = { ...this._draft, baseFolder: this.selectedBaseFolder };
    }
    if (changed.has('selectedTargetFolder') && this.selectedTargetFolder) {
      this._addTargetFolder(this.selectedTargetFolder);
    }
  }

  _setMessage(message, tone = 'error') {
    this._message = message;
    this._messageTone = tone;
  }

  setError(message) {
    this._setMessage(message);
  }

  _updateDraft(callback) {
    const draft = structuredClone(this._draft);
    callback(draft);
    this._draft = draft;
    this._setMessage('');
  }

  _addTargetFolder(path) {
    if (path === '__INVALID_TARGET_FOLDER__' || !isSafeTargetPath(path)) {
      this._setMessage('Target folders must stay inside the base folder and cannot go up a level.');
      return;
    }
    const normalized = normalizeFolderPath(path);
    if (this._draft.targetFolders.some((folder) => normalizeFolderPath(folder.path) === normalized)) {
      this._setMessage('This target folder is already configured.');
      return;
    }
    this._updateDraft((draft) => draft.targetFolders.push({ path: normalized, name: normalized, group: '' }));
  }

  _save(event) {
    event.preventDefault();
    const nextConfig = { baseFolder: this._draft.baseFolder.trim(), formats: [], targetFolders: [] };
    if (!nextConfig.baseFolder) return this._setMessage('Select a base folder first.');
    const seenRatios = new Set();
    for (const [index, format] of this._draft.formats.entries()) {
      const ratio = parseRatio(this._ratioDrafts[index] ?? format.ratio?.join(':'));
      if (!ratio) return this._setMessage('Each format needs a valid ratio like 16:10.');
      const ratioKey = `${ratio[0]}:${ratio[1]}`;
      if (seenRatios.has(ratioKey)) return this._setMessage(`Duplicate format ratio detected: ${ratioKey}.`);
      seenRatios.add(ratioKey);
      const sizes = (format.sizes || [])
        .map((size) => [Number(size[0]), Number(size[1])])
        .filter(([width, height]) => Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0)
        .sort((left, right) => left[0] * left[1] - right[0] * right[1]);
      if (!sizes.length) return this._setMessage('Each format needs at least one size.');
      nextConfig.formats.push({ id: ratioKey, ratio, sizes });
    }
    const seenTargets = new Set();
    for (const folder of this._draft.targetFolders) {
      const path = normalizeFolderPath(folder.path);
      if (!isSafeTargetPath(path)) return this._setMessage('Target folders must stay inside the base folder and cannot go up a level.');
      if (seenTargets.has(path)) return this._setMessage(`Duplicate target folder detected: ${path}.`);
      seenTargets.add(path);
      nextConfig.targetFolders.push({
        ...folder,
        path,
        name: folder.name?.trim() || '',
        group: folder.group?.trim() || ''
      });
    }
    if (!nextConfig.formats.length) return this._setMessage('Add at least one format.');
    if (!nextConfig.targetFolders.length) return this._setMessage('Add at least one target folder.');
    emit(this, 'config-save-requested', { config: nextConfig });
  }

  render() {
    return html`
      <div class="config-modal ${this.open ? '' : 'hidden'}" aria-hidden=${String(!this.open)}>
        <div class="config-panel" role="dialog" aria-modal="true" aria-labelledby="config-title">
          <div class="config-header">
            <h2 id="config-title">Configuration</h2>
            <wp-button color="neutral" round aria-label="Close configuration"
              @click=${() => emit(this, 'config-cancelled')}>
              <lucide-x></lucide-x>  
            </wp-button>
          </div>
          <div class="config-tabs" role="tablist" aria-label="Configuration sections">
            ${repeat([
              ['baseFolder', 'Base folder'],
              ['formats', 'Formats'],
              ['targetFolders', 'Target folders']
            ], ([name]) => name, ([name, label]) => html`
              <wp-button color=${this._tab === name ? 'accent' : 'neutral'} toggle ?pressed=${this._tab === name}
                button-role="tab" button-aria-selected=${String(this._tab === name)}
                @click=${() => { this._tab = name; }}>${label}</wp-button>
            `)}
          </div>
          <form id="config-form" class="config-form" @submit=${this._save}>
            <section class="config-section config-tab-panel ${this._tab === 'baseFolder' ? 'active' : 'hidden'}">
              <div class="config-section-header"><h3>Base folder</h3></div>
              <div class="base-folder-row">
                <input type="text" readonly placeholder="Select a base folder" .value=${this._draft.baseFolder || ''} />
                <wp-button color="neutral"
                  @click=${() => emit(this, 'base-folder-requested')}>Browse</wp-button>
              </div>
            </section>
            <section class="config-section config-tab-panel ${this._tab === 'formats' ? 'active' : 'hidden'}">
              <div class="config-section-header">
                <h3>Formats</h3>
                <wp-button color="neutral" @click=${() => this._updateDraft((draft) => {
                  draft.formats.push({ id: '', ratio: [], sizes: [[]] });
                  this._ratioDrafts = [...this._ratioDrafts, ''];
                })}>Add format</wp-button>
              </div>
              <div class="config-list" id="format-config-list">
                ${this._draft.formats.length ? repeat(this._draft.formats, (_, index) => index, (format, index) => html`
                  <div class="config-format-item">
                    <div class="config-format-row">
                      <label class="config-inline-label">Format ratio:</label>
                      <input type="text" placeholder="16:9" .value=${this._ratioDrafts[index] ?? format.ratio?.join(':') ?? ''}
                        @input=${(event) => {
                          const ratioDrafts = [...this._ratioDrafts];
                          ratioDrafts[index] = event.target.value;
                          this._ratioDrafts = ratioDrafts;
                          const ratio = parseRatio(event.target.value);
                          if (!ratio) this._setMessage('Use a ratio like 16:9 or 16/9.');
                          else this._updateDraft((draft) => { draft.formats[index].ratio = ratio; });
                        }} />
                      <wp-button color="danger" round title="Delete format"
                        aria-label="Delete format" @click=${() => {
                          const ratioDrafts = [...this._ratioDrafts];
                          ratioDrafts.splice(index, 1);
                          this._ratioDrafts = ratioDrafts;
                          this._updateDraft((draft) => draft.formats.splice(index, 1));
                        }}>
                        <lucide-trash></lucide-trash>
                      </wp-button>
                    </div>
                    <div class="config-format-separator"></div>
                    <div class="config-sizes-header">
                      <h4 class="config-sizes-title">Sizes</h4>
                      <wp-button color="neutral" @click=${() => this._updateDraft((draft) => {
                        draft.formats[index].sizes.push([]);
                      })}>Add size</wp-button>
                    </div>
                    <div class="config-size-list">
                      ${format.sizes?.length ? repeat(format.sizes, (_, sizeIndex) => sizeIndex, (size, sizeIndex) => html`
                        <div class="config-size-row">
                          <label class="config-inline-label">Width:</label>
                          <input type="number" min="1" .value=${size[0] || ''}
                            @input=${(event) => this._updateSize(index, sizeIndex, Number(event.target.value), true)} />
                          <label class="config-inline-label">Height:</label>
                          <input type="number" min="1" .value=${size[1] || ''}
                            @input=${(event) => this._updateSize(index, sizeIndex, Number(event.target.value), false)} />
                          <wp-button color="danger" round title="Remove size"
                            aria-label="Remove size" @click=${() => this._updateDraft((draft) => draft.formats[index].sizes.splice(sizeIndex, 1))}>
                            <lucide-trash></lucide-trash>
                          </wp-button>
                        </div>
                      `) : html`<div class="config-empty">No sizes configured.</div>`}
                    </div>
                  </div>
                `) : html`<div class="config-empty">No formats configured yet.</div>`}
              </div>
            </section>
            <section class="config-section config-tab-panel ${this._tab === 'targetFolders' ? 'active' : 'hidden'}">
              <div class="config-section-header">
                <h3>Target folders</h3>
                <wp-button color="neutral"
                  @click=${() => emit(this, 'target-folder-requested', { baseFolder: this._draft.baseFolder })}>Add folder</wp-button>
              </div>
              <div class="config-list" id="target-config-list">
                ${this._draft.targetFolders.length ? repeat(this._draft.targetFolders, (_, index) => index, (folder, index) => html`
                  <div class="config-target-item">
                    <div class="config-target-row">
                      <code class="config-target-path">${folder.path}</code>
                      <wp-button color="danger" round title="Remove folder"
                        aria-label="Remove folder" @click=${() => this._updateDraft((draft) => draft.targetFolders.splice(index, 1))}>
                        <lucide-trash></lucide-trash>
                      </wp-button>
                    </div>
                    <div class="config-target-meta-row">
                      <label class="config-target-label">Name:</label>
                      <input type="text" placeholder="Folder name" .value=${folder.name || ''}
                        @input=${(event) => this._updateDraft((draft) => { draft.targetFolders[index].name = event.target.value; })} />
                      <label class="config-target-label">Group:</label>
                      <input type="text" placeholder="Group" .value=${folder.group || ''}
                        @input=${(event) => this._updateDraft((draft) => { draft.targetFolders[index].group = event.target.value; })} />
                    </div>
                  </div>
                `) : html`<div class="config-empty">No target folders configured yet.</div>`}
              </div>
            </section>
          </form>
          <p class="config-message ${this._messageTone === 'success' ? 'success' : ''}" role="status" aria-live="polite">
            ${this._message}
          </p>
          <div class="config-actions">
            <wp-button color="neutral"
              @click=${() => emit(this, 'config-cancelled')}>Cancel</wp-button>
            <wp-button color="accent" type="submit"
              @click=${() => this.renderRoot.querySelector('#config-form').requestSubmit()}>Save</wp-button>
          </div>
        </div>
      </div>
    `;
  }

  _updateSize(formatIndex, sizeIndex, value, isWidth) {
    if (!value) return;
    this._updateDraft((draft) => {
      const format = draft.formats[formatIndex];
      const ratio = parseRatio(format.ratio?.join(':'));
      if (!ratio) return;
      const size = format.sizes[sizeIndex] || [0, 0];
      const next = isWidth
        ? [value, Math.round(value * ratio[1] / ratio[0])]
        : [Math.round(value * ratio[0] / ratio[1]), value];
      format.sizes[sizeIndex] = next;
    });
  }
}
customElements.define('wp-config-modal', WpConfigModal);

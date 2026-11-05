import { css, html } from 'lit';
import { ComponentElement } from './components/shared.js';
import './components/button.js';
import './components/topbar.js';
import './components/crop-stage.js';
import './components/merge-stage.js';
import './components/sidebar.js';
import './components/gallery.js';
import './components/config-modal.js';
import './components/overwrite-modal.js';

const emptyConfig = () => ({ baseFolder: '', formats: [], targetFolders: [] });

export class WpApp extends ComponentElement {
  static properties = {
    config: { attribute: false },
    images: { attribute: false },
    currentIndex: { type: Number },
    selectedIndices: { attribute: false },
    currentMeta: { attribute: false },
    mergeImages: { attribute: false },
    selectedFormat: { attribute: false },
    selectedSize: { attribute: false },
    crop: { attribute: false },
    imageRevision: { type: Number },
    status: { type: String },
    statusTone: { type: String },
    configOpen: { type: Boolean },
    overwriteOpen: { type: Boolean },
    overwriteMergeMode: { type: Boolean },
    overwriteNewPreview: { type: String },
    overwriteExistingPreview: { type: String },
    _loadingImage: { state: true },
    _loadingQueue: { state: true },
    _processingOutput: { state: true }
  };

  static styles = [ComponentElement.styles, css`
    :host { min-height: 100vh; }
    .app-shell {
      min-height: 100vh;
      margin: 0 auto;
      padding: var(--block-padding);
    }
    .busy-overlay {
      position: fixed;
      z-index: 35;
      inset: 0;
      background: rgba(255, 255, 255, 0.2);
      cursor: wait;
    }
    .busy-overlay[hidden] { display: none; }
    .workspace {
      display: grid;
      grid-template-columns: minmax(0, 1.7fr) minmax(300px, 420px);
      gap: var(--block-gap);
    }
    .workspace > wp-crop-stage,
    .workspace > wp-sidebar {
      min-width: 0;
    }
    @media (max-width: 1100px) {
      .workspace { grid-template-columns: 1fr; }
    }
  `];

  constructor() {
    super();
    this.config = emptyConfig();
    this.images = [];
    this.currentIndex = 0;
    this.selectedIndices = [];
    this.currentMeta = null;
    this._currentMetaPath = null;
    this.mergeImages = [];
    this.selectedFormat = null;
    this.selectedSize = null;
    this.crop = null;
    this.imageRevision = Date.now();
    this.status = 'Loading…';
    this.statusTone = 'neutral';
    this.configOpen = false;
    this.overwriteOpen = false;
    this.overwriteMergeMode = false;
    this.overwriteNewPreview = '';
    this.overwriteExistingPreview = '';
    this.pendingOverwrite = null;
    this._metadataByPath = new Map();
    this._zoomed = false;
    this._loadingImage = false;
    this._loadingQueue = false;
    this._processingOutput = false;
    this._selectionLoadId = 0;
  }

  createRenderRoot() {
    const root = super.createRenderRoot();
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL('./style.css', import.meta.url).href;
    root.append(link);
    return root;
  }

  firstUpdated() {
    this._loadConfig().catch((error) => {
      console.error(error);
      this._setStatus('Could not load configuration', 'danger');
    });
  }

  get _currentImage() {
    return this.images[this.currentIndex] || null;
  }

  get _isMergeMode() {
    return this.selectedIndices.length > 1;
  }

  get _workingMeta() {
    if (!this._isMergeMode || !this.mergeImages.length) return this.currentMeta;
    const height = Math.min(...this.mergeImages.map((item) => item.meta.height));
    return {
      width: Math.round(this.mergeImages.reduce(
        (width, item) => width + item.meta.width * height / item.meta.height,
        0
      )),
      height
    };
  }

  _setStatus(message, tone = 'neutral') {
    this.status = message;
    this.statusTone = tone;
  }

  async _loadConfig() {
    this.config = await window.electronAPI.loadConfig() || emptyConfig();
    if (!this.config.baseFolder || !this.config.formats.length || !this.config.targetFolders.length) {
      this.configOpen = true;
      this._setStatus('Configure app');
      return;
    }

    this.configOpen = false;
    await this._refreshQueue(false);
    if (this.images.length) {
      await this._showCurrentImage();
    } else {
      this._setEmptyState();
      this._setStatus('No images in source folder', 'warn');
    }
  }

  async _refreshQueue(reportStatus = true) {
    this._loadingQueue = true;
    try {
      this._metadataByPath.clear();
      this.mergeImages = [];
      this.currentMeta = null;
      this._currentMetaPath = null;
      this.images = await window.electronAPI.listImages();
      this.currentIndex = 0;
      this.selectedIndices = this.images.length ? [0] : [];
      if (!this.images.length) {
        this._setEmptyState();
        if (reportStatus) this._setStatus('Queue refreshed');
        return;
      }
      await this._showCurrentImage();
      if (reportStatus) this._setStatus('Queue refreshed', 'success');
    } catch (error) {
      console.error(error);
      this._setStatus('Refresh failed', 'danger');
    } finally {
      this._loadingQueue = false;
    }
  }

  async _showCurrentImage() {
    const image = this._currentImage;
    if (!image) {
      this._setEmptyState();
      this._setStatus('No images', 'warn');
      return;
    }
    const loadId = ++this._selectionLoadId;
    const indices = [...new Set(this.selectedIndices.filter((index) => index >= 0 && index < this.images.length))]
      .sort((a, b) => a - b);
    this.selectedIndices = indices;
    const displayIndices = indices.length ? indices : [this.currentIndex];
    const selected = displayIndices.map((index) => this.images[index]);
    const knownMetadata = new Map(this._metadataByPath);
    this.mergeImages.forEach(({ image, meta }) => knownMetadata.set(image.path, meta));
    if (this.currentMeta && this._currentMetaPath) {
      knownMetadata.set(this._currentMetaPath, this.currentMeta);
    }
    const displayedPaths = new Set(selected.map(({ path }) => path));
    this._metadataByPath = new Map(
      [...knownMetadata].filter(([path]) => displayedPaths.has(path))
    );
    this._loadingImage = true;
    this.imageRevision = Date.now();
    this.currentMeta = null;
    this._currentMetaPath = null;
    this.mergeImages = [];
    this.crop = null;
    this.selectedFormat = null;
    this.selectedSize = null;
    this._zoomed = false;
    try {
      const metadata = await Promise.all(selected.map(({ path }) => (
        this._metadataByPath.get(path) || window.electronAPI.getImageMeta(path)
      )));
      if (loadId !== this._selectionLoadId) return;
      const unreadableIndex = metadata.findIndex((meta) => !meta);
      if (unreadableIndex !== -1) {
        this._setStatus(`Could not read ${selected[unreadableIndex].name}`, 'danger');
        return;
      }

      selected.forEach((selectedImage, index) => {
        this._metadataByPath.set(selectedImage.path, metadata[index]);
      });
      this.mergeImages = selected.map((selectedImage, index) => ({
        image: selectedImage,
        meta: metadata[index],
        offsetY: 0
      }));
      const currentMetaIndex = displayIndices.indexOf(this.currentIndex);
      this.currentMeta = metadata[currentMetaIndex];
      this._currentMetaPath = selected[currentMetaIndex].path;
      const dimensions = this._workingMeta;
      const format = this._pickBestFormat(dimensions.width, dimensions.height);
      this.selectedFormat = format;
      this.selectedSize = this._pickBestSize(dimensions.width, dimensions.height, format);
      this._setStatus(this._isMergeMode ? `${selected.length} images selected` : 'Ready', 'success');
    } catch (error) {
      if (loadId !== this._selectionLoadId) return;
      console.error(error);
      this._setStatus('Could not read selected images', 'danger');
    } finally {
      if (loadId === this._selectionLoadId) this._loadingImage = false;
    }
  }

  _pickBestFormat(width, height) {
    if (!this.config.formats?.length) return null;
    return this.config.formats.reduce((best, format) => {
      const ratio = format.ratio[0] / format.ratio[1];
      const bestRatio = best.ratio[0] / best.ratio[1];
      return Math.abs(width / height - ratio) < Math.abs(width / height - bestRatio) ? format : best;
    }, this.config.formats[0]);
  }

  _pickBestSize(width, height, format) {
    const sizes = format?.sizes || [];
    if (!sizes.length) return { width: Math.round(width), height: Math.round(height) };
    const best = sizes.reduce((current, [candidateWidth, candidateHeight]) => {
      const score = (candidateWidth <= width && candidateHeight <= height ? 0 : 200000)
        + Math.abs(candidateWidth - width) + Math.abs(candidateHeight - height);
      return !current || score < current.score
        ? { width: candidateWidth, height: candidateHeight, score }
        : current;
    }, null);
    return { width: best.width, height: best.height };
  }

  _setEmptyState() {
    this.currentMeta = null;
    this._currentMetaPath = null;
    this._metadataByPath.clear();
    this.mergeImages = [];
    this.selectedIndices = [];
    this.crop = null;
    this.selectedFormat = null;
    this.selectedSize = null;
    this._zoomed = false;
  }

  _removeCurrentImage() {
    this.images = this.images.filter((_, index) => index !== this.currentIndex);
    if (this.currentIndex >= this.images.length) this.currentIndex = Math.max(0, this.images.length - 1);
    if (this.images.length) {
      this.selectedIndices = [this.currentIndex];
      this._showCurrentImage();
    }
    else this._setEmptyState();
  }

  _removeMergedImages() {
    const removedPaths = new Set(this.mergeImages.map(({ image }) => image.path));
    const firstRemovedIndex = Math.min(...this.selectedIndices);
    this.images = this.images.filter((image) => !removedPaths.has(image.path));
    if (!this.images.length) {
      this.currentIndex = 0;
      this._setEmptyState();
      return;
    }
    this.currentIndex = Math.min(firstRemovedIndex, this.images.length - 1);
    this.selectedIndices = [this.currentIndex];
    this._showCurrentImage();
  }

  async _moveToNext() {
    if (!this.images.length) return;
    this.currentIndex = (this.currentIndex + 1) % this.images.length;
    this.selectedIndices = [this.currentIndex];
    await this._showCurrentImage();
  }

  async _deleteCurrentImage() {
    const image = this._currentImage;
    if (!image) return;
    try {
      await window.electronAPI.deleteImage(image.path);
      this._removeCurrentImage();
      if (!this.images.length) this._setStatus('Queue complete', 'success');
    } catch (error) {
      console.error(error);
      this._setStatus('Could not delete image', 'danger');
    }
  }

  async _openEditor() {
    const image = this._currentImage;
    if (!image) return;
    try {
      await window.electronAPI.openEditor(image.path);
      this._setStatus('Editing in Photoshop');
      const didChange = await window.electronAPI.waitForFileChange(image.path);
      this._metadataByPath.delete(image.path);
      this.mergeImages = [];
      this.currentMeta = null;
      this._currentMetaPath = null;
      await this._showCurrentImage();
      this._setStatus(didChange ? 'Preview refreshed after edit' : 'Preview refreshed after edit', didChange ? 'success' : 'neutral');
    } catch (error) {
      console.error(error);
      this._setStatus('Could not open Photoshop', 'danger');
    }
  }

  _handleCropChanged(event) {
    this.crop = event.detail.crop;
    if (event.detail.suggestedSize) this.selectedSize = event.detail.suggestedSize;
  }

  _handleMergeImagesChanged(event) {
    this.mergeImages = event.detail.images;
  }

  async _applyTarget(target) {
    const image = this._currentImage;
    if (!image) return;
    if (!this.selectedIndices.length) {
      this._setStatus('Select at least one image', 'warn');
      return;
    }
    if ((!this._isMergeMode && !this.crop) || !this.selectedFormat || !this.selectedSize) {
      this._setStatus(this._isMergeMode ? 'No valid merge format or output size selected' : 'No crop selected', 'warn');
      return;
    }
    const size = {
      width: Math.round(this.selectedSize.width),
      height: Math.round(this.selectedSize.height)
    };
    const payload = this._isMergeMode
      ? {
          images: this.mergeImages.map((item, index) => {
            const columnLeft = Math.round(index * size.width / this.mergeImages.length);
            const columnRight = Math.round((index + 1) * size.width / this.mergeImages.length);
            const columnWidth = columnRight - columnLeft;
            const scale = Math.max(columnWidth / item.meta.width, size.height / item.meta.height);
            const imageWidth = item.meta.width * scale;
            const imageHeight = item.meta.height * scale;
            return {
              sourcePath: item.image.path,
              position: {
                x: columnLeft + (columnWidth - imageWidth) / 2 + (item.offsetX || 0),
                y: (size.height - imageHeight) / 2 + item.offsetY
              }
            };
          }),
          targetFolder: target.path,
          format: this.selectedFormat,
          size,
          overwrite: false
        }
      : {
          sourcePath: image.path,
          targetFolder: target.path,
          format: this.selectedFormat,
          size,
          crop: this.crop,
          overwrite: false
        };
    try {
      const comparison = await window.electronAPI.checkOutputFileExists(payload);
      if (comparison.exists) {
        this.pendingOverwrite = payload;
        this.overwriteMergeMode = this._isMergeMode;
        this.overwriteNewPreview = image.path;
        this.overwriteExistingPreview = comparison.outputPath;
        this.overwriteOpen = true;
        return;
      }
      await this._finalizeTarget(payload);
    } catch (error) {
      console.error(error);
      this._setStatus(error.message || 'Processing failed', 'danger');
    }
  }

  async _finalizeTarget(payload) {
    this._processingOutput = true;
    try {
      this._setStatus('Processing…');
      const outputPath = await window.electronAPI.applyTarget(payload);
      this._setStatus(`Saved: ${outputPath.split('\\').pop()}`, 'success');
      if (this._isMergeMode) this._removeMergedImages();
      else this._removeCurrentImage();
      if (!this.images.length) this._setStatus('Queue completed', 'success');
    } catch (error) {
      console.error(error);
      this._setStatus(error.message || 'Processing failed', 'danger');
    } finally {
      this._processingOutput = false;
    }
  }

  async _saveConfig(event) {
    try {
      this.config = await window.electronAPI.saveConfig(event.detail.config);
      this.configOpen = false;
      await this._loadConfig();
    } catch (error) {
      console.error(error);
      this.renderRoot.querySelector('wp-config-modal')?.setError('Could not save configuration.');
    }
  }

  async _selectBaseFolder() {
    try {
      const folder = await window.electronAPI.selectBaseFolder();
      if (folder) this.renderRoot.querySelector('wp-config-modal').selectedBaseFolder = folder;
    } catch (error) {
      console.error(error);
      this.renderRoot.querySelector('wp-config-modal')?.setError('Could not select base folder.');
    }
  }

  async _selectTargetFolder(event) {
    try {
      const folder = await window.electronAPI.selectTargetFolder(event.detail.baseFolder || '');
      if (folder) this.renderRoot.querySelector('wp-config-modal').selectedTargetFolder = folder;
    } catch (error) {
      console.error(error);
      this.renderRoot.querySelector('wp-config-modal')?.setError('Could not select target folder.');
    }
  }

  _closeOverwrite() {
    this.pendingOverwrite = null;
    this.overwriteOpen = false;
    this.overwriteMergeMode = false;
  }

  async _resolveOverwrite(overwrite) {
    if (!this.pendingOverwrite) {
      this._closeOverwrite();
      return;
    }
    const payload = { ...this.pendingOverwrite, overwrite };
    this._closeOverwrite();
    await this._finalizeTarget(payload);
  }

  render() {
    const image = this._currentImage;
    const meta = this._workingMeta;
    const metaLabel = meta
      ? `(${meta.width}×${meta.height})`
      : image ? '(unknown size)' : '';
    const filename = this._isMergeMode
      ? `${this.selectedIndices.length} images selected`
      : image?.name || (this.images.length ? 'Loading…' : 'No images found');
    const showBusyOverlay = this._loadingQueue
      || (this._loadingImage && this.selectedIndices.length > 1)
      || this._processingOutput;
    return html`
      <div class="app-shell">
        <wp-topbar
          .filename=${filename}
          .metaLabel=${metaLabel}
          .status=${this.status}
          .tone=${this.statusTone}
          @refresh-requested=${() => this._refreshQueue()}
          @config-requested=${() => { this.configOpen = true; }}
        ></wp-topbar>
        <main class="workspace">
          ${this._isMergeMode ? html`
            <wp-merge-stage .images=${this.mergeImages} .size=${this.selectedSize}
              .loading=${this._loadingImage}
              .revision=${this.imageRevision}
              @merge-images-changed=${(event) => this._handleMergeImagesChanged(event)}
            ></wp-merge-stage>
          ` : html`
            <wp-crop-stage
              .image=${image}
              .meta=${this.currentMeta}
              .format=${this.selectedFormat}
              .size=${this.selectedSize}
              .revision=${this.imageRevision}
              @crop-changed=${(event) => this._handleCropChanged(event)}
              @zoom-changed=${(event) => { this._zoomed = event.detail.zoomed; }}
            ></wp-crop-stage>
          `}
          <wp-sidebar
            .formats=${this.config.formats || []}
            .format=${this.selectedFormat}
            .size=${this.selectedSize}
            .meta=${meta}
            .targets=${this.config.targetFolders || []}
            .mergeMode=${this._isMergeMode}
            .disabled=${(!this._isMergeMode && this._zoomed) || !image || this._loadingImage}
            @format-selected=${(event) => {
              this.selectedFormat = event.detail.format;
              this.selectedSize = this._pickBestSize(meta.width, meta.height, this.selectedFormat);
            }}
            @size-selected=${(event) => { this.selectedSize = event.detail.size; }}
            @target-selected=${(event) => this._applyTarget(event.detail.target)}
            @skip-requested=${() => this._moveToNext()}
            @delete-requested=${() => this._deleteCurrentImage()}
            @edit-requested=${() => this._openEditor()}
          ></wp-sidebar>
        </main>
        <wp-gallery .images=${this.images} .currentIndex=${this.currentIndex}
          .selectedIndices=${this.selectedIndices}
          @image-selected=${(event) => {
            this.currentIndex = event.detail.index;
            this.selectedIndices = event.detail.indices;
            this._showCurrentImage();
          }}
        ></wp-gallery>
        <wp-config-modal
          .open=${this.configOpen}
          .config=${this.config}
          @config-cancelled=${() => { this.configOpen = false; }}
          @config-save-requested=${(event) => this._saveConfig(event)}
          @base-folder-requested=${() => this._selectBaseFolder()}
          @target-folder-requested=${(event) => this._selectTargetFolder(event)}
        ></wp-config-modal>
        <wp-overwrite-modal
          .open=${this.overwriteOpen}
          .mergeMode=${this.overwriteMergeMode}
          .newPreview=${this.overwriteNewPreview}
          .existingPreview=${this.overwriteExistingPreview}
          @overwrite-cancelled=${() => this._closeOverwrite()}
          @overwrite-keep-both=${() => this._resolveOverwrite(false)}
          @overwrite-confirmed=${() => this._resolveOverwrite(true)}
        ></wp-overwrite-modal>
      </div>
      <div class="busy-overlay" ?hidden=${!showBusyOverlay} aria-hidden="true"></div>
    `;
  }
}

customElements.define('wp-app', WpApp);

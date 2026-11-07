import { css, html } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';
import { ComponentElement, emit, clamp, clampCrop, defaultCrop, bestSizeForCrop } from './shared.js';

export class WpCropStage extends ComponentElement {
  static properties = {
    image: { attribute: false },
    meta: { attribute: false },
    format: { attribute: false },
    size: { attribute: false },
    revision: { type: Number },
    _crop: { state: true },
    _zoomed: { state: true },
    _imageStyle: { state: true },
    _drag: { state: true }
  };

  static styles = [ComponentElement.styles, css`
    .crop-stage {
      position: relative;
      width: 100%;
      height: calc(100vh - 280px);
      min-height: 540px;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      border: 1px solid var(--border-color-subtle);
      border-radius: var(--radius-card);
      background: linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.95));
      user-select: none;
    }
    .preview-image {
      position: absolute;
      top: 0;
      left: 0;
      max-width: none;
      max-height: none;
      object-fit: contain;
      box-shadow: 0 18px 42px rgba(15, 23, 42, 0.5);
      user-select: none;
      pointer-events: none;
    }
    .crop-box {
      position: absolute;
      border-radius: 2px;
      box-shadow: 0 0 0 9999px rgba(15, 23, 42, 0.52);
      cursor: move;
      transition: border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease;
    }
    .crop-box.warning {
      background: rgba(239, 68, 68, 0.08);
    }
    .crop-outline {
      position: absolute;
      inset: 0;
      border: 1px dashed rgba(125, 211, 252, 0.9);
    }
    .crop-box.warning .crop-outline {
      border-color: rgba(254, 202, 202, 0.9);
    }
    .crop-handle {
      position: absolute;
      z-index: 3;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #00a7d5;
      box-shadow: 0 0 0 2px rgba(15, 23, 42, 0.7);
    }
    .crop-box.warning .crop-handle { background: #fca5a5; }
    .handle-nw { top: -5px; left: -5px; cursor: nwse-resize; }
    .handle-ne { top: -5px; right: -5px; cursor: nesw-resize; }
    .handle-sw { bottom: -5px; left: -5px; cursor: nesw-resize; }
    .handle-se { bottom: -5px; right: -5px; cursor: nwse-resize; }
    .handle-n { top: -5px; left: 50%; transform: translateX(-50%); cursor: ns-resize; }
    .handle-s { bottom: -5px; left: 50%; transform: translateX(-50%); cursor: ns-resize; }
    .handle-e { top: 50%; right: -5px; transform: translateY(-50%); cursor: ew-resize; }
    .handle-w { top: 50%; left: -5px; transform: translateY(-50%); cursor: ew-resize; }
    .hidden { display: none !important; }
    .crop-empty { color: var(--muted); }
    @media (max-width: 1100px) {
      .crop-stage { height: 52vh; min-height: 420px; }
    }
  `];

  constructor() {
    super();
    this.image = null;
    this.meta = null;
    this.format = null;
    this.size = null;
    this.revision = 0;
    this._crop = null;
    this._zoomed = false;
    this._imageStyle = {};
    this._drag = null;
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
    this._resizeObserver = null;
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('pointermove', this._onPointerMove);
    window.addEventListener('pointerup', this._onPointerUp);
  }

  disconnectedCallback() {
    window.removeEventListener('pointermove', this._onPointerMove);
    window.removeEventListener('pointerup', this._onPointerUp);
    this._resizeObserver?.disconnect();
    super.disconnectedCallback();
  }

  firstUpdated() {
    const stage = this.renderRoot.querySelector('.crop-stage');
    this._resizeObserver = new ResizeObserver(() => this._fitImage());
    this._resizeObserver.observe(stage);
  }

  willUpdate(changed) {
    if (changed.has('image') || changed.has('meta') || changed.has('format')) {
      this._zoomed = false;
      this._crop = defaultCrop(this.meta?.width, this.meta?.height, this.format);
      this._notifyCrop();
    }
  }

  updated(changed) {
    if (changed.has('image') || changed.has('meta') || changed.has('_zoomed')) {
      this._fitImage();
    }
  }

  _notifyCrop() {
    if (!this._crop) return;
    emit(this, 'crop-changed', {
      crop: { ...this._crop },
      suggestedSize: bestSizeForCrop(this._crop, this.format)
    });
  }

  _fitImage() {
    if (!this.meta) return;
    const stage = this.renderRoot.querySelector('.crop-stage');
    if (!stage) return;
    const scale = this._zoomed
      ? 1
      : Math.min(1, stage.clientWidth / this.meta.width, stage.clientHeight / this.meta.height);
    const width = this.meta.width * scale;
    const height = this.meta.height * scale;
    this._imageStyle = {
      width: `${width}px`,
      height: `${height}px`,
      left: `${(stage.clientWidth - width) / 2}px`,
      top: `${(stage.clientHeight - height) / 2}px`
    };
    this.requestUpdate();
  }

  _imageBounds() {
    const stage = this.renderRoot.querySelector('.crop-stage').getBoundingClientRect();
    const image = this.renderRoot.querySelector('.preview-image').getBoundingClientRect();
    return {
      stage,
      left: image.left - stage.left,
      top: image.top - stage.top,
      width: image.width,
      height: image.height
    };
  }

  _cropStyle() {
    if (!this._crop || !this.meta || this._zoomed) return {};
    const imageLeft = Number.parseFloat(this._imageStyle.left) || 0;
    const imageTop = Number.parseFloat(this._imageStyle.top) || 0;
    const imageWidth = Number.parseFloat(this._imageStyle.width) || 0;
    const imageHeight = Number.parseFloat(this._imageStyle.height) || 0;
    return {
      left: `${imageLeft + this._crop.x / this.meta.width * imageWidth}px`,
      top: `${imageTop + this._crop.y / this.meta.height * imageHeight}px`,
      width: `${this._crop.width / this.meta.width * imageWidth}px`,
      height: `${this._crop.height / this.meta.height * imageHeight}px`
    };
  }

  _startDrag(event) {
    if (this._zoomed || !this._crop || !this.meta || !this.format) return;
    const bounds = this._imageBounds();
    const handle = event.target.closest('.crop-handle');
    this._drag = {
      mode: handle?.dataset.handle || 'move',
      rect: { ...this._crop },
      pointerX: (event.clientX - bounds.stage.left - bounds.left) / bounds.width * this.meta.width,
      pointerY: (event.clientY - bounds.stage.top - bounds.top) / bounds.height * this.meta.height
    };
    event.preventDefault();
  }

  _resizeCrop(start, mode, x, y) {
    const ratio = this.format.ratio[0] / this.format.ratio[1];
    const { width: imageWidth, height: imageHeight } = this.meta;

    if (mode === 'move') {
      return clampCrop({
        ...start,
        x: start.x + x - this._drag.pointerX,
        y: start.y + y - this._drag.pointerY
      }, imageWidth, imageHeight);
    }

    let width;
    let height;
    if (mode === 'n' || mode === 's') {
      const anchorY = mode === 'n' ? start.y + start.height : start.y;
      const maxHeight = mode === 'n' ? anchorY : imageHeight - anchorY;
      height = clamp(mode === 'n' ? anchorY - y : y - anchorY, 1, maxHeight);
      width = Math.min(height * ratio, imageWidth);
      height = width / ratio;
      const xPosition = clamp(start.x + start.width / 2 - width / 2, 0, imageWidth - width);
      const yPosition = mode === 'n' ? anchorY - height : anchorY;
      return clampCrop({ x: xPosition, y: yPosition, width, height }, imageWidth, imageHeight);
    }

    if (mode === 'e' || mode === 'w') {
      const anchorX = mode === 'w' ? start.x + start.width : start.x;
      const maxWidth = mode === 'w' ? anchorX : imageWidth - anchorX;
      width = clamp(mode === 'w' ? anchorX - x : x - anchorX, 1, maxWidth);
      height = Math.min(width / ratio, imageHeight);
      width = height * ratio;
      const xPosition = mode === 'w' ? anchorX - width : anchorX;
      const yPosition = clamp(start.y + start.height / 2 - height / 2, 0, imageHeight - height);
      return clampCrop({ x: xPosition, y: yPosition, width, height }, imageWidth, imageHeight);
    }

    const anchorX = mode.includes('e') ? start.x : start.x + start.width;
    const anchorY = mode.includes('s') ? start.y : start.y + start.height;
    const maxWidth = mode.includes('e') ? imageWidth - anchorX : anchorX;
    const maxHeight = mode.includes('s') ? imageHeight - anchorY : anchorY;
    width = Math.max(Math.abs(x - anchorX), Math.abs(y - anchorY) * ratio);
    width = clamp(width, 1, Math.min(maxWidth, maxHeight * ratio));
    height = width / ratio;
    const left = mode.includes('e') ? anchorX : anchorX - width;
    const top = mode.includes('s') ? anchorY : anchorY - height;
    return clampCrop({ x: left, y: top, width, height }, imageWidth, imageHeight);
  }

  _onPointerMove(event) {
    if (!this._drag || !this.meta) return;
    const bounds = this._imageBounds();
    const x = (event.clientX - bounds.stage.left - bounds.left) / bounds.width * this.meta.width;
    const y = (event.clientY - bounds.stage.top - bounds.top) / bounds.height * this.meta.height;
    this._crop = this._resizeCrop(this._drag.rect, this._drag.mode, x, y);
    this._notifyCrop();
  }

  _onPointerUp() {
    this._drag = null;
  }

  _toggleZoom(event) {
    if (!this.meta) return;
    event.preventDefault();
    const zoomingIn = !this._zoomed;
    let zoomPosition;
    if (zoomingIn) {
      const stage = this.renderRoot.querySelector('.crop-stage');
      const stageBounds = stage.getBoundingClientRect();
      const imageBounds = this.renderRoot.querySelector('.preview-image').getBoundingClientRect();
      const imageX = clamp(event.clientX - imageBounds.left, 0, imageBounds.width)
        / imageBounds.width * this.meta.width;
      const imageY = clamp(event.clientY - imageBounds.top, 0, imageBounds.height)
        / imageBounds.height * this.meta.height;
      const cursorX = event.clientX - stageBounds.left - stage.clientLeft;
      const cursorY = event.clientY - stageBounds.top - stage.clientTop;
      const maxLeft = stage.clientWidth - this.meta.width;
      const maxTop = stage.clientHeight - this.meta.height;
      zoomPosition = {
        left: clamp(cursorX - imageX, Math.min(0, maxLeft), Math.max(0, maxLeft)),
        top: clamp(cursorY - imageY, Math.min(0, maxTop), Math.max(0, maxTop))
      };
    }

    this._zoomed = zoomingIn;
    this.updateComplete.then(() => {
      if (zoomingIn) {
        this._imageStyle = {
          width: `${this.meta.width}px`,
          height: `${this.meta.height}px`,
          left: `${zoomPosition.left}px`,
          top: `${zoomPosition.top}px`
        };
        this.requestUpdate();
      }
      emit(this, 'zoom-changed', { zoomed: zoomingIn });
    });
  }

  render() {
    const isTooSmall = this._crop && this.size && (
      this._crop.width < this.size.width || this._crop.height < this.size.height
    );
    return html`
      <div class="crop-stage" @contextmenu=${this._toggleZoom}>
        ${this.image ? html`<img class="preview-image" src=${`${this.image.path}?v=${this.revision}`} alt=${this.image.name}
          style=${styleMap(this._imageStyle)} draggable="false" />` : html`<div class="crop-empty">No image selected</div>`}
        ${this._crop ? html`
          <div class="crop-box ${isTooSmall ? 'warning' : ''} ${this._zoomed ? 'hidden' : ''}"
            style=${styleMap(this._cropStyle())} @pointerdown=${this._startDrag}>
            <div class="crop-outline"></div>
            ${repeat(['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'], (handle) => handle,
              (handle) => html`<div class="crop-handle handle-${handle}" data-handle=${handle}></div>`)}
          </div>
        ` : ''}
      </div>
    `;
  }
}
customElements.define('wp-crop-stage', WpCropStage);

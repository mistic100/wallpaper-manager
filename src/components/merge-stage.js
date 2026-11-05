import { css, html } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';
import { ComponentElement, emit, clamp } from './shared.js';

export class WpMergeStage extends ComponentElement {
  static properties = {
    images: { attribute: false },
    size: { attribute: false },
    loading: { type: Boolean },
    revision: { type: Number },
    _drag: { state: true }
  };

  static styles = [ComponentElement.styles, css`
    .merge-stage {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: calc(100vh - 280px);
      min-height: 540px;
      overflow: hidden;
      border: 1px solid var(--border-color-subtle);
      border-radius: var(--radius-card);
      background: linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.95));
      user-select: none;
    }
    .merge-canvas {
      display: flex;
      width: 100%;
      height: auto;
      flex: 0 0 auto;
      aspect-ratio: var(--target-ratio);
      overflow: hidden;
      box-shadow: 0 18px 42px rgba(15, 23, 42, 0.5);
    }
    .merge-column {
      position: relative;
      flex: 1 1 0;
      min-width: 0;
      overflow: hidden;
      touch-action: none;
      cursor: grab;
    }
    .merge-column:active { cursor: grabbing; }
    .merge-image {
      position: absolute;
      max-width: none;
      pointer-events: none;
      user-select: none;
    }
    .merge-empty { color: var(--muted); }
    @media (max-width: 1100px) {
      .merge-stage { height: 52vh; min-height: 420px; }
    }
  `];

  constructor() {
    super();
    this.images = [];
    this.size = null;
    this.loading = false;
    this.revision = 0;
    this._drag = null;
    this._resizeObserver = null;
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
  }

  firstUpdated() {
    const stage = this.renderRoot.querySelector('.merge-stage');
    this._resizeObserver = new ResizeObserver(() => this.requestUpdate());
    this._resizeObserver.observe(stage);
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

  _canvasStyle() {
    if (!this.size) return {};
    const stage = this.renderRoot.querySelector('.merge-stage');
    if (!stage) return {};

    const scale = Math.min(stage.clientWidth / this.size.width, stage.clientHeight / this.size.height);
    return {
      width: `${this.size.width * scale}px`,
      height: `${this.size.height * scale}px`
    };
  }

  _imageDimensions(item) {
    const columnWidth = this.size.width / this.images.length;
    const scale = Math.max(columnWidth / item.meta.width, this.size.height / item.meta.height);
    return {
      width: item.meta.width * scale,
      height: item.meta.height * scale
    };
  }

  _imageStyle(item) {
    const { width, height } = this._imageDimensions(item);
    const centeredLeft = (this.size.width / this.images.length - width) / 2;
    const centeredTop = (this.size.height - height) / 2;
    const left = (centeredLeft + (item.offsetX || 0)) / (this.size.width / this.images.length) * 100;
    const top = (centeredTop + item.offsetY) / this.size.height * 100;
    return {
      left: `${left}%`,
      top: `${top}%`,
      width: `${width / (this.size.width / this.images.length) * 100}%`,
      height: `${height / this.size.height * 100}%`
    };
  }

  _startDrag(event, index) {
    if (!this.size) return;
    this._drag = {
      index,
      pointerX: event.clientX,
      pointerY: event.clientY,
      offsetX: this.images[index].offsetX || 0,
      offsetY: this.images[index].offsetY
    };
    event.preventDefault();
  }

  _onPointerMove(event) {
    if (!this._drag || !this.size) return;
    const canvas = this.renderRoot.querySelector('.merge-canvas');
    const item = this.images[this._drag.index];
    if (!canvas || !item) return;

    const columnWidth = this.size.width / this.images.length;
    const { width: imageWidth, height: imageHeight } = this._imageDimensions(item);
    const centeredLeft = (columnWidth - imageWidth) / 2;
    const centeredTop = (this.size.height - imageHeight) / 2;
    const minLeft = columnWidth - imageWidth;
    const maxLeft = 0;
    const minTop = Math.min(0, this.size.height - imageHeight);
    const maxTop = Math.max(0, this.size.height - imageHeight);
    const movementX = (event.clientX - this._drag.pointerX) / canvas.clientWidth * this.size.width;
    const movementY = (event.clientY - this._drag.pointerY) / canvas.clientHeight * this.size.height;
    const left = clamp(centeredLeft + this._drag.offsetX + movementX, minLeft, maxLeft);
    const top = clamp(centeredTop + this._drag.offsetY + movementY, minTop, maxTop);
    const offsetX = left - centeredLeft;
    const offsetY = top - centeredTop;
    const images = this.images.map((image, index) => index === this._drag.index
      ? { ...image, offsetX, offsetY }
      : image);
    emit(this, 'merge-images-changed', { images });
  }

  _onPointerUp() {
    this._drag = null;
  }

  render() {
    if (!this.size || !this.images.length) {
      const message = this.loading ? 'Loading, please wait' : 'Select two or more images to merge';
      return html`<div class="merge-stage"><div class="merge-empty">${message}</div></div>`;
    }

    return html`
      <div class="merge-stage">
        <div class="merge-canvas" style=${styleMap({
          '--target-ratio': `${this.size.width} / ${this.size.height}`,
          ...this._canvasStyle()
        })}>
          ${repeat(this.images, (item) => item.image.path, (item, index) => html`
            <div class="merge-column" aria-label=${`Column ${index + 1}: ${item.image.name}`}
              @pointerdown=${(event) => this._startDrag(event, index)}>
              <img class="merge-image" src=${`${item.image.path}?v=${this.revision}`}
                alt=${item.image.name} style=${styleMap(this._imageStyle(item))} draggable="false" />
            </div>
          `)}
        </div>
      </div>
    `;
  }
}

customElements.define('wp-merge-stage', WpMergeStage);

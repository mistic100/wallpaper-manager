import { css, html } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { ComponentElement, emit } from './shared.js';

export class WpGallery extends ComponentElement {
  static properties = {
    images: { attribute: false },
    currentIndex: { type: Number, attribute: 'current-index' },
    selectedIndices: { attribute: false }
  };

  static styles = [ComponentElement.styles, css`
    .gallery-bar {
      margin-top: var(--block-gap);
      padding: var(--space-2);
      border: 1px solid var(--border-color-subtle);
      border-radius: var(--radius-panel);
      background: rgba(15, 23, 42, 0.75);
      box-shadow: var(--shadow);
    }
    .thumbnail-strip {
      display: flex;
      gap: var(--space-1);
      overflow-x: auto;
      overflow-y: hidden;
      padding-bottom: 2px;
      scroll-behavior: smooth;
      scroll-snap-type: x proximity;
      overscroll-behavior-x: contain;
      touch-action: pan-x;
      -webkit-overflow-scrolling: touch;
    }
    .thumbnail-strip::-webkit-scrollbar { height: 8px; }
    .thumbnail-strip::-webkit-scrollbar-thumb {
      border-radius: var(--radius-pill);
      background: rgba(148, 163, 184, 0.45);
    }
    .thumbnail {
      flex: 0 0 auto;
      width: auto;
      height: 135px;
      padding: 0;
      overflow: hidden;
      border: 0;
      background: transparent;
      color: inherit;
      font: inherit;
      cursor: pointer;
      border-radius: var(--radius-control);
      margin: 2px;
    }
    .thumbnail img {
      display: block;
      width: auto;
      height: 100%;
      border-radius: var(--radius-control);
      object-fit: cover;
    }
    .thumbnail[aria-pressed="true"] { outline: 2px solid var(--accent); }
    .thumbnail:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  `];

  constructor() {
    super();
    this.images = [];
    this.currentIndex = 0;
    this.selectedIndices = [0];
    this._selectionAnchor = 0;
  }

  firstUpdated() {
    const strip = this.renderRoot.querySelector('.thumbnail-strip');
    strip.addEventListener('wheel', (event) => {
      if (Math.abs(event.deltaY) > 0) {
        event.preventDefault();
        strip.scrollLeft += event.deltaY;
      }
    }, { passive: false });
  }

  _selectImage(index, event) {
    let indices;
    let currentIndex = index;
    if (event.ctrlKey) {
      const selected = new Set(this.selectedIndices);
      if (selected.has(index)) selected.delete(index);
      else selected.add(index);
      indices = [...selected].sort((a, b) => a - b);
      if (!selected.has(index) && indices.length) currentIndex = indices[0];
    } else if (event.shiftKey) {
      const anchor = Math.min(this._selectionAnchor ?? this.currentIndex, this.images.length - 1);
      const start = Math.min(anchor, index);
      const end = Math.max(anchor, index);
      indices = Array.from({ length: end - start + 1 }, (_, offset) => start + offset);
    } else {
      this._selectionAnchor = index;
      indices = [index];
    }

    emit(this, 'image-selected', { index: currentIndex, indices });
  }

  render() {
    return html`
      <footer class="gallery-bar">
        <div class="thumbnail-strip">
          ${repeat(this.images, (image) => image.path, (image, index) => html`
            <button type="button" class="thumbnail" title=${`${index + 1}. ${image.name}`}
              aria-label=${`Open ${image.name}`} aria-pressed=${String(this.selectedIndices.includes(index))}
              @click=${(event) => this._selectImage(index, event)}>
              <img src=${image.path} alt=${image.name} draggable="false" />
            </button>
          `)}
        </div>
      </footer>
    `;
  }
}
customElements.define('wp-gallery', WpGallery);

import { LitElement, css } from 'lit';

export class ComponentElement extends LitElement {
  static styles = css`
    :host { 
      display: block; 
      box-sizing: border-box;
    }
    :host([hidden]) { display: none; }
    *, *::before, *::after { 
      box-sizing: border-box;
      scrollbar-color: rgba(148, 163, 184, 0.6) transparent;
      scrollbar-width: thin;
    }
  `;
}

export function emit(element, name, detail = {}) {
  element.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true, detail }));
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function clampCrop(rect, width, height) {
  const cropWidth = Math.min(Math.max(rect.width, 1), width);
  const cropHeight = Math.min(Math.max(rect.height, 1), height);
  return {
    x: Math.round(clamp(rect.x, 0, Math.max(0, width - cropWidth))),
    y: Math.round(clamp(rect.y, 0, Math.max(0, height - cropHeight))),
    width: Math.round(cropWidth),
    height: Math.round(cropHeight)
  };
}

export function defaultCrop(width, height, format) {
  if (!width || !height || !format?.ratio?.length) return null;
  const targetRatio = format.ratio[0] / format.ratio[1];
  const imageRatio = width / height;
  const cropWidth = imageRatio > targetRatio ? height * targetRatio : width;
  const cropHeight = imageRatio > targetRatio ? height : width / targetRatio;
  return clampCrop({ x: (width - cropWidth) / 2, y: (height - cropHeight) / 2, width: cropWidth, height: cropHeight }, width, height);
}

export function bestSizeForCrop(rect, format) {
  const sizes = format?.sizes || [];
  if (!rect || !sizes.length) return null;
  const fitting = sizes.filter(([width, height]) => width <= rect.width && height <= rect.height);
  const candidates = fitting.length ? fitting : sizes;
  const best = candidates.reduce((current, [width, height]) => {
    const score = width <= rect.width && height <= rect.height
      ? rect.width - width + rect.height - height
      : Math.abs(width - rect.width) + Math.abs(height - rect.height);
    return !current || score < current.score ? { width, height, score } : current;
  }, null);
  return best ? { width: best.width, height: best.height } : null;
}

export function normalizeFolderPath(value) {
  return String(value || '').trim().replace(/\\/g, '/').replace(/\/+/g, '/');
}

export function isSafeTargetPath(value) {
  const normalized = normalizeFolderPath(value);
  if (!normalized || normalized === '.' || normalized === '..') return false;
  if (/^[A-Za-z]:[\\/]/.test(normalized) || normalized.startsWith('/')) return false;
  return !normalized.split('/').includes('..');
}

export function parseRatio(value) {
  const parts = String(value || '').replace(/\s+/g, '').replace(/[x/]/gi, ':').split(':');
  if (parts.length !== 2) return null;
  const [width, height] = parts.map(Number);
  return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0 ? [width, height] : null;
}

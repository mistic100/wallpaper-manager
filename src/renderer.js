const state = {
  config: null,
  images: [],
  currentIndex: 0,
  selectedFormat: null,
  selectedSize: null,
  currentMeta: null,
  cropRect: null,
  dragOrigin: null,
  isDragging: false,
  isZoomed: false
};

const refs = {
  filename: document.getElementById('filename'),
  filenameMeta: document.getElementById('filename-meta'),
  statusPill: document.getElementById('status-pill'),
  configButton: document.getElementById('config-button'),
  configModal: document.getElementById('config-modal'),
  configCloseButton: document.getElementById('config-close-button'),
  configForm: document.getElementById('config-form'),
  baseFolderInput: document.getElementById('base-folder-input'),
  selectBaseFolderButton: document.getElementById('select-base-folder-button'),
  addFormatButton: document.getElementById('add-format-button'),
  addTargetButton: document.getElementById('add-target-button'),
  formatConfigList: document.getElementById('format-config-list'),
  targetConfigList: document.getElementById('target-config-list'),
  configMessage: document.getElementById('config-message'),
  configCancelButton: document.getElementById('config-cancel-button'),
  formatButtons: document.getElementById('format-buttons'),
  outputSize: document.getElementById('output-size'),
  targetButtons: document.getElementById('target-buttons'),
  thumbnailStrip: document.getElementById('thumbnail-strip'),
  refreshButton: document.getElementById('refresh-button'),
  previewImage: document.getElementById('preview-image'),
  cropStage: document.getElementById('crop-stage'),
  cropBox: document.getElementById('crop-box'),
  skipButton: document.getElementById('skip-button'),
  deleteButton: document.getElementById('delete-button'),
  editButton: document.getElementById('edit-button')
};

function setStatus(message, tone = 'neutral') {
  refs.statusPill.textContent = message;
  const tones = {
    neutral: {
      background: 'rgba(59,130,246,0.12)',
      border: 'rgba(96,165,250,0.5)'
    },
    success: {
      background: 'rgba(34,197,94,0.12)',
      border: 'rgba(74,222,128,0.5)'
    },
    warn: {
      background: 'rgba(245,158,11,0.12)',
      border: 'rgba(251,191,36,0.55)'
    },
    danger: {
      background: 'rgba(239,68,68,0.12)',
      border: 'rgba(248,113,113,0.55)'
    }
  };
  const selected = tones[tone] || tones.neutral;
  refs.statusPill.style.background = selected.background;
  refs.statusPill.style.borderColor = selected.border;
  refs.statusPill.style.color = selected.border;
}

function parseRatioString(value) {
  const clean = String(value ?? '').replace(/\s+/g, '').replace(/x/gi, ':').replace(/\//g, ':');
  if (!clean) return null;
  const parts = clean.split(':');
  if (parts.length !== 2) return null;
  const [left, right] = parts.map(Number);
  if (!Number.isFinite(left) || !Number.isFinite(right) || left <= 0 || right <= 0) {
    return null;
  }
  return [left, right];
}

function formatRatioString(ratio) {
  if (!Array.isArray(ratio) || ratio.length !== 2) return '';
  return `${ratio[0]}:${ratio[1]}`;
}

function sortSizesForSave(sizes) {
  return [...sizes].sort((left, right) => (left[0] * left[1]) - (right[0] * right[1]));
}

function ratioKeyFromArray(ratio) {
  const safe = Array.isArray(ratio) && ratio.length >= 2 ? ratio.slice(0, 2) : [0, 0];
  return `${Number(safe[0])}:${Number(safe[1])}`;
}

function normalizeFolderKey(folderValue) {
  return String(folderValue || '').trim().replace(/\\/g, '/').replace(/\/+/g, '/');
}

function isSafeTargetFolderPath(folderValue) {
  const normalized = normalizeFolderKey(folderValue);
  if (!normalized || normalized === '.' || normalized === '..') {
    return false;
  }

  if (normalized.startsWith('../') || normalized.startsWith('..\\') || normalized === '..') {
    return false;
  }

  if (/^[A-Za-z]:[\\/]/.test(normalized) || normalized.startsWith('/') || normalized.startsWith('\\')) {
    return false;
  }

  return !normalized.split('/').includes('..');
}

function showConfigMessage(message, tone = 'error') {
  refs.configMessage.textContent = message;
  refs.configMessage.classList.toggle('success', tone === 'success');
}

function showConfigModal() {
  state.config ??= { baseFolder: '', formats: [], targetFolders: [] };
  refs.configModal.classList.remove('hidden');
  refs.configModal.setAttribute('aria-hidden', 'false');
  refs.baseFolderInput.value = state.config.baseFolder || '';
  renderConfigEditor();
}

function hideConfigModal() {
  refs.configModal.classList.add('hidden');
  refs.configModal.setAttribute('aria-hidden', 'true');
}

function renderConfigEditor() {
  state.config ??= { baseFolder: '', formats: [], targetFolders: [] };
  refs.baseFolderInput.value = state.config.baseFolder || '';

  refs.formatConfigList.innerHTML = '';
  if (!state.config.formats.length) {
    const empty = document.createElement('div');
    empty.className = 'config-empty';
    empty.textContent = 'No formats configured yet.';
    refs.formatConfigList.appendChild(empty);
  } else {
    state.config.formats.forEach((format, formatIndex) => {
      const item = document.createElement('div');
      item.className = 'config-format-item';

      const ratioRow = document.createElement('div');
      ratioRow.className = 'config-format-row';

      const ratioLabel = document.createElement('label');
      ratioLabel.className = 'config-inline-label';
      ratioLabel.textContent = 'Format ratio:';

      const ratioInput = document.createElement('input');
      ratioInput.type = 'text';
      ratioInput.value = formatRatioString(format.ratio);
      ratioInput.placeholder = '16:9';
      ratioInput.addEventListener('input', () => {
        const ratio = parseRatioString(ratioInput.value);
        if (ratio) {
          state.config.formats[formatIndex].ratio = ratio;
          showConfigMessage('');
        } else {
          showConfigMessage('Use a ratio like 16:9 or 16/9.', 'error');
        }
      });

      const deleteFormatButton = document.createElement('button');
      deleteFormatButton.type = 'button';
      deleteFormatButton.title = 'Delete format';
      deleteFormatButton.setAttribute('aria-label', 'Delete format');
      deleteFormatButton.innerHTML = '<i class="fa-solid fa-trash-can" aria-hidden="true"></i>';
      deleteFormatButton.addEventListener('click', () => {
        state.config.formats.splice(formatIndex, 1);
        renderConfigEditor();
      });

      ratioRow.appendChild(ratioLabel);
      ratioRow.appendChild(ratioInput);
      ratioRow.appendChild(deleteFormatButton);
      item.appendChild(ratioRow);

      const separator = document.createElement('div');
      separator.className = 'config-format-separator';
      item.appendChild(separator);

      const sizesHeader = document.createElement('div');
      sizesHeader.className = 'config-sizes-header';

      const sizesTitle = document.createElement('h4');
      sizesTitle.className = 'config-sizes-title';
      sizesTitle.textContent = 'Sizes';

      const addSizeButton = document.createElement('button');
      addSizeButton.type = 'button';
      addSizeButton.className = 'secondary-button';
      addSizeButton.textContent = 'Add size';
      addSizeButton.addEventListener('click', () => {
        state.config.formats[formatIndex].sizes.push([]);
        renderConfigEditor();
      });

      sizesHeader.appendChild(sizesTitle);
      sizesHeader.appendChild(addSizeButton);
      item.appendChild(sizesHeader);

      const sizeList = document.createElement('div');
      sizeList.className = 'config-size-list';

      if (!format.sizes.length) {
        const empty = document.createElement('div');
        empty.className = 'config-empty';
        empty.textContent = 'No sizes configured.';
        sizeList.appendChild(empty);
      } else {
        format.sizes.forEach((size, sizeIndex) => {
          const sizeRow = document.createElement('div');
          sizeRow.className = 'config-size-row';

          const widthLabel = document.createElement('label');
          widthLabel.className = 'config-inline-label';
          widthLabel.textContent = 'Width:';

          const widthInput = document.createElement('input');
          widthInput.type = 'number';
          widthInput.min = '1';
          widthInput.value = size[0];
          widthInput.addEventListener('input', () => {
            const ratio = parseRatioString(ratioInput.value) || format.ratio;
            const nextWidth = Number(widthInput.value) || 0;
            if (!nextWidth) return;
            const nextHeight = Math.round((nextWidth * ratio[1]) / ratio[0]);
            state.config.formats[formatIndex].sizes[sizeIndex] = [nextWidth, nextHeight];
            heightInput.value = nextHeight;
            showConfigMessage('');
          });

          const heightLabel = document.createElement('label');
          heightLabel.className = 'config-inline-label';
          heightLabel.textContent = 'Height:';

          const heightInput = document.createElement('input');
          heightInput.type = 'number';
          heightInput.min = '1';
          heightInput.value = size[1];
          heightInput.addEventListener('input', () => {
            const ratio = parseRatioString(ratioInput.value) || format.ratio;
            const nextHeight = Number(heightInput.value) || 0;
            if (!nextHeight) return;
            const nextWidth = Math.round((nextHeight * ratio[0]) / ratio[1]);
            state.config.formats[formatIndex].sizes[sizeIndex] = [nextWidth, nextHeight];
            widthInput.value = nextWidth;
            showConfigMessage('');
          });

          const removeSizeButton = document.createElement('button');
          removeSizeButton.type = 'button';
          removeSizeButton.className = 'remove-size-button';
          removeSizeButton.title = 'Remove size';
          removeSizeButton.setAttribute('aria-label', 'Remove size');
          removeSizeButton.innerHTML = '<i class="fa-solid fa-trash-can" aria-hidden="true"></i>';
          removeSizeButton.addEventListener('click', () => {
            state.config.formats[formatIndex].sizes.splice(sizeIndex, 1);
            renderConfigEditor();
          });

          sizeRow.appendChild(widthLabel);
          sizeRow.appendChild(widthInput);
          sizeRow.appendChild(heightLabel);
          sizeRow.appendChild(heightInput);
          sizeRow.appendChild(removeSizeButton);
          sizeList.appendChild(sizeRow);
        });
      }

      item.appendChild(sizeList);
      refs.formatConfigList.appendChild(item);
    });
  }

  refs.targetConfigList.innerHTML = '';
  if (!state.config.targetFolders.length) {
    const empty = document.createElement('div');
    empty.className = 'config-empty';
    empty.textContent = 'No target folders configured yet.';
    refs.targetConfigList.appendChild(empty);
    return;
  }

  const item = document.createElement('div');
  item.className = 'config-target-item';

  state.config.targetFolders.forEach((folderName, targetIndex) => {
    const row = document.createElement('div');
    row.className = 'config-target-row';

    const folderInput = document.createElement('code');
    folderInput.className = 'config-target-path';
    folderInput.textContent = folderName;

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.title = 'Remove folder';
    removeButton.setAttribute('aria-label', 'Remove folder');
    removeButton.className = 'config-delete-button';
    removeButton.innerHTML = '<i class="fa-solid fa-trash-can" aria-hidden="true"></i>';
    removeButton.addEventListener('click', () => {
      state.config.targetFolders.splice(targetIndex, 1);
      renderConfigEditor();
    });

    row.appendChild(folderInput);
    row.appendChild(removeButton);
    item.appendChild(row);
  });

  refs.targetConfigList.appendChild(item);
}

function pickBestFormat(imageWidth, imageHeight, formats) {
  if (!formats || !formats.length) return null;
  const ratio = imageWidth / imageHeight;
  let best = formats[0];
  let smallestDistance = Number.POSITIVE_INFINITY;

  for (const format of formats) {
    const [w, h] = format.ratio;
    const targetRatio = w / h;
    const distance = Math.abs(ratio - targetRatio);
    if (distance < smallestDistance) {
      smallestDistance = distance;
      best = format;
    }
  }

  return best;
}

function pickBestSize(imageWidth, imageHeight, format) {
  const candidates = (format?.sizes || []).map(([width, height]) => ({ width, height }));
  if (!candidates.length) {
    return { width: Math.round(imageWidth), height: Math.round(imageHeight) };
  }

  let best = candidates[0];
  let bestScore = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    const penalty = (candidate.width <= imageWidth && candidate.height <= imageHeight) ? 0 : 200_000;
    const score = penalty + Math.abs(candidate.width - imageWidth) + Math.abs(candidate.height - imageHeight);
    if (score < bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  return best;
}

function pickBestMatchingSizeFromCrop(rect, format) {
  const candidates = (format?.sizes || []).map(([width, height]) => ({ width, height }));
  if (!rect || !candidates.length) {
    return null;
  }

  const fitting = candidates.filter((candidate) => candidate.width <= rect.width && candidate.height <= rect.height);
  const pool = fitting.length ? fitting : candidates;

  let best = pool[0];
  let bestScore = Number.POSITIVE_INFINITY;

  for (const candidate of pool) {
    const score = (candidate.width <= rect.width && candidate.height <= rect.height)
      ? (rect.width - candidate.width) + (rect.height - candidate.height)
      : Math.abs(candidate.width - rect.width) + Math.abs(candidate.height - rect.height);

    if (score < bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  return best;
}

function clampCropRect(rect, imageWidth, imageHeight) {
  const width = Math.min(Math.max(rect.width, 1), imageWidth);
  const height = Math.min(Math.max(rect.height, 1), imageHeight);
  const x = Math.min(Math.max(rect.x, 0), Math.max(0, imageWidth - width));
  const y = Math.min(Math.max(rect.y, 0), Math.max(0, imageHeight - height));

  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height)
  };
}

function computeDefaultCrop(width, height, format) {
  const [ratioW, ratioH] = format.ratio;
  const targetRatio = ratioW / ratioH;
  const imageRatio = width / height;

  let cropWidth;
  let cropHeight;

  if (imageRatio > targetRatio) {
    cropHeight = height;
    cropWidth = height * targetRatio;
  } else {
    cropWidth = width;
    cropHeight = width / targetRatio;
  }

  const x = (width - cropWidth) / 2;
  const y = (height - cropHeight) / 2;

  return clampCropRect({ x, y, width: cropWidth, height: cropHeight }, width, height);
}

function buildCropSelection() {
  if (!state.currentMeta || !state.selectedFormat) {
    return;
  }

  state.cropRect = computeDefaultCrop(
    state.currentMeta.width,
    state.currentMeta.height,
    state.selectedFormat
  );
  updateCropBox();
}

function normalizeCropSelectionToFormat(rect, format) {
  const [ratioW, ratioH] = format.ratio;
  const targetRatio = ratioW / ratioH;
  const rectRatio = rect.width / rect.height;

  let nextWidth = rect.width;
  let nextHeight = rect.height;

  if (Math.abs(rectRatio - targetRatio) > 0.01) {
    if (rectRatio > targetRatio) {
      nextHeight = rect.width / targetRatio;
    } else {
      nextWidth = rect.height * targetRatio;
    }
  }

  const nextRect = {
    x: rect.x + (rect.width - nextWidth) / 2,
    y: rect.y + (rect.height - nextHeight) / 2,
    width: nextWidth,
    height: nextHeight
  };

  return clampCropRect(nextRect, state.currentMeta.width, state.currentMeta.height);
}

function getImageDisplayBounds() {
  const stageRect = refs.cropStage.getBoundingClientRect();
  const imageRect = refs.previewImage.getBoundingClientRect();

  return {
    left: imageRect.left - stageRect.left,
    top: imageRect.top - stageRect.top,
    width: imageRect.width,
    height: imageRect.height
  };
}

function applyScaledPreview() {
  if (!state.currentMeta) {
    return;
  }

  const stageRect = refs.cropStage.getBoundingClientRect();
  const fit = fitImageToStage({
    stageWidth: stageRect.width,
    stageHeight: stageRect.height,
    imageWidth: state.currentMeta.width,
    imageHeight: state.currentMeta.height
  });

  refs.previewImage.style.width = `${fit.width}px`;
  refs.previewImage.style.height = `${fit.height}px`;
  refs.previewImage.style.left = `${fit.left}px`;
  refs.previewImage.style.top = `${fit.top}px`;
  refs.previewImage.style.maxWidth = 'none';
  refs.previewImage.style.maxHeight = 'none';
  refs.previewImage.style.transform = 'none';
}

function applyZoomPreview(pointerX, pointerY) {
  if (!state.currentMeta) {
    return;
  }

  const stageRect = refs.cropStage.getBoundingClientRect();
  const currentRect = getImageDisplayBounds();
  const zoomed = computeZoomPosition({
    stageWidth: stageRect.width,
    stageHeight: stageRect.height,
    imageWidth: state.currentMeta.width,
    imageHeight: state.currentMeta.height,
    currentRect,
    pointerX: pointerX - stageRect.left,
    pointerY: pointerY - stageRect.top
  });

  refs.previewImage.style.width = `${zoomed.width}px`;
  refs.previewImage.style.height = `${zoomed.height}px`;
  refs.previewImage.style.left = `${zoomed.left}px`;
  refs.previewImage.style.top = `${zoomed.top}px`;
  refs.previewImage.style.maxWidth = 'none';
  refs.previewImage.style.maxHeight = 'none';
  refs.previewImage.style.transform = 'none';
  state.isZoomed = true;
}

function cacheBustUrl(filePath) {
  return `${filePath}?v=${Date.now()}`;
}

function updateCropBox() {
  const image = refs.previewImage;
  if (!image || !state.cropRect || !state.currentMeta) {
    return;
  }

  if (state.isZoomed) {
    refs.cropBox.classList.add('hidden');
    return;
  }

  const bounds = getImageDisplayBounds();
  const left = bounds.left + (state.cropRect.x / state.currentMeta.width) * bounds.width;
  const top = bounds.top + (state.cropRect.y / state.currentMeta.height) * bounds.height;
  const width = (state.cropRect.width / state.currentMeta.width) * bounds.width;
  const height = (state.cropRect.height / state.currentMeta.height) * bounds.height;

  const isTooSmall = !!state.selectedSize && (
    state.cropRect.width < state.selectedSize.width ||
    state.cropRect.height < state.selectedSize.height
  );

  refs.cropBox.classList.toggle('warning', isTooSmall);
  refs.cropBox.style.left = `${left}px`;
  refs.cropBox.style.top = `${top}px`;
  refs.cropBox.style.width = `${width}px`;
  refs.cropBox.style.height = `${height}px`;
  refs.cropBox.classList.remove('hidden');
}

function calculateActiveCropPixels() {
  if (!state.currentMeta || !state.cropRect) {
    return null;
  }

  return {
    x: Math.round(state.cropRect.x),
    y: Math.round(state.cropRect.y),
    width: Math.round(state.cropRect.width),
    height: Math.round(state.cropRect.height)
  };
}

function fitImageToStage({ stageWidth, stageHeight, imageWidth, imageHeight }) {
  const safeStageWidth = Math.max(1, Number(stageWidth) || 0);
  const safeStageHeight = Math.max(1, Number(stageHeight) || 0);
  const safeImageWidth = Math.max(1, Number(imageWidth) || 0);
  const safeImageHeight = Math.max(1, Number(imageHeight) || 0);

  const scale = Math.min(1, safeStageWidth / safeImageWidth, safeStageHeight / safeImageHeight);
  const width = safeImageWidth * scale;
  const height = safeImageHeight * scale;

  return {
    width,
    height,
    left: (safeStageWidth - width) / 2,
    top: (safeStageHeight - height) / 2
  };
}

function computeZoomPosition({
  stageWidth,
  stageHeight,
  imageWidth,
  imageHeight,
  currentRect,
  pointerX,
  pointerY
}) {
  const safeStageWidth = Math.max(1, Number(stageWidth) || 0);
  const safeStageHeight = Math.max(1, Number(stageHeight) || 0);
  const safeImageWidth = Math.max(1, Number(imageWidth) || 0);
  const safeImageHeight = Math.max(1, Number(imageHeight) || 0);

  const currentLeft = Number(currentRect?.left) || 0;
  const currentTop = Number(currentRect?.top) || 0;
  const currentWidth = Math.max(1, Number(currentRect?.width) || 0);
  const currentHeight = Math.max(1, Number(currentRect?.height) || 0);

  const scaleX = currentWidth / safeImageWidth;
  const scaleY = currentHeight / safeImageHeight;
  const localPointerX = (Number(pointerX) - currentLeft) / scaleX;
  const localPointerY = (Number(pointerY) - currentTop) / scaleY;

  let left = Number(pointerX) - localPointerX;
  let top = Number(pointerY) - localPointerY;

  const minLeft = Math.min(0, safeStageWidth - safeImageWidth);
  const minTop = Math.min(0, safeStageHeight - safeImageHeight);
  left = Math.min(Math.max(left, minLeft), 0);
  top = Math.min(Math.max(top, minTop), 0);

  return {
    width: safeImageWidth,
    height: safeImageHeight,
    left,
    top
  };
}


async function loadConfig() {
  const loaded = await window.electronAPI.loadConfig();
  state.config = loaded || { baseFolder: '', formats: [], targetFolders: [] };
  renderConfigEditor();

  if (!state.config.baseFolder || !state.config.formats.length || !state.config.targetFolders.length) {
    showConfigModal();
    setStatus('Configure app', 'neutral');
    return;
  }

  hideConfigModal();
  renderFormatButtons();
  renderTargetButtons();
  renderSizeOptions();
  await loadQueue();
  if (state.images.length) {
    await showCurrentImage();
  } else {
    setEmptyQueueState();
    setStatus('No images in source folder', 'warn');
  }
}

async function loadQueue() {
  state.images = await window.electronAPI.listImages();
  state.currentIndex = 0;
  renderThumbnails();
}

async function refreshQueue() {
  try {
    await loadQueue();
    if (!state.images.length) {
      setEmptyQueueState();
      setStatus('Queue refreshed', 'neutral');
      return;
    }

    await showCurrentImage();
    setStatus('Queue refreshed', 'success');
  } catch (error) {
    console.error(error);
    setStatus('Refresh failed', 'danger');
  }
}

function setEmptyQueueState() {
  refs.filename.textContent = 'No images found';
  refs.filenameMeta.textContent = '';
  refs.previewImage.style.display = 'none';
  state.isZoomed = false;
  refs.cropBox.classList.add('hidden');
}

async function showCurrentImage() {
  if (!state.images.length) {
    setEmptyQueueState();
    setStatus('No images', 'warn');
    return;
  }

  state.isZoomed = false;
  refs.cropBox.classList.remove('hidden');

  const current = state.images[state.currentIndex];
  const previewImage = refs.previewImage;
  const imageReady = new Promise((resolve) => {
    const done = () => {
      previewImage.onload = null;
      previewImage.onerror = null;
      resolve();
    };

    previewImage.onload = done;
    previewImage.onerror = done;
  });

  previewImage.src = cacheBustUrl(current.path);
  refs.previewImage.style.display = '';
  previewImage.alt = current.name;
  await imageReady;

  const meta = await window.electronAPI.getImageMeta(current.path);
  const sizeLabel = meta ? `(${meta.width}×${meta.height})` : '(unknown size)';
  refs.filename.textContent = current.name;
  refs.filenameMeta.textContent = sizeLabel;

  if (!meta) {
    state.images.splice(state.currentIndex, 1);
    if (!state.images.length) {
      setEmptyQueueState();
      renderThumbnails();
      setStatus('Skipped unreadable image', 'warn');
      return;
    }

    if (state.currentIndex >= state.images.length) {
      state.currentIndex = state.images.length - 1;
    }

    await showCurrentImage();
    return;
  }

  state.currentMeta = meta;
  applyScaledPreview();

  const currentFormat = pickBestFormat(meta.width, meta.height, state.config.formats);
  state.selectedFormat = currentFormat;
  const formatIndex = state.config.formats.findIndex((format) => format.id === currentFormat.id);
  state.formatButtonsIndex = formatIndex;
  renderFormatButtons();
  renderSizeOptions();
  renderTargetButtons();
  buildCropSelection();
  setStatus('Ready', 'success');
  renderThumbnails();
}

function renderFormatButtons() {
  refs.formatButtons.innerHTML = '';
  state.config.formats.forEach((format, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `format-button ${state.selectedFormat && state.selectedFormat.id === format.id ? 'active' : ''} ${state.isZoomed ? 'disabled' : ''}`.trim();
    button.textContent = `${format.id}`;
    button.disabled = state.isZoomed;
    button.addEventListener('click', async () => {
      if (state.isZoomed) {
        return;
      }

      state.selectedFormat = format;
      state.formatButtonsIndex = index;
      state.selectedSize = null;
      renderFormatButtons();
      renderSizeOptions();
      buildCropSelection();
      setStatus(`Format: ${format.id}`, 'neutral');
    });
    refs.formatButtons.appendChild(button);
  });
}

function renderSizeOptions() {
  refs.outputSize.innerHTML = '';
  const sizes = state.selectedFormat?.sizes || [];

  if (!sizes.length || !state.currentMeta) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'size-button disabled';
    button.textContent = 'No size available';
    button.disabled = true;
    refs.outputSize.appendChild(button);
    state.selectedSize = null;
    return;
  }

  const currentBest = pickBestSize(state.currentMeta.width, state.currentMeta.height, state.selectedFormat);
  const hasExplicitSelection = !!state.selectedSize && sizes.some(([width, height]) => width === state.selectedSize.width && height === state.selectedSize.height);

  if (!hasExplicitSelection) {
    state.selectedSize = currentBest;
  }

  sizes.forEach(([width, height]) => {
    const isDisabled = width > state.currentMeta.width || height > state.currentMeta.height || state.isZoomed;
    const isActive = !isDisabled && width === state.selectedSize.width && height === state.selectedSize.height;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `size-button ${isActive ? 'active' : ''} ${isDisabled ? 'disabled' : ''}`;
    button.textContent = `${width} × ${height}`;
    button.disabled = isDisabled;

    button.addEventListener('click', () => {
      if (state.isZoomed) {
        return;
      }

      if (isDisabled) {
        setStatus(`Upscale disabled: ${currentBest.width}×${currentBest.height}`, 'warn');
        return;
      }

      state.selectedSize = { width, height };
      renderSizeOptions();
      setStatus(`${width}×${height}`, 'neutral');
    });

    refs.outputSize.appendChild(button);
  });
}

function renderTargetButtons() {
  refs.targetButtons.innerHTML = '';
  state.config.targetFolders.forEach((folderName) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `target-button ${state.isZoomed ? 'disabled' : ''}`.trim();
    button.textContent = folderName;
    button.disabled = state.isZoomed;
    button.addEventListener('click', async () => {
      if (state.isZoomed) {
        return;
      }

      await applyTargetAction(folderName);
    });
    refs.targetButtons.appendChild(button);
  });
}

function renderThumbnails() {
  refs.thumbnailStrip.innerHTML = '';

  state.images.forEach((image, index) => {
    const wrapper = document.createElement('button');
    wrapper.type = 'button';
    wrapper.className = 'thumbnail';
    wrapper.title = `${index + 1}. ${image.name}`;
    wrapper.addEventListener('click', () => {
      state.currentIndex = index;
      showCurrentImage();
    });

    const img = document.createElement('img');
    img.src = image.path;
    img.alt = image.name;
    wrapper.appendChild(img);
    refs.thumbnailStrip.appendChild(wrapper);
  });
}

async function moveToNext() {
  if (state.currentIndex >= state.images.length - 1) {
    state.currentIndex = 0;
  } else {
    state.currentIndex += 1;
  }

  await showCurrentImage();
}

async function deleteCurrentImage() {
  const current = state.images[state.currentIndex];
  if (!current) return;

  await window.electronAPI.deleteImage(current.path);
  state.images.splice(state.currentIndex, 1);
  if (!state.images.length) {
    setEmptyQueueState();
    renderThumbnails();
    setStatus('Queue complete', 'success');
    return;
  }

  if (state.currentIndex >= state.images.length) {
    state.currentIndex = state.images.length - 1;
  }

  await showCurrentImage();
}

async function applyTargetAction(targetFolderName) {
  const current = state.images[state.currentIndex];
  if (!current) return;

  const crop = calculateActiveCropPixels();
  if (!crop) {
    setStatus('No crop selected', 'warn');
    return;
  }

  const payload = {
    sourcePath: current.path,
    targetFolder: targetFolderName,
    format: state.selectedFormat,
    size: state.selectedSize,
    crop
  };

  try {
    setStatus('Processing…', 'neutral');
    const outputPath = await window.electronAPI.applyTarget(payload);
    setStatus(`Saved: ${outputPath.split('\\').pop()}`, 'success');
    state.images.splice(state.currentIndex, 1);
    if (!state.images.length) {
      setEmptyQueueState();
      renderThumbnails();
      setStatus('Queue completed', 'success');
      return;
    }

    if (state.currentIndex >= state.images.length) {
      state.currentIndex = state.images.length - 1;
    }

    await showCurrentImage();
  } catch (error) {
    console.error(error);
    setStatus('Processing failed', 'danger');
  }
}

async function openCurrentInPhotoshop() {
  const current = state.images[state.currentIndex];
  if (!current) return;

  try {
    await window.electronAPI.openEditor(current.path);
    setStatus('Editing in Photoshop', 'neutral');

    const didChange = await window.electronAPI.waitForFileChange(current.path);
    await showCurrentImage();

    if (didChange) {
      setStatus('Preview refreshed after edit', 'success');
    } else {
      setStatus('Preview refreshed after edit', 'neutral');
    }
  } catch (error) {
    console.error(error);
    setStatus('Could not open Photoshop', 'danger');
  }
}

function attachHandlers() {
  refs.configButton.addEventListener('click', () => {
    showConfigModal();
  });

  refs.configCloseButton.addEventListener('click', () => {
    hideConfigModal();
  });

  refs.configCancelButton.addEventListener('click', () => {
    hideConfigModal();
  });

  refs.selectBaseFolderButton.addEventListener('click', async () => {
    const selected = await window.electronAPI.selectBaseFolder();
    if (!selected) return;
    state.config.baseFolder = selected;
    refs.baseFolderInput.value = selected;
  });

  refs.addFormatButton.addEventListener('click', () => {
    state.config.formats.push({ id: '', ratio: [], sizes: [[]] });
    showConfigMessage('', 'success');
    renderConfigEditor();
  });

  refs.addTargetButton.addEventListener('click', async () => {
    const picked = await window.electronAPI.selectTargetFolder(state.config.baseFolder || '');
    if (picked === '__INVALID_TARGET_FOLDER__') {
      showConfigMessage('Target folders must stay inside the base folder and cannot go up a level.', 'error');
      return;
    }

    if (!picked) return;

    if (!isSafeTargetFolderPath(picked)) {
      showConfigMessage('Target folders must stay inside the base folder and cannot go up a level.', 'error');
      return;
    }

    const normalized = normalizeFolderKey(picked);
    const folderName = normalized.split('/').filter(Boolean).pop() || normalized;
    const exists = state.config.targetFolders.some((targetFolderName) => normalizeFolderKey(targetFolderName) === normalizeFolderKey(folderName));
    if (exists) {
      showConfigMessage('This target folder is already configured.', 'error');
      return;
    }

    state.config.targetFolders.push(folderName);
    showConfigMessage('', 'success');
    renderConfigEditor();
  });

  refs.configForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const nextConfig = {
      baseFolder: refs.baseFolderInput.value.trim(),
      formats: [],
      targetFolders: []
    };

    if (!nextConfig.baseFolder) {
      showConfigMessage('Select a base folder first.', 'error');
      return;
    }

    const seenFormatRatios = new Set();
    for (const format of state.config.formats) {
      const ratio = parseRatioString(format.ratio.join(':')) || parseRatioString(`${format.ratio[0]}:${format.ratio[1]}`);
      if (!ratio) {
        showConfigMessage('Each format needs a valid ratio like 16:10.', 'error');
        return;
      }

      const ratioId = ratioKeyFromArray(ratio);
      if (seenFormatRatios.has(ratioId)) {
        showConfigMessage('Duplicate format ratio detected: ' + ratioId + '.', 'error');
        return;
      }
      seenFormatRatios.add(ratioId);

      const sizes = sortSizesForSave((format.sizes || []).map((size) => [Number(size[0]), Number(size[1])]).filter(([width, height]) => Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0));
      if (!sizes.length) {
        showConfigMessage('Each format needs at least one size.', 'error');
        return;
      }

      nextConfig.formats.push({
        id: `${ratio[0]}:${ratio[1]}`,
        ratio,
        sizes
      });
    }

    const seenTargetFolders = new Set();
    for (const targetFolderName of state.config.targetFolders) {
      const cleanedFolder = normalizeFolderKey(targetFolderName || '');
      if (!cleanedFolder) continue;
      if (!isSafeTargetFolderPath(cleanedFolder)) {
        showConfigMessage('Target folders must stay inside the base folder and cannot go up a level.', 'error');
        return;
      }
      if (seenTargetFolders.has(cleanedFolder)) {
        showConfigMessage('Duplicate target folder detected: ' + cleanedFolder + '.', 'error');
        return;
      }
      seenTargetFolders.add(cleanedFolder);

      nextConfig.targetFolders.push(cleanedFolder);
    }

    if (!nextConfig.formats.length) {
      showConfigMessage('Add at least one format.', 'error');
      return;
    }

    if (!nextConfig.targetFolders.length) {
      showConfigMessage('Add at least one target folder.', 'error');
      return;
    }

    try {
      state.config = await window.electronAPI.saveConfig(nextConfig);
      showConfigMessage('Configuration saved.', 'success');
      hideConfigModal();
      await loadConfig();
    } catch (error) {
      console.error(error);
      showConfigMessage('Could not save configuration.', 'error');
    }
  });

  refs.thumbnailStrip.addEventListener('wheel', (event) => {
    if (Math.abs(event.deltaY) > 0) {
      event.preventDefault();
      refs.thumbnailStrip.scrollLeft += event.deltaY;
    }
  }, { passive: false });

  refs.refreshButton.addEventListener('click', async () => {
    await refreshQueue();
  });

  refs.skipButton.addEventListener('click', async () => {
    await moveToNext();
  });

  refs.deleteButton.addEventListener('click', async () => {
    await deleteCurrentImage();
  });

  refs.editButton.addEventListener('click', async () => {
    await openCurrentInPhotoshop();
  });

  function clampSize(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function buildHandleResizeRect(startRect, mode, pointerX, pointerY) {
    const ratio = state.selectedFormat.ratio[0] / state.selectedFormat.ratio[1];
    const imageWidth = state.currentMeta.width;
    const imageHeight = state.currentMeta.height;

    function constrainToRatio(width, height) {
      let nextWidth = clampSize(width, 1, imageWidth);
      let nextHeight = clampSize(height, 1, imageHeight);

      if (nextWidth / nextHeight > ratio) {
        nextWidth = clampSize(nextHeight * ratio, 1, imageWidth);
      } else {
        nextHeight = clampSize(nextWidth / ratio, 1, imageHeight);
      }

      return {
        width: nextWidth,
        height: nextHeight
      };
    }

    if (mode === 'n') {
      const anchorY = startRect.y + startRect.height;
      const height = clampSize(anchorY - pointerY, 1, anchorY);
      const { width, height: nextHeight } = constrainToRatio(height * ratio, height);
      const centerX = startRect.x + startRect.width / 2;
      const x = clampSize(centerX - width / 2, 0, imageWidth - width);
      const y = clampSize(anchorY - nextHeight, 0, imageHeight - nextHeight);
      return clampCropRect({ x, y, width, height: nextHeight }, imageWidth, imageHeight);
    }

    if (mode === 's') {
      const anchorY = startRect.y;
      const height = clampSize(pointerY - anchorY, 1, imageHeight - anchorY);
      const { width, height: nextHeight } = constrainToRatio(height * ratio, height);
      const centerX = startRect.x + startRect.width / 2;
      const x = clampSize(centerX - width / 2, 0, imageWidth - width);
      const y = clampSize(anchorY, 0, imageHeight - nextHeight);
      return clampCropRect({ x, y, width, height: nextHeight }, imageWidth, imageHeight);
    }

    if (mode === 'w') {
      const anchorX = startRect.x + startRect.width;
      const width = clampSize(anchorX - pointerX, 1, anchorX);
      const { width: nextWidth, height } = constrainToRatio(width, width / ratio);
      const x = clampSize(anchorX - nextWidth, 0, imageWidth - nextWidth);
      const y = clampSize(startRect.y + (startRect.height - height) / 2, 0, imageHeight - height);
      return clampCropRect({ x, y, width: nextWidth, height }, imageWidth, imageHeight);
    }

    if (mode === 'e') {
      const anchorX = startRect.x;
      const width = clampSize(pointerX - anchorX, 1, imageWidth - anchorX);
      const { width: nextWidth, height } = constrainToRatio(width, width / ratio);
      const x = clampSize(anchorX, 0, imageWidth - nextWidth);
      const y = clampSize(startRect.y + (startRect.height - height) / 2, 0, imageHeight - height);
      return clampCropRect({ x, y, width: nextWidth, height }, imageWidth, imageHeight);
    }

    const anchorX = mode.includes('e') ? startRect.x : startRect.x + startRect.width;
    const anchorY = mode.includes('s') ? startRect.y : startRect.y + startRect.height;
    let width = Math.abs(anchorX - pointerX);
    let height = Math.abs(anchorY - pointerY);

    const constrained = constrainToRatio(width, height);
    width = constrained.width;
    height = constrained.height;

    let x = 0;
    let y = 0;

    if (mode === 'nw') {
      x = clampSize(anchorX - width, 0, imageWidth - width);
      y = clampSize(anchorY - height, 0, imageHeight - height);
    }
    if (mode === 'ne') {
      x = clampSize(anchorX, 0, imageWidth - width);
      y = clampSize(anchorY - height, 0, imageHeight - height);
    }
    if (mode === 'sw') {
      x = clampSize(anchorX - width, 0, imageWidth - width);
      y = clampSize(anchorY, 0, imageHeight - height);
    }
    if (mode === 'se') {
      x = clampSize(anchorX, 0, imageWidth - width);
      y = clampSize(anchorY, 0, imageHeight - height);
    }

    return clampCropRect({ x, y, width, height }, imageWidth, imageHeight);
  }

  refs.cropBox.addEventListener('pointerdown', (event) => {
    if (state.isZoomed) {
      return;
    }

    const target = event.target.closest('.crop-handle');
    const stageRect = refs.cropStage.getBoundingClientRect();
    const imageBounds = getImageDisplayBounds();
    state.dragOrigin = {
      mode: target ? target.dataset.handle : 'move',
      pointerX: event.clientX - stageRect.left,
      pointerY: event.clientY - stageRect.top,
      imageLocalX: event.clientX - stageRect.left - imageBounds.left,
      imageLocalY: event.clientY - stageRect.top - imageBounds.top,
      rect: { ...state.cropRect }
    };
    state.isDragging = true;
  });

  refs.cropStage.addEventListener('contextmenu', (event) => {
    if (!state.currentMeta) {
      return;
    }

    event.preventDefault();
    if (state.isZoomed) {
      state.isZoomed = false;
      refs.cropBox.classList.remove('hidden');
      renderFormatButtons();
      renderSizeOptions();
      renderTargetButtons();
      applyScaledPreview();
      setStatus('Ready', 'success');
      return;
    }

    state.isZoomed = true;
    refs.cropBox.classList.add('hidden');
    renderFormatButtons();
    renderSizeOptions();
    renderTargetButtons();
    applyZoomPreview(event.clientX, event.clientY);
    setStatus('100% zoom', 'neutral');
  });

  refs.cropStage.addEventListener('pointermove', (event) => {
    if (state.isZoomed || !state.isDragging || !state.dragOrigin || !state.currentMeta || !state.selectedFormat) {
      return;
    }

    const stageRect = refs.cropStage.getBoundingClientRect();
    const imageBounds = getImageDisplayBounds();
    const pointerX = event.clientX - stageRect.left;
    const pointerY = event.clientY - stageRect.top;
    const localPointerX = pointerX - imageBounds.left;
    const localPointerY = pointerY - imageBounds.top;

    if (state.dragOrigin.mode === 'move') {
      const dx = (localPointerX - state.dragOrigin.imageLocalX) / imageBounds.width * state.currentMeta.width;
      const dy = (localPointerY - state.dragOrigin.imageLocalY) / imageBounds.height * state.currentMeta.height;

      state.cropRect = clampCropRect(
        {
          ...state.dragOrigin.rect,
          x: state.dragOrigin.rect.x + dx,
          y: state.dragOrigin.rect.y + dy
        },
        state.currentMeta.width,
        state.currentMeta.height
      );
    } else {
      const pointerInImageX = clampSize(localPointerX / imageBounds.width * state.currentMeta.width, 0, state.currentMeta.width);
      const pointerInImageY = clampSize(localPointerY / imageBounds.height * state.currentMeta.height, 0, state.currentMeta.height);
      state.cropRect = buildHandleResizeRect(state.dragOrigin.rect, state.dragOrigin.mode, pointerInImageX, pointerInImageY);
    }

    const normalized = normalizeCropSelectionToFormat(state.cropRect, state.selectedFormat);
    state.cropRect = normalized;

    const bestMatchingSize = pickBestMatchingSizeFromCrop(state.cropRect, state.selectedFormat);
    if (bestMatchingSize) {
      state.selectedSize = { width: bestMatchingSize.width, height: bestMatchingSize.height };
      renderSizeOptions();
    }
    updateCropBox();
  });

  window.addEventListener('pointerup', () => {
    state.isDragging = false;
    state.dragOrigin = null;
  });

  window.addEventListener('resize', () => {
    if (!state.currentMeta) {
      return;
    }

    if (state.isZoomed) {
      const stageRect = refs.cropStage.getBoundingClientRect();
      const currentRect = getImageDisplayBounds();
      const zoomed = computeZoomPosition({
        stageWidth: stageRect.width,
        stageHeight: stageRect.height,
        imageWidth: state.currentMeta.width,
        imageHeight: state.currentMeta.height,
        currentRect,
        pointerX: stageRect.width / 2,
        pointerY: stageRect.height / 2
      });
      refs.previewImage.style.width = `${zoomed.width}px`;
      refs.previewImage.style.height = `${zoomed.height}px`;
      refs.previewImage.style.left = `${zoomed.left}px`;
      refs.previewImage.style.top = `${zoomed.top}px`;
      return;
    }

    if (state.cropRect) {
      applyScaledPreview();
      updateCropBox();
    }
  });
}

async function init() {
  attachHandlers();
  await loadConfig();
}

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  init();
} else {
  document.addEventListener('DOMContentLoaded', init);
}

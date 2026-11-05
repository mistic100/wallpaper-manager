const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const supportedExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif', '.tif', '.tiff']);

const configPath = path.join(process.cwd(), 'wallpaper-manager.config.json');

async function ensureConfigFile() {
  try {
    const raw = await fs.readFile(configPath, 'utf8');
    if (!raw.trim()) {
      return null;
    }
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

function findMagickExecutable() {
  const candidates = ['magick', 'convert'];
  for (const candidate of candidates) {
    const result = spawnSync(candidate, ['-version'], { shell: false, stdio: 'ignore' });
    if (result.status === 0) {
      return candidate;
    }
  }
  throw new Error('ImageMagick was not found. Install ImageMagick and ensure it is on PATH.');
}

function pickBestFormat(imageWidth, imageHeight, formats) {
  const aspectRatio = imageWidth / imageHeight;
  let bestFormat = formats[0];
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const format of formats) {
    const [w, h] = format.ratio;
    const target = w / h;
    const distance = Math.abs(aspectRatio - target);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestFormat = format;
    }
  }

  return bestFormat;
}

function pickBestSize(imageWidth, imageHeight, format) {
  const candidates = (format.sizes || []).map(([width, height]) => ({ width, height }));
  if (!candidates.length) {
    return { width: Math.round(imageWidth), height: Math.round(imageHeight) };
  }

  let best = candidates[0];
  let bestScore = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    const hasNoUpscale = candidate.width <= imageWidth && candidate.height <= imageHeight;
    const score = Math.abs(candidate.width - imageWidth) + Math.abs(candidate.height - imageHeight);
    const adaptiveScore = hasNoUpscale ? score : score + 200_000;
    if (adaptiveScore < bestScore) {
      bestScore = adaptiveScore;
      best = candidate;
    }
  }

  return best;
}

async function scanImages(baseFolder) {
  await fs.mkdir(baseFolder, { recursive: true }).catch(() => {});
  const entries = await fs.readdir(baseFolder, { withFileTypes: true }).catch(() => []);
  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => supportedExtensions.has(path.extname(name).toLowerCase()));

  const imageInfos = await Promise.all(
    files.map(async (name) => {
      const filePath = path.join(baseFolder, name);
      const stat = await fs.stat(filePath).catch(() => null);
      if (!stat) {
        return null;
      }

      return {
        name,
        path: filePath,
        size: stat.size,
        modifiedAt: stat.mtimeMs
      };
    })
  );

  return imageInfos
    .filter(Boolean)
    .sort((a, b) => a.modifiedAt - b.modifiedAt);
}

async function ensureFolderExists(folderPath) {
  await fs.mkdir(folderPath, { recursive: true });
}

async function getImageMetadata(filePath) {
  try {
    await fs.access(filePath);
  } catch (error) {
    return null;
  }

  const magick = findMagickExecutable();
  const response = spawnSync(magick, ['identify', '-format', '%w %h', filePath], {
    shell: false,
    encoding: 'utf8'
  });

  if (response.error) {
    return null;
  }

  const line = (response.stdout || '').trim();
  const [width, height] = line.split(/\s+/).map(Number).filter((v) => Number.isFinite(v));

  if (!width || !height) {
    return null;
  }

  return { width, height };
}

function buildTargetOutputPath(sourcePath, targetFolder, imageCount = 1) {
  const sourceName = path.parse(sourcePath).name;
  const outputName = imageCount > 1 ? `${sourceName}_${imageCount}-images` : sourceName;
  return path.join(targetFolder, `${outputName}.jpg`);
}

async function findNextAvailableOutputPath(sourcePath, targetFolder, imageCount = 1) {
  const baseOutputPath = buildTargetOutputPath(sourcePath, targetFolder, imageCount);
  const parsed = path.parse(baseOutputPath);
  let candidate = baseOutputPath;
  let index = 2;

  while (true) {
    try {
      await fs.access(candidate);
      candidate = path.join(parsed.dir, `${parsed.name} (${index})${parsed.ext}`);
      index += 1;
    } catch (error) {
      return candidate;
    }
  }
}

function buildCropCommand({ sourcePath, outputPath, crop, size }) {
  return [
    sourcePath,
    '-strip',
    '-background', 'white',
    '-alpha', 'remove',
    '-alpha', 'off',
    '-crop', `${Math.round(crop.width)}x${Math.round(crop.height)}+${Math.round(crop.x)}+${Math.round(crop.y)}`,
    '-resize', `${Math.round(size.width)}x${Math.round(size.height)}!`,
    '-quality', '95',
    outputPath
  ];
}

async function processImage({ sourcePath, targetFolder, format, size, crop, outputPath }) {
  await ensureFolderExists(targetFolder);
  const magick = findMagickExecutable();
  const cropCommand = buildCropCommand({ sourcePath, outputPath, crop, size });

  const result = spawnSync(magick, cropCommand, {
    shell: false,
    stdio: 'pipe'
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const details = (result.stderr || result.stdout || '').toString();
    throw new Error(`ImageMagick failed while processing the file: ${details}`);
  }
}

async function processMerge({ images, targetFolder, size, outputPath, baseFolder }) {
  if (!Array.isArray(images) || images.length < 2) {
    throw new Error('A merge requires at least two images.');
  }
  if (!Number.isSafeInteger(size?.width) || !Number.isSafeInteger(size?.height) || size.width < 1 || size.height < 1) {
    throw new Error('The merge output size is invalid.');
  }

  const resolvedBase = path.resolve(baseFolder);
  const seenPaths = new Set();
  const imageData = [];
  for (const item of images) {
    if (typeof item.sourcePath !== 'string' || !item.position
      || !Number.isFinite(item.position.x) || !Number.isFinite(item.position.y)) {
      throw new Error('A merge image or its position is invalid.');
    }

    const sourcePath = path.resolve(item.sourcePath);
    const relativePath = path.relative(resolvedBase, sourcePath);
    if (path.dirname(sourcePath) !== resolvedBase || !relativePath
      || relativePath === '..' || relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath)) {
      throw new Error('Merge images must be in the configured source folder.');
    }
    if (seenPaths.has(sourcePath.toLowerCase())) {
      throw new Error('A merge cannot contain the same image more than once.');
    }
    seenPaths.add(sourcePath.toLowerCase());

    const stat = await fs.stat(sourcePath);
    if (!stat.isFile() || !supportedExtensions.has(path.extname(sourcePath).toLowerCase())) {
      throw new Error(`The merge source is not a supported image: ${path.basename(sourcePath)}`);
    }
    const meta = await getImageMetadata(sourcePath);
    if (!meta) {
      throw new Error(`Could not read merge source: ${path.basename(sourcePath)}`);
    }
    imageData.push({ sourcePath, position: item.position, meta });
  }

  const command = ['-size', `${size.width}x${size.height}`, 'xc:white'];
  imageData.forEach(({ sourcePath, position, meta }, index) => {
    const left = Math.round(index * size.width / imageData.length);
    const right = Math.round((index + 1) * size.width / imageData.length);
    const columnWidth = right - left;
    const scale = Math.max(columnWidth / meta.width, size.height / meta.height);
    const imageWidth = Math.round(meta.width * scale);
    const imageHeight = Math.round(meta.height * scale);
    const minLeft = left + columnWidth - imageWidth;
    const maxLeft = left;
    const minTop = Math.min(0, size.height - imageHeight);
    const maxTop = Math.max(0, size.height - imageHeight);
    if (position.x < minLeft - 1 || position.x > maxLeft + 1
      || position.y < minTop - 1 || position.y > maxTop + 1) {
      throw new Error('A merge image position is outside its column.');
    }
    const cropLeft = Math.max(0, Math.min(imageWidth - columnWidth, Math.round(left - position.x)));
    const cropTop = Math.max(0, Math.min(imageHeight - size.height, Math.round(-position.y)));

    command.push(
      '(',
      sourcePath,
      '-strip',
      '-background', 'white',
      '-alpha', 'remove',
      '-alpha', 'off',
      '-resize', `${imageWidth}x${imageHeight}!`,
      '-crop', `${columnWidth}x${size.height}+${cropLeft}+${cropTop}`,
      '+repage',
      ')',
      '-geometry', `+${left}+0`,
      '-composite'
    );
  });
  command.push('-quality', '95', '-strip', outputPath);

  await ensureFolderExists(targetFolder);
  const magick = findMagickExecutable();
  const result = spawnSync(magick, command, { shell: false, stdio: 'pipe' });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const details = (result.stderr || result.stdout || '').toString();
    throw new Error(`ImageMagick failed while composing the merge: ${details}`);
  }
}

async function checkOutputFileExists({ baseFolder, sourcePath, images, targetFolder }) {
  const firstSourcePath = sourcePath || images?.[0]?.sourcePath;
  if (!firstSourcePath) {
    throw new Error('No source image was provided.');
  }
  const cleanedTarget = path.isAbsolute(targetFolder) ? targetFolder : path.join(baseFolder, targetFolder);
  const outputPath = buildTargetOutputPath(firstSourcePath, cleanedTarget, images?.length || 1);

  try {
    await fs.access(outputPath);
    return { exists: true, outputPath };
  } catch (error) {
    return { exists: false, outputPath };
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1500,
    height: 980,
    minWidth: 1100,
    minHeight: 760,
    icon: path.join(__dirname, 'icon.png'),
    backgroundColor: '#0f172a',
    autoHideMenuBar: true,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: false
    }
  });

  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, 'index.html'));
  return win;
}

function isTargetFolderWithinBase(baseFolder, targetFolder) {
  if (!baseFolder || !targetFolder) {
    return false;
  }

  const resolvedBase = path.resolve(baseFolder);
  const resolvedTarget = path.resolve(baseFolder, targetFolder);
  const relativePath = path.relative(resolvedBase, resolvedTarget);

  if (!relativePath || relativePath === '') {
    return false;
  }

  return !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
}

function normalizeTargetFolderEntry(folderValue) {
  if (typeof folderValue === 'string') {
    return {
      path: folderValue,
      name: folderValue,
      group: ''
    };
  } else {
    return folderValue;
  }
}

function normalizeConfig(rawConfig) {
  const config = rawConfig || {};
  const baseFolder = typeof config.baseFolder === 'string' ? config.baseFolder.trim() : '';

  const formats = (config.formats || []).map((format) => {
    const ratio = Array.isArray(format.ratio) ? format.ratio : [16, 10];
    const normalizedRatio = ratio.map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0);
    const safeRatio = normalizedRatio.length === 2 ? [normalizedRatio[0], normalizedRatio[1]] : [16, 10];
    const sizes = (format.sizes || [])
      .map((size) => Array.isArray(size) ? [Number(size[0]), Number(size[1])] : [Number(size.width), Number(size.height)])
      .filter(([width, height]) => Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0)
      .sort((a, b) => (a[0] * a[1]) - (b[0] * b[1]));

    const id = format.id || `${safeRatio[0]}:${safeRatio[1]}`;
    return {
      id,
      ratio: safeRatio,
      sizes
    };
  });

  const targetFolders = (config.targetFolders || [])
    .map((folder) => normalizeTargetFolderEntry(folder))
    .filter(Boolean)
    .filter((folder) => {
      if (!baseFolder) {
        return true;
      }
      return isTargetFolderWithinBase(baseFolder, folder.path);
    });

  return {
    baseFolder: baseFolder || '',
    formats,
    targetFolders
  };
}

async function watchFileForChange(filePath, timeoutMs = 60000) {
  const original = await fs.stat(filePath).catch(() => null);
  if (!original) {
    return false;
  }

  const originalSignature = {
    size: original.size,
    mtimeMs: original.mtimeMs
  };

  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const latest = await fs.stat(filePath).catch(() => null);
    if (latest && (latest.size !== originalSignature.size || latest.mtimeMs !== originalSignature.mtimeMs)) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 700));
  }

  return false;
}

app.whenReady().then(async () => {
  let config = await ensureConfigFile().then((raw) => raw ? normalizeConfig(raw) : null);

  ipcMain.handle('load-config', async () => config);

  ipcMain.handle('save-config', async (_event, rawConfig) => {
    const normalized = normalizeConfig(rawConfig);
    config = normalized;
    await fs.mkdir(path.dirname(configPath), { recursive: true }).catch(() => {});
    await fs.writeFile(configPath, JSON.stringify(normalized, null, 2), 'utf8');
    return normalized;
  });

  ipcMain.handle('select-base-folder', async () => {
    const defaultPath = config?.baseFolder && config.baseFolder.trim()
      ? config.baseFolder
      : require('node:os').homedir();

    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      defaultPath
    });

    if (result.canceled || !result.filePaths.length) {
      return null;
    }

    return result.filePaths[0];
  });

  ipcMain.handle('select-target-folder', async (_event, baseFolder) => {
    const basePath = baseFolder || process.cwd();
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      defaultPath: basePath
    });

    if (result.canceled || !result.filePaths.length) {
      return null;
    }

    const selectedPath = path.resolve(result.filePaths[0]);
    const resolvedBase = path.resolve(basePath);
    const relativePath = path.relative(resolvedBase, selectedPath).replace(/\\/g, '/');

    if (!relativePath || relativePath === '' || relativePath === '.' || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      return '__INVALID_TARGET_FOLDER__';
    }

    return relativePath;
  });

  ipcMain.handle('list-images', async () => {
    if (!config || !config.baseFolder) {
      return [];
    }
    const docs = await scanImages(config.baseFolder);
    return docs;
  });

  ipcMain.handle('get-image-meta', async (_event, sourcePath) => {
    return getImageMetadata(sourcePath);
  });

  ipcMain.handle('wait-for-file-change', async (_event, sourcePath) => {
    return watchFileForChange(sourcePath);
  });

  ipcMain.handle('open-editor', async (_event, sourcePath) => {
    const photoshopCandidates = [
      'C:\\Program Files\\Adobe\\Adobe Photoshop 2025\\Photoshop.exe',
      'C:\\Program Files\\Adobe\\Adobe Photoshop 2024\\Photoshop.exe',
      'C:\\Program Files\\Adobe\\Adobe Photoshop 2023\\Photoshop.exe',
      'C:\\Program Files\\Adobe\\Adobe Photoshop 2022\\Photoshop.exe',
      'C:\\Program Files\\Adobe\\Adobe Photoshop\\Photoshop.exe'
    ];

    const validPath = photoshopCandidates.find((candidate) => require('node:fs').existsSync(candidate));
    const exePath = validPath || 'Photoshop.exe';
    const result = spawnSync('powershell', ['-NoProfile', '-Command', `Start-Process -FilePath '${exePath}' -ArgumentList @('${sourcePath}')`], {
      shell: false,
      stdio: 'ignore'
    });

    if (result.error) {
      throw result.error;
    }

    return exePath;
  });

  ipcMain.handle('delete-image', async (_event, sourcePath) => {
    await shell.trashItem(sourcePath);
    return true;
  });

  ipcMain.handle('check-output-file', async (_event, payload) => {
    if (!config || !config.baseFolder) {
      throw new Error('Configuration is missing. Please set a base folder first.');
    }

    return checkOutputFileExists({
      baseFolder: config.baseFolder,
      sourcePath: payload.sourcePath,
      images: payload.images,
      targetFolder: payload.targetFolder
    });
  });

  ipcMain.handle('apply-target', async (_event, payload) => {
    if (!config || !config.baseFolder) {
      throw new Error('Configuration is missing. Please set a base folder first.');
    }

    const { sourcePath, images, targetFolder, format, size, crop, overwrite = false } = payload;
    const outputSourcePath = sourcePath || images?.[0]?.sourcePath;
    if (!outputSourcePath) {
      throw new Error('No source image was provided.');
    }
    const cleanedTarget = path.isAbsolute(targetFolder) ? targetFolder : path.join(config.baseFolder, targetFolder);
    const imageCount = images?.length || 1;
    const baseOutputPath = buildTargetOutputPath(outputSourcePath, cleanedTarget, imageCount);
    const outputExists = await fs.access(baseOutputPath).then(() => true).catch(() => false);
    const outputPath = !overwrite && outputExists
      ? await findNextAvailableOutputPath(outputSourcePath, cleanedTarget, imageCount)
      : baseOutputPath;

    if (images) {
      await processMerge({ images, targetFolder: cleanedTarget, size, outputPath, baseFolder: config.baseFolder });
      await Promise.all(images.map(({ sourcePath: imagePath }) => shell.trashItem(imagePath)));
    } else {
      await processImage({
        sourcePath,
        targetFolder: cleanedTarget,
        format,
        size,
        crop,
        outputPath
      });
      await shell.trashItem(sourcePath);
    }
    return outputPath;
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

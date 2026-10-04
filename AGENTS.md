# Wallpaper Manager AGENTS

## Project overview
This project is a Windows desktop application for quickly sorting, cropping, and exporting downloaded images. It is built with Electron and uses ImageMagick for processing.

The app workflow is:
- select a base source folder
- scan all supported image files inside that folder
- inspect each image one by one
- crop a selection to a target aspect ratio
- resize to a selected output size
- send the processed image to one of the configured target folders
- optionally delete or skip the original source image

## App structure
- `src/main.js`: Electron main process; config loading, target-folder validation, ImageMagick calls, IPC handlers
- `src/preload.js`: exposes the safe Electron bridge to the renderer
- `src/renderer.js`: UI logic, crop interaction, size selection, target actions, queue management
- `src/index.html`: app shell and configuration modal layout
- `src/style.css`: styling for the app and config UI
- `wallpaper-manager.config.json`: persisted app configuration

## Application UI
The main screen has four parts:
- top header with current image name and size, status pill an global action buttons
- large image visualisation area with interractive cropping tools (Photoshop like) which preserve aspect ratio
- form allowing to select crop format, output size, target folder and skip, delete, edit buttons
- bottom thumbnails strip of images to process

The settings modal:
- change scanned folder
- configure crop formats and respective output sizes
- list target folders

## Runtime and tools
- Desktop runtime: Electron
- Image processing: ImageMagick (`magick` or `convert` on PATH)
- Package manager: Yarn
- Icons: FontAwesome
- Target OS: Windows
- Portable usage is expected; no install-time setup beyond ImageMagick and the app runtime

## Core configuration
The app stores a config object with:
- `baseFolder`: root folder scanned for source images
- `formats`: array of aspect-ratio formats, each with `id`, `ratio`, and `sizes`
- `targetFolders`: destinations under the base folder; these must remain inside the base folder hierarchy

Rules:
- target folders cannot traverse upward outside the base folder
- duplicate target folders are rejected
- duplicate format ratios are rejected
- each format requires at least one valid size

## Important behavior and constraints
- The source folder is the root scan location.
- Target folders are configured from the app and must remain child paths relative to the base folder.
- Images are processed through ImageMagick CLI calls with `shell: false` for reliability.
- Output files should preserve the original input filename unless a deliberate naming rule is introduced later.
- Keep the application portable and avoid assuming a fixed installation path.
- Protect user-facing config validation and avoid silently discarding invalid user selections.
- Metadata should be stripped from output images using ImageMagick `-strip`.

## Typical workflow for changes
When working on this app:
1. Check the relevant logic in `src/renderer.js` for UI state changes.
2. Check `src/main.js` for validation and ImageMagick behavior.
3. Keep changes consistent with the Windows/Electron environment.
4. Preserve the single-screen workflow and compact config UX.
5. Prefer explicit validation messages over silent failures.

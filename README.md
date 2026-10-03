# Wallpaper Manager

> [!NOTE]
> **Disclaimer:** this is 99% vibe-coded

A desktop workflow for scanning a source folder, reviewing images, choosing a crop/size preset, recompressing to JPEG, and moving the file to a target folder.

## Quick start

1. Install dependencies:
   yarn install
2. Start the app:
   yarn start

## Configuration

The configuration file defines:
- the source folder to scan (`baseFolder`)
- the available crop formats and sizes (`formats`)
- the target folders inside the working directory (`targetFolders`)

## Notes

- The app scans only the configured folder, non-recursively.
- Images are processed with ImageMagick, which is expected to be available on the PATH.
- Deletes go to the Windows recycle bin.
- The Edit tries to open the file in Adobe Photoshop if it is installed.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  loadConfig: () => ipcRenderer.invoke('load-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  selectBaseFolder: () => ipcRenderer.invoke('select-base-folder'),
  selectTargetFolder: (baseFolder) => ipcRenderer.invoke('select-target-folder', baseFolder),
  listImages: () => ipcRenderer.invoke('list-images'),
  getImageMeta: (imagePath) => ipcRenderer.invoke('get-image-meta', imagePath),
  waitForFileChange: (imagePath) => ipcRenderer.invoke('wait-for-file-change', imagePath),
  openEditor: (imagePath) => ipcRenderer.invoke('open-editor', imagePath),
  deleteImage: (imagePath) => ipcRenderer.invoke('delete-image', imagePath),
  applyTarget: (payload) => ipcRenderer.invoke('apply-target', payload)
});

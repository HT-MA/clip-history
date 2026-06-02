const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('clipAPI', {
  getAllItems: () => ipcRenderer.invoke('get-all-items'),
  getItems: () => ipcRenderer.invoke('get-items'),
  searchItems: (query) => ipcRenderer.invoke('search-items', query),
  toggleFavorite: (id) => ipcRenderer.invoke('toggle-favorite', id),
  copyItem: (content) => ipcRenderer.invoke('copy-item', content),
  copyImageItem: (dataUrl) => ipcRenderer.invoke('copy-image-item', dataUrl),
  pasteToActive: () => ipcRenderer.invoke('paste-to-active'),
  hideWindow: () => ipcRenderer.invoke('hide-window'),
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  togglePause: () => ipcRenderer.invoke('toggle-pause'),
  clearAll: () => ipcRenderer.invoke('clear-all'),
  deleteItem: (id) => ipcRenderer.invoke('delete-item', id),
  getStatus: () => ipcRenderer.invoke('get-status'),
  exportData: () => ipcRenderer.invoke('export-data'),
  importData: () => ipcRenderer.invoke('import-data'),

  onItemsUpdated: (cb) => {
    ipcRenderer.on('items-updated', (_, items) => cb(items));
  },
  onHistoryCleared: (cb) => {
    ipcRenderer.on('history-cleared', () => cb());
  },
  onPauseChanged: (cb) => {
    ipcRenderer.on('pause-changed', (_, paused) => cb(paused));
  },
  onWindowShown: (cb) => {
    ipcRenderer.on('window-shown', () => cb());
  },
  onConfirmClear: (cb) => {
    ipcRenderer.on('confirm-clear', () => cb());
  },
  onToastShow: (cb) => {
    ipcRenderer.on('toast-show', (_, text) => cb(text));
  }
});
const { app, BrowserWindow, Tray, Menu, clipboard, globalShortcut, nativeImage, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const Store = require('electron-store');
const fs = require('fs');

// ─── Logging ───
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
const logStream = fs.createWriteStream(path.join(logDir, 'clip-history.log'), { flags: 'a' });
function log(level, msg) {
  const line = `[${new Date().toISOString()}] [${level}] ${msg}` + "\n";
  logStream.write(line);
}

const store = new Store({
  name: 'clip-history',
  schema: {
    items: {
      type: 'array',
      default: [],
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          content: { type: 'string' },
          contentType: { type: 'string', default: 'text' },
          createdAt: { type: 'string' },
          isFavorite: { type: 'boolean', default: false }
        }
      }
    },
    windowBounds: {
      type: 'object',
      default: { x: 0, y: 30, width: 420, height: 600 }
    }
  }
});

const MAX_CONTENT_LENGTH = 50000;

let mainWindow = null;
let tray = null;
let isQuitting = false;
let isPaused = false;
let lastContent = '';
// Set-based guard with expiry to prevent race conditions
const selfCopyGuard = new Map();
const GUARD_TTL = 2000;

function createWindow() {
  const bounds = store.get('windowBounds');

  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    minWidth: 300,
    minHeight: 400,
    alwaysOnTop: true,
    frame: false,
    transparent: false,
    resizable: true,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Save window bounds on move/resize
  mainWindow.on('resize', saveBounds);
  mainWindow.on('move', saveBounds);

  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

function saveBounds() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try {
    const bounds = mainWindow.getBounds();
    store.set('windowBounds', { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height });
  } catch (_) {}
}

function createTray() {
  const icon = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAAKRJREFUWEft1rENwjAQBdD/FYyAWIAJYAQKOkZgBDoWYARGYARGYARGYAQK4kjWybElf/6XkixZ9tP3t08pMTzGcRwBPOdcJgw457YAnpxzWwDXvu9vLcCrjJkBHJ0XT56mDZ77wNeAvQIdADfPswgE86sTQVMD9wJsJw8BofzGE4haQSe6pwDa2r9JQk5K/aFaQdL0U/JLgHYOLzmj8ynwBu+FJXEhMJUAAAAAAElFTkSuQmCC'
  );
  tray = new Tray(icon);
  tray.setToolTip('ClipHistory');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show / Hide',
      click: () => toggleWindow()
    },
    {
      label: 'Pause Monitoring',
      type: 'checkbox',
      checked: false,
      click: (item) => {
        isPaused = item.checked;
        if (mainWindow) {
          mainWindow.webContents.send('pause-changed', isPaused);
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Export History',
      click: () => exportHistory()
    },
    {
      label: 'Import History',
      click: () => importHistory()
    },
    { type: 'separator' },
    {
      label: 'Clear History',
      click: () => {
        if (mainWindow) {
          mainWindow.webContents.send('confirm-clear');
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Exit',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('click', () => toggleWindow());
}

function toggleWindow() {
  if (!mainWindow) return;
  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.send('window-shown');
  }
}

// ─── Debounced storage ───
let itemsCache = null;
let flushTimer = null;
function scheduleFlush() {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    if (itemsCache) {
      try { store.set('items', itemsCache); } catch (e) { log('ERROR', 'flush: ' + e.message); }
    }
    flushTimer = null;
  }, 3000);
}

function cleanOldItems() {
  const items = itemsCache || store.get('items');
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const filtered = items.filter(i => new Date(i.createdAt).getTime() > cutoff);
  if (filtered.length !== items.length) {
    itemsCache = filtered;
    scheduleFlush();
  }
}

// ─── Export / Import ───
async function exportHistory() {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Clipboard History',
    defaultPath: `clip-history-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (!result.canceled && result.filePath) {
    try {
      fs.writeFileSync(result.filePath, JSON.stringify(itemsCache || [], null, 2), 'utf-8');
      if (mainWindow) mainWindow.webContents.send('toast-show', 'Exported successfully');
    } catch (e) {
      log('ERROR', 'export: ' + e.message);
      if (mainWindow) mainWindow.webContents.send('toast-show', 'Export failed');
    }
  }
}

async function importHistory() {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Import Clipboard History',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile']
  });
  if (!result.canceled && result.filePaths.length > 0) {
    try {
      const raw = fs.readFileSync(result.filePaths[0], 'utf-8');
      const imported = JSON.parse(raw);
      if (!Array.isArray(imported)) throw new Error('Invalid format');
      // Merge: prepend imported items, dedup by id
      const existingIds = new Set((itemsCache || []).map(i => i.id));
      const newItems = imported.filter(i => i.id && i.content && !existingIds.has(i.id));
      itemsCache = [...newItems, ...(itemsCache || [])].slice(0, 500);
      scheduleFlush();
      if (mainWindow) {
        mainWindow.webContents.send('items-updated', itemsCache);
        mainWindow.webContents.send('toast-show', `Imported ${newItems.length} items`);
      }
    } catch (e) {
      log('ERROR', 'import: ' + e.message);
      if (mainWindow) mainWindow.webContents.send('toast-show', 'Import failed: invalid file');
    }
  }
}

// ─── Clipboard Monitor ───
let lastImageHash = '';

function startClipboardMonitor() {
  // Load items into memory cache
  try { itemsCache = store.get('items'); } catch (e) { log('ERROR', 'load items: ' + e.message); itemsCache = []; }

  // Clean expired guard entries periodically
  setInterval(() => {
    const now = Date.now();
    for (const [key, ts] of selfCopyGuard) { if (now - ts > GUARD_TTL) selfCopyGuard.delete(key); }
  }, 5000);

  // Clean old items on startup
  cleanOldItems();

  setInterval(() => {
    if (isPaused) return;
    try {
      // Check image first
      const img = clipboard.readImage();
      if (!img.isEmpty()) {
        const hash = img.toDataURL().slice(-64);
        if (hash === lastImageHash) return;
        lastImageHash = hash;

        // Create thumbnail
        const thumb = img.resize({ width: 80 });
        const dataUrl = thumb.toDataURL();

        const item = {
          id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
          content: dataUrl,
          contentType: 'image',
          createdAt: new Date().toISOString(),
          isFavorite: false
        };
        itemsCache.unshift(item);
        itemsCache = itemsCache.slice(0, 500);
        scheduleFlush();

        if (mainWindow && mainWindow.isVisible()) {
          mainWindow.webContents.send('items-updated', itemsCache);
        }
        return;
      }

      // Then check text
      const text = clipboard.readText();
      if (!text || text === lastContent) return;

      lastContent = text;

      // Skip if this was our own copy action (Set-based guard)
      if (selfCopyGuard.has(text)) { selfCopyGuard.delete(text); return; }

      // Dedup: check if already in history
      const isDup = itemsCache.length > 0 && itemsCache[0].content === text;
      if (isDup) return;

      // Content size limit
      const truncated = text.length > MAX_CONTENT_LENGTH
        ? text.slice(0, MAX_CONTENT_LENGTH) + '\u2026'
        : text;

      const contentType = /^https?:\/\//.test(text) ? 'url' : 'text';
      itemsCache.unshift({
        id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
        content: truncated,
        contentType,
        createdAt: new Date().toISOString(),
        isFavorite: false
      });

      // Trim to 500 max items
      itemsCache = itemsCache.slice(0, 500);
      scheduleFlush();

      if (mainWindow && mainWindow.isVisible()) {
        mainWindow.webContents.send('items-updated', itemsCache);
      }
    } catch (_) {
      log('WARN', 'clipboard read failed (may be locked)');
    }
  }, 1000);

  // Periodically clean old items (every hour)
  setInterval(() => cleanOldItems(), 60 * 60 * 1000);
}

// ─── Paste simulation (Windows) ───
async function pasteToActiveWindow() {
  try {
    require('child_process').exec('powershell -Command "$wshell = New-Object -ComObject WScript.Shell; $wshell.SendKeys(\'^v\')"', (err) => {
      if (err) log('ERROR', 'paste: ' + err.message);
    });
  } catch (e) {
    log('ERROR', 'paste: ' + e.message);
  }
}

// ─── IPC Handlers ───

ipcMain.handle('get-all-items', () => {
  return itemsCache || store.get('items');
});

ipcMain.handle('get-items', () => {
  return itemsCache || store.get('items');
});

ipcMain.handle('search-items', (_, query) => {
  const items = itemsCache || store.get('items');
  if (!query) return items;

  if (query.startsWith('!')) {
    const rest = query.slice(1).trim().toLowerCase();
    const favs = items.filter(i => i.isFavorite);
    if (!rest) return favs;
    return favs.filter(i => i.content.toLowerCase().includes(rest));
  }

  const q = query.toLowerCase();
  return items.filter(i => i.content.toLowerCase().includes(q));
});

ipcMain.handle('toggle-favorite', (_, id) => {
  const item = itemsCache.find(i => i.id === id);
  if (item) {
    item.isFavorite = !item.isFavorite;
    scheduleFlush();
  }
  return itemsCache;
});

ipcMain.handle('copy-item', (_, content) => {
  selfCopyGuard.set(content, Date.now());
  clipboard.writeText(content);
  return true;
});

ipcMain.handle('copy-image-item', (_, dataUrl) => {
  const img = nativeImage.createFromDataURL(dataUrl);
  clipboard.writeImage(img);
  return true;
});

ipcMain.handle('paste-to-active', async () => {
  // Hide window and paste
  if (mainWindow) mainWindow.hide();
  await new Promise(r => setTimeout(r, 150));
  await pasteToActiveWindow();
  return true;
});

ipcMain.handle('hide-window', () => {
  if (mainWindow) mainWindow.hide();
});

ipcMain.handle('minimize-window', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.handle('toggle-pause', () => {
  isPaused = !isPaused;
  return isPaused;
});

ipcMain.handle('clear-all', () => {
  itemsCache = [];
  scheduleFlush();
  return [];
});

ipcMain.handle('delete-item', (_, id) => {
  const filtered = itemsCache.filter(i => i.id !== id);
  itemsCache = filtered;
  scheduleFlush();
  return filtered;
});

ipcMain.handle('get-status', () => {
  return { paused: isPaused, count: (itemsCache || []).length };
});

ipcMain.handle('export-data', async () => {
  await exportHistory();
});

ipcMain.handle('import-data', async () => {
  await importHistory();
});

// ─── App Lifecycle ───

app.whenReady().then(() => {
  createWindow();
  createTray();
  startClipboardMonitor();

  globalShortcut.register('CommandOrControl+Shift+V', () => {
    toggleWindow();
  });

  setTimeout(() => {
    mainWindow.show();
    mainWindow.focus();
  }, 300);
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  saveBounds();
  // Final flush before quit
  if (flushTimer) { clearTimeout(flushTimer); try { store.set('items', itemsCache || []); } catch (_) {} }
  logStream.end();
});

app.on('window-all-closed', () => {
  // Don't quit - tray keeps app alive
});
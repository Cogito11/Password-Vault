const { app, BrowserWindow, ipcMain, dialog, session, clipboard, powerMonitor } = require('electron');
const fs   = require('fs');
const path = require('path');
const { writeFileAtomic } = require('./fs-atomic');

const configPath = path.join(app.getPath('userData'), 'vault-config.json');

let _config = null;

function getIconPath() {
  const base = path.join(__dirname, 'PasswordVault/assets/logos');
  switch (process.platform) {
    case 'win32': return path.join(base, 'Password Vault Logo.ico');
    case 'linux': return path.join(base, 'icons', '256x256.png');
    case 'darwin': return path.join(base, 'Password Vault Logo.icns');
    default: return path.join(base, 'Password Vault Logo.png');
  }
}

function getConfig() {
  if (_config) return _config;

  let raw = null;
  try { raw = fs.readFileSync(configPath, 'utf8'); }
  catch (e) { /* no config yet, that's fine */ }

  if (raw === null) {
    _config = {};
    return _config;
  }

  try {
    const parsed = JSON.parse(raw);
    _config = (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
  } catch (e) {
    // The file exists but is unreadable. Keep a copy instead of silently
    // starting over (the next save would otherwise overwrite it for good).
    try { fs.copyFileSync(configPath, configPath + '.corrupt'); } catch (_) { /* best effort */ }
    _config = {};
  }

  return _config;
}

function setConfig(key, val) {
  const conf = getConfig();
  conf[key] = val;
  writeFileAtomic(configPath, JSON.stringify(conf));
}

// Folders that should never be treated as password books
function isIgnoredFolder(name) {
  return name.startsWith('.') || name === '$RECYCLE.BIN' || name === 'System Volume Information' || name === 'node_modules';
}

let mainWindow = null;

// ── Clipboard clearing ──────────────────────────────────────────────
// After a value is copied (and the user has turned this on), the clipboard is
// emptied again after a delay, but only if it still holds that same text, so
// something the user copied afterwards is never wiped. This lives here rather
// than in the page so it survives a page reload and can be flushed on quit.
let clipboardTimer = null;
let clipboardPending = null;

function runClipboardClear() {
  clearTimeout(clipboardTimer);
  clipboardTimer = null;

  if (clipboardPending !== null) {
    try {
      if (clipboard.readText() === clipboardPending) clipboard.clear();
    } catch (e) { /* clipboard unavailable, nothing to do */ }
  }

  clipboardPending = null;
}

function scheduleClipboardClear(text, seconds) {
  if (typeof text !== 'string' || !text) return false;

  const secs = Math.min(600, Math.max(1, Math.round(Number(seconds)) || 30));

  clearTimeout(clipboardTimer);
  clipboardPending = text;
  clipboardTimer = setTimeout(runClipboardClear, secs * 1000);
  return true;
}

// Tell the page the computer was locked or is going to sleep (it decides what to do)
function notifySystemLock(reason) {
  runClipboardClear(); // leaving the computer: don't leave a copied password behind
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('system-lock', reason);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,

    // Minimum size
    minWidth: 380,
    minHeight: 350,

    title: "Password Vault",
    icon: getIconPath(),
    autoHideMenuBar: true,
    backgroundColor: '#1a1a1a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      sandbox: false
    },
  });

  mainWindow = win;
  win.on('closed', () => { if (mainWindow === win) mainWindow = null; });

  win.once('ready-to-show', () => {
    win.show();
  });

  win.loadFile('PasswordVault/index.html');
}

app.whenReady().then(() => {
  ipcMain.handle('schedule-clipboard-clear', (_event, text, seconds) => scheduleClipboardClear(text, seconds));

  // 'lock-screen' is only emitted on Windows and macOS; 'suspend' on all platforms
  powerMonitor.on('lock-screen', () => notifySystemLock('lock-screen'));
  powerMonitor.on('suspend', () => notifySystemLock('suspend'));

  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(true);
  });

  ipcMain.handle('get-default-path', () => {
    return getConfig().defaultVaultPath || null;
  });

  ipcMain.handle('set-default-path', (event, targetPath) => {
    setConfig('defaultVaultPath', targetPath);
  });

  ipcMain.handle('create-default-vault', async () => {
    const vaultPath = path.join(app.getPath('documents'), 'Password Vault');
    fs.mkdirSync(vaultPath, { recursive: true }); // no-op if it already exists
    setConfig('defaultVaultPath', vaultPath);     // Remember it for next time
    return vaultPath;
  });

  ipcMain.handle('open-folder', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
    return result.canceled ? null : result.filePaths[0];
  });

  // Fast launch scan, structure only, no file contents
  ipcMain.handle('scan-vault-structure', async (event, vaultPath) => {
    if (!vaultPath || !fs.existsSync(vaultPath)) return null;

    const name = path.basename(vaultPath);
    const entries = fs.readdirSync(vaultPath, { withFileTypes: true });

    const subBooks = [];
    const hasTxt = [];
    let hasEnc = false;

    for (const entry of entries) {
      if (entry.isDirectory()) 
      {
        if (isIgnoredFolder(entry.name)) continue;

        const bookPath = path.join(vaultPath, entry.name);
        const isEncrypted = fs.existsSync(path.join(bookPath, 'vault.enc'));
        subBooks.push({ name: entry.name, path: bookPath, isEncrypted });
      } 
      else if (entry.isFile() && entry.name.toLowerCase().endsWith('.txt')) 
      {
        hasTxt.push(entry.name);
      } 
      else if (entry.isFile() && entry.name.toLowerCase().endsWith('.enc')) 
      {
        hasEnc = true;
      }
    }

    return { name, path: vaultPath, subBooks, hasTxt, hasEnc };
  });

  // On-demand file read — only called when user opens a book/collection
  ipcMain.handle('read-book-files', async (event, bookPath) => {
    const entries  = await fs.promises.readdir(bookPath, { withFileTypes: true });
    const txtFiles = await Promise.all(
      entries
        .filter(e => e.isFile() && e.name.toLowerCase().endsWith('.txt'))
        .map(async e => ({
          name: e.name,
          text: await fs.promises.readFile(path.join(bookPath, e.name), 'utf8')
        }))
    );
    return txtFiles;
  });

  // On-demand single-book flat .txt read (for single-book vaults)
  ipcMain.handle('read-vault-files', async (event, vaultPath) => {
    const entries  = await fs.promises.readdir(vaultPath, { withFileTypes: true });
    const txtFiles = await Promise.all(
      entries
        .filter(e => e.isFile() && e.name.toLowerCase().endsWith('.txt'))
        .map(async e => ({
          name: e.name,
          text: await fs.promises.readFile(path.join(vaultPath, e.name), 'utf8')
        }))
    );
    return txtFiles;
  });
  
  createWindow();
});

// Don't leave a copied value on the clipboard just because the app was closed
app.on('before-quit', runClipboardClear);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

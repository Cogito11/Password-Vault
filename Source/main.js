const { app, BrowserWindow, ipcMain, dialog, session } = require('electron');
const fs   = require('fs');
const path = require('path');

const configPath = path.join(app.getPath('userData'), 'vault-config.json');

function getConfig() {
  try { return JSON.parse(fs.readFileSync(configPath, 'utf8')); }
  catch(e) { return {}; }
}

function setConfig(key, val) {
  const conf = getConfig();
  conf[key] = val;
  fs.writeFileSync(configPath, JSON.stringify(conf));
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "Password Vault",
    icon: path.join(__dirname, 'PasswordVault.ico'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
  });
  win.loadFile('Password Vault.html');
}

app.whenReady().then(() => {
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

  /**
   * Scan a vault folder by path and return its structure so the renderer
   * can load it without going through the Web File System Access API picker.
   * Returns null if the path doesn't exist.
   */
  ipcMain.handle('scan-vault-path', async (event, vaultPath) => {
    if (!vaultPath || !fs.existsSync(vaultPath)) return null;

    const name = path.basename(vaultPath);
    const entries = fs.readdirSync(vaultPath, { withFileTypes: true });

    // Collect sub-directories (password books) and top-level .txt files
    const subBooks = [];
    const txtFiles = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const bookPath = path.join(vaultPath, entry.name);
        const isEncrypted = fs.existsSync(path.join(bookPath, 'vault.enc'));
        subBooks.push({ name: entry.name, path: bookPath, isEncrypted });
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.txt')) {
        const text = fs.readFileSync(path.join(vaultPath, entry.name), 'utf8');
        txtFiles.push({ name: entry.name, text });
      }
    }

    // For each sub-book, collect its .txt files and encrypted status
    const books = subBooks.map(b => {
      const bookEntries = fs.readdirSync(b.path, { withFileTypes: true });
      const txts = [];
      for (const e of bookEntries) {
        if (e.isFile() && e.name.toLowerCase().endsWith('.txt')) {
          txts.push({ name: e.name, text: fs.readFileSync(path.join(b.path, e.name), 'utf8') });
        }
      }
      return { name: b.name, path: b.path, isEncrypted: b.isEncrypted, txtFiles: txts };
    });

    return { name, path: vaultPath, subBooks: books, txtFiles };
  });
  
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

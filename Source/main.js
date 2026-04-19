const { app, BrowserWindow, ipcMain, dialog, session } = require('electron');
const fs   = require('fs');
const path = require('path');

const configPath = path.join(app.getPath('userData'), 'vault-config.json');

let _config = null;

function getConfig() {
  if (_config) return _config;
  try { _config = JSON.parse(fs.readFileSync(configPath, 'utf8')); }
  catch(e) { _config = {}; }
  return _config;
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
    show: false,
    title: "Password Vault",
    icon: path.join(__dirname, 'PasswordVault/assets/logos/PasswordVault.ico'),
    ///autoHideMenuBar: true,
    backgroundColor: '#1a1a1a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      sandbox: false
    },
  });

  win.once('ready-to-show', () => {
    console.log('ready-to-show fired at', Date.now());
    win.show();
  });

  win.webContents.on('did-finish-load', () => {
    console.log('did-finish-load fired at', Date.now());
  });

  win.loadFile('PasswordVault/index.html');
}

app.whenReady().then(() => {
  console.time('ready-to-createWindow');
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
  console.timeEnd('ready-to-createWindow');
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

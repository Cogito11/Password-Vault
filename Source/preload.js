const { contextBridge, ipcRenderer, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const { writeFileAtomic } = require('./fs-atomic');

const packageJsonPath = path.join(__dirname, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

contextBridge.exposeInMainWorld('electronAPI', {
  openExternal: (url) => shell.openExternal(url),
  getAppVersion: () => packageJson.version || 'unknown',
  // Config & Path exposed to the frontend
  createDefaultVault: () => ipcRenderer.invoke('create-default-vault'),
  getDefaultPath: () => ipcRenderer.invoke('get-default-path'),
  setDefaultPath: (targetPath) => ipcRenderer.invoke('set-default-path', targetPath),
  
  scanVaultStructure: (vaultPath) => ipcRenderer.invoke('scan-vault-structure', vaultPath),

    // On-demand file reads
    readBookFiles: (bookPath)  => ipcRenderer.invoke('read-book-files', bookPath),
    readVaultFiles: (vaultPath) => ipcRenderer.invoke('read-vault-files', vaultPath),

  // Security
  /** Ask the main process to empty the clipboard after `seconds`, if it still holds `text` */
  scheduleClipboardClear: (text, seconds) => ipcRenderer.invoke('schedule-clipboard-clear', String(text), Number(seconds)),

  /** Be told when the computer is locked or goes to sleep (cb receives the reason) */
  onSystemLock: (cb) => {
    if (typeof cb === 'function') ipcRenderer.on('system-lock', (_event, reason) => cb(String(reason)));
  },
});

contextBridge.exposeInMainWorld('vault', {
  /** Open a native folder-picker dialog; resolves to a path string or null if cancelled */
  openFolder: () => ipcRenderer.invoke('open-folder'),

  /**
   * Read a directory synchronously.
   * Returns plain { name, isFile, isDirectory } objects — NOT Dirent instances.
   * Dirent class methods are stripped when values cross the contextBridge.
   */
  readDir: (folderPath) => fs.readdirSync(folderPath, { withFileTypes: true }).map(e => ({
    name: e.name,
    // resolved to boolean here, in the Node context
    isFile: e.isFile(),
    // resolved to boolean here, in the Node context
    isDirectory: e.isDirectory(),  
  })),

  /** Read a text file synchronously */
  readFile: (p) => fs.readFileSync(p, 'utf8'),

  /**
   * Write a text file. Crash-safe: the new contents are written to a temp file
   * and renamed over the destination, so a failed write never damages the
   * existing file. opts: { exclusive } fail if the file already exists.
   */
  writeFile: (p, data, opts) => writeFileAtomic(p, String(data), opts),

  /**
   * Write a binary file (accepts Uint8Array / Buffer), crash-safe like writeFile.
   * opts: { exclusive } fail if it already exists, { backup } keep the previous
   * version as <file>.bak.
   */
  writeFileBin: (p, buf, opts) => writeFileAtomic(p, Buffer.from(buf), opts),

  /** Read a binary file synchronously; returns a Buffer */
  readFileBin: (p) => fs.readFileSync(p),

  /**
   * Create a directory. Deliberately NOT recursive: it fails with EEXIST if the
   * folder is already there, so creating a "new" book can never silently reuse
   * (and then overwrite files in) an existing one.
   */
  mkdir: (p) => fs.mkdirSync(p),

  /** Delete a file */
  deleteFile: (p) => fs.unlinkSync(p),

  /** Remove an EMPTY directory (fails if anything is still inside it) */
  rmdir: (p) => fs.rmdirSync(p),

  /** Rename / move a file or directory */
  rename: (oldP, newP) => fs.renameSync(oldP, newP),

  /** Return true if the path exists */
  exists: (p) => fs.existsSync(p),

  /** Join path segments using the OS separator */
  joinPath: (...args) => path.join(...args),

  /** Return the last segment of a path (i.e. the folder/file name) */
  basename: (p) => path.basename(p),
});

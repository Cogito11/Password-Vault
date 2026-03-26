const { contextBridge, ipcRenderer } = require('electron');
const fs   = require('fs');
const path = require('path');

contextBridge.exposeInMainWorld('electronAPI', {
  // Config & Path exposed to the frontend
  createDefaultVault: () => ipcRenderer.invoke('create-default-vault'),
  getDefaultPath:     () => ipcRenderer.invoke('get-default-path'),
  setDefaultPath:     (targetPath) => ipcRenderer.invoke('set-default-path', targetPath),
  /** Scan a vault folder by absolute path; returns structure or null */
  scanVaultPath:      (vaultPath) => ipcRenderer.invoke('scan-vault-path', vaultPath),
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
    name:        e.name,
    isFile:      e.isFile(),       // resolved to boolean here, in the Node context
    isDirectory: e.isDirectory(),  // resolved to boolean here, in the Node context
  })),

  /** Read a text file synchronously */
  readFile:     (p)       => fs.readFileSync(p, 'utf8'),

  /** Write a text file synchronously */
  writeFile:    (p, data) => fs.writeFileSync(p, data),

  /** Write a binary file synchronously (accepts Uint8Array / Buffer) */
  writeFileBin: (p, buf)  => fs.writeFileSync(p, Buffer.from(buf)),

  /** Read a binary file synchronously; returns a Buffer */
  readFileBin:  (p)       => fs.readFileSync(p),

  /** Delete a file */
  deleteFile:   (p)       => fs.unlinkSync(p),

  /** Delete a directory recursively */
  deleteDir:    (p)       => fs.rmSync(p, { recursive: true, force: true }),

  /** Rename / move a file or directory */
  rename:       (oldP, newP) => fs.renameSync(oldP, newP),

  /** Return true if the path exists */
  exists:       (p)       => fs.existsSync(p),

  /** Join path segments using the OS separator */
  joinPath:     (...args) => path.join(...args),

  /** Return the last segment of a path (i.e. the folder/file name) */
  basename:     (p)       => path.basename(p),
});

/* ═══════════════════════════════
   VAULT-IO  —  transparent file I/O for both Web FS API and Electron path mode
   All functions route through the active book, falling back to Node fs when
   isElectronPathMode is true.
═══════════════════════════════ */

/* ── Helpers to resolve the active book's handle / key / flags ── */

/** Safe name accessor — works in FileSystemHandle mode and Electron path mode. */
function vaultName() {
  if (dirHandle) return dirHandle.name;
  if (_electronVaultPath) {
    return _electronVaultPath.split(/[\/\\]/).filter(Boolean).pop() || _electronVaultPath;
  }
  return 'Vault';
}

function getBookHandle()    { return isMultiBookMode ? activeBookHandle : dirHandle; }
function getBookKey()       { return isMultiBookMode ? (bookHandles[activeBookName] ? bookHandles[activeBookName].key : null) : vaultKey; }
function bookIsEncrypted()  { return isMultiBookMode ? (bookHandles[activeBookName] ? bookHandles[activeBookName].isEncrypted : false) : isEncryptedVault; }

/**
 * Returns the absolute path for the active book directory.
 * Only meaningful in Electron path mode.
 */
function getBookPath() {
  if (!isElectronPathMode) return null;
  if (isMultiBookMode && activeBookName && bookHandles[activeBookName]) {
    return bookHandles[activeBookName].path || null;
  }
  return _electronVaultPath || null;
}

/* ── Active-book I/O ── */

/** Write text to a file in the active book. */
async function bookWriteFile(filename, text) {
  if (isElectronPathMode) {
    window.vault.writeFile(window.vault.joinPath(getBookPath(), filename), text);
    return;
  }
  var fh = await getBookHandle().getFileHandle(filename, { create: true });
  var w  = await fh.createWritable();
  await w.write(text); await w.close();
}

/** Write binary (Uint8Array) to a file in the active book. */
async function bookWriteBin(filename, bytes) {
  if (isElectronPathMode) {
    window.vault.writeFileBin(window.vault.joinPath(getBookPath(), filename), bytes);
    return;
  }
  var fh = await getBookHandle().getFileHandle(filename, { create: true });
  var w  = await fh.createWritable();
  await w.write(bytes); await w.close();
}

/** Read binary from a file in the active book. Returns Uint8Array. */
async function bookReadBin(filename) {
  if (isElectronPathMode) {
    return new Uint8Array(window.vault.readFileBin(window.vault.joinPath(getBookPath(), filename)));
  }
  var fh = await getBookHandle().getFileHandle(filename);
  return new Uint8Array(await (await fh.getFile()).arrayBuffer());
}

/** Delete a file from the active book. */
async function bookDeleteFile(filename) {
  if (isElectronPathMode) {
    window.vault.deleteFile(window.vault.joinPath(getBookPath(), filename));
    return;
  }
  await getBookHandle().removeEntry(filename);
}

/* ── Named-book I/O (operates on an arbitrary book by name) ── */

/** Write binary to a specific named book's file. */
async function namedBookWriteBin(bookName, filename, bytes) {
  var info = bookHandles[bookName];
  if (isElectronPathMode) {
    window.vault.writeFileBin(window.vault.joinPath(info.path, filename), bytes);
    return;
  }
  var fh = await info.handle.getFileHandle(filename, { create: true });
  var w  = await fh.createWritable();
  await w.write(bytes); await w.close();
}

/** Read binary from a specific named book's file. Returns Uint8Array. */
async function namedBookReadBin(bookName, filename) {
  var info = bookHandles[bookName];
  if (isElectronPathMode) {
    return new Uint8Array(window.vault.readFileBin(window.vault.joinPath(info.path, filename)));
  }
  var fh = await info.handle.getFileHandle(filename);
  return new Uint8Array(await (await fh.getFile()).arrayBuffer());
}

/** Write text to a specific named book's file. */
async function namedBookWriteFile(bookName, filename, text) {
  var info = bookHandles[bookName];
  if (isElectronPathMode) {
    window.vault.writeFile(window.vault.joinPath(info.path, filename), text);
    return;
  }
  var fh = await info.handle.getFileHandle(filename, { create: true });
  var w  = await fh.createWritable();
  await w.write(text); await w.close();
}

/** Delete a file from a specific named book. */
async function namedBookDeleteFile(bookName, filename) {
  var info = bookHandles[bookName];
  if (isElectronPathMode) {
    window.vault.deleteFile(window.vault.joinPath(info.path, filename));
    return;
  }
  await info.handle.removeEntry(filename);
}

/** List files in a specific named book. Returns array of { name, isFile, isDirectory }. */
async function namedBookListFiles(bookName) {
  var info = bookHandles[bookName];
  if (isElectronPathMode) {
    return window.vault.readDir(info.path);
  }
  var files = [];
  for await (var entry of info.handle.values()) {
    files.push({ name: entry.name, isFile: entry.kind === 'file', isDirectory: entry.kind === 'directory' });
  }
  return files;
}

/* ── Plain-text file parser ── */

/**
 * Parse a .txt collection file into an entries array.
 * Format:
 *   Entry Name (N attributes)
 *       Key: Value
 *   (blank line)
 *   End
 */
function parseFile(text) {
  var entries = [];
  var lines   = text.split(/\r?\n/);
  var cur     = null;

  for (var i = 0; i < lines.length; i++) {
    var raw = lines[i];
    var tr  = raw.trim();
    if (!tr || /^end$/i.test(tr) || /^[-=]/.test(tr)) continue;

    if (/^\s/.test(raw) && cur) {
      var ci = tr.indexOf(':');
      if (ci > 0) cur.attrs.push({ key: tr.slice(0, ci).trim(), val: tr.slice(ci + 1).trim() });
      continue;
    }

    cur = { name: tr.replace(/\s*\(\d+\s*(?:attributes?)?\)\s*$/i, '').trim(), attrs: [] };
    if (cur.name) entries.push(cur);
  }
  return entries;
}

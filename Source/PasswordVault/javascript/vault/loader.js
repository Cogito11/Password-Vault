/* ═══════════════════════════════
   VAULT / LOADER  —  open, scan, and load vault folders
   Covers single-book, multi-book, Electron path, and Web FS API modes.
═══════════════════════════════ */

/* ── Startup auto-load ── */

/**
 * Called once on startup. Checks for a stored default vault path/handle
 * and loads it automatically if permission is already granted, or shows
 * the resume banner if a prompt is needed.
 */
async function tryAutoLoadDefault() {
  if (_autoLoadDone) return;
  _autoLoadDone = true;

  /* Electron path-based auto-load (Node fs — no picker needed) */
  if (window.electronAPI && window.electronAPI.getDefaultPath) {
    var storedPath = await window.electronAPI.getDefaultPath();
    if (storedPath) {
      var folderName = storedPath.split(/[\/\\]/).filter(Boolean).pop() || storedPath;
      updateDefaultUI(folderName);
      statusTxt.textContent = 'Loading default folder\u2026';
      await loadFromElectronPath(storedPath);
      return;
    }
    document.getElementById('resumeBanner').classList.add('visible');
    return;
  }

  /* Fallback: Web File System Access API */
  var savedName = getDefaultName();
  if (savedName) updateDefaultUI(savedName);

  var handle = await getDefaultDirHandle();
  if (!handle) {
    document.getElementById('resumeBanner').classList.add('visible');
    return;
  }

  var perm;
  try { perm = await handle.queryPermission({ mode: 'readwrite' }); } catch (_) { return; }
  if (perm === 'denied') return;
  if (perm === 'granted') { await loadHandleNow(handle); return; }
  try {
    var granted = await handle.requestPermission({ mode: 'readwrite' });
    if (granted === 'granted') await loadHandleNow(handle);
  } catch (_) {}
}

/**
 * Core load logic for a FileSystemHandle — called either when permission
 * is already granted or after the resume banner provides the user gesture.
 */
async function loadHandleNow(handle) {
  saveDefaultName(handle.name);
  updateDefaultUI(handle.name);
  statusTxt.textContent = 'Loading default folder\u2026';

  try {
    var subBooks = [];
    for await (var entry of handle.values()) {
      if (entry.kind !== 'directory') continue;
      var bookInfo = { name: entry.name, handle: entry, isEncrypted: false };
      try { await entry.getFileHandle('vault.enc'); bookInfo.isEncrypted = true; subBooks.push(bookInfo); continue; } catch (_) {}
      subBooks.push(bookInfo);
    }

    if (subBooks.length > 0) {
      dirHandle = handle;
      isMultiBookMode = true;
      bookHandles = {};
      subBooks.forEach(function (b) {
        bookHandles[b.name] = { handle: b.handle, isEncrypted: b.isEncrypted, isUnlocked: false, key: null, collections: {} };
      });
      enterMultiBookMode(subBooks);
    } else {
      var hasVault = false;
      try { await handle.getFileHandle('vault.enc'); hasVault = true; } catch (_) {}
      dirHandle = handle;
      isMultiBookMode = false;
      if (hasVault) {
        openVaultUnlockModal(null);
      } else {
        await loadPlainFolder();
      }
    }
  } catch (err) {
    statusTxt.textContent = 'Could not load default folder: ' + err.message;
  }
}

/* ── Plain-text folder load ── */

/** Read all .txt files from the active folder and populate the sidebar. */
async function loadPlainFolder() {
  isEncryptedVault = false;
  vaultKey = null;
  var results = [];

  if (isElectronPathMode && _electronVaultPath) {
    var data = await window.electronAPI.scanVaultPath(_electronVaultPath);
    if (data) {
      (data.txtFiles || []).forEach(function (f) {
        results.push({ name: f.name, entries: parseFile(f.text) });
      });
    }
  } else {
    for await (var entry of dirHandle.values()) {
      if (entry.kind === 'file' && entry.name.toLowerCase().endsWith('.txt')) {
        var file = await entry.getFile();
        var text = await file.text();
        results.push({ name: entry.name, entries: parseFile(text) });
      }
    }
  }

  results.sort(function (a, b) { return a.name.localeCompare(b.name); });
  collections = {};
  collList.innerHTML = '';
  leftHint.style.display = 'none';
  results.forEach(function (r) { collections[r.name] = r.entries; });
  buildSidebar(results);
}

/* ── Electron path-mode load ── */

/**
 * Load a vault folder by absolute path using Node fs via the Electron
 * main process. No Web FS API picker is needed.
 */
async function loadFromElectronPath(vaultPath) {
  try {
    var data = await window.electronAPI.scanVaultPath(vaultPath);
    if (!data) {
      statusTxt.textContent = 'Default folder not found: ' + vaultPath;
      document.getElementById('resumeBanner').classList.add('visible');
      return;
    }

    saveDefaultName(data.name);
    updateDefaultUI(data.name);

    if (data.subBooks && data.subBooks.length > 0) {
      /* Multi-book mode */
      _electronVaultPath = vaultPath;
      isMultiBookMode    = true;
      isElectronPathMode = true;
      dirHandle          = null;
      bookHandles        = {};

      var subBooks = data.subBooks.map(function (b) {
        return { name: b.name, path: b.path, isEncrypted: b.isEncrypted };
      });
      subBooks.forEach(function (b) {
        bookHandles[b.name] = {
          handle:      null,
          path:        b.path,
          isEncrypted: b.isEncrypted,
          isUnlocked:  false,
          key:         null,
          collections: {}
        };
        /* Pre-load plain books from scan data */
        if (!b.isEncrypted) {
          var scanBook = data.subBooks.filter(function (s) { return s.name === b.name; })[0];
          if (scanBook) {
            var results = (scanBook.txtFiles || []).map(function (f) {
              return { name: f.name, entries: parseFile(f.text) };
            });
            results.sort(function (a, b2) { return a.name.localeCompare(b2.name); });
            bookHandles[b.name].collections = {};
            results.forEach(function (r) { bookHandles[b.name].collections[r.name] = r.entries; });
            bookHandles[b.name].isUnlocked = true;
          }
        }
      });

      enterMultiBookMode(subBooks);

    } else if (data.subBooks.length === 0 && data.txtFiles && data.txtFiles.length > 0) {
      /* Single-book plain mode */
      _electronVaultPath = vaultPath;
      isElectronPathMode = true;
      isMultiBookMode    = false;
      isEncryptedVault   = false;
      dirHandle          = null;
      var results = data.txtFiles.map(function (f) { return { name: f.name, entries: parseFile(f.text) }; });
      results.sort(function (a, b) { return a.name.localeCompare(b.name); });
      collections = {};
      results.forEach(function (r) { collections[r.name] = r.entries; });
      buildSidebar(results);
      ejectBtn.classList.add('visible');
      bookNameEl.textContent = data.name;

    } else {
      /* Empty vault folder — enter multi-book mode so user can add books */
      _electronVaultPath = vaultPath;
      isElectronPathMode = true;
      isMultiBookMode    = true;
      dirHandle          = null;
      bookHandles        = {};
      enterMultiBookMode([]);
    }
  } catch (err) {
    statusTxt.textContent = 'Could not load default folder: ' + err.message;
  }
}

/* ── Plain book load (single book inside a multi-book vault) ── */

/** Read all .txt files from a plain (non-encrypted) sub-book and cache them. */
async function loadPlainBook(bookName) {
  var info    = bookHandles[bookName];
  var results = [];

  if (isElectronPathMode) {
    window.vault.readDir(info.path)
      .filter(function (e) { return e.isFile && e.name.toLowerCase().endsWith('.txt'); })
      .forEach(function (e) {
        var text = window.vault.readFile(window.vault.joinPath(info.path, e.name));
        results.push({ name: e.name, entries: parseFile(text) });
      });
  } else {
    for await (var entry of info.handle.values()) {
      if (entry.kind === 'file' && entry.name.toLowerCase().endsWith('.txt')) {
        var file = await entry.getFile();
        var text = await file.text();
        results.push({ name: entry.name, entries: parseFile(text) });
      }
    }
  }

  results.sort(function (a, b) { return a.name.localeCompare(b.name); });
  info.collections = {};
  results.forEach(function (r) { info.collections[r.name] = r.entries; });
  info.isUnlocked = true;

  var meta = document.getElementById('book-meta-' + bookName);
  if (meta) {
    meta.textContent = results.length + ' collection' + (results.length !== 1 ? 's' : '') + ' \xb7 plain text';
  }
}

/* ── Vault folder re-scan (multi-book mode) ── */

/**
 * Re-read the vault folder and refresh the books panel without losing
 * the unlock state of books that are already open.
 */
async function rescanVaultFolder() {
  var subBooks = [];

  if (isElectronPathMode && _electronVaultPath) {
    var data = await window.electronAPI.scanVaultPath(_electronVaultPath);
    if (data) {
      data.subBooks.forEach(function (b) {
        subBooks.push({ name: b.name, path: b.path, handle: null, isEncrypted: b.isEncrypted });
      });
    }
  } else {
    for await (var entry of dirHandle.values()) {
      if (entry.kind !== 'directory') continue;
      var bookInfo = { name: entry.name, handle: entry, isEncrypted: false };
      try { await entry.getFileHandle('vault.enc'); bookInfo.isEncrypted = true; } catch (_) {}
      subBooks.push(bookInfo);
    }
  }

  /* Preserve existing unlock state */
  var oldHandles = bookHandles;
  bookHandles = {};
  subBooks.forEach(function (b) {
    var existing = oldHandles[b.name];
    bookHandles[b.name] = existing || {
      handle: b.handle || null, path: b.path || null,
      isEncrypted: b.isEncrypted, isUnlocked: false, key: null, collections: {}
    };
    if (!isElectronPathMode) bookHandles[b.name].handle = b.handle;
  });

  booksList.innerHTML = '';
  subBooks.sort(function (a, b) { return a.name.localeCompare(b.name); });
  subBooks.forEach(function (b) {
    addBookBtn(b.name, bookHandles[b.name].isEncrypted);
    if (bookHandles[b.name].isUnlocked) injectRelockBtn(b.name);
  });

  var total = subBooks.length;
  booksPanelCount.textContent = total + ' book' + (total !== 1 ? 's' : '');
  statusTxt.textContent = total + ' password book' + (total !== 1 ? 's' : '') + ' found';
}

/* ═══════════════════════════════
   VAULT / BOOKS  —  book lifecycle management
   Covers: selecting, activating, locking/relocking, deleting, renaming,
   encrypting, decrypting, and changing passwords for password books.
═══════════════════════════════ */

/* ── Selection ── */

/**
 * Handle a click on a book button in the sidebar.
 * Loads plain books immediately; shows the unlock modal for encrypted books.
 */
async function selectBook(bookName, btn) {
  var info = bookHandles[bookName];
  if (!info) return;

  if (info.isUnlocked || !info.isEncrypted) {
    if (!info.isUnlocked) await loadPlainBook(bookName);
    activateBook(bookName, btn);
    return;
  }

  unlockingBookName = bookName;
  openVaultUnlockModal(bookName);
}

/**
 * Make a book the active one: sync global state, build the collections
 * sidebar, and reset the right panel.
 */
function activateBook(bookName, btn) {
  booksList.querySelectorAll('.book-btn').forEach(function (b) { b.classList.remove('active'); });
  if (btn) btn.classList.add('active');

  activeBookName   = bookName;
  activeBookHandle = bookHandles[bookName].handle;
  var info         = bookHandles[bookName];

  collections      = info.collections;
  vaultKey         = info.key;
  isEncryptedVault = info.isEncrypted;

  collSectionName.textContent = bookName;

  var results = Object.keys(collections).sort().map(function (k) {
    return { name: k, entries: collections[k] };
  });
  buildSidebar(results);
  newCollBtn.classList.remove('hidden');

  activeFile = null;
  rightPanel.style.display = 'none';
  rightEmpty.style.display = '';
}

/* ── Locking ── */

/**
 * Wipe a book's key from memory and restore its locked appearance.
 * If the book was active, the right panel is cleared.
 */
function relockBook(bookName) {
  var info = bookHandles[bookName];
  if (!info || !info.isEncrypted) return;

  info.key = null;
  info.collections = {};
  info.isUnlocked  = false;

  var btn = booksList.querySelector('[data-book="' + bookName + '"]');
  if (btn) {
    if (!btn.querySelector('.book-lock')) {
      var lk = document.createElement('span');
      lk.className = 'book-lock';
      lk.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
      btn.appendChild(lk);
    }
    var rb = btn.querySelector('.book-relock-btn');
    if (rb) rb.remove();
  }

  var meta = document.getElementById('book-meta-' + bookName);
  if (meta) meta.textContent = 'Encrypted';

  if (activeBookName === bookName) {
    activeBookName   = null;
    activeBookHandle = null;
    collections      = {};
    vaultKey         = null;
    isEncryptedVault = false;
    activeFile       = null;
    collList.innerHTML = '';
    leftHint.style.display = '';
    rightPanel.style.display = 'none';
    rightEmpty.style.display = '';
    newCollBtn.classList.add('hidden');
    collSectionName.textContent = 'Select a book above';
    if (btn) btn.classList.remove('active');
  }

  showToast(bookName + ' locked');
}

/* ── Deletion ── */

/** Confirm and permanently delete a book and all its files. */
async function deleteBook(bookName) {
  var info      = bookHandles[bookName];
  var collCount = Object.keys((info && info.collections) || {}).length;
  var msg = 'Delete book "' + bookName + '"';
  if (info && info.isEncrypted && !info.isUnlocked) {
    msg += '?\n\nThis book is locked. All its data will be permanently deleted.';
  } else {
    msg += ' (' + collCount + ' collection' + (collCount !== 1 ? 's' : '') + ')?\n\nThis cannot be undone.';
  }
  var confirmed = await showConfirm('Delete Book', msg);
  if (!confirmed) return;

  try {
    if (isElectronPathMode) {
      window.vault.deleteDir(bookHandles[bookName].path);
    } else {
      await dirHandle.removeEntry(bookName, { recursive: true });
    }
    delete bookHandles[bookName];

    var btn = booksList.querySelector('[data-book="' + bookName + '"]');
    if (btn) btn.remove();

    var remaining = Object.keys(bookHandles).length;
    booksPanelCount.textContent = remaining + ' book' + (remaining !== 1 ? 's' : '');
    statusTxt.textContent = remaining + ' password book' + (remaining !== 1 ? 's' : '') + ' found';

    if (activeBookName === bookName) {
      activeBookName   = null;
      activeBookHandle = null;
      collections      = {};
      vaultKey         = null;
      isEncryptedVault = false;
      activeFile       = null;
      collList.innerHTML = '';
      leftHint.style.display = '';
      rightPanel.style.display = 'none';
      rightEmpty.style.display = '';
      newCollBtn.classList.add('hidden');
      collSectionName.textContent = 'Select a book above';
    }

    showToast('"' + bookName + '" deleted');
  } catch (err) {
    showToast('Error: ' + err.message);
  }
}

/* ── Renaming ── */

/**
 * Rename a book's folder on disk and update all references in bookHandles,
 * the books list, and the active-book state.
 */
async function doRenameBook(oldName, newName) {
  var info = bookHandles[oldName];

  if (isElectronPathMode) {
    var newPath = window.vault.joinPath(_electronVaultPath, newName);
    window.vault.rename(info.path, newPath);
    bookHandles[newName]      = info;
    bookHandles[newName].path = newPath;
    delete bookHandles[oldName];
  } else {
    var newDir = await dirHandle.getDirectoryHandle(newName, { create: true });
    for await (var entry of info.handle.values()) {
      if (entry.kind === 'file') {
        var file  = await entry.getFile();
        var buf   = await file.arrayBuffer();
        var newFh = await newDir.getFileHandle(entry.name, { create: true });
        var w     = await newFh.createWritable();
        await w.write(buf); await w.close();
      }
    }
    await dirHandle.removeEntry(oldName, { recursive: true });
    bookHandles[newName]        = info;
    bookHandles[newName].handle = newDir;
    delete bookHandles[oldName];
  }

  /* Update the book button */
  var btn = booksList.querySelector('[data-book="' + oldName + '"]');
  if (btn) {
    btn.dataset.book = newName;
    var nameEl = btn.querySelector('.book-name');
    if (nameEl) nameEl.textContent = newName;
    var metaEl = btn.querySelector('.book-meta');
    if (metaEl && metaEl.id) metaEl.id = 'book-meta-' + newName;

    /* Rewire all event listeners by cloning */
    var newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.addEventListener('click', (function (n, b) { return function () { selectBook(n, b); }; })(newName, newBtn));
    var eb = newBtn.querySelector('.edit-book-btn');
    var db = newBtn.querySelector('.delete-book-btn');
    var rb = newBtn.querySelector('.book-relock-btn');
    if (eb) { eb.replaceWith(eb.cloneNode(true)); newBtn.querySelector('.edit-book-btn').addEventListener('click', (function (n) { return function (e) { e.stopPropagation(); openEditBookModal(n); }; })(newName)); }
    if (db) { db.replaceWith(db.cloneNode(true)); newBtn.querySelector('.delete-book-btn').addEventListener('click', (function (n) { return function (e) { e.stopPropagation(); deleteBook(n); }; })(newName)); }
    if (rb) { rb.replaceWith(rb.cloneNode(true)); newBtn.querySelector('.book-relock-btn').addEventListener('click', (function (n) { return function (e) { e.stopPropagation(); relockBook(n); }; })(newName)); }
  }

  if (activeBookName === oldName) {
    activeBookName = newName;
    collSectionName.textContent = newName;
  }
  editingBookName = newName;
}

/* ── Encryption changes ── */

/** Change the password for an already-encrypted book. */
async function doChangeBookPassword(bookName, newPassword) {
  var info  = bookHandles[bookName];
  var bytes = await packEncrypted({ collections: info.collections }, newPassword);
  await namedBookWriteBin(bookName, 'vault.enc', bytes);
  info.key = await deriveKey(newPassword, bytes.slice(0, 16));
}

/** Convert a plain book to encrypted: pack all collections into vault.enc and delete .txt files. */
async function doEncryptBook(bookName, password) {
  var info = bookHandles[bookName];
  if (!info.isUnlocked) await loadPlainBook(bookName);

  var bytes = await packEncrypted({ collections: info.collections }, password);
  await namedBookWriteBin(bookName, 'vault.enc', bytes);

  /* Delete all .txt files */
  var toDelete = (await namedBookListFiles(bookName))
    .filter(function (e) { return e.isFile && e.name.toLowerCase().endsWith('.txt'); })
    .map(function (e) { return e.name; });
  for (var fname of toDelete) {
    await namedBookDeleteFile(bookName, fname);
  }

  info.key         = await deriveKey(password, bytes.slice(0, 16));
  info.isEncrypted = true;
  info.isUnlocked  = true;

  /* Update book button */
  var btn = booksList.querySelector('[data-book="' + bookName + '"]');
  if (btn) {
    var meta = btn.querySelector('.book-meta');
    var cnt  = Object.keys(info.collections).length;
    if (meta) meta.textContent = cnt + ' collection' + (cnt !== 1 ? 's' : '') + ' \xb7 encrypted';
    if (!btn.querySelector('.book-lock')) {
      var lk = document.createElement('span');
      lk.className = 'book-lock';
      lk.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
      btn.insertBefore(lk, btn.querySelector('.book-actions'));
    }
    injectRelockBtn(bookName);
  }

  if (activeBookName === bookName) {
    isEncryptedVault = true;
    vaultKey = info.key;
  }
  showToast('"' + bookName + '" encrypted');
}

/** Convert an encrypted book back to plain: write .txt files and delete vault.enc. */
async function doDecryptBook() {
  var info = bookHandles[editingBookName];

  for (var filename in info.collections) {
    await namedBookWriteFile(editingBookName, filename, buildFileText(info.collections[filename]));
  }
  await namedBookDeleteFile(editingBookName, 'vault.enc');

  info.isEncrypted = false;
  info.key         = null;

  var btn = booksList.querySelector('[data-book="' + editingBookName + '"]');
  if (btn) {
    var lk = btn.querySelector('.book-lock');
    if (lk) lk.remove();
    var rb = btn.querySelector('.book-relock-btn');
    if (rb) rb.remove();
    var meta = btn.querySelector('.book-meta');
    var cnt  = Object.keys(info.collections).length;
    if (meta) meta.textContent = cnt + ' collection' + (cnt !== 1 ? 's' : '') + ' \xb7 plain text';
  }

  if (activeBookName === editingBookName) {
    isEncryptedVault = false;
    vaultKey         = null;
  }

  showToast('"' + editingBookName + '" decrypted');
  editBookOverlay.classList.remove('open');
}

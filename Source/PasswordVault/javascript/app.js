/* ═══════════════════════════════
   APP  —  top-level event wiring
   Connects toolbar controls, search, eject, lock/unlock, and startup.
   All heavy logic lives in the src/ modules; this file only wires them up.

   Required load order (all via <script> tags before this file):
     src/core/state.js
     src/core/dom.js
     src/core/utils.js
     src/storage/db.js
     src/storage/crypto.js
     src/storage/vault-io.js
     src/vault/loader.js
     src/vault/books.js
     src/vault/collections.js
     src/ui/sidebar.js
     src/ui/panel.js
     src/confirm.js
     src/entries.js
     src/modals/unlock.js
     src/modals/collection.js
     src/modals/edit-entry.js
     src/modals/rename.js
     src/modals/book-create.js
     src/modals/edit-book.js
     app.js   ← this file
═══════════════════════════════ */

/* ── Open-folder split button ── */

openBtnArrow.addEventListener('click', function (e) {
  e.stopPropagation();
  var isOpen = openBtnMenu.classList.contains('open');
  if (isOpen) {
    closeOpenMenu();
  } else {
    openBtnMenu.classList.add('open');
    openBtnArrow.classList.add('open');
  }
});

document.addEventListener('click', function (e) {
  if (!document.getElementById('openBtnWrap').contains(e.target)) closeOpenMenu();
});

/* Mirror "Open Folder" menu item to the main button */
menuOpenFolder.addEventListener('click', function () {
  closeOpenMenu();
  openFolderBtn.click();
});

/* ── Set Default Location ── */
menuSetDefault.addEventListener('click', async function () {
  closeOpenMenu();
  if (window.vault && window.vault.openFolder) {
    var chosenPath = await window.vault.openFolder();
    if (!chosenPath) return;
    await window.electronAPI.setDefaultPath(chosenPath);
    var folderName = chosenPath.split(/[\/\\]/).filter(Boolean).pop() || chosenPath;
    saveDefaultName(folderName);
    updateDefaultUI(folderName);
    showToast('Default location set to "' + folderName + '"');
    return;
  }
  try {
    var startIn = await getLastDirHandle();
    var opts    = { mode: 'readwrite' };
    if (startIn) opts.startIn = startIn;
    var handle = await window.showDirectoryPicker(opts);
    window.focus();
    await saveDefaultDirHandle(handle);
    await saveLastDirHandle(handle);
    saveDefaultName(handle.name);
    updateDefaultUI(handle.name);
    showToast('Default location set to "' + handle.name + '"');
  } catch (e) { if (e.name !== 'AbortError') showToast('Error: ' + e.message); }
});

/* ── Load Default Folder ── */
menuLoadDefault.addEventListener('click', async function () {
  closeOpenMenu();
  if (window.electronAPI && window.electronAPI.getDefaultPath) {
    var storedPath = await window.electronAPI.getDefaultPath();
    if (!storedPath) { showToast('No default folder set'); return; }
    statusTxt.textContent = 'Loading default folder\u2026';
    await loadFromElectronPath(storedPath);
    return;
  }
  var handle = await getDefaultDirHandle();
  if (!handle) { showToast('No default folder set'); return; }
  try {
    var granted = await handle.requestPermission({ mode: 'readwrite' });
    if (granted !== 'granted') { showToast('Permission denied'); return; }
  } catch (err) { showToast('Permission error: ' + err.message); return; }
  await loadHandleNow(handle);
});

/* ── Clear Default ── */
menuClearDefault.addEventListener('click', async function () {
  closeOpenMenu();
  if (window.electronAPI && window.electronAPI.setDefaultPath) {
    await window.electronAPI.setDefaultPath(null);
  }
  await clearDefaultDirHandle();
  clearDefaultName();
  updateDefaultUI(null);
  showToast('Default location cleared');
});

/* ── Open Folder button ── */
openFolderBtn.addEventListener('click', async function () {
  if (window.vault && window.vault.openFolder) {
    var chosenPath = await window.vault.openFolder();
    if (!chosenPath) return;
    resetVaultState();
    await loadFromElectronPath(chosenPath);
    return;
  }
  if (!window.showDirectoryPicker) {
    alert('Your browser does not support the File System Access API.\nPlease use a modern Chromium-based browser (Chrome, Edge, Brave, Arc).');
    return;
  }
  try {
    var startIn = await getLastDirHandle();
    var opts    = { mode: 'readwrite' };
    if (startIn) opts.startIn = startIn;
    var handle = await window.showDirectoryPicker(opts);
    window.focus();
    saveLastDirHandle(handle);

    if (dirHandle) resetVaultState();

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
      isMultiBookMode = false;
      var hasVault = false;
      try { await handle.getFileHandle('vault.enc'); hasVault = true; } catch (_) {}
      dirHandle = handle;
      if (hasVault) {
        openVaultUnlockModal(null);
      } else {
        await loadPlainFolder();
      }
    }
  } catch (err) {
    if (err.name !== 'AbortError') statusTxt.textContent = 'Error: ' + err.message;
  }
});

/* ── Eject ── */
ejectBtn.addEventListener('click', resetVaultState);

/* ── Single-book Lock / Unlock Vault button ── */
lockVaultBtn.addEventListener('click', function () {
  if (!singleBookLocked) {
    vaultKey     = null;
    collections  = {};
    activeFile   = null;
    singleBookLocked = true;
    collList.innerHTML = '';
    leftHint.style.display  = '';
    rightPanel.style.display = 'none';
    rightEmpty.style.display = '';
    newCollBtn.classList.add('hidden');
    lockVaultBtnLabel.textContent = 'Unlock Vault';
    lockVaultBtn.title = 'Unlock this vault';
    bookNameEl.textContent = vaultName() + ' \uD83D\uDD12';
    statusTxt.textContent  = vaultName() + ' locked';
    showToast(vaultName() + ' locked');
  } else {
    openVaultUnlockModal(null);
  }
});

/* ── Search ── */
searchInput.addEventListener('input', function () {
  if (!activeFile) return;
  var q = searchInput.value.toLowerCase();
  var source;
  if (activeFile === '__all__') {
    source = [];
    Object.keys(collections).forEach(function (k) {
      collections[k].forEach(function (e) { source.push(e); });
    });
  } else {
    source = collections[activeFile];
  }
  var filtered = source.filter(function (e) {
    return e.name.toLowerCase().includes(q) ||
      e.attrs.some(function (a) {
        return a.key.toLowerCase().includes(q) || a.val.toLowerCase().includes(q);
      });
  });
  renderPasswords(filtered);
});

/* ── Resume banner ── */
document.getElementById('resumeBanner').addEventListener('click', async function (e) {
  if (e.target === document.getElementById('resumeBannerDismiss')) return;
  document.getElementById('resumeBanner').classList.remove('visible');

  if (window.electronAPI && window.electronAPI.createDefaultVault) {
    try {
      var vaultPath = await window.electronAPI.createDefaultVault();
      statusTxt.textContent = 'Loading default folder\u2026';
      await loadFromElectronPath(vaultPath);
      showToast('Default folder ready: ' + vaultPath.split(/[\/\\]/).pop());
    } catch (err) {
      showToast('Could not create folder: ' + err.message);
    }
    return;
  }

  /* Fallback for non-Electron */
  try {
    await window.electronAPI.createDefaultVault();
  } catch (err) {
    showToast('Could not create folder: ' + err.message);
    return;
  }
  try {
    var handle = await window.showDirectoryPicker({ startIn: 'documents', mode: 'readwrite' });
    window.focus();
    await saveDefaultDirHandle(handle);
    await saveLastDirHandle(handle);
    saveDefaultName(handle.name);
    updateDefaultUI(handle.name);
    showToast('Default folder set to "' + handle.name + '"');
    await loadHandleNow(handle);
  } catch (e) {
    if (e.name !== 'AbortError') showToast('Error: ' + e.message);
  }
});

document.getElementById('resumeBannerDismiss').addEventListener('click', function (e) {
  e.stopPropagation();
  _pendingDefaultHandle = null;
  document.getElementById('resumeBanner').classList.remove('visible');
});

/* ── Electron focus recovery ──
   After native OS dialogs the renderer loses keyboard focus.
   Re-acquire it on any mousedown inside a modal overlay. */
document.querySelectorAll('.modal-overlay').forEach(function (overlay) {
  overlay.addEventListener('mousedown', function () { window.focus(); });
});
document.addEventListener('mousedown', function () {
  if (document.querySelector('.modal-overlay.open')) window.focus();
}, true);

/* ── Startup auto-load ── */
document.addEventListener('DOMContentLoaded', tryAutoLoadDefault);
if (document.readyState !== 'loading') setTimeout(tryAutoLoadDefault, 0);
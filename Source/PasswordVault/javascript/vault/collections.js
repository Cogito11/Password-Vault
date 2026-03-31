/* ═══════════════════════════════
   VAULT / COLLECTIONS  —  open and delete password collections
═══════════════════════════════ */

/** Activate the synthetic "All Passwords" view across every collection. */
function openAllCollections(btn) {
  document.querySelectorAll('.coll-btn').forEach(function (b) { b.classList.remove('active'); });
  btn.classList.add('active');
  activeFile = '__all__';

  var allEntries = [];
  Object.keys(collections).forEach(function (k) {
    collections[k].forEach(function (e) { allEntries.push(e); });
  });

  panelTitle.textContent = 'All Passwords';
  panelCount.textContent = allEntries.length + ' entries';
  searchInput.value = '';
  newEntryBtn.classList.remove('visible');

  rightEmpty.style.display = 'none';
  rightPanel.style.display = 'flex';

  renderPasswords(allEntries);
}

/** Activate a single named collection and render its entries. */
function openCollection(filename, btn) {
  document.querySelectorAll('.coll-btn').forEach(function (b) { b.classList.remove('active'); });
  btn.classList.add('active');
  activeFile = filename;

  var entries = collections[filename];
  if (!entries) { showToast('Collection not found'); return; }

  panelTitle.textContent = filename.replace(/\.txt$/i, '');
  panelCount.textContent = entries.length + ' entries';
  searchInput.value = '';
  newEntryBtn.classList.add('visible');

  rightEmpty.style.display = 'none';
  rightPanel.style.display = 'flex';

  renderPasswords(entries);
}

/** Confirm and permanently delete a collection. */
async function deleteCollection(filename) {
  var displayName = filename.replace(/\.txt$/i, '');
  var count       = (collections[filename] || []).length;
  var confirmed   = await showConfirm(
    'Delete Collection',
    'Delete "' + displayName + '" (' + count + ' entr' + (count === 1 ? 'y' : 'ies') + ')?\n\nThis cannot be undone.'
  );
  if (!confirmed) return;

  try {
    if (bookIsEncrypted()) {
      var deleted = collections[filename];
      delete collections[filename];
      if (isMultiBookMode && activeBookName) bookHandles[activeBookName].collections = collections;
      try {
        await reEncryptVault();
      } catch (e) {
        collections[filename] = deleted;
        if (isMultiBookMode && activeBookName) bookHandles[activeBookName].collections = collections;
        throw e;
      }
    } else {
      await bookDeleteFile(filename);
      delete collections[filename];
    }

    /* Remove sidebar button */
    var sideBtn = collList.querySelector('[data-file="' + filename + '"]');
    if (sideBtn) sideBtn.remove();

    /* Update "All" count */
    var allBtnEl = collList.querySelector('.all-btn');
    if (allBtnEl) {
      var total = Object.keys(collections).reduce(function (s, k) { return s + collections[k].length; }, 0);
      allBtnEl.querySelector('.coll-n').textContent = total + ' passwords total';
    }

    /* Update book meta count */
    if (isMultiBookMode && activeBookName) {
      var bookMeta = document.getElementById('book-meta-' + activeBookName);
      if (bookMeta) {
        var cnt = Object.keys(collections).length;
        bookMeta.textContent = cnt + ' collection' + (cnt !== 1 ? 's' : '') + (bookIsEncrypted() ? ' \xb7 encrypted' : ' \xb7 plain text');
      }
    }

    /* Clear right panel if this was active */
    if (activeFile === filename) {
      activeFile = null;
      rightPanel.style.display = 'none';
      rightEmpty.style.display = '';
      newEntryBtn.classList.remove('visible');
    }

    showToast('"' + displayName + '" deleted');
  } catch (err) {
    showToast('Error: ' + err.message);
  }
}

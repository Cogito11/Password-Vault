/* ═══════════════════════════════
   VAULT / ENTRIES  —  append staged entries to an existing collection
═══════════════════════════════ */

/** Persist all entries staged in modalEntryList into the currently open collection. */
async function saveNewEntries() {
  if (!modalEntryList.length || !activeFile || activeFile === '__all__') return;

  try {
    var existing = collections[activeFile] || [];
    var combined = existing.concat(modalEntryList);
    collections[activeFile] = combined;

    if (isMultiBookMode && activeBookName) bookHandles[activeBookName].collections = collections;

    if (bookIsEncrypted()) {
      await reEncryptVault();
    } else {
      await bookWriteFile(activeFile, buildFileText(combined));
    }

    /* Update sidebar count */
    var sideBtn = collList.querySelector('[data-file="' + activeFile + '"]');
    if (sideBtn) sideBtn.querySelector('.coll-n').textContent = combined.length + ' password' + (combined.length !== 1 ? 's' : '');

    /* Update "All" count */
    var allBtnEl = collList.querySelector('.all-btn');
    if (allBtnEl) {
      var total = Object.keys(collections).reduce(function (s, k) { return s + collections[k].length; }, 0);
      allBtnEl.querySelector('.coll-n').textContent = total + ' passwords total';
    }

    closeModal();
    showToast(modalEntryList.length + ' entr' + (modalEntryList.length === 1 ? 'y' : 'ies') + ' added');
    panelCount.textContent = combined.length + ' entries';
    renderPasswords(combined);
  } catch (err) {
    modalInfo.textContent = 'Error: ' + err.message;
    modalInfo.style.color = '#e05555';
    setTimeout(function () { modalInfo.style.color = ''; }, 3000);
  }
}

/* ═══════════════════════════════
   MODALS / EDIT-ENTRY  —  edit and delete individual password entries
═══════════════════════════════ */

/* ── Close handlers ── */

editModalClose.addEventListener('click', function () { editModalOverlay.classList.remove('open'); });
editModalOverlay.addEventListener('click', function (e) {
  if (e.target === editModalOverlay) editModalOverlay.classList.remove('open');
});
editAddAttrBtn.addEventListener('click', function () { addEditAttrRow('', ''); });

/* ── Keyboard shortcuts ── */

editEntryName.addEventListener('keydown', function (e) {
  if (e.key === 'Enter') { e.preventDefault(); saveEditBtn.click(); }
});

editModalOverlay.addEventListener('keydown', function (e) {
  if (e.key !== 'Enter') return;
  var t = e.target;
  if (t.classList.contains('attr-key') || t.classList.contains('attr-val')) {
    e.preventDefault();
    saveEditBtn.click();
  }
});

/* ── Open ── */

var editingCollName;
/** Open the edit modal pre-filled with an existing entry's data. */
function openEditModal(idx, collName) {
  collName = collName || activeFile;
  var entry = collections[collName][idx];
  if (!entry) return;
  editingIdx = idx;
  editingCollName = collName;
  editEntryName.value = entry.name;
  editAttrRows.innerHTML = '';
  entry.attrs.forEach(function (a) { addEditAttrRow(a.key, a.val); });
  editModalInfo.textContent = '';
  editModalOverlay.classList.add('open');
  setTimeout(function () { window.focus(); editEntryName.focus(); }, 100);
}

function addEditAttrRow(key, val) {
  var row = document.createElement('div');
  row.className = 'attr-row';
  row.innerHTML =
    '<input class="modal-input attr-key" type="text" placeholder="Key (e.g. Email)" value="' + esc(key) + '">' +
    '<input class="modal-input attr-val" type="text" placeholder="Value" value="' + esc(val) + '">' +
    '<button class="attr-row-del" title="Remove">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>' +
    '</button>';
  row.querySelector('.attr-row-del').addEventListener('click', function () { editAttrRows.removeChild(row); });
  editAttrRows.appendChild(row);
}

/* ── Save edits ── */

saveEditBtn.addEventListener('click', async function () {
  var name = editEntryName.value.trim();
  if (!name) {
    editEntryName.style.borderColor = '#e05555';
    setTimeout(function () { window.focus(); editEntryName.style.borderColor = ''; }, 1200);
    return;
  }

  var attrs = [];
  editAttrRows.querySelectorAll('.attr-row').forEach(function (row) {
    var k = row.querySelector('.attr-key').value.trim();
    var v = row.querySelector('.attr-val').value.trim();
    if (k) attrs.push({ key: k, val: v });
  });

  collections[editingCollName][editingIdx] = { name: name, attrs: attrs };  // ← editingCollName
  if (isMultiBookMode && activeBookName) bookHandles[activeBookName].collections = collections;

  saveEditBtn.disabled    = true;
  saveEditBtn.textContent = 'Saving\u2026';

  try {
    if (bookIsEncrypted()) {
      await reEncryptVault();
    } else {
      await bookWriteFile(editingCollName, buildFileText(collections[editingCollName]));  // ← editingCollName
    }
    var sideBtn = collList.querySelector('[data-file="' + editingCollName + '"]');  // ← editingCollName
    if (sideBtn) sideBtn.querySelector('.coll-n').textContent = collections[editingCollName].length + ' password' + (collections[editingCollName].length !== 1 ? 's' : '');
    editModalOverlay.classList.remove('open');
    showToast('Entry updated');

    // Re-render passwords
    renderPasswords();
  } catch (err) {
    editModalInfo.textContent = 'Error: ' + err.message;
    editModalInfo.style.color = '#e05555';
    setTimeout(function () { window.focus(); editModalInfo.style.color = ''; }, 3000);
  }

  saveEditBtn.disabled    = false;
  saveEditBtn.textContent = 'Save Changes';
});

/* ── Delete entry ── */

/** Confirm and permanently delete a single entry from the active collection. */
async function deleteEntry(idx, collName) {
  collName = collName || activeFile;
  var entry = collections[collName][idx];
  if (!entry) return;

  var confirmed = await showConfirm(
    'Delete Entry',
    'Delete "' + entry.name + '"?\n\nThis cannot be undone.'
  );
  if (!confirmed) return;

  collections[collName].splice(idx, 1); 
  if (isMultiBookMode && activeBookName) bookHandles[activeBookName].collections = collections;

  try {
    if (bookIsEncrypted()) {
      await reEncryptVault();
    } else {
      await bookWriteFile(collName, buildFileText(collections[collName]));
    }

    var remaining = collections[collName].length;
    var sideBtn   = collList.querySelector('[data-file="' + collName + '"]');
    if (sideBtn) sideBtn.querySelector('.coll-n').textContent = remaining + ' password' + (remaining !== 1 ? 's' : '');

    var allBtnEl = collList.querySelector('.all-btn');
    if (allBtnEl) {
      var total = Object.keys(collections).reduce(function (s, k) { return s + collections[k].length; }, 0);
      allBtnEl.querySelector('.coll-n').textContent = total + ' passwords total';
    }

    panelCount.textContent = remaining + ' entries';
    showToast('"' + entry.name + '" deleted');
    renderPasswords();
  } catch (err) {
    collections[collName].splice(idx, 0, entry);
    if (isMultiBookMode && activeBookName) bookHandles[activeBookName].collections = collections;
    showToast('Error: ' + err.message);
  }
}

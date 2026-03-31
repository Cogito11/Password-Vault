/* ═══════════════════════════════
   MODALS / COLLECTION  —  new collection modal and add-entry modal
   Both share the same overlay; entryModalMode switches between them.
═══════════════════════════════ */

/* ── Open / close ── */

newCollBtn.addEventListener('click', openModal);
newEntryBtn.addEventListener('click', openEntryModal);
modalClose.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', function (e) { if (e.target === modalOverlay) closeModal(); });

/** Open the modal in "new collection" mode. */
function openModal() {
  entryModalMode = 'collection';
  modalEntryList = [];
  collNameInput.value  = '';
  entryNameInput.value = '';
  attrRows.innerHTML   = '';
  modalEntries.innerHTML = '';
  entryCountLbl.textContent  = '0 added';
  saveCollBtn.disabled       = false;
  saveCollBtn.textContent    = 'Save File';
  modalInfo.textContent      = 'Name the collection and optionally add entries.';
  document.getElementById('collModalTitle').textContent = 'New Collection';
  document.querySelector('#modalOverlay .modal-field').style.display = '';
  addDefaultAttrRows();
  modalOverlay.classList.add('open');
  setTimeout(function () { window.focus(); collNameInput.focus(); }, 100);
}

/** Open the modal in "add entry" mode (target is the currently open collection). */
function openEntryModal() {
  entryModalMode = 'entry';
  modalEntryList = [];
  entryNameInput.value   = '';
  attrRows.innerHTML     = '';
  modalEntries.innerHTML = '';
  entryCountLbl.textContent = '0 added';
  saveCollBtn.disabled      = true;
  saveCollBtn.textContent   = 'Add to Collection';
  modalInfo.textContent     = 'Add entries then save to the collection file.';
  document.getElementById('collModalTitle').textContent = 'New Entry \u2014 ' + activeFile.replace(/\.txt$/i, '');
  document.querySelector('#modalOverlay .modal-field').style.display = 'none';
  addDefaultAttrRows();
  modalOverlay.classList.add('open');
  setTimeout(function () { window.focus(); entryNameInput.focus(); }, 100);
}

function closeModal() {
  modalOverlay.classList.remove('open');
  document.querySelector('#modalOverlay .modal-field').style.display = '';
}

/* ── Attribute row builders ── */

function addDefaultAttrRows() {
  addAttrRow('Email', '', false);
  addAttrRow('Password', '', false);
}

addAttrBtn.addEventListener('click', function () { addAttrRow('', '', true); });

function addAttrRow(key, val, shouldFocus) {
  var row = document.createElement('div');
  row.className = 'attr-row';
  row.innerHTML =
    '<input class="modal-input attr-key" type="text" placeholder="Key (e.g. Email)" value="' + esc(key) + '">' +
    '<input class="modal-input attr-val" type="text" placeholder="Value" value="' + esc(val) + '">' +
    '<button class="attr-row-del" title="Remove">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>' +
    '</button>';
  row.querySelector('.attr-row-del').addEventListener('click', function () { attrRows.removeChild(row); });
  attrRows.appendChild(row);
  if (shouldFocus) row.querySelector('.attr-key').focus();
}

/* ── Keyboard shortcuts (Enter stages an entry) ── */

entryNameInput.addEventListener('keydown', function (e) {
  if (e.key === 'Enter') { e.preventDefault(); addEntryBtn.click(); }
});

modalOverlay.addEventListener('keydown', function (e) {
  if (e.key !== 'Enter') return;
  var t = e.target;
  if (t.classList.contains('attr-key') || t.classList.contains('attr-val')) {
    e.preventDefault();
    addEntryBtn.click();
  }
});

collNameInput.addEventListener('keydown', function (e) {
  if (e.key === 'Enter') { e.preventDefault(); saveCollBtn.click(); }
});

/* ── Stage entry into the pending list ── */

addEntryBtn.addEventListener('click', function () {
  var name = entryNameInput.value.trim();
  if (!name) {
    entryNameInput.focus();
    entryNameInput.style.borderColor = '#e05555';
    setTimeout(function () { entryNameInput.style.borderColor = ''; }, 1200);
    return;
  }

  var attrs = [];
  attrRows.querySelectorAll('.attr-row').forEach(function (row) {
    var k = row.querySelector('.attr-key').value.trim();
    var v = row.querySelector('.attr-val').value.trim();
    if (k) attrs.push({ key: k, val: v });
  });

  modalEntryList.push({ name: name, attrs: attrs });
  renderModalEntries();

  entryNameInput.value = '';
  attrRows.innerHTML   = '';
  addDefaultAttrRows();
  entryNameInput.focus();
  updateSaveBtn();
});

/* ── Pending-entry list ── */

function renderModalEntries() {
  modalEntries.innerHTML = '';
  entryCountLbl.textContent = modalEntryList.length + ' added';

  modalEntryList.forEach(function (entry, idx) {
    var card = document.createElement('div');
    card.className = 'modal-entry-card';

    var attrsHtml = entry.attrs.map(function (a) {
      return '<div class="modal-entry-attr">' +
        '<span class="modal-entry-attr-key">' + esc(a.key) + '</span>' +
        '<span class="modal-entry-attr-val">' + esc(a.val || '\u2014') + '</span>' +
      '</div>';
    }).join('');

    card.innerHTML =
      '<div class="modal-entry-head">' +
        '<span class="modal-entry-name">' + esc(entry.name) + '</span>' +
        '<span style="font-family:var(--mono);font-size:9px;color:var(--text-dim);margin-right:6px;">' + entry.attrs.length + ' attr</span>' +
        '<button class="modal-entry-del" data-idx="' + idx + '" title="Remove">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>' +
        '</button>' +
      '</div>' +
      (attrsHtml ? '<div class="modal-entry-attrs">' + attrsHtml + '</div>' : '');

    card.querySelector('.modal-entry-del').addEventListener('click', function (e) {
      modalEntryList.splice(parseInt(e.currentTarget.dataset.idx), 1);
      renderModalEntries();
      updateSaveBtn();
    });

    modalEntries.appendChild(card);
  });
}

function updateSaveBtn() {
  var ready = entryModalMode === 'entry'
    ? modalEntryList.length > 0
    : !!collNameInput.value.trim();
  saveCollBtn.disabled  = !ready;
  modalInfo.textContent = modalEntryList.length + ' entr' + (modalEntryList.length === 1 ? 'y' : 'ies') + ' ready.';
}

collNameInput.addEventListener('input', updateSaveBtn);

/* ── Save ── */

saveCollBtn.addEventListener('click', async function () {
  if (entryModalMode === 'entry') {
    await saveNewEntries();
  } else {
    await saveNewCollection();
  }
});

/** Save a brand-new collection file with all staged entries. */
async function saveNewCollection() {
  var collName = collNameInput.value.trim();
  if (!collName) return;

  var filename = collName.replace(/[^a-zA-Z0-9 _\-]/g, '').trim().replace(/\s+/g, '_') + '.txt';
  if (collections[filename]) {
    modalInfo.textContent = 'A collection with that name already exists.';
    modalInfo.style.color = '#e05555';
    setTimeout(function () { window.focus(); modalInfo.style.color = ''; }, 3000);
    return;
  }

  var newEntries = modalEntryList.slice();

  try {
    collections[filename] = newEntries;
    if (isMultiBookMode && activeBookName) bookHandles[activeBookName].collections = collections;

    if (bookIsEncrypted()) {
      await reEncryptVault();
    } else {
      await bookWriteFile(filename, buildFileText(newEntries));
    }

    var allBtnEl = collList.querySelector('.all-btn');
    if (allBtnEl) {
      var total = Object.keys(collections).reduce(function (s, k) { return s + collections[k].length; }, 0);
      allBtnEl.querySelector('.coll-n').textContent = total + ' passwords total';
    }

    if (isMultiBookMode && activeBookName) {
      var meta = document.getElementById('book-meta-' + activeBookName);
      if (meta) {
        var cnt = Object.keys(collections).length;
        meta.textContent = cnt + ' collection' + (cnt !== 1 ? 's' : '') + (bookIsEncrypted() ? ' \xb7 encrypted' : ' \xb7 plain text');
      }
    }

    addCollBtn(filename, newEntries.length);
    closeModal();
    showToast(filename + (bookIsEncrypted() ? ' saved (encrypted)' : ' saved'));

    var newBtn = collList.querySelector('[data-file="' + filename + '"]');
    if (newBtn) openCollection(filename, newBtn);
  } catch (err) {
    delete collections[filename];
    if (isMultiBookMode && activeBookName) bookHandles[activeBookName].collections = collections;
    modalInfo.textContent = 'Error: ' + err.message;
    modalInfo.style.color = '#e05555';
    setTimeout(function () { modalInfo.style.color = ''; }, 3000);
  }
}

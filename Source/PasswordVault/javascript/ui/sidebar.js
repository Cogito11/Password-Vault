/* ═══════════════════════════════
   UI / SIDEBAR  —  left-panel rendering
   Covers: multi-book panel, collections list, and the open-folder menu.
═══════════════════════════════ */

/** Close the open-folder split-button dropdown. */
function closeOpenMenu() {
  openBtnMenu.classList.remove('open');
  openBtnArrow.classList.remove('open');
}

/* ── Multi-book panel ── */

/** Switch the app into multi-book mode and populate the books panel. */
function enterMultiBookMode(subBooks) {
  colHeadLabel.textContent = 'Vault Folder';
  bookNameEl.textContent   = vaultName();
  booksPanel.classList.add('visible');
  collSectionHead.classList.add('visible');
  booksPanelCount.textContent = subBooks.length + ' book' + (subBooks.length !== 1 ? 's' : '');
  collSectionName.textContent = 'Select a book above';
  leftHint.style.display = '';
  collList.innerHTML  = '';
  booksList.innerHTML = '';
  newCollBtn.classList.add('hidden');
  ejectBtn.classList.add('visible');
  dot.classList.add('on');
  statusTxt.textContent = subBooks.length + ' password book' + (subBooks.length !== 1 ? 's' : '') + ' found';

  subBooks.sort(function (a, b) { return a.name.localeCompare(b.name); });
  subBooks.forEach(function (b) { addBookBtn(b.name, b.isEncrypted); });
}

/** Append a book row to the books panel. */
function addBookBtn(bookName, isEncrypted) {
  var btn = document.createElement('button');
  btn.className   = 'book-btn';
  btn.dataset.book = bookName;
  btn.innerHTML =
    '<div class="book-icon">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>' +
      '</svg>' +
    '</div>' +
    '<span class="book-text">' +
      '<span class="book-name">' + esc(bookName) + '</span>' +
      '<span class="book-meta" id="book-meta-' + esc(bookName) + '">' + (isEncrypted ? 'Encrypted' : 'Plain Text') + '</span>' +
    '</span>' +
    '<span class="book-actions">' +
      '<span role="button" tabindex="0" class="book-action-btn edit-book-btn" title="Edit book">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>' +
      '</span>' +
      '<span role="button" tabindex="0" class="book-action-btn del delete-book-btn" title="Delete book">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>' +
      '</span>' +
    '</span>' +
    (isEncrypted
      ? '<span class="book-lock"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span>'
      : '');

  btn.addEventListener('click', function () { selectBook(bookName, btn); });
  btn.querySelector('.edit-book-btn').addEventListener('click', function (e) { e.stopPropagation(); openEditBookModal(bookName); });
  btn.querySelector('.delete-book-btn').addEventListener('click', function (e) { e.stopPropagation(); deleteBook(bookName); });
  booksList.appendChild(btn);
}

/** Inject a relock button into a book row (called after successful unlock). */
function injectRelockBtn(bookName) {
  var btn = booksList.querySelector('[data-book="' + bookName + '"]');
  if (!btn || btn.querySelector('.book-relock-btn')) return;
  var rb = document.createElement('button');
  rb.className = 'book-relock-btn';
  rb.title     = 'Lock this book \u2014 wipes the key from memory';
  rb.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
  rb.addEventListener('click', function (e) { e.stopPropagation(); relockBook(bookName); });
  btn.appendChild(rb);
}

/* ── Collections list ── */

/** Build the full collections sidebar from a results array. */
function buildSidebar(results) {
  collList.innerHTML = '';
  leftHint.style.display = 'none';

  var totalCount = results.reduce(function (s, r) { return s + r.entries.length; }, 0);
  var allBtn     = document.createElement('button');
  allBtn.className   = 'coll-btn all-btn';
  allBtn.dataset.file = '__all__';
  allBtn.innerHTML =
    '<div class="coll-icon">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect x="2" y="3" width="6" height="6" rx="1"/><rect x="9" y="3" width="6" height="6" rx="1"/><rect x="16" y="3" width="6" height="6" rx="1"/>' +
        '<rect x="2" y="12" width="6" height="6" rx="1"/><rect x="9" y="12" width="6" height="6" rx="1"/><rect x="16" y="12" width="6" height="6" rx="1"/>' +
      '</svg>' +
    '</div>' +
    '<span class="coll-text">' +
      '<span class="coll-name">All Passwords</span>' +
      '<span class="coll-n">' + totalCount + ' passwords total</span>' +
    '</span>';
  allBtn.addEventListener('click', function () { openAllCollections(allBtn); });
  collList.appendChild(allBtn);

  var divEl = document.createElement('div');
  divEl.className = 'coll-divider';
  collList.appendChild(divEl);

  results.forEach(function (r) { addCollBtn(r.name, r.entries.length); });

  if (!isMultiBookMode) {
    dot.classList.add('on');
    statusTxt.textContent = results.length + ' password collection' + (results.length !== 1 ? 's' : '') + ' loaded' + (isEncryptedVault ? ' \xb7 encrypted' : '');
    ejectBtn.classList.add('visible');
    newCollBtn.classList.remove('hidden');
    bookNameEl.textContent = vaultName() + (isEncryptedVault ? ' \uD83D\uDD12' : '');
  }
}

/** Append a single collection row to the sidebar. */
function addCollBtn(filename, count) {
  var name = filename.replace(/\.txt$/i, '');
  var btn  = document.createElement('button');
  btn.className    = 'coll-btn';
  btn.dataset.file = filename;
  btn.innerHTML =
    '<div class="coll-icon">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>' +
      '</svg>' +
    '</div>' +
    '<span class="coll-text">' +
      '<span class="coll-name">' + esc(name) + '</span>' +
      '<span class="coll-n">' + count + ' password' + (count !== 1 ? 's' : '') + '</span>' +
    '</span>' +
    '<span class="coll-actions">' +
      '<span role="button" tabindex="0" class="coll-action-btn rename-coll-btn" title="Rename collection">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>' +
      '</span>' +
      '<span role="button" tabindex="0" class="coll-action-btn del delete-coll-btn" title="Delete collection">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>' +
      '</span>' +
    '</span>';

  btn.addEventListener('click', function () { openCollection(filename, btn); });
  btn.querySelector('.rename-coll-btn').addEventListener('click', function (e) { e.stopPropagation(); openRenameCollModal(filename); });
  btn.querySelector('.delete-coll-btn').addEventListener('click', function (e) { e.stopPropagation(); deleteCollection(filename); });
  collList.appendChild(btn);
}

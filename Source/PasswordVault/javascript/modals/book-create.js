/* ═══════════════════════════════
   MODALS / BOOK-CREATE  —  new password book modal
   Handles name entry, location picking, optional encryption, and creation.
═══════════════════════════════ */

/* ── Open ── */

newBookBtn.addEventListener('click', async function () {
  bookNameInput.value = '';
  bookLocationDisp.value = '';
  bookLocationDisp.classList.remove('chosen');
  encryptToggle.checked = false;
  encryptFields.classList.remove('show');
  bookPw.value = '';
  bookPwConfirm.value = '';
  pwStrBar.style.width   = '0';
  pwStrLabel.textContent = '';
  saveBookBtn.disabled   = true;
  chosenParentHandle     = null;
  chosenParentPath       = null;

  /* Pre-fill location from default if one is set */
  if (window.electronAPI && window.electronAPI.getDefaultPath) {
    var defPath = await window.electronAPI.getDefaultPath();
    if (defPath) {
      chosenParentPath = defPath;
      chosenParentHandle = null;
      bookLocationDisp.value = defPath.split(/[\/\\]/).filter(Boolean).pop() || defPath;
      bookLocationDisp.classList.add('chosen');
      bookModalInfo.textContent = 'Default location pre-selected \u2014 change it or enter a name.';
      saveBookBtn.disabled = false;
    } else {
      bookModalInfo.textContent = 'Choose a name and location.';
    }
  } else {
    var defaultHandle = await getDefaultDirHandle();
    if (defaultHandle) {
      chosenParentHandle = defaultHandle;
      chosenParentPath   = null;
      bookLocationDisp.value = defaultHandle.name;
      bookLocationDisp.classList.add('chosen');
      bookModalInfo.textContent = 'Default location pre-selected \u2014 change it or enter a name.';
      saveBookBtn.disabled = false;
    } else {
      bookModalInfo.textContent = 'Choose a name and location.';
    }
  }

  bookModalOverlay.classList.add('open');
  setTimeout(function () { window.focus(); bookNameInput.focus(); }, 100);
});

/* ── Close handlers ── */

bookModalClose.addEventListener('click', function () { bookModalOverlay.classList.remove('open'); });
bookModalOverlay.addEventListener('click', function (e) {
  if (e.target === bookModalOverlay) bookModalOverlay.classList.remove('open');
});

/* ── Keyboard shortcuts ── */

bookNameInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); saveBookBtn.click(); } });
bookPw.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); saveBookBtn.click(); } });
bookPwConfirm.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); saveBookBtn.click(); } });

/* ── Location picker ── */

pickLocationBtn.addEventListener('click', async function () {
  if (window.vault && window.vault.openFolder) {
    var p = await window.vault.openFolder();
    if (!p) return;
    chosenParentPath   = p;
    chosenParentHandle = null;
    bookLocationDisp.value = p.split(/[\/\\]/).filter(Boolean).pop() || p;
    bookLocationDisp.classList.add('chosen');
    validateBookForm();
    return;
  }
  try {
    var startIn = await getLastDirHandle();
    var opts    = { mode: 'readwrite' };
    if (startIn) opts.startIn = startIn;
    chosenParentHandle = await window.showDirectoryPicker(opts);
    chosenParentPath   = null;
    window.focus();
    saveLastDirHandle(chosenParentHandle);
    bookLocationDisp.value = chosenParentHandle.name;
    bookLocationDisp.classList.add('chosen');
    validateBookForm();
  } catch (_) { /* cancelled */ }
});

/* ── Encrypt toggle and strength meter ── */

encryptToggle.addEventListener('change', function () {
  encryptFields.classList.toggle('show', this.checked);
  validateBookForm();
});

bookNameInput.addEventListener('input', validateBookForm);
bookPwConfirm.addEventListener('input', validateBookForm);

bookPw.addEventListener('input', function () {
  var pw = this.value, s = 0;
  if (pw.length >= 8)           s++;
  if (pw.length >= 14)          s++;
  if (/[A-Z]/.test(pw))         s++;
  if (/[0-9]/.test(pw))         s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  var pcts   = [0, 18, 36, 58, 80, 100];
  var colors = ['var(--text-dim)', '#e05555', '#e8a230', '#a8c84a', '#52c07a', '#52c07a'];
  var labels = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Very strong'];
  pwStrBar.style.width      = pcts[s] + '%';
  pwStrBar.style.background = colors[s];
  pwStrLabel.textContent    = labels[s];
  validateBookForm();
});

function validateBookForm() {
  var name = bookNameInput.value.trim();
  if (!name) { saveBookBtn.disabled = true; bookModalInfo.textContent = 'Enter a name for the book.'; return; }
  if (!chosenParentHandle && !chosenParentPath) { saveBookBtn.disabled = true; bookModalInfo.textContent = 'Choose where to create the book.'; return; }
  if (encryptToggle.checked) {
    var pw = bookPw.value, pc = bookPwConfirm.value;
    if (!pw)            { saveBookBtn.disabled = true; bookModalInfo.textContent = 'Enter an encryption password.'; return; }
    if (pw.length < 6)  { saveBookBtn.disabled = true; bookModalInfo.textContent = 'Password too short (min 6 chars).'; return; }
    if (pw !== pc)      { saveBookBtn.disabled = true; bookModalInfo.textContent = pc ? 'Passwords do not match.' : 'Confirm your password.'; return; }
    bookModalInfo.textContent = 'AES-256-GCM encrypted \u2014 one binary file, no readable text on disk.';
  } else {
    bookModalInfo.textContent = 'Plain book \u2014 collections stored as .txt files inside the folder.';
  }
  saveBookBtn.disabled = false;
}

/* ── Create ── */

saveBookBtn.addEventListener('click', async function () {
  var name = bookNameInput.value.trim().replace(/[^a-zA-Z0-9 _\-]/g, '').trim();
  if (!name || (!chosenParentHandle && !chosenParentPath)) return;

  saveBookBtn.disabled    = true;
  saveBookBtn.textContent = 'Creating\u2026';

  try {
    var bookDirPath = null;
    var bookDir     = null;

    if (chosenParentPath) {
      bookDirPath = window.vault.joinPath(chosenParentPath, name);
      window.vault.mkdir(bookDirPath);
    } else {
      bookDir = await chosenParentHandle.getDirectoryHandle(name, { create: true });
    }

    var defaultCollFilename = 'Password_Collection.txt';
    var defaultCollEntries  = [];

    if (encryptToggle.checked) {
      var initCollections = {};
      initCollections[defaultCollFilename] = defaultCollEntries;
      var bytes = await packEncrypted({ collections: initCollections }, bookPw.value);
      if (bookDirPath) {
        window.vault.writeFileBin(window.vault.joinPath(bookDirPath, 'vault.enc'), bytes);
      } else {
        var fh = await bookDir.getFileHandle('vault.enc', { create: true });
        var w  = await fh.createWritable(); await w.write(bytes); await w.close();
      }
      showToast('"' + name + '" created \u2014 encrypted');
    } else {
      if (bookDirPath) {
        window.vault.writeFile(window.vault.joinPath(bookDirPath, defaultCollFilename), buildFileText(defaultCollEntries));
      } else {
        var fh2 = await bookDir.getFileHandle(defaultCollFilename, { create: true });
        var w2  = await fh2.createWritable();
        await w2.write(buildFileText(defaultCollEntries));
        await w2.close();
      }
      showToast('"' + name + '" created');
    }

    if (isMultiBookMode) await rescanVaultFolder();

    bookModalOverlay.classList.remove('open');
    saveBookBtn.textContent = 'Create Book';
  } catch (e) {
    bookModalInfo.textContent = 'Error: ' + e.message;
    bookModalInfo.style.color = '#e05555';
    setTimeout(function () { window.focus(); bookModalInfo.style.color = ''; }, 3000);
    saveBookBtn.disabled    = false;
    saveBookBtn.textContent = 'Create Book';
  }
});

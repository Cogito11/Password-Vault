/* ═══════════════════════════════
   MODALS / EDIT-BOOK  —  edit password book modal
   Handles renaming, password changes, adding encryption, and removing it.
═══════════════════════════════ */

/* ── Close handlers ── */

editBookClose.addEventListener('click', function () { editBookOverlay.classList.remove('open'); });
editBookOverlay.addEventListener('click', function (e) {
  if (e.target === editBookOverlay) editBookOverlay.classList.remove('open');
});
editBookOverlay.addEventListener('keydown', function (e) {
  if (e.key !== 'Enter') return;
  if (e.target.tagName === 'INPUT') { e.preventDefault(); saveEditBookBtn.click(); }
});

/* ── Open ── */

/** Open the edit-book modal for the given book. */
function openEditBookModal(bookName) {
  var info = bookHandles[bookName];
  if (!info) return;
  editingBookName = bookName;
  editBookInfo.textContent    = '';
  saveEditBookBtn.disabled    = false;
  saveEditBookBtn.textContent = 'Save Changes';

  buildEditBookBody(info.isEncrypted, info.isUnlocked, bookName);
  editBookOverlay.classList.add('open');
  setTimeout(function () { var ni = document.getElementById('ebNameInput'); if (ni) { ni.focus(); ni.select(); } }, 100);
}

/** Render the modal body HTML for the current book state. */
function buildEditBookBody(isEnc, isUnlocked, bookName) {
  var html = '<div class="modal-field">';
  html += '<div class="modal-label">Book Name</div>';
  html += '<input class="modal-input" id="ebNameInput" type="text" value="' + esc(bookName) + '">';
  html += '</div>';

  if (isEnc && !isUnlocked) {
    /* Locked encrypted book — cannot change settings */
    html += '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:12px 14px;display:flex;gap:10px;align-items:flex-start;">';
    html += '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;stroke:var(--amber);flex-shrink:0;margin-top:1px;"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
    html += '<div style="font-family:var(--mono);font-size:11px;color:var(--text-muted);line-height:1.6;">Unlock this book first to change encryption settings or password.</div>';
    html += '</div>';
  } else if (isEnc && isUnlocked) {
    /* Unlocked encrypted book — can change password or remove encryption */
    html += '<div class="modal-field">';
    html += '<div class="modal-label">New Password <span style="color:var(--text-dim);font-size:9px;">(leave blank to keep current)</span></div>';
    html += '<input class="modal-input" id="ebNewPw" type="password" placeholder="New password..." autocomplete="new-password">';
    html += '<div class="pw-strength-track"><div class="pw-strength-bar" id="ebPwStrBar"></div></div>';
    html += '<div class="pw-strength-label" id="ebPwStrLabel"></div>';
    html += '</div>';
    html += '<div class="modal-field">';
    html += '<div class="modal-label">Confirm New Password</div>';
    html += '<input class="modal-input" id="ebNewPwConfirm" type="password" placeholder="Confirm..." autocomplete="new-password">';
    html += '</div>';
    html += '<button class="mini-btn" id="ebDecryptBtn" style="border-color:rgba(224,85,85,0.35);color:#e05555;align-self:flex-start;">Remove Encryption...</button>';
  } else {
    /* Plain book — can add encryption */
    html += '<div class="toggle-row">';
    html += '<div class="toggle-label-group">';
    html += '<div class="toggle-label"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Encrypt this book</div>';
    html += '<div class="toggle-sub">Converts .txt files into a single encrypted binary</div>';
    html += '</div>';
    html += '<label class="toggle-switch"><input type="checkbox" id="ebEncToggle"><div class="toggle-track"></div><div class="toggle-thumb"></div></label>';
    html += '</div>';
    html += '<div class="encrypt-fields" id="ebEncFields">';
    html += '<div class="modal-field"><div class="modal-label">Password</div>';
    html += '<input class="modal-input" id="ebEncPw" type="password" placeholder="Enter password..." autocomplete="new-password">';
    html += '<div class="pw-strength-track"><div class="pw-strength-bar" id="ebEncPwStrBar"></div></div>';
    html += '<div class="pw-strength-label" id="ebEncPwStrLabel"></div>';
    html += '</div>';
    html += '<div class="modal-field"><div class="modal-label">Confirm Password</div>';
    html += '<input class="modal-input" id="ebEncPwConfirm" type="password" placeholder="Confirm..." autocomplete="new-password">';
    html += '</div></div>';
  }

  editBookBody.innerHTML = html;
  wireEditBookListeners(isEnc, isUnlocked);
}

/** Attach event listeners to the dynamically injected fields. */
function wireEditBookListeners(isEnc, isUnlocked) {
  var nameInput = document.getElementById('ebNameInput');
  if (nameInput) nameInput.addEventListener('input', validateEditBook);

  if (isEnc && isUnlocked) {
    var newPwEl  = document.getElementById('ebNewPw');
    var strBar   = document.getElementById('ebPwStrBar');
    var strLabel = document.getElementById('ebPwStrLabel');
    if (newPwEl) {
      newPwEl.addEventListener('input', function () {
        updatePwStrength(this.value, strBar, strLabel);
        validateEditBook();
      });
    }
    var conf = document.getElementById('ebNewPwConfirm');
    if (conf) conf.addEventListener('input', validateEditBook);

    var decBtn = document.getElementById('ebDecryptBtn');
    if (decBtn) {
      decBtn.addEventListener('click', async function () {
        var confirmed = await showConfirm(
          'Remove Encryption',
          'Remove encryption from "' + editingBookName + '"?\n\nAll collections will be written as plain .txt files.',
          'Remove'
        );
        if (!confirmed) return;
        try {
          await doDecryptBook();
        } catch (err) {
          editBookInfo.textContent = 'Error: ' + err.message;
        }
      });
    }
  }

  if (!isEnc) {
    var encToggle = document.getElementById('ebEncToggle');
    var encFields = document.getElementById('ebEncFields');
    if (encToggle) encToggle.addEventListener('change', function () {
      encFields.classList.toggle('show', this.checked);
      validateEditBook();
    });
    var encPwEl  = document.getElementById('ebEncPw');
    var encStrBar = document.getElementById('ebEncPwStrBar');
    var encStrLbl = document.getElementById('ebEncPwStrLabel');
    if (encPwEl) encPwEl.addEventListener('input', function () {
      updatePwStrength(this.value, encStrBar, encStrLbl);
      validateEditBook();
    });
    var encConf = document.getElementById('ebEncPwConfirm');
    if (encConf) encConf.addEventListener('input', validateEditBook);
  }
}

/** Update a password-strength bar and label. */
function updatePwStrength(pw, bar, label) {
  var s = 0;
  if (pw.length >= 8)           s++;
  if (pw.length >= 14)          s++;
  if (/[A-Z]/.test(pw))         s++;
  if (/[0-9]/.test(pw))         s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  var pcts   = ['0%', '18%', '36%', '58%', '80%', '100%'];
  var colors = ['var(--text-dim)', '#e05555', '#e8a230', '#a8c84a', '#52c07a', '#52c07a'];
  var labels = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Very strong'];
  if (bar)   { bar.style.width = pcts[s]; bar.style.background = colors[s]; }
  if (label) { label.textContent = labels[s]; }
}

/** Enable/disable the Save button based on current field values. */
function validateEditBook() {
  var info = bookHandles[editingBookName];
  if (!info) return;
  saveEditBookBtn.disabled    = false;
  editBookInfo.textContent    = '';

  if (info.isEncrypted && info.isUnlocked) {
    var newPw = (document.getElementById('ebNewPw') || {}).value || '';
    var conf  = (document.getElementById('ebNewPwConfirm') || {}).value || '';
    if (newPw && newPw !== conf) {
      editBookInfo.textContent = 'Passwords do not match.';
      saveEditBookBtn.disabled = true;
      return;
    }
  }

  if (!info.isEncrypted) {
    var tog = document.getElementById('ebEncToggle');
    if (tog && tog.checked) {
      var pw = (document.getElementById('ebEncPw') || {}).value || '';
      var pc = (document.getElementById('ebEncPwConfirm') || {}).value || '';
      if (!pw)           { saveEditBookBtn.disabled = true; editBookInfo.textContent = 'Enter an encryption password.'; return; }
      if (pw.length < 6) { saveEditBookBtn.disabled = true; editBookInfo.textContent = 'Password too short (min 6 chars).'; return; }
      if (pw !== pc)     { saveEditBookBtn.disabled = true; editBookInfo.textContent = pc ? 'Passwords do not match.' : 'Confirm your password.'; return; }
    }
  }
}

/* ── Save ── */

saveEditBookBtn.addEventListener('click', async function () {
  var info = bookHandles[editingBookName];
  if (!info) return;

  var nameInput = document.getElementById('ebNameInput');
  var newName   = nameInput ? nameInput.value.trim().replace(/[^a-zA-Z0-9 _\-]/g, '').trim() : '';
  if (!newName) { editBookInfo.textContent = 'Enter a valid book name.'; return; }

  saveEditBookBtn.disabled    = true;
  saveEditBookBtn.textContent = 'Saving...';

  try {
    /* Step 1 — encryption changes */
    if (info.isEncrypted && info.isUnlocked) {
      var newPw = (document.getElementById('ebNewPw') || {}).value || '';
      var conf  = (document.getElementById('ebNewPwConfirm') || {}).value || '';
      if (newPw && newPw === conf) {
        await doChangeBookPassword(editingBookName, newPw);
        showToast('Password changed');
      }
    } else if (!info.isEncrypted) {
      var tog = document.getElementById('ebEncToggle');
      if (tog && tog.checked) {
        var encPw = (document.getElementById('ebEncPw') || {}).value || '';
        await doEncryptBook(editingBookName, encPw);
      }
    }

    /* Step 2 — rename */
    if (newName !== editingBookName) {
      if (bookHandles[newName]) {
        editBookInfo.textContent    = 'A book with that name already exists.';
        saveEditBookBtn.disabled    = false;
        saveEditBookBtn.textContent = 'Save Changes';
        return;
      }
      await doRenameBook(editingBookName, newName);
    }

    editBookOverlay.classList.remove('open');
    showToast('Book updated');
  } catch (err) {
    editBookInfo.textContent = 'Error: ' + err.message;
    editBookInfo.style.color = '#e05555';
    setTimeout(function () { window.focus(); editBookInfo.style.color = ''; }, 3000);
  }

  saveEditBookBtn.disabled    = false;
  saveEditBookBtn.textContent = 'Save Changes';
});

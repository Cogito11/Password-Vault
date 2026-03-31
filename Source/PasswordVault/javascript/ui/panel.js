/* ═══════════════════════════════
   UI / PANEL  —  right panel, vault state, and status bar helpers
═══════════════════════════════ */

/** Update the default-location display in the open-folder menu. */
function updateDefaultUI(name) {
  if (name) {
    menuSetDefaultSub.textContent  = name;
    menuClearDefault.style.display = '';
    menuClearDivider.style.display = '';
    menuLoadDefault.style.display  = '';
    menuLoadDefaultSub.textContent = name;
  } else {
    menuSetDefaultSub.textContent  = 'No default set';
    menuClearDefault.style.display = 'none';
    menuClearDivider.style.display = 'none';
    menuLoadDefault.style.display  = 'none';
    menuLoadDefaultSub.textContent = '';
  }
}

/** Reset every piece of vault state back to the "no folder loaded" baseline. */
function resetVaultState() {
  collections      = {};
  activeFile       = null;
  dirHandle        = null;
  vaultKey         = null;
  isEncryptedVault = false;
  isMultiBookMode  = false;
  isElectronPathMode  = false;
  _electronVaultPath  = null;
  bookHandles         = {};
  activeBookHandle    = null;
  activeBookName      = null;
  unlockingBookName   = null;
  collList.innerHTML  = '';
  leftHint.style.display  = '';
  rightPanel.style.display = 'none';
  rightEmpty.style.display = '';
  dot.classList.remove('on');
  statusTxt.textContent = 'No folder loaded, awaiting input';
  ejectBtn.classList.remove('visible');
  lockVaultBtn.style.display = 'none';
  singleBookLocked = false;
  newCollBtn.classList.add('hidden');
  bookNameEl.textContent = 'No book open';
  colHeadLabel.textContent = 'Password Book';
  booksPanel.classList.remove('visible');
  collSectionHead.classList.remove('visible');
  booksList.innerHTML = '';
}

/* ── Password card list ── */

/** Render an array of entries as password cards in the right panel. */
function renderPasswords(entries) {
  pwList.innerHTML = '';

  if (!entries.length) {
    pwList.innerHTML = '<div class="no-results">No entries found.</div>';
    return;
  }

  entries.forEach(function (entry, idx) {
    var words = entry.name.split(/\s+/);
    var init  = (words[0] ? words[0][0] : '') + (words[1] ? words[1][0] : '');
    init = init.toUpperCase() || '??';

    var attrsHtml = entry.attrs.map(function (attr, ai) {
      var uid      = 'f' + idx + '_' + ai;
      var isSecret = /pass(word)?|secret|pin|key|token/i.test(attr.key);
      var safeVal  = esc(attr.val);

      var valSpan = isSecret
        ? '<span class="pw-attr-val masked" id="v_' + uid + '">\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022</span>'
        : '<span class="pw-attr-val" id="v_' + uid + '">' + safeVal + '</span>';

      var showBtn = isSecret
        ? '<button class="act-btn" data-uid="' + uid + '" data-val="' + safeVal + '" onclick="toggleReveal(this)">SHOW</button>'
        : '';

      return '<div class="pw-attr">' +
        '<span class="pw-attr-key">' + esc(attr.key) + '</span>' +
        valSpan +
        '<div class="pw-attr-actions">' + showBtn +
          '<button class="act-btn" data-val="' + safeVal + '" onclick="copyVal(this)">COPY</button>' +
        '</div></div>';
    }).join('');

    var card      = document.createElement('div');
    card.className = 'pw-card';
    var canMutate = activeFile && activeFile !== '__all__';
    var trueIdx   = (canMutate && collections[activeFile]) ? collections[activeFile].indexOf(entry) : idx;

    card.innerHTML =
      '<div class="pw-card-head">' +
        '<div class="pw-avatar">' + esc(init) + '</div>' +
        '<div class="pw-name" title="' + esc(entry.name) + '">' + esc(entry.name) + '</div>' +
        '<span class="pw-badge">' + entry.attrs.length + ' attribute(s)</span>' +
        (canMutate
          ? '<button class="act-btn card-edit-btn">EDIT</button>' +
            '<button class="act-btn card-del-btn" style="border-color:rgba(224,85,85,0.4);color:#e05555;background:rgba(224,85,85,0.06);">DELETE</button>'
          : '') +
      '</div>' +
      '<div class="pw-attrs">' +
        (attrsHtml || '<div class="pw-attr"><span style="font-family:var(--mono);font-size:11px;color:var(--text-dim)">no attributes</span></div>') +
      '</div>';

    if (canMutate) {
      (function (entryIdx) {
        card.querySelector('.card-edit-btn').addEventListener('click', function () { openEditModal(entryIdx); });
        card.querySelector('.card-del-btn').addEventListener('click', function () { deleteEntry(entryIdx); });
      })(trueIdx);
    }

    pwList.appendChild(card);
  });
}

/** Toggle a masked password field between visible and hidden. */
function toggleReveal(btn) {
  var el = document.getElementById('v_' + btn.dataset.uid);
  if (!el) return;
  if (el.classList.contains('masked')) {
    el.textContent = btn.dataset.val;
    el.classList.remove('masked');
    btn.textContent = 'HIDE';
  } else {
    el.textContent = '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022';
    el.classList.add('masked');
    btn.textContent = 'SHOW';
  }
}

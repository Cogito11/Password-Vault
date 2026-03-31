/* ═══════════════════════════════
   CONFIRM  —  promise-based confirmation dialog
   Exposes window.showConfirm(title, message, okLabel?) → Promise<boolean>
═══════════════════════════════ */
(function () {
  var overlay   = document.getElementById('confirmOverlay');
  var titleEl   = document.getElementById('confirmTitle');
  var msgEl     = document.getElementById('confirmMsg');
  var okBtn     = document.getElementById('confirmOkBtn');
  var cancelBtn = document.getElementById('confirmCancelBtn');
  var _resolve  = null;

  function close(result) {
    overlay.classList.remove('open');
    if (_resolve) { _resolve(result); _resolve = null; }
  }

  okBtn.addEventListener('click',     function () { close(true);  });
  cancelBtn.addEventListener('click', function () { close(false); });
  overlay.addEventListener('click',   function (e) { if (e.target === overlay) close(false); });

  document.addEventListener('keydown', function (e) {
    if (!overlay.classList.contains('open')) return;
    if (e.key === 'Enter')  { e.preventDefault(); close(true);  }
    if (e.key === 'Escape') { e.preventDefault(); close(false); }
  });

  /**
   * Show a modal confirmation dialog.
   * @param {string} title    — dialog heading
   * @param {string} message  — body text
   * @param {string} okLabel  — confirm button label (default: "Delete")
   * @returns {Promise<boolean>}
   */
  window.showConfirm = function (title, message, okLabel) {
    titleEl.textContent = title   || 'Confirm';
    msgEl.textContent   = message || '';
    okBtn.textContent   = okLabel || 'Delete';
    overlay.classList.add('open');
    okBtn.focus();
    return new Promise(function (resolve) { _resolve = resolve; });
  };
})();

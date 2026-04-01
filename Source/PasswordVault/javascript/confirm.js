// ═══════════════════════════════
// CONFIRM - A promise based confirmation dialog
// Exposes window.showConfirm(title, message, okLabel?) -> Promise<boolean>
// ═══════════════════════════════

(function () {
  // Grab references to DOM elements used in the modal
  var overlay = document.getElementById('confirmOverlay');
  var titleEl = document.getElementById('confirmTitle');
  var msgEl = document.getElementById('confirmMsg');
  var okBtn = document.getElementById('confirmOkBtn');
  var cancelBtn = document.getElementById('confirmCancelBtn');

  // Stores the resolve function of the active promise
  var _resolve = null;

  // Closes the modal and resolves the promise with true/false
  function close(result) {
    // Hide modal
    overlay.classList.remove('open');
    if (_resolve) { 
      // Resolve Promise
      _resolve(result); 
      // Reset for next use
      _resolve = null; 
    }
  }

  // When user clicks "OK" -> resolve promise as true
  okBtn.addEventListener('click', function () { close(true);  });
  // When user clicks "Cancel" -> resolve promise as false
  cancelBtn.addEventListener('click', function () { close(false); });
  // Clicking outside the dialog (on overlay) cancels (Might remove to avoid accidental closing, only intentional actions from user)
  overlay.addEventListener('click', function (e) { if (e.target === overlay) close(false); });

  // Keyboard support while modal is open
  document.addEventListener('keydown', function (e) {
    // Ignore key presses if modal is not open
    if (!overlay.classList.contains('open')) return;

    // Enter key = confirm
    if (e.key === 'Enter') { e.preventDefault(); close(true);  }
    // Escape key = cancel
    if (e.key === 'Escape') { e.preventDefault(); close(false); }
  });

  
  // Show a modal confirmation dialog.
  // @param {string} title - dialog heading
  // @param {string} message - body text
  // @param {string} okLabel - confirm button label (default: "Delete")
  // @returns {Promise<boolean>}
  window.showConfirm = function (title, message, okLabel) {
    // Set UI text (with defaults)
    titleEl.textContent = title || 'Confirm';
    msgEl.textContent = message || '';
    okBtn.textContent = okLabel || 'Delete';

    // Show modal
    overlay.classList.add('open');

    // Focus the OK button for accessibility
    okBtn.focus();
    // Return a promise that resolves when the user acts
    return new Promise(function (resolve) { 
      _resolve = resolve; 
    });

  };

})();

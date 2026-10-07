// ═══════════════════════════════
// UI / A11Y - keyboard and screen-reader behaviour shared by every dialog
//   - dialogs are announced as dialogs (role="dialog", aria-modal, a label)
//   - Escape closes the topmost open dialog
//   - Tab / Shift+Tab stay inside the open dialog instead of wandering off
//     into the page behind it
//   - the small edit / delete icons in the sidebar can be used with Enter / Space
// ═══════════════════════════════

(function () {
	var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

	// Dialog semantics
	document.querySelectorAll('.modal-overlay').forEach(function (overlay) {
		var modal = overlay.querySelector('.modal');
		if (!modal) return;

		modal.setAttribute('role', 'dialog');
		modal.setAttribute('aria-modal', 'true');

		var title = modal.querySelector('.modal-head-title');
		if (title) {
			if (!title.id) title.id = (overlay.id || 'modal') + 'Title';
			modal.setAttribute('aria-labelledby', title.id);
		}
	});

	// The dialog the user is currently in. The confirm dialog can open on top of
	// another one, so it wins when it's open.
	function topOverlay() {
		var confirm = document.getElementById('confirmOverlay');
		if (confirm && confirm.classList.contains('open')) return confirm;

		var open = document.querySelectorAll('.modal-overlay.open');
		return open.length ? open[open.length - 1] : null;
	}

	function keepFocusInside(e, overlay) {
		var modal = overlay.querySelector('.modal');
		if (!modal) return;

		var items = Array.prototype.filter.call(modal.querySelectorAll(FOCUSABLE), function (el) {
			return el.offsetParent !== null; // visible only
		});
		if (!items.length) return;

		var first = items[0];
		var last = items[items.length - 1];

		if (!modal.contains(document.activeElement)) {
			e.preventDefault();
			first.focus();
		} else if (e.shiftKey && document.activeElement === first) {
			e.preventDefault();
			last.focus();
		} else if (!e.shiftKey && document.activeElement === last) {
			e.preventDefault();
			first.focus();
		}
	}

	document.addEventListener('keydown', function (e) {
		var overlay = topOverlay();

		if (e.key === 'Tab' && overlay) {
			keepFocusInside(e, overlay);
			return;
		}

		// Escape closes the dialog through its own close button, so any clean-up
		// that button does still happens. (The confirm dialog handles its own Escape.)
		if (e.key === 'Escape' && overlay && overlay.id !== 'confirmOverlay') {
			var closeBtn = overlay.querySelector('.modal-close');
			if (closeBtn) {
				e.preventDefault();
				closeBtn.click();
			}
		}
	});

	// The edit / delete icons are focusable spans (they sit inside the row's own
	// button), so they need to respond to Enter and Space like real buttons.
	document.addEventListener('keydown', function (e) {
		if (e.key !== 'Enter' && e.key !== ' ') return;

		var t = e.target;
		if (t && t.matches && t.matches('.book-action-btn, .coll-action-btn')) {
			e.preventDefault();
			t.click();
		}
	});
})();

// ═══════════════════════════════
// UI / SIDEBAR RESIZE - drag the divider to change the sidebar width
// Session-only by design: nothing is saved, so the app always opens at the
// default width (300px, set in styles.css) and double-clicking the divider
// puts it back. The narrow layout shows the sidebar as a full-width overlay,
// so resizing is wide-layout only.
// ═══════════════════════════════

var SIDEBAR_MIN_WIDTH = 250; // narrower and the "Password Books" heading no longer fits
var SIDEBAR_MAX_WIDTH = 400;
var SIDEBAR_MIN_MAIN_WIDTH = 400; // always leave this much room for the main view

// Keep the width inside [min, max]. The max also shrinks on small windows so
// the main view never gets squeezed below SIDEBAR_MIN_MAIN_WIDTH.
function clampSidebarWidth(px, availableWidth) {
	var dynamicMax = availableWidth ? Math.min(SIDEBAR_MAX_WIDTH, availableWidth - SIDEBAR_MIN_MAIN_WIDTH) : SIDEBAR_MAX_WIDTH;
	var max = Math.max(SIDEBAR_MIN_WIDTH, dynamicMax);
	return Math.min(max, Math.max(SIDEBAR_MIN_WIDTH, Math.round(px)));
}

(function () {
	var resizer = document.getElementById('sidebarResizer');
	var sidebar = document.getElementById('sidebarPanel');
	var layout = document.querySelector('.body');
	if (!resizer || !sidebar || !layout) return;

	var KEY_STEP = 16;
	var KEY_STEP_LARGE = 48;

	var root = document.documentElement;
	var narrowQuery = window.matchMedia('(max-width: 760px)');

	resizer.setAttribute('aria-valuemin', SIDEBAR_MIN_WIDTH);
	resizer.setAttribute('aria-valuemax', SIDEBAR_MAX_WIDTH);

	function currentWidth() {
		return sidebar.getBoundingClientRect().width;
	}

	function syncAria() {
		resizer.setAttribute('aria-valuenow', Math.round(currentWidth()));
	}

	function setWidth(px) {
		var next = clampSidebarWidth(px, layout.getBoundingClientRect().width);
		// One variable drives the sidebar width (see .col-left in styles.css)
		root.style.setProperty('--sidebar-width', next + 'px');
		syncAria();
	}

	resizer.addEventListener('pointerdown', function (e) {
		if (e.button !== 0 || narrowQuery.matches) return;

		e.preventDefault(); // no text selection while dragging

		var startX = e.clientX;
		var startWidth = currentWidth();

		// Capturing the pointer keeps the drag alive even if it leaves the
		// divider, crosses the main view, or leaves the window entirely.
		resizer.setPointerCapture(e.pointerId);
		resizer.classList.add('is-dragging');
		document.body.classList.add('resizing-sidebar');

		function onMove(ev) {
			setWidth(startWidth + (ev.clientX - startX));
		}

		function onEnd() {
			resizer.removeEventListener('pointermove', onMove);
			resizer.removeEventListener('pointerup', onEnd);
			resizer.removeEventListener('pointercancel', onEnd);
			resizer.removeEventListener('lostpointercapture', onEnd);
			resizer.classList.remove('is-dragging');
			document.body.classList.remove('resizing-sidebar');
		}

		resizer.addEventListener('pointermove', onMove);
		resizer.addEventListener('pointerup', onEnd);
		resizer.addEventListener('pointercancel', onEnd);
		resizer.addEventListener('lostpointercapture', onEnd);
	});

	// Double-click: back to the default width
	resizer.addEventListener('dblclick', function () {
		root.style.removeProperty('--sidebar-width');
		syncAria();
	});

	// Keyboard: Left/Right nudge (Shift for bigger steps), Home/End jump to min/max
	resizer.addEventListener('keydown', function (e) {
		var step = e.shiftKey ? KEY_STEP_LARGE : KEY_STEP;

		if (e.key === 'ArrowLeft') setWidth(currentWidth() - step);
		else if (e.key === 'ArrowRight') setWidth(currentWidth() + step);
		else if (e.key === 'Home') setWidth(SIDEBAR_MIN_WIDTH);
		else if (e.key === 'End') setWidth(SIDEBAR_MAX_WIDTH);
		else return;

		e.preventDefault();
	});

	// The stylesheet also caps the sidebar on small windows, keep the reported
	// value in step with what's actually on screen.
	window.addEventListener('resize', syncAria);

	syncAria();
})();

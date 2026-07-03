// ═══════════════════════════════
// UTILS / PASSWORD GENERATOR
// Shared password generation engine + the attr-row generator panel UI.
// Used by:
//   - collection.js   (New Collection / Add Entry modal -> addAttrRow)
//   - edit-entry.js   (Edit Entry modal -> addEditAttrRow)
// ═══════════════════════════════

var GEN_DEFAULT_LENGTH = 15;
var GEN_MIN_LENGTH = 4;
var GEN_MAX_LENGTH = 64;

function getDefaultGeneratorOptions() {
	var settings = getAppSettings();
	return {
		length: settings.generatorLength || GEN_DEFAULT_LENGTH,
		upper: settings.generatorUpper !== false,
		lower: settings.generatorLower !== false,
		numbers: settings.generatorNumbers !== false,
		symbols: settings.generatorSymbols !== false
	};
}

var GEN_CHARSETS = {
	upper:   'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
	lower:   'abcdefghijklmnopqrstuvwxyz',
	numbers: '0123456789',
	symbols: '!@#$%^&*()-_=+[]{}?/~'
};

// Random int in [0, max) - prefers crypto.getRandomValues when available.
function genRandInt(max) {
	if (window.crypto && window.crypto.getRandomValues) {
		var buf = new Uint32Array(1);
		window.crypto.getRandomValues(buf);
		return buf[0] % max;
	}
	return Math.floor(Math.random() * max);
}

// Generate a password string from the given options.
// opts: { length, upper, lower, numbers, symbols }
// Returns '' if no character types are selected.
function generatePassword(opts) {
	var len = Math.min(GEN_MAX_LENGTH, Math.max(GEN_MIN_LENGTH, parseInt(opts.length, 10) || GEN_DEFAULT_LENGTH));

	var activeSets = [];
	['upper', 'lower', 'numbers', 'symbols'].forEach(function (key) {
		if (opts[key]) activeSets.push(GEN_CHARSETS[key]);
	});

	if (!activeSets.length) return '';

	var all = activeSets.join('');
	var chars = [];

	// Guarantee at least one char from each selected set, when the length allows it
	if (activeSets.length <= len) {
		activeSets.forEach(function (set) { chars.push(set[genRandInt(set.length)]); });
	}

	while (chars.length < len) chars.push(all[genRandInt(all.length)]);

	// Fisher-Yates shuffle so guaranteed chars aren't always at the front
	for (var i = chars.length - 1; i > 0; i--) {
		var j = genRandInt(i + 1);
		var tmp = chars[i]; chars[i] = chars[j]; chars[j] = tmp;
	}

	return chars.slice(0, len).join('');
}

// Markup for the value input, wrapped so a generate icon can sit inside it.
// Replaces a bare `<input class="modal-input attr-val">`.
function genAttrValHTML(val) {
	return (
		'<div class="attr-val-wrap">' +
			'<input class="modal-input attr-val" type="text" placeholder="Value" value="' + esc(val) + '">' +
			'<button type="button" class="attr-gen-btn" title="Generate password">' +
				'<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
					'<path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/>' +
				'</svg>' +
			'</button>' +
		'</div>'
	);
}

// Markup for the collapsible generator options panel - a sibling placed after .attr-row.
function genPanelHTML() {
	var defaults = getDefaultGeneratorOptions();
	return (
		'<div class="gen-panel">' +
			'<div class="gen-panel-header">Generate Random Password</div>' +
			'<div class="gen-panel-row">' +
				'<span class="gen-panel-label">Length</span>' +
				'<input type="range" class="gen-len-slider" min="' + GEN_MIN_LENGTH + '" max="' + GEN_MAX_LENGTH + '" value="' + defaults.length + '">' +
				'<span class="gen-len-val">' + defaults.length + '</span>' +
			'</div>' +
			'<div class="gen-panel-checks">' +
				'<label><input type="checkbox" class="gen-chk" data-type="upper" ' + (defaults.upper ? 'checked' : '') + '> Uppercase A-Z</label>' +
				'<label><input type="checkbox" class="gen-chk" data-type="lower" ' + (defaults.lower ? 'checked' : '') + '> Lowercase a-z</label>' +
				'<label><input type="checkbox" class="gen-chk" data-type="numbers" ' + (defaults.numbers ? 'checked' : '') + '> Numbers 0-9</label>' +
				'<label><input type="checkbox" class="gen-chk" data-type="symbols" ' + (defaults.symbols ? 'checked' : '') + '> Symbols !@#</label>' +
			'</div>' +
			'<div class="gen-panel-preview"></div>' +
			'<div class="gen-panel-actions">' +
				'<button type="button" class="mini-btn" data-act="regen">\u21bb Regenerate</button>' +
				'<button type="button" class="mini-btn primary" data-act="use">Use Password</button>' +
			'</div>' +
		'</div>'
	);
}

// Wire up the generate icon + options panel for a single attr-row.
// `rowWrap` is the container holding BOTH the .attr-row and its following .gen-panel as siblings.
function wireAttrGenerator(rowWrap) {
	var genBtn = rowWrap.querySelector('.attr-gen-btn');
	var panel = rowWrap.querySelector('.gen-panel');
	var valInput = rowWrap.querySelector('.attr-val');
	if (!genBtn || !panel || !valInput) return;

	var lenSlider = panel.querySelector('.gen-len-slider');
	var lenVal = panel.querySelector('.gen-len-val');
	var preview = panel.querySelector('.gen-panel-preview');

	function readOpts() {
		return {
			length: parseInt(lenSlider.value, 10),
			upper: panel.querySelector('[data-type="upper"]').checked,
			lower: panel.querySelector('[data-type="lower"]').checked,
			numbers: panel.querySelector('[data-type="numbers"]').checked,
			symbols: panel.querySelector('[data-type="symbols"]').checked
		};
	}

	function regenerate() {
		var pw = generatePassword(readOpts());
		if (!pw) {
			preview.textContent = 'Select at least one character type';
			preview.classList.add('gen-panel-preview-empty');
			panel.dataset.lastGen = '';
		} else {
			preview.textContent = pw;
			preview.classList.remove('gen-panel-preview-empty');
			panel.dataset.lastGen = pw;
		}
	}

	genBtn.addEventListener('click', function (e) {
		e.preventDefault();
		var isOpen = panel.style.display === 'flex';

		// Only one generator panel open at a time across the whole document.
		document.querySelectorAll('.gen-panel').forEach(function (p) { p.style.display = 'none'; });

		if (!isOpen) {
			panel.style.display = 'flex';
			regenerate();
		}
	});

	lenSlider.addEventListener('input', function () {
		lenVal.textContent = lenSlider.value;
		regenerate();
	});

	panel.querySelectorAll('.gen-chk').forEach(function (chk) {
		chk.addEventListener('change', regenerate);
	});

	panel.querySelector('[data-act="regen"]').addEventListener('click', function (e) {
		e.preventDefault();
		regenerate();
	});

	panel.querySelector('[data-act="use"]').addEventListener('click', function (e) {
		e.preventDefault();
		if (panel.dataset.lastGen) valInput.value = panel.dataset.lastGen;
		panel.style.display = 'none';
	});
}

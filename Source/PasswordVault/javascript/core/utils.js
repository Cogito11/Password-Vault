// ═══════════════════════════════
// UTILS - esc, showToast, copyVal, buildFileText
// No dependencies on other JS files.
// These are small helper functions used across the app.
// They are intentionally dependency-free so they can be reused anywhere.
// ═══════════════════════════════

// HTML-escape a string for safe injection into innerHTML.
// WHY: Prevents XSS (cross-site scripting) by escaping special HTML characters.
// Example: "<script>" becomes "&lt;script&gt;"
function esc(s) {
	// Ensure input is treated as a string
	return String(s)
		// Escape ampersand FIRST (important!)
		.replace(/&/g, '&amp;')
		// Escape less-than
		.replace(/</g, '&lt;')
		// Escape greater-than
		.replace(/>/g, '&gt;')
		// Escape double quotes
		.replace(/"/g, '&quot;');
	// NOTE: Does not escape single quotes (') - add if needed
}

// Stores timeout so we can cancel/reset it
var toastTimer;
// Show a brief status toast notification.
// Appears on screen and auto-hides after 1.8 seconds.
function showToast(msg) {
	if (!toast) return;

	// Set message text
	toast.textContent = msg;
	// Trigger css visibility
	toast.classList.add('show');

	// Cancel previous hide timer if there is any
	clearTimeout(toastTimer);

	// Start a new timer to hide the toast after 1.8 seconds
	toastTimer = setTimeout(function () { 
		// Hide via CSS
		toast.classList.remove('show'); 
	}, 1800);
}

// Copy a value to the clipboard
// Briefly flashes the button green.
function copyVal(btn) {
	if (!btn) return;

	// The value is looked up from the data on screen when the button is pressed
	// (see attrValueFromButton in panel.js), it isn't stored in the page.
	var text = typeof attrValueFromButton === 'function' ? attrValueFromButton(btn) : '';

	// Copy through Electron's native clipboard (see preload.js). Unlike
	// navigator.clipboard it needs no browser permission, so the page is granted
	// none and can never read the clipboard back.
	if (!(window.electronAPI && typeof window.electronAPI.copyText === 'function')) {
		showToast('Clipboard unavailable');
		return;
	}

	try {
		window.electronAPI.copyText(text);
	} catch (_) {
		showToast('Clipboard unavailable');
		return;
	}

	// Save original button label
	var prev = btn.textContent;

	// Give visual feedback
	btn.textContent = 'DONE';
	btn.classList.add('ok');

	// Optionally have the clipboard emptied again after a while
	var settings = typeof getAppSettings === 'function' ? getAppSettings() : null;
	var willClear = !!(settings && settings.clearClipboardEnabled && text && typeof window.electronAPI.scheduleClipboardClear === 'function');

	if (willClear) {
		window.electronAPI.scheduleClipboardClear(text, settings.clearClipboardSeconds);
		showToast('Copied \u2014 clipboard clears in ' + settings.clearClipboardSeconds + 's');
	} else {
		showToast('Copied to clipboard');
	}

	// Restore original button after delay
	setTimeout(function () { 
		btn.textContent = prev; 
		btn.classList.remove('ok'); 
	}, 1600);
}

// Function to convert an array of entries into a plain text file format
//
// STRUCTURE OF INPUT:
// entries = [
//   {
//     name: "Example",
//     attrs: [
//       { key: "username", val: "john" },
//       { key: "password", val: "1234" }
//     ]
//   }
// ]
//
// OUTPUT FORMAT:
//
// Entry Name (N attributes)
//     Key: Value
//     Key: First line of a longer value
//         and the lines that follow it, indented further
//
// Entry Name 2 (M attributes)
//     Key: Value
//
// End
//
// WHY:
// This creates a simple, human-readable and parseable text format. Everything the
// app writes reads back exactly as it was entered (see parseFile in vault-io.js):
//   - values are written as-is, including leading/trailing spaces
//   - a value with line breaks continues on following lines, indented deeper
//   - colons and backslashes inside a KEY are escaped as "\\:" and "\\\\"
//   - names and keys are always a single line (line breaks become spaces)
// Blank (or whitespace-only) lines at the very end of a multi-line value are not kept.
function buildFileText(entries) {
	// Collect lines of text before joining
	var lines = [];

	entries.forEach(function (entry) {

		// Header line for each entry, includes entry name and number of attributes
		lines.push(singleLine(entry.name) + ' (' + entry.attrs.length + ' attributes)');

		// Add each attribute on its own indented line
		entry.attrs.forEach(function (a) {
			var valueLines = String(a.val == null ? '' : a.val).split(/\r\n|\r|\n/);

			lines.push('    ' + escapeKey(singleLine(a.key)) + ': ' + valueLines[0]);

			// Any further lines of the value are indented deeper than the key
			for (var i = 1; i < valueLines.length; i++) lines.push('        ' + valueLines[i]);
		});

		// Blank line between entries for readability
		lines.push('');
	});

	// Add a sentinel value at the end of the file
	// Makes parsing easier and signals end of file
	lines.push('End');

	// Join all lines into a single string with newline seperators
	return lines.join('\n');
}

// Names and keys live on one line: line breaks become spaces
function singleLine(s) {
	return String(s == null ? '' : s).replace(/[\r\n]+/g, ' ');
}

// In a key, a colon would be mistaken for the key/value separator, so it (and the
// backslash used to escape it) is escaped
function escapeKey(key) {
	return key.replace(/\\/g, '\\\\').replace(/:/g, '\\:');
}


// ═══════════════════════════════
// NAMES - turning what the user typed into a safe book / collection name
// ═══════════════════════════════

// Windows treats these as devices, with or without an extension (CON, NUL.txt...)
var RESERVED_FILE_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;
var MAX_NAME_LENGTH = 100;

// Cleans a typed name so it can be used as a folder / file name on any OS.
// Only characters that genuinely can't be used are removed, so accented and
// non-Latin names ("Café", "Банк", "银行") are kept as typed.
//
// Returns { name, changed, error }
//   name    - the cleaned name ('' if nothing usable is left)
//   changed - true if cleaning altered what was typed (beyond trimming), so the
//             UI can tell the user what the name will actually be
//   error   - a message if the name can't be used at all, otherwise null
function sanitizeName(raw) {
	var typed = String(raw == null ? '' : raw).trim();

	var name = typed
		.replace(/[\u0000-\u001f\u007f<>:"\/\\|?*]/g, '') // characters no common file system allows
		.replace(/\s+/g, ' ')                              // collapse runs of whitespace
		.replace(/^\.+/, '')                               // a leading dot makes a hidden file on macOS/Linux
		.trim()
		.replace(/[. ]+$/, '');                            // Windows silently drops trailing dots and spaces

	// Cut by characters, not UTF-16 units, so an emoji is never split in half
	var chars = Array.from(name);
	if (chars.length > MAX_NAME_LENGTH) name = chars.slice(0, MAX_NAME_LENGTH).join('').trim();

	var error = null;
	if (!name) error = 'Enter a valid name.';
	else if (RESERVED_FILE_NAMES.test(name)) error = '"' + name + '" is a reserved name on Windows. Please choose another.';

	return { name: name, changed: name !== typed, error: error };
}

// Case- and accent-form-insensitive key for comparing names. Windows and macOS
// treat "Banking" and "banking" as the same file, so every duplicate check goes
// through this instead of comparing raw strings.
function nameKey(s) {
	return String(s == null ? '' : s).normalize('NFC').toLowerCase();
}

// Finds the first descendant whose data-<name> attribute equals value.
// Replaces querySelector('[data-file="' + value + '"]'), which throws a
// SyntaxError for any value containing a quote, bracket or backslash.
function findByData(root, name, value) {
	if (!root) return null;
	var nodes = root.querySelectorAll('[data-' + name + ']');
	for (var i = 0; i < nodes.length; i++) {
		if (nodes[i].dataset[name] === value) return nodes[i];
	}
	return null;
}


// ═══════════════════════════════
// SECRET FIELDS - which attributes are hidden by default
// ═══════════════════════════════

// Whole words that mark a value as sensitive. Matching whole words (not pieces of
// words) means "Shipping address", "Opinion" and "Monkey" are NOT hidden just
// because they contain "pin" or "key".
var SECRET_WORDS = [
	'pass', 'password', 'passwords', 'passwd', 'pwd', 'passcode', 'passphrase',
	'pin', 'secret', 'secrets', 'token', 'tokens', 'key', 'keys', 'apikey',
	'cvv', 'cvc', 'cvn', 'ssn', 'otp', 'totp', '2fa', 'mfa',
	'seed', 'mnemonic', 'credential', 'credentials', 'answer', 'answers',

	// "password" in other languages (labels are matched as whole words, any script)
	'contraseña', 'contrasena', 'clave', 'passwort', 'kennwort', 'wachtwoord', 'senha', 'lösenord', 'hasło', 'salasana',
	'пароль', '密码', '密碼', 'パスワード', '비밀번호'
];

// Two-word labels where neither word is sensitive on its own
var SECRET_PHRASES = /\b(card|account|routing|license|licence|passport|bank|social security|tax) (number|no|num)\b|\b(security|recovery|backup|auth|verification|reset) (code|codes)\b/;

function isSecretKey(key) {
	var words = String(key == null ? '' : key)
		.replace(/([a-z])([A-Z])/g, '$1 $2') // apiKey -> api Key
		.toLowerCase()
		.split(/[^\p{L}\p{N}]+/u)           // letters and digits of any script
		.filter(Boolean);

	if (words.some(function (w) { return SECRET_WORDS.indexOf(w) !== -1; })) return true;

	var joined = words.join(' ');
	return SECRET_PHRASES.test(joined) || joined.indexOf('mot de passe') !== -1;
}

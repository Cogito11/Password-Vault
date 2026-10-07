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

	var text = btn.dataset && btn.dataset.val ? btn.dataset.val : '';

	if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
		// Copy the text from the buttons data attribute
		navigator.clipboard.writeText(text).then(function () {
			// Save original button label
			var prev = btn.textContent;

			// Give visual feedback
			btn.textContent = 'DONE';
			btn.classList.add('ok');

			showToast('Copied to clipboard');

			// Restore original button after delay
			setTimeout(function () { 
				btn.textContent = prev; 
				btn.classList.remove('ok'); 
			}, 1600);
		}).catch(function () {
			showToast('Clipboard unavailable');
		});
	} else {
		showToast('Clipboard unavailable');
	}
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
//
// Entry Name 2 (M attributes)
//     Key: Value
//
// End
//
// WHY:
// This creates a simple, human-readable and parseable text format.
function buildFileText(entries) {
	// Collect lines of text before joining
	var lines = [];

	entries.forEach(function (entry) {

		// Header line for each entry, includes entry name and number of attributes
		lines.push(entry.name + ' (' + entry.attrs.length + ' attributes)');
		
		// Add each attribute on its own indented line
		entry.attrs.forEach(function (a) { 
			lines.push('    ' + a.key + ': ' + a.val); 
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

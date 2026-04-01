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
	// Copy the text from the buttons data attribute
	navigator.clipboard.writeText(btn.dataset.val).then(function () {
		
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
	});
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

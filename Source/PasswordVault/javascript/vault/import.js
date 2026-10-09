// ═══════════════════════════════
// VAULT / IMPORT - CSV password import
// Handles parsing browser-exported password CSVs (Chrome, Edge, and others
// that use the same "name,url,username,password[,note]" export format) and
// writing the resulting entries into an existing password book - whether or
// not that book is the one currently open in the sidebar.
// ═══════════════════════════════

var csvImportBookSelect = document.getElementById('csvImportBookSelect');
var csvImportFileInput  = document.getElementById('csvImportFileInput');
var csvImportBtn        = document.getElementById('csvImportBtn');
var csvImportInfo       = document.getElementById('csvImportInfo');

// Parse a raw CSV string into an array of row objects keyed by lower-cased
// header name. Handles quoted fields (commas/newlines inside quotes, and
// "" as an escaped quote) since real browser exports quote URLs freely.
function parseCsv(text) {
	var rows = [];
	var row = [];
	var field = '';
	var inQuotes = false;
	var quoteRow = 0; // data row (header = row 1) where the current quote was opened

	text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

	for (var i = 0; i < text.length; i++) {
		var c = text[i];

		if (inQuotes) {
			if (c === '"') {
				if (text[i + 1] === '"') { field += '"'; i++; }
				else { inQuotes = false; }
			} else {
				field += c;
			}
			continue;
		}

		if (c === '"') { inQuotes = true; quoteRow = rows.length + 1; continue; }
		if (c === ',') { row.push(field); field = ''; continue; }

		if (c === '\n') {
			row.push(field); field = '';
			rows.push(row); row = [];
			continue;
		}

		field += c;
	}

	// A quote that was opened and never closed would swallow the rest of the file
	// into one giant field without any sign that something was wrong
	if (inQuotes) {
		throw new Error('Row ' + quoteRow + ' has a quote that is never closed, so the rest of the file cannot be read. Check the file and try again.');
	}

	// Final field/row - files don't always end with a trailing newline
	if (field.length || row.length) { row.push(field); rows.push(row); }

	if (!rows.length) return { headers: [], rows: [] };

	var headers = rows[0].map(function (h) { return h.trim().toLowerCase(); });

	var dataRows = rows.slice(1)
		// Skip blank trailing lines
		.filter(function (r) { return r.some(function (v) { return v.trim() !== ''; }); })
		.map(function (r) {
			var obj = {};
			// Values are kept exactly as exported: a password may legitimately start or
			// end with a space. Fields that should never carry stray whitespace are
			// trimmed where they're used (see csvRowsToEntries).
			headers.forEach(function (h, idx) { obj[h] = r[idx] || ''; });
			return obj;
		});

	return { headers: headers, rows: dataRows };
}

// The columns we already give a fixed, friendly attribute name to.
// Anything else in the CSV falls through to the generic handling below.
var KNOWN_CSV_COLUMNS = ['name', 'title', 'url', 'username', 'password', 'note'];

// Turn a lower-cased CSV header into a readable attribute key,
// e.g. "http_realm" -> "Http Realm".
function titleCaseHeader(h) {
	return h.replace(/[_\-]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.replace(/\b\w/g, function (c) { return c.toUpperCase(); });
}

// Convert parsed CSV rows into the app's entry format: { name, attrs: [{ key, val }] }
// The 5 known columns (name/title/url/username/password/note) get fixed,
// friendly attribute names. Any other non-empty column - from exports that
// use different headers (Firefox, custom tools, etc.) - is still imported,
// using its original header text as the attribute key, so nothing silently
// gets dropped just because it isn't one of the columns we anticipated.
function csvRowsToEntries(rows, headers) {
	return rows.map(function (r) {
		var name = (r.name || r.title || r.url || '').trim() || 'Imported Password';
		var attrs = [];

		var url = (r.url || '').trim();
		var username = (r.username || '').trim();
		var note = (r.note || '').trim();

		if (url)        attrs.push({ key: 'URL', val: url });
		if (username)   attrs.push({ key: 'Username', val: username });
		if (r.password) attrs.push({ key: 'Password', val: r.password });
		if (note)       attrs.push({ key: 'Note', val: note });

		(headers || []).forEach(function (h) {
			if (!h || KNOWN_CSV_COLUMNS.indexOf(h) !== -1) return;
			var val = (r[h] || '').trim();
			if (!val) return;
			attrs.push({ key: titleCaseHeader(h), val: val });
		});

		return { name: name, attrs: attrs };
	});
}

// Populate the "Import To" dropdown with every book we can currently write
// into: plain books, and encrypted books that are unlocked. Locked
// encrypted books are listed but disabled, since we have no way to decrypt
// (or re-encrypt) them without the password.
function populateCsvImportBookOptions() {
	if (!csvImportBookSelect) return;

	csvImportBookSelect.innerHTML = '';

	var names = Object.keys(bookHandles).sort();

	if (!names.length) {
		var empty = document.createElement('option');
		empty.textContent = 'No books available \u2014 open a folder first';
		empty.disabled = true;
		csvImportBookSelect.appendChild(empty);
		if (csvImportBtn) csvImportBtn.disabled = true;
		return;
	}

	names.forEach(function (name) {
		var info = bookHandles[name];
		var locked = info.isEncrypted && !info.isUnlocked;

		var opt = document.createElement('option');
		opt.value = name;
		opt.textContent = name + (locked ? ' (locked \u2014 unlock first)' : '');
		opt.disabled = locked;
		csvImportBookSelect.appendChild(opt);
	});

	var firstEnabled = csvImportBookSelect.querySelector('option:not(:disabled)');
	if (firstEnabled) csvImportBookSelect.value = firstEnabled.value;

	if (csvImportBtn) csvImportBtn.disabled = !firstEnabled;
	if (csvImportInfo) csvImportInfo.textContent = '';
}

// Write a freshly-imported collection into the named book, whether or not
// it's the book currently open in the sidebar. Returns the filename used.
//
// This works on the target book directly instead of temporarily re-pointing the
// shared "active book" globals: those swaps spanned several awaits, so anything
// the user did in that window (clicking a collection, say) would have acted on
// the wrong book.
async function writeImportedCollection(bookName, entries) {
	var info = bookHandles[bookName];
	if (!info) throw new Error('Book not found');
	if (info.isEncrypted && !info.isUnlocked) throw new Error('Unlock "' + bookName + '" first.');

	// In single-book mode there is only ever one book loaded, so it's always "active"
	var isTargetActive = isMultiBookMode ? (activeBookName === bookName) : true;

	// A plain book that has never been opened this session only has an empty
	// in-memory stub (see loader.js). Load its real files first so we don't
	// clobber the record of its other collections with just the one we add.
	if (!isTargetActive && !info.isEncrypted && !info.isUnlocked) {
		await loadPlainBook(bookName);
	}

	// The active book's collections live in the global; other books keep theirs on their handle
	var target = isTargetActive ? collections : info.collections;
	var filename = nextImportFilename(target, info.path);

	target[filename] = entries;
	if (isMultiBookMode && isTargetActive) info.collections = collections;

	try {
		if (info.isEncrypted) {
			await reEncryptBook(bookName);
		} else {
			// exclusive: never overwrite a file we didn't know about
			await namedBookWriteFile(bookName, filename, buildFileText(entries), { exclusive: true });
		}
	} catch (err) {
		// The write failed: keep memory in step with the disk
		delete target[filename];
		throw err;
	}

	return filename;
}

// Pick a collection filename that doesn't collide (ignoring case) with an existing
// collection, or with a file already on disk, based on today's date.
function nextImportFilename(existingCollections, folderPath) {
	existingCollections = existingCollections || {};
	var taken = Object.keys(existingCollections).map(nameKey);

	var stamp = new Date().toISOString().slice(0, 10);
	var base = 'Imported_' + stamp;
	var filename = base + '.txt';
	var n = 2;

	function inUse(f) {
		if (taken.indexOf(nameKey(f)) !== -1) return true;

		try { return !!folderPath && window.vault.exists(window.vault.joinPath(folderPath, f)); }
		catch (_) { return false; }
	}

	while (inUse(filename)) {
		filename = base + '_' + n + '.txt';
		n++;
	}

	return filename;
}

// Handle the actual import: read the chosen file, parse it, write the
// resulting collection into the selected book, and refresh the UI if that
// book happens to be the one currently open.
async function handleCsvImportFile(file) {
	var bookName = csvImportBookSelect.value;
	if (!bookName) { showToast('Choose a book to import into'); return; }

	csvImportBtn.disabled = true;
	csvImportBtn.textContent = 'Importing\u2026';
	if (csvImportInfo) csvImportInfo.textContent = '';

	try {
		var text = await file.text();
		var parsed = parseCsv(text);
		var entries = csvRowsToEntries(parsed.rows, parsed.headers);

		if (!entries.length) {
			showToast('No passwords found in that file');
			return;
		}

		var filename = await writeImportedCollection(bookName, entries);

		var info = bookHandles[bookName];

		// Keep that book's sidebar row in sync even if it isn't open right now
		if (isMultiBookMode) {
			var meta = document.getElementById('book-meta-' + bookName);
			if (meta) {
				var cnt = Object.keys(info.collections).length;
				meta.textContent = cnt + ' collection' + (cnt !== 1 ? 's' : '') + (info.isEncrypted ? ' \xb7 encrypted' : ' \xb7 plain text');
			}
		}

		// If the target book is the one currently open, refresh the visible list
		var isCurrentlyOpen = isMultiBookMode ? (activeBookName === bookName) : (bookName === vaultName());
		if (isCurrentlyOpen) {
			var results = Object.keys(collections).sort().map(function (k) {
				return { name: k, entries: collections[k] };
			});
			buildSidebar(results);
		}

		var msg = entries.length + ' password' + (entries.length !== 1 ? 's' : '') + ' imported into "' + bookName + '"';
		showToast(msg);
		if (csvImportInfo) csvImportInfo.textContent = msg + '.';

	} catch (err) {
		showToast('Import failed: ' + err.message);
		if (csvImportInfo) csvImportInfo.textContent = 'Error: ' + err.message;
	} finally {
		csvImportBtn.disabled = false;
		csvImportBtn.textContent = 'Import';
	}
}

// Wiring

if (csvImportBtn) {
	csvImportBtn.addEventListener('click', function () {
		csvImportFileInput.value = '';
		csvImportFileInput.click();
	});
}

if (csvImportFileInput) {
	csvImportFileInput.addEventListener('change', function () {
		var file = csvImportFileInput.files && csvImportFileInput.files[0];
		if (file) handleCsvImportFile(file);
	});
}

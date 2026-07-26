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

		if (c === '"') { inQuotes = true; continue; }
		if (c === ',') { row.push(field); field = ''; continue; }

		if (c === '\n') {
			row.push(field); field = '';
			rows.push(row); row = [];
			continue;
		}

		field += c;
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
			headers.forEach(function (h, idx) { obj[h] = (r[idx] || '').trim(); });
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
		var name = r.name || r.title || r.url || 'Imported Password';
		var attrs = [];

		if (r.url)      attrs.push({ key: 'URL', val: r.url });
		if (r.username) attrs.push({ key: 'Username', val: r.username });
		if (r.password) attrs.push({ key: 'Password', val: r.password });
		if (r.note)     attrs.push({ key: 'Note', val: r.note });

		(headers || []).forEach(function (h) {
			if (!h || KNOWN_CSV_COLUMNS.indexOf(h) !== -1) return;
			var val = r[h];
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
// HOW: temporarily points the shared "active book" accessors (collections /
// vaultKey / isEncryptedVault / activeBookName / activeBookHandle) at the
// target book, reuses the exact same save path every other flow in this app
// uses (bookWriteFile for plain books, reEncryptVault for encrypted ones),
// then restores whatever was actually active before. This mirrors the
// pattern already used by doEncryptBook / doChangeBookPassword in books.js,
// which operate on a named book's own `info.collections` directly.
async function writeImportedCollection(bookName, entries) {
	var info = bookHandles[bookName];
	if (!info) throw new Error('Book not found');

	// In single-book mode there is only ever one book loaded, so it's
	// always "active" - getBookPath() ignores activeBookName entirely in
	// that mode, so no context swap is needed or possible.
	var isTargetActive = isMultiBookMode ? (activeBookName === bookName) : true;

	// A plain book that has never been opened this session only has an
	// empty in-memory `collections` stub (see loader.js - multi-book plain
	// books start as { isUnlocked: false, collections: {} } until clicked).
	// Load its real files first so we don't clobber the in-memory record of
	// its other collections with just the one we're about to add.
	if (!isTargetActive && !info.isEncrypted && !info.isUnlocked) {
		await loadPlainBook(bookName);
	}

	var prev = {
		collections: collections,
		vaultKey: vaultKey,
		isEncryptedVault: isEncryptedVault,
		activeBookName: activeBookName,
		activeBookHandle: activeBookHandle
	};

	if (!isTargetActive) {
		collections = info.collections || {};
		vaultKey = info.key;
		isEncryptedVault = info.isEncrypted;
		activeBookName = bookName;
		activeBookHandle = info.handle;
	}

	try {
		// Pick the filename now that `collections` genuinely reflects the
		// target book's real contents (the live global if it was already
		// active/loaded, or the freshly-loaded data above otherwise) -
		// checking a cached/stale reference here could miss a same-day
		// collision (this bit us in single-book mode, where
		// bookHandles[name].collections is never kept in sync - the loader
		// only ever populates the global `collections` var for that case).
		var filename = nextImportFilename(collections);

		collections[filename] = entries;
		if (isMultiBookMode) bookHandles[bookName].collections = collections;

		if (bookIsEncrypted()) {
			await reEncryptVault();
		} else {
			await bookWriteFile(filename, buildFileText(entries));
		}

		return filename;
	} finally {
		if (!isTargetActive) {
			// Keep the target book's own record in sync before switching back
			info.collections = collections;

			collections = prev.collections;
			vaultKey = prev.vaultKey;
			isEncryptedVault = prev.isEncryptedVault;
			activeBookName = prev.activeBookName;
			activeBookHandle = prev.activeBookHandle;
		}
	}
}

// Pick a collection filename that doesn't already collide with one that
// genuinely exists in the given collections object, based on today's date.
function nextImportFilename(existingCollections) {
	existingCollections = existingCollections || {};
	var stamp = new Date().toISOString().slice(0, 10);
	var base = 'Imported_' + stamp;
	var filename = base + '.txt';
	var n = 2;

	while (existingCollections[filename]) {
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

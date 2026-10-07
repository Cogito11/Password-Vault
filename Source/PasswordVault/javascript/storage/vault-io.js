// ═══════════════════════════════
// VAULT-IO - transparent file I/O for both Web FS API and Electron path mode
// All functions route through the active book, falling back to Node fs when
// isElectronPathMode is true.
// ═══════════════════════════════

// Returns the display name of the vault by extracting the last segment of
// the Electron vault path, falling back to the full path if it has no separators.
function vaultName() {
	if (_electronVaultPath) {
		return _electronVaultPath.split(/[\/\\]/).filter(Boolean).pop() || _electronVaultPath;
	}
	return 'Vault';
}

function getBookHandle() { return isMultiBookMode ? activeBookHandle : dirHandle; }

// Returns the AES-GCM CryptoKey for the active book, or null if it is plain text.
function getBookKey() { return isMultiBookMode ? (bookHandles[activeBookName] ? bookHandles[activeBookName].key : null) : vaultKey; }

// Returns whether the active book is encrypted.
function bookIsEncrypted()  { return isMultiBookMode ? (bookHandles[activeBookName] ? bookHandles[activeBookName].isEncrypted : false) : isEncryptedVault; }

// Returns the absolute filesystem path for the active book directory.
// In multi-book mode this is the book's own subdirectory; otherwise the vault root.
function getBookPath() {
	if (isMultiBookMode && activeBookName && bookHandles[activeBookName]) {
		return bookHandles[activeBookName].path || null;
	}
	return _electronVaultPath || null;
}

// Active-book I/O
 
// Writes a UTF-8 text string to filename inside the active book directory.
// Writes are crash-safe (see fs-atomic.js). opts: { exclusive } never overwrite.
async function bookWriteFile(filename, text, opts) {
	window.vault.writeFile(window.vault.joinPath(getBookPath(), filename), text, opts);
}

// Writes a Uint8Array to filename inside the active book directory.
// Used for vault.enc - binary data must not go through the text path.
// opts: { exclusive } never overwrite, { backup } keep the previous version as .bak
async function bookWriteBin(filename, bytes, opts) {
	window.vault.writeFileBin(window.vault.joinPath(getBookPath(), filename), bytes, opts);
}

// Renames a file inside the active book directory. This is a real rename (not
// write + delete), so it also works for case-only changes like Banking -> banking
// on case-insensitive file systems, where write + delete would erase the file.
function bookRenameFile(oldName, newName) {
	var dir = getBookPath();
	window.vault.rename(window.vault.joinPath(dir, oldName), window.vault.joinPath(dir, newName));
}

// Reads filename from the active book and returns its contents as a Uint8Array.
// window.vault.readFileBin returns a plain Array or Buffer, so we normalise to Uint8Array.
function bookReadBin(filename) {
	return new Uint8Array(window.vault.readFileBin(window.vault.joinPath(getBookPath(), filename)));
}

// Permanently removes filename from the active book directory.
function bookDeleteFile(filename) {
	window.vault.deleteFile(window.vault.joinPath(getBookPath(), filename));
}

// Named-book I/O 
// These functions accept an explicit bookName so they can target a book other
// than the active one - used during encryption conversion and rename operations.
 
// Writes bytes to filename inside the named book's directory.
function namedBookWriteBin(bookName, filename, bytes, opts) {
	var info = bookHandles[bookName];
	window.vault.writeFileBin(window.vault.joinPath(info.path, filename), bytes, opts);
}

// Reads filename from the named book and returns a Uint8Array.
function namedBookReadBin(bookName, filename) {
	var info = bookHandles[bookName];
	return new Uint8Array(window.vault.readFileBin(window.vault.joinPath(info.path, filename)));
}

// Writes a UTF-8 text string to filename inside the named book's directory.
function namedBookWriteFile(bookName, filename, text, opts) {
	var info = bookHandles[bookName];
	window.vault.writeFile(window.vault.joinPath(info.path, filename), text, opts);
}

// Permanently removes filename from the named book's directory.
function namedBookDeleteFile(bookName, filename) {
	var info = bookHandles[bookName];
	window.vault.deleteFile(window.vault.joinPath(info.path, filename));
}

// Removes the vault.enc.bak safety copy, if there is one. Must be done whenever
// the password changes or the book is decrypted: the backup is encrypted with the
// OLD password, so keeping it would defeat the purpose of changing it.
function namedBookRemoveBackup(bookName) {
	var info = bookHandles[bookName];
	var bak = window.vault.joinPath(info.path, 'vault.enc.bak');
	if (window.vault.exists(bak)) window.vault.deleteFile(bak);
}

// Folder contents
// A "book" is just a folder, so deleting one must never touch files the app
// didn't create. These helpers decide what is the app's and what isn't.

// Files this app creates inside a book folder: collections, the encrypted
// vault, its backup, and the temporary files used while writing.
function isVaultOwnedFile(name) {
	var n = name.toLowerCase();
	return n.endsWith('.txt') || n === 'vault.enc' || n === 'vault.enc.bak' || n === 'vault.enc.bak.tmp' || /\.tmp-\d+-\d+-[a-z0-9]+$/.test(n);
}

// Clutter the operating system adds on its own; safe to remove with the folder
function isOsJunkFile(name) {
	var n = name.toLowerCase();
	return n === '.ds_store' || n === 'thumbs.db' || n === 'desktop.ini';
}

// Splits a book folder into files that can be removed with it and anything else
// (the user's own files, sub-folders). Returns { removable: [names], others: [names] }.
function inspectBookFolder(folderPath) {
	var removable = [];
	var others = [];

	window.vault.readDir(folderPath).forEach(function (e) {
		if (e.isFile && (isVaultOwnedFile(e.name) || isOsJunkFile(e.name))) removable.push(e.name);
		else others.push(e.name);
	});

	return { removable: removable, others: others };
}

// Lists all entries in the named book's directory.
// window.vault.readDir already returns the normalised { name, isFile, isDirectory } shape.
function namedBookListFiles(bookName) {
	var info = bookHandles[bookName];
	return window.vault.readDir(info.path);
}

// Plain-text file parser
 
// Parses the contents of a .txt collection file into an array of entry objects.
// Expected format:
//   Entry Name (N attributes)
//       Key: Value
//   (blank line)
//   End
//
// Returns: [{ name: string, attrs: [{ key, val }] }]
function parseFile(text) {
	var entries = [];
	var lines = text.split(/\r?\n/);
	var cur = null; // The entry currently being built
 
	for (var i = 0; i < lines.length; i++) {
		var raw = lines[i];
		var tr = raw.trim();
 
		// Skip blank lines, "End" terminators, and decorative separator lines (--- or ===)
		if (!tr || /^end$/i.test(tr) || /^[-=]/.test(tr)) continue;
 
		if (/^\s/.test(raw) && cur) {
			// Indented line -> attribute of the current entry
			var ci = tr.indexOf(':');
			if (ci > 0) cur.attrs.push({ key: tr.slice(0, ci).trim(), val: tr.slice(ci + 1).trim() });
			continue;
		}
 
		// Non-indented line -> start of a new entry.
		// Strip the trailing "(N attributes)" annotation added by the serialiser.
		cur = { name: tr.replace(/\s*\(\d+\s*(?:attributes?)?\)\s*$/i, '').trim(), attrs: [] };
		if (cur.name) entries.push(cur); // Guard against a line that is nothing but the annotation
	}
	return entries;
}

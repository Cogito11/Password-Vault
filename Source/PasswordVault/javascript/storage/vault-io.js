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
async function bookWriteFile(filename, text) {
	window.vault.writeFile(window.vault.joinPath(getBookPath(), filename), text);
}

// Writes a Uint8Array to filename inside the active book directory.
// Used for vault.enc - binary data must not go through the text path.
async function bookWriteBin(filename, bytes) {
	window.vault.writeFileBin(window.vault.joinPath(getBookPath(), filename), bytes);
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
function namedBookWriteBin(bookName, filename, bytes) {
	var info = bookHandles[bookName];
	window.vault.writeFileBin(window.vault.joinPath(info.path, filename), bytes);
}

// Reads filename from the named book and returns a Uint8Array.
function namedBookReadBin(bookName, filename) {
	var info = bookHandles[bookName];
	return new Uint8Array(window.vault.readFileBin(window.vault.joinPath(info.path, filename)));
}

// Writes a UTF-8 text string to filename inside the named book's directory.
function namedBookWriteFile(bookName, filename, text) {
	var info = bookHandles[bookName];
	window.vault.writeFile(window.vault.joinPath(info.path, filename), text);
}

// Permanently removes filename from the named book's directory.
function namedBookDeleteFile(bookName, filename) {
	var info = bookHandles[bookName];
	window.vault.deleteFile(window.vault.joinPath(info.path, filename));
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

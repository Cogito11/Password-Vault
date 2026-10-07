// ═══════════════════════════════
// VAULT / BOOKS - book lifecycle management
// Covers: selecting, activating, locking/relocking, deleting, renaming,
// encrypting, decrypting, and changing passwords for password books.
// ═══════════════════════════════ */


// Handle a click on a book button in the sidebar
// Loads plain books immediately; shows unlock modal for encrypted books
async function selectBook(bookName, btn) {
	
	// Lookup metadata for this book
	var info = bookHandles[bookName];
	// Abort if book doesn't exist
	if (!info) return;

	if (!isMultiBookMode && info.isUnlocked) return;

	// If already unlocked OR not encrypted, load immediately
	if (info.isUnlocked || !info.isEncrypted) {
		// If not unlocked yet (plain book), load its contents
		if (!info.isUnlocked) await loadPlainBook(bookName);
		// Make it active in UI
		activateBook(bookName, btn);
		return;
	}

	// Otherwise, book is encrypted and locked, prompt unlock modal
	unlockingBookName = bookName;
	openVaultUnlockModal(bookName);
}

// Make a book the active one
// Syncs global state, builds sidebar, opens the All Passwords view
function activateBook(bookName, btn) {
	// Remove active state from all book buttons
	booksList.querySelectorAll('.book-btn').forEach(function (b) { b.classList.remove('active'); });
	
	// Highlight selected button
	if (btn) btn.classList.add('active');

	// Set global active book state
	activeBookName = bookName;
	activeBookHandle = bookHandles[bookName].handle;

	var info = bookHandles[bookName];

	// Load book specific data into globals
	collections = info.collections;
	vaultKey = info.key;
	isEncryptedVault = info.isEncrypted;

	// Build sidebar from sorted collection names
	var results = Object.keys(collections).sort().map(function (k) {
		return { name: k, entries: collections[k] };
	});

	// Update header subtitles: which book is selected, and how many
	// collections it has (buildSidebar doesn't touch these in multi-book
	// mode, since that branch is single-book-only)
	setSelectedBookLabel(bookName);
	setCollSectionCount(results.length, bookName);

	buildSidebar(results);

	// Show new collection button
	newCollBtn.classList.remove('hidden');

	// Open the "All Passwords" view straight away instead of leaving the
	// right panel empty until a collection is picked.
	var allBtn = collList.querySelector('.all-btn');
	if (allBtn) 
	{
		openAllCollections(allBtn);
	} 
	else 
	{
		activeFile = null;
		rightPanel.style.display = 'none';
		rightEmpty.style.display = '';
	}
}

// Relock a book, wipe key and sensitive data from memory
// Also resets UI if the book was active
function relockBook(bookName, options) {
	var info = bookHandles[bookName];
	// Only applies to encrypted books
	if (!info || !info.isEncrypted) return;

	// Clear sensitive data
	info.key = null;
	info.salt = null;
	info.collections = {};
	info.isUnlocked = false;

	// Update UI button (add lock icon if missing)
	var btn = findByData(booksList, 'book', bookName);
	if (btn) {
		if (!btn.querySelector('.book-lock')) {
			var lk = document.createElement('span');
			lk.className = 'book-lock';
			lk.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
			btn.appendChild(lk);
		}

		// Remove relock button since its now locked
		var rb = btn.querySelector('.book-relock-btn');
		if (rb) rb.remove();
	}

	// Update metadata label
	var meta = document.getElementById('book-meta-' + bookName);
	if (meta) meta.textContent = 'Encrypted';

	// If this book was active, reset entire UI state
	if (activeBookName === bookName) {
		activeBookName = null;
		activeBookHandle = null;
		collections = {};
		vaultKey = null;
		isEncryptedVault = false;
		activeFile = null;
		collList.innerHTML = '';
		leftHint.style.display = '';
		rightPanel.style.display = 'none';
		rightEmpty.style.display = '';
		newCollBtn.classList.add('hidden');
		collSectionName.textContent = 'Select a book above';
		setSelectedBookLabel(null);
		setCollSectionCount(0, null);
		if (btn) btn.classList.remove('active');
	} 
	else if (!isMultiBookMode) 
	{
		// single book mode reset
		collections = {};
		vaultKey = null;
		isEncryptedVault = false;
		activeFile = null;
		collList.innerHTML = '';
		leftHint.style.display = '';
		rightPanel.style.display = 'none';
		rightEmpty.style.display = '';
		newCollBtn.classList.add('hidden');
		booksPanel.classList.add('visible');
		collSectionName.textContent = 'Select a book above';
		setSelectedBookLabel(null);
		setCollSectionCount(0, null);
	}

	// Notify user (callers locking several books at once show one summary instead)
	if (!(options && options.silent)) showToast(bookName + ' locked');
}

// Permanently delete a book and the files this app created in it.
//
// A "book" is just a folder, and the folder may hold things that aren't ours.
// So this never deletes recursively: if anything other than vault files is in
// there, nothing is deleted at all and the user is told why. Only the app's own
// files are removed, followed by the (then empty) folder.
async function deleteBook(bookName) {
	var info = bookHandles[bookName];
	if (!info) return;

	var contents;
	try {
		contents = inspectBookFolder(info.path);
	} catch (err) {
		showToast('Error: ' + err.message);
		return;
	}

	if (contents.others.length) {
		var shown = contents.others.slice(0, 5).join(', ') + (contents.others.length > 5 ? ', \u2026' : '');
		await showConfirm(
			'Book Not Deleted',
			'Other files were found in this book, so it was not deleted.\n\nMove or remove them first, then try again:\n' + shown,
			'OK',
			{ hideCancel: true }
		);
		return;
	}

	var collCount = Object.keys(info.collections || {}).length;

	// Build confirmation message based on state
	var msg = 'Delete book "' + bookName + '"';
	if (info.isEncrypted && !info.isUnlocked) {
		msg += '?\n\nThis book is locked. All its data will be permanently deleted.';
	} else {
		msg += ' (' + collCount + ' collection' + (collCount !== 1 ? 's' : '') + ')?\n\nThis cannot be undone.';
	}

	var confirmed = await showConfirm('Delete Book', msg);
	if (!confirmed) return;

	try {
		// Remove our own files, then the folder itself (fails safely if it isn't empty)
		contents.removable.forEach(function (name) {
			window.vault.deleteFile(window.vault.joinPath(info.path, name));
		});
		window.vault.rmdir(info.path);

		// Remove from memory
		delete bookHandles[bookName];

		// Remove button from UI
		var btn = findByData(booksList, 'book', bookName);
		if (btn) btn.remove();

		// Update counts
		if (isMultiBookMode) 
		{
			var remaining = Object.keys(bookHandles).length;
			setBooksPanelCount(remaining);
			statusTxt.textContent = remaining + ' password book' + (remaining !== 1 ? 's' : '') + ' found';
		} 
		else 
		{
			resetVaultState();
		}

		// Reset UI if deleted book was active
		if (activeBookName === bookName) {
			activeBookName = null;
			activeBookHandle = null;
			collections = {};
			vaultKey = null;
			isEncryptedVault = false;
			activeFile = null;

			collList.innerHTML = '';

			leftHint.style.display = '';
			rightPanel.style.display = 'none';
			rightEmpty.style.display = '';

			newCollBtn.classList.add('hidden');
			collSectionName.textContent = 'Select a book above';
			setSelectedBookLabel(null);
			setCollSectionCount(0, null);
		}

		showToast('"' + bookName + '" deleted');
	} catch (err) {
		showToast('Error: ' + err.message);
	}
}

// Rename a book folder and update all references
async function doRenameBook(oldName, newName) {
	var info = bookHandles[oldName];

	// Direct filesystem rename
	var basePath = isMultiBookMode
		? _electronVaultPath
		: info.path.substring(0, Math.max(info.path.lastIndexOf('/'), info.path.lastIndexOf('\\')));
	var newPath = window.vault.joinPath(basePath, newName);

	window.vault.rename(info.path, newPath);

	if (!isMultiBookMode) 
	{
		_electronVaultPath = newPath;
	}

	bookHandles[newName] = info;
	bookHandles[newName].path = newPath;
	delete bookHandles[oldName];

	// Update UI button and rebind events
	var btn = findByData(booksList, 'book', oldName);
	if (btn) {
		btn.dataset.book = newName;

		var nameEl = btn.querySelector('.book-name');
		if (nameEl) nameEl.textContent = newName;

		var metaEl = btn.querySelector('.book-meta');
		if (metaEl && metaEl.id) metaEl.id = 'book-meta-' + newName;

		// Clone node to reset all event listeners cleanly
		var newBtn = btn.cloneNode(true);
		btn.parentNode.replaceChild(newBtn, btn);

		// Reattach events
		newBtn.addEventListener('click', (function (n, b) { return function () { selectBook(n, b); }; })(newName, newBtn));
		
		var eb = newBtn.querySelector('.edit-book-btn');
		var db = newBtn.querySelector('.delete-book-btn');
		var rb = newBtn.querySelector('.book-relock-btn');
		
		if (eb) { eb.replaceWith(eb.cloneNode(true)); newBtn.querySelector('.edit-book-btn').addEventListener('click', (function (n) { return function (e) { e.stopPropagation(); openEditBookModal(n); }; })(newName)); }
		if (db) { db.replaceWith(db.cloneNode(true)); newBtn.querySelector('.delete-book-btn').addEventListener('click', (function (n) { return function (e) { e.stopPropagation(); deleteBook(n); }; })(newName)); }
		if (rb) { rb.replaceWith(rb.cloneNode(true)); newBtn.querySelector('.book-relock-btn').addEventListener('click', (function (n) { return function (e) { e.stopPropagation(); relockBook(n); }; })(newName)); }
	}

	// Update active book name if needed
	if (activeBookName === oldName) {
		activeBookName = newName;
		setSelectedBookLabel(newName);
		setCollSectionCount(Object.keys(collections).length, newName);
	}
	editingBookName = newName;
}

// Change password for an encrypted book
async function doChangeBookPassword(bookName, newPassword) {
	var info  = bookHandles[bookName];

	if (!isMultiBookMode) 
	{
        info.collections = collections;
    }

	// Repack encrypted data with new password
	var bytes = await packEncrypted({ collections: info.collections }, newPassword);
	var salt = bytes.slice(0, 16);
	var newKey = await deriveKey(newPassword, salt);

	// No .bak is made here (that copy would still open with the old password)
	await namedBookWriteBin(bookName, 'vault.enc', bytes);
	await verifyEncryptedBook(bookName, newKey, info.collections);

	// Any earlier backup is protected by the OLD password, so it has to go
	namedBookRemoveBackup(bookName);

	// Store the new key and salt
	info.key = newKey;
	info.salt = salt;
}

// Encrypt a plain book into vault.enc
async function doEncryptBook(bookName, password) {
	var info = bookHandles[bookName];

	if (!isMultiBookMode) {
        info.collections = collections;
    }

	// Ensure data is loaded
	if (!info.isUnlocked) await loadPlainBook(bookName);

	// Encrypt collections
	var bytes = await packEncrypted({ collections: info.collections }, password);
	var salt = bytes.slice(0, 16);
	var newKey = await deriveKey(password, salt);
	await namedBookWriteBin(bookName, 'vault.enc', bytes);

	// Prove the encrypted copy opens and matches BEFORE the plaintext originals
	// are touched. If it doesn't, remove the bad file and leave everything as it was.
	try {
		await verifyEncryptedBook(bookName, newKey, info.collections);
	} catch (err) {
		try { namedBookDeleteFile(bookName, 'vault.enc'); } catch (_) { /* nothing to clean up */ }
		throw new Error(err.message + ' Your original files were not changed.');
	}

	// Delete all plaintext files for security
	var toDelete = (await namedBookListFiles(bookName))
		.filter(function (e) { return e.isFile && e.name.toLowerCase().endsWith('.txt'); })
		.map(function (e) { return e.name; });
	for (var fname of toDelete) {
		await namedBookDeleteFile(bookName, fname);
	}

	// Update State
	info.key = newKey;
	info.salt = salt;
	info.isEncrypted = true;
	info.isUnlocked = true;

	// Update UI
	var cnt = Object.keys(info.collections).length;

	var btn = findByData(booksList, 'book', bookName);
	if (btn) {
		var meta = btn.querySelector('.book-meta');
		if (meta) meta.textContent = cnt + ' collection' + (cnt !== 1 ? 's' : '') + ' \xb7 encrypted';
		injectRelockBtn(bookName);
	}

	// Sync active state
	if (activeBookName === bookName || !isMultiBookMode) 
	{
		isEncryptedVault = true;
		vaultKey = info.key;
	}
	showToast('"' + bookName + '" encrypted');
}

// Decrypt a book back to plaintext files
async function doDecryptBook() {
	var info = bookHandles[editingBookName];

	// Write each collection back to .txt. files
	for (var filename in info.collections) {
		await namedBookWriteFile(editingBookName, filename, buildFileText(info.collections[filename]));
	}

	// Remove encrypted vault file and its backup (both hold the data under the old password)
	await namedBookDeleteFile(editingBookName, 'vault.enc');
	namedBookRemoveBackup(editingBookName);

	// Update State
	info.isEncrypted = false;
	info.key = null;
	info.salt = null;

	// Update UI
	var btn = findByData(booksList, 'book', editingBookName);
	if (btn) {
		var lk = btn.querySelector('.book-lock');
		if (lk) lk.remove();

		var rb = btn.querySelector('.book-relock-btn');
		if (rb) rb.remove();

		var meta = btn.querySelector('.book-meta');
		var cnt  = Object.keys(info.collections).length;

		if (meta) meta.textContent = cnt + ' collection' + (cnt !== 1 ? 's' : '') + ' \xb7 plain text';
	}

	// Sync active state
	if (activeBookName === editingBookName || !isMultiBookMode) 
	{
		isEncryptedVault = false;
		vaultKey = null;
	}

	if (!isMultiBookMode)
	{
		info.isUnlocked  = true;
		info.isEncrypted = false;
		var results = Object.keys(collections).sort().map(function (k) {
			return { name: k, entries: collections[k] };
		});
		buildSidebar(results);
	}

	showToast('"' + editingBookName + '" decrypted');

	// Close Modal Edit
	editBookOverlay.classList.remove('open');
}

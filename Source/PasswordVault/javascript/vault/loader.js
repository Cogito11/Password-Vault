// ═══════════════════════════════
// VAULT / LOADER
// Handles opening, scanning, and loading vault folders (Electron only).
// Supports:
// - Single-book vaults (one folder of .txt files)
// - Multi-book vaults (subfolders = separate vaults)
// ═══════════════════════════════


// Auto-load Default folder on start up 
// Runs once when the app starts. 
// PURPOSE:
// - Check if the user has a saved "default vault folder"
// - If yes then automatically load it
// - If not then show "resume banner" prompting user action
async function tryAutoLoadDefault() {

	// Prevent running multiple times
	if (_autoLoadDone) return;
	_autoLoadDone = true;

	// Ask Electron (main process) for stored default path
	var storedPath = await window.electronAPI.getDefaultPath();

	if (storedPath) 
	{
		// Extract just the folder name from full path
		var folderName = storedPath.split(/[\/\\]/).filter(Boolean).pop() || storedPath;
		
		// Update UI to show current default
		updateDefaultUI(folderName);

		// Show loading status
		statusTxt.textContent = 'Loading default folder…';

		// Load vault contents from disk
		await loadFromElectronPath(storedPath);
	} 
	else 
	{
		// If no default set then show banner prompting user to choose/create one
		document.getElementById('resumeBanner').classList.add('visible');
	}
}

// Plain-text folder load 
// Loads a SINGLE vault folder that contains plain `.txt` files.
// FLOW:
// 1. Scan folder via Electron
// 2. Parse each .txt file
// 3. Store results in `collections`
// 4. Build sidebar UI
async function loadPlainFolder() {
    isEncryptedVault = false;
    vaultKey = null;

    // readVaultFiles returns the array directly, not { txtFiles: [...] }
    var txtFiles = await window.electronAPI.readVaultFiles(_electronVaultPath);

    var results = (txtFiles || []).map(function (f) {
        return { name: f.name, entries: parseFile(f.text) };
    });

    results.sort(function (a, b) { return a.name.localeCompare(b.name); });

    collections = {};
    collList.innerHTML = '';
    leftHint.style.display = 'none';

    results.forEach(function (r) { collections[r.name] = r.entries; });

    buildSidebar(results);
}

// Electron path-mode load 
// CORE LOADER FUNCTION 
// Loads a vault from a filesystem path using Electron (Node fs).
// Determines if Multi-book vault (subfolders), Single-book vault (flat .txt files) or Empty vault
async function loadFromElectronPath(vaultPath) {
	try {

		// Ask Electron to scan folder structure + contents
		var data = await window.electronAPI.scanVaultStructure(vaultPath);

		// If folder missing or unreadable
		if (!data) 
		{
			statusTxt.textContent = 'Default folder not found: ' + vaultPath;
			document.getElementById('resumeBanner').classList.add('visible');
			return;
		}

		// Save/display folder name
		saveDefaultName(data.name);
		updateDefaultUI(data.name);

		// MULTI-BOOK MODE
		if (data.subBooks && data.subBooks.length > 0) 
		{
			// Multi-book mode
			_electronVaultPath = vaultPath;
			isMultiBookMode = true;
			isElectronPathMode = true;
			// unused in Electron, kept for compatibility
			dirHandle = null;
			bookHandles = {};

			// Convert scan results into internal structure
			var subBooks = data.subBooks.map(function (b) {
				return { 
					name: b.name, 
					path: b.path, 
					isEncrypted: b.isEncrypted
				};
			});

			// Initialize each "book"
			subBooks.forEach(function (b) {
				bookHandles[b.name] = {
					handle: null,
					path: b.path,
					isEncrypted: b.isEncrypted,
					isUnlocked: false,
					key: null,
					collections: {}
				};
			});

			// Render multi-book UI
			enterMultiBookMode(subBooks);

		// Single Book Mode
		} 
		else if (data.subBooks.length === 0 && data.hasTxt && data.hasTxt.length > 0) 
		{
			
			_electronVaultPath = vaultPath;
			isElectronPathMode = true;
			isMultiBookMode = false;
			isEncryptedVault = false;
			dirHandle = null;

			bookHandles = {};
			bookHandles[data.name] = {
				handle: null,
				path: vaultPath,
				key: null,
				collections: {}
			};

			// Parse all files
			var txtFiles = await window.electronAPI.readVaultFiles(vaultPath);

			var results = txtFiles.map(function (f) {
				return { name: f.name, entries: parseFile(f.text) };
			});

			results.sort(function (a, b) { 
				return a.name.localeCompare(b.name); 
			});

			// Store collections
			collections = {};
			results.forEach(function (r) { 
				collections[r.name] = r.entries; 
			});

			// Build UI
			buildSidebar(results);

			// Show eject button
			ejectBtn.classList.add('visible');

			// Update UI label
			bookNameEl.textContent = data.name;

		// Single Encrypted Book
		} 
		else if (data.subBooks.length === 0 && data.hasEnc) 
		{

			_electronVaultPath = vaultPath;
			isElectronPathMode = true;
			isMultiBookMode = false;
			isEncryptedVault = true;
			dirHandle = null;

			bookHandles = {};
			bookHandles[data.name] = {
				handle: null,
				path: vaultPath,
				isEncrypted: true,
				isUnlocked: false,
				key: null,
				collections: {}
			};

			// Store the vault name so vaultName() works
			saveDefaultName(data.name);

			// Show the book in the sidebar - collections load after unlock
			bookNameEl.textContent = data.name;
			booksPanel.classList.add('visible');
			booksList.innerHTML = '';
			addBookBtn(data.name, true);
			dot.classList.add('on');
			ejectBtn.classList.add('visible');
			statusTxt.textContent = 'Encrypted book — unlock to load collections';
			leftHint.style.display = '';

		// Empty Vault
		} 
		else 
		{

			// No files or books, treat as empty multi-book container
			_electronVaultPath = vaultPath;
			isElectronPathMode = true;
			isMultiBookMode = true;
			dirHandle = null;
			bookHandles = {};

			enterMultiBookMode([]);
		}
	} catch (err) {
		statusTxt.textContent = 'Could not load default folder: ' + err.message;
	}
}

// Plain book load 
// Loads a SINGLE book inside a multi-book vault.
// Only used for NON-encrypted books.
async function loadPlainBook(bookName) {
	var info = bookHandles[bookName];

	// Read files on demand via IPC — no sync fs blocking
	var txtFiles = await window.electronAPI.readBookFiles(info.path);

	var results = txtFiles.map(function (f) {
		return { name: f.name, entries: parseFile(f.text) };
	});

	results.sort(function (a, b) { return a.name.localeCompare(b.name); });

	info.collections = {};
	results.forEach(function (r) {
		info.collections[r.name] = r.entries;
	});

  	info.isUnlocked = true;

  	var meta = document.getElementById('book-meta-' + bookName);
  	if (meta) 
	{
		meta.textContent =
		results.length + ' collection' +
		(results.length !== 1 ? 's' : '') +
		' \xb7 plain text';
  	}
}

// Vault folder re-scan
// Re-scans the vault folder to detect: New books added and Removed books
// IMPORTANT: Preserves unlock state of already-open books.
async function rescanVaultFolder() {

	var subBooks = [];

	// Re-scan folder using Electron
	var data = await window.electronAPI.scanVaultStructure(_electronVaultPath);

	if (data) 
	{
		data.subBooks.forEach(function (b) {
			subBooks.push({
				name: b.name,
				path: b.path,
				handle: null,
				isEncrypted: b.isEncrypted
			});
		});
	}

	// Preserve existing unlock state
	var oldHandles = bookHandles;
	bookHandles = {};

	subBooks.forEach(function (b) {

		var existing = oldHandles[b.name];

		// Reuse existing state if present
		bookHandles[b.name] = existing || {
			handle: null,
			path: b.path,
			isEncrypted: b.isEncrypted,
			isUnlocked: false,
			key: null,
			collections: {}
		};
	});

	// Rebuild UI list
	booksList.innerHTML = '';

	subBooks.sort(function (a, b) {
		return a.name.localeCompare(b.name);
	});

	subBooks.forEach(function (b) {
		addBookBtn(b.name, bookHandles[b.name].isEncrypted);

		// If already unlocked, re-add relock button
		if (bookHandles[b.name].isUnlocked) {
			injectRelockBtn(b.name);
		}
	});

	// Update UI counters
	var total = subBooks.length;

	booksPanelCount.textContent =
		total + ' book' + (total !== 1 ? 's' : '');

	statusTxt.textContent =
		total + ' password book' +
		(total !== 1 ? 's' : '') +
		' found';
}

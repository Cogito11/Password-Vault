// MODALS / BOOK-CREATE - new password book modal
// Handles name entry, location picking, optional encryption, and creation.

// Show/Hide toggle for password fields
wirePwToggle(bookPw);
wirePwToggle(bookPwConfirm);

// Open

newBookBtn.addEventListener('click', async function () {
	var defaultSettings = getAppSettings();
	bookNameInput.value = '';
	bookLocationDisp.value = '';
	bookLocationDisp.classList.remove('chosen');
	encryptToggle.checked = defaultSettings.defaultBookEncrypted;
	encryptFields.classList.toggle('show', defaultSettings.defaultBookEncrypted);
	bookPw.value = '';
	bookPwConfirm.value = '';
	pwStrBar.style.width   = '0';
	pwStrLabel.textContent = '';
	saveBookBtn.disabled = true;
	chosenParentPath = null;

	// Pre-fill location from the default vault folder if one is set
	var defPath = await window.electronAPI.getDefaultPath();

	if (defPath) 
	{
		chosenParentPath = defPath;
		bookLocationDisp.value = defPath.split(/[\/\\]/).filter(Boolean).pop() || defPath;
		bookLocationDisp.classList.add('chosen');
		bookModalInfo.textContent = 'Default location pre-selected \u2014 change it or enter a name.';
		saveBookBtn.disabled = false;
	} 
	else 
	{
		bookModalInfo.textContent = 'Choose a name and location.';
	}

	bookModalOverlay.classList.add('open');
	setTimeout(function () { window.focus(); bookNameInput.focus(); }, 100);
});

// Close handlers

bookModalClose.addEventListener('click', function () { bookModalOverlay.classList.remove('open'); });
bookModalOverlay.addEventListener('click', function (e) {
	if (e.target === bookModalOverlay) bookModalOverlay.classList.remove('open');
});

// Keyboard shortcuts

bookNameInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); saveBookBtn.click(); } });
bookPw.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); saveBookBtn.click(); } });
bookPwConfirm.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); saveBookBtn.click(); } });

// Location picker

pickLocationBtn.addEventListener('click', async function () {
	var p = await window.vault.openFolder();
	if (!p) return;

	chosenParentPath = p;
	bookLocationDisp.value = p.split(/[\/\\]/).filter(Boolean).pop() || p;
	bookLocationDisp.classList.add('chosen');
	validateBookForm();
});

// Encrypt toggle and strength meter

encryptToggle.addEventListener('change', function () {
	encryptFields.classList.toggle('show', this.checked);
	validateBookForm();
});

bookNameInput.addEventListener('input', validateBookForm);
bookPwConfirm.addEventListener('input', validateBookForm);

bookPw.addEventListener('input', function () {
	var pw = this.value, s = 0;
	if (pw.length >= 8) s++;
	if (pw.length >= 14) s++;
	if (/[A-Z]/.test(pw)) s++;
	if (/[0-9]/.test(pw)) s++;

	if (/[^A-Za-z0-9]/.test(pw)) s++;
	var pcts   = [0, 18, 36, 58, 80, 100];
	var colors = ['var(--text-dim)', '#e05555', '#e8a230', '#a8c84a', '#52c07a', '#52c07a'];
	var labels = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Very strong'];
	pwStrBar.style.width = pcts[s] + '%';
	pwStrBar.style.background = colors[s];
	pwStrLabel.textContent = labels[s];
	validateBookForm();
});

// True if anything in parentPath already has this name, ignoring case. Windows and
// macOS treat "Work" and "work" as the same folder, and this also catches folders
// that were added outside the app after it scanned the vault.
function bookNameTaken(parentPath, name) {
	var key = nameKey(name);

	try {
		return window.vault.readDir(parentPath).some(function (e) { return nameKey(e.name) === key; });
	} catch (_) {
		return false;
	}
}

function validateBookForm() {
	var typed = bookNameInput.value.trim();
	if (!typed) 
	{ 
		saveBookBtn.disabled = true; 
		bookModalInfo.textContent = 'Enter a name for the book.'; 
		return; 
	}

	var san = sanitizeName(typed);
	if (san.error)
	{
		saveBookBtn.disabled = true;
		bookModalInfo.textContent = san.error;
		return;
	}

	// If characters will be dropped, say what the book will really be called
	var nameNote = san.changed ? 'Will be created as "' + san.name + '". ' : '';

	if (!chosenParentPath) 
	{ 
		saveBookBtn.disabled = true; 
		bookModalInfo.textContent = 'Choose where to create the book.'; 
		return; 
	}

	if (bookNameTaken(chosenParentPath, san.name))
	{
		saveBookBtn.disabled = true;
		bookModalInfo.textContent = 'A book named "' + san.name + '" already exists in that location.';
		return;
	}

	if (encryptToggle.checked) 
	{
		var pw = bookPw.value, pc = bookPwConfirm.value;
		if (!pw)
		{ 
			saveBookBtn.disabled = true; 
			bookModalInfo.textContent = 'Enter an encryption password.'; 
			return; 
		}

		if (pw.length < 6) 
		{ 
			saveBookBtn.disabled = true; 
			bookModalInfo.textContent = 'Password too short (min 6 chars).'; 
			return; 
		}

		if (pw !== pc) 
		{ 
			saveBookBtn.disabled = true; 
			bookModalInfo.textContent = pc ? 'Passwords do not match.' : 'Confirm your password.'; 
			return; 
		}

		bookModalInfo.textContent = nameNote + 'AES-256-GCM encrypted \u2014 one binary file, no readable text on disk.';
	} 
	else 
	{
		bookModalInfo.textContent = nameNote + 'Plain book \u2014 collections stored as .txt files inside the folder.';
	}

	saveBookBtn.disabled = false;
}

// Create

saveBookBtn.addEventListener('click', async function () {
	var san = sanitizeName(bookNameInput.value);
	var name = san.name;

	if (san.error || !chosenParentPath) return;

	saveBookBtn.disabled = true;
	saveBookBtn.textContent = 'Creating\u2026';

	var bookDirPath = null;
	var createdDir = false;

	try {
		// Checked again here (not just while typing) in case the folder appeared since
		if (bookNameTaken(chosenParentPath, name))
			throw new Error('A book named "' + name + '" already exists in that location.');

		bookDirPath = window.vault.joinPath(chosenParentPath, name);
		window.vault.mkdir(bookDirPath); // not recursive: fails if the folder exists
		createdDir = true;

		var defaultCollFilename = 'Password_Collection.txt';
		var defaultCollEntries = [];

		if (encryptToggle.checked) 
		{
			var initCollections = {};
			initCollections[defaultCollFilename] = defaultCollEntries;
			var bytes = await packEncrypted({ collections: initCollections }, bookPw.value);

			window.vault.writeFileBin(window.vault.joinPath(bookDirPath, 'vault.enc'), bytes, { exclusive: true });
			showToast('"' + name + '" created \u2014 encrypted');
		} 
		else 
		{
			window.vault.writeFile(window.vault.joinPath(bookDirPath, defaultCollFilename), buildFileText(defaultCollEntries), { exclusive: true });
			showToast('"' + name + '" created');
		}

		if (isMultiBookMode) await rescanVaultFolder();

		bookModalOverlay.classList.remove('open');
		saveBookBtn.textContent = 'Create Book';
		
	} catch (e) {
		// Don't leave an empty folder behind if creating the files failed (rmdir only removes empty folders)
		if (createdDir) { try { window.vault.rmdir(bookDirPath); } catch (_) { /* not empty or already gone */ } }

		bookModalInfo.textContent = (e && e.code === 'EEXIST')
			? 'A book named "' + name + '" already exists in that location.'
			: 'Error: ' + e.message;
		bookModalInfo.style.color = '#e05555';
		setTimeout(function () { window.focus(); bookModalInfo.style.color = ''; }, 3000);
		saveBookBtn.disabled = false;
		saveBookBtn.textContent = 'Create Book';
	}
});

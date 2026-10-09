// MODALS / RENAME - rename a password collection

// Close handlers

renameCollClose.addEventListener('click', function () { renameCollOverlay.classList.remove('open'); });
renameCollOverlay.addEventListener('click', function (e) {
	if (e.target === renameCollOverlay) renameCollOverlay.classList.remove('open');
});

renameCollInput.addEventListener('keydown', function (e) {
	if (e.key === 'Enter') renameCollSaveBtn.click();
});

// Open

// Open the rename modal pre-filled with the current collection name.
function openRenameCollModal(filename) {
	renamingFile = filename;
	renameCollInput.value = filename.replace(/\.txt$/i, '');
	renameCollInfo.textContent = '';
	renameCollSaveBtn.disabled = false;
	renameCollSaveBtn.textContent = 'Rename';
	renameCollOverlay.classList.add('open');

	setTimeout(function () { window.focus(); renameCollInput.focus(); renameCollInput.select(); }, 100);
}

// Save

renameCollSaveBtn.addEventListener('click', async function () {
	if (!renameCollInput.value.trim()) return;

	var san = sanitizeName(renameCollInput.value);
	if (san.error) 
	{
		renameCollInfo.textContent = san.error; 
		return; 
	}

	var newName = san.name;
	var newFilename = newName + '.txt';
	if (newFilename === renamingFile) 
	{ 
		renameCollOverlay.classList.remove('open'); 
		return; 
	}
	
	// Case-insensitive, but the collection being renamed doesn't clash with itself,
	// so changing only its capitalisation (Banking -> banking) is allowed
	if (collectionNameTaken(newFilename, renamingFile)) 
	{ 
		renameCollInfo.textContent = 'A collection named "' + newName + '" already exists.'; 
		return; 
	}

	renameCollSaveBtn.disabled = true;
	renameCollSaveBtn.textContent = 'Renaming\u2026';

	var entries = collections[renamingFile];

	try {
		if (bookIsEncrypted()) 
		{
			// Optimistic update - roll back on failure 
			collections[newFilename] = entries;
			delete collections[renamingFile];
			if (isMultiBookMode && activeBookName) bookHandles[activeBookName].collections = collections;
			
			try {
				await reEncryptVault();
			} catch (e) {
				delete collections[newFilename];
				collections[renamingFile] = entries;
				if (isMultiBookMode && activeBookName) bookHandles[activeBookName].collections = collections;
				throw e;
			}
		
		} 
		else 
		{
			// A real rename, not write + delete: for a case-only change on Windows/macOS
			// the "new" and "old" names are the same file, so deleting the old one
			// after writing the new one would erase the collection.
			bookRenameFile(renamingFile, newFilename);
			collections[newFilename] = entries;
			delete collections[renamingFile];
		}

		// Rewire the sidebar button by cloning it 
		var sideBtn = findByData(collList, 'file', renamingFile);
		
		if (sideBtn) 
		{
			var clone = sideBtn.cloneNode(true);
			sideBtn.parentNode.replaceChild(clone, sideBtn);
			clone.dataset.file = newFilename;
			clone.querySelector('.coll-name').textContent = newName;

			clone.addEventListener('click', (function (fn, b) {
				return function () { openCollection(fn, b); };
			})(newFilename, clone));

			var renameBtn2 = clone.querySelector('.rename-coll-btn');
			var deleteBtn2 = clone.querySelector('.delete-coll-btn');

			if (renameBtn2) 
			{
				renameBtn2.replaceWith(renameBtn2.cloneNode(true));
				clone.querySelector('.rename-coll-btn').addEventListener('click', (function (fn) {
					return function (e) { e.stopPropagation(); openRenameCollModal(fn); };
				})(newFilename));
			}
			
			if (deleteBtn2) 
			{
				deleteBtn2.replaceWith(deleteBtn2.cloneNode(true));
				clone.querySelector('.delete-coll-btn').addEventListener('click', (function (fn) {
					return function (e) { e.stopPropagation(); deleteCollection(fn); };
				})(newFilename));
			}
		}

		// Update panel title if this was the active collection
		if (activeFile === renamingFile) 
		{
			activeFile = newFilename;
			panelTitle.textContent = newName;
		}

		renameCollOverlay.classList.remove('open');
		showToast('Renamed to "' + newName + '"');

	} catch (err) {
		renameCollInfo.textContent = 'Error: ' + err.message;
		renameCollInfo.style.color = '#e05555';
		setTimeout(function () { window.focus(); renameCollInfo.style.color = ''; }, 3000);
	}

	renameCollSaveBtn.disabled = false;
	renameCollSaveBtn.textContent = 'Rename';
});

// Live feedback while typing (the same rules are enforced again on save)
renameCollInput.addEventListener('input', function () {
	var typed = renameCollInput.value.trim();

	if (!typed) { renameCollInfo.textContent = ''; return; }

	var san = sanitizeName(typed);

	if (san.error) renameCollInfo.textContent = san.error;
	else if (collectionNameTaken(san.name + '.txt', renamingFile)) renameCollInfo.textContent = 'A collection named "' + san.name + '" already exists.';
	else if (san.changed) renameCollInfo.textContent = 'Will be renamed to "' + san.name + '".';
	else renameCollInfo.textContent = '';
});

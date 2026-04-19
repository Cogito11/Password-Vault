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
	var rawName = renameCollInput.value.trim();
	if (!rawName) return;

	var newName = rawName.replace(/[^a-zA-Z0-9 _\-]/g, '').trim().replace(/\s+/g, '_');
	if (!newName) 
	{
		renameCollInfo.textContent = 'Invalid name.'; 
		return; 
	}

	var newFilename = newName + '.txt';
	if (newFilename === renamingFile) 
	{ 
		renameCollOverlay.classList.remove('open'); 
		return; 
	}
	
	if (collections[newFilename]) 
	{ 
		renameCollInfo.textContent = 'A collection with that name already exists.'; 
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
			await bookWriteFile(newFilename, buildFileText(entries));
			await bookDeleteFile(renamingFile);
			collections[newFilename] = entries;
			delete collections[renamingFile];
		}

		// Rewire the sidebar button by cloning it 
		var sideBtn = collList.querySelector('[data-file="' + renamingFile + '"]');
		
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

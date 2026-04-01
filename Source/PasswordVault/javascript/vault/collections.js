// ═══════════════════════════════
// VAULT / COLLECTIONS
// Handles opening and deleting password collections (files)
// ═══════════════════════════════

// Activate the synthetic "All Passwords" view.
// PURPOSE:
// - Combine entries from ALL collections into one list
// - Disable "new entry" (since this is not a real file)
function openAllCollections(btn) {

	// Remove active state from all sidebar buttons
	document.querySelectorAll('.coll-btn').forEach(function (b) { b.classList.remove('active'); });
	
	// Mark this button as active
	btn.classList.add('active');

	// Special identifier meaning "aggregate view"
	activeFile = '__all__';

	// Combine all entries from all collections into one array
	// Wrap each entry with its home collection + true index so
	// renderPasswords can wire up edit/delete without activeFile
	var allEntries = [];
	Object.keys(collections).forEach(function (k) {
		collections[k].forEach(function (e, i) {
			allEntries.push(Object.assign({}, e, {
				_homeCollection : k,
				_trueIdx        : i
			}));
		});
	});

	// Update UI
	panelTitle.textContent = 'All Passwords';
	panelCount.textContent = allEntries.length + ' entries';

	// Reset search field
	searchInput.value = '';

	// Hide new entry button since all isnt a specific collection
	newEntryBtn.classList.remove('visible');

	// Show right panel (Hide empty state)
	rightEmpty.style.display = 'none';
	rightPanel.style.display = 'flex';

	// Render combined entries
	renderPasswords();
}


// Open a single collection (file) and display its entries.
// @param {string} filename - The collection file name (Ex: "School Passwords.txt")
// @param {HTMLElement} btn - The sidebar button clicked
function openCollection(filename, btn) {

	// Clear active state from all buttons
	document.querySelectorAll('.coll-btn').forEach(function (b) { b.classList.remove('active'); });
	
	// Highlight selected buttons
	btn.classList.add('active');

	// Set active file (used globally)
	activeFile = filename;

	// Get entries for this collection
	var entries = collections[filename];

	// Saftey check
	if (!entries) { 
		showToast('Collection not found'); 
		return; 
	}

	// Update UI title by removing txt extension
	panelTitle.textContent = filename.replace(/\.txt$/i, '');

	// Show number of entries
	panelCount.textContent = entries.length + ' entries';

	// Reset search input
	searchInput.value = '';

	// Show new entry button as its valid for real collections
	newEntryBtn.classList.add('visible');

	// Show main panel
	rightEmpty.style.display = 'none';
	rightPanel.style.display = 'flex';

	// Render entries in UI
	renderPasswords();
}

// Delete a collection (file) permanently. 
// FLOW:
// 1. Ask user for confirmation
// 2. Remove from memory
// 3. Persist deletion (encrypted or plain)
// 4. Update UI (sidebar, counts, panels)
async function deleteCollection(filename) {

	// Remove txt extension
	var displayName = filename.replace(/\.txt$/i, '');

	// Count the entries in this collection
	var count = (collections[filename] || []).length;

	// Show confirmation dialog
	var confirmed = await showConfirm(
		'Delete Collection',
		'Delete "' + displayName + '" (' + count + ' entr' + (count === 1 ? 'y' : 'ies') + ')?\n\nThis cannot be undone.'
	);

	// Abort if the user cancels
	if (!confirmed) return;

	try {
		// Handle Deletion
		if (bookIsEncrypted()) {

			// Save backup incase re-encrption fails
			var deleted = collections[filename];

			// Remove from memory
			delete collections[filename];

			// Sync to active book if in multi book mode
			if (isMultiBookMode && activeBookName) {
				bookHandles[activeBookName].collections = collections;
			}

			try {
				// Re-encrypt entire vault 
				await reEncryptVault();
			} catch (e) {
				// Rollback if the encryption failed
				collections[filename] = deleted;

				if (isMultiBookMode && activeBookName) {
					bookHandles[activeBookName].collections = collections;
				}

				// Throw error
				throw e;
			}

		} else {

			// Plain text mode, delete file directly
			await bookDeleteFile(filename);

			// Remove from memory
			delete collections[filename];
		}

		// UI Updates

		// Remove collection button from sidebar
		var sideBtn = collList.querySelector('[data-file="' + filename + '"]');
		if (sideBtn) sideBtn.remove();

		// Update all passwords total count
		var allBtnEl = collList.querySelector('.all-btn');
		if (allBtnEl) {
			var total = Object.keys(collections).reduce(function (s, k) { return s + collections[k].length; }, 0);
			allBtnEl.querySelector('.coll-n').textContent = total + ' passwords total';
		}

		// Update book meta data
		if (isMultiBookMode && activeBookName) {
			var bookMeta = document.getElementById('book-meta-' + activeBookName);
			
			if (bookMeta) {
				var cnt = Object.keys(collections).length;

				bookMeta.textContent = cnt + ' collection' + (cnt !== 1 ? 's' : '') + (bookIsEncrypted() ? ' \xb7 encrypted' : ' \xb7 plain text');
			}
		}

		// If deleted collection was currently open + reset UI
		if (activeFile === filename) {
			activeFile = null;

			// Hide main panel
			rightPanel.style.display = 'none';

			// Show empty state
			rightEmpty.style.display = '';

			// Hide new entry button
			newEntryBtn.classList.remove('visible');
		}

		// Success feedback
		showToast('"' + displayName + '" deleted');

	} catch (err) {

		// Error feedback
		showToast('Error: ' + err.message);
	}
}

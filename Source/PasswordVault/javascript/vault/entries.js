// ═══════════════════════════════
// VAULT / ENTRIES - append staged entries to an existing collection
// ═══════════════════════════════ 

// Saves all entries currently staged in `modalEntryList` into the active collection (activeFile).
// FLOW:
// 1. Validate state
// 2. Merge new entries with existing ones
// 3. Persist to disk (encrypted or plain)
// 4. Update UI (sidebar counts, main panel)
// 5. Close modal + show feedback
async function saveNewEntries() {

	// Guard clause: do nothing if
	// - no entries staged
	// - no active file selected
	// - or viewing "__all__" (not a real file)
	if (!modalEntryList.length || !activeFile || activeFile === '__all__') return;

	try {
		// Get current entries for this collection file
		var existing = collections[activeFile] || [];

		// Merge existing + new entries
		// This does NOT merge duplicates, duplicates are allowed
		var combined = existing.concat(modalEntryList);

		// Update in-memory state
		collections[activeFile] = combined;
		
		// If in multi-book mode, sync this collection back into the active book
		if (isMultiBookMode && activeBookName) {
			bookHandles[activeBookName].collections = collections;
		}

		// Persist changes to disk
		if (bookIsEncrypted()) {
			// Re-encrypt entire vault (since encrypted files are stored as one enc file)
			await reEncryptVault();
		} else {
			// Write updated plain-text file
			await bookWriteFile(activeFile, buildFileText(combined));
		}

		// UI Updates

		// Update sidebar count for this specific collection
		var sideBtn = collList.querySelector('[data-file="' + activeFile + '"]');
		
		if (sideBtn) {
			sideBtn.querySelector('.coll-n').textContent = combined.length + ' password' + (combined.length !== 1 ? 's' : '');
		}

		// Update "All" collections total count
		var allBtnEl = collList.querySelector('.all-btn');
		
		if (allBtnEl) {
			// Sum all entries across all collections
			var total = Object.keys(collections).reduce(function (s, k) { return s + collections[k].length; }, 0);
			allBtnEl.querySelector('.coll-n').textContent = total + ' passwords total';
		}

		// Close the modal after saving
		closeModal();

		// Show success feedback
		showToast(modalEntryList.length + ' entr' + (modalEntryList.length === 1 ? 'y' : 'ies') + ' added');
		
		// Update main panel entry count
		panelCount.textContent = combined.length + ' entries';
		
		// Re-render visible entries in UI
		renderPasswords(combined);

	} catch (err) {

		// Show error message inside modal
		modalInfo.textContent = 'Error: ' + err.message;

		// Temporarily highlight error in red
		modalInfo.style.color = '#e05555';
		
		// Reset color after 3 seconds
		setTimeout(function () { modalInfo.style.color = ''; }, 3000);
	}
}

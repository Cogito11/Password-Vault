// ═══════════════════════════════
// APP - top-level event wiring
// Connects toolbar controls, search, eject, lock/unlock, and startup.
// All heavy logic lives in the module folders, this file only wires them up.
// ═══════════════════════════════

// Toggle the droptown menu when clicking the arrow
openBtnArrow.addEventListener('click', function (e) {
	// Prevent document click from immediately closing it
	e.stopPropagation();

	var isOpen = openBtnMenu.classList.contains('open');

	if (isOpen) {
		// Close if already open
		closeOpenMenu();
	} else {
		// Show dropdown and visually rotate arrow if currently closed
		openBtnMenu.classList.add('open');
		openBtnArrow.classList.add('open');
	}
});

// Close dropdown if clicking anywhere outside the button wrapper
document.addEventListener('click', function (e) {
	if (!document.getElementById('openBtnWrap').contains(e.target)) closeOpenMenu();
});

// Clicking the dropdown open folder button triggers the same thing as the main open folder button
menuOpenFolder.addEventListener('click', function () {
	closeOpenMenu();
	openFolderBtn.click();
});

// Set default location event listener
menuSetDefault.addEventListener('click', async function () {
	closeOpenMenu();

	// Electron path based flow
	if (window.vault && window.vault.openFolder) {
		var chosenPath = await window.vault.openFolder();
		if (!chosenPath) return;

		await window.electronAPI.setDefaultPath(chosenPath);

		// Extract the folder name from path
		var folderName = chosenPath.split(/[\/\\]/).filter(Boolean).pop() || chosenPath;

		saveDefaultName(folderName);
		updateDefaultUI(folderName);
		showToast('Default location set to "' + folderName + '"');
		return;
	}
});

// Load Default folder click event listener
menuLoadDefault.addEventListener('click', async function () {
	closeOpenMenu();

	// Electron based load
	if (window.electronAPI && window.electronAPI.getDefaultPath) {
		// Get the stored default path from storage
		var storedPath = await window.electronAPI.getDefaultPath();
		// If there is no default folder then print a message
		if (!storedPath) { 
			showToast('No default folder set'); return; 
		}
		statusTxt.textContent = 'Loading default folder\u2026';
		await loadFromElectronPath(storedPath);
		return;
	}
});

// Clear default path
menuClearDefault.addEventListener('click', async function () {
	closeOpenMenu();

	// Clear the stored default path from local storage
	if (window.electronAPI && window.electronAPI.setDefaultPath) {
		await window.electronAPI.setDefaultPath(null);
	}

	clearDefaultName();
	updateDefaultUI(null);
	showToast('Default location cleared');
});

// Open folder button
openFolderBtn.addEventListener('click', async function () {
	var chosenPath = await window.vault.openFolder();
	if (!chosenPath) return;

	resetVaultState();
	await loadFromElectronPath(chosenPath);
});

// Eject Folder Button Listener
ejectBtn.addEventListener('click', resetVaultState);

// Single book Lock/Unlock Vault button
lockVaultBtn.addEventListener('click', function () {
	// Lock
	if (!singleBookLocked) {
		vaultKey = null;
		collections = {};
		activeFile = null;
		singleBookLocked = true;

		// Reset UI
		collList.innerHTML = '';
		leftHint.style.display  = '';
		rightPanel.style.display = 'none';
		rightEmpty.style.display = '';
		newCollBtn.classList.add('hidden');

		lockVaultBtnLabel.textContent = 'Unlock Vault';
		lockVaultBtn.title = 'Unlock this vault';

		bookNameEl.textContent = vaultName() + ' \uD83D\uDD12';
		statusTxt.textContent  = vaultName() + ' locked';

		showToast(vaultName() + ' locked');

	} else {
		// Unlock
		openVaultUnlockModal(null);
	}
});

// Search input event listener
searchInput.addEventListener('input', function () {
	if (!activeFile) return;

	var q = searchInput.value.toLowerCase();
	var source;

	// If viewing all collections
	if (activeFile === '__all__') {
		source = [];
		Object.keys(collections).forEach(function (k) {
			collections[k].forEach(function (e) { source.push(e); });
		});
	} else {
		source = collections[activeFile];
	}

	// Filter entries by name or attributes
	var filtered = source.filter(function (e) {
		return e.name.toLowerCase().includes(q) || e.attrs.some(function (a) {
			return a.key.toLowerCase().includes(q) || a.val.toLowerCase().includes(q);
		});
	});

	renderPasswords(filtered);
});

// Resume Banner, now used to create default folder
document.getElementById('resumeBanner').addEventListener('click', async function (e) {

	if (e.target === document.getElementById('resumeBannerDismiss')) return;
	
	document.getElementById('resumeBanner').classList.remove('visible');

	if (window.electronAPI && window.electronAPI.createDefaultVault) {
		try {
			var vaultPath = await window.electronAPI.createDefaultVault();
			statusTxt.textContent = 'Loading default folder\u2026';
			await loadFromElectronPath(vaultPath);
			showToast('Default folder ready: ' + vaultPath.split(/[\/\\]/).pop());
		} catch (err) {
			showToast('Could not create folder: ' + err.message);
		}
		return;
	}
});

// Dismiss resume/quickstart banner
document.getElementById('resumeBannerDismiss').addEventListener('click', function (e) {
	e.stopPropagation();
	_pendingDefaultHandle = null;
	document.getElementById('resumeBanner').classList.remove('visible');
});

// Electron focus recovery
// After native OS dialogs the renderer loses keyboard focus.
// Re-acquire it on any mousedown inside a modal overlay.
document.querySelectorAll('.modal-overlay').forEach(function (overlay) {
	overlay.addEventListener('mousedown', function () { window.focus(); });
});

// Global Fallback: If any modal is open, force focus on click
document.addEventListener('mousedown', function () {
	if (document.querySelector('.modal-overlay.open')) window.focus();
}, true);

// Startup auto-load, try loading default folder when app starts
document.addEventListener('DOMContentLoaded', tryAutoLoadDefault);

// If DOM already loaded (Edge Case), run immediately
if (document.readyState !== 'loading') {
	setTimeout(tryAutoLoadDefault, 0);
} 
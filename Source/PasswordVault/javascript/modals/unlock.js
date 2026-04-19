// MODALS / UNLOCK - vault unlock modal
// Handles both single-book and multi-book unlock flows.

// Open the vault-unlock modal, pre-filling the book name label.
function openVaultUnlockModal(bookName) {
	// bookName is null in single-book mode
	vaultUnlockBookName.textContent = (bookName !== null) ? bookName : vaultName();

	vaultUnlockPw.value = '';
	vaultUnlockError.style.display = 'none';
	vaultUnlockBtn.disabled = false;
	vaultUnlockBtn.textContent = 'Unlock';
	vaultUnlockInfo.textContent = '';
	vaultUnlockOverlay.classList.add('open');

	setTimeout(function () { window.focus(); vaultUnlockPw.focus(); }, 100);
}

// Close handlers

vaultUnlockClose.addEventListener('click', function () {
	vaultUnlockOverlay.classList.remove('open');

	if (!isMultiBookMode) dirHandle = null;
	unlockingBookName = null;
});

vaultUnlockOverlay.addEventListener('click', function (e) {
	if (e.target !== vaultUnlockOverlay) return;

	vaultUnlockOverlay.classList.remove('open');

	if (!isMultiBookMode) dirHandle = null;
	unlockingBookName = null;
});

vaultUnlockPw.addEventListener('keydown', function (e) {
	if (e.key === 'Enter') vaultUnlockBtn.click();
});

// Unlock attempt

vaultUnlockBtn.addEventListener('click', async function () {
	var pw = vaultUnlockPw.value;
	if (!pw) return;

	vaultUnlockBtn.disabled = true;
	vaultUnlockBtn.textContent = 'Unlocking\u2026';
	vaultUnlockError.style.display = 'none';

	try {
		// Read vault.enc - supports Web FS API and Electron path mode
		var buf;

		if (isElectronPathMode) 
		{
			var encPath = isMultiBookMode
				? window.vault.joinPath(bookHandles[unlockingBookName].path, 'vault.enc')
				: window.vault.joinPath(_electronVaultPath, 'vault.enc');

			buf = new Uint8Array(window.vault.readFileBin(encPath));
		} 
		else 
		{
			var targetHandle = isMultiBookMode ? bookHandles[unlockingBookName].handle : dirHandle;
			var fh = await targetHandle.getFileHandle('vault.enc');
			buf = new Uint8Array(await (await fh.getFile()).arrayBuffer());
		}

		var salt = buf.slice(0, 16);
		var iv = buf.slice(16, 28);
		var ct = buf.slice(28);
		var key = await deriveKey(pw, salt);
		var pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, ct);
		var payload = JSON.parse(new TextDecoder().decode(pt));

		vaultUnlockOverlay.classList.remove('open');

		if (isMultiBookMode) 
		{
			var info = bookHandles[unlockingBookName];
			info.key = key;
			info.collections = payload.collections || {};
			info.isUnlocked = true;

			var meta = document.getElementById('book-meta-' + unlockingBookName);
			if (meta) 
			{
				var cnt = Object.keys(info.collections).length;
				meta.textContent = cnt + ' collection' + (cnt !== 1 ? 's' : '') + ' \xb7 encrypted';
			}

			var bookBtn = booksList.querySelector('[data-book="' + unlockingBookName + '"]');
			if (bookBtn) 
			{
				var lk = bookBtn.querySelector('.book-lock');
				if (lk) lk.remove();
			}

			injectRelockBtn(unlockingBookName);
			activateBook(unlockingBookName, bookBtn);
			showToast(unlockingBookName + ' unlocked');
			unlockingBookName = null;

		} 
		else 
		{
			// Single-book mode
			vaultKey = key;
			isEncryptedVault = true;
			collections = payload.collections || {};

			var results = Object.keys(collections).sort().map(function (k) {
				return { name: k, entries: collections[k] };
			});

			buildSidebar(results);
			singleBookLocked = false;
			showToast(vaultName() + ' unlocked');
		}
		
	} catch (_) {
		vaultUnlockError.style.display = 'block';
		vaultUnlockBtn.disabled = false;
		vaultUnlockBtn.textContent = 'Unlock';
	}
});

// MODALS / SETTINGS - app preferences and defaults
// Settings render inline in the main viewport (in place of the password list)
// rather than in a modal. Navigating to a book or collection closes them.
// Every change is saved as soon as it's made, there is no Save button.

(function () {
	var settingsBtn = document.getElementById('settingsBtn');
	var settingsView = document.getElementById('settingsView');
	var colRight = settingsView ? settingsView.parentElement : null;
	var settingsClose = document.getElementById('settingsClose');
	var settingsSaved = document.getElementById('settingsSaved');
	var settingsCharsHint = document.getElementById('settingsCharsHint');
	var settingsVersion = document.getElementById('settingsVersion');
	var settingsLengthInput = document.getElementById('settingsLengthInput');
	var settingsLengthValue = document.getElementById('settingsLengthValue');
	var settingsUpper = document.getElementById('settingsUpper');
	var settingsLower = document.getElementById('settingsLower');
	var settingsNumbers = document.getElementById('settingsNumbers');
	var settingsSymbols = document.getElementById('settingsSymbols');
	var settingsBookEncrypt = document.getElementById('settingsBookEncrypt');
	var settingsThemeSelect = document.getElementById('settingsThemeSelect');
	var settingsAutoLock = document.getElementById('settingsAutoLock');
	var settingsAutoLockMinutes = document.getElementById('settingsAutoLockMinutes');
	var settingsAutoLockMinutesValue = document.getElementById('settingsAutoLockMinutesValue');
	var settingsAutoLockMinutesRow = document.getElementById('settingsAutoLockMinutesRow');
	var settingsLockOnSystem = document.getElementById('settingsLockOnSystem');
	var settingsClipClear = document.getElementById('settingsClipClear');
	var settingsClipSeconds = document.getElementById('settingsClipSeconds');
	var settingsClipSecondsValue = document.getElementById('settingsClipSecondsValue');
	var settingsClipSecondsRow = document.getElementById('settingsClipSecondsRow');
	var updateBtn = document.getElementById('settingsUpdateBtn');
	var updateLabel = document.getElementById('settingsUpdateLabel');
	var updateDownload = document.getElementById('settingsUpdateDownload');
	var updateDownloadLabel = document.getElementById('settingsUpdateDownloadLabel');
	var updateInstall = document.getElementById('settingsUpdateInstall');
	var updateInstallLabel = document.getElementById('settingsUpdateInstallLabel');
	var updateHint = document.getElementById('settingsUpdateHint');
	var restoreActiveBtn = null; // sidebar button that was highlighted before settings opened
	var savedTimer = null;
	var charsHintTimer = null;

	var charTypeInputs = [settingsUpper, settingsLower, settingsNumbers, settingsSymbols];

	async function populateSettingsForm(settings) {
		settings = settings || getAppSettings();
		settingsLengthInput.value = settings.generatorLength;
		if (settingsLengthValue) settingsLengthValue.textContent = settings.generatorLength;
		settingsUpper.checked = settings.generatorUpper;
		settingsLower.checked = settings.generatorLower;
		settingsNumbers.checked = settings.generatorNumbers;
		settingsSymbols.checked = settings.generatorSymbols;
		settingsBookEncrypt.checked = settings.defaultBookEncrypted;
		settingsThemeSelect.value = settings.theme || 'classic';
		applyAppTheme(settingsThemeSelect.value || 'classic');

		settingsAutoLock.checked = settings.autoLockEnabled;
		settingsAutoLockMinutes.value = settings.autoLockMinutes;
		settingsLockOnSystem.checked = settings.lockOnSystemLock;
		settingsClipClear.checked = settings.clearClipboardEnabled;
		settingsClipSeconds.value = settings.clearClipboardSeconds;
		syncSecurityRows();
		if (settingsVersion) {
			settingsVersion.textContent = 'Loading…';
			try {
				if (window.electronAPI && window.electronAPI.getAppVersion) {
					settingsVersion.textContent = await window.electronAPI.getAppVersion();
				} else {
					settingsVersion.textContent = 'unknown';
				}
			} catch (err) {
				settingsVersion.textContent = 'unknown';
			}
		}
	}

	function collectSettingsFromForm() {
		return {
			generatorLength: Math.min(64, Math.max(4, parseInt(settingsLengthInput.value, 10) || 15)),
			generatorUpper: settingsUpper.checked,
			generatorLower: settingsLower.checked,
			generatorNumbers: settingsNumbers.checked,
			generatorSymbols: settingsSymbols.checked,
			defaultBookEncrypted: settingsBookEncrypt.checked,
			theme: settingsThemeSelect.value || 'classic',
			autoLockEnabled: settingsAutoLock.checked,
			autoLockMinutes: parseInt(settingsAutoLockMinutes.value, 10) || DEFAULT_APP_SETTINGS.autoLockMinutes,
			lockOnSystemLock: settingsLockOnSystem.checked,
			clearClipboardEnabled: settingsClipClear.checked,
			clearClipboardSeconds: parseInt(settingsClipSeconds.value, 10) || DEFAULT_APP_SETTINGS.clearClipboardSeconds
		};
	}

	// Slider values and the rows that only make sense when their switch is on
	function syncSecurityRows() {
		settingsAutoLockMinutesValue.textContent = settingsAutoLockMinutes.value + ' min';
		settingsClipSecondsValue.textContent = settingsClipSeconds.value + ' s';
		settingsAutoLockMinutesRow.hidden = !settingsAutoLock.checked;
		settingsClipSecondsRow.hidden = !settingsClipClear.checked;
	}

	// Brief "Saved" confirmation in the toolbar
	function flashSaved() {
		if (!settingsSaved) return;
		settingsSaved.classList.add('show');
		clearTimeout(savedTimer);
		savedTimer = setTimeout(function () { settingsSaved.classList.remove('show'); }, 1600);
	}

	// Save the whole form right away (called after every change)
	function persistSettings() {
		var settings = collectSettingsFromForm();
		applyAppTheme(settings.theme);
		saveAppSettings(settings);

		// Changing the auto-lock settings counts as activity: start the idle timer fresh
		if (typeof noteActivity === 'function') noteActivity();

		flashSaved();
	}

	// At least one character type must stay on or the generator has nothing to
	// work with. Instead of saving a broken state, put the box back and say why.
	function showCharsHint() {
		if (!settingsCharsHint) return;
		settingsCharsHint.hidden = false;
		clearTimeout(charsHintTimer);
		charsHintTimer = setTimeout(function () { settingsCharsHint.hidden = true; }, 2500);
	}

	function isSettingsOpen() {
		return !!(colRight && colRight.classList.contains('settings-open'));
	}

	async function openSettingsView() {
		if (!settingsView) return;

		// The sidebar is an overlay in narrow layouts, get it out of the way
		// (also when settings are already open, so tapping Settings again
		// simply dismisses the overlay)
		if (typeof closeSidebarOverlay === 'function') closeSidebarOverlay();

		if (isSettingsOpen()) return;

		await populateSettingsForm(getAppSettings());
		if (typeof populateCsvImportBookOptions === 'function') populateCsvImportBookOptions();
		syncing = syncUpdateState();

		// Only one thing should look selected in the sidebar: Settings
		restoreActiveBtn = document.querySelector('.coll-btn.active');
		if (restoreActiveBtn) restoreActiveBtn.classList.remove('active');
		if (settingsBtn) {
			settingsBtn.classList.add('active');
			settingsBtn.setAttribute('aria-pressed', 'true');
		}

		colRight.classList.add('settings-open');

		var scroller = settingsView.querySelector('.settings-scroll');
		if (scroller) scroller.scrollTop = 0;
	}

	function closeSettingsView() {
		if (!isSettingsOpen()) return;

		colRight.classList.remove('settings-open');

		if (settingsSaved) settingsSaved.classList.remove('show');
		if (settingsCharsHint) settingsCharsHint.hidden = true;

		if (settingsBtn) {
			settingsBtn.classList.remove('active');
			settingsBtn.setAttribute('aria-pressed', 'false');
		}

		// Put the sidebar highlight back (skipped if that button has since been
		// removed, e.g. the sidebar was rebuilt while settings were open)
		if (restoreActiveBtn && document.body.contains(restoreActiveBtn)) restoreActiveBtn.classList.add('active');
		restoreActiveBtn = null;
	}

	// Other modules call this when the user navigates to a book/collection
	window.closeSettingsView = closeSettingsView;

	function openExternalLink(url) {
		if (!url) return;
		if (window.electronAPI && window.electronAPI.openExternal) {
			window.electronAPI.openExternal(url);
			return;
		}
		window.open(url, '_blank', 'noopener,noreferrer');
	}

	document.addEventListener('click', function (e) {
		var link = e.target.closest && e.target.closest('[data-external-link]');
		if (!link) return;
		e.preventDefault();
		openExternalLink(link.getAttribute('data-external-link'));
	});

	if (settingsBtn) settingsBtn.addEventListener('click', openSettingsView);
	if (settingsClose) settingsClose.addEventListener('click', closeSettingsView);

	// Length: the number follows the slider while dragging, the value is saved
	// once on release (or after a keyboard adjustment) rather than on every tick.
	if (settingsLengthInput) {
		settingsLengthInput.addEventListener('input', function () {
			if (settingsLengthValue) settingsLengthValue.textContent = settingsLengthInput.value;
		});
		settingsLengthInput.addEventListener('change', persistSettings);
	}

	charTypeInputs.forEach(function (input) {
		if (!input) return;
		input.addEventListener('change', function () {
			var anyOn = charTypeInputs.some(function (i) { return i && i.checked; });
			if (!anyOn) {
				input.checked = true;
				showCharsHint();
				return;
			}
			if (settingsCharsHint) settingsCharsHint.hidden = true;
			persistSettings();
		});
	});

	if (settingsBookEncrypt) settingsBookEncrypt.addEventListener('change', persistSettings);

	// Security: switches save immediately; sliders update their label while dragging
	// and save once on release (like the password length slider)
	[settingsAutoLock, settingsLockOnSystem, settingsClipClear].forEach(function (el) {
		el.addEventListener('change', function () { syncSecurityRows(); persistSettings(); });
	});

	[settingsAutoLockMinutes, settingsClipSeconds].forEach(function (el) {
		el.addEventListener('input', syncSecurityRows);
		el.addEventListener('change', persistSettings);
	});
	if (settingsThemeSelect) settingsThemeSelect.addEventListener('change', persistSettings);

	// ── Check for update ──────────────────────────────────────────────
	// Two flows share this row, and neither does anything until the person clicks:
	//  - In-place: on installs that can update themselves, the main process does the work through
	//    window.vaultUpdater. Check for update, then Download, then Restart to update.
	//  - Website: on installs that can't (portable build, macOS, ...), check GitHub here and link
	//    to the download page.
	// What each state looks like lives in core/update-state.js (describeUpdateState).
	// States: idle | checking | current | available | downloading | downloaded | error

	var updater = window.vaultUpdater || null;
	var inPlaceState = null; // the main process's latest state, once we know this install can update itself
	var syncing = Promise.resolve(); // resolves once we know which of the two flows applies

	function setUpdateState(state) {
		var view = describeUpdateState(state);

		updateBtn.dataset.state = state.status;
		updateBtn.disabled = view.check.disabled;
		updateBtn.hidden = view.check.hidden;
		updateLabel.textContent = view.check.label;

		if (updateInstall) {
			updateInstall.hidden = view.install.hidden;
			updateInstallLabel.textContent = view.install.label;
		}

		updateDownload.hidden = view.website.hidden;
		updateDownloadLabel.textContent = view.website.label;
		updateHint.textContent = view.hint;
	}

	// Show whatever the main process reports
	function showInPlaceState(s) {
		inPlaceState = s;
		setUpdateState({
			status: s.status === 'unsupported' ? 'idle' : s.status,
			inPlace: true,
			version: s.version,
			current: s.currentVersion,
			percent: s.percent,
			message: s.error ? s.error.message : null,
			errorPhase: s.error ? s.error.phase : null
		});
	}

	// Runs each time Settings opens: ask the main process whether this install can update itself, and
	// pick up where it left off (an update may have finished downloading while Settings was closed).
	async function syncUpdateState() {
		inPlaceState = null;
		setUpdateState({ status: 'idle' });
		if (!updater) return;

		try {
			var s = await updater.getState();
			if (s && s.supported) showInPlaceState(s);
		} catch (err) { /* keep the website flow */ }
	}

	if (updater && typeof updater.onStateChange === 'function') {
		updater.onStateChange(function (s) {
			if (s && s.supported) showInPlaceState(s);
		});
	}

	async function getCurrentVersion() {
		try {
			if (window.electronAPI && window.electronAPI.getAppVersion) return await window.electronAPI.getAppVersion();
		} catch (err) { /* fall through */ }
		return null;
	}

	async function handleCheckForUpdate() {
		await syncing; // by now we know whether this install can update itself

		if (inPlaceState) {
			try {
				showInPlaceState(await updater.check());
			} catch (err) {
				setUpdateState({ status: 'error', inPlace: true, message: 'Couldn\'t check for updates right now.' });
			}
			return;
		}

		setUpdateState({ status: 'checking' });

		try {
			var current = await getCurrentVersion();

			// Without a known current version we can't tell if anything is newer
			if (!current || current === 'unknown') throw new Error('fetch-failed');

			var result = await checkForUpdate(current);

			setUpdateState(result.hasUpdate
				? { status: 'available', version: result.latestVersion }
				: { status: 'current', current: current });
		} catch (err) {
			setUpdateState({ status: 'error', reason: err && err.message });
		}
	}

	// The in-place button is "Download" first, then "Restart to update" once the download has finished
	async function handleInstallStep() {
		if (!inPlaceState) return;

		try {
			var s = inPlaceState.status === 'downloaded' ? await updater.install() : await updater.download();
			if (s) showInPlaceState(s);
		} catch (err) { /* the main process reports failures through its state */ }
	}

	if (updateBtn) updateBtn.addEventListener('click', handleCheckForUpdate);
	if (updateInstall) updateInstall.addEventListener('click', handleInstallStep);

})();

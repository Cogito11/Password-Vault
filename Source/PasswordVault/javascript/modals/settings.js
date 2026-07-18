// MODALS / SETTINGS - app preferences and defaults

(function () {
	var settingsBtn = document.getElementById('settingsBtn');
	var settingsOverlay = document.getElementById('settingsOverlay');
	var settingsClose = document.getElementById('settingsClose');
	var saveSettingsBtn = document.getElementById('saveSettingsBtn');
	var settingsInfo = document.getElementById('settingsInfo');
	var settingsVersion = document.getElementById('settingsVersion');
	var settingsLengthInput = document.getElementById('settingsLengthInput');
	var settingsLengthValue = document.getElementById('settingsLengthValue');
	var settingsUpper = document.getElementById('settingsUpper');
	var settingsLower = document.getElementById('settingsLower');
	var settingsNumbers = document.getElementById('settingsNumbers');
	var settingsSymbols = document.getElementById('settingsSymbols');
	var settingsBookEncrypt = document.getElementById('settingsBookEncrypt');
	var settingsThemeSelect = document.getElementById('settingsThemeSelect');
	var savedSettings;

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
		validateSettingsForm();
	}

	function validateSettingsForm() {
		var length = parseInt(settingsLengthInput.value, 10);
		if (!length || length < 4) length = 4;
		if (length > 64) length = 64;
		settingsLengthInput.value = length;
		if (settingsLengthValue) settingsLengthValue.textContent = length;

		var hasType = settingsUpper.checked || settingsLower.checked || settingsNumbers.checked || settingsSymbols.checked;
		saveSettingsBtn.disabled = !hasType;
		settingsInfo.textContent = hasType
			? 'Defaults will be used for future password generation and new books.'
			: 'Select at least one character type to enable password generation.';
	}

	function collectSettingsFromForm() {
		return {
			generatorLength: Math.min(64, Math.max(4, parseInt(settingsLengthInput.value, 10) || 15)),
			generatorUpper: settingsUpper.checked,
			generatorLower: settingsLower.checked,
			generatorNumbers: settingsNumbers.checked,
			generatorSymbols: settingsSymbols.checked,
			defaultBookEncrypted: settingsBookEncrypt.checked,
			theme: settingsThemeSelect.value || 'classic'
		};
	}

	async function openSettingsModal() {
		savedSettings = getAppSettings();
		await populateSettingsForm(savedSettings);
		settingsOverlay.classList.add('open');
		window.scrollTo(0, 0);
		var modalBody = settingsOverlay.querySelector('.modal-body');
		if (modalBody) modalBody.scrollTop = 0;
		setTimeout(function () {
			if (settingsLengthInput) {
				settingsLengthInput.focus({ preventScroll: true });
			}
		}, 80);
	}

	function closeSettingsModal() {
		// Theme changes are previewed immediately. Restore the saved preferences
		// whenever the modal is dismissed without saving.
		if (savedSettings) {
			applyAppTheme(savedSettings.theme);
			settingsLengthInput.value = savedSettings.generatorLength;
			if (settingsLengthValue) settingsLengthValue.textContent = savedSettings.generatorLength;
			settingsUpper.checked = savedSettings.generatorUpper;
			settingsLower.checked = savedSettings.generatorLower;
			settingsNumbers.checked = savedSettings.generatorNumbers;
			settingsSymbols.checked = savedSettings.generatorSymbols;
			settingsBookEncrypt.checked = savedSettings.defaultBookEncrypted;
			settingsThemeSelect.value = savedSettings.theme || 'classic';
		}
		settingsOverlay.classList.remove('open');
		settingsInfo.textContent = 'Adjust app defaults and future generation behavior.';
	}

	function openExternalLink(url) {
		if (!url) return;
		if (window.electronAPI && window.electronAPI.openExternal) {
			window.electronAPI.openExternal(url);
			return;
		}
		window.open(url, '_blank', 'noopener,noreferrer');
	}

	var settingsLinks = document.querySelectorAll('[data-external-link]');
	settingsLinks.forEach(function (link) {
		link.addEventListener('click', function (e) {
			e.preventDefault();
			openExternalLink(link.getAttribute('data-external-link'));
		});
	});

	if (settingsBtn) settingsBtn.addEventListener('click', openSettingsModal);
	if (settingsClose) settingsClose.addEventListener('click', closeSettingsModal);
	if (settingsOverlay) {
		settingsOverlay.addEventListener('click', function (e) {
			if (e.target === settingsOverlay) closeSettingsModal();
		});
	}

	if (settingsLengthInput) settingsLengthInput.addEventListener('input', validateSettingsForm);
	[settingsUpper, settingsLower, settingsNumbers, settingsSymbols, settingsBookEncrypt].forEach(function (input) {
		if (input) input.addEventListener('change', validateSettingsForm);
	});
	if (settingsThemeSelect) {
		settingsThemeSelect.addEventListener('change', function () {
			applyAppTheme(settingsThemeSelect.value || 'classic');
		});
	}

	if (saveSettingsBtn) {
		saveSettingsBtn.addEventListener('click', function () {
			var settings = collectSettingsFromForm();
			if (!settings.generatorUpper && !settings.generatorLower && !settings.generatorNumbers && !settings.generatorSymbols) {
				validateSettingsForm();
				return;
			}

			applyAppTheme(settings.theme);
			saveAppSettings(settings);
			savedSettings = settings;
			settingsInfo.textContent = 'Settings saved.';
			showToast('Settings saved');
			closeSettingsModal();
		});
	}

	document.addEventListener('keydown', function (e) {
		if (e.key === 'Escape' && settingsOverlay && settingsOverlay.classList.contains('open')) closeSettingsModal();
	});
})();

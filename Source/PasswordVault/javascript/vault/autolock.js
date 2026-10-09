// ═══════════════════════════════
// VAULT / AUTO-LOCK - lock encrypted books automatically
//
// Two optional triggers, both off by default (Settings > Security):
//   - Idle: no mouse or keyboard activity for N minutes
//   - System: the computer is locked or goes to sleep (reported by the main
//     process, which listens to the operating system)
//
// "Locking" is the same relockBook() the lock button uses: the key and the
// decrypted data are dropped, and anything decrypted that is still on screen
// is cleared (see clearDecryptedView in panel.js).
// ═══════════════════════════════

var AUTOLOCK_CHECK_MS = 5000; // how often the idle time is checked
var lastActivityAt = Date.now();

// Names of the encrypted books that are currently unlocked
function unlockedEncryptedBooks() {
	return Object.keys(bookHandles).filter(function (name) {
		var b = bookHandles[name];
		return b.isEncrypted && b.isUnlocked;
	});
}

// Locks every unlocked encrypted book and says so once. Returns how many were locked.
function lockAllBooks(reason) {
	var names = unlockedEncryptedBooks();
	if (!names.length) return 0;

	names.forEach(function (name) { relockBook(name, { silent: true }); });

	var because = reason === 'system' ? 'the computer was locked or went to sleep' : 'inactivity';
	showToast((names.length === 1 ? '"' + names[0] + '" was' : names.length + ' books were') + ' locked (' + because + ')');

	return names.length;
}

// Called whenever the user is active (and when the settings change)
function noteActivity() {
	lastActivityAt = Date.now();
}

function checkIdle() {
	var settings = getAppSettings();
	if (!settings.autoLockEnabled) return;

	// Comparing timestamps (instead of counting ticks) also means that after the
	// computer wakes from sleep, a long idle period is noticed straight away.
	if (Date.now() - lastActivityAt < settings.autoLockMinutes * 60000) return;

	lockAllBooks('idle');
}

['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart'].forEach(function (evt) {
	document.addEventListener(evt, noteActivity, { passive: true, capture: true });
});

setInterval(checkIdle, AUTOLOCK_CHECK_MS);

// The main process reports lock-screen / suspend events
if (window.electronAPI && typeof window.electronAPI.onSystemLock === 'function') {
	window.electronAPI.onSystemLock(function () {
		if (getAppSettings().lockOnSystemLock) lockAllBooks('system');
	});
}

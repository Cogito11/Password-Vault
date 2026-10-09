// ═══════════════════════════════
// DB - app preferences, kept in localStorage
// ═══════════════════════════════

// Early versions stored browser-style "directory handles" in an IndexedDB database
// so a folder picker could reopen in the same place. The app only uses real folder
// paths now, so that database is never read; remove it if it's still there.
try { indexedDB.deleteDatabase('pwvault_prefs'); } catch (_) { /* nothing to clean up */ }

// localStorage key for the default folder's display name
var LS_DEFAULT_NAME = 'pwvault_default_name';
var APP_SETTINGS_KEY = 'pwvault_app_settings';

var APP_THEMES = ['classic', 'aurora', 'ember', 'forest', 'midnight', 'manilla'];

// Allowed ranges for the numeric security settings (also used by the sliders)
var AUTOLOCK_MIN_MINUTES = 1;
var AUTOLOCK_MAX_MINUTES = 60;
var CLIPBOARD_MIN_SECONDS = 5;
var CLIPBOARD_MAX_SECONDS = 120;

var DEFAULT_APP_SETTINGS = {
	generatorLength: 15,
	generatorUpper: true,
	generatorLower: true,
	generatorNumbers: true,
	generatorSymbols: true,
	defaultBookEncrypted: false,
	theme: 'classic',

	// Security (all off by default)
	autoLockEnabled: false,
	autoLockMinutes: 5,
	lockOnSystemLock: false,
	clearClipboardEnabled: false,
	clearClipboardSeconds: 30
};

// Turns whatever was stored (possibly hand-edited, corrupted, or written by an
// older version) into a complete, valid settings object: wrong types and
// out-of-range numbers fall back to the default or are clamped, unknown keys are
// dropped, and the generator always keeps at least one character type on.
function normalizeAppSettings(raw) {
	var d = DEFAULT_APP_SETTINGS;
	var s = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};

	function bool(v, fallback) { return typeof v === 'boolean' ? v : fallback; }

	function int(v, min, max, fallback) {
		var usable = typeof v === 'number' || (typeof v === 'string' && v.trim() !== '');
		var n = usable ? Math.round(Number(v)) : NaN;
		if (!isFinite(n)) return fallback;
		return Math.min(max, Math.max(min, n));
	}

	var theme = typeof s.theme === 'string' ? s.theme.trim().toLowerCase() : '';

	var out = {
		generatorLength: int(s.generatorLength, 4, 64, d.generatorLength),
		generatorUpper: bool(s.generatorUpper, d.generatorUpper),
		generatorLower: bool(s.generatorLower, d.generatorLower),
		generatorNumbers: bool(s.generatorNumbers, d.generatorNumbers),
		generatorSymbols: bool(s.generatorSymbols, d.generatorSymbols),
		defaultBookEncrypted: bool(s.defaultBookEncrypted, d.defaultBookEncrypted),
		theme: APP_THEMES.indexOf(theme) !== -1 ? theme : d.theme,
		autoLockEnabled: bool(s.autoLockEnabled, d.autoLockEnabled),
		autoLockMinutes: int(s.autoLockMinutes, AUTOLOCK_MIN_MINUTES, AUTOLOCK_MAX_MINUTES, d.autoLockMinutes),
		lockOnSystemLock: bool(s.lockOnSystemLock, d.lockOnSystemLock),
		clearClipboardEnabled: bool(s.clearClipboardEnabled, d.clearClipboardEnabled),
		clearClipboardSeconds: int(s.clearClipboardSeconds, CLIPBOARD_MIN_SECONDS, CLIPBOARD_MAX_SECONDS, d.clearClipboardSeconds)
	};

	// A generator with every character type off has nothing to generate from
	if (!out.generatorUpper && !out.generatorLower && !out.generatorNumbers && !out.generatorSymbols) {
		out.generatorUpper = d.generatorUpper;
		out.generatorLower = d.generatorLower;
		out.generatorNumbers = d.generatorNumbers;
		out.generatorSymbols = d.generatorSymbols;
	}

	return out;
}

// All three helpers swallow errors - localStorage can be blocked by private-browsing
// policies, and a missing name is a cosmetic issue, not a functional one.
function saveDefaultName(name) { try { localStorage.setItem(LS_DEFAULT_NAME, name); } catch (_) {} }
function getDefaultName() { try { return localStorage.getItem(LS_DEFAULT_NAME); } catch (_) { return null; } }
function clearDefaultName() { try { localStorage.removeItem(LS_DEFAULT_NAME); } catch (_) {} }

function applyAppTheme(themeName) {
	var name = (themeName || 'classic').toString().trim().toLowerCase();
	if (!name) name = 'classic';
	if (typeof document !== 'undefined' && document.documentElement) {
		document.documentElement.setAttribute('data-theme', name);
	}
	if (typeof document !== 'undefined' && document.body) {
		document.body.setAttribute('data-theme', name);
	}
}

function initAppTheme() {
	applyAppTheme(getAppSettings().theme);
}

if (typeof document !== 'undefined') {
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', initAppTheme);
	} else {
		initAppTheme();
	}
}

function getAppSettings() {
	try {
		var raw = localStorage.getItem(APP_SETTINGS_KEY);
		if (!raw) return normalizeAppSettings({});
		return normalizeAppSettings(JSON.parse(raw));
	} catch (_) {
		return normalizeAppSettings({});
	}
}

function saveAppSettings(settings) {
	try {
		var merged = normalizeAppSettings(Object.assign({}, getAppSettings(), settings || {}));
		localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(merged));
	} catch (_) {}
}

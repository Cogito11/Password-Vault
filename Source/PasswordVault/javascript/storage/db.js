// ═══════════════════════════════
// DB - persist last-used / default directory handle in IndexedDB
// so showDirectoryPicker() can open in the same place next session.
// ═══════════════════════════════

// IndexedDB database and store names - kept as constants so any future
// rename only needs to change one place
var PICKER_DB_NAME = 'pwvault_prefs';
var PICKER_STORE_NAME = 'handles';

// Keys used to identify each record inside the object store
// The most recently opened directory
var PICKER_KEY = 'lastDir';
// The user-pinned default directory (survives "last" being overwritten)
var DEFAULT_KEY = 'defaultDir';

// Opens (or creates) the IndexedDB database at version 1.
// The onupgradeneeded handler runs on first visit to create the object store.
// Returns a Promise that resolves to the IDBDatabase instance.
function openPickerDB() {
	return new Promise(function (resolve, reject) {
		var req = indexedDB.open(PICKER_DB_NAME, 1);

		// First-time setup: create the key-value store (no keyPath - keys are supplied explicitly)
		req.onupgradeneeded = function (e) { e.target.result.createObjectStore(PICKER_STORE_NAME); };
		req.onsuccess = function (e) { resolve(e.target.result); };
		req.onerror   = function (e) { reject(e.target.error); };
	});
}

// Writes value under key in the object store.
// Failures are silently swallowed - a missing handle is recoverable (user re-picks the folder).
async function idbPut(key, value) {
	try {
		var db = await openPickerDB();
		var tx = db.transaction(PICKER_STORE_NAME, 'readwrite');
		tx.objectStore(PICKER_STORE_NAME).put(value, key);
		// No explicit tx.oncomplete wait - the browser commits automatically, we don't need the result
	} catch (_) {}
}

// Reads the value stored under key.
// Returns null if the key doesn't exist or if IndexedDB is unavailable.
async function idbGet(key) {
	try {
		var db = await openPickerDB();
		return await new Promise(function (resolve, reject) {
			var tx  = db.transaction(PICKER_STORE_NAME, 'readonly');
			var req = tx.objectStore(PICKER_STORE_NAME).get(key);
			// Coerce undefined to null for consistent callers
			req.onsuccess = function (e) { resolve(e.target.result || null); };
			req.onerror   = function (e) { reject(e.target.error); };
		});
		// IndexedDB blocked or unavailable - treat as a cache miss
	} catch (_) { return null; }
}

// Removes the record stored under key.
// Failures are silently swallowed - a missing record is a no-op anyway.
async function idbDelete(key) {
	try {
		var db = await openPickerDB();
		var tx = db.transaction(PICKER_STORE_NAME, 'readwrite');
		tx.objectStore(PICKER_STORE_NAME).delete(key);
	} catch (_) {}
}

// Public handle API 
// Thin wrappers around idbPut/idbGet/idbDelete that expose named operations
// instead of raw key strings, keeping call-sites readable.

// Overwrite the last-used handle on every successful open
function saveLastDirHandle(handle) { return idbPut(PICKER_KEY, handle); }
// Retrieve on startup to restore the picker's starting directory
function getLastDirHandle() { return idbGet(PICKER_KEY); }
// Persist the user-pinned default across sessions
function saveDefaultDirHandle(handle) { return idbPut(DEFAULT_KEY, handle); }
// Used at startup to auto-open the default vault without prompting
function getDefaultDirHandle() { return idbGet(DEFAULT_KEY); }
// Called when the user removes their pinned default
function clearDefaultDirHandle() { return idbDelete(DEFAULT_KEY); }

// localStorage fallback for directory name strings 
// FileSystemHandle objects cannot be serialised into IndexedDB in all Electron
// versions, but we can at least remember the folder *name* so the UI can show
// it even when the handle itself must be re-acquired via showDirectoryPicker().

// localStorage key for the default directory's display name
var LS_DEFAULT_NAME = 'pwvault_default_name';

// All three helpers swallow errors - localStorage can be blocked by private-browsing
// policies, and a missing name is a cosmetic issue, not a functional one.
function saveDefaultName(name) { try { localStorage.setItem(LS_DEFAULT_NAME, name); } catch (_) {} }
function getDefaultName() { try { return localStorage.getItem(LS_DEFAULT_NAME); } catch (_) { return null; } }
function clearDefaultName() { try { localStorage.removeItem(LS_DEFAULT_NAME); } catch (_) {} }

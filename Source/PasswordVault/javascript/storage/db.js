/* ═══════════════════════════════
   DB  —  persist last-used / default directory handle in IndexedDB
   so showDirectoryPicker() can open in the same place next session.
═══════════════════════════════ */

var PICKER_DB_NAME    = 'pwvault_prefs';
var PICKER_STORE_NAME = 'handles';
var PICKER_KEY        = 'lastDir';
var DEFAULT_KEY       = 'defaultDir';

function openPickerDB() {
  return new Promise(function (resolve, reject) {
    var req = indexedDB.open(PICKER_DB_NAME, 1);
    req.onupgradeneeded = function (e) { e.target.result.createObjectStore(PICKER_STORE_NAME); };
    req.onsuccess = function (e) { resolve(e.target.result); };
    req.onerror   = function (e) { reject(e.target.error); };
  });
}

async function idbPut(key, value) {
  try {
    var db = await openPickerDB();
    var tx = db.transaction(PICKER_STORE_NAME, 'readwrite');
    tx.objectStore(PICKER_STORE_NAME).put(value, key);
  } catch (_) {}
}

async function idbGet(key) {
  try {
    var db = await openPickerDB();
    return await new Promise(function (resolve, reject) {
      var tx  = db.transaction(PICKER_STORE_NAME, 'readonly');
      var req = tx.objectStore(PICKER_STORE_NAME).get(key);
      req.onsuccess = function (e) { resolve(e.target.result || null); };
      req.onerror   = function (e) { reject(e.target.error); };
    });
  } catch (_) { return null; }
}

async function idbDelete(key) {
  try {
    var db = await openPickerDB();
    var tx = db.transaction(PICKER_STORE_NAME, 'readwrite');
    tx.objectStore(PICKER_STORE_NAME).delete(key);
  } catch (_) {}
}

function saveLastDirHandle(handle)    { return idbPut(PICKER_KEY, handle); }
function getLastDirHandle()           { return idbGet(PICKER_KEY); }
function saveDefaultDirHandle(handle) { return idbPut(DEFAULT_KEY, handle); }
function getDefaultDirHandle()        { return idbGet(DEFAULT_KEY); }
function clearDefaultDirHandle()      { return idbDelete(DEFAULT_KEY); }

/* localStorage keys for the name strings — reliable in Electron even when
   FileSystemHandle serialization into IndexedDB is unavailable. */
var LS_DEFAULT_NAME = 'pwvault_default_name';

function saveDefaultName(name) { try { localStorage.setItem(LS_DEFAULT_NAME, name); } catch (_) {} }
function getDefaultName()      { try { return localStorage.getItem(LS_DEFAULT_NAME); } catch (_) { return null; } }
function clearDefaultName()    { try { localStorage.removeItem(LS_DEFAULT_NAME); } catch (_) {} }

// ═══════════════════════════════
// STATE - The single source of truth for all global variables
// Import order: this file must load before every other JS file.
// ═══════════════════════════════

// Vault / folder Values
var collections = {};
var activeFile = null;
var vaultKey = null; // CryptoKey when an encrypted vault is open
var isEncryptedVault = false;

// The vault folder is always opened by absolute path and read / written through
// the Node fs bridge (window.vault).
var _electronVaultPath = null;

// Multi book mode
var isMultiBookMode = false;
var bookHandles = {};   // bookName -> { path, isEncrypted, isUnlocked, key, salt, collections }
var activeBookName = null; // currently selected book name
var unlockingBookName = null; // book name currently pending unlock

// Startup / default folder
var _autoLoadDone = false;

// New collection / entry modal
var modalEntryList = []; // [{ name, attrs: [{ key, val }] }]
var entryModalMode = 'collection'; // 'collection' | 'entry'

// Edit entry modal
var editingIdx = -1;

// Rename collection modal
var renamingFile = null; // current filename (with .txt) being renamed

// Edit book modal
var editingBookName = null;

// New book modal
var chosenParentPath   = null; // folder the new book will be created in

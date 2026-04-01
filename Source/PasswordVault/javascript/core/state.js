// ═══════════════════════════════
// STATE - The single source of truth for all global variables
// Import order: this file must load before every other JS file.
// ═══════════════════════════════

// Vault / folder Values
var collections = {};
var activeFile = null;
var dirHandle = null;
var vaultKey = null; // CryptoKey when an encrypted vault is open
var isEncryptedVault = false;

// Electron path mode
// When the vault is loaded by absolute path (Node fs) instead of a
// FileSystemHandle, these flags are set and write operations use window.vault.
var isElectronPathMode = false;
var _electronVaultPath = null;

// Multi book mode
var isMultiBookMode = false;
var bookHandles = {};   // bookName -> { handle, path, isEncrypted, isUnlocked, key, collections }
var activeBookHandle = null; // currently selected book's directory handle
var activeBookName = null; // currently selected book name
var unlockingBookName = null; // book name currently pending unlock

// Startup / default folder
var _autoLoadDone = false;
var _pendingDefaultHandle = null; // held for the quickstart banner click

// Single book lock state 
var singleBookLocked = false;

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
var chosenParentHandle = null;
var chosenParentPath   = null; // Electron path mode alternative to chosenParentHandle

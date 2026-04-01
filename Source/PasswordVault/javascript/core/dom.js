// ═══════════════════════════════
// DOM - all getElementById references
// Import order: load after the HTML is parsed (bottom of <body> or DOMContentLoaded).
// ═══════════════════════════════

// Toolbar / open-folder split button
var openFolderBtn = document.getElementById('openFolderBtn');
var openBtnArrow = document.getElementById('openBtnArrow');
var openBtnMenu = document.getElementById('openBtnMenu');
var menuOpenFolder = document.getElementById('menuOpenFolder');
var menuSetDefault = document.getElementById('menuSetDefault');
var menuSetDefaultSub = document.getElementById('menuSetDefaultSub');
var menuClearDefault = document.getElementById('menuClearDefault');
var menuClearDivider = document.getElementById('menuClearDivider');
var menuLoadDefault = document.getElementById('menuLoadDefault');
var menuLoadDefaultSub = document.getElementById('menuLoadDefaultSub');

// Status bar
var dot = document.getElementById('dot');
var statusTxt = document.getElementById('statusTxt');
var toast = document.getElementById('toast');
var ejectBtn = document.getElementById('ejectBtn');
var lockVaultBtn = document.getElementById('lockVaultBtn');
var lockVaultBtnLabel = document.getElementById('lockVaultBtnLabel');

// Left panel - book / collection list
var colHeadLabel = document.getElementById('colHeadLabel');
var bookNameEl = document.getElementById('bookNameEl');
var booksPanel = document.getElementById('booksPanel');
var booksList = document.getElementById('booksList');
var booksPanelCount = document.getElementById('booksPanelCount');
var collSectionHead = document.getElementById('collSectionHead');
var collSectionName = document.getElementById('collSectionName');
var collList = document.getElementById('collList');
var leftHint = document.getElementById('leftHint');
var newBookBtn = document.getElementById('newBookBtn');
var newCollBtn = document.getElementById('newCollBtn');

// Right panel - password entries 
var rightEmpty = document.getElementById('rightEmpty');
var rightPanel = document.getElementById('rightPanel');
var panelTitle = document.getElementById('panelTitle');
var panelCount = document.getElementById('panelCount');
var pwList = document.getElementById('pwList');
var searchInput = document.getElementById('searchInput');
var newEntryBtn = document.getElementById('newEntryBtn');

// Modal: New Collection / Add Entry
var modalOverlay = document.getElementById('modalOverlay');
var modalClose = document.getElementById('modalClose');
var collNameInput = document.getElementById('collNameInput');
var entryCountLbl = document.getElementById('entryCountLabel');
var modalEntries = document.getElementById('modalEntries');
var entryNameInput = document.getElementById('entryNameInput');
var attrRows = document.getElementById('attrRows');
var addAttrBtn = document.getElementById('addAttrBtn');
var addEntryBtn = document.getElementById('addEntryBtn');
var saveCollBtn = document.getElementById('saveCollBtn');
var modalInfo = document.getElementById('modalInfo');

// Modal: Rename Collection 
var renameCollOverlay = document.getElementById('renameCollOverlay');
var renameCollClose = document.getElementById('renameCollClose');
var renameCollInput = document.getElementById('renameCollInput');
var renameCollInfo = document.getElementById('renameCollInfo');
var renameCollSaveBtn = document.getElementById('renameCollSaveBtn');

// Modal: Edit Entry
var editModalOverlay = document.getElementById('editModalOverlay');
var editModalClose = document.getElementById('editModalClose');
var editEntryName = document.getElementById('editEntryName');
var editAttrRows = document.getElementById('editAttrRows');
var editAddAttrBtn = document.getElementById('editAddAttrBtn');
var saveEditBtn = document.getElementById('saveEditBtn');
var editModalInfo = document.getElementById('editModalInfo');

// Modal: Edit Book 
var editBookOverlay = document.getElementById('editBookOverlay');
var editBookClose = document.getElementById('editBookClose');
var editBookBody = document.getElementById('editBookBody');
var editBookInfo = document.getElementById('editBookInfo');
var saveEditBookBtn = document.getElementById('saveEditBookBtn');

// Modal: Vault Unlock
var vaultUnlockOverlay = document.getElementById('vaultUnlockOverlay');
var vaultUnlockClose = document.getElementById('vaultUnlockClose');
var vaultUnlockBookName = document.getElementById('vaultUnlockBookName');
var vaultUnlockPw = document.getElementById('vaultUnlockPw');
var vaultUnlockBtn = document.getElementById('vaultUnlockBtn');
var vaultUnlockError = document.getElementById('vaultUnlockError');
var vaultUnlockInfo = document.getElementById('vaultUnlockInfo');

// Modal: New Password Book
var bookModalOverlay = document.getElementById('bookModalOverlay');
var bookModalClose = document.getElementById('bookModalClose');
var bookNameInput = document.getElementById('bookNameInput');
var bookLocationDisp = document.getElementById('bookLocationDisplay');
var pickLocationBtn = document.getElementById('pickLocationBtn');
var encryptToggle = document.getElementById('encryptToggle');
var encryptFields = document.getElementById('encryptFields');
var bookPw = document.getElementById('bookPw');
var bookPwConfirm = document.getElementById('bookPwConfirm');
var pwStrBar = document.getElementById('pwStrBar');
var pwStrLabel = document.getElementById('pwStrLabel');
var saveBookBtn = document.getElementById('saveBookBtn');
var bookModalInfo = document.getElementById('bookModalInfo');

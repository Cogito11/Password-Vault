// ═══════════════════════════════
// UI / SIDEBAR  —  left-panel rendering
// Handles:
// - Open-folder dropdown
// - Multi-book (vault folder) view
// - Collections (files) list
// ═══════════════════════════════


// Close the "Open Folder" dropdown menu.
// Removes the 'open' class from both:
// - The dropdown menu itself
// - The arrow icon (used for rotation styling)
function closeOpenMenu() {
	openBtnMenu.classList.remove('open');
	openBtnArrow.classList.remove('open');
}

// Multi-book panel
// Enter multi-book mode (a folder containing multiple vaults/books). 
// @param {Array} subBooks
// Each item: { name, isEncrypted }
// WHAT THIS DOES:
// - Switches UI into "vault folder" mode
// - Clears collection view
// - Populates list of books (folders)
function enterMultiBookMode(subBooks) {

	// Update header labels
	colHeadLabel.textContent = 'Vault Folder';
	bookNameEl.textContent   = vaultName();

	// Show books panel + section header
	booksPanel.classList.add('visible');
	collSectionHead.classList.add('visible');

	// Show number of books
	booksPanelCount.textContent = subBooks.length + ' book' + (subBooks.length !== 1 ? 's' : '');
	
	// Prompt user to select a book
	collSectionName.textContent = 'Select a book above';
	
	// Show hint/empty state
	leftHint.style.display = '';

	// Clear previous UI
	collList.innerHTML  = '';
	booksList.innerHTML = '';

	// Hide new collection button until a book is selected
	newCollBtn.classList.add('hidden');

	// Show eject button since you have something loaded
	ejectBtn.classList.add('visible');

	// Turn on status indicator dot
	dot.classList.add('on');

	// Update status text
	statusTxt.textContent = subBooks.length + ' password book' + (subBooks.length !== 1 ? 's' : '') + ' found';

	// Sort books alphabetically
	subBooks.sort(function (a, b) { return a.name.localeCompare(b.name); });
	
	// Render each book as a button
	subBooks.forEach(function (b) { addBookBtn(b.name, b.isEncrypted); });
}

// Create and append a book button to the sidebar.
// @param {string} bookName
// @param {boolean} isEncrypted 
// Each book row includes:
// - Icon
// - Name
// - Metadata (encrypted/plain)
// - Actions (edit, delete)
// - Optional lock icon
function addBookBtn(bookName, isEncrypted) {

	var btn = document.createElement('button');
	btn.className   = 'book-btn';
	btn.dataset.book = bookName;

	// Build Innner UI
	btn.innerHTML =
		'<div class="book-icon">' +
			'<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
				'<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>' +
			'</svg>' +
		'</div>' +

		// Book name and metadata
		'<span class="book-text">' +
			'<span class="book-name">' + esc(bookName) + '</span>' +
			'<span class="book-meta" id="book-meta-' + esc(bookName) + '">' + (isEncrypted ? 'Encrypted' : 'Plain Text') + '</span>' +
		'</span>' +

		// Action buttons (edit and delete)
		'<span class="book-actions">' +
			'<span role="button" tabindex="0" class="book-action-btn edit-book-btn" title="Edit book">' +
				'<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>' +
			'</span>' +
			'<span role="button" tabindex="0" class="book-action-btn del delete-book-btn" title="Delete book">' +
				'<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>' +
			'</span>' +
		'</span>' +

		// Lock icon if encrypted
		(isEncrypted
			? '<span class="book-lock"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span>'
			: '');


	// Event wiring
	
	// Clicking the row selects the book
	btn.addEventListener('click', function () { selectBook(bookName, btn); });
	
	// Edit button (stop propagation so it doesnt select the book)
	btn.querySelector('.edit-book-btn').addEventListener('click', function (e) { e.stopPropagation(); openEditBookModal(bookName); });
	
	// Delete button
	btn.querySelector('.delete-book-btn').addEventListener('click', function (e) { e.stopPropagation(); deleteBook(bookName); });
	
	// Add to DOM
	booksList.appendChild(btn);
}

// Inject a "relock" button into a book row after it is unlocked. 
// PURPOSE:
// - Allows user to manually lock an encrypted book again
// - Removes encryption key from memory
function injectRelockBtn(bookName) {

	var btn = booksList.querySelector('[data-book="' + bookName + '"]');
	
	// Skip if not found or already has relock button
	if (!btn || btn.querySelector('.book-relock-btn')) return;
	
	var rb = document.createElement('button');
	rb.className = 'book-relock-btn';
	
	rb.title = 'Lock this book \u2014 wipes the key from memory';
	
	// Lock icon
	rb.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
	
	// Prevent selecting the book when clicking relock
	rb.addEventListener('click', function (e) { e.stopPropagation(); relockBook(bookName); });
	btn.appendChild(rb);
}

// Build the collections sidebar (list of .txt files).
// @param {Array} results
// Each item: { name, entries }
// WHAT THIS DOES:
// - Clears sidebar
// - Adds "All Passwords" button
// - Adds divider
// - Adds each collection
// - Updates UI state
function buildSidebar(results) {

	// Clear existing UI
	collList.innerHTML = '';

	// Hide hint (we now have content)
	leftHint.style.display = 'none';

	// Compute total number of passwords
	var totalCount = results.reduce(function (s, r) { 
		return s + r.entries.length; 
	}, 0);

	// All Passwords Button
	var allBtn = document.createElement('button');
	allBtn.className   = 'coll-btn all-btn';
	allBtn.dataset.file = '__all__';

	allBtn.innerHTML =
		'<div class="coll-icon">' +
			'<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
				'<rect x="2" y="3" width="6" height="6" rx="1"/><rect x="9" y="3" width="6" height="6" rx="1"/><rect x="16" y="3" width="6" height="6" rx="1"/>' +
				'<rect x="2" y="12" width="6" height="6" rx="1"/><rect x="9" y="12" width="6" height="6" rx="1"/><rect x="16" y="12" width="6" height="6" rx="1"/>' +
			'</svg>' +
		'</div>' +
		'<span class="coll-text">' +
			'<span class="coll-name">All Passwords</span>' +
			'<span class="coll-n">' + totalCount + ' passwords total</span>' +
		'</span>';
	
	// Clicking opens aggregated view
	allBtn.addEventListener('click', function () { openAllCollections(allBtn); });
	
	collList.appendChild(allBtn);

	// Divider between "all" and actual collections
	var divEl = document.createElement('div');
	divEl.className = 'coll-divider';
	collList.appendChild(divEl);

	// Add each collection
	results.forEach(function (r) { 
		addCollBtn(r.name, r.entries.length); 
	});

	// Single book mode UI adjustments
	if (!isMultiBookMode) {

		// Turn on status indicator
		dot.classList.add('on');

		// Update status text
		statusTxt.textContent = results.length + ' password collection' + (results.length !== 1 ? 's' : '') + ' loaded' + (isEncryptedVault ? ' \xb7 encrypted' : '');
		
		// Show eject + new collection button
		ejectBtn.classList.add('visible');
		newCollBtn.classList.remove('hidden');
		
		// Update vault name (add lock if encrypted)
		bookNameEl.textContent = vaultName() + (isEncryptedVault ? ' \uD83D\uDD12' : '');
	}
}

// Add a single collection row to the sidebar.
// @param {string} filename (Ex: "passwords.txt")
// @param {number} count (number of entries)
function addCollBtn(filename, count) {

	// Remove .txt extension for display
	var name = filename.replace(/\.txt$/i, '');

	var btn  = document.createElement('button');
	btn.className    = 'coll-btn';
	btn.dataset.file = filename;

	btn.innerHTML =
		'<div class="coll-icon">' +
			'<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
				'<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>' +
			'</svg>' +
		'</div>' +

		// Name + Count
		'<span class="coll-text">' +
			'<span class="coll-name">' + esc(name) + '</span>' +
			'<span class="coll-n">' + count + ' password' + (count !== 1 ? 's' : '') + '</span>' +
		'</span>' +

		// Actions (Rename/Delete)
		'<span class="coll-actions">' +
			'<span role="button" tabindex="0" class="coll-action-btn rename-coll-btn" title="Rename collection">' +
				'<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>' +
			'</span>' +
			'<span role="button" tabindex="0" class="coll-action-btn del delete-coll-btn" title="Delete collection">' +
				'<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>' +
			'</span>' +
		'</span>';

	// Event Wiring

	// Open collection when clicking row
	btn.addEventListener('click', function () { openCollection(filename, btn); });
	
	// Rename action
	btn.querySelector('.rename-coll-btn').addEventListener('click', function (e) { e.stopPropagation(); openRenameCollModal(filename); });
	
	// Delete action
	btn.querySelector('.delete-coll-btn').addEventListener('click', function (e) { e.stopPropagation(); deleteCollection(filename); });
	
	// Add to DOM
	collList.appendChild(btn);
}

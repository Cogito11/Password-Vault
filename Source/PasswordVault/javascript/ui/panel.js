// ═══════════════════════════════
// UI / PANEL
// Handles:
// - Right-side panel (password entries display)
// - Vault state reset
// - Status / default UI helpers
// ═══════════════════════════════

// Update the "Default Location" UI in the open-folder dropdown.
// @param {string|null} name - Folder name (or null if none set)
// WHAT THIS DOES:
// - Shows/hides menu options based on whether a default exists
// - Updates labels so the user knows what the default is
function updateDefaultUI(name) {
	if (name) {
		// Show default name in set default
		menuSetDefaultSub.textContent  = name;

		// Show clear default option
		menuClearDefault.style.display = '';

		// Show divider between meny items
		menuClearDivider.style.display = '';

		// Show load default
		menuLoadDefault.style.display  = '';

		// Show name under load default
		menuLoadDefaultSub.textContent = name;
	} else {
		// No default set -> reset UI
		menuSetDefaultSub.textContent  = 'No default set';

		// Hide related actions
		menuClearDefault.style.display = 'none';
		menuClearDivider.style.display = 'none';
		menuLoadDefault.style.display  = 'none';

		menuLoadDefaultSub.textContent = '';
	}
}

// Reset ALL vault-related state back to "nothing loaded". 
// This is used when:
// - User clicks "Eject"
// - Opening a new folder
// - Clearing everything 
// WHAT THIS RESETS:
// - Data (collections, keys, handles)
// - UI (panels, lists, buttons)
// - Mode flags (multi-book, encryption...)
function resetVaultState() {

	// Core Data
	collections      = {};
	activeFile       = null;
	dirHandle        = null;
	vaultKey         = null;
	isEncryptedVault = false;

	// Mode Flags
	isMultiBookMode  = false;
	isElectronPathMode  = false;
	_electronVaultPath  = null;

	// Multi Book State
	bookHandles         = {};
	activeBookHandle    = null;
	activeBookName      = null;
	unlockingBookName   = null;

	// UI Reset

	// Clear sidebar collections
	collList.innerHTML  = '';

	// Show left hint
	leftHint.style.display  = '';

	// Hide right panel
	rightPanel.style.display = 'none';

	// Show empty right panel state
	rightEmpty.style.display = '';

	// Turn off status indicator
	dot.classList.remove('on');

	// Reset status text
	statusTxt.textContent = 'No folder loaded, awaiting input';

	// Hide eject button
	ejectBtn.classList.remove('visible');

	// Hide lock button
	lockVaultBtn.style.display = 'none';

	// Reset lock state
	singleBookLocked = false;

	// Hide new collection
	newCollBtn.classList.add('hidden');

	// Reset header labels
	bookNameEl.textContent = 'No book open';
	colHeadLabel.textContent = 'Password Book';

	// Hide multi book UI
	booksPanel.classList.remove('visible');
	collSectionHead.classList.remove('visible');

	// Clear book list
	booksList.innerHTML = '';
}

// Password card list

// Render a list of entries as UI cards in the right panel.
// @param {Array} entries
// Each entry:
//   {
//     name: string,
//     attrs: [{ key, val }]
//   }
// WHAT THIS DOES:
// - Clears current panel
// - Builds card UI for each entry
// - Masks sensitive values (passwords, tokens...)
// - Adds COPY / SHOW / EDIT / DELETE actions
function renderPasswords() {

	// Build the entries array based on current view
	var entries;
	if (activeFile === '__all__') {
		entries = [];
		Object.keys(collections).forEach(function (k) {
			collections[k].forEach(function (e, i) {
				entries.push(Object.assign({}, e, {
					_homeCollection: k,
					_trueIdx: i
				}));
			});
		});
	} else if (activeFile && collections[activeFile]) {
		entries = collections[activeFile];
	} else {
		entries = [];
	}

	// Update panel count
	panelCount.textContent = entries.length + ' entries';

	// Clear previous results
	pwList.innerHTML = '';

	// Empty state
	if (!entries.length) {
		pwList.innerHTML = '<div class="no-results">No entries found.</div>';
		return;
	}

	// Build each entry card
	entries.forEach(function (entry, idx) {

		// Avatar initials (first letter of name words)
		var words = entry.name.split(/\s+/);

		var init  = (words[0] ? words[0][0] : '') + (words[1] ? words[1][0] : '');
		
		init = init.toUpperCase() || '??';

		// Build attributes list
		var attrsHtml = entry.attrs.map(function (attr, ai) {
			var uid = 'f' + idx + '_' + ai;

			// Detect sesitive fields (passwords, tokens...)
			var isSecret = /pass(word)?|secret|pin|key|token/i.test(attr.key);
			
			var safeVal = esc(attr.val);

			// Mask sensitive values by default
			var valSpan = isSecret
				? '<span class="pw-attr-val masked" id="v_' + uid + '">\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022</span>'
				: '<span class="pw-attr-val" id="v_' + uid + '">' + safeVal + '</span>';

			// Add show button only for secrets
			var showBtn = isSecret
				? '<button class="act-btn" data-uid="' + uid + '" data-val="' + safeVal + '" onclick="toggleReveal(this)">SHOW</button>'
				: '';

			
			// Final attribute row
			return '<div class="pw-attr">' +
				'<span class="pw-attr-key">' + esc(attr.key) + '</span>' +
				valSpan +
				'<div class="pw-attr-actions">' + showBtn +
					'<button class="act-btn" data-val="' + safeVal + '" onclick="copyVal(this)">COPY</button>' +
				'</div></div>';
		}).join('');

		// Create card container
		var card = document.createElement('div');
		card.className = 'pw-card';

		var homeCollection, trueIdx, canMutate;

		if (activeFile && activeFile !== '__all__') {
			// Normal single-collection view
			homeCollection = activeFile;
			trueIdx        = collections[activeFile] ? collections[activeFile].indexOf(entry) : idx;
			canMutate      = true;
		} else if (entry._homeCollection != null && entry._trueIdx != null) {
			// All-passwords view — use stamps applied in openAllCollections
			homeCollection = entry._homeCollection;
			trueIdx        = entry._trueIdx;
			canMutate      = true;
		} else {
			canMutate = false;
		}
		
		card.innerHTML =
			'<div class="pw-card-head">' +
				// Avatar
				'<div class="pw-avatar">' + esc(init) + '</div>' +
				// Entry Name
				'<div class="pw-name" title="' + esc(entry.name) + '">' + esc(entry.name) + '</div>' +
				// Attribute Count Badge
				'<span class="pw-badge">' + entry.attrs.length + ' attribute(s)</span>' +
				
				// Edit/Delete buttons
				(canMutate
					? '<button class="act-btn card-edit-btn">EDIT</button>' +
						'<button class="act-btn card-del-btn" style="border-color:rgba(224,85,85,0.4);color:#e05555;background:rgba(224,85,85,0.06);">DELETE</button>'
					: '') +
			'</div>' +
			// Attributes List
			'<div class="pw-attrs">' +
				(attrsHtml || '<div class="pw-attr"><span style="font-family:var(--mono);font-size:11px;color:var(--text-dim)">no attributes</span></div>') +
			'</div>';

		
		// Attach edit and delete handlers
		if (canMutate) {
			(function (entryIdx, collName) {
				card.querySelector('.card-edit-btn').addEventListener('click', function () {
					openEditModal(entryIdx, collName);  // pass home collection
				});
				card.querySelector('.card-del-btn').addEventListener('click', function () {
					deleteEntry(entryIdx, collName);    // pass home collection
				});
			})(trueIdx, homeCollection);
		}

		// Add Card to DOM
		pwList.appendChild(card);
	});
}

// Toggle visibility of a masked secret field. 
// @param {HTMLElement} btn - The SHOW/HIDE button clicked 
// WHAT THIS DOES:
// - Finds the associated value span using a unique ID
// - Switches between masked (••••) and actual value
function toggleReveal(btn) {

	var el = document.getElementById('v_' + btn.dataset.uid);
	if (!el) return;

	if (el.classList.contains('masked')) {

		// Reveal actual value
		el.textContent = btn.dataset.val;
		el.classList.remove('masked');

		btn.textContent = 'HIDE';

	} else {
		// Mask again
		el.textContent = '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022';
		el.classList.add('masked');

		btn.textContent = 'SHOW';
	}
}

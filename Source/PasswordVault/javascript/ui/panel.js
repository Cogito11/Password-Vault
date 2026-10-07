// ═══════════════════════════════
// UI / PANEL
// Handles:
// - Right-side panel (password entries display)
// - Vault state reset
// - Status / default UI helpers
// ═══════════════════════════════

// Attach a SHOW/HIDE eye-icon toggle to a <input type="password"> field.
// Styled to match the app's existing icon-button convention: dim by
// default (like .book-lock's opacity: 0.45) and brightening to amber on
// hover/active (like .book-action-btn / .book-relock-btn).
// @param {HTMLInputElement} input
// WHAT THIS DOES:
// - Wraps the input so an icon button can sit inside its right edge
// - Clicking the icon flips the input between type="password" / "text"
// - Safe to call multiple times on different inputs; each input is only
//   wired once (checked via a data attribute)
// Used by: unlock.js (vault password), book-create.js (new book password),
// edit-book.js (change/add password fields).
function wirePwToggle(input) {
	if (!input || input.dataset.pwToggleWired) return;
	input.dataset.pwToggleWired = '1';

	// Wrapper lets the icon sit visually inside the input
	var wrap = document.createElement('div');
	wrap.style.position = 'relative';
	input.parentNode.insertBefore(wrap, input);
	wrap.appendChild(input);
	input.style.paddingRight = '36px';

	var btn = document.createElement('button');
	btn.type = 'button';
	btn.className = 'pw-toggle-btn';
	btn.title = 'Show password';
	btn.setAttribute('aria-label', 'Show password');
	btn.tabIndex = -1;
	btn.style.cssText =
		'position:absolute;right:5px;top:50%;transform:translateY(-50%);' +
		'width:26px;height:26px;display:flex;align-items:center;justify-content:center;' +
		'border:none;border-radius:4px;background:transparent;' +
		'cursor:pointer;color:var(--text-dim);opacity:0.6;padding:0;transition:all 0.13s;';

	btn.addEventListener('mouseenter', function () {
		btn.style.opacity = '1';
		btn.style.color = 'var(--amber)';
		btn.style.background = 'var(--amber-dim)';
	});
	btn.addEventListener('mouseleave', function () {
		btn.style.opacity = '0.6';
		btn.style.color = 'var(--text-dim)';
		btn.style.background = 'transparent';
	});

	var eyeSvg =
		'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px;">' +
		'<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/><circle cx="12" cy="12" r="3"/></svg>';

	var eyeOffSvg =
		'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px;">' +
		'<path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a20.3 20.3 0 0 1 4.22-5.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a20.3 20.3 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24"/><path d="M1 1l22 22"/></svg>';

	btn.innerHTML = eyeSvg;

	btn.addEventListener('click', function () {
		var showing = input.type === 'text';
		input.type = showing ? 'password' : 'text';
		btn.innerHTML = showing ? eyeSvg : eyeOffSvg;
		btn.title = showing ? 'Show password' : 'Hide password';
		btn.setAttribute('aria-label', btn.title);
	});

	wrap.appendChild(btn);
}

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

// The entries currently drawn in the list. COPY / SHOW buttons carry an index into
// this array rather than a copy of the value, so no password is kept as a
// (hidden) attribute in the page; they're looked up here only when used, and
// forgotten when the book is locked (see clearDecryptedView).
var renderedEntries = [];

// The attribute value a COPY / SHOW button refers to
function attrValueFromButton(btn) {
	var entry = renderedEntries[parseInt(btn.dataset.ri, 10)];
	var attr = entry && entry.attrs[parseInt(btn.dataset.ai, 10)];
	return attr ? String(attr.val == null ? '' : attr.val) : '';
}

// Removes everything decrypted from the page: the list of entries, the search
// box, and anything half-typed in the add / edit dialogs. Used when a book is
// locked, deleted or ejected so locking really does take the data off the screen
// (and out of the page's memory), not just hide the panel.
function clearDecryptedView() {
	renderedEntries = [];
	pwList.innerHTML = '';
	searchInput.value = '';

	modalEntryList = [];
	closeModal();
	editModalOverlay.classList.remove('open');
	attrRows.innerHTML = '';
	editAttrRows.innerHTML = '';
	entryNameInput.value = '';
	editEntryName.value = '';
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

	// Take any decrypted data off the screen first
	clearDecryptedView();

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

// Flatten every collection into one array, stamping each entry with
// where it came from so edit/delete can locate it without activeFile.
function getAllStampedEntries() {
	var all = [];
	Object.keys(collections).forEach(function (k) {
		collections[k].forEach(function (e, i) {
			all.push(Object.assign({}, e, {
				_homeCollection: k,
				_trueIdx: i
			}));
		});
	});
	return all;
}

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
function renderPasswords(overrideEntries) {

	// Build the entries array based on current view
	var entries;

	if (overrideEntries) 
	{
        entries = overrideEntries;
    } 
	else if (activeFile === '__all__') 
	{
		entries = getAllStampedEntries();
	} 
	else if (activeFile && collections[activeFile]) 
	{
		entries = collections[activeFile];
	} 
	else
	{
		entries = [];
	}

	// Remember what's on screen so COPY / SHOW can look their values up
	renderedEntries = entries;

	// Update panel count
	panelCount.textContent = entries.length + ' password' + (entries.length === 1 ? '' : 's');

	// Clear previous results
	pwList.innerHTML = '';

	// Empty state
	if (!entries.length) {
		pwList.innerHTML = '<div class="no-results">No passwords found.</div>';
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

			// Values with line breaks (multi-line notes) are shown with their line breaks
			var multiClass = String(attr.val).indexOf('\n') !== -1 ? ' multi' : '';

			// Mask sensitive values by default
			var valSpan = isSecret
				? '<span class="pw-attr-val masked' + multiClass + '" id="v_' + uid + '">\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022</span>'
				: '<span class="pw-attr-val' + multiClass + '" id="v_' + uid + '">' + safeVal + '</span>';

			// Add show button only for secrets
			var showBtn = isSecret
				? '<button class="act-btn" data-uid="' + uid + '" data-ri="' + idx + '" data-ai="' + ai + '" onclick="toggleReveal(this)">SHOW</button>'
				: '';

			
			// Final attribute row
			return '<div class="pw-attr">' +
				'<span class="pw-attr-key" title="' + esc(attr.key) + '">' + esc(attr.key) + '</span>' +
				'<div class="attr-resize-handle" title="Drag to resize"></div>' +
				valSpan +
				'<div class="pw-attr-actions">' + showBtn +
					'<button class="act-btn" data-ri="' + idx + '" data-ai="' + ai + '" onclick="copyVal(this)">COPY</button>' +
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
		el.textContent = attrValueFromButton(btn);
		el.classList.remove('masked');

		btn.textContent = 'HIDE';

	} else {
		// Mask again
		el.textContent = '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022';
		el.classList.add('masked');

		btn.textContent = 'SHOW';
	}
}

// ═══════════════════════════════
// ATTRIBUTE COLUMN RESIZE
// Every .pw-attr-key across every card reads its width from the single
// --attr-key-width CSS variable (see styles.css), so dragging one row's
// divider resizes the name column for all password entries at once.
// Handles are rebuilt with every renderPasswords() call, so this uses
// event delegation on document rather than binding per-handle.
// Session-only by design: not persisted, resets on reload.
// ═══════════════════════════════

(function () {
	var MIN_KEY_WIDTH = 48;
	var MAX_KEY_WIDTH = 280;

	// Same breakpoint the stylesheet uses to stack key/value vertically;
	// resizing a shared side-by-side column width makes no sense there.
	var narrowQuery = window.matchMedia('(max-width: 760px)');

	// Keep the key column from growing so wide it eats the value column
	// and action buttons entirely, whatever the current row happens to be.
	function clampKeyWidth(px, rowWidth) {
		var dynamicMax = rowWidth ? Math.min(MAX_KEY_WIDTH, rowWidth - 150) : MAX_KEY_WIDTH;
		var max = Math.max(MIN_KEY_WIDTH, dynamicMax);
		return Math.min(max, Math.max(MIN_KEY_WIDTH, px));
	}

	document.addEventListener('mousedown', function (e) {
		if (e.button !== 0 || narrowQuery.matches) return;

		var handle = e.target.closest('.attr-resize-handle');
		if (!handle) return;

		var row   = handle.closest('.pw-attr');
		var keyEl = row && row.querySelector('.pw-attr-key');
		if (!keyEl) return;

		e.preventDefault();

		var startX     = e.clientX;
		var startWidth = keyEl.getBoundingClientRect().width;
		var rowWidth   = row.getBoundingClientRect().width;

		handle.classList.add('is-dragging');
		document.body.classList.add('resizing-attr-col');

		function onMove(ev) {
			var next = clampKeyWidth(startWidth + (ev.clientX - startX), rowWidth);
			// Setting this once updates every card's attribute row in one shot.
			document.documentElement.style.setProperty('--attr-key-width', next + 'px');
		}

		function onUp() {
			document.removeEventListener('mousemove', onMove);
			document.removeEventListener('mouseup', onUp);
			handle.classList.remove('is-dragging');
			document.body.classList.remove('resizing-attr-col');
		}

		document.addEventListener('mousemove', onMove);
		document.addEventListener('mouseup', onUp);
	});
})();

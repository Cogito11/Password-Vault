// MODALS / EDIT-ENTRY - edit and delete individual password entries

// Close handlers

editModalClose.addEventListener('click', function () { editModalOverlay.classList.remove('open'); });

editModalOverlay.addEventListener('click', function (e) {
  if (e.target === editModalOverlay) editModalOverlay.classList.remove('open');
});

editAddAttrBtn.addEventListener('click', function () { addEditAttrRow('', ''); });

// Keyboard shortcuts 

editEntryName.addEventListener('keydown', function (e) {
  if (e.key === 'Enter') 
  { 
    e.preventDefault(); 
    saveEditBtn.click(); 
  }
});

editModalOverlay.addEventListener('keydown', function (e) {
  if (e.key !== 'Enter') return;
  
  var t = e.target;
  
  if (t.classList.contains('attr-key') || t.classList.contains('attr-val')) 
  {
    e.preventDefault();
    saveEditBtn.click();
  }
});

// Open 

var editingCollName;
// Open the edit modal pre-filled with an existing entry's data.
function openEditModal(idx, collName) {
  collName = collName || activeFile;
  var entry = collections[collName][idx];

  if (!entry) return;

  editingIdx = idx;
  editingCollName = collName;
  editEntryName.value = entry.name;
  editAttrRows.innerHTML = '';

  entry.attrs.forEach(function (a) { addEditAttrRow(a.key, a.val); });

  editModalInfo.textContent = '';
  editModalOverlay.classList.add('open');

  setTimeout(function () { window.focus(); editEntryName.focus(); }, 100);
}

function addEditAttrRow(key, val) {
  // Wrapper groups the row itself with its (initially hidden) generator panel,
  // so removing one attribute removes both together.
  var wrap = document.createElement('div');
  wrap.className = 'attr-row-block';

  var row = document.createElement('div');
  row.className = 'attr-row';

  row.innerHTML =
    '<button type="button" class="attr-row-grip" title="Drag to reorder" aria-label="Reorder attribute">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>' +
    '</button>' +
    '<input class="modal-input attr-key" type="text" placeholder="Key (e.g. Email)" value="' + esc(key) + '">' +
    genAttrValHTML(val) +
    '<button class="attr-row-del" title="Remove">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>' +
    '</button>';

  wrap.appendChild(row);
  wrap.insertAdjacentHTML('beforeend', genPanelHTML());

  row.querySelector('.attr-row-del').addEventListener('click', function () { editAttrRows.removeChild(wrap); });

  wireAttrGenerator(wrap);

  editAttrRows.appendChild(wrap);
}

// Reorder attributes
// Each attribute is an .attr-row-block inside #editAttrRows. Grabbing a row's
// grip and dragging moves that block up or down; with the grip focused,
// ArrowUp / ArrowDown does the same from the keyboard. The saved order is
// simply the DOM order (see the save handler), so nothing else needs to know
// about reordering. Listeners are delegated because rows are added and
// removed dynamically.

(function () {
  var EDGE = 40;      // px from the scroll container's edge that triggers auto-scroll
  var MAX_STEP = 16;  // max px scrolled per frame

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  // Run `mutate` (which reorders the blocks), then slide every other block
  // from where it was to where it now is (FLIP technique).
  function animateReorder(mutate, moved) {
    var kids = Array.prototype.slice.call(editAttrRows.children);
    var before = kids.map(function (k) { return k.getBoundingClientRect().top; });

    mutate();

    if (reduceMotion.matches) return;

    kids.forEach(function (k, i) {
      if (k === moved || !k.animate) return;

      var dy = before[i] - k.getBoundingClientRect().top;
      if (!dy) return;

      k.animate(
        [{ transform: 'translateY(' + dy + 'px)' }, { transform: 'translateY(0)' }],
        { duration: 180, easing: 'cubic-bezier(0.2, 0, 0, 1)' }
      );
    });
  }

  editAttrRows.addEventListener('pointerdown', function (e) {
    if (e.button !== 0) return;

    var grip = e.target.closest('.attr-row-grip');
    if (!grip) return;

    var block = grip.closest('.attr-row-block');
    if (!block) return;

    e.preventDefault(); // no text selection / focus loss while dragging

    var scroller = editAttrRows.closest('.modal-body');
    var lastY = e.clientY;
    var raf = null;

    block.classList.add('is-dragging');
    editAttrRows.classList.add('is-reordering');
    document.body.classList.add('reordering-attr');

    // Move the dragged block to wherever the pointer currently is. Midpoints
    // come from layout positions (not getBoundingClientRect) so rows that are
    // still mid-slide can't make the block flip-flop between two slots.
    function place() {
      var top0 = editAttrRows.getBoundingClientRect().top - editAttrRows.offsetTop;
      var next = null;
      var others = editAttrRows.children;

      for (var i = 0; i < others.length; i++) {
        if (others[i] === block) continue;
        var mid = top0 + others[i].offsetTop + others[i].offsetHeight / 2;
        if (lastY < mid) { next = others[i]; break; }
      }

      if (next) {
        if (block.nextElementSibling !== next) animateReorder(function () { editAttrRows.insertBefore(block, next); }, block);
      } else if (editAttrRows.lastElementChild !== block) {
        animateReorder(function () { editAttrRows.appendChild(block); }, block);
      }
    }

    // Scroll the modal while the pointer is held near its top/bottom edge.
    function autoScroll() {
      if (!scroller) return;
      var r = scroller.getBoundingClientRect();
      var step = 0;

      if (lastY < r.top + EDGE) step = -Math.ceil(MAX_STEP * Math.min(1, (r.top + EDGE - lastY) / EDGE));
      else if (lastY > r.bottom - EDGE) step = Math.ceil(MAX_STEP * Math.min(1, (lastY - (r.bottom - EDGE)) / EDGE));

      if (step) {
        scroller.scrollTop += step;
        place();
      }
      raf = requestAnimationFrame(autoScroll);
    }

    function onMove(ev) { lastY = ev.clientY; place(); }

    function onEnd() {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onEnd);
      document.removeEventListener('pointercancel', onEnd);
      if (raf) cancelAnimationFrame(raf);

      block.classList.remove('is-dragging');
      editAttrRows.classList.remove('is-reordering');
      document.body.classList.remove('reordering-attr');
    }

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onEnd);
    document.addEventListener('pointercancel', onEnd);
    raf = requestAnimationFrame(autoScroll);
  });

  editAttrRows.addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;

    var grip = e.target.closest('.attr-row-grip');
    if (!grip) return;

    var block = grip.closest('.attr-row-block');
    if (!block) return;

    e.preventDefault();

    var sib = e.key === 'ArrowUp' ? block.previousElementSibling : block.nextElementSibling;
    if (sib) 
    {
      animateReorder(function () {
        if (e.key === 'ArrowUp') editAttrRows.insertBefore(block, sib);
        else editAttrRows.insertBefore(sib, block);
      }, block);
    }

    grip.focus(); // re-inserting a node can drop focus
    block.scrollIntoView({ block: 'nearest' });
  });
})();

// Save edits 

saveEditBtn.addEventListener('click', async function () {
  var name = editEntryName.value.trim();
  if (!name) 
  {
    editEntryName.style.borderColor = '#e05555';
    setTimeout(function () { window.focus(); editEntryName.style.borderColor = ''; }, 1200);
    return;
  }

  var attrs = [];
  editAttrRows.querySelectorAll('.attr-row').forEach(function (row) {
    var k = row.querySelector('.attr-key').value.trim();
    var v = row.querySelector('.attr-val').value.trim();
    if (k) attrs.push({ key: k, val: v });
  });

  // Remember the current entry so it can be put back if saving fails
  var previousEntry = collections[editingCollName][editingIdx];

  // editingCollName
  collections[editingCollName][editingIdx] = { name: name, attrs: attrs };
  if (isMultiBookMode && activeBookName) bookHandles[activeBookName].collections = collections;

  saveEditBtn.disabled = true;
  saveEditBtn.textContent = 'Saving\u2026';

  try {
    if (bookIsEncrypted()) 
    {
      await reEncryptVault();
    } 
    else 
    {
      // editingCollName
      await bookWriteFile(editingCollName, buildFileText(collections[editingCollName]));
    }

    // editingCollName
    var sideBtn = findByData(collList, 'file', editingCollName);
    if (sideBtn) sideBtn.querySelector('.coll-n').textContent = collections[editingCollName].length + ' password' + (collections[editingCollName].length !== 1 ? 's' : '');
    
    editModalOverlay.classList.remove('open');
	showToast('Password updated');

    // Re-render passwords
    refreshActiveView();

  } catch (err) {

    // The save failed, so put the old entry back: what's in memory must match what's on disk
    collections[editingCollName][editingIdx] = previousEntry;

    editModalInfo.textContent = 'Error: ' + err.message;
    editModalInfo.style.color = '#e05555';
    setTimeout(function () { window.focus(); editModalInfo.style.color = ''; }, 3000);
  }

  saveEditBtn.disabled = false;
  saveEditBtn.textContent = 'Save Changes';
});

// Delete entry 

// Confirm and permanently delete a single entry from the active collection.
async function deleteEntry(idx, collName) {
  collName = collName || activeFile;
  var entry = collections[collName][idx];

  if (!entry) return;

  var confirmed = await showConfirm(
		'Delete Password',
    'Delete "' + entry.name + '"?\n\nThis cannot be undone.'
  );
  if (!confirmed) return;

  collections[collName].splice(idx, 1); 
  if (isMultiBookMode && activeBookName) bookHandles[activeBookName].collections = collections;

  try {
    if (bookIsEncrypted()) 
    {
      await reEncryptVault();
    } 
    else 
    {
      await bookWriteFile(collName, buildFileText(collections[collName]));
    }

    var remaining = collections[collName].length;
    var sideBtn = findByData(collList, 'file', collName);
    if (sideBtn) sideBtn.querySelector('.coll-n').textContent = remaining + ' password' + (remaining !== 1 ? 's' : '');

    var allBtnEl = collList.querySelector('.all-btn');
    if (allBtnEl) 
    {
      var total = Object.keys(collections).reduce(function (s, k) { return s + collections[k].length; }, 0);
      allBtnEl.querySelector('.coll-n').textContent = total + ' passwords total';
    }

    showToast('"' + entry.name + '" deleted');
    refreshActiveView();
    
  } catch (err) {
    collections[collName].splice(idx, 0, entry);
    if (isMultiBookMode && activeBookName) bookHandles[activeBookName].collections = collections;
    showToast('Error: ' + err.message);
  }
}

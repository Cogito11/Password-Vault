/* ═══════════════════════════════
   UTILS  —  esc, showToast, copyVal, buildFileText
   No dependencies on other src/ files.
═══════════════════════════════ */

/** HTML-escape a string for safe injection into innerHTML. */
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Show a brief status toast. Auto-hides after 1.8 s. */
var toastTimer;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 1800);
}

/** Copy a value to the clipboard; briefly flashes the button green. */
function copyVal(btn) {
  navigator.clipboard.writeText(btn.dataset.val).then(function () {
    var prev = btn.textContent;
    btn.textContent = 'DONE';
    btn.classList.add('ok');
    showToast('Copied to clipboard');
    setTimeout(function () { btn.textContent = prev; btn.classList.remove('ok'); }, 1600);
  });
}

/**
 * Serialise an entries array back to the plain-text .txt format.
 * Each entry is written as:
 *   Entry Name (N attributes)
 *       Key: Value
 *       …
 * (blank line between entries, "End" sentinel at the bottom)
 */
function buildFileText(entries) {
  var lines = [];
  entries.forEach(function (entry) {
    lines.push(entry.name + ' (' + entry.attrs.length + ' attributes)');
    entry.attrs.forEach(function (a) { lines.push('    ' + a.key + ': ' + a.val); });
    lines.push('');
  });
  lines.push('End');
  return lines.join('\n');
}

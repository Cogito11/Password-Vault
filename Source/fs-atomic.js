// ═══════════════════════════════
// FS-ATOMIC - crash-safe file writes
//
// A plain fs.writeFileSync() truncates the destination first and then writes
// into it, so a failure part-way through (disk full, power loss, crash) leaves
// a half-written file where the user's only copy used to be. For an encrypted
// vault that means every password is gone.
//
// writeFileAtomic() instead writes the new contents to a temporary file next
// to the destination, flushes it to disk, and only then renames it over the
// destination. A rename is atomic, so the destination is always either the
// complete old file or the complete new file, never something in between.
// If anything goes wrong the temp file is removed and the original is untouched.
// ═══════════════════════════════

const fs = require('fs');
const path = require('path');

let counter = 0;

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// Renaming over a file can briefly fail on Windows while an antivirus scanner
// or indexer has it open. A couple of short retries clears that up.
function renameWithRetry(from, to) {
  for (let attempt = 0; ; attempt++) {
    try {
      fs.renameSync(from, to);
      return;
    } catch (err) {
      const transient = err && (err.code === 'EPERM' || err.code === 'EBUSY' || err.code === 'EACCES');
      if (!transient || attempt >= 4) throw err;
      sleepSync(40 * (attempt + 1));
    }
  }
}

// opts.exclusive - fail with EEXIST instead of replacing an existing file
// opts.backup    - before replacing, keep the previous contents as <file>.bak
//                  (the backup itself is written via a temp file too, so a
//                  failure while backing up never destroys the last good backup)
function writeFileAtomic(target, data, opts) {
  opts = opts || {};

  if (opts.exclusive && fs.existsSync(target)) {
    const err = new Error('EEXIST: ' + path.basename(target) + ' already exists');
    err.code = 'EEXIST';
    throw err;
  }

  const tmp = target + '.tmp-' + process.pid + '-' + (counter++) + '-' + Date.now().toString(36);
  let fd = null;

  try {
    fd = fs.openSync(tmp, 'wx');
    fs.writeFileSync(fd, data);
    fs.fsyncSync(fd); // make sure the bytes are on disk before we swap
    fs.closeSync(fd);
    fd = null;

    if (opts.backup && fs.existsSync(target)) {
      const bak = target + '.bak';
      fs.copyFileSync(target, bak + '.tmp');
      renameWithRetry(bak + '.tmp', bak);
    }

    renameWithRetry(tmp, target);
  } catch (err) {
    if (fd !== null) { try { fs.closeSync(fd); } catch (_) { /* already closed */ } }
    try { fs.unlinkSync(tmp); } catch (_) { /* nothing to clean up */ }
    try { fs.unlinkSync(target + '.bak.tmp'); } catch (_) { /* nothing to clean up */ }
    throw err;
  }
}

module.exports = { writeFileAtomic };

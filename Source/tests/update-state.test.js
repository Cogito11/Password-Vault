const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// describeUpdateState decides what the Settings "Updates" row shows for each state.
function loadDescribe() {
  const fullPath = path.join(__dirname, '..', 'PasswordVault/javascript/core/update-state.js');
  const sandbox = { console };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(fullPath, 'utf8'), sandbox);
  return sandbox.describeUpdateState;
}

const describe = loadDescribe();
// Reduce to the things a person would see, so assertions read like the screen
const screen = (state) => {
  const v = describe(state);
  return {
    check: v.check.hidden ? null : v.check.label + (v.check.disabled ? ' (disabled)' : ''),
    install: v.install.hidden ? null : v.install.label,
    website: v.website.hidden ? null : v.website.label,
    hint: v.hint,
  };
};

// ── The website flow (portable build, macOS, ...) must look exactly as it did before ──

test('website flow: idle shows only the check button', () => {
  assert.deepEqual(screen({ status: 'idle' }), { check: 'Check for update', install: null, website: null, hint: '' });
});

test('website flow: checking, up to date', () => {
  assert.deepEqual(screen({ status: 'checking' }), { check: 'Checking… (disabled)', install: null, website: null, hint: 'Checking for updates…' });
  assert.deepEqual(screen({ status: 'current', current: '1.3.5' }), { check: 'Up to date', install: null, website: null, hint: 'You\'re on the latest version (v1.3.5).' });
});

test('website flow: an available update swaps the check button for the download link', () => {
  assert.deepEqual(screen({ status: 'available', version: '1.4.0' }), { check: null, install: null, website: 'Download v1.4.0', hint: 'A newer version (v1.4.0) is available.' });
});

test('website flow: error messages by reason', () => {
  assert.equal(screen({ status: 'error', reason: 'no-release' }).hint, 'No published release found on GitHub.');
  assert.equal(screen({ status: 'error', reason: 'rate-limited' }).hint, 'GitHub\'s API rate limit was hit. Try again in a few minutes.');
  assert.equal(screen({ status: 'error', reason: 'fetch-failed' }).hint, 'Couldn\'t check for updates right now.');
  assert.equal(screen({ status: 'error', reason: undefined }).check, 'Check failed');
});

// ── The in-place flow ───────────────────────────────────────────────

const inPlace = (state) => screen({ inPlace: true, current: '1.3.5', ...state });

test('in-place: idle, checking, up to date look the same as the website flow', () => {
  assert.deepEqual(inPlace({ status: 'idle' }), { check: 'Check for update', install: null, website: null, hint: '' });
  assert.equal(inPlace({ status: 'checking' }).check, 'Checking… (disabled)');
  assert.equal(inPlace({ status: 'current' }).hint, 'You\'re on the latest version (v1.3.5).');
});

test('in-place: an available update offers an in-app download, never the website link', () => {
  assert.deepEqual(inPlace({ status: 'available', version: '1.4.0' }), { check: null, install: 'Download v1.4.0', website: null, hint: 'A newer version (v1.4.0) is available.' });
});

test('in-place: while downloading there is nothing to click, just progress', () => {
  assert.deepEqual(inPlace({ status: 'downloading', version: '1.4.0', percent: 42 }), { check: null, install: null, website: null, hint: 'Downloading v1.4.0… 42%' });
  assert.equal(inPlace({ status: 'downloading', version: '1.4.0' }).hint, 'Downloading v1.4.0… 0%');
});

test('in-place: once downloaded, the button restarts, and the hint says what a restart does', () => {
  const s = inPlace({ status: 'downloaded', version: '1.4.0', percent: 100 });
  assert.equal(s.install, 'Restart to update');
  assert.equal(s.check, null);
  assert.match(s.hint, /will restart/);
  assert.match(s.hint, /unlocked books will be locked again/);
});

test('in-place: a failed download offers a retry and says why; a failed install says why too', () => {
  const download = inPlace({ status: 'available', version: '1.4.0', message: 'Couldn\'t reach GitHub.', errorPhase: 'download' });
  assert.equal(download.install, 'Retry download');
  assert.equal(download.hint, 'The update couldn\'t be downloaded: Couldn\'t reach GitHub.');

  const install = inPlace({ status: 'downloaded', version: '1.4.0', message: 'pkexec was dismissed', errorPhase: 'install' });
  assert.equal(install.install, 'Try again');
  assert.equal(install.hint, 'The update couldn\'t be installed: pkexec was dismissed');
});

test('in-place: a failed re-check does not replace the waiting update\'s message', () => {
  const s = inPlace({ status: 'available', version: '1.4.0', message: 'offline', errorPhase: 'check' });
  assert.equal(s.install, 'Download v1.4.0');
  assert.equal(s.hint, 'A newer version (v1.4.0) is available.');
});

test('in-place: a failed check shows the message from the app, or a generic one', () => {
  assert.equal(inPlace({ status: 'error', message: 'Couldn\'t reach GitHub. Check your internet connection and try again.', errorPhase: 'check' }).hint, 'Couldn\'t reach GitHub. Check your internet connection and try again.');
  assert.equal(inPlace({ status: 'error' }).hint, 'Couldn\'t check for updates right now.');
  assert.equal(inPlace({ status: 'error' }).check, 'Check failed');
});

test('exactly one next step is ever shown at a time', () => {
  for (const inPlaceFlag of [true, false]) {
    for (const status of ['idle', 'checking', 'current', 'available', 'downloading', 'downloaded', 'error']) {
      const s = screen({ status, inPlace: inPlaceFlag, version: '1.4.0', current: '1.3.5' });
      const shown = [s.check, s.install, s.website].filter((x) => x !== null).length;
      assert.ok(shown <= 1, `${inPlaceFlag ? 'in-place' : 'website'} / ${status} shows ${shown} controls`);
    }
  }
});

test('the website link never appears for an in-place install', () => {
  for (const status of ['idle', 'checking', 'current', 'available', 'downloading', 'downloaded', 'error']) {
    assert.equal(screen({ status, inPlace: true, version: '1.4.0' }).website, null, status);
  }
});

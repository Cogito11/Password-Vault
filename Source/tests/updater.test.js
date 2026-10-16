const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const {
  CHANNELS, MAC_IN_PLACE_UPDATES,
  detectSupport, friendlyError, createUpdater, registerUpdaterIpc,
} = require('../updater.js');

// A stand-in for electron-updater's autoUpdater: an EventEmitter whose operations the test controls.
function fakeAutoUpdater() {
  const au = new EventEmitter();
  au.calls = { check: 0, download: 0, install: [] };
  au.checkForUpdates = async () => { au.calls.check += 1; return { updateInfo: {} }; };
  au.downloadUpdate = async () => { au.calls.download += 1; return []; };
  au.quitAndInstall = (...args) => { au.calls.install.push(args); };
  return au;
}

function makeWindow(destroyed = false) {
  const win = { sent: [], isDestroyed: () => destroyed };
  win.webContents = { send: (channel, state) => win.sent.push([channel, state.status]) };
  return win;
}

function setup({ isPackaged = true, platform = 'win32', env = {}, existsSync = () => false, autoUpdater = fakeAutoUpdater(), loadFails = false } = {}) {
  const windows = [makeWindow(), makeWindow(), makeWindow(true)];
  const logs = [];
  let loads = 0;
  const updater = createUpdater({
    app: { isPackaged, getVersion: () => '1.3.5' },
    BrowserWindow: { getAllWindows: () => windows },
    loadAutoUpdater: () => { loads += 1; if (loadFails) throw new Error('module missing'); return autoUpdater; },
    platform,
    env,
    resourcesPath: '/opt/PasswordVault/resources',
    existsSync,
    log: (...args) => logs.push(args.join(' ')),
  });
  return { updater, autoUpdater, windows, logs, loads: () => loads };
}

// Make the fake report an update, the way electron-updater does: through events
const offerUpdate = (au, version = '1.4.0') => { au.checkForUpdates = async () => { au.calls.check += 1; au.emit('update-available', { version }); return {}; }; };
const finishDownload = (au, version = '1.4.0') => { au.downloadUpdate = async () => { au.calls.download += 1; au.emit('download-progress', { percent: 41.7 }); au.emit('update-downloaded', { version }); return []; }; };

// ── Which installs can update themselves ────────────────────────────

test('detectSupport: a development run never updates itself', () => {
  assert.deepEqual(detectSupport({ isPackaged: false, platform: 'win32', env: {} }), { supported: false, reason: 'dev' });
});

test('detectSupport: Windows installer yes, portable .exe no (there is no installer to replace)', () => {
  const base = { isPackaged: true, platform: 'win32' };
  assert.equal(detectSupport({ ...base, env: {} }).supported, true);
  assert.deepEqual(detectSupport({ ...base, env: { PORTABLE_EXECUTABLE_FILE: 'C:\\x\\PasswordVault.exe' } }), { supported: false, reason: 'portable' });
});

test('detectSupport: Linux AppImage yes, .deb yes (package-type marker), anything else no', () => {
  const base = { isPackaged: true, platform: 'linux', resourcesPath: '/r' };
  assert.equal(detectSupport({ ...base, env: { APPIMAGE: '/home/me/PasswordVault.AppImage' }, existsSync: () => false }).supported, true);
  assert.equal(detectSupport({ ...base, env: {}, existsSync: (p) => p.endsWith('package-type') }).supported, true);
  assert.deepEqual(detectSupport({ ...base, env: {}, existsSync: () => false }), { supported: false, reason: 'unmanaged-install' });
  assert.equal(detectSupport({ ...base, env: { SNAP: '1' }, existsSync: () => false }).supported, false);
});

test('detectSupport: macOS follows MAC_IN_PLACE_UPDATES (off until the builds are code-signed)', () => {
  assert.equal(detectSupport({ isPackaged: true, platform: 'darwin', env: {} }).supported, MAC_IN_PLACE_UPDATES);
});

test('friendlyError turns network failures and rate limits into plain sentences, and trims long errors', () => {
  assert.match(friendlyError(new Error('net::ERR_INTERNET_DISCONNECTED')), /internet connection/);
  assert.match(friendlyError(new Error('getaddrinfo ENOTFOUND github.com')), /internet connection/);
  assert.match(friendlyError(new Error('HttpError: 403 rate limit exceeded')), /limiting requests/);
  assert.equal(friendlyError(new Error('Cannot find latest.yml\n  at stack...\n  headers: {...}')), 'Cannot find latest.yml');
  assert.ok(friendlyError(new Error('x'.repeat(500))).length <= 200);
});

test('an install that can\'t update itself reports unsupported, never loads electron-updater, and ignores every request', async () => {
  const { updater, autoUpdater, loads, logs } = setup({ isPackaged: false });
  assert.equal(updater.getState().supported, false);
  assert.equal(updater.getState().reason, 'dev');
  assert.equal(updater.getState().status, 'unsupported');
  await updater.check();
  await updater.download();
  updater.install();
  assert.equal(loads(), 0);
  assert.equal(autoUpdater.calls.check, 0);
  assert.equal(updater.getState().status, 'unsupported');
  assert.ok(logs.some((l) => l.includes('off for this install (dev)')), 'says why in the log');
});

test('if electron-updater can\'t be loaded, it degrades to unsupported instead of crashing', () => {
  const { updater, logs } = setup({ loadFails: true });
  assert.equal(updater.getState().supported, false);
  assert.equal(updater.getState().reason, 'unavailable');
  assert.ok(logs.some((l) => l.includes("couldn't load electron-updater")));
});

// ── The offline-first promise ───────────────────────────────────────

test('nothing touches the network until asked: creating the updater only configures it', () => {
  const { updater, autoUpdater } = setup();
  assert.equal(autoUpdater.calls.check, 0);
  assert.equal(autoUpdater.calls.download, 0);
  assert.equal(updater.getState().status, 'idle');
  assert.equal(typeof updater.start, 'undefined', 'there is no background scheduler to start');
});

test('nothing downloads or installs on its own: auto-download and install-on-quit are both off', () => {
  const { autoUpdater } = setup();
  assert.equal(autoUpdater.autoDownload, false);
  assert.equal(autoUpdater.autoInstallOnAppQuit, false);
  assert.equal(autoUpdater.allowDowngrade, false);
});

// ── The update flow ─────────────────────────────────────────────────

test('check -> available -> download (with progress) -> downloaded -> install', async () => {
  const { updater, autoUpdater, windows } = setup();
  assert.deepEqual(
    { supported: updater.getState().supported, status: updater.getState().status, currentVersion: updater.getState().currentVersion, error: updater.getState().error },
    { supported: true, status: 'idle', currentVersion: '1.3.5', error: null }
  );

  offerUpdate(autoUpdater);
  await updater.check();
  assert.equal(updater.getState().status, 'available');
  assert.equal(updater.getState().version, '1.4.0');

  finishDownload(autoUpdater);
  await updater.download();
  assert.equal(updater.getState().status, 'downloaded');
  assert.equal(updater.getState().percent, 100);

  updater.install();
  assert.deepEqual(autoUpdater.calls.install, [[true, true]]);

  // every live window heard each step; the destroyed one was skipped
  assert.deepEqual(windows[0].sent.map((m) => m[1]), ['checking', 'available', 'downloading', 'downloading', 'downloaded', 'downloaded']);
  assert.equal(windows[1].sent.length, windows[0].sent.length);
  assert.equal(windows[2].sent.length, 0);
  assert.ok(windows[0].sent.every((m) => m[0] === CHANNELS.changed));
});

test('download progress is a whole number from 0 to 100', async () => {
  const { updater, autoUpdater } = setup();
  offerUpdate(autoUpdater);
  await updater.check();
  const seen = [];
  autoUpdater.downloadUpdate = async () => {
    autoUpdater.emit('download-progress', { percent: 99.99 });
    seen.push(updater.getState().percent);
    autoUpdater.emit('download-progress', { percent: 250 });
    seen.push(updater.getState().percent);
    autoUpdater.emit('download-progress', { percent: -5 });
    seen.push(updater.getState().percent);
    return [];
  };
  await updater.download();
  assert.deepEqual(seen, [99, 100, 0]);
});

test('already up to date -> current', async () => {
  const { updater, autoUpdater } = setup();
  autoUpdater.checkForUpdates = async () => { autoUpdater.emit('update-not-available', { version: '1.3.5' }); return {}; };
  await updater.check();
  assert.equal(updater.getState().status, 'current');
  assert.equal(updater.getState().version, null);
});

test('a check that does nothing (electron-updater returned null) doesn\'t leave "checking" stuck', async () => {
  const { updater, autoUpdater } = setup();
  autoUpdater.checkForUpdates = async () => null;
  await updater.check();
  assert.equal(updater.getState().status, 'idle');
});

test('only downloads when there is an update, and only installs once it has downloaded', async () => {
  const { updater, autoUpdater } = setup();
  await updater.download(); // idle
  updater.install(); // idle
  assert.equal(autoUpdater.calls.download, 0);
  assert.equal(autoUpdater.calls.install.length, 0);

  // an update that's only been found is not installable either
  offerUpdate(autoUpdater);
  await updater.check();
  updater.install();
  assert.equal(autoUpdater.calls.install.length, 0);
});

test('overlapping checks, or a check with an update downloaded, run only once', async () => {
  const { updater, autoUpdater } = setup();
  let release;
  autoUpdater.checkForUpdates = () => { autoUpdater.calls.check += 1; return new Promise((r) => { release = () => { autoUpdater.emit('update-available', { version: '1.4.0' }); r({}); }; }); };
  const first = updater.check();
  await updater.check();
  assert.equal(autoUpdater.calls.check, 1);
  release();
  await first;

  finishDownload(autoUpdater);
  await updater.download();
  await updater.check(); // already downloaded
  assert.equal(autoUpdater.calls.check, 1);
});

test('a double-click on Restart only installs once, and a failed install can be retried', async () => {
  const { updater, autoUpdater } = setup();
  offerUpdate(autoUpdater);
  finishDownload(autoUpdater);
  await updater.check();
  await updater.download();
  updater.install();
  updater.install();
  assert.equal(autoUpdater.calls.install.length, 1);

  autoUpdater.emit('error', new Error('installer failed to start'));
  updater.install();
  assert.equal(autoUpdater.calls.install.length, 2);
});

// ── Failures ────────────────────────────────────────────────────────

test('a failed check reports an error with a readable message (electron-updater emits AND rejects)', async () => {
  const { updater, autoUpdater } = setup();
  autoUpdater.checkForUpdates = async () => {
    const e = new Error('net::ERR_INTERNET_DISCONNECTED');
    autoUpdater.emit('error', e);
    throw e;
  };
  await updater.check();
  assert.equal(updater.getState().status, 'error');
  assert.equal(updater.getState().error.phase, 'check');
  assert.match(updater.getState().error.message, /internet connection/);
});

test('a rejection with no "error" event is still caught, and an error can be retried', async () => {
  const { updater, autoUpdater } = setup();
  autoUpdater.checkForUpdates = async () => { throw new Error('boom'); };
  await updater.check();
  assert.deepEqual(updater.getState().error, { phase: 'check', message: 'boom' });
  assert.equal(updater.getState().status, 'error');

  autoUpdater.checkForUpdates = async () => { autoUpdater.emit('update-not-available', {}); return {}; };
  await updater.check();
  assert.equal(updater.getState().status, 'current');
  assert.equal(updater.getState().error, null);
});

test('a failed download goes back to "available" (with the error) so it can be retried', async () => {
  const { updater, autoUpdater } = setup();
  offerUpdate(autoUpdater);
  await updater.check();
  autoUpdater.downloadUpdate = async () => { const e = new Error('sha512 checksum mismatch'); autoUpdater.emit('error', e); throw e; };
  await updater.download();
  assert.equal(updater.getState().status, 'available');
  assert.equal(updater.getState().version, '1.4.0');
  assert.equal(updater.getState().percent, null);
  assert.deepEqual(updater.getState().error, { phase: 'download', message: 'sha512 checksum mismatch' });

  finishDownload(autoUpdater);
  await updater.download();
  assert.equal(updater.getState().status, 'downloaded');
  assert.equal(updater.getState().error, null);
});

test('a failed install stays on "downloaded" so the person can try again', async () => {
  const { updater, autoUpdater } = setup();
  offerUpdate(autoUpdater);
  finishDownload(autoUpdater);
  await updater.check();
  await updater.download();
  autoUpdater.quitAndInstall = () => { throw new Error('pkexec was dismissed'); };
  updater.install();
  assert.equal(updater.getState().status, 'downloaded');
  assert.deepEqual(updater.getState().error, { phase: 'install', message: 'pkexec was dismissed' });
});

test('an error after the download finished is an install error', async () => {
  const { updater, autoUpdater } = setup();
  offerUpdate(autoUpdater);
  finishDownload(autoUpdater);
  await updater.check();
  await updater.download();
  autoUpdater.emit('error', new Error('could not replace the old version'));
  assert.equal(updater.getState().status, 'downloaded');
  assert.equal(updater.getState().error.phase, 'install');
});

test('a failed re-check never hides an update that is already waiting', async () => {
  const { updater, autoUpdater } = setup();
  offerUpdate(autoUpdater);
  await updater.check();
  autoUpdater.checkForUpdates = async () => { throw new Error('offline'); };
  await updater.check();
  assert.equal(updater.getState().status, 'available');
  assert.equal(updater.getState().version, '1.4.0');
  assert.equal(updater.getState().error.phase, 'check');
});

// ── IPC ─────────────────────────────────────────────────────────────

test('IPC exposes exactly four channels, each returning the current state', async () => {
  const { updater, autoUpdater } = setup();
  const handlers = {};
  registerUpdaterIpc({ ipcMain: { handle: (channel, fn) => { handlers[channel] = fn; } }, updater });
  assert.deepEqual(Object.keys(handlers).sort(), [CHANNELS.check, CHANNELS.download, CHANNELS.getState, CHANNELS.install].sort());

  assert.equal((await handlers[CHANNELS.getState]()).status, 'idle');
  offerUpdate(autoUpdater);
  const afterCheck = await handlers[CHANNELS.check]();
  assert.equal(afterCheck.status, 'available');
  assert.equal(afterCheck.version, '1.4.0');
  finishDownload(autoUpdater);
  assert.equal((await handlers[CHANNELS.download]()).status, 'downloaded');
  assert.equal((await handlers[CHANNELS.install]()).status, 'downloaded');
  assert.equal(autoUpdater.calls.install.length, 1);
});

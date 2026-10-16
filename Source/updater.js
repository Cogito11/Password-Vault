// In-place updates for the desktop app, built on electron-updater.
//
// How it works: every release on GitHub carries a small `latest*.yml` file (written by
// electron-builder when it publishes) that lists the new build and its checksum. This module reads
// that file, and when the person agrees, downloads only the new build, checks it against the
// checksum, and installs it when they choose to restart. No installer to fetch by hand.
//
// Password Vault promises to be offline-first, so this is deliberately strictly on request:
//   - Nothing contacts GitHub until the person clicks "Check for update" in Settings.
//   - Nothing downloads until they click "Download".
//   - Nothing installs until they click "Restart to update". An update that was downloaded but not
//     installed is never applied behind their back when the app closes.
//
// Everything Electron-specific is passed in as a parameter so this file can be tested with fakes.
// It never throws across the IPC boundary: failures become `error` in the state.

const fs = require('fs');
const path = require('path');

const CHANNELS = {
  getState: 'updater:get-state',
  check: 'updater:check',
  download: 'updater:download',
  install: 'updater:install',
  changed: 'updater:state-changed',
};

// macOS can only swap in a new version of an app that is code-signed with an Apple Developer ID
// (the release workflow doesn't sign yet). An unsigned update would download and then fail, so until
// the builds are signed and notarized, Mac stays on the "download from the website" path. Flip this
// to true once they are.
const MAC_IN_PLACE_UPDATES = false;

// Can this installation update itself? When it can't, the Settings page falls back to the plain
// "check GitHub, then link to the download page" flow, so nobody is left without a way to update.
function detectSupport({ isPackaged, platform, env, resourcesPath, existsSync = fs.existsSync }) {
  if (!isPackaged) return { supported: false, reason: 'dev' };

  if (platform === 'win32') {
    // The portable .exe has no installer to replace, so it can't update itself.
    if (env.PORTABLE_EXECUTABLE_FILE) return { supported: false, reason: 'portable' };
    return { supported: true };
  }

  if (platform === 'darwin') {
    return MAC_IN_PLACE_UPDATES ? { supported: true } : { supported: false, reason: 'mac-unsigned' };
  }

  if (platform === 'linux') {
    if (env.SNAP) return { supported: false, reason: 'snap' };
    // An AppImage replaces itself; a .deb install carries a `package-type` marker written at build time.
    if (env.APPIMAGE) return { supported: true };
    if (resourcesPath && existsSync(path.join(resourcesPath, 'package-type'))) return { supported: true };
    return { supported: false, reason: 'unmanaged-install' };
  }

  return { supported: false, reason: 'platform' };
}

// electron-updater errors can run to many lines (stack, response headers). People get one readable
// sentence; the full text goes to the log.
function friendlyError(err) {
  const raw = String((err && err.message) || err || 'Unknown error');
  if (/ERR_INTERNET_DISCONNECTED|ERR_NETWORK|ERR_NAME_NOT_RESOLVED|ERR_CONNECTION|ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|EAI_AGAIN/i.test(raw)) {
    return "Couldn't reach GitHub. Check your internet connection and try again.";
  }
  if (/\b(403|429)\b|rate limit/i.test(raw)) {
    return 'GitHub is limiting requests right now. Try again in a few minutes.';
  }
  const firstLine = raw.split('\n')[0].trim();
  return firstLine.length > 200 ? `${firstLine.slice(0, 197)}...` : firstLine;
}

function createUpdater({
  app,
  BrowserWindow,
  // Returns electron-updater's `autoUpdater`. Called only when this install can update itself, so a
  // dev run or a portable build never even loads it.
  loadAutoUpdater,
  platform = process.platform,
  env = process.env,
  resourcesPath = process.resourcesPath,
  existsSync,
  log = () => {},
}) {
  const support = detectSupport({ isPackaged: app.isPackaged, platform, env, resourcesPath, existsSync });

  // status: unsupported | idle | checking | current | available | downloading | downloaded | error
  // error:  null, or { phase: 'check' | 'download' | 'install', message }
  let state = {
    supported: support.supported,
    reason: support.reason || null,
    status: support.supported ? 'idle' : 'unsupported',
    currentVersion: app.getVersion(),
    version: null,
    percent: null,
    error: null,
  };

  // Say why, so "it opened the website instead of updating" can be diagnosed from the terminal.
  log(support.supported ? 'in-place updates are on' : `in-place updates are off for this install (${support.reason})`);

  let autoUpdater = null;
  let phase = 'check';
  let previousStatus = 'idle'; // what we were showing before the current check began
  let errorCount = 0; // lets check() tell whether the "error" event already reported a failure
  let installing = false; // a second click on "Restart" while the first is still quitting does nothing

  function setState(patch) {
    state = { ...state, ...patch };
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) win.webContents.send(CHANNELS.changed, state);
    });
  }

  function handleError(err) {
    errorCount += 1;
    log('error during', phase, err);
    const message = friendlyError(err);

    if (phase === 'download') {
      // The update is still there to retry, so stay on "available" and say what went wrong.
      setState({ status: 'available', percent: null, error: { phase, message } });
      return;
    }
    if (phase === 'install') {
      installing = false;
      setState({ status: 'downloaded', error: { phase, message } });
      return;
    }

    // phase === 'check'. A failed check must never hide an update that's already waiting.
    const waiting = previousStatus === 'available' || previousStatus === 'downloaded';
    if (waiting) setState({ status: previousStatus, error: { phase, message } });
    else setState({ status: 'error', error: { phase, message } });
  }

  if (support.supported) {
    try {
      autoUpdater = loadAutoUpdater();
      // The person decides when to download, and when to install. Closing the app with a downloaded
      // update that they haven't chosen to install leaves it uninstalled.
      autoUpdater.autoDownload = false;
      autoUpdater.autoInstallOnAppQuit = false;
      autoUpdater.allowDowngrade = false;
      autoUpdater.logger = {
        info: (m) => log('info', m),
        warn: (m) => log('warn', m),
        error: (m) => log('error', m),
        debug: (m) => log('debug', m),
      };

      autoUpdater.on('update-available', (info) => setState({ status: 'available', version: info && info.version, percent: null, error: null }));
      autoUpdater.on('update-not-available', () => setState({ status: 'current', version: null, percent: null, error: null }));
      autoUpdater.on('download-progress', (p) => setState({ status: 'downloading', percent: Math.max(0, Math.min(100, Math.floor((p && p.percent) || 0))), error: null }));
      autoUpdater.on('update-downloaded', (info) => {
        // From here on, anything that goes wrong is an install problem, not a download problem.
        phase = 'install';
        setState({ status: 'downloaded', version: (info && info.version) || state.version, percent: 100, error: null });
      });
      autoUpdater.on('error', (err) => handleError(err));
    } catch (e) {
      log("couldn't load electron-updater", e);
      autoUpdater = null;
      state = { ...state, supported: false, reason: 'unavailable', status: 'unsupported' };
    }
  }

  const ready = () => state.supported && autoUpdater;

  async function check() {
    if (!ready()) return state;
    // A check during a check, a download, or with an update already downloaded would only confuse things.
    if (['checking', 'downloading', 'downloaded'].includes(state.status)) return state;

    phase = 'check';
    previousStatus = state.status;
    const errorsBefore = errorCount;
    setState({ status: 'checking', error: null });
    try {
      const result = await autoUpdater.checkForUpdates();
      // electron-updater reports its result through events; this only catches "it did nothing".
      if (state.status === 'checking') setState({ status: result ? 'current' : 'idle' });
    } catch (e) {
      // The "error" event normally got here first and already handled it.
      if (errorCount === errorsBefore) handleError(e);
    }
    return state;
  }

  async function download() {
    if (!ready() || state.status !== 'available') return state;
    phase = 'download';
    setState({ status: 'downloading', percent: 0, error: null });
    const errorsBefore = errorCount;
    try {
      await autoUpdater.downloadUpdate();
    } catch (e) {
      if (errorCount === errorsBefore) handleError(e);
    }
    return state;
  }

  function install() {
    if (!ready() || state.status !== 'downloaded' || installing) return state;
    installing = true;
    phase = 'install';
    setState({ error: null });
    try {
      // (silent, run-after): swap the build in without installer screens, then reopen the app.
      // Quitting runs the app's normal shutdown (before-quit), so a copied password is still
      // cleared from the clipboard, and every unlocked book is locked again by the restart.
      autoUpdater.quitAndInstall(true, true);
    } catch (e) {
      handleError(e);
    }
    return state;
  }

  return { getState: () => state, check, download, install };
}

// None of these take arguments from the renderer, so there is nothing for it to inject.
function registerUpdaterIpc({ ipcMain, updater }) {
  ipcMain.handle(CHANNELS.getState, () => updater.getState());
  ipcMain.handle(CHANNELS.check, async () => { await updater.check(); return updater.getState(); });
  ipcMain.handle(CHANNELS.download, async () => { await updater.download(); return updater.getState(); });
  ipcMain.handle(CHANNELS.install, () => { updater.install(); return updater.getState(); });
}

module.exports = {
  CHANNELS,
  MAC_IN_PLACE_UPDATES,
  detectSupport,
  friendlyError,
  createUpdater,
  registerUpdaterIpc,
};

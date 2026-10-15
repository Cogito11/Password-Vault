const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const { CHANNELS } = require('../updater.js');

// Loads preload.js against a stand-in for Electron and records how the page-facing bridge uses IPC.
function loadPreload() {
  const exposed = {};
  const invoked = [];
  const listeners = new Map();
  const electronStub = {
    contextBridge: { exposeInMainWorld(name, api) { exposed[name] = api; } },
    ipcRenderer: {
      invoke(channel) { invoked.push(channel); return Promise.resolve({ channel }); },
      on(channel, fn) { listeners.set(channel, fn); },
      removeListener(channel, fn) { if (listeners.get(channel) === fn) listeners.delete(channel); },
    },
    shell: {},
    clipboard: {},
  };

  const originalLoad = Module._load;
  Module._load = function (request) {
    if (request === 'electron') return electronStub;
    return originalLoad.apply(this, arguments);
  };

  try {
    const preloadPath = path.join(__dirname, '..', 'preload.js');
    delete require.cache[require.resolve(preloadPath)];
    require(preloadPath);
    return { exposed, invoked, listeners };
  } finally {
    Module._load = originalLoad;
  }
}

test('preload exposes the updater bridge, and loading it registers nothing and calls nothing', () => {
  const { exposed, invoked, listeners } = loadPreload();
  assert.deepEqual(Object.keys(exposed.vaultUpdater).sort(), ['check', 'download', 'getState', 'install', 'onStateChange']);
  assert.equal(invoked.length, 0, 'no IPC at load');
  assert.equal(listeners.size, 0, 'no listeners at load');
});

test('each bridge method calls its own channel, which matches the main process\'s', async () => {
  const { exposed, invoked } = loadPreload();
  await exposed.vaultUpdater.getState();
  await exposed.vaultUpdater.check();
  await exposed.vaultUpdater.download();
  await exposed.vaultUpdater.install();
  assert.deepEqual(invoked, [CHANNELS.getState, CHANNELS.check, CHANNELS.download, CHANNELS.install]);
});

test('onStateChange delivers just the state (not the IPC event), and the returned function unsubscribes', () => {
  const { exposed, listeners } = loadPreload();
  const received = [];
  const stop = exposed.vaultUpdater.onStateChange((s) => received.push(s));

  const listener = listeners.get(CHANNELS.changed);
  assert.equal(typeof listener, 'function');
  listener({ sender: 'internal electron event object' }, { status: 'downloading', percent: 5 });
  assert.deepEqual(received, [{ status: 'downloading', percent: 5 }]);

  stop();
  assert.equal(listeners.has(CHANNELS.changed), false);
});

test('the existing electronAPI and vault bridges are still exposed', () => {
  const { exposed } = loadPreload();
  assert.equal(typeof exposed.electronAPI.getAppVersion, 'function');
  assert.equal(typeof exposed.vault.writeFile, 'function');
});

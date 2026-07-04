const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const fs = require('node:fs');
const path = require('node:path');

const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));

function loadPreloadWithStub() {
  const exposed = {};
  const electronStub = {
    contextBridge: {
      exposeInMainWorld(name, api) {
        exposed[name] = api;
      }
    },
    ipcRenderer: {
      invoke() {}
    },
    shell: {}
  };

  const originalLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request === 'electron') {
      return electronStub;
    }
    return originalLoad.apply(this, arguments);
  };

  try {
    const preloadPath = path.join(__dirname, '..', 'preload.js');
    delete require.cache[require.resolve(preloadPath)];
    require(preloadPath);
    return exposed;
  } finally {
    Module._load = originalLoad;
  }
}

test('preload exposes the app version from package.json', () => {
  const exposed = loadPreloadWithStub();

  assert.equal(typeof exposed.electronAPI.getAppVersion, 'function');
  assert.equal(exposed.electronAPI.getAppVersion(), packageJson.version);
});

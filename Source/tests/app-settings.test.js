const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadSettingsModule(storage) {
  const fullPath = path.join(__dirname, '..', 'PasswordVault/javascript/storage/db.js');
  const source = fs.readFileSync(fullPath, 'utf8');

  const sandbox = {
    console,
    localStorage: storage,
    indexedDB: {
      open() {
        return {
          onupgradeneeded: null,
          onsuccess: null,
          onerror: null,
          result: {
            createObjectStore() {},
            transaction() {
              return {
                objectStore() {
                  return {
                    put() {},
                    get() { return { onsuccess: null, onerror: null }; },
                    delete() {}
                  };
                }
              };
            }
          }
        };
      }
    }
  };

  sandbox.global = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;

  const context = vm.createContext(sandbox);
  vm.runInContext(source, context, { filename: fullPath });
  return sandbox;
}

test('app settings store and restore a selected theme', () => {
  const storage = {
    data: {},
    getItem(key) { return Object.prototype.hasOwnProperty.call(this.data, key) ? this.data[key] : null; },
    setItem(key, value) { this.data[key] = String(value); },
    removeItem(key) { delete this.data[key]; }
  };

  const sandbox = loadSettingsModule(storage);

  assert.equal(sandbox.getAppSettings().theme, 'classic');

  sandbox.saveAppSettings({ theme: 'aurora' });

  const stored = JSON.parse(storage.getItem('pwvault_app_settings'));
  assert.equal(stored.theme, 'aurora');
  assert.equal(sandbox.getAppSettings().theme, 'aurora');
});

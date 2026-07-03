const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function createClassList() {
  return {
    add() {},
    remove() {},
    contains() { return false; }
  };
}

function loadScript(relativePath, overrides = {}) {
  const fullPath = path.join(__dirname, '..', relativePath);
  const source = fs.readFileSync(fullPath, 'utf8');

  const toast = overrides.toast || { textContent: '', classList: createClassList() };
  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    navigator: overrides.navigator || {},
    document: overrides.document || {
      querySelectorAll() { return []; },
      querySelector() { return null; }
    },
    window: overrides.window || {},
    toast,
    localStorage: overrides.localStorage || {
      getItem() { return null; },
      setItem() {},
      removeItem() {}
    },
    crypto: overrides.crypto || globalThis.crypto,
    ...overrides
  };

  sandbox.global = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox.window || {};
  sandbox.window.crypto = sandbox.crypto;
  sandbox.window.navigator = sandbox.navigator;
  sandbox.window.document = sandbox.document;
  sandbox.window.toast = sandbox.toast;
  sandbox.window.localStorage = sandbox.localStorage;

  const context = vm.createContext(sandbox);
  vm.runInContext(source, context, { filename: fullPath });
  return sandbox;
}

test('generatePassword uses crypto randomness when window.crypto is unavailable', () => {
  const cryptoStub = {
    getRandomValues(arr) {
      arr[0] = 0;
      return arr;
    }
  };

  const originalRandom = Math.random;
  Math.random = () => 0.9999;

  try {
    const sandbox = loadScript('PasswordVault/javascript/core/generator.js', {
      window: {},
      crypto: cryptoStub
    });

    const password = sandbox.generatePassword({ length: 4, upper: true, lower: false, numbers: false, symbols: false });
    assert.equal(password, 'AAAA');
  } finally {
    Math.random = originalRandom;
  }
});

test('buildFileText formats entries into a readable export string', () => {
  const sandbox = loadScript('PasswordVault/javascript/core/utils.js');
  const entries = [
    {
      name: 'Example',
      attrs: [
        { key: 'username', val: 'john' },
        { key: 'password', val: 'secret' }
      ]
    }
  ];

  const text = sandbox.buildFileText(entries);
  assert.equal(text, 'Example (2 attributes)\n    username: john\n    password: secret\n\nEnd');
});

test('showToast does not throw when the toast element is missing', () => {
  const sandbox = loadScript('PasswordVault/javascript/core/utils.js', {
    navigator: {},
    window: {},
    toast: undefined
  });

  assert.doesNotThrow(() => sandbox.showToast('Hello'));
});

test('esc safely escapes HTML-sensitive characters', () => {
  const sandbox = loadScript('PasswordVault/javascript/core/utils.js');
  assert.equal(sandbox.esc('<script>"x" & y</script>'), '&lt;script&gt;&quot;x&quot; &amp; y&lt;/script&gt;');
});

test('copyVal does not throw when the clipboard API is unavailable', () => {
  const sandbox = loadScript('PasswordVault/javascript/core/utils.js', {
    navigator: {},
    window: {},
    toast: { textContent: '', classList: createClassList() }
  });

  const btn = {
    dataset: { val: 'top-secret' },
    textContent: 'Copy',
    classList: createClassList()
  };

  assert.doesNotThrow(() => sandbox.copyVal(btn));
});

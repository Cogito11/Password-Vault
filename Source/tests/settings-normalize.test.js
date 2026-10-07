const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function load(file, extra = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', 'PasswordVault/javascript', file), 'utf8');
  const store = new Map();
  const sandbox = {
    console,
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) },
    ...extra
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  sandbox.__store = store;
  return sandbox;
}

const plain = (x) => JSON.parse(JSON.stringify(x));

test('security settings are all off by default, with sensible values ready', () => {
  const { getAppSettings } = load('storage/db.js');
  const s = plain(getAppSettings());
  assert.equal(s.autoLockEnabled, false);
  assert.equal(s.autoLockMinutes, 5);
  assert.equal(s.lockOnSystemLock, false);
  assert.equal(s.clearClipboardEnabled, false);
  assert.equal(s.clearClipboardSeconds, 30);
});

test('wrong types fall back to the defaults', () => {
  const { normalizeAppSettings } = load('storage/db.js');
  const s = plain(normalizeAppSettings({ generatorLength: 'banana', autoLockEnabled: 'yes', theme: 42, clearClipboardEnabled: 1, autoLockMinutes: null, lockOnSystemLock: {} }));
  assert.equal(s.generatorLength, 15);
  assert.equal(s.autoLockEnabled, false);
  assert.equal(s.theme, 'classic');
  assert.equal(s.clearClipboardEnabled, false);
  assert.equal(s.autoLockMinutes, 5);
  assert.equal(s.lockOnSystemLock, false);
});

test('numbers are rounded and clamped into their allowed ranges', () => {
  const { normalizeAppSettings } = load('storage/db.js');
  assert.equal(normalizeAppSettings({ generatorLength: 1 }).generatorLength, 4);
  assert.equal(normalizeAppSettings({ generatorLength: 500 }).generatorLength, 64);
  assert.equal(normalizeAppSettings({ generatorLength: '20' }).generatorLength, 20);
  assert.equal(normalizeAppSettings({ generatorLength: 12.6 }).generatorLength, 13);
  assert.equal(normalizeAppSettings({ autoLockMinutes: 0 }).autoLockMinutes, 1);
  assert.equal(normalizeAppSettings({ autoLockMinutes: 99999 }).autoLockMinutes, 60);
  assert.equal(normalizeAppSettings({ clearClipboardSeconds: -5 }).clearClipboardSeconds, 5);
  assert.equal(normalizeAppSettings({ clearClipboardSeconds: 9000 }).clearClipboardSeconds, 120);
  assert.equal(normalizeAppSettings({ generatorLength: NaN }).generatorLength, 15);
  assert.equal(normalizeAppSettings({ generatorLength: Infinity }).generatorLength, 15);
});

test('only known themes are accepted, case-insensitively', () => {
  const { normalizeAppSettings } = load('storage/db.js');
  for (const t of ['classic', 'aurora', 'ember', 'forest', 'midnight', 'manilla']) assert.equal(normalizeAppSettings({ theme: t }).theme, t);
  assert.equal(normalizeAppSettings({ theme: 'EMBER' }).theme, 'ember');
  assert.equal(normalizeAppSettings({ theme: '<script>' }).theme, 'classic');
  assert.equal(normalizeAppSettings({ theme: '' }).theme, 'classic');
});

test('the generator always keeps at least one character type', () => {
  const { normalizeAppSettings } = load('storage/db.js');
  const s = plain(normalizeAppSettings({ generatorUpper: false, generatorLower: false, generatorNumbers: false, generatorSymbols: false }));
  assert.ok(s.generatorUpper && s.generatorLower && s.generatorNumbers && s.generatorSymbols);
  const one = plain(normalizeAppSettings({ generatorUpper: false, generatorLower: true, generatorNumbers: false, generatorSymbols: false }));
  assert.equal(one.generatorLower, true);
  assert.equal(one.generatorUpper, false);
});

test('unknown keys are dropped and non-objects are tolerated', () => {
  const { normalizeAppSettings } = load('storage/db.js');
  assert.deepEqual(Object.keys(normalizeAppSettings({ evil: 1, __proto__: { x: 1 } })).sort(), Object.keys(normalizeAppSettings({})).sort());
  for (const bad of [null, undefined, 'str', 7, [], [1, 2]]) assert.equal(normalizeAppSettings(bad).generatorLength, 15);
});

test('corrupt stored settings load as defaults instead of throwing', () => {
  const db = load('storage/db.js');
  db.__store.set('pwvault_app_settings', '{not json');
  assert.equal(db.getAppSettings().generatorLength, 15);
  db.__store.set('pwvault_app_settings', JSON.stringify({ generatorLength: 'x', autoLockMinutes: 99999 }));
  const s = db.getAppSettings();
  assert.equal(s.generatorLength, 15);
  assert.equal(s.autoLockMinutes, 60);
});

test('saving merges, validates, and keeps what was already stored', () => {
  const db = load('storage/db.js');
  db.saveAppSettings({ autoLockEnabled: true, autoLockMinutes: 15 });
  db.saveAppSettings({ clearClipboardEnabled: true, clearClipboardSeconds: 9999 });
  const s = db.getAppSettings();
  assert.equal(s.autoLockEnabled, true);
  assert.equal(s.autoLockMinutes, 15);
  assert.equal(s.clearClipboardEnabled, true);
  assert.equal(s.clearClipboardSeconds, 120);
});

test('the generator refuses to fall back to an insecure random source', () => {
  const gen = load('core/generator.js', { window: {} });
  assert.throws(() => gen.genRandInt(10), /Secure random/);
});

test('genRandInt stays inside the range and uses every value', () => {
  const nodeCrypto = require('node:crypto');
  const gen = load('core/generator.js', { window: { crypto: { getRandomValues: (a) => nodeCrypto.getRandomValues(a) } } });
  const seen = new Set();
  for (let i = 0; i < 4000; i++) {
    const n = gen.genRandInt(7);
    assert.ok(Number.isInteger(n) && n >= 0 && n < 7);
    seen.add(n);
  }
  assert.equal(seen.size, 7);
});

test('genRandInt discards values from the partial bucket (no modulo bias)', () => {
  // max 3: 4294967296 is not a multiple of 3, so values >= 4294967295 must be rejected
  const queue = [4294967295, 4294967295, 7];
  const gen = load('core/generator.js', { window: { crypto: { getRandomValues: (a) => { a[0] = queue.shift(); return a; } } } });
  assert.equal(gen.genRandInt(3), 7 % 3);
  assert.equal(queue.length, 0);
});

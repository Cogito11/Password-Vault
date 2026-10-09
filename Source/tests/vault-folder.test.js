const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadVaultIo(readDirEntries) {
  const source = fs.readFileSync(path.join(__dirname, '..', 'PasswordVault/javascript/storage/vault-io.js'), 'utf8');
  const sandbox = { console, window: { vault: { readDir: () => readDirEntries } } };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox;
}

const file = (name) => ({ name, isFile: true, isDirectory: false });
const dir = (name) => ({ name, isFile: false, isDirectory: true });

test('the app recognises the files it creates', () => {
  const { isVaultOwnedFile } = loadVaultIo([]);
  for (const n of ['Banking.txt', 'BANKING.TXT', 'vault.enc', 'vault.enc.bak', 'vault.enc.bak.tmp', 'Social.txt.tmp-4242-0-lk2x9', 'vault.enc.tmp-1-12-abc']) {
    assert.equal(isVaultOwnedFile(n), true, n);
  }
});

test('the app does not claim files it did not create', () => {
  const { isVaultOwnedFile } = loadVaultIo([]);
  for (const n of ['return-2025.pdf', 'photo.jpg', 'notes.docx', 'vault.enc.old', 'vault.encx', 'archive.zip', 'tmp-123']) {
    assert.equal(isVaultOwnedFile(n), false, n);
  }
});

test('operating-system clutter is recognised', () => {
  const { isOsJunkFile } = loadVaultIo([]);
  for (const n of ['.DS_Store', 'Thumbs.db', 'desktop.ini', 'THUMBS.DB']) assert.equal(isOsJunkFile(n), true, n);
  assert.equal(isOsJunkFile('notes.txt'), false);
});

test('a folder containing only vault files and OS clutter can be removed entirely', () => {
  const { inspectBookFolder } = loadVaultIo([file('A.txt'), file('vault.enc'), file('vault.enc.bak'), file('.DS_Store')]);
  const r = inspectBookFolder('/book');
  assert.deepEqual([...r.removable].sort(), ['.DS_Store', 'A.txt', 'vault.enc', 'vault.enc.bak']);
  assert.deepEqual([...r.others], []);
});

test('user files and sub-folders are reported as "others" and never as removable', () => {
  const { inspectBookFolder } = loadVaultIo([file('A.txt'), file('return-2025.pdf'), dir('Receipts'), file('Thumbs.db')]);
  const r = inspectBookFolder('/book');
  assert.deepEqual([...r.others].sort(), ['Receipts', 'return-2025.pdf']);
  assert.ok(!r.removable.includes('return-2025.pdf'));
  assert.ok(!r.removable.includes('Receipts'));
});

test('an empty folder has nothing to delete and nothing blocking', () => {
  const { inspectBookFolder } = loadVaultIo([]);
  const r = inspectBookFolder('/book');
  assert.deepEqual([...r.removable], []);
  assert.deepEqual([...r.others], []);
});

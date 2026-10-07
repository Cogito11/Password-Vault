const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

const cryptoApi = webcrypto || globalThis.crypto;

function loadCryptoModule() {
  const fullPath = path.join(__dirname, '..', 'PasswordVault/javascript/storage/crypto.js');
  const source = fs.readFileSync(fullPath, 'utf8');

  const cryptoStub = {
    subtle: cryptoApi?.subtle,
    getRandomValues(array) {
      return cryptoApi.getRandomValues(array);
    }
  };

  const sandbox = {
    console,
    crypto: cryptoStub,
    TextEncoder,
    TextDecoder,
    Uint8Array,
    JSON,
    setTimeout,
    clearTimeout
  };

  sandbox.global = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;

  const context = vm.createContext(sandbox);
  vm.runInContext(source, context, { filename: fullPath });
  return sandbox;
}

test('packEncrypted and decrypt round-trip the vault payload correctly', async () => {
  const sandbox = loadCryptoModule();
  const payload = {
    collections: {
      General: [
        { name: 'Example', attrs: [{ key: 'username', val: 'john' }, { key: 'password', val: 'secret' }] }
      ]
    }
  };

  const password = 'super-secure-password';
  const bytes = await sandbox.packEncrypted(payload, password);

  assert.ok(bytes instanceof Uint8Array);
  assert.ok(bytes.length > 28);

  const salt = bytes.slice(0, 16);
  const iv = bytes.slice(16, 28);
  const ciphertext = bytes.slice(28);

  assert.equal(salt.length, 16);
  assert.equal(iv.length, 12);
  assert.ok(ciphertext.length > 0);

  const key = await sandbox.deriveKey(password, salt);
  const decrypted = await cryptoApi.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  const decoded = JSON.parse(new TextDecoder().decode(decrypted));

  assert.deepEqual(decoded, payload);
});

test('reEncryptVault reuses the in-memory salt, never reads the file, and asks for a backup', async () => {
  const sandbox = loadCryptoModule();
  const password = 'master-password';
  const originalPayload = { collections: { Inbox: [{ name: 'GitHub', attrs: [{ key: 'token', val: 'abc123' }] }] } };

  const originalBytes = await sandbox.packEncrypted(originalPayload, password);
  const salt = originalBytes.slice(0, 16);
  const key = await sandbox.deriveKey(password, salt);

  let written = null;
  let diskReads = 0;

  sandbox.isMultiBookMode = true;
  sandbox.activeBookName = 'Work';
  sandbox.bookHandles = { Work: { key, salt, isEncrypted: true, isUnlocked: true, collections: originalPayload.collections } };
  sandbox.collections = originalPayload.collections;
  sandbox.namedBookReadBin = () => { diskReads += 1; return originalBytes; };
  sandbox.bookReadBin = () => { diskReads += 1; return originalBytes; };
  sandbox.namedBookWriteBin = (book, filename, bytes, opts) => { written = { book, filename, bytes, opts }; };

  await sandbox.reEncryptVault();

  assert.equal(diskReads, 0, 'the salt must come from memory, not from re-reading the file');
  assert.equal(written.book, 'Work');
  assert.equal(written.filename, 'vault.enc');
  assert.deepEqual({ ...written.opts }, { backup: true });
  assert.ok(written.bytes instanceof Uint8Array);
  assert.deepEqual(written.bytes.slice(0, 16), salt);
  assert.notDeepEqual(written.bytes.slice(16, 28), originalBytes.slice(16, 28));

  const decrypted = await cryptoApi.subtle.decrypt({ name: 'AES-GCM', iv: written.bytes.slice(16, 28) }, key, written.bytes.slice(28));
  assert.deepEqual(JSON.parse(new TextDecoder().decode(decrypted)), { collections: originalPayload.collections });
});

test('reEncryptBook refuses to write when the book is locked (no key or salt in memory)', async () => {
  const sandbox = loadCryptoModule();
  let wrote = false;

  sandbox.isMultiBookMode = true;
  sandbox.activeBookName = 'Work';
  sandbox.bookHandles = { Work: { key: null, salt: null, isEncrypted: true, isUnlocked: false, collections: {} } };
  sandbox.collections = {};
  sandbox.namedBookWriteBin = () => { wrote = true; };

  await assert.rejects(() => sandbox.reEncryptBook('Work'), /locked/i);
  assert.equal(wrote, false);
});

test('reEncryptBook saves a non-active book from its own collections', async () => {
  const sandbox = loadCryptoModule();
  const password = 'pw-for-other-book';
  const bytes = await sandbox.packEncrypted({ collections: {} }, password);
  const salt = bytes.slice(0, 16);
  const key = await sandbox.deriveKey(password, salt);
  const otherCollections = { Other: [{ name: 'Site', attrs: [{ key: 'Password', val: 'x' }] }] };

  let written = null;
  sandbox.isMultiBookMode = true;
  sandbox.activeBookName = 'Active';
  sandbox.bookHandles = { Other: { key, salt, isEncrypted: true, isUnlocked: true, collections: otherCollections } };
  sandbox.collections = { ShouldNotBeSaved: [] };
  sandbox.namedBookWriteBin = (book, filename, b) => { written = b; };

  await sandbox.reEncryptBook('Other');

  const pt = await cryptoApi.subtle.decrypt({ name: 'AES-GCM', iv: written.slice(16, 28) }, key, written.slice(28));
  assert.deepEqual(JSON.parse(new TextDecoder().decode(pt)), { collections: otherCollections });
});

test('verifyEncryptedBook accepts a file that decrypts to exactly the expected data', async () => {
  const sandbox = loadCryptoModule();
  const collections = { A: [{ name: 'x', attrs: [{ key: 'k', val: 'v' }] }] };
  const bytes = await sandbox.packEncrypted({ collections }, 'pw');
  const key = await sandbox.deriveKey('pw', bytes.slice(0, 16));
  sandbox.namedBookReadBin = () => bytes;

  await sandbox.verifyEncryptedBook('Book', key, collections);
});

test('verifyEncryptedBook rejects wrong data, a damaged file and a truncated file', async () => {
  const sandbox = loadCryptoModule();
  const collections = { A: [{ name: 'x', attrs: [] }] };
  const bytes = await sandbox.packEncrypted({ collections }, 'pw');
  const key = await sandbox.deriveKey('pw', bytes.slice(0, 16));

  sandbox.namedBookReadBin = () => bytes;
  await assert.rejects(() => sandbox.verifyEncryptedBook('Book', key, { A: [] }), /does not match/);

  const damaged = bytes.slice();
  damaged[damaged.length - 1] ^= 0xff;
  sandbox.namedBookReadBin = () => damaged;
  await assert.rejects(() => sandbox.verifyEncryptedBook('Book', key, collections));

  sandbox.namedBookReadBin = () => bytes.slice(0, 20);
  await assert.rejects(() => sandbox.verifyEncryptedBook('Book', key, collections), /too short/);
});

test('vault I/O can save and read encrypted bytes through the active book path', async () => {
  const fullPath = path.join(__dirname, '..', 'PasswordVault/javascript/storage/vault-io.js');
  const source = fs.readFileSync(fullPath, 'utf8');
  const files = new Map();

  const sandbox = {
    console,
    window: {
      vault: {
        joinPath: (dir, filename) => `${dir}/${filename}`,
        writeFileBin: (pathName, bytes) => {
          files.set(pathName, new Uint8Array(bytes));
        },
        readFileBin: (pathName) => files.get(pathName) || new Uint8Array()
      }
    },
    isMultiBookMode: false,
    activeBookHandle: null,
    dirHandle: null,
    _electronVaultPath: '/tmp/vault',
    TextEncoder,
    Uint8Array
  };

  sandbox.global = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.window.window = sandbox.window;

  const context = vm.createContext(sandbox);
  vm.runInContext(source, context, { filename: fullPath });

  const bytes = new Uint8Array([1, 2, 3, 4]);
  await sandbox.bookWriteBin('vault.enc', bytes);
  const loaded = sandbox.bookReadBin('vault.enc');

  assert.deepEqual(loaded, bytes);
  assert.deepEqual(files.get('/tmp/vault/vault.enc'), bytes);
});

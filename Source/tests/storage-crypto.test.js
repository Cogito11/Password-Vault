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

test('reEncryptVault preserves the salt and writes a new encrypted payload', async () => {
  const sandbox = loadCryptoModule();
  const password = 'master-password';
  const originalPayload = { collections: { Inbox: [{ name: 'GitHub', attrs: [{ key: 'token', val: 'abc123' }] }] } };

  const originalBytes = await sandbox.packEncrypted(originalPayload, password);
  const salt = originalBytes.slice(0, 16);
  const key = await sandbox.deriveKey(password, salt);

  let writtenBytes = null;
  let readCalls = 0;

  sandbox.getBookKey = () => key;
  sandbox.bookReadBin = () => {
    readCalls += 1;
    return originalBytes;
  };
  sandbox.bookWriteBin = (filename, bytes) => {
    writtenBytes = bytes;
  };
  sandbox.collections = originalPayload.collections;

  await sandbox.reEncryptVault();

  assert.equal(readCalls, 1);
  assert.ok(writtenBytes instanceof Uint8Array);
  assert.equal(writtenBytes.slice(0, 16).length, 16);
  assert.deepEqual(writtenBytes.slice(0, 16), salt);
  assert.notDeepEqual(writtenBytes.slice(16, 28), originalBytes.slice(16, 28));

  const newIv = writtenBytes.slice(16, 28);
  const newCiphertext = writtenBytes.slice(28);
  const decrypted = await cryptoApi.subtle.decrypt({ name: 'AES-GCM', iv: newIv }, key, newCiphertext);
  const decoded = JSON.parse(new TextDecoder().decode(decrypted));

  assert.deepEqual(decoded, { collections: originalPayload.collections });
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

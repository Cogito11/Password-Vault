const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

const HOST = path.join(__dirname, '..', '..', 'BrowserExtension', 'password-vault-host.js');
const COUNTER = path.join(__dirname, 'fixtures', 'count-pbkdf2.js');
const PASSWORD = 'correct horse battery staple';

// Writes <root>/Main/vault.enc the way the app does: salt(16) + iv(12) + ciphertext + tag(16)
function writeBook(root, contents, password, salt) {
  const iv = crypto.randomBytes(12);
  const key = crypto.pbkdf2Sync(password, salt, 200000, 32, 'sha256');
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([cipher.update(Buffer.from(JSON.stringify(contents))), cipher.final()]);
  fs.writeFileSync(path.join(root, 'Main', 'vault.enc'), Buffer.concat([salt, iv, body, cipher.getAuthTag()]));
}
function readBook(root, password) {
  const file = fs.readFileSync(path.join(root, 'Main', 'vault.enc'));
  const key = crypto.pbkdf2Sync(password, file.subarray(0, 16), 200000, 32, 'sha256');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, file.subarray(16, 28));
  decipher.setAuthTag(file.subarray(file.length - 16));
  return JSON.parse(Buffer.concat([decipher.update(file.subarray(28, -16)), decipher.final()]).toString('utf8'));
}
const sample = () => ({ collections: { 'Personal.txt': [
  { name: 'GitHub', attrs: [{ key: 'URL', val: 'https://github.com/login' }, { key: 'Username', val: 'me' }, { key: 'Password', val: 'pw-1' }] },
  { name: 'Bank', attrs: [{ key: 'URL', val: 'https://bank.example/' }, { key: 'Username', val: 'me' }, { key: 'Password', val: 'pw-2' }] },
] } });

// A temp vault folder with one encrypted book, and a running host that counts key derivations
function startHost(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pv-host-'));
  const root = path.join(dir, 'vault');
  fs.mkdirSync(path.join(root, 'Main'), { recursive: true });
  writeBook(root, sample(), PASSWORD, crypto.randomBytes(16));
  const config = path.join(dir, 'vault-config.json');
  fs.writeFileSync(config, JSON.stringify({ defaultVaultPath: root }));
  const log = path.join(dir, 'pbkdf2.log');
  fs.writeFileSync(log, '');

  const child = spawn(process.execPath, ['--require', COUNTER, HOST], {
    env: { ...process.env, PASSWORD_VAULT_CONFIG_PATH: config, PV_PBKDF2_LOG: log },
    stdio: ['pipe', 'pipe', 'inherit'],
  });
  let buf = Buffer.alloc(0); let next = 0; const waiting = new Map();
  child.stdout.on('data', chunk => {
    buf = Buffer.concat([buf, chunk]);
    while (buf.length >= 4 && buf.length >= buf.readUInt32LE(0) + 4) {
      const len = buf.readUInt32LE(0);
      const msg = JSON.parse(buf.subarray(4, len + 4).toString('utf8')); buf = buf.subarray(len + 4);
      const done = waiting.get(msg.requestId); waiting.delete(msg.requestId); if (done) done(msg);
    }
  });
  t.after(() => { child.kill(); fs.rmSync(dir, { recursive: true, force: true }); });
  return {
    root,
    derivations: () => fs.readFileSync(log, 'utf8').split('\n').filter(Boolean).length,
    send: payload => new Promise(resolve => {
      const requestId = ++next; waiting.set(requestId, resolve);
      const data = Buffer.from(JSON.stringify({ ...payload, requestId })); const head = Buffer.alloc(4); head.writeUInt32LE(data.length);
      child.stdin.write(Buffer.concat([head, data]));
    }),
  };
}

test('derives the key once per unlock, not once per request', async t => {
  const host = startHost(t);
  assert.equal((await host.send({ type: 'unlockBook', bookId: 'Main', password: PASSWORD })).ok, true);
  assert.equal(host.derivations(), 1);

  for (let i = 0; i < 5; i++) {
    const r = await host.send({ type: 'getBookEntries', bookId: 'Main' });
    assert.equal(r.ok, true); assert.equal(r.locked, false); assert.equal(r.entries.length, 2);
  }
  assert.equal(host.derivations(), 1);

  assert.equal((await host.send({ type: 'saveCredential', bookId: 'Main', url: 'https://example.org/login', username: 'new@example.org', password: 'pw-3', name: 'Example' })).ok, true);
  assert.equal(host.derivations(), 1);

  // The saved file must be a valid book for the original password, and the host sees the new entry
  const saved = readBook(host.root, PASSWORD);
  assert.equal(saved.collections['Browser Extension.txt'][0].attrs.find(a => a.key === 'Password').val, 'pw-3');
  assert.equal((await host.send({ type: 'getBookEntries', bookId: 'Main' })).entries.length, 3);
  // saving again updates the same entry instead of adding another
  await host.send({ type: 'saveCredential', bookId: 'Main', url: 'https://example.org/login', username: 'new@example.org', password: 'pw-4' });
  assert.equal((await host.send({ type: 'getBookEntries', bookId: 'Main' })).entries.length, 3);
  assert.equal(host.derivations(), 1);
});

test('a wrong password is rejected and leaves the book locked', async t => {
  const host = startHost(t);
  const bad = await host.send({ type: 'unlockBook', bookId: 'Main', password: 'nope' });
  assert.equal(bad.ok, false); assert.match(bad.error, /Incorrect password/);
  const r = await host.send({ type: 'getBookEntries', bookId: 'Main' });
  assert.equal(r.locked, true); assert.deepEqual(r.entries, []);
  assert.equal((await host.send({ type: 'saveCredential', bookId: 'Main', url: 'https://a.example', username: 'u', password: 'p' })).ok, false);
});

test('an unlocked book still rejects a wrong password (the cached key is never used for a different password)', async t => {
  const host = startHost(t);
  assert.equal((await host.send({ type: 'unlockBook', bookId: 'Main', password: PASSWORD })).ok, true);
  const bad = await host.send({ type: 'unlockBook', bookId: 'Main', password: 'nope' });
  assert.equal(bad.ok, false); assert.match(bad.error, /Incorrect password/);
  // the failed attempt must not replace the stored password or the cached key
  assert.equal((await host.send({ type: 'getBookEntries', bookId: 'Main' })).entries.length, 2);
  assert.equal((await host.send({ type: 'unlockBook', bookId: 'Main', password: PASSWORD })).ok, true);
});

test('locking forgets the key: entries are locked until the book is unlocked (and re-derived) again', async t => {
  const host = startHost(t);
  await host.send({ type: 'unlockBook', bookId: 'Main', password: PASSWORD });
  assert.equal((await host.send({ type: 'getBookEntries', bookId: 'Main' })).entries.length, 2);

  await host.send({ type: 'lock' });
  const locked = await host.send({ type: 'getBookEntries', bookId: 'Main' });
  assert.equal(locked.locked, true); assert.deepEqual(locked.entries, []);
  assert.equal((await host.send({ type: 'saveCredential', bookId: 'Main', url: 'https://a.example', username: 'u', password: 'p' })).ok, false);
  assert.equal((await host.send({ type: 'listBooks' })).books[0].unlocked, false);
  assert.equal(host.derivations(), 1);

  // A wrong password after a lock must not be accepted because of a leftover key
  assert.equal((await host.send({ type: 'unlockBook', bookId: 'Main', password: 'nope' })).ok, false);
  assert.equal((await host.send({ type: 'unlockBook', bookId: 'Main', password: PASSWORD })).ok, true);
  assert.equal(host.derivations(), 3);
  assert.equal((await host.send({ type: 'getBookEntries', bookId: 'Main' })).entries.length, 2);
  assert.equal(host.derivations(), 3);
});

test('a re-encrypted book (new salt) is picked up: one fresh derivation, then cached again', async t => {
  const host = startHost(t);
  await host.send({ type: 'unlockBook', bookId: 'Main', password: PASSWORD });
  await host.send({ type: 'getBookEntries', bookId: 'Main' });
  assert.equal(host.derivations(), 1);

  const changed = sample(); changed.collections['Personal.txt'].pop();
  writeBook(host.root, changed, PASSWORD, crypto.randomBytes(16)); // what the app does when it saves with a fresh salt
  const r = await host.send({ type: 'getBookEntries', bookId: 'Main' });
  assert.equal(r.ok, true); assert.equal(r.entries.length, 1);
  assert.equal(host.derivations(), 2); // only the host's derivations are counted, not the test helper's
  await host.send({ type: 'getBookEntries', bookId: 'Main' });
  assert.equal(host.derivations(), 2);
});

test('a book whose password was changed is reported as unreadable, never decrypted with the old key', async t => {
  const host = startHost(t);
  await host.send({ type: 'unlockBook', bookId: 'Main', password: PASSWORD });
  writeBook(host.root, sample(), 'a different password', crypto.randomBytes(16));
  const r = await host.send({ type: 'getBookEntries', bookId: 'Main' });
  assert.equal(r.ok, false); assert.match(r.error, /Incorrect password|unreadable/);
});

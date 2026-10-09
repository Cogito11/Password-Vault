const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { writeFileAtomic } = require('../fs-atomic');

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'pv-atomic-'));
}

test('writes a new file', () => {
  const dir = tmpDir();
  const f = path.join(dir, 'a.txt');
  writeFileAtomic(f, 'hello');
  assert.equal(fs.readFileSync(f, 'utf8'), 'hello');
});

test('replaces an existing file and leaves no temp files behind', () => {
  const dir = tmpDir();
  const f = path.join(dir, 'a.txt');
  fs.writeFileSync(f, 'old');
  writeFileAtomic(f, 'new');
  assert.equal(fs.readFileSync(f, 'utf8'), 'new');
  assert.deepEqual(fs.readdirSync(dir), ['a.txt']);
});

test('writes binary data exactly', () => {
  const dir = tmpDir();
  const f = path.join(dir, 'vault.enc');
  const bytes = Buffer.from([0, 255, 1, 254, 2, 253]);
  writeFileAtomic(f, bytes);
  assert.ok(fs.readFileSync(f).equals(bytes));
});

test('exclusive mode refuses to overwrite and leaves the file alone', () => {
  const dir = tmpDir();
  const f = path.join(dir, 'vault.enc');
  fs.writeFileSync(f, 'precious');
  assert.throws(() => writeFileAtomic(f, 'clobber', { exclusive: true }), { code: 'EEXIST' });
  assert.equal(fs.readFileSync(f, 'utf8'), 'precious');
  assert.deepEqual(fs.readdirSync(dir), ['vault.enc']);
});

test('exclusive mode creates a file that does not exist yet', () => {
  const dir = tmpDir();
  const f = path.join(dir, 'new.txt');
  writeFileAtomic(f, 'x', { exclusive: true });
  assert.equal(fs.readFileSync(f, 'utf8'), 'x');
});

test('backup keeps the previous version as .bak', () => {
  const dir = tmpDir();
  const f = path.join(dir, 'vault.enc');
  fs.writeFileSync(f, 'v1');
  writeFileAtomic(f, 'v2', { backup: true });
  assert.equal(fs.readFileSync(f, 'utf8'), 'v2');
  assert.equal(fs.readFileSync(f + '.bak', 'utf8'), 'v1');
  writeFileAtomic(f, 'v3', { backup: true });
  assert.equal(fs.readFileSync(f + '.bak', 'utf8'), 'v2');
  assert.deepEqual(fs.readdirSync(dir).sort(), ['vault.enc', 'vault.enc.bak']);
});

test('no backup is created when there is nothing to back up', () => {
  const dir = tmpDir();
  const f = path.join(dir, 'vault.enc');
  writeFileAtomic(f, 'v1', { backup: true });
  assert.deepEqual(fs.readdirSync(dir), ['vault.enc']);
});

test('a failed write leaves the original untouched and cleans up', () => {
  const dir = tmpDir();
  const f = path.join(dir, 'a.txt');
  fs.writeFileSync(f, 'original');
  // Writing a value fs cannot serialise makes the write fail after the temp file exists
  assert.throws(() => writeFileAtomic(f, { not: 'writable' }));
  assert.equal(fs.readFileSync(f, 'utf8'), 'original');
  assert.deepEqual(fs.readdirSync(dir), ['a.txt']);
});

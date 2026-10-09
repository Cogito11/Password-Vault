const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadUtils() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'PasswordVault/javascript/core/utils.js'), 'utf8');
  const sandbox = { console };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox;
}

const { sanitizeName, nameKey, findByData } = loadUtils();

test('keeps ordinary names unchanged', () => {
  const r = sanitizeName('Work Passwords');
  assert.equal(r.name, 'Work Passwords');
  assert.equal(r.changed, false);
  assert.equal(r.error, null);
});

test('keeps accented and non-Latin names as typed', () => {
  for (const n of ['Café', 'Crédito', 'Банк', '银行', 'Trabajo ñ', '日本語 パスワード']) {
    const r = sanitizeName(n);
    assert.equal(r.name, n);
    assert.equal(r.error, null);
    assert.equal(r.changed, false);
  }
});

test('removes characters no file system allows and reports the change', () => {
  const r = sanitizeName('Bank: "Main" / <Home>?*');
  assert.equal(r.name, 'Bank Main Home');
  assert.equal(r.changed, true);
  assert.equal(r.error, null);
});

test('path separators and ".." cannot escape the folder', () => {
  assert.equal(sanitizeName('../../etc').name, 'etc');
  assert.equal(sanitizeName('a\\b').name, 'ab');
  assert.equal(sanitizeName('..').error, 'Enter a valid name.');
  assert.equal(sanitizeName('.hidden').name, 'hidden');
});

test('trailing dots and spaces are dropped, inner dots are kept', () => {
  assert.equal(sanitizeName('Notes. . ').name, 'Notes');
  assert.equal(sanitizeName('v1.2 passwords').name, 'v1.2 passwords');
});

test('whitespace is trimmed and collapsed', () => {
  assert.equal(sanitizeName('   a    b   ').name, 'a b');
});

test('empty or symbol-only names are rejected', () => {
  assert.equal(sanitizeName('').error, 'Enter a valid name.');
  assert.equal(sanitizeName('   ').error, 'Enter a valid name.');
  assert.equal(sanitizeName('???').error, 'Enter a valid name.');
  assert.equal(sanitizeName(null).error, 'Enter a valid name.');
});

test('Windows reserved device names are rejected', () => {
  for (const n of ['CON', 'con', 'NUL', 'Aux', 'COM1', 'lpt9', 'CON.txt']) {
    assert.match(sanitizeName(n).error, /reserved/, n);
  }
  assert.equal(sanitizeName('CONSOLE').error, null);
  assert.equal(sanitizeName('COM10').error, null);
});

test('very long names are cut to 100 characters without splitting emoji', () => {
  const long = '😀'.repeat(150);
  const r = sanitizeName(long);
  assert.equal(Array.from(r.name).length, 100);
  assert.equal(r.changed, true);
});

test('nameKey treats case differences as the same name', () => {
  assert.equal(nameKey('Banking'), nameKey('banking'));
  assert.equal(nameKey('BANKING.txt'), nameKey('banking.TXT'));
  assert.notEqual(nameKey('Banking'), nameKey('Banks'));
});

test('nameKey treats composed and decomposed accents as the same name', () => {
  assert.equal(nameKey('Caf\u00e9'), nameKey('Cafe\u0301'));
});

test('findByData matches values containing quotes and brackets', () => {
  const nodes = ['plain.txt', 'Q"uote.txt', 'br]acket[.txt', 'back\\slash.txt'].map((v) => ({ dataset: { file: v }, v }));
  const root = { querySelectorAll: () => nodes };
  for (const n of nodes) assert.equal(findByData(root, 'file', n.v), n);
  assert.equal(findByData(root, 'file', 'missing.txt'), null);
  assert.equal(findByData(null, 'file', 'x'), null);
});

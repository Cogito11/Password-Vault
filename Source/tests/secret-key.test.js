const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'PasswordVault/javascript/core/utils.js'), 'utf8'), sandbox);
const { isSecretKey } = sandbox;

test('classic secret labels are hidden', () => {
  for (const k of ['Password', 'password', 'PASSWORD', 'Passphrase', 'Passcode', 'PIN', 'Pin', 'API Key', 'apiKey', 'API_KEY', 'api-key',
    'Token', 'Access Token', 'Secret', 'Client Secret', 'Private key (PEM)', 'Wi-Fi Key', 'Key', 'Keys', 'Master Password', 'Password hint', 'Pass']) {
    assert.equal(isSecretKey(k), true, k);
  }
});

test('financial and identity secrets are hidden', () => {
  for (const k of ['CVV', 'CVC', 'Card number', 'Account number', 'Routing number', 'SSN', 'Social Security number', 'Passport number', 'Tax number']) {
    assert.equal(isSecretKey(k), true, k);
  }
});

test('recovery material is hidden', () => {
  for (const k of ['Recovery code', 'Recovery codes', 'Backup codes', 'Security code', 'Security answer', 'Security Answer 1', '2FA code', '2FA', 'MFA secret', 'OTP', 'TOTP seed', 'Seed phrase', 'Mnemonic', 'Credentials', 'Credential']) {
    assert.equal(isSecretKey(k), true, k);
  }
});

test('ordinary labels that merely CONTAIN secret-looking letters are shown', () => {
  for (const k of ['Shipping address', 'Opinion', 'Mapping', 'Spinning class', 'Monkey', 'Turkey', 'Pinterest', 'Keyboard layout', 'Hotkey',
    'Skeleton', 'Passport', 'Passenger', 'Compass', 'Bypass notes']) {
    assert.equal(isSecretKey(k), false, k);
  }
});

test('common non-secret fields are shown', () => {
  for (const k of ['Username', 'User', 'Email', 'URL', 'Website', 'Note', 'Notes', 'Phone', 'Address', 'Zip code', 'Country code', 'Name', 'Security question', 'Date of birth']) {
    assert.equal(isSecretKey(k), false, k);
  }
});

test('odd input is handled', () => {
  assert.equal(isSecretKey(''), false);
  assert.equal(isSecretKey(null), false);
  assert.equal(isSecretKey(undefined), false);
  assert.equal(isSecretKey('   '), false);
});

test('"password" in other languages and scripts is recognised', () => {
  for (const k of ['Пароль', 'пароль для почты', '密码', 'パスワード', 'Contraseña', 'Mot de passe', 'Passwort', 'Wachtwoord', 'Senha', '비밀번호']) {
    assert.equal(isSecretKey(k), true, k);
  }
  for (const k of ['Имя пользователя', '用户名', 'Adresse', 'Nombre']) assert.equal(isSecretKey(k), false, k);
});

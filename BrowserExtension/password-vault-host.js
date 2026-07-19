#!/usr/bin/env node
/* Native Messaging bridge for Password Vault's local default vault. */
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const appDataPath = process.platform === 'win32' ? (process.env.APPDATA || '') : process.platform === 'darwin' ? path.join(os.homedir(), 'Library', 'Application Support') : (process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'));
const configPaths = process.env.PASSWORD_VAULT_CONFIG_PATH ? [process.env.PASSWORD_VAULT_CONFIG_PATH] : [path.join(appDataPath, 'password-vault', 'vault-config.json'), path.join(appDataPath, 'Password Vault', 'vault-config.json')];
const bookPasswords = new Map();

function config() { const file = configPaths.find(candidate => fs.existsSync(candidate)); try { return file ? JSON.parse(fs.readFileSync(file, 'utf8')) : {}; } catch (_) { return {}; } }
function origin(url) { try { return new URL(url).origin; } catch (_) { return ''; } }
function write(message) { const data = Buffer.from(JSON.stringify(message)); const size = Buffer.alloc(4); size.writeUInt32LE(data.length); process.stdout.write(Buffer.concat([size, data])); }

function parseFile(text) {
  const entries = []; let current = null;
  text.split(/\r?\n/).forEach(raw => {
    const line = raw.trim(); if (!line || /^end$/i.test(line) || /^[-=]/.test(line)) return;
    if (/^\s/.test(raw) && current) { const divider = line.indexOf(':'); if (divider > 0) current.attrs.push({ key: line.slice(0, divider).trim(), val: line.slice(divider + 1).trim() }); }
    else { current = { name: line.replace(/\s*\(\d+\s*(?:attributes?)?\)\s*$/i, ''), attrs: [] }; entries.push(current); }
  });
  return entries;
}

function buildFile(entries) { return entries.map(entry => [entry.name + ' (' + entry.attrs.length + ' attributes)', ...entry.attrs.map(attr => '    ' + attr.key + ': ' + attr.val), ''].join('\n')).join('\n') + 'End\n'; }
function attr(entry, pattern) { return (entry.attrs.find(item => pattern.test(item.key)) || {}).val; }
function website(entry) { return attr(entry, /^(url|website|site|login url|website url)$/i) || (entry.attrs.find(item => /^https?:\/\//i.test(item.val)) || {}).val || ''; }
function vaultEntryFrom(entry, source) {
  const username = attr(entry, /^(user(name)?|email|login)$/i); const password = attr(entry, /^(password|pass|pwd)$/i); const url = website(entry);
  if (!password) return null;
  const site = origin(url);
  return { id: crypto.createHash('sha256').update(source + entry.name + username).digest('hex'), name: entry.name || (site ? new URL(url).hostname : 'Untitled password'), origin: site, username: username || '', password, attributes: entry.attrs.map(item => ({ key: item.key, val: /^(password|pass|pwd)$/i.test(item.key) ? '••••••••' : item.val })) };
}

function vaultPath() { const value = config().defaultVaultPath; if (!value || !fs.existsSync(value)) throw new Error('Open Password Vault and set a default folder first.'); return value; }
// A valid vault.enc must at minimum hold a 16-byte salt, 12-byte IV, and 16-byte GCM auth tag.
// Anything smaller is a stray/empty/truncated leftover (e.g. from a cancelled or interrupted
// "enable encryption" step) rather than real encrypted data, and should not lock the book.
const MIN_VAULT_ENC_BYTES = 16 + 12 + 16;
function isEncryptedBook(bookPath) {
  const file = path.join(bookPath, 'vault.enc');
  if (!fs.existsSync(file)) return false;
  try { return fs.statSync(file).size > MIN_VAULT_ENC_BYTES; } catch (_) { return false; }
}
function books() {
  const root = vaultPath(); const dirs = fs.readdirSync(root, { withFileTypes: true }).filter(item => item.isDirectory());
  if (!dirs.length) return [{ id: 'root', name: path.basename(root), path: root, encrypted: isEncryptedBook(root) }];
  return dirs.map(item => { const bookPath = path.join(root, item.name); return { id: item.name, name: item.name, path: bookPath, encrypted: isEncryptedBook(bookPath) }; });
}
function book(id) { const result = books().find(item => item.id === id); if (!result) throw new Error('Password book not found.'); return result; }
function decryptBook(item, password) {
  const encrypted = fs.readFileSync(path.join(item.path, 'vault.enc')); const salt = encrypted.subarray(0, 16); const iv = encrypted.subarray(16, 28);
  const key = crypto.pbkdf2Sync(password, salt, 200000, 32, 'sha256'); const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv); decipher.setAuthTag(encrypted.subarray(encrypted.length - 16));
  try {
    return JSON.parse(Buffer.concat([decipher.update(encrypted.subarray(28, -16)), decipher.final()]).toString('utf8'));
  } catch (_) {
    // Wrong password and a corrupted/truncated vault.enc both fail GCM auth the same way,
    // so we can't tell them apart here — surface a single, clear message either way.
    throw new Error('Incorrect password, or this book\u2019s encrypted data is unreadable.');
  }
}
function encryptBook(item, contents) {
  const file = path.join(item.path, 'vault.enc'); const old = fs.readFileSync(file); const salt = old.subarray(0, 16); const key = crypto.pbkdf2Sync(bookPasswords.get(item.id), salt, 200000, 32, 'sha256'); const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv); const ciphertext = Buffer.concat([cipher.update(Buffer.from(JSON.stringify(contents))), cipher.final()]); fs.writeFileSync(file, Buffer.concat([salt, iv, ciphertext, cipher.getAuthTag()]));
}
function entriesForBook(item) {
  if (item.encrypted && !bookPasswords.has(item.id)) return { locked: true, entries: [] };
  const entries = [];
  if (item.encrypted) {
    const contents = decryptBook(item, bookPasswords.get(item.id));
    Object.keys(contents.collections || {}).forEach(collection => (contents.collections[collection] || []).forEach(entry => { const vaultEntry = vaultEntryFrom(entry, item.id + collection); if (vaultEntry) entries.push(vaultEntry); }));
  } else {
    fs.readdirSync(item.path, { withFileTypes: true }).filter(file => file.isFile() && file.name.endsWith('.txt')).forEach(file => parseFile(fs.readFileSync(path.join(item.path, file.name), 'utf8')).forEach(entry => { const vaultEntry = vaultEntryFrom(entry, item.id + file.name); if (vaultEntry) entries.push(vaultEntry); }));
  }
  return { locked: false, entries };
}
function saveCredential(message) {
  const item = book(message.bookId); const site = origin(message.url || message.origin); if (!site || !message.username || !message.password) throw new Error('Website, username, and password are required.');
  const entryMatches = entry => attr(entry, /^(user(name)?|email|login)$/i) === message.username && origin(website(entry)) === site;
  const update = entries => { const existing = entries.find(entryMatches); const entry = existing || { name: message.name || new URL(site).hostname, attrs: [] }; entry.attrs = [{ key: 'URL', val: site }, { key: 'Username', val: message.username }, { key: 'Password', val: message.password }]; if (!existing) entries.push(entry); };
  if (item.encrypted) {
    if (!bookPasswords.has(item.id)) throw new Error('Unlock this password book before saving to it.');
    const contents = decryptBook(item, bookPasswords.get(item.id)); const collection = 'Browser Extension.txt'; const entries = contents.collections[collection] || []; update(entries); contents.collections[collection] = entries; encryptBook(item, contents);
  } else {
    const file = path.join(item.path, 'Browser Extension.txt'); const entries = fs.existsSync(file) ? parseFile(fs.readFileSync(file, 'utf8')) : []; update(entries); fs.writeFileSync(file, buildFile(entries), 'utf8');
  }
  return { ok: true };
}
function handle(message) {
  if (message.type === 'status') { try { return { ok: true, hasVault: Boolean(vaultPath()) }; } catch (_) { return { ok: true, hasVault: false }; } }
  if (message.type === 'listBooks') return { ok: true, books: books().map(({ id, name, encrypted }) => ({ id, name, encrypted, unlocked: bookPasswords.has(id) })) };
  if (message.type === 'unlockBook') { const item = book(message.bookId); if (!item.encrypted) return { ok: true }; decryptBook(item, message.password || ''); bookPasswords.set(item.id, message.password || ''); return { ok: true }; }
  if (message.type === 'lock') { bookPasswords.clear(); return { ok: true }; }
  if (message.type === 'getBookEntries') return { ok: true, ...entriesForBook(book(message.bookId)) };
  if (message.type === 'saveCredential') return saveCredential(message);
  throw new Error('Unknown request.');
}
let buffer = Buffer.alloc(0);
process.stdin.on('data', chunk => { buffer = Buffer.concat([buffer, chunk]); while (buffer.length >= 4) { const length = buffer.readUInt32LE(0); if (buffer.length < length + 4) return; const message = JSON.parse(buffer.subarray(4, length + 4).toString('utf8')); buffer = buffer.subarray(length + 4); try { write({ ...handle(message), requestId: message.requestId }); } catch (error) { write({ ok: false, error: error.message, requestId: message.requestId }); } } });

/* ═══════════════════════════════
   CRYPTO  —  AES-256-GCM + PBKDF2
   vault.enc layout: [16-byte salt][12-byte IV][ciphertext]
   No plaintext files are written for encrypted books.
═══════════════════════════════ */

async function deriveKey(password, salt) {
  var km = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt, iterations: 200000, hash: 'SHA-256' },
    km,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/** Encrypt obj as JSON, prepend a fresh salt + IV, return the packed Uint8Array. */
async function packEncrypted(obj, password) {
  var salt = crypto.getRandomValues(new Uint8Array(16));
  var iv   = crypto.getRandomValues(new Uint8Array(12));
  var key  = await deriveKey(password, salt);
  var ct   = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv }, key, new TextEncoder().encode(JSON.stringify(obj))
  );
  var out = new Uint8Array(16 + 12 + ct.byteLength);
  out.set(salt, 0); out.set(iv, 16); out.set(new Uint8Array(ct), 28);
  return out;
}

/**
 * Re-encrypt the active book's collections into vault.enc.
 * Reuses the existing salt (so the derived key stays valid) but generates a fresh IV.
 */
async function reEncryptVault() {
  var bk  = getBookKey();
  var old = await bookReadBin('vault.enc');
  var salt = old.slice(0, 16);
  var iv   = crypto.getRandomValues(new Uint8Array(12));
  var ct   = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv }, bk,
    new TextEncoder().encode(JSON.stringify({ collections: collections }))
  );
  var out = new Uint8Array(16 + 12 + ct.byteLength);
  out.set(salt, 0); out.set(iv, 16); out.set(new Uint8Array(ct), 28);
  await bookWriteBin('vault.enc', out);
}

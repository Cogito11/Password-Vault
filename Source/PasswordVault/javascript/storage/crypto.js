// ═══════════════════════════════
// CRYPTO - AES-256-GCM + PBKDF2
// vault.enc layout: [16-byte salt][12-byte IV][ciphertext]
// No plaintext files are written for encrypted books.
// ═══════════════════════════════

// Derives a 256-bit AES-GCM key from a plaintext password and a 16-byte salt
// using PBKDF2-SHA-256 with 200,000 iterations. The key is non-extractable.
async function deriveKey(password, salt) {
	// Import the raw password bytes as a PBKDF2 base key
	var km = await crypto.subtle.importKey(
		'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']
	);

	// Stretch the base key into a final AES-GCM key using the provided salt
	return crypto.subtle.deriveKey(
		{ name: 'PBKDF2', salt: salt, iterations: 200000, hash: 'SHA-256' },
		km,
		{ name: 'AES-GCM', length: 256 },
		false, // non-extractable - the raw key bytes can never be read back out
		['encrypt', 'decrypt']
	);
}

// Serialises obj to JSON, encrypts it with a freshly derived key, and returns
// the result as a single Uint8Array in the format: [salt (16)][IV (12)][ciphertext].
async function packEncrypted(obj, password) {
	// Fresh random salt - unique per save
	var salt = crypto.getRandomValues(new Uint8Array(16));

	// Fresh random IV - must never be reused with the same key
	var iv = crypto.getRandomValues(new Uint8Array(12));
	var key = await deriveKey(password, salt);
	var ct = await crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv: iv }, key, new TextEncoder().encode(JSON.stringify(obj))
	);

	// Pack salt + IV + ciphertext into one contiguous buffer matching the vault.enc layou
	var out = new Uint8Array(16 + 12 + ct.byteLength);
	// bytes  0–15:  salt
	out.set(salt, 0); 
	// bytes 16–27:  IV
	out.set(iv, 16); 
	// bytes 28+:   ciphertext (includes GCM auth tag)
	out.set(new Uint8Array(ct), 28);
	return out;
}

// Re-encrypts the active book's collections and writes the result back to vault.enc.
// Reuses the existing salt (so the derived key stays valid) but generates a fresh IV.
// Re-saves a book's encrypted vault using the key AND salt held in memory.
// The salt is taken from memory (stored when the book was unlocked / created)
// rather than re-read from the file on every save: if vault.enc were ever
// damaged, reading the salt back from it would write a vault that can never be
// opened again with the user's password.
async function reEncryptBook(bookName) {
	var info = bookHandles[bookName];
	var bk = info && info.key;
	var salt = info && info.salt;

	if (!bk || !salt) throw new Error('This book is locked. Unlock it and try again.');

	// The active book's collections live in the global; other books keep theirs on the handle
	var activeName = isMultiBookMode ? activeBookName : vaultName();
	var coll = (bookName === activeName) ? collections : info.collections;

	// New IV for every write (reusing an IV breaks GCM security)
	var iv = crypto.getRandomValues(new Uint8Array(12));
	var ct = await crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv: iv }, bk,
		new TextEncoder().encode(JSON.stringify({ collections: coll }))
	);

	// Reassemble the vault.enc buffer: salt + IV + ciphertext
	var out = new Uint8Array(16 + 12 + ct.byteLength);
	out.set(salt, 0);
	out.set(iv, 16);
	out.set(new Uint8Array(ct), 28);

	// Keep the previous version as vault.enc.bak in case this one is ever damaged
	await namedBookWriteBin(bookName, 'vault.enc', out, { backup: true });
}

// Re-saves the active book (kept as the single entry point for existing callers)
async function reEncryptVault() {
	await reEncryptBook(isMultiBookMode ? activeBookName : vaultName());
}

// Decrypts a vault.enc file and checks it contains exactly the expected collections.
// Used before deleting the plaintext originals, so a bad write can never cost data.
async function verifyEncryptedBook(bookName, key, expectedCollections) {
	var buf = namedBookReadBin(bookName, 'vault.enc');
	if (buf.length < 44) throw new Error('Verification failed: the encrypted file is too short.');

	var pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(16, 28) }, key, buf.slice(28));
	var payload = JSON.parse(new TextDecoder().decode(pt));

	if (JSON.stringify(payload.collections) !== JSON.stringify(expectedCollections)) {
		throw new Error('Verification failed: the encrypted copy does not match your data.');
	}
}

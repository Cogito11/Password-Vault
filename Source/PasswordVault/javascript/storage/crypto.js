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
async function reEncryptVault() {
	// Retrieve the in-memory AES-GCM key for the active book
	var bk  = getBookKey();

	// Read the current file to extract the original salt
	var old = await bookReadBin('vault.enc');

	// Preserve the salt - changing it would invalidate the stored key
	var salt = old.slice(0, 16);

	// New IV for every write (reusing an IV breaks GCM security)
	var iv = crypto.getRandomValues(new Uint8Array(12));
	var ct = await crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv: iv }, bk,
		new TextEncoder().encode(JSON.stringify({ collections: collections }))
	);

	// Reassemble the vault.enc buffer with the preserved salt and new IV + ciphertext
	var out = new Uint8Array(16 + 12 + ct.byteLength);
	out.set(salt, 0); 
	out.set(iv, 16); 
	out.set(new Uint8Array(ct), 28);
	await bookWriteBin('vault.enc', out);
}

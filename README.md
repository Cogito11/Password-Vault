# Password Vault

A lightweight, offline-first password manager built with Electron.

Password Vault stores all data locally on your computer. There are no accounts, cloud services, subscriptions, or mandatory internet connectivity. Your password data remains under your control and can be organized however you choose.

The application is built around a three-level structure:

- **Password Books**: top-level containers that hold your credentials and define whether data is stored as plain text or encrypted.
- **Collections**: categories within a book used to organize related entries.
- **Entries**: individual accounts, credentials, or records containing customizable fields.

Each password book can be stored as either plain text or encrypted with AES-256-GCM. Unencrypted books save each collection as a readable `.txt` file, while encrypted books store all collection data inside a single `vault.enc` file.

The system is designed around loading and ejecting files directly from your filesystem. You can load a vault folder containing multiple password books or load an individual password book directly depending on your preferred workflow.

---

## Features

- **Password Books**: organize credentials into separate books, each with its own collections and encryption settings
- **Collections**: group related passwords within a book (Finance, Work, Social Media, Gaming, etc.)
- **Plain Text or Encrypted Storage**: choose storage mode independently for every password book
- **AES-256-GCM Encryption**: encrypted books are stored as a single binary `vault.enc` file with no readable data written to disk
- **Per-Book Locking**: unlock and relock individual encrypted books without ejecting the entire vault
- **Search**: filter entries within a collection or across an entire password book
- **Custom Fields**: create entries with any fields you need rather than being limited to predefined templates
- **Copy to Clipboard**: copy any field value with one click while sensitive values remain masked by default
- **Fully Offline**: no network calls, cloud synchronization, or external services

---

## Intended Usage

The recommended workflow is to create a single folder somewhere on your computer that will act as your vault root. Inside password vault, set this folder as your default folder.

Inside that folder, create one or more password books for different areas of your life such as Personal, Work, or Finance. When opening Password Vault, open the vault root folder rather than individual books. This allows all books to be managed from a single location while keeping their contents logically separated.

Users with a smaller number of accounts may prefer to create a single password book and load it directly. Password Vault supports both approaches equally well.

---

## Installation

### Option 1: Download a Release

Download the latest version from either:

- GitHub Releases: https://github.com/Cogito11/Password-Vault/releases
- Official Website: https://cogito11.github.io/Password-Vault/

Choose the build that matches your operating system and follow the normal installation process.

### Option 2: Build From Source

#### Prerequisites

- Node.js 18 or later
- npm (included with Node.js)

#### Clone the Repository

```bash
git clone https://github.com/Cogito11/Password-Vault
cd Password-Vault/Source
```

#### Install Dependencies

```bash
npm install
```

#### Build

```bash
npm run build
```

Build outputs will be placed in the `dist/` directory.

#### Run Development Version

```bash
npm start
```

---

## How Data Is Stored

### Plain Text Books

Each collection is stored as its own `.txt` file within the password book folder.

Example:

```text
Gmail (2 attributes)
    Email: you@example.com
    Password: hunter2

Netflix (2 attributes)
    Email: you@example.com
    Password: correcthorsebattery

End
```

### Encrypted Books

Encrypted books store all collection data inside a single binary file named `vault.enc`.

File layout:

```text
[ 16 bytes - salt ][ 12 bytes - IV ][ N bytes - AES-256-GCM ciphertext ]
```

The encrypted payload contains a UTF-8 JSON document representing the book's collections and entries.

Key derivation uses PBKDF2-SHA256 with 200,000 iterations.

---

## Security Notes

- Encryption keys exist only in memory while a book is unlocked
- Relocking a book immediately removes the key from memory
- Password Vault never transmits vault data over the network
- Plain-text books rely entirely on filesystem permissions for protection and can be accessed by anyone with permission to do so
- Clipboard contents are not cleared automatically after copying
- This project has not been independently audited

---

## License

Released under the MIT License.
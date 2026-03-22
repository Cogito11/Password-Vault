# Password Vault

A lightweight, offline first password manager built with Electron. All data lives on computer so theres no need to worry about cloud, accounts, or forced online connectivity. You have the choice to store your passwords and accounts as either plain text in .txt files or encrypted with AES-256-GCM, depending on your preference per password book. That brings us to the next major focus of Password Vault, the organization. Password books are the containers for all of your passwords, encryption is decided at this level. Entire Password books are encrypted or they are not. Within password books you create password collections which are essentially a way for your to categorize your passwords. If you are using an unencrypted book then each collection will be its own text file but if the book is encrypted then they will all be contained inside one .enc file. Inside collections is where you can create password entries. You can decide what fields each password will have for ultimate customization. This whole system is build around loading and ejecting your password files from the system. If you load a password book folder directly then you will see the collections inside of it, if you load a folder that contains multiple password books then you can access each of the books independently.

---

## Features

- **Password Books** — organize credentials into separate books (folders), each with its own collections
- **Collections** — group related passwords within a book (For example, *Social Media*, *Work Accounts*, *Finance Accounts*...)
- **Plain text or encrypted storage** — each password book can be plain text or encrypted independently, you choose during the creation process
- **AES-256-GCM encryption** — encrypted books are stored as a single binary `vault.enc` file. No readable data is written to disk
- **Per-book locking** — unlock and relock individual encrypted books without ejecting the whole vault
- **Search** — filter entries from the active collection or from the entire password book with ease
- **Copy to clipboard** — copy any field value with one click, sensitive fields (password, token, PIN...) are masked by default

---

## Project Structure

```
source/
├── main.js                 # Electron main process — creates the window, handles IPC
├── preload.js              # Context bridge — exposes Node fs/path to the renderer safely
├── Password Vault.html     # Entire UI and application logic (renderer process)
└── package.json            # Project manifest and dependencies
```

### How the three files relate

```
main.js  ──IPC──▶  preload.js  ──window.vault.*──▶  Password Vault.html
(Node/Electron)    (Node bridge)                     (renderer UI)
```

- **`main.js`** runs in Node and has full system access. It creates the `BrowserWindow` and handles the `open-folder` IPC call (the native folder-picker dialog).
- **`preload.js`** runs in a privileged context and exposes a minimal `window.vault` API to the renderer via Electron's `contextBridge`. This keeps Node out of the renderer's direct scope while still allowing controlled file system access.
- **`index.html`** contains all UI and logic. It calls `window.vault.*` for any disk I/O and uses the Web Crypto API (`crypto.subtle`) for all encryption — no Node crypto module is involved.

> **Note on `sandbox: false`:** The preload uses `require()` directly. This requires `sandbox: false` in `webPreferences`. If you want stricter security, all `fs` calls can be moved into `ipcMain` handlers instead.

---

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- npm (included with Node.js)

---

## Getting Started

### 1. Clone or download the project

```bash
git clone https://github.com/Cogito11/Password-Vault
cd source
```

Or download and extract the ZIP, then open a terminal in the project folder.

### 2. Create `package.json`

If no `package.json` is present, create one in the project source folder:

```json
{
  "name": "password-vault",
  "productName": "Password Vault",
  "artifactName": "PasswordVault-Setup.${ext}",
  "version": "0.2.0",
  "description": "A Local Password Manager",
  "main": "main.js",
  "scripts": {
    "start": "electron .",
    "build": "electron-builder",
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "build": {
    "appId": "com.bishop.passwordvault.app",
    "productName": "Password Vault",
    "win": {
      "target": ["nsis", "portable"],
      "icon": "passwordvault.ico"
    },
    "mac": {
      "target": "dmg"
    },
    "linux": {
      "target": "AppImage"
    },
    "portable": {
      "artifactName": "PasswordVault.exe"
    }
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "devDependencies": {
    "electron": "^41.0.3",
    "electron-builder": "^26.8.1"
  }
}
```

### 3. Install dependencies

```bash
npm install
```

This installs Electron locally into `node_modules/`. The app has no other dependencies.

### 4. Run the app

```bash
npm start
```

---

## Building a Distributable

To package the app into a standalone executable (`.app`, `.exe`, etc.) use [electron-builder](https://www.electron.build/).

### Install electron-builder

```bash
npm install --save-dev electron-builder
```

### Ensure a build script exists in `package.json`

```json
"scripts": {
  "start": "electron .",
  "build": "electron-builder"
},
"build": {
  "appId": "com.bishop.passwordvault.app",
  "productName": "Password Vault",
  "files": [
    "main.js",
    "preload.js",
    "index.html"
  ],
  "win": {
    "target": ["nsis", "portable"]
  },
  "mac": {
    "target": "dmg"
  },
  "linux": {
    "target": "AppImage"
  }
}
```

For windows target "nsis" for an application installer and target "portable" for an all in one executable

### Build

```bash
npm run build
```

Output is placed in the `dist/` folder.

---

## How Data is Stored

### Plain text books

Each collection is a `.txt` file inside the book's folder. The format is human-readable:

```
Gmail (2 attributes)
    Email: you@example.com
    Password: hunter2

Netflix (2 attributes)
    Email: you@example.com
    Password: correcthorsebattery

End
```

Rules the parser follows:
- A line with no leading whitespace is an entry name
- Lines indented with whitespace are `Key: Value` attribute pairs
- Lines starting with `-`, `=`, or the word `End` are ignored
- The `(N attributes)` suffix on entry names is optional and stripped on read

### Encrypted books

An encrypted book is a single binary file — `vault.enc` — inside the book's folder. No `.txt` files are written. The format is:

```
[ 16 bytes — salt ][ 12 bytes — IV ][ N bytes — AES-256-GCM ciphertext ]
```

The ciphertext decrypts to a UTF-8 JSON string: `{ "collections": { ... } }`.

Key derivation uses **PBKDF2** with SHA-256, 200,000 iterations. The salt is generated once at book creation and preserved on every subsequent save — changing the password is not currently supported without recreating the book.

---

## Security Notes

- Encryption keys exist only in memory for the duration of a session. Relocking a book wipes the key from memory immediately.
- The app is entirely offline. No data ever leaves your machine.
- Plain-text books have no protection beyond filesystem permissions. Use encrypted books for anything sensitive.
- Clipboard contents are not cleared automatically after copying. Close the app or clear your clipboard manually if this is a concern.
- This app has not been independently audited. It is a personal tool, not a commercial product.

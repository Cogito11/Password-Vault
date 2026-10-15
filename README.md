# Password Vault

A lightweight, offline-first password manager built with Electron.

Password Vault stores all data locally on your computer. There are no accounts, cloud services, subscriptions, or mandatory internet connectivity. Your password data remains under your control and can be organized however you choose.

🌐 **[Visit the website](https://cogito11.github.io/Password-Vault/)**

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
- **Fully Offline**: no cloud synchronization or external services. The only network connection is the update check, and only when you click **Check for update**

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

### Updating

Open **Settings** and click **Check for update**. If there is a newer version, click **Download**, then **Restart to update**. There is no installer to download by hand, and your vault files are never touched. Restarting locks any unlocked books again.

Nothing happens on its own. Password Vault never checks for updates in the background, never downloads one until you click, and never installs one until you choose to restart. An update you downloaded but did not install is left alone when you close the app.

| Your install | Updates inside the app? |
| --- | --- |
| Windows installer | Yes |
| Linux AppImage | Yes |
| Linux `.deb` | Yes (still in beta; asks for your password) |
| Windows portable | No. **Settings** links to the download page. |
| macOS | Not yet. **Settings** links to the download page. |

Versions released before this feature can't update themselves. Install a newer version once the usual way, and from then on you can update inside the app.

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
- The only connection it makes is to GitHub, when you ask it to check for or download an update. No vault data is sent
- Updates are checked against the checksum published with each release, but the builds are not code-signed yet, so that checksum comes from the same place as the download
- Plain-text books rely entirely on filesystem permissions for protection and can be accessed by anyone with permission to do so
- Clipboard contents are not cleared automatically after copying
- This project has not been independently audited

---

## Publishing a release

For maintainers.

1. Set the new `version` in `Source/package.json`.
2. Commit, then tag and push: `git tag vX.Y.Z && git push origin vX.Y.Z`.
3. The **Build and Release** workflow builds every platform and uploads the installers, along with the `latest*.yml` files that tell installed copies a new version exists.
4. If GitHub creates the release as a draft, publish it. Installed copies only see published releases, and only offer a version higher than the one they're running.

In-place updates on macOS need Apple code signing, which the builds don't have yet. Once they do, set `MAC_IN_PLACE_UPDATES` to `true` in `Source/updater.js`.

---

## License

Released under the MIT License.
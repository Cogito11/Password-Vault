# Password Vault

**A simple, offline-first password manager for Windows, macOS, and Linux.**
Your passwords live in files on your own computer, so there is no account, no cloud, and no subscription.

🌐 [Website](https://cogito11.github.io/Password-Vault/) · ⬇️ [Download](https://github.com/Cogito11/Password-Vault/releases)

## How it's organized

- **Password books** hold your credentials. Each book is either plain text or encrypted, your choice.
- **Collections** sort a book into categories, like Finance, Work, or Social Media.
- **Entries** are the individual accounts, with whatever fields you need.

## What you can do

- **Choose how each book is stored.** Plain text for easy access, or encrypted with AES-256-GCM.
- **Lock and unlock books one at a time**, without closing everything else.
- **Search** across a collection or a whole book.
- **Add any fields you like.** Entries aren't limited to fixed templates.
- **Generate strong passwords** from 4 to 64 characters, with the character types you choose.
- **Copy with one click.** Sensitive values stay hidden until you reveal them.
- **Import from your browser.** Bring in a CSV export from Chrome, Edge, and others.
- **Lock automatically** (optional) when you're idle, or when the computer locks or goes to sleep.
- **Clear the clipboard** (optional) a few seconds after you copy something.
- **Pick a theme** from six.

## Getting started

1. [Download](#download) and install Password Vault.
2. Create one folder to hold everything, then set it as your default folder in the app. The app can create a **Password Vault** folder in your Documents for you.
3. Inside it, create a book for each area of your life, such as Personal, Work, or Finance.

You can open the whole folder to manage all your books together, or open a single book directly if you only have a few accounts.

## Download

Get the latest version from the [Releases page](https://github.com/Cogito11/Password-Vault/releases)
or the [website](https://cogito11.github.io/Password-Vault/).

| System | Choose |
| --- | --- |
| Windows | **Installer** (recommended), or **Portable** to run from any folder or USB drive |
| macOS | **.dmg** (Apple Silicon / M-series Macs only) |
| Linux | **AppImage** or **.deb** |

Windows and Linux builds are 64-bit (Intel/AMD).

## Updating

Open **Settings** and click **Check for update**. If there is a newer version, click **Download**, then
**Restart to update**. There is no installer to download by hand, and your vault files are never
touched. Restarting locks any unlocked books again.

Nothing happens on its own. Password Vault never checks for updates in the background, never downloads
one until you click, and never installs one until you choose to restart. An update you downloaded but
didn't install is left alone when you close the app.

| Your install | Updates inside the app? |
| --- | --- |
| Windows installer | Yes |
| Linux AppImage | Yes |
| Linux .deb | Yes (still in beta; asks for your password) |
| Windows portable | No. **Settings** links to the download page. |
| macOS | Not yet. **Settings** links to the download page. |

Versions released before this feature can't update themselves. Install a newer version once the usual
way, and from then on you can update inside the app.

## How your data is stored

**Plain text books** keep each collection in its own readable `.txt` file:

```text
Gmail (2 attributes)
    Email: you@example.com
    Password: hunter2

Netflix (2 attributes)
    Email: you@example.com
    Password: correcthorsebattery

End
```

**Encrypted books** keep everything in a single file named `vault.enc`, with nothing readable written
to disk. The file is laid out like this:

```text
[ 16 bytes - salt ][ 12 bytes - IV ][ N bytes - AES-256-GCM ciphertext ]
```

The encrypted part is a UTF-8 JSON document of the book's collections and entries. The key is derived
from your password with PBKDF2-SHA256 (200,000 iterations).

## Security notes

- **Keys stay in memory.** An encryption key exists only while a book is unlocked. Locking removes it, along with any decrypted data on screen.
- **Your vault never leaves your computer.** Password Vault doesn't send vault data anywhere. The only connection it makes is to GitHub, when you ask it to check for or download an update.
- **Updates aren't code-signed yet.** Each download is checked against the checksum published with its release, but that checksum comes from the same place as the download.
- **Saving is crash-safe.** Files are written so a crash or power cut can't leave one half-written. An encrypted book keeps its previous version as `vault.enc.bak`, which is removed if you change the password or decrypt the book.
- **One copy at a time.** Only one copy of Password Vault can run, so two copies can't overwrite each other's changes.
- **Auto-lock and clipboard clearing are optional.** Both are in **Settings** and are off by default.
- **Plain text books aren't protected.** They rely entirely on your computer's file permissions, and anyone who can open the folder can read them.
- **This project has not been independently audited.**

## Build from source

You need [Node.js](https://nodejs.org/) 18 or newer.

```bash
git clone https://github.com/Cogito11/Password-Vault.git
cd Password-Vault/Source

npm install        # always run this first, or the build can be missing parts
npm start          # run the app from source
npm test           # run the tests
npm run build      # build installers for your current platform (output goes to Source/dist)
```

A build produces the installers for the system you build on: Windows (installer and portable),
macOS (.dmg and .zip), and Linux (AppImage and .deb).

A browser extension preview lives in [`BrowserExtension/`](BrowserExtension/README.md). It isn't part of
the installed app yet.

## Publishing a release

For maintainers.

1. Set the new `version` in `Source/package.json`.
2. Commit, then tag and push: `git tag vX.Y.Z && git push origin vX.Y.Z`.
3. The **Build and Release** workflow builds every platform and uploads the installers, along with the
   `latest*.yml` files that tell installed copies a new version exists.
4. If GitHub creates the release as a draft, publish it. Installed copies only see published releases,
   and only offer a version higher than the one they're running.

In-place updates on macOS need Apple code signing, which the builds don't have yet. Once they do, set
`MAC_IN_PLACE_UPDATES` to `true` in `Source/updater.js`.

## License

[MIT](LICENSE). Built by **Cole Bishop** ([@cogito11](https://github.com/Cogito11)).

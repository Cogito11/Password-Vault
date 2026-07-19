# Password Vault browser extension

A Chromium Manifest V3 extension that uses the local Password Vault application's default vault for password generation, autofill, and save-on-login submission.

## Install for development

1. Open `chrome://extensions` (or the equivalent extensions page in a Chromium browser).
2. Enable **Developer mode**.
3. Choose **Load unpacked** and select this `BrowserExtension` directory. Copy the extension ID shown on its card.
4. On Linux, run `bash native-host/install-linux.sh <extension-id>` from this directory. This registers the local bridge with Chrome. Restart Chrome after installing it.

Open the desktop application and set a default folder before using the extension. The extension reads that folder through Chrome's native-messaging bridge; it never receives direct filesystem access. Plain-text books work immediately. For encrypted books, unlock with the book password in the popup. The password is held only by the local companion process and is not saved.

## Scope

The extension reads saved credentials from all plain or encrypted books in the default vault. New and updated browser logins are written to `Browser Extension.txt` at the default-vault root (or into that collection inside a root encrypted vault). Multi-book vaults receive a `Browser Extension/Logins.txt` book so the entries remain visible in the desktop application.

`install-linux.sh` is intended for a development checkout with Node.js available. Packaging the Electron application should install a platform-specific native host launcher and manifest as part of the desktop app installer. Chrome requires the extension ID in the manifest as an explicit trust boundary.

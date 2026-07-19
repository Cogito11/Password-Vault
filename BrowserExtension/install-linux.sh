#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <Chrome-extension-ID>" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOST_PATH="$SCRIPT_DIR/password-vault-host.js"
TARGET_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/google-chrome/NativeMessagingHosts"
TARGET="$TARGET_DIR/com.cogito11.password_vault.json"

mkdir -p "$TARGET_DIR"
chmod +x "$HOST_PATH"
sed -e "s|__HOST_PATH__|$HOST_PATH|" -e "s|__EXTENSION_ID__|$1|" "$SCRIPT_DIR/com.cogito11.password_vault.json.template" > "$TARGET"
echo "Installed native host manifest: $TARGET"

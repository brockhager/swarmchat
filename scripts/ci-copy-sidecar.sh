#!/usr/bin/env bash
set -euo pipefail

# CI helper: copy a prebuilt dendrite sidecar for the target runner into resources/sidecar/dendrite
# Expected layout in the repo (CI or release pipeline should place the correct binaries here):
# src-tauri/sidecar/prebuilt/dendrite-linux
# src-tauri/sidecar/prebuilt/dendrite-macos
# src-tauri/sidecar/prebuilt/dendrite-windows.exe

PLATFORM="$1"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PREBUILT_DIR="$ROOT/src-tauri/sidecar/prebuilt"
TARGET_DIR="$ROOT/src-tauri/resources/sidecar"

echo "Platform: $PLATFORM"
mkdir -p "$TARGET_DIR"

case "$PLATFORM" in
  ubuntu-latest)
    SRC="$PREBUILT_DIR/dendrite-linux"
    DEST="$TARGET_DIR/dendrite"
    ;;
  macos-latest)
    SRC="$PREBUILT_DIR/dendrite-macos"
    DEST="$TARGET_DIR/dendrite"
    ;;
  windows-latest)
    # on windows this script may still run under bash on runner; choose exe
    SRC="$PREBUILT_DIR/dendrite-windows.exe"
    DEST="$TARGET_DIR/dendrite.exe"
    ;;
  *)
    echo "Unknown platform: $PLATFORM" >&2
    exit 1
    ;;
esac

if [ -f "$SRC" ]; then
  echo "Copying $SRC -> $DEST"
  cp "$SRC" "$DEST"
  chmod +x "$DEST" || true
else
  echo "No prebuilt sidecar found at $SRC — CI should populate prebuilt binaries before build." >&2
  exit 0
fi

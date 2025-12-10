#!/usr/bin/env bash
set -euo pipefail
SOURCE_PATH=${1:-../dendrite}
OUTPUT_DIR=${2:-src-tauri/sidecar/prebuilt}
OUT_FILE="$OUTPUT_DIR/dendrite-windows.exe"

mkdir -p "$OUTPUT_DIR"

if ! command -v go >/dev/null 2>&1; then
  echo "Go is not installed. Please install Go to build Dendrite from source."
  exit 1
fi

echo "Building dendrite from $SOURCE_PATH -> $OUT_FILE"
pushd "$SOURCE_PATH" >/dev/null
if ! go build -o "$OUT_FILE" ./cmd/dendrite-monolith-server; then
  echo "Go build failed"
  popd >/dev/null
  exit 1
fi
popd >/dev/null

if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "$OUT_FILE" | awk '{print $1 "  " $2}'
else
  openssl dgst -sha256 "$OUT_FILE" || true
fi

echo "Done. Copy this file to your repo if you want to commit and trigger CI."
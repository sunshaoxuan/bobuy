#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
command -v sops >/dev/null || { echo "sops is required" >&2; exit 1; }

files=(
  ".env"
  "backend/src/main/resources/application-dev.properties"
  "backend/src/main/resources/application-ai-hermes.properties"
)

for target in "${files[@]}"; do
  source="${target}.enc"
  [[ -f "$source" ]] || { echo "Missing encrypted file: $source" >&2; exit 1; }
  temporary="${target}.tmp"
  trap 'rm -f -- "$temporary"' EXIT
  sops decrypt --input-type binary --output-type binary --output "$temporary" "$source"
  chmod 600 "$temporary"
  mv -- "$temporary" "$target"
  trap - EXIT
  echo "Decrypted $source -> $target"
done

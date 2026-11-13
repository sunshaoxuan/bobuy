#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
command -v sops >/dev/null || { echo "sops is required" >&2; exit 1; }

recipient="$(awk '/^[[:space:]]*age:[[:space:]]*/ { print $2; exit }' .sops.yaml)"
if [[ -z "$recipient" || "$recipient" == "age1REPLACE_ME" ]]; then
  echo "Replace age1REPLACE_ME in .sops.yaml with the maintainer age public key." >&2
  exit 1
fi

files=(
  ".env"
  "backend/src/main/resources/application-dev.properties"
  "backend/src/main/resources/application-ai-hermes.properties"
)

for source in "${files[@]}"; do
  [[ -f "$source" ]] || { echo "Missing plaintext file: $source" >&2; exit 1; }
  target="${source}.enc"
  temporary="${target}.tmp"
  trap 'rm -f -- "$temporary"' EXIT
  sops encrypt --input-type binary --output-type binary --age "$recipient" \
    --output "$temporary" "$source"
  mv -- "$temporary" "$target"
  trap - EXIT
  echo "Encrypted $source -> $target"
done

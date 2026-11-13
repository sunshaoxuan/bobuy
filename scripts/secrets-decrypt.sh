#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
command -v sops >/dev/null || { echo "sops is required" >&2; exit 1; }

files=(
  ".env"
  "backend/src/main/resources/application-dev.properties"
  "backend/src/main/resources/application-ai-hermes.properties"
)

temporaries=()
trap 'rm -f -- "${temporaries[@]}"' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
umask 077

for target in "${files[@]}"; do
  source="${target}.enc"
  [[ -f "$source" ]] || { echo "Missing encrypted file: $source" >&2; exit 1; }
  temporary=$(mktemp "${target}.tmp.XXXXXXXXXX")
  temporaries+=("$temporary")
  sops decrypt --input-type binary --output-type binary --output "$temporary" "$source"
  chmod 600 "$temporary"
done

for i in "${!files[@]}"; do
  mv -- "${temporaries[$i]}" "${files[$i]}"
  echo "Decrypted ${files[$i]}.enc -> ${files[$i]}"
done

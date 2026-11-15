#!/usr/bin/env bash
set -euo pipefail

# Build a short-lived Compose env overlay without writing decrypted data to stdout.
# Disabled is deliberately a no-op so /etc/bobuy.env remains the only env file.
enabled=${1:-false}
ciphertext=${2:-}
key_file=${3:-/etc/bobuy/age/keys.txt}
output=${4:-}

if [[ "$enabled" != true ]]; then
  exit 0
fi

fail() {
  echo 'Encrypted production environment preparation failed.' >&2
  exit 1
}

[[ -n "$ciphertext" && -f "$ciphertext" && -s "$ciphertext" ]] || fail
[[ -n "$key_file" && -f "$key_file" && -r "$key_file" ]] || fail
[[ -n "$output" ]] || fail
command -v sops >/dev/null || fail

umask 077
temporary=$(mktemp "${output}.tmp.XXXXXXXXXX") || fail
trap 'rm -f -- "$temporary"' EXIT

if ! SOPS_AGE_KEY_FILE="$key_file" sops decrypt --input-type dotenv --output-type dotenv \
    --output "$temporary" "$ciphertext" >/dev/null 2>&1; then
  fail
fi

# Accept only dotenv assignments/comments and reject flags that could activate mail,
# reset, verification, or abuse-sensitive production behavior in this config-only PR.
if ! awk '
  /^[[:space:]]*($|#)/ { next }
  /^[A-Za-z_][A-Za-z0-9_]*=.*/ { next }
  { exit 1 }
' "$temporary"; then
  fail
fi
if awk -F= '
  BEGIN { forbidden = 0 }
  $1 == "BOBBUY_ACCOUNT_MAIL_DELIVERY_ENABLED" ||
  $1 == "BOBBUY_ACCOUNT_PASSWORD_RESET_ENABLED" ||
  $1 == "BOBBUY_ACCOUNT_REQUIRE_VERIFIED_EMAIL_FOR_CHECKOUT" { forbidden = 1 }
  END { exit forbidden ? 0 : 1 }
' "$temporary"; then
  fail
fi

chmod 600 "$temporary" || fail
mv -- "$temporary" "$output" || fail
trap - EXIT

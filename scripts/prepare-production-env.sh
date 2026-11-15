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

# Accept a conservative single-line literal subset of Compose dotenv syntax.
# Interpolation is intentionally unsupported: use single quotes for literal dollars.
# Never expose parser diagnostics or input, including on malformed quoted values.
if ! awk '
  BEGIN { single = sprintf("%c", 39) }
  /^[[:space:]]*($|#)/ { next }
  {
    if ($0 !~ /^[A-Za-z_][A-Za-z0-9_]*=/ || $0 ~ /[[:cntrl:]]/) exit 1
    value = substr($0, index($0, "=") + 1)
    sub(/^[ ]+/, "", value)
    quote = substr(value, 1, 1)
    if (quote == single || quote == "\"") {
      closed = 0
      for (i = 2; i <= length(value); i++) {
        c = substr(value, i, 1)
        if (c == "\\") {
          escaped = substr(value, i + 1, 1)
          if (quote == "\"") {
            if (escaped == "" || index("\\\"nrt", escaped) == 0) exit 1
            i++
            continue
          }
          if (escaped == single || escaped == "\\") { i++; continue }
        }
        if (quote == "\"" && c == "$") exit 1
        if (c == quote) {
          tail = substr(value, i + 1)
          if (tail !~ /^[ ]*(#.*)?$/) exit 1
          closed = 1
          break
        }
      }
      if (!closed) exit 1
    } else {
      sub(/[ ]+#.*$/, "", value)
      if (index(value, single) || value ~ /["\\$]/) exit 1
    }
  }
' "$temporary" >/dev/null 2>&1; then
  fail
fi
if awk -F= '
  BEGIN { forbidden = 0 }
  $1 == "BOBBUY_ACCOUNT_MAIL_DELIVERY_ENABLED" ||
  $1 == "BOBBUY_ACCOUNT_PASSWORD_RESET_ENABLED" ||
  $1 == "BOBBUY_ACCOUNT_REQUIRE_VERIFIED_EMAIL_FOR_CHECKOUT" { forbidden = 1 }
  END { exit forbidden ? 0 : 1 }
' "$temporary" >/dev/null 2>&1; then
  fail
fi

chmod 600 "$temporary" || fail
mv -- "$temporary" "$output" || fail
trap - EXIT

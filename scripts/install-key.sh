#!/usr/bin/env bash
# For development: copy your OpenRouter key into extension/key.local.json, which
# the extension reads when no key was saved in its options page. Takes the key
# from OPENROUTER_API_KEY, or from OPENROUTER_API_KEY=... in .env at the repo
# root. The file is gitignored, scripts/package.sh refuses to zip it, and the
# pre-commit hook refuses a staged key. People installing the extension don't
# need this: they paste their key into the options page.
set -euo pipefail
cd "$(dirname "$0")/.."
key="${OPENROUTER_API_KEY:-}"
if [ -z "$key" ] && [ -f .env ]; then
  key="$(sed -n 's/^OPENROUTER_API_KEY=["'\'']\{0,1\}\([^"'\''[:space:]]*\).*/\1/p' .env | head -1)"
fi
[ -n "$key" ] || { echo "No key: set OPENROUTER_API_KEY or add OPENROUTER_API_KEY=... to .env" >&2; exit 1; }
umask 077
printf '{"openrouter": "%s"}\n' "$key" > extension/key.local.json
echo "wrote extension/key.local.json"

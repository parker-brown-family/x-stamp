#!/usr/bin/env bash
# Zip extension/ for the Chrome Web Store, into dist/x-stamp-<version>.zip.
# Leaves out anything *.local.* (a developer's key.local.json) and refuses to
# finish if any file going in contains something shaped like an API key.
set -euo pipefail
cd "$(dirname "$0")/.."
exec python3 -I scripts/package.py

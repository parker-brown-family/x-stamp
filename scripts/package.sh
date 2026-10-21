#!/usr/bin/env bash
# Zip extension/ for the Chrome Web Store, into dist/x-stamp-<version>.zip.
# Leaves out anything *.local.* (a developer's key.local.json) and refuses to
# finish if any file going in contains something shaped like an API key.
set -euo pipefail
cd "$(dirname "$0")/.."
version="$(python3 -I -c 'import json; print(json.load(open("extension/manifest.json"))["version"])')"
out="dist/x-stamp-$version.zip"
mkdir -p dist
rm -f "$out"
files="$(cd extension && find . -type f ! -name '*.local.*' ! -name '.*' | sort)"
if (cd extension && echo "$files" | xargs grep -l -E 'sk-or-v1-[A-Za-z0-9]{20,}|sk-[A-Za-z0-9_-]{30,}' 2>/dev/null); then
  echo "REFUSED: a file above contains something shaped like an API key" >&2
  exit 1
fi
(cd extension && echo "$files" | zip -q -X "../$out" -@)
if unzip -l "$out" | grep -E '\.local\.|\.env' ; then
  echo "REFUSED: a local file got into $out" >&2
  rm -f "$out"; exit 1
fi
echo "$out"
unzip -l "$out" | tail -n +4 | head -n -2 | awk '{print "  " $4}'

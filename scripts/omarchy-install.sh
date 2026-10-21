#!/usr/bin/env bash
# Install x-stamp the way Omarchy installs its own Chromium extensions: add this
# checkout's extension/ folder to the --load-extension= line in each browser's
# ~/.config/<browser>-flags.conf. No Developer mode, no Load unpacked. The
# browser picks it up at its next start.
#
#   scripts/omarchy-install.sh              install
#   scripts/omarchy-install.sh --uninstall  remove it again
#
# Mirrors Omarchy's own migration that added WhatsApp Slim (append to an existing
# line, or add one; never rewrite the others), so Omarchy updates leave it alone.
# Branded Google Chrome ignores --load-extension since version 137; Chromium,
# Brave and Edge honour it. Nothing here touches your key: the options page asks
# for it on first start.
set -euo pipefail

ext="$(cd "$(dirname "$0")/../extension" && pwd)"
[ -f "$ext/manifest.json" ] || { echo "can't find the extension folder at $ext" >&2; exit 1; }

browsers=(chromium chrome google-chrome brave brave-beta brave-nightly brave-origin microsoft-edge-stable)
mode="${1:-install}"
changed=0

install_into() {
  local file=$1
  if grep -qF "$ext" "$file"; then
    echo "  already in $file"
    return
  fi
  cp -L "$file" "$file.bak-x-stamp"
  if grep -q "^--load-extension=" "$file"; then
    sed -i --follow-symlinks "s|^--load-extension=\(.*\)$|--load-extension=\1,$ext|" "$file"
  else
    [[ -n $(tail -c1 "$file") ]] && echo >>"$file"
    echo "--load-extension=$ext" >>"$file"
  fi
  echo "  added to $file (backup: $file.bak-x-stamp)"
  changed=1
}

uninstall_from() {
  local file=$1
  grep -qF "$ext" "$file" || return 0
  # drop the line if x-stamp was its only extension, else just its entry
  sed -i --follow-symlinks \
    -e "\\|^--load-extension=$ext\$|d" -e "s|,$ext||g" -e "s|=$ext,|=|" "$file"
  echo "  removed from $file"
  changed=1
}

found=0
for b in "${browsers[@]}"; do
  file="$HOME/.config/$b-flags.conf"
  [ -f "$file" ] || continue
  found=1
  case "$mode" in
    --uninstall) uninstall_from "$file" ;;
    *) install_into "$file" ;;
  esac
done

if [ "$found" = 0 ]; then
  echo "No browser flags file in ~/.config (this looks like it isn't Omarchy)." >&2
  echo "Install by hand instead: chrome://extensions → Developer mode → Load unpacked → $ext" >&2
  exit 1
fi

if [ "$changed" = 1 ]; then
  echo "Done. Quit your browser completely and start it again."
  [ "$mode" = --uninstall ] || echo "On first start x-stamp opens its options page: paste your OpenRouter key there."
fi

#!/usr/bin/env bash
# Put the repo's hooks where git will run them. Safe to re-run.
#
# Hooks live in scripts/hooks/ so they are version-controlled and survive a clone;
# .git/hooks is not. This copies rather than symlinks, so a hook cannot be changed
# by a branch checkout without the copy being re-run deliberately.
set -euo pipefail
cd "$(dirname "$0")/../.."

if git config --get core.hooksPath >/dev/null; then
  echo "core.hooksPath is set to '$(git config --get core.hooksPath)' — it overrides" >&2
  echo ".git/hooks, so installing there would do nothing. Point it here instead:" >&2
  echo "  git config core.hooksPath scripts/hooks" >&2
  exit 1
fi

for h in scripts/hooks/*; do
  name="$(basename "$h")"
  [ "$name" = "install.sh" ] && continue
  install -m 755 "$h" ".git/hooks/$name"
  echo "installed .git/hooks/$name"
done

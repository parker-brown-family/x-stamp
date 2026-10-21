#!/usr/bin/env python3
"""Scan and archive the same file bytes; publish the archive only on success."""
import fnmatch
import json
import os
from pathlib import Path
import re
import stat
import sys
import tempfile
import zipfile

KEY = re.compile(rb"sk-or-v1-[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9_-]{30,}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{50,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{30,}|xox[baprs]-[A-Za-z0-9-]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----")


def inventory(root):
    def fail(error):
        raise error

    entries = []
    for directory, dirs, files in os.walk(root, onerror=fail, followlinks=False):
        dirs[:] = sorted(d for d in dirs if not d.startswith("."))
        for name in dirs + sorted(files):
            path = Path(directory) / name
            if name.startswith(".") or fnmatch.fnmatch(name, "*.local.*"):
                if name in dirs:
                    dirs.remove(name)
                continue
            mode = path.lstat().st_mode
            if stat.S_ISLNK(mode):
                raise ValueError("symbolic links are not allowed: " + str(path.relative_to(root)))
            if stat.S_ISDIR(mode):
                continue
            if not stat.S_ISREG(mode):
                raise ValueError("not a regular file: " + str(path.relative_to(root)))
            data = path.read_bytes()  # a read error is a build failure
            if KEY.search(data):
                raise ValueError("credential pattern in " + str(path.relative_to(root)))
            entries.append((path.relative_to(root).as_posix(), data))
    return sorted(entries)


def package(root):
    extension = root / "extension"
    if extension.is_symlink():
        raise ValueError("extension directory must not be a symbolic link")
    entries = inventory(extension)
    manifest = json.loads(dict(entries)["manifest.json"])
    version = manifest["version"]
    if not isinstance(version, str) or not re.fullmatch(r"[0-9]+(?:\.[0-9]+){1,3}", version):
        raise ValueError("invalid manifest version")
    dist = root / "dist"
    dist.mkdir(exist_ok=True)
    target = dist / ("x-stamp-" + version + ".zip")
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(prefix=".x-stamp-", suffix=".zip", dir=dist, delete=False) as file:
            temporary = Path(file.name)
        with zipfile.ZipFile(temporary, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for name, data in entries:
                archive.writestr(name, data)
        os.replace(temporary, target)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
    print(target.relative_to(root))
    for name, _ in entries:
        print("  " + name)


if __name__ == "__main__":
    try:
        package(Path(__file__).resolve().parent.parent)
    except (OSError, ValueError, KeyError, TypeError) as error:
        print("REFUSED: " + str(error), file=sys.stderr)
        sys.exit(1)

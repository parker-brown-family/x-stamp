import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, chmodSync, symlinkSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
const dummy = "sk-or-v1-" + "A".repeat(64);

function fixture(fn) {
  const root = mkdtempSync(join(tmpdir(), "x-stamp-package-"));
  mkdirSync(join(root, "extension")); mkdirSync(join(root, "scripts"));
  for (const name of ["package.sh", "package.py"]) copyFileSync(resolve("scripts", name), join(root, "scripts", name));
  writeFileSync(join(root, "extension/manifest.json"), '{"version":"0.3.2"}');
  const run = () => spawnSync("bash", ["scripts/package.sh"], { cwd: root, encoding: "utf8" });
  try { fn(root, run); } finally { rmSync(root, { recursive: true, force: true }); }
}

test("packaging rejects credentials in whitespace filenames without printing the token", () => {
  for (const name of ["plain.txt", "audit notes.txt", "audit\tnotes.txt", "audit\nnotes.txt"]) {
    fixture((root, run) => {
      writeFileSync(join(root, "extension", name), dummy);
      const r = run();
      assert.notEqual(r.status, 0, name);
      assert.ok(!(r.stdout + r.stderr).includes(dummy), "printed the secret");
      assert.deepEqual(readdirSync(join(root, "extension")).sort(), ["manifest.json", name].sort());
    });
  }
});
test("clean whitespace files are archived and local files/hidden folders are excluded", () => fixture((root, run) => {
  writeFileSync(join(root, "extension/clean notes.txt"), "safe text");
  writeFileSync(join(root, "extension/key.local.json"), dummy);
  mkdirSync(join(root, "extension/.private"));
  writeFileSync(join(root, "extension/.private/.env"), dummy);
  assert.equal(run().status, 0);
  const r = spawnSync("python3", ["-I", "-c",
    "import zipfile; z=zipfile.ZipFile('dist/x-stamp-0.3.2.zip'); assert sorted(z.namelist())==['clean notes.txt','manifest.json']; assert z.read('clean notes.txt')==b'safe text'"], { cwd: root });
  assert.equal(r.status, 0, r.stderr?.toString());
}));
test("unreadable files, symlinks and invalid versions fail without replacing a valid archive", () => fixture((root, run) => {
  assert.equal(run().status, 0);
  const artifact = join(root, "dist/x-stamp-0.3.2.zip");
  const before = readFileSync(artifact);
  const bad = join(root, "extension/unreadable.txt");
  writeFileSync(bad, "unreadable"); chmodSync(bad, 0);
  try { assert.notEqual(run().status, 0); } finally { chmodSync(bad, 0o600); rmSync(bad); }
  symlinkSync("/does-not-exist", bad);
  assert.notEqual(run().status, 0); rmSync(bad);
  writeFileSync(join(root, "extension/manifest.json"), '{"version":"../../escape"}');
  assert.notEqual(run().status, 0);
  assert.deepEqual(readFileSync(artifact), before);
  assert.deepEqual(readdirSync(join(root, "dist")), ["x-stamp-0.3.2.zip"]);
}));

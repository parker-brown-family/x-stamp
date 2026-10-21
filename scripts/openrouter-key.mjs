// Where the scripts and tests find an OpenRouter key, in order: the
// OPENROUTER_API_KEY environment variable, a .env file at the repo root
// (gitignored), or extension/key.local.json (gitignored, written by
// scripts/install-key.sh). Never from a tracked file.
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export function openrouterKey() {
  if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY.trim();
  const env = join(root, ".env");
  if (existsSync(env)) {
    const m = readFileSync(env, "utf8").match(/^OPENROUTER_API_KEY=["']?([^"'\s]+)/m);
    if (m) return m[1];
  }
  const local = join(root, "extension/key.local.json");
  if (existsSync(local)) return JSON.parse(readFileSync(local, "utf8")).openrouter;
  throw new Error("No OpenRouter key: set OPENROUTER_API_KEY, or put OPENROUTER_API_KEY=... in .env at the repo root");
}

// Record the fixture feed in motion (not a test): the extension loaded in
// Chromium, x.com served from test/fixture/home.html, real Jev, a slow scroll.
//   node test/fixture-video.mjs   → test/out/fixture.webm
import { chromium } from "playwright";
import { readFileSync, mkdtempSync, rmSync, renameSync, readdirSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ext = join(root, "extension");
const out = join(root, "test/out");
mkdirSync(join(out, "video"), { recursive: true });
const profile = mkdtempSync(join(tmpdir(), "x-stamp-video-"));
const ctx = await chromium.launchPersistentContext(profile, {
  channel: "chromium", headless: true, viewport: { width: 640, height: 900 },
  recordVideo: { dir: join(out, "video"), size: { width: 640, height: 900 } },
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
});
let [sw] = ctx.serviceWorkers(); sw ??= await ctx.waitForEvent("serviceworker");
for (const p of ctx.pages()) if (p.url().startsWith("chrome-extension://")) await p.close();
await sw.evaluate(() => chrome.storage.local.set({ enabled: true }));
await ctx.route("https://x.com/**", (r) => r.request().resourceType() === "document"
  ? r.fulfill({ contentType: "text/html", body: readFileSync(join(root, "test/fixture/home.html"), "utf8") }) : r.fulfill({ status: 204 }));
const page = await ctx.newPage();
await page.goto("https://x.com/home");
await page.waitForTimeout(3000);
for (let i = 0; i < 16; i++) { await page.mouse.wheel(0, 260); await page.waitForTimeout(900); }
await page.waitForTimeout(1500);
const v = page.video();
await ctx.close();
renameSync(await v.path(), join(out, "fixture.webm"));
rmSync(profile, { recursive: true, force: true });
console.log("test/out/fixture.webm");

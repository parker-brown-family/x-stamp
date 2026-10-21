// Record x-stamp on the live feed: attach to the x-stamp Chromium over its
// loopback DevTools port, reload X so every stamp drops fresh, scroll like a
// person, switch stamps off and on, and write an MP4.
//
//   X_STAMP_DEBUG_PORT=9333 ./scripts/x-stamp-browser
//   node scripts/demo.mjs [out.mp4]
//
// Frames come from the page itself (Page.startScreencast), so nothing on the
// desktop is driven and nothing else on screen is captured.
import { chromium } from "playwright";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

const port = process.env.X_STAMP_DEBUG_PORT ?? "9333";
const work = join(homedir(), ".local/share/x-stamp/demo");
const out = process.argv[2] ?? join(work, `x-stamp-demo-${new Date().toISOString().slice(0, 10)}.mp4`);
const frames = join(work, "frames");
rmSync(frames, { recursive: true, force: true });
mkdirSync(frames, { recursive: true });

const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
const ctx = browser.contexts()[0];
const page = ctx.pages().find((p) => p.url().startsWith("https://x.com/")) ?? (await ctx.newPage());
const sw = ctx.serviceWorkers().find((w) => w.url().startsWith("chrome-extension://"));
if (!sw) throw new Error("x-stamp's service worker is not running in this browser");
await sw.evaluate(() => chrome.storage.local.set({ enabled: true }));

await page.bringToFront();
await page.goto("https://x.com/home");
await page.waitForSelector('article[data-testid="tweet"]', { timeout: 20000 });
await page.waitForTimeout(1500);

const cdp = await ctx.newCDPSession(page);
const shots = [];
cdp.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
  const f = join(frames, `f${String(shots.length).padStart(5, "0")}.jpg`);
  writeFileSync(f, Buffer.from(data, "base64"));
  shots.push({ f, t: metadata.timestamp });
  await cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
});
await cdp.send("Page.startScreencast", { format: "jpeg", quality: 85, everyNthFrame: 1 });

const pause = (ms) => page.waitForTimeout(ms);
const glide = async (px, ms = 600) => {
  const steps = 12;
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, px / steps);
    await pause(ms / steps);
  }
};

await page.mouse.move(400, 500);
await pause(1800);
for (let i = 0; i < 9; i++) {
  await glide(520);
  await pause(1500);
}
// The toolbar switch does exactly this: one storage flag every tab listens to.
await sw.evaluate(() => chrome.storage.local.set({ enabled: false }));
await pause(1600);
await sw.evaluate(() => chrome.storage.local.set({ enabled: true }));
await pause(1800);
await glide(520);
await pause(1800);

await cdp.send("Page.stopScreencast");
await pause(300);
const stats = (await sw.evaluate(() => chrome.storage.local.get("stats"))).stats;
// No browser.close(): over connectOverCDP it shut the x-stamp window down
// (2026-10-21). Leaving the process drops the connection and the window stays.

// Each frame lasts until the next one arrived, so the video keeps real time.
const list = shots.map((s, i) => `file '${s.f}'\nduration ${((shots[i + 1]?.t ?? s.t + 0.5) - s.t).toFixed(3)}`).join("\n");
writeFileSync(join(work, "frames.txt"), `${list}\nfile '${shots.at(-1).f}'\n`);
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", join(work, "frames.txt"),
  "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2,fps=30", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", out]);
console.log(`${shots.length} frames, ${(shots.at(-1).t - shots[0].t).toFixed(1)} s → ${out}`);
console.log("stats", stats);
process.exit(0);

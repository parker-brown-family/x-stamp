// End to end: real Chromium, the real unpacked extension, x.com served from a
// fixture, and real Jev answering through OpenRouter. Scrolls the feed like a
// person and measures how long each stamp spot is on screen before its stamp
// lands, which is what "label quicker" means.
//
//   npm run e2e            # writes test/out/e2e.png
import { chromium } from "playwright";
import { readFileSync, mkdtempSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { openrouterKey } from "../scripts/openrouter-key.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ext = join(root, "extension");
const fixture = readFileSync(join(root, "test/fixture/home.html"), "utf8");
const key = openrouterKey();

const TEXT_POSTS = 19; // fixture posts with words; 1005 is a picture only
const profile = mkdtempSync(join(tmpdir(), "x-stamp-e2e-"));
const ctx = await chromium.launchPersistentContext(profile, {
  channel: "chromium",
  headless: true,
  viewport: { width: 640, height: 900 },
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
});
const step = (s) => console.log(`· ${s}`);
const stats = async () => (await sw.evaluate(() => chrome.storage.local.get("stats"))).stats;
let sw;

try {
  [sw] = ctx.serviceWorkers();
  sw ??= await ctx.waitForEvent("serviceworker");
  for (const p of ctx.pages()) if (p.url().startsWith("chrome-extension://")) await p.close();
  // With extension/key.local.json present (scripts/install-key.sh) the test runs
  // the real install path; without it, the key goes into the throwaway profile.
  const fileKey = existsSync(join(ext, "key.local.json"));
  await sw.evaluate((k) => chrome.storage.local.set({ ...(k ? { key: k } : {}), enabled: true, stats: null }), fileKey ? null : key);
  step(`extension loaded, key from ${fileKey ? "key.local.json" : "the throwaway profile"}`);

  await ctx.route("https://x.com/**", (route) =>
    route.request().resourceType() === "document"
      ? route.fulfill({ contentType: "text/html", body: fixture })
      : route.fulfill({ status: 204 }),
  );
  const page = await ctx.newPage();
  // Watch from the page: when each stamp spot comes on screen, when each stamp lands.
  await page.addInitScript(() => {
    const xs = (window.__xs = { seen: {}, stamped: {} });
    const idOf = (art) => art?.querySelector('a[href*="/status/"]')?.getAttribute("href").match(/status\/(\d+)/)?.[1];
    const io = new IntersectionObserver(
      (es) => { for (const e of es) if (e.isIntersecting) { const id = idOf(e.target.parentElement); if (id) xs.seen[id] ??= performance.now(); } },
      { rootMargin: "0px 0px -8% 0px" },
    );
    new MutationObserver((ms) => {
      for (const m of ms) for (const n of m.addedNodes) {
        if (n.classList?.contains("xstamp-spot")) io.observe(n);
        if (n.classList?.contains("xstamp")) xs.stamped[n.dataset.xstampId] ??= performance.now();
      }
    }).observe(document, { childList: true, subtree: true });
  });
  await page.goto("https://x.com/home");
  await page.waitForTimeout(2500); // the first screen lands, and the next two are asked ahead

  // Scroll a screen at a time, pausing about as long as a person glances.
  for (let i = 0; i < 12; i++) {
    await page.mouse.wheel(0, 650);
    await page.waitForTimeout(700);
  }
  await page.waitForTimeout(1500);

  const { seen, stamped } = await page.evaluate(() => window.__xs);
  const rows = await page.$$eval("article", (as) =>
    as.map((a) => ({
      id: a.querySelector('a[href*="/status/"]').getAttribute("href").match(/status\/(\d+)/)[1],
      post: a.querySelector('[data-testid="tweetText"]')?.textContent.slice(0, 34) ?? "(picture only)",
      top: Math.round(a.getBoundingClientRect().top + scrollY),
      stamp: a.querySelector(":scope > .xstamp")?.innerText.replace(/\n/g, " · ") ?? null,
    })),
  );
  // Lag only means something for posts below the first screen: those are the
  // ones the scroll brings in, and the ones asking ahead is meant to have ready.
  for (const r of rows) {
    r.lagMs = r.id in seen && r.id in stamped && r.top > 900 ? Math.max(0, Math.round(stamped[r.id] - seen[r.id])) : null;
  }
  console.table(rows.map(({ post, stamp, lagMs }) => ({ post, stamp, lagMs })));

  const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
  assert.equal(byId["1005"].stamp, null, "picture-only post was stamped");
  assert.equal(byId["1021"].stamp, null, "a reply was stamped");
  const meterText = await page.$eval(".xstamp-meter", (e) => e.textContent).catch(() => null);
  assert.match(meterText ?? "", /^TODAY\$[\d.]+\d+WEEK≥?\$[\d.]+\d+ALL\$[\d.]+\d+$/, `no cost meter on screen: ${meterText}`);
  step(`meter: ${meterText}`);
  const [logo, meterBox] = await Promise.all([
    page.$eval('header[role="banner"] h1 a', (e) => e.getBoundingClientRect().toJSON()),
    page.$eval(".xstamp-meter", (e) => e.getBoundingClientRect().toJSON()),
  ]);
  assert.ok(meterBox.left >= logo.right && meterBox.left - logo.right < 20 && meterBox.top < logo.bottom, "meter is not beside the X logo");
  mkdirSync(join(root, "test/out"), { recursive: true });
  await page.locator(".xstamp-meter").screenshot({ path: join(root, "test/out/meter.png") });
  assert.match(byId["1003"].stamp ?? "", /^PAID ADVERT/, "X's paid ad was not stamped PAID ADVERT");
  // One small stamp per post and nothing over the window (the film's big red box
  // and builder piles were removed, 2026-10-21).
  assert.match(byId["1007"].stamp ?? "", /^ENGAGEMENT/, "the engagement post did not get an ENGAGEMENT stamp");
  assert.equal(await page.$$eval(".xstamp-layer, .xstamp-pile, .xstamp-big", (e) => e.length), 0, "something bigger than a stamp was drawn");
  assert.ok(await page.$$eval("article", (as) => as.every((a) => a.querySelectorAll(":scope > .xstamp").length <= 1)), "a post has more than one stamp");
  assert.ok(!/pixelpals\.app\/|=2|https/.test(byId["1009"].stamp ?? ""), `link pieces reached the quote: ${byId["1009"].stamp}`);
  const stampedCount = rows.filter((r) => r.stamp).length;
  assert.ok(stampedCount >= 0.8 * TEXT_POSTS, `only ${stampedCount}/${TEXT_POSTS} text posts stamped`);
  for (const r of rows) {
    const quote = r.stamp?.match(/“(.+)”/)?.[1];
    if (quote) assert.ok(quote.split(/\s+/).length <= 10, `quote over ten words: ${quote}`);
  }
  const lags = rows.map((r) => r.lagMs).filter((l) => l !== null).sort((a, b) => a - b);
  const median = lags[Math.floor(lags.length / 2)];
  step(`${stampedCount}/${TEXT_POSTS} text posts stamped; below the first screen, stamp landed ${median} ms (median) and ${lags.at(-1)} ms (worst) after its spot came on screen, over ${lags.length} posts`);
  assert.ok(lags.length >= 8, "too few posts measured below the first screen");
  assert.ok(median <= 100, `median lag ${median} ms: stamps are not ready before posts arrive`);

  mkdirSync(join(root, "test/out"), { recursive: true });
  await page.screenshot({ path: join(root, "test/out/e2e.png"), fullPage: true });
  step("screenshot: test/out/e2e.png");

  const s = await stats();
  console.log("stats", s);
  assert.equal(s.requests, TEXT_POSTS, "expected exactly one request per text post");

  // Off: every stamp lifts, and nothing new is asked.
  await sw.evaluate(() => chrome.storage.local.set({ enabled: false }));
  await page.waitForFunction(() => document.querySelectorAll(".xstamp").length === 0, null, { timeout: 2000 });
  step("switched off: all stamps gone");

  // On again: stamps on screen return without asking Jev again.
  await sw.evaluate(() => chrome.storage.local.set({ enabled: true }));
  await page.waitForFunction(() => document.querySelectorAll(".xstamp").length > 0, null, { timeout: 3000 });
  assert.equal((await stats()).requests, TEXT_POSTS, "switching back on asked Jev again");
  step("switched on: stamps back, no new requests");

  // A reload drops the page's memory; the worker's session cache still answers.
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll(".xstamp").length > 0, null, { timeout: 5000 });
  await page.waitForTimeout(1000);
  assert.equal((await stats()).requests, TEXT_POSTS, "a reload asked Jev again");
  step("reloaded: stamps back from the cache, no new requests");

  // A newer copy arriving in an open X tab, as after an install, update or
  // Reload (Parker, 2026-10-21: "after clicking around a bit we lose the
  // extension"): the tab keeps one meter and keeps stamping, no page reload.
  const open = await ctx.newPage();
  await open.goto("https://x.com/home?many");
  await open.waitForSelector(".xstamp-meter");
  const runBefore = await open.evaluate(() => document.documentElement.dataset.xstampRun);
  // Headless Chromium doesn't bring an extension back after chrome.runtime.reload()
  // when it was loaded from the command line, so inject the newer copy the same
  // way reinject() does after a real install, update or Reload.
  await sw.evaluate(async () => {
    const tabs = await chrome.tabs.query({ url: ["https://x.com/*"] });
    for (const t of tabs) {
      await chrome.scripting.insertCSS({ target: { tabId: t.id }, files: ["stamp.css"] });
      await chrome.scripting.executeScript({ target: { tabId: t.id }, files: ["content.js"] });
    }
  });
  await open.waitForFunction((r) => document.documentElement.dataset.xstampRun !== r, runBefore, { timeout: 15000 });
  const stampedBefore = await open.$$eval(".xstamp", (e) => e.length);
  for (let i = 0; i < 6; i++) { await open.mouse.wheel(0, 700); await open.waitForTimeout(900); }
  await open.waitForTimeout(2500);
  const after = await open.evaluate(() => ({
    meters: document.querySelectorAll(".xstamp-meter").length,
    meter: document.querySelector(".xstamp-meter")?.textContent ?? "",
    stamps: document.querySelectorAll(".xstamp").length,
  }));
  step(`newer copy injected into an open tab: ${after.meters} meter, stamps ${stampedBefore} → ${after.stamps}`);
  assert.equal(after.meters, 1, "expected exactly one meter after a newer copy arrived");
  assert.ok(!/reload this tab/.test(after.meter), "the tab was left asking to be reloaded");
  assert.ok(after.stamps > stampedBefore, "no new stamps after reloading the extension");
  await open.close();

  // A power scroll (Parker's demo, 2026-10-21): ten screens a second to the
  // bottom of 120 posts, then stop. Posts flown past shouldn't be paid for, and
  // the posts the scroll stops on must still be stamped.
  const fast = await ctx.newPage();
  await fast.goto("https://x.com/home?many");
  await fast.waitForFunction(() => document.querySelectorAll('article[data-testid="tweet"]').length > 100);
  const before = (await stats()).requests;
  for (let i = 0; i < 40; i++) {
    await fast.mouse.wheel(0, 900 * 2);
    await fast.waitForTimeout(100);
  }
  const passed = await fast.$$eval('article[data-testid="tweet"]', (as) => as.filter((a) => a.getBoundingClientRect().bottom < 0).length);
  const duringFlight = (await stats()).requests - before;
  await fast.waitForTimeout(4000);
  const landed = await fast.$$eval('article[data-testid="tweet"]', (as) => {
    const vis = as.filter((a) => { const r = a.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && a.querySelector('[data-testid="tweetText"]'); });
    return { visible: vis.length, stamped: vis.filter((a) => a.querySelector(":scope > .xstamp")).length };
  });
  step(`power scroll: flew past ${passed} posts with ${duringFlight} requests; where it stopped, ${landed.stamped}/${landed.visible} fully visible posts stamped`);
  assert.ok(duringFlight < passed / 3, `power scroll paid for ${duringFlight} of ${passed} posts flown past`);
  assert.ok(landed.visible > 0 && landed.stamped >= landed.visible - 1, `stamps died after a power scroll: ${landed.stamped}/${landed.visible}`);
  await fast.close();

  console.log(`\nPASS · ${s.requests} requests · avg ${Math.round(s.ms / (s.requests - s.errors))} ms per answer · ` +
    (s.costKnown ? `$${(s.cost / s.costKnown).toFixed(6)} per post` : "cost not reported"));
} finally {
  await ctx.close();
  rmSync(profile, { recursive: true, force: true });
}

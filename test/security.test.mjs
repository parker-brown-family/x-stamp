// Real Chromium and extension messaging, with no provider calls or real key.
import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdtempSync, cpSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { LIMITS } from "../extension/lib/limits.js";

test("extension security boundaries and lifecycle", { timeout: 60000 }, async (t) => {
  const root = mkdtempSync(join(tmpdir(), "x-stamp-security-"));
  const ext = join(root, "extension");
  cpSync(resolve("extension"), ext, { recursive: true, filter: (p) => !p.endsWith("key.local.json") });
  let ctx, sw, options, content;
  let nextId = 8000000000000;
  const msg = () => ({ type: "judge", id: String(nextId++), post: { text: "Safe synthetic security fixture" } });
  async function until(fn) {
    const end = Date.now() + 5000;
    while (!(await fn())) {
      if (Date.now() > end) throw new Error("condition timed out");
      await new Promise((r) => setTimeout(r, 20));
    }
  }
  async function world(page) {
    const cdp = await ctx.newCDPSession(page), worlds = [];
    cdp.on("Runtime.executionContextCreated", (e) => worlds.push(e.context));
    await cdp.send("Runtime.enable");
    await page.goto("https://x.com/home");
    await until(() => worlds.some((w) => w.origin.startsWith("chrome-extension://")));
    const id = worlds.find((w) => w.origin.startsWith("chrome-extension://")).id;
    return async (expression) => {
      const r = await cdp.send("Runtime.evaluate", { contextId: id, expression, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
      return r.result.value;
    };
  }
  async function mock() {
    await sw.evaluate(async () => {
      const original = fetch.bind(globalThis);
      globalThis.audit = { calls: [], active: 0, peak: 0, aborted: 0, hold: false, pending: [] };
      globalThis.fetch = async (url, opts = {}) => {
        if (String(url).startsWith(chrome.runtime.getURL(""))) return original(url, opts);
        if (String(url) !== "https://openrouter.ai/api/v1/systemone") throw new Error("unexpected network destination");
        const body = JSON.parse(opts.body);
        audit.calls.push({ enabled: (await chrome.storage.local.get("enabled")).enabled, body });
        audit.active++; audit.peak = Math.max(audit.peak, audit.active);
        try {
          if (opts.signal.aborted) throw new DOMException("cancelled", "AbortError");
          if (audit.hold) await new Promise((resolve, reject) => {
            const abort = () => { audit.aborted++; reject(new DOMException("cancelled", "AbortError")); };
            opts.signal.addEventListener("abort", abort, { once: true });
            audit.pending.push(() => { opts.signal.removeEventListener("abort", abort); resolve(); });
          });
          const phrase = Object.keys(body.questions.gist?.criteria ?? {})[0];
          return new Response(JSON.stringify({
            answers: { type: { probabilities: { NEWS: 1 } }, category: { probabilities: { TECH: 1 } },
              ...(phrase ? { gist: { probabilities: { [phrase]: 1 } } } : {}) },
            usage: { cost: 0.0001 }, model: "audit-mock",
          }), { headers: { "Content-Type": "application/json" } });
        } finally { audit.active--; }
      };
    });
  }
  async function boot() {
    ctx = await chromium.launchPersistentContext(join(root, "profile"), {
      channel: "chromium", headless: true,
      args: ["--disable-extensions-except=" + ext, "--load-extension=" + ext],
    });
    [sw] = ctx.serviceWorkers(); sw ??= await ctx.waitForEvent("serviceworker");
    await mock();
    await sw.evaluate(() => chrome.storage.local.set({ key: "AUDIT_DUMMY_NOT_A_CREDENTIAL", enabled: false }));
    await ctx.route("https://x.com/**", (r) => r.fulfill({ contentType: "text/html", body: "<!doctype html><main></main>" }));
    options = await ctx.newPage();
    await options.goto(sw.url().replace("background.js", "options.html"));
    content = await world(await ctx.newPage());
    assert.deepEqual(await content('chrome.runtime.sendMessage({type:"getState"})'), { enabled: false });
  }
  const ui = (message) => options.evaluate((m) => chrome.runtime.sendMessage(m), message);
  const send = (message) => content("chrome.runtime.sendMessage(" + JSON.stringify(message) + ")");
  const release = () => sw.evaluate(() => { audit.hold = false; audit.pending.splice(0).forEach((r) => r()); });
  async function reset() {
    await sw.evaluate(() => chrome.storage.local.set({ enabled: false }));
    await release();
    await until(async () => (await sw.evaluate(() => audit.active)) === 0);
    await ui({ type: "setRecording", enabled: false });
    await ui({ type: "clearRecordings" });
    await sw.evaluate(async () => {
      await chrome.storage.session.set({ requestWindow: [], postCache: {} });
      await chrome.storage.local.remove("dailyRequests");
      audit.calls = []; audit.aborted = 0; audit.peak = 0;
      await chrome.storage.local.set({ enabled: true });
    });
  }
  async function startBatch(n) {
    const messages = Array.from({ length: n }, msg);
    await content("globalThis.auditResults=null;globalThis.auditJob=Promise.all(" + JSON.stringify(messages) +
      ".map(m=>chrome.runtime.sendMessage(m))).then(r=>globalThis.auditResults=r);void 0");
  }
  const finishBatch = () => content("globalThis.auditJob");

  try {
    await boot();
    await t.test("content cannot read credentials or invoke options commands", async () => {
      assert.equal(await content('chrome.storage.local.get("key").then(()=>false,()=>true)'), true);
      assert.equal(await content('globalThis.keyEvent=false;chrome.storage.onChanged.addListener(c=>{if(c.key)keyEvent=true});false'), false);
      await sw.evaluate(() => chrome.storage.local.set({ key: "AUDIT_ANOTHER_DUMMY" }));
      assert.equal(await content("globalThis.keyEvent"), false);
      for (const type of ["test", "keySource", "repaint", "setRecording", "clearRecordings"]) {
        assert.equal((await send({ type, text: "synthetic", enabled: true })).reason, "forbidden");
      }
      assert.equal(await ui({ type: "keySource" }), "options");
      assert.equal((await ui({ type: "test", text: "Explicit test while stamps are off" })).status, "stamp");
    });
    await t.test("Off aborts active uploads, drains queued jobs, and allows later work", async () => {
      await reset();
      await sw.evaluate(() => { audit.hold = true; });
      await startBatch(12);
      await until(async () => (await sw.evaluate(() => audit.calls.length)) === 6);
      await sw.evaluate(() => chrome.storage.local.set({ enabled: false }));
      const results = await finishBatch();
      assert.equal(results.length, 12);
      assert.ok(results.every((r) => r.status === "off"));
      assert.equal(await sw.evaluate(() => audit.calls.length), 6);
      assert.equal(await sw.evaluate(() => audit.aborted), 6);
      await release();
      await sw.evaluate(() => chrome.storage.local.set({ enabled: true }));
      assert.equal((await send(msg())).status, "stamp");
    });
    await t.test("Clear and Recording changes invalidate old answers, including queued jobs", async () => {
      for (const action of ["clear", "off-on", "queued-clear"]) {
        await reset();
        await ui({ type: "setRecording", enabled: true });
        await sw.evaluate(() => { audit.hold = true; });
        await startBatch(action === "queued-clear" ? 12 : 1);
        await until(async () => (await sw.evaluate(() => audit.calls.length)) === (action === "queued-clear" ? 6 : 1));
        if (action === "off-on") {
          await ui({ type: "setRecording", enabled: false });
          await ui({ type: "setRecording", enabled: true });
        } else await ui({ type: "clearRecordings" });
        await release(); await finishBatch();
        assert.equal((await sw.evaluate(() => chrome.storage.local.get("recordings"))).recordings.length, 0, action);
        assert.equal((await send(msg())).status, "stamp");
        assert.equal((await sw.evaluate(() => chrome.storage.local.get("recordings"))).recordings.length, 1, "new consent must work");
      }
    });
    await t.test("simultaneous recording writes retain every permitted answer", async () => {
      await reset(); await ui({ type: "setRecording", enabled: true });
      await startBatch(6); await finishBatch();
      assert.equal((await sw.evaluate(() => chrome.storage.local.get("recordings"))).recordings.length, 6);
    });
    await t.test("malformed and oversized fields are rejected before fetching", async () => {
      await reset();
      const messages = [
        { ...msg(), id: "not-a-status" },
        { ...msg(), post: null },
        { ...msg(), post: { text: "x".repeat(20001) } },
        { ...msg(), post: { text: "valid text", author: "x".repeat(257) } },
        { ...msg(), post: { text: "valid text", quoted_text: {} } },
        { ...msg(), promoted: "true" },
      ];
      for (const m of messages) assert.equal((await send(m)).reason, "invalid-request");
      assert.equal((await ui({ type: "test", text: "x".repeat(20001) })).reason, "invalid-request");
      assert.equal(await sw.evaluate(() => audit.calls.length), 0);
    });
    await t.test("a burst bounds active jobs and the pending queue", async () => {
      await reset(); await sw.evaluate(() => { audit.hold = true; });
      await startBatch(100);
      await until(async () => (await sw.evaluate(() => audit.calls.length)) === 6);
      await release(); const results = await finishBatch();
      assert.equal(results.filter((r) => r.reason === "busy").length, 100 - LIMITS.active - LIMITS.pending);
      assert.equal(await sw.evaluate(() => audit.peak), LIMITS.active);
      assert.equal(await sw.evaluate(() => audit.calls.length), LIMITS.active + LIMITS.pending);
    });
    await t.test("per-tab and global minute limits reject excess work", async () => {
      await reset();
      await startBatch(LIMITS.perTabMinute); await finishBatch();
      assert.equal((await send(msg())).reason, "rate-limited");
      const other = await world(await ctx.newPage());
      await sw.evaluate(() => chrome.storage.session.set({ requestWindow: Array.from({ length: 59 },
        () => ({ at: Date.now(), tab: -1 })) }));
      assert.equal((await other("chrome.runtime.sendMessage(" + JSON.stringify(msg()) + ")")).status, "stamp");
      assert.equal((await other("chrome.runtime.sendMessage(" + JSON.stringify(msg()) + ")")).reason, "rate-limited");
    });
    await t.test("cache deduplicates uploads, stays bounded, and quota failures settle", async () => {
      await reset();
      const m = msg();
      assert.equal((await send(m)).status, "stamp");
      assert.equal((await send(m)).cached, true);
      assert.equal(await sw.evaluate(() => audit.calls.length), 1);
      await sw.evaluate(() => chrome.storage.session.set({
        postCache: Object.fromEntries(Array.from({ length: 500 }, (_, i) => [String(7000000000000 + i), { status: "blank" }])),
      }));
      await send(msg());
      assert.equal(await sw.evaluate(async () => Object.keys((await chrome.storage.session.get("postCache")).postCache).length), 500);
      await sw.evaluate(() => {
        globalThis.originalSessionSet = chrome.storage.session.set.bind(chrome.storage.session);
        chrome.storage.session.set = async (v) => {
          if (v.postCache) throw new Error("simulated quota");
          return originalSessionSet(v);
        };
      });
      try { assert.equal((await send(msg())).status, "stamp"); }
      finally { await sw.evaluate(() => { chrome.storage.session.set = originalSessionSet; }); }
    });
    await t.test("real DOM stamps still render and toggle using the cache", async () => {
      await reset();
      const page = await ctx.newPage();
      await page.goto("https://x.com/home");
      await page.evaluate(() => {
        const a = document.createElement("article");
        a.style.cssText = "height:300px;width:500px";
        a.dataset.testid = "tweet";
        const text = document.createElement("div"); text.dataset.testid = "tweetText";
        text.textContent = "Harmless fixture <img src=x onerror=alert(1)> text";
        const link = document.createElement("a"); link.href = "/fixture/status/99999999999999";
        link.append(document.createElement("time")); a.append(text, link); document.querySelector("main").append(a);
      });
      await page.waitForSelector(".xstamp");
      assert.equal(await page.locator(".xstamp img").count(), 0);
      const count = await sw.evaluate(() => audit.calls.length);
      await sw.evaluate(() => chrome.storage.local.set({ enabled: false }));
      await page.waitForSelector(".xstamp", { state: "detached" });
      await sw.evaluate(() => chrome.storage.local.set({ enabled: true }));
      await page.waitForSelector(".xstamp");
      assert.equal(await sw.evaluate(() => audit.calls.length), count);
      await page.close();
    });
    await t.test("unreadable admission storage fails closed and later controls recover", async () => {
      await reset();
      await sw.evaluate(() => {
        globalThis.originalSessionSet = chrome.storage.session.set.bind(chrome.storage.session);
        chrome.storage.session.set = async () => { throw new Error("simulated quota"); };
      });
      try { assert.equal((await send(msg())).reason, "storage-or-request"); }
      finally { await sw.evaluate(() => { chrome.storage.session.set = originalSessionSet; }); }
      assert.equal(await sw.evaluate(() => audit.calls.length), 0);
      assert.equal(await ui({ type: "clearRecordings" }), true);
      assert.equal((await send(msg())).status, "stamp");
      await sw.evaluate(() => chrome.storage.local.set({
        dailyRequests: { day: new Date().toISOString().slice(0, 10) },
      }));
      assert.equal((await send(msg())).reason, "storage-or-request");
    });
    await t.test("daily limit fails closed and persists through a browser restart", async () => {
      await reset();
      await sw.evaluate(async () => {
        await chrome.storage.local.set({
          dailyRequests: { day: new Date().toISOString().slice(0, 10), count: 1000 },
          recordings: Array.from({ length: 300 }, () => ({ post: { text: "x".repeat(10000) } })),
        });
        await chrome.storage.local.remove("recordEpoch"); // upgrade from the old recorder
      });
      assert.equal((await send(msg())).reason, "daily-limit");
      await ctx.close(); await boot();
      assert.equal((await ui({ type: "test", text: "Explicit test with exhausted budget" })).reason, "daily-limit");
      assert.equal(await sw.evaluate(() => audit.calls.length), 0);
      assert.ok(await sw.evaluate(async () => {
        const state = await chrome.storage.local.get(["recordings", "recordEpoch"]);
        return state.recordEpoch && new TextEncoder().encode(JSON.stringify(state.recordings)).length <= 2 * 1024 * 1024;
      }), "upgrade must trim legacy recordings before adding metadata");
    });
  } finally { await ctx?.close(); rmSync(root, { recursive: true, force: true }); }
});

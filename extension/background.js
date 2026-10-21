// The worker owns credentials, admission, cancellation and recording writes.
import { cutCandidates } from "./lib/candidates.js";
import { askJev, buildRequest } from "./lib/jev.js";
import { decideStamp } from "./lib/rule.js";
import { LIMITS, validPost, trimRows } from "./lib/limits.js";

async function getKey() {
  const { key } = await chrome.storage.local.get("key");
  if (key) return key;
  try {
    const res = await fetch(chrome.runtime.getURL("key.local.json"));
    if (res.ok) return (await res.json()).openrouter || null;
  } catch {}
  return null;
}

async function paint() {
  const on = await isEnabled();
  const key = await getKey();
  const { stats } = await chrome.storage.local.get("stats");
  const s = stats ?? {};
  const state = on ? "on" : "off";
  await chrome.action.setIcon({
    path: { 16: `icons/${state}-16.png`, 32: `icons/${state}-32.png`, 48: `icons/${state}-48.png` },
  });
  let badge = "";
  if (!key) badge = "KEY";
  else if (s.lastError === "auth") badge = "ERR";
  await chrome.action.setBadgeText({ text: badge });
  await chrome.action.setBadgeBackgroundColor({ color: "#dc2626" });
  const cost = s.costKnown ? `$${s.cost.toFixed(5)} over ${s.costKnown}` : "cost not reported yet";
  await chrome.action.setTitle({
    title:
      `x-stamp: ${on ? "ON" : "OFF"} (click or Alt+Shift+S to switch)\n` +
      `${s.requests ?? 0} posts asked, ${s.errors ?? 0} failed` +
      (s.lastError ? ` (last: ${s.lastError})` : "") +
      `\n${cost}` +
      (!key ? "\nNo key: right-click the icon → Options" : ""),
  });
}

// Protect storage before handling any messages, including after worker restarts.
const ready = (async () => {
  await chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
  const state = await chrome.storage.local.get(["recordEpoch", "recordings"]);
  const patch = {};
  if (!state.recordEpoch) patch.recordEpoch = crypto.randomUUID();
  if (Array.isArray(state.recordings)) {
    patch.recordings = trimRows(state.recordings, LIMITS.recordingEntries, LIMITS.recordingBytes);
  }
  if (Object.keys(patch).length) await chrome.storage.local.set(patch);
  const session = await chrome.storage.session.get(null);
  const old = Object.keys(session).filter((k) => k.startsWith("j:"));
  if (old.length) await chrome.storage.session.remove(old);
})();
let writes = Promise.resolve();
function serialize(fn) {
  const result = writes.then(() => ready).then(fn);
  writes = result.catch(() => {});
  return result;
}
async function isEnabled() {
  return (await chrome.storage.local.get("enabled")).enabled !== false;
}
let generation = 0;
let running = 0;
let testId = 0;
let recordingGeneration = 0;
const jobs = new Map();
const waiting = [];
const active = new Set();
function cancelWork() {
  generation++;
  for (const ctl of active) ctl.abort();
  for (const job of waiting.splice(0)) {
    jobs.delete(job.key);
    job.resolve({ status: "off" });
  }
}
async function broadcast(on) {
  const tabs = await chrome.tabs.query({}); // IDs need no broad tabs permission
  await Promise.allSettled(tabs.map((tab) =>
    chrome.tabs.sendMessage(tab.id, { type: "state", enabled: on })));
}
async function setEnabled(on) {
  if (!on) cancelWork();
  await serialize(() => chrome.storage.local.set({ enabled: on }));
  await paint();
}
async function toggle() {
  await ready;
  await setEnabled(!(await isEnabled()));
}
chrome.action.onClicked.addListener(() => toggle().catch(console.error));
chrome.commands.onCommand.addListener((cmd) => {
  if (cmd === "toggle-stamps") toggle().catch(console.error);
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes.enabled) return;
  const on = changes.enabled.newValue !== false;
  if (!on) cancelWork();
  broadcast(on).catch(console.error);
});
chrome.runtime.onInstalled.addListener(() => {
  (async () => {
    await ready;
    const { enabled } = await chrome.storage.local.get("enabled");
    if (enabled === undefined) await chrome.storage.local.set({ enabled: true });
    if (!(await getKey())) await chrome.runtime.openOptionsPage();
    await paint();
  })().catch(console.error);
});
chrome.runtime.onStartup.addListener(() => ready.then(paint).catch(console.error));
function cancelled(job) {
  return job.generation !== generation || job.controller.signal.aborted;
}
function admit(job) {
  return serialize(async () => {
    const now = Date.now();
    const day = new Date(now).toISOString().slice(0, 10);
    const local = await chrome.storage.local.get(["enabled", "dailyRequests", "record", "recordEpoch"]);
    if (cancelled(job) || (!job.manual && local.enabled === false)) return { error: "off" };
    const daily = local.dailyRequests;
    if (daily?.day === day && (!Number.isSafeInteger(daily.count) || daily.count < 0)) {
      return { error: "storage-or-request" };
    }
    const count = daily?.day === day ? daily.count : 0;
    const { requestWindow = [] } = await chrome.storage.session.get("requestWindow");
    const recent = requestWindow.filter((r) => r.at > now - 60000);
    if (count >= LIMITS.perDay) return { error: "daily-limit" };
    if (recent.length >= LIMITS.perMinute ||
        recent.filter((r) => r.tab === job.tab).length >= LIMITS.perTabMinute) return { error: "rate-limited" };
    // Reserve before sending. Cancellation may consume a slot, never exceed a cap.
    await chrome.storage.local.set({ dailyRequests: { day, count: count + 1 } });
    await chrome.storage.session.set({ requestWindow: [...recent, { at: now, tab: job.tab }] });
    return { recordEpoch: local.record === true ? local.recordEpoch : null };
  });
}
function saveRecording(job, epoch, candidates, r, stamp) {
  if (!epoch) return;
  return serialize(async () => {
    const state = await chrome.storage.local.get(["record", "recordEpoch", "recordings"]);
    if (state.record !== true || state.recordEpoch !== epoch ||
        job.recordingGeneration !== recordingGeneration || cancelled(job)) return;
    const rows = Array.isArray(state.recordings) ? state.recordings : [];
    rows.push({ id: job.id, post: job.post, promoted: job.promoted, candidates,
      answers: r.answers, stamp, model: r.model, usage: r.usage, at: new Date().toISOString() });
    await chrome.storage.local.set({ recordings: trimRows(rows, LIMITS.recordingEntries, LIMITS.recordingBytes) });
  });
}
function changeRecording(on, clear = false) {
  recordingGeneration++;
  return serialize(async () => {
    await chrome.storage.local.set({
      recordEpoch: crypto.randomUUID(),
      ...(on === undefined ? {} : { record: on }),
      ...(clear ? { recordings: [] } : {}),
    });
    return true;
  });
}
function cacheResult(id, result) {
  return serialize(async () => {
    const { postCache = {} } = await chrome.storage.session.get("postCache");
    delete postCache[id];
    const rows = trimRows([...Object.entries(postCache), [id, result]], LIMITS.cacheEntries, LIMITS.cacheBytes);
    try {
      await chrome.storage.session.set({ postCache: Object.fromEntries(rows) });
    } catch {
      await chrome.storage.session.remove("postCache").catch(() => {});
    }
  });
}
async function run(job) {
  await ready;
  if (cancelled(job) || (!job.manual && !(await isEnabled()))) return { status: "off" };
  if (!job.manual) {
    const { postCache = {} } = await chrome.storage.session.get("postCache");
    if (Object.hasOwn(postCache, job.id)) return { ...postCache[job.id], cached: true };
  }
  const key = await getKey();
  if (!key) return { status: "error", reason: "no-key" };
  const admission = await admit(job);
  if (admission.error) return admission.error === "off" ? { status: "off" } : { status: "error", reason: admission.error };
  if (cancelled(job)) return { status: "off" };
  // Queue and rate admission precede phrase generation and request allocation.
  const candidates = cutCandidates(job.post.text);
  const body = buildRequest(job.post, candidates, { promoted: job.promoted });
  if (cancelled(job)) return { status: "off" };
  const r = await askJev(key, body, fetch, { signal: job.controller.signal });
  await serialize(async () => {
    const { stats } = await chrome.storage.local.get("stats");
    const s = { requests: 0, errors: 0, cost: 0, costKnown: 0, ms: 0, lastError: null, ...stats };
    // Today's totals (UTC day, the same day the request limit counts) for the
    // on-screen meter. A response without a cost is counted as unpriced, never
    // as free.
    const day = new Date().toISOString().slice(0, 10);
    if (s.day !== day) Object.assign(s, { day, dayRequests: 0, dayErrors: 0, dayCost: 0, dayCostKnown: 0 });
    s.requests++;
    s.dayRequests++;
    if (!r.ok) { s.errors++; s.dayErrors++; s.lastError = r.reason; }
    else {
      s.lastError = null;
      s.ms += r.ms;
      if (typeof r.usage?.cost === "number" && Number.isFinite(r.usage.cost)) {
        s.cost += r.usage.cost;
        s.costKnown++;
        s.dayCost += r.usage.cost;
        s.dayCostKnown++;
      }
    }
    await chrome.storage.local.set({ stats: s });
  });
  paint().catch(console.error);
  if (cancelled(job)) return { status: "off" };
  if (!r.ok) return { status: "error", reason: r.reason };
  const stamp = decideStamp(r.answers, candidates, { promoted: job.promoted });
  const result = { status: stamp.primary || stamp.quote ? "stamp" : "blank", stamp, ms: r.ms };
  await saveRecording(job, admission.recordEpoch, candidates, r, stamp);
  if (!job.manual && !cancelled(job)) await cacheResult(job.id, result);
  return cancelled(job) ? { status: "off" } : result;
}
function pump() {
  while (running < LIMITS.active && waiting.length) {
    const job = waiting.shift();
    running++;
    active.add(job.controller);
    run(job).catch(() => ({ status: "error", reason: "storage-or-request" }))
      .then(job.resolve).finally(() => {
        jobs.delete(job.key);
        active.delete(job.controller);
        running--;
        pump();
      });
  }
}
function judge(msg, tab, manual = false) {
  const post = validPost(manual ? { text: msg.text } : msg.post);
  if (!post || (!manual && (typeof msg.id !== "string" || !/^\d{1,25}$/.test(msg.id))) ||
      (!manual && msg.promoted !== undefined && typeof msg.promoted !== "boolean")) {
    return Promise.resolve({ status: "error", reason: "invalid-request" });
  }
  const key = manual ? `test:${++testId}` : `post:${msg.id}`;
  if (jobs.has(key)) return jobs.get(key);
  if (jobs.size >= LIMITS.active + LIMITS.pending) return Promise.resolve({ status: "error", reason: "busy" });
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  jobs.set(key, promise);
  waiting.push({ key, resolve, id: manual ? "test" : msg.id, post, tab, manual,
    promoted: msg.promoted === true, generation, recordingGeneration, controller: new AbortController() });
  pump();
  return promise;
}
function contentSender(sender) {
  if (sender.id !== chrome.runtime.id || !sender.tab || sender.frameId !== 0) return false;
  try { return ["https://x.com", "https://twitter.com"].includes(new URL(sender.url).origin); }
  catch { return false; }
}
function optionsSender(sender) {
  return sender.id === chrome.runtime.id && sender.url === chrome.runtime.getURL("options.html");
}
// What the on-page meter may know: today's counts and cost, nothing else.
async function meter() {
  const { stats, showMeter } = await chrome.storage.local.get(["stats", "showMeter"]);
  const day = new Date().toISOString().slice(0, 10);
  const s = stats?.day === day ? stats : null;
  const answered = s ? s.dayRequests - s.dayErrors : 0;
  return {
    show: showMeter !== false,
    posts: s?.dayRequests ?? 0,
    failed: s?.dayErrors ?? 0,
    cost: s?.dayCost ?? 0,
    unpriced: s ? Math.max(0, answered - s.dayCostKnown) : 0,
    limit: LIMITS.perDay,
  };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const content = contentSender(sender);
  const options = optionsSender(sender);
  if (!content && !options) { sendResponse({ status: "error", reason: "forbidden" }); return false; }
  const handle = async () => {
    await ready;
    if (msg?.type === "getState") return { enabled: await isEnabled() };
    if (msg?.type === "judge" && content) return judge(msg, sender.tab.id);
    if (msg?.type === "meter") return meter();
    if (!options) return { status: "error", reason: "forbidden" };
    if (msg?.type === "test") return judge(msg, "options", true);
    if (msg?.type === "keySource") {
      const { key } = await chrome.storage.local.get("key");
      return key ? "options" : (await getKey()) ? "file" : null;
    }
    if (msg?.type === "repaint") { await paint(); return true; }
    if (msg?.type === "setRecording" && typeof msg.enabled === "boolean") return changeRecording(msg.enabled);
    if (msg?.type === "clearRecordings") return changeRecording(undefined, true);
    return { status: "error", reason: "invalid-request" };
  };
  handle().then(sendResponse, () => sendResponse({ status: "error", reason: "storage-or-request" }));
  return true;
});

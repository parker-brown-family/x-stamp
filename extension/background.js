// x-stamp service worker: the only part that holds the key or touches the network.

import { cutCandidates } from "./lib/candidates.js";
import { askJev, buildRequest } from "./lib/jev.js";
import { decideStamp } from "./lib/rule.js";

const MAX_IN_FLIGHT = 6; // posts are asked ahead of the scroll, so they arrive in bursts

// ---- the key --------------------------------------------------------------

// A key saved in the options page wins. Otherwise `key.local.json`, written
// beside this file by scripts/install-key.sh for development, so
// setup on this box never needs the key typed into a page. Gitignored.
async function getKey() {
  const { key } = await chrome.storage.local.get("key");
  if (key) return key;
  try {
    const res = await fetch(chrome.runtime.getURL("key.local.json"));
    if (res.ok) return (await res.json()).openrouter || null;
  } catch {}
  return null;
}
const MAX_RECORDINGS = 300;

// ---- on/off ---------------------------------------------------------------

async function isEnabled() {
  const { enabled } = await chrome.storage.local.get("enabled");
  return enabled !== false; // set to true on install; never unset afterwards
}

async function setEnabled(on) {
  await chrome.storage.local.set({ enabled: on });
  await paint();
}

async function toggle() {
  await setEnabled(!(await isEnabled()));
}

chrome.action.onClicked.addListener(toggle);
chrome.commands.onCommand.addListener((cmd) => {
  if (cmd === "toggle-stamps") toggle();
});

chrome.runtime.onInstalled.addListener(async () => {
  const { enabled } = await chrome.storage.local.get("enabled");
  if (enabled === undefined) await chrome.storage.local.set({ enabled: true });
  if (!(await getKey())) chrome.runtime.openOptionsPage();
  await paint();
});
chrome.runtime.onStartup.addListener(paint);

// The icon says on or off; the badge only appears when something needs fixing.
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

// ---- stats ----------------------------------------------------------------

let statsWrite = Promise.resolve();
function record(fn) {
  statsWrite = statsWrite.then(async () => {
    const { stats } = await chrome.storage.local.get("stats");
    const s = { requests: 0, errors: 0, cost: 0, costKnown: 0, ms: 0, lastError: null, ...stats };
    fn(s);
    await chrome.storage.local.set({ stats: s });
    await paint();
  });
  return statsWrite;
}

// ---- judging --------------------------------------------------------------

const memo = new Map(); // post id -> Promise<result>
let inFlight = 0;
const waiting = [];

async function slot() {
  if (inFlight < MAX_IN_FLIGHT) {
    inFlight++;
    return;
  }
  await new Promise((resolve) => waiting.push(resolve));
  inFlight++;
}
function release() {
  inFlight--;
  waiting.shift()?.();
}

async function judgeFresh(id, post, promoted) {
  const key = await getKey();
  const { record: recording } = await chrome.storage.local.get("record");
  if (!key) return { status: "error", reason: "no-key" };

  const candidates = cutCandidates(post.text);
  const body = buildRequest(post, candidates, { promoted });
  // A paid ad with nothing to quote needs no question at all.
  if (!Object.keys(body.questions).length) {
    const stamp = decideStamp({}, candidates, { promoted });
    return { status: stamp.primary ? "stamp" : "blank", stamp, ms: 0 };
  }
  await slot();
  let r;
  try {
    r = await askJev(key, body);
  } finally {
    release();
  }

  if (!r.ok) {
    await record((s) => {
      s.requests++;
      s.errors++;
      s.lastError = r.reason;
    });
    return { status: "error", reason: r.reason };
  }

  const stamp = decideStamp(r.answers, candidates, { promoted });
  await record((s) => {
    s.requests++;
    s.lastError = null;
    s.ms += r.ms;
    // Unknown is not zero: a response without a cost is counted apart, never as $0.
    if (typeof r.usage?.cost === "number") {
      s.cost += r.usage.cost;
      s.costKnown++;
    }
  });
  const result = { status: stamp.primary || stamp.quote ? "stamp" : "blank", stamp, ms: r.ms };

  if (recording) {
    const { recordings = [] } = await chrome.storage.local.get("recordings");
    recordings.push({ id, post, promoted, candidates, answers: r.answers, stamp, model: r.model, usage: r.usage, at: new Date().toISOString() });
    await chrome.storage.local.set({ recordings: recordings.slice(-MAX_RECORDINGS) });
  }
  return result;
}

async function judge(id, post, promoted) {
  if (!(await isEnabled())) return { status: "off" };
  const cacheKey = `j:${id}`;
  const cached = (await chrome.storage.session.get(cacheKey))[cacheKey];
  if (cached) return { ...cached, cached: true };
  if (!memo.has(id)) {
    memo.set(
      id,
      judgeFresh(id, post, promoted).then(async (result) => {
        // Failures are not cached, so the post is asked again next time it is seen.
        if (result.status === "stamp" || result.status === "blank") {
          await chrome.storage.session.set({ [cacheKey]: result });
        }
        memo.delete(id);
        return result;
      }),
    );
  }
  return memo.get(id);
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "judge") {
    judge(String(msg.id), msg.post, msg.promoted === true).then(sendResponse);
    return true;
  }
  if (msg?.type === "test") {
    judgeFresh("test", { text: String(msg.text) }, false).then(sendResponse);
    return true;
  }
  if (msg?.type === "keySource") {
    chrome.storage.local.get("key").then(async ({ key }) =>
      sendResponse(key ? "options" : (await getKey()) ? "file" : null));
    return true;
  }
  if (msg?.type === "repaint") {
    paint().then(() => sendResponse(true));
    return true;
  }
  return false;
});

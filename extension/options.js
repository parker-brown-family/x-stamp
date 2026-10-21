import { LIMITS } from "./lib/limits.js";
const $ = (id) => document.getElementById(id);

async function load() {
  const { record, stats, dailyRequests, recordings = [] } = await chrome.storage.local.get(["record", "stats", "dailyRequests", "recordings"]);
  const source = await chrome.runtime.sendMessage({ type: "keySource" });
  $("key").placeholder = source === "options" ? "saved (paste to replace)" : source === "file" ? "using key.local.json (paste to override)" : "sk-or-…";
  $("record").checked = record === true;
  $("recCount").textContent = `${recordings.length} recorded`;
  const s = stats ?? {};
  const ok = (s.requests ?? 0) - (s.errors ?? 0);
  const today = new Date().toISOString().slice(0, 10);
  const used = dailyRequests?.day === today
    ? (Number.isSafeInteger(dailyRequests.count) && dailyRequests.count >= 0 ? dailyRequests.count : null)
    : 0;
  const rows = [
    ["Posts asked", s.requests ?? 0],
    ["Daily allowance used (UTC)", used === null ? "unavailable" : `${used} / ${LIMITS.perDay}`],
    ["Failed", s.errors ? `${s.errors} (last: ${s.lastError ?? "since recovered"})` : 0],
    ["Average answer", ok > 0 ? `${Math.round(s.ms / ok)} ms` : "no answers yet"],
    ["Cost", s.costKnown ? `$${s.cost.toFixed(5)} over ${s.costKnown} posts, $${(s.cost / s.costKnown).toFixed(6)} each` : "not reported yet"],
  ];
  $("stats").replaceChildren(...rows.flatMap(([k, v]) => {
    const dt = document.createElement("dt");
    dt.textContent = k;
    const dd = document.createElement("dd");
    dd.textContent = v;
    return [dt, dd];
  }));
}

$("save").onclick = async () => {
  const key = $("key").value.trim();
  if (!key) return;
  await chrome.storage.local.set({ key });
  $("key").value = "";
  $("saved").textContent = "Saved.";
  await chrome.runtime.sendMessage({ type: "repaint" });
  load();
};

$("test").onclick = async () => {
  $("testOut").textContent = "Asking…";
  const r = await chrome.runtime.sendMessage({ type: "test", text: $("sample").value });
  if (r.status === "error") {
    $("testOut").textContent = `Failed: ${r.reason}`;
  } else if (r.status === "blank") {
    $("testOut").textContent = `No stamp: Jev answered, and nothing passed the thresholds (${r.ms} ms).`;
  } else {
    const { primary, second, quote } = r.stamp;
    $("testOut").textContent =
      (primary ? `${primary.title}  ${primary.p.toFixed(2)}${primary.faint ? " (faint)" : ""}\n` : "no title\n") +
      (second ? `+ ${second.title}  ${second.p.toFixed(2)}\n` : "") +
      (quote ? `“${quote.text}”  merged ${quote.merged.toFixed(2)}\n` : "no quote line\n") +
      `${r.ms} ms`;
  }
  load();
};

$("record").onchange = async (e) => {
  const r = await chrome.runtime.sendMessage({ type: "setRecording", enabled: e.target.checked });
  if (r !== true) $("recCount").textContent = "Could not change Recording. Try again.";
};

$("export").onclick = async () => {
  const { recordings = [] } = await chrome.storage.local.get("recordings");
  const url = URL.createObjectURL(new Blob([JSON.stringify(recordings, null, 1)], { type: "application/json" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: `x-stamp-recordings-${new Date().toISOString().slice(0, 10)}.json` });
  a.click();
  URL.revokeObjectURL(url);
};

$("clear").onclick = async () => {
  const r = await chrome.runtime.sendMessage({ type: "clearRecordings" });
  if (r !== true) { $("recCount").textContent = "Could not clear recordings. Try again."; return; }
  load();
};

load();

$("reload").onclick = () => chrome.runtime.reload();

chrome.storage.local.get("showMeter").then(({ showMeter }) => { $("showMeter").checked = showMeter !== false; });
$("showMeter").onchange = (e) => chrome.storage.local.set({ showMeter: e.target.checked });

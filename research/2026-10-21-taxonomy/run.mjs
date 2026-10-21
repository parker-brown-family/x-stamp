import { writeFileSync } from "node:fs";
import { openrouterKey } from "../../scripts/openrouter-key.mjs";
import { cutCandidates } from "../../extension/lib/candidates.js";
import { buildRequest, askJev } from "../../extension/lib/jev.js";
import { decideStamp } from "../../extension/lib/rule.js";
import { CASES } from "./cases.mjs";
const key = openrouterKey();
const RUNS = Number(process.argv[2] ?? 2);
const score = { type: [0, 0], title: [0, 0], second: [0, 0] };
let cost = 0, costN = 0, ms = 0;
const lines = [];
for (const c of CASES) {
  const cands = cutCandidates(c.post.text);
  const runs = await Promise.all(Array.from({ length: RUNS }, async () => {
    const r = await askJev(key, buildRequest(c.post, cands));
    if (!r.ok) return { err: r.reason };
    if (typeof r.usage?.cost === "number") { cost += r.usage.cost; costN++; }
    ms += r.ms;
    return decideStamp(r.answers, cands);
  }));
  for (const s of runs) {
    if (s.err) { lines.push(`  ERROR ${s.err}`); continue; }
    const types = [s.primary?.type, s.second?.type];
    const titles = [s.primary?.title, s.second?.title];
    score.type[1]++; if (c.type.includes(s.primary?.type) || (c.titleOrSecond && c.type.some((t) => types.includes(t)))) score.type[0]++;
    if (c.title) { score.title[1]++; if (c.title.includes(s.primary?.title) || (c.titleOrSecond && c.title.some((t) => titles.includes(t)))) score.title[0]++; }
    if (c.second) { score.second[1]++; if (c.second.every((t) => types.includes(t)) || (s.second && c.second.includes(s.second.type))) score.second[0]++; }
  }
  const show = runs.map((s) => s.err ? `ERR ${s.err}` : `${s.primary ? `${s.primary.title}${s.primary.faint ? " (faint)" : ""} ${s.primary.p.toFixed(2)}` : "—"}${s.second ? ` + ${s.second.title} ${s.second.p.toFixed(2)}` : ""} “${s.quote?.text ?? "—"}”`).join("  |  ");
  lines.push(`[${c.who}] ${c.post.text.slice(0, 40).replace(/\n/g, " ").padEnd(40)} → ${show}`);
}
const pct = ([a, b]) => `${a}/${b}`;
const out = `type ${pct(score.type)} · title ${pct(score.title)} · second card ${pct(score.second)} · ${CASES.length} cases × ${RUNS} runs\n` +
  `cost $${(cost / costN).toFixed(6)} per post (${costN} reported) · ${Math.round(ms / (CASES.length * RUNS))} ms per post\n\n${lines.join("\n")}\n`;
console.log(out);
writeFileSync(new URL("./output.txt", import.meta.url), out);

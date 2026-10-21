import { test } from "node:test";
import assert from "node:assert/strict";
import { cutCandidates, LIMIT, MAX_WORDS, words } from "../extension/lib/candidates.js";
import { buildRequest, NONE, TYPES, SECONDARY, alsoKey, askJev } from "../extension/lib/jev.js";
import { decideStamp, mergedAround, tidy, title } from "../extension/lib/rule.js";

const POST = "Unpopular opinion but after 10 years in tech the single most important skill nobody talks about is writing clearly. Not coding. Writing. 🧵👇";

test("links, handles and hashtags are not quotable", () => {
  assert.deepEqual(words("hi @bob see https://t.co/abc #fail 🧵 ok"), ["hi", "see", "ok"]);
});

test("every candidate is 2-10 consecutive words of the post, verbatim", () => {
  const cands = cutCandidates(POST);
  assert.ok(cands.some((c) => c.end - c.start > 6), "no runs longer than six words");
  for (const c of cands) {
    const n = c.end - c.start;
    assert.ok(n >= 2 && n <= MAX_WORDS, c.text);
    assert.ok(POST.includes(c.text), `not verbatim: ${c.text}`);
  }
});

test("no candidate starts or ends on a stop word", () => {
  for (const c of cutCandidates(POST)) {
    const parts = c.text.toLowerCase().split(" ");
    assert.notEqual(parts[0], "the");
    assert.notEqual(parts.at(-1), "the");
  }
});

test("a long post keeps every short run before any long one, within the Choice limit", () => {
  const long = Array.from({ length: 400 }, (_, i) => `word${i}`).join(" ");
  const cands = cutCandidates(long);
  assert.equal(cands.length, LIMIT);
  assert.equal(cands[0].text, "word0 word1");
  assert.ok(cands.every((c) => c.end - c.start <= 6));
});

test("one request asks type, engagement kind, category, quote and every second-card check", () => {
  const body = buildRequest({ text: POST }, cutCandidates(POST));
  const keys = Object.keys(body.questions);
  for (const k of ["type", "engagement_kind", "category", "gist", ...SECONDARY.map(alsoKey)]) assert.ok(keys.includes(k), k);
  for (const k of ["type", "engagement_kind", "category", "gist"]) assert.ok(NONE in body.questions[k].criteria, `${k} has no escape`);
  assert.ok(!("AD" in TYPES) && "PAID ADVERT" in TYPES && "ENGAGEMENT" in TYPES && !("ENGAGEMENT BAIT" in TYPES));
});

test("a paid ad is PAID ADVERT by code: no type or second-card questions", () => {
  const body = buildRequest({ text: POST }, cutCandidates(POST), { promoted: true });
  assert.deepEqual(Object.keys(body.questions).sort(), ["category", "gist"]);
  const s = decideStamp({}, [], { promoted: true });
  assert.equal(s.primary.title, "PAID ADVERT");
  assert.equal(s.second, null);
});

test("titles: {CATEGORY} {TYPE}, ENGAGEMENT by its kind, UPDATE always with a subject", () => {
  assert.equal(title("NEWS", "MONEY"), "MONEY NEWS");
  assert.equal(title("NEWS", null), "NEWS");
  assert.equal(title("UPDATE", "FAITH"), "FAITH UPDATE");
  assert.equal(title("UPDATE", null), "LIFE UPDATE");
  assert.equal(title("ENGAGEMENT", "TECH", "TROLL"), "ENGAGEMENT TROLL");
  assert.equal(title("ENGAGEMENT", "TECH", null), "ENGAGEMENT HARVEST");
  assert.equal(title("PAID ADVERT", "HEALTH"), "PAID ADVERT");
});

const ans = (o) => ({
  type: { probabilities: o.type },
  category: { probabilities: o.category ?? { [NONE]: 1 } },
  engagement_kind: { probabilities: o.kind ?? { [NONE]: 1 } },
  ...Object.fromEntries(Object.entries(o.also ?? {}).map(([t, p]) => [alsoKey(t), { noul: p }])),
});

test("a second card needs a firm yes, a different type, and a pair that says something", () => {
  const hotEngage = decideStamp(ans({ type: { "HOT TAKE": 0.9 }, category: { CAREER: 0.9 }, kind: { HARVEST: 0.8 }, also: { ENGAGEMENT: 0.95, "HOT TAKE": 0.99 } }), []);
  assert.equal(hotEngage.primary.title, "CAREER HOT TAKE");
  assert.equal(hotEngage.second.title, "ENGAGEMENT HARVEST");
  const sober = decideStamp(ans({ type: { UPDATE: 0.9 }, category: { ADDICTION: 0.9 }, also: { "SELF-PROMO": 0.95 } }), []);
  assert.equal(sober.primary.title, "ADDICTION UPDATE");
  assert.equal(sober.second, null, "SELF-PROMO beside a success UPDATE");
  const weak = decideStamp(ans({ type: { QUESTION: 1 }, also: { UPDATE: 0.85 } }), []);
  assert.equal(weak.second, null);
});

test("a flat type is dropped, and so is its second card", () => {
  const s = decideStamp(ans({ type: { NEWS: 0.25, JOKE: 0.25, ADVICE: 0.25, UPDATE: 0.25 }, also: { JOKE: 0.99 } }), []);
  assert.equal(s.primary, null);
  assert.equal(s.second, null);
});

test("merged probability counts every overlapping phrase and nothing else", () => {
  const c = [{ text: "a b", start: 0, end: 2 }, { text: "b c", start: 1, end: 3 }, { text: "d e", start: 3, end: 5 }];
  assert.equal(mergedAround(c[0], c, { "a b": 0.2, "b c": 0.3, "d e": 0.4 }), 0.5);
});

test("tidy drops trailing full stops but keeps a question mark", () => {
  assert.equal(tidy("writing clearly."), "writing clearly");
  assert.equal(tidy("takes new patients?"), "takes new patients?");
});

test("a failed request comes back as a reason, never as an answer", async () => {
  const fake = (status) => async () => ({ ok: false, status, json: async () => ({}) });
  assert.equal((await askJev("k", {}, fake(401))).reason, "auth");
  assert.equal((await askJev("k", {}, fake(429))).reason, "rate-limited");
  assert.equal((await askJev("k", {}, async () => { throw new TypeError("x"); })).reason, "network");
});

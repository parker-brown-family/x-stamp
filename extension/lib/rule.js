// Turn Jev's answers into what the stamp says, or into no stamp. Thresholds are
// starting values, not labelled data: slice 3 of the first plan replaces them.

import { NONE, NO_PAIR, SECONDARY, alsoKey } from "./jev.js";

const paired = (a, b) => NO_PAIR.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

export const THRESHOLDS = {
  type: 0.5, // top type at or above this: full ink
  typeFaint: 0.3, // between this and `type`: faint ink; below: no card
  category: 0.5, // the prefix shows only when the subject is this clear
  kind: 0.4, // below this an ENGAGEMENT card says HARVEST, the general kind
  second: 0.9, // a second type needs a firm yes of its own (0.85 let a stray HEALTH UPDATE onto a dentist question)
  quote: 0.4, // probability merged across phrases overlapping the winner
};

function top(probabilities) {
  let best = null;
  for (const [k, p] of Object.entries(probabilities ?? {})) {
    if (best === null || p > best[1]) best = [k, p];
  }
  return best;
}

// Near-identical phrases ("writing clearly." / "is writing clearly") split the
// vote, so sum every candidate that shares a word with the winner.
export function mergedAround(winner, candidates, probabilities) {
  let sum = 0;
  for (const c of candidates) {
    if (c.start < winner.end && winner.start < c.end) sum += probabilities[c.text] ?? 0;
  }
  return sum;
}

// "{category} {type}": ENGAGEMENT reads by its kind ("ENGAGEMENT TROLL"), an
// UPDATE always carries a subject ("FAITH UPDATE", LIFE when none is clear), a
// paid advert stays plain.
export function title(type, category, kind) {
  if (type === "ENGAGEMENT") return `ENGAGEMENT ${kind ?? "HARVEST"}`;
  if (type === "UPDATE") return `${category ?? "LIFE"} UPDATE`;
  if (type === "PAID ADVERT" || !category) return type;
  return `${category} ${type}`;
}

// Returns {primary, second, quote}. primary and second are
// {type, title, p, faint?} or null; all of primary, second and quote null means
// Jev answered and nothing it said is worth stamping.
// `promoted`: X itself labelled the post a paid ad, so PAID ADVERT is a fact.
export function decideStamp(answers, candidates, { promoted = false } = {}, t = THRESHOLDS) {
  const c = top(answers.category?.probabilities);
  const category = c && c[0] !== NONE && c[1] >= t.category ? c[0] : null;
  const k = top(answers.engagement_kind?.probabilities);
  const kind = k && k[0] !== NONE && k[1] >= t.kind ? k[0] : null;

  let primary = null;
  if (promoted) {
    primary = { type: "PAID ADVERT", title: "PAID ADVERT", p: 1, faint: false, by: "x" };
  } else {
    const v = top(answers.type?.probabilities);
    if (v && v[0] !== NONE && v[1] >= t.typeFaint) {
      primary = { type: v[0], title: title(v[0], category, kind), p: v[1], faint: v[1] < t.type };
    }
  }

  let second = null;
  if (!promoted) {
    for (const s of SECONDARY) {
      const p = answers[alsoKey(s)]?.noul;
      if (typeof p !== "number" || p < t.second || s === primary?.type || paired(s, primary?.type)) continue;
      if (!second || p > second.p) second = { type: s, title: title(s, category, kind), p };
    }
  }
  // A second card only says something beside a first one.
  if (!primary) second = null;

  let quote = null;
  const g = top(answers.gist?.probabilities);
  if (g && g[0] !== NONE) {
    const winner = candidates.find((x) => x.text === g[0]);
    if (winner) {
      const merged = mergedAround(winner, candidates, answers.gist.probabilities);
      if (merged >= t.quote) quote = { text: tidy(winner.text), p: g[1], merged };
    }
  }

  return { primary, second, quote };
}

// Trailing full stops and commas read as noise on a stamp; ? and ! carry meaning.
export function tidy(phrase) {
  return phrase.replace(/[.,;:…。、]+$/u, "");
}

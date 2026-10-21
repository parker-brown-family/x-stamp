// Cut a post into the phrases Jev may quote. Jev cannot write text, only pick,
// so every phrase on the stamp is one of these, copied verbatim from the post.

const STOP = new Set(
  "a an the and or but nor so of to in on at for with by from as is are was were be been am it its this that these those my your our their his her i you we they he she me us them".split(" "),
);

const WORDLIKE = /[\p{L}\p{N}]/u;

export const MIN_WORDS = 2;
// Parker, 2026-10-21: "Quotes will run [up to] 10 words".
export const MAX_WORDS = 10;
// A Choice takes at most 255 options; one is kept for "none of these".
export const LIMIT = 254;
// Runs up to this length are always offered first; longer ones fill what is left.
const SHORT = 6;

function bare(word) {
  return word.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

// Words with links, @handles and #hashtags removed.
export function words(text) {
  return text
    .replace(/https?:\/\/\S+/g, " ")
    .split(/\s+/)
    .filter((w) => w && !/^[@#]/.test(w) && WORDLIKE.test(w));
}

// Every run of MIN_WORDS..MAX_WORDS consecutive words that neither starts nor
// ends on a stop word, as {text, start, end} with word positions (end exclusive).
// A post with more runs than a Choice takes keeps every short run (front to back,
// so a very long post keeps its opening) and fills the rest with longer ones.
export function cutCandidates(text) {
  const ws = words(text);
  const seen = new Set();
  const short = [];
  const long = [];
  for (let i = 0; i < ws.length; i++) {
    if (STOP.has(bare(ws[i]))) continue;
    for (let n = MIN_WORDS; n <= MAX_WORDS && i + n <= ws.length; n++) {
      if (STOP.has(bare(ws[i + n - 1]))) continue;
      const phrase = ws.slice(i, i + n).join(" ").replace(/[,;:\-–—]+$/u, "");
      if (seen.has(phrase)) continue;
      seen.add(phrase);
      (n <= SHORT ? short : long).push({ text: phrase, start: i, end: i + n });
    }
  }
  return short.slice(0, LIMIT).concat(long.slice(0, Math.max(0, LIMIT - short.length)));
}

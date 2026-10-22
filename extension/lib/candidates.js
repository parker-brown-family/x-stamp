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

// Japanese, Chinese, Thai and their neighbours are written without spaces, so
// a space-split "word" there is a whole sentence and ten of them a paragraph.
// Those runs are cut again with the platform's word segmenter (ICU's
// dictionaries, in the browser and in Node alike).
const UNSPACED = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}]/u;
const segmenter = new Intl.Segmenter(undefined, { granularity: "word" });
// In Japanese a run of hiragana alone is mostly a particle or a verb ending,
// a poor first word for a quote; these particles are a poor last one.
const KANA_ONLY = /^[\p{Script=Hiragana}ー]+$/u;
const PARTICLE = new Set("は が を に の と で も へ や".split(" "));

function bare(word) {
  return word.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

// Words with links, @handles and #hashtags removed, as {w, glued, unspaced}:
// glued means no space before it in the post. Punctuation inside an unspaced
// run rides with the word beside it, so joining glued words gives back the
// post's own characters.
function tokens(text) {
  const out = [];
  for (const w of text.replace(/https?:\/\/\S+/g, " ").split(/\s+/)) {
    if (!w || /^[@#]/.test(w) || !WORDLIKE.test(w)) continue;
    if (!UNSPACED.test(w)) {
      out.push({ w, glued: false, unspaced: false });
      continue;
    }
    let lead = "";
    let first = true;
    for (const s of segmenter.segment(w)) {
      if (s.isWordLike) {
        out.push({ w: lead + s.segment, glued: !first, unspaced: true });
        lead = "";
        first = false;
      } else if (first) lead += s.segment;
      else out[out.length - 1].w += s.segment;
    }
    if (first) out.push({ w: lead, glued: false, unspaced: true });
  }
  return out;
}

export function words(text) {
  return tokens(text).map((t) => t.w);
}

// Every run of MIN_WORDS..MAX_WORDS consecutive words that neither starts nor
// ends on a stop word, as {text, start, end} with word positions (end exclusive).
// A post with more runs than a Choice takes keeps every short run (front to back,
// so a very long post keeps its opening) and fills the rest with longer ones.
export function cutCandidates(text) {
  const ts = tokens(text);
  const seen = new Set();
  const short = [];
  const long = [];
  for (let i = 0; i < ts.length; i++) {
    if (STOP.has(bare(ts[i].w)) || (ts[i].unspaced && KANA_ONLY.test(bare(ts[i].w)))) continue;
    for (let n = MIN_WORDS; n <= MAX_WORDS && i + n <= ts.length; n++) {
      const last = bare(ts[i + n - 1].w);
      if (STOP.has(last) || PARTICLE.has(last)) continue;
      const phrase = ts.slice(i, i + n).map((t, k) => (k && !t.glued ? " " : "") + t.w).join("").replace(/[,;:\-–—、]+$/u, "");
      if (seen.has(phrase)) continue;
      seen.add(phrase);
      (n <= SHORT ? short : long).push({ text: phrase, start: i, end: i + n });
    }
  }
  return short.slice(0, LIMIT).concat(long.slice(0, Math.max(0, LIMIT - short.length)));
}

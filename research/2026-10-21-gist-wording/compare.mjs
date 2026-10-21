// Two wordings of the quote question, three runs each over the e2e posts.
// "Acceptable" is my own label per post (the words a quote must contain to name
// the post's subject), not Parker's; slice 3 replaces it with his.
import { openrouterKey } from "../../scripts/openrouter-key.mjs";
import { cutCandidates } from "../../extension/lib/candidates.js";
import { buildRequest, askJev } from "../../extension/lib/jev.js";
import { decideStamp } from "../../extension/lib/rule.js";
const key = openrouterKey();

const POSTS = [
  ["Unpopular opinion but after 10 years in tech the single most important skill nobody talks about is writing clearly. Not coding. Writing. 🧵👇", /writing clearly/],
  ["BREAKING: The Federal Reserve cuts interest rates by 0.25%, the first cut since March. Markets rallied on the news.", /cuts interest rates|Reserve cuts/],
  ["Ship faster with Acme Cloud. Deploy any app in 30 seconds, free for your first 3 months. Start building today.", /Acme Cloud|Deploy any app/],
  ["I quit my 6-figure job 18 months ago. Today my SaaS hit $40k MRR. Here's exactly how I did it (bookmark this) 👇", /\$40k MRR/],
  ["Does anyone know a good dentist in Calgary that takes new patients? Mine just retired.", /dentist/],
  ["Reply with the last photo in your camera roll. No cheating. Let's go 👀", /camera roll|last photo/],
  ["If you still use tabs instead of spaces you are genuinely a danger to society and should not be allowed near a keyboard", /tabs/],
];
const WORDINGS = {
  current: {
    question: "Which phrase, copied from `post.text`, best states what the post says on its own?",
    focus: "Prefer the phrase a reader would understand without the rest of the post. Ignore hooks, emoji and calls to reply or follow.",
  },
  subject: {
    question: "Which phrase, copied from `post.text`, names what the post is about?",
    focus: "Pick the words a reader most needs to know the post's subject and what it says about it. A phrase that only adds an aside, a reason, an insult or a closing remark is not it. Ignore hooks, emoji and calls to reply or follow.",
  },
};
const RUNS = 3;
for (const [name, instructions] of Object.entries(WORDINGS)) {
  let ok = 0, n = 0;
  const lines = [];
  for (const [text, want] of POSTS) {
    const c = cutCandidates(text);
    const picks = await Promise.all(Array.from({ length: RUNS }, async () => {
      const body = buildRequest(text, c);
      body.questions.gist.instructions = instructions;
      const r = await askJev(key, body);
      return r.ok ? decideStamp(r.answers, c).quote?.text ?? "(no quote)" : `(error ${r.reason})`;
    }));
    for (const p of picks) { n++; if (want.test(p)) ok++; }
    lines.push(`  ${text.slice(0, 32).padEnd(32)} ${picks.map((p) => (want.test(p) ? "✓ " : "✗ ") + p).join("  |  ")}`);
  }
  console.log(`\n${name}: ${ok}/${n} name the subject\n${lines.join("\n")}`);
}

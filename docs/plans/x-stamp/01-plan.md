# x-stamp — the plan

Difficulty 5/10: one combined plan, one approval, then build.

## What you see

You scroll X. As each post settles into view, a rubber stamp drops onto it and
leaves two lines in ink: what the post is *for*, and up to six words lifted
straight out of it.

```
┌──────────────────────────────────────────────────────┐
│ @someone · 2h                                        │
│ Unpopular opinion but after 10 years in tech the     │
│ single most  ╔══════════════════════════╗  nobody    │
│ talks about  ║  HOT TAKE                ║  t coding. │
│ Writing. 🧵👇 ║  “writing clearly. Not   ║            │
│              ║   coding.”               ║            │
│              ╚══════════════════════════╝            │
│ 💬 41   🔁 12   ♥ 380                                 │
└──────────────────────────────────────────────────────┘
  Fig 1. The stamp sits over the text, tilted a few degrees, half-transparent,
  so the post stays readable and clickable underneath. Drawn by me; the real
  look is slice 2's job.
```

One click on the toolbar icon turns it off in every tab, and stamps already on
screen lift off. Alt+Shift+S does the same from the keyboard.

## Why the words are the post's own

Jev does not write text. It picks one option from a list your code hands it, with
a probability on each. So code cuts every run of 2–6 consecutive words out of the
post (dropping links, hashtags, handles, and runs that start or end on "the",
"and", "of" and so on), and Jev picks the run that best says what the post says.
A typical post gives 25–60 candidates; a Choice takes up to 255.

The verdict is a second Choice over a list we write, all answering one question:
*what is this post mainly trying to get from the reader?* — NEWS, HOT TAKE, RAGE
BAIT, SELF-PROMO, AD, ENGAGEMENT BAIT, ADVICE, QUESTION, LIFE UPDATE, JOKE, plus
a "none of these". Both questions go in one request per post.

| Step | Done by |
|---|---|
| Find posts on the page, read text and post id | code (content script) |
| Skip posts with no text, already stamped, or flicked past | code |
| Cut candidate phrases | code |
| Which verdict | Jev — Choice, 11 options |
| Which phrase | Jev — Choice over the candidates + "none" |
| Whether to stamp at all, and which lines | code, reading Jev's probabilities |
| Draw and animate the stamp | code |

## What the probe showed

Run today against `jev-latest` on OpenRouter, six posts I wrote to cover the
range, each run twice. Same picks both times, probabilities within ±0.05,
215–457 ms per post.

| Post (opening) | Verdict | Quote Jev picked |
|---|---|---|
| Unpopular opinion… writing clearly. Not coding. | HOT TAKE 0.97 | nobody talks about is writing clearly. |
| BREAKING: The Federal Reserve cuts… | NEWS 1.00 | cuts interest rates by 0.25% |
| I quit my 6-figure job… $40k MRR… (bookmark this) | SELF-PROMO 0.45, ADVICE 0.32, ENGAGEMENT BAIT 0.21 | Today my SaaS hit $40k MRR. |
| Reply with the last photo in your camera roll | ENGAGEMENT BAIT 1.00 | last photo in your camera roll. |
| Does anyone know a good dentist in Calgary… | QUESTION 1.00 | good dentist in Calgary |
| If you still use tabs instead of spaces… | RAGE BAIT 0.68 | genuinely a danger to society |

Two things to take from it.

**The quote's own probability is low even when Jev is sure.** The winning phrase
scored 0.18–0.62, because "writing clearly. Not coding." and "is writing
clearly" are near-copies that split the vote. Adding up the probability of every
candidate containing a word tells the real story: "writing" carries 0.73,
"clearly" 0.66. So the stamp rule reads that merged figure, not the winner's raw
number.

**A post can be three things at once.** The SaaS post really is self-promotion,
advice and a bookmark-bait hook; the Choice spread 0.45 / 0.32 / 0.21 rather
than faking certainty. The stamp shows one verdict, so a spread like that is
where a low-confidence look (lighter ink) earns its place.

The tabs post shows the quote's weak spot: it picked the insult, not the
subject. Six posts is not a measurement; slice 3 is.

## The stamp rule (starting values, unmeasured)

- Verdict line: shown when the top verdict is not "none" and scores ≥ 0.5;
  0.3–0.5 draws in lighter ink; below 0.3, no verdict line.
- Quote line: shown when the merged probability around the winning phrase
  is ≥ 0.4.
- Neither line passes: no stamp. A failed or timed-out request: no stamp, and
  the error is counted in the toolbar tooltip, so "Jev said nothing useful" and
  "Jev never answered" stay separate.

These numbers are guesses. Slice 3 replaces them from labelled posts with
`ask-jev check`, which refuses to recommend a threshold from fewer than ten.

## How it is built

A Manifest V3 extension, loaded unpacked from `~/Work/x-stamp`, plain JavaScript
with no build step. Only Chrome on this box, no store listing, no GitHub remote.

```
 x.com tab                             extension service worker         OpenRouter
┌───────────────────────┐  post text  ┌─────────────────────────┐  POST /api/v1/systemone
│ content.js            │────────────▶│ background.js           │───────────────────────▶ Jev
│  · watches articles   │             │  · on/off state         │   2 questions,
│  · ≥60% visible 300ms │◀────────────│  · cache by post id     │   1 request
│  · draws the stamp    │   verdict + │  · ≤4 requests in flight│◀───────────────────────
└───────────────────────┘   quote     │  · reads the key        │
                                      └─────────────────────────┘
  Fig 2. Only the service worker holds the key and talks to the network; the
  page script never sees it. Drawn from the plan, nothing built yet.
```

- **The key.** You paste your OpenRouter key once into the extension's options
  page; it lives in Chrome's extension storage on this machine, and the repo
  never sees it (`.gitignore` plus a pre-commit check, copied from
  jev-integrations). Our rule is that keys stay server-side; the server-side
  version here would be a loopback proxy running `JevClient`, which any web page
  in the browser can reach and which is one more daemon to keep alive. For a
  build that never leaves this box, extension storage is the same trust as the
  `.env` file.
- **No `JevClient`.** It is Python and the browser cannot run it. The JavaScript
  call is about forty lines; the request shape is linted at design time with
  `ask-jev lint` against a saved copy.
- **Spending.** Only posts that stay ≥60% on screen for 300 ms get asked, so a
  fast flick spends nothing. Answers are cached by post id, so scrolling back
  does not ask again. Cost per post is **unmeasured**: the four-question
  lead-scoring figure ($0.000035) had a much smaller request than 60 candidate
  phrases. Slice 1 logs the real number.
- **X's page structure.** Posts are `article[data-testid="tweet"]`, text is
  `[data-testid="tweetText"]`. X changes these without notice, so the selectors
  live in one place.
- **The stamp.** Drops from 2.4× size to 1× with a slight overshoot and a −6°
  tilt in about 180 ms, ink colour by verdict, multiply blend, clicks pass
  through it. Under "reduce motion" it fades in instead.

## Slices

1. **Tracer.** Content script finds posts, the service worker asks Jev, a plain
   unstyled label appears on the post. Verified live on x.com in your Chrome.
   Logs tokens and cost per request.
2. **The stamp.** The look and the drop, the toolbar toggle and shortcut, the
   options page, the cache, the visibility gate.
3. **Calibration.** A debug switch records 30–50 real posts from your feed with
   Jev's answers; you mark each verdict and quote right, wrong or "no stamp" on a
   page; `ask-jev check` sets the thresholds and the verdict list gets edited
   where it confused you.

## Yours to change

- **Name and place:** `~/Work/x-stamp`, local git only.
- **The verdict list:** the ten above are my first cut; rename, merge or add
  freely. Each one has to answer *what is this post trying to get from me?*
- **Where the stamp sits:** over the text (Fig 1), or smaller in the corner so
  the post is untouched.

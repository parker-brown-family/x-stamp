# x-stamp — status

- **Difficulty (submitted before planning): 5/10** — one combined plan page, one approval.
- **Plan:** `01-plan.md` — written 2026-10-21, **approved 2026-10-21** ("full concur all BUILD BUILD BUILD!"). Defaults taken: the ten verdicts as listed, stamp over the text.
- **Decided by Parker, 2026-10-21:** the stamp is a verdict tag plus a verbatim quote of ≤6 words, both picked by Jev (Choice). Jev cannot generate text, so an LLM writing the six words was the other option, and it was declined.

## Slices

1. **Tracer — done 2026-10-21.** Verified end to end in real Chromium against real Jev (`npm run e2e`), and the selectors were checked read-only against live x.com in Parker's Chrome. Live X needed one change: an ad has no timestamp link, so the id falls back to its analytics link.
2. **The stamp — done 2026-10-21.** Drop and lift animation, toolbar toggle and Alt+Shift+S, options page with key, test and stats, per-post cache (page memory plus the worker's session storage), and the 60%-for-300 ms gate. The first screenshot showed post text bleeding through the stamp; paper went from 82% to 94% opaque, and faint is now lighter ink rather than a dimmed stamp.
3. **Calibration — recorder built, labels pending.** Recording and export are in the options page. Still to do: a labelling page, and `ask-jev check` over Parker's labels to replace the starting thresholds.

## Departures from the plan

- **The quote question was reworded** after the e2e run picked "Mine just retired" and "No cheating". The new wording ("names what the post is about") scored 21/21 against 17/21 on seven posts over three runs, picking the same phrase every time (`research/2026-10-21-gist-wording/`). The labels were mine, and those seven posts are also the ones the wording was tuned on.

## First look at Parker's live feed (2026-10-21, dedicated Chromium)

Stamps land on real posts. Of the first three: a real ad stamped `AD · "$200 monthly AI subscription prize"` (right); an organic post plugging the author's own app stamped `AD` (should be SELF-PROMO); and a quote post saying only "This is just incredible!!!" got no verdict and a quote of those words. The quoted post's text is not in Jev's state, so a quote post is judged on its comment alone. Both go into slice 3.

## Parker's first labels, and what changed (2026-10-21)

- **BUILDER AD <3** added for a person promoting what they made ("we love solo builders doing their own promo!!!"). Paid ads are AD from X's own label, by code. Jev now also sees the author, the link card and a quoted post. Measured that day on labelled cases that included real posts from his feed (kept private; superseded by `research/2026-10-21-taxonomy/`, measured on fictional stand-ins). One of his builder labels, a post about outfits for the author's own app, can't be reached from the text alone: nothing in it says the app is theirs.
- **Quicker:** posts are asked up to two screens ahead, and the stamp drops when its spot comes on screen. In the scrolling e2e it landed 0–1 ms after the spot appeared on every post below the first screen. Tall picture posts, which the old 60%-visible gate could never stamp, are covered.
- **Position:** the middle right of the post's lower half, sized to its words and kept inside the post.

## Measured

- About $0.000050 per post (`usage.cost`, 7 of 7 responses reported it).
- Latency per post: 275–911 ms averaged across three runs. It varies with the network.

- **Post-hoc difficulty:** 5 so far. Nothing has broken that the plan did not expect; the real test is Parker's feed.

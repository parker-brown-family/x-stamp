# x-stamp, round two — glass gel, category × type, builders bury shitposts

Difficulty 6/10: one combined plan, one approval, then build.

Parker, 2026-10-21, on his live feed: *"The shitposts are all too small... The
logos need to be GLASS GEL! ... with each shitpost (not getting smaller!) —
taking up a good 40% of the screen and then the builder posts knock it loose and
it flies off the screen... like a wave of jumbled posts all tangled together from
the right to the left... like rain falling down to bury the shitpost in a
mountain of building"* — the same note he gave the Omarchy film
`build-your-way-out`, and *"IT IS NOT HANDLED!!! this last prompt DEFINITELY
STILL APPLIES here"*. Then: *"BORDERS will be RAISED colour and cast a phosphor
colour light INTO the label element"*, and *"{category} {type} {quote} in
general then an optional second card if relevant ... make SINGLE calls with
carefully crafted state-question relationships"*.

## 1. What a stamp says

```
 ╔════════════════════════════════════╗   ← raised rim in the TYPE's colour,
 ║  FITNESS UPDATE                    ║     lit from above, its light spilling
 ║  “weight starts with a 1”          ║     inward as a phosphor glow
 ╚════════════════════════════════════╝
   {CATEGORY} {TYPE}  then  {quote}
```

- **Type** carries the colour, as now. Two renames from his notes:
  `LIFE UPDATE` becomes **UPDATE**, and `ENGAGEMENT BAIT` becomes **ENGAGEMENT**,
  which also covers thirst posts (*"THIRST is not a category we will use
  ENGAGEMENT"*).
  The full list is NEWS, HOT TAKE, RAGE BAIT, BUILDER AD <3, SELF-PROMO, AD,
  ENGAGEMENT, ADVICE, QUESTION, UPDATE and JOKE.
- **Category** is an optional prefix, there for scanning: TECH, AI, HEALTH,
  FITNESS, MONEY, CAREER, CONNECT, FAMILY, FOOD, POLITICS, SPORTS, GAMING, ART,
  SCIENCE, TRAVEL. It reads as `HEALTH UPDATE`, `TECH NEWS`, `CONNECT ENGAGEMENT`
  or `AI HOT TAKE`. When no category is clear, the stamp shows the type alone.
- **The quote** stays as it is: up to six of the post's own words.
- **The second card** appears when a second type also clearly holds. A
  BUILDER AD <3 that is also ADVICE gets a smaller card tucked under the first,
  in the second type's colour.

## 2. One request per post, built so each answer means one thing

All questions go in one request over one state. Each question asks about one
thing, so its answer can only mean that.

| Question | Primitive | Reads | Owns |
|---|---|---|---|
| type | Choice, 11 + none | `post.text`, plus author, card and quoted post when present | colour, and which motion runs |
| category | Choice, 15 + none | `post.text` and the card | the prefix |
| quote | Choice over the post's 2–6-word runs | `post.text` | the quote |
| also_<type> × 11 | Noul each: "Does `post.text` also …?" | as type | the second card |

The second card comes from separate yes/no questions, because a Choice names one
answer even when two are true. That was measured on 2026-09-28 (the churn
analysis): three reasons present, one named at 0.97. Code takes the strongest yes
that isn't the primary type, and shows it only above a high bar.

Paid ads stay AD by X's own label, so no question is asked about them.

Request cost goes up: 14 questions instead of 2. **It is unmeasured.** Slice 1
logs it, and if it runs past roughly ten times today's $0.00005 per post, the
second-card questions move into a follow-up asked only when the type's
distribution is split.

## 3. The look: glass gel, from the film

Ported from `build-your-way-out`'s `redBox` and builder cards to CSS, so nothing
is drawn on a canvas:

- **Body:** dark glass tinted with the type colour (`rgba(ink, 0.10)` over the
  page's black), with a backdrop blur so the post shows through as frost.
- **Raised rim:** a 4 px border in the type colour, with a light edge top-left
  and a dark edge bottom-right, so it reads as raised.
- **Phosphor:** the rim casts its colour inward (an inset glow 18–28 px deep) and
  outward (a soft halo). The words glow faintly in the same colour.
- **Sheen and glint:** a white highlight across the top 30% of the card, and one
  glint that sweeps across as the card lands.

## 4. The motion: shitposts held big, builders knock them loose

Over a live feed, as the scroll happens:

```
 frame 1  a RAGE BAIT / ENGAGEMENT post arrives
 ┌──────────────────────────────┐
 │ ╔══════════════════════════╗ │  its red-gel card slams in at about 40% of
 │ ║  RAGE BAIT               ║ │  the screen's height, over the post, and
 │ ║  “use tabs instead of    ║ │  holds while the post is on screen
 │ ║   spaces”                ║ │
 │ ╚══════════════════════════╝ │
 └──────────────────────────────┘
 frame 2  the next BUILDER AD <3 post lands on screen
 ┌──────────────────────────────┐
 │                  ▣ ▣  ▣      │  a tangled burst of builder cards (the
 │ ╔══════════════╗  ▣ ▣ ▣      │  builders seen so far: @handle + quote)
 │ ║  RAGE BAIT   ║ ◄── ▣ ▣     │  pours in from the upper right and hits
 │ ╚══════════════╝ ↙           │  the red card
 └──────────────────────────────┘
 frame 3
 ┌──────────────────────────────┐
 │ ╲╲  (red card spins down-left│  the red card tumbles off the left edge;
 │   ╲ and off the screen)      │  the builder cards rain down onto that
 │ ▣▣ ▣ ▣▣ ▣ ▣▣ ▣▣ ▣ ▣▣ ▣▣ ▣   │  post and pile on it: the shitpost is
 │ ▣▣▣ ▣▣▣▣▣ ▣▣▣ ▣▣▣▣ ▣▣▣ ▣▣   │  buried in a mountain of building
 └──────────────────────────────┘
```

- **Shitposts** are RAGE BAIT and ENGAGEMENT. **Builders** are BUILDER AD <3.
  Every other type gets the glass stamp at today's size and spot.
- The motion runs on a layer pinned over the whole window, which is how the
  cards can be 40% of the screen and fly off its edge, and it follows the post as
  it scrolls. Clicks pass through all of it.
- The pile stays on the buried post and scrolls away with it. **Unlike the film,
  builders don't rain between bursts,** because a feed you're reading can't keep
  being covered.
- With no builder seen yet, a held shitpost card just scrolls off with its post.
  The burst uses whatever builders this tab has seen, repeated when there are
  fewer than five.
- Under "reduce motion" there are no flights: the red card fades out, and a
  short stack of builder cards fades in.

## 5. Slices

1. **One call.** The new questions, with their cost and the type, category and
   second card measured on labelled cases, including Parker's posts from today.
2. **Glass gel.** The card look on every stamp, checked live on his feed.
3. **Knock and bury.** The overlay layer, the burst, the tumble and the pile.
   Checked in the scrolling e2e test and in a new demo recording.

## Yours to change

- The two type renames and the fifteen categories.
- Which types count as shitposts (I picked RAGE BAIT and ENGAGEMENT; HOT TAKE
  stays an ordinary stamp).
- The no-rain-between-bursts change from the film.

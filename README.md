# x-stamp

A Chrome extension for X (Twitter). As each post scrolls into view, a small
glass stamp lands on it saying what the post is **for** and what it's
**about**, plus a few of its own words:

```
 ╔══════════════════════════════════════╗
 ║  FITNESS UPDATE                      ║
 ║  “my weight now starts with a "1"”   ║
 ╚══════════════════════════════════════╝
```

The stamp's colour is the post's type, the same on every post:

| Type | Colour | Means |
|---|---|---|
| NEWS | blue | reports something that happened |
| HOT TAKE | orange | an opinion the author expects people to argue with |
| BUILDER AD <3 | pink | a person promoting something they built themselves |
| SELF-PROMO | purple | shows off the author's own success or status |
| PAID ADVERT | grey | a company selling, or a sponsored post (X's own "Ad" label counts) |
| ENGAGEMENT | yellow | fishing for replies: HARVEST, THIRST, TROLL or CONNECT |
| ADVICE | green | teaches you how to do something |
| QUESTION | teal | sincerely asks for help |
| UPDATE | indigo | news from the author's own life: FAITH, HEALTH, BUSINESS… UPDATE |
| JOKE | lime | trying to be funny |

Replies are skipped: on a post's own page only that post is stamped, and
elsewhere anything marked "Replying to" is left alone, so replies cost nothing.
A small meter at the bottom of X shows today's posts and spend (turn it off in
the options page).

A topic goes in front when it's clear (`MONEY NEWS`, `TECH HOT TAKE`). When a
post is also a second type, the stamp carries a small `+ ENGAGEMENT HARVEST`
pill. Posts with nothing worth saying get no stamp.

The labels come from [Jev](https://docs.typesafe.ai), a model from TypeSafe
that answers typed questions with probabilities instead of writing text. That's
why every quoted word is the post's own: Jev picks the phrase, it never writes
one.

## What you need

- **Chrome** (or another Chromium browser: Edge, Brave, Chromium).
- **An OpenRouter API key with a little credit.** Jev is served through
  OpenRouter. Make a key at <https://openrouter.ai/keys>. A post costs about
  **$0.00012** to label, so roughly **12 cents per thousand posts**. The key is
  yours and stays in your browser.

That's all. There's nothing to build.

Asking an AI agent to set it up for you? Point it at [AGENTS.md](AGENTS.md). It
says how to install this without the agent ever seeing your key.

## Install

### On Omarchy: one command, no Developer mode

Omarchy loads its own Chromium extensions (Copy URL, yt-dlp, WhatsApp Slim) from
a line in `~/.config/chromium-flags.conf`. x-stamp installs onto the same line.

1. Get the code:
   ```
   git clone https://github.com/parker-brown-family/x-stamp ~/x-stamp
   ```
2. Add it to your browser:
   ```
   ~/x-stamp/scripts/omarchy-install.sh
   ```
   It adds `~/x-stamp/extension` to the `--load-extension=` line of every
   browser flags file you have (Chromium, Brave, Edge), keeps a `.bak-x-stamp`
   copy of each, and leaves the other extensions alone. Omarchy updates append
   to that line rather than rewrite it, so x-stamp stays.
3. **Quit the browser completely and start it again.** Flags are read only at
   launch, so a new window isn't enough. Close every window (or run
   `pkill chromium`), then open it from the launcher.
4. x-stamp's options page opens on first start. Paste your OpenRouter key, press
   **Save**, then **Ask Jev**. A stamp title in the result means it works.
5. Pin the stamp icon. Click it, or press **Alt+Shift+S**, to switch stamps on
   and off. Then open <https://x.com> and scroll.

Branded Google Chrome ignores this way of loading extensions (since Chrome 137).
If that's your browser, use the next route.

### Any Chromium browser, by hand

1. Download this repository (**Code → Download ZIP**, then unzip) or `git clone`
   it.
2. Open `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and choose the `extension` folder inside it.
4. Steps 4 and 5 above: paste your key, **Save**, **Ask Jev**, pin the icon.

### Updating

```
git -C ~/x-stamp pull
```

Then quit and restart the browser. If stamps still behave like the old version,
open x-stamp's options page and press **Reload extension**. Chromium sometimes
keeps running an old copy of an extension's background code across restarts.

### Removing

On Omarchy:

```
~/x-stamp/scripts/omarchy-install.sh --uninstall
```

Then restart the browser. Installed by hand: remove it from `chrome://extensions`.
Either way, removing it deletes your key and everything it stored.

## What it sends, and where

For each post that comes near the screen, the extension sends **the post's
text**, and when present its author's display name and handle, its link-preview
card, and the text of a post it quotes. These go to OpenRouter's
`/api/v1/systemone` endpoint using your key. Nothing else leaves your browser:
no browsing history, no account details, no images. Answers are cached for the
browser session, keeping the newest 500 answers within 1 MB. Older answers can
be asked again after eviction. Full details:
[PRIVACY.md](PRIVACY.md).

Switching stamps off cancels queued uploads and aborts requests still in flight;
data already sent cannot be recalled. An explicit **Ask Jev** in Options still
works while stamps are off.

The extension permits at most **1,000 requests per UTC day**, **60 per minute
across tabs**, and **30 per minute from one tab**. Manual tests count too. These
are request limits; use an OpenRouter key spending limit for a dollar cap.
The daily allowance survives browser restarts. A cancelled request can still
consume an allowance slot. Each post is limited to 20,000 characters, with
separate limits on author, quote and card text; oversized posts are skipped.

## How it decides

| Step | Done by |
|---|---|
| Find posts and read their text, author, card and quoted post | code, `extension/content.js` |
| Cut every run of 2–10 consecutive words as a candidate quote | code, `extension/lib/candidates.js` |
| Type, kind of engagement, topic, quote, and whether a second type holds: one batched request | Jev, `extension/lib/jev.js` |
| Whether to stamp, the title, faint or full ink | code, `extension/lib/rule.js` |
| Paid ads | code: X's own "Ad" label decides, Jev isn't asked |
| Key, cache, on/off, cost and error counts | code, `extension/background.js` |

Measured on 20 labelled cases, two runs each: main type right 34/40, title
28/34, every requested two-type combination shown, about 200 ms and $0.00012
per post ([research/2026-10-21-taxonomy](research/2026-10-21-taxonomy/output.txt)).
The thresholds in `rule.js` are starting values; turn on **Recording** in the
options page if you want to collect posts and tune them.

## Developing

```
npm install
```
```
npm test
```
```
npm run e2e
```

`npm test` checks the phrase cutter, request, stamp rule, input and retention
limits, cancellation, and release packaging offline. `npm run security` tests
credentials, sender restrictions, Off, Recording, request limits, quota failures,
and restart persistence in a disposable Chromium with a dummy key and mocked
API responses. It makes no provider calls.
`npm run e2e` loads the real extension into a throwaway Chromium, serves x.com
from `test/fixture/home.html`, and asks real Jev (about $0.002 a run). Scripts
and tests find a key in `OPENROUTER_API_KEY`, or in `OPENROUTER_API_KEY=...` in
a `.env` at the repo root. Both are gitignored, and so is
`extension/key.local.json`, which `scripts/install-key.sh` writes for local
development.

Install the hook that refuses to commit a key:

```
./scripts/hooks/install.sh
```

Build the zip for the Chrome Web Store. It refuses to include anything
key-shaped:

```
./scripts/package.sh
```

`docs/chrome-web-store.md` walks through publishing. `docs/plans/` holds the
design notes the extension was built from.

## License

MIT. See [LICENSE](LICENSE). Not affiliated with X Corp., OpenRouter or
TypeSafe.

# Publishing x-stamp on the Chrome Web Store

Checked against Google's developer docs on 2026-10-21. They change, so the
dashboard is the authority on the day.

## 1. A developer account (once)

- Sign in at <https://chrome.google.com/webstore/devconsole> with the Google
  account that will own the listing.
- Pay the one-time registration fee. Google's page doesn't state the amount; it
  has been US$5, and the dashboard shows the current figure.
- Give a developer email. **It can't be changed later**, and Google recommends
  one used only for publishing.
- A new publisher can have at most two published extensions.

## 2. The package

```
./scripts/package.sh
```

This writes `dist/x-stamp-<version>.zip` from `extension/`. It leaves out any
`*.local.*` file (a developer's `key.local.json`), and it refuses to finish if
any file going in contains something shaped like an API key. The listing ships
**no key**: every user brings their own OpenRouter key and pastes it into the
options page.

In the dashboard: **Add new item → upload the zip**.

## 3. Store listing

**Name.** "x-stamp" puts X's name first, and the store's policies are strict about
anything that reads as impersonating another company. A safer listing name puts
the purpose first and X after "for", for example **"Post Stamps for X"**. The
repository can keep its name.

**Summary** (132 characters max):

> Stamps each post on X with what it's for and what it's about, using Jev. Bring your own OpenRouter key.

**Description:**

> As you scroll X, a small glass stamp lands on each post: NEWS, HOT TAKE,
> BUILDER AD <3, SELF-PROMO, PAID ADVERT, ENGAGEMENT, ADVICE, QUESTION, UPDATE or
> JOKE, with a topic in front when it's clear (MONEY NEWS, FAITH UPDATE) and a few
> of the post's own words. Colours stay the same for each type, so you can read
> your feed at a glance.
>
> Labels come from Jev, a model from TypeSafe served through OpenRouter. You need
> an OpenRouter API key with a little credit: about $0.00012 per post, roughly
> 12 cents per thousand. The key stays in your browser.
>
> Click the toolbar icon or press Alt+Shift+S to switch stamps on and off.
>
> Open source: <repository URL>. Not affiliated with X Corp.

**Category:** Social & Communication (or Productivity).

**Images:**

| Asset | Size | Required | Status |
|---|---|---|---|
| Icon | 128×128 PNG, artwork in the middle 96×96 | yes | `extension/icons/on-128.png` fills the whole square; redraw with 16 px transparent padding |
| Small promo tile | 440×280 | yes | not made yet |
| Screenshots | 1280×800 (or 640×400), square corners, full bleed, 1 to 5 | at least 1 | not made yet. Use a feed of posts you have the right to show, or the fixture feed (`test/fixture/home.html`), which is fictional. |
| Marquee | 1400×560 | no | only needed to be featured |

## 4. Privacy tab

**Single purpose:**

> Labels posts on x.com with a small stamp naming the post's type and topic.

**Permission justifications:**

| Permission | Justification |
|---|---|
| `storage` | Saves the user's OpenRouter key, the on/off switch, running cost totals, and answers for the current session, so each post is labelled once. |
| Host `https://openrouter.ai/*` | The only network call: sends a post's text to the Jev model on OpenRouter to get its label, authorised with the user's own key. |
| Content script on `https://x.com/*` and `https://twitter.com/*` | Reads the text of posts on X and draws the stamp on them. Runs on no other site. |

**Remote code:** "No, I am not using remote code." Every script is in the
package; the network call returns JSON labels, never code.

**Data usage**, to tick and describe consistently with [PRIVACY.md](../PRIVACY.md):

- **Website content:** the text of posts on x.com, with their author's name and
  handle, link-preview card and quoted post, sent to OpenRouter to be labelled.
- **Authentication information:** the user's OpenRouter API key, stored locally
  and sent only to OpenRouter, to authorise the user's own requests.

Then certify all three statements: not sold to third parties, not used or
transferred for purposes unrelated to the single purpose, and not used for
creditworthiness or lending.

**Privacy policy URL:** the public link to `PRIVACY.md` in the repository.

## 5. Distribution and review

- **Visibility:** public, or **unlisted** first, which only people with the link
  can find. That's a gentle first release.
- **Test instructions:** reviewers need a key to see the extension work. Either
  give them a capped OpenRouter key in the test-instructions field, or say plainly
  that the extension needs the user's own key and describe what they'll see.
- **Review:** usually a few days, up to a few weeks. New developers and new
  extensions may get a closer look. The manifest asks for narrow permissions (one
  API host, two X domains, storage, no `tabs`, no `<all_urls>`), which helps.

## Before each upload

1. Bump `version` in `extension/manifest.json`.
2. `npm test` and `npm run e2e`.
3. `./scripts/package.sh`, and upload the new zip.

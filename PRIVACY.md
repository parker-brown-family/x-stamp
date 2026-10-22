# x-stamp privacy policy

Last updated 2026-10-21.

x-stamp labels posts on x.com. To do that it sends some of what is on your
screen to a model you pay for with your own key. This page says exactly what.

## What leaves your browser

For each post on x.com that comes near the screen while stamps are on:

- the post's text
- the author's display name and handle, when X shows them
- the text of a link-preview card on the post, when there is one
- the text of a post it quotes, when there is one

These are sent over HTTPS to OpenRouter (`https://openrouter.ai/api/v1/systemone`),
which serves the Jev model from TypeSafe, authenticated with **your** OpenRouter
API key. OpenRouter's and TypeSafe's own policies govern what happens to the
request there: <https://openrouter.ai/privacy>.

Nothing else is sent: no browsing history, no pages other than x.com, no images,
no information about your X account, and nothing to the extension's author.

When a stamp's quote is in another language, Chrome's built-in translator turns
it into your browser's language on your computer. The quote is not sent
anywhere to be translated. The first time a language needs translating, Chrome
downloads its translator once, after you click or press a key on x.com.

The same goes for a reply: when you press the translate chip in X's reply box,
your draft is translated, and read back, on your computer. x-stamp sends the
draft nowhere; X receives it only when you press Reply.

Switching stamps off cancels waiting uploads and aborts active requests. Data
already transmitted cannot be recalled. An explicit **Ask Jev** in Options can
send the sample you enter while stamps are off. All requests share the limits
of 1,000 per UTC day, 60 per minute overall, and 30 per minute per tab. Use an
OpenRouter key spending limit for a dollar cap.

## What stays in your browser

- Your OpenRouter key, in Chrome's extension storage on your computer. Only
  trusted extension pages and the worker can access it; content scripts cannot.
- Up to 500 recent answers within 1 MB for the current browser session. Answers
  evicted from this cache can be requested again.
- A daily request counter, retained across browser restarts. Recent request
  times and tab IDs, kept in session storage to enforce request limits.
- Running totals: posts asked, failures, and cost reported by OpenRouter.
- If you turn on **Recording** in the options page: up to 300 recent posts with
  Jev's answers within 2 MB, so you can download them to tune the extension.
  Off by default. **Clear recordings** deletes them and prevents pending answers
  from restoring them. Disabling Recording prevents pending recording writes.

The extension has no server, no analytics and no tracking. Removing the extension
removes everything it stored.

## Contact

Open an issue on the project's GitHub repository.

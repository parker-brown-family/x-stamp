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

## What stays in your browser

- Your OpenRouter key, in Chrome's extension storage on your computer.
- Jev's answers for the current browser session, so a post is asked about once.
- Running totals: posts asked, failures, and cost reported by OpenRouter.
- If you turn on **Recording** in the options page: up to 300 recent posts with
  Jev's answers, so you can download them to tune the extension. Off by default.
  **Clear recordings** deletes them.

The extension has no server, no analytics and no tracking. Removing the extension
removes everything it stored.

## Contact

Open an issue on the project's GitHub repository.

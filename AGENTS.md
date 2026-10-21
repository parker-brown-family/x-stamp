# For an agent setting up x-stamp for someone

x-stamp is a Chrome extension with nothing to build. Your job is to get the
`extension/` folder loaded in their browser and let **them** put their key in.

## The key: you never handle it

The extension needs an OpenRouter API key (it reaches the Jev model through
OpenRouter). That key spends the person's money, so:

- **Don't ask for it in chat, don't type it, don't print it.** The person pastes
  it into the extension's options page themselves. The extension stores it in
  Chrome's local extension storage, and only the background service worker reads
  it. Page scripts never see it.
- **Never put it on a command line.** `OPENROUTER_API_KEY=sk-or-... npm test` lands
  in shell history and the process list. If a key is needed outside the browser
  (development only), the person writes it into `.env` at the repo root in their
  own editor, as `OPENROUTER_API_KEY=...`.
- **Never write it into a tracked file.** Only two places may hold it: `.env` and
  `extension/key.local.json` (written by `scripts/install-key.sh`). Both are
  gitignored.
- **Suggest a capped key.** At <https://openrouter.ai/keys> a key can have a
  credit limit. A few dollars covers tens of thousands of posts (about $0.00012
  each).
- **If a key is ever exposed**, it gets deleted at <https://openrouter.ai/keys>
  and replaced. Removing it from git afterwards doesn't un-leak it.

## Install, for a person who just wants to use it

**On Omarchy** (there's a `~/.config/chromium-flags.conf`), you can do steps 1–2
yourself, because they don't involve the key:

```
git clone https://github.com/parker-brown-family/x-stamp ~/x-stamp
```
```
~/x-stamp/scripts/omarchy-install.sh
```

Then **they** quit the browser completely and restart it (don't kill their
browser for them; it holds their open tabs), and go on from step 3 below. Undo
with `scripts/omarchy-install.sh --uninstall`.

**Anywhere else:**

1. Get the repo onto their machine: `git clone https://github.com/parker-brown-family/x-stamp`, or GitHub's **Code → Download ZIP**.
2. Have them open `chrome://extensions`, turn on **Developer mode**, click **Load
   unpacked**, and choose the `extension` folder. Chrome pages can't be automated,
   and Developer mode is the person's own security setting, so they do this step.
3. The options page opens. **They** paste their key, press **Save**, then
   **Ask Jev**. A stamp title in the result means it works.
4. They pin the icon. Clicking it (or Alt+Shift+S) switches stamps on and off.
   Then <https://x.com>.

That's the whole install. Don't run `npm install`, `install-key.sh` or the
launcher for a normal install.

## If something's wrong

| Symptom | Check |
|---|---|
| Icon badge says `KEY` | No key saved: options page, paste, Save |
| Badge says `ERR` | The key was refused (wrong, deleted, or out of credit). Hover the icon for the last error |
| No stamps, no badge | Is the icon switched on? Reload the x.com tab after loading or reloading the extension |
| Stamps stopped after editing the code | Press the reload arrow on the extension's card in `chrome://extensions`, then reload x.com |

## Development (only when asked to change the code)

```
npm install
```
```
./scripts/hooks/install.sh
```
```
npm test
```
```
npm run e2e
```

- `npm test` is offline. `npm run e2e` asks real Jev (about $0.002) and finds the
  key in `OPENROUTER_API_KEY` or `.env`, without printing it.
- `scripts/install-key.sh` copies the key from `.env` into
  `extension/key.local.json`, so an unpacked build works without the options page.
- `scripts/x-stamp-browser` opens X in a separate Chromium profile with the
  extension preloaded. It's Linux-specific (it assumes Wayland), so leave it alone
  on other systems.
- Before any commit: the hook is installed, and `git status` doesn't list `.env`
  or `key.local.json`. Before any upload: `./scripts/package.sh`, which refuses to
  zip anything key-shaped.

Design notes are in `docs/plans/`, publishing steps in `docs/chrome-web-store.md`,
and what leaves the browser in `PRIVACY.md`.

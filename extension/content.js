// x-stamp content script: read posts on x.com as X loads them, ask the service
// worker ahead of the scroll, and drop one small glass-gel stamp on each post as
// its spot comes into view, coloured by the post's type.
(() => {
  // X renames these without notice; this is the only place that knows them.
  const SEL = {
    post: 'article[data-testid="tweet"]',
    text: '[data-testid="tweetText"]',
    permalink: 'a[href*="/status/"]',
    author: '[data-testid="User-Name"]',
    card: '[data-testid="card.wrapper"]',
    quoted: 'div[role="link"]',
  };
  // Ask Jev about posts up to two screens below the viewport, so the answer is
  // usually back before the post arrives.
  const AHEAD = "0px 0px 200% 0px";
  // Where an ordinary stamp lands: the middle right of the post's lower half.
  const SPOT = { left: 0.7, top: 0.72 };
  const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  let enabled = false;
  const results = new Map(); // post id -> result
  const asked = new Map(); // post id -> Promise<result>
  const dropped = new Set(); // post ids whose stamp has already animated once

  // ---- reading a post -----------------------------------------------------

  function postId(article) {
    const links = [...article.querySelectorAll(SEL.permalink)];
    for (const a of [...links.filter((l) => l.querySelector("time")), ...links]) {
      const m = a.getAttribute("href").match(/\/status\/(\d+)/);
      if (m) return m[1];
    }
    return null;
  }

  // X splits a link's visible text into pieces; drop links whole.
  function cleanText(el) {
    const c = el.cloneNode(true);
    for (const a of c.querySelectorAll("a")) {
      const href = a.getAttribute("href") ?? "";
      if (href.startsWith("https://t.co/") || /^\s*https?:\/\//.test(a.textContent)) a.remove();
    }
    return c.textContent.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  }

  function readPost(article) {
    const texts = [...article.querySelectorAll(SEL.text)];
    const own = texts.find((t) => !t.closest(SEL.quoted)) ?? null;
    const quoted = texts.find((t) => t !== own && t.closest(SEL.quoted)) ?? null;
    const post = { text: own ? cleanText(own) : "" };
    const who = article.querySelector(SEL.author)?.innerText.split("\n") ?? [];
    const handle = who.join(" ").match(/@\w{1,30}/)?.[0];
    if (who[0]) post.author = handle ? `${who[0]} (${handle})` : who[0];
    if (quoted) post.quoted_text = cleanText(quoted);
    const card = article.querySelector(SEL.card)?.innerText.split("\n").filter(Boolean).join(" · ");
    if (card) post.link_card = card;
    // X labels a paid ad "Ad" in the header: a fact code can read.
    const promoted = [...article.querySelectorAll("span")].some(
      (s) => !s.childElementCount && /^(Ad|Promoted)$/.test(s.textContent.trim()) && !s.closest(SEL.text),
    );
    return { id: postId(article), post, promoted, handle: handle ?? who[0] ?? "" };
  }

  // ---- ink ------------------------------------------------------------------

  // Colour stands for the TYPE, the same on every post.
  const INK = {
    NEWS: "#3b82f6",
    "HOT TAKE": "#f97316",
    "BUILDER AD <3": "#ff4d8d",
    "SELF-PROMO": "#a855f7",
    "PAID ADVERT": "#a3a3a3",
    ENGAGEMENT: "#facc15",
    ADVICE: "#22c55e",
    QUESTION: "#14b8a6",
    UPDATE: "#6366f1",
    JOKE: "#84cc16",
  };
  const PLAIN_INK = "#94a3b8";
  const ink = (type) => INK[type] ?? PLAIN_INK;

  function card(cls, type, titleText, quoteText, faint, also) {
    const el = document.createElement("div");
    el.className = `xstamp-card ${cls}${faint ? " xstamp-faint" : ""}`;
    el.style.setProperty("--ink", ink(type));
    if (titleText) {
      const t = document.createElement("div");
      t.className = "xstamp-title";
      t.textContent = titleText;
      el.append(t);
    }
    if (quoteText) {
      const q = document.createElement("div");
      q.className = "xstamp-quote";
      q.textContent = `“${quoteText}”`;
      el.append(q);
    }
    // A second type rides inside the same card, small, in its own colour: one
    // stamp per post (Parker: "singular and small").
    if (also) {
      const a = document.createElement("div");
      a.className = "xstamp-also";
      a.style.setProperty("--also", ink(also.type));
      a.textContent = `+ ${also.title}`;
      el.append(a);
    }
    return el;
  }

  // ---- the ordinary stamp, inside its post ---------------------------------

  function drawStamp(article, id, stamp, animate) {
    removeStamp(article, false);
    const { primary, second, quote } = stamp;
    const el = document.createElement("div");
    el.className = "xstamp" + (animate ? " xstamp-drop" : "");
    el.dataset.xstampId = id;
    el.setAttribute("aria-hidden", "true");
    el.append(card("xstamp-first", primary?.type, primary?.title, quote?.text, primary?.faint, second));
    article.append(el);
    fit(article, el);
  }

  // Keep the stamp inside its post: the post clips what overflows it.
  function fit(article, el) {
    const W = article.clientWidth;
    const H = article.clientHeight;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const pad = 12;
    const x = Math.min(Math.max(W * SPOT.left, w / 2 + pad), W - w / 2 - pad);
    const y = Math.min(Math.max(H * SPOT.top, h / 2 + pad), H - h / 2 - pad);
    el.style.left = `${Math.round(x)}px`;
    el.style.top = `${Math.round(y)}px`;
  }

  function removeStamp(article, animate) {
    for (const el of article.querySelectorAll(":scope > .xstamp")) lift(el, animate);
  }

  function lift(el, animate) {
    if (!animate || reduceMotion()) return el.remove();
    el.classList.remove("xstamp-drop");
    el.classList.add("xstamp-lift");
    el.addEventListener("animationend", () => el.remove(), { once: true });
  }

  // ---- asking ahead, stamping on arrival ----------------------------------

  const inView = new WeakSet();

  function ask(article) {
    if (!enabled) return null;
    const { id, post, promoted } = readPost(article);
    if (!id || !post.text) return null; // a picture or video with no words: nothing to judge
    if (results.has(id)) return Promise.resolve(results.get(id));
    if (!asked.has(id)) {
      asked.set(
        id,
        chrome.runtime
          .sendMessage({ type: "judge", id, post, promoted })
          .then((res) => {
            if (res && (res.status === "stamp" || res.status === "blank")) results.set(id, res);
            return res;
          })
          .catch(() => null)
          .finally(() => asked.delete(id)),
      );
    }
    return asked.get(id);
  }

  async function show(article) {
    if (!enabled || !article.isConnected) return;
    const id = postId(article);
    const existing = article.querySelector(":scope > .xstamp");
    if (existing && existing.dataset.xstampId === id) return;
    if (existing) removeStamp(article, false);
    const res = await ask(article);
    if (!res || res.status !== "stamp") return;
    if (!enabled || postId(article) !== id || !inView.has(article)) return;
    if (article.querySelector(":scope > .xstamp")?.dataset.xstampId === id) return;
    drawStamp(article, id, res.stamp, !dropped.has(id));
    dropped.add(id);
  }

  const ahead = new IntersectionObserver(
    (entries) => {
      for (const e of entries) if (e.isIntersecting) ask(e.target);
    },
    { rootMargin: AHEAD },
  );

  // A one-pixel marker where the ordinary stamp lands: "is the stamp's spot on
  // screen" is the right question for a tall post, "is the post" the wrong one.
  const spot = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const article = e.target.parentElement;
        if (!article) continue;
        if (e.isIntersecting) {
          inView.add(article);
          show(article);
        } else {
          inView.delete(article);
        }
      }
    },
    { rootMargin: "0px 0px -8% 0px" },
  );

  function addSpot(article) {
    let m = article.querySelector(":scope > .xstamp-spot");
    if (m) return m;
    if (getComputedStyle(article).position === "static") article.style.position = "relative";
    m = document.createElement("div");
    m.className = "xstamp-spot";
    m.style.left = `${SPOT.left * 100}%`;
    m.style.top = `${SPOT.top * 100}%`;
    article.append(m);
    return m;
  }

  const watched = new WeakSet();
  function scan() {
    for (const a of document.querySelectorAll(SEL.post)) {
      if (watched.has(a)) continue;
      watched.add(a);
      ahead.observe(a);
      spot.observe(addSpot(a));
    }
  }

  // X adds thousands of nodes as it scrolls. Rather than search each one, look
  // for new posts at most once a frame.
  let scanQueued = false;
  new MutationObserver(() => {
    if (scanQueued) return;
    scanQueued = true;
    requestAnimationFrame(() => {
      scanQueued = false;
      scan();
    });
  }).observe(document.documentElement, { childList: true, subtree: true });

  // ---- on/off -------------------------------------------------------------

  function setEnabled(on) {
    enabled = on;
    if (on) {
      for (const a of document.querySelectorAll(SEL.post)) {
        ask(a);
        if (inView.has(a)) show(a);
      }
    } else {
      for (const el of document.querySelectorAll(".xstamp")) lift(el, true);
    }
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.enabled) setEnabled(changes.enabled.newValue !== false);
  });
  chrome.storage.local.get("enabled").then(({ enabled: on }) => {
    enabled = on !== false;
    scan();
    setEnabled(enabled);
  });
})();

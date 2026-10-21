// The one request x-stamp makes per post: every question about one post, batched,
// each asking one thing so its answer can only mean that thing.

export const ENDPOINT = "https://openrouter.ai/api/v1/systemone";
export const MODEL = "jev-latest";
export const NONE = "none_of_the_above";
export const TIMEOUT_MS = 8000;

// The TYPE: what the post is mainly trying to get from the reader. It carries
// the stamp's colour. Parker, 2026-10-21: "PAID ADVERT is the new AD",
// "Engagement is valid --- we take BAIT out", and rage bait is a kind of
// engagement (TROLL) rather than a type of its own.
export const TYPES = {
  NEWS: "Reports something that happened, as information",
  "HOT TAKE": "Argues an opinion the author expects people to disagree with",
  // Parker: "we love solo builders doing their own promo!!!"
  "BUILDER AD <3": "A person promoting something they built or run themselves: their own app, game, product, project or service",
  "SELF-PROMO": "Shows off the author's own success, numbers or status, with nothing of theirs to try or buy",
  "PAID ADVERT": "A company's account selling its product, or a sponsored or affiliate post selling someone else's",
  ENGAGEMENT: "Exists mainly to collect replies, likes, follows or attention, by asking for them, provoking people or showing off, more than to say something",
  ADVICE: "Teaches the reader how to do something",
  QUESTION: "Sincerely asks readers for information or help",
  UPDATE: "Shares news from the author's own life or work, without selling anything",
  JOKE: "Is mainly trying to be funny",
  [NONE]: "The post's main purpose is none of the above",
};

// How an ENGAGEMENT post goes about it. Read only when ENGAGEMENT is on a card.
export const ENGAGEMENT_KINDS = {
  HARVEST: "Asks readers to reply, like, repost, comment or follow, or dangles a reward for doing it",
  THIRST: "Leans on the author's looks or desirability to draw attention",
  TROLL: "Insults or provokes a group to get angry replies",
  CONNECT: "Invites strangers to introduce themselves or network with the author",
  [NONE]: "None of these ways",
};

// The CATEGORY: what the post is about. An optional prefix on the title, for
// scanning ("FAITH UPDATE, HEALTH UPDATE, BUSINESS UPDATE, TECH UPDATE,
// ADDICTION UPDATE").
export const CATEGORIES = {
  TECH: "Software, hardware, computers, the internet",
  AI: "Artificial intelligence and AI tools",
  BUSINESS: "Companies, startups, revenue, markets and work as a business",
  MONEY: "Personal finance, prices, the economy, investing",
  CAREER: "Jobs, hiring, quitting, workplaces",
  HEALTH: "Illness, medicine, mental health, the body",
  FITNESS: "Exercise, training, weight, sport as a practice",
  FAITH: "Religion, prayer, God, church",
  ADDICTION: "Addiction, sobriety and recovery",
  FAMILY: "Parents, children, partners, relatives",
  FOOD: "Cooking, eating, restaurants",
  POLITICS: "Government, elections, policy",
  SPORTS: "Teams, games, athletes as entertainment",
  GAMING: "Video games and gaming",
  ART: "Art, design, music, writing, film",
  SCIENCE: "Science, space and nature",
  TRAVEL: "Places, trips, moving",
  [NONE]: "About none of these, or about everyday life in general",
};

// Types that can be true of a post at the same time as its main type, so they
// can earn a second card. Asked as separate yes/no questions, because a Choice
// names one answer even when two hold (measured 2026-09-28: three reasons
// present, one named at 0.97).
// Each worded as one yes/no in its own right: reusing the type definitions,
// which say "mainly", inside an "at least in part" question asked two things.
export const SECONDARY_Q = {
  "HOT TAKE": "Does `post.text` argue an opinion the author expects people to disagree with?",
  ENGAGEMENT: "Is `post.text` fishing for replies, likes, follows or attention: asking for them, inviting strangers to introduce themselves, provoking anger, or leaning on the author's looks?",
  "BUILDER AD <3": "Does `post.text` promote something the author built or runs themselves?",
  "SELF-PROMO": "Does `post.text` show off the author's own success, numbers or status?",
  ADVICE: "Does `post.text` teach the reader how to do something?",
  QUESTION: "Does `post.text` sincerely ask readers for information or help?",
  UPDATE: "Does `post.text` share news that happened in the author's own life or work?",
  JOKE: "Is `post.text` trying to be funny?",
};
export const SECONDARY = Object.keys(SECONDARY_Q);
// Pairs that say nothing new side by side, or contradict each other. Measured
// 2026-10-21: SELF-PROMO said yes at 0.91-0.96 beside every success UPDATE
// (sobriety, weight loss, a seed round), and BUILDER AD <3 beside a brand's advert.
export const NO_PAIR = [["UPDATE", "SELF-PROMO"], ["UPDATE", "BUILDER AD <3"], ["PAID ADVERT", "BUILDER AD <3"], ["PAID ADVERT", "SELF-PROMO"]];
export const alsoKey = (t) => `also_${t.toLowerCase().replace(/[^a-z]+/g, "_").replace(/_+$/, "")}`;

function context(post) {
  return [
    post.author && "`post.author` is who posted it.",
    post.link_card && "`post.link_card` previews the page the post links to.",
    post.quoted_text && "`post.quoted_text` is someone else's post that this one quotes.",
  ].filter(Boolean).join(" ");
}

// `post` is {text, author?, quoted_text?, link_card?}; a field X did not show is
// left out rather than sent empty. A paid ad (`promoted`, read off X's own label)
// is PAID ADVERT by code, so its type and second card are not asked.
export function buildRequest(post, candidates, { promoted = false } = {}) {
  const state = { post: { text: post.text } };
  for (const k of ["author", "quoted_text", "link_card"]) if (post[k]) state.post[k] = post[k];
  const ctx = context(state.post);
  const questions = {
    category: {
      type: "choice",
      instructions: {
        question: "What is `post.text` about?",
        focus: `Name the subject, not the author's purpose.${state.post.link_card ? " `post.link_card` previews the page it links to." : ""}`,
      },
      criteria: CATEGORIES,
    },
  };
  if (!promoted) {
    questions.type = {
      type: "choice",
      instructions: {
        question: "What is `post.text` mainly trying to get from the reader?",
        focus: `Judge the author's main purpose, not the topic. ${ctx}`.trim(),
      },
      criteria: TYPES,
    };
    questions.engagement_kind = {
      type: "choice",
      instructions: {
        question: "If `post.text` is fishing for attention or replies, how does it go about it?",
        focus: `Answer none of these if it is not fishing for attention. ${ctx}`.trim(),
      },
      criteria: ENGAGEMENT_KINDS,
    };
    for (const t of SECONDARY) {
      questions[alsoKey(t)] = {
        type: "noul",
        instructions: {
          question: SECONDARY_Q[t],
          focus: `Judge this one thing only, whatever else the post also does. ${ctx}`.trim(),
        },
      };
    }
  }
  if (candidates.length) {
    const criteria = {};
    for (const c of candidates) criteria[c.text] = null;
    criteria[NONE] = "No phrase states what the post says";
    questions.gist = {
      type: "choice",
      instructions: {
        // Measured against "best states what the post says on its own": 21/21
        // against 17/21 quotes naming the subject (research/2026-10-21-gist-wording).
        question: "Which phrase, copied from `post.text`, names what the post is about?",
        focus: "Pick the words a reader most needs to know the post's subject and what it says about it. A phrase that only adds an aside, a reason, an insult or a closing remark is not it. Ignore hooks, emoji and calls to reply or follow.",
      },
      criteria,
    };
  }
  return { model: MODEL, state, questions };
}

// POST to OpenRouter. Resolves {ok:true, answers, usage, model, ms} or
// {ok:false, reason, status?, ms}; never throws, so a caller cannot mistake a
// failure for an answer.
export async function askJev(key, body, fetchImpl = fetch) {
  const t0 = Date.now();
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctl.signal,
    });
    const ms = Date.now() - t0;
    if (!res.ok) {
      const reason = res.status === 401 || res.status === 403 ? "auth" : res.status === 429 ? "rate-limited" : "http";
      return { ok: false, reason, status: res.status, ms };
    }
    const json = await res.json();
    if (!json.answers || !Object.keys(json.answers).length) return { ok: false, reason: "no-answer", ms };
    return { ok: true, answers: json.answers, usage: json.usage ?? null, model: json.model ?? null, ms };
  } catch (e) {
    return { ok: false, reason: e.name === "AbortError" ? "timeout" : "network", ms: Date.now() - t0 };
  } finally {
    clearTimeout(timer);
  }
}

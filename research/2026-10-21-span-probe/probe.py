import json, re, sys, time, urllib.request
from concurrent.futures import ThreadPoolExecutor
import os
key = os.environ["OPENROUTER_API_KEY"]  # export it before running
POSTS = [
 "Unpopular opinion but after 10 years in tech the single most important skill nobody talks about is writing clearly. Not coding. Writing. 🧵👇",
 "BREAKING: The Federal Reserve cuts interest rates by 0.25%, the first cut since March. Markets rallied on the news.",
 "I quit my 6-figure job 18 months ago. Today my SaaS hit $40k MRR. Here's exactly how I did it (bookmark this) 👇",
 "Reply with the last photo in your camera roll. No cheating. Let's go 👀",
 "Does anyone know a good dentist in Calgary that takes new patients? Mine just retired.",
 "If you still use tabs instead of spaces you are genuinely a danger to society and should not be allowed near a keyboard",
]
VERDICTS = {
 "NEWS": "Reports something that happened, as information",
 "HOT TAKE": "Argues an opinion the author expects people to disagree with",
 "RAGE BAIT": "Insults or provokes a group to get angry replies, more than it argues",
 "SELF-PROMO": "Shows off the author's own success, product or work",
 "AD": "Sells a product on behalf of a brand",
 "ENGAGEMENT BAIT": "Asks readers to reply, like, repost or follow, with little content of its own",
 "ADVICE": "Teaches the reader how to do something",
 "QUESTION": "Sincerely asks readers for information or help",
 "LIFE UPDATE": "Shares news from the author's own life without selling anything",
 "JOKE": "Is mainly trying to be funny",
 "none_of_the_above": "The post's main purpose is none of the above",
}
STOP = set("a an the and or but of to in on at for with is are was be it this that my your i you".split())
def spans(text):
    words = [w for w in re.sub(r"https?://\S+|#\w+|@\w+","",text).split() if re.search(r"\w", w)]
    out = []
    for n in range(2,7):
        for i in range(len(words)-n+1):
            s = " ".join(words[i:i+n]).strip(" ,;:-")
            first, last = words[i].lower().strip(".,!?"), words[i+n-1].lower().strip(".,!?")
            if first in STOP or last in STOP: continue
            if s not in out: out.append(s)
    return out[:254]
def ask(text):
    cands = spans(text)
    body = {"model":"jev-latest","state":{"post":{"text":text}},"questions":{
      "verdict":{"type":"choice","instructions":{"question":"What is `post.text` mainly trying to get from the reader?","focus":"Judge the author's main purpose, not the topic."},"criteria":VERDICTS},
      "gist":{"type":"choice","instructions":{"question":"Which phrase, copied from `post.text`, best states what the post says on its own?","focus":"Prefer the phrase a reader would understand without the rest of the post. Ignore hooks, emoji and calls to reply or follow."},
              "criteria":{**{c:None for c in cands},"none_of_the_above":"No phrase states what the post says"}}}}
    req = urllib.request.Request("https://openrouter.ai/api/v1/systemone", json.dumps(body).encode(), {"Authorization":"Bearer "+key,"Content-Type":"application/json"})
    t=time.time(); r=json.load(urllib.request.urlopen(req, timeout=30)); dt=time.time()-t
    return text, cands, r, dt
with ThreadPoolExecutor(6) as ex:
    for text, cands, r, dt in ex.map(ask, POSTS):
        a = r.get("answers") or r.get("results") or r
        print(f"\n### {text[:70]}  ({len(cands)} spans, {dt*1000:.0f} ms)")
        for q in ("verdict","gist"):
            ans = a[q]; p = ans.get("probabilities",{})
            top = sorted(p.items(), key=lambda kv:-kv[1])[:5]
            print(f"  {q}: {ans.get('choice')!r} conf={ans.get('confidence')}  top5=" + "; ".join(f"{k!r}={v:.2f}" for k,v in top))
        # word-coverage mass
        words = text.split(); p = a["gist"].get("probabilities",{})
        cov = [sum(v for k,v in p.items() if k!="none_of_the_above" and w.strip(".,!?") and w in k.split()) for w in words]
        print("  coverage: " + " ".join(f"{w}[{c:.2f}]" for w,c in zip(words,cov) if c>0.15))

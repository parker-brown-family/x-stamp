# Reply in the post's language

Difficulty **4/10**: one plan page, one approval. The score is set by the
reply box itself. If x-stamp writes into it wrongly, you post a public reply
that says something other than what you read, and you find out after it's up.
I checked that before writing this plan (the measurements are below), so what's
left is the design.

## What you'd see

Reading a Japanese post, about to reply:

```
  Replying to @someone_jp
  (o) Can you share the source code?

  [img] [gif] [:)] [pin]        [ TRANSLATE TO JAPANESE ]  [ Reply ]
```

One click later:

```
  Replying to @someone_jp
  (o) ソースコードを共有できますか?
      reads back: "Can I share the source code?"

  [img] [gif] [:)] [pin]        [ BACK TO ENGLISH ]        [ Reply ]
```

The reads-back line is the Japanese translated back into English, so you can
see what you're about to say in a language you can't read. Here it caught
something: the Japanese leaves out who is sharing, and it reads back as "Can I".
You'd reword and translate again before pressing Reply.

## How it works

1. **When the chip shows.** The reply box is open, the post you're replying to
   carries an X language tag that isn't your browser's language, and Chrome has
   its translator. On a post's own page the language comes from that post. In
   the reply window opened from the timeline, it comes from the post shown
   inside the window.
2. **Click.** Your draft goes through Chrome's on-device translator into the
   post's language and replaces the draft in the box. Nothing leaves the
   browser, and there's no Jev call.
3. **Back to English.** The chip becomes BACK TO ENGLISH and puts your saved
   English back. It has to exist, because Ctrl+Z doesn't undo the swap. If you
   edit the translated text, the chip goes back to TRANSLATE and the saved
   English is dropped. At that point the box holds your words, not the
   translator's.
4. **Reads back.** After the swap, the box's text is translated back into English
   and shown faintly under the box. It runs after the swap, so it never delays
   it.
5. **A language's first use.** Chrome downloads a model only in answer to a
   click, and your click on the chip counts. The chip reads FETCHING JAPANESE…
   while it downloads, about 5–6 s, once per language.

Stamps are untouched: none of this code runs until a reply box exists.

## Measured today, Chrome 155 on x.com

| Check | Result |
|---|---|
| Swap the draft through `execCommand('insertText')` | Text replaced; Reply button live |
| Does X's editor keep it? | Typed two letters by hand after the swap; the Finnish stayed and the letters joined it. If the editor hadn't taken the swap, the English would have come back |
| Ctrl+Z after the swap | Does nothing, hence BACK TO ENGLISH |
| English → Japanese, one sentence | 27–76 ms |
| Japanese → English, one sentence | 27–103 ms |
| Swap plus reads-back, both Japanese models loaded | 207–424 ms |
| Fetching the Japanese models, first use | 5.0 s and 6.1 s |

| You write | Japanese | Reads back |
|---|---|---|
| I built a robot that labels posts | 投稿するラベルのロボットを作りました | I made a robot with a label to post |
| I made a robot that puts labels on posts | 投稿にラベルを付けるロボットを作りました | I made a robot to label posts |
| This is amazing work, how did you build the controller? | これはすばらしい作業ですが、どのようにしてコントローラーを構築しましたか? | This is a great job, but how did you build the controller? |
| Can you share the source code? | ソースコードを共有できますか? | Can I share the source code? |

The first row is why the reads-back line exists. The second row is the fix a
person makes after seeing it.

## The decision: does Jev check the reads-back line?

**A (recommended): no.** You compare the two English lines by eye, as in the
second table. Nothing leaves the browser.

**B: one Jev yes/no question per click.** "Does the reads-back line say the
same thing as the draft?" Both sentences are English, which is the language
Jev reads best. A tick or a warning appears beside the reads-back line about
200 ms after the swap, at roughly $0.00003 a click. Your draft would then go
to OpenRouter, so the privacy page would have to say so.

## Not in this

- Translating anything you didn't click. Nothing happens on Post.
- New posts and quote posts. A new post has no other post to take a language
  from; quote posts could come later.
- An automated translation test. Playwright's Chromium has no translator, so
  the e2e gets a fixture post page with a reply box and checks that the chip
  stays away when there's no translator. Translation is checked live in your
  Chrome, as the stamps were.
- The release film. It films the English fixture feed, which has no reply box,
  so nothing it shows changes.

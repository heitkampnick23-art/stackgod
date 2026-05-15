# Stakgod launch playbook

Pre-written copy for every channel, ready to paste. Replace `[demo gif/video URL]` with your recording.

---

## 🚨 T-12hr final checklist (do these tonight)

**Run-on-Nick (you):**
- [ ] **Apply migration 008** so digest cron actually runs Monday:
      ```bash
      cd apps/api && npx wrangler d1 execute stackgod --remote --file=../../infra/d1/migrations/008_email_digest.sql
      ```
- [ ] **Record 30-second demo** (script below). Phone screen-record is fine. Save to `apps/web/public/demo.mp4`.
- [ ] **Flip 5 CF security toggles** (Bot Fight, BIC, Always-HTTPS, Min TLS 1.2, Email Obfuscation) — dash.cloudflare.com → stakgod.com → Security
- [ ] **Schedule Product Hunt for 12:01am PT** with copy from this doc
- [ ] **Find a hunter** with PH karma (DM 3-5 today, only one will say yes)
- [ ] **Sign-up sanity test in incognito** → /build → ship something → Discover shows it
- [ ] **Confirm Stripe shows LIVE mode** + a test webhook fired this week (Dashboard → Developers → Webhooks)
- [ ] **Pin tweet** announcing tomorrow's launch with a teaser GIF

**Already shipped, no action needed:**
- ✅ Press kit live at /press (logos, boilerplate, founder bio, screenshots, story angles)
- ✅ Per-app OG images auto-generated (every share has a real preview card)
- ✅ Dashboard empty state with 6 prompt suggestions for new sign-ups
- ✅ 🔥 Trending badge on Discover for ≥10 views/24h (social proof loop)
- ✅ Welcome email on first sign-up (drives 7-day retention)
- ✅ Weekly builder digest cron (fires Mondays, needs migration 008)
- ✅ SSR /discover (search engines see real content)
- ✅ /build accepts ?prompt= for prefilled ideas
- ✅ Real-time multi-cursor collab via Durable Objects
- ✅ All 16 sg.* SDK primitives auto-injected into shipped apps

## Day 1 morning — sequence

| Time (PT) | Action |
|---|---|
| 12:01 AM | Product Hunt goes live (scheduled) |
| 6:00 AM  | Post "Show HN" (see copy below) |
| 6:05 AM  | Post first HN comment ("I built this because…") |
| 6:30 AM  | Tweet the launch thread (see copy below) |
| 7:00 AM  | DM @CloudflareDev, @AnthropicAI, @stripe with demo |
| 8:00 AM  | r/SaaS post |
| 9:00 AM  | r/SideProject post |
| 10:00 AM | r/ChatGPTCoding post |
| 11:00 AM | DM 5 newsletter editors with the asset pack |
| 12:00 PM | r/webdev post |
| 1:00 PM  | r/IndieDev post |
| Whenever | Reply to every HN/PH comment within 5 min |

---

## 30-second demo script

```
[Screen: stakgod.com landing]
"This is Stakgod. Open source, on Cloudflare."

[Click 'Start free' → /build]
"I'm gonna build a habit tracker. Just by talking."

[Type: 'A habit tracker with streaks and Apple sign in']
[Hit send → preview streams in 5 seconds → app appears]
"Five seconds. Real auth. Real database. Real backend."

[Click 'Sign in with Apple' in the preview]
[Sign in → habits screen → add 'Meditate' → checkmark]
"My data persists. Across users. Across devices."

[Switch to dashboard]
"And — I can ship this same app to TestFlight."

[Click 'TestFlight' button → spinner]
"That's it. That's the app. Shipped."

[Cut to text: stakgod.com — open source — MIT]
```

---

## Show HN post

**Title:** `Show HN: Stakgod – Open-source Lovable that ships to the App Store`

**URL:** `https://stakgod.com`

**Body (paste as the FIRST comment, not the body — leave URL field as the only thing):**

> Hey HN — I built Stakgod because every AI app builder I tried (Lovable, Bolt, Hercules) gives you a chat box and a webview, but you have to BYO Supabase + auth + Stripe + email + everything else.
>
> Stakgod injects 16 backend primitives into every app you generate via chat — auth (magic link / Apple / Google), DB, AI (chat + stream + image), Stripe Connect (10% fee), file uploads, transactional email, web push (real RFC-8291), geo, cron, queue, share, embed. All as `window.sg.*`.
>
> Plus: ships generated apps to TestFlight + Play with auto-generated Flux app icons, real per-user keystores, native SwiftUI/Kotlin shells.
>
> Built on Cloudflare Workers + D1 + R2 + KV + Durable Objects + Workers AI. Open source MIT — fork it and run your own.
>
> Tech writeup of the architecture: https://github.com/heitkampnick23-art/stackgod#architecture
> Live demo: https://stakgod.com (5 free AI msgs/day, no card)
> Comparison vs Lovable / Bolt / Hercules: https://stakgod.com#compare
>
> Would love feedback. What primitive should I add next?

---

## Product Hunt copy

**Name:** Stakgod

**Tagline (60 char):** Chat to a real app, in TestFlight by lunch

**Description:**
> Open-source Lovable. Speak your app, ship it to the App Store the same day.
>
> Every app you generate gets 16 baked-in backend primitives — auth, db, AI (chat/image/stream), Stripe payments, push notifications, file uploads, email, geo, cron, queue. All as `window.sg.*`. Zero setup, no SDKs.
>
> Ships generated apps to TestFlight + Google Play with auto-generated app icons, real keystores, native shells.
>
> Built on Cloudflare. MIT licensed. Free forever for 5 messages/day.

**Topics:** AI, Developer Tools, No-Code, Open Source

**First comment (post yourself):**
> Hey PH! I built this because Lovable + Bolt are great UIs but you still have to wire Supabase + Stripe + email + push + iOS yourself. Stakgod bakes all of it in. Live demo, MIT licensed. Roast me — what's missing?

---

## Twitter/X launch thread

**Tweet 1 (the hook):**
> 🧵 I built **stakgod.com** — an open-source Lovable that ships your app to the App Store.
>
> Every app you generate gets 16 baked-in primitives: auth, db, AI, Stripe, push, file uploads, email, geo, cron, queue.
>
> All by typing *"build me a habit tracker."*
>
> Receipts ↓
> [demo video]

**Tweet 2:**
> The chat → working app loop is fast.
>
> But what makes it different from Lovable / Bolt: you don't BYO backend.
>
> `await sg.auth.signIn(email)`
> `await sg.db.put('habit:1', {streak: 5})`
> `await sg.payments.checkout({items})`
>
> All inject into every app for free.
> [screenshot of code]

**Tweet 3:**
> Then click "Ship to TestFlight" → real native iOS app in your inbox 8 minutes later.
>
> Real keystore (per-app, encrypted in R2). Real Stripe Connect (you keep 80%). Real Web Push (RFC-8291).
>
> Real apps. Not toys.
> [TestFlight screenshot]

**Tweet 4:**
> Built on @CloudflareDev (Workers + D1 + R2 + Durable Objects + Workers AI), @AnthropicAI Claude, @stripe Connect, @resend.
>
> Open source MIT — fork it, run your own:
> https://github.com/heitkampnick23-art/stackgod
>
> Live: https://stakgod.com

**Tweet 5 (CTA):**
> 5 free AI messages/day, no card. Upgrade when you outgrow it.
>
> If you want to try it: https://stakgod.com
> If you want to support an indie founder shipping app #1: https://stakgod.com/support
>
> What should I build next?

---

## Reddit posts (rotate these — don't shotgun the same body)

### r/SaaS — angle: marketplace + revenue

**Title:** I built a Lovable killer with a built-in marketplace where builders sell forks (80/20 split)

**Body:**
> Stakgod (open-source) lets you chat-to-build apps like Lovable/Bolt — but every shipped app has Stripe Connect baked in, and builders can flip a switch to sell their app as a forkable template ($X per fork, 80% to creator, 20% to Stakgod).
>
> No payment integration code. No "BYO Stripe." It's already wired.
>
> Live: https://stakgod.com
> Source: https://github.com/heitkampnick23-art/stackgod
>
> Curious what the indie SaaS folks here think about the marketplace model.

### r/SideProject — angle: I built it in a week

**Title:** I built an open-source Lovable competitor in a week — chat-to-app + ships to App Store

**Body:**
> No funding, no team. Built this on Cloudflare Workers + D1 + Claude. Generates real apps with auth/db/AI/payments baked in, then can submit to TestFlight + Google Play. MIT-licensed, fork it.
>
> Demo: [video]
> Live: https://stakgod.com
> Source: https://github.com/heitkampnick23-art/stackgod

### r/ChatGPTCoding — angle: 16 primitives Claude knows about

**Title:** I taught Claude to use 16 backend primitives so chat-built apps are real products, not toys

**Body:**
> Most chat-to-app builders generate single-file HTML toys. I built Stakgod with a system prompt that teaches Claude about `sg.db`, `sg.auth`, `sg.ai.chat`, `sg.payments.checkout`, `sg.upload`, `sg.email`, `sg.notify` (real web push), `sg.cron`, `sg.queue`, etc.
>
> Every app you generate has them auto-injected. So when you say "build me a habit tracker with sign-in," it actually works across users + devices, not just localStorage.
>
> Open source, deployed on Cloudflare Workers.
> https://stakgod.com · https://github.com/heitkampnick23-art/stackgod

### r/webdev — angle: Cloudflare-only stack

**Title:** Built a chat-to-app builder fully on Cloudflare — Workers + D1 + R2 + KV + Durable Objects + Workers AI

**Body:**
> Wanted to see how far the Cloudflare stack goes. Turns out: very far. Stakgod is fully on CF (Pages frontend, 2 Workers, D1, R2, KV, Queues, Durable Objects for live multi-cursor collab, Workers AI for app icons).
>
> Open source, MIT. Architecture diagram in the README.
> https://github.com/heitkampnick23-art/stackgod

### r/IndieDev — angle: ship to App Store flow

**Title:** I built an AI app builder that auto-submits to TestFlight + Play with generated icons

**Body:**
> Every shipped app gets a Flux-generated 1024x1024 icon, gets wrapped in a native SwiftUI / Kotlin shell, signed with a per-app keystore, and uploaded to App Store Connect via API.
>
> Builder brings their Apple Dev / Play account ($99/yr / $25 once), Stakgod handles every step after.
>
> Live: https://stakgod.com — open source.

---

## Newsletter editor email template

**Subject:** Open-source Lovable, builds AND ships to TestFlight (first to cover?)

**Body:**

> Hi [editor name],
>
> Quick one — I shipped **Stakgod** ([live](https://stakgod.com), [code](https://github.com/heitkampnick23-art/stackgod)), an open-source Lovable competitor with two features no other AI app builder has:
>
> 1. 16 backend primitives baked into every generated app (auth, db, AI, Stripe, real web push, cron, queue, file uploads, email)
> 2. Auto-submission to TestFlight + Google Play with AI-generated icons + per-app keystores
>
> If you'd like to cover it: I've prepared a 200-word blurb you can drop in, plus 3 high-res screenshots and a 30-sec demo video. Want me to send the asset pack?
>
> No pressure either way — happy to chat.
>
> Thanks,
> [your name]

---

## DM templates

### Cloudflare DevRel (Rita Kozlov, Brendan Irvine-Broque, Sam Hindawi)

> Hey [name] — built [stakgod.com](https://stakgod.com) entirely on Workers (D1, R2, KV, DOs for live collab, Workers AI for app icons). Open source. Curious if you'd find it interesting for the showcase. Demo video: [link]

### Anthropic DevRel

> Hey — open-source AI app builder using Claude across 16 different backend primitives (chat + stream + image gen). Live multi-cursor collab via DOs. Would love your eyes: [stakgod.com](https://stakgod.com) · [demo](link)

### Indie creators (Theo Browne, Greg Isenberg, Levelsio)

> Built an open-source Lovable that ships to App Store — fully on Cloudflare, MIT. Thought you might enjoy the architecture: [link]. No ask, just sharing.

---

## After-launch growth (week 2+)

- Ship one feature/week, tweet about it
- `/changelog` page (already auto-built from git) — link in every tweet
- Free Pro 14-day trial for first 100 signups via promo code
- Discord server, public roadmap
- Direct DMs to early signups: "what would unblock you?"
- Repeat the launch on Hacker News' "Ask HN" or "Tell HN" formats every 4-6 weeks (don't repeat Show HN)

---

## Metrics to watch (set up Cloudflare Web Analytics for free real-time)

| Metric | Day 1 healthy | Day 7 healthy |
|---|---|---|
| Visitors | 10k+ | 30k+ |
| Signups | 200+ | 1k+ |
| Apps generated | 100+ | 500+ |
| Pro upgrades | 5+ | 30+ |
| GitHub stars | 200+ | 800+ |

If signups < 1% of visitors → landing copy isn't converting; iterate the hero.
If signups but no apps generated → onboarding broken; check `/build` flow.
If apps but no upgrades → free tier too generous OR pricing too steep.

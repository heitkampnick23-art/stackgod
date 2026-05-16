# Product Hunt Reply Playbook — Stakgod, Sun May 17

Paste these as starting points, tweak 1-2 words to make each feel personal.
The PH algorithm rewards reply *speed* and *thread depth* — aim for ≤5 min per reply.

> **Tone north star:** confident, technical, slightly nerdy, never defensive. Always answer the question first, then add one extra useful fact. Never sell.

---

## 🥇 The "How is this different from Lovable / Bolt / Hercules?" reply

> Honest answer: those three are amazing chat-to-app tools but they hand you a web app and stop. Stakgod automates the *rest of shipping a real product*:
>
> - **App Store + Play submission**: real native SwiftUI + Compose generators, code-signs under your own Apple Developer account, uploads via ASC API. TestFlight in ~60s.
> - **16 baked-in primitives**: every shipped app gets `window.sg.{auth, db, payments, ai, push, cron, email, upload, share, ...}` auto-injected. Zero glue code.
> - **Marketplace**: builders can set a fork price (80% to them, 20% to us via Stripe Connect).
> - **Open source MIT** + all-Cloudflare stack.
>
> Free tier is intentionally small (5 messages/day) because we're paying real inference costs. Hercules generosity is unsustainable IMO.

---

## 🥇 The "Why Cloudflare, why not AWS / Vercel / Supabase?" reply

> Three reasons:
>
> 1. **Edge-first** — D1 + R2 + KV all run on the same machine that handles the request. Cold starts measured in *single-digit ms*. AWS Lambda + RDS is 100-500ms by comparison.
> 2. **Pricing honesty** — CF's free tier is generous *because their infra is so much cheaper to run*. We pay <$0.05/user/month at small scale. On Vercel + Supabase we'd be $2+.
> 3. **One vendor, one bill** — Workers + Pages + D1 + R2 + KV + Queues + Durable Objects + AI all on a single Cloudflare invoice. The complexity savings alone is the moat.
>
> The catch: D1 is still smaller than Postgres for big OLAP queries. But for the apps people build on Stakgod (auth, CRUD, payments) it's perfect.

---

## 🥇 The "What about vendor lock-in?" reply

> Real concern, real answer: **almost none**.
>
> - Your **domain** is yours (you buy it through CF Registrar or bring your own — we never own it).
> - Your **Apple Developer account** is yours (we automate submission, you own the listing).
> - Your **Stripe Connect account** is yours (your buyers, your money, weekly direct deposits).
> - The **source code** Stakgod generates is yours — you can `git clone` it, deploy it anywhere else.
> - We're **MIT licensed** so you can run your own Stakgod if you wanted to.
>
> The "lock-in" boils down to: the `window.sg.*` SDK assumes a Stakgod backend exists. Easy to shim onto any other BaaS in an afternoon.

---

## 🥇 The "How does the App Store ship actually work?" reply

> Per Apple Guideline 4.2.6 (avoiding "template apps" auto-rejection), every app submits under the *builder's own* Apple Developer account. So:
>
> 1. You connect your Apple Developer account once (App Store Connect API key + private key — stored AES-256-GCM-encrypted in our R2).
> 2. You click "Ship to TestFlight" on any of your apps.
> 3. We trigger a GitHub Actions macOS runner. `xcodegen` generates the project from `project.yml`, `xcodebuild` compiles + code-signs, `altool` uploads to ASC.
> 4. ~10 min later it's in TestFlight under your account, ready for review or external test invites.
>
> Same flow for Android: per-app keystore generated once and reused (so updates aren't blocked), uploaded to Play Internal Testing track.

---

## 🥇 The "Why so small free tier?" reply

> Brutal honest answer: AI inference costs *real money* and "free forever" platforms are racing each other to bankruptcy. 5 messages/day is enough to ship a small app and decide if you like the experience — but it forces an honest conversion conversation early.
>
> Math check: every Claude Sonnet 4.6 message that builds an app uses ~5-15k input tokens + ~3-8k output tokens = ~$0.02-$0.06 cost to us. At 5/day that's ~$0.10-$0.30/user/day in costs. If we gave 100 messages free, we'd hemorrhage cash. 14-day Pro trial is wide open today — that's our "try it for real" path.

---

## 🥇 The "Is this just a wrapper around Claude?" reply

> Fair question. The Claude calls are ~20% of the system. The other 80% is:
>
> - **Real-time multi-cursor collab** via Cloudflare Durable Objects (one DO per app_id, WebSocket fanout for cursors/presence/reactions)
> - **Visual click-to-edit** with iframe `postMessage` bridge that extracts the clicked element's CSS selector + HTML, wraps the user's natural-language edit, sends *just that diff* to Claude
> - **SDK injection** that splices a `<script>` tag with 16 backend primitives into every served HTML at the edge
> - **Per-app KV-backed mini-backend** at `/__api__/*` so each user's app has its own database, auth, push subs, etc.
> - **Full RFC 8030+8291+8292 web push** implementation in 200 lines of zero-dep WebCrypto (no `web-push` npm)
> - **Build pipeline** wiring all the way to App Store
>
> Claude is the brain. Cloudflare's primitives are the body.

---

## 🥇 The "Does it really ship to the App Store?" reply

> Yes, real submission to a real Apple account. Demo URL: visit a builder's profile (e.g. `stakgod.com/u/<handle>`), click their app, click "Ship to TestFlight." You'll see the GitHub Actions run in the dashboard build log.
>
> Caveats:
> - You bring your own Apple Developer account ($99/yr to Apple).
> - First app takes 10-15 min from click to TestFlight (bundle id provisioning + signing).
> - Apple review for App Store production submit is 1-3 days (their queue, not ours).
>
> Same flow for Google Play.

---

## 🥇 The "What's the catch / what's the business model?" reply

> No catch, here's exactly how we make money:
>
> 1. **Subscriptions**: Free 5 msg/day, Hobby $19, Pro $49, Studio $149/month. Most users land on Pro.
> 2. **Marketplace fees**: 20% of paid app forks (Stripe Connect routes 80% to builders).
> 3. **Domain registrar markup**: $1 flat over CF Registrar wholesale price (.com ~$10.77 → we charge $11.77).
>
> That's it. We don't sell your data, don't run ads, don't have a "we'll figure it out later" pricing strategy. The free tier is intentionally not generous so the business stays sustainable — we'd rather have 100 paying customers we serve well than 10,000 freeloaders we can't.

---

## 🥇 The "Built it solo?" reply

> Yeah — one human (me), one AI partner (Claude), one repo. Started the codebase ~3 weeks ago, shipped to LIVE production from day one (no test/sandbox modes anywhere). The whole platform is MIT-licensed on GitHub so the receipts are public: `github.com/heitkampnick23-art/stackgod`.
>
> Solo isn't a flex — it's a constraint that forced ruthless prioritization. Every feature you see is something I actually needed to ship my own apps.

---

## 🥇 The "Can I see source code?" / "Where's GitHub?" reply

> Yep, MIT licensed: **https://github.com/heitkampnick23-art/stackgod**
>
> Honest moat acknowledgment: the code is replicable. The brand, community, free CF infrastructure access, and willingness to ship LIVE from day one — that's the moat.

---

## 🥇 The negative / skeptical comment

> Generic structure when someone says "this won't work" / "AI builders are toys" / "Vercel will eat your lunch":
>
> > Totally hear that. The "toy" critique is fair for most chat-to-app tools — they stop at a working web demo. The bet Stakgod makes is that compressing *the App Store submission flow* (which is where 80% of would-be founders give up) is the actual product. Curious what your specific concern is — happy to dig in.

---

## ⛔ DO NOT

- **Don't** ask people to upvote ("would mean a lot if you'd upvote!"). PH algorithm auto-detects this. Genuine engagement = upvotes naturally.
- **Don't** reply with marketing speak. Engineers smell it instantly.
- **Don't** get defensive on negative comments. Acknowledge → ask question → engage.
- **Don't** delete bad comments. Leave them, reply substantively.
- **Don't** respond in <30 seconds to everything (looks bot-like). Aim for 2-5 min.

## ⚡ Speed playbook

1. **Tab 1**: PH launch page, refresh every 60 sec
2. **Tab 2**: this playbook, open in browser
3. **Tab 3**: stakgod.com (live demo to link from replies)
4. **Tab 4**: github.com/heitkampnick23-art/stackgod (for source-asks)
5. **Tab 5**: Twitter (cross-post good PH threads as tweet-quotes for compound reach)

## 🪝 Hooks to volunteer

If a comment thread is going well, drop ONE of these as a follow-up:
- "Side note: I'm trying to build the next 25 apps on the platform myself this week — DM me if you want to be one of them, I'll cover your $99 Apple fee."
- "The thing I'm most curious about: which of the 16 baked-in primitives surprises you most when you actually go shipping?"
- "Wrote up our model router logic [link to blog post] if anyone's curious how we route between Opus/Sonnet/Haiku."

(Only the first one is real today — skip the blog-post one until you actually write the post.)

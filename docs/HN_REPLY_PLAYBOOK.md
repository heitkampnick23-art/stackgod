# Hacker News Reply Playbook — Show HN: Stakgod

HN comments are ~10x more skeptical than PH, ~10x more technical, ~10x harder to spin.
The ONE rule: **answer the actual question, in technical detail, no marketing words**.

> **Tone north star:** the engineer-to-engineer slack reply you'd send to a senior colleague. Confident, terse, evidence-based, willing to say "I don't know" or "good point, that's a real weakness."

---

## The Show HN post itself (already in docs/LAUNCH.md, but repeating for context)

**Title**: `Show HN: Stakgod – Chat with Claude, ship the result to the App Store`

**Body**:
```
Hi HN, Nick here. Stakgod is an AI app builder where you describe what you
want, watch it appear in ~10s, and ship the result to the iOS App Store or
Google Play under your own Apple/Google developer account.

What makes this different from Lovable/Bolt/Hercules:

  - Every shipped app gets 16 baked-in primitives via window.sg.{...}
    (auth, db, payments, push, ai, cron, email, upload, share). No
    glue code, no BYO-Supabase, no "you wire it up."

  - Real App Store submission, not just a web preview. xcodegen +
    xcodebuild + altool inside a GitHub Actions macOS runner, signed
    under the user's own Apple Developer account (Guideline 4.2.6
    compliant). TestFlight in ~60s, Play Internal Testing too.

  - Real-time multi-cursor collab via Cloudflare Durable Objects (one
    DO per app_id, WebSocket fanout).

  - Marketplace: builders set a fork price, Stripe Connect routes 80%
    to them, 20% to us.

  - MIT licensed end-to-end: https://github.com/heitkampnick23-art/stackgod

  - Built on Cloudflare Workers + D1 + R2 + Workers AI + Durable Objects
    + Queues. Zero AWS. Free tier is small (5 messages/day) because
    inference costs are real.

Try it: https://stakgod.com
Source: https://github.com/heitkampnick23-art/stackgod

Happy to dig into any of the architecture in the comments.
```

**Hunter's first comment (post immediately after main post, on your own thread)**:
```
A few implementation things I think are interesting:

Web push: implemented RFC 8030 + 8291 + 8292 from scratch in ~200
lines using only WebCrypto. ECDH P-256 → HKDF → AES-128-GCM payload
encryption + ES256 JWT signing. Zero deps. Source:
github.com/heitkampnick23-art/stackgod/blob/main/apps/apps-worker/src/lib/webpush.ts

Model router: every chat request gets routed across Haiku 4.5 /
Sonnet 4.6 / Opus 4.7 based on the prompt category and the user's
plan. Free tier is Haiku-first; Pro defaults to Sonnet; Studio gets
Opus for hard problems. Saves us ~60% on inference costs vs always-
Opus, no visible quality drop because the routing is per-task.

Per-app keystores (Android): generated once on first build, AES-256-
GCM encrypted at rest in R2, retrieved + decrypted in the macOS
runner. Means updates aren't blocked by "different signing cert"
errors, which is the #1 thing that breaks BYO-CI-for-mobile setups.

Happy to talk about any of these in detail.
```

---

## 🥇 "Yet another AI app builder"

> Fair. The wrapper-around-Claude critique is valid for ~80% of this category. What's specifically different about Stakgod:
>
> The Claude calls are ~20% of the system. The rest is:
> - Web push from scratch (RFC 8030+8291+8292 in WebCrypto, zero deps)
> - Durable Objects fanout for real-time cursor collab
> - GitHub Actions macOS runner that actually xcodebuild + altool's to TestFlight
> - Per-app KV-backed mini-backend served at the edge (`/__api__/*`)
> - HMAC build tokens for CI↔API auth
> - Stripe Connect Express with 80/20 marketplace split
> - All-Cloudflare stack (Workers + D1 + R2 + KV + DO + Queues + AI)
>
> If "chat-to-app" felt like the moat I'd agree this is yet another. The moat IMO is the App Store submission flow + the 16 backend primitives auto-injected into every shipped app — that's where competitors stop.

---

## 🥇 "How is this not a security nightmare?"

> Good question. Specifics:
>
> 1. **User-built apps run in iframes with `sandbox="allow-scripts allow-same-origin"`** on `apps.stakgod.com` — separate origin from `stakgod.com` so cookies/localStorage are isolated.
> 2. **Apple Developer credentials** are stored AES-256-GCM-encrypted in R2, keyed by per-user secrets, only decrypted server-side at build time inside an ephemeral GitHub Actions runner that's destroyed after each build.
> 3. **Per-user app data isolation**: D1 row-level filter on every query (`WHERE user_id = ?`), KV namespaced with the slug, R2 keyed by `{user_id}/{app_id}/...`.
> 4. **Magic-link auth + Sign in with Apple/Google + WebAuthn**: passwords never touch our infra. Magic-link KV entry expires in 15 min.
> 5. **CSP** on the builder UI restricts inline scripts; CSRF protection on state-changing requests via SameSite=Lax cookies.
>
> The biggest residual risk: user-generated HTML in shipped apps can XSS itself (their app, their data). We don't sanitize because it's their domain — same model as Vercel/Netlify.

---

## 🥇 "Why Cloudflare?"

> Three concrete reasons:
>
> 1. **Edge co-location of compute + storage.** D1 + R2 + KV are accessed from the *same machine* that handled the HTTP request. P99 latency is single-digit ms. AWS Lambda + RDS round-trip is 100-500ms.
> 2. **Cost model**. Workers free tier = 100k requests/day, paid is $5/10M requests. D1 is $5/25 billion reads/month. R2 is $0.015/GB/month with zero egress. For a 10k-user SaaS, our infrastructure bill is <$300/month. On Vercel + Supabase + S3 the same workload is $1.5k+.
> 3. **One bill, one vendor**: Workers + Pages + D1 + R2 + KV + DOs + Queues + Workers AI = single CF invoice. Operational simplicity matters for a solo founder.
>
> Real trade-off: D1 is smaller than Postgres, and DOs have learning curves. We hit the D1 size limit on per-app analytics (10GB cap per DB) and shard by app for that. Honest about it.

---

## 🥇 "I tried Lovable/Bolt/v0 and it broke"

> Genuine answer: those are great tools that hit the wall at "real auth + real DB + real payments + real deploy + real App Store." The wall is *production*, not generation.
>
> Stakgod's bet is that the value is in the part *after* "the AI wrote some code" — the SDK that auto-injects 16 backend primitives so the generated code actually works, the GitHub Actions runner that signs and ships, the Stripe Connect that routes payments. That's 80% of the codebase.
>
> If you try it and hit a wall, please tell me what specifically. I'm here all day.

---

## 🥇 "Why open source?"

> Three reasons:
>
> 1. **Trust** — if you're going to put your Apple Developer credentials in our infra, you should be able to read the code that handles them.
> 2. **The moat is not the code.** The moat is real-time response (5 min comment replies), willingness to ship LIVE from day one, and brand. None of those are GitHub-stealable.
> 3. **Contributions** — already getting MIT-license pull requests for the connector registry. Solo founder needs all the help available.
>
> Honest about the risk: someone could 100% take the source and run their own Stakgod. They'd have to also be willing to run a Cloudflare account, an Anthropic billing relationship, a Stripe Connect platform application, an Apple Developer enterprise program, etc. The non-code moat is wider than people think.

---

## 🥇 "How much does inference cost you per user?"

> Real numbers from yesterday's logs (~80 users, 600 messages):
>
> - Avg input tokens per message: 12,400 (large because we pass conversation history + current deployed HTML for context)
> - Avg output tokens per message: 4,200
> - Sonnet 4.6 pricing: $3/M in + $15/M out
> - **Per-message cost: ~$0.10**
> - **Per-user/day at 5 free messages: ~$0.50**
>
> If we gave 100 messages free, we'd lose $10/user/day. So the 5/day cap is not stingy — it's solvent. Pro plan ($49/mo) at 1500 messages/mo costs us ~$150 in inference, so we run at a small loss on heavy users (margin recovered via marketplace fees + domain markup).

---

## 🥇 "How does App Store submission actually work?"

> Step-by-step:
>
> 1. User connects Apple Developer account once via `/dashboard/connect-apple`. Form takes their App Store Connect API key ID, issuer ID, and private key (.p8 file content). We AES-256-GCM-encrypt with `ENCRYPTION_KEY` (base64 32 bytes from Workers Secret), store in `developer_credentials` D1 table.
> 2. User clicks "Ship to TestFlight" on any app.
> 3. Workers issues an HMAC-signed one-time build token, then `workflow_dispatch` to our GH Actions iOS workflow with `app_id`, `token`, `api_url`.
> 4. macos-15 runner pulls the build, calls back to `/builds/:id/manifest?token=...` to fetch the generated SwiftUI source + asset bundle + decrypted ASC key.
> 5. `xcodegen` generates the .xcodeproj from `project.yml`.
> 6. `xcodebuild -archive` → `xcodebuild -exportArchive` produces signed .ipa.
> 7. `altool --upload-package` (with --apiKey + --apiIssuer) uploads to App Store Connect.
> 8. ASC processes the binary (~5-10 min), it appears in TestFlight under the user's account.
>
> Builds typically finish in 8-12 min wall-clock. Source for all of this: `apps/api/src/queue/build-consumer.ts` and `.github/workflows/ios-build.yml`.

---

## 🥇 "What happens if you go out of business?"

> Real answer: open source MIT, so you can self-host. The generated HTML for your apps is in R2 — you can `wrangler r2 object get` everything in 30 seconds. Custom domains you bought through us are registered to *you* directly with Cloudflare (we never owned them).
>
> If we vanished tomorrow:
> - Your apps keep serving until your CF account expires
> - Your iOS apps keep being downloadable from the App Store (it's under your Apple account, not ours)
> - Your Stripe payments keep flowing direct-to-your-bank (Stripe Connect, not us-as-merchant)
> - Your domain keeps resolving (it's at CF Registrar under your account)
>
> The only thing you lose: the chat UI to make new changes. And the marketplace.

---

## 🥇 "Why not just use Replit/CodeSandbox + Claude?"

> Good question. You absolutely can! The reason Stakgod exists:
>
> - **Time-to-first-real-deploy** in Replit is ~20 min (sign up, pick stack, configure DB, get deploy URL working). On Stakgod it's ~10s.
> - **App Store submission** in Replit requires you to download the code, set up Xcode locally, configure signing, archive, upload. Stakgod automates all that in a GitHub Actions runner.
> - **Backend primitives** in Replit require you to wire Postgres + auth + payments yourself. Stakgod auto-injects them.
>
> If you're a developer who'd rather click 50 buttons to learn the stack — Replit is the right tool. If you'd rather type a sentence and have the App Store submission be the last button you click — Stakgod is.

---

## 🥇 "Pricing seems aggressive"

> Acknowledged. 5 messages/day free is *very* tight. Reasoning:
>
> - Each message costs us ~$0.10 in Sonnet inference. Free-forever 100/day = $10/user/day loss.
> - Pro $49/mo @ 1500 msgs costs us ~$150 in inference + ~$1 in CF + Stripe fees. We lose ~$102/Pro user/month on inference alone if they max out.
> - We make it back via: 80% of users don't max out (avg is ~400 msgs/mo, $40 cost vs $49 revenue, $9/user margin), marketplace fees (20% of paid forks), domain markup ($1 flat).
>
> Math is tight. The bet: a small free tier finds product-market fit faster than a generous one that bleeds cash.

---

## 🥇 The negative / dismissive comment

> Generic structure when someone says "this is over-engineered" / "Anthropic is going to eat this" / "nobody needs this":
>
> > Fair point that [restate their critique]. The specific gap I'm trying to close is [one sentence]. I might be wrong about the size of that gap — what's your bear case?

---

## ⛔ DO NOT

- **Don't** "Show HN" twice. One post per launch.
- **Don't** use marketing words. HN auto-detects them: "revolutionary", "game-changing", "next-gen", "powered by AI".
- **Don't** post links to your tweets/PH page from HN comments. HN crowd hates the cross-promotion.
- **Don't** edit your top comment after publishing (visible to all). Reply with corrections instead.
- **Don't** complain about getting flagged. Just keep replying substantively.
- **Don't** delete negative threads. Engage.

## ⚡ HN-specific tips

- Post Show HN at **6am PT on a weekday**. Sunday at 6am PT works because we already scheduled.
- Have a working demo URL. HN people click immediately.
- First commenter on your own thread is usually the most-read after the post body. Use it for technical depth.
- Respond to negative comments first (they get visible). Then sort to controversial.
- HN crowd loves: technical detail, honest costs, vendor honesty, "I don't know" answers.
- HN crowd hates: marketing speak, FOMO language, fake humility, "anyone interested in beta access?", emoji in posts.

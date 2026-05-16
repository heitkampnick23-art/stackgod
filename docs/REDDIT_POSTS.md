# Reddit Launch Posts — Sun May 17

5 posts, 5 subreddits, 5 different angles. **Do NOT shotgun the same body.**
Reddit hates cross-posting; the mods will nuke you. Space them ~90 min apart.

> **Universal rules:**
> - Never link the same post twice in different subs
> - Reply to every comment in <15 min for the first 4 hours
> - Don't put `stakgod.com` in the title — put it once in the body
> - Don't ask for upvotes. Anywhere. Ever.
> - First comment on your own thread should be technical depth (drives engagement)

---

## 1. r/SideProject — angle: "what I built in 3 weeks"

**Post at**: 10:00 AM PT
**Title**: I spent 3 weeks building an open-source Lovable that ships to the App Store
**Flair**: Show & Tell
**Body**:

```
3 weeks ago I was tired of every AI app builder giving me a chat box
and then leaving me to wire up auth, payments, push notifications,
and "oh you actually wanted to ship to iOS?" as separate problems.

So I built one that does the whole thing in one chat.

→ stakgod.com (MIT, GitHub link in comments)

What it does that competitors don't:

1. Every shipped app gets 16 backend primitives auto-injected as
   window.sg.{auth, db, payments, ai, push, cron, email, ...}.
   No glue code. The generated HTML just works.

2. One button ships your app to TestFlight under your OWN Apple
   Developer account (Guideline 4.2.6 compliant — not a template app).
   Real xcodebuild + altool, takes ~10 min wall-clock.

3. Real-time multi-cursor collab via Cloudflare Durable Objects.

4. Marketplace where you set a fork price (you get 80%, we take 20%
   via Stripe Connect).

The whole stack is Cloudflare (Workers + D1 + R2 + KV + DOs + Queues
+ Workers AI). Free tier is intentionally tight (5 messages/day)
because Claude inference actually costs money — I made the numbers
work without burning VC.

Built solo, 3 weeks, 100% in production from day one. Would love
brutal feedback.
```

**First own-comment** (post 30s after): 
```
Source: https://github.com/heitkampnick23-art/stackgod

Happy to dig into any specific architecture question — the web push
implementation (RFC 8030+8291+8292 from scratch in WebCrypto) and the
per-app keystore handling for Android were probably the hardest bits.
```

---

## 2. r/SaaS — angle: "honest economics of an AI SaaS"

**Post at**: 11:30 AM PT
**Title**: Launched my AI SaaS today. Sharing the actual unit economics (per-message costs, free tier math, why $19/mo)
**Body**:

```
I launched Stakgod today (AI app builder that ships to App Store +
Play). Wanted to share the actual numbers because every AI SaaS post
I read seems to skip them.

PER-MESSAGE COSTS:
  - Avg input tokens: 12,400 (we pass conversation history + current
    deployed HTML as context, that adds up)
  - Avg output tokens: 4,200
  - Sonnet 4.6 pricing: $3/M in + $15/M out
  - → ~$0.10 per chat message

FREE TIER MATH:
  - 5 messages/day free
  - At full use that's $0.50/free-user/day = $15/month cost to us
  - If we gave 100/day free we'd hemorrhage $300/free-user/month

PAID PLAN ECONOMICS:
  - Hobby $19/mo: 200 msgs = ~$20 cost. -$1 margin. Loss leader.
  - Pro $49/mo: 1,500 msgs = ~$150 cost. -$101 margin on max users
    BUT avg is ~400 msgs = $40 cost = $9 margin. Most users don't max.
  - Studio $149/mo: 6,000 msgs (Opus heavy) = ~$600 cost. -$451 margin
    on max users. Only sustainable because <5% of users will max.

OTHER REVENUE:
  - 20% application_fee on marketplace fork sales (Stripe Connect)
  - $1 flat markup on Cloudflare Registrar domains (~$11.77 on .com)

Why I'm posting this: the "free forever" race in AI SaaS is going
to bankrupt half the category. Pricing honesty + reasonable margins
> generous free tiers + Series A.

Site: stakgod.com (MIT licensed, source on GH)
```

---

## 3. r/ChatGPTCoding — angle: "the 16 primitives Claude builds with"

**Post at**: 1:00 PM PT
**Title**: I made it so Claude has 16 backend primitives baked into every app it ships
**Body**:

```
The thing I kept hitting with Claude-as-coder: it can write the
frontend in 10 seconds but then the user (or me) has to wire up
Supabase, Stripe, Resend, push notifications, etc. before the app
does anything real.

Solution: instead of telling Claude "write a habit tracker, then I'll
add auth later," I built a serving layer that auto-injects 16 backend
primitives into every shipped HTML page as `window.sg.*`.

Claude's system prompt now includes:

  sg.auth.{signIn, signOut, user, requireSignIn}
  sg.db.{get, set, list, delete}              ← KV-backed per-app DB
  sg.ai.{chat, stream, image}                 ← Claude calls from your app
  sg.payments.{checkout, link, listSubs}      ← Stripe Connect routes 80% to builder
  sg.push.{subscribe, send}                   ← RFC 8030+8291+8292 web push
  sg.email.send                                ← Resend-backed
  sg.upload                                    ← R2 with public URL
  sg.geo                                       ← CF Worker geo data
  sg.cron, sg.queue                           ← Both backed by CF scheduled+queues
  sg.share, sg.embed                          ← OG + iframe-embed helpers

So when a user says "add sign-in to my habit tracker," Claude doesn't
write 200 lines of auth code — it writes 1 line: `await sg.auth.signIn()`.

Side effect: generated apps are now 4-8x smaller (less code = fewer
bugs = faster).

Site: stakgod.com (open source, MIT)

Curious if anyone's tried similar SDK-injection approaches with other
LLMs — would love to compare notes on prompt design.
```

---

## 4. r/webdev — angle: "what I learned building all-Cloudflare"

**Post at**: 3:00 PM PT
**Title**: I built a SaaS entirely on Cloudflare (no AWS, no Vercel, no Supabase). Here's what worked, what didn't.
**Body**:

```
Built and launched stakgod.com — an AI app builder. Decided early to
go 100% Cloudflare and skip Vercel/AWS/Supabase entirely. Three weeks
in, here's the honest tally:

WORKED GREAT:
- Workers + D1 + R2 colocated = single-digit ms p99 reads. AWS
  Lambda + RDS is 100-500ms.
- DOs for real-time multi-cursor collab — one DO per app_id,
  WebSocket fanout for cursor/presence/typing. Way simpler than
  redis-pubsub setup.
- Pages deploys are fast (~30s) and free. next-on-pages bridges
  Next.js 15 cleanly.
- KV for session+rate-limit cache. <5ms reads at the edge.
- Workers AI for image generation (Flux Schnell) and embeddings.
  Cheap and bundled in the same bill.
- $5/month base + ~$0.001/active-user. Vercel + Supabase same load
  would be $200+/mo.

WHAT WAS HARDER:
- D1 has a 10GB-per-database cap. Had to shard analytics per app.
- DO bindings + naming feels clunky compared to plain functions.
- Some npm packages don't run on Workers runtime (e.g. anything
  using `node:crypto` directly). Had to implement RFC 8030+8291
  web push in raw WebCrypto.
- Wrangler error messages can be cryptic.
- Pages Functions can be slow to deploy if you have a big build
  (next-on-pages bundle is ~960KB compressed).

WHAT I'D DO AGAIN:
- 100%. Once you stop fighting it and learn the primitives, the
  cost + latency wins are absurd.

Site: stakgod.com (open source, MIT, full source on GH).
```

---

## 5. r/IndieDev — angle: "ship-to-App-Store flow"

**Post at**: 4:30 PM PT
**Title**: AMA: I built a flow that submits iOS apps to TestFlight from a chat message
**Body**:

```
Background: I'm Nick, building stakgod.com. The thing I'm proudest
of: making "ship to the App Store" a single button click after typing
your app idea.

How it works step-by-step:

1. User connects their Apple Developer account ONCE via a dashboard
   form (App Store Connect API key ID, issuer ID, .p8 private key).
   We AES-256-GCM-encrypt and store in our DB.

2. User builds an app via chat with Claude. It deploys to a web URL
   in ~10s.

3. User clicks "🍎 Ship to TestFlight."

4. Our Worker signs a one-time HMAC build token, hits GitHub's
   workflow_dispatch API on our macOS GHA workflow with the app_id,
   token, and api_url.

5. The macOS runner pulls the build manifest (Swift source + assets +
   decrypted ASC key) from our API.

6. xcodegen generates the .xcodeproj from project.yml. xcodebuild
   archives + signs. altool uploads to App Store Connect.

7. ASC processes the IPA. ~5-10 min later it's in TestFlight under
   the USER'S Apple Developer account (not ours — Apple Guideline
   4.2.6 compliance).

Total time from click to TestFlight: ~10 minutes.
Total time from "I have an idea" to TestFlight: ~12 minutes.

If anyone wants to see the implementation, it's all open source:
https://github.com/heitkampnick23-art/stackgod/tree/main/.github/workflows

AMA on anything App Store / IndieDev / solo founder.
```

---

## 🪝 Comment-thread expansion templates

When a Reddit thread is going well (5+ comments in 30 min), drop ONE of these
mid-thread to keep the conversation alive:

> **"What surprised me building this"**
> The thing nobody tells you about App Store submission: Apple's Guideline 4.2.6 explicitly rejects "templated apps with minimal customization." So you literally cannot have a service that submits 100 apps from your own dev account — each user has to bring their own. That constraint shaped the whole arch.

> **"The cost honesty"**
> Just to put real numbers on this: every chat message in Stakgod costs me ~$0.10 in Anthropic API fees. At 5 free messages/day per user × 100 free users = $50/day burned just keeping freeloaders happy. Hence the small free tier — solvency over virality.

> **"Why MIT not source-available"**
> Pure paranoia about Vercel doing what they did to Remix. If someone wants to fork Stakgod and run it, MIT lets them. The moat is community + speed-of-iteration + brand, not code secrecy.

---

## ⛔ Subreddits to AVOID

- r/programming → no self-promotion, will be auto-removed
- r/javascript → same
- r/Entrepreneur → low signal, mostly people asking for "honest feedback" on landing pages
- r/startups → too many karma-mining bots, your post will drown
- r/SaaSGrowthHacks → spam city

## 🎯 Subreddits to also try (lower-priority, only if launch day's going well)

- r/HostingTips (if domain story resonates)
- r/SwiftUI (if iOS angle gets traction)
- r/cloudflare (CF community loves their own stack)
- r/Cloudflare (yes, both — different mods)

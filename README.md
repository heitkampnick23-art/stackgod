# Stakgod

> **Speak it. Ship it. Own it.** — AI app builder on Cloudflare.

[![Live](https://img.shields.io/badge/live-stakgod.com-ff5b1f?style=flat-square)](https://stakgod.com)
[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/heitkampnick23-art/stackgod)
[![License: MIT](https://img.shields.io/badge/license-MIT-d4af37?style=flat-square)](LICENSE)

Stakgod is a chat-to-app builder, like Lovable / Bolt / Hercules — but every app you ship gets **16 baked-in BaaS primitives** (auth, db, AI, payments, push, file uploads, geo, email, cron, queue, share, embed) auto-injected as `window.sg`. Zero setup, zero SDKs. Plus full **TestFlight + Play submission pipelines** with auto-generated Flux app icons.

## What you get out of the box

```js
// In any app a user builds via chat — these all just exist:
await sg.auth.signIn(email)              // magic link via Resend
await sg.db.put('habit:1', { streak: 5 })// per-app KV, multi-user
await sg.ai.chat({ messages })           // Claude with builder-quota
await sg.ai.image({ prompt })            // Workers AI Flux
await sg.payments.checkout({ items })    // Stripe Connect, 80/20 split
await sg.upload(file)                    // public R2 URL
await sg.email.send({ to, subject, html })
await sg.notify.subscribe()              // real web push (RFC-8291)
await sg.notify.broadcast({ title })
await sg.cron.add({ schedule: '@daily', action })
await sg.queue.enqueue({ delay_seconds: 300, action })
await sg.share({ title, text, url })
sg.embed({ width: '100%', height: 640 }) // copy-paste iframe snippet
const g = await sg.geo()                 // visitor city/country/lat/lon
```

## Architecture

```
                   ┌────────────────────────┐
                   │   Cloudflare Pages     │   apps/web (Next.js 15)
                   │   stakgod.com          │   landing, /build, /dashboard,
                   └───────────┬────────────┘   /discover, /pricing, /support
                               │
            ┌──────────────────┼──────────────────┐
            ▼                  ▼                  ▼
     ┌─────────────┐    ┌────────────┐    ┌───────────────────┐
     │ stackgod-api│    │stackgod-apps│   │stackgod-apps-data │
     │api.stakgod  │    │apps.stakgod │   │   (R2 + KV)       │
     │   .com      │    │  .com/{slug}│   └───────────────────┘
     └──────┬──────┘    └──────┬─────┘
            │                  │
   ┌────────┴────────┐    ┌────┴─────────────────────────────┐
   │ Anthropic       │    │ sg.* primitives served per-app:  │
   │ Stripe Connect  │    │  /__api__/{db,auth,ai,payments,  │
   │ Resend          │    │   upload,email,geo,notify,cron,  │
   │ CF Registrar    │    │   queue,share,embed}             │
   │ ASC + Play API  │    └──────────────────────────────────┘
   └─────────────────┘
            │
            ▼
   ┌──────────────────────────┐
   │ Cloudflare D1 (stackgod) │   users, apps, sessions, usage_events,
   │ KV: SESSIONS, APP_DATA,  │   builds, fork_purchases, tips, grants
   │     APP_HOSTS            │
   │ R2: stackgod-apps,       │
   │     stackgod-artifacts   │
   │ Queues: stackgod-builds  │
   └──────────────────────────┘
            │
            ▼
   ┌──────────────────────────┐
   │ GitHub Actions runners   │   ios-build.yml (macos-15) +
   │ render template + sign + │   android-build.yml (ubuntu)
   │ TestFlight / Play upload │   per-user keystores in R2
   └──────────────────────────┘
```

## Self-host on your own Cloudflare account

The easy path is the **Deploy to Cloudflare** button above (creates the worker; you wire the rest).
The full self-host:

```bash
# 1. Clone + install
git clone https://github.com/heitkampnick23-art/stackgod
cd stackgod
npm install

# 2. Create CF resources (D1 + KV + R2 + Queue)
cd apps/api
npx wrangler d1 create stackgod
npx wrangler kv namespace create SESSIONS
npx wrangler kv namespace create APP_DATA
npx wrangler kv namespace create APP_HOSTS
npx wrangler r2 bucket create stackgod-apps
npx wrangler r2 bucket create stackgod-artifacts
npx wrangler queues create stackgod-builds
# paste the printed IDs into apps/api/wrangler.toml + apps/apps-worker/wrangler.toml

# 3. Apply schema + migrations
npx wrangler d1 execute stackgod --remote --file=../../infra/d1/schema.sql
for m in ../../infra/d1/migrations/*.sql; do npx wrangler d1 execute stackgod --remote --file="$m"; done

# 4. Set required worker secrets
for k in ANTHROPIC_API_KEY STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET RESEND_API_KEY \
         ENCRYPTION_KEY BUILD_TOKEN_SECRET GH_PAT GH_REPO \
         APPLE_CLIENT_ID APPLE_TEAM_ID APPLE_KEY_ID APPLE_PRIVATE_KEY \
         GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET \
         VAPID_PUBLIC_KEY VAPID_PRIVATE_KEY VAPID_SUBJECT; do
  npx wrangler secret put "$k"
done
cd ../apps-worker && npx wrangler secret put ANTHROPIC_API_KEY  # … (same set on apps-worker)

# 5. Deploy all three
npx wrangler deploy                      # apps/apps-worker
cd ../api && npx wrangler deploy
cd ../web && npm run build && npx @cloudflare/next-on-pages && \
  npx wrangler pages deploy .vercel/output/static --project-name=stackgod-web
```

## What's where

```
apps/web/             Next.js 15 (Cloudflare Pages) — landing + builder + dashboard
apps/api/             Hono on Workers (api.stakgod.com)
apps/apps-worker/     Worker that serves user-built apps + the sg.* mini-backend
apps/codegen-ios/     SwiftUI shell + render.sh (icon resize via sips)
apps/codegen-android/ Kotlin/Compose-less shell + render.sh (icon resize via ImageMagick)
infra/d1/             schema.sql + migrations/
infra/templates/      Seeded starter apps (habit-tracker, link-in-bio, tip-jar, newsletter, mentor)
.github/workflows/    deploy.yml (manual), ios-build.yml, android-build.yml
```

## License

MIT — fork it, sell it, white-label it. The hosted version at stakgod.com is operated by Stakgod, Inc.

## Comparison

|                                                | **Stakgod** | Lovable | Bolt | Hercules |
|------------------------------------------------|-------------|---------|------|----------|
| Backend primitives baked into shipped apps     | **16**      | 0       | 0    | ~5       |
| In-app Claude (chat / stream / image)          | **✓**       | ✗       | ✗    | ✗        |
| Server-sent web push (RFC-8291)                | **✓**       | ✗       | ✗    | ✗        |
| AI-generated app icons (auto)                  | **✓ Flux**  | ✗       | ✗    | ✗        |
| Marketplace: builders sell paid forks          | **✓ 80/20** | ✗       | ✗    | ✗        |
| Ship to App Store + Play                       | **✓**       | ✗       | ✗    | ✓        |
| Open source                                    | **✓ MIT**   | ✗       | partial | ✗     |

See https://stakgod.com for the full comparison.

## Built with

[Cloudflare Workers + Pages](https://workers.cloudflare.com) · [D1](https://developers.cloudflare.com/d1) · [R2](https://developers.cloudflare.com/r2) · [KV](https://developers.cloudflare.com/kv) · [Workers AI](https://developers.cloudflare.com/workers-ai) · [Queues](https://developers.cloudflare.com/queues) · [Anthropic Claude](https://anthropic.com) · [Stripe Connect](https://stripe.com/connect) · [Resend](https://resend.com) · [Hono](https://hono.dev) · [Next.js](https://nextjs.org)

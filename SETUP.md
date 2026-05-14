# Stackgod — first-time setup

Live production from day one. Run these in order.

## 1. Create Cloudflare resources
```
cd apps/api
wrangler d1 create stackgod
wrangler kv namespace create SESSIONS
wrangler r2 bucket create stackgod-artifacts
wrangler queues create stackgod-builds
```
Paste the returned IDs into `apps/api/wrangler.toml` (replace `PLACEHOLDER_*`).

## 2. Apply schema (LIVE)
```
wrangler d1 execute stackgod --remote --file=../../infra/d1/schema.sql
```

## 3. Live secrets (Workers)
```
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put STRIPE_SECRET_KEY              # sk_live_...
wrangler secret put STRIPE_WEBHOOK_SECRET          # whsec_...
wrangler secret put CF_API_TOKEN_REGISTRAR         # token with Account.Domain.Edit
wrangler secret put RESEND_API_KEY                 # re_...
wrangler secret put SESSION_SECRET                 # 64 random hex
wrangler secret put APPLE_CLIENT_ID
wrangler secret put APPLE_TEAM_ID
wrangler secret put APPLE_KEY_ID
wrangler secret put APPLE_PRIVATE_KEY
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
```

## 4. Stripe (LIVE) — create products
```
stripe products create --name="Stackgod Hobby"  --default-price-data="{ recurring: { interval: month }, unit_amount: 1900, currency: usd }"
stripe products create --name="Stackgod Pro"    --default-price-data="{ recurring: { interval: month }, unit_amount: 4900, currency: usd }"
stripe products create --name="Stackgod Studio" --default-price-data="{ recurring: { interval: month }, unit_amount: 14900, currency: usd }"
```
Paste the `price_…` IDs into `apps/api/src/routes/billing.ts` `PRICE_IDS`.

## 5. Stripe webhook
Add endpoint at https://api.stakgod.com/billing/webhook for events:
- checkout.session.completed
- customer.subscription.{created,updated,deleted}
- payment_intent.succeeded

## 6. CF Pages project
```
cd apps/web
npx @cloudflare/next-on-pages@latest
wrangler pages project create stackgod-web --production-branch=main
wrangler pages deploy .vercel/output/static --project-name=stackgod-web --branch=main
```
Then in CF dash: Pages → stackgod-web → Custom domains → add `stakgod.com` and `www.stakgod.com`.

## 7. Worker route for API
Already declared in `apps/api/wrangler.toml`:
```
api.stakgod.com/* → stackgod-api
```
First deploy:
```
cd apps/api && wrangler deploy
```

## 8. GitHub Actions
Add secret `CLOUDFLARE_API_TOKEN` (same token used in [reference_aimirrortwin_setup.md] pattern). Push to `main` → auto-deploys both Worker and Pages.

# Stackgod

Speak it. Ship it. Own it. — AI app builder on Cloudflare.

Live at https://stakgod.com

## Stack
- Next.js 15 (Cloudflare Pages) — `apps/web`
- Hono on Cloudflare Workers — `apps/api`
- D1 (auth, usage ledger, apps, subs) — `infra/d1/schema.sql`
- R2 (artifacts), Queues (build jobs), KV (sessions)
- Anthropic API (Claude Opus 4.7 / Sonnet 4.6 / Haiku 4.5) — model router in `apps/api/src/lib/model-router.ts`
- Stripe Connect Express — 10% application_fee
- Cloudflare Registrar API — domains at near-cost + $1 platform fee

## Strict free tier
5 AI messages/day. Hard 402 wall. See `apps/api/src/middleware/credits.ts`.

## Deploy
```
pnpm i
pnpm -C apps/api wrangler deploy
pnpm -C apps/web build && pnpm -C apps/web wrangler pages deploy .vercel/output/static
```

GH Actions deploy on push to `main` (uses `CLOUDFLARE_API_TOKEN` secret).

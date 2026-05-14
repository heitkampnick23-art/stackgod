// First 100 Founders Fund — public donations via Stripe Checkout.
// Goal: $10,000. Every $99 buys an Apple Developer enrollment for a builder
// who shipped through Stackgod but can't afford the fee. Public ledger.

import { Hono } from 'hono';
import Stripe from 'stripe';
import type { Env, Variables } from '../types';

export const tips = new Hono<{ Bindings: Env; Variables: Variables }>();

const GOAL_CENTS = 1_000_000;     // $10,000
const COST_PER_FOUNDER_CENTS = 9_900;
const MIN_TIP_CENTS = 200;        // $2 floor — Stripe fees would eat smaller
const MAX_TIP_CENTS = 100_000;    // $1,000 ceiling per session

const stripe = (env: Env) => new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' as Stripe.LatestApiVersion });

interface CheckoutBody { amount_cents: number; supporter_name?: string; message?: string; anonymous?: boolean; }

tips.post('/checkout', async (c) => {
  const b = await c.req.json<CheckoutBody>();
  const amount = Math.round(b.amount_cents);
  if (!Number.isFinite(amount) || amount < MIN_TIP_CENTS || amount > MAX_TIP_CENTS) {
    return c.json({ error: 'amount_out_of_range', min: MIN_TIP_CENTS, max: MAX_TIP_CENTS }, 400);
  }

  const session = await stripe(c.env).checkout.sessions.create({
    mode: 'payment',
    submit_type: 'donate',
    line_items: [{
      price_data: {
        currency: 'usd',
        unit_amount: amount,
        product_data: {
          name: 'First 100 Founders Fund',
          description: 'Funds Apple Developer enrollment for a builder who shipped through Stackgod.',
        },
      },
      quantity: 1,
    }],
    success_url: `${c.env.APP_URL}/support?thx=1`,
    cancel_url: `${c.env.APP_URL}/support`,
    metadata: {
      kind: 'founders_fund_tip',
      supporter_name: (b.supporter_name ?? '').slice(0, 80),
      message: (b.message ?? '').slice(0, 280),
      anonymous: b.anonymous ? '1' : '0',
    },
  });
  return c.json({ url: session.url });
});

tips.get('/stats', async (c) => {
  // Compute totals from tips table; fallback to 0 when table empty / unmigrated.
  let raised = 0; let count = 0;
  try {
    const row = await c.env.DB.prepare(
      `SELECT COALESCE(SUM(amount_cents),0) as raised, COUNT(*) as count FROM tips`
    ).first<{ raised: number; count: number }>();
    raised = row?.raised ?? 0;
    count = row?.count ?? 0;
  } catch {}

  let recent: Array<{ name: string; amount_cents: number; message: string | null; ts: number }> = [];
  try {
    const r = await c.env.DB.prepare(
      `SELECT supporter_name as name, amount_cents, message, ts, anonymous
       FROM tips ORDER BY ts DESC LIMIT 12`
    ).all<{ name: string | null; amount_cents: number; message: string | null; ts: number; anonymous: number }>();
    recent = (r.results ?? []).map((t) => ({
      name: t.anonymous || !t.name ? 'Anonymous' : t.name,
      amount_cents: t.amount_cents,
      message: t.message,
      ts: t.ts,
    }));
  } catch {}

  let grants: Array<{ handle: string; app_url: string | null; kind: string; ts: number }> = [];
  try {
    const r = await c.env.DB.prepare(
      `SELECT recipient_handle as handle, app_url, kind, ts FROM grants ORDER BY ts DESC LIMIT 12`
    ).all<{ handle: string; app_url: string | null; kind: string; ts: number }>();
    grants = r.results ?? [];
  } catch {}

  return c.json({
    goal_cents: GOAL_CENTS,
    cost_per_founder_cents: COST_PER_FOUNDER_CENTS,
    raised_cents: raised,
    supporters: count,
    founders_funded: Math.floor(raised / COST_PER_FOUNDER_CENTS),
    pct: Math.min(100, +(raised / GOAL_CENTS * 100).toFixed(2)),
    recent,
    grants,
  });
});

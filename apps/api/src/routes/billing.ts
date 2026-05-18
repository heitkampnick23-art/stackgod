// Stripe billing for Stackgod tiers + Connect Express for builders.
// LIVE keys only.

import { Hono } from 'hono';
import Stripe from 'stripe';
import type { Env, Variables } from '../types';
import { requireAuth } from '../middleware/auth';
import { PLANS, type Plan } from '../lib/plans';

export const billing = new Hono<{ Bindings: Env; Variables: Variables }>();

const stripe = (env: Env) => new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' as Stripe.LatestApiVersion });

// LIVE price IDs (Stripe acct_1S40wDQu1YpWmfU0 / SUMHEAD)
export const PRICE_IDS = {
  hobby:  { month: 'price_1TX0MMQu1YpWmfU0SsoaTL8F', year: 'price_1TX0MPQu1YpWmfU0ba05E6me' },
  pro:    { month: 'price_1TX0MSQu1YpWmfU04UUr0Ffb', year: 'price_1TX0MVQu1YpWmfU0mM5ma35D' },
  studio: { month: 'price_1TX0MeQu1YpWmfU0Em6VEuBH', year: 'price_1TX0MhQu1YpWmfU0XzppgklY' },
} as const;

type Cycle = 'month' | 'year';

billing.post('/checkout', requireAuth, async (c) => {
  const user = c.get('user')!;
  // Accept any string here so we can validate at runtime — clients lie about types.
  const { plan, cycle = 'month' } = await c.req.json<{ plan: Plan; cycle?: Cycle }>();
  if (!PLANS[plan] || plan === 'free') return c.json({ error: 'invalid_plan' }, 400);
  if (cycle !== 'month' && cycle !== 'year') return c.json({ error: 'invalid_cycle' }, 400);

  const s = stripe(c.env);
  let customerId = user.stripe_customer_id;
  if (!customerId) {
    const cust = await s.customers.create({ email: user.email, metadata: { user_id: user.id } });
    customerId = cust.id;
    await c.env.DB.prepare(`UPDATE users SET stripe_customer_id=? WHERE id=?`).bind(customerId, user.id).run();
  }
  const session = await s.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: PRICE_IDS[plan][cycle], quantity: 1 }],
    success_url: `${c.env.APP_URL}/dashboard?upgraded=${plan}`,
    cancel_url: `${c.env.APP_URL}/pricing`,
    allow_promotion_codes: true,
    // No trial period — charge immediately on subscribe.
  });
  return c.json({ url: session.url });
});

billing.post('/connect/onboard', requireAuth, async (c) => {
  const user = c.get('user')!;
  const s = stripe(c.env);
  let acct = user.stripe_connect_account_id;
  if (!acct) {
    const a = await s.accounts.create({
      type: 'express',
      email: user.email,
      capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
      metadata: { user_id: user.id },
    });
    acct = a.id;
    await c.env.DB.prepare(`UPDATE users SET stripe_connect_account_id=? WHERE id=?`).bind(acct, user.id).run();
  }
  const link = await s.accountLinks.create({
    account: acct,
    refresh_url: `${c.env.APP_URL}/dashboard/payouts?refresh=1`,
    return_url: `${c.env.APP_URL}/dashboard/payouts?ok=1`,
    type: 'account_onboarding',
  });
  return c.json({ url: link.url });
});

billing.post('/webhook', async (c) => {
  const sig = c.req.header('stripe-signature');
  if (!sig) return c.text('missing sig', 400);
  const raw = await c.req.text();
  const s = stripe(c.env);
  let event: Stripe.Event;
  try {
    event = await s.webhooks.constructEventAsync(raw, sig, c.env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    return c.text(`bad sig: ${e}`, 400);
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const sess = event.data.object as Stripe.Checkout.Session;
      // Founders Fund tip — record in tips ledger.
      if (sess.metadata?.kind === 'founders_fund_tip') {
        const amount = sess.amount_total ?? 0;
        if (amount > 0) {
          await c.env.DB.prepare(
            `INSERT OR IGNORE INTO tips (id, stripe_session_id, amount_cents, currency, supporter_name, supporter_email, message, anonymous)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            crypto.randomUUID(),
            sess.id,
            amount,
            sess.currency ?? 'usd',
            sess.metadata.supporter_name || null,
            sess.customer_details?.email ?? null,
            sess.metadata.message || null,
            sess.metadata.anonymous === '1' ? 1 : 0,
          ).run();
        }
        break;
      }
      // Otherwise: subscription checkout (Hobby/Pro/Studio) — falls through.
      // intentional fallthrough
    }
    case 'customer.subscription.updated':
    case 'customer.subscription.created': {
      const obj = event.data.object as Stripe.Checkout.Session | Stripe.Subscription;
      const customerId = typeof obj.customer === 'string' ? obj.customer : obj.customer?.id;
      if (!customerId) break;
      const subId = 'subscription' in obj && typeof obj.subscription === 'string' ? obj.subscription : ('id' in obj && (obj as Stripe.Subscription).items ? obj.id : null);
      const sub = subId ? await s.subscriptions.retrieve(subId) : null;
      const priceId = sub?.items.data[0]?.price.id;
      const plan: Plan =
        priceId === PRICE_IDS.studio.month || priceId === PRICE_IDS.studio.year ? 'studio' :
        priceId === PRICE_IDS.pro.month    || priceId === PRICE_IDS.pro.year    ? 'pro' :
        priceId === PRICE_IDS.hobby.month  || priceId === PRICE_IDS.hobby.year  ? 'hobby' :
        'free';
      await c.env.DB.prepare(`UPDATE users SET plan=?, stripe_subscription_id=? WHERE stripe_customer_id=?`).bind(plan, sub?.id ?? null, customerId).run();
      break;
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
      await c.env.DB.prepare(`UPDATE users SET plan='free', stripe_subscription_id=NULL WHERE stripe_customer_id=?`).bind(customerId).run();
      break;
    }
    case 'payment_intent.succeeded': {
      const pi = event.data.object as Stripe.PaymentIntent;
      const fee = pi.application_fee_amount ?? 0;
      const acct = (pi.transfer_data?.destination as string | undefined) ?? null;
      if (acct) {
        const u = await c.env.DB.prepare(`SELECT id FROM users WHERE stripe_connect_account_id=?`).bind(acct).first<{ id: string }>();
        if (u) {
          await c.env.DB.prepare(
            `INSERT OR IGNORE INTO builder_payouts (id, user_id, amount_gross_cents, application_fee_cents, currency, stripe_payment_intent)
             VALUES (?, ?, ?, ?, ?, ?)`
          ).bind(crypto.randomUUID(), u.id, pi.amount, fee, pi.currency, pi.id).run();
        }
      }
      break;
    }
  }
  return c.json({ received: true });
});

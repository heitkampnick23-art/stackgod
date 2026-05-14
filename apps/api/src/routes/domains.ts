// Cloudflare Registrar reseller wrapper.
// CF Registrar charges wholesale; we add a flat $1 platform fee at checkout.
// Note: full programmatic registration via CF Registrar requires the user's
// CF account or our reseller program enrollment. This route handles search,
// quote, and post-purchase DNS attach to a Stackgod app.

import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { requireAuth } from '../middleware/auth';

export const domains = new Hono<{ Bindings: Env; Variables: Variables }>();

const PLATFORM_FEE_USD = 1.00;

domains.get('/search', requireAuth, async (c) => {
  const q = c.req.query('q');
  if (!q) return c.json({ error: 'missing_q' }, 400);
  const tlds = ['com', 'app', 'dev', 'io', 'ai', 'xyz', 'co'];
  // CF wholesale prices (USD/yr) — keep in sync with dash.cloudflare.com/registrar
  const wholesale: Record<string, number> = { com: 9.77, app: 13.98, dev: 11.78, io: 36.50, ai: 70.00, xyz: 9.45, co: 22.50 };
  const base = q.replace(/\.[a-z]+$/i, '').toLowerCase();
  const results = tlds.map((tld) => ({
    domain: `${base}.${tld}`,
    cost_usd: wholesale[tld],
    fee_usd: PLATFORM_FEE_USD,
    total_usd: +(wholesale[tld] + PLATFORM_FEE_USD).toFixed(2),
  }));
  return c.json({ results });
});

domains.post('/purchase', requireAuth, async (c) => {
  const user = c.get('user')!;
  const { domain, app_id } = await c.req.json<{ domain: string; app_id?: string }>();
  if (!/^[a-z0-9-]+\.[a-z]+$/.test(domain)) return c.json({ error: 'invalid_domain' }, 400);

  // 1) Charge user via Stripe for (wholesale + $1) — handled by frontend
  //    creating a one-off PaymentIntent before calling this endpoint.
  // 2) Trigger CF Registrar register call.
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/4d259cf98fff468b0108b6a80b7a10fc/registrar/domains/${domain}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${c.env.CF_API_TOKEN_REGISTRAR}`, 'content-type': 'application/json' },
    body: JSON.stringify({ name_servers: ['nina.ns.cloudflare.com', 'sean.ns.cloudflare.com'], privacy: true, auto_renew: true }),
  });
  if (!r.ok) return c.json({ error: 'registrar_failed', detail: await r.text() }, 502);
  const data = await r.json<{ result: { expires_at: string; cost: number } }>();

  await c.env.DB.prepare(
    `INSERT INTO domains (id, user_id, app_id, domain, registrar, cost_usd, fee_usd, expires_at)
     VALUES (?, ?, ?, ?, 'cloudflare', ?, ?, ?)`
  ).bind(
    crypto.randomUUID(),
    user.id,
    app_id ?? null,
    domain,
    data.result.cost,
    PLATFORM_FEE_USD,
    Math.floor(new Date(data.result.expires_at).getTime() / 1000),
  ).run();

  return c.json({ ok: true, domain, attached_app: app_id ?? null });
});

domains.get('/list', requireAuth, async (c) => {
  const user = c.get('user')!;
  const { results } = await c.env.DB.prepare(
    `SELECT domain, app_id, cost_usd, fee_usd, expires_at FROM domains WHERE user_id=? ORDER BY created_at DESC`
  ).bind(user.id).all();
  return c.json({ domains: results });
});

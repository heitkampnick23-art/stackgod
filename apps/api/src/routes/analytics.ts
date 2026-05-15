// Per-app analytics — pulls from D1 (usage_events, builder_payouts) and KV
// (views, push subs, db keys). Cached briefly via cache-control on the response.

import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { requireAuth } from '../middleware/auth';

export const analytics = new Hono<{ Bindings: Env; Variables: Variables }>();

analytics.get('/:id/analytics', requireAuth, async (c) => {
  const user = c.get('user')!;
  const id = c.req.param('id');
  const app = await c.env.DB.prepare(`SELECT id, slug, name, created_at FROM apps WHERE id=? AND user_id=?`)
    .bind(id, user.id).first<{ id: string; slug: string; name: string; created_at: number }>();
  if (!app) return c.json({ error: 'not_found' }, 404);

  const now = Math.floor(Date.now() / 1000);
  const startOfMonth = Math.floor(new Date(new Date().toISOString().slice(0, 7) + '-01').getTime() / 1000);
  const startOfDay   = Math.floor(new Date(new Date().toISOString().slice(0, 10)).getTime() / 1000);

  // KV-side: views totals + last 14 days, push subscriber count, db key count.
  const today = new Date().toISOString().slice(0, 10);
  const [viewsTotal, viewsToday, dailyViewsList, subList, dbKeyList] = await Promise.all([
    c.env.APP_DATA.get(`appviews:${app.slug}:total`),
    c.env.APP_DATA.get(`appviews:${app.slug}:d:${today}`),
    c.env.APP_DATA.list({ prefix: `appviews:${app.slug}:d:`, limit: 30 }),
    c.env.APP_DATA.list({ prefix: `appsub:${app.slug}:`, limit: 1000 }),
    c.env.APP_DATA.list({ prefix: `app:${app.slug}:`, limit: 1000 }),
  ]);
  const dailyViews: Array<{ d: string; n: number }> = [];
  for (const k of dailyViewsList.keys.sort((a, b) => a.name.localeCompare(b.name)).slice(-14)) {
    const v = await c.env.APP_DATA.get(k.name);
    dailyViews.push({ d: k.name.slice(-10), n: Number(v ?? '0') || 0 });
  }

  // D1-side: AI calls + email sends + push sends + payments.
  const [aiMonth, aiToday, emailMonth, pushMonth, payouts] = await Promise.all([
    c.env.DB.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(cost_usd),0) AS cost FROM usage_events WHERE user_id=? AND kind='ai_message' AND ts>=?`).bind(user.id, startOfMonth).first<{ n: number; cost: number }>(),
    c.env.DB.prepare(`SELECT COUNT(*) AS n FROM usage_events WHERE user_id=? AND kind='ai_message' AND ts>=?`).bind(user.id, startOfDay).first<{ n: number }>(),
    c.env.DB.prepare(`SELECT COALESCE(SUM(tokens_in),0) AS n FROM usage_events WHERE user_id=? AND kind='email_send' AND ts>=?`).bind(user.id, startOfMonth).first<{ n: number }>(),
    c.env.DB.prepare(`SELECT COALESCE(SUM(tokens_in),0) AS n FROM usage_events WHERE user_id=? AND kind='push_send' AND ts>=?`).bind(user.id, startOfMonth).first<{ n: number }>(),
    c.env.DB.prepare(`SELECT COALESCE(SUM(amount_gross_cents),0) AS gross, COALESCE(SUM(application_fee_cents),0) AS fee, COUNT(*) AS n FROM builder_payouts WHERE user_id=?`).bind(user.id).first<{ gross: number; fee: number; n: number }>(),
  ]);

  return c.json({
    app: { id: app.id, slug: app.slug, name: app.name, created_at: app.created_at, days_old: Math.floor((now - app.created_at) / 86400) },
    views: { total: Number(viewsTotal ?? 0), today: Number(viewsToday ?? 0), daily: dailyViews },
    db_keys: dbKeyList.keys.length,
    push: { subscribers: subList.keys.length, sent_month: pushMonth?.n ?? 0 },
    ai: { calls_month: aiMonth?.n ?? 0, calls_today: aiToday?.n ?? 0, cost_usd_month: aiMonth?.cost ?? 0 },
    email: { sent_month: emailMonth?.n ?? 0 },
    payments: { gross_cents: payouts?.gross ?? 0, fee_cents: payouts?.fee ?? 0, transactions: payouts?.n ?? 0 },
  }, 200, { 'cache-control': 'private, max-age=20' });
});

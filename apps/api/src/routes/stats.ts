// Public stats for landing-page social proof.
// Cached 60s at the edge.

import { Hono } from 'hono';
import type { Env, Variables } from '../types';

export const stats = new Hono<{ Bindings: Env; Variables: Variables }>();

stats.get('/public', async (c) => {
  const day = Math.floor(Date.now() / 1000) - 86_400;
  const week = Math.floor(Date.now() / 1000) - 7 * 86_400;

  const [appsTotal, appsToday, builders, ai, payouts] = await Promise.all([
    c.env.DB.prepare(`SELECT COUNT(*) AS n FROM apps WHERE status='live'`).first<{ n: number }>(),
    c.env.DB.prepare(`SELECT COUNT(*) AS n FROM apps WHERE created_at>=?`).bind(day).first<{ n: number }>(),
    c.env.DB.prepare(`SELECT COUNT(*) AS n FROM users`).first<{ n: number }>(),
    c.env.DB.prepare(`SELECT COUNT(*) AS n FROM usage_events WHERE kind='ai_message' AND ts>=?`).bind(week).first<{ n: number }>(),
    c.env.DB.prepare(`SELECT COALESCE(SUM(amount_gross_cents),0) AS gross FROM builder_payouts WHERE ts>=?`).bind(week).first<{ gross: number }>(),
  ]);

  return c.json(
    {
      apps_total: appsTotal?.n ?? 0,
      apps_today: appsToday?.n ?? 0,
      builders: builders?.n ?? 0,
      ai_calls_week: ai?.n ?? 0,
      builder_revenue_week_cents: payouts?.gross ?? 0,
    },
    200,
    { 'cache-control': 'public, max-age=60', 'access-control-allow-origin': '*' }
  );
});

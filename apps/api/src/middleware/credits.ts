// Hard credit gate. Returns 402 with upgrade URL when limit hit.
// Counts AI messages today (UTC) and this calendar month.
// ALSO: global daily-spend circuit breaker — kills new AI calls if today's
// total inference cost across all users exceeds GLOBAL_DAILY_BUDGET_USD.
// Cached in KV for 60s so we don't query D1 on every request.

import type { MiddlewareHandler } from 'hono';
import type { Env, Variables } from '../types';
import { PLANS, type Plan } from '../lib/plans';
import { isPanicActive } from '../routes/panic';

// Hard ceiling on org-wide Anthropic spend per day. Tune via env in Workers Secrets.
const DEFAULT_GLOBAL_BUDGET_USD = 50;

export const requireCredits: MiddlewareHandler<{ Bindings: Env; Variables: Variables }> = async (c, next) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'unauthorized' }, 401);

  // -1. Manual panic switch — admin can kill AI calls instantly via POST /admin/panic.
  if (await isPanicActive(c.env)) {
    return c.json({
      error: 'service_paused',
      message: 'Stakgod is briefly paused while we sort out an issue. Try again in a few minutes.',
      retry_after_seconds: 300,
    }, 503);
  }

  // 0. Global circuit breaker — protects against abuse spikes during launches.
  const budget = Number(c.env.GLOBAL_DAILY_BUDGET_USD || DEFAULT_GLOBAL_BUDGET_USD);
  if (budget > 0) {
    const today = new Date().toISOString().slice(0, 10);
    const cacheKey = `global_spend:${today}`;
    let spent = Number(await c.env.SESSIONS.get(cacheKey) ?? '');
    if (Number.isNaN(spent) || !spent) {
      const startOfDayUtc = Math.floor(new Date(today).getTime() / 1000);
      const r = await c.env.DB.prepare(
        `SELECT COALESCE(SUM(cost_usd), 0) as total FROM usage_events WHERE kind='ai_message' AND ts>=?`
      ).bind(startOfDayUtc).first<{ total: number }>();
      spent = r?.total ?? 0;
      await c.env.SESSIONS.put(cacheKey, String(spent), { expirationTtl: 60 });
    }
    if (spent >= budget) {
      console.warn(`Global budget breaker tripped: $${spent.toFixed(2)} >= $${budget}`);
      return c.json({
        error: 'global_budget_exhausted',
        message: 'Stakgod is temporarily paused for new builds due to higher-than-expected demand. We’ll be back in a few hours.',
        retry_after_seconds: 3600,
      }, 503);
    }
  }

  const plan = PLANS[user.plan as Plan];
  const now = Math.floor(Date.now() / 1000);
  const startOfDayUtc = Math.floor(new Date(new Date().toISOString().slice(0, 10)).getTime() / 1000);
  const startOfMonthUtc = Math.floor(new Date(new Date().toISOString().slice(0, 7) + '-01').getTime() / 1000);

  const day = await c.env.DB.prepare(
    `SELECT COUNT(*) as n FROM usage_events WHERE user_id=? AND kind='ai_message' AND ts>=?`
  ).bind(user.id, startOfDayUtc).first<{ n: number }>();

  const month = await c.env.DB.prepare(
    `SELECT COUNT(*) as n FROM usage_events WHERE user_id=? AND kind='ai_message' AND ts>=?`
  ).bind(user.id, startOfMonthUtc).first<{ n: number }>();

  const dayN = day?.n ?? 0;
  const monthN = month?.n ?? 0;

  if (plan.daily_messages > 0 && dayN >= plan.daily_messages) {
    return c.json({
      error: 'daily_limit_reached',
      message: `You've used your ${plan.daily_messages} free messages today. Upgrade to keep building.`,
      upgrade_url: `${c.env.APP_URL}/pricing`,
      used: dayN,
      limit: plan.daily_messages,
    }, 402);
  }
  if (monthN >= plan.monthly_messages) {
    return c.json({
      error: 'monthly_limit_reached',
      message: `You've used all ${plan.monthly_messages} messages this month. Upgrade for more.`,
      upgrade_url: `${c.env.APP_URL}/pricing`,
      used: monthN,
      limit: plan.monthly_messages,
    }, 402);
  }
  await next();
};

// Hard credit gate. Returns 402 with upgrade URL when limit hit.
// Counts AI messages today (UTC) and this calendar month.

import type { MiddlewareHandler } from 'hono';
import type { Env, Variables } from '../types';
import { PLANS, type Plan } from '../lib/plans';

export const requireCredits: MiddlewareHandler<{ Bindings: Env; Variables: Variables }> = async (c, next) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'unauthorized' }, 401);

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

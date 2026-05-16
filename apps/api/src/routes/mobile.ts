// Ship-to-store endpoints. Bundle/package IDs derive from the user's connected
// developer account (Apple Guideline 4.2.6). Real build runs on GitHub Actions;
// see queue/build-consumer.ts for the dispatch.

import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { requireAuth } from '../middleware/auth';
import { PLANS, type Plan } from '../lib/plans';

export const mobile = new Hono<{ Bindings: Env; Variables: Variables }>();

mobile.post('/ios/ship', requireAuth, async (c) => {
  const user = c.get('user')!;
  if (!PLANS[user.plan as Plan].testflight) {
    return c.json({ error: 'plan_required', hint: 'TestFlight ship requires Pro or Studio', upgrade_url: `${c.env.APP_URL}/pricing` }, 402);
  }
  const { app_id } = await c.req.json<{ app_id: string }>();
  const app = await c.env.DB.prepare(`SELECT id, slug, name FROM apps WHERE id=? AND user_id=?`).bind(app_id, user.id).first<{ id: string; slug: string; name: string }>();
  if (!app) return c.json({ error: 'not_found' }, 404);

  const creds = await c.env.DB.prepare(
    `SELECT apple_team_id, apple_bundle_prefix FROM developer_credentials
     WHERE user_id=? AND apple_connected_at IS NOT NULL`
  ).bind(user.id).first<{ apple_team_id: string; apple_bundle_prefix: string }>();
  if (!creds) {
    return c.json({ error: 'apple_not_connected', connect_url: `${c.env.APP_URL}/dashboard/connect-apple` }, 412);
  }

  const bundle_id = `${creds.apple_bundle_prefix}.${app.slug}`;
  await c.env.BUILD_QUEUE.send({ kind: 'ios', app_id: app.id, user_id: user.id, bundle_id });
  await c.env.DB.prepare(`UPDATE apps SET ios_bundle_id=? WHERE id=?`).bind(bundle_id, app.id).run();
  return c.json({ ok: true, queued: true, bundle_id });
});

mobile.post('/android/ship', requireAuth, async (c) => {
  const user = c.get('user')!;
  if (!PLANS[user.plan as Plan].app_store) {
    return c.json({ error: 'plan_required', hint: 'Play submit requires Studio', upgrade_url: `${c.env.APP_URL}/pricing` }, 402);
  }
  const { app_id } = await c.req.json<{ app_id: string }>();
  const app = await c.env.DB.prepare(`SELECT id, slug, name FROM apps WHERE id=? AND user_id=?`).bind(app_id, user.id).first<{ id: string; slug: string; name: string }>();
  if (!app) return c.json({ error: 'not_found' }, 404);

  const creds = await c.env.DB.prepare(
    `SELECT google_package_prefix FROM developer_credentials
     WHERE user_id=? AND google_connected_at IS NOT NULL`
  ).bind(user.id).first<{ google_package_prefix: string }>();
  if (!creds) {
    return c.json({ error: 'google_not_connected', connect_url: `${c.env.APP_URL}/dashboard/connect-google` }, 412);
  }

  const package_name = `${creds.google_package_prefix}.${app.slug}`;
  await c.env.BUILD_QUEUE.send({ kind: 'android', app_id: app.id, user_id: user.id, package_name });
  await c.env.DB.prepare(`UPDATE apps SET android_package=? WHERE id=?`).bind(package_name, app.id).run();
  return c.json({ ok: true, queued: true, package_name });
});

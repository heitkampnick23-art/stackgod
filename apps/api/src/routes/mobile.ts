// Trigger an iOS or Android build for an app. The actual build runs on
// GitHub Actions (macOS runner for iOS); we dispatch a workflow_dispatch event.

import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { requireAuth } from '../middleware/auth';
import { PLANS, type Plan } from '../lib/plans';

export const mobile = new Hono<{ Bindings: Env; Variables: Variables }>();

const REPO = 'heitkampnick23-art/stackgod';

mobile.post('/ios/ship', requireAuth, async (c) => {
  const user = c.get('user')!;
  const plan = PLANS[user.plan as Plan];
  if (!plan.testflight) {
    return c.json({ error: 'plan_too_low', message: 'TestFlight ship requires Pro or Studio.', upgrade_url: `${c.env.APP_URL}/pricing` }, 402);
  }
  const { app_id, app_name, bundle_id } = await c.req.json<{ app_id: string; app_name: string; bundle_id: string }>();
  if (!app_id || !app_name || !bundle_id) return c.json({ error: 'missing_fields' }, 400);

  // Enqueue a build job. A separate worker (or GH Actions) drains the queue.
  await c.env.BUILD_QUEUE.send({ kind: 'ios', app_id, app_name, bundle_id, user_id: user.id, ts: Date.now() });

  return c.json({ ok: true, queued: true, message: 'Build queued. TestFlight in ~8 min.' });
});

mobile.post('/android/ship', requireAuth, async (c) => {
  const user = c.get('user')!;
  const plan = PLANS[user.plan as Plan];
  if (!plan.app_store) {
    return c.json({ error: 'plan_too_low', message: 'Play submit requires Studio.', upgrade_url: `${c.env.APP_URL}/pricing` }, 402);
  }
  const { app_id, app_name, package: pkg } = await c.req.json<{ app_id: string; app_name: string; package: string }>();
  if (!app_id || !app_name || !pkg) return c.json({ error: 'missing_fields' }, 400);
  await c.env.BUILD_QUEUE.send({ kind: 'android', app_id, app_name, package: pkg, user_id: user.id, ts: Date.now() });
  return c.json({ ok: true, queued: true, message: 'Build queued. Play internal track in ~6 min.' });
});

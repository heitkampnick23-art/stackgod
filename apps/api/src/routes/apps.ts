import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { requireAuth } from '../middleware/auth';
import { PLANS, type Plan } from '../lib/plans';

export const apps = new Hono<{ Bindings: Env; Variables: Variables }>();

apps.post('/', requireAuth, async (c) => {
  const user = c.get('user')!;
  const { name, description } = await c.req.json<{ name: string; description?: string }>();

  const plan = PLANS[user.plan as Plan];
  if (plan.max_apps !== -1) {
    const { count } = (await c.env.DB.prepare(
      `SELECT COUNT(*) as count FROM apps WHERE user_id=? AND status!='archived'`
    ).bind(user.id).first<{ count: number }>())!;
    if (count >= plan.max_apps) {
      return c.json({ error: 'app_limit_reached', limit: plan.max_apps, upgrade_url: `${c.env.APP_URL}/pricing` }, 402);
    }
  }
  const id = crypto.randomUUID();
  const slug = (name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 32)) + '-' + id.slice(0, 6);
  await c.env.DB.prepare(
    `INSERT INTO apps (id, user_id, slug, name, description) VALUES (?, ?, ?, ?, ?)`
  ).bind(id, user.id, slug, name, description ?? null).run();
  return c.json({ id, slug, name, url: `https://apps.stakgod.com/${slug}/` });
});

apps.get('/', requireAuth, async (c) => {
  const user = c.get('user')!;
  const { results } = await c.env.DB.prepare(
    `SELECT id, slug, name, description, tagline, status, custom_domain, ios_bundle_id, android_package,
            is_public, view_count, updated_at
     FROM apps WHERE user_id=? AND status!='archived' ORDER BY updated_at DESC`
  ).bind(user.id).all();
  return c.json({ apps: results });
});

// Toggle public visibility + optional tagline.
apps.post('/:id/visibility', requireAuth, async (c) => {
  const user = c.get('user')!;
  const id = c.req.param('id');
  const body = await c.req.json<{ is_public: boolean; tagline?: string }>();
  const tagline = (body.tagline ?? '').trim().slice(0, 120) || null;
  const r = await c.env.DB.prepare(
    `UPDATE apps SET is_public=?, tagline=COALESCE(?,tagline), updated_at=unixepoch()
     WHERE id=? AND user_id=?`
  ).bind(body.is_public ? 1 : 0, tagline, id, user.id).run();
  if ((r.meta as { changes?: number }).changes === 0) return c.json({ error: 'not_found' }, 404);
  return c.json({ ok: true, is_public: body.is_public, tagline });
});

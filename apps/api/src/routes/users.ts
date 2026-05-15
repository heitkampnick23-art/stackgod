// Public builder profiles + handle management.
// GET  /users/:handle              — public profile + public apps
// GET  /users/me                   — current builder's own profile (auth)
// POST /users/me                   — update handle/bio/twitter/website (auth)

import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { requireAuth } from '../middleware/auth';

export const users = new Hono<{ Bindings: Env; Variables: Variables }>();

const HANDLE_RE = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$/;
const RESERVED = new Set(['admin', 'api', 'app', 'apps', 'build', 'dashboard', 'discover', 'docs', 'login', 'logout', 'me', 'pricing', 'showcase', 'support', 'templates', 'u', 'user', 'users', 'www']);

function deriveHandle(email: string): string {
  const base = email.split('@')[0].toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24);
  return base || 'user';
}

// Top builders leaderboard. Aggregates each builder's public apps for views
// (live KV) + revenue (D1 builder_payouts). Cached 5 min at the edge.
users.get('/leaderboard', async (c) => {
  const by = (c.req.query('by') ?? 'views') === 'revenue' ? 'revenue' : 'views';
  const limit = Math.min(20, Math.max(1, Number(c.req.query('limit') ?? '10')));

  // Pull all builders with at least one public app.
  const rows = await c.env.DB.prepare(
    `SELECT u.id, u.handle, u.name, u.avatar_url, COUNT(a.id) AS app_count
     FROM users u JOIN apps a ON a.user_id = u.id
     WHERE u.handle IS NOT NULL AND a.is_public = 1 AND a.status = 'live'
     GROUP BY u.id LIMIT 500`
  ).all<{ id: string; handle: string; name: string | null; avatar_url: string | null; app_count: number }>();

  const builders = await Promise.all((rows.results ?? []).map(async (b) => {
    // Public app slugs for this builder.
    const slugRows = await c.env.DB.prepare(
      `SELECT slug FROM apps WHERE user_id=? AND is_public=1 AND status='live' LIMIT 100`
    ).bind(b.id).all<{ slug: string }>();
    const slugs = (slugRows.results ?? []).map((r) => r.slug);

    let total_views = 0;
    if (by === 'views' || by === 'revenue') {
      // Live KV view counts (parallel).
      const counts = await Promise.all(slugs.map((s) => c.env.APP_DATA.get(`appviews:${s}:total`)));
      total_views = counts.reduce((sum, v) => sum + (Number(v ?? 0) || 0), 0);
    }

    let revenue_cents = 0;
    if (by === 'revenue') {
      const r = await c.env.DB.prepare(
        `SELECT COALESCE(SUM(amount_gross_cents),0) AS gross FROM builder_payouts WHERE user_id=?`
      ).bind(b.id).first<{ gross: number }>();
      revenue_cents = r?.gross ?? 0;
    }

    return {
      handle: b.handle, name: b.name, avatar_url: b.avatar_url,
      apps: b.app_count, total_views, revenue_cents,
    };
  }));

  builders.sort((a, b) => by === 'revenue' ? (b.revenue_cents - a.revenue_cents) : (b.total_views - a.total_views));
  return c.json({ builders: builders.slice(0, limit), by }, 200, { 'cache-control': 'public, max-age=300' });
});

users.get('/me', requireAuth, async (c) => {
  const user = c.get('user')!;
  const row = await c.env.DB.prepare(
    `SELECT id, email, name, avatar_url, handle, bio, twitter, website FROM users WHERE id=?`
  ).bind(user.id).first();
  return c.json({ profile: row });
});

users.post('/me', requireAuth, async (c) => {
  const user = c.get('user')!;
  const body = await c.req.json<{ handle?: string; bio?: string; twitter?: string; website?: string }>();
  const updates: string[] = [];
  const binds: (string | null)[] = [];

  if (body.handle !== undefined) {
    const h = body.handle.toLowerCase().trim();
    if (!HANDLE_RE.test(h)) return c.json({ error: 'invalid_handle', detail: 'lowercase a-z 0-9 dash, 3-32 chars' }, 400);
    if (RESERVED.has(h)) return c.json({ error: 'handle_reserved' }, 409);
    const taken = await c.env.DB.prepare(`SELECT id FROM users WHERE handle=? AND id != ?`).bind(h, user.id).first();
    if (taken) return c.json({ error: 'handle_taken' }, 409);
    updates.push('handle=?'); binds.push(h);
  }
  if (body.bio !== undefined)     { updates.push('bio=?');     binds.push(body.bio.slice(0, 280) || null); }
  if (body.twitter !== undefined) { updates.push('twitter=?'); binds.push(body.twitter.replace(/^@/, '').slice(0, 40) || null); }
  if (body.website !== undefined) {
    const w = body.website.trim();
    if (w && !/^https?:\/\//.test(w)) return c.json({ error: 'website_must_be_http' }, 400);
    updates.push('website=?'); binds.push(w.slice(0, 200) || null);
  }
  if (updates.length === 0) return c.json({ ok: true, unchanged: true });
  binds.push(user.id);
  await c.env.DB.prepare(`UPDATE users SET ${updates.join(', ')}, updated_at=unixepoch() WHERE id=?`).bind(...binds).run();
  return c.json({ ok: true });
});

users.get('/:handle', async (c) => {
  const handleParam = c.req.param('handle').toLowerCase();
  if (!HANDLE_RE.test(handleParam)) return c.json({ error: 'invalid_handle' }, 400);

  const row = await c.env.DB.prepare(
    `SELECT id, name, avatar_url, handle, bio, twitter, website, created_at FROM users WHERE handle=?`
  ).bind(handleParam).first<{ id: string; name: string | null; avatar_url: string | null; handle: string; bio: string | null; twitter: string | null; website: string | null; created_at: number }>();
  if (!row) return c.json({ error: 'not_found' }, 404);

  const apps = await c.env.DB.prepare(
    `SELECT slug, name, description, tagline, custom_domain, view_count, updated_at
     FROM apps WHERE user_id=? AND is_public=1 AND status='live' ORDER BY updated_at DESC LIMIT 50`
  ).bind(row.id).all<{ slug: string; name: string; description: string | null; tagline: string | null; custom_domain: string | null; view_count: number; updated_at: number }>();

  // Hydrate live view counts from KV.
  const out = await Promise.all((apps.results ?? []).map(async (a) => {
    const v = await c.env.APP_DATA.get(`appviews:${a.slug}:total`);
    return {
      slug: a.slug, name: a.name,
      tagline: a.tagline || a.description,
      url: a.custom_domain ? `https://${a.custom_domain}/` : `https://apps.stakgod.com/${a.slug}/`,
      updated_at: a.updated_at,
      view_count: Number(v ?? a.view_count ?? 0),
    };
  }));

  // Total view count across all this user's public apps (cheap stat).
  const totalViews = out.reduce((s, a) => s + a.view_count, 0);

  return c.json({
    profile: {
      handle: row.handle, name: row.name, bio: row.bio,
      avatar_url: row.avatar_url, twitter: row.twitter, website: row.website,
      builder_since: row.created_at,
      stats: { apps: out.length, total_views: totalViews },
    },
    apps: out,
  });
});

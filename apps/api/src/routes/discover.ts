// Public app discovery — paginated grid of opt-in apps.
// view_count is hydrated from KV at query time so leaderboard is real-time.

import { Hono } from 'hono';
import type { Env, Variables } from '../types';

export const discover = new Hono<{ Bindings: Env; Variables: Variables }>();

interface Row { slug: string; name: string; description: string | null; tagline: string | null; custom_domain: string | null; view_count: number; updated_at: number; }

discover.get('/', async (c) => {
  const cursor = Math.max(0, Number(c.req.query('cursor') ?? '0'));
  const q = (c.req.query('q') ?? '').toLowerCase().slice(0, 64);
  const sort = (c.req.query('sort') ?? 'fresh') === 'top' ? 'top' : 'fresh';
  const limit = 24;

  // For 'top' we over-fetch then sort by live KV view counts.
  const fetchN = sort === 'top' ? 200 : limit + 1;
  const stmt = q
    ? c.env.DB.prepare(
        `SELECT slug, name, description, tagline, custom_domain, view_count, updated_at
         FROM apps WHERE is_public=1 AND status='live' AND lower(name) LIKE ?
         ORDER BY updated_at DESC LIMIT ? OFFSET ?`
      ).bind(`%${q}%`, fetchN, sort === 'top' ? 0 : cursor)
    : c.env.DB.prepare(
        `SELECT slug, name, description, tagline, custom_domain, view_count, updated_at
         FROM apps WHERE is_public=1 AND status='live'
         ORDER BY updated_at DESC LIMIT ? OFFSET ?`
      ).bind(fetchN, sort === 'top' ? 0 : cursor);

  const r = await stmt.all<Row>();
  let rows = r.results ?? [];

  // Hydrate views from KV.
  await Promise.all(rows.map(async (a) => {
    const v = await c.env.APP_DATA.get(`appviews:${a.slug}:total`);
    a.view_count = Number(v ?? a.view_count ?? 0);
  }));

  if (sort === 'top') rows = rows.sort((a, b) => b.view_count - a.view_count);

  const slice = rows.slice(cursor, cursor + limit);
  const hasMore = rows.length > cursor + limit;
  const apps = slice.map((a) => ({
    slug: a.slug, name: a.name,
    description: a.tagline || a.description,
    url: a.custom_domain ? `https://${a.custom_domain}/` : `https://apps.stakgod.com/${a.slug}/`,
    updated_at: a.updated_at,
    view_count: a.view_count,
  }));
  return c.json({ apps, next_cursor: hasMore ? cursor + limit : null, sort });
});

// Top-10 leaderboard for the Discover hero strip. Cached 60s at the edge.
discover.get('/leaderboard', async (c) => {
  const r = await c.env.DB.prepare(
    `SELECT slug, name, description, tagline, custom_domain, view_count, updated_at
     FROM apps WHERE is_public=1 AND status='live' LIMIT 200`
  ).all<Row>();
  const rows = r.results ?? [];
  await Promise.all(rows.map(async (a) => {
    const v = await c.env.APP_DATA.get(`appviews:${a.slug}:total`);
    a.view_count = Number(v ?? 0);
  }));
  const top = rows.sort((a, b) => b.view_count - a.view_count).slice(0, 10).map((a) => ({
    slug: a.slug, name: a.name,
    tagline: a.tagline || a.description,
    url: a.custom_domain ? `https://${a.custom_domain}/` : `https://apps.stakgod.com/${a.slug}/`,
    view_count: a.view_count,
  }));
  return c.json({ apps: top }, 200, { 'cache-control': 'public, max-age=60' });
});

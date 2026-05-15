// Public app discovery — paginated grid of opt-in apps.

import { Hono } from 'hono';
import type { Env, Variables } from '../types';

export const discover = new Hono<{ Bindings: Env; Variables: Variables }>();

discover.get('/', async (c) => {
  const cursor = Math.max(0, Number(c.req.query('cursor') ?? '0'));
  const q = (c.req.query('q') ?? '').toLowerCase().slice(0, 64);
  const limit = 24;

  const where = q ? `is_public=1 AND status='live' AND lower(name) LIKE ?` : `is_public=1 AND status='live'`;
  const stmt = q
    ? c.env.DB.prepare(
        `SELECT slug, name, description, tagline, custom_domain, view_count, updated_at
         FROM apps WHERE ${where} ORDER BY updated_at DESC LIMIT ? OFFSET ?`
      ).bind(`%${q}%`, limit + 1, cursor)
    : c.env.DB.prepare(
        `SELECT slug, name, description, tagline, custom_domain, view_count, updated_at
         FROM apps WHERE ${where} ORDER BY updated_at DESC LIMIT ? OFFSET ?`
      ).bind(limit + 1, cursor);

  const r = await stmt.all<{
    slug: string; name: string; description: string | null; tagline: string | null;
    custom_domain: string | null; view_count: number; updated_at: number;
  }>();
  const rows = r.results ?? [];
  const hasMore = rows.length > limit;
  const apps = (hasMore ? rows.slice(0, limit) : rows).map((a) => ({
    slug: a.slug,
    name: a.name,
    description: a.tagline || a.description,
    url: a.custom_domain ? `https://${a.custom_domain}/` : `https://apps.stakgod.com/${a.slug}/`,
    updated_at: a.updated_at,
    view_count: a.view_count,
  }));
  return c.json({ apps, next_cursor: hasMore ? cursor + limit : null });
});

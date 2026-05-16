// Per-app custom domain attach.
// Builders point a CNAME from their domain → apps.stakgod.com (proxied), then
// hit /apps/:id/domain to register the host→slug mapping in KV. apps-worker
// looks up the Host header on every request to resolve which app to serve.
//
// Cloudflare for SaaS Custom Hostnames could automate the SSL/route side
// for external zones; for v0 we ask users with their own zones to configure
// the CNAME themselves and use CF universal SSL on apps.stakgod.com.

import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { requireAuth } from '../middleware/auth';
import { PLANS, type Plan } from '../lib/plans';

export const appDomain = new Hono<{ Bindings: Env; Variables: Variables }>();

const DOMAIN_RE = /^(?!-)(?:[a-z0-9-]{1,63}(?<!-)\.)+[a-z]{2,}$/i;
const RESERVED = new Set(['stakgod.com', 'apps.stakgod.com', 'api.stakgod.com', 'www.stakgod.com']);

interface Body { domain: string; }

appDomain.post('/:id/domain', requireAuth, async (c) => {
  const user = c.get('user')!;
  if (!PLANS[user.plan as Plan].custom_domains) {
    return c.json({ error: 'plan_required', hint: 'Custom domains require Hobby or higher.', upgrade_url: `${c.env.APP_URL}/pricing` }, 402);
  }
  const id = c.req.param('id');
  const { domain } = await c.req.json<Body>();
  const d = domain?.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!d || !DOMAIN_RE.test(d) || RESERVED.has(d)) return c.json({ error: 'invalid_domain' }, 400);

  const app = await c.env.DB.prepare(`SELECT id, slug FROM apps WHERE id=? AND user_id=?`).bind(id, user.id).first<{ id: string; slug: string }>();
  if (!app) return c.json({ error: 'not_found' }, 404);

  // Refuse if another app already claims this host.
  const existing = await c.env.APP_HOSTS.get(`host:${d}`);
  if (existing && existing !== app.slug) return c.json({ error: 'host_taken', detail: 'This domain is attached to another app on Stakgod.' }, 409);

  // Clear any old host this app had.
  const prev = await c.env.DB.prepare(`SELECT custom_domain FROM apps WHERE id=?`).bind(id).first<{ custom_domain: string | null }>();
  if (prev?.custom_domain && prev.custom_domain !== d) await c.env.APP_HOSTS.delete(`host:${prev.custom_domain}`);

  await c.env.APP_HOSTS.put(`host:${d}`, app.slug);
  await c.env.DB.prepare(`UPDATE apps SET custom_domain=?, updated_at=unixepoch() WHERE id=?`).bind(d, id).run();
  return c.json({
    ok: true,
    domain: d,
    cname_target: 'apps.stakgod.com',
    instructions: `In your DNS provider, add a CNAME record: ${d} → apps.stakgod.com (proxied if using Cloudflare). SSL is automatic.`,
  });
});

appDomain.delete('/:id/domain', requireAuth, async (c) => {
  const user = c.get('user')!;
  const id = c.req.param('id');
  const row = await c.env.DB.prepare(`SELECT custom_domain FROM apps WHERE id=? AND user_id=?`).bind(id, user.id).first<{ custom_domain: string | null }>();
  if (!row) return c.json({ error: 'not_found' }, 404);
  if (row.custom_domain) await c.env.APP_HOSTS.delete(`host:${row.custom_domain}`);
  await c.env.DB.prepare(`UPDATE apps SET custom_domain=NULL WHERE id=?`).bind(id).run();
  return c.json({ ok: true });
});

// Verify the user has actually pointed DNS at us by fetching the domain.
appDomain.get('/:id/domain/verify', requireAuth, async (c) => {
  const user = c.get('user')!;
  const id = c.req.param('id');
  const row = await c.env.DB.prepare(`SELECT slug, custom_domain FROM apps WHERE id=? AND user_id=?`).bind(id, user.id).first<{ slug: string; custom_domain: string | null }>();
  if (!row) return c.json({ error: 'not_found' }, 404);
  if (!row.custom_domain) return c.json({ error: 'no_domain_attached' }, 400);
  try {
    const r = await fetch(`https://${row.custom_domain}/`, { redirect: 'manual' });
    const ok = r.status >= 200 && r.status < 400;
    return c.json({ ok, status: r.status, served_by: r.headers.get('server'), domain: row.custom_domain });
  } catch (e) {
    return c.json({ ok: false, error: String(e) });
  }
});

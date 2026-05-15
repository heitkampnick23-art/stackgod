// One-click unsubscribe + manual trigger for the weekly builder digest.
// Unsub honors RFC 8058 List-Unsubscribe-Post: a POST with no body must work.

import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { runWeeklyDigests, verifyUnsubToken } from '../lib/run-digests';

export const digest = new Hono<{ Bindings: Env; Variables: Variables }>();

async function doUnsub(c: { env: Env; req: { query(k: string): string | undefined } }): Promise<Response> {
  const token = c.req.query('token');
  if (!token) return new Response('missing token', { status: 400 });
  const userId = await verifyUnsubToken(c.env, token);
  if (!userId) return new Response('invalid token', { status: 401 });
  await c.env.DB.prepare(`UPDATE users SET digest_unsubscribed_at = unixepoch() WHERE id=?`).bind(userId).run();
  const html = `<!doctype html><meta charset=utf-8><title>Unsubscribed</title>
<style>body{font:16px/1.5 -apple-system,sans-serif;background:#0a0a0f;color:#f5f5f7;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center;padding:24px}
a{color:#ff5b1f}</style>
<h1 style="font-family:Georgia,serif"><span style="color:#d4af37">STAK</span>GOD</h1>
<p>You're unsubscribed from weekly digests.</p>
<p style="color:#888;font-size:14px">Transactional emails (sign-in links, billing) still work.</p>
<p><a href="https://stakgod.com/dashboard">← Back to dashboard</a></p>`;
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}

digest.get('/unsubscribe', (c) => doUnsub(c));
digest.post('/unsubscribe', (c) => doUnsub(c));

// Admin-only manual trigger; useful before the first cron fires.
digest.post('/run', async (c) => {
  const user = c.get('user');
  const admins = (c.env.ADMIN_EMAILS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!user || !admins.includes(user.email)) return c.json({ error: 'forbidden' }, 403);
  const result = await runWeeklyDigests(c.env);
  return c.json(result);
});

// Magic-link email auth + Sign in with Apple/Google handoff stubs.
// LIVE production from day one — real Resend, real Apple/Google clients.

import { Hono } from 'hono';
import type { Env, Variables } from '../types';

export const auth = new Hono<{ Bindings: Env; Variables: Variables }>();

auth.post('/magic-link', async (c) => {
  const { email, next } = await c.req.json<{ email: string; next?: string }>();
  if (!email || !/^[^@]+@[^@]+\.[^@]+$/.test(email)) return c.json({ error: 'invalid_email' }, 400);

  const token = crypto.randomUUID() + crypto.randomUUID();
  await c.env.SESSIONS.put(`magic:${token}`, JSON.stringify({ email, next: next ?? '/dashboard' }), { expirationTtl: 900 });
  const link = `${c.env.API_URL}/auth/verify?token=${token}`;

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${c.env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: 'Stakgod <login@stakgod.com>',
      to: email,
      subject: 'Your Stakgod login link',
      html: `<p>Click to sign in: <a href="${link}">${link}</a></p><p>Expires in 15 minutes.</p>`,
    }),
  });
  if (!r.ok) return c.json({ error: 'send_failed', detail: await r.text() }, 500);
  return c.json({ ok: true });
});

auth.get('/verify', async (c) => {
  const token = c.req.query('token');
  if (!token) return c.text('missing token', 400);
  const stored = await c.env.SESSIONS.get(`magic:${token}`);
  if (!stored) return c.text('expired or invalid', 401);
  await c.env.SESSIONS.delete(`magic:${token}`);
  // Stored is either a plain email (legacy) or {email, next} JSON.
  let email: string; let next = '/dashboard';
  if (stored.startsWith('{')) { try { const o = JSON.parse(stored); email = o.email; next = sanitizeNextLocal(o.next); } catch { email = stored; } }
  else email = stored;

  let user = await c.env.DB.prepare(`SELECT * FROM users WHERE email=?`).bind(email).first<{ id: string }>();
  if (!user) {
    const id = crypto.randomUUID();
    await c.env.DB.prepare(`INSERT INTO users (id, email, plan) VALUES (?, ?, 'free')`).bind(id, email).run();
    user = { id };
  }
  const sessionToken = crypto.randomUUID() + crypto.randomUUID();
  const expires = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30;
  await c.env.DB.prepare(
    `INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)`
  ).bind(sessionToken, user.id, expires).run();

  return new Response(null, {
    status: 302,
    headers: {
      location: `${c.env.APP_URL}${next}`,
      'set-cookie': `sg_session=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}; Domain=.stakgod.com`,
    },
  });
});

function sanitizeNextLocal(n: string | undefined | null): string {
  const def = '/dashboard';
  if (!n || typeof n !== 'string') return def;
  if (!n.startsWith('/') || n.startsWith('//') || n.length > 200) return def;
  return n;
}

auth.post('/logout', async (c) => {
  const cookie = c.req.header('cookie') ?? '';
  const m = cookie.match(/sg_session=([^;]+)/);
  if (m) await c.env.DB.prepare(`DELETE FROM sessions WHERE token=?`).bind(m[1]).run();
  return new Response(null, {
    status: 204,
    headers: { 'set-cookie': `sg_session=; Path=/; Max-Age=0; Domain=.stakgod.com` },
  });
});

auth.get('/me', async (c) => {
  const user = c.get('user');
  return c.json({ user: user ?? null });
});

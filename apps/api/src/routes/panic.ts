// Emergency kill switch + live error tail. Admin-only.
//
// POST /admin/panic        → KV flag flipped, every /builder/chat returns 503
// POST /admin/panic/clear  → flag cleared, normal service resumes
// GET  /admin/panic        → current panic state + last 50 errors
// GET  /admin/errors       → just the last 50 errors (used live during launch)
//
// Errors are written to KV by a global onError handler in src/index.ts.

import { Hono } from 'hono';
import type { Env, Variables } from '../types';

export const panic = new Hono<{ Bindings: Env; Variables: Variables }>();

const PANIC_KEY = 'panic:ai_calls_blocked';
const ERROR_PREFIX = 'error:';

function requireAdmin(c: { env: Env; get: (k: string) => unknown }): Response | null {
  const user = c.get('user') as { email?: string } | undefined;
  const admins = (c.env.ADMIN_EMAILS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!user?.email || !admins.includes(user.email)) {
    return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: { 'content-type': 'application/json' } });
  }
  return null;
}

panic.post('/panic', async (c) => {
  const fb = requireAdmin(c); if (fb) return fb;
  const reason = c.req.query('reason') || 'manual';
  await c.env.SESSIONS.put(PANIC_KEY, JSON.stringify({ at: Date.now(), reason }), { expirationTtl: 6 * 60 * 60 });
  return c.json({ ok: true, panic: true, reason, expires_in_hours: 6 });
});

panic.post('/panic/clear', async (c) => {
  const fb = requireAdmin(c); if (fb) return fb;
  await c.env.SESSIONS.delete(PANIC_KEY);
  return c.json({ ok: true, panic: false });
});

panic.get('/panic', async (c) => {
  const fb = requireAdmin(c); if (fb) return fb;
  const raw = await c.env.SESSIONS.get(PANIC_KEY);
  const errs = await listErrors(c.env);
  return c.json({ panic: !!raw, raw: raw ? JSON.parse(raw) : null, recent_errors: errs.slice(0, 10) });
});

panic.get('/errors', async (c) => {
  const fb = requireAdmin(c); if (fb) return fb;
  const errs = await listErrors(c.env);
  return c.json({ count: errs.length, errors: errs });
});

async function listErrors(env: Env): Promise<Array<{ ts: number; key: string; msg: string; path: string; status?: number }>> {
  const list = await env.SESSIONS.list({ prefix: ERROR_PREFIX, limit: 50 });
  const out = await Promise.all(list.keys.map(async (k) => {
    const v = await env.SESSIONS.get(k.name);
    if (!v) return null;
    try { const o = JSON.parse(v); return { key: k.name, ...o }; } catch { return null; }
  }));
  return (out.filter(Boolean) as Array<{ ts: number; key: string; msg: string; path: string; status?: number }>)
    .sort((a, b) => b.ts - a.ts);
}

// Helper used by index.ts onError + middleware to check panic + log errors.
export async function isPanicActive(env: Env): Promise<boolean> {
  const raw = await env.SESSIONS.get(PANIC_KEY);
  return !!raw;
}

export async function logError(env: Env, err: { msg: string; path: string; status?: number; stack?: string }): Promise<void> {
  const ts = Date.now();
  const id = ts + '-' + Math.random().toString(36).slice(2, 8);
  await env.SESSIONS.put(`${ERROR_PREFIX}${id}`, JSON.stringify({ ts, ...err }), { expirationTtl: 24 * 60 * 60 });
}

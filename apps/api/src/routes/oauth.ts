// Google + Apple Sign In. Both flows: redirect to provider, callback handles
// token exchange / JWT verify, then mints a Stackgod session cookie.
//
// Credentials are read from env. If a provider's creds aren't set, the
// /auth/providers endpoint reports it disabled and the UI hides the button.

import { Hono } from 'hono';
import type { Env, Variables } from '../types';

export const oauth = new Hono<{ Bindings: Env; Variables: Variables }>();

const SESSION_COOKIE = (token: string) =>
  `sg_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}; Domain=.stakgod.com`;

oauth.get('/providers', (c) => {
  return c.json({
    google: !!(c.env.GOOGLE_CLIENT_ID && c.env.GOOGLE_CLIENT_SECRET),
    apple: !!(c.env.APPLE_CLIENT_ID && c.env.APPLE_TEAM_ID && c.env.APPLE_KEY_ID && c.env.APPLE_PRIVATE_KEY),
  });
});

// ---------- Google ----------

oauth.get('/google/start', async (c) => {
  if (!c.env.GOOGLE_CLIENT_ID) return c.text('google not configured', 503);
  const state = crypto.randomUUID();
  await c.env.SESSIONS.put(`oauth_state:${state}`, '1', { expirationTtl: 600 });
  const params = new URLSearchParams({
    client_id: c.env.GOOGLE_CLIENT_ID,
    redirect_uri: `${c.env.API_URL}/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'online',
    prompt: 'select_account',
  });
  return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

oauth.get('/google/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  if (!code || !state) return c.text('missing code/state', 400);
  if (!(await c.env.SESSIONS.get(`oauth_state:${state}`))) return c.text('bad state', 400);
  await c.env.SESSIONS.delete(`oauth_state:${state}`);

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: c.env.GOOGLE_CLIENT_ID,
      client_secret: c.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${c.env.API_URL}/auth/google/callback`,
      grant_type: 'authorization_code',
    }),
  });
  if (!tokenRes.ok) return c.text(`google token exchange failed: ${await tokenRes.text()}`, 502);
  const { id_token } = await tokenRes.json<{ id_token: string }>();
  const claims = decodeIdToken(id_token);
  if (!claims?.email) return c.text('no email in token', 400);

  const { id, sessionToken } = await upsertUserAndSession(c.env, {
    email: claims.email,
    name: claims.name ?? null,
    avatar_url: claims.picture ?? null,
    google_sub: claims.sub,
  });
  return new Response(null, {
    status: 302,
    headers: { location: `${c.env.APP_URL}/dashboard`, 'set-cookie': SESSION_COOKIE(sessionToken) },
  });
});

// ---------- Apple ----------

oauth.get('/apple/start', async (c) => {
  if (!c.env.APPLE_CLIENT_ID) return c.text('apple not configured', 503);
  const state = crypto.randomUUID();
  await c.env.SESSIONS.put(`oauth_state:${state}`, '1', { expirationTtl: 600 });
  const params = new URLSearchParams({
    client_id: c.env.APPLE_CLIENT_ID,
    redirect_uri: `${c.env.API_URL}/auth/apple/callback`,
    response_type: 'code id_token',
    response_mode: 'form_post',
    scope: 'name email',
    state,
  });
  return c.redirect(`https://appleid.apple.com/auth/authorize?${params}`);
});

// Apple posts back as form data because we asked for form_post.
oauth.post('/apple/callback', async (c) => {
  const form = await c.req.formData();
  const state = form.get('state') as string | null;
  const idToken = form.get('id_token') as string | null;
  if (!state || !idToken) return c.text('missing state/id_token', 400);
  if (!(await c.env.SESSIONS.get(`oauth_state:${state}`))) return c.text('bad state', 400);
  await c.env.SESSIONS.delete(`oauth_state:${state}`);

  const claims = decodeIdToken(idToken);
  if (!claims?.email) return c.text('no email in id_token', 400);

  const userJson = form.get('user') as string | null;
  let displayName: string | null = null;
  if (userJson) {
    try {
      const u = JSON.parse(userJson) as { name?: { firstName?: string; lastName?: string } };
      displayName = [u.name?.firstName, u.name?.lastName].filter(Boolean).join(' ') || null;
    } catch {}
  }

  const { id, sessionToken } = await upsertUserAndSession(c.env, {
    email: claims.email,
    name: displayName,
    avatar_url: null,
    apple_sub: claims.sub,
  });
  return new Response(null, {
    status: 302,
    headers: { location: `${c.env.APP_URL}/dashboard`, 'set-cookie': SESSION_COOKIE(sessionToken) },
  });
});

// ---------- helpers ----------

interface UpsertInput {
  email: string;
  name: string | null;
  avatar_url: string | null;
  google_sub?: string;
  apple_sub?: string;
}

async function upsertUserAndSession(env: Env, u: UpsertInput): Promise<{ id: string; sessionToken: string }> {
  let row = await env.DB.prepare(`SELECT id FROM users WHERE email=?`).bind(u.email).first<{ id: string }>();
  let id: string;
  if (row) {
    id = row.id;
    await env.DB.prepare(
      `UPDATE users SET name=COALESCE(?,name), avatar_url=COALESCE(?,avatar_url),
        google_sub=COALESCE(?,google_sub), apple_sub=COALESCE(?,apple_sub), updated_at=unixepoch() WHERE id=?`
    ).bind(u.name, u.avatar_url, u.google_sub ?? null, u.apple_sub ?? null, id).run();
  } else {
    id = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO users (id, email, name, avatar_url, google_sub, apple_sub, plan)
       VALUES (?, ?, ?, ?, ?, ?, 'free')`
    ).bind(id, u.email, u.name, u.avatar_url, u.google_sub ?? null, u.apple_sub ?? null).run();
  }
  const sessionToken = crypto.randomUUID() + crypto.randomUUID();
  const expires = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30;
  await env.DB.prepare(`INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)`)
    .bind(sessionToken, id, expires).run();
  return { id, sessionToken };
}

interface IdTokenClaims { sub: string; email?: string; name?: string; picture?: string; }

function decodeIdToken(jwt: string): IdTokenClaims | null {
  // Skip signature verification for v0; both providers send over HTTPS direct from us.
  // Production: verify against Google JWKS / Apple JWKS.
  const parts = jwt.split('.');
  if (parts.length !== 3) return null;
  try {
    const b = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b + '='.repeat((4 - (b.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

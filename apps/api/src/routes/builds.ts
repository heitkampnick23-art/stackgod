// Build job lifecycle: list, CI credential fetch, CI status callback.
// Credentials endpoint is HMAC-token-protected so CI can pull decrypted creds
// without us ever passing them through workflow inputs (which get logged).

import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { requireAuth } from '../middleware/auth';
import { decryptString, encryptString } from '../lib/crypto';
import { verifyBuildToken } from '../lib/build-token';

export const builds = new Hono<{ Bindings: Env; Variables: Variables }>();

// List recent builds for the signed-in user (dashboard).
builds.get('/', requireAuth, async (c) => {
  const user = c.get('user')!;
  const appId = c.req.query('app_id');
  const rows = appId
    ? await c.env.DB.prepare(
        `SELECT id, app_id, kind, bundle_id, status, gh_run_url, error, artifact_url, queued_at, finished_at
         FROM builds WHERE user_id=? AND app_id=? ORDER BY queued_at DESC LIMIT 25`
      ).bind(user.id, appId).all()
    : await c.env.DB.prepare(
        `SELECT id, app_id, kind, bundle_id, status, gh_run_url, error, artifact_url, queued_at, finished_at
         FROM builds WHERE user_id=? ORDER BY queued_at DESC LIMIT 25`
      ).bind(user.id).all();
  return c.json({ builds: rows.results });
});

// CI fetches credentials with a one-time HMAC token.
builds.get('/:id/credentials', async (c) => {
  const id = c.req.param('id');
  const token = c.req.query('token') ?? '';
  if (!(await verifyBuildToken(c.env.BUILD_TOKEN_SECRET, id, token))) return c.text('bad token', 401);

  const job = await c.env.DB.prepare(`SELECT app_id, user_id, kind, bundle_id FROM builds WHERE id=?`).bind(id).first<{
    app_id: string; user_id: string; kind: string; bundle_id: string;
  }>();
  if (!job) return c.text('not found', 404);

  const creds = await c.env.DB.prepare(
    `SELECT apple_team_id, apple_asc_issuer_id, apple_asc_key_id, apple_asc_p8_enc,
            google_play_service_account_enc
     FROM developer_credentials WHERE user_id=?`
  ).bind(job.user_id).first<Record<string, string | null>>();
  if (!creds) return c.text('no developer credentials', 412);

  const app = await c.env.DB.prepare(`SELECT name, slug FROM apps WHERE id=?`).bind(job.app_id).first<{ name: string; slug: string }>();

  if (job.kind === 'ios') {
    if (!creds.apple_asc_p8_enc) return c.text('apple not connected', 412);
    return c.json({
      app_name: app?.name,
      slug: app?.slug,
      bundle_id: job.bundle_id,
      apple_team_id: creds.apple_team_id,
      asc_issuer_id: creds.apple_asc_issuer_id,
      asc_key_id: creds.apple_asc_key_id,
      asc_p8: await decryptString(c.env.ENCRYPTION_KEY, creds.apple_asc_p8_enc),
      app_url: `https://apps.stakgod.com/${app?.slug}/`,
    });
  }
  if (job.kind === 'android') {
    if (!creds.google_play_service_account_enc) return c.text('google not connected', 412);
    return c.json({
      app_name: app?.name,
      slug: app?.slug,
      package_name: job.bundle_id,
      service_account_json: await decryptString(c.env.ENCRYPTION_KEY, creds.google_play_service_account_enc),
      app_url: `https://apps.stakgod.com/${app?.slug}/`,
    });
  }
  return c.text('unknown kind', 400);
});

// Per-app Android upload keystore — fetched-or-stored by CI.
// Stored encrypted in R2 at _keystores/{slug}.jks + _keystores/{slug}.pw
// (apps-worker only serves apps/* so these are naturally private).

builds.get('/:id/keystore', async (c) => {
  const id = c.req.param('id');
  const token = c.req.query('token') ?? '';
  if (!(await verifyBuildToken(c.env.BUILD_TOKEN_SECRET, id, token))) return c.text('bad token', 401);
  const job = await c.env.DB.prepare(`SELECT app_id FROM builds WHERE id=?`).bind(id).first<{ app_id: string }>();
  if (!job) return c.text('build not found', 404);
  const app = await c.env.DB.prepare(`SELECT slug FROM apps WHERE id=?`).bind(job.app_id).first<{ slug: string }>();
  if (!app) return c.text('app not found', 404);
  const obj = await c.env.APPS.get(`_keystores/${app.slug}.jks`);
  if (!obj) return c.text('not found', 404);
  // Returned as base64 to keep this transport simple over curl.
  const buf = await obj.arrayBuffer();
  const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
  return new Response(b64, { headers: { 'content-type': 'text/plain' } });
});

builds.get('/:id/keystore/password', async (c) => {
  const id = c.req.param('id');
  const token = c.req.query('token') ?? '';
  if (!(await verifyBuildToken(c.env.BUILD_TOKEN_SECRET, id, token))) return c.text('bad token', 401);
  const job = await c.env.DB.prepare(`SELECT app_id FROM builds WHERE id=?`).bind(id).first<{ app_id: string }>();
  if (!job) return c.text('build not found', 404);
  const app = await c.env.DB.prepare(`SELECT slug FROM apps WHERE id=?`).bind(job.app_id).first<{ slug: string }>();
  if (!app) return c.text('app not found', 404);
  const obj = await c.env.APPS.get(`_keystores/${app.slug}.pw`);
  if (!obj) return c.text('not found', 404);
  const enc = await obj.text();
  const pw = await decryptString(c.env.ENCRYPTION_KEY, enc);
  return new Response(pw, { headers: { 'content-type': 'text/plain' } });
});

builds.put('/:id/keystore', async (c) => {
  const id = c.req.param('id');
  const token = c.req.query('token') ?? '';
  if (!(await verifyBuildToken(c.env.BUILD_TOKEN_SECRET, id, token))) return c.text('bad token', 401);
  const job = await c.env.DB.prepare(`SELECT app_id FROM builds WHERE id=?`).bind(id).first<{ app_id: string }>();
  if (!job) return c.text('build not found', 404);
  const app = await c.env.DB.prepare(`SELECT slug FROM apps WHERE id=?`).bind(job.app_id).first<{ slug: string }>();
  if (!app) return c.text('app not found', 404);
  const { keystore_b64, password } = await c.req.json<{ keystore_b64: string; password: string }>();
  if (!keystore_b64 || !password) return c.text('missing fields', 400);
  const bin = Uint8Array.from(atob(keystore_b64), (ch) => ch.charCodeAt(0));
  await c.env.APPS.put(`_keystores/${app.slug}.jks`, bin);
  await c.env.APPS.put(`_keystores/${app.slug}.pw`, await encryptString(c.env.ENCRYPTION_KEY, password));
  return c.json({ ok: true });
});

// CI uploads the built artifact (.aab / .ipa) so users can download it from the dashboard.
builds.put('/:id/artifact', async (c) => {
  const id = c.req.param('id');
  const token = c.req.query('token') ?? '';
  if (!(await verifyBuildToken(c.env.BUILD_TOKEN_SECRET, id, token))) return c.text('bad token', 401);
  const name = (c.req.query('name') ?? 'artifact.bin').replace(/[^a-zA-Z0-9._-]/g, '');
  const job = await c.env.DB.prepare(`SELECT app_id FROM builds WHERE id=?`).bind(id).first<{ app_id: string }>();
  if (!job) return c.text('build not found', 404);
  const app = await c.env.DB.prepare(`SELECT slug FROM apps WHERE id=?`).bind(job.app_id).first<{ slug: string }>();
  if (!app) return c.text('app not found', 404);
  const body = await c.req.arrayBuffer();
  const key = `_artifacts/${app.slug}/${id}/${name}`;
  await c.env.APPS.put(key, body);
  // Update the artifact_url to the download endpoint below.
  const url = `${c.env.API_URL}/builds/${id}/artifact?download=1`;
  await c.env.DB.prepare(`UPDATE builds SET artifact_url=? WHERE id=?`).bind(url, id).run();
  return c.json({ ok: true, key, url });
});

// Owner-only artifact download (auth + ownership check).
builds.get('/:id/artifact', requireAuth, async (c) => {
  const user = c.get('user')!;
  const id = c.req.param('id');
  const job = await c.env.DB.prepare(
    `SELECT b.app_id FROM builds b WHERE b.id=? AND b.user_id=?`
  ).bind(id, user.id).first<{ app_id: string }>();
  if (!job) return c.text('not found', 404);
  const app = await c.env.DB.prepare(`SELECT slug FROM apps WHERE id=?`).bind(job.app_id).first<{ slug: string }>();
  if (!app) return c.text('not found', 404);
  // Find the (single) artifact under this build.
  const list = await c.env.APPS.list({ prefix: `_artifacts/${app.slug}/${id}/`, limit: 1 });
  const obj = list.objects[0] ? await c.env.APPS.get(list.objects[0].key) : null;
  if (!obj) return c.text('no artifact', 404);
  const filename = list.objects[0].key.split('/').pop() ?? 'artifact.bin';
  return new Response(obj.body, {
    headers: {
      'content-type': 'application/octet-stream',
      'content-disposition': `attachment; filename="${filename}"`,
    },
  });
});

// CI posts status updates here.
interface StatusBody {
  status: 'running' | 'succeeded' | 'failed';
  gh_run_id?: string;
  gh_run_url?: string;
  artifact_url?: string;
  error?: string;
}
builds.post('/:id/status', async (c) => {
  const id = c.req.param('id');
  const token = c.req.query('token') ?? '';
  if (!(await verifyBuildToken(c.env.BUILD_TOKEN_SECRET, id, token))) return c.text('bad token', 401);
  const b = await c.req.json<StatusBody>();
  const finished = b.status === 'succeeded' || b.status === 'failed';
  await c.env.DB.prepare(
    `UPDATE builds
     SET status=?,
         gh_run_id=COALESCE(?,gh_run_id),
         gh_run_url=COALESCE(?,gh_run_url),
         artifact_url=COALESCE(?,artifact_url),
         error=COALESCE(?,error),
         finished_at=CASE WHEN ? THEN unixepoch() ELSE finished_at END
     WHERE id=?`
  ).bind(b.status, b.gh_run_id ?? null, b.gh_run_url ?? null, b.artifact_url ?? null, b.error ?? null, finished ? 1 : 0, id).run();
  return c.json({ ok: true });
});

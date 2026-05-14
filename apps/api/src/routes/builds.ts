// Build job lifecycle: list, CI credential fetch, CI status callback.
// Credentials endpoint is HMAC-token-protected so CI can pull decrypted creds
// without us ever passing them through workflow inputs (which get logged).

import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { requireAuth } from '../middleware/auth';
import { decryptString } from '../lib/crypto';
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

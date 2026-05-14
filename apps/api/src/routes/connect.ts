// Builder-side OAuth-equivalent for Apple Developer + Google Play accounts.
// Stores credentials encrypted at rest. Used by the mobile ship pipeline.

import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { requireAuth } from '../middleware/auth';
import { encryptString } from '../lib/crypto';

export const connect = new Hono<{ Bindings: Env; Variables: Variables }>();

interface AppleConnectBody {
  apple_team_id: string;            // 10-char alphanumeric
  apple_bundle_prefix: string;      // reverse-DNS, e.g. "com.acme"
  apple_asc_issuer_id: string;      // UUID
  apple_asc_key_id: string;         // 10-char alphanumeric
  apple_asc_p8: string;             // raw .p8 contents
}

interface GoogleConnectBody {
  google_package_prefix: string;
  google_play_service_account_json: string;
}

connect.get('/status', requireAuth, async (c) => {
  const user = c.get('user')!;
  const row = await c.env.DB.prepare(
    `SELECT apple_team_id, apple_bundle_prefix, apple_asc_key_id, apple_connected_at,
            google_package_prefix, google_connected_at
     FROM developer_credentials WHERE user_id=?`
  ).bind(user.id).first<Record<string, unknown>>();
  return c.json({
    apple: row?.apple_connected_at
      ? { team_id: row.apple_team_id, bundle_prefix: row.apple_bundle_prefix, key_id: row.apple_asc_key_id, connected_at: row.apple_connected_at }
      : null,
    google: row?.google_connected_at
      ? { package_prefix: row.google_package_prefix, connected_at: row.google_connected_at }
      : null,
  });
});

connect.post('/apple', requireAuth, async (c) => {
  const user = c.get('user')!;
  const b = await c.req.json<AppleConnectBody>();
  if (!/^[A-Z0-9]{10}$/.test(b.apple_team_id)) return c.json({ error: 'invalid_team_id', hint: '10 alphanumeric chars from Apple Developer' }, 400);
  if (!/^[a-z0-9]+(\.[a-z0-9]+)+$/i.test(b.apple_bundle_prefix)) return c.json({ error: 'invalid_bundle_prefix', hint: 'reverse-DNS like com.acme' }, 400);
  if (!/^[A-Z0-9]{10}$/.test(b.apple_asc_key_id)) return c.json({ error: 'invalid_key_id' }, 400);
  if (!/-/.test(b.apple_asc_issuer_id)) return c.json({ error: 'invalid_issuer_id', hint: 'UUID format' }, 400);
  if (!b.apple_asc_p8.includes('BEGIN PRIVATE KEY')) return c.json({ error: 'invalid_p8', hint: 'paste the entire .p8 file contents including BEGIN/END lines' }, 400);

  const p8Enc = await encryptString(c.env.ENCRYPTION_KEY, b.apple_asc_p8);
  await c.env.DB.prepare(
    `INSERT INTO developer_credentials (user_id, apple_team_id, apple_bundle_prefix, apple_asc_issuer_id, apple_asc_key_id, apple_asc_p8_enc, apple_connected_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())
     ON CONFLICT(user_id) DO UPDATE SET
       apple_team_id=excluded.apple_team_id,
       apple_bundle_prefix=excluded.apple_bundle_prefix,
       apple_asc_issuer_id=excluded.apple_asc_issuer_id,
       apple_asc_key_id=excluded.apple_asc_key_id,
       apple_asc_p8_enc=excluded.apple_asc_p8_enc,
       apple_connected_at=unixepoch(),
       updated_at=unixepoch()`
  ).bind(user.id, b.apple_team_id, b.apple_bundle_prefix, b.apple_asc_issuer_id, b.apple_asc_key_id, p8Enc).run();
  return c.json({ ok: true });
});

connect.post('/google', requireAuth, async (c) => {
  const user = c.get('user')!;
  const b = await c.req.json<GoogleConnectBody>();
  if (!/^[a-z0-9]+(\.[a-z0-9]+)+$/i.test(b.google_package_prefix)) return c.json({ error: 'invalid_package_prefix' }, 400);
  let parsed: { client_email?: string; private_key?: string };
  try { parsed = JSON.parse(b.google_play_service_account_json); } catch { return c.json({ error: 'invalid_json' }, 400); }
  if (!parsed.client_email || !parsed.private_key) return c.json({ error: 'json_missing_fields', hint: 'expected client_email + private_key' }, 400);

  const enc = await encryptString(c.env.ENCRYPTION_KEY, b.google_play_service_account_json);
  await c.env.DB.prepare(
    `INSERT INTO developer_credentials (user_id, google_package_prefix, google_play_service_account_enc, google_connected_at, updated_at)
     VALUES (?, ?, ?, unixepoch(), unixepoch())
     ON CONFLICT(user_id) DO UPDATE SET
       google_package_prefix=excluded.google_package_prefix,
       google_play_service_account_enc=excluded.google_play_service_account_enc,
       google_connected_at=unixepoch(),
       updated_at=unixepoch()`
  ).bind(user.id, b.google_package_prefix, enc).run();
  return c.json({ ok: true });
});

connect.delete('/apple', requireAuth, async (c) => {
  const user = c.get('user')!;
  await c.env.DB.prepare(
    `UPDATE developer_credentials
     SET apple_team_id=NULL, apple_bundle_prefix=NULL, apple_asc_issuer_id=NULL,
         apple_asc_key_id=NULL, apple_asc_p8_enc=NULL, apple_connected_at=NULL,
         updated_at=unixepoch()
     WHERE user_id=?`
  ).bind(user.id).run();
  return c.json({ ok: true });
});

connect.delete('/google', requireAuth, async (c) => {
  const user = c.get('user')!;
  await c.env.DB.prepare(
    `UPDATE developer_credentials
     SET google_package_prefix=NULL, google_play_service_account_enc=NULL,
         google_connected_at=NULL, updated_at=unixepoch()
     WHERE user_id=?`
  ).bind(user.id).run();
  return c.json({ ok: true });
});

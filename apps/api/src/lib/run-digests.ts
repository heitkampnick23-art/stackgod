// Weekly builder digest runner. Invoked from scheduled() every Monday.
// Idempotent per (user_id, ISO-week) — safe if cron fires twice.

import type { Env } from '../types';
import { sendDigestEmail, type DigestStats } from './digest-email';

interface BuilderRow {
  id: string;
  email: string;
  name: string | null;
}
interface AppRow { id: string; slug: string; name: string; }

export async function runWeeklyDigests(env: Env): Promise<{ sent: number; skipped: number }> {
  const week = isoWeekKey(new Date());
  const cutoff = Math.floor(Date.now() / 1000) - 7 * 86400;

  // All builders with at least one public app, not unsubscribed, not yet emailed this week.
  const { results } = await env.DB.prepare(`
    SELECT DISTINCT u.id, u.email, u.name
    FROM users u
    JOIN apps a ON a.user_id = u.id
    WHERE a.is_public = 1
      AND u.digest_unsubscribed_at IS NULL
      AND u.email LIKE '%@%'
      AND NOT EXISTS (SELECT 1 FROM email_digests_sent d WHERE d.user_id = u.id AND d.week_key = ?)
    LIMIT 5000
  `).bind(week).all<BuilderRow>();

  let sent = 0, skipped = 0;
  for (const u of results ?? []) {
    try {
      const stats = await collectStats(env, u.id, cutoff);
      // Threshold: never email empty digests. Builders without traction get nothing.
      const matters = stats.views >= 5 || stats.forks > 0 || stats.revenue_cents > 0;
      if (!matters) { skipped++; continue; }

      const unsubToken = await mintUnsubToken(env, u.id);
      await sendDigestEmail(env, u.email, u.name, stats, unsubToken);

      await env.DB.prepare(
        `INSERT OR IGNORE INTO email_digests_sent (user_id, week_key, views, forks, revenue_cents)
         VALUES (?, ?, ?, ?, ?)`
      ).bind(u.id, week, stats.views, stats.forks, stats.revenue_cents).run();
      sent++;
    } catch {
      skipped++;
    }
  }
  return { sent, skipped };
}

async function collectStats(env: Env, userId: string, cutoff: number): Promise<DigestStats> {
  const apps = await env.DB.prepare(
    `SELECT id, slug, name FROM apps WHERE user_id=? AND is_public=1`
  ).bind(userId).all<AppRow>();

  const days = last7DayKeys();
  let totalViews = 0;
  let topApp: DigestStats['top_app'] = null;

  for (const a of apps.results ?? []) {
    let appViews = 0;
    // KV reads are tiny; bound parallelism by Promise.all per app.
    const vs = await Promise.all(days.map((d) => env.APP_DATA.get(`appviews:${a.slug}:d:${d}`)));
    for (const v of vs) appViews += Number(v ?? '0') || 0;
    totalViews += appViews;
    if (!topApp || appViews > topApp.views) topApp = { name: a.name, slug: a.slug, views: appViews };
  }

  // Forks + revenue sourced from this builder's apps in last 7 days.
  const forkAgg = await env.DB.prepare(
    `SELECT COUNT(*) AS n,
            COALESCE(SUM(amount_cents - application_fee_cents), 0) AS net
     FROM fork_purchases
     WHERE source_user_id = ? AND ts >= ?`
  ).bind(userId, cutoff).first<{ n: number; net: number }>();

  return {
    views: totalViews,
    forks: forkAgg?.n ?? 0,
    revenue_cents: forkAgg?.net ?? 0,
    top_app: topApp && topApp.views > 0 ? topApp : null,
    apps_count: apps.results?.length ?? 0,
  };
}

function last7DayKeys(): string[] {
  const out: string[] = [];
  const today = new Date();
  for (let i = 1; i <= 7; i++) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

// ISO 8601 week key, e.g. "2026-W20".
function isoWeekKey(d: Date): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((t.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

// HMAC-signed user_id, valid until manually revoked. Same pattern as build tokens.
async function mintUnsubToken(env: Env, userId: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(env.SESSION_SECRET || env.BUILD_TOKEN_SECRET || 'sg-digest'),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`unsub:${userId}`));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${userId}.${sigB64}`;
}

export async function verifyUnsubToken(env: Env, token: string): Promise<string | null> {
  const [userId, sig] = token.split('.');
  if (!userId || !sig) return null;
  const expected = (await mintUnsubToken(env, userId)).split('.')[1];
  return timingSafeEq(sig, expected) ? userId : null;
}

function timingSafeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

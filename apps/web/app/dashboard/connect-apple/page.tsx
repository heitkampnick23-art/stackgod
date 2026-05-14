'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

const API = 'https://api.stakgod.com';

export default function ConnectApple() {
  const [status, setStatus] = useState<{ team_id?: string; bundle_prefix?: string; key_id?: string } | null | 'loading'>('loading');
  const [team, setTeam] = useState('');
  const [prefix, setPrefix] = useState('');
  const [issuer, setIssuer] = useState('');
  const [keyId, setKeyId] = useState('');
  const [p8, setP8] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  useEffect(() => { refresh(); }, []);
  async function refresh() {
    const r = await fetch(`${API}/connect/status`, { credentials: 'include' });
    if (r.status === 401) { location.href = '/login?next=/dashboard/connect-apple'; return; }
    const d = await r.json();
    setStatus(d.apple);
  }

  async function save() {
    setBusy(true); setErr(''); setOk('');
    const r = await fetch(`${API}/connect/apple`, {
      method: 'POST', credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        apple_team_id: team.trim().toUpperCase(),
        apple_bundle_prefix: prefix.trim().toLowerCase(),
        apple_asc_issuer_id: issuer.trim(),
        apple_asc_key_id: keyId.trim().toUpperCase(),
        apple_asc_p8: p8,
      }),
    });
    setBusy(false);
    if (r.ok) { setOk('Connected. You can now ship to TestFlight.'); setP8(''); refresh(); }
    else { const j = await r.json(); setErr(`${j.error}${j.hint ? ' — ' + j.hint : ''}`); }
  }

  async function disconnect() {
    if (!confirm('Disconnect Apple? Your TestFlight ships will stop working until you reconnect.')) return;
    await fetch(`${API}/connect/apple`, { method: 'DELETE', credentials: 'include' });
    refresh();
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <Link href="/dashboard" className="text-sm text-white/60 hover:text-white">← Dashboard</Link>
      <h1 className="font-display text-4xl mt-2">Connect Apple Developer</h1>
      <p className="mt-2 text-white/60">
        Apple requires apps to publish under their owner's account (Guideline 4.2.6). Bring your own Apple
        Developer account ($99/yr to Apple) and we'll automate every ship for you.
      </p>

      {status && status !== 'loading' && (
        <div className="card mt-6 border-emerald-500/30 bg-emerald-500/5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-emerald-400 font-semibold">Connected</div>
              <div className="text-sm text-white/70 mt-1">Team {status.team_id} · prefix <code>{status.bundle_prefix}</code> · key {status.key_id}</div>
            </div>
            <button onClick={disconnect} className="btn-ghost text-sm">Disconnect</button>
          </div>
        </div>
      )}

      <ol className="mt-8 space-y-6 text-white/80">
        <li className="card">
          <div className="font-semibold">1. Get your Team ID</div>
          <div className="text-sm text-white/60 mt-1">
            <a href="https://developer.apple.com/account#MembershipDetailsCard" target="_blank" rel="noreferrer" className="text-flame underline">developer.apple.com/account</a>
            &nbsp;→ Membership Details → copy <b>Team ID</b> (10 chars).
          </div>
          <input value={team} onChange={(e) => setTeam(e.target.value)} placeholder="ABCDE12345"
            className="mt-3 w-full rounded bg-white/10 px-4 py-2 outline-none focus:ring-2 focus:ring-flame font-mono uppercase" />
        </li>

        <li className="card">
          <div className="font-semibold">2. Pick a bundle ID prefix</div>
          <div className="text-sm text-white/60 mt-1">Reverse-DNS, usually a domain you own. We'll append your app slug, e.g. <code>com.acme.habit-tracker</code>.</div>
          <input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="com.acme"
            className="mt-3 w-full rounded bg-white/10 px-4 py-2 outline-none focus:ring-2 focus:ring-flame font-mono lowercase" />
        </li>

        <li className="card">
          <div className="font-semibold">3. Create an App Store Connect API Key</div>
          <div className="text-sm text-white/60 mt-1">
            <a href="https://appstoreconnect.apple.com/access/integrations/api" target="_blank" rel="noreferrer" className="text-flame underline">App Store Connect → Users and Access → Integrations</a>
            &nbsp;→ Generate API Key with role <b>App Manager</b>. Copy Issuer ID (UUID) and Key ID (10 chars), download the .p8 file.
          </div>
          <input value={issuer} onChange={(e) => setIssuer(e.target.value)} placeholder="69a6de70-... (Issuer ID UUID)"
            className="mt-3 w-full rounded bg-white/10 px-4 py-2 outline-none focus:ring-2 focus:ring-flame font-mono" />
          <input value={keyId} onChange={(e) => setKeyId(e.target.value)} placeholder="ABCDE12345 (Key ID)"
            className="mt-3 w-full rounded bg-white/10 px-4 py-2 outline-none focus:ring-2 focus:ring-flame font-mono uppercase" />
          <textarea value={p8} onChange={(e) => setP8(e.target.value)}
            placeholder="-----BEGIN PRIVATE KEY-----&#10;... (paste full .p8 contents) ...&#10;-----END PRIVATE KEY-----"
            rows={6}
            className="mt-3 w-full rounded bg-white/10 px-4 py-2 outline-none focus:ring-2 focus:ring-flame font-mono text-xs" />
          <div className="mt-2 text-xs text-white/40">Encrypted at rest with AES-256-GCM. Never logged.</div>
        </li>
      </ol>

      {err && <div className="mt-4 text-red-400 text-sm">{err}</div>}
      {ok && <div className="mt-4 text-emerald-400 text-sm">{ok}</div>}
      <button onClick={save} disabled={busy || !team || !prefix || !issuer || !keyId || !p8} className="btn-primary mt-6 disabled:opacity-50">
        {busy ? 'Saving…' : 'Connect Apple'}
      </button>
    </div>
  );
}

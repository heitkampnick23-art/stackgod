'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

const API = 'https://api.stakgod.com';

export default function ConnectGoogle() {
  const [status, setStatus] = useState<{ package_prefix?: string } | null | 'loading'>('loading');
  const [prefix, setPrefix] = useState('');
  const [json, setJson] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  useEffect(() => { refresh(); }, []);
  async function refresh() {
    const r = await fetch(`${API}/connect/status`, { credentials: 'include' });
    if (r.status === 401) { location.href = '/login?next=/dashboard/connect-google'; return; }
    const d = await r.json();
    setStatus(d.google);
  }

  async function save() {
    setBusy(true); setErr(''); setOk('');
    const r = await fetch(`${API}/connect/google`, {
      method: 'POST', credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ google_package_prefix: prefix.trim().toLowerCase(), google_play_service_account_json: json }),
    });
    setBusy(false);
    if (r.ok) { setOk('Connected. You can now ship to Play.'); setJson(''); refresh(); }
    else { const j = await r.json(); setErr(`${j.error}${j.hint ? ' — ' + j.hint : ''}`); }
  }

  async function disconnect() {
    if (!confirm('Disconnect Google Play?')) return;
    await fetch(`${API}/connect/google`, { method: 'DELETE', credentials: 'include' });
    refresh();
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <Link href="/dashboard" className="text-sm text-white/60 hover:text-white">← Dashboard</Link>
      <h1 className="font-display text-4xl mt-2">Connect Google Play</h1>
      <p className="mt-2 text-white/60">
        Apps publish under your Google Play Console account ($25 one-time to Google). Generate a service-account
        JSON in Play and paste it here — we'll automate every Play upload.
      </p>

      {status && status !== 'loading' && (
        <div className="card mt-6 border-emerald-500/30 bg-emerald-500/5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-emerald-400 font-semibold">Connected</div>
              <div className="text-sm text-white/70 mt-1">Package prefix <code>{status.package_prefix}</code></div>
            </div>
            <button onClick={disconnect} className="btn-ghost text-sm">Disconnect</button>
          </div>
        </div>
      )}

      <ol className="mt-8 space-y-6 text-white/80">
        <li className="card">
          <div className="font-semibold">1. Pick a package prefix</div>
          <div className="text-sm text-white/60 mt-1">Reverse-DNS, like Apple's bundle prefix. We append your app slug.</div>
          <input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="com.acme"
            className="mt-3 w-full rounded bg-white/10 px-4 py-2 outline-none focus:ring-2 focus:ring-flame font-mono lowercase" />
        </li>

        <li className="card">
          <div className="font-semibold">2. Create a service account in Google Cloud, link it to Play</div>
          <ol className="text-sm text-white/60 mt-1 list-decimal list-inside space-y-1">
            <li><a className="text-flame underline" href="https://console.cloud.google.com/iam-admin/serviceaccounts" target="_blank" rel="noreferrer">Cloud Console → Service Accounts</a> → Create → name it "Stakgod Play Publisher" → Done</li>
            <li>Click into the account → Keys → Add key → JSON → download</li>
            <li><a className="text-flame underline" href="https://play.google.com/console/developers/users-and-permissions" target="_blank" rel="noreferrer">Play Console → Users and permissions</a> → Invite the service account email → grant <b>Release</b> + <b>Edit store listing</b></li>
            <li>Paste the JSON below</li>
          </ol>
          <textarea value={json} onChange={(e) => setJson(e.target.value)}
            placeholder='{ "type": "service_account", "client_email": "...", "private_key": "..." }'
            rows={10}
            className="mt-3 w-full rounded bg-white/10 px-4 py-2 outline-none focus:ring-2 focus:ring-flame font-mono text-xs" />
          <div className="mt-2 text-xs text-white/40">Encrypted at rest with AES-256-GCM.</div>
        </li>
      </ol>

      {err && <div className="mt-4 text-red-400 text-sm">{err}</div>}
      {ok && <div className="mt-4 text-emerald-400 text-sm">{ok}</div>}
      <button onClick={save} disabled={busy || !prefix || !json} className="btn-primary mt-6 disabled:opacity-50">
        {busy ? 'Saving…' : 'Connect Google Play'}
      </button>
    </div>
  );
}

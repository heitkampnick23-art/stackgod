'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface App { id: string; slug: string; name: string; status: string; custom_domain?: string | null; is_public?: number; tagline?: string | null; }
interface Usage { messages: number; cost: number; }
interface Build { id: string; app_id: string; kind: string; status: string; bundle_id: string | null; gh_run_url: string | null; artifact_url: string | null; error: string | null; queued_at: number; }

const API = 'https://api.stakgod.com';

export default function Dashboard() {
  const [apps, setApps] = useState<App[]>([]);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [plan, setPlan] = useState('free');
  const [builds, setBuilds] = useState<Build[]>([]);
  const [shipping, setShipping] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/apps`, { credentials: 'include' }).then(r => r.ok ? r.json() : { apps: [] }).then((d: { apps: App[] }) => setApps(d.apps));
    fetch(`${API}/builder/usage`, { credentials: 'include' }).then(r => r.ok ? r.json() : null).then((d: { today: Usage; plan: string } | null) => { if (d) { setUsage(d.today); setPlan(d.plan); } });
    refreshBuilds();
    const t = setInterval(refreshBuilds, 15000);
    return () => clearInterval(t);
  }, []);

  function refreshBuilds() {
    fetch(`${API}/builds`, { credentials: 'include' }).then(r => r.ok ? r.json() : { builds: [] }).then((d: { builds: Build[] }) => setBuilds(d.builds));
  }

  async function shipIos(appId: string) { return ship(appId, 'ios'); }
  async function shipAndroid(appId: string) { return ship(appId, 'android'); }
  async function ship(appId: string, kind: 'ios' | 'android') {
    setShipping(appId + ':' + kind);
    const r = await fetch(`${API}/mobile/${kind}/ship`, {
      method: 'POST', credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ app_id: appId }),
    });
    setShipping(null);
    const j = await r.json();
    if (!r.ok) {
      if (j.connect_url) { if (confirm(`${j.error}. Connect now?`)) location.href = j.connect_url; return; }
      if (j.upgrade_url) { if (confirm(`${j.error}. Upgrade now?`)) location.href = j.upgrade_url; return; }
      alert(`Ship failed: ${j.error}`);
      return;
    }
    refreshBuilds();
  }

  async function connectStripe() {
    const r = await fetch('https://api.stakgod.com/billing/connect/onboard', { method: 'POST', credentials: 'include' });
    const { url } = await r.json();
    location.href = url;
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl">Your forge</h1>
        <Link href="/build" className="btn-primary">+ New app</Link>
      </div>

      <div className="mt-8 grid md:grid-cols-3 gap-4">
        <div className="card">
          <div className="text-xs text-white/50 uppercase tracking-wider">Plan</div>
          <div className="font-display text-2xl mt-1 capitalize">{plan}</div>
          <Link href="/pricing" className="text-flame text-sm mt-2 inline-block">Upgrade →</Link>
        </div>
        <div className="card">
          <div className="text-xs text-white/50 uppercase tracking-wider">Today’s usage</div>
          <div className="font-display text-2xl mt-1">{usage?.messages ?? 0} msgs</div>
          <div className="text-xs text-white/50">${(usage?.cost ?? 0).toFixed(4)} of compute</div>
        </div>
        <div className="card">
          <div className="text-xs text-white/50 uppercase tracking-wider">Sell subscriptions</div>
          <button onClick={connectStripe} className="btn-ghost mt-2 text-sm">Connect Stripe →</button>
        </div>
      </div>

      <h2 className="font-display text-2xl mt-12">Ship to stores</h2>
      <p className="text-sm text-white/50 mt-1">Apps publish under your own developer accounts (Apple Guideline 4.2.6). Bring your keys, we automate every ship.</p>
      <div className="mt-4 grid md:grid-cols-2 gap-4">
        <Link href="/dashboard/connect-apple" className="card hover:border-flame/40 transition block">
          <div className="font-semibold">Connect Apple Developer</div>
          <div className="text-sm text-white/60 mt-1">Required for TestFlight + App Store ship. ~10 min, $99/yr to Apple.</div>
        </Link>
        <Link href="/dashboard/connect-google" className="card hover:border-flame/40 transition block">
          <div className="font-semibold">Connect Google Play</div>
          <div className="text-sm text-white/60 mt-1">Required for Play submit. ~10 min, $25 one-time to Google.</div>
        </Link>
      </div>

      <h2 className="font-display text-2xl mt-12">Your apps</h2>
      <div className="mt-4 grid md:grid-cols-3 gap-4">
        {apps.length === 0 && <div className="card text-white/50">No apps yet. <Link href="/build" className="text-flame">Start building →</Link></div>}
        {apps.map((a) => (
          <AppCard
            key={a.id}
            app={a}
            shippingIos={shipping === a.id + ':ios'}
            shippingAndroid={shipping === a.id + ':android'}
            onShipIos={() => shipIos(a.id)}
            onShipAndroid={() => shipAndroid(a.id)}
            onChange={() => fetch(`${API}/apps`, { credentials: 'include' }).then(r => r.json()).then(d => setApps(d.apps))}
          />
        ))}
      </div>

      {builds.length > 0 && (
        <>
          <h2 className="font-display text-2xl mt-12">Recent builds</h2>
          <div className="mt-4 card !p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-left text-white/60 text-xs uppercase">
                <tr><th className="p-3">Status</th><th className="p-3">Kind</th><th className="p-3">Bundle</th><th className="p-3">Queued</th><th className="p-3">Logs</th><th className="p-3">Artifact</th></tr>
              </thead>
              <tbody>
                {builds.map(b => (
                  <tr key={b.id} className="border-t border-white/5">
                    <td className="p-3"><BuildStatus status={b.status} /></td>
                    <td className="p-3 uppercase text-xs">{b.kind}</td>
                    <td className="p-3 font-mono text-xs">{b.bundle_id ?? '—'}</td>
                    <td className="p-3 text-white/60 text-xs">{new Date(b.queued_at * 1000).toLocaleString()}</td>
                    <td className="p-3 text-xs">{b.gh_run_url ? <a className="text-flame underline" href={b.gh_run_url} target="_blank" rel="noreferrer">view</a> : '—'}</td>
                    <td className="p-3 text-xs">{b.artifact_url ? <a className="text-flame underline" href={b.artifact_url} target="_blank" rel="noreferrer">{b.kind === 'ios' ? '.ipa' : '.aab'} ↓</a> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function BuildStatus({ status }: { status: string }) {
  const cls = status === 'succeeded' ? 'text-emerald-400' :
              status === 'failed'    ? 'text-red-400' :
              status === 'running' || status === 'dispatched' ? 'text-amber-400' : 'text-white/60';
  return <span className={`font-semibold text-xs uppercase ${cls}`}>{status}</span>;
}

function AppCard({ app, onShipIos, onShipAndroid, shippingIos, shippingAndroid, onChange }: { app: App; onShipIos: () => void; onShipAndroid: () => void; shippingIos: boolean; shippingAndroid: boolean; onChange: () => void }) {
  const [openDomain, setOpenDomain] = useState(false);
  const [domain, setDomain] = useState(app.custom_domain ?? '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>('');
  const [isPublic, setIsPublic] = useState(!!app.is_public);
  const [tagline, setTagline] = useState(app.tagline ?? '');
  const [savingVis, setSavingVis] = useState(false);

  async function togglePublic(next: boolean) {
    setSavingVis(true);
    setIsPublic(next);
    await fetch(`${API}/apps/${app.id}/visibility`, {
      method: 'POST', credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ is_public: next, tagline }),
    });
    setSavingVis(false);
    onChange();
  }
  async function saveTagline() {
    setSavingVis(true);
    await fetch(`${API}/apps/${app.id}/visibility`, {
      method: 'POST', credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ is_public: isPublic, tagline }),
    });
    setSavingVis(false);
  }

  async function attach() {
    setBusy(true); setMsg('');
    const r = await fetch(`${API}/apps/${app.id}/domain`, {
      method: 'POST', credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ domain: domain.trim() }),
    });
    setBusy(false);
    const j = await r.json();
    if (!r.ok) {
      if (j.upgrade_url) { if (confirm(`${j.error}. Upgrade now?`)) location.href = j.upgrade_url; return; }
      setMsg(j.error ?? 'failed'); return;
    }
    setMsg(`✓ Saved. CNAME ${j.domain} → ${j.cname_target} (proxied) and it's live.`);
    onChange();
  }

  async function detach() {
    if (!confirm(`Detach ${app.custom_domain}?`)) return;
    setBusy(true);
    await fetch(`${API}/apps/${app.id}/domain`, { method: 'DELETE', credentials: 'include' });
    setBusy(false);
    setDomain(''); setMsg('');
    onChange();
  }

  const liveUrl = app.custom_domain ? `https://${app.custom_domain}/` : `https://apps.stakgod.com/${app.slug}/`;

  return (
    <div className="card">
      <Link href={`/build?app=${app.id}`} className="block">
        <div className="flex items-start gap-3">
          <img
            src={`https://apps.stakgod.com/${app.slug}/icon.png`}
            alt=""
            onError={(e) => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }}
            className="w-12 h-12 rounded-xl object-cover bg-white/5 border border-white/10 shrink-0"
          />
          <div className="min-w-0 flex-1">
            <div className="font-semibold truncate">{app.name}</div>
            <div className="text-xs text-white/50 mt-1 truncate">{liveUrl.replace(/^https?:\/\//, '')}</div>
            <div className="mt-2 inline-block text-xs px-2 py-0.5 rounded bg-white/10">{app.status}</div>
          </div>
        </div>
      </Link>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <a href={liveUrl} target="_blank" rel="noreferrer" className="btn-ghost text-xs !py-2">Open ↗</a>
        <button onClick={() => setOpenDomain((v) => !v)} className="btn-ghost text-xs !py-2">
          {app.custom_domain ? '🌐 ' + app.custom_domain : '🌐 Custom domain'}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-2">
        <button onClick={onShipIos} disabled={shippingIos} className="btn-ghost text-xs disabled:opacity-50">
          {shippingIos ? '…' : '🍎 TestFlight'}
        </button>
        <button onClick={onShipAndroid} disabled={shippingAndroid} className="btn-ghost text-xs disabled:opacity-50">
          {shippingAndroid ? '…' : '🤖 Play'}
        </button>
      </div>

      <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
          <input type="checkbox" checked={isPublic} onChange={(e) => togglePublic(e.target.checked)} disabled={savingVis} />
          <span className="text-white/70">{isPublic ? '🌍 Public on /discover' : 'Private'}</span>
        </label>
        {isPublic && (
          <input
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            onBlur={saveTagline}
            placeholder="One-line tagline"
            maxLength={120}
            className="text-xs rounded bg-white/10 px-2 py-1 outline-none focus:ring-1 focus:ring-flame max-w-[55%]" />
        )}
      </div>

      {openDomain && (
        <div className="mt-3 pt-3 border-t border-white/10 text-xs">
          <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="myapp.com"
            className="w-full rounded bg-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-flame" />
          <div className="text-white/50 mt-2">Add a CNAME at your DNS provider: <code className="text-white/70">{(domain.trim() || 'yourdomain') + ' → apps.stakgod.com'}</code> (proxied through Cloudflare).</div>
          <div className="flex gap-2 mt-3">
            <button onClick={attach} disabled={busy || !domain.trim()} className="btn-primary text-xs !py-2 flex-1 disabled:opacity-50">
              {busy ? '…' : (app.custom_domain ? 'Update' : 'Attach')}
            </button>
            {app.custom_domain && <button onClick={detach} disabled={busy} className="btn-ghost text-xs !py-2 disabled:opacity-50">Detach</button>}
          </div>
          {msg && <div className="mt-2 text-white/70">{msg}</div>}
        </div>
      )}
    </div>
  );
}

'use client';
import { useEffect, useState } from 'react';

const API = 'https://api.stakgod.com';

interface Stats {
  goal_cents: number;
  cost_per_founder_cents: number;
  raised_cents: number;
  supporters: number;
  founders_funded: number;
  pct: number;
  recent: Array<{ name: string; amount_cents: number; message: string | null; ts: number }>;
  grants: Array<{ handle: string; app_url: string | null; kind: string; ts: number }>;
}

const QUICK_AMOUNTS = [25, 99, 250];

export default function Support() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [amount, setAmount] = useState<number | ''>(99);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch(`${API}/tips/stats`).then((r) => r.json()).then(setStats);
    if (typeof window !== 'undefined' && new URLSearchParams(location.search).get('thx')) {
      setTimeout(() => fetch(`${API}/tips/stats`).then((r) => r.json()).then(setStats), 1500);
    }
  }, []);

  async function tip() {
    if (!amount || amount < 2) { setErr('Minimum tip is $2'); return; }
    setBusy(true); setErr('');
    const r = await fetch(`${API}/tips/checkout`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        amount_cents: Math.round(Number(amount) * 100),
        supporter_name: name.trim(),
        message: message.trim(),
        anonymous,
      }),
    });
    setBusy(false);
    if (!r.ok) { setErr(((await r.json()) as { error?: string }).error ?? 'failed'); return; }
    const { url } = await r.json();
    location.href = url;
  }

  const showThx = typeof window !== 'undefined' && new URLSearchParams(location.search).get('thx');

  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      {showThx && (
        <div className="card border-emerald-500/40 bg-emerald-500/10 mb-8 text-center">
          <div className="text-3xl">🙏</div>
          <div className="font-display text-2xl mt-2">You just funded a founder.</div>
          <div className="text-sm text-white/70 mt-1">We&apos;ll publish your grant in the ledger below within 48 hours.</div>
        </div>
      )}

      <h1 className="font-display text-5xl md:text-6xl leading-tight">
        The First <span className="text-gold">100 Founders</span> Fund.
      </h1>
      <p className="mt-4 text-white/80 text-lg leading-relaxed max-w-2xl">
        Apple charges <b>$99/yr</b> to publish on the App Store. For a 17-year-old in Manila who just built her first app with Stackgod, that&apos;s a wall.
        We&apos;re funding it for her.
      </p>
      <p className="mt-3 text-white/70 max-w-2xl">
        Every <b className="text-flame">$99</b> here pays a year of Apple Developer enrollment for a builder who shipped through Stackgod but
        can&apos;t afford the fee. They publish, they earn, and at $50 of revenue they&apos;re asked to fund the next founder.
        <b className="text-white"> A flywheel of funded founders.</b>
      </p>
      <p className="mt-3 text-white/60 max-w-2xl">
        Stackgod takes <b>0%</b>. 100% of tips go to Apple/Google fees. Public ledger below — every grant traceable.
      </p>

      {/* Progress + counters */}
      <div className="card mt-10">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <div className="text-xs uppercase tracking-wider text-white/50">Raised</div>
            <div className="font-display text-4xl mt-1">${stats ? (stats.raised_cents / 100).toLocaleString() : '0'}<span className="text-white/40 text-base"> / ${stats ? (stats.goal_cents / 100).toLocaleString() : '10,000'}</span></div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wider text-white/50">Founders funded</div>
            <div className="font-display text-4xl mt-1 text-gold">{stats?.founders_funded ?? 0}<span className="text-white/40 text-base"> / 100</span></div>
          </div>
        </div>
        <div className="h-3 rounded-full bg-white/5 mt-5 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-flame to-gold transition-all" style={{ width: `${stats?.pct ?? 0}%` }} />
        </div>
        <div className="mt-2 text-xs text-white/50">{stats?.supporters ?? 0} supporters</div>
      </div>

      {/* Tip form */}
      <div className="card mt-6">
        <div className="font-display text-2xl">Fund a founder</div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {QUICK_AMOUNTS.map((a) => (
            <button key={a} onClick={() => setAmount(a)}
              className={`rounded-xl py-4 font-semibold border transition ${amount === a ? 'bg-flame text-white border-flame' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}>
              ${a}{a === 99 && <div className="text-[10px] opacity-70 mt-0.5">= 1 founder</div>}
            </button>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2 text-white/60">
          <span>or</span>
          <span className="text-white/80">$</span>
          <input
            type="number" min={2} max={1000} value={amount}
            onChange={(e) => setAmount(e.target.value === '' ? '' : Math.max(2, Math.min(1000, +e.target.value)))}
            className="flex-1 rounded-xl bg-white/10 px-4 py-3 outline-none focus:ring-2 focus:ring-flame" />
        </div>
        <div className="mt-3 grid md:grid-cols-2 gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (optional)"
            maxLength={80}
            className="rounded-xl bg-white/10 px-4 py-3 outline-none focus:ring-2 focus:ring-flame" />
          <label className="flex items-center gap-2 text-sm text-white/70 px-2">
            <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
            Show me as Anonymous
          </label>
        </div>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Public note for the founder you&rsquo;re funding (optional)"
          maxLength={280} rows={2}
          className="mt-3 w-full rounded-xl bg-white/10 px-4 py-3 outline-none focus:ring-2 focus:ring-flame resize-none" />
        <button onClick={tip} disabled={busy || !amount} className="btn-primary mt-4 w-full text-lg disabled:opacity-50">
          {busy ? 'Opening Stripe…' : `Tip $${amount || 0} →`}
        </button>
        {err && <div className="mt-2 text-sm text-red-400">{err}</div>}
        <div className="mt-3 text-center text-xs text-white/40">Secure checkout via Stripe. No card data ever touches Stackgod.</div>
      </div>

      {/* Recent supporters */}
      {stats && stats.recent.length > 0 && (
        <div className="mt-10">
          <h2 className="font-display text-2xl">Recent supporters</h2>
          <div className="mt-4 grid md:grid-cols-2 gap-3">
            {stats.recent.map((t, i) => (
              <div key={i} className="card !py-3 !px-4">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="font-semibold truncate">{t.name}</div>
                  <div className="text-flame font-bold">${(t.amount_cents / 100).toLocaleString()}</div>
                </div>
                {t.message && <div className="text-sm text-white/70 mt-1 italic">&ldquo;{t.message}&rdquo;</div>}
                <div className="text-xs text-white/40 mt-1">{new Date(t.ts * 1000).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grant ledger */}
      <div className="mt-10">
        <h2 className="font-display text-2xl">Grant ledger <span className="text-white/50 text-sm font-normal">— every dollar accounted for</span></h2>
        {stats && stats.grants.length > 0 ? (
          <div className="mt-4 card !p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-left text-white/60 text-xs uppercase">
                <tr><th className="p-3">Recipient</th><th className="p-3">App</th><th className="p-3">Kind</th><th className="p-3">Date</th></tr>
              </thead>
              <tbody>
                {stats.grants.map((g, i) => (
                  <tr key={i} className="border-t border-white/5">
                    <td className="p-3 font-mono">{g.handle}</td>
                    <td className="p-3">{g.app_url ? <a className="text-flame hover:underline" href={g.app_url} target="_blank" rel="noreferrer">{g.app_url.replace(/^https?:\/\//, '')}</a> : '—'}</td>
                    <td className="p-3 uppercase text-xs">{g.kind === 'apple_99' ? '🍎 Apple' : g.kind === 'google_25' ? '🤖 Google' : g.kind}</td>
                    <td className="p-3 text-white/60">{new Date(g.ts * 1000).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="card mt-4 text-white/60">First grants land the moment we hit $99. Be the spark.</div>
        )}
      </div>

      <div className="mt-12 text-center text-xs text-white/40">
        Questions? <a href="mailto:hello@stakgod.com" className="text-flame">hello@stakgod.com</a>
      </div>
    </div>
  );
}

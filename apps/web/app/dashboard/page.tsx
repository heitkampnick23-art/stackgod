'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface App { id: string; slug: string; name: string; status: string; }
interface Usage { messages: number; cost: number; }

export default function Dashboard() {
  const [apps, setApps] = useState<App[]>([]);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [plan, setPlan] = useState('free');

  useEffect(() => {
    fetch('https://api.stakgod.com/apps', { credentials: 'include' }).then(r => r.ok ? r.json() : { apps: [] }).then((d: { apps: App[] }) => setApps(d.apps));
    fetch('https://api.stakgod.com/builder/usage', { credentials: 'include' }).then(r => r.ok ? r.json() : null).then((d: { today: Usage; plan: string } | null) => { if (d) { setUsage(d.today); setPlan(d.plan); } });
  }, []);

  async function connectStripe() {
    const r = await fetch('https://api.stakgod.com/billing/connect/onboard', { method: 'POST', credentials: 'include' });
    const { url } = await r.json<{ url: string }>();
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

      <h2 className="font-display text-2xl mt-12">Your apps</h2>
      <div className="mt-4 grid md:grid-cols-3 gap-4">
        {apps.length === 0 && <div className="card text-white/50">No apps yet. <Link href="/build" className="text-flame">Start building →</Link></div>}
        {apps.map((a) => (
          <Link key={a.id} href={`/build?app=${a.id}`} className="card hover:border-flame/40 transition block">
            <div className="font-semibold">{a.name}</div>
            <div className="text-xs text-white/50 mt-1">{a.slug}.stakgod.app</div>
            <div className="mt-3 inline-block text-xs px-2 py-0.5 rounded bg-white/10">{a.status}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

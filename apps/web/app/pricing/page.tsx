'use client';

import Link from 'next/link';
import { useState } from 'react';

type Cycle = 'month' | 'year';

const TIERS = [
  { id: 'free',   name: 'Free',   monthly: 0,   yearly: 0,    tag: 'Try it', features: ['5 AI messages / day', '1 app', 'subdomain on stakgod.com', 'Stakgod branding'] },
  { id: 'hobby',  name: 'Hobby',  monthly: 19,  yearly: 190,  tag: 'Indie',  features: ['200 messages / mo', '3 apps', '1 custom domain', 'Email support'] },
  { id: 'pro',    name: 'Pro',    monthly: 49,  yearly: 490,  tag: 'Most popular', highlight: true, features: ['1,500 messages / mo', 'Unlimited apps', 'Stripe Connect (sell subs)', 'TestFlight ship', 'Custom domains'] },
  { id: 'studio', name: 'Studio', monthly: 149, yearly: 1490, tag: 'Power',  features: ['6,000 messages / mo', 'App Store + Play submit', 'Marketplace listing', 'Priority Opus routing', 'Slack support'] },
];

export default function Pricing() {
  const [cycle, setCycle] = useState<Cycle>('month');
  return (
    <div className="max-w-6xl mx-auto px-6 py-20">
      <div className="text-center">
        <h1 className="font-display text-5xl">Pricing built for shipping.</h1>
        <p className="mt-3 text-white/60">Start free. The wall hits fast — by design.</p>

        <div className="mt-8 inline-flex rounded-full border border-white/10 bg-white/5 p-1">
          <button onClick={() => setCycle('month')} className={`px-5 py-2 rounded-full text-sm font-semibold ${cycle==='month' ? 'bg-flame text-white' : 'text-white/70'}`}>Monthly</button>
          <button onClick={() => setCycle('year')} className={`px-5 py-2 rounded-full text-sm font-semibold ${cycle==='year' ? 'bg-flame text-white' : 'text-white/70'}`}>Annual <span className="text-gold">· 2 months free</span></button>
        </div>
      </div>

      <div className="mt-12 grid md:grid-cols-4 gap-4">
        {TIERS.map((t) => {
          const price = cycle === 'year' ? Math.round(t.yearly / 12) : t.monthly;
          const billed = cycle === 'year' && t.yearly > 0 ? `$${t.yearly}/yr billed annually` : null;
          return (
            <div key={t.id} className={`card relative ${t.highlight ? 'border-flame/60 ring-1 ring-flame/30' : ''}`}>
              {t.highlight && <div className="absolute -top-3 left-6 bg-flame text-white text-xs font-bold px-2 py-0.5 rounded">{t.tag}</div>}
              <div className="text-sm text-white/50">{!t.highlight && t.tag}</div>
              <h3 className="font-display text-2xl">{t.name}</h3>
              <div className="mt-2 text-4xl font-bold">${price}<span className="text-base text-white/50">/mo</span></div>
              {billed && <div className="text-xs text-white/50 mt-1">{billed}</div>}
              <ul className="mt-4 space-y-2 text-sm text-white/70">
                {t.features.map((f) => <li key={f} className="flex gap-2"><span className="text-flame">✓</span>{f}</li>)}
              </ul>
              <button onClick={() => upgrade(t.id, cycle)} className={`mt-6 w-full ${t.highlight ? 'btn-primary' : 'btn-ghost'}`}>
                {t.id === 'free' ? 'Start free' : `Get ${t.name}`}
              </button>
            </div>
          );
        })}
      </div>
      <div className="mt-16 text-center text-sm text-white/50">
        Need more? <Link href="/contact" className="text-gold underline">Talk to us</Link> about Enterprise.
      </div>
    </div>
  );
}

async function upgrade(plan: string, cycle: Cycle) {
  if (plan === 'free') { location.href = '/build'; return; }
  const r = await fetch('https://api.stakgod.com/billing/checkout', {
    method: 'POST', credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ plan, cycle }),
  });
  if (r.status === 401) { location.href = `/login?next=/pricing`; return; }
  const { url } = await r.json();
  if (url) location.href = url;
}

'use client';

import Link from 'next/link';

const TIERS = [
  { id: 'free',   name: 'Free',   price: 0,   tag: 'Try it', features: ['5 AI messages / day', '1 app', 'subdomain on stakgod.app', 'Stackgod branding'] },
  { id: 'hobby',  name: 'Hobby',  price: 19,  tag: 'Indie',  features: ['200 messages / mo', '3 apps', '1 custom domain', 'Email support'] },
  { id: 'pro',    name: 'Pro',    price: 49,  tag: 'Most popular', highlight: true, features: ['1,500 messages / mo', 'Unlimited apps', 'Stripe Connect (sell subs)', 'TestFlight ship', 'Custom domains'] },
  { id: 'studio', name: 'Studio', price: 149, tag: 'Power',  features: ['6,000 messages / mo', 'App Store + Play submit', 'Marketplace listing', 'Priority Opus routing', 'Slack support'] },
];

export default function Pricing() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-20">
      <div className="text-center">
        <h1 className="font-display text-5xl">Pricing built for shipping.</h1>
        <p className="mt-3 text-white/60">Start free. Upgrade the second your free tier hits the wall — we make sure it does fast, on purpose.</p>
      </div>
      <div className="mt-12 grid md:grid-cols-4 gap-4">
        {TIERS.map((t) => (
          <div key={t.id} className={`card relative ${t.highlight ? 'border-flame/60 ring-1 ring-flame/30' : ''}`}>
            {t.highlight && <div className="absolute -top-3 left-6 bg-flame text-white text-xs font-bold px-2 py-0.5 rounded">{t.tag}</div>}
            <div className="text-sm text-white/50">{!t.highlight && t.tag}</div>
            <h3 className="font-display text-2xl">{t.name}</h3>
            <div className="mt-2 text-4xl font-bold">${t.price}<span className="text-base text-white/50">/mo</span></div>
            <ul className="mt-4 space-y-2 text-sm text-white/70">
              {t.features.map((f) => <li key={f} className="flex gap-2"><span className="text-flame">✓</span>{f}</li>)}
            </ul>
            <button
              onClick={() => upgrade(t.id)}
              className={`mt-6 w-full ${t.highlight ? 'btn-primary' : 'btn-ghost'}`}
            >
              {t.id === 'free' ? 'Start free' : `Get ${t.name}`}
            </button>
          </div>
        ))}
      </div>
      <div className="mt-16 text-center text-sm text-white/50">
        Need more? <Link href="/contact" className="text-gold underline">Talk to us</Link> about Enterprise.
      </div>
    </div>
  );
}

async function upgrade(plan: string) {
  if (plan === 'free') { location.href = '/build'; return; }
  const r = await fetch('https://api.stakgod.com/billing/checkout', {
    method: 'POST', credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ plan }),
  });
  if (r.status === 401) { location.href = `/login?next=/pricing`; return; }
  const { url } = await r.json<{ url: string }>();
  if (url) location.href = url;
}

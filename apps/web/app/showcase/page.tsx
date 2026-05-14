// Visual feature gallery — exactly the "see what we offer" UX from Hercules,
// but interactive. Each card opens a live demo of the capability.

'use client';

import { useState } from 'react';

const DEMOS = [
  { id: 'chat',    title: 'Chat → App in 30s',     blurb: 'Streaming Claude builds your UI live, in a phone frame.', preview: chatPreview() },
  { id: 'auth',    title: 'Sign in with Apple',    blurb: 'Real Apple + Google + magic link, wired in seconds.',     preview: authPreview() },
  { id: 'pay',     title: 'Sell SaaS subs',        blurb: 'Stripe Connect Express. Your customers pay you directly.', preview: payPreview() },
  { id: 'domain',  title: 'Buy a domain in-app',   blurb: '.com from $10.77. Cloudflare wholesale + flat $1 fee.',    preview: domainPreview() },
  { id: 'ios',     title: 'Ship to TestFlight',    blurb: 'Native SwiftUI generated. Uploaded via App Store Connect API.', preview: iosPreview() },
  { id: 'android', title: 'Ship to Google Play',   blurb: 'Native Compose generated. Uploaded to Play internal track.',    preview: androidPreview() },
  { id: 'data',    title: 'D1 + R2 baked in',      blurb: 'Real Postgres-style DB and S3-style storage on Cloudflare.',    preview: dataPreview() },
  { id: 'push',    title: 'Push, email, SMS',      blurb: 'Campaign tools live the moment your app does.',               preview: pushPreview() },
  { id: 'market',  title: 'Marketplace rev-share', blurb: 'List your app as a template. Earn forever.',                  preview: marketPreview() },
];

export default function Showcase() {
  const [active, setActive] = useState(DEMOS[0].id);
  const cur = DEMOS.find((d) => d.id === active)!;
  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      <h1 className="font-display text-5xl">See everything Stackgod ships with.</h1>
      <p className="mt-2 text-white/60">Click any feature to see it run.</p>

      <div className="mt-10 grid lg:grid-cols-[280px_1fr] gap-6">
        <div className="space-y-2">
          {DEMOS.map((d) => (
            <button key={d.id} onClick={() => setActive(d.id)}
              className={`w-full text-left card !py-3 !px-4 transition ${active === d.id ? 'border-flame/60 bg-flame/10' : 'hover:bg-white/5'}`}>
              <div className="font-semibold">{d.title}</div>
              <div className="text-xs text-white/50 mt-0.5">{d.blurb}</div>
            </button>
          ))}
        </div>
        <div className="card min-h-[480px]">
          <div className="text-xs uppercase tracking-wider text-white/40">Live demo</div>
          <h2 className="font-display text-2xl mt-1">{cur.title}</h2>
          <div className="mt-6">{cur.preview}</div>
        </div>
      </div>
    </div>
  );
}

function chatPreview() {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="rounded-xl bg-black/40 border border-white/10 p-4 text-sm font-mono text-white/80 h-[320px] overflow-auto">
        <div className="text-flame">$ build a habit tracker with streaks</div>
        <div className="mt-2 text-white/60">→ generating SwiftUI + web preview…</div>
        <div className="mt-1 text-white/60">→ wiring Sign in with Apple…</div>
        <div className="mt-1 text-white/60">→ adding D1 schema (habits, checkins)…</div>
        <div className="mt-1 text-white/60">→ deploying to habit-tracker-x9k2.stakgod.app</div>
        <div className="mt-2 text-emerald-400">✓ live in 24s</div>
      </div>
      <div className="rounded-[36px] border-4 border-white/20 bg-gradient-to-b from-amber-500/30 to-flame/30 h-[320px] p-6 text-center flex flex-col justify-center">
        <div className="text-5xl">🔥</div>
        <div className="mt-3 font-bold text-2xl">12 day streak</div>
        <div className="text-white/70 text-sm">Meditate · Read · Code</div>
      </div>
    </div>
  );
}
function authPreview() { return <div className="rounded-xl bg-black/40 p-8 text-center"><button className="btn bg-white text-black w-full">  Sign in with Apple</button><button className="btn bg-white/10 text-white w-full mt-3">G  Continue with Google</button><button className="btn bg-white/10 text-white w-full mt-3">✉ Email me a magic link</button></div>; }
function payPreview() { return <div className="rounded-xl bg-black/40 p-6 text-sm"><div className="text-white/60">Your customer’s checkout</div><div className="mt-3 rounded bg-white text-black p-4"><div className="font-bold">Pro plan — $19/mo</div><div className="mt-3 h-10 rounded bg-black text-white grid place-items-center font-semibold">Pay $19</div></div><div className="mt-4 text-emerald-400">→ $17.10 to you, $1.90 to Stackgod (10%)</div></div>; }
function domainPreview() { return <div className="rounded-xl bg-black/40 p-6"><input defaultValue="myhabits" className="w-full rounded bg-white/10 px-4 py-3 outline-none" /><div className="mt-4 space-y-2 text-sm"><Row d="myhabits.com" p="$10.77" /><Row d="myhabits.app" p="$14.98" /><Row d="myhabits.dev" p="$12.78" /></div></div>; }
function Row({ d, p }: { d: string; p: string }) { return <div className="flex justify-between rounded bg-white/5 px-4 py-2"><span>{d}</span><span className="text-gold">{p} <button className="ml-3 btn-primary !py-1 !px-3 text-xs">Buy</button></span></div>; }
function iosPreview() { return <div className="rounded-xl bg-black/40 p-6 text-sm font-mono text-white/80"><div>$ stackgod ship ios</div><div className="text-white/60 mt-2">→ generating SwiftUI project…</div><div className="text-white/60">→ archiving release.ipa…</div><div className="text-white/60">→ uploading to App Store Connect…</div><div className="text-emerald-400 mt-2">✓ TestFlight build 1.0.3 (47) processing — live in ~8 min</div></div>; }
function androidPreview() { return <div className="rounded-xl bg-black/40 p-6 text-sm font-mono text-white/80"><div>$ stackgod ship android</div><div className="text-white/60 mt-2">→ Compose build → release.aab</div><div className="text-emerald-400 mt-2">✓ Uploaded to Play internal track</div></div>; }
function dataPreview() { return <div className="rounded-xl bg-black/40 p-6 text-sm font-mono"><div className="text-flame">SELECT * FROM habits WHERE user_id = ?</div><pre className="mt-3 text-white/70">{`[
  { id: 1, name: "Meditate", streak: 12 },
  { id: 2, name: "Read",     streak: 4  }
]`}</pre></div>; }
function pushPreview() { return <div className="rounded-xl bg-black/40 p-6"><div className="rounded bg-white/10 p-4"><div className="text-xs text-white/50">Push notification</div><div className="font-semibold">🔥 Don’t break your 12-day streak!</div><div className="text-sm text-white/60">Tap to check in.</div></div><div className="mt-4 text-xs text-white/50">Sent to 4,219 users · open rate 38%</div></div>; }
function marketPreview() { return <div className="rounded-xl bg-black/40 p-6"><div className="grid grid-cols-3 gap-3 text-xs">{['Habit Tracker','Recipe Box','Linktree clone','Tip jar','Wedding RSVP','Newsletter'].map(n=><div key={n} className="rounded bg-white/5 p-3">{n}<div className="text-white/40 mt-1">$2.50 fork</div></div>)}</div></div>; }

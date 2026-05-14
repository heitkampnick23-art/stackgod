import Link from 'next/link';

export default function Home() {
  return (
    <>
      <section className="glow">
        <div className="max-w-6xl mx-auto px-6 pt-24 pb-20 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
            <span className="size-1.5 rounded-full bg-flame" /> Live now — built on Cloudflare
          </div>
          <h1 className="mt-6 font-display text-5xl md:text-7xl leading-tight">
            Speak it. <span className="text-gold">Ship it.</span> Own it.
          </h1>
          <p className="mt-6 text-lg md:text-xl text-white/70 max-w-2xl mx-auto">
            Describe your app. Stackgod writes it, hosts it, sells subscriptions for you, and ships it to the App Store and Google Play — all in one chat.
          </p>
          <div className="mt-8 flex gap-4 justify-center">
            <Link href="/build" className="btn-primary">Start building free</Link>
            <Link href="/showcase" className="btn-ghost">See it in action</Link>
          </div>
          <div className="mt-12 text-xs text-white/40">5 free AI messages a day. No card. Upgrade when you outgrow it.</div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-16 grid md:grid-cols-3 gap-6">
        {FEATURES.map((f) => (
          <div key={f.title} className="card">
            <div className="text-2xl">{f.emoji}</div>
            <h3 className="mt-3 font-semibold text-lg">{f.title}</h3>
            <p className="mt-2 text-sm text-white/60">{f.body}</p>
          </div>
        ))}
      </section>

      <section className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="font-display text-3xl md:text-4xl">Everything baked in.</h2>
        <p className="mt-2 text-white/60 max-w-xl">No glue code. Auth, payments, domains, mobile builds, AI — already wired the day you start.</p>
        <div className="mt-8 grid md:grid-cols-4 gap-3 text-sm">
          {STACK.map((s) => (
            <div key={s} className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">{s}</div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-20 text-center">
        <h2 className="font-display text-3xl md:text-5xl">Be in the App Store by Friday.</h2>
        <p className="mt-3 text-white/60">Stackgod generates a real native iOS + Android app from your chat and uploads it to TestFlight and Play.</p>
        <Link href="/build" className="btn-primary mt-8">Start free →</Link>
      </section>
    </>
  );
}

const FEATURES = [
  { emoji: '⚡', title: 'AI builder, native', body: 'Claude Opus 4.7 routes hard problems; Haiku 4.5 handles edits. You never pick the model — we save you credits.' },
  { emoji: '💳', title: 'Sell subscriptions day one', body: 'Stripe Connect Express baked in. Your buyers, your money, weekly payouts. We take 10%, no setup.' },
  { emoji: '🌐', title: 'Buy domains in one click', body: 'Cloudflare Registrar wholesale + a flat $1 fee. .com from $10.77. DNS auto-attaches to your app.' },
  { emoji: '📱', title: 'Ship to App Store + Play', body: 'Real native SwiftUI + Compose, not a wrapper. TestFlight in 60 seconds.' },
  { emoji: '🛡️', title: 'Auth, DB, storage, email', body: 'Sign in with Apple + Google + magic link, D1, R2, Resend — all live the moment you say "go".' },
  { emoji: '🪙', title: 'Marketplace rev-share', body: 'List your finished app as a template. Earn every time someone forks it.' },
];

const STACK = ['Cloudflare Pages', 'Workers', 'D1 Postgres', 'R2 Storage', 'Queues', 'KV', 'Workers AI', 'Durable Objects', 'Stripe Connect', 'Apple Sign In', 'Google Sign In', 'Resend Email', 'Anthropic Claude', 'CF Registrar', 'GitHub Actions', 'TestFlight'];

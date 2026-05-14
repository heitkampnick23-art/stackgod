import Link from 'next/link';

export default function Home() {
  return (
    <>
      <section className="relative glass-stage min-h-[90vh] flex items-center">
        <div className="hero-bg" aria-hidden />
        <div className="relative z-10 max-w-6xl mx-auto px-6 pt-24 pb-20 text-center w-full">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 backdrop-blur-md px-3 py-1 text-xs text-white/80">
            <span className="size-1.5 rounded-full bg-flame animate-pulse" /> Live now — built on Cloudflare
          </div>
          <h1 className="mt-6 font-display text-6xl md:text-8xl leading-tight tracking-tight drop-shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
            Speak it. <span className="text-gold">Ship it.</span> Own it.
          </h1>
          <p className="mt-6 text-lg md:text-xl text-white/80 max-w-2xl mx-auto drop-shadow-[0_4px_16px_rgba(0,0,0,0.6)]">
            Describe your app. Stackgod writes it, hosts it, sells subscriptions for you, and ships it to the App Store and Google Play — all in one chat.
          </p>
          <div className="mt-10 flex gap-4 justify-center">
            <Link href="/build" className="btn-primary text-lg px-8 py-4">Start building free</Link>
            <Link href="/showcase" className="btn-ghost text-lg px-8 py-4">See it in action</Link>
          </div>
          <div className="mt-12 text-xs text-white/50">5 free AI messages a day. No card. Upgrade when you outgrow it.</div>
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
            <div key={s} className="rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-md px-4 py-3 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]">{s}</div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-20 text-center">
        <h2 className="font-display text-3xl md:text-5xl">Be in the App Store by Friday.</h2>
        <p className="mt-3 text-white/60">Stackgod generates a real native iOS + Android app from your chat and uploads it to TestFlight and Play.</p>
        <Link href="/build" className="btn-primary mt-8">Start free →</Link>
      </section>

      {/* Founders Fund */}
      <section className="max-w-5xl mx-auto px-6 py-12">
        <div className="card border-gold/30 ring-1 ring-gold/10">
          <div className="grid md:grid-cols-[1fr_auto] gap-6 items-center">
            <div>
              <div className="text-xs uppercase tracking-widest text-gold">The First 100 Founders Fund</div>
              <h3 className="font-display text-3xl mt-2">Fund a founder. <span className="text-gold">$99 = 1 app shipped.</span></h3>
              <p className="mt-2 text-white/70">
                Apple charges $99/yr. For builders who can&apos;t pay it, that&apos;s the wall. Tip here and we cover their fee — they ship,
                they earn, they fund the next one. Stackgod takes 0%. Public ledger.
              </p>
            </div>
            <Link href="/support" className="btn-primary whitespace-nowrap">Fund a founder →</Link>
          </div>
        </div>
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

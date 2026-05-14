import Link from 'next/link';

export default function Docs() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      <h1 className="font-display text-5xl">Docs</h1>
      <p className="mt-3 text-white/60">Everything you need to ship with Stackgod.</p>

      <div className="mt-12 grid md:grid-cols-2 gap-4">
        {SECTIONS.map((s) => (
          <div key={s.title} className="card">
            <h2 className="font-display text-2xl">{s.title}</h2>
            <p className="text-sm text-white/60 mt-2">{s.body}</p>
          </div>
        ))}
      </div>

      <h2 className="font-display text-3xl mt-16">Quickstart</h2>
      <ol className="mt-4 space-y-3 text-white/80 list-decimal list-inside">
        <li>Sign up at <Link href="/login" className="text-flame">stakgod.com/login</Link></li>
        <li>Open the <Link href="/build" className="text-flame">builder</Link> and describe your app</li>
        <li>Watch it stream into the live preview</li>
        <li>Hit the credit wall? <Link href="/pricing" className="text-flame">Upgrade</Link> — start at $19/mo</li>
        <li>Ready to sell? <Link href="/dashboard" className="text-flame">Connect Stripe</Link> from the dashboard</li>
        <li>Buy a domain in-flow — wholesale + $1 platform fee</li>
        <li>Studio plan? Ship to App Store + Play in one click</li>
      </ol>

      <h2 className="font-display text-3xl mt-16">Limits + pricing</h2>
      <table className="mt-4 w-full text-sm border border-white/10 rounded-xl overflow-hidden">
        <thead className="bg-white/5">
          <tr><th className="text-left p-3">Plan</th><th className="text-left p-3">Messages</th><th className="text-left p-3">Apps</th><th className="text-left p-3">Ships</th></tr>
        </thead>
        <tbody>
          <tr className="border-t border-white/5"><td className="p-3">Free</td><td className="p-3">5/day</td><td className="p-3">1</td><td className="p-3">subdomain</td></tr>
          <tr className="border-t border-white/5"><td className="p-3">Hobby $19</td><td className="p-3">200/mo</td><td className="p-3">3</td><td className="p-3">1 custom domain</td></tr>
          <tr className="border-t border-white/5"><td className="p-3">Pro $49</td><td className="p-3">1,500/mo</td><td className="p-3">∞</td><td className="p-3">+ TestFlight + Stripe Connect</td></tr>
          <tr className="border-t border-white/5"><td className="p-3">Studio $149</td><td className="p-3">6,000/mo</td><td className="p-3">∞</td><td className="p-3">+ App Store + Play submit</td></tr>
        </tbody>
      </table>

      <h2 className="font-display text-3xl mt-16">Help</h2>
      <p className="mt-3 text-white/70">Email <a href="mailto:hello@stakgod.com" className="text-flame">hello@stakgod.com</a> for anything.</p>
    </div>
  );
}

const SECTIONS = [
  { title: 'AI Builder', body: 'Chat with Claude Opus 4.7 / Sonnet 4.6 / Haiku 4.5. We pick the model so you save credits.' },
  { title: 'Auth', body: 'Sign in with Apple, Google, or magic-link email. No SDK to wire — already done.' },
  { title: 'Database', body: 'Each app gets a Cloudflare D1 database. Postgres-compatible, edge-replicated.' },
  { title: 'Storage', body: 'R2 buckets per app for images, files, .ipa/.aab artifacts.' },
  { title: 'Payments', body: 'Stripe Connect Express. Your customers, your money, weekly payouts. We take 10%.' },
  { title: 'Custom domains', body: 'Buy through us at Cloudflare wholesale + $1. DNS + SSL auto-attach.' },
  { title: 'Mobile shipping', body: 'Real native SwiftUI + Compose generated from your spec. Auto-uploaded to TestFlight + Play.' },
  { title: 'Marketplace', body: 'Studio: list your finished app as a template. Earn rev-share when others fork.' },
];

import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Stackgod — Speak it. Ship it. Own it.',
  description: 'AI app builder. Ship to web, App Store, and Google Play. Sell SaaS subs, buy domains, all in-flow.',
  metadataBase: new URL('https://stakgod.com'),
  openGraph: { title: 'Stackgod', description: 'AI app builder for the App Store generation.', url: 'https://stakgod.com' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <header className="sticky top-0 z-50 backdrop-blur-xl backdrop-saturate-150 bg-ink/50 border-b border-white/10">
          <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
            <Link href="/" className="font-display text-xl tracking-wider"><span className="text-gold">STACK</span>GOD</Link>
            <nav className="hidden md:flex gap-8 text-sm text-white/70">
              <Link href="/templates" className="hover:text-white">Templates</Link>
              <Link href="/showcase" className="hover:text-white">Showcase</Link>
              <Link href="/pricing" className="hover:text-white">Pricing</Link>
              <Link href="/docs" className="hover:text-white">Docs</Link>
              <Link href="/support" className="text-gold hover:text-amber-200">Fund a founder</Link>
            </nav>
            <div className="flex gap-3">
              <Link href="/login" className="text-sm text-white/80 hover:text-white">Sign in</Link>
              <Link href="/build" className="btn-primary text-sm py-2 px-4">Start free</Link>
            </div>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-white/10 mt-24 backdrop-blur-xl bg-ink/40">
          <div className="max-w-6xl mx-auto px-6 py-12 grid md:grid-cols-4 gap-8 text-sm text-white/60">
            <div>
              <div className="font-display text-lg text-white"><span className="text-gold">STACK</span>GOD</div>
              <p className="mt-2">Built on Cloudflare. Powered by Claude.</p>
            </div>
            <div>
              <div className="text-white font-semibold mb-2">Product</div>
              <ul className="space-y-1"><li><Link href="/showcase">Showcase</Link></li><li><Link href="/pricing">Pricing</Link></li><li><Link href="/docs">Docs</Link></li></ul>
            </div>
            <div>
              <div className="text-white font-semibold mb-2">Company</div>
              <ul className="space-y-1"><li><Link href="/about">About</Link></li><li><a href="mailto:hello@stakgod.com">Contact</a></li></ul>
            </div>
            <div>
              <div className="text-white font-semibold mb-2">Legal</div>
              <ul className="space-y-1"><li><Link href="/terms">Terms</Link></li><li><Link href="/privacy">Privacy</Link></li></ul>
            </div>
          </div>
          <div className="text-center text-xs text-white/40 pb-8">© {new Date().getFullYear()} Stackgod, Inc.</div>
        </footer>
      </body>
    </html>
  );
}

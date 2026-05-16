import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';
import HeaderActions from './_components/header-actions';
import LaunchBanner from './_components/launch-banner';

export const metadata: Metadata = {
  metadataBase: new URL('https://stakgod.com'),
  title: { default: 'Stakgod — AI app builder. 16 backend primitives. Open source.', template: '%s — Stakgod' },
  description: 'Open-source Lovable that ships to the App Store. Every app you generate via chat gets 16 baked-in primitives: auth, db, AI, Stripe, push, file uploads, email, geo, cron, queue, share, embed.',
  applicationName: 'Stakgod',
  keywords: ['ai app builder', 'lovable alternative', 'hercules alternative', 'no code', 'cloudflare workers', 'claude', 'app store builder', 'open source app builder'],
  authors: [{ name: 'Stakgod', url: 'https://stakgod.com' }],
  creator: 'Stakgod',
  openGraph: {
    type: 'website',
    url: 'https://stakgod.com',
    siteName: 'Stakgod',
    title: 'Stakgod — AI app builder. 16 backend primitives. Open source.',
    description: 'Chat to a real app. Auth, payments, AI, push — baked in. Ship to TestFlight by lunch.',
    images: [{ url: '/api/og?title=Speak%20it.%20Ship%20it.%20Own%20it.&subtitle=Open-source%20Lovable%20with%2016%20baked-in%20primitives%20%2B%20iOS%20shipping', width: 1200, height: 630, alt: 'Stakgod' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Stakgod — AI app builder, open source, ships to App Store',
    description: 'Chat to a real app with 16 baked-in primitives. Open source. Ships to TestFlight by lunch.',
    images: ['/api/og?title=Speak%20it.%20Ship%20it.%20Own%20it.&subtitle=Open-source%20Lovable%20with%2016%20baked-in%20primitives%20%2B%20iOS%20shipping'],
  },
  alternates: { canonical: 'https://stakgod.com' },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:px-3 focus:py-2 focus:bg-flame focus:text-white focus:rounded-full text-sm font-semibold">Skip to content</a>
        <LaunchBanner />
        <header className="sticky top-0 z-50 backdrop-blur-xl backdrop-saturate-150 bg-ink/50 border-b border-white/10">
          <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
            <Link href="/" aria-label="Stakgod home" className="font-display text-xl tracking-wider"><span className="text-gold">STAK</span>GOD</Link>
            <nav aria-label="Primary" className="hidden md:flex gap-6 text-sm text-white/70">
              <Link href="/discover" className="hover:text-white">Discover</Link>
              <Link href="/templates" className="hover:text-white">Templates</Link>
              <Link href="/showcase" className="hover:text-white">Showcase</Link>
              <Link href="/pricing" className="hover:text-white">Pricing</Link>
              <Link href="/changelog" className="hover:text-white">Changelog</Link>
              <Link href="/docs" className="hover:text-white">Docs</Link>
              <Link href="/support" className="text-gold hover:text-amber-200">Fund a founder</Link>
            </nav>
            <HeaderActions />
          </div>
        </header>
        <main id="main" className="flex-1">{children}</main>
        <footer className="border-t border-white/10 mt-24 backdrop-blur-xl bg-ink/40">
          <div className="max-w-6xl mx-auto px-6 py-12 grid md:grid-cols-4 gap-8 text-sm text-white/60">
            <div>
              <div className="font-display text-lg text-white"><span className="text-gold">STAK</span>GOD</div>
              <p className="mt-2">Built on Cloudflare. Powered by Claude.</p>
            </div>
            <div>
              <div className="text-white font-semibold mb-2">Product</div>
              <ul className="space-y-1"><li><Link href="/discover">Discover</Link></li><li><Link href="/templates">Templates</Link></li><li><Link href="/showcase">Showcase</Link></li><li><Link href="/pricing">Pricing</Link></li><li><Link href="/docs">Docs</Link></li><li><Link href="/changelog">Changelog</Link></li></ul>
            </div>
            <div>
              <div className="text-white font-semibold mb-2">Community</div>
              <ul className="space-y-1">
                <li><a href="https://github.com/heitkampnick23-art/stackgod" target="_blank" rel="noreferrer">⭐ GitHub</a></li>
                <li><a href="https://discord.gg/stakgod" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#5865F2]" />Discord</a></li>
                <li><a href="https://twitter.com/stakgod" target="_blank" rel="noreferrer">𝕏 / Twitter</a></li>
                <li><Link href="/support">🪙 Founders Fund</Link></li>
                <li><Link href="/press">📰 Press kit</Link></li>
                <li><a href="mailto:hello@stakgod.com">📨 Contact</a></li>
              </ul>
            </div>
            <div>
              <div className="text-white font-semibold mb-2">Legal</div>
              <ul className="space-y-1"><li><Link href="/terms">Terms</Link></li><li><Link href="/privacy">Privacy</Link></li></ul>
            </div>
          </div>
          <div className="text-center text-xs text-white/40 pb-8">© {new Date().getFullYear()} Stakgod, Inc.</div>
        </footer>
      </body>
    </html>
  );
}

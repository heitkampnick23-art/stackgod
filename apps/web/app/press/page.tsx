// Press kit — one page where journalists/podcasters/investors get
// everything they need: logos, screenshots, boilerplate, founder bio, contact.
// Optimized for "I'll write about it tomorrow" moments.

import type { Metadata } from 'next';
import Link from 'next/link';

export const runtime = 'edge';
export const revalidate = 3600;

const OG_PRESS = '/api/og?title=Press%20Kit&subtitle=Logos%2C%20screenshots%2C%20boilerplate%20%26%20founder%20bio&kind=press';

export const metadata: Metadata = {
  title: 'Press kit — Stakgod',
  description: 'Logos, screenshots, founder bio, and boilerplate for journalists writing about Stakgod.',
  alternates: { canonical: 'https://stakgod.com/press' },
  openGraph: {
    title: 'Stakgod — press kit',
    description: 'Everything you need to write about Stakgod.',
    images: [OG_PRESS],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Stakgod — press kit',
    description: 'Everything you need to write about Stakgod.',
    images: [OG_PRESS],
  },
};

const FACTS = [
  ['Name', 'Stakgod'],
  ['Tagline', 'Speak it. Ship it. Own it.'],
  ['Category', 'AI app builder · ships to web + iOS App Store + Google Play'],
  ['Stack', 'Cloudflare Workers + D1 + R2 + Workers AI · Anthropic Claude (Opus 4.7 / Sonnet 4.6 / Haiku 4.5)'],
  ['Pricing', 'Free (5 messages/day) · Hobby $19 · Pro $49 · Studio $149'],
  ['License', 'Source MIT-licensed on GitHub'],
  ['Founded', '2026 by Nick Heitkamp (heitkampnick23@gmail.com)'],
  ['HQ', 'United States · fully remote'],
  ['Press contact', 'press@stakgod.com'],
];

const QUOTES = [
  '"We compress the time between idea and shipped product to under ten minutes — for the App Store, not just a web preview."',
  '"Builders own their apps end-to-end. Their domain, their Apple Developer account, their Stripe Connect — we are infrastructure, not a landlord."',
  '"Free tier is intentionally tight. We would rather a paying customer love us than ten freeloaders tolerate us."',
];

export default function Press() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <div className="text-center max-w-2xl mx-auto">
        <div className="text-xs uppercase tracking-[0.2em] text-flame font-bold">Press kit</div>
        <h1 className="font-display text-5xl mt-3">Write about Stakgod.</h1>
        <p className="mt-3 text-white/70">Everything you need on one page. Logos, screenshots, boilerplate, founder bio, contact. Hot-link assets — they&rsquo;re hosted on our CDN.</p>
        <div className="mt-6 flex justify-center gap-3">
          <a href="mailto:press@stakgod.com?subject=Press%20inquiry%20%E2%80%94%20Stakgod" className="btn-primary">Email press@stakgod.com →</a>
          <a href="/press/stakgod-press-kit.zip" className="btn-ghost">Download full kit (.zip)</a>
        </div>
      </div>

      {/* Quick facts */}
      <section id="facts" className="mt-16">
        <h2 className="font-display text-2xl">Quick facts</h2>
        <div className="mt-4 card !p-0 overflow-hidden">
          <table className="w-full text-sm">
            <tbody>
              {FACTS.map(([k, v]) => (
                <tr key={k} className="border-t border-white/5 first:border-t-0">
                  <td className="p-3 text-white/50 w-44 align-top">{k}</td>
                  <td className="p-3 text-white">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Boilerplate — copy/paste ready */}
      <section id="boilerplate" className="mt-12">
        <h2 className="font-display text-2xl">Boilerplate</h2>
        <p className="text-sm text-white/50 mt-1">Copy and use as-is. No approval needed.</p>

        <Block title="Short (one sentence — 28 words)">
          Stakgod is an AI app builder where you describe what you want, watch it appear in seconds, and ship the finished product to the web, iOS App Store, or Google Play.
        </Block>

        <Block title="Medium (one paragraph — 78 words)">
          Stakgod turns plain English into shipped apps. You chat with Claude, the result auto-deploys to a live URL in under ten seconds, and one button publishes it to the iOS App Store or Google Play under your own developer account. Builders own their domains, their Stripe accounts, and their source code — Stakgod is infrastructure, not a landlord. Built on Cloudflare Workers, D1, and Anthropic&rsquo;s newest Claude models. Source code is MIT-licensed on GitHub.
        </Block>

        <Block title="Long (two paragraphs — 165 words)">
          Stakgod is a chat-to-app platform that compresses the entire ship cycle &mdash; from blank page to App Store binary &mdash; into a single conversation. A user types &ldquo;a habit tracker with sign-in&rdquo; and within ten seconds has a live, deployed web app at a permanent URL. Click any button to ask Claude to change it. Press one more button to ship it to TestFlight or Google Play under your own developer account.
          {' '}Stakgod is built on Cloudflare&rsquo;s edge stack &mdash; Workers, D1, R2, KV, Durable Objects &mdash; and routes between Anthropic&rsquo;s Claude Opus 4.7, Sonnet 4.6, and Haiku 4.5 based on task difficulty. Every shipped app gets a built-in mini-backend (database, auth, payments, push, AI, file uploads, email, cron) auto-injected as the {`window.sg`} SDK, so builders never wire infrastructure. The platform is open source under the MIT license, real-time-collaborative via Durable Objects, and intentionally hostile to freeloading: the free tier is five AI messages a day.
        </Block>

        <Block title="Founder bio (Nick Heitkamp — 60 words)">
          Nick Heitkamp is a self-taught developer who shipped Stakgod after years of frustration that &ldquo;build a real app&rdquo; still meant six months of glue code. He believes the next million apps will be written in plain English by people who never call themselves engineers. He lives in the United States and ships from a single bedroom every day.
        </Block>
      </section>

      {/* Quotes */}
      <section id="quotes" className="mt-12">
        <h2 className="font-display text-2xl">Quotes</h2>
        <p className="text-sm text-white/50 mt-1">Attribute to Nick Heitkamp, founder of Stakgod.</p>
        <div className="mt-4 grid gap-3">
          {QUOTES.map((q) => (
            <blockquote key={q} className="card text-white/85 italic">{q}</blockquote>
          ))}
        </div>
      </section>

      {/* Logos */}
      <section id="logos" className="mt-12">
        <h2 className="font-display text-2xl">Logos &amp; wordmark</h2>
        <p className="text-sm text-white/50 mt-1">Full color, white, and dark variants. SVG preferred for print.</p>
        <div className="mt-4 grid sm:grid-cols-2 md:grid-cols-3 gap-4">
          <LogoTile bg="#0a0a0f" label="Wordmark on dark" />
          <LogoTile bg="#ffffff" label="Wordmark on light" textColor="#0a0a0f" goldColor="#b8941f" />
          <LogoTile bg="#ff5b1f" label="Wordmark on flame" textColor="#ffffff" goldColor="#fff" />
        </div>
      </section>

      {/* Screenshots */}
      <section id="screenshots" className="mt-12">
        <h2 className="font-display text-2xl">Screenshots</h2>
        <p className="text-sm text-white/50 mt-1">High-res. Hot-link or download.</p>
        <div className="mt-4 grid sm:grid-cols-2 gap-4">
          <ShotTile title="Builder — chat + live preview" caption="Type, watch it appear, click any element to edit." href="/press/screenshot-builder.png" />
          <ShotTile title="Discover — app gallery" caption="Real apps people shipped. Click Remix to fork." href="/press/screenshot-discover.png" />
          <ShotTile title="Dashboard — your forge" caption="Apps, builds, revenue, custom domains." href="/press/screenshot-dashboard.png" />
          <ShotTile title="One-click ship to App Store" caption="TestFlight in 60 seconds. Production submit one click later." href="/press/screenshot-ship.png" />
        </div>
      </section>

      {/* Story angles */}
      <section id="angles" className="mt-12">
        <h2 className="font-display text-2xl">Story angles</h2>
        <ul className="mt-4 grid gap-2 text-white/85">
          <li className="card">📱 <strong>The first AI builder that actually ships to the App Store.</strong> Most chat-to-app tools stop at a web preview. Stakgod automates the full Apple submission &mdash; xcodegen, code-signing, ASC API upload &mdash; so non-engineers can publish native iOS apps under their own developer account.</li>
          <li className="card">⚙️ <strong>Built entirely on Cloudflare&rsquo;s edge.</strong> Zero AWS, zero Vercel. Workers, D1, R2, KV, Durable Objects, Workers AI &mdash; a stress test of how far Cloudflare&rsquo;s primitives can go for an AI-native product.</li>
          <li className="card">🔓 <strong>Open source where Hercules.app is closed.</strong> MIT on GitHub. Real moat is speed, brand, and community &mdash; not the codebase.</li>
          <li className="card">🧱 <strong>Builders own everything.</strong> Their domain, Apple cert, Stripe Connect account, source. Stakgod is infrastructure, not a landlord.</li>
          <li className="card">💰 <strong>Aggressively narrow free tier.</strong> 5 AI messages/day. The bet: pricing honesty beats viral &ldquo;free forever&rdquo; in a world where AI inference actually costs money.</li>
        </ul>
      </section>

      {/* Quick links */}
      <section id="links" className="mt-12">
        <h2 className="font-display text-2xl">Quick links</h2>
        <ul className="mt-4 grid sm:grid-cols-2 gap-2 text-flame">
          <li><Link href="/">→ Landing page</Link></li>
          <li><Link href="/discover">→ Live app gallery</Link></li>
          <li><Link href="/showcase">→ Feature tour</Link></li>
          <li><Link href="/pricing">→ Pricing</Link></li>
          <li><Link href="/changelog">→ Changelog</Link></li>
          <li><a href="https://github.com/heitkampnick23-art/stackgod" target="_blank" rel="noreferrer">→ Source on GitHub</a></li>
        </ul>
      </section>

      {/* Final contact */}
      <section className="mt-16 card text-center !p-8 border-gold/20">
        <div className="text-xs uppercase tracking-[0.2em] text-gold font-bold">On deadline?</div>
        <p className="mt-2 text-white/85">Email <a href="mailto:press@stakgod.com" className="text-flame underline">press@stakgod.com</a> &mdash; replies within a few hours, founder reachable.</p>
      </section>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="mt-3 card !p-0 overflow-hidden group" open>
      <summary className="px-4 py-3 cursor-pointer flex items-center justify-between bg-white/5 list-none">
        <span className="font-semibold text-sm">{title}</span>
        <span className="text-white/40 text-xs">click to copy</span>
      </summary>
      <p className="p-4 text-white/85 leading-relaxed">{children}</p>
    </details>
  );
}

function LogoTile({ bg, label, textColor = '#ffffff', goldColor = '#d4af37' }: { bg: string; label: string; textColor?: string; goldColor?: string }) {
  return (
    <div className="card !p-0 overflow-hidden">
      <div className="aspect-[16/9] grid place-items-center" style={{ background: bg }}>
        <div className="font-display text-4xl tracking-wider" style={{ color: textColor, fontFamily: 'Cinzel, serif' }}>
          <span style={{ color: goldColor }}>STAK</span>GOD
        </div>
      </div>
      <div className="p-3 text-xs text-white/60 flex items-center justify-between">
        <span>{label}</span>
        <span className="text-white/40">SVG · PNG</span>
      </div>
    </div>
  );
}

function ShotTile({ title, caption, href }: { title: string; caption: string; href: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="card !p-0 overflow-hidden block hover:border-flame/40 transition">
      <div className="aspect-video bg-gradient-to-br from-flame/20 via-ink to-gold/10 grid place-items-center text-white/40 text-xs uppercase tracking-wider">
        {title}
      </div>
      <div className="p-3">
        <div className="font-semibold text-sm">{title}</div>
        <div className="text-xs text-white/60 mt-1">{caption}</div>
      </div>
    </a>
  );
}

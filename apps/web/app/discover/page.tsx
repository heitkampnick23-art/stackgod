// Server-rendered shell so Google + AI crawlers see actual app cards.
// Interactivity (sort/search/load-more) is in <DiscoverGrid/> client island.

import type { Metadata } from 'next';
import Link from 'next/link';
import DiscoverGrid from './_grid';

const API = 'https://api.stakgod.com';

export const runtime = 'edge';
export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Discover apps shipped on Stakgod',
  description: 'Real, working apps people built by talking to Claude. Click any to use it. Click Remix to make it your own — fork the entire app in one click.',
  alternates: { canonical: 'https://stakgod.com/discover' },
  openGraph: {
    title: 'Discover apps shipped on Stakgod',
    description: 'Real apps people built in chat. Open + Remix any of them.',
    url: 'https://stakgod.com/discover',
    images: ['/api/og?title=Discover&subtitle=Apps%20people%20shipped%20by%20talking%20to%20Claude&kind=discover'],
  },
};

interface DApp {
  slug: string; name: string; description: string | null; url: string;
  updated_at: number; view_count: number; fork_price_cents?: number;
}
interface LeaderboardApp { slug: string; name: string; tagline: string | null; url: string; view_count: number; }
interface LeaderboardBuilder { handle: string; name: string | null; avatar_url: string | null; apps: number; total_views: number; revenue_cents: number; }

async function fetchJson<T>(url: string, fallback: T): Promise<T> {
  try {
    const r = await fetch(url, { next: { revalidate: 60 } });
    if (!r.ok) return fallback;
    return (await r.json()) as T;
  } catch { return fallback; }
}

export default async function Discover() {
  const [first, lb, builders] = await Promise.all([
    fetchJson<{ apps: DApp[]; next_cursor: number | null }>(`${API}/discover?cursor=0&sort=fresh`, { apps: [], next_cursor: null }),
    fetchJson<{ apps: LeaderboardApp[] }>(`${API}/discover/leaderboard`, { apps: [] }),
    fetchJson<{ builders: LeaderboardBuilder[] }>(`${API}/users/leaderboard?by=views&limit=5`, { builders: [] }),
  ]);

  // Schema.org: ItemList of SoftwareApplication for rich snippets.
  const jsonLd = first.apps.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Apps shipped on Stakgod',
    itemListElement: first.apps.slice(0, 24).map((a, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: a.url,
      name: a.name,
      ...(a.description ? { description: a.description } : {}),
    })),
  } : null;

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />}
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="font-display text-5xl">Apps shipped on Stakgod.</h1>
        <p className="mt-3 text-white/60">Real, working apps people built by talking to Claude. Click any to use it. Click Remix to make it yours.</p>
      </div>

      {lb.apps.length > 0 && (
        <div className="mt-12">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-display text-2xl">🏆 Top apps this week</h2>
            <div className="text-xs text-white/40">By views</div>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {lb.apps.slice(0, 5).map((a, i) => (
              <a key={a.slug} href={a.url} target="_blank" rel="noreferrer" className="card !p-3 hover:border-flame/40 transition flex items-center gap-3">
                <div className="text-2xl font-display text-gold w-6 shrink-0">{i + 1}</div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`https://apps.stakgod.com/${a.slug}/icon.png`} alt="" loading="lazy" className="w-10 h-10 rounded-lg object-cover bg-white/5 border border-white/10 shrink-0" />
                <div className="min-w-0">
                  <div className="font-semibold text-sm truncate">{a.name}</div>
                  <div className="text-xs text-white/50">{a.view_count.toLocaleString()} views</div>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {builders.builders.length > 0 && (
        <div className="mt-12">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-display text-2xl">⚒️ Top builders</h2>
            <div className="text-xs text-white/40">By total views across their public apps</div>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {builders.builders.map((b, i) => (
              <Link key={b.handle} href={`/u/${b.handle}`} className="card !p-3 hover:border-flame/40 transition flex items-center gap-3">
                <div className="text-2xl font-display text-gold w-6 shrink-0">{i + 1}</div>
                {b.avatar_url
                  /* eslint-disable-next-line @next/next/no-img-element */
                  ? <img src={b.avatar_url} alt="" loading="lazy" className="w-10 h-10 rounded-full object-cover bg-white/5 border border-white/10 shrink-0" />
                  : <div className="w-10 h-10 rounded-full bg-gradient-to-br from-flame to-gold grid place-items-center text-white font-display shrink-0">{(b.name || b.handle).slice(0, 1).toUpperCase()}</div>}
                <div className="min-w-0">
                  <div className="font-semibold text-sm truncate">{b.name || `@${b.handle}`}</div>
                  <div className="text-xs text-white/50">{b.apps} app{b.apps === 1 ? '' : 's'} · {b.total_views.toLocaleString()} views</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <DiscoverGrid initial={first} />
    </div>
  );
}

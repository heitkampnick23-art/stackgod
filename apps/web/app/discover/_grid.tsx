'use client';
import { useState } from 'react';

const API = 'https://api.stakgod.com';

interface DApp {
  slug: string; name: string; description: string | null; url: string;
  updated_at: number; view_count: number; views_24h?: number; fork_price_cents?: number;
}

export default function DiscoverGrid({ initial }: { initial: { apps: DApp[]; next_cursor: number | null } }) {
  const [apps, setApps] = useState<DApp[]>(initial.apps);
  const [cursor, setCursor] = useState<number | null>(initial.next_cursor);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'fresh' | 'top'>('fresh');
  const [loading, setLoading] = useState(false);

  async function load(c: number, query: string, s: 'fresh' | 'top') {
    setLoading(true);
    const r = await fetch(`${API}/discover?cursor=${c}&sort=${s}${query ? `&q=${encodeURIComponent(query)}` : ''}`);
    const d = (await r.json()) as { apps: DApp[]; next_cursor: number | null };
    setApps((prev) => (c === 0 ? d.apps : [...prev, ...d.apps]));
    setCursor(d.next_cursor);
    setLoading(false);
  }

  function search(query: string) { setQ(query); load(0, query, sort); }
  function changeSort(s: 'fresh' | 'top') { setSort(s); load(0, q, s); }

  return (
    <>
      <div className="mt-12 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
        <div className="flex rounded-full bg-white/5 backdrop-blur-md p-1 text-xs">
          <button onClick={() => changeSort('fresh')} className={`px-4 py-1.5 rounded-full font-semibold ${sort === 'fresh' ? 'bg-white text-black' : 'text-white/60 hover:text-white'}`}>🌱 Fresh</button>
          <button onClick={() => changeSort('top')} className={`px-4 py-1.5 rounded-full font-semibold ${sort === 'top' ? 'bg-white text-black' : 'text-white/60 hover:text-white'}`}>🔥 Top</button>
        </div>
        <input
          value={q}
          onChange={(e) => search(e.target.value)}
          placeholder="Search apps…"
          aria-label="Search public apps"
          className="w-full sm:max-w-sm rounded-full bg-white/10 px-5 py-3 outline-none focus:ring-2 focus:ring-flame backdrop-blur-md"
        />
      </div>

      {apps.length === 0 && !loading && (
        <div className="card mt-12 text-center text-white/60">
          No public apps yet. <a href="/dashboard" className="text-flame">Make yours public</a> to be the first.
        </div>
      )}

      <div className="mt-10 grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {apps.map((a) => (
          <article key={a.slug} className="card !p-0 overflow-hidden flex flex-col relative">
            {(a.views_24h ?? 0) >= 10 && (
              <div className="absolute top-3 left-3 z-10 inline-flex items-center gap-1 rounded-full bg-flame/95 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow-lg shadow-flame/30 backdrop-blur-sm" title={`${a.views_24h} views in the last 24h`}>
                🔥 Trending
              </div>
            )}
            <div className="bg-white">
              <iframe
                src={a.url}
                className="w-full h-[280px] border-0 pointer-events-none"
                loading="lazy"
                sandbox="allow-scripts allow-same-origin"
                title={a.name} />
            </div>
            <div className="p-4 flex-1 flex flex-col">
              <div className="flex items-start gap-3 mb-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`https://apps.stakgod.com/${a.slug}/icon.png`} alt="" loading="lazy" className="w-10 h-10 rounded-lg object-cover bg-white/5 border border-white/10 shrink-0" />
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-lg truncate">{a.name}</h3>
                  {a.description && <div className="text-sm text-white/60 mt-1 line-clamp-2">{a.description}</div>}
                  <div className="text-xs text-white/40 mt-1">{new Date(a.updated_at * 1000).toLocaleDateString()}{a.view_count > 0 ? ` · ${a.view_count} views` : ''}</div>
                </div>
              </div>
              <div className="flex gap-2 mt-auto">
                <a href={a.url} target="_blank" rel="noreferrer" className="btn-ghost text-xs !py-2 flex-1 text-center">Open ↗</a>
                <a href={`/build?fork=${a.slug}`} className="btn-primary text-xs !py-2 flex-1 text-center">
                  {a.fork_price_cents && a.fork_price_cents > 0 ? `Buy $${(a.fork_price_cents / 100).toFixed(0)} →` : 'Remix →'}
                </a>
              </div>
            </div>
          </article>
        ))}
      </div>

      {cursor !== null && (
        <div className="mt-8 text-center">
          <button onClick={() => load(cursor, q, sort)} disabled={loading} className="btn-ghost disabled:opacity-50">
            {loading ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </>
  );
}

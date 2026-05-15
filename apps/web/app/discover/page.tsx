'use client';
import { useEffect, useState } from 'react';

const API = 'https://api.stakgod.com';

interface DApp {
  slug: string;
  name: string;
  description: string | null;
  url: string;
  updated_at: number;
  view_count: number;
}

interface LeaderboardApp { slug: string; name: string; tagline: string | null; url: string; view_count: number; }

export default function Discover() {
  const [apps, setApps] = useState<DApp[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardApp[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'fresh' | 'top'>('fresh');
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(0, '', sort); fetch(`${API}/discover/leaderboard`).then(r => r.json()).then(d => setLeaderboard(d.apps ?? [])); }, []);

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
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="font-display text-5xl">Apps shipped on Stakgod.</h1>
        <p className="mt-3 text-white/60">Real, working apps people built by talking to Claude. Click any to use it. Click Remix to make it yours.</p>
      </div>

      {leaderboard.length > 0 && (
        <div className="mt-12">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-display text-2xl">🏆 Top apps this week</h2>
            <div className="text-xs text-white/40">By views</div>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {leaderboard.slice(0, 5).map((a, i) => (
              <a key={a.slug} href={a.url} target="_blank" rel="noreferrer" className="card !p-3 hover:border-flame/40 transition flex items-center gap-3">
                <div className="text-2xl font-display text-gold w-6 shrink-0">{i + 1}</div>
                <img src={`https://apps.stakgod.com/${a.slug}/icon.png`} alt="" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} className="w-10 h-10 rounded-lg object-cover bg-white/5 border border-white/10 shrink-0" />
                <div className="min-w-0">
                  <div className="font-semibold text-sm truncate">{a.name}</div>
                  <div className="text-xs text-white/50">{a.view_count.toLocaleString()} views</div>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="mt-12 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
        <div className="flex rounded-full bg-white/5 backdrop-blur-md p-1 text-xs">
          <button onClick={() => changeSort('fresh')} className={`px-4 py-1.5 rounded-full font-semibold ${sort === 'fresh' ? 'bg-white text-black' : 'text-white/60 hover:text-white'}`}>🌱 Fresh</button>
          <button onClick={() => changeSort('top')}   className={`px-4 py-1.5 rounded-full font-semibold ${sort === 'top'   ? 'bg-white text-black' : 'text-white/60 hover:text-white'}`}>🔥 Top</button>
        </div>
        <input
          value={q}
          onChange={(e) => search(e.target.value)}
          placeholder="Search apps…"
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
          <div key={a.slug} className="card !p-0 overflow-hidden flex flex-col">
            <div className="bg-white">
              <iframe
                src={a.url}
                className="w-full h-[280px] border-0 pointer-events-none"
                loading="lazy"
                sandbox="allow-scripts allow-same-origin" />
            </div>
            <div className="p-4 flex-1 flex flex-col">
              <div className="flex items-start gap-3 mb-3">
                <img
                  src={`https://apps.stakgod.com/${a.slug}/icon.png`}
                  alt=""
                  loading="lazy"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  className="w-10 h-10 rounded-lg object-cover bg-white/5 border border-white/10 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="font-display text-lg truncate">{a.name}</div>
                  {a.description && <div className="text-sm text-white/60 mt-1 line-clamp-2">{a.description}</div>}
                  <div className="text-xs text-white/40 mt-1">{new Date(a.updated_at * 1000).toLocaleDateString()}{a.view_count > 0 ? ` · ${a.view_count} views` : ''}</div>
                </div>
              </div>
              <div className="flex gap-2 mt-auto">
                <a href={a.url} target="_blank" rel="noreferrer" className="btn-ghost text-xs !py-2 flex-1 text-center">Open ↗</a>
                <a href={`/build?fork=${a.slug}`} className="btn-primary text-xs !py-2 flex-1 text-center">Remix →</a>
              </div>
            </div>
          </div>
        ))}
      </div>

      {cursor !== null && (
        <div className="mt-8 text-center">
          <button onClick={() => load(cursor, q, sort)} disabled={loading} className="btn-ghost disabled:opacity-50">
            {loading ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}

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

export default function Discover() {
  const [apps, setApps] = useState<DApp[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(0, ''); }, []);

  async function load(c: number, query: string) {
    setLoading(true);
    const r = await fetch(`${API}/discover?cursor=${c}${query ? `&q=${encodeURIComponent(query)}` : ''}`);
    const d = (await r.json()) as { apps: DApp[]; next_cursor: number | null };
    setApps((prev) => (c === 0 ? d.apps : [...prev, ...d.apps]));
    setCursor(d.next_cursor);
    setLoading(false);
  }

  function search(query: string) {
    setQ(query);
    load(0, query);
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="font-display text-5xl">Apps shipped on Stakgod.</h1>
        <p className="mt-3 text-white/60">Real, working apps people built by talking to Claude. Click any to use it. Click Remix to make it yours.</p>
      </div>

      <div className="mt-8 flex justify-center">
        <input
          value={q}
          onChange={(e) => search(e.target.value)}
          placeholder="Search apps…"
          className="w-full max-w-md rounded-full bg-white/10 px-5 py-3 outline-none focus:ring-2 focus:ring-flame backdrop-blur-md"
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
              <div className="font-display text-lg">{a.name}</div>
              {a.description && <div className="text-sm text-white/60 mt-1 line-clamp-2">{a.description}</div>}
              <div className="text-xs text-white/40 mt-2">{new Date(a.updated_at * 1000).toLocaleDateString()}{a.view_count > 0 ? ` · ${a.view_count} views` : ''}</div>
              <div className="flex gap-2 mt-3">
                <a href={a.url} target="_blank" rel="noreferrer" className="btn-ghost text-xs !py-2 flex-1 text-center">Open ↗</a>
                <a href={`/build?fork=${a.slug}`} className="btn-primary text-xs !py-2 flex-1 text-center">Remix →</a>
              </div>
            </div>
          </div>
        ))}
      </div>

      {cursor !== null && (
        <div className="mt-8 text-center">
          <button onClick={() => load(cursor, q)} disabled={loading} className="btn-ghost disabled:opacity-50">
            {loading ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}

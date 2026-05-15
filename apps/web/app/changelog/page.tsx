// Live changelog from git. SSR'd at the edge so HN/PH visitors see fresh ship-count.

const API = 'https://api.stakgod.com';
export const runtime = 'edge';
export const revalidate = 300;

interface Entry { sha: string; kind: string; scope: string | null; title: string; body: string; date: string; url: string; }

const KIND_STYLES: Record<string, { label: string; cls: string }> = {
  feat:     { label: 'feat',     cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  fix:      { label: 'fix',      cls: 'bg-red-500/15 text-red-300 border-red-500/30' },
  infra:    { label: 'infra',    cls: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
  perf:     { label: 'perf',     cls: 'bg-violet-500/15 text-violet-300 border-violet-500/30' },
  chore:    { label: 'chore',    cls: 'bg-white/10 text-white/60 border-white/20' },
  docs:     { label: 'docs',     cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  refactor: { label: 'refactor', cls: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' },
  misc:     { label: 'misc',     cls: 'bg-white/10 text-white/60 border-white/20' },
};

export const metadata = {
  title: 'Changelog — Stakgod',
  description: 'What we shipped this week. Pulled live from git.',
};

export default async function Changelog() {
  const r = await fetch(`${API}/changelog`, { next: { revalidate: 300 } });
  const { entries }: { entries: Entry[] } = r.ok ? await r.json() : { entries: [] };

  // Group by ISO date.
  const byDay = new Map<string, Entry[]>();
  for (const e of entries) {
    const d = e.date.slice(0, 10);
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d)!.push(e);
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="font-display text-5xl">Changelog</h1>
        <p className="mt-3 text-white/60">Every commit, pulled live from <a href="https://github.com/heitkampnick23-art/stackgod/commits/main" className="text-flame underline">git</a> every 5 minutes.</p>
      </div>

      <div className="mt-12 space-y-10">
        {Array.from(byDay.entries()).map(([day, items]) => (
          <div key={day}>
            <div className="text-xs uppercase tracking-widest text-white/40 mb-3">{new Date(day).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</div>
            <ul className="space-y-3">
              {items.map((e) => {
                const style = KIND_STYLES[e.kind] ?? KIND_STYLES.misc;
                return (
                  <li key={e.sha} className="card !p-4">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border ${style.cls}`}>{style.label}{e.scope && ` · ${e.scope}`}</span>
                      <a href={e.url} target="_blank" rel="noreferrer" className="text-white/30 hover:text-white/60 text-xs font-mono">{e.sha}</a>
                      <div className="text-sm font-semibold flex-1 min-w-0">{e.title}</div>
                    </div>
                    {e.body && <pre className="mt-2 text-xs text-white/60 whitespace-pre-wrap font-sans leading-relaxed">{e.body}</pre>}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        {entries.length === 0 && <div className="text-center text-white/40">No entries yet.</div>}
      </div>
    </div>
  );
}

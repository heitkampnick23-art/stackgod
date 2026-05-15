import Link from 'next/link';
import type { Metadata } from 'next';

const API = 'https://api.stakgod.com';
export const runtime = 'edge';
export const revalidate = 60;

interface Props { params: Promise<{ handle: string; slug: string }> }

interface Data {
  app: {
    slug: string; name: string; tagline: string | null; description: string | null;
    url: string; icon_url: string; view_count: number;
    created_at: number; updated_at: number; fork_price_cents: number;
  };
  builder: { handle: string; name: string | null; avatar_url: string | null; bio: string | null };
}

async function load(handle: string, slug: string): Promise<Data | null> {
  const r = await fetch(`${API}/users/${handle}/apps/${slug}`, { next: { revalidate: 60 } });
  return r.ok ? r.json() : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle, slug } = await params;
  const data = await load(handle, slug);
  if (!data) return { title: 'Not found' };
  const title = data.app.name;
  const subtitle = data.app.tagline || `Built by @${data.builder.handle}`;
  const ogUrl = `/api/og?title=${encodeURIComponent(title)}&subtitle=${encodeURIComponent('By @' + data.builder.handle + ' · ' + subtitle.slice(0, 60))}&kind=app`;
  return {
    title,
    description: subtitle,
    openGraph: { title, description: subtitle, url: `/u/${handle}/${slug}`, images: [{ url: ogUrl, width: 1200, height: 630, alt: title }] },
    twitter: { card: 'summary_large_image', title, description: subtitle, images: [ogUrl] },
    alternates: { canonical: `https://stakgod.com/u/${handle}/${slug}` },
  };
}

export default async function AppPage({ params }: Props) {
  const { handle, slug } = await params;
  const data = await load(handle, slug);
  if (!data) {
    return <div className="max-w-2xl mx-auto px-6 py-24 text-center">
      <h1 className="font-display text-4xl">App not found</h1>
      <p className="mt-3 text-white/60">Maybe it&apos;s private, or the link is wrong.</p>
      <Link href={`/u/${handle}`} className="text-flame underline mt-4 inline-block">@{handle}&apos;s profile</Link>
    </div>;
  }
  const a = data.app, b = data.builder;
  const priced = a.fork_price_cents > 0;
  const remixHref = `/build?fork=${a.slug}`;

  return (
    <article className="max-w-5xl mx-auto px-6 py-12">
      {/* Hero */}
      <div className="card !p-6">
        <div className="flex flex-col md:flex-row gap-6 items-start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={a.icon_url} alt="" className="w-24 h-24 rounded-2xl object-cover bg-white/5 border border-white/10 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 className="font-display text-3xl md:text-4xl">{a.name}</h1>
              <span className="text-xs text-white/40">{a.view_count.toLocaleString()} views</span>
              {priced && <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">${(a.fork_price_cents / 100).toFixed(0)} fork</span>}
            </div>
            {a.tagline && <p className="mt-2 text-white/70 text-lg">{a.tagline}</p>}
            <div className="mt-4 flex items-center gap-3 text-sm">
              <Link href={`/u/${b.handle}`} className="flex items-center gap-2 text-white/60 hover:text-white">
                {b.avatar_url
                  /* eslint-disable-next-line @next/next/no-img-element */
                  ? <img src={b.avatar_url} alt="" className="w-6 h-6 rounded-full" />
                  : <span className="w-6 h-6 rounded-full bg-white/10 grid place-items-center text-xs font-bold">{(b.name?.[0] ?? b.handle[0]).toUpperCase()}</span>}
                <span>by <b className="text-white">{b.name ?? '@' + b.handle}</b> <span className="text-white/40">@{b.handle}</span></span>
              </Link>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <a href={a.url} target="_blank" rel="noreferrer" className="btn-primary text-sm">Open app ↗</a>
              <Link href={remixHref} className="btn-ghost text-sm">{priced ? `Remix · $${(a.fork_price_cents / 100).toFixed(0)}` : 'Remix →'}</Link>
              <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(a.name + ' — ' + (a.tagline ?? 'Built on Stakgod'))}&url=${encodeURIComponent('https://stakgod.com/u/' + b.handle + '/' + a.slug)}`} target="_blank" rel="noreferrer" className="btn-ghost text-sm">Share on X</a>
            </div>
          </div>
        </div>
      </div>

      {/* Live preview */}
      <div className="mt-6 rounded-2xl overflow-hidden border border-white/10 bg-white">
        <iframe src={a.url} className="w-full h-[600px] border-0" loading="lazy" title={a.name} />
      </div>

      {/* About + builder */}
      <div className="mt-8 grid md:grid-cols-[1fr_280px] gap-6">
        <div>
          <h2 className="font-display text-xl">About</h2>
          <p className="mt-2 text-white/70 text-sm leading-relaxed">{a.description || 'No description yet.'}</p>
          <div className="mt-4 text-xs text-white/50">
            Created {new Date(a.created_at * 1000).toLocaleDateString()} · Updated {new Date(a.updated_at * 1000).toLocaleDateString()} · Built on <Link href="/" className="text-flame underline">Stakgod</Link>
          </div>
        </div>
        <aside className="card !p-4">
          <div className="text-xs uppercase tracking-wider text-white/40">Builder</div>
          <div className="mt-2 flex items-center gap-3">
            {b.avatar_url
              /* eslint-disable-next-line @next/next/no-img-element */
              ? <img src={b.avatar_url} alt="" className="w-10 h-10 rounded-full" />
              : <span className="w-10 h-10 rounded-full bg-white/10 grid place-items-center text-sm font-bold">{(b.name?.[0] ?? b.handle[0]).toUpperCase()}</span>}
            <div>
              <div className="font-semibold text-sm">{b.name ?? '@' + b.handle}</div>
              <Link href={`/u/${b.handle}`} className="text-xs text-flame">@{b.handle}</Link>
            </div>
          </div>
          {b.bio && <p className="mt-3 text-xs text-white/60">{b.bio}</p>}
          <Link href={`/u/${b.handle}`} className="mt-4 btn-ghost text-xs w-full">More from @{b.handle}</Link>
        </aside>
      </div>
    </article>
  );
}

import Link from 'next/link';
import { notFound } from 'next/navigation';

export const runtime = 'edge';
export const revalidate = 60;

interface Props { params: { handle: string } }
interface ProfileResp {
  profile: {
    handle: string;
    name: string | null;
    bio: string | null;
    avatar_url: string | null;
    twitter: string | null;
    website: string | null;
    builder_since: number;
    stats: { apps: number; total_views: number };
  };
  apps: Array<{ slug: string; name: string; tagline: string | null; url: string; view_count: number; updated_at: number }>;
}

async function load(handle: string): Promise<ProfileResp | null> {
  const r = await fetch(`https://api.stakgod.com/users/${encodeURIComponent(handle)}`, { cache: 'no-store' });
  if (!r.ok) return null;
  return r.json();
}

export async function generateMetadata({ params }: Props) {
  const data = await load(params.handle);
  if (!data) return { title: 'Builder not found' };
  const name = data.profile.name || `@${data.profile.handle}`;
  return {
    title: `${name} on Stakgod`,
    description: data.profile.bio || `${data.profile.stats.apps} apps shipped on Stakgod.`,
    openGraph: { title: `${name} on Stakgod`, description: data.profile.bio || `${data.profile.stats.apps} apps shipped` },
  };
}

export default async function ProfilePage({ params }: Props) {
  const data = await load(params.handle);
  if (!data) return notFound();
  const { profile, apps } = data;

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      {/* Header */}
      <div className="card !p-8">
        <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatar_url} alt="" className="w-24 h-24 rounded-2xl object-cover bg-white/5 border border-white/10" />
          ) : (
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-flame to-gold grid place-items-center text-4xl font-display text-white">
              {(profile.name || profile.handle).slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-3xl">{profile.name || `@${profile.handle}`}</h1>
            <div className="text-white/50 text-sm mt-1">@{profile.handle}</div>
            {profile.bio && <p className="mt-3 text-white/80">{profile.bio}</p>}
            <div className="mt-3 flex gap-4 text-sm flex-wrap">
              {profile.twitter && (
                <a href={`https://x.com/${profile.twitter}`} target="_blank" rel="noreferrer" className="text-flame hover:underline">𝕏 @{profile.twitter}</a>
              )}
              {profile.website && (
                <a href={profile.website} target="_blank" rel="noreferrer" className="text-flame hover:underline">{profile.website.replace(/^https?:\/\//, '')} ↗</a>
              )}
              <span className="text-white/40">Builder since {new Date(profile.builder_since * 1000).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-center min-w-[180px]">
            <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-3">
              <div className="font-display text-2xl text-gold">{profile.stats.apps}</div>
              <div className="text-[10px] uppercase tracking-wider text-white/50 mt-0.5">Apps shipped</div>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-3">
              <div className="font-display text-2xl text-gold">{profile.stats.total_views.toLocaleString()}</div>
              <div className="text-[10px] uppercase tracking-wider text-white/50 mt-0.5">Total views</div>
            </div>
          </div>
        </div>
      </div>

      {/* Apps */}
      <h2 className="font-display text-2xl mt-10">Public apps</h2>
      {apps.length === 0 ? (
        <div className="card mt-4 text-center text-white/50">No public apps yet.</div>
      ) : (
        <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {apps.map((a) => (
            <div key={a.slug} className="card !p-0 overflow-hidden flex flex-col">
              <div className="bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <iframe src={a.url} className="w-full h-[220px] border-0 pointer-events-none" loading="lazy" sandbox="allow-scripts allow-same-origin" />
              </div>
              <div className="p-4 flex-1 flex flex-col">
                <div className="flex items-start gap-3 mb-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`https://apps.stakgod.com/${a.slug}/icon.png`} alt="" loading="lazy" className="w-10 h-10 rounded-lg object-cover bg-white/5 border border-white/10 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-lg truncate">{a.name}</div>
                    {a.tagline && <div className="text-sm text-white/60 mt-1 line-clamp-2">{a.tagline}</div>}
                    <div className="text-xs text-white/40 mt-1">{a.view_count.toLocaleString()} views</div>
                  </div>
                </div>
                <div className="flex gap-2 mt-auto">
                  <a href={a.url} target="_blank" rel="noreferrer" className="btn-ghost text-xs !py-2 flex-1 text-center">Open ↗</a>
                  <Link href={`/build?fork=${a.slug}`} className="btn-primary text-xs !py-2 flex-1 text-center">Remix →</Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-12 text-center text-sm text-white/50">
        Built on <Link href="/" className="text-flame">Stakgod</Link> · Build your own at <Link href="/build" className="text-flame">/build</Link>
      </div>
    </div>
  );
}

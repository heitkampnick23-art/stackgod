'use client';
import { useState } from 'react';

const API = 'https://api.stakgod.com';

const TEMPLATES = [
  { slug: 'tpl-habit-tracker',  name: 'Habit Tracker',     emoji: '🔥', blurb: 'Track daily habits with streaks. Real persistent backend.' },
  { slug: 'tpl-link-in-bio',    name: 'Link in Bio',       emoji: '🔗', blurb: 'A clean linktree-style page. Add/edit links live.' },
  { slug: 'tpl-tip-jar',        name: 'Tip Jar',           emoji: '🪙', blurb: 'Collect tips with a goal bar. Connect Stripe later.' },
  { slug: 'tpl-newsletter',     name: 'Newsletter Signup', emoji: '✉️', blurb: 'Capture emails. List in-app, export to CSV.' },
  { slug: 'tpl-mentor',         name: 'Startup Mentor',    emoji: '🧠', blurb: 'AI co-founder w/ magic-link sign-in + memory. Uses sg.auth + sg.ai.' },
];

export default function Templates() {
  const [forking, setForking] = useState<string | null>(null);

  async function fork(slug: string, name: string) {
    setForking(slug);
    const r = await fetch(`${API}/builder/fork`, {
      method: 'POST', credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ template: slug, name }),
    });
    setForking(null);
    if (r.status === 401) { location.href = `/login?next=/templates`; return; }
    const j = await r.json();
    if (!r.ok) { alert(j.error ?? 'fork failed'); return; }
    location.href = j.build_url;
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      <h1 className="font-display text-5xl">Fork a starter.</h1>
      <p className="mt-3 text-white/60">Click any template to preview it live, then fork in one click and edit it via chat.</p>

      <div className="mt-10 grid md:grid-cols-2 gap-6">
        {TEMPLATES.map((t) => (
          <div key={t.slug} className="card overflow-hidden !p-0">
            <div className="bg-white">
              <iframe
                src={`https://apps.stakgod.com/${t.slug}/`}
                className="w-full h-[420px] border-0"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals" />
            </div>
            <div className="p-5 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="font-display text-xl flex items-center gap-2">
                  <span>{t.emoji}</span> {t.name}
                </div>
                <div className="text-sm text-white/60 mt-1">{t.blurb}</div>
              </div>
              <div className="flex gap-2 shrink-0">
                <a href={`https://apps.stakgod.com/${t.slug}/`} target="_blank" rel="noreferrer"
                   className="btn-ghost text-sm !px-4 !py-2">Open ↗</a>
                <button onClick={() => fork(t.slug, t.name)} disabled={forking === t.slug}
                        className="btn-primary text-sm !px-4 !py-2 disabled:opacity-50">
                  {forking === t.slug ? 'Forking…' : 'Fork →'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

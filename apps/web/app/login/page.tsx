'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

const API = 'https://api.stakgod.com';

function sanitizeNext(n: string | null): string {
  if (!n || !n.startsWith('/') || n.startsWith('//') || n.length > 200) return '/dashboard';
  return n;
}

function LoginInner() {
  const params = useSearchParams();
  const next = sanitizeNext(params.get('next'));

  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');
  const [providers, setProviders] = useState<{ google: boolean; apple: boolean } | null>(null);

  useEffect(() => {
    fetch(`${API}/auth/providers`).then((r) => r.json()).then(setProviders).catch(() => setProviders({ google: false, apple: false }));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    const r = await fetch(`${API}/auth/magic-link`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, next }),
    });
    if (r.ok) setSent(true);
    else setErr((await r.json()).error);
  }

  const startWith = (provider: 'apple' | 'google') => `${API}/auth/${provider}/start?next=${encodeURIComponent(next)}`;

  return (
    <div className="max-w-md mx-auto px-6 py-24">
      <h1 className="font-display text-4xl text-center">Welcome back.</h1>
      <p className="text-center text-white/60 mt-2">Sign in to keep building.</p>
      {next !== '/dashboard' && <p className="text-center text-white/40 text-xs mt-2">After sign-in we&apos;ll send you to <code className="text-flame">{next}</code></p>}

      {providers && (providers.apple || providers.google) && (
        <>
          <div className="mt-8 space-y-3">
            {providers.apple && (
              <a href={startWith('apple')} className="btn bg-white text-black w-full inline-flex items-center justify-center gap-2">
                <span aria-hidden></span> Sign in with Apple
              </a>
            )}
            {providers.google && (
              <a href={startWith('google')} className="btn bg-white/10 text-white w-full inline-flex items-center justify-center gap-2">
                <span aria-hidden>G</span> Continue with Google
              </a>
            )}
          </div>
          <div className="my-6 text-center text-white/40 text-xs">or</div>
        </>
      )}

      {sent ? (
        <div className="card text-center">📬 Check <b>{email}</b> for your sign-in link.</div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required placeholder="you@domain.com"
            className="w-full rounded-full bg-white/10 px-5 py-3 outline-none focus:ring-2 focus:ring-flame" />
          <button className="btn-primary w-full">Email me a magic link</button>
          {err && <div className="text-red-400 text-sm text-center">{err}</div>}
        </form>
      )}
    </div>
  );
}

export default function Login() {
  return (
    <Suspense fallback={<div className="p-12 text-white/60">Loading…</div>}>
      <LoginInner />
    </Suspense>
  );
}

'use client';
import { useState } from 'react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    const r = await fetch('https://api.stakgod.com/auth/magic-link', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (r.ok) setSent(true); else setErr((await r.json()).error);
  }

  return (
    <div className="max-w-md mx-auto px-6 py-24">
      <h1 className="font-display text-4xl text-center">Welcome back.</h1>
      <p className="text-center text-white/60 mt-2">Sign in to keep building.</p>

      <div className="mt-8 space-y-3">
        <button className="btn bg-white text-black w-full">  Sign in with Apple</button>
        <button className="btn bg-white/10 text-white w-full">G  Continue with Google</button>
      </div>
      <div className="my-6 text-center text-white/40 text-xs">or</div>
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

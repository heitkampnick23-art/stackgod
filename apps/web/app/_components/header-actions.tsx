'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

const API = 'https://api.stakgod.com';

export default function HeaderActions() {
  const [user, setUser] = useState<{ email: string; name: string | null; avatar_url: string | null } | null | 'loading'>('loading');

  useEffect(() => {
    fetch(`${API}/auth/me`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((d) => setUser(d.user))
      .catch(() => setUser(null));
  }, []);

  async function signOut() {
    await fetch(`${API}/auth/logout`, { method: 'POST', credentials: 'include' });
    location.href = '/';
  }

  if (user === 'loading') return <div className="size-8 rounded-full bg-white/5 animate-pulse" />;

  if (user) {
    const initial = (user.name?.[0] ?? user.email[0]).toUpperCase();
    return (
      <div className="flex gap-3 items-center">
        <Link href="/dashboard" className="text-sm text-white/80 hover:text-white">Dashboard</Link>
        <Link href="/build" className="btn-primary text-sm py-2 px-4">+ New app</Link>
        <button onClick={signOut} title="Sign out" className="size-8 rounded-full bg-white/10 hover:bg-white/20 grid place-items-center text-xs font-bold overflow-hidden">
          {user.avatar_url ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover" /> : initial}
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <Link href="/login" className="text-sm text-white/80 hover:text-white self-center">Sign in</Link>
      <Link href="/build" className="btn-primary text-sm py-2 px-4">Start free</Link>
    </div>
  );
}

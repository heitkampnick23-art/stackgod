'use client';
import { useEffect, useState } from 'react';

interface Stats {
  apps_total: number;
  apps_today: number;
  builders: number;
  ai_calls_week: number;
  builder_revenue_week_cents: number;
}

export default function LiveStats() {
  const [s, setS] = useState<Stats | null>(null);
  useEffect(() => {
    fetch('https://api.stakgod.com/stats/public').then((r) => (r.ok ? r.json() : null)).then((d) => d && setS(d)).catch(() => {});
  }, []);
  if (!s) return null;
  return (
    <div className="mt-8 inline-flex flex-wrap items-center justify-center gap-x-6 gap-y-2 rounded-full border border-white/10 bg-white/[0.04] backdrop-blur-md px-5 py-2 text-xs text-white/70">
      {s.apps_total > 0 && <span><b className="text-white">{s.apps_total.toLocaleString()}</b> apps shipped</span>}
      {s.apps_today > 0 && <span className="text-emerald-400">+{s.apps_today} today</span>}
      {s.builders > 0 && <span><b className="text-white">{s.builders.toLocaleString()}</b> builders</span>}
      {s.builder_revenue_week_cents > 0 && (
        <span><b className="text-gold">${Math.round(s.builder_revenue_week_cents / 100).toLocaleString()}</b> earned by builders / week</span>
      )}
    </div>
  );
}

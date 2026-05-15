// Auto-playing demo of the chat-to-app loop. Pure CSS + a 12-second
// keyframe timeline: types a prompt, shows fake stream, snaps in a real
// "habit tracker" mockup, repeats. No video file, no autoplay drama,
// plays on every device including iOS Safari low-power mode.

export default function AutoDemo() {
  return (
    <div className="mt-12 mx-auto max-w-5xl select-none" aria-hidden>
      <div className="rounded-2xl overflow-hidden border border-white/10 shadow-[0_30px_80px_rgba(0,0,0,0.5)] bg-ink/70 backdrop-blur-xl">
        {/* Faux browser chrome */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-white/5">
          <div className="flex gap-1.5">
            <span className="size-3 rounded-full bg-red-500/70" />
            <span className="size-3 rounded-full bg-amber-400/70" />
            <span className="size-3 rounded-full bg-emerald-500/70" />
          </div>
          <div className="ml-3 flex-1 rounded-md bg-white/5 px-3 py-1 text-xs text-white/50 font-mono">
            stakgod.com/build
          </div>
        </div>

        <div className="grid md:grid-cols-2 min-h-[420px]">
          {/* LEFT — chat pane */}
          <div className="border-r border-white/10 p-5 flex flex-col">
            <div className="text-xs text-white/40 uppercase tracking-wider mb-3">Chat</div>
            <div className="space-y-3 flex-1">
              <div className="text-sm rounded-xl bg-flame/15 border border-flame/30 px-4 py-2.5 w-fit max-w-full">
                <span className="ad-type">build me a habit tracker with sign-in and a streak chart</span>
                <span className="ad-caret">▎</span>
              </div>

              <div className="text-sm rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 max-w-full ad-claude-msg opacity-0">
                <div className="text-xs text-white/40 mb-1">Claude · Sonnet 4.6</div>
                Shipping a daily habit tracker with sign-in, streaks, and a 30-day chart…
                <div className="mt-2 grid gap-1 text-xs text-white/60 font-mono">
                  <div className="ad-step ad-step-1 opacity-0">✓ scaffold layout</div>
                  <div className="ad-step ad-step-2 opacity-0">✓ wire sg.auth (Apple + Google)</div>
                  <div className="ad-step ad-step-3 opacity-0">✓ persist habits to sg.db</div>
                  <div className="ad-step ad-step-4 opacity-0">✓ deploy to apps.stakgod.com</div>
                </div>
              </div>

              <div className="text-sm rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-4 py-2.5 max-w-full ad-done opacity-0 text-emerald-300">
                🎉 Live at <span className="font-mono">habit-glow.stakgod.app</span> — 9.4s
              </div>
            </div>

            <div className="mt-4 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/40">
              Type your next change…
            </div>
          </div>

          {/* RIGHT — app preview pane */}
          <div className="bg-white text-zinc-900 p-6 relative overflow-hidden">
            {/* Shimmer state while "generating" */}
            <div className="ad-shimmer absolute inset-0 flex items-center justify-center">
              <div className="text-zinc-400 text-sm font-medium">
                <span className="inline-block size-2 rounded-full bg-zinc-300 mr-2 align-middle animate-pulse" />
                writing your app…
              </div>
            </div>

            {/* Final rendered habit-tracker mockup */}
            <div className="ad-app opacity-0 relative">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold tracking-tight">Daily Glow ✨</div>
                  <div className="text-xs text-zinc-500 mt-0.5">Welcome back, Nick</div>
                </div>
                <div className="size-9 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 grid place-items-center text-white text-xs font-bold">N</div>
              </div>

              <div className="mt-4 rounded-xl bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-100 px-4 py-3 flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wide text-orange-600 font-bold">Current streak</div>
                  <div className="text-3xl font-bold mt-0.5 text-zinc-900">12 days 🔥</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-zinc-500">This month</div>
                  <div className="text-lg font-semibold text-zinc-700">87%</div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-7 gap-1.5">
                {Array.from({ length: 21 }).map((_, i) => {
                  // Pseudo-random fill density
                  const filled = [0,1,2,3,5,6,7,9,10,11,13,14,15,17,18,19,20].includes(i);
                  return (
                    <div key={i} className={`aspect-square rounded ${filled ? 'bg-emerald-500' : 'bg-zinc-100'}`} />
                  );
                })}
              </div>

              <div className="mt-4 space-y-2 text-sm">
                {[
                  { name: 'Read 20 pages', done: true },
                  { name: 'Workout · 30 min', done: true },
                  { name: 'Drink 2L water', done: false },
                ].map((h) => (
                  <label key={h.name} className="flex items-center gap-3 rounded-lg border border-zinc-200 px-3 py-2">
                    <input type="checkbox" defaultChecked={h.done} readOnly className="size-4 accent-emerald-500 pointer-events-none" />
                    <span className={h.done ? 'line-through text-zinc-400' : 'text-zinc-700'}>{h.name}</span>
                  </label>
                ))}
              </div>

              <div className="mt-3 text-[10px] text-zinc-400 text-right">Built with STAKGOD</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 text-xs text-white/40 text-center">↑ This is rendering live in your browser right now. The real builder is just as fast.</div>

      <style>{`
        @keyframes ad-type {
          0%   { width: 0 }
          18%  { width: 100% }
          92%  { width: 100% }
          100% { width: 0 }
        }
        @keyframes ad-caret {
          0%,49% { opacity: 1 }
          50%,100% { opacity: 0 }
        }
        @keyframes ad-fade-in {
          0%, var(--in-pct, 20%) { opacity: 0; transform: translateY(8px) }
          calc(var(--in-pct, 20%) + 5%), 92% { opacity: 1; transform: translateY(0) }
          100% { opacity: 0; transform: translateY(0) }
        }
        @keyframes ad-shimmer {
          0%,30% { opacity: 1 }
          45%,100% { opacity: 0 }
        }
        @keyframes ad-app-in {
          0%,38% { opacity: 0; transform: scale(0.98) }
          48%,92% { opacity: 1; transform: scale(1) }
          100% { opacity: 0; transform: scale(1) }
        }
        .ad-type {
          display: inline-block;
          overflow: hidden;
          white-space: nowrap;
          vertical-align: bottom;
          animation: ad-type 12s steps(60, end) infinite;
        }
        .ad-caret { animation: ad-caret 0.9s steps(1) infinite; }
        .ad-claude-msg {
          animation: ad-fade-in 12s ease-out infinite;
          --in-pct: 22%;
        }
        .ad-step { animation: ad-fade-in 12s ease-out infinite; }
        .ad-step-1 { --in-pct: 26%; }
        .ad-step-2 { --in-pct: 30%; }
        .ad-step-3 { --in-pct: 34%; }
        .ad-step-4 { --in-pct: 38%; }
        .ad-done { animation: ad-fade-in 12s ease-out infinite; --in-pct: 44%; }
        .ad-shimmer { animation: ad-shimmer 12s ease-out infinite; }
        .ad-app {
          animation: ad-app-in 12s ease-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .ad-type, .ad-caret, .ad-claude-msg, .ad-step, .ad-done, .ad-shimmer, .ad-app {
            animation: none !important;
            opacity: 1 !important;
          }
          .ad-shimmer { display: none; }
        }
      `}</style>
    </div>
  );
}

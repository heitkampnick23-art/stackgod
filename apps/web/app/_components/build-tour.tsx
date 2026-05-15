'use client';
import { useEffect, useState } from 'react';

const KEY = 'sg_tour_done_v1';

interface Step {
  title: string;
  body: React.ReactNode;
  // Floating-card placement on the screen.
  pos: { top?: string; bottom?: string; left?: string; right?: string };
  // Optional arrow direction so the card visually points at the thing.
  arrow?: 'up' | 'down' | 'left' | 'right';
}

const STEPS: Step[] = [
  {
    title: '👋 Welcome to Stakgod',
    body: (
      <>
        Just <b>describe</b> your app and Claude builds it live in the right pane.
        <br />Try: <em className="text-flame">&ldquo;a habit tracker with streaks&rdquo;</em>
        <br /><span className="text-white/50 text-xs">Tip: paste a screenshot (Cmd+V) and Claude will match it.</span>
      </>
    ),
    pos: { bottom: '110px', left: '24px' },
    arrow: 'down',
  },
  {
    title: '🎯 Click any element to edit it',
    body: (
      <>
        Hit the <b className="text-flame">🎯 Select</b> button up top, then click anything in the preview.
        Tell Claude <em>&ldquo;make this red&rdquo;</em> or use the quick-action buttons.
      </>
    ),
    pos: { top: '70px', left: 'calc(480px + 24px)' },
    arrow: 'up',
  },
  {
    title: '🚀 Ready when you are',
    body: (
      <>
        Your app is auto-deployed to <b>apps.stakgod.com/{`{slug}`}</b> on every chat.
        <br />Open your <a href="/dashboard" className="text-flame underline">dashboard</a> to make it public, sell forks, or ship it to TestFlight.
      </>
    ),
    pos: { top: '70px', right: '24px' },
    arrow: 'up',
  },
];

export default function BuildTour() {
  const [step, setStep] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!window.localStorage.getItem(KEY)) {
      // Tiny delay so the page settles first.
      const t = setTimeout(() => setStep(0), 400);
      return () => clearTimeout(t);
    }
  }, []);

  function dismiss() {
    try { window.localStorage.setItem(KEY, '1'); } catch { /**/ }
    setStep(null);
  }

  if (step === null) return null;
  const s = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <>
      {/* dim overlay (low intensity so the UI stays usable) */}
      <div onClick={dismiss}
        className="fixed inset-0 z-[9000] bg-black/40 backdrop-blur-[2px] cursor-pointer"
        aria-hidden />
      {/* the tour card */}
      <div
        role="dialog" aria-labelledby="tour-title"
        className="fixed z-[9001] w-[min(92vw,360px)] rounded-2xl border border-flame/40 bg-ink/95 backdrop-blur-xl shadow-2xl p-5"
        style={s.pos}>
        <div className="flex items-center justify-between mb-2">
          <div id="tour-title" className="font-display text-lg">{s.title}</div>
          <button onClick={dismiss} aria-label="Skip tour" className="text-white/40 hover:text-white text-lg leading-none">×</button>
        </div>
        <div className="text-sm text-white/80 leading-relaxed">{s.body}</div>
        <div className="mt-4 flex items-center justify-between">
          <div className="flex gap-1">
            {STEPS.map((_, i) => (
              <span key={i} className={`size-1.5 rounded-full ${i === step ? 'bg-flame' : 'bg-white/20'}`} />
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={dismiss} className="text-xs text-white/50 hover:text-white">Skip</button>
            {isLast ? (
              <button onClick={dismiss} className="btn-primary text-xs !px-4 !py-1.5">Got it →</button>
            ) : (
              <button onClick={() => setStep(step + 1)} className="btn-primary text-xs !px-4 !py-1.5">Next →</button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

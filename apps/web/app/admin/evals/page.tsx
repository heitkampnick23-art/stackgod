'use client';
import { useEffect, useState } from 'react';

const API = 'https://api.stakgod.com';

interface Trait { id: string; label: string; passed: boolean; }
interface CaseResult { id: string; category: string; output: string; tokens_in: number; tokens_out: number; ms: number; traits: Trait[]; passed: number; total: number; ok: boolean; }
interface Summary { cases: number; fully_passed: number; trait_pass_rate: number; total_tokens_in: number; total_tokens_out: number; total_ms: number; model: string; }

export default function Evals() {
  const [cases, setCases] = useState<Array<{ id: string; category: string; prompt: string; trait_count: number }>>([]);
  const [model, setModel] = useState<'haiku' | 'sonnet' | 'opus'>('haiku');
  const [running, setRunning] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [results, setResults] = useState<CaseResult[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch(`${API}/admin/evals`, { credentials: 'include' }).then(async (r) => {
      if (r.status === 403) setErr('forbidden — your email is not in ADMIN_EMAILS');
      else if (r.status === 401) setErr('sign in first');
      else if (r.ok) setCases((await r.json()).cases);
      else setErr(`HTTP ${r.status}`);
    });
  }, []);

  async function run(case_id?: string) {
    setRunning(true); setErr('');
    const r = await fetch(`${API}/admin/evals/run`, {
      method: 'POST', credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model, case_id }),
    });
    setRunning(false);
    if (!r.ok) { setErr(`${r.status}`); return; }
    const j = await r.json();
    setSummary(j.summary);
    setResults(j.results);
  }

  if (err) return <div className="max-w-2xl mx-auto px-6 py-16 text-center"><h1 className="font-display text-3xl">Admin only</h1><p className="mt-3 text-white/60">{err}</p></div>;

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <h1 className="font-display text-4xl">System-prompt evals</h1>
      <p className="mt-2 text-white/60">Run the suite of expected behaviors against the live <code>SYSTEM_PROMPT</code>. Catches regressions when we extend it.</p>

      <div className="card mt-8 flex items-center gap-3 flex-wrap">
        <div className="flex rounded-full bg-white/5 backdrop-blur-md p-1 text-xs">
          {(['haiku', 'sonnet', 'opus'] as const).map((m) => (
            <button key={m} onClick={() => setModel(m)} className={`px-3 py-1 rounded-full font-semibold ${model === m ? 'bg-white text-black' : 'text-white/60 hover:text-white'}`}>{m}</button>
          ))}
        </div>
        <button onClick={() => run()} disabled={running} className="btn-primary text-sm disabled:opacity-50">
          {running ? `Running ${cases.length} cases…` : `▶ Run all (${cases.length})`}
        </button>
        {summary && (
          <div className="text-xs text-white/60 ml-auto flex items-center gap-3">
            <span><b className={summary.fully_passed === summary.cases ? 'text-emerald-400' : 'text-amber-400'}>{summary.fully_passed}/{summary.cases}</b> cases fully passed</span>
            <span>Traits: <b>{(summary.trait_pass_rate * 100).toFixed(0)}%</b></span>
            <span>{(summary.total_ms / 1000).toFixed(1)}s</span>
            <span>{(summary.total_tokens_in + summary.total_tokens_out).toLocaleString()} tok</span>
          </div>
        )}
      </div>

      <div className="mt-6 space-y-2">
        {cases.map((c) => {
          const r = results.find((x) => x.id === c.id);
          return (
            <div key={c.id} className="card !p-4">
              <div className="flex items-center justify-between gap-3 cursor-pointer" onClick={() => setOpen(open === c.id ? null : c.id)}>
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="size-2 rounded-full shrink-0" style={{ background: r ? (r.ok ? '#10b981' : (r.passed > 0 ? '#f59e0b' : '#ef4444')) : '#525252' }} />
                  <div className="min-w-0">
                    <div className="font-mono text-xs text-white/40">{c.category}</div>
                    <div className="text-sm font-semibold truncate">{c.id}</div>
                    <div className="text-xs text-white/50 truncate">{c.prompt}</div>
                  </div>
                </div>
                {r && <div className="text-xs font-bold shrink-0">{r.passed}/{r.total} traits</div>}
                <button onClick={(e) => { e.stopPropagation(); run(c.id); }} disabled={running} className="btn-ghost text-xs !px-3 !py-1 shrink-0 disabled:opacity-50">▶</button>
              </div>
              {open === c.id && r && (
                <div className="mt-3 pt-3 border-t border-white/10 text-xs space-y-2">
                  <ul className="space-y-1">
                    {r.traits.map((t) => (
                      <li key={t.id} className={t.passed ? 'text-emerald-400' : 'text-red-400'}>
                        {t.passed ? '✓' : '✗'} {t.label}
                      </li>
                    ))}
                  </ul>
                  <details><summary className="cursor-pointer text-white/50 hover:text-white">Output ({r.output.length} chars · {r.tokens_out} tok · {r.ms}ms)</summary>
                    <pre className="mt-2 max-h-96 overflow-auto bg-black/40 p-3 rounded text-[10px] leading-relaxed font-mono whitespace-pre-wrap">{r.output}</pre>
                  </details>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

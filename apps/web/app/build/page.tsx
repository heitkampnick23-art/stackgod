'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';

const API = 'https://api.stakgod.com';

interface Msg { role: 'user' | 'assistant'; text: string; }

function BuildInner() {
  const params = useSearchParams();
  const initialAppId = params.get('app');

  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [appId, setAppId] = useState<string | null>(initialAppId);
  const [usage, setUsage] = useState<{ messages: number } | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [view, setView] = useState<'preview' | 'code'>('preview');
  const [deployedUrl, setDeployedUrl] = useState<string | null>(null);
  const [versions, setVersions] = useState<Array<{ ts: number }>>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [reverting, setReverting] = useState<number | null>(null);

  const endRef = useRef<HTMLDivElement>(null);
  const lastIframeUpdate = useRef(0);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  useEffect(() => {
    fetch(`${API}/builder/usage`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setUsage(d.today))
      .catch(() => {});
  }, [streaming]);

  // Load history + current HTML when an app is in the URL.
  useEffect(() => {
    if (!appId) {
      setMsgs([{ role: 'assistant', text: 'What do you want to build today? Try: "a habit tracker with streaks and Apple sign in."' }]);
      setPreviewHtml(emptyPreview());
      return;
    }
    fetch(`${API}/builder/messages?app_id=${appId}`, { credentials: 'include' }).then((r) => {
      if (r.status === 401) { location.href = `/login?next=/build?app=${appId}`; return null; }
      return r.ok ? r.json() : null;
    }).then((d) => {
      if (!d) return;
      const loaded: Msg[] = (d.messages ?? []).map((m: { role: string; content: string }) => ({ role: m.role as 'user' | 'assistant', text: m.content }));
      setMsgs(loaded.length ? loaded : [{ role: 'assistant', text: 'Welcome back. What do you want to change?' }]);
      if (d.deployed_url) {
        setDeployedUrl(d.deployed_url);
        fetch(d.deployed_url).then((r) => (r.ok ? r.text() : null)).then((html) => { if (html) setPreviewHtml(html); });
      }
    });
    refreshVersions(appId);
  }, [appId]);

  function refreshVersions(id: string | null) {
    if (!id) return setVersions([]);
    fetch(`${API}/builder/versions?app_id=${id}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { versions: [] }))
      .then((d: { versions: Array<{ ts: number }> }) => setVersions(d.versions ?? []))
      .catch(() => {});
  }

  async function revert(ts: number) {
    if (!appId) return;
    setReverting(ts);
    const r = await fetch(`${API}/builder/revert`, {
      method: 'POST', credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ app_id: appId, ts }),
    });
    setReverting(null);
    if (!r.ok) { alert('Revert failed'); return; }
    // Refresh preview from the deployed URL.
    const html = await fetch(`https://apps.stakgod.com/${(deployedUrl ?? '').match(/apps\.stakgod\.com\/([^/]+)/)?.[1] ?? ''}/`).then((x) => x.text()).catch(() => null);
    if (html) setPreviewHtml(html);
    setMsgs((m) => [...m, { role: 'assistant', text: `↩️ Reverted to version from ${new Date(ts).toLocaleString()}.` }]);
    refreshVersions(appId);
    setShowVersions(false);
  }

  async function ensureApp(): Promise<string> {
    if (appId) return appId;
    const r = await fetch(`${API}/apps`, {
      method: 'POST', credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: input.slice(0, 40) || 'Untitled' }),
    });
    if (r.status === 401) { location.href = '/login?next=/build'; throw new Error('auth'); }
    const j = await r.json();
    setAppId(j.id);
    history.replaceState(null, '', `/build?app=${j.id}`);
    return j.id;
  }

  async function send() {
    if (!input.trim() || streaming) return;
    const text = input;
    setInput('');
    setMsgs((m) => [...m, { role: 'user', text }, { role: 'assistant', text: '' }]);
    setStreaming(true);
    try {
      const id = await ensureApp();
      const r = await fetch(`${API}/builder/chat`, {
        method: 'POST', credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ app_id: id, message: text, intent: 'edit' }),
      });
      if (r.status === 402) {
        const j = await r.json();
        setMsgs((m) => [...m.slice(0, -1), { role: 'assistant', text: `${j.message}\n\n→ Upgrade: ${j.upgrade_url}` }]);
        return;
      }
      const reader = r.body!.getReader();
      const dec = new TextDecoder();
      let buf = '';
      let assembled = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          const data = line.replace(/^data: /, '');
          if (!data) continue;
          try {
            const j = JSON.parse(data);
            if (j.delta) {
              assembled += j.delta;
              setMsgs((m) => [...m.slice(0, -1), { role: 'assistant', text: assembled }]);
              const html = extractHtml(assembled);
              if (html && Date.now() - lastIframeUpdate.current > 200) {
                setPreviewHtml(html);
                lastIframeUpdate.current = Date.now();
              }
            }
            if (j.done) {
              if (j.deployed_url) setDeployedUrl(j.deployed_url);
              const html = extractHtml(assembled);
              if (html) setPreviewHtml(html);
              refreshVersions(appId);
            }
          } catch {}
        }
      }
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div className="grid md:grid-cols-[480px_1fr] gap-0 h-[calc(100vh-4rem)]">
      {/* Chat */}
      <div className="flex flex-col border-r border-white/10 bg-ink/40 backdrop-blur-xl">
        <div className="px-6 py-3 border-b border-white/10 flex items-center justify-between">
          <div className="text-sm text-white/60">Builder</div>
          {usage && <div className="text-xs text-white/40">{usage.messages} msgs today</div>}
        </div>
        <div className="flex-1 overflow-auto px-6 py-6 space-y-4">
          {msgs.map((m, i) => (
            <div key={i} className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${m.role === 'user' ? 'ml-auto bg-flame text-white' : 'bg-white/5 text-white/90 border border-white/5'}`}>
              {m.role === 'assistant' ? renderAssistant(m.text, streaming && i === msgs.length - 1) : m.text}
            </div>
          ))}
          <div ref={endRef} />
        </div>
        <div className="p-4 border-t border-white/10">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder={appId ? 'What do you want to change?' : 'Describe your app…'}
              className="flex-1 rounded-full bg-white/10 px-5 py-3 outline-none focus:ring-2 focus:ring-flame backdrop-blur-md" />
            <button onClick={send} disabled={streaming} className="btn-primary disabled:opacity-50">
              {streaming ? '…' : 'Send'}
            </button>
          </div>
        </div>
      </div>

      {/* Preview / Code */}
      <div className="flex flex-col bg-black">
        <div className="px-4 py-2 border-b border-white/10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex rounded-full bg-white/5 backdrop-blur-md p-1 text-xs">
              <button onClick={() => setView('preview')} className={`px-3 py-1 rounded-full font-semibold ${view === 'preview' ? 'bg-white text-black' : 'text-white/60 hover:text-white'}`}>Preview</button>
              <button onClick={() => setView('code')} className={`px-3 py-1 rounded-full font-semibold ${view === 'code' ? 'bg-white text-black' : 'text-white/60 hover:text-white'}`}>Code</button>
            </div>
            {versions.length > 0 && (
              <button onClick={() => setShowVersions((v) => !v)}
                className={`text-xs rounded-full px-3 py-1 font-semibold ${showVersions ? 'bg-white text-black' : 'bg-white/5 text-white/60 hover:text-white'}`}>
                ↩ Versions ({versions.length})
              </button>
            )}
          </div>
          {deployedUrl && (
            <a href={deployedUrl} target="_blank" rel="noreferrer" className="text-xs text-flame hover:underline truncate max-w-[40%]">
              {deployedUrl.replace(/^https?:\/\//, '')} ↗
            </a>
          )}
        </div>
        <div className="flex-1 relative">
          {view === 'preview' ? (
            <iframe srcDoc={previewHtml} className="w-full h-full bg-white" sandbox="allow-scripts allow-forms allow-popups allow-modals allow-same-origin" />
          ) : (
            <pre className="absolute inset-0 overflow-auto p-4 text-xs leading-relaxed font-mono text-white/90 bg-[#0a0a0f]">{previewHtml || '// no code yet'}</pre>
          )}

          {/* Versions drawer */}
          {showVersions && (
            <div className="absolute top-0 right-0 bottom-0 w-80 bg-ink/90 backdrop-blur-xl border-l border-white/10 overflow-auto p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="font-display text-lg">Versions</div>
                <button onClick={() => setShowVersions(false)} className="text-white/40 hover:text-white text-xl leading-none">×</button>
              </div>
              <div className="text-xs text-white/50 mb-3">Every chat that produced HTML is snapshotted. Click to revert.</div>
              <ul className="space-y-2">
                {versions.map((v, i) => (
                  <li key={v.ts} className="flex items-center justify-between gap-2 rounded-xl bg-white/5 border border-white/10 px-3 py-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">{i === 0 ? 'Current' : `v${versions.length - i}`}</div>
                      <div className="text-xs text-white/50 truncate">{new Date(v.ts).toLocaleString()}</div>
                    </div>
                    {i > 0 && (
                      <button onClick={() => revert(v.ts)} disabled={reverting === v.ts}
                        className="btn-ghost text-xs !px-3 !py-1 shrink-0 disabled:opacity-50">
                        {reverting === v.ts ? '…' : 'Revert'}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Build() {
  return (
    <Suspense fallback={<div className="p-12 text-white/60">Loading…</div>}>
      <BuildInner />
    </Suspense>
  );
}

function renderAssistant(text: string, streaming: boolean) {
  if (!text) return streaming ? <span className="opacity-50">thinking…</span> : '';
  // Hide the giant code block in chat — show only the prose. Code lives in the right pane.
  const stripped = text.replace(/```html[\s\S]*?(```|$)/g, '').trim();
  return stripped || (streaming ? <span className="opacity-50">writing your app…</span> : <span className="opacity-50">(see preview →)</span>);
}

function extractHtml(s: string): string | null {
  const fenced = s.match(/```html\n([\s\S]*?)(?:```|$)/);
  if (fenced) return fenced[1];
  const doctype = s.match(/<!doctype html[\s\S]*/i);
  if (doctype) return doctype[0];
  return null;
}

function emptyPreview(): string {
  return `<!doctype html><meta charset=utf-8><body style="font:16px system-ui;background:#0a0a0f;color:#666;display:grid;place-items:center;height:100vh;margin:0;text-align:center"><div><div style="font-size:64px;margin-bottom:16px">✨</div><div style="font-size:18px;color:#888">Your app will appear here as you chat</div></div></body>`;
}

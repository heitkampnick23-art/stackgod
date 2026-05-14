'use client';
import { useEffect, useRef, useState } from 'react';

interface Msg { role: 'user' | 'assistant'; text: string; }

export default function Build() {
  const [msgs, setMsgs] = useState<Msg[]>([{ role: 'assistant', text: 'What do you want to build today? Try: "a habit tracker with streaks and Apple sign in."' }]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [appId, setAppId] = useState<string | null>(null);
  const [usage, setUsage] = useState<{ messages: number } | null>(null);
  const [previewHtml, setPreviewHtml] = useState('<div style="display:grid;place-items:center;height:100%;color:#888;font-family:system-ui">Your app will appear here</div>');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);
  useEffect(() => { fetch('https://api.stakgod.com/builder/usage', { credentials: 'include' }).then(r => r.ok ? r.json() : null).then(d => d && setUsage(d.today)).catch(() => {}); }, [streaming]);

  async function ensureApp(): Promise<string> {
    if (appId) return appId;
    const r = await fetch('https://api.stakgod.com/apps', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Untitled' }) });
    if (r.status === 401) { location.href = '/login?next=/build'; throw new Error('auth'); }
    const { id } = await r.json();
    setAppId(id);
    return id;
  }

  async function send() {
    if (!input.trim() || streaming) return;
    const text = input;
    setInput('');
    setMsgs((m) => [...m, { role: 'user', text }, { role: 'assistant', text: '' }]);
    setStreaming(true);
    try {
      const id = await ensureApp();
      const r = await fetch('https://api.stakgod.com/builder/chat', {
        method: 'POST', credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ app_id: id, message: text, intent: 'generate' }),
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
              if (html) setPreviewHtml(html);
            }
          } catch {}
        }
      }
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div className="grid md:grid-cols-[1fr_1fr] gap-0 h-[calc(100vh-4rem)]">
      <div className="flex flex-col border-r border-white/5">
        <div className="px-6 py-3 border-b border-white/5 flex items-center justify-between">
          <div className="text-sm text-white/60">Builder</div>
          {usage && <div className="text-xs text-white/40">{usage.messages} msgs today</div>}
        </div>
        <div className="flex-1 overflow-auto px-6 py-6 space-y-4">
          {msgs.map((m, i) => (
            <div key={i} className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${m.role === 'user' ? 'ml-auto bg-flame text-white' : 'bg-white/5 text-white/90'}`}>{m.text || (streaming && i === msgs.length - 1 ? '…' : '')}</div>
          ))}
          <div ref={endRef} />
        </div>
        <div className="p-4 border-t border-white/5">
          <div className="flex gap-2">
            <input value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder="Describe your app…"
              className="flex-1 rounded-full bg-white/10 px-5 py-3 outline-none focus:ring-2 focus:ring-flame" />
            <button onClick={send} disabled={streaming} className="btn-primary disabled:opacity-50">Send</button>
          </div>
        </div>
      </div>
      <div className="bg-black">
        <iframe srcDoc={previewHtml} className="w-full h-full bg-white" sandbox="allow-scripts allow-forms" />
      </div>
    </div>
  );
}

function extractHtml(s: string): string | null {
  const m = s.match(/```html\n([\s\S]*?)(```|$)/);
  return m ? m[1] : null;
}

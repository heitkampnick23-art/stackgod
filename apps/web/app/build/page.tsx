'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';

const API = 'https://api.stakgod.com';

interface Msg { role: 'user' | 'assistant'; text: string; }
interface Attachment { name: string; mime: string; size: number; b64: string; preview: string; }
const ALLOWED_IMG = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

function fileToBase64(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const result = r.result as string;
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    r.onerror = reject;
    r.readAsDataURL(f);
  });
}

function BuildInner() {
  const params = useSearchParams();
  const initialAppId = params.get('app');
  const forkSlug = params.get('fork');
  const forkSession = params.get('session_id');

  // Handle ?fork=slug — call /builder/fork. If 402, redirect to Stripe checkout.
  // If returning from checkout (?fork=slug&session_id=cs_…), pass session through.
  useEffect(() => {
    if (!forkSlug || initialAppId) return;
    (async () => {
      const r = await fetch(`${API}/builder/fork`, {
        method: 'POST', credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ template: forkSlug, session_id: forkSession ?? undefined }),
      });
      if (r.status === 401) { location.href = `/login?next=/build?fork=${forkSlug}${forkSession ? `&session_id=${forkSession}` : ''}`; return; }
      if (r.status === 402) {
        const j = await r.json();
        if (j.checkout_url) { location.href = j.checkout_url; return; }
      }
      if (!r.ok) return;
      const j = await r.json();
      location.replace(`/build?app=${j.id}`);
    })();
  }, [forkSlug, forkSession, initialAppId]);

  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [appId, setAppId] = useState<string | null>(initialAppId);
  const [usage, setUsage] = useState<{ messages: number } | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [view, setView] = useState<'preview' | 'code'>('preview');
  const [deployedUrl, setDeployedUrl] = useState<string | null>(null);
  const [versions, setVersions] = useState<Array<{ ts: number }>>([]);
  const [peers, setPeers] = useState<Map<string, { name: string; color: string; x?: number; y?: number; lastMove?: number }>>(new Map());
  const wsRef = useRef<WebSocket | null>(null);
  const [showVersions, setShowVersions] = useState(false);
  const [reverting, setReverting] = useState<number | null>(null);
  const [streamChars, setStreamChars] = useState(0);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // Paste image handler — works anywhere on the page (Cmd+V).
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const it of items) {
        if (it.kind === 'file' && it.type.startsWith('image/')) {
          const f = it.getAsFile(); if (f) addFile(f);
        }
      }
    }
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  });

  async function addFile(f: File) {
    if (!ALLOWED_IMG.includes(f.type)) { alert(`${f.type} not supported. Use PNG, JPG, WEBP, or GIF.`); return; }
    if (f.size > 5 * 1024 * 1024) { alert('Image too big — max 5 MB.'); return; }
    const b64 = await fileToBase64(f);
    setAttachments((a) => a.length >= 5 ? a : [...a, { name: f.name, mime: f.type, size: f.size, b64, preview: `data:${f.type};base64,${b64}` }]);
  }
  async function addFiles(fs: FileList | File[]) { for (const f of Array.from(fs)) await addFile(f); }
  function removeAttachment(i: number) { setAttachments((a) => a.filter((_, idx) => idx !== i)); }
  const [editMode, setEditMode] = useState(false);
  const [selected, setSelected] = useState<{ selector: string; html: string; text: string } | null>(null);
  const [editPrompt, setEditPrompt] = useState('');

  // Listen for element-clicked messages from the iframe (when select-mode is on).
  useEffect(() => {
    function onMsg(e: MessageEvent) {
      const d = e.data as { __sg?: boolean; type?: string; selector?: string; html?: string; text?: string };
      if (!d || !d.__sg) return;
      if (d.type === 'select' && d.selector) {
        setSelected({ selector: d.selector, html: d.html ?? '', text: (d.text ?? '').trim() });
      }
    }
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

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

  // Real-time collab: open WebSocket into the room for this app.
  useEffect(() => {
    if (!appId) return;
    const ws = new WebSocket(API.replace(/^http/, 'ws') + `/builder/room/${appId}`);
    wsRef.current = ws;
    let lastSent = 0;
    function onMove(e: MouseEvent) {
      const now = Date.now();
      if (now - lastSent < 50) return;
      lastSent = now;
      ws.readyState === 1 && ws.send(JSON.stringify({ kind: 'cursor', x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight }));
    }
    ws.addEventListener('open', () => window.addEventListener('mousemove', onMove));
    ws.addEventListener('message', (ev) => {
      try {
        const m = JSON.parse(ev.data);
        if (m.kind === 'welcome') {
          setPeers(new Map(m.peers.map((p: { id: string; name: string; color: string }) => [p.id, { name: p.name, color: p.color }])));
        } else if (m.kind === 'join') {
          setPeers((prev) => { const n = new Map(prev); n.set(m.peer.id, { name: m.peer.name, color: m.peer.color }); return n; });
        } else if (m.kind === 'leave') {
          setPeers((prev) => { const n = new Map(prev); n.delete(m.peer.id); return n; });
        } else if (m.kind === 'cursor' && m.from) {
          setPeers((prev) => { const n = new Map(prev); const p = n.get(m.from); if (p) n.set(m.from, { ...p, x: m.x, y: m.y, lastMove: Date.now() }); return n; });
        }
      } catch {/**/}
    });
    return () => { window.removeEventListener('mousemove', onMove); ws.close(); };
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

  async function submitElementEdit(promptOverride?: string, displayOverride?: string) {
    if (!selected || streaming) return;
    const prompt = (promptOverride ?? editPrompt).trim();
    if (!prompt) return;
    const sel = selected;
    setSelected(null);
    setEditPrompt('');
    setEditMode(false);
    const wrapped = `Edit ONLY the element matching this CSS selector: \`${sel.selector}\`\n\nCurrent element snippet (for context):\n\`\`\`html\n${sel.html}\n\`\`\`\n\nUser's instruction: ${prompt}`;
    await sendMessage(wrapped, displayOverride ?? prompt);
  }

  function elementQuickAction(kind: 'delete' | 'duplicate' | 'moveUp' | 'moveDown') {
    const map = {
      delete:    { p: 'Remove this element entirely.',                   d: '🗑 Delete this' },
      duplicate: { p: 'Duplicate this element so it appears twice in a row.', d: '📋 Duplicate this' },
      moveUp:    { p: 'Move this element above its previous sibling.',   d: '⬆️ Move up' },
      moveDown:  { p: 'Move this element below its next sibling.',       d: '⬇️ Move down' },
    } as const;
    const a = map[kind];
    submitElementEdit(a.p, a.d);
  }

  async function send() {
    if ((!input.trim() && attachments.length === 0) || streaming) return;
    const text = input;
    setInput('');
    const imgs = attachments.slice();
    setAttachments([]);
    await sendMessage(text || (imgs.length ? 'Match this design.' : ''), text || (imgs.length ? `📎 ${imgs.length} image${imgs.length === 1 ? '' : 's'}` : ''), imgs);
  }

  async function sendMessage(realMessage: string, displayInChat: string, images: Attachment[] = []) {
    if (!realMessage.trim() && images.length === 0) return;
    if (streaming) return;
    const text = realMessage;
    setMsgs((m) => [...m, { role: 'user', text: displayInChat + (images.length ? `\n\n[📎 ${images.length} image${images.length === 1 ? '' : 's'} attached]` : '') }, { role: 'assistant', text: '' }]);
    setStreaming(true);
    try {
      const id = await ensureApp();
      const r = await fetch(`${API}/builder/chat`, {
        method: 'POST', credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          app_id: id, message: text, intent: 'edit',
          images: images.map((a) => ({ mime: a.mime, data: a.b64 })),
        }),
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
              setStreamChars(assembled.length);
              if (html && Date.now() - lastIframeUpdate.current > 80) {
                setPreviewHtml(html + (html.includes('</html>') ? '' : '\n<!-- streaming… -->'));
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
      setStreamChars(0);
    }
  }

  return (
    <div className="grid md:grid-cols-[480px_1fr] gap-0 h-[calc(100vh-4rem)] relative">
      {/* Live peer cursors (overlay) */}
      {Array.from(peers.entries()).filter(([, p]) => p.x !== undefined && p.y !== undefined).map(([id, p]) => (
        <div key={id} aria-hidden style={{
          position: 'fixed', left: `${(p.x ?? 0) * 100}vw`, top: `${(p.y ?? 0) * 100}vh`,
          transform: 'translate(-2px, -2px)', pointerEvents: 'none', zIndex: 9999,
          transition: 'left 60ms linear, top 60ms linear',
        }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill={p.color}><path d="M2 2l6 16 3-7 7-3z" /></svg>
          <div style={{ background: p.color, color: 'white', padding: '2px 6px', borderRadius: 6, fontSize: 11, fontWeight: 600, marginTop: 2, whiteSpace: 'nowrap' }}>{p.name}</div>
        </div>
      ))}

      {/* Chat */}
      <div className="flex flex-col border-r border-white/10 bg-ink/40 backdrop-blur-xl">
        <div className="px-6 py-3 border-b border-white/10 flex items-center justify-between">
          <div className="text-sm text-white/60 flex items-center gap-2">
            Builder
            {peers.size > 0 && (
              <div className="flex -space-x-1">
                {Array.from(peers.values()).slice(0, 4).map((p, i) => (
                  <div key={i} title={p.name} className="size-5 rounded-full border-2 border-ink grid place-items-center text-[9px] font-bold text-white" style={{ background: p.color }}>{p.name[0]?.toUpperCase()}</div>
                ))}
                {peers.size > 4 && <div className="size-5 rounded-full bg-white/10 border-2 border-ink grid place-items-center text-[9px] font-bold">+{peers.size - 4}</div>}
              </div>
            )}
          </div>
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
        <div
          className={`p-4 border-t border-white/10 ${dragOver ? 'bg-flame/10 border-flame/40' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
          }}>
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {attachments.map((a, i) => (
                <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-white/10 group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.preview} alt={a.name} className="w-full h-full object-cover" />
                  <button onClick={() => removeAttachment(i)} className="absolute top-0.5 right-0.5 size-4 rounded-full bg-black/70 text-white text-[10px] leading-none opacity-0 group-hover:opacity-100">×</button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2 items-end">
            <button
              onClick={() => fileInput.current?.click()}
              title="Attach screenshots / sketches (Cmd+V to paste)"
              className="size-11 rounded-full bg-white/10 hover:bg-white/20 grid place-items-center text-lg shrink-0">
              📎
            </button>
            <input ref={fileInput} type="file" accept={ALLOWED_IMG.join(',')} multiple className="hidden"
              onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }} />
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
              placeholder={dragOver ? 'Drop image to attach…' : attachments.length > 0 ? 'Optional: describe what to change…' : appId ? 'What do you want to change?' : 'Describe your app…'}
              className="flex-1 rounded-full bg-white/10 px-5 py-3 outline-none focus:ring-2 focus:ring-flame backdrop-blur-md" />
            <button onClick={send} disabled={streaming || (!input.trim() && attachments.length === 0)} className="btn-primary disabled:opacity-50">
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
            <button
              onClick={() => { setEditMode((v) => !v); setSelected(null); }}
              title="Click any element in the preview to edit it"
              className={`text-xs rounded-full px-3 py-1 font-semibold ${editMode ? 'bg-flame text-white' : 'bg-white/5 text-white/60 hover:text-white'}`}>
              🎯 {editMode ? 'Selecting…' : 'Select'}
            </button>
          </div>
          {deployedUrl && (
            <a href={deployedUrl} target="_blank" rel="noreferrer" className="text-xs text-flame hover:underline truncate max-w-[40%]">
              {deployedUrl.replace(/^https?:\/\//, '')} ↗
            </a>
          )}
        </div>
        <div className="flex-1 relative">
          {view === 'preview' ? (
            <iframe srcDoc={editMode ? withSelectMode(previewHtml) : previewHtml} className={`w-full h-full bg-white transition-all ${streaming ? 'ring-2 ring-flame/60 ring-inset' : ''}`} sandbox="allow-scripts allow-forms allow-popups allow-modals allow-same-origin" />
          ) : (
            <pre className="absolute inset-0 overflow-auto p-4 text-xs leading-relaxed font-mono text-white/90 bg-[#0a0a0f]">{previewHtml || '// no code yet'}</pre>
          )}

          {/* Streaming indicator */}
          {streaming && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-flame/90 backdrop-blur-md text-white text-xs font-semibold px-4 py-1.5 shadow-lg">
              <span className="size-1.5 rounded-full bg-white animate-ping" />
              Generating · {streamChars.toLocaleString()} chars
            </div>
          )}

          {/* Element edit prompt */}
          {selected && (
            <div className="absolute left-1/2 bottom-6 -translate-x-1/2 w-[min(540px,90%)] bg-ink/95 backdrop-blur-xl border border-flame/40 rounded-2xl p-4 shadow-2xl">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-wider text-flame mb-1">Editing element</div>
                  <code className="text-xs text-white/70 break-all">{selected.selector}</code>
                  {selected.text && <div className="text-xs text-white/50 mt-1 line-clamp-2">&ldquo;{selected.text}&rdquo;</div>}
                </div>
                <button onClick={() => { setSelected(null); setEditPrompt(''); }} className="text-white/40 hover:text-white text-xl leading-none shrink-0">×</button>
              </div>
              <div className="grid grid-cols-4 gap-1.5 mb-2">
                <button onClick={() => elementQuickAction('delete')}    disabled={streaming} className="rounded-lg bg-white/5 hover:bg-white/10 text-xs py-2 disabled:opacity-50">🗑 Delete</button>
                <button onClick={() => elementQuickAction('duplicate')} disabled={streaming} className="rounded-lg bg-white/5 hover:bg-white/10 text-xs py-2 disabled:opacity-50">📋 Duplicate</button>
                <button onClick={() => elementQuickAction('moveUp')}    disabled={streaming} className="rounded-lg bg-white/5 hover:bg-white/10 text-xs py-2 disabled:opacity-50">⬆️ Move up</button>
                <button onClick={() => elementQuickAction('moveDown')}  disabled={streaming} className="rounded-lg bg-white/5 hover:bg-white/10 text-xs py-2 disabled:opacity-50">⬇️ Move down</button>
              </div>
              <form onSubmit={(e) => { e.preventDefault(); submitElementEdit(); }} className="flex gap-2">
                <input
                  autoFocus
                  value={editPrompt}
                  onChange={(e) => setEditPrompt(e.target.value)}
                  placeholder="Or describe the change: make it red, change copy, add a button below…"
                  className="flex-1 rounded-full bg-white/10 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-flame" />
                <button type="submit" disabled={!editPrompt.trim() || streaming}
                  className="btn-primary text-sm !px-5 !py-2 disabled:opacity-50">
                  {streaming ? '…' : 'Apply'}
                </button>
              </form>
            </div>
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

// ----- Visual element editor: injects a hover/click-capture script into the
//        preview iframe when select-mode is on. Clicking an element posts back
//        a stable CSS selector + outerHTML snippet so the parent can ask Claude
//        to patch that exact element.
function withSelectMode(html: string): string {
  if (!html) return html;
  const inject = `<style>
[data-sg-hover]{outline:2px dashed #ff5b1f!important;outline-offset:2px;cursor:crosshair!important}
[data-sg-selected]{outline:3px solid #ff5b1f!important;outline-offset:2px}
html,body{cursor:crosshair!important}
</style>
<script>(function(){
function cssPath(el){const parts=[];while(el&&el.nodeType===1&&parts.length<5){let s=el.tagName.toLowerCase();if(el.id){parts.unshift(s+'#'+CSS.escape(el.id));break;}const cls=(typeof el.className==='string'?el.className:'').split(/\\s+/).filter(Boolean).slice(0,2);if(cls.length)s+='.'+cls.map(c=>CSS.escape(c)).join('.');const sib=el.parentElement?Array.from(el.parentElement.children).filter(c=>c.tagName===el.tagName):[];if(sib.length>1)s+=':nth-of-type('+(sib.indexOf(el)+1)+')';parts.unshift(s);el=el.parentElement;}return parts.join(' > ');}
let lastH=null;
document.addEventListener('mouseover',function(e){if(lastH)lastH.removeAttribute('data-sg-hover');if(e.target&&e.target.setAttribute){e.target.setAttribute('data-sg-hover','1');lastH=e.target;}},true);
document.addEventListener('mouseout',function(e){if(e.target&&e.target.removeAttribute)e.target.removeAttribute('data-sg-hover');},true);
document.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();var t=e.target;document.querySelectorAll('[data-sg-selected]').forEach(function(el){el.removeAttribute('data-sg-selected');});t.setAttribute('data-sg-selected','1');try{parent.postMessage({__sg:true,type:'select',selector:cssPath(t),html:(t.outerHTML||'').slice(0,1500),text:(t.textContent||'').slice(0,200)},'*');}catch(err){}},true);
document.addEventListener('submit',function(e){e.preventDefault();},true);
})();</script>`;
  if (html.includes('</head>')) return html.replace('</head>', inject + '</head>');
  if (html.includes('<body>')) return html.replace('<body>', '<body>' + inject);
  return inject + html;
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

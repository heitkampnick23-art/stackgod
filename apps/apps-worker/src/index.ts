// Serves user-built apps from R2 at apps.stakgod.com/{slug}/{path...}
// Each app gets a built-in KV-backed mini backend reachable at /{slug}/__api__/db.
// We auto-inject `window.sg = { db: { get, put, list, del } }` into every served HTML.

interface Env { APPS: R2Bucket; APP_DATA: KVNamespace; }

const STATIC_HEADERS: Record<string, string> = {
  'cache-control': 'public, max-age=300',
  'x-frame-options': 'SAMEORIGIN',
  'referrer-policy': 'strict-origin-when-cross-origin',
};

const TYPES: Record<string, string> = {
  html: 'text/html; charset=utf-8', htm: 'text/html; charset=utf-8',
  js: 'text/javascript; charset=utf-8', mjs: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  json: 'application/json; charset=utf-8',
  svg: 'image/svg+xml',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', ico: 'image/x-icon',
  txt: 'text/plain; charset=utf-8', xml: 'application/xml',
  woff: 'font/woff', woff2: 'font/woff2',
};

const MAX_KEY_LEN = 256;
const MAX_VALUE_BYTES = 64_000;          // per-key limit
const MAX_KEYS_PER_APP = 5_000;          // soft anti-abuse cap

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const segs = url.pathname.split('/').filter(Boolean);
    if (segs.length === 0) return landing();
    const slug = segs[0];
    if (!/^[a-z0-9-]{1,64}$/.test(slug)) return text('bad slug', 400);

    // Per-app mini backend.
    if (segs[1] === '__api__') return handleApi(req, env, slug, segs.slice(2));

    let path = segs.slice(1).join('/');
    if (path === '' || path.endsWith('/')) path += 'index.html';
    const key = `apps/${slug}/${path}`;

    const obj = await env.APPS.get(key);
    if (obj) return r2Response(obj, path, slug);

    // SPA-style fallback to root index.
    const root = await env.APPS.get(`apps/${slug}/index.html`);
    if (root) return r2Response(root, 'index.html', slug);
    return text('app not found', 404);
  },
};

async function r2Response(obj: R2ObjectBody, path: string, slug: string): Promise<Response> {
  const ext = path.split('.').pop()?.toLowerCase() ?? 'html';
  const headers = new Headers(STATIC_HEADERS);
  headers.set('content-type', TYPES[ext] ?? 'application/octet-stream');
  if (obj.httpEtag) headers.set('etag', obj.httpEtag);

  if (ext === 'html' || ext === 'htm') {
    const html = await obj.text();
    return new Response(injectSgSdk(html, slug), { status: 200, headers });
  }
  return new Response(obj.body, { status: 200, headers });
}

// Inject a tiny SDK so generated apps can call our backend with no setup.
function injectSgSdk(html: string, slug: string): string {
  const sdk = `<script>window.sg=(function(){const B='/${slug}/__api__';return {db:{
async get(k){const r=await fetch(B+'/db?key='+encodeURIComponent(k));if(r.status===404)return null;if(!r.ok)throw new Error('sg.db.get '+r.status);return r.json();},
async put(k,v){const r=await fetch(B+'/db?key='+encodeURIComponent(k),{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(v)});if(!r.ok)throw new Error('sg.db.put '+r.status);return true;},
async del(k){await fetch(B+'/db?key='+encodeURIComponent(k),{method:'DELETE'});},
async list(prefix){const r=await fetch(B+'/db/list?prefix='+encodeURIComponent(prefix||''));if(!r.ok)throw new Error('sg.db.list '+r.status);return r.json();}
}};})();</script>`;
  if (html.includes('</head>')) return html.replace('</head>', sdk + '</head>');
  if (html.includes('<body>')) return html.replace('<body>', '<body>' + sdk);
  return sdk + html;
}

async function handleApi(req: Request, env: Env, slug: string, sub: string[]): Promise<Response> {
  // CORS for app->api fetch on the same host (no preflight needed for same-origin).
  if (sub[0] !== 'db') return text('not found', 404);

  const url = new URL(req.url);
  const ns = `app:${slug}:`;

  if (sub[1] === 'list') {
    const prefix = url.searchParams.get('prefix') ?? '';
    const list = await env.APP_DATA.list({ prefix: ns + prefix, limit: 1000 });
    return json(list.keys.map((k) => k.name.slice(ns.length)));
  }

  const key = url.searchParams.get('key');
  if (!key || key.length > MAX_KEY_LEN) return text('bad key', 400);
  const fullKey = ns + key;

  if (req.method === 'GET') {
    const v = await env.APP_DATA.get(fullKey);
    if (v === null) return text('not found', 404);
    return new Response(v, { status: 200, headers: { 'content-type': 'application/json; charset=utf-8' } });
  }
  if (req.method === 'PUT' || req.method === 'POST') {
    const raw = await req.text();
    if (raw.length > MAX_VALUE_BYTES) return text('value too large', 413);
    try { JSON.parse(raw); } catch { return text('value must be valid JSON', 400); }
    // Soft cap on per-app key count (best-effort, not transactional).
    const existing = await env.APP_DATA.get(fullKey);
    if (existing === null) {
      const list = await env.APP_DATA.list({ prefix: ns, limit: 1 });
      if (list.list_complete === false) {
        const count = await countKeys(env.APP_DATA, ns);
        if (count >= MAX_KEYS_PER_APP) return text(`per-app key limit ${MAX_KEYS_PER_APP} reached`, 429);
      }
    }
    await env.APP_DATA.put(fullKey, raw);
    return json({ ok: true });
  }
  if (req.method === 'DELETE') {
    await env.APP_DATA.delete(fullKey);
    return json({ ok: true });
  }
  return text('method not allowed', 405);
}

async function countKeys(kv: KVNamespace, prefix: string): Promise<number> {
  let cursor: string | undefined;
  let n = 0;
  for (let i = 0; i < 6; i++) {
    const r = await kv.list({ prefix, cursor, limit: 1000 });
    n += r.keys.length;
    if (r.list_complete) return n;
    cursor = (r as { cursor?: string }).cursor;
  }
  return n;
}

function text(s: string, status = 200): Response { return new Response(s, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } }); }
function json(o: unknown, status = 200): Response { return new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8' } }); }

function landing(): Response {
  return new Response(
    `<!doctype html><meta charset=utf-8><title>Stackgod Apps</title><body style="font:16px system-ui;background:#0a0a0f;color:#f5f5f7;display:grid;place-items:center;height:100vh;text-align:center"><div><h1 style="font-family:Cinzel,serif;color:#d4af37">Stackgod Apps</h1><p style="opacity:.6">User apps live here at apps.stakgod.com/{slug}.</p><p><a style="color:#ff5b1f" href="https://stakgod.com/build">Start building →</a></p></div>`,
    { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } }
  );
}

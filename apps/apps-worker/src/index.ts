// Serves user-built apps from R2 at apps.stakgod.com/{slug}/{path...}
// Plus a built-in mini backend at /{slug}/__api__/* with:
//   db    — KV-backed key/value (per app, public access)
//   auth  — magic-link sign-in (per app sessions, namespaced users)
//   ai    — Claude chat / Flux image proxy, charged to the BUILDER's quota
// We auto-inject `window.sg = { db, auth, ai }` into every served HTML.

interface Env {
  APPS: R2Bucket;
  APP_DATA: KVNamespace;
  APP_HOSTS: KVNamespace;
  DB: D1Database;
  ANTHROPIC_API_KEY: string;
  RESEND_API_KEY: string;
  APP_URL: string;
  APPS_HOST: string;
}

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
const MAX_VALUE_BYTES = 64_000;
const MAX_KEYS_PER_APP = 5_000;
const MAX_AI_INPUT_CHARS = 20_000;
const MAX_AI_OUTPUT_TOKENS = 1024;

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const host = (req.headers.get('host') ?? url.hostname).toLowerCase();
    const segs = url.pathname.split('/').filter(Boolean);

    let slug: string | undefined;
    let pathSegs: string[];
    if (host === env.APPS_HOST) {
      if (segs.length === 0) return landing();
      slug = segs[0];
      pathSegs = segs.slice(1);
    } else {
      const mapped = await env.APP_HOSTS.get(`host:${host}`);
      if (!mapped) return text('app not found for this host', 404);
      slug = mapped;
      pathSegs = segs;
    }
    if (!slug || !/^[a-z0-9-]{1,64}$/.test(slug)) return text('bad slug', 400);

    if (pathSegs[0] === '__api__') return handleApi(req, env, slug, pathSegs.slice(1));

    let path = pathSegs.join('/');
    if (path === '' || path.endsWith('/')) path += 'index.html';
    const obj = await env.APPS.get(`apps/${slug}/${path}`);
    if (obj) return r2Response(obj, path, slug);
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
    return new Response(injectSdk(html, slug), { status: 200, headers });
  }
  return new Response(obj.body, { status: 200, headers });
}

// ---------- Auto-injected SDK ----------

function injectSdk(html: string, slug: string): string {
  const sdk = `<script>window.sg=(function(){const B='/${slug}/__api__';
async function J(p,o){const r=await fetch(B+p,o);if(r.status===204)return null;const t=await r.text();let j=null;try{j=t?JSON.parse(t):null}catch{}if(!r.ok)throw Object.assign(new Error(j&&j.error||t||r.status),{status:r.status,detail:j});return j;}
return {
db:{
get:k=>fetch(B+'/db?key='+encodeURIComponent(k)).then(r=>r.status===404?null:r.json()),
put:(k,v)=>J('/db?key='+encodeURIComponent(k),{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(v)}),
del:k=>J('/db?key='+encodeURIComponent(k),{method:'DELETE'}),
list:p=>J('/db/list?prefix='+encodeURIComponent(p||'')),
},
auth:{
async user(){try{return await J('/auth/me')}catch{return null}},
signIn:email=>J('/auth/magic',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email})}),
signOut:()=>J('/auth/signout',{method:'POST'}),
},
ai:{
chat:({system,messages,model})=>J('/ai/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({system,messages,model})}),
image:({prompt,steps})=>J('/ai/image',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({prompt,steps})}),
}};})();</script>`;

  const badge = `<div id="__sg_badge__" style="position:fixed;bottom:12px;right:12px;z-index:2147483647;font:500 12px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;color-scheme:light dark;display:flex;align-items:center;gap:6px;padding:8px 12px;border-radius:9999px;background:rgba(10,10,15,0.85);color:#f5f5f7;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);box-shadow:0 4px 20px rgba(0,0,0,0.25),inset 0 1px 0 rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.1)">
<a href="https://stakgod.com/?utm_source=app&amp;utm_medium=badge&amp;utm_campaign=${slug}" target="_blank" rel="noreferrer" style="color:inherit;text-decoration:none;display:flex;align-items:center;gap:4px"><span style="color:#d4af37;font-weight:700">STAK</span><span style="font-weight:700">GOD</span></a>
<span style="opacity:0.4">·</span>
<a href="https://stakgod.com/build?fork=${slug}" target="_blank" rel="noreferrer" style="color:#ff5b1f;text-decoration:none;font-weight:600">Remix</a>
</div>`;

  let out = html;
  if (out.includes('</head>')) out = out.replace('</head>', sdk + '</head>');
  else if (out.includes('<body>')) out = out.replace('<body>', '<body>' + sdk);
  else out = sdk + out;

  if (out.includes('</body>')) out = out.replace('</body>', badge + '</body>');
  else out = out + badge;
  return out;
}

// ---------- Router ----------

async function handleApi(req: Request, env: Env, slug: string, sub: string[]): Promise<Response> {
  if (sub[0] === 'db')   return handleDb(req, env, slug, sub.slice(1));
  if (sub[0] === 'auth') return handleAuth(req, env, slug, sub.slice(1));
  if (sub[0] === 'ai')   return handleAi(req, env, slug, sub.slice(1));
  return text('not found', 404);
}

// ---------- sg.db ----------

async function handleDb(req: Request, env: Env, slug: string, sub: string[]): Promise<Response> {
  const url = new URL(req.url);
  const ns = `app:${slug}:`;

  if (sub[0] === 'list') {
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
    if (await env.APP_DATA.get(fullKey) === null) {
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

// ---------- sg.auth ----------
//
// Per-app users + sessions, namespaced in APP_DATA so they never collide with
// the builder's sg.db data:
//   appuser:{slug}:email:{email}      → user object
//   appsess:{slug}:{token}            → user_id + email + expires
//   applink:{token}                   → {slug, email, expires} (15-min TTL)
//
// Cookie name is sg_user_{slug} so multiple apps on same parent host don't collide.

interface AppUser { id: string; email: string; created_at: number; }

const SESSION_TTL = 60 * 60 * 24 * 30; // 30 days
const MAGIC_TTL   = 60 * 15;

async function handleAuth(req: Request, env: Env, slug: string, sub: string[]): Promise<Response> {
  if (sub[0] === 'me' && req.method === 'GET') {
    const user = await currentUser(req, env, slug);
    if (!user) return text('not signed in', 401);
    return json({ id: user.id, email: user.email });
  }

  if (sub[0] === 'magic' && req.method === 'POST') {
    const { email } = await req.json<{ email: string }>();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'invalid_email' }, 400);
    const token = crypto.randomUUID() + crypto.randomUUID();
    await env.APP_DATA.put(`applink:${token}`, JSON.stringify({ slug, email: email.toLowerCase() }), { expirationTtl: MAGIC_TTL });
    const url = new URL(req.url);
    const link = `${url.origin}/${slug}/__api__/auth/verify?token=${token}`;
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: 'Stakgod <login@stakgod.com>',
        to: email,
        subject: `Sign in to your app`,
        html: `<p>Click to sign in: <a href="${link}">${link}</a></p><p>Expires in 15 minutes.</p>`,
      }),
    });
    if (!r.ok) return json({ error: 'send_failed', detail: await r.text() }, 500);
    return json({ ok: true });
  }

  if (sub[0] === 'verify' && req.method === 'GET') {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');
    if (!token) return text('missing token', 400);
    const raw = await env.APP_DATA.get(`applink:${token}`);
    if (!raw) return text('expired or invalid', 401);
    await env.APP_DATA.delete(`applink:${token}`);
    const { email } = JSON.parse(raw) as { slug: string; email: string };

    let userJson = await env.APP_DATA.get(`appuser:${slug}:email:${email}`);
    let user: AppUser;
    if (userJson) user = JSON.parse(userJson);
    else {
      user = { id: crypto.randomUUID(), email, created_at: Math.floor(Date.now() / 1000) };
      await env.APP_DATA.put(`appuser:${slug}:email:${email}`, JSON.stringify(user));
    }
    const sess = crypto.randomUUID() + crypto.randomUUID();
    const expires = Math.floor(Date.now() / 1000) + SESSION_TTL;
    await env.APP_DATA.put(`appsess:${slug}:${sess}`, JSON.stringify({ user_id: user.id, email, expires }), { expirationTtl: SESSION_TTL });
    const cookieDomain = url.hostname.endsWith('.stakgod.com') ? '; Domain=.stakgod.com' : '';
    return new Response(null, {
      status: 302,
      headers: {
        location: `/${slug}/`,
        'set-cookie': `sg_user_${slug}=${sess}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL}${cookieDomain}`,
      },
    });
  }

  if (sub[0] === 'signout' && req.method === 'POST') {
    const cookie = req.headers.get('cookie') ?? '';
    const m = cookie.match(new RegExp(`sg_user_${slug}=([^;]+)`));
    if (m) await env.APP_DATA.delete(`appsess:${slug}:${m[1]}`);
    return new Response(null, { status: 204, headers: { 'set-cookie': `sg_user_${slug}=; Path=/; Max-Age=0` } });
  }

  return text('not found', 404);
}

async function currentUser(req: Request, env: Env, slug: string): Promise<AppUser | null> {
  const cookie = req.headers.get('cookie') ?? '';
  const m = cookie.match(new RegExp(`sg_user_${slug}=([^;]+)`));
  if (!m) return null;
  const sess = await env.APP_DATA.get(`appsess:${slug}:${m[1]}`);
  if (!sess) return null;
  const { user_id, email } = JSON.parse(sess) as { user_id: string; email: string };
  return { id: user_id, email, created_at: 0 };
}

// ---------- sg.ai ----------
//
// Calls are charged to the BUILDER's monthly_messages quota — same wall as
// the chat builder. When the builder upgrades, their app's AI just works.

interface ChatBody {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  system?: string;
  model?: 'haiku' | 'sonnet' | 'opus';
}

const MODEL_MAP: Record<NonNullable<ChatBody['model']>, string> = {
  haiku: 'claude-haiku-4-5-20251001',
  sonnet: 'claude-sonnet-4-6',
  opus: 'claude-opus-4-7',
};

const PRICING_USD: Record<string, { in: number; out: number }> = {
  'claude-haiku-4-5-20251001': { in: 1, out: 5 },
  'claude-sonnet-4-6':         { in: 3, out: 15 },
  'claude-opus-4-7':           { in: 15, out: 75 },
};

async function handleAi(req: Request, env: Env, slug: string, sub: string[]): Promise<Response> {
  // Resolve the builder (owner) of this app to charge their quota.
  const owner = await env.DB.prepare(`SELECT user_id FROM apps WHERE slug=?`).bind(slug).first<{ user_id: string }>();
  if (!owner) return json({ error: 'app_not_found' }, 404);
  const planRow = await env.DB.prepare(`SELECT plan FROM users WHERE id=?`).bind(owner.user_id).first<{ plan: string }>();
  const plan = (planRow?.plan ?? 'free') as 'free' | 'hobby' | 'pro' | 'studio';

  // Same monthly_messages limits as builder chat.
  const monthlyLimit: Record<typeof plan, number> = { free: 150, hobby: 200, pro: 1500, studio: 6000 };
  const startOfMonth = Math.floor(new Date(new Date().toISOString().slice(0, 7) + '-01').getTime() / 1000);
  const usage = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM usage_events WHERE user_id=? AND kind='ai_message' AND ts>=?`
  ).bind(owner.user_id, startOfMonth).first<{ n: number }>();
  if ((usage?.n ?? 0) >= monthlyLimit[plan]) {
    return json({ error: 'builder_quota_exceeded', message: `This app's owner has hit their monthly AI quota. Have them upgrade at ${env.APP_URL}/pricing.` }, 402);
  }

  if (sub[0] === 'chat' && req.method === 'POST') {
    const body = await req.json<ChatBody>();
    if (!Array.isArray(body.messages) || body.messages.length === 0) return json({ error: 'missing_messages' }, 400);
    const totalChars = (body.system ?? '').length + body.messages.reduce((s, m) => s + m.content.length, 0);
    if (totalChars > MAX_AI_INPUT_CHARS) return json({ error: 'input_too_large', max: MAX_AI_INPUT_CHARS }, 413);

    const modelId = MODEL_MAP[body.model ?? (plan === 'free' ? 'haiku' : 'sonnet')];
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: modelId,
        max_tokens: MAX_AI_OUTPUT_TOKENS,
        system: body.system,
        messages: body.messages,
      }),
    });
    if (!r.ok) return json({ error: 'ai_failed', detail: (await r.text()).slice(0, 500) }, 502);
    const data = await r.json<{
      content: Array<{ type: string; text?: string }>;
      usage: { input_tokens: number; output_tokens: number };
    }>();
    const text = data.content.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('');
    const tokensIn = data.usage?.input_tokens ?? 0;
    const tokensOut = data.usage?.output_tokens ?? 0;
    const p = PRICING_USD[modelId];
    const costUsd = (tokensIn / 1_000_000) * p.in + (tokensOut / 1_000_000) * p.out;
    await env.DB.prepare(
      `INSERT INTO usage_events (id, user_id, kind, model, tokens_in, tokens_out, cost_usd) VALUES (?, ?, 'ai_message', ?, ?, ?, ?)`
    ).bind(crypto.randomUUID(), owner.user_id, modelId, tokensIn, tokensOut, costUsd).run();
    return json({ text, model: modelId, tokens_in: tokensIn, tokens_out: tokensOut });
  }

  if (sub[0] === 'image' && req.method === 'POST') {
    const { prompt, steps } = await req.json<{ prompt: string; steps?: number }>();
    if (!prompt || prompt.length > 1000) return json({ error: 'bad_prompt' }, 400);
    // Image gen via Anthropic isn't available; we tell builders to use a backend service.
    // Placeholder for future Workers AI integration.
    await env.DB.prepare(
      `INSERT INTO usage_events (id, user_id, kind, model, tokens_in, tokens_out, cost_usd) VALUES (?, ?, 'ai_message', ?, 0, 0, 0.003)`
    ).bind(crypto.randomUUID(), owner.user_id, 'image-placeholder').run();
    return json({ error: 'image_not_yet_available', hint: 'sg.ai.image is coming soon. Use sg.ai.chat for now.' }, 501);
  }

  return text('not found', 404);
}

// ---------- helpers ----------

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
    `<!doctype html><meta charset=utf-8><title>Stakgod Apps</title><body style="font:16px system-ui;background:#0a0a0f;color:#f5f5f7;display:grid;place-items:center;height:100vh;text-align:center"><div><h1 style="font-family:Cinzel,serif;color:#d4af37">Stakgod Apps</h1><p style="opacity:.6">User apps live here at apps.stakgod.com/{slug}.</p><p><a style="color:#ff5b1f" href="https://stakgod.com/build">Start building →</a></p></div>`,
    { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } }
  );
}

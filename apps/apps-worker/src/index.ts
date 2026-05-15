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
  STRIPE_SECRET_KEY: string;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  VAPID_SUBJECT: string;
  AI: Ai;
  APP_URL: string;
  APPS_HOST: string;
}

import { sendPush, type PushSubscription } from './lib/webpush';

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
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runDueTasks(env).then(() => {}));
  },

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
async stream({system,messages,model,onDelta,signal}){const r=await fetch(B+'/ai/stream',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({system,messages,model}),signal});if(!r.ok)throw new Error('sg.ai.stream '+r.status);const rd=r.body.getReader();const dec=new TextDecoder();let buf='';let final={text:'',tokens_in:0,tokens_out:0,model};let assembled='';while(true){const{value,done}=await rd.read();if(done)break;buf+=dec.decode(value,{stream:true});const evs=buf.split('\\n\\n');buf=evs.pop()||'';for(const ev of evs){const ln=ev.split('\\n').find(l=>l.startsWith('data: '));if(!ln)continue;try{const j=JSON.parse(ln.slice(6));if(j.delta){assembled+=j.delta;if(onDelta)onDelta(j.delta,assembled);}if(j.done){final={text:assembled,tokens_in:j.tokens_in,tokens_out:j.tokens_out,model:j.model};}if(j.error)throw new Error(j.error);}catch(e){}}}return final;},
},
payments:{
checkout:o=>J('/payments/checkout',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(o)}),
session:id=>J('/payments/session?id='+encodeURIComponent(id)),
},
async upload(file,opts){const fd=new FormData();fd.append('file',file,(opts&&opts.name)||(file&&file.name)||'file');const r=await fetch(B+'/uploads',{method:'POST',body:fd});const t=await r.text();let j=null;try{j=t?JSON.parse(t):null}catch{}if(!r.ok)throw Object.assign(new Error(j&&j.error||t||r.status),{status:r.status,detail:j});return j;},
uploads:{
list:()=>J('/uploads'),
del:k=>J('/uploads?key='+encodeURIComponent(k),{method:'DELETE'}),
},
email:{
send:o=>J('/email/send',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(o)}),
},
geo:()=>J('/geo'),
notify:{
async ask(){if(!('Notification'in window))return 'unsupported';if(Notification.permission==='granted')return 'granted';if(Notification.permission==='denied')return 'denied';return await Notification.requestPermission();},
async show(title,opts){if(!('Notification'in window))return false;if(Notification.permission!=='granted'){const p=await this.ask();if(p!=='granted')return false;}new Notification(title,opts||{});return true;},
async subscribe(){if(!('serviceWorker'in navigator)||!('PushManager'in window))throw new Error('push_unsupported');const p=await this.ask();if(p!=='granted')throw new Error('permission_denied');const reg=await navigator.serviceWorker.register('/${slug}/__api__/notify/sw.js',{scope:'/${slug}/'});await navigator.serviceWorker.ready;const{publicKey}=await J('/notify/key');const k=Uint8Array.from(atob(publicKey.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-publicKey.length%4)%4)),c=>c.charCodeAt(0));const sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:k});const j=sub.toJSON();await J('/notify/subscribe',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({endpoint:j.endpoint,keys:j.keys})});return{ok:true};},
async unsubscribe(){if(!('serviceWorker'in navigator))return{ok:true};const reg=await navigator.serviceWorker.getRegistration('/${slug}/');if(!reg)return{ok:true};const sub=await reg.pushManager.getSubscription();if(sub){await J('/notify/unsubscribe',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({endpoint:sub.endpoint})});await sub.unsubscribe();}return{ok:true};},
broadcast:p=>J('/notify/broadcast',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(p)}),
toMe:p=>J('/notify/self',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(p)}),
},
cron:{
add:t=>J('/cron',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(t)}),
list:()=>J('/cron'),
del:id=>J('/cron/'+encodeURIComponent(id),{method:'DELETE'}),
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
  if (sub[0] === 'db')       return handleDb(req, env, slug, sub.slice(1));
  if (sub[0] === 'auth')     return handleAuth(req, env, slug, sub.slice(1));
  if (sub[0] === 'ai')       return handleAi(req, env, slug, sub.slice(1));
  if (sub[0] === 'payments') return handlePayments(req, env, slug, sub.slice(1));
  if (sub[0] === 'uploads')  return handleUploads(req, env, slug);
  if (sub[0] === 'email')    return handleEmail(req, env, slug, sub.slice(1));
  if (sub[0] === 'geo')      return handleGeo(req);
  if (sub[0] === 'notify')   return handleNotify(req, env, slug, sub.slice(1));
  if (sub[0] === 'cron')     return handleCron(req, env, slug, sub.slice(1));
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

  if (sub[0] === 'stream' && req.method === 'POST') {
    const body = await req.json<ChatBody>();
    if (!Array.isArray(body.messages) || body.messages.length === 0) return json({ error: 'missing_messages' }, 400);
    const totalChars = (body.system ?? '').length + body.messages.reduce((s, m) => s + m.content.length, 0);
    if (totalChars > MAX_AI_INPUT_CHARS) return json({ error: 'input_too_large', max: MAX_AI_INPUT_CHARS }, 413);

    const modelId = MODEL_MAP[body.model ?? (plan === 'free' ? 'haiku' : 'sonnet')];
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
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
        stream: true,
      }),
    });
    if (!upstream.ok || !upstream.body) {
      const detail = (await upstream.text().catch(() => '')).slice(0, 500);
      return json({ error: 'ai_failed', detail }, 502);
    }

    // Proxy Anthropic SSE → our SSE, parse usage from message_start/message_delta,
    // forward only text deltas as { delta: '...' } JSON SSE events for a tiny SDK.
    const sse = new ReadableStream({
      async start(controller) {
        const enc = new TextEncoder();
        const dec = new TextDecoder();
        const reader = upstream.body!.getReader();
        let buf = '';
        let tokensIn = 0, tokensOut = 0;
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            const events = buf.split('\n\n');
            buf = events.pop() ?? '';
            for (const ev of events) {
              const dataLine = ev.split('\n').find((l) => l.startsWith('data: '));
              if (!dataLine) continue;
              try {
                const j = JSON.parse(dataLine.slice(6));
                if (j.type === 'content_block_delta' && j.delta?.type === 'text_delta') {
                  controller.enqueue(enc.encode(`data: ${JSON.stringify({ delta: j.delta.text })}\n\n`));
                }
                if (j.type === 'message_start' && j.message?.usage) tokensIn = j.message.usage.input_tokens ?? 0;
                if (j.type === 'message_delta' && j.usage)         tokensOut = j.usage.output_tokens ?? 0;
              } catch {}
            }
          }
          const p = PRICING_USD[modelId];
          const costUsd = (tokensIn / 1_000_000) * p.in + (tokensOut / 1_000_000) * p.out;
          await env.DB.prepare(
            `INSERT INTO usage_events (id, user_id, kind, model, tokens_in, tokens_out, cost_usd) VALUES (?, ?, 'ai_message', ?, ?, ?, ?)`
          ).bind(crypto.randomUUID(), owner.user_id, modelId, tokensIn, tokensOut, costUsd).run();
          controller.enqueue(enc.encode(`data: ${JSON.stringify({ done: true, model: modelId, tokens_in: tokensIn, tokens_out: tokensOut })}\n\n`));
        } catch (e) {
          controller.enqueue(enc.encode(`data: ${JSON.stringify({ error: String(e) })}\n\n`));
        } finally {
          controller.close();
        }
      },
    });
    return new Response(sse, { headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' } });
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
    if (!prompt || typeof prompt !== 'string' || prompt.length === 0 || prompt.length > 1000) return json({ error: 'bad_prompt' }, 400);
    const stepCount = Math.min(8, Math.max(1, steps ?? 4));
    try {
      const out = await env.AI.run('@cf/black-forest-labs/flux-1-schnell', { prompt: prompt.slice(0, 1000), steps: stepCount }) as { image?: string };
      if (!out?.image) return json({ error: 'gen_failed' }, 502);
      await env.DB.prepare(
        `INSERT INTO usage_events (id, user_id, kind, model, tokens_in, tokens_out, cost_usd) VALUES (?, ?, 'ai_message', ?, 0, 0, 0.003)`
      ).bind(crypto.randomUUID(), owner.user_id, 'flux-1-schnell').run();
      return json({
        base64: out.image,
        data_url: `data:image/jpeg;base64,${out.image}`,
        mime: 'image/jpeg',
        model: '@cf/black-forest-labs/flux-1-schnell',
        steps: stepCount,
      });
    } catch (e) {
      return json({ error: 'gen_failed', detail: String(e).slice(0, 300) }, 502);
    }
  }

  return text('not found', 404);
}

// ---------- sg.payments ----------
//
// Stripe Checkout via the BUILDER's Connect account.
// 10% application_fee_amount goes to Stakgod (matches Stripe Connect setup).
// Builders must connect Stripe first via /dashboard.

interface CheckoutItem { name: string; amount_cents: number; quantity?: number; description?: string; }
interface CheckoutBody {
  items: CheckoutItem[];
  mode?: 'payment' | 'subscription_one_off';
  success_url?: string;
  cancel_url?: string;
  customer_email?: string;
  metadata?: Record<string, string>;
}

const STAKGOD_FEE_BPS = 1000; // 10.00%
const MAX_ITEMS = 10;
const MAX_AMOUNT_CENTS = 2_000_000; // $20k cap per checkout

async function handlePayments(req: Request, env: Env, slug: string, sub: string[]): Promise<Response> {
  const url = new URL(req.url);

  if (sub[0] === 'checkout' && req.method === 'POST') {
    const body = await req.json<CheckoutBody>();
    if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > MAX_ITEMS) {
      return json({ error: 'invalid_items', max: MAX_ITEMS }, 400);
    }
    let total = 0;
    for (const it of body.items) {
      if (!it.name || typeof it.amount_cents !== 'number' || it.amount_cents < 50) return json({ error: 'invalid_item', detail: 'each item needs name + amount_cents>=50' }, 400);
      total += it.amount_cents * (it.quantity ?? 1);
    }
    if (total > MAX_AMOUNT_CENTS) return json({ error: 'amount_too_large', max_cents: MAX_AMOUNT_CENTS }, 400);

    // Resolve owner + their Stripe Connect account.
    const owner = await env.DB.prepare(
      `SELECT u.id, u.stripe_connect_account_id FROM apps a JOIN users u ON u.id = a.user_id WHERE a.slug=?`
    ).bind(slug).first<{ id: string; stripe_connect_account_id: string | null }>();
    if (!owner) return json({ error: 'app_not_found' }, 404);
    if (!owner.stripe_connect_account_id) {
      return json({
        error: 'owner_not_connected',
        message: `This app's owner hasn't connected Stripe yet, so payments can't be collected.`,
        connect_url: `${env.APP_URL}/dashboard`,
      }, 412);
    }

    const fee = Math.floor((total * STAKGOD_FEE_BPS) / 10_000);
    const successDefault = `${url.origin}/${slug}/?sg_checkout=success`;
    const cancelDefault  = `${url.origin}/${slug}/?sg_checkout=cancelled`;
    const params = new URLSearchParams();
    params.set('mode', 'payment');
    params.set('success_url', validUrl(body.success_url, slug, env) ?? successDefault);
    params.set('cancel_url',  validUrl(body.cancel_url,  slug, env) ?? cancelDefault);
    params.set('payment_intent_data[application_fee_amount]', String(fee));
    if (body.customer_email) params.set('customer_email', body.customer_email);
    params.set('metadata[stakgod_slug]', slug);
    params.set('metadata[stakgod_owner]', owner.id);
    if (body.metadata) for (const [k, v] of Object.entries(body.metadata)) params.set(`metadata[${'app_' + k}]`, String(v).slice(0, 500));
    body.items.forEach((it, i) => {
      params.set(`line_items[${i}][quantity]`, String(it.quantity ?? 1));
      params.set(`line_items[${i}][price_data][currency]`, 'usd');
      params.set(`line_items[${i}][price_data][unit_amount]`, String(it.amount_cents));
      params.set(`line_items[${i}][price_data][product_data][name]`, it.name.slice(0, 200));
      if (it.description) params.set(`line_items[${i}][price_data][product_data][description]`, it.description.slice(0, 500));
    });

    const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
        'content-type': 'application/x-www-form-urlencoded',
        'stripe-account': owner.stripe_connect_account_id,
      },
      body: params.toString(),
    });
    if (!r.ok) return json({ error: 'stripe_failed', detail: (await r.text()).slice(0, 800) }, 502);
    const s = await r.json<{ id: string; url: string }>();
    return json({ url: s.url, session_id: s.id });
  }

  // Verify a checkout completed (called from the success_url page).
  if (sub[0] === 'session' && req.method === 'GET') {
    const sessionId = url.searchParams.get('id');
    if (!sessionId || !/^cs_(live|test)_/.test(sessionId)) return json({ error: 'bad_session_id' }, 400);
    const owner = await env.DB.prepare(
      `SELECT u.stripe_connect_account_id FROM apps a JOIN users u ON u.id=a.user_id WHERE a.slug=?`
    ).bind(slug).first<{ stripe_connect_account_id: string | null }>();
    if (!owner?.stripe_connect_account_id) return json({ error: 'owner_not_connected' }, 412);
    const r = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
      headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'stripe-account': owner.stripe_connect_account_id },
    });
    if (!r.ok) return json({ error: 'stripe_failed' }, 502);
    const s = await r.json<{ id: string; payment_status: string; amount_total: number; currency: string; customer_email: string | null; metadata: Record<string, string> }>();
    return json({
      id: s.id,
      paid: s.payment_status === 'paid',
      amount_cents: s.amount_total,
      currency: s.currency,
      customer_email: s.customer_email,
      metadata: s.metadata,
    });
  }

  return text('not found', 404);
}

function validUrl(u: string | undefined, slug: string, env: Env): string | null {
  if (!u) return null;
  try {
    const parsed = new URL(u);
    // Only allow same-app or stakgod-host redirects.
    if (parsed.hostname === env.APPS_HOST && parsed.pathname.startsWith(`/${slug}/`)) return u;
    return null;
  } catch { return null; }
}

// ---------- sg.cron (scheduled tasks via Workers cron trigger) ----------
//
// Tasks live in KV at appcron:{slug}:{id} → { name, schedule, action, next_run }
// The scheduled() handler fires every minute, lists due tasks, runs them, reschedules.
//
// Supported schedules (v0):
//   '@hourly'      every hour on :00
//   '@daily'       every day at 00:00 UTC
//   '@weekly'      every Monday 00:00 UTC
//   'HH:MM'        daily at that UTC time
//   'every Nm'     every N minutes (1..1440)
//
// Supported actions (v0):
//   { kind: 'push',    title, body?, url?, scope?: 'all' }
//   { kind: 'webhook', url, body?, headers? }

interface CronAction {
  kind: 'push' | 'webhook';
  title?: string; body?: string; url?: string; scope?: 'all';
  body_json?: unknown; headers?: Record<string, string>;
}
interface CronTask {
  id: string; slug: string; owner: string; name: string;
  schedule: string; action: CronAction;
  next_run: number; last_run: number | null; created_at: number;
}

const MAX_TASKS_PER_APP = 20;
const CRON_QUOTA_BY_PLAN: Record<'free' | 'hobby' | 'pro' | 'studio', number> = {
  free: 100, hobby: 1000, pro: 10000, studio: 100000,
};

async function handleCron(req: Request, env: Env, slug: string, sub: string[]): Promise<Response> {
  const user = await currentUser(req, env, slug);
  if (!user) return json({ error: 'sign_in_required' }, 401);
  const ownerId = user.id;

  if (req.method === 'POST' && sub[0] === undefined) {
    const body = await req.json<{ name: string; schedule: string; action: CronAction }>();
    if (!body?.name || !body?.schedule || !body?.action) return json({ error: 'missing_fields' }, 400);
    const next = nextRun(body.schedule, Date.now());
    if (next === null) return json({ error: 'bad_schedule', supported: ['@hourly', '@daily', '@weekly', 'HH:MM', 'every Nm'] }, 400);
    if (body.action.kind !== 'push' && body.action.kind !== 'webhook') return json({ error: 'bad_action_kind' }, 400);
    if (body.action.kind === 'push' && !body.action.title) return json({ error: 'push_needs_title' }, 400);
    if (body.action.kind === 'webhook' && !body.action.url) return json({ error: 'webhook_needs_url' }, 400);

    // Per-app cap.
    const existing = await env.APP_DATA.list({ prefix: `appcron:${slug}:`, limit: MAX_TASKS_PER_APP + 1 });
    if (existing.keys.length >= MAX_TASKS_PER_APP) return json({ error: 'task_limit', limit: MAX_TASKS_PER_APP }, 429);

    const id = crypto.randomUUID();
    const task: CronTask = {
      id, slug, owner: ownerId, name: body.name.slice(0, 80),
      schedule: body.schedule, action: body.action,
      next_run: next, last_run: null, created_at: Math.floor(Date.now() / 1000),
    };
    await env.APP_DATA.put(`appcron:${slug}:${id}`, JSON.stringify(task));
    return json({ ok: true, id, next_run: next });
  }

  if (req.method === 'GET' && sub[0] === undefined) {
    const list = await env.APP_DATA.list({ prefix: `appcron:${slug}:`, limit: 100 });
    const out: CronTask[] = [];
    for (const k of list.keys) {
      const raw = await env.APP_DATA.get(k.name);
      if (raw) out.push(JSON.parse(raw));
    }
    return json(out.sort((a, b) => a.next_run - b.next_run));
  }

  if (req.method === 'DELETE' && sub[0]) {
    const id = sub[0];
    const raw = await env.APP_DATA.get(`appcron:${slug}:${id}`);
    if (!raw) return json({ error: 'not_found' }, 404);
    const t = JSON.parse(raw) as CronTask;
    if (t.owner !== ownerId) return json({ error: 'forbidden' }, 403);
    await env.APP_DATA.delete(`appcron:${slug}:${id}`);
    return json({ ok: true });
  }

  return text('not found', 404);
}

function nextRun(schedule: string, fromMs: number): number | null {
  const s = schedule.trim().toLowerCase();
  const now = new Date(fromMs);

  if (s === '@hourly') {
    const d = new Date(now); d.setUTCMinutes(0, 0, 0); d.setUTCHours(d.getUTCHours() + 1);
    return d.getTime();
  }
  if (s === '@daily') {
    const d = new Date(now); d.setUTCHours(24, 0, 0, 0);
    return d.getTime();
  }
  if (s === '@weekly') {
    const d = new Date(now); d.setUTCHours(0, 0, 0, 0);
    const dow = d.getUTCDay(); // 0=Sun
    const daysUntilMon = ((1 - dow + 7) % 7) || 7;
    d.setUTCDate(d.getUTCDate() + daysUntilMon);
    return d.getTime();
  }
  const hhmm = s.match(/^(\d{1,2}):(\d{2})$/);
  if (hhmm) {
    const h = +hhmm[1], m = +hhmm[2];
    if (h < 0 || h > 23 || m < 0 || m > 59) return null;
    const d = new Date(now); d.setUTCHours(h, m, 0, 0);
    if (d.getTime() <= fromMs) d.setUTCDate(d.getUTCDate() + 1);
    return d.getTime();
  }
  const every = s.match(/^every\s+(\d+)\s*m(in|inutes?)?$/);
  if (every) {
    const n = +every[1];
    if (n < 1 || n > 1440) return null;
    return fromMs + n * 60_000;
  }
  return null;
}

async function runCronTask(task: CronTask, env: Env): Promise<void> {
  const a = task.action;
  if (a.kind === 'push') {
    const list = await env.APP_DATA.list({ prefix: `appsub:${task.slug}:`, limit: 1000 });
    await sendToList(env, task.slug, list.keys.map((k) => k.name), {
      title: a.title!, body: a.body, url: a.url,
    });
  } else if (a.kind === 'webhook') {
    try {
      await fetch(a.url!, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-stakgod-app': task.slug, 'x-stakgod-task': task.name, ...(a.headers ?? {}) },
        body: JSON.stringify(a.body_json ?? { task: task.name, ts: Date.now() }),
      });
    } catch {/* swallow */}
  }
}

export async function runDueTasks(env: Env): Promise<{ ran: number }> {
  const now = Date.now();
  const list = await env.APP_DATA.list({ prefix: `appcron:`, limit: 1000 });
  let ran = 0;
  for (const k of list.keys) {
    const raw = await env.APP_DATA.get(k.name);
    if (!raw) continue;
    const t = JSON.parse(raw) as CronTask;
    if (t.next_run > now) continue;
    await runCronTask(t, env);
    const next = nextRun(t.schedule, now) ?? now + 86_400_000;
    t.last_run = now;
    t.next_run = next;
    await env.APP_DATA.put(k.name, JSON.stringify(t));
    ran++;
  }
  return { ran };
}

// ---------- sg.notify (server-side web push) ----------
//
// Subscriptions stored in KV: appsub:{slug}:{ownerId}:{idx}  → JSON subscription
// Anyone signed-in (sg.auth) can subscribe / receive their own pushes via /self.
// /broadcast is gated on caller being signed in (anti-anon-spam) and rate-limited
// per-app per-day.

const MAX_BROADCASTS_PER_DAY = 200;
const NOTIFY_QUOTA_BY_PLAN: Record<'free' | 'hobby' | 'pro' | 'studio', number> = {
  free: 50, hobby: 1000, pro: 10000, studio: 100000,
};

interface NotifyPayload { title: string; body?: string; icon?: string; url?: string; tag?: string; }

const SW_JS = (slug: string) => `// stakgod push service worker for ${slug}
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch {}
  const title = d.title || 'Notification';
  const body = d.body || '';
  const icon = d.icon || '/${slug}/icon.png';
  e.waitUntil(self.registration.showNotification(title, { body, icon, tag: d.tag, data: { url: d.url || '/' } }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(cs => {
    for (const c of cs) { if (c.url.includes('/${slug}/') && 'focus' in c) return c.focus(); }
    if (self.clients.openWindow) return self.clients.openWindow('/${slug}' + url);
  }));
});`;

async function handleNotify(req: Request, env: Env, slug: string, sub: string[]): Promise<Response> {
  const url = new URL(req.url);

  if (sub[0] === 'sw.js' && req.method === 'GET') {
    return new Response(SW_JS(slug), {
      headers: { 'content-type': 'text/javascript; charset=utf-8', 'service-worker-allowed': '/', 'cache-control': 'public, max-age=300' },
    });
  }
  if (sub[0] === 'key' && req.method === 'GET') {
    return json({ publicKey: env.VAPID_PUBLIC_KEY });
  }

  const user = await currentUser(req, env, slug);
  const ownerId = user?.id ?? `anon-${hashIp(req)}`;

  if (sub[0] === 'subscribe' && req.method === 'POST') {
    const body = await req.json<PushSubscription>();
    if (!body?.endpoint || !body?.keys?.p256dh || !body?.keys?.auth) return json({ error: 'invalid_subscription' }, 400);
    // Stable hash of endpoint so re-subscribing replaces rather than duplicating.
    const idx = await sha1Hex(body.endpoint);
    await env.APP_DATA.put(`appsub:${slug}:${ownerId}:${idx}`, JSON.stringify(body));
    return json({ ok: true, sub_id: idx });
  }

  if (sub[0] === 'unsubscribe' && req.method === 'POST') {
    const { endpoint } = await req.json<{ endpoint?: string }>();
    if (endpoint) {
      const idx = await sha1Hex(endpoint);
      await env.APP_DATA.delete(`appsub:${slug}:${ownerId}:${idx}`);
      return json({ ok: true });
    }
    // No endpoint provided → wipe all of this user's subscriptions for the app.
    const list = await env.APP_DATA.list({ prefix: `appsub:${slug}:${ownerId}:`, limit: 1000 });
    await Promise.all(list.keys.map((k) => env.APP_DATA.delete(k.name)));
    return json({ ok: true, removed: list.keys.length });
  }

  if (sub[0] === 'self' && req.method === 'POST') {
    if (!user) return json({ error: 'sign_in_required' }, 401);
    const payload = await req.json<NotifyPayload>();
    if (!payload?.title) return json({ error: 'missing_title' }, 400);
    const list = await env.APP_DATA.list({ prefix: `appsub:${slug}:${ownerId}:`, limit: 50 });
    return json(await sendToList(env, slug, list.keys.map((k) => k.name), payload));
  }

  if (sub[0] === 'broadcast' && req.method === 'POST') {
    if (!user) return json({ error: 'sign_in_required' }, 401);
    const payload = await req.json<NotifyPayload>();
    if (!payload?.title) return json({ error: 'missing_title' }, 400);

    // Plan-tier daily quota for the BUILDER.
    const owner = await env.DB.prepare(
      `SELECT u.id, u.plan FROM apps a JOIN users u ON u.id=a.user_id WHERE a.slug=?`
    ).bind(slug).first<{ id: string; plan: 'free' | 'hobby' | 'pro' | 'studio' }>();
    if (!owner) return json({ error: 'app_not_found' }, 404);
    const startOfDay = Math.floor(new Date(new Date().toISOString().slice(0, 10)).getTime() / 1000);
    const sent = await env.DB.prepare(
      `SELECT COALESCE(SUM(tokens_in),0) AS n FROM usage_events WHERE user_id=? AND kind='push_send' AND ts>=?`
    ).bind(owner.id, startOfDay).first<{ n: number }>();
    const limit = NOTIFY_QUOTA_BY_PLAN[owner.plan];
    if ((sent?.n ?? 0) >= limit) {
      return json({ error: 'builder_push_quota_exceeded', used: sent?.n, limit, message: `This app's owner has hit their ${limit}/day push quota. Upgrade at ${env.APP_URL}/pricing.` }, 402);
    }

    // Soft per-app per-day broadcast cap (anti-noise — independent of subscriber count).
    const broadcastCount = await env.APP_DATA.get(`appbcast:${slug}:${new Date().toISOString().slice(0, 10)}`);
    const bc = Number(broadcastCount ?? '0');
    if (bc >= MAX_BROADCASTS_PER_DAY) return json({ error: 'too_many_broadcasts_today', limit: MAX_BROADCASTS_PER_DAY }, 429);
    await env.APP_DATA.put(`appbcast:${slug}:${new Date().toISOString().slice(0, 10)}`, String(bc + 1), { expirationTtl: 86400 * 2 });

    const allKeys: string[] = [];
    let cursor: string | undefined;
    for (let i = 0; i < 6; i++) {
      const r = await env.APP_DATA.list({ prefix: `appsub:${slug}:`, cursor, limit: 1000 });
      for (const k of r.keys) allKeys.push(k.name);
      if (r.list_complete) break;
      cursor = (r as { cursor?: string }).cursor;
    }
    const result = await sendToList(env, slug, allKeys, payload);
    if (result.delivered > 0) {
      await env.DB.prepare(
        `INSERT INTO usage_events (id, user_id, kind, model, tokens_in, tokens_out, cost_usd) VALUES (?, ?, 'push_send', ?, ?, 0, 0)`
      ).bind(crypto.randomUUID(), owner.id, slug, result.delivered).run();
    }
    return json(result);
  }

  return text('not found', 404);
}

async function sendToList(env: Env, slug: string, keys: string[], payload: NotifyPayload): Promise<{ delivered: number; expired: number; failed: number; total: number }> {
  let delivered = 0, expired = 0, failed = 0;
  const body = JSON.stringify({
    title: payload.title.slice(0, 200),
    body: payload.body?.slice(0, 500),
    icon: payload.icon ?? `/${slug}/icon.png`,
    url: payload.url ?? '/',
    tag: payload.tag,
  });
  // Limit fan-out per request to avoid blowing past the worker subrequest budget.
  const batch = keys.slice(0, 200);
  for (const k of batch) {
    const raw = await env.APP_DATA.get(k);
    if (!raw) continue;
    let sub: PushSubscription;
    try { sub = JSON.parse(raw); } catch { continue; }
    const r = await sendPush(sub, {
      vapidPublicKey: env.VAPID_PUBLIC_KEY,
      vapidPrivateKey: env.VAPID_PRIVATE_KEY,
      vapidSubject: env.VAPID_SUBJECT,
      payload: body,
    });
    if (r.ok) delivered++;
    else if (r.expired) { expired++; await env.APP_DATA.delete(k); }
    else failed++;
  }
  return { delivered, expired, failed, total: keys.length };
}

async function sha1Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

// ---------- sg.geo ----------
//
// Cloudflare adds geo headers to every request for free; we just relay them.
// No PII beyond what's already public from the user's IP. Privacy: we don't
// log, just pass through.

function handleGeo(req: Request): Response {
  const h = req.headers;
  const cf = (req as unknown as { cf?: Record<string, unknown> }).cf ?? {};
  const get = (k: string) => h.get(k) ?? (cf[k.replace(/^cf-/i, '').replace(/-/g, '_')] as string | undefined) ?? null;
  return json({
    country:  h.get('cf-ipcountry') ?? cf.country ?? null,
    region:   get('cf-region')      ?? cf.region    ?? null,
    city:     get('cf-city')        ?? cf.city      ?? null,
    postal:   get('cf-postal-code') ?? cf.postalCode ?? null,
    timezone: get('cf-timezone')    ?? cf.timezone  ?? null,
    lat:      Number(cf.latitude  as string | undefined) || null,
    lon:      Number(cf.longitude as string | undefined) || null,
    continent: cf.continent ?? null,
  });
}

// ---------- sg.email ----------
//
// Transactional emails via Resend (our verified stakgod.com domain).
// Charged to the BUILDER's daily quota; counted in usage_events as 'email_send'.

interface EmailBody { to: string | string[]; subject: string; html?: string; text?: string; reply_to?: string; from_name?: string; }
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const DAILY_EMAIL_LIMITS = { free: 10, hobby: 100, pro: 1000, studio: 10000 } as const;
const MAX_EMAIL_BODY = 200_000; // bytes
const MAX_RECIPIENTS = 20;

async function handleEmail(req: Request, env: Env, slug: string, sub: string[]): Promise<Response> {
  if (sub[0] !== 'send' || req.method !== 'POST') return text('not found', 404);

  const owner = await env.DB.prepare(
    `SELECT u.id, u.plan, u.email FROM apps a JOIN users u ON u.id=a.user_id WHERE a.slug=?`
  ).bind(slug).first<{ id: string; plan: 'free' | 'hobby' | 'pro' | 'studio'; email: string }>();
  if (!owner) return json({ error: 'app_not_found' }, 404);

  const startOfDay = Math.floor(new Date(new Date().toISOString().slice(0, 10)).getTime() / 1000);
  const usage = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM usage_events WHERE user_id=? AND kind='email_send' AND ts>=?`
  ).bind(owner.id, startOfDay).first<{ n: number }>();
  const limit = DAILY_EMAIL_LIMITS[owner.plan];
  if ((usage?.n ?? 0) >= limit) {
    return json({ error: 'builder_email_quota_exceeded', used: usage?.n, limit, message: `This app's owner has hit their ${limit}/day email quota. Have them upgrade at ${env.APP_URL}/pricing.` }, 402);
  }

  const body = await req.json<EmailBody>();
  const tos = (Array.isArray(body.to) ? body.to : [body.to]).map((s) => String(s).trim().toLowerCase()).filter(Boolean);
  if (tos.length === 0 || tos.length > MAX_RECIPIENTS) return json({ error: 'invalid_recipients', max: MAX_RECIPIENTS }, 400);
  for (const t of tos) if (!EMAIL_RE.test(t)) return json({ error: 'invalid_recipient', detail: t }, 400);
  const subject = String(body.subject ?? '').slice(0, 200);
  if (!subject) return json({ error: 'missing_subject' }, 400);
  const html = body.html ? String(body.html).slice(0, MAX_EMAIL_BODY) : undefined;
  const txt  = body.text ? String(body.text).slice(0, MAX_EMAIL_BODY) : undefined;
  if (!html && !txt) return json({ error: 'missing_body' }, 400);

  const fromName = (body.from_name ?? slug).replace(/[^\w .-]/g, '').slice(0, 80) || slug;
  const fromAddr = `${fromName} <noreply@stakgod.com>`;
  const replyTo  = body.reply_to && EMAIL_RE.test(body.reply_to) ? body.reply_to : owner.email;

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: fromAddr,
      to: tos,
      subject,
      ...(html ? { html: appendFooter(html, slug) } : {}),
      ...(txt  ? { text: appendFooterText(txt, slug) } : {}),
      reply_to: replyTo,
      headers: { 'X-Stakgod-App': slug, 'X-Stakgod-Owner': owner.id },
      tags: [{ name: 'sg_app', value: slug }],
    }),
  });
  if (!r.ok) {
    const detail = (await r.text()).slice(0, 800);
    return json({ error: 'send_failed', detail }, 502);
  }
  const data = await r.json<{ id: string }>();
  await env.DB.prepare(
    `INSERT INTO usage_events (id, user_id, kind, model, tokens_in, tokens_out, cost_usd) VALUES (?, ?, 'email_send', ?, ?, 0, 0.0004)`
  ).bind(crypto.randomUUID(), owner.id, slug, tos.length).run();
  return json({ id: data.id, sent: tos.length });
}

function appendFooter(html: string, slug: string): string {
  const f = `<hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0"/><p style="font:12px/1.4 system-ui,Arial;color:#999">Sent via <a href="https://stakgod.com/?utm_source=email&amp;utm_campaign=${slug}" style="color:#999">Stakgod</a> &middot; <a href="https://stakgod.com/build?fork=${slug}" style="color:#999">Remix this app</a></p>`;
  if (html.includes('</body>')) return html.replace('</body>', f + '</body>');
  return html + f;
}
function appendFooterText(txt: string, slug: string): string {
  return txt + `\n\n— Sent via Stakgod (https://stakgod.com)\nRemix: https://stakgod.com/build?fork=${slug}`;
}

// ---------- sg.upload ----------
//
// Files land in R2 at apps/{slug}/uploads/{ownerId}/{random}.{ext} which is
// already publicly served by our static-asset path. Metadata kept in KV
// so we can list per-user without scanning R2.

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIMES = new Set([
  'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml',
  'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/webm', 'audio/ogg', 'audio/mp4',
  'video/mp4', 'video/webm', 'video/quicktime',
  'application/pdf', 'application/json', 'application/zip',
  'text/plain', 'text/csv', 'text/markdown',
]);
const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg',
  'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/wav': 'wav', 'audio/webm': 'weba', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a',
  'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov',
  'application/pdf': 'pdf', 'application/json': 'json', 'application/zip': 'zip',
  'text/plain': 'txt', 'text/csv': 'csv', 'text/markdown': 'md',
};

async function handleUploads(req: Request, env: Env, slug: string): Promise<Response> {
  const url = new URL(req.url);
  const user = await currentUser(req, env, slug);
  const ownerId = user?.id ?? `anon-${hashIp(req)}`;
  const metaPrefix = `appup:${slug}:${ownerId}:`;

  if (req.method === 'POST') {
    const ct = (req.headers.get('content-type') ?? '').toLowerCase();
    let body: ArrayBuffer; let name = 'file'; let mime = 'application/octet-stream';

    if (ct.startsWith('multipart/form-data')) {
      const fd = await req.formData();
      const f = fd.get('file');
      if (!(f instanceof File)) return json({ error: 'missing_file' }, 400);
      mime = f.type || mime;
      name = f.name || 'file';
      body = await f.arrayBuffer();
    } else {
      // Raw body upload — name + content-type from headers/query
      mime = ct || mime;
      name = url.searchParams.get('name') || 'file';
      body = await req.arrayBuffer();
    }

    if (body.byteLength === 0) return json({ error: 'empty_file' }, 400);
    if (body.byteLength > MAX_FILE_BYTES) return json({ error: 'file_too_large', max_bytes: MAX_FILE_BYTES }, 413);
    if (!ALLOWED_MIMES.has(mime)) return json({ error: 'mime_not_allowed', mime, allowed: [...ALLOWED_MIMES] }, 415);

    const ext = EXT_BY_MIME[mime] ?? 'bin';
    const key = `${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}.${ext}`;
    const r2Key = `apps/${slug}/uploads/${ownerId}/${key}`;
    await env.APPS.put(r2Key, body, { httpMetadata: { contentType: mime } });

    const safeName = name.replace(/[^\w. -]/g, '').slice(0, 200);
    const meta = { key, name: safeName, mime, size: body.byteLength, ts: Math.floor(Date.now() / 1000), owner: ownerId };
    await env.APP_DATA.put(metaPrefix + key, JSON.stringify(meta));
    return json({
      url: `${url.origin}/${slug}/uploads/${ownerId}/${key}`,
      key, name: safeName, mime, size: meta.size,
    });
  }

  if (req.method === 'GET') {
    const list = await env.APP_DATA.list({ prefix: metaPrefix, limit: 200 });
    const items = await Promise.all(list.keys.map(async (k) => {
      const v = await env.APP_DATA.get(k.name);
      if (!v) return null;
      const m = JSON.parse(v) as { key: string; name: string; mime: string; size: number; ts: number };
      return { ...m, url: `${url.origin}/${slug}/uploads/${ownerId}/${m.key}` };
    }));
    return json(items.filter(Boolean).sort((a, b) => (b!.ts - a!.ts)));
  }

  if (req.method === 'DELETE') {
    const key = url.searchParams.get('key');
    if (!key) return json({ error: 'missing_key' }, 400);
    await env.APPS.delete(`apps/${slug}/uploads/${ownerId}/${key}`);
    await env.APP_DATA.delete(metaPrefix + key);
    return json({ ok: true });
  }

  return text('method not allowed', 405);
}

function hashIp(req: Request): string {
  // Anonymous-but-deduplicated owner key (best-effort, not PII).
  const ip = req.headers.get('cf-connecting-ip') ?? req.headers.get('x-real-ip') ?? '0.0.0.0';
  let h = 2166136261;
  for (let i = 0; i < ip.length; i++) { h ^= ip.charCodeAt(i); h = (h * 16777619) >>> 0; }
  return h.toString(36);
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

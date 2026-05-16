// Builder chat: streams Claude responses with full conversation history,
// passes the currently deployed HTML so iterations PATCH instead of regenerate,
// auto-deploys to R2 on stream completion.

import { Hono } from 'hono';
import Anthropic from '@anthropic-ai/sdk';
import type { Env, Variables } from '../types';
import { requireAuth } from '../middleware/auth';
import { requireCredits } from '../middleware/credits';
import { pickModel, costUsd, type ModelId } from '../lib/model-router';
import { generateIconIfMissing } from './icons';

export const builder = new Hono<{ Bindings: Env; Variables: Variables }>();

interface ImageAttachment { mime: string; data: string; }   // base64
interface ChatBody { app_id: string; message: string; intent?: 'edit' | 'generate' | 'plan' | 'fix'; images?: ImageAttachment[]; }
const ALLOWED_IMG_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const MAX_IMAGES = 5;

const MAX_HISTORY = 20; // last N messages; older summarized as "(prior)" by us
const MAX_HTML_IN_CONTEXT = 80_000; // chars; ~20k tokens — Claude can handle full files

builder.post('/chat', requireAuth, requireCredits, async (c) => {
  const user = c.get('user')!;
  const body = await c.req.json<ChatBody>();
  const intent = body.intent ?? 'edit';
  const model = pickModel({ intent, promptChars: body.message.length, plan: user.plan });

  const app = await c.env.DB.prepare(`SELECT slug FROM apps WHERE id=? AND user_id=?`).bind(body.app_id, user.id).first<{ slug: string }>();
  if (!app) return c.json({ error: 'app_not_found' }, 404);

  // Load conversation history.
  const convoId = await ensureConversation(c.env.DB, body.app_id, user.id);
  const history = await c.env.DB.prepare(
    `SELECT role, content FROM messages WHERE conversation_id=? ORDER BY created_at ASC LIMIT ?`
  ).bind(convoId, MAX_HISTORY).all<{ role: 'user' | 'assistant'; content: string }>();

  // Current deployed HTML — so Claude can patch instead of regenerate.
  const currentObj = await c.env.APPS.get(`apps/${app.slug}/index.html`);
  const currentHtml = currentObj ? (await currentObj.text()).slice(0, MAX_HTML_IN_CONTEXT) : null;

  // Persist the new user message NOW so streaming UI can re-load it.
  // Tag the persisted text with [📎 N image(s)] so chat history shows what was attached.
  const imgsSummary = (body.images ?? []).slice(0, MAX_IMAGES).filter((im) => im && ALLOWED_IMG_MIMES.has(im.mime)).length;
  const persistedText = imgsSummary > 0 ? `${body.message}\n[📎 ${imgsSummary} image${imgsSummary === 1 ? '' : 's'} attached]` : body.message;
  await c.env.DB.prepare(
    `INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, 'user', ?)`
  ).bind(crypto.randomUUID(), convoId, persistedText).run();

  // Validate images (if any). Up to 5, allowed mimes only.
  const incomingImages = (body.images ?? []).slice(0, MAX_IMAGES).filter((im) =>
    im && typeof im.data === 'string' && im.data.length > 0 && ALLOWED_IMG_MIMES.has(im.mime)
  );

  type AllowedMime = 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';
  type ContentBlock = { type: 'text'; text: string } | { type: 'image'; source: { type: 'base64'; media_type: AllowedMime; data: string } };
  type Msg = { role: 'user' | 'assistant'; content: string | ContentBlock[] };

  const messages: Msg[] = [];
  if (currentHtml) {
    messages.push({
      role: 'user',
      content: `Here is the CURRENT deployed app at apps.stakgod.com/${app.slug}/. Modify this when the user asks for changes — don't regenerate from scratch.\n\n\`\`\`html\n${currentHtml}\n\`\`\``,
    });
    messages.push({ role: 'assistant', content: `Got it — I'll edit this in place. What would you like to change?` });
  }
  for (const m of history.results ?? []) messages.push({ role: m.role, content: m.content });

  // Final user turn — multipart if images attached, else plain string.
  // ALLOWED_IMG_MIMES already filtered incomingImages to these 4 types.
  if (incomingImages.length > 0) {
    const blocks: ContentBlock[] = [];
    for (const img of incomingImages) {
      blocks.push({ type: 'image', source: { type: 'base64', media_type: img.mime as AllowedMime, data: img.data } });
    }
    blocks.push({ type: 'text', text: body.message || 'Match this design.' });
    messages.push({ role: 'user', content: blocks });
  } else {
    messages.push({ role: 'user', content: body.message });
  }

  const client = new Anthropic({ apiKey: c.env.ANTHROPIC_API_KEY });
  const stream = await client.messages.stream({
    model, max_tokens: 8192, system: SYSTEM_PROMPT, messages,
  });

  const sse = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      let assembled = '';
      let tokensIn = 0, tokensOut = 0;
      try {
        for await (const ev of stream) {
          if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') {
            assembled += ev.delta.text;
            controller.enqueue(enc.encode(`data: ${JSON.stringify({ delta: ev.delta.text })}\n\n`));
          }
          if (ev.type === 'message_delta' && ev.usage) tokensOut = ev.usage.output_tokens;
          if (ev.type === 'message_start' && ev.message.usage) tokensIn = ev.message.usage.input_tokens;
        }
        const cost = costUsd(model as ModelId, tokensIn, tokensOut);
        const html = extractHtml(assembled);
        const extraFiles = extractFiles(assembled);
        let deployed_url: string | null = null;
        if (html) {
          const ts = Date.now();
          // Always treat the html block as index.html.
          await c.env.APPS.put(`apps/${app.slug}/index.html`, html, { httpMetadata: { contentType: 'text/html; charset=utf-8' } });
          await c.env.APPS.put(`apps/${app.slug}/versions/${ts}.html`, html, { httpMetadata: { contentType: 'text/html; charset=utf-8' } });
          // Write any additional <file path="..."> blocks alongside.
          for (const f of extraFiles.slice(0, 20)) {
            await c.env.APPS.put(`apps/${app.slug}/${f.path}`, f.body, { httpMetadata: { contentType: f.contentType } });
          }
          deployed_url = `https://apps.stakgod.com/${app.slug}/`;
          await c.env.DB.prepare(`UPDATE apps SET status='live', updated_at=unixepoch() WHERE id=?`).bind(body.app_id).run();
          // Best-effort: kick off AI icon gen on the first successful deploy.
          c.executionCtx.waitUntil((async () => {
            const meta = await c.env.DB.prepare(`SELECT name, description FROM apps WHERE id=?`).bind(body.app_id).first<{ name: string; description: string | null }>();
            if (meta) await generateIconIfMissing(c.env, { slug: app.slug, name: meta.name, description: meta.description });
          })());
        }
        await Promise.all([
          c.env.DB.prepare(
            `INSERT INTO messages (id, conversation_id, role, content, model, tokens_in, tokens_out)
             VALUES (?, ?, 'assistant', ?, ?, ?, ?)`
          ).bind(crypto.randomUUID(), convoId, assembled, model, tokensIn, tokensOut).run(),
          c.env.DB.prepare(
            `INSERT INTO usage_events (id, user_id, kind, model, tokens_in, tokens_out, cost_usd)
             VALUES (?, ?, 'ai_message', ?, ?, ?, ?)`
          ).bind(crypto.randomUUID(), user.id, model, tokensIn, tokensOut, cost).run(),
        ]);
        controller.enqueue(enc.encode(`data: ${JSON.stringify({ done: true, model, tokens_in: tokensIn, tokens_out: tokensOut, deployed_url })}\n\n`));
      } catch (e) {
        controller.enqueue(enc.encode(`data: ${JSON.stringify({ error: String(e) })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(sse, { headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' } });
});

// Conversation history for the dashboard / chat UI on load.
builder.get('/messages', requireAuth, async (c) => {
  const user = c.get('user')!;
  const appId = c.req.query('app_id');
  if (!appId) return c.json({ error: 'missing_app_id' }, 400);
  const app = await c.env.DB.prepare(`SELECT id, slug FROM apps WHERE id=? AND user_id=?`).bind(appId, user.id).first<{ id: string; slug: string }>();
  if (!app) return c.json({ error: 'not_found' }, 404);
  const convo = await c.env.DB.prepare(`SELECT id FROM conversations WHERE app_id=? AND user_id=? ORDER BY created_at DESC LIMIT 1`).bind(appId, user.id).first<{ id: string }>();
  if (!convo) return c.json({ messages: [], deployed_url: null });
  const rows = await c.env.DB.prepare(
    `SELECT role, content, created_at FROM messages WHERE conversation_id=? ORDER BY created_at ASC LIMIT 100`
  ).bind(convo.id).all<{ role: string; content: string; created_at: number }>();
  return c.json({ messages: rows.results, deployed_url: `https://apps.stakgod.com/${app.slug}/` });
});

// Manually deploy raw HTML.
builder.post('/deploy', requireAuth, async (c) => {
  const user = c.get('user')!;
  const { app_id, html } = await c.req.json<{ app_id: string; html: string }>();
  if (!app_id || !html) return c.json({ error: 'missing_fields' }, 400);
  const app = await c.env.DB.prepare(`SELECT slug FROM apps WHERE id=? AND user_id=?`).bind(app_id, user.id).first<{ slug: string }>();
  if (!app) return c.json({ error: 'not_found' }, 404);
  await c.env.APPS.put(`apps/${app.slug}/index.html`, html, { httpMetadata: { contentType: 'text/html; charset=utf-8' } });
  await c.env.DB.prepare(`UPDATE apps SET status='live', updated_at=unixepoch() WHERE id=?`).bind(app_id).run();
  return c.json({ ok: true, url: `https://apps.stakgod.com/${app.slug}/` });
});

// List recent versions for an app (for the "Versions" UI).
builder.get('/versions', requireAuth, async (c) => {
  const user = c.get('user')!;
  const appId = c.req.query('app_id');
  if (!appId) return c.json({ error: 'missing_app_id' }, 400);
  const app = await c.env.DB.prepare(`SELECT slug FROM apps WHERE id=? AND user_id=?`).bind(appId, user.id).first<{ slug: string }>();
  if (!app) return c.json({ error: 'not_found' }, 404);
  const list = await c.env.APPS.list({ prefix: `apps/${app.slug}/versions/`, limit: 50 });
  const versions = list.objects
    .map((o) => {
      const m = o.key.match(/\/versions\/(\d+)\.html$/);
      return m ? { ts: Number(m[1]), key: o.key, size: o.size } : null;
    })
    .filter(Boolean)
    .sort((a, b) => (b!.ts - a!.ts));
  return c.json({ versions });
});

// Revert to a specific version.
builder.post('/revert', requireAuth, async (c) => {
  const user = c.get('user')!;
  const { app_id, ts } = await c.req.json<{ app_id: string; ts: number }>();
  if (!app_id || !ts) return c.json({ error: 'missing_fields' }, 400);
  const app = await c.env.DB.prepare(`SELECT slug FROM apps WHERE id=? AND user_id=?`).bind(app_id, user.id).first<{ slug: string }>();
  if (!app) return c.json({ error: 'not_found' }, 404);
  const obj = await c.env.APPS.get(`apps/${app.slug}/versions/${ts}.html`);
  if (!obj) return c.json({ error: 'version_not_found' }, 404);
  const html = await obj.text();
  await c.env.APPS.put(`apps/${app.slug}/index.html`, html, { httpMetadata: { contentType: 'text/html; charset=utf-8' } });
  // Also snapshot the revert itself so it shows in versions.
  await c.env.APPS.put(`apps/${app.slug}/versions/${Date.now()}.html`, html, { httpMetadata: { contentType: 'text/html; charset=utf-8' } });
  await c.env.DB.prepare(`UPDATE apps SET updated_at=unixepoch() WHERE id=?`).bind(app_id).run();
  return c.json({ ok: true, url: `https://apps.stakgod.com/${app.slug}/` });
});

// Fork a template (or any public app) into a new app for the current user.
// If the source app has fork_price_cents > 0 AND a session_id isn't provided,
// returns 402 with a Stripe Checkout URL routed via the seller's Connect acct
// (Stakgod takes 20% application_fee). On success Stripe redirects back with
// session_id, and a second call to /fork verifies + completes the fork.
builder.post('/fork', requireAuth, async (c) => {
  const user = c.get('user')!;
  const { template, name, session_id } = await c.req.json<{ template: string; name?: string; session_id?: string }>();
  if (!template || !/^[a-z0-9-]{1,64}$/.test(template)) return c.json({ error: 'bad_template' }, 400);

  const src = await c.env.APPS.get(`apps/${template}/index.html`);
  if (!src) return c.json({ error: 'template_not_found' }, 404);

  // Look up source app + its price + the seller's Connect account.
  const source = await c.env.DB.prepare(
    `SELECT a.id AS app_id, a.user_id, a.fork_price_cents, a.name AS app_name,
            u.stripe_connect_account_id
     FROM apps a JOIN users u ON u.id = a.user_id WHERE a.slug=?`
  ).bind(template).first<{
    app_id: string; user_id: string; fork_price_cents: number; app_name: string;
    stripe_connect_account_id: string | null;
  }>();

  // Templates without an apps row (tpl-* seeded directly to R2) are always free.
  const price = source?.fork_price_cents ?? 0;
  let purchase_id: string | null = null;
  let amount_cents = 0;
  let fee_cents = 0;

  if (price > 0) {
    const sellerConnect = source?.stripe_connect_account_id;
    if (!sellerConnect) {
      return c.json({ error: 'seller_not_connected', message: 'This app is for sale but the seller has not connected Stripe yet.' }, 412);
    }

    // No session_id yet → create a Checkout Session and return its URL.
    if (!session_id) {
      const fee = Math.floor((price * 2000) / 10_000); // 20%
      const params = new URLSearchParams();
      params.set('mode', 'payment');
      params.set('success_url', `${c.env.APP_URL}/build?fork=${template}&session_id={CHECKOUT_SESSION_ID}`);
      params.set('cancel_url',  `${c.env.APP_URL}/u/${template}`);
      params.set('payment_intent_data[application_fee_amount]', String(fee));
      params.set('customer_email', user.email);
      params.set('metadata[stakgod_kind]', 'fork_purchase');
      params.set('metadata[stakgod_template]', template);
      params.set('metadata[stakgod_buyer]', user.id);
      params.set('line_items[0][quantity]', '1');
      params.set('line_items[0][price_data][currency]', 'usd');
      params.set('line_items[0][price_data][unit_amount]', String(price));
      params.set('line_items[0][price_data][product_data][name]', `Fork: ${source.app_name}`);
      params.set('line_items[0][price_data][product_data][description]', `One-time purchase to fork ${template} into your account.`);

      const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${c.env.STRIPE_SECRET_KEY}`,
          'content-type': 'application/x-www-form-urlencoded',
          'stripe-account': sellerConnect,
        },
        body: params.toString(),
      });
      if (!r.ok) return c.json({ error: 'stripe_failed', detail: (await r.text()).slice(0, 500) }, 502);
      const s = await r.json<{ id: string; url: string }>();
      return c.json({ requires_payment: true, price_cents: price, checkout_url: s.url, session_id: s.id }, 402);
    }

    // session_id present — verify it's paid before forking.
    if (!/^cs_(live|test)_/.test(session_id)) return c.json({ error: 'bad_session_id' }, 400);
    const dup = await c.env.DB.prepare(`SELECT id, forked_app_id FROM fork_purchases WHERE stripe_session_id=?`).bind(session_id).first<{ id: string; forked_app_id: string | null }>();
    if (dup?.forked_app_id) {
      // Already forked from this session — return the existing app to be idempotent.
      const ex = await c.env.DB.prepare(`SELECT slug FROM apps WHERE id=?`).bind(dup.forked_app_id).first<{ slug: string }>();
      if (ex) return c.json({ id: dup.forked_app_id, slug: ex.slug, url: `https://apps.stakgod.com/${ex.slug}/`, build_url: `${c.env.APP_URL}/build?app=${dup.forked_app_id}` });
    }
    if (!source.stripe_connect_account_id) return c.json({ error: 'seller_disconnected' }, 409);
    const r = await fetch(`https://api.stripe.com/v1/checkout/sessions/${session_id}`, {
      headers: { authorization: `Bearer ${c.env.STRIPE_SECRET_KEY}`, 'stripe-account': source.stripe_connect_account_id },
    });
    if (!r.ok) return c.json({ error: 'stripe_failed' }, 502);
    const s = await r.json<{ payment_status: string; amount_total: number; metadata: Record<string, string> }>();
    if (s.payment_status !== 'paid') return c.json({ error: 'not_paid' }, 402);
    if (s.metadata?.stakgod_template !== template || s.metadata?.stakgod_buyer !== user.id) return c.json({ error: 'session_mismatch' }, 400);
    amount_cents = s.amount_total;
    fee_cents = Math.floor((amount_cents * 2000) / 10_000);
    purchase_id = crypto.randomUUID();
  }

  // Do the actual fork.
  const html = await src.text();
  const id = crypto.randomUUID();
  const baseSlug = (name ?? template).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 32);
  const slug = `${baseSlug}-${id.slice(0, 6)}`;
  await c.env.DB.prepare(
    `INSERT INTO apps (id, user_id, slug, name, description, status) VALUES (?, ?, ?, ?, ?, 'live')`
  ).bind(id, user.id, slug, name ?? template, `Forked from ${template}`).run();
  await c.env.APPS.put(`apps/${slug}/index.html`, html, { httpMetadata: { contentType: 'text/html; charset=utf-8' } });
  await c.env.APPS.put(`apps/${slug}/versions/${Date.now()}.html`, html, { httpMetadata: { contentType: 'text/html; charset=utf-8' } });

  if (purchase_id && source) {
    await c.env.DB.prepare(
      `INSERT INTO fork_purchases (id, source_app_id, source_user_id, buyer_user_id, forked_app_id, amount_cents, application_fee_cents, stripe_session_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(purchase_id, source.app_id, source.user_id, user.id, id, amount_cents, fee_cents, session_id ?? null).run();
  }

  return c.json({ id, slug, url: `https://apps.stakgod.com/${slug}/`, build_url: `${c.env.APP_URL}/build?app=${id}` });
});

// Set the fork price (in cents). 0 = free fork.
builder.post('/apps/:id/fork-price', requireAuth, async (c) => {
  const user = c.get('user')!;
  const id = c.req.param('id');
  const { price_cents } = await c.req.json<{ price_cents: number }>();
  const cents = Math.max(0, Math.min(50_000, Math.floor(Number(price_cents) || 0)));
  if (cents > 0 && cents < 100) return c.json({ error: 'min_price', detail: 'minimum $1.00 (100 cents) to cover Stripe fees' }, 400);
  const r = await c.env.DB.prepare(`UPDATE apps SET fork_price_cents=? WHERE id=? AND user_id=?`).bind(cents, id, user.id).run();
  if (!r.success || r.meta.changes === 0) return c.json({ error: 'not_found' }, 404);
  return c.json({ ok: true, fork_price_cents: cents });
});

// Real-time collab: open a WebSocket into the per-app Durable Object room.
// GET /builder/room/:app_id with Upgrade: websocket; auth via session cookie.
// Query params name/color/avatar are reflected in the welcome message.
builder.get('/room/:app_id', async (c) => {
  if (c.req.header('upgrade') !== 'websocket') return c.text('expected websocket', 400);
  const user = c.get('user');
  if (!user) return c.text('unauthorized', 401);
  const appId = c.req.param('app_id');
  const ok = await c.env.DB.prepare(`SELECT 1 AS ok FROM apps WHERE id=? AND user_id=?`).bind(appId, user.id).first();
  if (!ok) return c.text('not found', 404);

  const id = c.env.BUILD_ROOM.idFromName(appId);
  const stub = c.env.BUILD_ROOM.get(id);
  // Append the user's metadata as query params for the DO to relay in the welcome.
  const url = new URL(c.req.url);
  url.searchParams.set('id', user.id);
  url.searchParams.set('name', user.name ?? user.email.split('@')[0] ?? 'Builder');
  return stub.fetch(new Request(url.toString(), c.req.raw));
});

builder.get('/usage', requireAuth, async (c) => {
  const user = c.get('user')!;
  const startOfDay = Math.floor(new Date(new Date().toISOString().slice(0, 10)).getTime() / 1000);
  const row = await c.env.DB.prepare(
    `SELECT COUNT(*) as messages, COALESCE(SUM(cost_usd),0) as cost FROM usage_events
     WHERE user_id=? AND kind='ai_message' AND ts>=?`
  ).bind(user.id, startOfDay).first<{ messages: number; cost: number }>();
  return c.json({ today: row, plan: user.plan });
});

async function ensureConversation(db: D1Database, appId: string, userId: string): Promise<string> {
  const existing = await db.prepare(`SELECT id FROM conversations WHERE app_id=? AND user_id=? ORDER BY created_at DESC LIMIT 1`).bind(appId, userId).first<{ id: string }>();
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  await db.prepare(`INSERT INTO conversations (id, app_id, user_id) VALUES (?, ?, ?)`).bind(id, appId, userId).run();
  return id;
}

function extractHtml(s: string): string | null {
  const fenced = s.match(/```html\n([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const doctype = s.match(/<!doctype html[\s\S]*<\/html>/i);
  if (doctype) return doctype[0];
  const html = s.match(/<html[\s\S]*<\/html>/i);
  return html ? html[0] : null;
}

const TYPE_BY_EXT: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  json: 'application/json; charset=utf-8',
  svg: 'image/svg+xml',
  txt: 'text/plain; charset=utf-8',
};

// Extracts <file path="..."> ... </file> blocks for multi-file apps.
// Paths are sanitized and constrained to a-z0-9._/- with no '..' segments.
export function extractFiles(s: string): Array<{ path: string; body: string; contentType: string }> {
  const out: Array<{ path: string; body: string; contentType: string }> = [];
  const re = /<file\s+path=["']([^"']+)["']>([\s\S]*?)<\/file>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const raw = m[1].trim().replace(/^\/+/, '');
    if (!/^[a-z0-9._\-/]+$/i.test(raw) || raw.includes('..')) continue;
    const ext = raw.split('.').pop()?.toLowerCase() ?? '';
    out.push({ path: raw, body: m[2].trim(), contentType: TYPE_BY_EXT[ext] ?? 'application/octet-stream' });
  }
  return out;
}

export const SYSTEM_PROMPT = `You are Stakgod, an AI app builder. Each app is ONE self-contained HTML file with inline Tailwind (CDN: https://cdn.tailwindcss.com) and inline JS.

RULES
- ALWAYS wrap your final HTML in a fenced \`\`\`html ... \`\`\` block. The platform extracts it from there and deploys to apps.stakgod.com automatically.
- If a "CURRENT deployed app" was provided, EDIT IT IN PLACE. Re-emit the entire updated file. Preserve everything the user didn't ask to change.
- If this is the first message and no current app exists, generate a complete fresh HTML file.
- Wire EVERY button. Use modern responsive Tailwind layouts. Mobile-first.
- Brief plain-English summary BEFORE the code block (1-3 sentences max). Then the code block. Nothing after.

VISION INPUT
- The user may attach screenshots, sketches, mockups, or reference designs. When they do, USE the visual content as the primary source of truth for layout, color, typography, and component arrangement.
- If the user attaches an image without text, default behavior is "build/update the app to match this design".
- If they attach an image AND give text instructions, the text wins for intent (e.g. "use this color palette but keep my layout") and the image is the visual reference.

MULTI-FILE OUTPUT (optional)
For richer apps, you may emit additional files alongside the main index.html:
  <file path="app.js">/* JavaScript */</file>
  <file path="styles.css">/* CSS */</file>
  <file path="logo.svg"><svg ...></svg></file>
Reference them from index.html with relative paths (e.g. <script src="app.js"></script>).
Paths must match [a-z0-9._/-]+ and stay within the app's directory. Up to 20 extra files per turn.

REAL BACKEND PRIMITIVES — ALL AUTO-INJECTED via \`window.sg\`. No setup, no SDKs.

────  sg.auth  ────  Real users via magic-link email (uses our Resend integration).
  await sg.auth.user()                  // → { id, email } if signed in, else null
  await sg.auth.signIn(email)           // sends a magic link; returns { ok: true }
  await sg.auth.signOut()               // clears the session cookie

When you build any app that needs user accounts, USE THIS — never roll your own.
A typical pattern:
  const me = await sg.auth.user();
  if (!me) {  /* show sign-in form calling sg.auth.signIn(email) */ }
  else      {  /* show the signed-in app */ }

Sessions live 30 days. Cookies are scoped per-app (sg_user_{slug}).

────  sg.ai  ────  Claude built into the user's app. Charged to the builder's monthly quota.

  // ONE-SHOT (waits for full response, then returns)
  const { text } = await sg.ai.chat({
    system: 'You are a startup mentor.',
    messages: [{ role: 'user', content: 'Pitch me on Stakgod' }],
    model: 'sonnet'   // 'haiku' (fast/cheap) | 'sonnet' (default) | 'opus' (smart)
  });

  // IMAGE GENERATION (Cloudflare Workers AI Flux Schnell — fast, free-ish, in-region)
  const { data_url, base64 } = await sg.ai.image({
    prompt: 'A cozy isometric desk scene with succulents, vibrant pastels',
    steps: 4,   // 1..8; 4 is the sweet spot
  });
  document.querySelector('img').src = data_url;       // base64 JPEG, drop right in <img>
  // Same builder quota as chat (1 ai_message debit per call). Use for in-app
  // covers, avatars, hero art, generative backgrounds, mood boards.

  // STREAMING (renders tokens as they arrive — use this for chatbot UIs)
  const out = document.querySelector('#bot-reply');
  out.textContent = '';
  const final = await sg.ai.stream({
    system: 'You are a friendly assistant.',
    messages: [{ role: 'user', content: input }],
    onDelta: (chunk) => { out.textContent += chunk; },
  });
  // final = { text, tokens_in, tokens_out, model }

Use sg.ai.stream for chatbots, agents, anywhere you want the typewriter feel.
Same per-month builder quota; both paths debit usage_events on completion.
When the builder hits their cap, both paths return 402 — display
'Have the owner upgrade at stakgod.com/pricing'.

────  sg.geo  ────  Visitor's location from Cloudflare (no setup, no IP geolocation library).
  const g = await sg.geo();
  // → { country: 'US', region: 'CA', city: 'San Francisco', postal: '94110',
  //     timezone: 'America/Los_Angeles', lat: 37.76, lon: -122.41, continent: 'NA' }
Use for currency selection, language defaults, weather/news/regional content,
fraud signals, "near me" UX. No permission prompt — it's edge-derived from the
visitor's IP (privacy: city-level granularity, not GPS-precise).

────  sg.share + sg.embed  ────  Distribute the app, drop it on other sites.

  // Native share sheet on mobile, clipboard fallback on desktop:
  const r = await sg.share({ title: 'Check out my app', text: 'Built on Stakgod' });
  // r = { shared, via: 'native' | 'clipboard' | 'cancelled' | 'unsupported', url? }

  // Get an iframe snippet to embed on a blog/Notion page:
  const html = sg.embed({ width: '100%', height: 640 });
  // → <iframe src="https://apps.stakgod.com/{slug}/?embed=1" ...></iframe>
  // Embed mode strips X-Frame-Options and uses a tiny corner badge instead
  // of the full Remix bar so the embed feels native to the host page.

────  sg.queue  ────  Fire-and-forget background jobs (one-shot, scheduled or delayed).
                          For RECURRING work, use sg.cron instead.

  // Send a follow-up push 5 minutes after sign-up:
  await sg.queue.enqueue({
    delay_seconds: 300,
    action: { kind: 'push', title: 'Welcome 👋', body_text: 'Try adding your first habit', scope: 'me' },
  });

  // POST a webhook tomorrow at 9am UTC:
  await sg.queue.enqueue({
    run_at: nineAmTomorrowMs,
    action: { kind: 'webhook', url: 'https://yourserver.com/digest', body: { for: me.id } },
  });

  // Self-callback (POST a path inside YOUR app — useful for state machines):
  await sg.queue.enqueue({
    delay_seconds: 60,
    action: { kind: 'self', path: '/__webhooks__/checkin' },
  });

  await sg.queue.list();              // current user's pending jobs
  await sg.queue.cancel(id);          // remove before it runs

Caller must be signed in (sg.auth). Limit: 200 jobs/app, max 30-day delay.

────  sg.cron  ────  Schedule recurring server-side tasks (1-minute resolution).

  // Push a daily reminder to all subscribers at 9am UTC:
  await sg.cron.add({
    name: 'morning-reminder',
    schedule: '09:00',                    // 'HH:MM' UTC | '@hourly' | '@daily' | '@weekly' | 'every 15m'
    action: { kind: 'push', title: 'Morning check-in', body: 'Log your habits.' },
  });

  // POST to your own webhook every hour:
  await sg.cron.add({
    name: 'hourly-sync',
    schedule: '@hourly',
    action: { kind: 'webhook', url: 'https://my-server.com/sync', body_json: { source: 'app' } },
  });

  await sg.cron.list();        // all tasks for this app, sorted by next run
  await sg.cron.del(id);

Caller must be signed in via sg.auth (only the user who created a task can
delete it). Limit: 20 tasks per app. Actions: 'push' (broadcast notification)
or 'webhook' (POST JSON to a URL).

────  sg.notify  ────  Real web push notifications (delivered even when tab is closed)
                          + foreground browser notifications.

  // FOREGROUND (works while page is open, no setup):
  await sg.notify.show('Streak saved!', { body: '12 days strong 🔥' });

  // SERVER-PUSH (delivered with page closed). Two-step:
  // 1) The user opts in once on their device:
  await sg.notify.subscribe();   // requests perm, registers our SW, stores their push subscription server-side
  // 2) Later, anything in your app can push to ALL subscribers of THIS app:
  await sg.notify.broadcast({ title: 'Daily reminder', body: 'Time for your check-in', url: '/' });
  // Or only to the current signed-in user:
  await sg.notify.toMe({ title: "Don't break the streak!", body: '12 days 🔥' });
  await sg.notify.unsubscribe();

Caller for broadcast/toMe MUST be signed in via sg.auth (anti-anon-spam).
Builder daily push quotas: free 50, hobby 1k, pro 10k, studio 100k. Quota
exhaustion returns 402 with an upgrade message. Subscriptions auto-clean up
when push services return 404/410.

────  sg.email  ────  Transactional emails sent from your app via Resend (verified stakgod.com).
  await sg.email.send({
    to: 'recipient@example.com',          // or array of up to 20
    subject: 'Welcome to my app',
    html: '<h1>Hello!</h1><p>Thanks for joining.</p>',
    text: 'Hello! Thanks for joining.',   // optional plaintext fallback
    from_name: 'My Cool App',             // optional display name; sender stays noreply@stakgod.com
    reply_to: 'me@mydomain.com',          // optional; defaults to the BUILDER's email
  });

Charged to the BUILDER's daily quota: free 10/day, hobby 100, pro 1k, studio
10k. Returns 402 when exceeded with a friendly upgrade message. Body capped
at ~200 KB; subject 200 chars. Auto-appends a small "Sent via Stakgod"
footer (counts as a viral surface like the badge on served apps).

────  sg.upload  ────  Real file uploads to per-app R2 with public URLs.

  // From a <input type="file"> change handler:
  const { url, key, mime, size } = await sg.upload(file);
  // url is publicly served at apps.stakgod.com/{slug}/uploads/{ownerId}/{key}
  // — drop it directly into <img>, <audio>, <video>, <a download>, etc.

  await sg.uploads.list();          // current user's uploads (sorted newest first)
  await sg.uploads.del(key);        // remove

Limits: 10 MB per file. Allowed mimes: png/jpg/webp/gif/svg/mp3/wav/m4a/ogg/
mp4/mov/webm/pdf/zip/json/csv/md/txt. If the user is signed in via sg.auth,
uploads are scoped to their user_id (so list() returns only theirs); otherwise
they're scoped per-IP-hash so an anonymous visitor can manage their own files.

────  sg.payments  ────  Charge customers via Stripe Checkout. Money lands in the BUILDER's Stripe Connect account; Stakgod takes 10% application fee automatically.

  // Single tip
  const { url } = await sg.payments.checkout({
    items: [{ name: 'Coffee', amount_cents: 500 }],
    success_url: 'https://apps.stakgod.com/{slug}/?sg_checkout=success',
  });
  location.href = url;   // → Stripe-hosted checkout page

  // After redirect back, verify payment:
  const id = new URLSearchParams(location.search).get('session_id');
  if (id) { const r = await sg.payments.session(id); if (r.paid) { /* unlock */ } }

  // Multi-line cart
  await sg.payments.checkout({
    items: [
      { name: 'Pro plan',  amount_cents: 1900 },
      { name: 'Add-on',    amount_cents:  500, quantity: 2 },
    ],
  });

If the BUILDER hasn't connected Stripe yet, sg.payments.checkout returns 412
with { error:'owner_not_connected', connect_url }; show a friendly message
linking them to connect_url. Min charge \$0.50, max \$20,000 per checkout.

────  sg.db  ────  REAL BACKEND for PERSISTENT, MULTI-USER DATA
The platform auto-injects a tiny SDK into every served app. It's backed by Cloudflare KV scoped to this app, so data persists and is shared across all visitors of this app's URL. Use it for anything beyond ephemeral UI state.

API:
  await sg.db.put(key, value)        // value is anything JSON-serializable
  await sg.db.get(key)               // returns the value or null
  await sg.db.del(key)               // delete
  await sg.db.list(prefix?)          // returns array of keys (strings)

CHOOSING THE STORE:
- Single-user transient state (which tab is open, draft text)  → localStorage
- Anything that should survive a refresh, share across devices, or be visible to other visitors → \`sg.db\`
- For lists, namespace keys with prefixes (e.g. \`task:abc123\`) so \`sg.db.list('task:')\` works.

EXAMPLE for a habit tracker:
  async function loadHabits() { const ids = await sg.db.list('habit:'); return Promise.all(ids.map(id => sg.db.get(id))); }
  async function addHabit(name) { const id = 'habit:' + crypto.randomUUID(); await sg.db.put(id, { id, name, streak: 0, created: Date.now() }); }

OUTPUT TEMPLATE
{1-3 sentence summary of what changed or what was built}

\`\`\`html
<!doctype html>
<html lang="en">
...full updated file...
</html>
\`\`\``;

// Builder chat: streams Claude responses with full conversation history,
// passes the currently deployed HTML so iterations PATCH instead of regenerate,
// auto-deploys to R2 on stream completion.

import { Hono } from 'hono';
import Anthropic from '@anthropic-ai/sdk';
import type { Env, Variables } from '../types';
import { requireAuth } from '../middleware/auth';
import { requireCredits } from '../middleware/credits';
import { pickModel, costUsd, type ModelId } from '../lib/model-router';

export const builder = new Hono<{ Bindings: Env; Variables: Variables }>();

interface ChatBody { app_id: string; message: string; intent?: 'edit' | 'generate' | 'plan' | 'fix'; }

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
  await c.env.DB.prepare(
    `INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, 'user', ?)`
  ).bind(crypto.randomUUID(), convoId, body.message).run();

  const messages: { role: 'user' | 'assistant'; content: string }[] = [];
  if (currentHtml) {
    messages.push({
      role: 'user',
      content: `Here is the CURRENT deployed app at apps.stakgod.com/${app.slug}/. Modify this when the user asks for changes — don't regenerate from scratch.\n\n\`\`\`html\n${currentHtml}\n\`\`\``,
    });
    messages.push({ role: 'assistant', content: `Got it — I'll edit this in place. What would you like to change?` });
  }
  for (const m of history.results ?? []) messages.push({ role: m.role, content: m.content });
  messages.push({ role: 'user', content: body.message });

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
builder.post('/fork', requireAuth, async (c) => {
  const user = c.get('user')!;
  const { template, name } = await c.req.json<{ template: string; name?: string }>();
  if (!template || !/^[a-z0-9-]{1,64}$/.test(template)) return c.json({ error: 'bad_template' }, 400);
  const src = await c.env.APPS.get(`apps/${template}/index.html`);
  if (!src) return c.json({ error: 'template_not_found' }, 404);
  const html = await src.text();

  const id = crypto.randomUUID();
  const baseSlug = (name ?? template).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 32);
  const slug = `${baseSlug}-${id.slice(0, 6)}`;
  await c.env.DB.prepare(
    `INSERT INTO apps (id, user_id, slug, name, description, status) VALUES (?, ?, ?, ?, ?, 'live')`
  ).bind(id, user.id, slug, name ?? template, `Forked from ${template}`).run();
  await c.env.APPS.put(`apps/${slug}/index.html`, html, { httpMetadata: { contentType: 'text/html; charset=utf-8' } });
  await c.env.APPS.put(`apps/${slug}/versions/${Date.now()}.html`, html, { httpMetadata: { contentType: 'text/html; charset=utf-8' } });
  return c.json({ id, slug, url: `https://apps.stakgod.com/${slug}/`, build_url: `https://stakgod.com/build?app=${id}` });
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

const SYSTEM_PROMPT = `You are Stakgod, an AI app builder. Each app is ONE self-contained HTML file with inline Tailwind (CDN: https://cdn.tailwindcss.com) and inline JS.

RULES
- ALWAYS wrap your final HTML in a fenced \`\`\`html ... \`\`\` block. The platform extracts it from there and deploys to apps.stakgod.com automatically.
- If a "CURRENT deployed app" was provided, EDIT IT IN PLACE. Re-emit the entire updated file. Preserve everything the user didn't ask to change.
- If this is the first message and no current app exists, generate a complete fresh HTML file.
- Wire EVERY button. Use modern responsive Tailwind layouts. Mobile-first.
- Brief plain-English summary BEFORE the code block (1-3 sentences max). Then the code block. Nothing after.

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
  const { text } = await sg.ai.chat({
    system: 'You are a startup mentor.',
    messages: [{ role: 'user', content: 'Pitch me on Stakgod' }],
    model: 'sonnet'   // 'haiku' (fast/cheap) | 'sonnet' (default) | 'opus' (smart)
  });

Use this for chatbots, summaries, classifications, agentic features. The builder
of this app pays for usage out of their plan's monthly_messages quota — when
they hit the wall, sg.ai.chat returns a 402 with a friendly message you should
display ('Have the owner upgrade at stakgod.com/pricing').

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

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
        let deployed_url: string | null = null;
        if (html) {
          await c.env.APPS.put(`apps/${app.slug}/index.html`, html, { httpMetadata: { contentType: 'text/html; charset=utf-8' } });
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

const SYSTEM_PROMPT = `You are Stackgod, an AI app builder. Each app is ONE self-contained HTML file with inline Tailwind (CDN: https://cdn.tailwindcss.com) and inline JS.

RULES
- ALWAYS wrap your final HTML in a fenced \`\`\`html ... \`\`\` block. The platform extracts it from there and deploys to apps.stakgod.com automatically.
- If a "CURRENT deployed app" was provided, EDIT IT IN PLACE. Re-emit the entire updated file (do not output diffs or partial snippets — we always replace the whole file). Preserve everything the user didn't ask to change.
- If this is the first message and no current app exists, generate a complete fresh HTML file.
- Wire EVERY button — never ship dead UI. Use localStorage for client state. Use modern responsive Tailwind layouts. Mobile-first.
- Brief plain-English summary BEFORE the code block (1-3 sentences max). Then the code block. Nothing after.
- For data: prefer localStorage. If a real backend is required, mention it but stub with localStorage.

OUTPUT TEMPLATE
{1-3 sentence summary of what changed or what was built}

\`\`\`html
<!doctype html>
<html lang="en">
...full updated file...
</html>
\`\`\``;

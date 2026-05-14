// Builder chat: streams Claude responses, counts tokens, decrements credits,
// auto-deploys generated HTML to R2 (served by stackgod-apps at apps.stakgod.com/{slug}).

import { Hono } from 'hono';
import Anthropic from '@anthropic-ai/sdk';
import type { Env, Variables } from '../types';
import { requireAuth } from '../middleware/auth';
import { requireCredits } from '../middleware/credits';
import { pickModel, costUsd, type ModelId } from '../lib/model-router';

export const builder = new Hono<{ Bindings: Env; Variables: Variables }>();

interface ChatBody { app_id: string; message: string; intent?: 'edit' | 'generate' | 'plan' | 'fix'; }

builder.post('/chat', requireAuth, requireCredits, async (c) => {
  const user = c.get('user')!;
  const body = await c.req.json<ChatBody>();
  const intent = body.intent ?? 'generate';
  const model = pickModel({ intent, promptChars: body.message.length, plan: user.plan });

  const app = await c.env.DB.prepare(`SELECT slug FROM apps WHERE id=? AND user_id=?`).bind(body.app_id, user.id).first<{ slug: string }>();
  if (!app) return c.json({ error: 'app_not_found' }, 404);

  const client = new Anthropic({ apiKey: c.env.ANTHROPIC_API_KEY });
  const convoId = await ensureConversation(c.env.DB, body.app_id, user.id);
  await c.env.DB.prepare(
    `INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, 'user', ?)`
  ).bind(crypto.randomUUID(), convoId, body.message).run();

  const stream = await client.messages.stream({
    model, max_tokens: 4096, system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: body.message }],
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

// Manually deploy raw HTML (used by editor "Save" or external integrations).
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
  const existing = await db.prepare(
    `SELECT id FROM conversations WHERE app_id=? AND user_id=? ORDER BY created_at DESC LIMIT 1`
  ).bind(appId, userId).first<{ id: string }>();
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  await db.prepare(`INSERT INTO conversations (id, app_id, user_id) VALUES (?, ?, ?)`).bind(id, appId, userId).run();
  return id;
}

function extractHtml(s: string): string | null {
  // Prefer fenced ```html ... ``` block; fallback to a <!doctype html> or <html> root.
  const fenced = s.match(/```html\n([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const doctype = s.match(/<!doctype html[\s\S]*<\/html>/i);
  if (doctype) return doctype[0];
  const html = s.match(/<html[\s\S]*<\/html>/i);
  return html ? html[0] : null;
}

const SYSTEM_PROMPT = `You are Stackgod, an AI app builder. Output a single self-contained HTML file (with inline Tailwind via CDN or vanilla CSS, and inline JS) wrapped in a fenced \`\`\`html ... \`\`\` block. The page must be modern, responsive, accessible, and fully wired — every button does something. Use localStorage for state. Never ship dead UI.`;

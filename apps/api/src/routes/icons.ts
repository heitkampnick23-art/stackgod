// AI-generated app icons via Workers AI Flux. Stored in R2 at
// apps/{slug}/icon.png so apps-worker serves them publicly. Used in the
// dashboard, discover page, and as the source for iOS/Android codegen.

import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { requireAuth } from '../middleware/auth';

export const icons = new Hono<{ Bindings: Env; Variables: Variables }>();

const ICON_PROMPT = (name: string, description: string | null) =>
  `App icon, modern iOS-style square logo, ${name}${description ? ': ' + description : ''}. ` +
  `Bold flat geometric design, vibrant gradient background, prominent central symbol, ` +
  `soft inner shadow, premium feel, no text, no letters, no words, centered composition, ` +
  `clean edges, suitable for a 1024x1024 app icon.`;

icons.post('/:id/icon/generate', requireAuth, async (c) => {
  const user = c.get('user')!;
  const id = c.req.param('id');
  const app = await c.env.DB.prepare(`SELECT id, slug, name, description FROM apps WHERE id=? AND user_id=?`)
    .bind(id, user.id).first<{ id: string; slug: string; name: string; description: string | null }>();
  if (!app) return c.json({ error: 'not_found' }, 404);

  const out = await c.env.AI.run('@cf/black-forest-labs/flux-1-schnell', {
    prompt: ICON_PROMPT(app.name, app.description),
    steps: 4,
  }) as { image?: string };
  if (!out?.image) return c.json({ error: 'gen_failed' }, 502);

  const bytes = Uint8Array.from(atob(out.image), (ch) => ch.charCodeAt(0));
  await c.env.APPS.put(`apps/${app.slug}/icon.png`, bytes, { httpMetadata: { contentType: 'image/png' } });
  await c.env.DB.prepare(`UPDATE apps SET updated_at=unixepoch() WHERE id=?`).bind(id).run();
  return c.json({ ok: true, url: `https://apps.stakgod.com/${app.slug}/icon.png?v=${Date.now()}` });
});

// Internal trigger called from builder.ts on first successful deploy.
// Best-effort; failures don't block the build.
export async function generateIconIfMissing(env: Env, app: { slug: string; name: string; description: string | null }): Promise<void> {
  const existing = await env.APPS.head(`apps/${app.slug}/icon.png`);
  if (existing) return;
  try {
    const out = await env.AI.run('@cf/black-forest-labs/flux-1-schnell', {
      prompt: ICON_PROMPT(app.name, app.description),
      steps: 4,
    }) as { image?: string };
    if (!out?.image) return;
    const bytes = Uint8Array.from(atob(out.image), (ch) => ch.charCodeAt(0));
    await env.APPS.put(`apps/${app.slug}/icon.png`, bytes, { httpMetadata: { contentType: 'image/png' } });
  } catch {
    // swallow — icon is best-effort
  }
}

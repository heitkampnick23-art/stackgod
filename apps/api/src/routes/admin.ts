// Admin-only utilities. Currently: system-prompt regression evals.
// Auth: caller must be signed in AND in the ADMIN_EMAILS env (comma-separated).

import { Hono } from 'hono';
import Anthropic from '@anthropic-ai/sdk';
import type { Env, Variables } from '../types';
import { requireAuth } from '../middleware/auth';
import { EVAL_CASES, score, type CaseResult } from '../lib/evals';
import { SYSTEM_PROMPT } from './builder';

export const admin = new Hono<{ Bindings: Env; Variables: Variables }>();

function isAdmin(email: string, env: Env): boolean {
  const list = (env.ADMIN_EMAILS ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  return list.includes(email.toLowerCase());
}

admin.use('*', requireAuth, async (c, next) => {
  const user = c.get('user')!;
  if (!isAdmin(user.email, c.env)) return c.json({ error: 'forbidden' }, 403);
  await next();
});

admin.get('/evals', (c) => {
  return c.json({
    cases: EVAL_CASES.map((c) => ({ id: c.id, category: c.category, prompt: c.prompt, trait_count: c.traits.length })),
  });
});

interface RunBody { case_id?: string; model?: 'haiku' | 'sonnet' | 'opus'; }
const MODELS = {
  haiku:  'claude-haiku-4-5-20251001',
  sonnet: 'claude-sonnet-4-6',
  opus:   'claude-opus-4-7',
};

admin.post('/evals/run', async (c) => {
  const body = await c.req.json<RunBody>().catch(() => ({} as RunBody));
  const cases = body.case_id ? EVAL_CASES.filter((x) => x.id === body.case_id) : EVAL_CASES;
  if (cases.length === 0) return c.json({ error: 'no_matching_case' }, 404);

  const model = MODELS[body.model ?? 'haiku'];
  const client = new Anthropic({ apiKey: c.env.ANTHROPIC_API_KEY });

  const results: CaseResult[] = [];
  for (const ec of cases) {
    const t0 = Date.now();
    let out = ''; let tIn = 0; let tOut = 0;
    try {
      const r = await client.messages.create({
        model, max_tokens: 4096, system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: ec.prompt }],
      });
      out = (r.content as Array<{ type: string; text?: string }>).filter((b) => b.type === 'text').map((b) => b.text ?? '').join('');
      tIn = r.usage.input_tokens; tOut = r.usage.output_tokens;
    } catch (e) {
      out = `ERROR: ${e}`;
    }
    const s = score(out, ec.traits);
    results.push({
      id: ec.id, category: ec.category, output: out.slice(0, 8000),
      tokens_in: tIn, tokens_out: tOut, ms: Date.now() - t0,
      traits: s.results, passed: s.passed, total: s.total, ok: s.ok,
    });
  }

  const summary = {
    cases: results.length,
    fully_passed: results.filter((r) => r.ok).length,
    trait_pass_rate: results.reduce((s, r) => s + r.passed, 0) / results.reduce((s, r) => s + r.total, 0),
    total_tokens_in:  results.reduce((s, r) => s + r.tokens_in, 0),
    total_tokens_out: results.reduce((s, r) => s + r.tokens_out, 0),
    total_ms:         results.reduce((s, r) => s + r.ms, 0),
    model,
  };
  return c.json({ summary, results });
});

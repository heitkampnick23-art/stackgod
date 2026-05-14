// Picks a Claude model based on intent + plan. User never picks; we route.
// Cost-per-token table is the single source of truth for credit accounting.

import type { Plan } from './plans';

export type ModelId =
  | 'claude-opus-4-7'
  | 'claude-sonnet-4-6'
  | 'claude-haiku-4-5-20251001';

// USD per 1M tokens. Update if Anthropic pricing changes.
export const PRICING: Record<ModelId, { in: number; out: number }> = {
  'claude-opus-4-7':         { in: 15.00, out: 75.00 },
  'claude-sonnet-4-6':       { in:  3.00, out: 15.00 },
  'claude-haiku-4-5-20251001': { in: 1.00, out:  5.00 },
};

export function costUsd(model: ModelId, tokensIn: number, tokensOut: number): number {
  const p = PRICING[model];
  return (tokensIn / 1_000_000) * p.in + (tokensOut / 1_000_000) * p.out;
}

export interface RouteInput {
  intent: 'edit' | 'generate' | 'plan' | 'fix';
  promptChars: number;
  plan: Plan;
}

export function pickModel({ intent, promptChars, plan }: RouteInput): ModelId {
  // Studio gets Opus for plan/fix by default.
  if (plan === 'studio' && (intent === 'plan' || intent === 'fix')) return 'claude-opus-4-7';
  // Big inputs or hard intents → Opus on paid; Sonnet on free.
  if (intent === 'plan' || intent === 'fix' || promptChars > 12_000) {
    return plan === 'free' ? 'claude-sonnet-4-6' : 'claude-opus-4-7';
  }
  // Routine edits → Haiku.
  if (intent === 'edit' && promptChars < 2_000) return 'claude-haiku-4-5-20251001';
  return 'claude-sonnet-4-6';
}

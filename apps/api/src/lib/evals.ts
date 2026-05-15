// System-prompt eval cases. Each case is a prompt + a list of traits we
// expect the assistant's response to satisfy. Used by /admin/evals to catch
// regressions when extending the SYSTEM_PROMPT.

export interface Trait {
  id: string;
  label: string;
  // returns true when the trait is satisfied by the model output.
  test: (out: string) => boolean;
}

export interface EvalCase {
  id: string;
  category: 'baseline' | 'data' | 'auth' | 'ai' | 'payments' | 'media' | 'patterns';
  prompt: string;
  traits: Trait[];
}

const has = (re: RegExp) => (s: string) => re.test(s);
const hasAny = (...regs: RegExp[]) => (s: string) => regs.some((r) => r.test(s));
const hasAll = (...regs: RegExp[]) => (s: string) => regs.every((r) => r.test(s));

const COMMON_TRAITS: Trait[] = [
  { id: 'fenced_html', label: 'wraps in ```html block', test: has(/```html\n[\s\S]+```/) },
  { id: 'doctype',     label: 'declares <!doctype html>', test: has(/<!doctype html>/i) },
  { id: 'tailwind',    label: 'uses Tailwind',           test: has(/cdn\.tailwindcss\.com/) },
  { id: 'closes_html', label: 'closes </html>',          test: has(/<\/html>/i) },
  { id: 'has_summary', label: 'has prose summary before code', test: (s) => {
      const i = s.search(/```html/);
      return i > 50 && i < 1500;
  }},
];

export const EVAL_CASES: EvalCase[] = [
  {
    id: 'baseline-habit-tracker',
    category: 'baseline',
    prompt: 'Build me a simple habit tracker. I want to add habits, mark them done daily, and see my streak. Should work across devices for the same user.',
    traits: [
      ...COMMON_TRAITS,
      { id: 'uses_sg_db',   label: 'persists with sg.db (multi-user)', test: has(/sg\.db\./) },
      { id: 'no_localStorage_only', label: 'does NOT rely solely on localStorage', test: (s) => has(/sg\.db\./)(s) || !has(/localStorage/i)(s) },
      { id: 'concept_streak', label: 'mentions "streak" somewhere', test: has(/streak/i) },
    ],
  },
  {
    id: 'auth-saves-per-user',
    category: 'auth',
    prompt: 'A journal app where each user signs in with their email and only sees their own entries.',
    traits: [
      ...COMMON_TRAITS,
      { id: 'uses_sg_auth', label: 'uses sg.auth.signIn / sg.auth.user', test: hasAny(/sg\.auth\.signIn/, /sg\.auth\.user/) },
      { id: 'magic_link',   label: 'mentions magic link / email sign-in', test: hasAny(/magic[- ]link/i, /sign.in.*email/i) },
      { id: 'scoped_data',  label: 'keys data per user (uses user id in db key)', test: has(/sg\.db\.(put|get)\([^)]*(user|me)\.id/) },
    ],
  },
  {
    id: 'ai-chatbot',
    category: 'ai',
    prompt: 'Build a chatbot that helps people pick a startup name. Use Claude.',
    traits: [
      ...COMMON_TRAITS,
      { id: 'uses_sg_ai',     label: 'calls sg.ai.chat',         test: hasAny(/sg\.ai\.chat/, /sg\.ai\.stream/) },
      { id: 'system_prompt',  label: 'passes a system prompt',   test: has(/system\s*:/) },
      { id: 'message_history',label: 'maintains messages array', test: has(/messages\s*:/) },
    ],
  },
  {
    id: 'payments-checkout',
    category: 'payments',
    prompt: 'A "buy me a coffee" page where visitors can tip the creator $5.',
    traits: [
      ...COMMON_TRAITS,
      { id: 'uses_sg_payments', label: 'calls sg.payments.checkout', test: has(/sg\.payments\.checkout/) },
      { id: 'amount_cents',     label: 'passes amount_cents (not just amount)', test: has(/amount_cents/) },
      { id: 'redirects_to_stripe', label: 'navigates to checkout url', test: hasAny(/location\.href\s*=\s*[^;]*url/, /window\.location\s*=\s*[^;]*url/) },
    ],
  },
  {
    id: 'media-image-upload',
    category: 'media',
    prompt: 'A photo gallery where users upload pics and they show up in a grid.',
    traits: [
      ...COMMON_TRAITS,
      { id: 'uses_sg_upload', label: 'calls sg.upload',           test: has(/sg\.upload/) },
      { id: 'file_input',     label: 'has a file input',          test: has(/<input[^>]*type=["']file["']/) },
      { id: 'renders_image',  label: 'renders <img> from upload', test: has(/<img[^>]*src/) },
    ],
  },
  {
    id: 'media-image-gen',
    category: 'media',
    prompt: 'An AI sticker maker. User types a prompt, gets a generated image.',
    traits: [
      ...COMMON_TRAITS,
      { id: 'uses_sg_ai_image', label: 'calls sg.ai.image', test: has(/sg\.ai\.image/) },
      { id: 'shows_data_url',   label: 'displays returned image (data_url or base64)', test: hasAny(/data_url/, /base64/) },
    ],
  },
  {
    id: 'patterns-iterative-edit',
    category: 'patterns',
    prompt: 'Add a delete button on each habit row.',
    // This case will be invoked WITH a current-html context in the real test
    // run; for the static-prompt eval we just check the assistant doesn't
    // hallucinate primitives we don't have.
    traits: [
      ...COMMON_TRAITS,
      { id: 'no_react',     label: 'does not require React build', test: (s) => !hasAny(/import\s+React/, /from\s+["']react["']/)(s) },
      { id: 'no_node_apis', label: 'does not call Node-only APIs', test: (s) => !hasAny(/require\(/, /process\.env/, /fs\.readFile/)(s) },
    ],
  },
];

export interface CaseResult {
  id: string;
  category: string;
  output: string;
  tokens_in: number;
  tokens_out: number;
  ms: number;
  traits: Array<{ id: string; label: string; passed: boolean }>;
  passed: number;
  total: number;
  ok: boolean;
}

export function score(out: string, traits: Trait[]): { results: Array<{ id: string; label: string; passed: boolean }>; passed: number; total: number; ok: boolean } {
  const results = traits.map((t) => ({ id: t.id, label: t.label, passed: t.test(out) }));
  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  return { results, passed, total, ok: passed === total };
}

// Plan definitions — single source of truth for limits and Stripe price IDs.
// Prices set in LIVE Stripe; IDs filled in at deploy time via `wrangler secret`.

export type Plan = 'free' | 'hobby' | 'pro' | 'studio';

export interface PlanDef {
  name: string;
  monthly_usd: number;
  daily_messages: number;        // 0 = use monthly only
  monthly_messages: number;
  max_apps: number;              // -1 = unlimited
  custom_domains: boolean;
  stripe_connect: boolean;
  testflight: boolean;
  app_store: boolean;
  marketplace: boolean;
  priority_opus: boolean;
}

export const PLANS: Record<Plan, PlanDef> = {
  free:   { name: 'Free',   monthly_usd: 0,   daily_messages: 5,   monthly_messages: 150,   max_apps: 1,  custom_domains: false, stripe_connect: false, testflight: false, app_store: false, marketplace: false, priority_opus: false },
  hobby:  { name: 'Hobby',  monthly_usd: 19,  daily_messages: 0,   monthly_messages: 200,   max_apps: 3,  custom_domains: true,  stripe_connect: false, testflight: false, app_store: false, marketplace: false, priority_opus: false },
  pro:    { name: 'Pro',    monthly_usd: 49,  daily_messages: 0,   monthly_messages: 1500,  max_apps: -1, custom_domains: true,  stripe_connect: true,  testflight: true,  app_store: false, marketplace: false, priority_opus: false },
  studio: { name: 'Studio', monthly_usd: 149, daily_messages: 0,   monthly_messages: 6000,  max_apps: -1, custom_domains: true,  stripe_connect: true,  testflight: true,  app_store: true,  marketplace: true,  priority_opus: true  },
};

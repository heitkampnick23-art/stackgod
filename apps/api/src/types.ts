export interface Env {
  DB: D1Database;
  ARTIFACTS: R2Bucket;
  APPS: R2Bucket;
  AI: Ai;
  SESSIONS: KVNamespace;
  APP_DATA: KVNamespace;
  APP_HOSTS: KVNamespace;
  BUILD_QUEUE: Queue;
  APP_URL: string;
  API_URL: string;
  ANTHROPIC_API_KEY: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  CF_API_TOKEN_REGISTRAR: string;
  APPLE_CLIENT_ID: string;
  APPLE_TEAM_ID: string;
  APPLE_KEY_ID: string;
  APPLE_PRIVATE_KEY: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  RESEND_API_KEY: string;
  SESSION_SECRET: string;
  ENCRYPTION_KEY: string;       // base64(32 bytes) for AES-GCM at-rest encryption
  BUILD_TOKEN_SECRET: string;   // HMAC for one-time CI build tokens
  GH_PAT: string;               // fine-grained PAT for workflow_dispatch
  GH_REPO: string;              // e.g. "heitkampnick23-art/stackgod"
  BUILD_ROOM: DurableObjectNamespace;
  ADMIN_EMAILS?: string;        // comma-separated list of admin emails
  GLOBAL_DAILY_BUDGET_USD?: string;  // org-wide circuit breaker on AI spend (default $50)
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  plan: 'free' | 'hobby' | 'pro' | 'studio';
  stripe_customer_id: string | null;
  stripe_connect_account_id: string | null;
}

export type Variables = { user?: User };

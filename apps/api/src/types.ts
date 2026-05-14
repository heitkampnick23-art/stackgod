export interface Env {
  DB: D1Database;
  ARTIFACTS: R2Bucket;
  SESSIONS: KVNamespace;
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

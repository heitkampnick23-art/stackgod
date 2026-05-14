// Cloudflare Queues consumer: receives build messages from /mobile/{ios,android}/ship,
// inserts a `builds` row, mints a one-time HMAC token, and dispatches the
// matching GitHub Actions workflow with just {build_id, token, api_url}.

import type { Env } from '../types';
import { mintBuildToken } from '../lib/build-token';

export interface IosMsg {
  kind: 'ios';
  app_id: string;
  user_id: string;
  bundle_id: string;
}
export interface AndroidMsg {
  kind: 'android';
  app_id: string;
  user_id: string;
  package_name: string;
}
export type BuildMsg = IosMsg | AndroidMsg;

export async function handleBuildBatch(batch: MessageBatch<BuildMsg>, env: Env): Promise<void> {
  for (const msg of batch.messages) {
    try {
      await dispatchOne(msg.body, env);
      msg.ack();
    } catch (e) {
      console.error('build dispatch failed', e);
      msg.retry({ delaySeconds: 30 });
    }
  }
}

async function dispatchOne(m: BuildMsg, env: Env): Promise<void> {
  const buildId = crypto.randomUUID();
  const bundleId = m.kind === 'ios' ? m.bundle_id : m.package_name;
  await env.DB.prepare(
    `INSERT INTO builds (id, app_id, user_id, kind, bundle_id, status) VALUES (?, ?, ?, ?, ?, 'queued')`
  ).bind(buildId, m.app_id, m.user_id, m.kind, bundleId).run();

  const token = await mintBuildToken(env.BUILD_TOKEN_SECRET, buildId);
  const workflow = m.kind === 'ios' ? 'ios-build.yml' : 'android-build.yml';
  const r = await fetch(
    `https://api.github.com/repos/${env.GH_REPO}/actions/workflows/${workflow}/dispatches`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.GH_PAT}`,
        accept: 'application/vnd.github+json',
        'user-agent': 'stackgod-api',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        ref: 'main',
        inputs: { build_id: buildId, token, api_url: env.API_URL },
      }),
    }
  );
  if (!r.ok) throw new Error(`gh dispatch ${r.status}: ${await r.text()}`);

  await env.DB.prepare(`UPDATE builds SET status='dispatched', dispatched_at=unixepoch() WHERE id=?`).bind(buildId).run();
}

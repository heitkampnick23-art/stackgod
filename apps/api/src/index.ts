import { Hono } from 'hono';
import type { Env, Variables } from './types';
import { loadUser } from './middleware/auth';
import { auth } from './routes/auth';
import { oauth } from './routes/oauth';
import { billing } from './routes/billing';
import { builder } from './routes/builder';
import { domains } from './routes/domains';
import { apps } from './routes/apps';
import { mobile } from './routes/mobile';
import { connect } from './routes/connect';
import { builds } from './routes/builds';
import { templates } from './routes/templates';
import { tips } from './routes/tips';
import { icons } from './routes/icons';
import { appDomain } from './routes/app-domain';
import { discover } from './routes/discover';
import { handleBuildBatch, type BuildMsg } from './queue/build-consumer';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.use('*', async (c, next) => {
  const origin = c.req.header('origin') ?? '';
  if (origin.endsWith('stakgod.com') || origin.endsWith('localhost:3000')) {
    c.header('access-control-allow-origin', origin);
    c.header('access-control-allow-credentials', 'true');
    c.header('access-control-allow-headers', 'content-type');
    c.header('access-control-allow-methods', 'GET,POST,PUT,DELETE,OPTIONS');
  }
  if (c.req.method === 'OPTIONS') return c.body(null, 204);
  await next();
});

app.use('*', loadUser);

app.get('/', (c) => c.json({ name: 'stackgod-api', ok: true }));
app.route('/auth', auth);
app.route('/auth', oauth);
app.route('/billing', billing);
app.route('/builder', builder);
app.route('/domains', domains);
app.route('/apps', apps);
app.route('/apps', appDomain);
app.route('/discover', discover);
app.route('/apps', icons);
app.route('/mobile', mobile);
app.route('/connect', connect);
app.route('/builds', builds);
app.route('/templates', templates);
app.route('/tips', tips);

export default {
  fetch: app.fetch,
  async queue(batch: MessageBatch<BuildMsg>, env: Env): Promise<void> {
    await handleBuildBatch(batch, env);
  },
};

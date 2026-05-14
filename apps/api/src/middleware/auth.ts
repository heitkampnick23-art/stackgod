import type { MiddlewareHandler } from 'hono';
import type { Env, User, Variables } from '../types';

export const loadUser: MiddlewareHandler<{ Bindings: Env; Variables: Variables }> = async (c, next) => {
  const cookie = c.req.header('cookie') ?? '';
  const m = cookie.match(/sg_session=([^;]+)/);
  if (!m) return await next();
  const token = m[1];
  const sess = await c.env.DB.prepare(
    `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token=? AND s.expires_at > unixepoch()`
  ).bind(token).first<User & Record<string, unknown>>();
  if (sess) c.set('user', sess as User);
  await next();
};

export const requireAuth: MiddlewareHandler<{ Bindings: Env; Variables: Variables }> = async (c, next) => {
  if (!c.get('user')) return c.json({ error: 'unauthorized' }, 401);
  await next();
};

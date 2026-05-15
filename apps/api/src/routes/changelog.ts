// Auto-built changelog from the public stackgod repo's git log.
// Cached 5 min at the edge.

import { Hono } from 'hono';
import type { Env, Variables } from '../types';

export const changelog = new Hono<{ Bindings: Env; Variables: Variables }>();

changelog.get('/', async (c) => {
  const r = await fetch(`https://api.github.com/repos/${c.env.GH_REPO}/commits?per_page=80`, {
    headers: {
      authorization: `Bearer ${c.env.GH_PAT}`,
      'user-agent': 'stakgod-api',
      accept: 'application/vnd.github+json',
    },
  });
  if (!r.ok) return c.json({ entries: [] });
  const commits = await r.json<Array<{
    sha: string;
    commit: { message: string; author: { name: string; date: string } };
    html_url: string;
  }>>();
  const entries = commits
    .filter((c) => !c.commit.message.toLowerCase().startsWith('merge '))
    .map((c) => {
      const lines = c.commit.message.split('\n').filter(Boolean);
      const subject = lines[0];
      const m = subject.match(/^(feat|fix|chore|docs|infra|perf|refactor|style|test)(\([^)]+\))?:?\s*(.+)$/i);
      const kind = (m?.[1] ?? 'misc').toLowerCase();
      const scope = m?.[2]?.replace(/[()]/g, '') ?? null;
      const title = m?.[3] ?? subject;
      const body = lines.slice(1).join('\n').trim();
      return {
        sha: c.sha.slice(0, 7),
        kind, scope, title,
        body: body.length > 600 ? body.slice(0, 600) + '…' : body,
        date: c.commit.author.date,
        url: c.html_url,
      };
    });
  return c.json({ entries }, 200, { 'cache-control': 'public, max-age=300' });
});

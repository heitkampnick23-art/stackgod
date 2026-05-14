// Public template catalog. Templates live in R2 under apps/{slug}/index.html
// and are also rendered by stackgod-apps at apps.stakgod.com/{slug}/ so the
// gallery on the marketing site can preview them in an iframe.

import { Hono } from 'hono';
import type { Env, Variables } from '../types';

export const templates = new Hono<{ Bindings: Env; Variables: Variables }>();

export const TEMPLATES = [
  { slug: 'tpl-habit-tracker',  name: 'Habit Tracker',     emoji: '🔥', blurb: 'Track daily habits with streaks. Powered by sg.db.' },
  { slug: 'tpl-link-in-bio',    name: 'Link in Bio',       emoji: '🔗', blurb: 'A clean linktree-style page. Add/edit links in-app.' },
  { slug: 'tpl-tip-jar',        name: 'Tip Jar',           emoji: '🪙', blurb: 'Collect tips with a goal bar. Connect Stripe later.' },
  { slug: 'tpl-newsletter',     name: 'Newsletter Signup', emoji: '✉️', blurb: 'Capture emails. List in-app, export to CSV.' },
];

templates.get('/', (c) => c.json({ templates: TEMPLATES }));

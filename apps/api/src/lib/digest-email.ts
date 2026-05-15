// Weekly builder digest email. Sent every Monday ~12pm ET via cron.
// Skipped entirely if the user had zero meaningful activity, so we never spam.

interface Env { RESEND_API_KEY: string; APP_URL: string; }

export interface DigestStats {
  views: number;
  forks: number;
  revenue_cents: number;
  top_app: { name: string; slug: string; views: number } | null;
  apps_count: number;
}

export async function sendDigestEmail(
  env: Env,
  to: string,
  name: string | null,
  stats: DigestStats,
  unsubToken: string,
): Promise<void> {
  const first = (name?.split(' ')[0]) || 'builder';
  const dollars = (stats.revenue_cents / 100).toFixed(2);
  const unsubUrl = `${env.APP_URL.replace('https://stakgod.com', 'https://api.stakgod.com')}/digest/unsubscribe?token=${unsubToken}`;
  const dashUrl = `${env.APP_URL}/dashboard`;

  const headlineEmoji = stats.revenue_cents > 0 ? '💰' : stats.forks > 0 ? '🔥' : '📈';
  const headline =
    stats.revenue_cents > 0 ? `You earned $${dollars} this week`
    : stats.forks > 0       ? `${stats.forks} ${stats.forks === 1 ? 'builder' : 'builders'} forked your work`
    :                         `${stats.views.toLocaleString()} ${stats.views === 1 ? 'person' : 'people'} used your apps this week`;

  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#0a0a0f;color:#f5f5f7;font:16px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;padding:32px 24px">
<tr><td>
<h1 style="font-family:Georgia,serif;font-weight:700;font-size:32px;margin:0;color:#fff">
<span style="color:#d4af37">STAK</span>GOD
</h1>

<p style="margin:24px 0 0;font-size:18px;color:#fff">Hey ${escape(first)},</p>
<p style="margin:8px 0 0;font-size:24px;font-weight:700;color:#fff">${headlineEmoji} ${escape(headline)}</p>

<table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;border:1px solid rgba(255,255,255,0.1);border-radius:16px;background:rgba(255,255,255,0.03)">
<tr>
<td width="33%" style="padding:20px;text-align:center;border-right:1px solid rgba(255,255,255,0.08)">
  <div style="font-size:28px;font-weight:700;color:#ff5b1f">${stats.views.toLocaleString()}</div>
  <div style="font-size:12px;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:1px;margin-top:4px">Views</div>
</td>
<td width="33%" style="padding:20px;text-align:center;border-right:1px solid rgba(255,255,255,0.08)">
  <div style="font-size:28px;font-weight:700;color:#d4af37">${stats.forks}</div>
  <div style="font-size:12px;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:1px;margin-top:4px">Forks</div>
</td>
<td width="33%" style="padding:20px;text-align:center">
  <div style="font-size:28px;font-weight:700;color:#6ee7b7">$${dollars}</div>
  <div style="font-size:12px;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:1px;margin-top:4px">Earned</div>
</td>
</tr>
</table>

${stats.top_app ? `
<p style="margin:24px 0 0;color:rgba(255,255,255,0.75)">
<strong style="color:#fff">⭐ Top app this week:</strong> <a href="${env.APP_URL}/u/me/${escape(stats.top_app.slug)}" style="color:#ff5b1f">${escape(stats.top_app.name)}</a> — ${stats.top_app.views.toLocaleString()} views.
</p>` : ''}

<p style="margin:24px 0 0;color:rgba(255,255,255,0.75)">
You have ${stats.apps_count} ${stats.apps_count === 1 ? 'public app' : 'public apps'} live. Want more reach?
</p>
<ul style="margin:8px 0 0;padding-left:20px;color:rgba(255,255,255,0.75)">
<li style="margin:4px 0">Tweet your app's link — every Discover view counts toward Top Apps</li>
<li style="margin:4px 0">Set a fork price (Marketplace) to earn when others remix your idea</li>
<li style="margin:4px 0">Ship to TestFlight + Play to multiply your audience</li>
</ul>

<table width="100%" cellpadding="0" cellspacing="0" style="margin:32px 0">
<tr><td align="center">
<a href="${dashUrl}" style="display:inline-block;background:#ff5b1f;color:#fff;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:999px">Open dashboard →</a>
</td></tr>
</table>

<hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:32px 0"/>
<p style="margin:0;color:rgba(255,255,255,0.4);font-size:12px;text-align:center">
You're getting this because you have public apps on Stakgod. Sent weekly.<br/>
<a href="${unsubUrl}" style="color:rgba(255,255,255,0.5)">Unsubscribe from digests</a> &middot;
<a href="${env.APP_URL}" style="color:rgba(255,255,255,0.5)">stakgod.com</a>
</p>
</td></tr></table>
</body></html>`;

  const text = `Hey ${first},

${headline}

This week:
• Views:  ${stats.views.toLocaleString()}
• Forks:  ${stats.forks}
• Earned: $${dollars}
${stats.top_app ? `\nTop app: ${stats.top_app.name} (${stats.top_app.views.toLocaleString()} views)\n` : ''}
You have ${stats.apps_count} public app${stats.apps_count === 1 ? '' : 's'} live.

Open your dashboard: ${dashUrl}

— Stakgod
Unsubscribe: ${unsubUrl}
`;

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: 'Stakgod <digest@stakgod.com>',
        to,
        subject: `${headlineEmoji} ${headline} — your Stakgod week`,
        html, text,
        reply_to: 'hello@stakgod.com',
        headers: { 'List-Unsubscribe': `<${unsubUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
        tags: [{ name: 'sg_kind', value: 'digest' }],
      }),
    });
  } catch { /* best-effort */ }
}

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

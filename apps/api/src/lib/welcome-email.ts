// Welcome email sent (best-effort) on first sign-up.
// Caller should wrap in ctx.waitUntil so it never blocks the auth redirect.

interface Env { RESEND_API_KEY: string; APP_URL: string; }

export async function sendWelcomeEmail(env: Env, to: string, name?: string | null): Promise<void> {
  const first = (name?.split(' ')[0]) || 'builder';
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#0a0a0f;color:#f5f5f7;font:16px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;padding:32px 24px">
<tr><td>
<h1 style="font-family:Georgia,serif;font-weight:700;font-size:32px;margin:0;color:#fff">
<span style="color:#d4af37">STAK</span>GOD
</h1>
<p style="margin:24px 0 0;font-size:18px;line-height:1.5;color:#fff">
Hey ${escape(first)} — welcome 🔥
</p>
<p style="margin:16px 0 0;color:rgba(255,255,255,0.75)">
You just joined ${countLink(env)}. Here's the fastest way to feel the magic:
</p>

<table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;border:1px solid rgba(255,255,255,0.1);border-radius:16px;background:rgba(255,255,255,0.03)">
<tr><td style="padding:20px">
<div style="font-weight:700;color:#ff5b1f;font-size:13px;letter-spacing:1px;text-transform:uppercase">3-minute first build</div>
<ol style="margin:12px 0 0;padding-left:20px;color:rgba(255,255,255,0.85)">
<li style="margin:8px 0">Open <a href="${env.APP_URL}/build" style="color:#ff5b1f">stakgod.com/build</a></li>
<li style="margin:8px 0">Type <em>"a habit tracker with sign-in"</em> and hit Send</li>
<li style="margin:8px 0">Watch your app go live in ~10 seconds</li>
<li style="margin:8px 0">Click <strong>🎯 Select</strong> → click any button → tell Claude what to change</li>
</ol>
</td></tr>
</table>

<p style="margin:24px 0 0;color:rgba(255,255,255,0.75)">
Need ideas? <a href="${env.APP_URL}/templates" style="color:#ff5b1f">Fork a template</a> in one click. Or browse what other builders are shipping on <a href="${env.APP_URL}/discover" style="color:#ff5b1f">Discover</a>.
</p>

<p style="margin:32px 0 0;padding:16px;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:12px;color:#6ee7b7;font-size:14px">
🎁 <strong>Launch promo:</strong> 14-day free trial on every paid plan. No card charged for 14 days.
</p>

<p style="margin:24px 0 0;color:rgba(255,255,255,0.6);font-size:14px">
Reply to this email if you get stuck. I read every one.
</p>
<p style="margin:8px 0 0;color:rgba(255,255,255,0.5);font-size:14px">— Nick @ Stakgod</p>

<hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:32px 0"/>
<p style="margin:0;color:rgba(255,255,255,0.4);font-size:12px;text-align:center">
<a href="${env.APP_URL}" style="color:rgba(255,255,255,0.5)">stakgod.com</a> &middot;
<a href="https://github.com/heitkampnick23-art/stackgod" style="color:rgba(255,255,255,0.5)">open source</a> &middot;
<a href="mailto:hello@stakgod.com" style="color:rgba(255,255,255,0.5)">hello@stakgod.com</a>
</p>
</td></tr></table>
</body></html>`;

  const text = `Hey ${first} — welcome to Stakgod 🔥

3-minute first build:
1. Open ${env.APP_URL}/build
2. Type "a habit tracker with sign-in" and hit Send
3. Watch your app go live in ~10 seconds
4. Click 🎯 Select → click any button → tell Claude what to change

Need ideas? Fork a template: ${env.APP_URL}/templates
Or browse Discover: ${env.APP_URL}/discover

Launch promo: 14-day free trial on every paid plan. No card charged for 14 days.

Reply to this email if you get stuck.
— Nick @ Stakgod
${env.APP_URL}
`;

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: 'Nick at Stakgod <welcome@stakgod.com>',
        to,
        subject: 'Welcome to Stakgod 🔥 — first build in 3 minutes',
        html, text,
        reply_to: 'hello@stakgod.com',
        tags: [{ name: 'sg_kind', value: 'welcome' }],
      }),
    });
  } catch { /* best-effort */ }
}

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

function countLink(env: Env): string {
  return `<a href="${env.APP_URL}" style="color:#ff5b1f">Stakgod</a>`;
}

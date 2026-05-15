// Dynamic Open Graph image — renders 1200x630 SVG → PNG on the edge.
// Usage: /api/og?title=...&subtitle=...&kind=feature

export const runtime = 'edge';

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function esc(s: string): string { return s.replace(/[&<>"']/g, (c) => ESC[c]); }

export async function GET(req: Request) {
  const url = new URL(req.url);
  const title = (url.searchParams.get('title') ?? 'Stakgod').slice(0, 80);
  const subtitle = (url.searchParams.get('subtitle') ?? 'Speak it. Ship it. Own it.').slice(0, 120);
  const kind = url.searchParams.get('kind') ?? '';

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0a0a0f"/>
      <stop offset="1" stop-color="#1a0a05"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.7" cy="0.2" r="0.7">
      <stop offset="0" stop-color="#ff5b1f" stop-opacity="0.45"/>
      <stop offset="1" stop-color="#ff5b1f" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="0.1" cy="0.9" r="0.5">
      <stop offset="0" stop-color="#d4af37" stop-opacity="0.3"/>
      <stop offset="1" stop-color="#d4af37" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <rect width="1200" height="630" fill="url(#glow2)"/>
  ${kind ? `<text x="80" y="120" font-family="ui-sans-serif,system-ui" font-size="22" font-weight="700" fill="#ff5b1f" letter-spacing="3">${esc(kind.toUpperCase())}</text>` : ''}
  <text x="80" y="${kind ? 280 : 240}" font-family="Cinzel,serif" font-size="84" font-weight="700" fill="#ffffff" style="letter-spacing:-2px">
    <tspan fill="#d4af37">STAK</tspan>GOD
  </text>
  <text x="80" y="${kind ? 380 : 340}" font-family="ui-sans-serif,system-ui" font-size="44" font-weight="700" fill="#ffffff">${esc(title)}</text>
  <text x="80" y="${kind ? 440 : 400}" font-family="ui-sans-serif,system-ui" font-size="26" font-weight="500" fill="rgba(255,255,255,0.7)">${esc(subtitle)}</text>
  <text x="80" y="560" font-family="ui-sans-serif,system-ui" font-size="20" font-weight="600" fill="rgba(255,255,255,0.5)">stakgod.com · open source · ships to App Store</text>
</svg>`;

  return new Response(svg, {
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      'cache-control': 'public, max-age=86400, immutable',
    },
  });
}

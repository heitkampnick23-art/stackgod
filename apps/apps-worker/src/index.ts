// Serves user-built apps from R2 at apps.stakgod.com/{slug}/{path...}
// Each app's deployed bundle lives under R2 key prefix `apps/{slug}/`.

interface Env { APPS: R2Bucket; }

const ALLOWED_HEADERS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'cache-control': 'public, max-age=300',
  'x-frame-options': 'SAMEORIGIN',
  'referrer-policy': 'strict-origin-when-cross-origin',
};

const TYPES: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  htm: 'text/html; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  json: 'application/json; charset=utf-8',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif',
  ico: 'image/x-icon',
  txt: 'text/plain; charset=utf-8',
  xml: 'application/xml',
  woff: 'font/woff', woff2: 'font/woff2',
};

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const segs = url.pathname.split('/').filter(Boolean);
    if (segs.length === 0) return landing();
    const slug = segs[0];
    if (!/^[a-z0-9-]{1,64}$/.test(slug)) return new Response('bad slug', { status: 400 });

    let path = segs.slice(1).join('/');
    if (path === '' || path.endsWith('/')) path += 'index.html';
    const key = `apps/${slug}/${path}`;

    const obj = await env.APPS.get(key);
    if (obj) return r2Response(obj, path);

    // SPA fallback: serve index.html for unknown paths.
    const root = await env.APPS.get(`apps/${slug}/index.html`);
    if (root) return r2Response(root, 'index.html', 200);
    return new Response('app not found', { status: 404, headers: { 'content-type': 'text/plain' } });
  },
};

function r2Response(obj: R2ObjectBody, path: string, status = 200): Response {
  const ext = path.split('.').pop()?.toLowerCase() ?? 'html';
  const headers = new Headers(ALLOWED_HEADERS);
  headers.set('content-type', TYPES[ext] ?? 'application/octet-stream');
  if (obj.httpEtag) headers.set('etag', obj.httpEtag);
  return new Response(obj.body, { status, headers });
}

function landing(): Response {
  return new Response(
    `<!doctype html><meta charset=utf-8><title>Stackgod Apps</title><body style="font:16px system-ui;background:#0a0a0f;color:#f5f5f7;display:grid;place-items:center;height:100vh;text-align:center"><div><h1 style="font-family:Cinzel,serif;color:#d4af37">Stackgod Apps</h1><p style="opacity:.6">Your built apps live here at apps.stakgod.com/{slug}.</p><p><a style="color:#ff5b1f" href="https://stakgod.com/build">Start building →</a></p></div>`,
    { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } }
  );
}

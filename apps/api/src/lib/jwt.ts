// RS256 JWT verifier for OIDC id_tokens (Apple + Google).
// Validates signature against the issuer's JWKS, plus standard claims.
// JWKS is cached in Workers KV for 1h to avoid hammering Apple/Google.

export interface VerifyInput {
  jwt: string;
  jwksUrl: string;        // e.g. https://appleid.apple.com/auth/keys
  expectedIss: string | string[];
  expectedAud: string | string[];
  kvCache?: KVNamespace;  // optional KV for JWKS cache
}

export interface IdTokenClaims {
  sub: string;
  email?: string;
  email_verified?: boolean | string;
  name?: string;
  picture?: string;
  iss: string;
  aud: string;
  exp: number;
  iat: number;
  [k: string]: unknown;
}

interface Jwk { kid: string; kty: string; alg?: string; use?: string; n: string; e: string; }

export async function verifyIdToken(input: VerifyInput): Promise<IdTokenClaims> {
  const parts = input.jwt.split('.');
  if (parts.length !== 3) throw new Error('jwt: malformed');

  const header = JSON.parse(b64urlDecodeStr(parts[0])) as { alg: string; kid: string };
  if (header.alg !== 'RS256') throw new Error(`jwt: unsupported alg ${header.alg}`);

  const claims = JSON.parse(b64urlDecodeStr(parts[1])) as IdTokenClaims;
  const now = Math.floor(Date.now() / 1000);
  if (claims.exp < now - 30) throw new Error('jwt: expired');
  const issOk = Array.isArray(input.expectedIss) ? input.expectedIss.includes(claims.iss) : claims.iss === input.expectedIss;
  if (!issOk) throw new Error(`jwt: bad iss ${claims.iss}`);
  const audOk = Array.isArray(input.expectedAud) ? input.expectedAud.includes(claims.aud) : claims.aud === input.expectedAud;
  if (!audOk) throw new Error(`jwt: bad aud ${claims.aud}`);

  const jwk = await fetchJwk(input.jwksUrl, header.kid, input.kvCache);
  if (!jwk) throw new Error(`jwt: no key for kid ${header.kid}`);

  const key = await crypto.subtle.importKey(
    'jwk',
    { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );
  const sig = b64urlDecode(parts[2]);
  const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, sig, data);
  if (!ok) throw new Error('jwt: bad signature');

  return claims;
}

async function fetchJwk(url: string, kid: string, kv?: KVNamespace): Promise<Jwk | null> {
  const cacheKey = `jwks:${url}`;
  let body: string | null = null;
  if (kv) body = await kv.get(cacheKey);
  if (!body) {
    const r = await fetch(url, { cf: { cacheTtl: 3600 } as RequestInitCfProperties });
    if (!r.ok) throw new Error(`jwks: fetch ${url} failed ${r.status}`);
    body = await r.text();
    if (kv) await kv.put(cacheKey, body, { expirationTtl: 3600 });
  }
  const { keys } = JSON.parse(body) as { keys: Jwk[] };
  return keys.find((k) => k.kid === kid) ?? null;
}

function b64urlDecode(s: string): Uint8Array {
  const b = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b + '='.repeat((4 - (b.length % 4)) % 4);
  const bin = atob(pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function b64urlDecodeStr(s: string): string {
  return new TextDecoder().decode(b64urlDecode(s));
}

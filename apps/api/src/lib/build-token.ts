// Short-lived HMAC tokens for CI to authenticate against /builds/:id/*.
// Token = base64url(hmacSHA256(secret, `${buildId}:${exp}`)) || ":" || exp
// Exp ≤ 90 minutes (max iOS build time). One token per build.

const ALG = { name: 'HMAC', hash: 'SHA-256' };

async function key(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), ALG, false, ['sign', 'verify']);
}

function b64url(bytes: ArrayBuffer): string {
  const s = btoa(String.fromCharCode(...new Uint8Array(bytes)));
  return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(s: string): Uint8Array {
  const b = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b + '='.repeat((4 - (b.length % 4)) % 4);
  return Uint8Array.from(atob(pad), (c) => c.charCodeAt(0));
}

export async function mintBuildToken(secret: string, buildId: string, ttlSeconds = 90 * 60): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const k = await key(secret);
  const sig = await crypto.subtle.sign(ALG, k, new TextEncoder().encode(`${buildId}:${exp}`));
  return `${b64url(sig)}.${exp}`;
}

export async function verifyBuildToken(secret: string, buildId: string, token: string): Promise<boolean> {
  const [sigB64, expStr] = token.split('.');
  if (!sigB64 || !expStr) return false;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  const k = await key(secret);
  return crypto.subtle.verify(ALG, k, fromB64url(sigB64), new TextEncoder().encode(`${buildId}:${exp}`));
}

// Minimal Web Push implementation (RFC 8030 + RFC 8291 aes128gcm + RFC 8292 VAPID).
// Designed for Cloudflare Workers' Web Crypto. Zero deps.

export interface PushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };   // both base64url
}

export interface SendOptions {
  vapidPublicKey: string;       // base64url uncompressed P-256 (65 bytes)
  vapidPrivateKey: string;      // base64url 32-byte 'd' value
  vapidSubject: string;         // 'mailto:you@example.com' or https URL
  payload: string;              // JSON string, ≤ ~3 KB after encryption
  ttlSeconds?: number;          // default 86400
  urgency?: 'very-low' | 'low' | 'normal' | 'high';
}

export interface SendResult {
  ok: boolean;
  status: number;
  expired: boolean;     // 404/410 from push service → drop the subscription
  error?: string;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64urlToBytes(s: string): Uint8Array {
  const b = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b + '='.repeat((4 - (b.length % 4)) % 4);
  return Uint8Array.from(atob(pad), (c) => c.charCodeAt(0));
}

function bytesToB64url(b: ArrayBuffer | Uint8Array): string {
  const a = b instanceof Uint8Array ? b : new Uint8Array(b);
  let s = '';
  for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function concatBytes(...arrs: Uint8Array[]): Uint8Array {
  const total = arrs.reduce((n, a) => n + a.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrs) { out.set(a, offset); offset += a.byteLength; }
  return out;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const baseKey = await crypto.subtle.importKey('raw', ikm.buffer.slice(ikm.byteOffset, ikm.byteOffset + ikm.byteLength) as ArrayBuffer, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: salt.buffer.slice(salt.byteOffset, salt.byteOffset + salt.byteLength) as ArrayBuffer, info: info.buffer.slice(info.byteOffset, info.byteOffset + info.byteLength) as ArrayBuffer },
    baseKey,
    length * 8
  );
  return new Uint8Array(bits);
}

// Build a VAPID JWT (ES256) for the push service host.
async function vapidAuthHeader(endpoint: string, opts: SendOptions): Promise<string> {
  const aud = new URL(endpoint).origin;
  const exp = Math.floor(Date.now() / 1000) + 12 * 60 * 60;
  const header = { alg: 'ES256', typ: 'JWT' };
  const claims = { aud, exp, sub: opts.vapidSubject };
  const enc64 = (o: object) => bytesToB64url(enc.encode(JSON.stringify(o)));
  const signingInput = `${enc64(header)}.${enc64(claims)}`;

  const d = b64urlToBytes(opts.vapidPrivateKey);
  const pub = b64urlToBytes(opts.vapidPublicKey);
  if (pub.length !== 65 || pub[0] !== 0x04) throw new Error('vapid public key must be 65-byte uncompressed P-256');
  const x = pub.slice(1, 33);
  const y = pub.slice(33, 65);
  const jwk: JsonWebKey = { kty: 'EC', crv: 'P-256', x: bytesToB64url(x), y: bytesToB64url(y), d: bytesToB64url(d) };
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(signingInput)));
  // WebCrypto already returns a 64-byte raw r||s for ES256 — perfect for JWT.
  const jwt = `${signingInput}.${bytesToB64url(sig)}`;
  return `vapid t=${jwt}, k=${opts.vapidPublicKey}`;
}

// RFC 8291 aes128gcm content-coding.
async function encryptPayload(sub: PushSubscription, payload: Uint8Array): Promise<Uint8Array> {
  const ua_pub = b64urlToBytes(sub.keys.p256dh); // 65 bytes, recipient
  const auth   = b64urlToBytes(sub.keys.auth);   // 16 bytes
  if (ua_pub.length !== 65) throw new Error('subscription p256dh must be 65 bytes');

  // Generate ephemeral ECDH keypair for the server (single use per push).
  const eph = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const as_pub_raw = new Uint8Array(await crypto.subtle.exportKey('raw', eph.publicKey));

  // Import the recipient's public key for ECDH.
  const recipPub = await crypto.subtle.importKey('raw', ua_pub.buffer.slice(ua_pub.byteOffset, ua_pub.byteOffset + ua_pub.byteLength) as ArrayBuffer, { name: 'ECDH', namedCurve: 'P-256' }, true, []);
  const sharedBits = await crypto.subtle.deriveBits({ name: 'ECDH', public: recipPub }, eph.privateKey, 256);
  const ecdhSecret = new Uint8Array(sharedBits);

  // PRK_key = HKDF(auth, ecdhSecret, "WebPush: info" || 0x00 || ua_pub || as_pub, 32)
  const keyInfo = concatBytes(enc.encode('WebPush: info\0'), ua_pub, as_pub_raw);
  const ikm = await hkdf(auth, ecdhSecret, keyInfo, 32);

  // salt: random 16 bytes; record_size: 4096 (max single record); idlen: 65; keyid = as_pub
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);

  // Plaintext = payload || 0x02 (last record)  per aes128gcm.
  const pt = concatBytes(payload, new Uint8Array([0x02]));
  const aesKey = await crypto.subtle.importKey('raw', cek.buffer.slice(cek.byteOffset, cek.byteOffset + cek.byteLength) as ArrayBuffer, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce.buffer.slice(nonce.byteOffset, nonce.byteOffset + nonce.byteLength) as ArrayBuffer }, aesKey, pt.buffer.slice(pt.byteOffset, pt.byteOffset + pt.byteLength) as ArrayBuffer));

  // Header: salt(16) || rs(4 BE) || idlen(1) || keyid(idlen)
  const header = new Uint8Array(16 + 4 + 1 + 65);
  header.set(salt, 0);
  // record size (big-endian uint32)
  const rs = 4096;
  header[16] = (rs >>> 24) & 0xff;
  header[17] = (rs >>> 16) & 0xff;
  header[18] = (rs >>> 8)  & 0xff;
  header[19] =  rs         & 0xff;
  header[20] = 65;
  header.set(as_pub_raw, 21);

  return concatBytes(header, ct);
}

export async function sendPush(sub: PushSubscription, opts: SendOptions): Promise<SendResult> {
  const payload = enc.encode(opts.payload);
  if (payload.byteLength > 3072) return { ok: false, status: 0, expired: false, error: 'payload too large (>3 KB)' };

  const body = await encryptPayload(sub, payload);
  const auth = await vapidAuthHeader(sub.endpoint, opts);

  const r = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      'authorization': auth,
      'content-encoding': 'aes128gcm',
      'content-type': 'application/octet-stream',
      'ttl': String(opts.ttlSeconds ?? 86400),
      'urgency': opts.urgency ?? 'normal',
    },
    body: body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer,
  });
  return {
    ok: r.status >= 200 && r.status < 300,
    status: r.status,
    expired: r.status === 404 || r.status === 410,
    error: r.status >= 400 ? (await r.text().catch(() => '')).slice(0, 300) : undefined,
  };
}

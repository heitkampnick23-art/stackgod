// AES-GCM encryption for at-rest secrets (ASC .p8 keys, Play service-account JSON).
// Key comes from a Worker secret ENCRYPTION_KEY (base64-encoded 32 bytes).

let cachedKey: CryptoKey | null = null;

async function getKey(envKeyB64: string): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  const raw = Uint8Array.from(atob(envKeyB64), (c) => c.charCodeAt(0));
  if (raw.byteLength !== 32) throw new Error('ENCRYPTION_KEY must decode to 32 bytes');
  cachedKey = await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  return cachedKey;
}

/** Encrypt UTF-8 plaintext → base64(iv || ciphertext). */
export async function encryptString(envKeyB64: string, plaintext: string): Promise<string> {
  const key = await getKey(envKeyB64);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext)));
  const out = new Uint8Array(iv.byteLength + ct.byteLength);
  out.set(iv, 0);
  out.set(ct, iv.byteLength);
  return btoa(String.fromCharCode(...out));
}

/** Decrypt base64(iv || ciphertext) → UTF-8. */
export async function decryptString(envKeyB64: string, b64: string): Promise<string> {
  const key = await getKey(envKeyB64);
  const blob = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const iv = blob.slice(0, 12);
  const ct = blob.slice(12);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return new TextDecoder().decode(pt);
}

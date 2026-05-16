/** @type {import('next').NextConfig} */

// Security headers applied to every response. CSP intentionally deferred —
// Next's RSC streaming + inline hydration script would need nonce setup.
const securityHeaders = [
  { key: 'strict-transport-security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'x-content-type-options',    value: 'nosniff' },
  { key: 'x-frame-options',           value: 'SAMEORIGIN' },
  { key: 'referrer-policy',           value: 'strict-origin-when-cross-origin' },
  { key: 'permissions-policy',        value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
];

const nextConfig = {
  reactStrictMode: true,
  experimental: { reactCompiler: false },
  images: { unoptimized: true },
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
};
export default nextConfig;

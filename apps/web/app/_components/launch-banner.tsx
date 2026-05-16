// Launch-day banner — shows ONLY on Sun May 17, 2026 (UTC).
// Auto-hides at midnight Monday so we don't leave a stale "live today" forever.
// Server component (no JS, no hydration cost on every page view).

const LAUNCH_DAY_UTC = '2026-05-17'; // PH launch day. Banner shows for this UTC day only.

export default function LaunchBanner() {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== LAUNCH_DAY_UTC) return null;

  return (
    <a
      href="https://www.producthunt.com/products/stakgod"
      target="_blank"
      rel="noreferrer"
      className="block w-full bg-gradient-to-r from-flame via-orange-500 to-gold text-black font-bold text-sm py-2.5 text-center hover:brightness-110 transition relative z-[60] shadow-lg"
    >
      🚀 We&rsquo;re LIVE on Product Hunt today — your upvote means the world. Click here →
    </a>
  );
}

/**
 * Shared domain allowlist for all fetch proxies (INV-3).
 * Imported by both the Vite dev proxy and Vercel serverless proxy.
 * A single source of truth prevents dev/prod policy divergence.
 */
export const ALLOWED_DOMAINS = [
  'kakuyomu.jp',
  'dxmwx.org',
  'kanunu8.com',
  'kanunu.net',
  'novelcool.com',
  'ncode.syosetu.com',
  'booktoki468.com',
  'suttacentral.net',
  'hetushu.com',
  'hetubook.com',
];

export function isDomainAllowed(hostname: string): boolean {
  return ALLOWED_DOMAINS.some(
    (d) => hostname === d || hostname.endsWith('.' + d)
  );
}

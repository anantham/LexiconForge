/**
 * Browser-facing twin of allowedDomains.cjs — INV-3's third consumer.
 *
 * The canonical module is CommonJS ON PURPOSE (api/fetch-proxy.js must
 * require() it and Vercel's file tracing follows that require). But Vite
 * serves source .cjs to the BROWSER untransformed, where module.exports
 * means nothing — a named ESM import of it kills the whole app at boot
 * ("does not provide an export named …"; found 2026-07-26 when every route
 * rendered blank in dev). So browser code imports this ESM twin instead.
 *
 * Drift is impossible to ship silently: proxy-parity.test.ts asserts this
 * twin's list and matcher behavior are IDENTICAL to the canonical CJS on
 * every run. The client-side check is UX/early-fail only — the proxies
 * remain the enforcement boundary.
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
  'fojin.app',
  '84000.co',

];

export const isDomainAllowed = (hostname: string): boolean =>
  ALLOWED_DOMAINS.some((d) => hostname === d || hostname.endsWith('.' + d));

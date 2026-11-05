/**
 * Shared domain allowlist for the TWO in-repo fetch proxies (INV-3): the Vite dev
 * proxy (vite.config.ts) and the Vercel serverless function (api/fetch-proxy.js).
 * It is the single source of truth for THOSE two — automatic third-party CORS fallbacks are disabled. The direct
 * browser fetch contacts only the requested site.
 *
 * CommonJS on purpose: serverFetchProxy.cjs requires this file for both the API and dev server, while
 * vite.config.ts imports it through esbuild's CJS interop. That dual consumption is
 * the whole point — dev and prod cannot drift when they read the same array.
 *
 * proxy-parity.test.ts enforces the structure: both consumers must reference this
 * module and must NOT define their own ALLOWED_DOMAINS literal. Browser code
 * imports the guarded ESM twin allowedDomainsBrowser.ts instead (source .cjs is
 * unimportable in Vite dev); the same test pins the twin to this list.
 */
const ALLOWED_DOMAINS = [
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

function isDomainAllowed(hostname) {
  return ALLOWED_DOMAINS.some(
    (d) => hostname === d || hostname.endsWith('.' + d)
  );
}

module.exports = { ALLOWED_DOMAINS, isDomainAllowed };

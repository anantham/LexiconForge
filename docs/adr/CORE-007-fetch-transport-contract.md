# CORE-007: Fetch Transport Contract

**Date:** 2026-04-05
**Status:** Proposed
**Authors:** Opus (with Codex review input)
**Triggered by:** Security review of commits ae260fe–664e7a7 (proxy infrastructure, April 2026)

## Context

### What happened

Between April 3–5, 2026, three fetch proxy paths were added to solve CORS failures when
loading Chinese novel sites (hetushu, kanunu, etc.):

1. **Vercel serverless proxy** (`api/fetch-proxy.js`) — server-side HTTP fetch with domain allowlist
2. **Cloudflare Worker** (`lexiconforge-cors-proxy.workers.dev`) — edge proxy, no allowlist
3. **Playwright VPS** (`3-99-221-14.sslip.io/fetch-proxy`) — headless browser fetch, no allowlist

Additionally, a local dev proxy was added via Vite's `server.proxy` config.

Each was added incrementally to solve the immediate symptom ("site X is blocked") without a
shared contract for transport behavior, redirect safety, or site-specific routing.

### Problems identified

1. **SSRF via redirect following.** `api/fetch-proxy.js` validates the initial hostname against
   an allowlist, then follows redirects via recursive `fetchUrl()` without re-checking the
   destination hostname. A whitelisted domain that 302s to an internal/off-domain URL becomes
   an open proxy hop. The CF Worker and Playwright proxy have no allowlist at all.

2. **SuttaCentral misrouting.** The local-proxy-first path in `fetcher.ts` fetches raw HTML,
   then passes `async () => htmlString` into `SuttaCentralAdapter.fetchSutta()`. But
   SuttaCentral's adapter expects per-request JSON from SuttaCentral's API, not a pre-fetched
   HTML page. Every SuttaCentral request now takes a guaranteed failed local-proxy attempt
   before falling back to the CORS proxy path that actually works.

3. **Inconsistent TOC redirect handling.** The local proxy and CORS proxy paths call
   `adapter.getRedirectUrl()` to detect index/TOC pages and redirect to chapter 1. The
   Playwright fallback path skips this check — index pages that reach Playwright won't redirect.

4. **Dev/prod policy divergence.** The Vite dev proxy has no domain allowlist. The Vercel
   serverless proxy has one. "Works locally" is not a trustworthy signal for production safety.

5. **No contract tests.** None of the proxy paths have tests for redirect behavior, allowlist
   enforcement, or site-specific routing. Bugs can land without detection.

## Decision

### Invariants (must hold across ALL transport paths)

These invariants apply to every proxy: Vercel serverless, CF Worker, Playwright VPS, Vite dev
proxy, public CORS proxies, and direct fetch.

#### INV-1: Redirect re-validation

Every redirect hop MUST re-validate the destination against the allowlist before following it.
If the destination is not allowed, the request fails with a clear error — it does not follow
the redirect.

```
ALLOW:  hetushu.com → hetushu.com/book/123     (same domain)
ALLOW:  hetushu.com → www.hetushu.com/book/123  (subdomain of allowed)
DENY:   hetushu.com → evil.com/steal-creds      (off-allowlist)
DENY:   hetushu.com → 169.254.169.254/metadata  (SSRF to cloud metadata)
```

Implementation: the `fetchUrl` recursive call in `api/fetch-proxy.js` must check
`isDomainAllowed()` on the redirect URL before recursing. The CF Worker must add an
equivalent check. The Playwright VPS should validate the final URL after navigation.

#### INV-2: Site strategy selects transport

Not all sites should go through the same proxy path. The decision of which transport to use
belongs to the site adapter, not to a generic fallback chain.

| Site family | Transport | Why |
|-------------|-----------|-----|
| SuttaCentral | Direct API fetch (JSON) | Has a public API; HTML scraping is wrong |
| Chinese novel sites (hetushu, kanunu, dxmwx) | Proxy cascade (local → CF Worker → CORS → Playwright) | Blocked by CORS, some need JS rendering |
| Japanese sites (kakuyomu, syosetu) | Proxy cascade | CORS-blocked |
| NovelCool, BookToki | Proxy cascade | CORS-blocked |

SuttaCentral MUST bypass the HTML proxy path entirely and go directly to its API fetch path.
The current `fetcher.ts` structure (try local HTML proxy for everything, then fall back)
violates this — it should check the adapter type first.

#### INV-3: Dev/prod proxy parity

The Vite dev proxy and Vercel serverless proxy MUST enforce the same domain allowlist.
The allowlist is defined once (shared constant or config file) and imported by both.

If a request is allowed in dev but blocked in prod (or vice versa), that's a bug.

#### INV-4: TOC redirect consistency

If any transport path supports `adapter.getRedirectUrl()` for TOC/index page detection,
ALL transport paths must support it. The check happens after content is fetched and parsed,
before returning the result — regardless of which proxy delivered the HTML.

This means the Playwright fallback path must call `getRedirectUrl()` after parsing, same
as the local proxy and CORS proxy paths.

#### INV-5: Transport metadata

Every successful fetch returns a result that includes which transport was used:

```typescript
interface FetchResult {
  html: string;
  source: 'local-proxy' | 'cf-worker' | 'cors-proxy' | 'playwright' | 'direct';
  finalUrl: string;  // after redirects
  elapsed: number;   // ms
}
```

This enables debugging, telemetry, and transport-specific logic (e.g., charset handling
for kanunu via GBK).

### Non-goals

- **Generic FetchStrategy abstraction.** We have 4 site families. A strategy pattern is
  premature. When we hit 8+ sites with genuinely different transport needs, revisit.
- **Rate limiting on our proxies.** The CF Worker and Playwright VPS serve one user (us).
  Rate limiting is not needed until we have public users.
- **Caching layer.** Chapter content is cached in IndexedDB after first fetch. Adding a
  proxy-level cache adds complexity without clear benefit.

## Implementation Plan

### Phase 1: Contract tests (write first, expect failures)

Add tests that encode the invariants above. They should fail on current main.

```
tests/services/scraping/fetch-proxy.test.ts     — INV-1 (redirect re-validation)
tests/services/scraping/fetcher.contract.test.ts — INV-2 (SuttaCentral bypass), INV-4 (TOC consistency)
tests/services/scraping/proxy-parity.test.ts     — INV-3 (dev/prod allowlist match)
```

### Phase 2: Fix the bugs

1. `api/fetch-proxy.js` — add `isDomainAllowed()` check inside `fetchUrl()` before
   following redirects
2. `services/scraping/fetcher.ts` — skip local proxy for SuttaCentral (check adapter
   type before entering the proxy cascade)
3. `services/scraping/fetcher.ts` — add `getRedirectUrl()` check in the Playwright
   fallback path
4. CF Worker (`worker.js` on VPS) — add domain allowlist + redirect re-validation
5. Vite dev proxy — import shared allowlist

### Phase 3: Structural cleanup (optional, lower priority)

Extract transport selection into a `getTransportChain(url): Transport[]` function that
returns the ordered list of transports to try for a given URL. This separates "which
transports to try" from "how to execute each transport" without over-abstracting.

## Consequences

- SuttaCentral requests will no longer waste time on a guaranteed-failing HTML proxy attempt
- Redirect-based SSRF is closed across all proxy paths
- TOC pages work consistently regardless of which proxy serves them
- Dev testing is a reliable signal for prod behavior
- Future proxy additions have clear invariants to satisfy

## Test plan

Each invariant maps to at least one test:

| Invariant | Test | Assertion |
|-----------|------|-----------|
| INV-1 | Redirect to off-allowlist domain | Returns error, does not follow |
| INV-1 | Redirect to SSRF target (169.254.x.x) | Returns error |
| INV-2 | SuttaCentral URL | Skips HTML proxy, uses API path |
| INV-3 | Allowlist in dev proxy | Matches prod allowlist exactly |
| INV-4 | TOC URL via Playwright path | Calls getRedirectUrl(), follows redirect |
| INV-5 | Any successful fetch | Result includes source + finalUrl |

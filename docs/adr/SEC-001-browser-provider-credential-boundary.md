# SEC-001: Browser Provider Credential Boundary

**Date:** 2026-08-13
**Status:** Implemented
**Group:** security / deployment
**Authors:** Codex with Aditya as operator

## Issue

LexiconForge is a static Vite application, but provider credentials had three browser pathways: user Settings, build-time environment fallbacks, and a shared OpenRouter trial key. `vite.config.ts` serialized six operator credentials into client JavaScript. A client-side request counter could pace the UI but could not prevent a visitor from extracting and using the shared key directly.

This created two failures of the product contract:

1. A deployment could expose operator-funded credentials to every visitor.
2. Similar provider calls resolved credentials through different pathways, so deleting or rotating one source did not reliably remove access.

## Decision

Browser provider calls have one credential source: the current user's browser-local Settings value, resolved through `services/ai/providerCredentials.ts`.

The following invariants apply:

1. Provider credentials must not be read from `import.meta.env`, `process.env`, Vite `define`, or deployment build variables in browser code.
2. The static client does not contain a shared trial or operator-owned provider key.
3. Node-only benchmark and curation scripts may read `process.env.OPENROUTER_API_KEY`; those scripts are not imported by the browser application.
4. Release CI builds with synthetic canaries and scans `dist/`. A matching canary or provider-shaped credential fails the release.
5. Removing a Settings credential must prevent new provider clients from retaining or reacquiring it through another source.
6. Shared or subsidized access requires a separately reviewed, authenticated server-side broker with authorization, per-user rate limits, and fail-closed spend caps.

## Positions Considered

### A. Keep Shared Keys in Vite with Quotas

- Impact: preserves keyless trial UX.
- Effort: low.
- Risk: unacceptable; a downloadable key bypasses all client controls.
- Reversibility: easy technically, expensive after abuse.
- Decision: rejected.

### B. Settings-Only BYOK

- Impact: removes keyless trial UX and the operator-spend exposure.
- Effort: moderate because all live provider paths and documentation must converge.
- Risk: users must obtain and manage their own provider credentials; browser-local keys remain exposed to code executing in that browser.
- Reversibility: high.
- Decision: selected for the current static application.

### C. Authenticated Server-Side Broker

- Impact: can support shared credits without exposing provider credentials.
- Effort: high; requires identity, authorization, abuse controls, accounting, observability, and operations.
- Risk: creates a new security and billing boundary.
- Reversibility: moderate.
- Decision: deferred until shared funded access is an explicit product requirement.

## Assumptions and Constraints

- The deployed application remains a public static client.
- Users understand that requests and their content go to the provider they select.
- Browser-local storage is not a hardware-backed secret store; XSS remains a separate lower-severity risk.
- No other product depends on the removed operator credentials or shared trial key.

## Consequences

- Visitors without a configured key receive an actionable Settings error instead of a hidden fallback.
- Deployment operators must keep provider credentials out of Vercel and equivalent client build environments.
- Existing exposed keys must be revoked at each provider and replaced only for non-browser uses that still need them.
- A clean production deployment must replace the active aliases; historical immutable deployment URLs remain harmless only after their embedded credentials are revoked.
- The artifact scanner becomes a release gate, not an advisory script.

## Implementation Notes

- `services/ai/providerCredentials.ts` is the browser credential resolver.
- `vite.config.ts` no longer loads or defines provider environment values.
- `services/defaultApiKeyService.ts` and `components/DefaultKeyBanner.tsx` were removed.
- `scripts/security/scan-client-secrets.mjs` and `.github/workflows/test.yml` enforce the artifact boundary with pattern checks and build canaries.
- `docs/guides/EnvVars.md` and `docs/guides/DEPLOYMENT.md` define the operator contract.

## Verification

- Unit tests cover settings-only resolution, the browser/Node environment boundary, missing-key failure, Settings UI coverage, scanner detection, and stale in-memory audio credential removal.
- The production build is run with synthetic values in every legacy provider environment variable.
- `npm run security:scan-client` must report no provider-key patterns and no synthetic canaries.

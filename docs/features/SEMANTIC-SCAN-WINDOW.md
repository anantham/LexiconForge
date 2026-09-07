# Private semantic scan window

The public reader keeps its URL and library. Scan opens one owner-origin page
that uses existing same-origin owner/CSRF controls and returns a scalar graph.
The former cross-site POST could not carry the paired Strict cookie.

- `semanticScanWindow.ts` owns the synchronous popup, exact origin/window checks,
  30-second connection and 5-minute scan deadlines, cancellation and cleanup.
  Closure is detected on reader focus or deadline; no polling or retry is added.
- `semanticScanProtocol.ts` strictly bounds and validates JSON messages, corpus,
  query and scores. The owner vendors the dependency-free module byte-for-byte.
- `semanticOscilloscopeClient.ts` now exposes a direct capability function:
  deleting its single-method class fixes native fetch's Illegal invocation.
  Capability must advertise `scanTransport: lf-owner-scan-v1` before Scan is
  offered. Legacy readiness and contradictory index readiness are rejected in
  the same request; no second probe or retry is added.
- The capability hook and ThreadSelector discard stale selections, close cancelled
  windows and surface connection failures. Unused refresh state/exports are deleted.

Node 24.19.0: 90 focused tests, typecheck/build and four desktop/Pixel production
browser regressions pass. Two tool-free Claude Sonnet 5 reviews approved the
exact source. Scoped lint: zero errors, one selection-reset effect warning.
Wire line coverage: 86.52% overall; 95.23% transport and 90.62% protocol.
Actual owner/CSRF middleware plus a synthetic two-chapter index/service passed
scan, export and native offline file reopen. Initial round trips: 115/120 ms;
these are local transport observations, not model benchmarks. Owner JS is about
7.3 KB (3.3 KB gzip). Run `npm run test:e2e -- tests/e2e/semantic-session.spec.ts`.

No backend publication/deployment is included. Complete corpus, exact release
scope, real-model latency, physical popup/local-network permission, Safari file
reopen and cold offline launch remain in the [acceptance checklist](../roadmaps/SEMANTIC-OSCILLOSCOPE-ACCEPTANCE.md).
FEAT-006 remains Accepted. Reader implementation: [PR #177](https://github.com/anantham/LexiconForge/pull/177), targeted to main after #160 and the chapter/coverage consolidation.

September 7 compatibility correction: 35 focused Node 24.19.0 tests, types,
production build and 12 desktop/Pixel browser cases pass. Missing backend,
owner rejection, unbuilt window and legacy readiness keep reading and frozen
custom-track export available while hiding Scan. The matching local backend
returns HTTP 503 before model probing when its fixed window artifact is absent;
its publication and deployment remain separate acceptance work.

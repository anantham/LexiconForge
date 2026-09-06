# Private semantic scan window

The public reader keeps its URL and local library. Selecting Scan opens a small
owner-origin page, which makes one fixed semantic request using its existing
same-origin owner and CSRF controls. Only a validated scalar result returns to
the reader; browser proof stays in the owner window.

The former cross-site POST omitted the paired Strict cookie and could not work.
The replacement does not weaken cookies, frame the private service, distribute
a credential or introduce a generic request proxy. Capability remains an
owner-authorized, read-only check of the exact corpus identity.

## Implementation and failure behavior

- `services/semanticOscilloscopeClient.ts` provides a direct capability function.
  Deleting its former single-method class fixes native browser fetch receiver
  errors that mocked requests missed. The configured URL must be an origin.
- `services/semanticScanWindow.ts` opens synchronously in the Scan gesture and
  owns the request, exact origin/window checks, deadlines and cleanup.
- `services/semanticScanProtocol.ts` validates the bounded JSON wire contract.
  The owner implementation vendors this dependency-free module byte-for-byte.
  No runtime package or automatic synchronization service is needed.
- `hooks/useSemanticOscilloscopeCapability.ts` cancels work on corpus/endpoint
  changes or unmount. `ThreadSelector.tsx` discards late submissions and exposes
  explicit cancellation. Unused refresh state and the obsolete scan POST are deleted.

Each window accepts one request. Unknown/duplicate messages, stale IDs, wrong
corpora, extra fields and invalid scores fail closed. Connection deadline: 30 s;
scan deadline: 5 min. No request retries are added. Closure is noticed when the
reader regains focus or its deadline expires; there is no polling timer. Reader
navigation, cancellation and deadlines close the popup; page teardown aborts its
fetch. Already-running model inference may continue remotely after cancellation.

The fixed owner page is `/api/lexiconforge/semantic-oscilloscope/owner-window`.
A compatible owner deployment must build its standalone entry, preserve the
opener relationship and allow exactly this reader origin. Preview origins are
not admitted by the production owner page. Missing access, blocked popups or
incompatible isolation headers produce a visible connection failure.

## Evidence and limits — 2026-09-06

Node 24.19.0: 90 focused reader tests, TypeScript and production build pass.
All four desktop/Pixel browser regressions pass. Scoped lint has zero errors
and one warning for the intentional selection-reset effect. Wire line coverage
is 86.52% overall (95.23% transport, 90.62% protocol); no baseline coverage
comparison is claimed for this new transport.
Independent tool-free Claude Sonnet 5 review approved the initial implementation;
the final direct-fetch/deletion correction also received APPROVE, with no blockers.
The separate owner gate passes 95 Python tests and 12 UI/CSRF helper tests using
an isolated exact-lockfile installation, TypeScript and production build.

Actual Chromium 141 and Pixel 7 emulation exercised the production reader,
standalone owner page, real owner/CSRF middleware and scoring service with a
synthetic two-chapter index. One capability GET, one proof bootstrap and one
scan POST produced the graph, which exported and reopened through native file
upload offline. Book invalidation passed. Initial synthetic round trips were
115 ms desktop / 120 ms Pixel; these are local transport observations, not real
model or full-novel latency. The owner entry loads about 7.3 KB JS (3.3 KB gzip),
not the 1.2 MB dashboard. Chrome required local-network permission in the
disposable profile; a before/after probe returned failure then HTTP 200.

`tests/e2e/semantic-session.spec.ts` retains the URL/export/offline/translation
regression and adds a native-fetch + real-popup wire fixture for repeatable
reader QA. Its fake owner page is explicitly synthetic and does not substitute
for backend authorization checks. Run with `npm run test:e2e --
tests/e2e/semantic-session.spec.ts` on the pinned Node/browser installation.

No private backend is published or deployed by this reader PR. Full-corpus
publication, exact deployment scope, real model latency, Safari native-file
reopening, physical-device popup/local-network behavior and cold offline launch
remain in the [acceptance checklist](../roadmaps/SEMANTIC-OSCILLOSCOPE-ACCEPTANCE.md).
FEAT-006 remains Accepted.

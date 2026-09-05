# FEAT-006 — Private Semantic Narrative Oscilloscope

**Status:** Accepted — implementation split across stacked PRs; deployment and full-book index pending
**Date:** 2026-08-24
**Group:** Integration / navigation / local AI

## Issue

The narrative oscilloscope draws scalar chapter tracks for long books, but its
Custom tab was a disconnected lexical-search stub. Running embeddings in the
static browser client would ship a model and a large vector index to every
reader. A generic private health check would also be unsafe: a reachable server
might hold an index for a different book or version and return plausible but
false navigation data.

The product has two trust modes:

1. On the operator's Tailnet devices, `https://read.adityaarpitha.com` may use
   Asus-hosted IndrasNet and shared owned embedding compute for concepts entered
   while reading.
2. Other readers may load frozen scalar tracks from a portable session, but
   receive no custom-query input or private-service configuration.

## Assumptions and constraints

- LexiconForge remains a static client with no public application backend.
- IndrasNet owner/Tailnet authorization remains authoritative; CORS is not auth.
- Portable artifacts may contain scores and scoring provenance, never vectors,
  chunks, private endpoints, credentials, or transport fields.
- A custom scan must address the exact selected chapter text currently loaded.
- Per-query max normalization is forbidden because it makes weak concepts look
  maximally present and prevents comparisons between tracks.
- The first scoring method is an inspectable baseline, not a calibrated measure
  of an abstract narrative category such as romance.

## Positions considered

### A. IndrasNet returns the finished graph — selected

The browser sends a corpus identity and query. IndrasNet embeds the query,
searches an immutable local index, and returns one scalar per chapter.

- **Impact:** High; live semantic navigation without turning the public app into
  a backend deployment.
- **Effort/time:** Medium; two narrow contracts and one operator index build.
- **Risk:** Medium; identity drift and private-service availability fail closed.
- **Reversibility:** High; removing the adapter leaves portable tracks usable.
- **Confidence:** 0.89 before implementation.

### B. IndrasNet sends corpus embeddings to the browser

- **Impact:** Similar visible result.
- **Effort/time:** Medium-high due to browser search, storage, and validation.
- **Risk:** High because reusable corpus representations cross the boundary.
- **Reversibility:** Medium because runtime/session formats would learn vectors.
- **Confidence:** 0.45 that the added exposure is justified.

### C. Browser embeds the book with WebGPU/WASM

- **Impact:** Could support custom scans without the Tailnet.
- **Effort/time:** High due to model distribution, caching, and device variance.
- **Risk:** High multi-gigabyte public-device burden.
- **Reversibility:** Medium.
- **Confidence:** 0.55 as a future optional mode, not this decision.

## Decision

Adopt Option A with a versioned, fail-closed session protocol.

### Canonical corpus identity

LexiconForge and IndrasNet independently derive `corpusId`, `versionId`,
`chapterCount`, and `contentHash`. The hash is SHA-256 over canonical contiguous
chapters after selecting the active translation, latest translation, fan
translation, or source content in that order. Text is NFC-normalized and line
endings are normalized. A shared known-answer test pins both implementations.

### Capability before input

The custom input is shown only when IndrasNet reports `ready=true` for the exact
four-field corpus identity and supported protocol/vector space. Missing network,
wrong index, invalid URL, unavailable model, malformed JSON, or identity mismatch
leaves only frozen tracks visible.

### Finished scalar response

The browser validates protocol, corpus identity, query echo, exact score count,
finiteness, and declared bounds. It registers returned values unchanged. Each
track records query, time, vector-space version, dimensions, score semantics,
aggregation method, range, and corpus identity.

### Portable session tracks

Session v2 gains an optional `oscilloscope` object with format/version, corpus
identity, scalar threads, and active IDs. Serialization rebuilds every object
from a public allowlist. Import recomputes corpus identity before accepting the
tracks and rejects malformed active IDs, provenance, ranges, or values. Invalid
graph data is logged and dropped while the book remains readable.

## Consequences

- Public readers can navigate frozen semantic tracks without learning the
  private service URL or receiving vectors.
- A changed selected translation invalidates the graph and requires a rebuild.
- Private availability depends on Tailnet reachability, owner auth, exact CORS,
  a matching immutable index, and the advertised embedding model.
- Full-book index build, scan latency, export, and offline re-import remain live
  acceptance gates; source tests alone do not establish deployment.

## Implementation notes

- Session/corpus contract: `services/semanticOscilloscopeSession.ts`
- Portable types: `types/oscilloscope.ts`, `types/session.ts`
- Later stacked slices add the private HTTP adapter, capability UI, store
  registration, full import/export persistence, and legacy fallback scoping.
- Owned-compute implementation is governed by TemporalCoordination ADR-071.

Mark this ADR `Implemented` only after both source stacks are merged and a real
owner Tailnet device passes capability, one full-book scan, freeze/export, and
offline re-import.


## Implementation review amendment — 2026-09-05

PR #159 is merged; PR #160 supplies the remaining portable import/export and
book-switch integration. Status remains **Accepted**, pending live acceptance.

Implementation notes:
- `services/semanticOscilloscopeExport.ts` verifies the original graph corpus
  against export text; optional graph failures preserve readable partial exports.
- `store/bootstrap/importSessionData.ts` and `services/importService.ts` validate
  portable tracks, preserve reader availability, and honor registry/session scope.
- `services/db/operations/export.ts` and `store/slices/exportSlice.ts` preserve
  per-chapter novel/version identity through full offline exports.
- `store/slices/{uiSlice,chaptersSlice}.ts` reset graphs across books and selected
  text changes. Image-only changes do not invalidate a graph.
- `components/oscilloscope/OscilloscopePanel.tsx` and
  `components/oscilloscope/loadOscilloscopeData.ts` restrict legacy data to FMoC and discard obsolete downloads.
- `services/semanticOscilloscopeCache.ts` retains frozen scalar graphs on book
  departure and verifies loaded text before cached reopening. Full backups hash
  only the graph's corpus while preserving chapters from other books/versions.
- Focused contracts plus `tests/e2e/semantic-session.spec.ts` cover synthetic
  IndexedDB export/offline reimport, visible text, graph rendering and invalidation.

TemporalCoordination #345/#346 were closed unmerged. Their recovery, exact deployed
versions, complete index, real scan, latency and owner-device acceptance remain
tracked in `docs/roadmaps/SEMANTIC-OSCILLOSCOPE-ACCEPTANCE.md`. Source/fixture tests
are not live acceptance and do not justify marking this ADR Implemented.

### Review corrections — 2026-09-05

- Portable session import hoists the nested novel/version scope before storage.
  Portable builders query only the selected corpus and serialize base chapter IDs
  so the receiving library can apply its own scope. A fork with a new version ID
  does not inherit a graph bound to the parent identity.
- A default library selection is nullable even when its frozen graph names a
  concrete version. The departure cache is keyed by that reader selection; its
  graph is accepted only after recomputing the selected chapter hash. Full backups
  preserve all books and carry `oscilloscopeLibraryVersionId` alongside the graph
  to retain this nullable selection. Older backups without that field use the
  graph's version ID. The portable scalar graph protocol itself is unchanged.
- `services/db/operations/rendering.ts` reuses the existing null-safe chapter
  query. It no longer treats a failed scope query as an empty library.
- Chapter insertion/deletion/clearing invalidates affected graphs. An import that
  finishes after a new book is selected may persist its data but cannot replace
  the current reader.
- `tests/services/semanticOscilloscopeLifecycle.test.ts` exercises actual import,
  IndexedDB, hydration, export and cache boundaries; synthetic rendering mocks
  cannot supply a version scope that persistence failed to save.

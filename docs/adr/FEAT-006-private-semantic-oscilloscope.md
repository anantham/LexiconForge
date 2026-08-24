# FEAT-006 — Private Semantic Narrative Oscilloscope

**Status:** Accepted — implementation in review; deployment and full-book index pending
**Date:** 2026-08-24
**Group:** Integration / navigation / local AI

## Issue

The narrative oscilloscope draws scalar chapter tracks for long books, but its
Custom tab was a disconnected lexical-search stub that always returned an empty
track. Running embeddings in the static browser client would require shipping a
model and a large vector index to every reader. Calling a generic private health
endpoint would be unsafe because a reachable server might hold an index for a
different book or version and return plausible-looking but false navigation data.

The product has two intended modes:

1. On the operator's Tailnet devices, `https://read.adityaarpitha.com` may use
   the Asus IndrasNet service and shared owned embedding compute for new semantic
   concepts entered at reading time.
2. Other readers receive frozen scalar tracks inside the portable session and
   have no custom-query input or dependency on the private service.

## Assumptions and constraints

- LexiconForge remains a static client. It gains no public application backend.
- IndrasNet's existing owner/Tailnet authorization remains authoritative; CORS
  only permits the production browser origin and is not authentication.
- Session artifacts may contain scores and transparent model/scoring provenance,
  but never passage embeddings, source chunks, private endpoints, or credentials.
- A custom scan must target the exact selected chapter text a reader has open.
- Scores from different queries must not be independently max-normalized, because
  that makes a weak concept look maximally present and prevents comparison.
- The first scoring method is an inspectable baseline, not a calibrated estimator
  of an abstract narrative category such as romance.

## Positions considered

### A. IndrasNet returns the finished graph — selected

The browser sends a corpus identity and custom concept. IndrasNet embeds the
query, searches its immutable local index, and returns one scalar per chapter.

- **Impact:** High; delivers live semantic navigation while preserving a static
  public app.
- **Effort/time:** Medium; two narrow contracts plus an operator index build.
- **Risk:** Medium; cross-language identity drift and private-service availability
  are the main failure modes, both fail-closed and test-pinned.
- **Reversibility:** High; remove the adapter/UI gate and portable tracks still
  render.
- **Confidence:** 0.89 before implementation; 0.94 after focused contract tests.

### B. IndrasNet sends corpus embeddings to the browser

- **Impact:** Similar visible result.
- **Effort/time:** Medium-high; browser vector search, storage, and validation.
- **Risk:** High; exposes reusable corpus representations and increases memory and
  transfer cost.
- **Reversibility:** Medium because session/runtime formats would learn vectors.
- **Confidence:** 0.45 that any benefit justifies the boundary cost.

### C. Browser embeds the book with WebGPU/WASM

- **Impact:** Custom scans could work without the Tailnet.
- **Effort/time:** High; model distribution, caching, device compatibility, and
  performance UX.
- **Risk:** High; multi-gigabyte public-device burden and inconsistent results.
- **Reversibility:** Medium.
- **Confidence:** 0.55 as a future optional mode, not the current design.

## Decision

Implement Option A with two explicit seams.

### 1. Canonical corpus identity

LexiconForge and IndrasNet independently derive:

- `corpusId`
- `versionId`
- `chapterCount`
- `contentHash`

The hash is SHA-256 over canonical, contiguous chapters after selecting the active
translation, then latest translation, then fan translation, then source content.
Line endings are normalized and text is NFC-normalized. A shared known-answer test
pins the TypeScript and Python algorithms to the same digest.

### 2. Capability before input

The Custom category/input is not rendered unless IndrasNet reports `ready=true`
for the exact four-field corpus identity and supported protocol. Missing network,
wrong index, invalid URL, unavailable Ollama, malformed JSON, and version/hash
mismatch all leave only frozen tracks visible.

### 3. Finished scalar response

The browser validates protocol, corpus identity, query echo, exact score count,
finiteness, and `[0, 1]` bounds. It registers the returned values unchanged; it
does not divide by that query's maximum. The thread records query, timestamp,
vector-space version, dimensions, score semantics, and aggregation provenance.

### 4. Portable session tracks

Session v2 gains an optional `oscilloscope` object with a versioned format,
corpus identity, scalar `ThreadData[]`, and active IDs. Import recomputes the
corpus identity before accepting tracks. Stale or malformed graph data is logged
and dropped while the book remains readable. Export recomputes identity from the
current chapters and omits incompatible stale tracks.

### 5. Honest book scoping

The old panel unconditionally loaded a 3,457-chapter FMoC analysis whenever any
reader lacked oscilloscope state. That could display FMoC romance/combat tracks
while Dungeon Defense or another book was open. The legacy public fallback now
loads only for `forty-millenniums-of-cultivation`; all session-provided graphs are
bound to their own corpus hash.

## Consequences

- The private feature behaves like the SillyTavern portal in availability shape,
  but with a stronger book/version capability check.
- Public readers can navigate precomputed and frozen semantic tracks without ever
  learning the private service URL or receiving vectors.
- A changed translation invalidates the old graph and requires an index rebuild.
- Initial scan availability depends on the Asus server, Tailnet path, exact CORS
  origin, owner authentication, matching index, and embedding service.
- The full-book index build and live Tailnet latency remain deployment gates; code
  tests do not establish either.

## Implementation notes

- Portable corpus/session contract: `services/semanticOscilloscopeSession.ts`
- Store-aware export adapter: `services/semanticOscilloscopeExport.ts`
- Private HTTP adapter: `services/semanticOscilloscopeClient.ts`
- Capability lifecycle: `hooks/useSemanticOscilloscopeCapability.ts`
- Input gate: `components/oscilloscope/ThreadSelector.tsx`
- Store and unchanged-score registration: `store/slices/oscilloscopeSlice.ts`
- Import/export persistence: `store/bootstrap/importSessionData.ts`,
  `store/slices/exportSlice.ts`, `services/exportService.ts`
- Legacy fallback scoping: `components/oscilloscope/OscilloscopePanel.tsx`
- Focused tests: `services/semanticOscilloscopeSession.test.ts`,
  `services/semanticOscilloscopeClient.test.ts`,
  `tests/store/oscilloscopeSemantic.test.ts`, and
  `tests/components/oscilloscope/ThreadSelector.semantic.test.tsx`

The corresponding owned-compute decision is TemporalCoordination ADR-071. Mark
this ADR `Implemented` only after the source PR is merged and a real Tailnet device
passes capability, one full-book scan, freeze/export, and offline re-import.

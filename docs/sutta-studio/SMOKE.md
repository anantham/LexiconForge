# Sutta Studio — Real-LLM Smoke

The Sutta Studio pipeline integrates with OpenRouter at compile time, so
unit tests can't catch regressions that only manifest end-to-end —
prompt-template drift, provider routing, post-pass attachment, IDB
schema changes, etc.

This is the one repeatable, paid smoke that catches them.

## What it verifies

[`tests/e2e/sutta-studio-grounding-smoke.spec.ts`](../../tests/e2e/sutta-studio-grounding-smoke.spec.ts):

1. **Eudoxos Vism citations reach the live pipeline** (PR #57 / GROUNDING
   Phase 4). After compile, the packet's `citations[]` contains at least
   one URL matching `edhamma.github.io` *or* an id starting with
   `cite:vism`. If this fails, the `CommentarialGlossProvider` is not
   being wired by `buildDefaultProviders()`, or the grounding pass is
   not attaching its citations to the packet.

2. **Segment cache persists across reloads** (PR #56). After the first
   compile the IndexedDB `segment_cache` store has >0 entries; after a
   page reload, the cache module logs `[SegmentCache] Loaded N/N
   entries` with `N>0`. If this fails, the DB migration or fire-and-
   forget persistence path has regressed.

Both assertions are made directly against the compiled packet (via the
`window.__APP_STORE__` debug surface) and IndexedDB, not against DOM
chip selectors — so it survives reader UI refactors.

## How to run

**Prerequisites** (one-time):

```bash
npm install
npx playwright install chromium
export OPENROUTER_API_KEY=sk-or-v1-...   # required for the LLM calls
```

**Run** (each time you want to verify):

```bash
npm run smoke:sutta-studio
```

That npm script sets `RUN_GROUNDING_SMOKE=1` and points Playwright at
the one spec. The default `npm run test:e2e` will *skip* this spec
because both env vars must be present — this is deliberate: it stops
the paid run from firing by accident in CI or in a developer's regular
e2e loop.

## Expected output

```
Running 1 test using 1 worker

  ✓ tests/e2e/sutta-studio-grounding-smoke.spec.ts:42:3 › Sutta Studio grounding smoke › MN10 phaseLimit=4 produces Vism citations and persists the cache (~3m 30s)

[smoke] packet citations: { total: 18, eudoxosUrls: [...], vismIds: [...] }
[smoke] segment_cache count after first compile: 32
[smoke] segment_cache load log: [SegmentCache] Loaded 32/32 entries (current version)

  1 passed (3m 35s)
```

Wall time: **~3–6 minutes**. Cost: **~$0.15** on OpenRouter's
`google/gemini-3-flash-preview` (the project's current
`SuttaStudioCompiler` override).

## When it should fail

- After any change to `services/sutta-studio/grounding/index.ts`
  (provider composition)
- After any change to `services/suttaStudioPipelineCache.ts`
  (cache schema / persistence)
- After a prompt-version bump in `services/suttaStudioPromptVersion.ts`
  (cache should self-invalidate; the cache-load count assertion verifies
  this — a freshly-bumped version should load 0 entries on first run,
  then >0 on the second)
- After any change to `services/compiler/index.ts` that affects how
  citations attach to the packet

## When NOT to run

- In CI without an explicit budget for paid LLM calls
- When upstream OpenRouter / SuttaCentral is having an outage (the test
  is real-network end-to-end; flakes will reflect upstream state)
- During a model rotation (Gemini Flash availability has historically
  been bursty; the cost-of-run is concentrated in the one test, so an
  upstream 429 wastes the whole run)

## Cost ceiling

If you accidentally drop `phaseLimit=4` from the spec (e.g. test the
full MN10), you'd pay ~$1.50 per run for MN10's ~39 phases. The
`phaseLimit=4` ceiling exists precisely so this smoke stays cheap and
repeatable; don't remove it without writing a separate "full compile"
smoke with its own runbook.

## Adjacent smokes

`tests/e2e/fojin-sutta-studio.spec.ts` and
`tests/e2e/fojin-sutta-studio-m2.spec.ts` are the *mocked* multi-source
studio smokes — fast, free, deterministic. They cover the FoJin /
84000 / fallback paths but not the Pāli grounding pipeline, which is
what this paid smoke is for.

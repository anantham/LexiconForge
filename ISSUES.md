1) epub of raw, fan and selected translation

2) FAQ for features, getting API keys, contacting for support

3) fan translation scrape

4) extend comparison between translations

5) test coverage - Coverage Gaps

  - docs/TEST_MANIFEST.md:1-74 still lists many suites as ❓ Unknown—especially the provider/IndexedDB adapters and EPUB pipeline tests—so those areas
    haven’t been exercised against the current architecture yet. Bringing them up to date would catch regressions in schema v11 and the rebuilt export
    flow.
  - The entire tests/epub/*.test.ts band (docs/TEST_MANIFEST.md:41-58) is stale; given how much EPUB generation changed with the prompt overhauls,
    fresh fixtures plus regression checks on services/epubService.ts would add real signal.
  - Hooks like tests/hooks/usePersistentState.test.tsx and tests/hooks/useTextSelection.test.tsx (docs/TEST_MANIFEST.md:59-66) were written for the
    pre-split store; they should be rerun or rewritten so UI behaviours (emoji toolbar, storage sync) stay honest.
  - Integration around the new comparison workflow has zero coverage—no occurrences of comparisonService in tests/—so adding slice- or service-level
    specs for the fan translation alignment path (services/comparisonService.ts, store/slices/translationsSlice.ts) would be a big win.
  - Recent diagnostic logging and image-generation changes (services/imageGenerationService.ts, store/slices/imageSlice.ts) likewise lack direct
    tests; even a lightweight smoke test of the logging toggles would keep the pipelines from regressing silently.

  If you want to prioritize, I’d start with the Unknown EPUB suites and the comparison service since those features are user-facing and currently
  unchecked.

6) website

7) customize emojis in toolbar

8) WORKLOG.md rotation/archiving - Consider adding automatic log cycling when docs/WORKLOG.md grows too large (currently 25KB/273 lines). Could archive entries older than 3 months to dated files like docs/archive/WORKLOG-YYYY-QN.md to keep the main log manageable. 
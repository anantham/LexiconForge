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

9) Image Version Navigation System [WIP - Commit 3745195]

   **Problem:** Regenerating images (retry/img2img/LoRA) overwrites cache but UI shows old image. Users want to compare multiple generated versions.

   **Status:** Core infrastructure complete (version tracking, cache storage, state management, navigation functions). UI integration and service wiring pending.

   **Roadmap:**

   Phase 1: Service Integration ⏳
   - [ ] Update ImageGenerationContext type to include nextVersion field (services/imageGenerationService.ts:~15)
   - [ ] Modify imageService.ts generateImage() to accept and pass version to ImageCacheStore.storeImage() (services/imageService.ts:~475-495)
   - [ ] Update initial generation in ImageGenerationService to set version=1 for new images (services/imageGenerationService.ts:~150-180)
   - [ ] Test: Verify version increments correctly on retry and cache entries don't overwrite

   Phase 2: UI Components 📱
   - [ ] Add version navigation controls to Illustration component:
         * < > buttons to navigate between versions
         * Display "Version X of Y" counter
         * Disable < on first version, disable > on latest version
         * Style to match existing image controls aesthetic
   - [ ] Wire up buttons to imageSlice.navigateToNextVersion/navigateToPreviousVersion
   - [ ] Use imageSlice.getVersionInfo to populate counter and button states
   - [ ] Update imageCacheKey prop passed to useBlobUrl to use activeImageVersion

   Phase 3: Edge Cases & Polish 🔍
   - [ ] Handle navigation away and back: ensure activeImageVersion persists or resets to latest
   - [ ] Test scenarios:
         * Generate image → retry with different prompt → navigate < >
         * Change LoRA model → retry → verify new version created
         * img2img with steering image → retry → compare versions
         * Navigate to different chapter → return → verify version state
   - [ ] IndexedDB persistence: decide if we persist activeImageVersion or always default to latest
   - [ ] Cache cleanup strategy: keep last N versions per illustration? (optional, future enhancement)

   Phase 4: User Experience Enhancements (Optional) ✨
   - [ ] Version metadata: store prompt/settings used for each version alongside image
   - [ ] Version comparison view: show 2-3 versions side-by-side in modal
   - [ ] Delete specific version: allow user to remove unwanted versions
   - [ ] Version labels: let users name/tag versions (e.g., "with LoRA", "darker mood")
   - [ ] Keyboard shortcuts: arrow keys to navigate versions when image focused

   **Files Modified (Phase 1 complete):**
   - ✅ types.ts - Added version to ImageCacheKey
   - ✅ services/imageCacheService.ts - Versioned cache URLs and operations
   - ✅ hooks/useBlobUrl.ts - Re-fetch on version change
   - ✅ store/slices/imageSlice.ts - Version tracking state and navigation
   - ⏳ services/imageGenerationService.ts - Context and version passing
   - ⏳ services/imageService.ts - Pass version when storing
   - ⏳ components/Illustration.tsx - Navigation UI

   **Technical Notes:**
   - Version numbers are 1-indexed (v1, v2, v3...) for user-friendliness
   - activeImageVersion defaults to latest if not set
   - Cache keys now: {chapterId, placementMarker, version}
   - useBlobUrl dependency array includes version for automatic re-fetching
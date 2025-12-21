2025-11-21 01:00 UTC - TranslationStatusPanel spacing tweak
- Files: components/chapter/TranslationStatusPanel.tsx (wrapper div class)
- Why: Chapter body sat flush against the translation/image metric lines; user requested extra spacing after the status rows.
- Details: Added `mb-4` to the panel wrapper (`space-y-2 mb-4`) so the “Translated in …” / “Generated …” lines remain tight but the chapter content starts with a clear visual gap.
- Tests: Not run (styling-only change)

2025-11-21 00:48 UTC - ImageOps deletion fixes + regression tests
- Files: services/db/operations/imageVersions.ts (normalizeVersionEntries helper + delete logic lines ~1-120); tests/services/db/ImageOps.test.ts (new regression coverage); docs/WORKLOG.md
- Why: Deleting an illustration version threw `TypeError: (markerState.versions || []).filter is not a function` because `versions` persisted as a record map, not an array. Needed to normalize both object + legacy array shapes before filtering and recompute latest/active state.
- Details:
  - Added `normalizeVersionEntries` to coerce stored metadata into `[version, metadata]` tuples and rewrote `deleteImageVersion` to build a new versions record, recompute `latestVersion`/`activeVersion`, and gracefully handle last-version deletions.
  - Added Vitest coverage under `tests/services/db/ImageOps.test.ts` to exercise both record-backed and legacy array-backed version states, ensuring `translationFacade.update` receives sanitized data.
- Tests: `npx tsc --noEmit`; `npm run test -- tests/services/db/ImageOps.test.ts --run`; `npm run test -- tests/store/bootstrap/bootstrapHelpers.test.ts --run`; `npm run test -- tests/services/exportService.test.ts --run`

2025-11-20 10:35 UTC - ChapterView decomposition: tokenization hook
- Files: hooks/useTranslationTokens.ts; components/ChapterView.tsx; tests/hooks/useTranslationTokens.test.tsx; docs/WORKLOG.md
- Why: Tokenization/diff wiring still lived in ChapterView (useMemo + ref updates). Extracting the logic into `useTranslationTokens` keeps the component lean and centralizes the memo/ref sync.
- Details:
  - Added `useTranslationTokens` to return `translationTokensData` + a ref that stays synced with token updates; ChapterView now consumes the hook and passes the ref into the inline editor hook.
  - Added hook tests ensuring English mode tokenizes while other modes return empty, and reran the standard targeted suites.
- Tests: `npx tsc --noEmit`; `npm run test -- tests/store/bootstrap/bootstrapHelpers.test.ts --run`; `npm run test -- tests/services/exportService.test.ts --run`; `npm run test -- tests/components/chapter/SelectionOverlay.test.tsx --run`; `npm run test -- tests/components/chapter/ChapterHeader.test.tsx --run`; `npm run test -- tests/components/chapter/ReaderFeedbackPanel.test.tsx --run`; `npm run test -- tests/components/chapter/ChapterContent.test.tsx --run`; `npm run test -- tests/components/chapter/FootnotesPanel.test.tsx --run`; `npm run test -- tests/components/chapter/TranslationStatusPanel.test.tsx --run`; `npm run test -- tests/components/chapter/ComparisonPortal.test.tsx --run`; `npm run test -- tests/components/chapter/FooterNavigation.test.tsx --run`; `npm run test -- tests/hooks/useFootnoteNavigation.test.tsx --run`; `npm run test -- tests/hooks/useTranslationTokens.test.tsx --run`

2025-11-20 10:19 UTC - ChapterView decomposition: footer navigation component
- Files: components/chapter/FooterNavigation.tsx; components/ChapterView.tsx; tests/components/chapter/FooterNavigation.test.tsx; docs/WORKLOG.md
- Why: The footer `NavigationControls` block plus `<footer>` wrapper were still inline. Extracting them reduces noise and keeps navigation wiring reusable.
- Details:
  - Added `FooterNavigation` to render prev/next buttons with the existing styles/disabled states; ChapterView now passes URLs/loading status down.
  - Added lightweight tests to exercise disabled/enabled states and updated the targeted suite.
- Tests: `npx tsc --noEmit`; `npm run test -- tests/store/bootstrap/bootstrapHelpers.test.ts --run`; `npm run test -- tests/services/exportService.test.ts --run`; `npm run test -- tests/components/chapter/SelectionOverlay.test.tsx --run`; `npm run test -- tests/components/chapter/ChapterHeader.test.tsx --run`; `npm run test -- tests/components/chapter/ReaderFeedbackPanel.test.tsx --run`; `npm run test -- tests/components/chapter/ChapterContent.test.tsx --run`; `npm run test -- tests/components/chapter/FootnotesPanel.test.tsx --run`; `npm run test -- tests/components/chapter/TranslationStatusPanel.test.tsx --run`; `npm run test -- tests/components/chapter/ComparisonPortal.test.tsx --run`; `npm run test -- tests/components/chapter/FooterNavigation.test.tsx --run`; `npm run test -- tests/hooks/useFootnoteNavigation.test.tsx --run`

2025-11-20 10:15 UTC - ChapterView decomposition: TranslationStatusPanel integration
- Files: components/chapter/ChapterHeader.tsx; components/chapter/TranslationStatusPanel.tsx; components/ChapterView.tsx; tests/components/chapter/ChapterHeader.test.tsx; docs/WORKLOG.md
- Why: The translation status UI was still embedded in ChapterHeader; moving it entirely into TranslationStatusPanel keeps the header focused on navigation/toggles and centralizes retranslate + metrics logic.
- Details:
  - Slimmed `ChapterHeader` to just title/navigation/language controls, eliminating the retranslate buttons and metrics text that now live in `TranslationStatusPanel`.
  - Rendered `TranslationStatusPanel` directly beneath the header inside ChapterView, wiring it to the existing `handleRetranslateClick` helper and status booleans.
  - Updated ChapterHeader tests accordingly and reran the targeted suites.
- Tests: `npx tsc --noEmit`; `npm run test -- tests/store/bootstrap/bootstrapHelpers.test.ts --run`; `npm run test -- tests/services/exportService.test.ts --run`; `npm run test -- tests/components/chapter/SelectionOverlay.test.tsx --run`; `npm run test -- tests/components/chapter/ChapterHeader.test.tsx --run`; `npm run test -- tests/components/chapter/ReaderFeedbackPanel.test.tsx --run`; `npm run test -- tests/components/chapter/ChapterContent.test.tsx --run`; `npm run test -- tests/components/chapter/FootnotesPanel.test.tsx --run`; `npm run test -- tests/components/chapter/TranslationStatusPanel.test.tsx --run`; `npm run test -- tests/components/chapter/ComparisonPortal.test.tsx --run`; `npm run test -- tests/hooks/useFootnoteNavigation.test.tsx --run`

2025-11-20 09:47 UTC - ChapterView decomposition: comparison portal component
- Files: components/chapter/ComparisonPortal.tsx; components/ChapterView.tsx; hooks/useComparisonPortal.ts; tests/components/chapter/ComparisonPortal.test.tsx; docs/WORKLOG.md
- Why: The fan comparison portal UI (plus show/hide toggles) still lived inline in ChapterView; extracting it reduces another ~100 LOC chunk and keeps portal-specific logic encapsulated.
- Details:
  - Added `ComparisonPortal` to own both the expanded card and collapsed chip, handling raw/fan toggle, dismiss, and loading/error messaging; ChapterView now just passes hook state down.
  - Exported the `ComparisonChunk` type from `useComparisonPortal` for reuse, and backfilled tests to ensure the component renders correctly for expanded/collapsed states and fires the appropriate callbacks.
- Tests: `npx tsc --noEmit`; `npm run test -- tests/store/bootstrap/bootstrapHelpers.test.ts --run`; `npm run test -- tests/services/exportService.test.ts --run`; `npm run test -- tests/components/chapter/SelectionOverlay.test.tsx --run`; `npm run test -- tests/components/chapter/ChapterHeader.test.tsx --run`; `npm run test -- tests/components/chapter/ReaderFeedbackPanel.test.tsx --run`; `npm run test -- tests/components/chapter/ChapterContent.test.tsx --run`; `npm run test -- tests/components/chapter/FootnotesPanel.test.tsx --run`; `npm run test -- tests/components/chapter/TranslationStatusPanel.test.tsx --run`; `npm run test -- tests/components/chapter/ComparisonPortal.test.tsx --run`; `npm run test -- tests/hooks/useFootnoteNavigation.test.tsx --run`

2025-11-20 09:21 UTC - ChapterView decomposition: TranslationStatusPanel
- Files: components/chapter/TranslationStatusPanel.tsx; components/ChapterView.tsx; tests/components/chapter/TranslationStatusPanel.test.tsx; docs/WORKLOG.md
- Why: The translation status + metrics block (retranslate CTA, translation banner, usage/image metrics) was still inline inside ChapterView; extracting it keeps the orchestrator lean and centralizes formatting.
- Details:
  - Added `TranslationStatusPanel` to render the retranslate button, translating banner, and usage/image metrics; ChapterView now just passes the booleans and callbacks.
  - Added RTL tests covering button clicks, metrics rendering, and translating states; reran the standard test suite.
- Tests: `npx tsc --noEmit`; `npm run test -- tests/store/bootstrap/bootstrapHelpers.test.ts --run`; `npm run test -- tests/services/exportService.test.ts --run`; `npm run test -- tests/components/chapter/SelectionOverlay.test.tsx --run`; `npm run test -- tests/components/chapter/ChapterHeader.test.tsx --run`; `npm run test -- tests/components/chapter/ReaderFeedbackPanel.test.tsx --run`; `npm run test -- tests/components/chapter/ChapterContent.test.tsx --run`; `npm run test -- tests/components/chapter/FootnotesPanel.test.tsx --run`; `npm run test -- tests/components/chapter/TranslationStatusPanel.test.tsx --run`; `npm run test -- tests/hooks/useFootnoteNavigation.test.tsx --run`

2025-11-20 07:03 UTC - ChapterView decomposition: footnote navigation hook
- Files: hooks/useFootnoteNavigation.ts; components/ChapterView.tsx; tests/hooks/useFootnoteNavigation.test.tsx; docs/WORKLOG.md
- Why: The click + hashchange effects for footnotes were still inline within ChapterView; extracting them into a hook keeps the component lean and improves testability.
- Details:
  - Added `useFootnoteNavigation` to encapsulate the container click handler and hashchange listener, preserving the smooth-scroll + history update behavior while guarding for SSR.
  - ChapterView now simply calls the hook with `viewRef`, `viewMode`, and `currentChapterId`, allowing future consumers (e.g., preview panes) to reuse the behavior.
  - Added RTL tests that verify scroll triggers for anchor clicks and initial hash/hashchange events, then reran the standard targeted suites.
- Tests: `npx tsc --noEmit`; `npm run test -- tests/store/bootstrap/bootstrapHelpers.test.ts --run`; `npm run test -- tests/services/exportService.test.ts --run`; `npm run test -- tests/components/chapter/SelectionOverlay.test.tsx --run`; `npm run test -- tests/components/chapter/ChapterHeader.test.tsx --run`; `npm run test -- tests/components/chapter/ReaderFeedbackPanel.test.tsx --run`; `npm run test -- tests/components/chapter/ChapterContent.test.tsx --run`; `npm run test -- tests/components/chapter/FootnotesPanel.test.tsx --run`; `npm run test -- tests/hooks/useFootnoteNavigation.test.tsx --run`

2025-11-20 05:48 UTC - ChapterView decomposition: FootnotesPanel extraction
- Files: components/chapter/FootnotesPanel.tsx; components/ChapterView.tsx; tests/components/chapter/FootnotesPanel.test.tsx; docs/WORKLOG.md
- Why: The footnotes rendering block (and its cloning quirks) was still embedded in ChapterView; extracting it keeps the reader body thinner while preserving the sanitized markup logic.
- Details:
  - Added `FootnotesPanel` which mirrors the previous `renderFootnotes` output (including normalization + anchor links) and returns null when no notes exist.
  - ChapterView now drops the helper and instead mounts the panel; hash/click navigation hooks remain untouched.
  - Added RTL coverage for empty vs populated states and reran the standard targeted suites.
- Tests: `npx tsc --noEmit`; `npm run test -- tests/store/bootstrap/bootstrapHelpers.test.ts --run`; `npm run test -- tests/services/exportService.test.ts --run`; `npm run test -- tests/components/chapter/SelectionOverlay.test.tsx --run`; `npm run test -- tests/components/chapter/ChapterHeader.test.tsx --run`; `npm run test -- tests/components/chapter/ReaderFeedbackPanel.test.tsx --run`; `npm run test -- tests/components/chapter/ChapterContent.test.tsx --run`; `npm run test -- tests/components/chapter/FootnotesPanel.test.tsx --run`

2025-11-20 04:19 UTC - ChapterView decomposition: ReaderFeedbackPanel extraction
- Files: components/chapter/ReaderFeedbackPanel.tsx; components/ChapterView.tsx; tests/components/chapter/ReaderFeedbackPanel.test.tsx; docs/WORKLOG.md
- Why: Continue peeling large contiguous blocks out of ChapterView by moving the reader feedback section (heading + FeedbackDisplay wiring) into its own component that can gate rendering by view mode.
- Details:
  - Added `ReaderFeedbackPanel` to wrap FeedbackDisplay, applying the existing heading + layout while hiding itself unless the English view has feedback.
  - ChapterView now renders the panel unconditionally (it returns null otherwise) and no longer imports FeedbackDisplay directly.
  - Added a focused test to ensure the panel renders only when expected and forwards delete callbacks; reran the standard targeted suites.
- Tests: `npx tsc --noEmit`; `npm run test -- tests/store/bootstrap/bootstrapHelpers.test.ts --run`; `npm run test -- tests/services/exportService.test.ts --run`; `npm run test -- tests/components/chapter/SelectionOverlay.test.tsx --run`; `npm run test -- tests/components/chapter/ChapterHeader.test.tsx --run`; `npm run test -- tests/components/chapter/ReaderFeedbackPanel.test.tsx --run`

2025-11-20 03:31 UTC - ChapterView decomposition: ChapterHeader extraction
- Files: components/chapter/ChapterHeader.tsx; components/ChapterView.tsx; tests/components/chapter/ChapterHeader.test.tsx; docs/WORKLOG.md
- Why: The ChapterView header block (nav, toggles, retranslate, metrics) was a contiguous ~200 LOC section; extracting it keeps the orchestrator slimmer per modularity plan.
- Details:
  - Introduced `ChapterHeader` to own both desktop/mobile layouts, Source link, retranslate button styling, translating banner, and metrics messaging; ChapterView now passes the necessary props instead of duplicating logic.
  - Added a `handleRetranslateClick` helper so logging/cancel-start flows live alongside store wiring, and replaced the inline `MetricsDisplay` helpers with booleans fed to the new component.
  - Created `ChapterHeader.test.tsx` to cover navigation disabling, language toggles, retranslate callbacks, and metrics rendering so future style changes stay guarded.
- Tests: `npx tsc --noEmit`; `npm run test -- tests/store/bootstrap/bootstrapHelpers.test.ts --run`; `npm run test -- tests/services/exportService.test.ts --run`; `npm run test -- tests/components/chapter/SelectionOverlay.test.tsx --run`; `npm run test -- tests/components/chapter/ChapterHeader.test.tsx --run`

2025-11-19 18:22 UTC - ChapterView decomposition: selection overlay + comparison guard
- Files: components/ChapterView.tsx; components/chapter/SelectionOverlay.tsx; hooks/useComparisonPortal.ts; hooks/useIsTouch.ts; tests/components/chapter/SelectionOverlay.test.tsx; docs/WORKLOG.md
- Why: Continue shrinking ChapterView by moving selection feedback UI into a dedicated component and make the comparison hook resilient when users dismiss or trigger multiple requests quickly.
- Details:
  - Added `SelectionOverlay` (with the previous `SelectionSheet`) plus a shared `useIsTouch` hook so ChapterView no longer inlines the popover/sheet gating logic; the new component consumes the feedback actions + inline edit hook directly.
  - Hardened `useComparisonPortal` with a `dismissComparison` helper and request-id guard so stale responses don’t resurrect dismissed cards; ChapterView now calls the helper instead of mutating hook state.
  - Added `SelectionOverlay.test.tsx` to assert popover vs sheet rendering paths and documented the extraction to keep future work coordinated.
- Tests: `npx tsc --noEmit`; `npm run test -- tests/store/bootstrap/bootstrapHelpers.test.ts --run`; `npm run test -- tests/services/exportService.test.ts --run`; `npm run test -- tests/components/chapter/SelectionOverlay.test.tsx --run`

2025-11-16 20:10 UTC - ChapterView decomposition: comparison portal hook
- Files: components/ChapterView.tsx; hooks/useComparisonPortal.ts; docs/WORKLOG.md
- Why: Comparison/portal logic still consumed ~200 LOC in ChapterView. Moving it into a dedicated hook shrinks the component and centralizes portal cleanup + request handling.
- Details:
  - Added `useComparisonPortal` to own the chunk state, portal creation/removal, async comparison request, and error handling.
  - ChapterView now simply consumes the hook outputs (`comparisonChunk`, `comparisonLoading`, etc.) and renders the existing UI.
- Tests: `npx tsc --noEmit`; `npm run test -- tests/store/bootstrap/bootstrapHelpers.test.ts --run`; `npm run test -- tests/services/exportService.test.ts --run`; `npm run test -- tests/components/diff/ChapterView.mapMarker.test.tsx --run`

2025-11-16 19:15 UTC - ChapterView decomposition: inline editor hook
- Files: components/ChapterView.tsx; hooks/useInlineTranslationEditor.ts; docs/WORKLOG.md
- Why: ChapterView still carried ~250 LOC of inline edit state/handlers. Moving them into a dedicated hook reduces the component surface and keeps the toolbar logic encapsulated.
- Details:
  - Added `useInlineTranslationEditor`, responsible for selection validation, toolbar positioning, and persist/cancel flows; the component now just consumes the hook outputs.
  - ChapterView no longer manages `inlineEditState`/toolbar effects directly, cutting another ~150 LOC from the monolith.
- Tests: `npx tsc --noEmit`; `npm run test -- tests/store/bootstrap/bootstrapHelpers.test.ts --run`; `npm run test -- tests/services/exportService.test.ts --run`

2025-11-16 19:15 UTC - ChapterView decomposition: inline editor hook
- Files: components/ChapterView.tsx; hooks/useInlineTranslationEditor.ts; docs/WORKLOG.md
- Why: ChapterView still carried ~250 LOC of inline edit state/handlers. Moving them into a dedicated hook reduces the component surface and keeps the toolbar logic encapsulated.
- Details:
  - Added `useInlineTranslationEditor`, responsible for selection validation, toolbar positioning, and persist/cancel flows; the component now just consumes the hook outputs.
  - ChapterView no longer manages `inlineEditState`/toolbar effects directly, cutting another ~150 LOC from the monolith.
- Tests: `npx tsc --noEmit`; `npm run test -- tests/store/bootstrap/bootstrapHelpers.test.ts --run`; `npm run test -- tests/services/exportService.test.ts --run`; `npm run test -- tests/components/diff/ChapterView.mapMarker.test.tsx --run`

2025-11-16 19:15 UTC - ChapterView decomposition: inline editor hook
- Files: components/ChapterView.tsx; hooks/useInlineTranslationEditor.ts; docs/WORKLOG.md
- Why: ChapterView still carried ~250 LOC of inline edit state/handlers. Moving them into a dedicated hook reduces the component surface and keeps the toolbar logic encapsulated.
- Details:
  - Added `useInlineTranslationEditor`, responsible for selection validation, toolbar positioning, and persist/cancel flows; the component now just consumes the hook outputs.
  - ChapterView no longer manages `inlineEditState`/toolbar effects directly, cutting another ~150 LOC from the monolith.
- Tests: `npx tsc --noEmit`; `npm run test -- tests/store/bootstrap/bootstrapHelpers.test.ts --run`; `npm run test -- tests/services/exportService.test.ts --run`; `npm run test -- tests/components/diff/ChapterView.mapMarker.test.tsx --run`

2025-11-16 18:45 UTC - ChapterView decomposition: diff gutter + hook
- Files: components/{ChapterView.tsx,chapter/DiffMarkersPanel.tsx}; hooks/useChapterDiffs.ts; tests/components/diff/ChapterView.mapMarker.test.tsx; docs/WORKLOG.md
- Why: Continue slimming the 1.6k LOC ChapterView by extracting the diff gutter JSX and orchestration into reusable pieces.
- Details:
  - Added `DiffMarkersPanel` to render the paragraph heatmap markers + tooltips and `useChapterDiffs` to wrap fetching/visibility/navigation logic; ChapterView now just passes props instead of managing the Map + JSX inline.
  - Updated the diff visibility test to import `mapMarkerForVisibility` from the new module instead of reaching through `__testables`.
- Tests: `npx tsc --noEmit`; `npm run test -- tests/store/bootstrap/bootstrapHelpers.test.ts --run`; `npm run test -- tests/services/exportService.test.ts --run`; `npm run test -- tests/components/diff/ChapterView.mapMarker.test.tsx --run`

2025-11-16 18:05 UTC - ChapterView decomposition: token + diff helpers
- Files: components/{ChapterView.tsx,chapter/translationTokens.tsx,chapter/diffVisibility.ts}; docs/WORKLOG.md
- Why: ChapterView was ~2k LOC with huge inline tokenization/diff helper blocks. Extracting them keeps the component readable and preps further splits.
- Details:
  - Moved the translation token/paragraph logic (regexes, renderers, mutate helpers) into `components/chapter/translationTokens.tsx`, exporting the same API consumed by the view.
  - Extracted the diff marker visibility helpers into `components/chapter/diffVisibility.ts`, so the component now imports `resolveMarkerVisibility`, `mapMarkerForVisibility`, and `DEFAULT_DIFF_MARKER_VISIBILITY`.
  - ChapterView imports the new modules and no longer duplicates the helper code.
- Tests: `npx tsc --noEmit`; `npm run test -- tests/store/bootstrap/bootstrapHelpers.test.ts --run`; `npm run test -- tests/services/exportService.test.ts --run`

2025-11-16 17:45 UTC - SettingsModal decomposition: Novel metadata hook
- Files: hooks/useNovelMetadata.ts; components/SettingsModal.tsx; docs/WORKLOG.md
- Why: Move the metadata-prefill logic (localStorage, sessionInfo, IndexedDB fallback) out of the modal so it only consumes a hook instead of embedding ~150 LOC of helpers/effects.
- Details:
  - Added `useNovelMetadata` to encapsulate the helper functions, fallback generation, and persistence into SettingsOps/localStorage while emitting the existing debug logs.
  - `SettingsModal` now calls the hook to receive `novelMetadata` + `handleNovelMetadataChange`, letting the shared context expose those values without maintaining duplicate effects or helpers inline.
- Tests: `npx tsc --noEmit`; `npm run test -- tests/store/bootstrap/bootstrapHelpers.test.ts --run`; `npm run test -- tests/services/exportService.test.ts --run`

2025-11-16 17:20 UTC - SettingsModal decomposition: Session actions footer
- Files: components/settings/{SessionActions.tsx,SessionActions.test.tsx}; components/SettingsModal.tsx; docs/WORKLOG.md
- Why: Finish stripping UI/handlers from the modal by moving the import/clear/save footer into a dedicated component so the shell just wires callbacks.
- Details:
  - Added `SessionActions` to encapsulate the hidden file input, import reader, and responsive buttons; `SettingsModal` now passes `handleSave/handleCancel/handleClear/importSessionData` instead of managing refs + FileReader logic inline.
  - Added tests covering save/cancel/clear events and verifying that importing a JSON file invokes the provided callback with parsed data.
- Tests: `npx tsc --noEmit`; `npm run test -- components/settings/SessionActions.test.tsx --run`; `npm run test -- tests/store/bootstrap/bootstrapHelpers.test.ts --run`; `npm run test -- tests/services/exportService.test.ts --run`

2025-11-16 16:45 UTC - SettingsModal decomposition: Display panel extraction
- Files: components/settings/{DisplayPanel.tsx,DisplayPanel.test.tsx}; components/SettingsModal.tsx; docs/WORKLOG.md
- Why: Finish carving the “General” tab out of the modal by moving the display/accessibility controls into their own panel with tests so future tweaks don’t require touching the modal shell.
- Details:
  - Added `DisplayPanel` consuming the shared modal context for font size/style/line height and rewired the General tab to render `<DisplayPanel/>` + `<PromptPanel/>`, eliminating the inline markup and handlers.
  - Added a focused test suite ensuring slider/dropdown changes call `handleSettingChange`, keeping regression coverage on the extracted UI.
- Tests: `npx tsc --noEmit`; `npm run test -- components/settings/DisplayPanel.test.tsx --run`

2025-11-16 16:05 UTC - SettingsModal decomposition: Advanced panel extraction
- Files: components/settings/{AdvancedPanel.tsx,AdvancedPanel.test.tsx}; hooks/useAdvancedPanelStore.ts; components/SettingsModal.tsx; docs/WORKLOG.md
- Why: Continue shrinking the modal by moving the diagnostics/logging + advanced parameter controls into a dedicated panel with its own hook/tests so the shell is only tabs + metadata state.
- Details:
  - Introduced `useAdvancedPanelStore` to surface memory diagnostics from the store and built `AdvancedPanel` with logging level + pipeline controls, image/diff parameter editors, and async disk diagnostics backed by `ImageOps`.
  - `SettingsModal` no longer tracks debug toggles or diagnostics state—rendering the advanced tab now delegates to `<AdvancedPanel/>`, reducing local hooks and keeping context clean.
  - Added `AdvancedPanel.test.tsx` to cover logging-level persistence, pipeline toggles, diagnostics hydration, and state delegation; panel wiring mirrors the other extracted tabs.
- Tests: `npx tsc --noEmit`; `npm run test -- tests/store/bootstrap/bootstrapHelpers.test.ts --run`; `npm run test -- tests/services/exportService.test.ts --run`; `npm run test -- components/settings/AdvancedPanel.test.tsx --run`

2025-11-16 13:08 UTC - SettingsModal decomposition: Providers panel extraction
- Files: components/settings/{ProvidersPanel.tsx,SettingsTabs.tsx}, components/settings/ProvidersPanel.test.tsx, hooks/useProvidersPanelStore.ts, components/SettingsModal.tsx, services/translate/HtmlSanitizer.ts
- Why: Begin the agreed SettingsModal decomposition by carving out the provider/API-key section into a dedicated panel with its own hook + tests, reducing the monolith size and introducing the shared tab shell/context needed for future extractions.
- Details:
  - Added `SettingsModalProvider` + `SettingsTabs` scaffolding and rewired `SettingsModal` to render the new `<ProvidersPanel/>` tab while delegating Zustand selectors for provider data into `useProvidersPanelStore`.
  - Implemented `ProvidersPanel` with all translation-engine + API key controls, OpenRouter model sorting, credit summaries, and structured-output/parameter probes; moved the supporting logic out of the modal and added focused tests.
  - Exported `toStrictXhtml` from `HtmlSanitizer` so existing EPUB serializers keep compiling under `tsc --noEmit`.
- Tests: `npx tsc --noEmit`; `npm run test -- tests/store/bootstrap/bootstrapHelpers.test.ts --run`; `npm run test -- tests/services/exportService.test.ts --run`; `npm run test -- components/settings/ProvidersPanel.test.tsx --run`

2025-11-16 13:45 UTC - SettingsModal decomposition: Export + metadata panels
- Files: components/settings/{MetadataPanel.tsx,SessionExportPanel.tsx,MetadataPanel.test.tsx,SessionExportPanel.test.tsx,types.ts}, hooks/useExportPanelStore.ts, components/SettingsModal.tsx
- Why: Continue shrinking the 2.7k LOC modal by extracting the metadata editor and export workflow into their own panels so future slices can reuse the shared context/tabs without reimplementing IndexedDB helpers.
- Details:
  - Added `PublisherMetadata` + extended context values so the metadata state lives in a provider that both panels consume; `MetadataPanel` now renders the novel form while `SessionExportPanel` owns the Quick Export/Publish flows.
  - Introduced `useExportPanelStore` and panel-specific tests to cover metadata propagation, quick export success, and metadata gating before publishing.
  - `SettingsModal.tsx` no longer contains the export/metadata markup, reducing surface area for future decompositions.
- Tests: `npx tsc --noEmit`; `npm run test -- tests/store/bootstrap/bootstrapHelpers.test.ts --run`; `npm run test -- tests/services/exportService.test.ts --run`; `npm run test -- components/settings/{ProvidersPanel.test.tsx,MetadataPanel.test.tsx,SessionExportPanel.test.tsx} --run`

2025-11-16 14:36 UTC - SettingsModal decomposition: Audio panel extraction
- Files: components/settings/{AudioPanel.tsx,AudioPanel.test.tsx}, hooks/useAudioPanelStore.ts, components/SettingsModal.tsx
- Why: Keep chipping away at the 2.7k LOC modal by migrating the entire Audio/OST settings tab into a dedicated panel that talks directly to the audio slice, so the shell no longer hosts provider/task/file-upload logic.
- Details:
  - Added `useAudioPanelStore` to wrap the audio slice selectors/actions and built `AudioPanel` with accessible controls, OST hydration, upload validation, and usage stats; the modal now renders `<AudioPanel/>` and drops the inline helper state/effects.
  - Converted the panel to rely on `setError` from the store so validation errors surface the same way as before; imports/state (OST samples, upload helpers) were removed from `SettingsModal`.
  - Added a focused test suite exercising provider changes and file validation.
- Tests: `npx tsc --noEmit`; `npm run test -- tests/store/bootstrap/bootstrapHelpers.test.ts --run`; `npm run test -- tests/services/exportService.test.ts --run`; `npm run test -- components/settings/{ProvidersPanel.test.tsx,MetadataPanel.test.tsx,SessionExportPanel.test.tsx,AudioPanel.test.tsx} --run`
 
2025-11-16 15:05 UTC - SettingsModal decomposition: Diff + prompt panels
- Files: components/settings/{DiffPanel.tsx,DiffPanel.test.tsx,PromptPanel.tsx,PromptPanel.test.tsx}, components/SettingsModal.tsx
- Why: Keep shrinking the monolith by isolating the diff/reader-features UI and the prompt library/system prompt editor, so subsequent tabs can follow the same panel pattern.
- Details:
  - Moved marker visibility toggles, diff prompt textarea, and the invalidate workflow into `DiffPanel`, which now talks to `DiffOps`/notifications directly.
  - Introduced `PromptPanel` to handle template CRUD, selection, and editing while syncing `systemPrompt` through the shared modal context.
  - `SettingsModal.tsx` no longer keeps the prompt/diff state or helper functions; the general tab now renders Display settings plus `<PromptPanel/>`.
- Tests: `npx tsc --noEmit`; `npm run test -- tests/store/bootstrap/bootstrapHelpers.test.ts --run`; `npm run test -- tests/services/exportService.test.ts --run`; `npm run test -- components/settings/{ProvidersPanel.test.tsx,MetadataPanel.test.tsx,SessionExportPanel.test.tsx,AudioPanel.test.tsx,DiffPanel.test.tsx,PromptPanel.test.tsx} --run`

2025-11-16 15:30 UTC - SettingsModal decomposition: EPUB template panel
- Files: components/settings/{TemplatePanel.tsx,TemplatePanel.test.tsx}, components/SettingsModal.tsx
- Why: Continue the decomposition by moving the EPUB overrides (gratitude message, project description, footer) into a dedicated panel so the templates tab is just `<TemplatePanel/>`.
- Details:
  - TemplatePanel now renders the EPUB fields with proper labels/IDs and uses the shared context to update settings; the modal dropped the legacy fieldset and no longer imports `getDefaultTemplate`.
  - Added tests that check the panel calls `handleSettingChange` for gratitude/footer edits.
- Tests: `npx tsc --noEmit`; `npm run test -- tests/store/bootstrap/bootstrapHelpers.test.ts --run`; `npm run test -- tests/services/exportService.test.ts --run`; `npm run test -- components/settings/{PromptPanel.test.tsx,TemplatePanel.test.tsx} --run`

2025-11-16 06:05 UTC - Facade slimming: URL mapping delegation
- Files: services/indexeddb.ts:330-440,404-420; services/db/operations/chapters.ts:300-360; docs/INDEXEDDB-FACADE-MIGRATION.md:18-30
- Why: Remove the facade’s custom URL mapping transaction so ChapterOps owns mapping upserts alongside the rest of the chapter logic.
- Details:
  - Deleted `buildUrlMappingEntries`/`upsertUrlMappingsForChapter` from the facade; `storeChapter` now calls `ChapterOps.ensureUrlMappings`.
  - Added `ChapterOps.ensureUrlMappings()` to expose the existing helper so other consumers don’t reimplement the transaction logic.
  - Migration tracker captures the mapping delegation milestone.
- Tests: `npx tsc --noEmit`

2025-11-16 06:15 UTC - Facade slimming: schema diagnostic delegation
- Files: services/indexeddb.ts:610-700; services/db/operations/schema.ts:1-200; docs/INDEXEDDB-FACADE-MIGRATION.md:18-32
- Why: Move the `testStableIdSchema` helper into SchemaOps so schema/index inspection logic sits with the rest of the schema utilities instead of the facade.
- Details:
  - Added `SchemaOps.testStableIdSchema()` (reusing `getConnection`) to report store/index status; the facade now simply returns that result.
  - Dropped the unused `DB_NAME`/`DB_VERSION` constants and the bespoke transaction logic; documentation updated accordingly.
- Tests: `npx tsc --noEmit`

2025-11-16 06:25 UTC - Facade slimming: debug hooks extraction
- Files: services/indexeddb.ts:900-950; services/db/debugHooks.ts (new); docs/INDEXEDDB-FACADE-MIGRATION.md:18-36
- Why: Move the dev-only window helpers (cleanup + schema-test hooks) out of the monolith so the facade no longer handles debug plumbing.
- Details:
  - Added `registerIndexedDbDebugHooks()` that attaches `cleanupDuplicateVersions`, `cleanupAndRefresh`, `resetIndexedDB`, and `testStableIdSchema` when `window` exists, reusing MaintenanceOps/SchemaOps.
  - `services/indexeddb.ts` now just calls the helper; the inline window block was deleted. Migration tracker updated.
- Tests: `npx tsc --noEmit`

2025-11-16 06:32 UTC - Facade slimming: enhanced chapter delegation
- Files: services/indexeddb.ts:30-80,330-350,630-660; docs/INDEXEDDB-FACADE-MIGRATION.md:18-38
- Why: Delegate the enhanced-chapter pathway to `ChapterOps` and drop the unused URL-normalizer helper so the facade keeps zero bespoke transformations.
- Details:
  - `storeEnhancedChapter` now calls `ChapterOps.storeEnhanced`, reusing the ops logic that already handles canonical URLs/stable IDs.
  - Removed the unused `normalizeUrlAggressively` helper and its import.
  - Migration tracker updated to reflect the delegation.
- Tests: `npx tsc --noEmit`

2025-11-16 06:40 UTC - Facade slimming: translation delete delegation
- Files: services/indexeddb.ts:630-660; services/db/repositories/interfaces/ITranslationRepository.ts:1-60; services/db/repositories/TranslationRepository.ts:240-310; docs/INDEXEDDB-FACADE-MIGRATION.md:18-40
- Why: Move the “delete translation by version” logic into the repository so the facade stops enumerating versions manually.
- Details:
  - Added `deleteTranslationVersionByChapter` to the translation repository (and interface) to encapsulate the “find version → delete by ID → ensure active version” flow.
  - `indexedDBService.deleteTranslation()` now just calls the repository helper before recomputing chapter summaries; no bespoke version scans remain in the facade.
  - Migration tracker updated accordingly.
- Tests: `npx tsc --noEmit`

2025-11-16 06:45 UTC - Facade slimming: summary diagnostics helper
- Files: services/indexeddb.ts:660-720; services/db/operations/summaries.ts:240-320; services/db/operations/index.ts:1-30; docs/INDEXEDDB-FACADE-MIGRATION.md:18-42
- Why: Move the chapter-summary diagnostics logging block out of the facade so all summary processing (data + logging) lives under SummariesOps.
- Details:
  - Added `logSummaryDiagnostics()` to SummariesOps and re-exported it; it reuses the existing diagnostics data to emit the console output.
  - `indexedDBService.getChapterSummaries()` now just calls the helper via `getChapterSummaryDiagnostics().then(logSummaryDiagnostics)`; the inline logging block was deleted.
  - Migration tracker updated to note that the facade no longer includes bespoke logging.
- Tests: `npx tsc --noEmit`

2025-11-16 07:00 UTC - Remove indexedDBService facade
- Files: services/indexeddb.ts (deleted); services/db/types.ts (new) plus widespread import updates across services/db/*, store/slices/exportSlice.ts, scripts/backfillChapterNumbers.ts, services/navigationService.ts, services/prompts/PromptRegistry.ts; tests updated (store/amendmentProposal, current-system/{translation,export-import}, db/open-singleton, utils/db-harness, smoke/critical-components, services/exportService); removed services/db/interfaces/IIndexedDBService.ts, services/db/__mocks__/MockIndexedDBService.ts, tests/services/db/indexedDBService.interface.test.ts.
- Why: Finish the facade migration by deleting the monolithic service, moving shared types into `services/db/types.ts`, and pointing tests at the ops/repository layer.
- Details:
  - Replaced every runtime/test usage of `indexedDBService` with the appropriate ops (`TranslationOps`, `SessionExportOps`, `ImportOps`, `AmendmentOps`, etc.) and added a dedicated `logSummaryDiagnostics` helper so no bespoke logic remained before deletion.
  - Created `services/db/types.ts` to host the shared Chapter/Translation/Prompt/Feedback record definitions and rewired all repositories/ops to import from it.
  - Removed the obsolete interface + mock + contract test; tests now spy directly on the ops layer.
- Tests: `npx tsc --noEmit`

2025-11-16 07:10 UTC - Preserve enhanced chapter raw URLs
- Files: services/db/operations/chapters.ts:360-390; docs/WORKLOG.md:1-120
- Why: Ensure enhanced chapter writes continue preferring the raw/original URL so URL mappings contain both canonical and fetched URLs.
- Details:
  - Updated `ChapterOps.storeEnhanced` to prefer `enhanced.originalUrl` when present and only fall back to `enhanced.canonicalUrl` if necessary.
  - Explicitly carry a separate canonical URL so downstream storage/mapping logic receives both representations.
- Tests: `npx tsc --noEmit`

2025-11-16 05:55 UTC - Facade slimming: chapter lookup delegation
- Files: services/indexeddb.ts:890-1045; services/db/operations/chapters.ts:150-360; docs/INDEXEDDB-FACADE-MIGRATION.md:18-28
- Why: Remove the remaining raw CHAPTERS store transactions (find-by-url, find-by-number, most-recent-stable-id) so ChapterOps owns all chapter lookups.
- Details:
  - Added `ChapterOps.getMostRecentStableReference()` (with a shared `getMostRecentChapterModern` helper) and wired the facade's `getMostRecentChapterStableId` to it; the helper no longer opens its own transaction or index cursor.
  - `findChapterByUrl` now delegates to `ChapterOps.findByUrl`, and `findChapterByNumber` uses `ChapterOps.findByNumber`, eliminating the duplicated stable-id math.
  - Migration tracker updated to reflect that chapter lookup helpers are now part of the ops layer.
- Tests: `npx tsc --noEmit`

2025-11-16 05:35 UTC - Facade slimming: chapter summary ops
- Files: services/indexeddb.ts:45-70,780-870; services/db/operations/summaries.ts:1-300; services/db/operations/index.ts:1-40; docs/INDEXEDDB-FACADE-MIGRATION.md:21-26
- Why: Remove the bespoke chapter-summary fetch/diagnostic logic from the facade so SummariesOps owns both the data retrieval and the comparison tooling.
- Details:
  - Added `getChapterSummaryDiagnostics()` to SummariesOps (built atop ChapterOps + `fetchChapterSummaries`) and re-exported it for consumers.
  - `indexedDBService.getChapterSummaries()` now delegates to `fetchChapterSummaries()` after ensuring the store exists, logs the sorted output, and calls the new diagnostics helper instead of opening manual transactions.
  - Deleted the local `compareChaptersVsSummaries()` helper; documentation updated to capture the delegation milestone.
- Tests: `npx tsc --noEmit`

2025-11-16 05:20 UTC - Facade slimming: rendering ops delegation
- Files: services/indexeddb.ts:45-50,620-950; docs/INDEXEDDB-FACADE-MIGRATION.md:21-24
- Why: Remove the bespoke rendering dependency builder so `RenderingOps` owns database + translation wiring, keeping the facade ignorant of low-level hydration details.
- Details:
  - Swapped the local `getRenderingDeps()` helper with `fetchChaptersForReactRendering()` so the facade just forwards calls to the ops layer.
  - Dropped the now-unused `RenderingOpsDeps` import/type plumbing; RenderingOps reuses ChapterOps/TranslationOps via `getConnection`.
  - Migration tracker updated to record the rendering delegation milestone.
- Tests: `npx tsc --noEmit`

2025-11-16 05:05 UTC - Facade slimming: summary ops delegation
- Files: services/indexeddb.ts:45-70,360-410; services/db/operations/schema.ts:1-60,120-160; docs/INDEXEDDB-FACADE-MIGRATION.md:32-40
- Why: Finish the summary-path delegation so the facade stops building `SummaryOps` dependencies locally and SchemaOps owns recompute/delete orchestration.
- Details:
  - Removed the unused `recomputeSummary`/`deleteSummary` imports plus the bespoke `getSummaryDeps()` helper; `indexedDBService` now calls `SchemaOps.deleteChapterSummary` just like recompute, keeping the file a pure delegator.
  - Added a shared `liveSummaryDeps` helper inside `SchemaOps` so recompute/delete share the same ChapterOps-based dependency graph, reducing drift risk.
  - Migration tracker updated to capture the summary delegation milestone.
- Tests: `npx tsc --noEmit`

2025-11-16 03:12 UTC - Facade slimming: mappings + diff ops
- Files: services/indexeddb.ts; services/db/operations/diffResults.ts; docs/INDEXEDDB-FACADE-MIGRATION.md
- Why: Continue shrinking `services/indexeddb.ts` by delegating URL mapping helpers and diff queries to the ops layer so the facade stays a thin delegator.
- Details:
  - `getStableIdByUrl`, `getAllUrlMappings`, and `getAllNovels` now call `MappingsOps`; the bespoke IndexedDB transactions were deleted.
  - Added `DiffOps.getAll()` and wired `getAllDiffResults()` to it instead of opening the `DIFF_RESULTS` store manually.
  - Migration tracker updated to note the additional delegation.
- Tests: `npx tsc --noEmit`

2025-11-16 04:25 UTC - Facade slimming: schema/bootstrap
- Files: services/indexeddb.ts; services/db/operations/schema.ts; docs/INDEXEDDB-FACADE-MIGRATION.md
- Why: Move the schema verification/index-guarding logic and chapter-summary bootstrap out of the facade so `SchemaOps` owns database opening/migrations.
- Details:
  - `openDatabase()` now delegates to `SchemaOps.openDatabaseWithMigrations()`; the inlined `verifySchemaOrAutoMigrate/ensureTranslationIndexes/ensureChapterIndexes` helpers were deleted.
  - Added a thin `ensureChapterSummaries` wrapper that simply memoizes `SchemaOps.ensureChapterSummaries()` so recompute/delete paths still gate on initialization.
  - Updated the migration tracker to capture the schema delegation milestone.
- Tests: `npx tsc --noEmit`

2025-11-16 04:37 UTC - Facade slimming: prompt template ops
- Files: services/indexeddb.ts
- Why: The prompt template CRUD lived directly on the facade despite the `TemplatesOps` helper already existing. Delegating keeps `services/indexeddb.ts` focused on orchestration.
- Details: Store/read/default/delete/set-default now call `TemplatesOps`, allowing removal of the prompt-template repository field/import.
- Tests: `npx tsc --noEmit`

2025-11-15 17:51 UTC - Remove legacy repo backend toggle
- Files: services/db/index.ts; legacy/indexeddb-compat.ts (deleted); adapters/repo/{Repo.ts,index.ts} (deleted); tests/hooks/useDiffMarkers.test.tsx; docs/LEGACY_REPO_RETIREMENT_PLAN.md; docs/REFACTORING_PLAN.md; docs/INDEXEDDB-FACADE-MIGRATION.md
- Why: With the archived contracts migrated, the `makeLegacyRepo` shim and backend toggle for `'legacy'` were dead weight. Removing them ensures the modern ops/repo layer is the only persistence API.
- Details:
  - Inlined the `Repo` interface into `services/db/index.ts`, dropped the `'legacy'` backend option, and added a one-time warning/migration that rewrites stored backend preferences to `'modern'`.
  - Deleted `legacy/indexeddb-compat.ts` and the remaining adapter exports; the memory backend remains as the only fallback when IndexedDB is unavailable.
  - Updated docs (plan + migration tracker + retirement plan) to reflect completion, and fixed the `useDiffMarkers` test to mock `DiffOps` instead of the removed adapter path.
- Tests: `npx tsc --noEmit`

2025-11-15 17:36 UTC - Modernize archived repo contracts
- Files: archive/tests/db/contracts/translation-simple.legacy.ts; archive/tests/db/contracts/migration-validation-clean.legacy.ts; archive/tests/db/contracts/actual-system-validation.legacy.ts; archive/tests/db/contracts/helpers/modernDbHarness.ts (new); archive/tests/db/contracts/{migration-validation.legacy.ts,legacy-workaround.legacy.ts,diagnostic-investigation.legacy.ts,diagnostic-evidence.legacy.ts} (deleted); docs/INDEXEDDB-FACADE-MIGRATION.md
- Why: With the legacy repo slated for removal, the remaining “keep” suites had to run on ChapterOps/TranslationOps, and the logging-only diagnostics could be retired once their findings were recorded.
- Details:
  - Added a shared fake-indexeddb harness (`resetModernDb`, `storeChapterForTest`) so archive suites can exercise the ops layer without touching `makeLegacyRepo`.
  - Rewrote `translation-simple`, `migration-validation-clean`, and `actual-system-validation` to seed chapters via ChapterOps, call TranslationOps/StableIdManager directly, and keep their behavioral assertions intact.
  - Deleted the redundant diagnostic/migration suites and summarized their conclusions in `docs/INDEXEDDB-FACADE-MIGRATION.md` to prevent regressing on the documented fixes.
- Tests: Not run (archive suites remain opt-in)

2025-11-15 23:50 UTC - Draft legacy repo retirement plan
- Files: docs/LEGACY_REPO_RETIREMENT_PLAN.md (new); docs/REFACTORING_PLAN.md
- Why: Document the approved strategy for migrating/retiring the remaining archived repo-contract suites so we can delete `makeLegacyRepo` without surprises.
- Details:
  - Added a dedicated plan covering which archived tests migrate vs retire, the execution order, testing expectations, and risks.
  - Linked the refactoring plan’s legacy section to the new document so future work sees the dependency before removing the compatibility shim.
- Tests: Not run (documentation only)

2025-11-15 22:05 UTC - Translation persistence fully on ops layer
- Files: services/translationPersistenceService.ts; adapters/repo/index.ts; adapters/repo/TranslationsRepo.ts (deleted); docs/INDEXEDDB-FACADE-MIGRATION.md; docs/INDEXEDDB-DECOMPOSITION-PLAN.md; docs/REFACTORING_PLAN.md
- Why: TranslationPersistenceService still imported the legacy `TranslationsRepo` adapter, which was the last runtime dependency on the old facade. Switching it to `TranslationOps` lets us delete the adapter entirely and keeps persistence on the modern repo stack.
- Details:
  - TranslationPersistenceService now calls `TranslationOps.update/storeByStableId/setActiveByStableId` directly—no dynamic repo loading.
  - Removed `adapters/repo/TranslationsRepo.ts` and the export from `adapters/repo/index.ts`; updated docs/tracker to note the cleanup and adjust the adapter inventory.
  - Documented the change in the migration plan and decomposition plan so future work doesn't assume the adapter still exists.
- Tests: `npx tsc --noEmit`; `npm run test -- tests/store/bootstrap/bootstrapHelpers.test.ts --run`; `npm run test -- tests/services/exportService.test.ts --run`

2025-11-15 22:25 UTC - Remove unused settings/feedback/template adapters
- Files: adapters/repo/{SettingsRepo.ts,FeedbackRepo.ts,PromptTemplatesRepo.ts,DiffResultsRepo.ts}; adapters/repo/index.ts; docs/INDEXEDDB-FACADE-MIGRATION.md; docs/REFACTORING_PLAN.md
- Why: After the ops layer migration, those adapters were dead code (no runtime import paths). Dropping them avoids confusion and makes the adapter directory purely legacy (only `Repo.ts` left for archived tests).
- Details:
  - Deleted the three wrapper files plus the unused DiffResultsRepo helper; cleaned up `adapters/repo/index.ts`.
  - Updated the migration tracker + refactoring plan to show zero remaining adapters.
- Tests: `npx tsc --noEmit`; `npm run test -- tests/store/bootstrap/bootstrapHelpers.test.ts --run`; `npm run test -- tests/services/exportService.test.ts --run`

2025-11-15 23:10 UTC - Modernize archived translation contract suites
- Files: archive/tests/db/contracts/{translation-contracts.legacy.ts,translation-accurate.legacy.ts}
- Why: These suites still referenced the old `Repo` interface/makeRepo helper. Rewriting them to use `ChapterRepository`/`TranslationRepository` directly keeps the coverage relevant and lets us delete the adapters. They now spin up a fake IndexedDB instance per test and exercise the modern repositories end-to-end.
- Tests: `npx tsc --noEmit`

2025-11-13 21:05 UTC - Retire migration controller + simplify backend toggle
- Files: services/db/index.ts; services/db/migration/{phase-controller.ts,service-adapter.ts,shadow-validator.ts}; docs/INDEXEDDB-FACADE-MIGRATION.md; docs/ADDITIONAL-ARCHITECTURAL-ISSUES.md; docs/REMEDIATION-ROADMAP.md; docs/INDEXEDDB-DECOMPOSITION-PLAN.md; docs/REFACTORING_PLAN.md
- Why: The elaborate phase controller/shadow validator stack was never wired up. Replaced it with a single backend preference (env `DB_BACKEND` + localStorage `lf:db-backend`) so services hit the modern repo by default but can flip to legacy or memory when needed.
- Details:
  - Deleted the unused migration folder and all references; `services/db/index.ts` now exports a lightweight backend toggle plus simplified `dbUtils`.
  - Added `Backend`/`ServiceName` types inline, cached repo instances per backend, and persisted the selection to localStorage for manual rollbacks.
  - Updated docs (migration tracker, remediation roadmap, refactoring plan, decomposition plan, additional issues) to record the removal and describe the new toggle workflow.
- Tests: `npx tsc --noEmit`; `npm run test -- tests/store/bootstrap/bootstrapHelpers.test.ts --run`; `npm run test -- tests/services/exportService.test.ts --run`

2025-11-13 20:25 UTC - Ops layer fully decoupled from the facade
- Files: services/db/operations/{chapters.ts,translations.ts,imports.ts,maintenance.ts}; services/indexeddb.ts; services/db/core/connection.ts; docs/INDEXEDDB-FACADE-MIGRATION.md
- Why: Finish Batch 3 by removing the last direct `indexedDBService` imports inside the ops layer so all runtime reads/writes flow through the repository/txn helpers and the legacy facade becomes a thin compatibility shim.
- Details:
  - Dropped the `shouldUseLegacy` branches in `ChapterOps`/`TranslationOps` so they call the modern repositories exclusively (URL-mapping hygiene now lives inside `storeChapterModern`).
  - Rebuilt `ImportOps` to handle both full-session JSON imports and stable-session payloads using `getConnection` transactions, reusing the new progress hooks instead of the monolithic service.
  - Reimplemented `MaintenanceOps` (URL mapping backfill, stableId normalization, active-translation backfill, clear-all) on the transaction helpers and added `resetConnection()` to the shared connection module.
  - Pointed the legacy `indexedDBService` methods (imports, maintenance, clearing, exports) at the new ops so the facade only delegates work and no longer opens its own transactions.
  - Updated the migration tracker to note that the ops layer no longer references the facade.
- Tests: `npx tsc --noEmit`; `npm run test -- tests/services/exportService.test.ts --run`

2025-11-13 15:30 UTC - Stable ID + export pipeline off the facade
- Files: services/db/operations/mappings.ts; services/db/core/stable-ids.ts; services/db/operations/sessionExport.ts; services/db/index.ts; docs/INDEXEDDB-FACADE-MIGRATION.md
- Why: Finish the service-layer migration by removing the last direct `indexedDBService` imports (stable ID helper + session export bridge) so the facade is only referenced inside ops’ legacy branches.
- Details:
  - Reimplemented `MappingsOps` on top of the shared connection/txn helpers, adding stableId/index lookups used by `StableIdManager`.
  - Moved `StableIdManager` to the core layer’s transaction helpers instead of `importStableSessionData`, keeping URL mapping repairs entirely within the new architecture.
  - Wrote a proper `SessionExportOps` dependency bundle (settings, mappings, translations, feedback, diff results) so `services/db/index.ts` can export sessions without going through the facade.
  - Updated the migration tracker to note that no runtime services import the facade anymore.
- Tests: `npx tsc --noEmit`; `npm run test -- tests/services/exportService.test.ts --run`

2025-11-13 15:20 UTC - Batch 3 service cleanup: ops-only consumers
- Files: services/db/operations/translations.ts:190-203; services/imageMigrationService.ts:10-128; services/openrouterService.ts:1-159; services/providerCreditCacheService.ts:1-137; services/db/migrationService.ts:78-135; services/db/maintenanceService.ts:11-57; scripts/backfillChapterNumbers.ts:16-130; docs/INDEXEDDB-FACADE-MIGRATION.md
- Why: Continue the IndexedDB facade slim-down by moving straggling services/scripts onto the repository/ops layer and updating the tracker so the remaining call sites are obvious.
- Details:
  - Added `TranslationOps.update/getAll` (services/db/operations/translations.ts:190-203) so downstream services can mutate/fetch translations without touching the facade.
  - Swapped service-layer caches and migrations (`services/imageMigrationService.ts:10-128`, `services/openrouterService.ts:1-159`, `services/providerCreditCacheService.ts:1-137`, `services/db/migrationService.ts:78-135`, `services/db/maintenanceService.ts:11-57`) to the ops layer (`ChapterOps`, `TranslationOps`, `SettingsOps`, `FeedbackOps`).
  - Ported `scripts/backfillChapterNumbers.ts:16-130` to use `ChapterOps` + `recomputeChapterSummary` instead of raw IDB transactions, keeping summaries in sync.
  - Updated `docs/INDEXEDDB-FACADE-MIGRATION.md` with the reduced service inventory and the Batch 3 progress notes so future agents know what’s left.
- Tests: `npx tsc --noEmit`; `npm run test -- tests/services/exportService.test.ts --run`

2025-11-12 12:11 UTC - Fix initialization deadlock in schema verification
- Files: services/indexeddb.ts
- Why: App hung on "Initializing Session..." because ensureChapterSummaries() called openDatabase() recursively, creating a re-entrant call that never resolved.
- Details:
  - Modified ensureChapterSummaries() to pass the already-open database instance to seedChapterSummariesIfEmpty() instead of calling openDatabase() again.
  - This prevents the deadlock: openDatabase() → verifySchemaOrAutoMigrate() → ensureChapterSummaries() → openDatabase() [HANG].
- Tests: Manual verification needed - reload app and check initialization completes

2025-11-13 03:21 UTC - Batch 1 kickoff: bootstrap + import/export on ops layer
- Files: components/InputBar.tsx, components/NovelLibrary.tsx, services/importService.ts, services/exportService.ts, store/bootstrap/{initializeStore.ts,importSessionData.ts}, store/slices/exportSlice.ts, services/db/operations/{index.ts,maintenance.ts,imports.ts,navigation.ts,sessionExport.ts,rendering.ts}, tests/store/bootstrap/bootstrapHelpers.test.ts, tests/services/exportService.test.ts, docs/INDEXEDDB-FACADE-MIGRATION.md
- Why: Remove direct app usage of `indexedDBService` in bootstrap/import/export flows so the new repository/ops layer becomes the single integration point.
- Details:
  - Added Maintenance/Ops bridges (`MaintenanceOps`, `NavigationOps`, `ImportOps`, `SessionExportOps`, `fetchChaptersForReactRendering`) so clients call ops instead of the facade.
  - Rewired bootstrap + streaming import components and ExportService/export slice to use `ChapterOps`, `TranslationOps`, and the new helpers; dynamic rehydration now goes through `SettingsOps` + `fetchChaptersForReactRendering`.
  - Updated Vitest suites for bootstrap + export service to mock the ops instead of the facade.
- Tests: `npm run test -- tests/store/bootstrap/bootstrapHelpers.test.ts --run`; `npm run test -- tests/services/exportService.test.ts --run`; `npx tsc --noEmit`

2025-11-12 14:25 UTC - URL mapping backfill v2 + live upserts
- Files: services/indexeddb.ts, store/bootstrap/initializeStore.ts, tests/store/bootstrap/bootstrapHelpers.test.ts, types/playwright-test.d.ts
- Why: Translation version picker crashed (`No URL mapping for stableId …`) because new chapters weren’t writing to `url_mappings` once the legacy backfill flag flipped. We now upsert mappings every time a chapter is stored and introduced a versioned backfill so existing chapters regenerate their mappings without manual DB wipes.
- Details:
  - Added `buildUrlMappingEntries` + `upsertUrlMappingsForChapter` helpers, hooked them into `storeChapter`, and upgraded `backfillUrlMappingsFromChapters` to a versioned (v2) run that always replays unless the new setting is recorded.
  - initializeStore now unconditionally triggers the mapping backfill (the IndexedDB service logs whether it skipped or finished), ensuring fresh imports aren’t stuck behind stale flags.
  - Extended bootstrap tests to cover the “re-use templates” branch earlier; kept them green after the instrumentation changes.
  - Added a lightweight declaration stub for `@playwright/test` so `npx tsc --noEmit` stays green without installing Playwright in this sandbox (actual e2e runs still need the package installed).
- Tests: `npx tsc --noEmit`; `npm run test -- tests/store/bootstrap/bootstrapHelpers.test.ts --run`

2025-11-12 12:04 UTC - Schema migrations now own fresh installs (createSchema removed)
- Files: services/db/core/schema.ts, services/indexeddb.ts, tests/db/migrations/fresh-install.test.ts
- Why: Eliminated the legacy createSchema path so the migration stack is the single source of truth, ensuring fresh installs create novels/chapter_summaries/amendment_logs stores and preventing schema drift errors that blocked imports.
- Details:
  - Added `ensureStore` / `ensureIndex` helpers and rewrote migrations v1–v12 to use the upgrade transaction, creating every store/index (canonical URLs, amendment logs, diffResults) without ad-hoc transactions.
  - openDatabase’s upgrade handler now requires the migration transaction, and schema verification derives the store list from `STORE_NAMES`.
  - Retained the regression suite (`tests/db/migrations/fresh-install.test.ts`) to assert all 10 stores + critical indexes exist when running migrations alone.
- Tests: `npx tsc --noEmit`; `npm run test -- tests/db/migrations/fresh-install.test.ts --run`

2025-11-11 - TypeScript error reduction: Phase 1 & 2 complete (172 → 114 errors, 34% reduction)
- Files modified: services/indexeddb.ts, services/navigationService.ts, services/db/repositories/TranslationRepository.ts, services/importService.ts, services/stableIdService.ts, services/prompts/PromptRegistry.ts
- Purpose: Systematically reduce TypeScript errors by fixing critical API regressions from repository extraction, resolving type safety issues with legacy data coercion, and aligning interface mappings between database and application layers.
- Changes:
  - **Phase 1 (172→150, -22 errors):** Restored deleteChapter method deleted during refactoring; fixed .data accessor removal (translation.data.translatedContent → translation.translation); replaced activeTranslationId lookups with getActiveTranslation(); fixed createdAt → dateAdded property name; added DIFF_RESULTS to STORES constant; removed duplicate ChapterSummaryRecord export.
  - **Phase 2 (150→114, -36 errors):** Replaced boolean strict comparisons (v.isActive === true || v.isActive === 1) with Boolean(v.isActive) coercion for legacy data compatibility; eliminated {} fallback pattern (obj || {}) with optional chaining (obj?.property) to preserve type information across importService, navigationService, stableIdService; created mapEmojiToFeedbackType function for emoji → string type mapping; fixed isDefault number → boolean conversion; mapped PromptTemplateRecord (DB) → PromptTemplate (app) with proper field alignment (content → systemPrompt, ISO timestamps → numeric).
- Notes: Repository pattern extraction exposed hidden type safety issues that were previously masked; errors increasing from 138→172 initially was good (revealed real bugs). Fixed by using Boolean() coercion for legacy data (handles true/1/'true'), optional chaining instead of empty object fallbacks, and proper interface mapping. Created comprehensive planning docs: TYPESCRIPT-ERROR-ANALYSIS.md, TYPESCRIPT-FIX-PLAN.md, PHASE-3-ROADMAP.md.
- Tests: `npx tsc --noEmit 2>&1 | grep -c "error TS"` - verified error count reduction at each phase checkpoint

2025-10-27 01:32 UTC - Replace oboe importer with native streaming parser & improve UX telemetry
- Files modified: services/importService.ts; components/NovelLibrary.tsx
- Purpose: Drop the oboe/clarinet dependency so large translations no longer trip the 64 KB buffer cap; stream metadata + chapters via Fetch while preserving progressive hydration; log telemetry for first-batch/complete timings and surface quick-start toasts.
- Notes: Custom brace-aware parser feeds existing storage logic, new `FIRST_BATCH_THRESHOLD` reduces wait to 4 chapters, and completion toast now signals when everything is cached. TypeScript still flags legacy DTO shape mismatches (pre-existing).
- Tests: `npx tsc --noEmit | rg "importService"` *(fails: longstanding DTO typing issues unrelated to this change)*

2025-10-27 01:55 UTC - Guard image retries when model is disabled
- Files modified: store/slices/imageSlice.ts
- Purpose: Prevent illustration retries from calling providers when the selected model is `none`, surfacing a warning toast instead of logging errors.
- Notes: Skips API metrics/log spam and preserves existing image data; ImageGenerationService guard still handles legacy `'None'` casing.
- Tests: `npx tsc --noEmit | rg "imageSlice"` *(fails: pre-existing DTO typing warnings elsewhere)*

2025-10-27 00:48 UTC - Fix streaming hydration TDZ regression
- Files modified: components/NovelLibrary.tsx
- Purpose: Remove dynamic `useAppStore` re-import that triggered TDZ exceptions during `onFirstChaptersReady`, wrap initial hydration in try/catch, and surface warnings when the fast-path fails so readers aren’t blocked.
- Notes: Streaming import now proceeds to open the first chapters once threshold is reached; fallback notification appears if hydration still throws. TypeScript run still reports legacy NovelLibrary shape mismatches (pre-existing).
- Tests: `npx tsc --noEmit | rg "NovelLibrary"` *(fails: longstanding NovelLibrary DTO typing issues unrelated to this patch)*

2025-10-27 00:26 UTC - Automate Codex PR reviews
- Files modified: .github/workflows/codex-review.yml
- Purpose: Request Codex code reviews automatically for every non-draft PR unless labeled `skip-codex`.
- Notes: Workflow relies on repository secret `OPENAI_API_KEY`; optional label can suppress the run when needed. Trigger fires on open, reopen, synchronize, and ready_for_review events.
- Tests: GitHub Actions syntax validation pending (requires push to remote).

2025-10-27 00:09 UTC - Stabilize atomic translation writes & streaming import buffer
- Files modified: services/indexeddb.ts:1397-1520; services/importService.ts:368-438
- Purpose: Ensure `storeTranslationAtomic` always resolves a stableId before persisting new versions and expand streamed import buffer configuration to mitigate Clarinet’s 64KB string cap.
- Notes: Atomic path now mirrors legacy stableId derivation with a fallback hash on translation payloads; streaming importer hydrates oboe via options object (`cachedBufferSize` guard) and feeds ChapterOps with explicitly typed payloads to silence TS complaints.
- Tests: `npx tsc --noEmit` *(fails: longstanding repo-wide TS errors; verified no new diagnostics for indexeddb/importService via targeted grep)*

2025-10-19 06:18 UTC - Fix diff heatmap stylistic marker crash
- Files modified: .worktrees/semantic-diff-heatmap/components/ChapterView.tsx:1270-1285
- Purpose: Replaced stale `markerVisibility` guard with `markerVisibilitySettings` so grey-only markers no longer throw a ReferenceError when diff analysis completes.
- Notes: Runtime crash occurred after the diff prompt refactor when JSX retained the old variable name while visibility logic moved into `resolveMarkerVisibility`.
- Tests: `npx tsc --noEmit` *(fails: legacy audio storage + archived fixtures already contain invalid characters; unrelated to this change)*

2025-10-18 14:05 UTC - Add export options UI and telemetry-aware EPUB stats
- Files modified: components/SessionInfo.tsx; store/slices/exportSlice.ts; services/indexeddb.ts; services/epubService.ts; docs/EPUB.md; tests/current-system/export-import.test.ts; tests/store/nullSafety.test.ts
- Purpose: Let users choose which data (chapters, telemetry, illustrations) to include in JSON exports, surface size estimates, capture export timings, embed Cache API images when requested, and surface session telemetry aggregates inside the EPUB acknowledgments page.
- Notes: JSON export now waits for the IndexedDB snapshot, records `ux:export:*` telemetry, attaches image assets via `assets.images` when enabled, and the EPUB stats page highlights navigation/hydration/export durations recorded by telemetry. Modal UI disables illustration export unless chapters are included.
- Tests: `npm run test -- tests/current-system/export-import.test.ts --run`; `npm run test -- tests/store/nullSafety.test.ts --run`

2025-10-18 13:20 UTC - Instrument UX performance telemetry
- Files modified: services/navigationService.ts; services/indexeddb.ts; services/telemetryService.ts; components/ChapterView.tsx; components/SessionInfo.tsx
- Purpose: Captured navigation, hydration, fetch, and key UI readiness timings via `telemetryService`, persisted events into session exports for downstream analysis.
- Notes: Emitted `ux:*` performance events for chapter hydration, fetch, component mount/ready states, and initial IndexedDB hydration; export JSON now includes telemetry snapshot.
- Tests: Manual navigation + export in dev build to verify events appear in `window.exportTelemetry()` and JSON payload

2025-10-18 12:30 UTC - Build telemetry export dashboard scaffold
- Files modified: tools/telemetry-dashboard/index.html (new)
- Purpose: Added standalone HTML/JS viewer that ingests `lexiconforge-full-1` export JSON, aggregates chapter/provider metrics, and flags duplicate translation runs for cost investigations.
- Notes: Computes per-provider totals, per-chapter version tables, and duplicate fingerprints hashed on text+settings—all client-side with no build step.
- Tests: Manual browser load (Chrome) with sample export payload

2025-10-18 11:45 UTC - Diff heatmap alignment & model parity
- Files modified: services/diff/DiffAnalysisService.ts; services/diff/DiffTriggerService.ts; services/diff/types.ts; services/diff/constants.ts (new); services/diff/hash.ts (new); adapters/repo/DiffResultsRepo.ts; tests/services/diff/DiffAnalysisService.test.ts; tests/adapters/repo/DiffResultsRepo.test.ts; tests/db/diffResults.test.ts; hooks/useDiffMarkers.ts; components/diff/DiffGutter.tsx; components/ChapterView.tsx; services/navigationService.ts; services/translationService.ts; store/slices/translationsSlice.ts; tests/hooks/useDiffMarkers.test.tsx; docs updated.
- Purpose: Normalize paragraph chunking for diff markers, respect user-selected translation models with JSON fallback, allow manual diff reruns even when translation settings are unchanged, and add instrumentation for future diagnostics.
- Notes: Diff analysis now hashes HTML paragraphs, falls back to `gpt-4o-mini` on parse failure, and caches both IDs and hashes to prevent stale hits. UI gutter positions markers proportionally and retranslate button stays available when a translation exists.
- Tests: `npm run test -- --run`

2025-10-18 09:30 UTC - Finalize image version system QA
- Files modified: store/slices/exportSlice.ts:40-90, 186-246; tests/services/export/exportSlice.test.ts (new); docs/manual-tests/image-versioning.md (new)
- Purpose: Added caption helper tests, recorded manual QA checklist, and exported `buildImageCaption` for verification so the versioned illustration workflow has documented coverage.
- Notes: Manual checklist captures generate/retry/delete/export scenarios; helper test exercises metadata formatting.
- Tests: `npm run test -- tests/services/export/exportSlice.test.ts`

2025-10-18 13:32 UTC - Diff fallback explanation cleanup
- Files modified: services/diff/DiffAnalysisService.ts (lines ~30-320, ~420-480); components/ChapterView.tsx (lines ~140-200, ~1270-1290, export tail); services/diff/types.ts (lines ~15-25); tests/services/diff/DiffAnalysisService.test.ts (new fallback/explanation assertions); tests/components/diff/ChapterView.mapMarker.test.tsx (new); docs/WORKLOG.md.
- Purpose: Stop injecting the “No differences reported” text into every fallback marker, trim explanation strings, salvage freeform reason text or single-field explanations when the model deviates from the schema, and block inline grey copy unless there’s a meaningful explanation.
- Notes: Grey fallback markers now omit confidence values; hover tooltips continue to show “No explanation provided.” when empty. Added test exposure hook for mapMarkerForVisibility to assert trimming logic, service tests covering schema slip + single explanation field, wider LLM preview (2k chars), and a runtime warning when non-grey markers are missing explanations.
- Tests: `npm run test -- tests/services/diff/DiffAnalysisService.test.ts --run`; `npm run test -- tests/components/diff/ChapterView.mapMarker.test.tsx --run`; `npm run test`

2025-10-18 21:34 UTC - Diff prompt customization & color taxonomy overhaul
- Files modified: config/prompts.json; services/diff/DiffAnalysisService.ts; services/diff/DiffTriggerService.ts; services/diff/types.ts; services/sessionManagementService.ts; components/ChapterView.tsx; components/SettingsModal.tsx; components/diff/DiffPip.tsx; styles/diff-colors.css; tests/components/diff/DiffPip.test.tsx; docs/WORKLOG.md.
- Purpose: Encode the new red/orange/blue/purple schema, add grey fallbacks for every paragraph, surface the diff-analysis prompt in Settings with editing + reset controls, and ensure runtime honors customized prompts.
- Notes: LLM now omits grey chunks; service fills them locally, logs coverage gaps, and persists normalized markers. Settings migrate legacy visibility flags and expose legend + manual rerun.
- Tests: `npm run test -- tests/components/diff/DiffPip.test.tsx --run`; `npm run test -- tests/services/diff/DiffAnalysisService.test.ts --run`

2025-10-18 21:12 UTC - Diff heatmap settings relocation & manual refresh
- Files modified: components/SettingsModal.tsx (lines ~40-750); components/ChapterView.tsx (lines ~1030-1040); docs/WORKLOG.md.
- Purpose: Move diff heatmap controls into a dedicated Settings “Features” tab, add a manual diff cache invalidation/re-run button, and remove paragraph highlight flashes when clicking markers.
- Notes: Manual refresh deletes stored diff results then replays the `translation:complete` event so the trigger service recomputes markers.
- Tests: Pending (UI change only; manual verification recommended)

2025-10-18 20:57 UTC - Block unsupported fetch attempts
- Files modified: services/navigationService.ts (guard added at line 403); docs/WORKLOG.md
- Purpose: Reintroduce the supported-site check so `handleFetch` short-circuits on domains without adapters instead of hammering the proxy rotation.
- Notes: Aligns worktree behaviour with mainline navigation flow; unsupported URLs now throw immediately.
- Tests: `npm run test -- tests/current-system/navigation.test.ts --run`

2025-10-18 20:34 UTC - Diff heatmap UI rail refactor
- Files modified: components/ChapterView.tsx (paragraph layout & marker rail); components/diff/DiffPip.tsx (color normalization); styles/diff-colors.css (blue variable); docs/WORKLOG.md.
- Purpose: Relocate diff markers to a right-aligned rail, add vertical spacing between paragraphs, and remove hover-based highlighting so the reading experience stays uncluttered.
- Notes: Paragraph wrappers now provide padding and an absolute marker column; invisible placeholders maintain alignment when no markers are present.
- Tests: `npm run test -- tests/components/diff/DiffPip.test.tsx --run`

2025-10-18 20:26 UTC - Diff heatmap visibility controls & palette refresh
- Files modified: types.ts (AppSettings + visibility type); services/sessionManagementService.ts (default settings); components/SettingsModal.tsx (new toggles); components/ChapterView.tsx (visibility filtering & new colors); components/diff/DiffPip.tsx, components/diff/DiffPip.module.css (color normalization); styles/diff-colors.css (blue palette); tests/components/diff/DiffPip.test.tsx.
- Purpose: Add per-category visibility toggles (fan/raw/stylistic) defaulting grey off, remap raw differences to blue, and filter hidden categories ahead of rendering/navigation.
- Notes: Visible markers now derive colors from reasons, ensuring cached results adopt the new orange/blue scheme even if stored colors differ.
- Tests: `npm run test -- tests/components/diff/DiffPip.test.tsx --run`

2025-10-18 20:12 UTC - Diff analysis logging instrumentation
- Files modified: services/diff/DiffAnalysisService.ts (diagnostic helpers added around lines 20-120); docs/WORKLOG.md
- Purpose: Gate prompt/response previews behind the diff debug pipeline, surface chunk/marker coverage summaries, and warn when markers reference missing or out-of-range chunks.
- Notes: New logs emit start/end previews alongside payload length without altering existing console summaries.
- Tests: `npm run test -- tests/services/diff/DiffAnalysisService.test.ts --run`

2025-10-15 08:07 UTC - Enforce structured Gemini JSON responses
- Files modified: services/translate/translationResponseSchema.ts:1-150, adapters/providers/GeminiAdapter.ts:1-240, adapters/providers/OpenAIAdapter.ts:1-360, services/translate/Translator.ts:70-140
- Purpose: Shared the translation response schema across adapters, required Gemini to emit `application/json` with the schema, and stopped retrying after schema parse failures.
- Notes: Gemini adapter now mirrors OpenAI’s usage metrics fields and keeps legacy aliases (`illustrations`/`amendments`) for downstream compatibility.
- Tests: Not run (manual validation required for SDK calls)

2025-10-15 01:58 UTC - Add Gemini raw response debug logging
- Files modified: adapters/providers/GeminiAdapter.ts:17-60, 125-180
- Purpose: Gate Gemini adapter debug output on `LF_AI_DEBUG_LEVEL` and emit raw response previews/full dumps when JSON parsing fails so we can inspect malformed payloads.
- Notes: Preview logs print first 500–800 chars by default; full body requires setting `LF_AI_DEBUG_LEVEL=full`.
- Tests: Not run (logging only)

2025-10-14 06:00 UTC - Archive legacy amendment proposal diagnostics
- Files modified: archive/tests/store/amendmentProposal.legacy.test.ts:1-199, tests/store/amendmentProposal.test.ts:33-86
- Purpose: Preserved the eight skipped legacy diagnostics in an archived suite while trimming the active amendment proposal tests down to the current slice-based coverage.
- Notes: Archived suite sits behind `describe.skip` to keep history without polluting the run; active suite now focuses on accept/reject/edit plus IndexedDB logging behaviour.
- Tests: Not run (legacy archive remains skipped)

2025-10-13 17:59 UTC - Restore amendment logging test harness stability
- Files modified: services/indexeddb.ts:482-493, tests/store/amendmentProposal.test.ts:1-14, 340-414
- Purpose: Reinstated the `hasTranslation` index while wiring tests to use an in-memory fake IndexedDB so migration v11 can be exercised without schema drift blocking the suite.
- Notes: Test setup now clears the fake database via `indexedDBService.clearAllData()` before each run to keep action logs isolated.
- Tests: `npm run test -- tests/store/amendmentProposal.test.ts --run`

2025-10-13 18:10 UTC - Refresh README marketing copy
- Files modified: README.md:4-107
- Purpose: Surface live hosted app link, Patreon concierge program, numbered feedback workflow, and inline feature imagery pulled from `Marketing/Features/`.
- Notes: Added CTA block, image gallery (emoji toolbar, models, comparison, art), and consolidated Patreon references in community/support sections.
- Tests: Not applicable

2025-10-13 18:45 UTC - Test suite census groundwork
- Files modified: docs/TEST_MANIFEST.md
- Purpose: Catalogued every suite under `tests/`, annotated current health (pass/fail/unknown/obsolete), and flagged legacy specs tied to the pre-split store or deleted prompt helpers.
- Notes: Marked critical failures (nullSafety, jobsSlice, translator, templates, cost-calculation, navigation) for rewrite; `tests/store/useAppStore.test.ts` and prompt builder suites recorded as obsolete.
- Tests: Not applicable

2025-10-13 19:05 UTC - Rewrite null safety regression suite
- Files modified: tests/store/nullSafety.test.ts, docs/TEST_MANIFEST.md
- Purpose: Ported the null-safety tests to the slice-based store, verifying chaptersSlice/error handling, translation history filters, and export snapshots without relying on legacy `sessionData`.
- Notes: Mocked NavigationService to exercise error paths; history expectations now require numbered chapters; manifest updated to reflect passing status.
- Tests: `npm run test -- tests/store/nullSafety.test.ts --run`

2025-10-13 19:20 UTC - Modernise jobs slice tests
- Files modified: tests/store/slices/jobsSlice.test.ts, docs/TEST_MANIFEST.md
- Purpose: Replaced the legacy worker-heavy spec with coverage that matches the current slice (add/update/remove, clear helpers, control flow, selectors, and placeholder worker hooks).
- Notes: Added a lightweight slice harness without mocking zustand internals; worker APIs now asserted to be no-ops rather than fabricating fake workers.
- Tests: `npm run test -- tests/store/slices/jobsSlice.test.ts --run`

2025-10-13 19:30 UTC - Align Translator tests with abort & retry behaviour
- Files modified: tests/services/translate/Translator.test.ts, docs/TEST_MANIFEST.md
- Purpose: Updated the translator spec to match the current abort message and confirmed sanitization/retry flows with the new orchestrator.
- Notes: The mock provider now respects the “Translation was aborted by user” contract while keeping sanitizer assertions intact.
- Tests: `npm run test -- tests/services/translate/Translator.test.ts --run`

2025-10-13 19:40 UTC - Refresh EPUB template expectations
- Files modified: tests/services/epub/Templates.test.ts, docs/TEST_MANIFEST.md
- Purpose: Relaxed numeric assertions to tolerate locale-specific formatting and verified the modern footer/stats layout.
- Notes: Added helper to accept `Intl` variations (en-US, en-IN, fr-FR, de-DE, ja-JP).
- Tests: `npm run test -- tests/services/epub/Templates.test.ts --run`

2025-10-13 19:42 UTC - Confirm structured-output schema coverage
- Files modified: docs/TEST_MANIFEST.md
- Purpose: Verified that the structured output tests still align with the generated prompt schema and marked the manifest entry as passing.
- Notes: No code changes required; updated manifest only.
- Tests: `npm run test -- tests/services/structured-outputs.test.ts --run`

2025-10-13 19:55 UTC - Rebuild cost-calculation integration suite
- Files modified: tests/current-system/cost-calculation.test.ts, docs/TEST_MANIFEST.md
- Purpose: Ported cost tests to the async `calculateCost` API, covering Gemini/OpenAI/DeepSeek pricing, OpenRouter dynamic rates, and image model pricing.
- Notes: Added helper to reuse expected formulas and removed stale references to legacy pricing helpers.
- Tests: `npm run test -- tests/current-system/cost-calculation.test.ts --run`

2025-10-13 20:05 UTC - Simplify navigation integration tests
- Files modified: tests/current-system/navigation.test.ts, docs/TEST_MANIFEST.md
- Purpose: Replaced brittle mocks with targeted assertions around `NavigationService.isValidUrl` and the store’s `handleFetch` integration (success/error cases).
- Notes: Enhanced chapters are fabricated via helpers; error paths now assert on the UI slice state instead of expecting old logs.
- Tests: `npm run test -- tests/current-system/navigation.test.ts --run`

2025-10-13 20:15 UTC - Add HTML repair regression tests
- Files modified: services/translate/HtmlRepairService.ts, tests/services/HtmlRepairService.test.ts
- Purpose: Ensured the HTML repair pipeline covers the documented formatting issues (capital `<I>` tags, `<hr>` variants, illustration markers, scene breaks, and dangling closing italics).
- Notes: Introduced a helper to fix leading closing tags before the existing unclosed-tag repair.
- Tests: `npm run test -- tests/services/HtmlRepairService.test.ts --run`

2025-10-14 07:13 UTC - Refresh settings persistence suite
- Files modified: tests/current-system/settings.test.ts, docs/TEST_MANIFEST.md
- Purpose: Rebuilt the settings tests around the slice-based store, covering persistence, load, defaults, translation-change detection, and localStorage failure handling.
- Notes: Added helper to fabricate chapters with snapshot metadata; storage mocks now applied per-test.
- Tests: `npm run test -- tests/current-system/settings.test.ts --run`

2025-10-14 07:17 UTC - Modernize translation flow tests
- Files modified: tests/current-system/translation.test.ts, docs/TEST_MANIFEST.md
- Purpose: Stubbed `TranslationService` and IndexedDB calls to validate successful translations, early exits when versions exist, error reporting, and abort handling.
- Notes: Simplified fixtures by injecting enhanced chapters into the store; translation progress assertions now follow slice behaviour.
- Tests: `npm run test -- tests/current-system/translation.test.ts --run`

2025-10-14 07:19 UTC - Rebuild export/import tests
- Files modified: tests/current-system/export-import.test.ts, docs/TEST_MANIFEST.md
- Purpose: Covered JSON snapshot export and full-session import using mocked IndexedDB services; verified error handling for malformed payloads.
- Notes: Export tests operate on the in-memory chapters map; import tests assert navigation history hydration.
- Tests: `npm run test -- tests/current-system/export-import.test.ts --run`

2025-10-14 07:21 UTC - Verify provider initialization
- Files modified: tests/current-system/providers.test.ts, docs/TEST_MANIFEST.md
- Purpose: Added a lightweight check ensuring `initializeProviders` registers all adapters with the translator singleton.
- Notes: Keeps provider coverage aligned with the refactored adapter architecture.
- Tests: `npm run test -- tests/current-system/providers.test.ts --run`

2025-10-14 07:23 UTC - Retire legacy DB contract suites
- Files modified: docs/TEST_MANIFEST.md
- Purpose: Marked the legacy IndexedDB contract tests as obsolete—they exercise the deprecated monolithic repo interface and no longer reflect the slice/IDB architecture.
- Notes: Future persistence coverage will focus on the new schema/migration tooling instead.
- Tests: Not applicable

2025-10-14 07:28 UTC - Rewrite feedback integration tests
- Files modified: tests/current-system/feedback.test.ts, docs/TEST_MANIFEST.md
- Purpose: Simplified feedback tests to assert the modern slice API (submit/update/delete) against the chapters map and feedback history.
- Notes: Removed dependencies on legacy `sessionData` and inline selectors.
- Tests: `npm run test -- --run`

2025-10-13 14:12 UTC - Switch comparison flow to contextual excerpts
- Files modified: config/prompts.json:38-74, services/comparisonService.ts:1-177, components/ChapterView.tsx:1-1390, services/translationService.ts:133-150, services/navigationService.ts:26-95, services/indexeddb.ts:17-110, types.ts:124-142
- Purpose: Replace chunk-based alignment caching with a focused compare API that returns fan translation context + raw snippet, simplifying the UI and avoiding brittle chunk maps.
- Notes: Added markdown-fence stripping in the service, removed all `fanAlignment` plumbing, reworked the comparison UI into an inline collapsible card with raw/fan toggle, and left a persistent reopen affordance instead of a transient overlay.
- Tests: Not run (API + UI wiring change)

2025-10-13 13:24 UTC - Restore translation metadata during hydration
- Files modified: services/navigationService.ts:26-85, services/navigationService.ts:154-176, services/navigationService.ts:520-572
- Purpose: Ensure chapters loaded from IndexedDB keep their translation IDs/versions so comparison and versioned workflows can identify the active translation. Adds a helper to adapt `TranslationRecord` → `translationResult` while preserving metadata and providing a deterministic fallback ID if legacy data lacks one.
- Notes: Console warns when relying on the fallback key, signaling legacy records that still need persistence repair.
- Tests: Not run (logic wiring only)

2025-10-13 12:19 UTC - Quiet ChapterView footnote diagnostics
- Files modified: components/ChapterView.tsx:129-137, components/ChapterView.tsx:865-872
- Purpose: Commented noisy footnote tokenization/render logs to keep the console readable during normal navigation while preserving the code for future diagnostics.
- Notes: Enable by uncommenting the existing `console.log` calls if deeper tracing is required.
- Tests: Not run (log-only change)

2025-10-13 06:15 UTC - Normalize illustration marker handling
- Files modified: components/Illustration.tsx:1-520
- Purpose: Allow illustration components to reconcile `[ILLUSTRATION-*]` markers stored in translations with marker tokens rendered in the reader. Adds marker normalization, fallback key matching for cached image state, and ensures retry/edit actions use the canonical placement marker.
- Notes: Cache-backed images now hydrate in ChapterView without requiring regeneration; retry/edit flows reuse the original placement marker to avoid mismatches.
- Tests: `npx tsc --noEmit` *(blocked by sandbox, manual run recommended)*

2025-10-13 05:24 UTC - Extend provider credit summaries
- Files modified: services/providerCreditCacheService.ts:1-180, store/slices/settingsSlice.ts:1-360, components/SettingsModal.tsx:1-1740, components/SettingsModal.test.tsx:1-240
- Purpose: Persist DeepSeek and PiAPI balances (IndexedDB cache) and surface them alongside OpenRouter credits. Hide OpenAI usage controls until a backend proxy exists.
- Behavior: Added shared credit fetchers (DeepSeek `/user/balance`, PiAPI `/account/info`), cached summaries in IndexedDB, manual refresh buttons + formatted readouts under each key, static guidance for OpenAI.
- Tests: `npx vitest run components/SettingsModal.test.tsx`

2025-10-13 04:58 UTC - Align SettingsModal tests with modular store
- Files modified: components/SettingsModal.test.tsx:1-140
- Purpose: Mock the aggregated `../store` module (post-monolith split) so SettingsModal tests see configured API keys and remain deterministic after the OpenRouter credit UI changes.
- Behavior: Tests construct a reusable store mock factory, expose the mocked `useAppStore` for per-spec overrides, and unmount rendered components to avoid bleed-over.
- Notes: happy-dom dev dependency bumped to ^20 via npm install (user-applied) ahead of addressing upstream security advisory; retesting needed once mocks settle.
- Tests: `npx vitest run components/SettingsModal.test.tsx` (pass)

2025-10-13 04:30 UTC - Show OpenRouter credit balance
- Files modified: services/openrouterService.ts:23-141, store/slices/settingsSlice.ts:1-60, components/SettingsModal.tsx:1-920
- Purpose: Switch OpenRouter credit refresh to the documented `/api/v1/credits` endpoint and surface remaining purchased credits in the settings modal instead of the legacy rate-limit limit field. Added a legacy fallback if the new endpoint fails.
- Behavior: UI now reports `Credits remaining` with optional total purchased amount and timestamp; service caches unified credit data while mirroring legacy fields for backward compatibility.
- Tests: `npx vitest run components/SettingsModal.test.tsx` *(fails: missing @testing-library/react dependency in node_modules)*

2025-08-30 16:40 UTC - Diagnostic silence edits
- Files modified: components/ChapterView.tsx, services/navigationService.ts, services/importTransformationService.ts
- Purpose: Reduce console noise by muting verbose informational `console.log` statements. Kept `console.error`/`console.warn` intact for visibility of real problems. No behavioral changes intended.

Next: After running with reduced logs, gather traces for 'Chapter not found' and decide where to add targeted diagnostics.


2025-08-30 17:10 UTC - Hydration tracing and UI guard
- Files modified: services/navigationService.ts (timestamped logs), store/slices/chaptersSlice.ts (timestamped setCurrentChapter log), components/ChapterView.tsx (UI guard while hydrating)
- Purpose: Add lightweight diagnostics to trace navigation → setCurrentChapter → IDB hydration ordering, and mute noisy missing-chapter error while hydration is in-flight.
- Behavior: No functional change to navigation/hydration; ChapterView suppresses console.error when `hydratingChapters[currentChapterId]` is truthy. Diagnostic logs are plain console.logs (visible in dev) to allow quick reproduction.
- Next: Reproduce and collect ordered traces. If confirmed, consider propagating a single `navTraceId` for richer correlation.


2025-08-30 17:40 UTC - Increase explanation max tokens
- File modified: services/explanationService.ts
- Change: Increased `max_tokens` from 500 to 1000 to allow more detailed generated explanation footnotes.
- Reason: 500 was too small for some explanatory footnotes; aligning with higher token budgets improves quality.

2025-08-30 17:55 UTC - Fix client-side require usage
- File modified: store/slices/translationsSlice.ts
- Change: Replaced `require('../../adapters/repo')` with dynamic ESM `import('../../adapters/repo')` to avoid `ReferenceError: require is not defined` in browser environments.
- Reason: `require` is CommonJS and not available in browser bundles; dynamic import defers loading the module and keeps behavior identical in Node and browser.

2025-08-30 18:05 UTC - Align explanation max tokens with global setting
- File modified: services/explanationService.ts
- Change: Use `settings.maxOutputTokens` as an upper bound for explanation `max_tokens`; keep a default per-call cap of 1000 but allow higher when global setting allows.
- Reason: Some footnotes were truncated; this change allows the explanation service to use the global token budget when configured.

2025-08-30 18:18 UTC - Explanation service now uses full global max tokens
- File modified: services/explanationService.ts
- Change: `max_tokens` now set to `settings.maxOutputTokens` (clamped) for full-length footnotes.
- Reason: User requested full global token budget for elaborate footnotes.

2025-08-30 19:05 UTC - Centralize translation persistence
- Files modified: services/translationPersistenceService.ts (new), store/slices/translationsSlice.ts:12,303-366,624-707
- Purpose: Replace browser-only `require` usage with a service that handles repo loading and logs persistence results, ensuring footnote/illustration updates persist without runtime errors.

2025-08-30 19:20 UTC - Ensure auto-translate triggers after hydration
- Files modified: App.tsx:20-113
- Purpose: Added a store selector tracking whether the current chapter is loaded so the translation effect runs once hydration completes instead of requiring manual retry.

2025-08-30 19:28 UTC - Replace CommonJS requires in DB repo
- Files modified: services/db/index.ts:9-93,204-238
- Purpose: Hoisted operations imports to module scope so the IDB repo works in Vite’s ESM bundle instead of throwing `require is not defined` during persistence calls.

2025-08-30 19:40 UTC - Keep translation versions stable for metadata edits
- Files modified: services/translationService.ts:123-142, store/slices/imageSlice.ts:11,478-511, services/imageGenerationService.ts:15,189-214
- Purpose: Capture stored translation IDs immediately and route footnote/image updates through the persistence helper so metadata changes mutate in place instead of spawning new versions.

2025-08-30 20:10 UTC - Inline edit reaction for translations
- Files modified: components/ChapterView.tsx:1-870, components/FeedbackPopover.tsx:1-52, components/SessionInfo.tsx:220-332, services/translationPersistenceService.ts:1-118, services/indexeddb.ts:73-1040, services/translationService.ts:120-142, store/slices/imageSlice.ts:1-520, services/imageGenerationService.ts:1-330
- Purpose: Tokenize rendered translations into editable chunks, add an inline edit option in the reaction tray with save/new-version controls, and surface custom version labels across the UI.

2025-08-30 20:25 UTC - Guard duplicate translations
- Files modified: store/slices/translationsSlice.ts:80-220, store/slices/chaptersSlice.ts:520-620, App.tsx:70-140
- Purpose: Track pending translation requests and short-circuit both the auto-translate effect and prefetch worker when a job or persisted version already exists, avoiding duplicate API calls.

2025-08-30 20:35 UTC - Fix inline edit chunk resolution
- Files modified: components/ChapterView.tsx:400-430
- Purpose: Ensure text-node selections resolve to their enclosing chunk spans so inline editing activates correctly.

2025-08-30 22:05 UTC - Memory telemetry scaffolding
- Files modified: utils/debug.ts, utils/memoryDiagnostics.ts (new), services/indexeddb.ts, services/navigationService.ts, store/slices/chaptersSlice.ts, components/SettingsModal.tsx
- Purpose: Introduce dedicated memory debug pipeline with helper utilities, wrap heavy chapter hydration paths with gated timing logs, and surface chapter cache size changes so upcoming eviction logic has observability.
- Notes: Memory logs remain silent unless the new "Memory / cache" pipeline is enabled alongside Summary/Full logging.

2025-08-30 22:40 UTC - Chapter summary API for lightweight hydration
- Files modified: services/indexeddb.ts, services/importTransformationService.ts, components/SessionInfo.tsx, types.ts
- Purpose: Added a dedicated chapter summaries store with automatic backfill/write-through updates, exposed `getChapterSummaries()` for list rendering, and migrated SessionInfo’s dropdown to the metadata slice with a loading state.
- Notes: Summary records track canonical URL, translation/image flags, and timestamps; cache writes trigger recomputation after chapter/translation mutations.

2025-08-30 22:55 UTC - Context hydration fallback fixes
- Files modified: services/indexeddb.ts, services/translationService.ts
- Purpose: Hardened summary initialization for legacy data, added `ensureActiveTranslationByStableId`, and taught the translation history builder to hydrate missing context chapters from IndexedDB (promoting the latest version when no active flag exists).
- Notes: History diagnostics now rely on the new helpers, avoiding bulk `getAllChapters()` scans and preventing redundant re-translation calls.

2025-08-30 23:05 UTC - Image diagnostics logging
- Files modified: store/slices/imageSlice.ts, services/imageGenerationService.ts
- Purpose: Added gated debug logs for image hydration, prompt payloads, and retry/generation flows so we can verify Phase 1 didn’t regress image features.
- Notes: Logs emit under the existing `image` pipeline (Summary/Full levels) and avoid dumping base64 payloads.

2025-08-30 23:15 UTC - Steering image list fallback
- File modified: scripts/generate-steering-image-list.cjs
- Purpose: Guarded the steering image script so builds succeed even when `public/steering` is absent (writes an empty list instead of throwing).

2025-08-30 23:20 UTC - Debug logging introspection
- Files modified: utils/debug.ts, components/SettingsModal.tsx
- Purpose: Added a helper to print the current logging level/pipelines whenever developer logging settings change so it’s obvious which gates are active.

2025-08-30 21:15 UTC - Granular debug pipeline toggles
- Files modified: utils/debug.ts (new), components/SettingsModal.tsx, services/indexeddb.ts, services/comparisonService.ts
- Purpose: Replace the single logging gate with pipeline-specific checkboxes and shared helpers so developers can enable IndexedDB, comparison, worker, audio, or translation logs individually without dumping massive payloads by default.

2025-08-30 20:55 UTC - Add fan translation comparison flow
- Files modified: components/ChapterView.tsx, components/FeedbackPopover.tsx, components/icons/CompareIcon.tsx (new), services/comparisonService.ts (new), services/indexeddb.ts, services/translationPersistenceService.ts, services/translationService.ts, store/slices/translationsSlice.ts, store/slices/chaptersSlice.ts, types.ts, App.tsx
- Purpose: Tokenize and cache chunk metadata for both translation and fan text, provide a toolbar action to fetch a single alignment map per chapter, cache/persist the results, and render a collapsible inline panel showing matching fan sentences with guards against duplicate requests.

2025-08-30 18:30 UTC - Diagnostic logging for illustration insertion
- File modified: store/slices/translationsSlice.ts
- Change: Add console logs after updating chapter to print `suggestedIllustrations` and whether the placement marker was inserted; log persistence results (stored id or update confirmation) and merge persisted translationResult into state.
- Reason: Quickly surface whether markers/prompts are present in-memory and whether persistence succeeded.

2025-09-25 18:40 UTC - Session wrap-up / investigation parking lot
- Phase coverage: Completed Phase 0 telemetry plumbing and Phase 1 summary API rollout; validated sequential translation queue + IDB hydration fixes during long session.
- Logging state: Developer logging panel now prints the active level/pipelines on change (`DebugConfig` log). Current run used level=full with all pipelines (indexeddb, comparison, worker, translation, image, audio, memory) enabled.
- Memory diagnostics: Observed `chapters.loadFromIDB` cache events while paging through chapters; sequential translate queue prevented duplicate jobs. No eviction logic implemented yet—Phase 2 will introduce window-size slider + pinning.
- Image investigation: Added gated logs (`image` pipeline) around hydration/generation. Need to revisit hydrated chapters after import to confirm `suggestedIllustrations` -> `generatedImages` handshake still renders. Chapter selection is manual post-import (session does not auto-focus a chapter).
- Import workflow: JSON import pushes chapters/translations straight into IDB, but translations + media hydrate lazily on first navigation. Summaries API populates SessionInfo with metadata only.
- Build health: `scripts/generate-steering-image-list.cjs` now handles missing `public/steering/` by emitting an empty list, unblocking Vercel builds without checking in sensitive assets.
- Tailwind note: Still warning about CDN usage; migrate to PostCSS/CLI in a later pass.
- Next resume checklist:
  1. Re-open a chapter with known illustrations, confirm hydration logs + UI render stored art.
  2. Design Phase 2 UI (cache window slider + pin toggle) and wire eviction bookkeeping.
  3. Consider auto-selecting a chapter post-import or surfacing a prompt so users immediately load content.
  4. (Optional) Plan Tailwind build migration and finalize instrumentation for image latency/cost tracking.


2025-10-12 15:22 UTC - Formalize IndexedDB schema to v9
- Files modified: services/db/core/schema.ts, services/db/core/connection.ts, services/indexeddb.ts, utils/debug.ts
- Summary: Codified schema versions 7–9 (canonical stores + index backfills + no-op legacy cap), aligned SCHEMA_VERSIONS.CURRENT with the highest legacy auto-migrated version (9), routed DB version constants through the shared schema module, and restored the IndexedDB debug helper.
- Notes: Existing browsers auto-migrate on next load; if someone somehow landed above v9 in earlier dev builds, have them reload or clear the `lexicon-forge` DB once. Follow-up: revisit legacy store-based tests that still assume pre-refactor APIs.

2025-10-13 09:30 UTC - Golden test harness cassette replay
- Files modified: tests/gold/diff/diff-golden.test.ts, tests/gold/diff/SimpleLLMAdapter.ts
- Purpose: Allow golden tests to run in replay mode without `OPENROUTER_API_KEY` by always wiring the SimpleLLMAdapter (with placeholder key) and removing the skip guards. Added a protective check so live recording (`LIVE_API_TEST=1`) still demands a real API key.
- Next steps: Record cassettes for cases 002–007 with `LIVE_API_TEST=1 OPENROUTER_API_KEY=…`, regenerate diagnostics, and rerun the suite in replay mode to confirm the aggregate F1 gate.

2025-10-13 09:40 UTC - Golden dataset live run + replay verification
- Files modified: tests/gold/diff/diff-golden.test.ts (timeouts), PHASE_2_GOLDEN_TEST_LEARNINGS.md
- Purpose: Recorded OpenRouter cassettes for cases 001–007, regenerated diagnostics, expanded the learnings doc with per-case metrics, and raised golden test timeouts to accommodate live calls (aggregate gate now 60s).
- Validation: `LIVE_API_TEST=1 OPENROUTER_API_KEY=… npm test tests/gold/diff/diff-golden.test.ts -- --run` (records) followed by `npm test tests/gold/diff/diff-golden.test.ts -- --run` (replay) both succeed; aggregate F1 = 1.0.

2025-10-13 10:00 UTC - aiService + adapter coverage lift
- Files modified: services/aiService.ts, tests/services/aiService.internal.test.ts (new), tests/services/aiService.translateChapter.test.ts (new), tests/services/aiService.providers.test.ts (new), tests/adapters/providers/{ClaudeAdapter,GeminiAdapter,OpenAIAdapter}.test.ts (new)
- Purpose: Exposed internal helpers for focused testing, added unit suites covering illustration/footnote reconciliation, translateChapter default-key accounting, and legacy provider flows. Added adapter-level mocks to exercise JSON parsing, parameter retry, and metrics recording.
- Result: `npm test -- --coverage --run` now passes provider thresholds (aiService lines 43% vs. 16% prior; each adapter ≥50% lines / ≥40% funcs).

2025-10-13 11:30 UTC - aiService decomposition kickoff
- Files modified: services/aiService.ts (refactored to aggregator), services/ai/* (new modules), services/ai/providers/{gemini,openai}.ts (new), services/ai/translatorRouter.ts (new), tests/services/aiService.* (updated via aggregator)
- Purpose: Split aiService into modular helpers (debug, params, text utils, cost), provider-specific translators, and a dedicated translation router; align with refactoring plan thresholds (<200 LOC per service).
- Tests: `npm test -- --coverage --run`

2025-10-13 12:05 UTC - ChapterOps IndexedDB path (feature-flagged)
- Files modified: services/db/operations/chapters.ts (rewritten), services/db/utils/featureFlags.ts (new)
- Purpose: Implement direct IndexedDB reads/writes for chapter operations while keeping legacy `indexedDBService` path behind a runtime flag (`LF_DB_V2_DOMAINS`, localStorage overrides). Writes canonical URL mappings and chapter summaries in the new path.
- Tests: `npm test -- --coverage --run`

2025-10-13 12:40 UTC - TranslationOps IndexedDB path (feature-flagged)
- Files modified: services/db/operations/translations.ts (rewritten), services/db/operations/chapters.ts (exports for shared helpers)
- Purpose: Add modern translation persistence (versioning, active flag) using direct IndexedDB transactions with capability flag gating; summary recalculation and URL mapping updates now run without touching legacy pathways unless flag disabled.
- Tests: `npm test -- --coverage --run`

2025-10-13 13:05 UTC - Stream importer loads exported translations
- Files modified: services/importService.ts
- Purpose: Recognize the v2 export format (`chapters[].translations`) during streamed imports, store chapters via ChapterOps, persist each translation via TranslationOps, and reactivate the original active version so English text populates after loading GitHub sessions.
- Tests: `npm test -- --coverage --run`

2025-11-10 15:00 UTC - Day 1 tech debt kickoff: OpenAI typing fixes + IndexedDB harness
- Files modified: services/explanationService.ts, services/illustrationService.ts, services/db/interfaces/IIndexedDBService.ts, services/db/__mocks__/MockIndexedDBService.ts, tests/services/db/indexedDBService.interface.test.ts
- Summary: Typed all OpenAI chat requests via `ChatCompletionMessageParam` + explicit request params, hardened finish_reason logging, and introduced an IndexedDB service interface with an in-memory mock plus 8 contract tests to provide a safety net ahead of monolith decomposition.
- Tests: `npx vitest run tests/services/db/indexedDBService.interface.test.ts`
2025-11-10 15:30 UTC - LOC guardrail + small-service strict typing
- Files modified: package.json, scripts/check-loc.js, services/env.ts, services/stableIdService.ts, services/telemetryService.ts, services/imageCacheService.ts, services/illustrationService.ts, services/db/interfaces/IIndexedDBService.ts, services/db/__mocks__/MockIndexedDBService.ts, tests/services/db/indexedDBService.interface.test.ts
- Summary: Added `npm run check:loc` guardrail (warning-only) with per-directory limits, removed all `any` usage from env/stableId/telemetry services, introduced typed IndexedDB feedback signatures, hardened image cache telemetry payloads, and kept the new IndexedDB interface tests green.
- Tests: `npm run check:loc`, `npx vitest run tests/services/db/indexedDBService.interface.test.ts`
2025-11-10 16:10 UTC - Day 3 documentation pass
- Files added: docs/ARCHITECTURE.md, docs/INDEXEDDB-DECOMPOSITION-PLAN.md, docs/COMPONENT-DECOMPOSITION-PLAN.md
- Summary: Captured current system data flow, state/service dependencies, and dual-write behavior; documented IndexedDB monolith method groupings with extraction plan + verification strategy; produced UI decomposition roadmap for SettingsModal (7 panels + hooks) and ChapterView (tokenizer + sub-components).
- Notes: These docs are the source of truth for upcoming refactors—update them whenever a repository/panel lands so future agents stay aligned.
2025-11-10 16:45 UTC - ChapterRepository extraction (phase 1)
- Files modified: services/indexeddb.ts, services/db/repositories/ChapterRepository.ts (new), services/db/repositories/interfaces/IChapterRepository.ts (new)
- Summary: Added a dedicated ChapterRepository with typed interface, moved store/get/getByStableId/setChapterNumber/getAll logic out of the 3,900‑line monolith, and wired IndexedDBService to delegate + keep summary recompute hooks intact.
- Notes: No behavioral change intended; legacy API now wraps repo calls so downstream code remains untouched. Next steps per plan: add repo-level tests + migrate translation operations.
2025-11-10 22:11 UTC - ChapterRepository tests + wiring
- Files modified: services/indexeddb.ts, tests/services/db/indexedDBService.interface.test.ts; files added: services/db/repositories/interfaces/IChapterRepository.ts, services/db/repositories/ChapterRepository.ts, tests/services/db/ChapterRepository.test.ts
- Summary: Delegated chapter CRUD APIs in `indexedDBService` to the new repository and covered repository behavior with fake-indexeddb tests (store/get/preserve metadata, stableId lookups, chapterNumber updates, list all).
- Tests: `npx vitest run tests/services/db/ChapterRepository.test.ts tests/services/db/indexedDBService.interface.test.ts`

2025-11-10 17:40 UTC - Continue translation repository extraction
- Files modified: services/indexeddb.ts:1134-1205,1973-2035; services/db/repositories/TranslationRepository.ts:1-310; services/db/repositories/ChapterRepository.ts:1-140; services/db/repositories/interfaces/ITranslationRepository.ts:1-45; services/db/repositories/interfaces/IChapterRepository.ts:1-40; tests/services/db/TranslationRepository.test.ts:1-220
- Purpose: Finish wiring translation CRUD/activation through the extracted repository, drop the legacy stableId writer inside the monolith, and harden the repository contract with vitest coverage.
- Notes: Delegated updateTranslation/recompute flow to the repo, removed the duplicate storeTranslationByStableId implementation, and fixed broken relative imports so repository files resolve types/indexeddb definitions. Added helper coverage for setActive/ensureActive/getById+getAll paths using fake-indexeddb.
- Tests: `npx vitest run tests/services/db/TranslationRepository.test.ts`; `npm run check:loc`; `npx tsc --noEmit` *(fails on pre-existing issues such as adapters/IndexedDbRepo AppSettings narrowing, services/db/migrationService.ts storeTranslationAtomic references, services/imageService.ts responseModalities args; no new diagnostics from updated files).* 

2025-11-10 18:08 UTC - Wire adapters & ops to TranslationRepository facade
- Files modified: services/db/repositories/{instances.ts,translationFacade.ts}; adapters/repo/TranslationsRepo.ts; services/db/operations/translations.ts; services/db/migrationService.ts; services/indexeddb.ts (constructor + helper); tests/services/db/TranslationRepository.test.ts (unchanged from earlier run).
- Purpose: Expose shared Chapter/Translation repository singletons plus a translation facade that handles URL mappings + chapter summaries, then point the translations adapter and modern TranslationOps/migration flows at that facade to retire `storeTranslationAtomic` and fix the lingering AppSettings type mismatch.
- Notes: translationsRepo now delegates CRUD/activation/delete to `translationFacade`, TranslationOps uses the same path whenever the modern backend is enabled, and migration writes reuse it to avoid reintroducing the monolith logic. IndexedDBService now accepts either full `AppSettings` or the slimmer snapshot when storing translations, and Chapter/Translation repos are instantiated once via `services/db/repositories/instances.ts`. Remaining `tsc` failures are pre-existing (image service args, SessionInfo deleteChapter, importService DTO typing, etc.); translation-related diagnostics about `storeTranslationAtomic`/missing methods are resolved.
- Tests: `npx vitest run tests/services/db/TranslationRepository.test.ts`; `npm run check:loc`; `npx tsc --noEmit` *(still fails on known image/import/nav issues noted above, but no new errors from updated modules).* 

2025-11-10 18:30 UTC - Phase 1 TypeScript error fixes
- Fixed deleteChapter method missing error (components/SessionInfo.tsx)
- Fixed activeTranslationId references (services/indexeddb.ts:2917-2923)
- Fixed .data accessor errors (services/indexeddb.ts:2921,2958-2961)
- Fixed createdAt → dateAdded (services/navigationService.ts:749)
- Fixed stores array typing for DIFF_RESULTS (services/indexeddb.ts:2506)
- Result: TypeScript errors reduced from 172 to 150 (-22 errors, 12.8% reduction)
- Status: Phase 1 complete, exceeded target (-12 errors)

2025-11-10 18:37 UTC - Extract settings/feedback/templates repos & knock down image TS errors
- Files added: services/db/repositories/{SettingsRepository.ts,FeedbackRepository.ts,PromptTemplatesRepository.ts,instances.ts}; services/db/repositories/interfaces/{ISettingsRepository.ts,IFeedbackRepository.ts,IPromptTemplatesRepository.ts}; tests/services/db/{SettingsRepository.test.ts,FeedbackRepository.test.ts,PromptTemplatesRepository.test.ts}.
- Files modified: services/indexeddb.ts, services/db/operations/{settings.ts,feedback.ts,templates.ts}, adapters/repo/{SettingsRepo.ts,FeedbackRepo.ts,PromptTemplatesRepo.ts,TranslationsRepo.ts}, services/db/repositories/TranslationRepository.ts, services/db/repositories/translationFacade.ts, services/db/migrationService.ts, services/imageGenerationService.ts, services/imageService.ts, services/imageUtils.ts, docs/INDEXEDDB-DECOMPOSITION-PLAN.md, docs/WORKLOG.md.
- Purpose: move settings/feedback/prompt template CRUD into dedicated repositories + shared instances, wire the adapters/ops and IndexedDB facade through them, and add fake-indexeddb unit tests to guard the contracts. Also cleaned up the Gemini image request builder and debug helpers so TS rest-parameter errors disappear.
- Notes: IndexedDBService now only delegates to repositories for settings/feedback/templates, adapters reuse the same instances, and translation + new repos are covered by vitest. Remaining TS errors centre on navigation/session types & schema defs; image-specific diagnostics are resolved.
- Tests: `npx vitest run tests/services/db/{SettingsRepository.test.ts,FeedbackRepository.test.ts,PromptTemplatesRepository.test.ts,TranslationRepository.test.ts}`; `npm run check:loc`; `npx tsc --noEmit` *(fails on longstanding navigation/store/schema typings unrelated to today’s changes).* 

2025-11-11 05:13 UTC - Jobs slice cleanup + adapter test typing
- Files: store/slices/jobsSlice.ts (lines 120-210), tests/adapters/providers/*.test.ts (line updates for mock settings), tests/current-system/*.test.ts, tests/db/open-singleton.test.ts, tests/services/exportService.test.ts
- Notes: Removed merge artifact from jobs slice, ensured Zustand setters return typed partials, updated adapter/provider tests to use createMockAppSettings and typed mocks, and retyped feedback/settings specs plus IndexedDB/export tests to align with new repository schema. Remaining TS errors tracked via tsc logs.
- Tests: npx tsc --noEmit (still failing; focus on remaining test fixtures next)

2025-11-11 11:18 UTC - Test fixture normalization + helper expansion
- Files: tests/utils/test-data.ts; tests/epub/{dataCollector,exportService}.test.ts; tests/services/imageMigrationService.test.ts; tests/store/chaptersSlice.test.ts; tests/adapters/repo/ChaptersRepo.test.ts; tests/services/exportService.test.ts
- Notes: Added reusable helpers for EnhancedChapter/ImageCacheKey, updated EPUB/image/chapters tests to use typed translations & cache keys, and tightened repository/export mocks to match new schema. Remaining TS errors localized to aiService/Translator suites, Diff color enums, smoke tests, workers, and jobs slice unit tests.
- Tests: npx tsc --noEmit (still failing; see /tmp/tsc.log for current list)

2025-11-11 11:38 UTC - AI service + worker typing cleanup
- Files: tests/services/aiService.providers.test.ts; tests/services/aiService.translateChapter.test.ts; tests/services/translate/Translator.test.ts; tests/hooks/useDiffMarkers.test.tsx; tests/services/hr-rendering.test.ts; tests/smoke/critical-components.smoke.test.tsx; tests/store/slices/jobsSlice.test.ts; types/novel.test.ts; workers/translate.worker.ts
- Notes: Rebuilt AI-service + translator harnesses around createMockAppSettings, fixed LandingPage smoke import, ensured worker history/error results satisfy HistoricalChapter/TranslationResult, updated Diff/HR tests for stricter typing, and wired jobsSlice tests to the new Zustand API stub. `npx tsc --noEmit` now passes.
- Tests: npx tsc --noEmit
2025-11-11 11:53 UTC - Store bootstrap extraction + typed session actions
- Files modified: store/index.ts; store/storeTypes.ts; store/bootstrap/index.ts; store/bootstrap/clearSession.ts; store/bootstrap/importSessionData.ts; store/bootstrap/initializeStore.ts
- Purpose: Split the monolithic store bootstrap logic (clearSession/importSessionData/initializeStore) into dedicated helper modules, centralize AppState/SessionActions typing, and keep store/index.ts focused on slice composition per the modularity guardrail.
- Notes: Bootstrap helpers now share a typed context so migrations/deep-link handling stay encapsulated; store/index.ts simply composes slices + metadata setters and delegates heavy lifting to the helpers. This trims ~400 LOC from the root store file and makes future bootstrap/unit testing easier.
- Tests: `npx tsc --noEmit`

2025-11-11 12:05 UTC - Bootstrap helper tests
- Files: tests/store/bootstrap/bootstrapHelpers.test.ts
- Purpose: Added targeted unit tests for clearSession/importSessionData/initializeStore helpers using mocked SessionManagementService + indexedDB/audio contexts to guard future refactors.
- Tests: npx vitest run tests/store/bootstrap/bootstrapHelpers.test.ts; npx tsc --noEmit

2025-11-11 12:40 UTC - IndexedDB export extraction and delegation
- Files: services/indexeddb.ts; services/db/operations/export.ts; services/db/index.ts; services/db/operations/index.ts
- Purpose: Moved the ~250 LOC export/image-asset routine out of the facade into a dedicated operations module, wired the service to pass typed deps, and kept the repo factory delegating to the facade while we build modern counterparts.
- Notes: exportFullSessionToJson now lives in services/db/operations/export.ts w/ shared helpers + telemetry; IndexedDBService just constructs deps + exposes prompt template helpers again, shrinking the main file by ~220 LOC.
- Tests: npx tsc --noEmit

2025-11-11 13:05 UTC - IndexedDB facade slimming: amendments + image ops
- Files: services/indexeddb.ts; services/db/operations/{amendments,imageVersions}.ts; services/db/operations/index.ts; services/db/index.ts
- Purpose: moved amendment logs and image-version/storage helpers into dedicated ops so the main facade keeps shrinking toward the <500 LOC goal while slices still call the same API.
- Notes: new AmendmentOps handles CRUD/stats via txn helpers; ImageOps reuses chapter/translation repos for delete + diagnostics, and IndexedDBService now delegates instead of inlining ~250 LOC of logic.
- Tests: npx tsc --noEmit

2025-11-11 13:25 UTC - Rendering + summary block extraction
- Files: services/indexeddb.ts; services/db/operations/rendering.ts; services/db/operations/index.ts; docs/WORKLOG.md
- Purpose: moved getChaptersForReactRendering into a standalone rendering op with typed deps/logging, further shrinking the facade and prepping for additional summary cleanups.
- Notes: rendering op now handles memory/telemetry instrumentation internally, and the service just forwards via a helper so future repos can reuse it.
- Tests: npx tsc --noEmit

2025-11-11 13:40 UTC - Summary + rendering ops extraction
- Files: services/indexeddb.ts; services/db/operations/{rendering,summaries}.ts; services/db/operations/index.ts; docs/WORKLOG.md
- Purpose: Continued slimming by moving chapter summary recompute + render hydration into reusable ops, leaving the facade as a thin delegator.
- Notes: IndexedDBService now passes typed deps into recompute/delete + rendering helpers; chapter summary builders live in the ops module for reuse by future repos.
- Tests: npx tsc --noEmit

2025-11-11 14:15 UTC - Include amendment logs in session export/import
- Files: services/db/operations/{amendments,export}.ts; services/indexeddb.ts; tests/current-system/export-import.test.ts
- Purpose: ensure full session backups carry amendment history by exporting `amendmentLogs` and importing them via AmendmentOps, so resetting the DB doesn’t lose prompt-change audits.
- Tests: npx tsc --noEmit
2025-11-13 07:50 UTC - Batch 2: store/UI + navigation on repo ops
- Files: store/slices/{chaptersSlice.ts,imageSlice.ts,translationsSlice.ts}, components/{SessionInfo.tsx,SettingsModal.tsx}, services/navigationService.ts, services/db/operations/{chapters.ts,translations.ts}, docs/INDEXEDDB-FACADE-MIGRATION.md
- Why: Continue removing direct `indexedDBService` usage by moving preload workers, deletion flows, image version management, navigation persistence, and settings metadata onto the repository/ops layer.
- Details:
  - `ChapterOps` gained `findByNumber` / `deleteByUrl` so preload + chapter deletion can reuse the modern schema; `TranslationOps` added `ensureActiveByStableId` and `deleteVersion`, and `ImageOps` now handles all version deletions.
  - Store slices and components now call these ops directly: preload worker uses `ChapterOps.findByNumber`, image slice uses `ImageOps.deleteImageVersion`, translations slice relies on `TranslationOps`/`AmendmentOps`, SessionInfo deletes chapters via `ChapterOps`, and SettingsModal reads/persists metadata and diagnostics via `SettingsOps`/`ImageOps`.
  - NavigationService now persists history via `SettingsOps`, hydrates translations via `TranslationOps`, imports stable sessions via `ImportOps`, and resolves chapters via `ChapterOps`.
  - Migration tracker updated (store + UI sections cleared; navigation removed from service backlog).
- Tests: `npx tsc --noEmit`; `npm run test -- tests/store/bootstrap/bootstrapHelpers.test.ts --run`; `npm run test -- tests/services/exportService.test.ts --run`
2025-11-13 10:15 UTC - Batch 3: translation service on ops + ChapterOps setters
- Files: services/translationService.ts, services/db/operations/chapters.ts, docs/INDEXEDDB-FACADE-MIGRATION.md
- Why: Continue stripping service-layer dependencies on the legacy facade. TranslationService was still persisting/fetching via `indexedDBService`, so moving it onto `ChapterOps`/`TranslationOps`/`FeedbackOps` keeps the pipeline consistent with the new repositories.
- Details:
  - `ChapterOps` now exposes `setChapterNumberByStableId`, and the existing `findByNumber` helper is reused for history diagnostics/preload flows.
  - Translation persistence, hydration, history reconstruction, and feedback loading all call `TranslationOps`/`ChapterOps`/`FeedbackOps`; there are no direct `indexedDBService` calls left in TranslationService.
  - Migration tracker updated (translation service removed from the “remaining services” list).
- Tests: `npx tsc --noEmit`

2025-11-13 10:40 UTC - Session management now calls TemplatesOps/MaintenanceOps
- Files: services/sessionManagementService.ts, services/db/operations/{templates.ts,maintenance.ts}, docs/INDEXEDDB-FACADE-MIGRATION.md
- Why: Remove the last service-layer dependency on `indexedDBService` outside the DB ops. Prompt template CRUD and `clearSession` now use the ops layer, keeping the facade localized.
- Details:
  - `TemplatesOps` gained `delete`, `SessionManagementService`’s load/create/update/delete/setActive flows now call it directly.
  - `MaintenanceOps` exposes `clearAllData`, so session clearing no longer touches the facade.
  - Migration tracker count for services decremented accordingly.
- Tests: `npx tsc --noEmit`
2025-11-20 19:20 UTC - ChapterView decomposition: chapter telemetry + token hook
- Files: components/ChapterView.tsx; components/chapter/ChapterHeader.tsx; components/chapter/TranslationStatusPanel.tsx; components/chapter/FooterNavigation.tsx; components/chapter/ComparisonPortal.tsx; hooks/useTokenizedContent.ts; hooks/useTranslationTokens.ts; hooks/useChapterTelemetry.ts; tests/hooks/useTranslationTokens.test.tsx; tests/hooks/useChapterTelemetry.test.tsx; tests/components/chapter/FooterNavigation.test.tsx; tests/components/chapter/ComparisonPortal.test.tsx; tests/components/chapter/TranslationStatusPanel.test.tsx; docs/WORKLOG.md
- Why: Continue slicing ChapterView by moving token/diff wiring into a hook, centralizing telemetry, and extracting remaining UI blocks (comparison portal, status panel, footer nav).
- Details:
  - Added `useTokenizedContent` (wrapping translation tokenization, diff markers, and inline edit wiring) plus `useTranslationTokens`, letting ChapterView just consume the outputs.
  - Created `useChapterTelemetry` so mount/ready performance logging and selection debug logs live outside the component.
  - Extracted `TranslationStatusPanel`, `ComparisonPortal`, and `FooterNavigation` into dedicated components with RTL coverage.
- Tests: `npx tsc --noEmit`; `npm run test -- tests/store/bootstrap/bootstrapHelpers.test.ts --run`; `npm run test -- tests/services/exportService.test.ts --run`; `npm run test -- tests/components/chapter/SelectionOverlay.test.tsx --run`; `npm run test -- tests/components/chapter/ChapterHeader.test.tsx --run`; `npm run test -- tests/components/chapter/ReaderFeedbackPanel.test.tsx --run`; `npm run test -- tests/components/chapter/ChapterContent.test.tsx --run`; `npm run test -- tests/components/chapter/FootnotesPanel.test.tsx --run`; `npm run test -- tests/components/chapter/TranslationStatusPanel.test.tsx --run`; `npm run test -- tests/components/chapter/ComparisonPortal.test.tsx --run`; `npm run test -- tests/components/chapter/FooterNavigation.test.tsx --run`; `npm run test -- tests/hooks/useFootnoteNavigation.test.tsx --run`; `npm run test -- tests/hooks/useTranslationTokens.test.tsx --run`; `npm run test -- tests/hooks/useChapterTelemetry.test.tsx --run`
2025-11-20 19:37 UTC - ChapterContent decomposition: diff paragraphs + inline toolbar
- Files: components/chapter/ChapterContent.tsx; components/chapter/DiffParagraphs.tsx; components/chapter/InlineEditToolbar.tsx; hooks/useTokenizedContent.ts; tests/components/chapter/DiffParagraphs.test.tsx; tests/components/chapter/InlineEditToolbar.test.tsx; docs/WORKLOG.md
- Why: ChapterContent still hosted the diff paragraph mapping and inline edit toolbar markup; splitting them keeps the main component lean and reusable.
- Details:
  - Added `DiffParagraphs` and `InlineEditToolbar` components; `ChapterContent` now composes them instead of embedding the markup.
  - `useTokenizedContent` remains the central hook for tokens/diffs; updated imports accordingly.
- Tests: `npx tsc --noEmit`; `npm run test -- tests/components/chapter/DiffParagraphs.test.tsx --run`; `npm run test -- tests/components/chapter/InlineEditToolbar.test.tsx --run`
2025-11-20 19:39 UTC - ChapterContent decomposition: translation editor component
- Files: components/chapter/ChapterContent.tsx; components/chapter/TranslationEditor.tsx; tests/components/chapter/TranslationEditor.test.tsx; docs/WORKLOG.md
- Why: The inline textarea inside ChapterContent was still embedded; extracting it keeps the component slimmer and makes future styling/testing easier.
- Details:
  - Added `TranslationEditor` (a simple textarea wrapper) and replaced the inline markup; added a lightweight test to ensure onChange fires.
- Tests: `npx tsc --noEmit`; `npm run test -- tests/components/chapter/TranslationEditor.test.tsx --run`
2025-11-20 19:48 UTC - Selection overlay wrapper + editor split
- Files: components/ChapterView.tsx; components/chapter/ChapterSelectionOverlay.tsx; components/chapter/ChapterContent.tsx; components/chapter/TranslationEditor.tsx; tests/components/chapter/ChapterSelectionOverlay.test.tsx; tests/components/chapter/TranslationEditor.test.tsx; docs/WORKLOG.md
- Why: Continue slimming ChapterView/ChapterContent by wrapping the SelectionOverlay wiring and extracting the translation textarea.
- Details:
  - Added `ChapterSelectionOverlay` to encapsulate the overlay rendering logic so ChapterView just mounts the wrapper; added RTL coverage for selection/no-selection cases.
  - Extracted the `TranslationEditor` textarea from ChapterContent for reuse and simpler testing.
- Tests: `npx tsc --noEmit`; `npm run test -- tests/components/chapter/ChapterSelectionOverlay.test.tsx --run`; `npm run test -- tests/components/chapter/TranslationEditor.test.tsx --run`
2025-11-20 19:51 UTC - ReaderBody wrapper
- Files: components/ChapterView.tsx; components/chapter/ReaderBody.tsx; docs/WORKLOG.md
- Why: Compress the main render body by wrapping ChapterContent, footnotes, feedback, selection overlay, comparison portal, footer nav, and audio player into a single component.
- Details:
  - Added `ReaderBody` which accepts the necessary props (chapter content config, overlay handlers, comparison portal state, navigation/audio props) so ChapterView just passes down computed values.
- Tests: `npx tsc --noEmit`
2025-11-21 13:47 UTC - ChapterView decomposition: ReaderBody wrapper
- Files: components/ChapterView.tsx; components/chapter/ReaderBody.tsx; docs/WORKLOG.md
- Why: Consolidate the remaining ChapterView body (ChapterContent, footnotes, reader feedback, selection overlay, comparison portal, footer nav, audio player) into a single component.
- Details:
  - Added `ReaderBody` which accepts the necessary props (tokenized content config, overlay actions, comparison portal state, navigation/audio handlers) so ChapterView only orchestrates data/hook outputs.
- Tests: `npx tsc --noEmit`

2025-11-21 14:05 UTC - ChapterView decomposition: ReaderView container
- Files: components/ChapterView.tsx; components/chapter/ReaderView.tsx; docs/WORKLOG.md
- Why: Wrap the header + status + body render structure in a dedicated `ReaderView` so ChapterView shrinks to computing props + invoking a single component.
- Details:
  - Added `ReaderView` that renders `ChapterHeader`, `TranslationStatusPanel`, and `ReaderBody` inside the main container; ChapterView now just builds the header/status/body prop objects and passes a `viewRef`.
- Tests: `npx tsc --noEmit`
2025-11-22 12:40 UTC - Image version hydration + marker cleanup
- Files: services/db/operations/imageVersions.ts; store/slices/imageSlice.ts; tests/services/db/ImageOps.test.ts
- Why: After deleting the last illustration version, navigation/reload cleared imageVersionState so the delete control disappeared; user also wanted to delete orphaned markers after a refresh.
- Details: Keep a placeholder imageVersionState when the final version is removed, surface version controls via loadExistingImages/getVersionInfo even with zero versions, and treat a delete against an empty version list as a marker cleanup (removing it from suggestedIllustrations). Added regression coverage for last-version placeholders and empty-state cleanup.
- Tests: npx tsc --noEmit; npm run test -- run tests/services/db/ImageOps.test.ts

2025-11-22 12:30 UTC - Translation metadata backfill + image hydration on navigation
- Files: services/navigationService.ts; services/db/operations/maintenance.ts; store/bootstrap/initializeStore.ts; store/slices/chaptersSlice.ts; tests/store/bootstrap/bootstrapHelpers.test.ts
- Why: Legacy translations lacked provider/model snapshots, breaking shouldEnableRetranslation and image persistence after navigation; image delete controls vanished after leaving a chapter because image state wasn’t hydrated on load.
- Details: Hydrate translationSettingsSnapshot during chapter load, add a maintenance backfill for provider/model snapshots, wire it into bootstrap, and auto-call loadExistingImages when hydrating a chapter that has suggestedIllustrations. Navigation/chapters slices now preserve snapshot metadata and repopulate image state after navigation.
- Tests: npx tsc --noEmit; npm run test -- run tests/store/bootstrap/bootstrapHelpers.test.ts

2025-11-22 12:20 UTC - SettingsModal modularization + novel metadata guard
- Files: components/SettingsModal.tsx; components/settings/*; hooks/useAdvancedPanelStore.ts; hooks/useAudioPanelStore.ts; hooks/useExportPanelStore.ts; hooks/useProvidersPanelStore.ts; hooks/useNovelMetadata.ts
- Why: 2.7k LOC modal blocked further changes and tests were brittle; novel metadata hook crashed in tests without a chapters map.
- Details: Extracted Providers/Display/Prompt/Diff/Metadata/Export/Template/Audio/Advanced panels with shared context/tabs and SessionActions footer; added dedicated panel tests and a defensive guard in useNovelMetadata for undefined maps.
- Tests: npm run test -- run components/settings; npx tsc --noEmit

2025-11-22 12:10 UTC - Config + UX touch-ups
- Files: config/constants.ts; config/costs.ts; services/translate/HtmlSanitizer.ts; components/SessionInfo.tsx
- Why: Add OpenRouter Gemini 3 Pro image preview model pricing, expose strict XHTML sanitizer for EPUB, and fix SessionInfo wrapping on small screens.
- Details: Deduped Gemini model entry, added pricing, exported toStrictXhtml helper, and tightened select wrappers/justification on SessionInfo.
- Tests: npx tsc --noEmit

2025-12-21 18:05 UTC - Repo hygiene: ignore local assistant configs
- Files: .gitignore; docs/WORKLOG.md
- Why: Keep local Codex/Claude config and symlink artifacts out of `git status` and prevent accidental commits.
- Details: Ignore `.claude/` and `CLAUDE.md`.

2025-12-21 18:08 UTC - System tests: export/import + EPUB asset resolver hardening
- Files: services/db/operations/sessionExport.ts; services/epub/assetResolver.ts; components/chapter/{ReaderView.tsx,DiffMarkersPanel.tsx}; tests/current-system/{export-import.test.ts,translation.test.ts}; tests/epub/assetResolver.test.ts; tests/services/db/TranslationRepository.test.ts; docs/WORKLOG.md
- Why: Keep session export using the DB ops layer (DiffOps), make EPUB image IDs stable with versioning, and tighten tests/selectors for more reliable validation.
- Tests: `npm test -- --run tests/current-system/export-import.test.ts tests/epub/assetResolver.test.ts tests/current-system/translation.test.ts tests/services/db/TranslationRepository.test.ts`

2025-12-21 18:10 UTC - Prompt UX: active prompt content editor
- Files: components/settings/PromptPanel.tsx; components/settings/PromptPanel.test.tsx; docs/WORKLOG.md
- Why: Make the active system prompt directly editable (edit/save/cancel) without switching templates or losing selection state.
- Tests: `npm test -- --run components/settings/PromptPanel.test.tsx`

2025-12-21 18:13 UTC - Prompts: metadata preamble plumbing
- Files: services/prompts/metadataPreamble.ts; tests/services/prompts/metadataPreamble.test.ts; services/ai/providers/{openai.ts,gemini.ts}; services/claudeService.ts; docs/WORKLOG.md
- Why: Centralize “session context” (project/languages/glossary) generation and inject it into provider prompts to reduce prompt drift across models.
- Tests: `npm test -- --run tests/services/prompts/metadataPreamble.test.ts tests/services/aiService.providers.test.ts`

2025-12-21 18:26 UTC - Test runner fixes: exclude Playwright specs + stabilize DB singleton test
- Files: vitest.config.ts; tests/adapters/providers/ClaudeAdapter.test.ts; services/db/core/connection.ts; docs/WORKLOG.md
- Why: Keep Playwright `tests/e2e/*.spec.ts` out of Vitest, fix Vitest mock hoisting in ClaudeAdapter tests, and remove an unreliable IndexedDB “probe open” that doubled open() calls.
- Tests: `npm test -- --run`

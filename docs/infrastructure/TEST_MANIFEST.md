# Test Manifest

> Auto-generated from disk scan on 2026-03-19.
> Verify: `find tests/ -name '*.test.*' | sort`

## Summary

- **Total test files:** 122

## By Directory

### archive/tests/store/

| File | Description |
|------|-------------|
| archive/tests/store/amendmentProposal.legacy.test.ts | Legacy amendment proposal store tests |

### components/settings/

| File | Description |
|------|-------------|
| components/settings/AdvancedPanel.test.tsx | Advanced settings panel component tests |
| components/settings/AudioPanel.test.tsx | Audio settings panel component tests |
| components/settings/DiffPanel.test.tsx | Diff settings panel component tests |
| components/settings/DisplayPanel.test.tsx | Display settings panel component tests |
| components/settings/GalleryPanel.test.tsx | Gallery settings panel component tests |
| components/settings/ImageLightbox.test.tsx | Image lightbox component tests |
| components/settings/MetadataPanel.test.tsx | Metadata settings panel component tests |
| components/settings/PromptPanel.test.tsx | Prompt settings panel component tests |
| components/settings/ProvidersPanel.test.tsx | Providers settings panel component tests |
| components/settings/SessionActions.test.tsx | Session actions component tests |
| components/settings/SessionExportPanel.test.tsx | Session export panel component tests |
| components/settings/SettingsSidebar.test.tsx | Settings sidebar component tests |
| components/settings/TemplatePanel.test.tsx | Template settings panel component tests |

### components/sutta-studio/

| File | Description |
|------|-------------|
| components/sutta-studio/SuttaStudioView.test.tsx | Sutta Studio view component tests |

### components/

| File | Description |
|------|-------------|
| components/SettingsModal.test.tsx | Settings modal component tests |

### services/

| File | Description |
|------|-------------|
| services/suttaStudioRehydrator.test.ts | Sutta Studio rehydrator unit tests |

### tests/adapters/providers/

| File | Description |
|------|-------------|
| tests/adapters/providers/ClaudeAdapter.test.ts | Claude adapter unit tests |
| tests/adapters/providers/GeminiAdapter.test.ts | Gemini adapter unit tests |
| tests/adapters/providers/OpenAIAdapter.test.ts | OpenAI adapter unit tests |
| tests/adapters/providers/registry.test.ts | Provider registry unit tests |

### tests/components/chapter/

| File | Description |
|------|-------------|
| tests/components/chapter/ChapterContent.test.tsx | Chapter content component tests |
| tests/components/chapter/ChapterHeader.test.tsx | Chapter header component tests |
| tests/components/chapter/ChapterSelectionOverlay.test.tsx | Chapter selection overlay tests |
| tests/components/chapter/ComparisonPortal.test.tsx | Comparison portal component tests |
| tests/components/chapter/DiffParagraphs.test.tsx | Diff paragraphs component tests |
| tests/components/chapter/FooterNavigation.test.tsx | Footer navigation component tests |
| tests/components/chapter/FootnotesPanel.test.tsx | Footnotes panel component tests |
| tests/components/chapter/InlineEditToolbar.test.tsx | Inline edit toolbar component tests |
| tests/components/chapter/ReaderFeedbackPanel.test.tsx | Reader feedback panel component tests |
| tests/components/chapter/SelectionOverlay.test.tsx | Selection overlay component tests |
| tests/components/chapter/TranslationEditor.test.tsx | Translation editor component tests |
| tests/components/chapter/TranslationStatusPanel.test.tsx | Translation status panel component tests |

### tests/components/diff/

| File | Description |
|------|-------------|
| tests/components/diff/ChapterView.mapMarker.test.tsx | Chapter view map marker tests |
| tests/components/diff/DiffGutter.test.tsx | Diff gutter component tests |
| tests/components/diff/DiffPip.test.tsx | Diff pip component tests |

### tests/components/

| File | Description |
|------|-------------|
| tests/components/CoverageDistribution.test.tsx | Coverage distribution component tests |
| tests/components/MigrationRecovery.test.tsx | Migration recovery component tests |
| tests/components/NovelLibrary.test.tsx | Novel library component tests |
| tests/components/NovelMetadataForm.test.tsx | Novel metadata form component tests |
| tests/components/SessionInfo.test.tsx | Session info component tests |
| tests/components/SettingsModal.test.tsx | Settings modal component tests |
| tests/components/sutta-studio-scroll-progress.test.ts | Sutta Studio scroll progress tests |
| tests/components/sutta-studio-utils.test.ts | Sutta Studio utility tests |
| tests/components/tag-balancing.test.ts | Tag balancing logic tests |
| tests/components/VersionPicker.test.tsx | Version picker component tests |

### tests/contracts/

| File | Description |
|------|-------------|
| tests/contracts/provider.contract.test.ts | Provider contract tests |

### tests/current-system/

| File | Description |
|------|-------------|
| tests/current-system/cost-calculation.test.ts | Cost calculation integration tests |
| tests/current-system/export-import.test.ts | Export/import flow integration tests |
| tests/current-system/feedback.test.ts | Feedback flow integration tests |
| tests/current-system/navigation.test.ts | Navigation integration tests |
| tests/current-system/providers.test.ts | Provider initialization integration tests |
| tests/current-system/settings.test.ts | Settings persistence integration tests |
| tests/current-system/translation.test.ts | Translation flow integration tests |

### tests/db/migrations/

| File | Description |
|------|-------------|
| tests/db/migrations/fresh-install.test.ts | Fresh install migration tests |
| tests/db/migrations/migrationBackup.test.ts | Migration backup tests |
| tests/db/migrations/migrationRestore.test.ts | Migration restore tests |
| tests/db/migrations/versionGate.test.ts | Version gate migration tests |

### tests/db/

| File | Description |
|------|-------------|
| tests/db/diffResults.test.ts | Diff results DB tests |
| tests/db/open-singleton.test.ts | IndexedDB open singleton lifecycle tests |

### tests/epub/

| File | Description |
|------|-------------|
| tests/epub/assetResolver.test.ts | EPUB asset resolver tests |
| tests/epub/contentBuilder.test.ts | EPUB content builder tests |
| tests/epub/dataCollector.test.ts | EPUB data collector tests |
| tests/epub/exportService.test.ts | EPUB export service tests |
| tests/epub/packageBuilder.test.ts | EPUB package builder tests |

### tests/gold/diff/

| File | Description |
|------|-------------|
| tests/gold/diff/diff-golden.test.ts | Diff golden file tests |

### tests/hooks/

| File | Description |
|------|-------------|
| tests/hooks/useChapterTelemetry.test.tsx | useChapterTelemetry hook tests |
| tests/hooks/useDiffMarkers.test.tsx | useDiffMarkers hook tests |
| tests/hooks/useFootnoteNavigation.test.tsx | useFootnoteNavigation hook tests |
| tests/hooks/usePersistentState.test.tsx | usePersistentState hook tests |
| tests/hooks/useTextSelection.test.tsx | useTextSelection hook tests |
| tests/hooks/useTranslationTokens.test.tsx | useTranslationTokens hook tests |

### tests/integration/

| File | Description |
|------|-------------|
| tests/integration/ChapterView.critical-flows.test.tsx | ChapterView critical flows integration tests |
| tests/integration/ChapterView.inline-edit.test.tsx | ChapterView inline edit integration tests |
| tests/integration/registry.test.ts | Registry integration tests |

### tests/services/compiler/

| File | Description |
|------|-------------|
| tests/services/compiler/utils.test.ts | Sutta Studio compiler utility tests |

### tests/services/db/

| File | Description |
|------|-------------|
| tests/services/db/ChapterRepository.test.ts | Chapter repository unit tests |
| tests/services/db/FeedbackRepository.test.ts | Feedback repository unit tests |
| tests/services/db/ImageOps.test.ts | Image operations unit tests |
| tests/services/db/PromptTemplatesRepository.test.ts | Prompt templates repository unit tests |
| tests/services/db/SettingsRepository.test.ts | Settings repository unit tests |
| tests/services/db/TranslationRepository.test.ts | Translation repository unit tests |

### tests/services/diff/

| File | Description |
|------|-------------|
| tests/services/diff/DiffAnalysisService.test.ts | Diff analysis service unit tests |

### tests/services/epub/

| File | Description |
|------|-------------|
| tests/services/epub/Templates.test.ts | EPUB template rendering tests |
| tests/services/epub/XhtmlSerializer.test.ts | EPUB XHTML serializer tests |

### tests/services/export/

| File | Description |
|------|-------------|
| tests/services/export/exportSlice.test.ts | Export slice unit tests |

### tests/services/navigation/

| File | Description |
|------|-------------|
| tests/services/navigation/converters.test.ts | Navigation converters unit tests |

### tests/services/prompts/

| File | Description |
|------|-------------|
| tests/services/prompts/metadataPreamble.test.ts | Metadata preamble prompt tests |

### tests/services/translate/

| File | Description |
|------|-------------|
| tests/services/translate/Translator.test.ts | Translator core unit tests |

### tests/services/

| File | Description |
|------|-------------|
| tests/services/adapters.booktoki.test.ts | BookToki adapter tests |
| tests/services/adapters.suttacentral.test.ts | SuttaCentral adapter tests |
| tests/services/aiService.internal.test.ts | AI service internal logic tests |
| tests/services/aiService.providers.test.ts | AI service provider integration tests |
| tests/services/aiService.translateChapter.test.ts | AI service chapter translation tests |
| tests/services/api-key-validation.test.ts | API key validation tests |
| tests/services/comparisonService.test.ts | Comparison service tests |
| tests/services/epub-regression.test.ts | EPUB regression tests |
| tests/services/epubPackager.diagnostics.test.ts | EPUB packager diagnostics tests |
| tests/services/epubService.test.ts | EPUB service integration tests |
| tests/services/exportService.test.ts | Export service tests |
| tests/services/hr-rendering.test.ts | Horizontal rule rendering tests |
| tests/services/HtmlRepairService.test.ts | HTML repair service tests |
| tests/services/HtmlSanitizer.test.ts | HTML sanitizer tests |
| tests/services/illustration-validation.test.ts | Illustration validation tests |
| tests/services/imageMigrationService.test.ts | Image migration service tests |
| tests/services/importService.test.ts | Import service tests |
| tests/services/navigationService.test.ts | Navigation service tests |
| tests/services/registryService.test.ts | Registry service tests |
| tests/services/structured-outputs.test.ts | Structured output parsing tests |
| tests/services/translation-rendering.test.ts | Translation rendering tests |

### tests/smoke/

| File | Description |
|------|-------------|
| tests/smoke/critical-components.smoke.test.tsx | Critical components smoke tests |

### tests/store/bootstrap/

| File | Description |
|------|-------------|
| tests/store/bootstrap/bootstrapHelpers.test.ts | Bootstrap helpers unit tests |

### tests/store/slices/

| File | Description |
|------|-------------|
| tests/store/slices/illustration-marker-insertion.test.ts | Illustration marker insertion tests |
| tests/store/slices/jobsSlice.test.ts | Jobs slice unit tests |

### tests/store/

| File | Description |
|------|-------------|
| tests/store/amendmentProposal.test.ts | Amendment proposal store tests |
| tests/store/chaptersSlice.test.ts | Chapters slice unit tests |
| tests/store/nullSafety.test.ts | Null safety guard tests |
| tests/store/provenance.test.ts | Provenance tracking tests |

### tests/utils/

| File | Description |
|------|-------------|
| tests/utils/retry.test.ts | Retry utility tests |
| tests/utils/versionFormatting.test.ts | Version formatting utility tests |

### types/

| File | Description |
|------|-------------|
| types/novel.test.ts | Novel type definition tests |
| types/session.test.ts | Session type definition tests |

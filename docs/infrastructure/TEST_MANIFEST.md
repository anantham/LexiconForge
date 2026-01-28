# Test Manifest (2025-10-13)

This inventory captures every suite in `tests/`, its focus area, and the current health based on the most recent runs.

Legend for **Status**:
- ✅ Passing — Last executed successfully (date)
- ⚠️ Failing — Last run surfaced failures (date + failing command)
- ❓ Unknown — Not exercised in the latest run
- 💤 Obsolete — Targets code that has been removed or archived

| Suite | Area | Status | Owner | Recommended Action | Notes |
| --- | --- | --- | --- | --- | --- |
| tests/adapters/providers/registry.test.ts | Provider registry | ❓ Unknown | Unassigned | Smoke run | Ensure latest model catalog + scopes reflected. |
| tests/adapters/repo/ChaptersRepo.test.ts | Chapters repo adapter | ❓ Unknown | Unassigned | Review | Verify against current repo abstraction. |
| tests/adapters/repo/IndexedDbRepo.test.ts | IndexedDB repo adapter | ❓ Unknown | Unassigned | Review | Confirm compatibility with schema v11. |
| tests/current-system/cost-calculation.test.ts | Integration – cost tracking | ✅ Passing (2025-10-13) | Unassigned | Keep | Rewritten for async pricing logic, including OpenRouter dynamic rates. |
| tests/current-system/export-import.test.ts | Integration – session export/import | ✅ Passing (2025-10-14) | Unassigned | Keep | Tests memory snapshot export and full-session import flow via IndexedDB stubs. |
| tests/current-system/feedback.test.ts | Integration – feedback | ✅ Passing (2025-10-14) | Unassigned | Keep | Replaced with slice-focused coverage for submit/update/delete feedback flows. |
| tests/current-system/navigation.test.ts | Integration – navigation | ✅ Passing (2025-10-13) | Unassigned | Keep | Slimmed down to NavigationService URL checks and store.handleFetch happy/error paths. |
| tests/current-system/providers.test.ts | Integration – providers | ✅ Passing (2025-10-14) | Unassigned | Keep | Confirms `initializeProviders` registers OpenAI, DeepSeek, OpenRouter, Gemini, and Claude adapters. |
| tests/current-system/settings.test.ts | Integration – settings | ✅ Passing (2025-10-14) | Unassigned | Keep | Updated for slice-based store; covers persistence, restore, change detection, and storage failures. |
| tests/current-system/translation.test.ts | Integration – translation flow | ✅ Passing (2025-10-14) | Unassigned | Keep | Reworked with TranslationService/IndexedDB stubs covering success, skip, error, and abort scenarios. |
| tests/db/contracts/actual-system-validation.test.ts | DB contract (legacy) | 💤 Obsolete | Unassigned | Retire | Targets the pre-slice IndexedDB repo; superseded by new persistence layer. |
| tests/db/contracts/diagnostic-evidence.test.ts | DB contract (legacy) | 💤 Obsolete | Unassigned | Retire | "
| tests/db/contracts/diagnostic-investigation.test.ts | DB contract (legacy) | 💤 Obsolete | Unassigned | Retire | " |
| tests/db/contracts/legacy-workaround.test.ts | DB contract (legacy) | 💤 Obsolete | Unassigned | Retire | " |
| tests/db/contracts/migration-validation-clean.test.ts | DB migration (legacy) | 💤 Obsolete | Unassigned | Retire | Covered by new schema tooling. |
| tests/db/contracts/migration-validation.test.ts | DB migration (legacy) | 💤 Obsolete | Unassigned | Retire | "
| tests/db/contracts/new-translations-ops.test.ts | DB contract (legacy) | 💤 Obsolete | Unassigned | Retire | " |
| tests/db/contracts/translation-accurate.test.ts | DB contract (legacy) | 💤 Obsolete | Unassigned | Retire | " |
| tests/db/contracts/translation-contracts.test.ts | DB contract (legacy) | 💤 Obsolete | Unassigned | Retire | " |
| tests/db/contracts/translation-simple.test.ts | DB contract (legacy) | 💤 Obsolete | Unassigned | Retire | " |
| tests/db/open-singleton.test.ts | IndexedDB lifecycle | ❓ Unknown | Unassigned | Update | Should assert amendment log store presence. |
| tests/epub/assetResolver.test.ts | EPUB asset pipeline | ✅ Passing (2025-10-27) | Unassigned | Keep | Confirms cache + base64 fallbacks with current fixtures. |
| tests/epub/contentBuilder.test.ts | EPUB content assembly | ✅ Passing (2025-10-27) | Unassigned | Keep | Validated stats/title toggles with regenerated chapter fixtures. |
| tests/epub/dataCollector.test.ts | EPUB data gathering | ✅ Passing (2025-10-27) | Unassigned | Keep | Verifies store snapshot integration under schema v11. |
| tests/epub/exportService.test.ts | EPUB orchestrator | ✅ Passing (2025-10-27) | Unassigned | Keep | Smoke covers happy path + error handling for rebuilt export flow. |
| tests/epub/packageBuilder.test.ts | EPUB packaging | ✅ Passing (2025-10-27) | Unassigned | Keep | ZIP manifest + required file assertions match new pipeline. |
| tests/hooks/usePersistentState.test.tsx | Hook | ✅ Passing (2025-10-27) | Unassigned | Keep | Storage-sync + migration logic holds against slice store. |
| tests/hooks/useTextSelection.test.tsx | Hook | ✅ Passing (2025-10-27) | Unassigned | Keep | Emoji toolbar selection guards confirmed with DOM harness. |
| tests/services/api-key-validation.test.ts | API key validation | ❓ Unknown | Unassigned | Review | Add coverage for new providers. |
| tests/services/epub/Templates.test.ts | EPUB templates | ✅ Passing (2025-10-13) | Unassigned | Keep | Updated assertions accept locale-formatted numbers and current footer layout. |
| tests/services/epub/XhtmlSerializer.test.ts | EPUB serialization | ❓ Unknown | Unassigned | Review | |
| tests/services/epubService.test.ts | EPUB service integration | ❓ Unknown | Unassigned | Review | |
| tests/services/HtmlSanitizer.test.ts | Sanitizer | ✅ Passing (2025-10-27) | Unassigned | Keep | Covers allowHr toggle and legacy normalization. |
| tests/services/comparisonService.test.ts | Comparison workflow | ✅ Passing (2025-10-27) | Unassigned | Keep | New coverage for focused comparison prompt/response parsing. |
| tests/services/comparisonService.test.ts | Comparison workflow | ✅ Passing (2025-10-27) | Unassigned | Keep | New coverage for focused comparison prompt/response parsing. |
| tests/services/illustration-validation.test.ts | Illustration prompts | ❓ Unknown | Unassigned | Review | Align with latest prompt schema. |
| tests/services/imageMigrationService.test.ts | Image migration | ❓ Unknown | Unassigned | Review | Likely still valid. |
| tests/services/structured-outputs.test.ts | Structured output parsing | ✅ Passing (2025-10-13) | Unassigned | Keep | Schema now sourced dynamically from `config/prompts.json`; no rewrites needed. |
| tests/services/translate/Translator.test.ts | Translator core | ✅ Passing (2025-10-13) | Unassigned | Keep | Adjusted abort expectations and confirmed sanitize/retry behaviour under the new orchestrator. |
| tests/setup.ts | Vitest setup | ✅ Passing (2025-10-13) | Unassigned | Keep | Consider centralizing fake-indexeddb setup here. |
| tests/store/amendmentProposal.test.ts | Store – amendment workflow | ✅ Passing (2025-10-13) | Unassigned | Keep | Uses `fake-indexeddb`; covers logging path. |
| tests/store/chaptersSlice.test.ts | Store – chapters slice | ❓ Unknown | Unassigned | Review | Pre-split assumptions; needs audit. |
| tests/store/nullSafety.test.ts | Store – null guards | ✅ Passing (2025-10-13) | Unassigned | Keep | Rewritten for slice-based architecture; asserts error logging + export snapshot safety. |
| tests/store/slices/jobsSlice.test.ts | Store – jobs slice | ✅ Passing (2025-10-13) | Unassigned | Keep | Replaced with slice-native harness; covers job lifecycle, selectors, and placeholder worker hooks. |
| tests/utils/api-mocks.ts | Test utility | ✅ Passing | Unassigned | Keep | Shared mock helpers. |
| tests/utils/db-harness.ts | Test utility | ✅ Passing | Unassigned | Keep | Supports DB suites. |
| tests/utils/network-mocks.ts | Test utility | ✅ Passing | Unassigned | Keep | |
| tests/utils/storage-mocks.ts | Test utility | ✅ Passing | Unassigned | Keep | |
| tests/utils/test-data.ts | Test utility | ✅ Passing | Unassigned | Keep | |
| _Legacy (removed)_ tests/services/prompts/PromptBuilder.test.ts | Prompt builder (legacy) | 💤 Obsolete | Unassigned | Remove | File deleted with prompt refactor. |
| _Legacy (removed)_ tests/store/useAppStore.test.ts | Monolithic store | 💤 Obsolete | Unassigned | Remove | Superseded by slice-based store. |

> **Next steps:** Prioritize rewriting the failing suites highlighted above (nullSafety, navigation, EPUB templates, translator, jobsSlice, cost-calculation) and evaluate the `current-system` + `db/contracts` suites for relevance versus maintenance effort. This manifest should be updated after each triage session.

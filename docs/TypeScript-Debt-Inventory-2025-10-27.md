# TypeScript Error Inventory — 2025-10-27

## Command & Raw Output
- Command: `npx tsc --noEmit --pretty false`
- Raw diagnostics saved to [`diagnostics/tsc-errors-2025-10-27.txt`](../diagnostics/tsc-errors-2025-10-27.txt)

## Error Volume by Code
| Count | Code |
| -----:|:-----|
|   102 | TS2339 |
|    40 | TS2353 |
|    36 | TS2345 |
|    29 | TS2322 |
|    19 | TS2740 |
|    17 | TS2304 |
|    11 | TS2551 |
|     7 | TS2556 |
|     6 | TS2554 |
|     4 | TS2741 |
|     4 | TS2739 |
|     3 | TS2769 |
|     3 | TS2367 |
|     2 | TS2719 |
|     2 | TS2558 |
|     2 | TS2503 |
|     2 | TS2352 |
|     1 | TS2678 |
|     1 | TS2582 |
|     1 | TS2559 |
|     1 | TS2484 |
|     1 | TS2440 |
|     1 | TS2307 |
|     1 | TS2305 |

## Distribution by Top-Level Directory
| Count | Directory |
| -----:|:----------|
|   115 | services |
|    96 | tests |
|    37 | store |
|    22 | components |
|    15 | workers |
|     7 | adapters |
|     2 | hooks |
|     1 | types.ts |
|     1 | types |

## Top 30 Files by Error Count
```
     18 tests/store/slices/jobsSlice.test.ts
     17 tests/services/translate/Translator.test.ts
     16 services/db/migration/service-adapter.ts
     14 tests/services/api-key-validation.test.ts
     14 services/translationService.ts
     13 workers/epub.worker.ts
     11 services/indexeddb.ts
     10 components/NovelLibrary.tsx
      9 store/slices/exportSlice.ts
      9 store/slices/chaptersSlice.ts
      9 services/db/index.ts
      8 store/index.ts
      8 services/translate/Translator.ts
      7 services/epub/dataCollector.ts
      7 adapters/providers/GeminiAdapter.ts
      6 tests/services/imageMigrationService.test.ts
      6 services/prompts/PromptRegistry.ts
      5 tests/utils/test-data.ts
      5 store/slices/jobsSlice.ts
      5 services/diff/DiffAnalysisService.ts
      5 services/db/migration/shadow-validator.ts
      4 tests/store/chaptersSlice.test.ts
      4 tests/services/aiService.translateChapter.test.ts
      4 tests/db/open-singleton.test.ts
      4 services/db/migrationService.ts
      4 components/InputBar.tsx
      3 tests/services/epubService.test.ts
      3 tests/services/aiService.providers.test.ts
      3 tests/current-system/feedback.test.ts
      3 store/slices/translationsSlice.ts
```

## Observations & Buckets
- **Stale DTO shapes (IndexedDB + migrations):** `services/db/**/*`, `services/indexeddb.ts`, and fixtures under `tests/utils` account for 35% of diagnostics. Missing properties and mismatched migration adapters dominate the TS2339/TS2353 noise.
- **Translator pipeline drift:** `services/translationService.ts`, `services/translate/Translator.ts`, and the associated tests are hitting TS2345/TS2322 due to widened parameter types and provider contract changes.
- **Worker + EPUB surfaces:** `workers/epub.worker.ts` and `services/epub/dataCollector.ts` share outdated message payload typings, producing TS2304/TS2740 errors.
- **Store slices & selectors:** `store/slices/{chapters,export,jobs}.ts` plus their tests throw TS2339 where inferred state no longer matches the expanded slices.
- **UI touchpoints:** `components/NovelLibrary.tsx` and `components/InputBar.tsx` reflect the same state-shape issues seen in the slices, but concentrated around hydration effects and new props.

Each cluster maps neatly to a domain we can tackle independently while keeping other areas untouched.

## Next Steps Checklist
1. **Decide canonical DTO interfaces** in `types/db.ts` (or a new `types/db/records.ts`) covering chapters, translations, summaries, URL mappings, and migration payloads.
2. **Refactor the DB layer** (`services/indexeddb.ts`, `services/db/operations/*`, `services/db/migration/*`) to consume those interfaces, removing ad-hoc type assertions.
3. **Refresh translator contracts** by codifying `TranslationRequest`, `TranslationResult`, and provider adapter outputs, then align the translator service + tests.
4. **Stabilize worker message typings** by introducing shared `workerMessages.ts` types consumed by `workers/epub.worker.ts` and EPUB services.
5. **Realign store slices** with explicit `State` interfaces and selectors, then update fixtures/tests (`tests/store/**/*`, `tests/utils/test-data.ts`).
6. **Introduce per-domain TS gates** (e.g., `npm run tsc -- --project tsconfig.json --noEmit --pretty false --types services/db/index.ts`) once a domain is green, and track allow-listed exceptions via a curated `types/ts-errors-allowlist.json`.

Progress against this checklist will be captured in `docs/WORKLOG.md` and a forthcoming ADR describing the clean-up protocol.

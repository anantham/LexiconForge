# LexiconForge Tech-Debt Audit — State Management / DB Layer / Migrations

Scope: store/ (8 slices + bootstrap + mediator), services/db/ (core/operations/repositories), services/*Service.ts persistence files, ADRs DB-001 & DB-007.
Method: every file cited below was read in full; the import graph was verified by grepping import statements repo-wide; each finding is marked active vs dead.

> **Rereview correction (2026-08-16):** This is point-in-time audit evidence. `DESPRAWL-ROADMAP-2026-08-16.md` revision 2.1 rechecked application entrypoints and supersedes conflicting active/dead verdicts below. In particular, `migrateImagesToCacheFromDB` is a live operator/debug command exposed deliberately on `window`, even though ordinary application code does not invoke it automatically.

---

## 1. Multiple owners for the same state / config / credential

### 1.1 AppSettings is dual-persisted in localStorage AND the IDB settings store, with no reconciliation — ACTIVE on both sides
- localStorage owner: services/sessionManagementService.ts:18 (settingsStorageKey = "app-settings"), :128-146 (loadSettings), :151-164 (saveSettings), :169-180 (updateSettings). Driven by the store: store/slices/settingsSlice.ts:101,109,117-134,255.
- Component-level third owner: components/SettingsModal.tsx:147 reads localStorage.getItem("app-settings") directly to "verify" a save; :162 also writes novelMetadata to localStorage from inside the modal.
- IDB owner: services/db/repositories/SettingsRepository.ts:22 (appSettingsKey ?? "app-settings"), services/db/operations/settings.ts:4-17 (SettingsOps → repository), services/db/operations/imports.ts:243 (import writes "app-settings" into the IDB settings store), services/db/index.ts:742-745 (makeIdbRepo delegates to SettingsOps).
- WHY it confuses: import a session with settings → imports.ts:243 writes IDB "app-settings", but the app boots from localStorage (initializeStore.ts:556 → settingsSlice.loadSettings → sessionManagementService.loadSettings). The two copies silently diverge; there is no sync, no last-writer-wins rule, no test asserting they agree. API keys ride inside AppSettings, so credentials are dual-owned too.

### 1.2 Same chapter/translation entity has 3-4 concurrent representations
- In-memory: store/slices/chaptersSlice.ts:28 (chapters: Map<string, EnhancedChapter>) with chapter.translationResult embedded.
- Persisted: ChapterRecord/TranslationRecord (services/db/types.ts:12-116) written by ChapterOps/TranslationOps/repositories — a DIFFERENT shape than the store EnhancedChapter (two record types for one entity).
- Derived: chapter_summaries table (schema.ts:230-234) — a third copy of chapter metadata.
- Image sub-state: store/slices/imageSlice.ts:25 (generatedImages in-memory) PLUS imageVersionState persisted inside each TranslationRecord (imageSlice.ts:105,223-238,1278-1289; services/db/operations/imageVersions.ts:90-155) PLUS the blob cache (services/imageCacheService.ts). imageSlice mutates the persisted record through the store copy; imageGenerationService.ts:292-297 mutates chapter.translationResult.imageVersionState directly. Three writers for "image state of one illustration".
- WHY it confuses: a translation saved via translationFacade (which recomputes summaries) and one saved via TranslationOps.update from imageSlice can disagree on which image version is active; overlapping busy-flags (pendingTranslations translationsSlice.ts:31, activeTranslations :30, hydratingChapters uiSlice.ts:52, urlLoadingStates uiSlice.ts:49, isLoading) can drift apart and are read together by clientTelemetry.ts:108-116.

### 1.3 Navigation history: persisted record + in-memory array, read from 5 places
- Persisted: services/db/operations/navigation.ts:10-22 (navigation-history, lastActiveChapter in IDB settings store).
- In-memory: chaptersSlice.ts:33 navigationHistory: string[], hydrated once at boot (initializeStore.ts:450-453).
- Direct readers of the persisted key bypassing the store: store/slices/exportSlice.ts:321, store/bootstrap/importSessionData.ts:70-71, services/importService.ts:969, components/NovelLibrary.tsx:193.
- WHY it confuses: 4+ call sites read/write the same key directly while the store keeps its own array; "clear session" resets the array (clearSession.ts:31) but persistence clearing depends on option flags.

### 1.4 Migration/completion state scattered across 2 storages and ~19 keys
- localStorage: indexeddb-migration-completed (migrationService.ts:63,155,167,174), model-field-repair-completed (migrationService.ts:270,285), lexiconforge-migration-backup-metadata/-data (migrationTypes.ts:8-9), lf:db-backend (db/index.ts:100).
- IDB settings store: ~16 one-shot repair flags (SETTINGS.URL_BACKFILL_FLAG, STABLE_ID_NORMALIZED, ACTIVE_TRANSLATIONS_V2, TRANSLATION_METADATA_BACKFILLED, SUMMARY_NOVEL_ID_BACKFILLED, NOVEL_ID_BACKFILLED, SCOPED_IDENTITY_REPAIRED_V2, SUMMARIES_SYNCED, BOOKSHELF_DEDUPED_V3, CHAPTER_IDS_UNWRAPPED_V4, CHAPTER_NUMBER_CORRECTED_V5, MANGLED_CANONICAL_REPAIRED_V6 — maintenance.ts:563-564,625,694,760,798,833,1340,1361,1509,2588,2791,2944; plus bootRepairsDone/chapterNumbersBackfilled initializeStore.ts:137,222).
- WHY it confuses: two different resetMigrationState() functions exist — services/db/migrationService.ts:173 (clears localStorage flag) vs services/db/index.ts:792 dbUtils.resetMigrationState (clears backend preference, never called in src). Same name, different state, different storage.

### 1.5 Global window side-effects as ownership
- store/index.ts:59-63 exposes window.useAppStore + window.__APP_STORE__; store/index.ts:26 imports ../services/imageMigrationService for its deliberate side effect window.migrateImagesToCacheFromDB (imageMigrationService.ts:154-157). Ordinary application flows do not invoke the migration automatically, but the window exposure is a live operator/debug entrypoint.
- WHY it confuses: module-import-for-side-effect obscures ownership and defeats tree-shaking; removing it is a product decision that must remove both the import and the supported window command.

---

## 2. Migrations / one-shots with no exit condition

### 2.1 migrateFromLocalStorage marks itself complete BEFORE doing the work and swallows per-section errors — currently DEAD but a landmine
- services/db/migrationService.ts:63 — flag indexeddb-migration-completed=true is set BEFORE any migration runs.
- :79-107, :110-119, :122-139 — each section wraps its work in try/catch that only console.errors; a corrupted session-data JSON or a failed SettingsOps.store does not abort.
- :143-150 — the localStorage cleanup is COMMENTED OUT, so the old data (session-data, app-settings, feedback-history) is never removed → permanent stale duplicate.
- Exit condition: the flag is only removed on a thrown error (:155); an interrupted tab close leaves the flag set with a partially migrated DB forever.
- Active/dead: grep shows migrateFromLocalStorage, isMigrationCompleted, migrationService.resetMigrationState have ZERO importers in src (definitions only). The path is dead but exported, so it can be re-armed by any future caller.

### 2.2 repairMissingModelFields sets its completion flag even when repairs FAILED — ACTIVE at boot
- services/db/migrationService.ts:270 — localStorage.setItem("model-field-repair-completed", ...) written unconditionally, even when result.errors.length > 0 (only a warn at :299-301).
- :284-286, :291-302 — isModelFieldRepairCompleted() gates on key EXISTENCE; failed records are never retried on later boots.
- Active: store/bootstrap/initializeStore.ts:12,141 runs ensureModelFieldsRepaired() inside boot repairs; utils/versionFormatting.ts:34 even tells users to "Run ensureModelFieldsRepaired() to fix."
- Exit condition: none beyond flag existence; no completeness check (scanned vs repaired counts are logged but never gated).

### 2.3 The ~16 boot-repair flags: each is "if (already) return" with no versioning, no removal trigger
- Pattern at services/db/operations/maintenance.ts:568,629,698,764,802,837,1347,1399,1916,2647,2862 and initializeStore.ts:137,222.
- Flags are NOT coupled to SCHEMA_VERSIONS (schema.ts:11-29), so a repair that ran against buggy code and set its flag can never be re-run after the fix lands — the only escape is manual IDB surgery.
- The aggregate gate bootRepairsDone was correctly fixed to not set on failure (initializeStore.ts:167-179), but each individual repair sets its own flag unconditionally at the end (e.g. maintenance.ts:563-564).

### 2.4 Version gate "migration-failed" exit is only restore; crashed upgrades leave "pending" metadata that the gate ignores
- services/db/core/versionGate.ts:42-53 — gate is derived from canRestoreFromBackup() (migrationRestore.ts:28-31), which requires metadata.status === "failed".
- connection.ts:143-148 marks "failed" only if the JS catch runs; a browser-killed mid-upgrade leaves status "pending" — the gate then silently re-backups and re-migrates, overwriting the previous backup (migrationBackup.ts:31-74; openDbReadOnly :79-92 aborts if the DB already upgraded).
- After success, markBackupCompleted (connection.ts:137) leaves the metadata key + backup artifacts; cleanupOldBackups (migrationBackup.ts:173-194) deletes only after 7 days and fires ONCE, fire-and-forget (connection.ts:138, catch swallowed). If that single call fails, multi-MB backup data + metadata persist indefinitely and getBackupMetadata() returns "completed" forever.
- Exit condition: the gate has no "retry migration" or "discard backup and proceed" action (versionGate.ts:29 actions: update-app / restore-backup / create-backup / fresh-start); components/MigrationRecovery.tsx renders only those. A permanently-failed backup (restore that fails again at migrationRestore.ts:86-92) leaves the app stuck at the gate with no third path.

---

## 3. Derived / materialized state with no completeness or reconciliation boundary

### 3.1 chapterCatalog module cache is never invalidated in production
- services/chapterCatalog.ts:75 — const cache = new Map<string, ChapterSummary[]>(); invalidation only via clearCatalogCache() (:162), and grep shows clearCatalogCache is called ONLY from tests — zero production callers. The header comment itself hedges: "cleared via clearCatalogCache() on novel switch / settings change IF NEEDED" (:24).
- WHY it confuses: the catalog is DERIVED from RegistryService metadata (novel chapterCount / version chapterRange, :85-100); if registry metadata changes mid-session, every dropdown/oscilloscope surface keeps projecting the stale range. Derived state with no reconciliation trigger.

### 3.2 chapter_summaries table: reconciliation exists but is gated to run once
- services/db/operations/summaries.ts:74-114 syncAllChapterSummaries IS a proper recompute-from-source (chapters + active translations). But the call path is the one-shot SETTINGS.SUMMARIES_SYNCED flag (maintenance.ts:1347,1361), so after first boot the table only stays fresh via recomputeChapterSummary on translation write paths (repositories/translationFacade.ts:10,17; operations/chapters.ts:54,224) — NOT on chapter-metadata-only changes. seedChapterSummariesIfEmpty (summaries.ts:116-126) only seeds an empty table.
- WHY it confuses: "summaries are authoritative" is true only for translations; any other mutation path leaves hasTranslation/title/chapterNumber stale until someone forces MaintenanceOps.syncSummaries (imports.ts:531,614 do; nothing else does).

### 3.3 Persisted caches without TTL: provider credits, OpenRouter key usage, last-used map, capability failures
- services/providerCreditCacheService.ts:41,46 — credit summary cached in IDB with no expiry read; services/openrouterService.ts:180,198 (KEY_USAGE_KEY, LAST_USED_KEY) — no TTL; services/openrouterImageModelAdapter.ts:236 — image-model catalogue.
- services/capabilityService.ts:305-318 — session-scoped cache.failures learned-failure set; the only pruning function clearCapabilityCache() (:344) has ZERO production callers (tests only). A single transient 404 poisons hasRecordedParameterFailure for the whole session, permanently changing request shape for a paid call.
- The one cache with TTL discipline (OpenRouter models, settingsSlice.ts:299-305 age < 1h) shows the pattern was known and applied inconsistently.

### 3.4 In-memory url indexes never reconcile with the persisted store
- chaptersSlice.ts:36-37 urlIndex/rawUrlIndex are hydrated only when BOTH are empty (initializeStore.ts:414), then mutated in-slice (addUrlMapping, chaptersSlice.ts:66) and by other writers to url_mappings (StableIdManager, imports). A partially-populated index is never refreshed against the store.

---

## 4. Compatibility branches without a trigger for eventual removal

### 4.1 "legacy" backend value handling persists after the legacy backend was deleted
- services/db/index.ts:101-107 (LEGACY_BACKEND_VALUE="legacy", env warning), :112-120 (warnLegacyPreference), :623 (normalizeBackend maps legacy→modern), :629-647 (resolveBackendPreference warns + rewrites), :785-787, :808-812.
- The comment at :806-807 says the legacy backend "was removed long ago", yet the compat branch lives on with no deletion date. The only dated trigger — "Named emergencyRollback until 2026-07-26" (:805) — governs resetToModernBackend, which is itself NEVER called (grep: only definition).
- WHY it confuses: future readers must understand "legacy" is a dead value that can only appear in ancient user profiles via the lf:db-backend key (:100).

### 4.2 Vestigial repository factory API kept for 3 call sites
- getRepoForService() — "The old signature took a ServiceName that was IGNORED (nine registered names, zero routing)" (db/index.ts:771-778). Active callers: services/navigation/index.ts:14,243,335; services/navigation/hydration.ts:2,229. Everything else imports operations directly.
- makeIdbRepo is still labeled "placeholder for full implementation" (:711) while being the DEFAULT backend — the comment is inverted reality.

### 4.3 The ~16 one-shot repair functions are permanent compat branches (see 2.3) — maintenance.ts list in §2.3; no removal plan, no version coupling.

### 4.4 Legacy field-compat without triggers
- normalizeDiffVisibility maps legacy "raw" → rawLoss/rawGain (sessionManagementService.ts:108-114) forever; mapLegacyFeedbackType converts emoji feedback (db/index.ts:289-302) forever; resolveMigrationSettings fallbacks (migrationService.ts:25-41) forever. None have "drop after X" markers.

### 4.5 Dead-but-kept legacy code
- migrateFromLocalStorage + isMigrationCompleted (zero importers, §2.1); dbUtils (zero access in src — grep "dbUtils." → none); resetToModernBackend (zero callers); validateSchema/exportSchema/getStoresForDomain/DOMAIN_STORES (schema.ts:47-54,408-410,415-449,467-497 — zero importers, but leaked via "export * from ./core/schema" at db/index.ts:818). None have a removal ticket or comment. `migrateImagesToCacheFromDB` is excluded from this list because its window exposure is a live operator/debug entrypoint.

---

## 5. Old and new implementations BOTH active

### 5.1 Operations layer and repositories layer are both active AND entangled in both directions
Verified import graph (grep, all in src):
- operations → repositories: operations/translations.ts:4 → repositories/translationFacade.ts (comment :36-39: "Thin static API over translationFacade"); operations/feedback.ts:3 → repositories/instances.ts; operations/settings.ts:2 → repositories/instances.ts; operations/templates.ts:1 → repositories/instances.ts; operations/imageVersions.ts:3-4 → instances + translationFacade.
- repositories → operations: repositories/translationFacade.ts:5 imports ensureChapterUrlMappings, recomputeChapterSummary from ../operations/chapters and uses them at :10,17,29,43,67,72. THIS IS A CYCLE: operations/translations → repositories/translationFacade → operations/chapters.
- The cycle is acknowledged: operations/sessionExport.ts:2-5 documents that importing the barrel (operations/index.ts) from within operations is "a real import cycle with TDZ/undefined-at-init risk".
- Both layers implement the same domains differently: ChapterRepository (repositories/ChapterRepository.ts, active via translationFacade lookups) vs ChapterOps (operations/chapters.ts, active via slices) are two chapter-access implementations with DIFFERENT error behavior — documented as a past bug source at operations/chapters.ts:26-29 and core/stable-ids.ts:26-33 ("there used to be two divergent copies: this one swallowed errors and dropped libraryVersionId; the other propagated and carried it").
- Factory layer usage: services/db/index.ts repo factory is consumed only by navigation (getRepoForService, §4.2); store slices bypass it and call operations directly (chaptersSlice.ts:17, translationsSlice.ts:19, exportSlice.ts:9, initializeStore.ts:6-11); migrationService.ts:13 imports operations AND translationFacade (:11) simultaneously.
- DB-001 Implementation Notes (docs/adr/DB-001-...md:8-17) claim a clean operations/repositories/core layering; the imports above show operations and repositories are mutually dependent — the ADR describes intent, not reality.

### 5.2 Two session-export implementations
- SessionExportOps.exportFullSession (operations/sessionExport.ts:24 → operations/export.ts:190), used by exportSlice.ts:180 and db/index.ts:759-760.
- ExportService.generateQuickExport (services/exportService.ts:87), used by components/session-info/PublishWizard.tsx:11, components/settings/SessionExportPanel.tsx:2, components/sutta-studio/SuttaStudioDebugButton.tsx:5. This service IMPORTS THE STORE SINGLETON (exportService.ts:1: import { useAppStore } from "../store") — a service→store dependency (layer inversion) — and re-implements serialization of chapters/translations/feedback/images (:5-6) that the db-layer export already does, with different completeness guarantees (db one adds diff results + amendment logs; service one adds provenance).

### 5.3 Three retry systems
- utils/retry.ts withRetry (active: capabilityService.ts:136,168; importService.ts:210; sutta-studio/llm.ts:117).
- services/db/core/errors.ts:102-140 RetryPolicy (active: core/txn.ts:35 inside withTxn).
- Inline retry loop in services/translate/Translator.ts:98-105 (uses settings retryMax/retryInitialDelayMs, sessionManagementService.ts:40-41) — a third implementation with its own backoff/timeout.
- CONTRADICTORY SEMANTICS: retry.ts:34-35 deliberately excludes AbortError from retry; errors.ts:64-67 maps AbortError → "Transient" → isRetryable true (:31-33) → RetryPolicy WILL retry a user abort inside withTxn. Same error class, opposite retry decisions, same codebase.

### 5.4 ADR DB-007 documents an engine that was never built
- docs/adr/DB-007-...md:55-150 specifies a schema_meta store, MigrationEngine, migration_log, rollback_data — grep confirms ZERO of these exist in src (only in the ADR). The Implementation Notes (:8-13) claim "fully implemented" with "Current schema version: 13", while schema.ts:28 says CURRENT: 16, and the referenced guides/INDEXEDDB_SCHEMA.md does not exist.

---

## 6. Retry semantics correct internally but converted to terminal failure by a caller

### 6.1 getModelMetadata drops loadError — the strongest instance
- services/capabilityService.ts:323-326: const { map: models } = await loadModels(); return models.get(modelId) || null; — the loadError field (returned at :154 as { map: cache.models || new Map(), loadError: true } after withRetry exhausts its 4 attempts at :136-146) is DISCARDED. getModelPricing (:328-337) and getModelLimits (:339-342) inherit the silent null.
- Consumers: services/rateLimitService.ts:6, adapters/providers/OpenAIAdapter.ts:5, scripts/sutta-studio/lib/cost.ts:12, image planning. A transient outage at boot makes pricing/limits "unknown" indistinguishable from "model has no metadata" — cost estimation silently degrades.
- The codebase KNOWS this matters: :190-192 ("consumers downgrade paid requests to json_object on false, so the source matters") and supportsParameters/getStructuredOutputsSupport DO honor loadError (:199-206, :267-274). Only getModelMetadata drops it. Retries correct; the caller converts exhaustion into a terminal "no data".

### 6.2 supportsParameters converts retry-exhaustion into a permissive true
- capabilityService.ts:296-299: catch → return true ("Fallback to permissive"), with the comment at :270-271 admitting "unsupported params ship on paid requests" when metadata fails open. The internal retry (:267 via loadModels) is correct; the caller terminalizes the failure into the most dangerous answer (claiming support).

### 6.3 Auto-translate: internal retries fail → mediator marks the chapter permanently no-retry for the session
- store/autoTranslateMediator.ts:80,112-115 — autoTriggered set is never cleared even on failure; shouldAutoTranslate stays true after a failed handleTranslate (chapter still untranslated) but the guard blocks re-fire. handleTranslate internally retries (Translator.ts loop), but its final throw lands in the mediator as "already auto-translated this session" — a transient outage becomes a terminal, per-session, billed-call-protection state. Deliberate and commented (:66-79), but it is exactly the "correct retry converted to terminal by the caller" pattern: a provider recovering mid-session will not re-trigger until manual retranslate.

### 6.4 Boot-repair callers terminalize partial success
- migrationService.ts:270 sets the repair flag even with errors.length > 0 (see §2.2) — the repair scan semantics are sound, but ensureModelFieldsRepaired (:291-302) converts the outcome into "done forever". Contrast with the aggregate gate, which was fixed to not set on failure (initializeStore.ts:167-179) — the two patterns coexist.

---

## Active vs dead — import verification summary (grep across src)

| Symbol | Verdict | Evidence |
|---|---|---|
| migrateFromLocalStorage, isMigrationCompleted, migrationService.resetMigrationState | DEAD | zero importers (definitions only) |
| ensureModelFieldsRepaired | ACTIVE | initializeStore.ts:12,141 |
| DOMAIN_STORES, getStoresForDomain, validateSchema, exportSchema | DEAD | zero importers; leaked via db/index.ts:818 export * |
| dbUtils, resetToModernBackend, clearCapabilityCache | DEAD | zero src callers (tests only) |
| getRepoForService | ACTIVE | navigation/index.ts:14,243,335; hydration.ts:2,229 |
| makeRepo | ACTIVE only internally/tests | no production importers besides getRepoForService |
| repositories (5 classes + instances + facade) | ACTIVE | imported by operations (5 files) + migrationService + tests |
| operations (~18 files) | ACTIVE | imported by store slices, services, db/index, migrationService |
| migrateImagesToCacheFromDB | ACTIVE operator/debug surface | exposed on `window` by the deliberate side-effect import in store/index.ts:26; not called automatically |
| RetryPolicy | ACTIVE | txn.ts:35 |
| withRetry | ACTIVE | capabilityService, importService, sutta-studio/llm |

## Highest-leverage next steps (suggestions only)
1. Single-own AppSettings: kill the localStorage path (sessionManagementService.ts:128-180) or the IDB "app-settings" path (imports.ts:243, SettingsRepository.ts:22); keep one and write a migration.
2. Repair-flag registry: replace ~19 ad-hoc flags with one versioned repairs record keyed by schema version, so failed/obsolete repairs are re-runnable and removable.
3. Un-entangle layers: make repositories the only IO with operations as thin wrappers, or delete the facade cycle; remove translationFacade.ts:5 import of operations/chapters (move summary recompute into the repository or a domain event).
4. Fix getModelMetadata to surface loadError (discriminated result like the other two call sites) and prune cache.failures with a TTL.
5. Delete dead code (§4.5) in one PR per area; add removal-date comments for the rest.

Confidence: 0.9 — all file:line references verified by direct read and grep during this session; active-vs-dead verdicts are grep-backed, not inferred.

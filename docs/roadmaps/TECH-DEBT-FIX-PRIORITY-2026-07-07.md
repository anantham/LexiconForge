# LexiconForge — Tech-Debt Fix Priority Plan (2026-07-07)

Companion to `TECH-DEBT-DEEP-AUDIT-2026-07-07.md` (55 verified findings). This document
sequences the fixes. Ordering is by **blast radius × irreversibility × leverage**, not raw
severity: a cheap fix that stops silent data loss outranks an expensive high-severity refactor.
Findings that share one root fix are batched so a single PR closes several.

Effort key: **S** ≈ <½ day, **M** ≈ ½–2 days, **L** ≈ multi-day. Each item lists the audit
findings it closes.

---

## P0 — Stop silent loss of data and money (do first)

These share one trait: **the user cannot tell it happened.** No error, no log they'll read —
translations, images, backups, or dollars vanish quietly. That invisibility is what makes them
top priority regardless of individual severity.

### P0.1 — Make DB writes durable: resolve on `oncomplete`, not `onsuccess`  · effort S · HIGH
- **Fix:** In `services/db/core/txn.ts:63`, resolve `withTxn` from `transaction.oncomplete`
  (capturing the operation result in a closure) instead of from the operation promise. Apply the
  same to `TranslationRepository.writeTranslation` (`:126`) and `deactivateTranslations` (`:143`).
- **Why first:** This is the foundation of a local-first app whose only datastore is IndexedDB.
  Today every write reports success on `request.onsuccess` (fires in memory, before commit). A
  commit-time abort — the canonical case being `QuotaExceededError` on a large chapter or base64
  image — rejects an already-resolved promise (a no-op), so the store shows success, the retry
  policy never fires, and the record is gone. The bug also masks itself: you won't see it until a
  user's quota fills, then they lose translations with no trace.
- **Closes:** `txn.ts:63` (high), `TranslationRepository` writeTranslation path, and the
  swallowed-persist half of `imageGenerationService.ts:302`.

### P0.2 — Unify the `chapterUrl` keyspace so imports don't collide/orphan  · effort M · HIGH
- **Fix:** Make `resolveChapterUrl` (`TranslationRepository.ts:242`) prefer the chapter record's
  own storage URL (look up by `stableId` first, fall back to `URL_MAPPINGS`) so every write path
  keys translations under one canonical URL.
- **Why:** Imported library chapters and live translations currently live in two different URL
  keyspaces. That produces unique-index collisions, orphaned translation rows, and
  non-deterministic version lists — corruption that compounds silently over time and is very hard
  to diagnose after the fact.
- **Closes:** `TranslationRepository.ts:242` (high). Prerequisite for trusting P0.3.

### P0.3 — Fix session import: version order + set-active target  · effort S · HIGH
- **Fix:** In `services/importService.ts:695`, store versions ascending (or honor exported
  numbers) and call `setActiveByUrl` with `identity.storageUrl` (or resolve via
  `setActiveByStableId`). Separately (`imports.ts:367`), look up existing records by index and
  merge/overwrite deterministically instead of aborting mid-import with no rollback.
- **Why:** Restoring a backup today silently discards the exported active-version selection
  (reverse renumbering + wrong-URL set-active) and, on any unique-index conflict, aborts halfway
  leaving a partially-imported DB. A backup you can't reliably restore is not a backup.
- **Closes:** `importService.ts:695` (high), `imports.ts:367` (medium).

### P0.4 — Close the cost fail-open and the budget undercount  · effort S · HIGH
- **Fix:** `services/ai/cost.ts:62` must not return `$0` for an unpriced model — throw or mark
  cost unknown and have budget mode refuse to proceed. `budgetOps.ts:25` must sum `estimatedCost`
  across **all** versions of each chapter (or from the `api_metrics` ledger), not just the active
  version.
- **Why:** Budget mode is a spend *safety gate*, and both bugs defeat it. An unpriced model zeroes
  `estimatedCost`, so a 999-chapter preload runs with the gate believing it's free. The
  active-only sum lets cumulative spend exceed the cap. Real dollars, and the user set the cap
  precisely because they wanted the ceiling enforced.
- **Closes:** `cost.ts:62` (high), `budgetOps.ts:25` (medium). Pairs with P1.4.

### P0.5 — Guard `handleRetryImage` against double-fire  · effort S · HIGH
- **Fix:** In `store/slices/imageSlice.ts:428`, return early if
  `get().generatedImages[key]?.isLoading`, and allocate the version number inside the post-await
  `set()` from `prevState.imageVersions`, not the pre-await snapshot.
- **Why:** The retry/regenerate buttons are only disabled on `isSaving`, which the common
  "retry without editing the caption" path never sets — so a physical double-click (or a manual
  retry racing the auto-trigger at `translationsSlice.ts:1528`) launches two *paid* generations,
  both keyed to the same version. The second overwrites the first; one paid image is lost and the
  counter advances by one. Money + data, user-invisible.
- **Closes:** `imageSlice.ts:428` (high).

### P0.6 — Persist feedback-comment edits  · effort S · MEDIUM (high user-visibility)
- **Fix:** Rewrite `updateFeedbackComment` (`translationsSlice.ts:1074`) to locate the item in
  `chapter.feedback`, produce new array/item objects via `updateChapter`, mirror into
  `feedbackHistory` immutably, and persist via `FeedbackOps` — the unused
  `FeedbackRepository.updateFeedbackComment` already exists.
- **Why:** Editing a feedback comment is wired to a real UI button but is a total no-op for any
  feedback from a prior session, and never persists even in-session — the edit is always gone on
  reload. It's a refactor regression (the archived store did it correctly), directly loses typed
  user input, and is trivially reproducible.
- **Closes:** `translationsSlice.ts:1074` (medium, verifier conf 0.95).

---

## P1 — Correctness bugs users hit, and the cheap high-leverage cleanups

### P1.1 — One shared illustration-marker regex (kills a family of bugs)  · effort S · HIGH LEVERAGE
- **Fix:** Replace the double-escaped `/\\[ILLUSTRATION.../` with a single exported constant
  `/\[ILLUSTRATION-\d+[A-Za-z]*\]/g` used everywhere.
- **Why:** The same copy-paste typo appears in three live places and causes three distinct
  user-facing failures: Claude **duplicates illustration markers on every translation**
  (`claudeService.ts:215`); the prior-chapter context hint always reports "Illustration markers: 0"
  (`prompts.ts:26`); and the structured-output summary tells the model prior chapters had **zero**
  illustrations, actively suppressing illustration output (`prompts.ts:50`). One ~5-line change,
  three bugs closed, immediately visible in output quality.
- **Closes:** `claudeService.ts:215` (medium), `prompts.ts:26` (low), `prompts.ts:50` (low).

### P1.2 — Route all provider adapters through the shared validators/extractors  · effort M · MEDIUM
- **Fix:** Have all three live adapters use `responseValidators.validateAndFix{Illustrations,
  Footnotes}` with a consistent `strictMode`, and consolidate to one balanced-JSON extractor
  (the `gemini.ts` state-machine version). Then resolve the dead-tested-path problem: either delete
  `services/ai/providers/{gemini,openai}.ts` and point tests at the real adapters, or make the
  adapters delegate to them so the shipped code is the tested code.
- **Why:** Provider choice currently changes behavior — Claude hard-fails where Gemini/OpenAI
  silently ship dangling markers; OpenAIAdapter's JSON extractor mishandles escaped quotes
  differently from the others. Worst of all, the entire suite that "covers" translation exercises
  code that production never runs (`aiService.ts` reaches the real adapters, tests reach
  `__testUtils`), so the live adapters are effectively untested.
- **Closes:** `OpenAIAdapter.ts:699` (medium), `aiService.ts:7` (medium), `OpenAIAdapter.ts:583`
  (low), `illustration-validation.test.ts:5` (low). Depends on P1.1 for the regex.

### P1.3 — Make timeouts actually abort; stop fail-open successes  · effort M · MEDIUM
- **Fix:** Thread real `AbortController`/`AbortSignal.timeout` into the image fetch
  (`imageService.ts:294`) and the per-attempt translation timeout (`Translator.ts:99`) so a
  timed-out call cancels instead of leaving state stuck or stacking a duplicate billed retry. In
  `gemini.ts:379`, treat an empty `translation` in the fallback branch as a parse failure (throw),
  not a success.
- **Why:** Today a stalled image connection hangs the loading state forever; a translation timeout
  fires a retry while the original request is still billing (concurrent duplicate spend); and a
  Gemini fallback can persist a **blank chapter as a success** with no error. These are the async
  landmines the codex "empty catch" pass didn't reach.
- **Closes:** `imageService.ts:294` (medium), `Translator.ts:99` (medium), `gemini.ts:379`
  (medium), and surfaces the `imageGenerationService.ts:302` swallow (medium) started in P0.1.

### P1.4 — Record billed-but-unparseable responses in the cost ledger  · effort S · MEDIUM
- **Fix:** In `OpenAIAdapter.ts:681`, compute tokens/cost from `response.usage` and write a
  `success:false` metric **before** `JSON.parse`, so spend is counted even when parsing fails.
- **Why:** A provider bills you whether or not the JSON parses. Right now those responses hit
  neither cost ledger, so real spend is invisible to the budget gate — the same "budget is a lie"
  theme as P0.4.
- **Closes:** `OpenAIAdapter.ts:681` (medium); reconcile the three cost formulas
  (`exportService.ts:471`, low) into one canonical function while here.

### P1.5 — Fix prior-chapter context assembly  · effort S · MEDIUM
- **Fix:** Reverse the `prevUrl`-chain fallback to oldest→newest (`translationService.ts:789`) and
  delete the stale private `convertFeedbackRecordToItem`, using the canonical
  `feedbackRecordToItem` that carries `comment` (`translationService.ts:206`).
- **Why:** These silently degrade every translation. The fallback path feeds prior chapters in the
  wrong order (contradicting the template's own "(OLDEST)" label), and IDB-hydrated feedback
  reaches the model with the user's actual comments stripped out — the guidance the user wrote is
  dropped before it ever influences the translation.
- **Closes:** `translationService.ts:789` (medium), `translationService.ts:206` (medium);
  consider `translationService.ts:620` (low) chapter-number selection at the same time.

### P1.6 — Two remaining state races  · effort S · MEDIUM
- **Fix:** In `translationsSlice.ts:279`, add `chapterId` to `pendingTranslations` synchronously
  before the budget await (remove on early return). In `translationsSlice.ts:1135`, remove the
  amendment proposal by identity, not positional index, and synchronously before the await. Fix the
  boot race (`autoTranslateMediator.ts:69`) by re-reading `get().chapters` after awaits and
  including pending transitions in the `changed` gate.
- **Why:** All three are the P0.5 pattern (snapshot before await). They cause: the same chapter
  translated twice (double spend, duplicate versions); a double-click silently discarding the
  **next** queued proposal without applying or logging it; and a spurious "Chapter not found" on
  boot that can permanently skip auto-translate.
- **Closes:** `translationsSlice.ts:279` (medium), `translationsSlice.ts:1135` (medium),
  `autoTranslateMediator.ts:69` (medium). Also fold in `imageSlice.ts:212` (low) in-place mutation.

---

## P2 — Restore benchmark validity (before the next model selection)

The leaderboard is your stated instrument for "expensive ≠ better" model choice. These bugs mean
it currently measures something other than what production runs, so a decision made on it may be
wrong. Batch as one "benchmark parity" PR.

### P2.1 — Anatomist grounding parity  · effort M · HIGH
- **Fix:** Decide the intended behavior, then make code and ADR agree. Either build `dpdLookups`
  before the anatomist call in `services/compiler/index.ts:409` (mirroring the lexicographer block)
  so production is grounded, **or** remove `dpdLookups: anatomistDpd` from `benchmark.ts:970` and
  correct SUTTA-014's parity table.
- **Why:** The benchmark anatomist is DPD-grounded; production's is not — the opposite of what ADR
  SUTTA-014's parity table asserts (and the audit recorded that row as closed). The board ranks a
  grounded pass real users never run.
- **Closes:** `compiler/index.ts:409` (high).

### P2.2 — Stop dropping failed phases from the ranked mean  · effort M · HIGH
- **Fix:** In `generate-leaderboard.ts:392`, charge every golden-backed phase a model failed to
  complete as a 0 (or rank all models over the common phase intersection), derive the coverage
  denominator from the configured phase universe, and surface drops in `excluded.reasons`.
- **Why:** Survivorship at the phase level — a model that fails hard phases is averaged only over
  the ones it survived, so failing looks like a competitive advantage. This is the exact class of
  bias the earlier golden/metric work fought at the word level.
- **Closes:** `generate-leaderboard.ts:392` (high).

### P2.3 — Parity + publication consistency  · effort M · MEDIUM
- **Fix:** Define per-pass token budgets once (shared constants) consumed by both
  `compiler/index.ts` and the pass runners (`skeleton.ts:69`); make `publish-compare.ts` a pure
  replay of the frozen `quality-scores.json` (or recompute all numbers and stamp the scorer
  version so mismatches fail loudly); filter run selection to `status: complete`.
- **Why:** Benchmark passes allow 16000 completion tokens vs production's 3000–8000 (silent
  production-side degradation, absent from the ADR table); the compare "View" recomputes some
  numbers at publish time while reading `overall` frozen, so board and audit artifact disagree on
  which phases count; and "latest run" can surface an in-progress/errored run as canonical.
- **Closes:** `skeleton.ts:69` (medium), `publish-compare.ts:126` (medium),
  `publish-compare.ts:96` (low), `benchmark.ts:353` (low).

---

## P3 — Performance, security hardening, and hygiene

Real debt, but lower blast radius or opportunistic. Do after P0–P2.

### P3.1 — Shrink the entry chunk  · effort M · MEDIUM
- Route-split the Sutta-Studio / Liturgy / benchmark subsystem with `React.lazy` + `Suspense`
  (`App.tsx:5`) and drop `eager:true` from the DPD glob (`dpd-loader-vite.ts:22`), loading only the
  DPD subset for the compiled sutta. Together these remove ~1.2MB+ (incl. a 0.49MB packet) from the
  3.85MB main chunk every visitor downloads. **Closes** `App.tsx:5`, `dpd-loader-vite.ts:22`,
  and relates to the dead `workers/epub.worker.ts` (main-thread packaging).

### P3.2 — Export secret redaction + SSRF/HTML boundaries  · effort S–M · MEDIUM/LOW
- Redact export keys by robust predicate, adding `deeplApiKey`/`googleTranslateApiKey` explicitly
  (`export.ts:285`, medium — currently leaked in full-session JSON export). Consolidate the
  triplicated SSRF allowlist into one shared module both proxies import (`allowedDomains.ts:3`).
  Strip `on*`/`javascript:` attributes for **all** allowed tags in `sanitizeHtml`
  (`HtmlSanitizer.ts:23`) — it's a false safety boundary for untrusted LLM output today.

### P3.3 — Export round-trip completeness  · effort S · MEDIUM
- Add the omitted fields (`proposal`, `customVersionLabel`, `imageVersionState`,
  `settingsSnapshot`, `blurb`, `sourceLanguage`) to the export and both import paths, or merge on
  import instead of whole-record `put` (`export.ts:217`). Otherwise re-importing a backup silently
  wipes those fields.

### P3.4 — Config, dead code, and CI truth  · effort S each · LOW
- Rename `.env.example` keys to their `VITE_` names (`:11`) — currently silently disables Google
  Drive import + the free-trial key. Fix or hide the `/sutta/pipeline` route that 404s in prod
  (`vite.config.ts:143`) and the loader's non-existent `npm run bench:sutta-studio` hint
  (`SuttaStudioPipelineLoader.tsx:137`). Delete the five dead files, the stale
  `generate-steering-image-list.js`, and the dead audio-storage files excluded from tsconfig
  (`tsconfig.json:34`). Add a Playwright smoke job to CI (`test.yml:28`) — the entire e2e layer
  never runs today. Break the `db/operations` barrel import cycle (`sessionExport.ts:3`).

### P3.5 — Add the missing regression tests  · effort M · MEDIUM
- The only auto-retry cost-storm test is `it.skip`'d and its replacement was never written
  (`appScreen.integration.test.tsx:216`); the mediator has no retry-guard at all. Write the focused
  test and add the guard. Do this alongside P1.2 so the newly-consolidated code lands tested.

---

## One-glance sequencing

1. **P0** (data + money loss): DB durability → keyspace → import → cost/budget → image race →
   feedback persist.
2. **P1** (user-visible correctness + cheap leverage): illustration regex → provider consolidation
   → abort/timeouts → cost ledger → context assembly → remaining races.
3. **P2** (benchmark validity) before any new model-selection decision.
4. **P3** (perf, security, hygiene) opportunistically.

Suggested first PR: **P0.1 + P0.4 + P0.5 + P0.6** — all effort-S, all stop silent loss, minimal
surface overlap, one afternoon. Then P0.2/P0.3 (the import/keyspace pair) as a focused second PR
since they interact.

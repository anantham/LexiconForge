# LexiconForge — Deep Tech-Debt Audit (beyond the codex pass)

_Generated 2026-07-07 by a 13-lens multi-agent audit with adversarial verification of every finding. Read-only; no files were modified during the audit._

## What this is

The earlier single-model (codex-style) audit found the surface debt: tsc-red, API keys in the client bundle, one unsafe `?path=` fetch, empty catch blocks, `new Promise(async)`, ~245 `as any`, the *existence* of duplicate EPUB/Sutta-Studio pathways, and LOC counts. This pass was told **not to re-report any of those** and to find what a single reader misses: behavioral *divergence* between the known duplicates, races, silent persistence failures, money/cost correctness, and benchmark-fairness bugs.

**Method:** 10 finder lenses ran in parallel; a completeness critic then added 3 more that proved the highest-yield (cost accounting, prompt-context assembly, benchmark aggregation). Every candidate was handed to a separate *adversarial verifier* whose default stance was to refute it by reading the code. **55 findings survived; 3 were refuted** and dropped.

## Scoreboard

| Severity | Count |
|---|---|
| 🔴 Critical | 0 |
| 🟠 High | 7 |
| 🟡 Medium | 25 |
| ⚪ Low | 23 |
| **Total** | **55** |

## The four systemic patterns underneath

Most of these are instances of four root patterns, not 55 unrelated bugs:

1. **"Success" reported before durability.** IndexedDB writes resolve on `onsuccess` (in-memory) instead of `oncomplete` (committed), so commit-time aborts (quota/disk) are invisible. The store and the DB then silently disagree. (txn.ts, TranslationRepository, imageGenerationService)
2. **Snapshot-before-await races.** Actions read a version/guard from `get()`, then `await` a long network call, then write using the stale snapshot. Double-clicks and auto+manual co-fires produce duplicate paid API/image calls and lost records. (imageSlice retry, translate dedup, acceptProposal)
3. **The benchmark and production run different code.** The ranked leaderboard — the stated model-selection instrument — grounds/limits passes differently than production and drops failed phases from the mean. The parity ADR asserts parity that the code contradicts.
4. **Copy-paste that drifted.** The same logic (JSON extraction, illustration-marker validation, cost math, HTML sanitizing) exists in 3+ places that now behave differently; the "dead" copy is sometimes the live one.

## Findings

---

## 🟠 HIGH (7)

### 🟠 HIGH 1. Benchmark anatomist is DPD-grounded but the production anatomist never is — and ADR SUTTA-014's parity table asserts the opposite

- **File:** `services/compiler/index.ts:409`
- **Lens:** Behaviorally divergent duplicate pathways · **verifier confidence:** 0.9

**Evidence.** Production compile (UI: components/sutta-studio/SuttaStudioApp.tsx -> suttaStudioCompiler.ts shim -> compiler/index.ts) builds the anatomist prompt WITHOUT dictionary grounding: `const anatomistPrompt = buildAnatomistPrompt(phase.id, effectiveSegments, phaseState, retrievalContext || undefined);` (index.ts:409 — 4 args; production builds `dpdLookups` only inside the LEXICOGRAPHER block, index.ts:514-539). The benchmark path passes the 5th arg: services/sutta-studio/passes/anatomist.ts:54 `buildAnatomistPrompt(phaseId, segments, phaseState, retrievalContext, dpdLookups)`, fed from scripts/sutta-studio/benchmark.ts:970 `dpdLookups: anatomistDpd,`. That 5th arg activates a large grounding block in the prompt (services/sutta-studio/prompts/anatomist.ts:63-66, 'DPD attestations ... INFORM your morpheme split'). Yet docs/adr/SUTTA-014-grounded-benchmark-track.md:29 claims production is at parity: `| DPD attestations (dpdLookups) | fed to anatomist + lexicographer | **already fed** (since #21) — at parity |`. Git confirms production never had it: `git log -S dpdLookups -- services/compiler/index.ts` shows only bc46e47 'wire DPD into the live lexicographer pass', and every historical revision of index.ts has the 4-arg anatomist call. The ranked leaderboard (the stated production-model-selection instrument) therefore measures a grounded anatomist that production users never run, and the repo's own parity audit (measured 2026-07-03) recorded this row as closed.

**Fix.** Build dpdLookups before the anatomist call (mirroring the lexicographer block at index.ts:514-539) and pass it as the 5th argument — or, if closed-book anatomist is intentional in production, remove `dpdLookups: anatomistDpd` from benchmark.ts:970 and correct SUTTA-014's parity table.

### 🟠 HIGH 2. All DB writes report success before the IndexedDB transaction commits; commit-time aborts are silently swallowed

- **File:** `services/db/core/txn.ts:63`
- **Lens:** IndexedDB persistence / silent data loss · **verifier confidence:** 0.9 · _(finder said critical, verifier adjusted to high)_

**Evidence.** withTxn resolves the outer promise when the operation's promise settles, not when the transaction commits: `transaction.oncomplete = () => { // Transaction completed successfully // The result should already be resolved by the operation };` (lines 57-60) followed by `operation(transaction, stores).then(result => resolve(result))` (line 63). promisifyRequest (lines 105-110) resolves on `request.onsuccess`, which in IndexedDB fires when the request executes in memory, BEFORE the transaction durably commits. If the transaction aborts at commit time (canonical case: QuotaExceededError on large chapter content/images, or disk-full aborts), `transaction.onabort` (line 49) calls reject() on an already-resolved promise, which is a no-op — the caller (storeChapterModern chapters.ts:200-232, ensureChapterUrlMappings, recomputeChapterSummary) has already returned success, the Zustand store was updated, and the record never landed in the DB. The RetryPolicy wrapper (errors.ts:107-138) also never sees the abort so its 'Transient' retry never fires. TranslationRepository.writeTranslation (TranslationRepository.ts:126-133) independently repeats the same pattern (`request.onsuccess = () => resolve()`). Contrast: setActiveTranslation (line 351) correctly waits for `transaction.oncomplete` — showing the codebase knows the difference.

**Verifier note.** Severity is high rather than critical: the defect is conditional on a commit-time transaction abort (disk-full, storage I/O error, or quota detected only at commit) rather than every write. Also, the evidence names QuotaExceededError as the canonical trigger, but a `put` that exceeds quota commonly surfaces at the request level (request.onerror), which IS caught by promisifyRequest.onerror -> reject -> operation .catch -> RetryPolicy. The cleanest triggers of the swallowed abort are commit-time storage/disk failures. This does not refute the core finding — commit-time aborts are genuinely swallowed regardless of trigger.

**Fix.** Resolve withTxn (and writeTranslation) from transaction.oncomplete, capturing the operation's result in a closure, so success is only reported after durable commit and onabort rejections actually reach callers.

### 🟠 HIGH 3. Streaming import renumbers versions in reverse order and its setActive call targets the wrong URL, silently discarding the exported active-version selection

- **File:** `services/importService.ts:695`
- **Lens:** IndexedDB persistence / silent data loss · **verifier confidence:** 0.9

**Evidence.** Exports list translations sorted DESCENDING by version (`results.sort((a, b) => b.version - a.version)`, TranslationRepository.ts:67, feeding export.ts:217 via getTranslationVersionsByStableId). processChapter stores them in that order through `TranslationOps.store({ ref: { url: identity.storageUrl, ... } })` (importService.ts:675-679), and storeTranslation IGNORES the exported version field, allocating sequential nextVersion (TranslationRepository.ts:192) — so the original v3 becomes v1 and the original v1 becomes v3: the user's version history is inverted (createdAt also reset). Each store also deactivates prior versions and marks the newest active, so the LAST-stored (originally OLDEST) version ends up active. The corrective call `await TranslationOps.setActiveByUrl(chapterUrl, activeVersion)` (line 695) passes `chapterUrl` (`chapter.url || chapter.canonicalUrl`, line 633) instead of `identity.storageUrl` under which the translations were just stored — for library-scoped imports storageUrl is `lf-library://...` (getScopedChapterIdentity lines 151-159), so the cursor over index('chapterUrl') matches zero records and the call silently no-ops. Net: after a scoped stream import of a multi-version chapter, the reader shows the oldest translation as active and the version numbering no longer matches the export.

**Verifier note.** Details are accurate; two clarifications. (a) The wrong-active-version symptom is specific to LIBRARY-SCOPED streaming imports (registryNovelId set → storageUrl is lf-library://…). For non-scoped streaming imports (InputBar path) storageUrl===canonicalUrl===chapterUrl, so setActiveByUrl succeeds and the active selection IS correctly restored — there only the version-number inversion + createdAt reset remain (minor). (b) The evidence's 'TranslationRepository.ts' resolves to services/db/repositories/TranslationRepository.ts; all cited line numbers (67, 192) match there. Severity kept at high but is borderline: no translation content is lost and users can still switch versions manually via the version selector, but the app silently defaults to the oldest/incorrect translation on the headline library-load flow with no error surfaced, and the fix (use identity.storageUrl, or the stableId-based setActiveByStableId) is one line.

**Fix.** Store versions in ascending order (or honor the exported version numbers) and call setActiveByUrl with identity.storageUrl — or resolve the active version via setActiveByStableId using identity.stableId.

### 🟠 HIGH 4. Failed/incomplete phases are silently dropped from the ranked mean → phase-level survivorship advantage; models are averaged over different, self-selected phase subsets

- **File:** `scripts/sutta-studio/generate-leaderboard.ts:392`
- **Lens:** Benchmark aggregation & publication · **verifier confidence:** 0.9

**Evidence.** A phase is only ever recorded (and thus counted) when it produces a COMPLETE pipeline: benchmark.ts:1543-1547 `if (pipelineResult.anatomist.output && ...lexicographer.output && ...weaver.output)` then `qualityScores.push(score)` (1565); a phase that errors a required pass is never pushed, and the circuit-breaker (1621-1632 `break`) removes all remaining phases. generate-leaderboard.ts then ranks on `avgOverall: mean(phases.map((p) => p.overallScore))` (392) over ONLY the phases present in quality-scores.json, never charging a 0 for a dropped phase, never intersecting phases across models, and never reading the `phasesAttempted` field that benchmark.ts:1670 writes. The coverage floor is derived from SURVIVING phases (`maxPhases = ...Math.max(...runs.map((r) => r.phases.length))`, 345-346), not the configured phase universe, so if every model drops the same hard phrase it silently vanishes. VERIFIED on the LIVE published board: gemini-3-flash/grok/mistral ranked over 30 phases, but deepseek-v3.2 ranked over 29 (dropped phase-ao) and qwen3-235b over 29 (dropped phase-ab) — different 29-phase subsets. qwen's dropped phase-ab is a genuine 0 (segF1=0, contentF1=0 in the compare artifact) that is excluded from its mean, inflating its rank AND lowering its reported cost. A model that errors out on its hardest phrases is rewarded twice.

**Verifier note.** Two secondary points in the evidence are slightly overstated, though the core is sound: (1) The "lowering its reported cost / rewarded twice" angle is weak — the 29-phase runs still ATTEMPTED all 30 phases (earlyStopReason is null, no circuit-breaker fired), and cost/tokens are reported as the run total (best.run.metrics), so the only cost 'saved' is the remainder of the one aborted pass, not a whole phase. The primary reward is the inflated mean, not the cost. (2) The observed drop was caused by an aborted lexicographer pass (a timeout/abort), not necessarily the model 'erroring out on its hardest phrase' — but the structural bias holds regardless of failure cause. Also note `phasesAttempted` is absent (null) in the actual published-board runs, so the leaderboard could not use it even if coded to — which reinforces rather than weakens the finding.

**Fix.** Charge every golden-backed phase the model failed to complete as a 0 in the ranked mean (or rank all models over the common intersection of golden phases), and derive the coverage denominator from the configured phase universe rather than from surviving phases; also surface the drop in `excluded.reasons` instead of silently omitting it.

### 🟠 HIGH 5. Imported library chapters and live translations use two different chapterUrl keyspaces, causing unique-index collisions, orphaned records, and non-deterministic version lists

- **File:** `services/db/repositories/TranslationRepository.ts:242`
- **Lens:** IndexedDB persistence / silent data loss · **verifier confidence:** 0.85 · _(finder said critical, verifier adjusted to high)_

**Evidence.** Import writes translations under the scoped storage URL: `chapterUrl: identity.storageUrl` (imports.ts:369, an `lf-library://` URL per libraryScope.ts:2). But live translation (translationService.ts:388 / persistUpdatedTranslation → storeTranslationByStableId) resolves chapterUrl via `store.index('stableId').get(ref.stableId)` on URL_MAPPINGS (TranslationRepository.ts:33-48); since import also writes the https canonical mappings (imports.ts:255-277) and non-unique index get() returns the lowest primary key ('https://...' < 'lf-library://...'), it returns the https URL. storeTranslation then computes `nextVersion` from fetchTranslationsByUrl(https-url) = [] → version 1, writes the record with stableId undefined (chapter lookup by https url misses the scoped chapter record), then the second put `record.stableId = stableId; await this.writeTranslation(record);` (lines 243-244) violates the unique `stableId_version` index (schema.ts:243) against the imported version 1 → ConstraintError → the new translation is left permanently orphaned WITHOUT a stableId (first put persisted, no rollback). translationsSlice.ts:1008-1010 only `console.warn`s the throw, so the in-memory store shows the translation while the DB copy is invisible to stableId lookups. Reads then flip-flop: getTranslationVersionsByStableId (lines 278-298) races urlPath (finds only the orphan set) against stableIdPath (finds only the imported set) via Promise.any — whichever wins returns a DIFFERENT disjoint version list. deleteChapterModernByUrl (chapters.ts:531-546) deletes translations only by `chapter.url` (scoped), orphaning the canonical-URL set forever.

**Verifier note.** Minor nuance in the evidence: on the primary library-import path (importService.streamImportFromUrl / ChapterOps.store → ensureChapterUrlMappings) NO `lf-library://` URL_MAPPINGS record is ever written — only the canonical + raw `https` mappings. So resolveChapterUrl returns the https url simply because it is the only mapping present, not because of the `'https://' < 'lf-library://'` lowest-primary-key tie-break the claim cites (that lexicographic argument would only matter in a full-session re-import where both keys coexist). The outcome (resolveChapterUrl diverges from the storage keyspace → ConstraintError orphan) is unchanged. Also note the throw is swallowed at BOTH translationService.ts:404 (main translate path) and translationsSlice.ts:1008-1010 (footnote-persist path), not only the latter.

**Fix.** Make resolveChapterUrl prefer the chapter record's own storage url (look up chapters by stableId first, falling back to URL_MAPPINGS), or store a single authoritative mapping stableId→storageUrl, so every write path keys translations under one canonical chapterUrl.

### 🟠 HIGH 6. handleRetryImage has no in-flight guard and captures nextVersion before awaiting, so a double-click produces two paid generations stored under the SAME version — one image silently lost

- **File:** `store/slices/imageSlice.ts:428`
- **Lens:** Zustand state & concurrency · **verifier confidence:** 0.8

**Evidence.** `const currentMaxVersion = state.imageVersions[key] || 0; const nextVersion = currentMaxVersion + 1;` (lines 428-429) is computed from a snapshot taken at entry, then passed into the long `await ImageGenerationService.retryImage(...)` (line 485). Unlike `handleGenerateImages`, which guards re-entry via `imageGenerationProgress` (lines 253-257: 'prevents auto + manual double-fire'), retryImage has NO in-progress check — the only state written before the await is `generatedImages[key] = { isLoading: true ... }` (lines 474-479), which is never consulted as a guard. Two rapid retries for the same marker both read currentMaxVersion=N and both call the service with `nextVersion = N+1`; the service stores the generated image keyed by that version (services/imageGenerationService.ts:413 `context.nextVersion || 1` passed to generateImage for Cache API storage, and line 441 `requestedVersion = context.nextVersion ?? ...` written into version metadata). Both completions then set `imageVersions[key] = N+1` (lines 515-523). User observes: pays for two image generations, the second overwrites the first in the cache under version N+1, and the version counter advances by only 1 — one image silently gone. This action is also auto-triggered by generateIllustrationForSelection (translationsSlice.ts:1528), so a manual retry racing that auto-trigger hits the same collision.

**Verifier note.** Detail worth adding: the no-guard problem is aggravated by the UI, not just the slice — in the ordinary "retry without editing the caption" path, saveDraftsIfChanged short-circuits (savePromptIfChanged returns at Illustration.tsx:298 before setIsSaving), so isSaving never flips and disabled={isSaving} provides zero double-click protection. Severity: high is defensible because it combines a duplicate paid API charge with silent data loss, though one could argue medium since the user can simply retry to regenerate the lost image; the double-charge plus silent-loss combination keeps me at high.

**Fix.** Guard on `get().generatedImages[key]?.isLoading` at entry (return if already loading) and/or allocate the version number inside the post-await set() from prevState.imageVersions rather than the pre-await snapshot.

### 🟠 HIGH 7. calculateCost fail-opens to $0 for any unpriced model, which zeroes estimatedCost and permanently defeats the budget gate (up to 999-chapter unbounded preload spend)

- **File:** `services/ai/cost.ts:62`
- **Lens:** Cost/budget accounting · **verifier confidence:** 0.8

**Evidence.** When a model is absent from the static table and either lacks '/' or the dynamic OpenRouter pricing lookup returns null, calculateCost does:
  console.warn(`[Cost] No pricing information found for model: ${model}. Cost will be reported as 0.`);
  return 0;
The base-model normalizer only strips ISO dates: `model.replace(/-\d{4}-\d{2}-\d{2}$/, '')` (line 18) — it does NOT match Anthropic-style 8-digit suffixes (e.g. a future `claude-opus-4-5-20260514`) or `-MM-DD` preview suffixes, so such ids fall through to `return 0`. Because config/costs.ts is hand-maintained, any model added to config/costs.ts MODELS (or returned by a provider) without a matching COSTS_PER_MILLION_TOKENS entry prices to $0. That $0 is stored as the translation's estimatedCost, so getNovelTranslationCost stays $0 forever; in budget mode BUDGET_MODE_MAX_LOOKAHEAD=999 (store/slices/chaptersSlice.ts:912) means the preloader keeps translating up to 999 chapters — real paid API calls — while the budget UI shows $0.00 and the `spent >= budget` check never trips. A concrete trigger: an OpenRouter text model whose pricing fetch fails transiently (offline/rate-limited/not-in-catalog) → promptCost=0 → unbounded overspend.

**Verifier note.** The normalizer-8-digit-suffix argument is technically correct but practically moot for CURRENT Anthropic models: config/costs.ts:83-88 exact-lists the 8-digit-suffixed Claude ids (claude-opus-4-1-20250805 etc.), so today's models are priced; the claude-opus-4-5-20260514 future-model case is speculative. The concrete real-world trigger is an OpenRouter text model (only a few are in the static table) whose runtime fetchDynamicPricing returns null — transient rate-limit/offline OR slug not present in OpenRouter's /models catalog — fail-opening to $0. There is also a secondary fail-open inside the dynamic-pricing success branch: `|| 0` on unparseable/absent prompt/completion prices (cost.ts:50-54) also yields $0.

**Fix.** Do not fail open: when no price is resolvable, either throw/surface an error, treat the cost as unknown (block budget-mode preload rather than treating spend as $0), or make budget mode refuse to proceed on any $0-priced model.

---

## 🟡 MEDIUM (25)

### 🟡 MEDIUM 1. DPD dictionary loader uses import.meta.glob({eager:true}), inlining ~1.2MB of headword/forms JSON into the main chunk and eager-parsing ALL suttas at Sutta-Studio module load

- **File:** `services/providers/dpd-loader-vite.ts:22`
- **Lens:** Performance & bundle · **verifier confidence:** 0.96

**Evidence.** dpd-loader-vite.ts lines 21-28 eagerly glob-import every per-sutta DPD subset:
  const headwordModules = import.meta.glob<DpdHeadwords>('../../data/dpd/*/headwords.json', { eager: true, import: 'default' });
  const formsModules   = import.meta.glob<DpdForms>('../../data/dpd/*/forms.json',     { eager: true, import: 'default' });
The underlying files are large: data/dpd/mn10/headwords.json=708KB, data/dpd/mn117/headwords.json=444KB (+forms 24KB/16KB) = ~1.19MB. `eager:true` turns these into hoisted static imports whose JSON.parse runs at module-init, so ALL suttas' dictionaries load even when compiling just one. This module is pulled into the eager path via services/compiler/index.ts:54 (`import { getBundledDpdData } from '../providers/dpd-loader-vite'`) ← SuttaStudioApp ← App.tsx:5. VERIFIED in the build: all 507 mn10 + all 317 mn117 headword keys (e.g. `abhijjhādomanassa`, marker `rawExcerpt`) are present verbatim in `assets/index-C1SS08u8.js`. The `getBundledDpdData` singleton only defers the merge step, not the per-file parse.

**Verifier note.** Minor size figures in the claim are slightly off: mn10 headwords.json is 722,413 B (~705 KiB, claim said 708 KB); forms are 22,697 B and 14,354 B (claim said 24 KB/16 KB). The aggregate (~1.2 MB) and all structural/behavioral claims are correct. Note also that the eager DPD data loads on EVERY route including the primary non-sutta translation app (App.tsx statically imports SuttaStudioApp), which strengthens the finding.

**Fix.** Drop `eager:true` so the glob yields lazy `() => import()` loaders, and load only the DPD subset for the sutta actually being compiled (keyed by workId) — combined with route-splitting SuttaStudioApp, this removes ~1.2MB from the entry chunk entirely.

### 🟡 MEDIUM 2. updateFeedbackComment mutates the feedback item in place, only searches session-local feedbackHistory, and never persists — comment edits are invisible and silently lost on reload

- **File:** `store/slices/translationsSlice.ts:1074`
- **Lens:** Zustand state & concurrency · **verifier confidence:** 0.95 · _(finder said high, verifier adjusted to medium)_

**Evidence.** `set(prevState => { const newFeedbackHistory = { ...prevState.feedbackHistory }; for (const chapterId in newFeedbackHistory) { const feedback = newFeedbackHistory[chapterId].find(f => f.id === feedbackId); if (feedback) { feedback.comment = comment; break; } } ... })` (lines 1076-1085). Three compounding defects: (1) the per-chapter ARRAY reference is unchanged and the item is mutated in place, so any selector on the array or on the chapter sees an identical reference — ChapterView renders feedback from `chapter?.feedback` (components/ChapterView.tsx:82), whose chapter object is untouched by this set(), so the edit does not re-render the feedback UI; (2) `feedbackHistory` is only ever populated by same-session `submitFeedback` (line 887) — feedback hydrated from IDB lives solely on `chapter.feedback` (services/navigation/hydration.ts:65), making the action a TOTAL no-op for any feedback created in a previous session, even though ChapterView wires it as the edit handler (ChapterView.tsx:551 `onUpdateFeedback: updateFeedbackComment`); (3) `FeedbackOps.store` is called only from submitFeedback (line 922), never here, so even a same-session edit vanishes on reload. Contrast with `deleteFeedback` (lines 1044-1071), which correctly goes through `updateChapter`. User observes: editing a feedback comment appears to do nothing (or updates only after an unrelated re-render) and the edit is always gone after refresh — silent loss of user input.

**Verifier note.** Defect (1) as worded ('the edit does not re-render the feedback UI') is directionally correct but mechanistically nuanced. In the SAME-SESSION case, submitFeedback passes the very same feedbackHistory[chapterId] array reference to updateChapter (lines 900-903), so chapter.feedback and feedbackHistory share the same item objects; the in-place feedback.comment = comment mutation therefore also mutates the object chapter.feedback references. When Save fires, FeedbackDisplay's own setEditingId(null) triggers a LOCAL re-render that maps the same array and reads item.comment — so the new comment can actually appear immediately for same-session feedback, even though the store's set() (which only changes feedbackHistory) does not itself re-render ChapterView (which subscribes to chapters). The unambiguous, always-true defects are (2) a total no-op for any hydrated/prior-session feedback and (3) no persistence, so the edit is always gone after refresh. Severity lowered from high to medium: real silent loss of user-typed input on a live 'Save' control, but the surface is narrow (editing an existing feedback comment; feedback creation via submitFeedback still persists correctly).

**Fix.** Rewrite to locate the item in `chapter.feedback`, produce new array/item objects via `updateChapter`, mirror into feedbackHistory immutably, and persist via FeedbackOps like submitFeedback does.

### 🟡 MEDIUM 3. The tested translation path (services/ai/providers/*.ts + responseValidators.ts) is dead in production — reachable only via aiService.__testUtils

- **File:** `services/aiService.ts:7`
- **Lens:** Copy-paste drift across providers · **verifier confidence:** 0.95

**Evidence.** translateWithGemini/translateWithOpenAI and validateAndFixIllustrations/validateAndFixFootnotes are imported only by aiService.ts, which re-exports them under `__testUtils` (aiService.ts:4-7, 15-19). aiService's live export `translateChapter` comes from ./ai/translatorRouter, which calls translator.translate (services/ai/translatorRouter.ts:26) -> the adapters/providers/* classes. Grep confirms no non-test importer of translateWithGemini/translateWithOpenAI and no live importer of responseValidators outside services/ai/providers/*.ts. Result: the reconciliation logic the test suite exercises (via __testUtils) NEVER runs in production — the shipped GeminiAdapter/OpenAIAdapter skip it entirely and ClaudeAdapter runs a divergent broken copy. Green tests here give false confidence that illustration/footnote integrity is enforced.

**Verifier note.** Two clarifications, both strengthening the finding. (1) responseValidators.ts is technically also imported by aiService.ts, but only to populate __testUtils — so it is still dead in the production runtime path; the claim's "no live importer outside providers/*.ts" is effectively correct. (2) The ClaudeAdapter "divergent broken copy" detail is confirmed and is genuinely broken, not merely divergent: claudeService.ts:215 uses an over-escaped illustration regex /\\[ILLUSTRATION-\\d+[A-Za-z]*\\]/g (double backslashes match a literal backslash + character class, so it will not match real [ILLUSTRATION-1] markers), inconsistent with the correctly-escaped /\[(\d+)\]/g on line 257 of the same file and with responseValidators.ts:19's /\[ILLUSTRATION-\d+[A-Za-z]*\]/g. That means the Claude path's illustration reconciliation effectively finds zero text markers and always takes the auto-insert branch — an independent latent bug the tests never touch.

**Fix.** Either delete services/ai/providers/{gemini,openai}.ts and point tests at the real adapters, or make the adapters delegate to these functions so the tested code is the shipped code.

### 🟡 MEDIUM 4. User feedback COMMENTS silently dropped from IDB-hydrated history context via a stale private converter, diverging from the in-memory path

- **File:** `services/translationService.ts:206`
- **Lens:** Prompt-context assembly · **verifier confidence:** 0.95 · _(finder said high, verifier adjusted to medium)_

**Evidence.** TranslationService.convertFeedbackRecordToItem (L206-222) returns {id, text: record.comment, category, timestamp, chapterId, selection, type} with NO `comment` field. formatHistory reads `f.comment` to build the feedback line (services/prompts.ts L30: `const commentStr = f.comment ? ` (User comment: ${f.comment})` : ''`), so for every feedback item converted this way commentStr is '' -- the user's actual comment (the WHY behind a thumbs-up/down) never reaches the model; only `- (emoji) on: "selection"` is emitted. This converter feeds the IDB-hydration path (L728 `feedback = feedbackRecords.map(record => this.convertFeedbackRecordToItem(record))` and L814 in the prevUrl chain). The canonical converter services/db/operations/feedback.ts feedbackRecordToItem (L18-27) DOES include `comment: record.comment` (L26) and its own docstring notes translationService kept 'its own private copy of this logic (pre-2026-05-04)' that should be consolidated. In-memory feedback from addFeedback (store/slices/translationsSlice.ts L876-885) and loadChapterFromIDB (canonical converter) both carry `comment`, so warm-memory context includes the comment while cold/background IDB-hydrated context for the SAME chapter drops it -- divergent prompt context between warm and cold state.

**Verifier note.** Trivial line-number offset: formatHistory's `const commentStr = f.comment ? ...` is at services/prompts.ts L31, not L30 (the claim said L30). All other cited locations (L206-222, feedback.ts L18-27/L26, translationService L728/L814, translationsSlice L876-885) are accurate. Severity adjusted high -> medium: impact is limited to the cold IDB-hydration path (warm-memory context is unaffected), drops only the comment field while feedback type/selection still reach the model, and the comment itself is not lost from persistence.

**Fix.** Delete the private convertFeedbackRecordToItem and use the canonical feedbackRecordToItem (which sets `comment`), so IDB-hydrated feedback carries the user comment like the in-memory path.

### 🟡 MEDIUM 5. .env.example documents two keys under wrong (non-VITE) names, silently disabling Google Drive import + free-trial key

- **File:** `.env.example:11`
- **Lens:** Config, scripts & docs drift · **verifier confidence:** 0.93 · _(finder said high, verifier adjusted to medium)_

**Evidence.** .env.example tells users to set `GOOGLE_DRIVE_API_KEY=...` (line 11) and `DEFAULT_OPENROUTER_KEY=...` (line 28) with NO `VITE_` prefix. But the code reads the VITE_-prefixed names: `import.meta.env.VITE_GOOGLE_DRIVE_API_KEY` (services/importService.ts:203 and :360) and `import.meta.env.VITE_DEFAULT_OPENROUTER_KEY` (services/defaultApiKeyService.ts:106; components/DefaultKeyBanner.tsx:25). Unlike the 6 core provider keys, these two are NOT bridged in vite.config.ts's `define` block (only GEMINI/OPENAI/DEEPSEEK/CLAUDE/OPENROUTER/PIAPI appear at lines 222-244), so Vite only exposes them when the .env var itself is VITE_-prefixed. A user who copies .env.example verbatim gets `undefined`: Google Drive session import falls back to the public `uc?export=download` URL (importService.ts:208) and importService.ts:207 even logs 'Set VITE_GOOGLE_DRIVE_API_KEY in .env.local' — directly contradicting .env.example. The free-trial banner (DefaultKeyBanner.tsx:25) and getDefaultApiKey() (defaultApiKeyService.ts:106-108) also stay off, so new users can't try the app. README.md:122-127 compounds the contradiction by documenting the VITE_ prefix while .env.example omits it.

**Verifier note.** Severity is better rated medium than high: both features degrade gracefully rather than breaking (Google Drive import falls back to the public download URL and emits a debug warning at importService.ts:207; the trial key is an operator-deployment concern that just stays dormant), with no crash, data loss, or security exposure, and it only affects users who follow .env.example verbatim and want those specific features. Minor claim overstatement: README.md:122-127 uses the VITE_ prefix for the core keys but does not actually document these two keys at all (so it omits rather than 'documents VITE_ while .env.example omits'). All code-level facts and line numbers in the claim are accurate.

**Fix.** Rename the .env.example entries to VITE_GOOGLE_DRIVE_API_KEY and VITE_DEFAULT_OPENROUTER_KEY (and reconcile the README-vs-.env.example prefix convention across all keys).

### 🟡 MEDIUM 6. Claude's copy of validateAndFixIllustrations uses a double-escaped regex that never matches real markers, so it appends/duplicates illustration markers on every Claude translation

- **File:** `services/claudeService.ts:215`
- **Lens:** Copy-paste drift across providers · **verifier confidence:** 0.92 · _(finder said high, verifier adjusted to medium)_

**Evidence.** claudeService.ts:215 is a hand-copied reimplementation of the canonical validator (comment at :213 'We need to import this locally to avoid circular imports') but its regex is double-escaped:

    const textMarkers = translation.match(/\\[ILLUSTRATION-\\d+[A-Za-z]*\\]/g) || [];

vs the canonical services/ai/responseValidators.ts:19:

    const textMarkers = translation.match(/\[ILLUSTRATION-\d+[A-Za-z]*\]/g) || [];

In a JS regex literal `\\[` matches a literal backslash then opens a char-class; the whole pattern requires the matched text to contain backslash characters, which real markers like `[ILLUSTRATION-1]` never do — so `textMarkers` is ALWAYS []. Consequence in this exact function: the 'perfect match' branch (:220) can never fire when illustrations exist, and the 'jsonMarkers.length > textMarkers.length' branch (:232) always sees every suggested illustration as 'unmatched' and appends its placementMarker to the end of the chapter (:238-241) even though the model already placed it inline. Every Claude-translated chapter with N illustrations therefore gets N marker duplicates appended at the end. ClaudeAdapter.translate (adapters/providers/ClaudeAdapter.ts:18) calls translateWithClaude directly, so this is the live 'Claude' provider path, not dead code. The footnote regex two lines down (:257 `/\[(\d+)\]/g`) is correctly single-escaped, confirming :215 is an accidental double-escape, not intentional.

**Verifier note.** Severity adjusted high→medium. The bug is real and fires on every Claude translation containing illustrations, silently persisting duplicated [ILLUSTRATION-N] markers to the returned/saved output. But it is scoped to one provider (Claude) with illustrations enabled, and the failure mode is degraded output (stray/duplicate markers, possibly a duplicate image at chapter end) rather than a crash, data loss, or security issue — which keeps it below the top tier. All other technical details in the claim (regex mechanics, always-empty textMarkers, the two triggered branches, line numbers, live-path wiring via ClaudeAdapter, and the single-escaped footnote regex as a copy-drift tell) are accurate as stated.

**Fix.** Delete the local copy in claudeService.ts and import validateAndFixIllustrations/validateAndFixFootnotes from services/ai/responseValidators.ts (as gemini.ts/openai.ts already do); if the local copy must stay, fix the regex to /\[ILLUSTRATION-\d+[A-Za-z]*\]/g.

### 🟡 MEDIUM 7. No route-level code splitting: entire Sutta-Studio + Liturgy + benchmark subsystem (incl. 0.49MB mn10 packet) rides in a 3.85MB main entry chunk downloaded by every visitor

- **File:** `App.tsx:5`
- **Lens:** Performance & bundle · **verifier confidence:** 0.92 · _(finder said high, verifier adjusted to medium)_

**Evidence.** App.tsx statically imports every route target at the top of the file — there is NO React.lazy/Suspense anywhere in the app (grep for `React.lazy`/`= lazy(` returns nothing) and vite.config.ts:255 sets `rollupOptions` with NO `manualChunks`. Lines 3-11:
  import MainApp from './MainApp';
  import { SuttaStudioBenchmarkView } from './components/bench/SuttaStudioBenchmarkView'; // 1573 LOC
  import { SuttaStudioApp } ...;  import { SuttaStudioView } ...;  import { SuttaStudioPipelineLoader } ...;  import { SuttaStudioCompareView } ...;
  import { DEMO_PACKET_MN10 } from './components/sutta-studio/demoPacket';
  import { LiturgyApp } from './components/liturgy/LiturgyApp';
These are only ever rendered on `/sutta*`, `/bench/*`, `/liturgy*` routes (App.tsx lines 80-122), yet all ride in the eager bundle. demoPacket.ts:2 does `import demoData from '../../content/references/sutta/mn10.json'` (490,322 bytes — the App.tsx:20 comment even admits "mn10's 0.5MB stays sync for now"), and LiturgyApp pulls data/concepts/heart-sutra.ts (80KB) + ~984KB of data/liturgy/*.ts. VERIFIED in the built artifact: dist/index.html loads `assets/index-C1SS08u8.js` = 3.85MB as the sole entry; that chunk contains `mn10:` segment markers, liturgy heart-sutra content, and the benchmark view. A user who only wants to translate a web novel (the MainApp product) still downloads+parses ~2-3MB of Pali/liturgy code and data they never touch.

**Verifier note.** Two factual refinements, neither undermining the claim: (1) The main entry chunk is 4,138,027 bytes = 3.95 MiB / 4.14 MB, not 3.85 MB (a slight underestimate). (2) mn117 (the LARGER 1.1MB packet) is already lazily code-split into its own chunk (dist/assets/mn117-C0rcGSTN.js, 1,115,105 bytes) via LAZY_SUTTA_LOADERS' dynamic import; the claim already correctly scopes its assertion to mn10 and the route components, so this is consistent. Severity lowered high->medium: this is a verified bundle-size/perf optimization opportunity, not a correctness or security defect, and the codebase already demonstrates working code-splitting for several other modules (epubService, commentarial-glosses, contested-terms, mn117) with the mn10 sync-load being a documented deliberate choice.

**Fix.** Wrap the SuttaStudio*/Liturgy/benchmark route components in React.lazy + Suspense (and lazy-load DEMO_PACKET_MN10 the same way mn117 already is at App.tsx:22) so each route becomes its own chunk and MainApp users no longer pay for them.

### 🟡 MEDIUM 8. acceptProposal/rejectProposal remove by index after an await — a double-click silently discards the NEXT queued amendment proposal without applying or logging it

- **File:** `store/slices/translationsSlice.ts:1135`
- **Lens:** Zustand state & concurrency · **verifier confidence:** 0.9

**Evidence.** The action reads the proposal by index at entry (`const proposal = amendmentProposals[index];` line 1093), synchronously applies it, then does `await AmendmentOps.logAction({...})` (line 1122, an IndexedDB write), and only afterwards removes by INDEX against the then-current queue: `set((state) => ({ amendmentProposals: state.amendmentProposals.filter((_, i) => i !== index) }))` (lines 1135-1137). MainApp wires this straight to modal buttons (`acceptProposal(index)` MainApp.tsx:271). Interleaving: with proposals [A, B] queued (multiple background translations each append via line 667-669), the user double-clicks Accept(0); both invocations read A and apply it (second apply is a no-op since `systemPrompt.replace(currentRule, ...)` no longer matches), both awaits resolve, then the first set() removes A (B shifts to index 0) and the second set() removes index 0 again — deleting B, which was never displayed, applied, or written to the amendment log. Same shape for a race between accept and reject on the same index. User observes: an amendment proposal they never saw silently vanishes from the queue counter.

**Verifier note.** The queue corruption is independent of the second apply being a no-op — the second synchronous apply only affects whether settings are re-written or a duplicate 'accepted' log row is created; the lost proposal comes purely from the stale-index removal after the await, regardless of what the second apply does. The defect is not limited to acceptProposal: rejectProposal (lines 1159-1162) and editAndAcceptProposal (lines 1201-1204) share the exact same read-index -> await -> remove-by-index pattern and the same discard behavior.

**Fix.** Filter by identity of the proposal captured at entry (e.g. `filter(p => p !== proposal)` or a proposal id) instead of positional index, and/or remove the proposal from the queue synchronously before the await.

### 🟡 MEDIUM 9. Full-session JSON export leaks DeepL & Google Translate API keys (redaction filter matches wrong prefix)

- **File:** `services/db/operations/export.ts:285`
- **Lens:** Security · **verifier confidence:** 0.9 · _(finder said high, verifier adjusted to medium)_

**Evidence.** The user-facing "Export as JSON" flow (components/session-info/ExportModal.tsx handleExportFormat('json') -> store/slices/exportSlice.ts exportSessionData -> SessionExportOps.exportFullSession -> exportFullSessionToJson) serializes settings with only this redaction:

  settings: Object.fromEntries(
    Object.entries(settings || {}).filter(([k]) => !k.startsWith('apiKey'))
  ),

The developer clearly INTENDED to strip keys, and this correctly drops apiKeyGemini/apiKeyOpenAI/apiKeyDeepSeek/apiKeyClaude/apiKeyOpenRouter/apiKeyPiAPI. But two secret fields are named with the 'ApiKey' SUFFIX, not the 'apiKey' prefix, so they survive: types.ts:378 `deeplApiKey?: string;` and types.ts:380 `googleTranslateApiKey?: string;` (real credentials entered for the interleaved-reader per-word lookups, used in components/chapter/ReaderBody.tsx apiKeys={{deepl: settings.deeplApiKey, google: settings.googleTranslateApiKey}}). Because startsWith('apiKey') is case/prefix-sensitive, `deeplApiKey` and `googleTranslateApiKey` are written verbatim into the downloaded lexiconforge-full-1 JSON, a file explicitly meant to be backed up / shared. A Google Cloud Translate key is billable and often broadly-scoped. (Same class latent second vector: services/sessionManagementService.ts:446 exportSessionConfig() returns loadSettings() with NO redaction at all — currently only reachable via the un-wired store action exportSettings, but confirms key-redaction is inconsistent across the codebase.)

**Verifier note.** The redaction bug is real and correctly located, but the claim overstates present-day impact by asserting these are "real credentials entered for the interleaved-reader per-word lookups." In the current codebase there is NO code path that WRITES settings.deeplApiKey or settings.googleTranslateApiKey — they are only defined in types.ts and read in ReaderBody.tsx:116-117; the per-word-lookup key-entry UI (Issue #15 Phase 3) is not implemented (DisplayPanel exposes only the enableInterleavedView toggle). Therefore the leak is latent: it becomes live the moment the planned key-input UI ships, or if a user sets the field via devtools or imports a full-session JSON that already contained the keys (import would round-trip them, since export strips the six apiKey* fields but preserves deepl/google). Severity is medium (latent secret-leak in an export-for-sharing artifact) rather than high, given no in-app populate path exists today.

**Fix.** Redact by a robust predicate (e.g. drop any key matching /api[_-]?key/i or ending in 'Key'/'Token'/'Secret', or better, whitelist the exact settings fields that are safe to export) instead of the fragile startsWith('apiKey'), and add deeplApiKey/googleTranslateApiKey explicitly.

### 🟡 MEDIUM 10. Image-generation fetch has no timeout/AbortSignal — a stalled connection hangs the image loading state forever

- **File:** `services/imageService.ts:294`
- **Lens:** Async / error-handling topology · **verifier confidence:** 0.9 · _(finder said high, verifier adjusted to medium)_

**Evidence.** The OpenRouter image branch does `const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', { method:'POST', headers:{...}, body:... });` (line 294) with NO `signal`/timeout, and `generateImage(...)` (line 111) takes no abortSignal param at all. In the SAME file the PiAPI branch was deliberately given `signal: AbortSignal.timeout(8000) // 8 second timeout per request` (line 530) with the comment "prevent indefinite hangs" — so the authors know these fetches can stall, but the OpenRouter/Imagen/Gemini paths were left unprotected. ImageGenerationService.generateImages sets `initialImageStates[key] = { isLoading:true }` and only clears it in its `catch` (services/imageGenerationService.ts:310) — but a fetch that never resolves never throws, so the catch never runs. Consequence chain is confirmed by the code's own comments: hasImagesInProgress() (store/slices/imageSlice.ts:910) returns `states.some(s=>s?.isLoading)`, imageSlice.ts:338-339 note "hasImagesInProgress() returns true forever and the beforeunload warning fires falsely", and MainApp.tsx:133-143 wires `isWorking = pendingTranslationsCount>0 || hasImagesInProgress()` to a beforeunload confirm dialog.

**Verifier note.** Severity lowered from high to medium: this is a local-first single-user app, and the failure mode is a stuck loading spinner plus a falsely-firing beforeunload warning, both recoverable by page reload (not data loss, crash, or security). The trigger requires a connection that stays alive but never responds (sleep/wifi-drop/proxy stall) which is plausible but not everyday, and browsers eventually time out many such connections on their own. Also note the gap is broader than just OpenRouter: the PiAPI create-task fetch (line 483) also lacks a signal (only the poll at 530 has one), and the Imagen (164/174) and Gemini (209) SDK paths have no explicit timeout either.

**Fix.** Thread an AbortController with a timeout (e.g. AbortSignal.timeout(120_000)) into generateImage and pass `signal` to the OpenRouter/Imagen/Gemini fetches, matching the PiAPI branch, so a stalled request rejects and the isLoading/progress state clears.

### 🟡 MEDIUM 11. The only regression test for auto-retry (LLM cost-storm) suppression is it.skip'd, its promised replacement was never written, and the mediator it points to has no retry-guard at all

- **File:** `tests/store/appScreen.integration.test.tsx:216`
- **Lens:** Test-suite honesty · **verifier confidence:** 0.9 · _(finder said high, verifier adjusted to medium)_

**Evidence.** `it.skip('does not auto-retry the same chapter after an unexpected auto-translate failure', ...)` is disabled with the note that the behavior 'now lives in store/autoTranslateMediator.ts ... Skipping until a focused unit test is added against the mediator directly.' No such test exists: grep for `setupAutoTranslateMediator`/`shouldAutoTranslate` across tests/ returns nothing, and the only other mediator mentions (navigation.test.ts L29, translation.test.ts L197) set `viewMode:'original'` specifically to 'prevent autoTranslateMediator from racing the test' — i.e. they suppress it, not test it. Reading store/autoTranslateMediator.ts, `shouldAutoTranslate` (L45-54) gates only on hasTranslation/isHydrating/isTranslationActive/isPending — after a FAILED translation all four are false again, so it re-fires with no failed-attempt memory. The single owner of automatic paid-LLM dispatch is therefore entirely untested, and the one guard against runaway retries is a skipped test with an unfulfilled TODO — the suite is green while a cost/API-hammer path is unprotected (and likely regressed).

**Verifier note.** The finding (disabled regression test + unwritten replacement + mediator with no retry-guard) is accurate. But the runtime severity is overstated: the mediator does NOT autonomously retry-storm after a failure. Its changed-gate only re-evaluates on currentChapterId/viewMode/hasTranslation/isHydrating changes; a failed translation clears only pendingTranslations/isTranslationActive (not watched by the gate), so re-fire requires a new user action (navigation/viewMode toggle), not an infinite loop. Additional cost guards exist (pendingTranslations dedup, 'any version exists → block' for auto_visit/auto_preload, API-key fail-fast, budget cap) — the missing guard is specifically 'don't re-auto-translate a chapter whose auto-translate just failed.' Real gap = zero direct test coverage of the auto-dispatch owner plus a skipped guard with an unfulfilled TODO; medium, not high.

**Fix.** Write a focused unit test that drives `setupAutoTranslateMediator` with a mocked subscribe/getState, forces a `handleTranslate` rejection, and asserts it is not re-dispatched for the same chapter; add the missing failed-attempt suppression to the mediator if the test proves it absent.

### 🟡 MEDIUM 12. Illustration/footnote reconciliation diverges across the three live provider adapters — Claude hard-fails where Gemini/OpenAI silently ship dangling markers

- **File:** `adapters/providers/OpenAIAdapter.ts:699`
- **Lens:** Copy-paste drift across providers · **verifier confidence:** 0.9 · _(finder said high, verifier adjusted to medium)_

**Evidence.** The three registered translation adapters (adapters/providers/index.ts:20-23) handle the SAME structured-output reconciliation completely differently for identical model output:

- OpenAIAdapter (live 'OpenRouter'/'DeepSeek'), lines 699-701: `suggestedIllustrations: parsedResponse.suggestedIllustrations || []`, `footnotes: parsedResponse.footnotes || []` — no validation at all.
- GeminiAdapter (live 'Gemini'), lines 299-300 + 331-332: `safeFootnotes = safeArray(parsedResponse.footnotes)`, `safeIllustrations = safeArray(parsedResponse.suggestedIllustrations)` — no validation.
- ClaudeAdapter -> claudeService.translateWithClaude runs a local validateAndFixFootnotes that THROWS (claudeService.ts:292-293 'AI response validation failed: Missing footnotes for markers... Requires regeneration') whenever the text has more `[n]` markers than JSON footnotes.

So a response where the model wrote `[1]` and `[2]` inline but returned only one footnote object FAILS the entire translation on Claude (user sees an error) but is accepted verbatim on Gemini/OpenAI, leaving a dangling `[2]` marker with no footnote in the reader. The illustration side diverges too: Claude appends markers (see finding above), Gemini/OpenAI pass mismatches through untouched. There is no single source of truth for this integrity check.

**Verifier note.** Severity downgraded high→medium: the divergence is real and confirmed, but impact is moderate, not severe (no data loss/corruption/security). The Claude branch fails LOUD/safe (throws → up to 3 retries with backoff, then a user-visible error — not an immediate single failure), whereas Gemini/OpenAI fail SILENT with a cosmetic dangling footnote marker in the reader. Note also the divergence is asymmetric only in the text-markers > footnotes direction: the reverse case (more footnotes than markers) is auto-fixed on Claude too (appends markers, claudeService.ts:283-290), while Gemini/OpenAI still pass it through unchanged. The "no single source of truth" characterization is accurate.

**Fix.** Route all three adapters through the shared responseValidators.validateAndFixIllustrations/validateAndFixFootnotes with a consistent strictMode, so provider choice does not change whether a mismatched response fails, auto-repairs, or ships broken.

### 🟡 MEDIUM 13. Budget-mode gate undercounts real spend by counting only the ACTIVE translation version per chapter, letting users overspend their cap

- **File:** `services/db/operations/budgetOps.ts:25`
- **Lens:** Cost/budget accounting · **verifier confidence:** 0.9 · _(finder said high, verifier adjusted to medium)_

**Evidence.** getNovelTranslationCost sums per chapter only the active version's cost:
  const activeVersion = versions.find(v => v.isActive) || versions[0];
  totalCost += activeVersion.estimatedCost || 0;
Every chapter is retrieved with getVersionsByStableId/getVersionsByUrl (ALL paid translation versions), but only ONE (isActive) is added. Every prior retranslation was a real, billed API call whose estimatedCost is silently dropped. This is the ONLY number the budget gate uses: store/slices/translationsSlice.ts:280 (`const spent = await getNovelTranslationCost(...); if (spent >= preloadBudget) return;`) and store/slices/chaptersSlice.ts:1036 (same call inside the preload loop). So if a user sets a $5 cap and retranslates each chapter 3× (e.g. tuning prompts/models) at ~$0.50/version, real spend is ~$15 by the time `spent` reads $5 — a ~3× overspend of a hard cap the user believes is enforced. The undercount factor equals total-versions ÷ active-versions.

**Verifier note.** Mechanism and impact are accurate. Two refinements: (1) The undercount only occurs on retranslation — for chapters translated exactly once the cap is accurate — so the "~3× overspend of a hard cap" is an illustrative worst case (heavy prompt/model tuning) rather than the typical single-translation path; it is also gated behind opt-in budget mode (preloadMode==='budget' && preloadBudget>0) and spends the user's own API key. Prior versions accumulate because retranslation deactivates but does not delete them (default), unless the user manually calls deleteVersion. (2) The same undercounting function also feeds the displayed 'Spent: $X / $cap' figure in Settings (ProvidersPanel.tsx / TranslationEngineSection.tsx), so the user-visible spend number is understated too, not just the enforcement gate. Severity adjusted high→medium given the opt-in + retranslation-dependent, self-billed nature.

**Fix.** Sum estimatedCost across ALL versions of each chapter (or sum the api_metrics translation rows for the novel) instead of only the active version, so the gate reflects cumulative API spend.

### 🟡 MEDIUM 14. Provider-billed responses that fail JSON parsing are recorded in NEITHER cost ledger, so real spend goes uncounted against the budget

- **File:** `adapters/providers/OpenAIAdapter.ts:681`
- **Lens:** Cost/budget accounting · **verifier confidence:** 0.9

**Evidence.** In translate(), the try/catch only wraps the network call (try at line 90, catch's failed-metric recordMetric at line 122 fires only when `client.chat.completions.create` itself throws). processResponse() is invoked AFTER that block (line 145). Inside processResponse the JSON parse can throw (lines 655-661: `throw new Error('Failed to parse JSON response ...')`) BEFORE the success recordMetric at line 681 and before estimatedCost is attached (line 674). A provider returns and bills for an HTTP-200 completion, but if that body isn't parseable JSON the throw propagates up uncaught by translate()'s try — so no api_metrics row is written and no estimatedCost is stored on any translation version. The tokens were paid for but are invisible to both the lifetime ledger and (transitively) the budget gate, further undercounting spend beyond the active-version issue.

**Verifier note.** The gap is broader than JSON-parse-only: the same pre-line-681 region also throws for 'Empty response from API' (line 616) and 'length_cap' truncation (line 628). A truncated completion (finish_reason === 'length') is definitely billed yet escapes both ledgers through the identical path, so the undercount recurs more often than the JSON-parse framing alone implies. The corrupted-short-translation throw at line 722, by contrast, is AFTER recordMetric(681) and so IS counted.

**Fix.** Compute promptTokens/completionTokens/costUsd from response.usage and record a metric (success:false with real costUsd) before attempting JSON.parse, so billed-but-unparseable responses still hit the ledger.

### 🟡 MEDIUM 15. prevUrl-chain fallback assembles prior-chapter context in REVERSED (newest-first) order, contradicting the primary path and the '(OLDEST)' template label

- **File:** `services/translationService.ts:789`
- **Lens:** Prompt-context assembly · **verifier confidence:** 0.9 · _(finder said high, verifier adjusted to medium)_

**Evidence.** buildHistoryByPrevUrlChain walks backward from the immediately-previous chapter: line 789 `let cursorPrev = currentChapter.prevUrl || null;`, pushes that (newest) chapter into results FIRST (lines 816/838), then follows its prevUrl to older chapters (line 850). So results is ordered NEWEST->oldest. The comment at line 883 is wrong ('We built oldest-first (walking backward)'). The primary number-based path instead sorts ascending: line 642 `candidates.sort((a, b) => a.number - b.number)` (also line 746), producing OLDEST->newest. buildTranslationHistoryAsync merges them by APPENDING the newest-first chain onto the oldest-first block (lines 756-766: `merged.push(entry)` then `combinedHistory = merged.slice(-contextDepth)`), scrambling order when the fallback fires. formatHistory (services/prompts.ts L24-55) labels entries 1..N via config/prompts.json L17 '--- PREVIOUS CHAPTER CONTEXT {index} (OLDEST) ---' -- index 1 is meant to be OLDEST, but under the fallback index 1 is the newest chapter. Chapter continuity is fed to the model backwards, silently, whenever chapterNumber-based resolution is incomplete.

**Verifier note.** Claim is accurate. Severity adjusted high->medium: this is a fallback-only path guarded by line 749 (combinedHistory.length >= contextDepth returns early), so it fires only when number-based resolution (memory + IndexedDB findByNumber) yields fewer than contextDepth chapters yet the prevUrl chain resolves them (e.g. chapters lacking correct chapterNumber metadata, per the issue #20 comment). Impact is silent context-ordering degradation of LLM translation continuity, not a crash or data loss. Minor detail: the '(OLDEST)' string is a fixed suffix present on EVERY header (single template with only {index} varying), so the mislabel is that the intended-oldest position 1 becomes the newest chapter under the fallback.

**Fix.** Reverse the prevUrl-chain results (or sort the merged candidates by resolved chapter number) before returning so both code paths emit strict oldest->newest order matching the template.

### 🟡 MEDIUM 16. Export omits proposal/customVersionLabel/imageVersionState/settingsSnapshot and blurb/sourceLanguage; re-importing a backup replaces records by preserved id and silently wipes those fields

- **File:** `services/db/operations/export.ts:217`
- **Lens:** IndexedDB persistence / silent data loss · **verifier confidence:** 0.88 · _(finder said high, verifier adjusted to medium)_

**Evidence.** The UI exporter (ExportModal → exportSlice.ts:155 → SessionExportOps → exportFullSessionToJson) serializes translations with only `id, version, isActive, createdAt, translatedTitle, translation, footnotes, suggestedIllustrations, provider, model, temperature, systemPrompt, promptId, promptName, usageMetrics` (export.ts:217-241) — omitting `proposal`, `customVersionLabel`, `imageVersionState`, and `settingsSnapshot`, all real persisted fields (services/db/types.ts:90, 98, 106, 107; imageSlice.ts:202-217 actively maintains imageVersionState). Chapter export (lines 207-216) likewise omits `blurb` and `sourceLanguage` (types.ts:25,27) which storeChapterModern persists (chapters.ts:217-218). On import, imports.ts does whole-record puts keyed by the PRESERVED exported id: `id: translation.id || crypto.randomUUID()` (line 368) and `chaptersStore.put(chapterRecord)` (line 363) — put replaces the entire record, so restoring your own backup into the same DB overwrites existing records with versions missing those fields: user-named version labels, per-marker generated-image version state, and amendment proposals are destroyed with no warning. The streaming import path reads `translation.proposal ?? null, customVersionLabel, imageVersionState` (importService.ts:425-427) — proof the importers expect fields the exporter never writes.

**Verifier note.** Translation-side loss is universal (id is the preserved primary key, always overwritten). Chapter-side blurb/sourceLanguage loss additionally requires the recomputed import storageUrl to equal the live record's url — deterministic for scoped/novelId chapters, but a non-scoped chapter can import to a different key (duplicate) instead of overwriting. settingsSnapshot's sub-fields (provider/model/temperature/systemPrompt/promptId/promptName) ARE exported at top level so are partly reconstructable, though ImportOps doesn't rebuild the object. Generated images themselves survive via the separate image-asset collection; only imageVersionState (version-switching metadata) is lost. Deeper framing: the export is simply lossy for these fields, so even export→clear→restore drops them, not only re-import-into-populated-DB. Severity lowered HIGH→MEDIUM: genuine silent data loss in a local-first backup feature, but bounded to secondary metadata while primary content (translation text, footnotes, images, settings) round-trips intact.

**Fix.** Add the missing fields to the exported translation/chapter objects (they are plain JSON-serializable) and carry them through both import paths, or at minimum merge-on-import instead of whole-record put when the id already exists.

### 🟡 MEDIUM 17. Per-attempt translation timeout races but never aborts the in-flight request — retries stack concurrent duplicate billed API calls

- **File:** `services/translate/Translator.ts:99`
- **Lens:** Async / error-handling topology · **verifier confidence:** 0.88 · _(finder said high, verifier adjusted to medium)_

**Evidence.** `await Promise.race([ provider.translate(workingRequest), timeoutPromise ])` (lines 99-102) with `timeout(ms)` (lines 351-362) only `reject`s a separate promise on the 90s deadline; `cancelTimeout()` in the finally just `clearTimeout` — it does NOT abort `provider.translate`. No per-attempt AbortController exists (only the user's `workingRequest.abortSignal` is forwarded, and it is not triggered on timeout). So when the race times out, the underlying provider request keeps running, and the retry loop `continue`s (line 151) firing a fresh `provider.translate` — a SECOND concurrent call to the model. Across `maxRetries` (default 3) plus the `translateChunked` fallback, a merely-slow model produces 2-3 simultaneous billed requests; the 429s that causes then re-enter the same backoff-and-retry path, amplifying cost and rate-limit pressure.

**Verifier note.** The mechanism and line references are correct. Two calibrations: (1) Severity down from high to medium — the defect only triggers when a single attempt exceeds the 90s default timeout (reasoning models, large chapters, or an overloaded endpoint — reachable but not the common path), and the impact is cost/rate-limit waste, not correctness or data loss; the typical case is one overlapping duplicate call, with the '2-3 simultaneous + 429 cascade' being the tail worst case. (2) Worth adding that the fix is trivial and already-supported: providers honor abortSignal (OpenAIAdapter passes it straight to the OpenAI SDK's create() call), so wiring a per-attempt AbortController and aborting it in the finally/on timeout would actually cancel the in-flight HTTP request — the finding is a real, easily-fixable resource/cost leak rather than an inherent limitation.

**Fix.** Create a per-attempt AbortController, have the timeout call `controller.abort()`, and pass `controller.signal` (chained with the user signal) into `provider.translate` so a timed-out attempt actually cancels its in-flight request before the next retry starts.

### 🟡 MEDIUM 18. Budget-mode await between dedup-guard check and guard set lets two handleTranslate calls translate the same chapter twice (double API spend, duplicate versions)

- **File:** `store/slices/translationsSlice.ts:279`
- **Lens:** Zustand state & concurrency · **verifier confidence:** 0.85 · _(finder said high, verifier adjusted to medium)_

**Evidence.** The re-entrancy guard is read at entry: `if (state.pendingTranslations.has(chapterId)) { ...return; }` (line 225), but the guard is only SET at line 308 (`nextPending.add(chapterId)`), and when `settings.preloadMode === 'budget'` two awaits sit in between: `const { getNovelTranslationCost } = await import('../../services/db/operations/budgetOps'); const spent = await getNovelTranslationCost(...)` (lines 279-280). Interleaving: (1) preload worker calls handleTranslate(X, 'auto_preload') — guard check passes, yields at the budget await; (2) the auto-translate mediator or a second preload worker (MainApp.tsx:197-202 spawns a NEW detached worker on every currentChapterId change with no cancellation of prior workers; chaptersSlice.ts:1055 `setTimeout(worker, 1500)`) calls handleTranslate(X) — `pendingTranslations` still doesn't contain X, guard passes again; (3) both resume, both add X to pending, both fetch `getVersionsByStableId` (line 342) before either has persisted, find no matching version, and both call `TranslationService.translateChapterSequential`. The service's `runSequential` queue (translationService.ts:224-236) serializes but does NOT dedupe, so the second call runs the full LLM translation again after the first finishes. User observes double token/budget spend and two versions with identical settings in the version picker — exactly what the `matchingVersion` check was built to prevent. In non-budget mode the guard window is synchronous and safe; only the budget path has the hole.

**Verifier note.** Severity lowered from high to medium: the defect is real and costs real money (double LLM call) plus duplicate identical-settings versions, undermining the budget cap's purpose, but it is gated on budget mode AND requires two handleTranslate calls hitting the same chapter within a bounded timing window (a couple IndexedDB reads); in the common staggered case the worker's line-1012 pending.has guard and the mediator's isPending guard close it. Also, the claim slightly understates the window for the two-preload-worker case: the preload worker's OWN budget await (chaptersSlice.ts:1035-1036) sits between its line-1012 pending.has guard and the pending set inside handleTranslate, widening the non-atomic gap to ~4 awaits rather than only the two at lines 279-280.

**Fix.** Add chapterId to pendingTranslations synchronously before the budget check (and remove it on the early budget-return), or re-check `get().pendingTranslations.has(chapterId)` immediately after the budget awaits.

### 🟡 MEDIUM 19. Boot hydration race: mediator auto-translate fires on the bootstrap currentChapterId set with a stale empty chapters map — spurious 'Chapter not found' failure, and one interleaving permanently skips auto-translate

- **File:** `store/autoTranslateMediator.ts:69`
- **Lens:** Zustand state & concurrency · **verifier confidence:** 0.85 · _(finder said high, verifier adjusted to medium)_

**Evidence.** Bootstrap sets the restored chapter id BEFORE loading it: `ctx.set((state) => ({ currentChapterId: state.currentChapterId || lastChapterData.id }))` then only afterwards calls `loadChapterFromIDB` fire-and-forget (store/bootstrap/initializeStore.ts:443-457). The mediator subscriber runs synchronously inside that set(): the chapter is not in `chapters`, so `hasTranslation:false`, `isHydrating:false` (hydratingChapters is still `{}` — the flag is set later by loadChapterFromIDB), and viewMode defaults to 'english' (uiSlice.ts loadViewMode fallback `return 'english'`), so `shouldAutoTranslate` passes and `handleTranslate(id, 'auto_visit')` fires. handleTranslate snapshots `context.chapters = state.chapters` from the PRE-hydration state (translationsSlice.ts:229-233) and, for a chapter with zero saved versions, carries that stale empty Map through the awaits into `TranslationService.translateChapterSequential`, where `chapters.get(chapterId)` fails → `{ error: 'Chapter not found' }` (services/translationService.ts:255-258) → `emitTranslationFailure` + `setError('Chapter not found')` shown for the current chapter (lines 552-560). Worse, the mediator's re-evaluation gate `const changed = curr.currentChapterId !== prev... || curr.isHydrating !== prev.isHydrating` (autoTranslateMediator.ts:69-73) omits `isPending`: if hydration completes while the doomed attempt is still in `pendingTranslations`, the isHydrating flip evaluates while `isPending` is true (skipped), and the later pending-removal set() produces `changed === false` — auto-translate never re-fires. User observes on a routine restart: an error banner about a chapter that plainly exists, and an untranslated chapter that no longer auto-translates despite English view mode.

**Verifier note.** The claim is essentially accurate. Two refinements: (1) deriveSnapshot's `viewMode: s.viewMode ?? 'original'` fallback (line 37) is never exercised — the 'english' default actually comes from uiSlice's loadViewMode()/state init, exactly the localStorage path the claim cites, so the mechanism holds. (2) Part B's permanent-skip is more robust than 'one interleaving': because NavigationService flips isHydrating to false (hydration.ts finally, line 209) BEFORE the chapter is inserted into the map (chaptersSlice:213), even the 'recovery' interleaving (isPending already false at the hydrating flip) re-fires handleTranslate against a still-stale map → a second 'Chapter not found' — and for a zero-version chapter hasTranslation never changes, so no gated transition ever re-triggers a successful auto-translate on that boot. The trigger requires the last-active chapter to have zero saved translation versions (a never-successfully-translated / interrupted chapter); if any version exists in IDB, the auto_visit branch (translationsSlice:429) blocks cleanly and no error is shown.

**Fix.** Include isPending/isTranslationActive transitions in the mediator's `changed` gate (or re-evaluate on pending-clear), and make handleTranslate re-read `get().chapters` after its awaits instead of using the entry snapshot.

### 🟡 MEDIUM 20. Gemini fallback JSON extraction returns an empty translation as a SUCCESS (fail-open) — blank chapter persisted with no error

- **File:** `services/ai/providers/gemini.ts:379`
- **Lens:** Async / error-handling topology · **verifier confidence:** 0.85

**Evidence.** In the catch that salvages a malformed response, `const extracted = extractFirstBalancedJson(responseText); ... const sanitized = sanitiseTranslation(parsedJson.translation || ''); return { translatedTitle: parsedJson.translatedTitle || parsedJson.title || '', translation: sanitized, ... };` (lines 375-387). If the salvaged JSON block parses but lacks a `translation` field, `parsedJson.translation || ''` yields `''` and the function RETURNS a success-shaped TranslationResult with an empty body instead of throwing. Downstream nothing rejects empty content: Translator.sanitizeResult (services/translate/Translator.ts:332) passes `''` through, and TranslationService persists it via TranslationOps.storeByStableId (services/translationService.ts:388) as a valid version. The user gets a blank chapter saved as a real translation, and the retry/`length_cap` machinery never fires because the call 'succeeded'.

**Verifier note.** Details in the claim are accurate. Worth adding: (1) The core defect is an asymmetry — the primary parse path throws on a missing translation AND supports alternative field names (content/translation/translated_content/body), whereas the fallback catch supports neither and silently defaults to ''. (2) A key enabling factor is the absence of any finishReason===MAX_TOKENS guard before the parse (only empty-candidate checks at lines 235/244), so truncated-but-nonempty Gemini responses reach this salvage path instead of triggering the length_cap retry. The most concrete realistic trigger is truncation during the trailing footnotes/suggestedIllustrations arrays (schema order = translatedTitle, translation, footnotes, suggestedIllustrations), where extractFirstBalancedJson returns a complete nested footnote/illustration object that has no translation field. Severity medium is fair (silent success + persisted blank chapter + wasted API cost + no retry, but local-first, recoverable, no security impact).

**Fix.** In the fallback branch, treat a missing/empty `translation` as a parse failure — throw the existing malformed-JSON error rather than returning `translation: ''`.

### 🟡 MEDIUM 21. Persisted-image write failure is swallowed with only a warn — a just-paid-for image is lost on reload

- **File:** `services/imageGenerationService.ts:302`
- **Lens:** Async / error-handling topology · **verifier confidence:** 0.85

**Evidence.** After a successful (billed) generateImage call the code mutates the in-memory chapter (`target.generatedImage = enrichedResult`, line 264) and then persists: `try { await TranslationPersistenceService.persistUpdatedTranslation(...); } catch (error) { swarn('[ImageGen] Failed to persist image to IndexedDB:', error); }` (lines 288-304). The catch only logs and continues, returning the image as a normal success. The image bytes live in the Cache API under `imageCacheKey`, but the mapping (suggestedIllustrations[].generatedImage + imageVersionState) that loadExistingImages depends on (services/imageGenerationService.ts:79-96 reads `generated?.imageCacheKey`) is only in the un-persisted translationResult. On reload the chapter's translationResult is re-hydrated from IDB without that mapping, so the image vanishes from the UI while its blob is orphaned in cache — silent loss of a paid operation.

**Verifier note.** The imageGenerationService catch's swarn is gated behind the 'image' debug pipeline (utils/debug.ts:126-134 early-returns when off), so by default it emits NOTHING — even more silent than "only logs." However, persistUpdatedTranslation itself emits a raw console.error before re-throwing, so a console-error trail does exist; what is genuinely absent is any user-facing surfacing (no toast/notification) and the operation is still reported to the UI as a success.

**Fix.** On persist failure, surface it to the caller/UI (return an error flag or set the image state's error) rather than swallowing with a warn, so the user knows the image was not saved and can retry.

### 🟡 MEDIUM 22. Every benchmark pass runner defaults to 16000 completion tokens while production caps passes at 3000-8000 — a parity gap absent from ADR SUTTA-014's measured table, with silent degradation on the production side

- **File:** `services/sutta-studio/passes/skeleton.ts:69`
- **Lens:** Behaviorally divergent duplicate pathways · **verifier confidence:** 0.82 · _(finder said high, verifier adjusted to medium)_

**Evidence.** All six benchmark pass runners default `maxTokens = 16000` (passes/skeleton.ts:69 with the comment `// High default for reasoning models (kimi, lfm, etc.)`; anatomist.ts:38, lexicographer.ts:54, weaver.ts:46, typesetter.ts:42, morphology.ts:34 — benchmark.ts leaves the override undefined at line 1200, so 16000 is effective). Production hardcodes far lower budgets in compiler/index.ts: anatomist `signal, 8000` (:414), lexicographer `signal, 8000` (:545), weaver `signal, 4000` (:584), typesetter `signal, 3000` (:626), phase `signal, 4000` (:651), morphology `signal, 3000` (:701), and compiler/skeleton.ts:70 `signal, 4000`. The duplicated skeleton even claims equivalence — passes/skeleton.ts:135 says `Mirrors services/compiler/skeleton.ts` — while diverging 4x on the budget. SUTTA-014's 'actual parity gap (measured against the code, 2026-07-03)' table lists 6 input gaps but no token-budget row, so this gap survived the parity audit. Consequence: a reasoning model that scores well on the board (16k budget) truncates in production, and production's error handling hides it — compiler/skeleton.ts:127-129 catches and silently substitutes mechanical chunks (`warn(...); phases.push(...chunkPhases(chunkSegments, 8, ...))`, console-only, no ValidationIssue), and index.ts:440 logs `Anatomist pass failed for ${phase.id}; continuing without it.` The benchmark copy records `fallbackUsed: true` per chunk; production surfaces nothing to the packet.

**Verifier note.** Two framing details are slightly off but don't overturn the finding: (1) The `Mirrors services/compiler/skeleton.ts` comment at passes/skeleton.ts:135 is attached to the duplicate-claim-handling block, not to the whole file, so it does not literally 'claim equivalence' of token budgets. (2) The SUTTA-014 parity table's column is headed 'Input' and enumerates DPD/dictionary/retrieval/prior-phases/morphology-fallback/grounding inputs; maxTokens is a call parameter rather than one of those inputs, so its absence from that specific table is partly a scope mismatch — though the ADR still never addresses token budgets anywhere, leaving the parity goal genuinely un-audited on this axis. Severity is better rated medium than high: the parity gap is unconditional, but actual production truncation is conditional on reasoning-model usage and per-pass output size (non-reasoning models on small per-phase chunks rarely exceed 3000-8000 completion tokens), it causes silent quality degradation and possible board mis-ranking rather than a crash or data loss, and the ADR in question is still 'Proposed'.

**Fix.** Define per-pass token budgets once (a shared constants module) consumed by both compiler/index.ts and the pass runners, and add a token-budget row to SUTTA-014's parity table; also surface skeleton-chunk fallback as a packet ValidationIssue like surface repair already is.

### 🟡 MEDIUM 23. /sutta/pipeline production route depends on a dev-only API — no Vercel function, always 404s when deployed

- **File:** `vite.config.ts:143`
- **Lens:** Config, scripts & docs drift · **verifier confidence:** 0.8 · _(finder said high, verifier adjusted to medium)_

**Evidence.** The `/sutta/pipeline` route (App.tsx:85-86 renders SuttaStudioPipelineLoader) fetches `/api/sutta-studio/reports` (SuttaStudioPipelineLoader.tsx:80) and `/api/sutta-studio/reports/<id>/packet.json` (:94) when no `?path=` param is given. Those endpoints are implemented ONLY inside vite.config.ts's `suttaStudioReportsPlugin().configureServer` middleware (lines 133-198), which runs exclusively under `vite dev`. The `api/` directory contains only `fetch-proxy.js` and `client-telemetry.js` — there is NO serverless function for sutta-studio reports. vercel.json rewrites `/api/(.*)` -> `/api/$1` (identity, no function behind it), so on the Vercel-deployed site the fetch at :80 returns 404, `reportsResponse.ok` is false, and the route always renders 'Failed to load pipeline output' (:132). The feature silently works only on a local dev server.

**Verifier note.** This is a distinct-but-adjacent finding to the prior audit's '?path= fetch' issue, not a strict duplicate: the '?path=' branch (loadFromPath, the leaderboard's actual 'View' link at SuttaStudioBenchmarkView.tsx:581) is a different mechanism (static reports/ file not present in the dist build) from this claim's default/`?report=` branch, which fails because the report-LISTING API (`/api/sutta-studio/reports`) is implemented only as vite dev-server middleware. Also note the `?report=<id>` branch is broken for the same reason — line 80 fetches the dev-only listing endpoint before line 91 selects the report — so it isn't only the bare no-param case that 404s.

**Fix.** Add a Vercel serverless function under api/ that mirrors the dev plugin's report listing/packet serving (or prerender the report index), or guard/hide the /sutta/pipeline route in production builds.

### 🟡 MEDIUM 24. compare 'View' recomputes content/seg F1 at publish time but reads `overall` from frozen run-time scores → intra-row inconsistency and silent board/View drift on any scorer change

- **File:** `scripts/sutta-studio/publish-compare.ts:126`
- **Lens:** Benchmark aggregation & publication · **verifier confidence:** 0.8

**Evidence.** Within one phase record, `segF1`/`contentF1`/`contentPrecision`/`contentRecall` are RECOMPUTED live at publish time (`scoreContentFidelityDetail(oa, ga, ol, gl)` and `scoreSegmentationFidelity(oa, ga)`, 125-130) using whatever quality-scorer.ts is checked out then, but `overall` and `textIntegrity` are read from the frozen quality-scores.json (`phaseScores?.overallScore ?? null`, 133-134) written at run time. The comment on 122-123 asserts these 'can't drift from the metric', but nothing pins the scorer version: because `overall` is itself a function of content+seg fidelity, a scorer change between run and publish (this repo has already moved golden v1→v2 and rubric v2.0→v2.1) makes a single displayed row internally inconsistent (its `overall` no longer matches its shown `contentF1`/`segF1`), and makes the whole View contradict the leaderboard's frozen contentFidelity. They agree today only because the scorer happens to be unchanged since these runs.

**Verifier note.** Two refinements to the claim. (1) The board's rubric-version guard (generate-leaderboard.ts 320-331) does NOT fully protect against this: it keys on the frozen rubricVersion STRING, so any scorer-LOGIC change that keeps the same version label (e.g. the tokenize() NFC fix and the normSurface reconstruction change, both already made in-code under v2.1) silently diverges the live View from the frozen board with nothing catching it. So framing this as only a golden/rubric-version bump risk understates it — it triggers on any scorer logic edit. (2) The frozen fields are exactly overall and textIntegrity (133-134); everything else in the per-phase scores strip (segF1/contentF1/P/R/semantic/coverage) is recomputed. The robust fix is to source ALL displayed per-phase numbers from ONE place — either recompute overall/textIntegrity live too (run the full scorer), or read seg/content frozen from quality-scores.json — and to verify/pin the frozen quality-scores.json rubricVersion against the current scorer's RUBRIC_VERSION, mirroring the guard the leaderboard already has. Severity best characterized as medium-leaning-low: benign today, defeats the artifact's stated auditability purpose only after an un-backfilled scorer edit.

**Fix.** Either read ALL per-phase numbers (incl. content/seg F1) from the frozen quality-scores.json so the View is a pure replay, or recompute `overall` too and stamp the scorer version so a mismatch fails loudly.

### 🟡 MEDIUM 25. Importing a session over existing translations aborts mid-import on unique-index ConstraintError, leaving a partially imported DB with no rollback

- **File:** `services/db/operations/imports.ts:367`
- **Lens:** IndexedDB persistence / silent data loss · **verifier confidence:** 0.78 · _(finder said high, verifier adjusted to medium)_

**Evidence.** importFullSessionData writes each 50-chapter batch in its own transaction with fire-and-forget puts: `translationsStore.put({ id: translation.id || crypto.randomUUID(), chapterUrl: identity.storageUrl, stableId: identity.stableId, version: translation.version || 1, ... })` (lines 367-389) with no per-request onerror. The translations store has unique indexes `chapterUrl_version` ['chapterUrl','version'] and `stableId_version` ['stableId','version'] (connection.ts:249-251, schema.ts:241-243). If the DB already holds a translation for the same chapter/version under a DIFFERENT id — e.g. importing a session exported on another device for a novel you also translated locally (stableIds are content-derived so they match), or re-importing a BookToki scrape whose translations carry no ids so a fresh randomUUID is minted each time — the put raises ConstraintError, the unhandled request error aborts the whole batch transaction, tx.onerror rejects (line 332), and importSessionData surfaces a cryptic DOMException. Batches before the failing one are ALREADY COMMITTED (each batch is a separate transaction, lines 321-408) and `MaintenanceOps.syncSummaries` (line 431) never runs — the DB is left half-imported with stale summaries and no cleanup or resume path.

**Verifier note.** Index paths are services/db/core/connection.ts:249-251 and services/db/core/schema.ts:241-243 (claim dropped the /core/ segment; lines correct). Re-importing the identical export file does NOT trigger the bug — exported translations carry their id (export.ts:218), so put overwrites by primary key with no constraint violation. The collision specifically needs the DB to already contain a translation at the same scoped [chapterUrl,version]/[stableId,version] under a DIFFERENT id (two distinct exports of the same chapter/version, cross-device/shared-registry merge, or id-less scrape payloads). No existing user data is corrupted or lost (the aborted batch's writes roll back; prior committed batches and untouched novels remain), which is why medium, not high, is the accurate severity — though the half-imported state with stale summaries, a cryptic DOMException, and re-import re-hitting the same ConstraintError (no recovery path) is a genuine bug.

**Fix.** Before putting, look up existing records by the chapterUrl_version/stableId_version indexes and merge/overwrite deterministically (or delete-then-put within the same transaction), and treat a batch failure as resumable rather than abandoning the import mid-way.

---

## ⚪ LOW (23)

### ⚪ LOW 1. Pipeline loader error UI instructs a non-existent npm script (`npm run bench:sutta-studio`)

- **File:** `components/sutta-studio/SuttaStudioPipelineLoader.tsx:137`
- **Lens:** Config, scripts & docs drift · **verifier confidence:** 0.97 · _(finder said medium, verifier adjusted to low)_

**Evidence.** The error state renders `npm run bench:sutta-studio` (line 136-138) as the recovery instruction users see when the pipeline fails to load. package.json defines no such script — the sutta scripts are `sutta:lookup` and `smoke:sutta-studio`, and per docs/WORKLOG.md:1514 the benchmark is actually run via `./node_modules/.bin/tsx scripts/sutta-studio/benchmark.ts`. A grep confirms `bench:sutta-studio` appears nowhere except this line. Following the on-screen instruction fails immediately with 'npm error Missing script: bench:sutta-studio'.

**Verifier note.** The correct command is not an npm script; the benchmark is invoked directly, e.g. `./node_modules/.bin/tsx scripts/sutta-studio/benchmark.ts` (or `npx tsx scripts/sutta-studio/benchmark.ts`). The nearest existing npm scripts are `sutta:lookup` and `smoke:sutta-studio`.

**Fix.** Replace the instruction with the real command (`npx tsx scripts/sutta-studio/benchmark.ts`) or add a `bench:sutta-studio` script to package.json.

### ⚪ LOW 2. prompts.ts history illustration-count uses the same double-escaped regex, so every prior-chapter context hint reports 'Illustration markers: 0'

- **File:** `services/prompts.ts:26`
- **Lens:** Copy-paste drift across providers · **verifier confidence:** 0.96 · _(finder said medium, verifier adjusted to low)_

**Evidence.** services/prompts.ts:26 builds a per-history-chapter hint sent to the model:

    const illuCount = (h.translatedContent.match(/\\[ILLUSTRATION-\\d+\\]/g) || []).length;

Same double-escaped `\\[ILLUSTRATION-\\d+\\]` bug as claudeService.ts:215 (and, separately, it omits the `[A-Za-z]*` the canonical uses). Because the pattern requires literal backslashes that never appear in translated content, `illuCount` is always 0. This value is emitted into every provider's history context as `prompts.historyIllustrationMarkersLabel ${illuCount}` (prompts.ts:47), so the model is always told previous chapters had zero illustrations regardless of the truth — quietly degrading illustration-density continuity for all providers. Correct usages elsewhere (epubService/generators/chapter.ts:117, components/chapter/translationTokens.tsx:26) use single-escaped `\[ILLUSTRATION-\d+...\]`.

**Verifier note.** The count is emitted at prompts.ts:50, not line 47 (line 47 is the FOOTNOTES block). Also worth noting: the same formatHistory block includes the previous chapter's verbatim translatedContent (line 44) which still carries the real [ILLUSTRATION-N] markers, so the wrong count is a contradictory hint rather than the model's only signal — this mitigates real-world impact and is why severity is lowered from medium to low.

**Fix.** Change the regex to /\[ILLUSTRATION-\d+[A-Za-z]*\]/g (single backslashes), ideally via a shared exported constant used by responseValidators, prompts, and the epub/token renderers.

### ⚪ LOW 3. Production XHTML sanitizer's control-char regex is written with literal raw NUL/0x1F/0x7F bytes in the source, where its twin spells them escaped

- **File:** `services/epubService/sanitizers/xhtmlSanitizer.ts:19`
- **Lens:** Behaviorally divergent duplicate pathways · **verifier confidence:** 0.95

**Evidence.** Hexdump of line 19 shows `2e 72 65 70 6c 61 63 65 28 2f 5b 00 2d 1f 7f 5d 2f 67` — i.e. `sanitizeStyle`'s `.replace(/[ -]/g, '')` is encoded with LITERAL control bytes (NUL, 0x1F, 0x7F) inside the regex character class, while the duplicate copy services/epub/XhtmlSerializer.ts:19 spells it safely: `const v = (value ?? '').replace(/[ -]/g, '');`. Behavior is identical today, but a raw NUL byte in a .ts file makes many tools treat it as binary (grep/diff/editors), and any formatter, sync tool, or copy-paste that strips or normalizes control characters silently rewrites what the production style-attribute sanitizer strips — with no visible diff in most viewers. This is the production copy of a security-adjacent function (it guards `style` attributes ahead of the `url(javascript:)`/`expression(` checks) in the live EPUB export path.

**Verifier note.** The claim's inline code quote of the twin as `.replace(/[ -]/g,'')` is a mis-transcription; the twin is actually the escaped `/[ -]/g` (the claim title states this correctly). Also the twin XhtmlSerializer.ts is not an equal duplicate — it has zero importers (dead/legacy code), while the raw-byte xhtmlSanitizer.ts is the sole live copy, which strengthens the finding: the safe encoding is not the one shipping.

**Fix.** Replace the raw control bytes with the escaped `/[ -]/g` form so both copies are textually identical and editor-safe.

### ⚪ LOW 4. imageSlice mutates chapter.translationResult in place outside set() (persistImageVersionState, loadExistingImages migration) and resetAdvancedControls deletes keys on shared sub-object references — subscribers never notified, prior snapshots corrupted

- **File:** `store/slices/imageSlice.ts:212`
- **Lens:** Zustand state & concurrency · **verifier confidence:** 0.9 · _(finder said medium, verifier adjusted to low)_

**Evidence.** persistImageVersionState grabs the live state object and writes through it with no set(): `const versionStateMap = chapter.translationResult.imageVersionState ?? {}; ... versionStateMap[placementMarker] = { latestVersion, activeVersion, versions }; chapter.translationResult.imageVersionState = versionStateMap;` (lines 202-217) — this mutates the translationResult object that every earlier state snapshot, the chapters Map, and any in-flight persistence/export payload share by reference, and fires no subscription. The legacy migration inside loadExistingImages does the same class of thing mid-await: `illust.generatedImage.imageCacheKey = cacheKey; illust.generatedImage.imageData = ''; delete (illust as any).url; ... chapter.translationResult.imageVersionState = {...}` (lines 577-619), mutating illustrations owned by store state while other actions (updateChapter's shallow `{ ...chapter, ...updates }`, chaptersSlice.ts:296) are cloning around the same shared reference. Same defect inside a set(): resetAdvancedControls does `const newState = { ...prevState }; delete newState.steeringImages[key]; delete newState.negativePrompts[key]; ...` (lines 841-848) — the top-level spread copies only the outer object, so every `delete` mutates the CURRENT state's sub-objects and returns the same references: components selecting steeringImages/negativePrompts/etc. compare identical references and never re-render, and the 'previous' state handed to subscribers has already been altered. Maintainer trap: any equality-based memoization, devtools time-travel, or diff heatmap over these objects observes retroactively-changed history.

**Verifier note.** The "subscribers never notified" framing overstates visible-UI impact for the two persist paths: persistImageVersionState is always invoked AFTER a set() that already updates the reactive activeImageVersion/imageVersions slices (imageSlice.ts lines 983, 1007, 1140), which are what actually drive the version-navigation UI. imageVersionState on translationResult is a persistence-side write-through, so the practical harm there is the shared-reference snapshot mutation (mostly theoretical here) rather than a stale on-screen render. The clearest standalone defect is resetAdvancedControls (shallow spread then delete on shared sub-objects); its correct counterpart resetAllAdvancedControls immediately below spreads each sub-object and is the reference fix.

**Fix.** Route all translationResult changes through updateChapter with fresh objects, and rebuild each sub-record immutably (`const next = { ...prev.steeringImages }; delete next[key]; return { steeringImages: next }`) as clearImageState already does.

### ⚪ LOW 5. SSRF fetch-allowlist is triplicated and already diverged; the documented "single source of truth" is imported by neither proxy

- **File:** `services/scraping/allowedDomains.ts:3`
- **Lens:** Security · **verifier confidence:** 0.9 · _(finder said medium, verifier adjusted to low)_

**Evidence.** allowedDomains.ts documents itself as the authoritative allowlist: "Imported by both the Vite dev proxy and Vercel serverless proxy. A single source of truth prevents dev/prod policy divergence." (lines 2-4, INV-3). This is false at runtime: neither server-side fetch proxy imports it. vite.config.ts:14 hardcodes its own `const ALLOWED_DOMAINS = [...]` and api/fetch-proxy.js:14 hardcodes another. The three copies have ALREADY drifted — allowedDomains.ts lists 10 domains and lacks 'fojin.app' and '84000.co', while BOTH live proxies (vite.config.ts:25-26 and api/fetch-proxy.js:25-26) allow them. This allowlist is the SSRF/open-relay control for server-side fetch of an attacker-influenceable ?url= (api/fetch-proxy.js handler). Because the file that looks authoritative is dead code at runtime, a maintainer tightening it for security (removing a compromised domain) would have zero effect on prod, and dev/prod policy silently drifts — the exact failure the comment claims to prevent.

**Verifier note.** The claim's statement that "dev/prod policy silently drifts — the exact failure the comment claims to prevent" is inaccurate. tests/services/scraping/proxy-parity.test.ts (referenced by the vite.config.ts:13 comment) regex-extracts ALLOWED_DOMAINS from BOTH vite.config.ts and api/fetch-proxy.js and asserts equality (line 73), so the two live enforcement points are actively test-kept in sync and currently carry an identical 12-domain list — dev↔prod parity IS enforced and there is no active SSRF vulnerability. The true defect is narrower: allowedDomains.ts is imported by NOTHING (dead code), its self-description as the imported single-source-of-truth is false, and it has diverged (10 vs 12 domains). Because the live control is intact and test-enforced, severity is better rated low (stale-dead-code / false-invariant maintainability hazard) rather than medium.

**Fix.** Make both proxies import ALLOWED_DOMAINS/isDomainAllowed from a single shared module (a plain .js so api/fetch-proxy.js can require it), delete the two hardcoded copies, and have the parity test assert set-equality rather than just non-empty.

### ⚪ LOW 6. Central sanitizeHtml() leaves event-handler and javascript: attributes on structural tags — a false safety boundary for untrusted LLM output

- **File:** `services/translate/HtmlSanitizer.ts:23`
- **Lens:** Security · **verifier confidence:** 0.9 · _(finder said medium, verifier adjusted to low)_

**Evidence.** sanitizeHtml() is the app's centrally-named sanitizer ("Centralized HTML sanitization utilities used by reader and EPUB paths") applied to raw model output at services/translate/Translator.ts:336 `translation: sanitizeHtml(result.translation || '')`. It only strips attributes from INLINE tags:

  s = s.replace(/<\s*([\/]?)(i|em|b|strong|u|s|sub|sup)\b[^>]*>/gi, '<$1$2>');   // line 23

Structural tags are allow-listed WITH their attributes untouched (line 30 epubTags includes a|img|div|span|...), and the only other transform is escapeUnknownTags (line 32) which merely escapes the '<' of tags NOT on the allowlist. So `<img src=x onerror=alert(document.cookie)>`, `<a href="javascript:...">`, and `<div onmouseover=...>` pass through with handlers intact. This is NOT a live XSS today only because every current consumer independently neutralizes it (the reader tokenizes text through React escaping in components/chapter/translationTokens.tsx, and the EPUB path re-runs the strict sanitizeHtmlAllowlist). But a function literally named sanitizeHtml, documented as the sanitizer, whose output is trusted model text, is a trap: the next dev who pipes its result into innerHTML/dangerouslySetInnerHTML (or a preview/"copy as HTML" feature) gets stored XSS from any malicious/compromised translation payload.

**Verifier note.** Severity reduced medium→low. The described dangerous-attribute pass-through is real and reproducible from the code, but there is no current data flow to any executable sink: the reader renders via React-escaped text tokens (no innerHTML), and every EPUB innerHTML write is fed sanitizeHtmlAllowlist output, which rebuilds elements with createElement(tagName) and copies NO attributes (so even for its own allowed tags, no handlers survive) and unwraps img/a/div. No dangerouslySetInnerHTML exists in production. The value of the finding is defense-in-depth / naming-trap (rename or actually strip attributes so the 'sanitizer' name isn't a footgun for a future consumer), not a present vulnerability.

**Fix.** Strip on* and javascript:/data: attributes for ALL allowed tags (or rebuild the tree via DOMParser + an attribute allowlist as sanitizeHtmlAllowlist already does), rather than only for the inline-formatting subset.

### ⚪ LOW 7. illustration-validation.test.ts tests a private in-file copy of the validator — and asserts behavior OPPOSITE to production, so it can never catch a real bug

- **File:** `tests/services/illustration-validation.test.ts:5`
- **Lens:** Test-suite honesty · **verifier confidence:** 0.9 · _(finder said high, verifier adjusted to low)_

**Evidence.** The file opens with `// We need to test the validateAndFixIllustrations function, but it's not exported // So we'll create our own version for testing`. It then defines three local re-implementations inside the test file (`validateAndFixIllustrations` L5, `validateIllustrationsFixed` L32, and the one the specs actually call, `validateIllustrations` L59) and tests THOSE. The real production function is exported at services/ai/responseValidators.ts:15 (and never imported here). Worse, the local copy only ever THROWS on any mismatch, while production AUTO-FIXES: the test 'should throw when JSON has illustrations but text is empty' (L129) asserts `.toThrow()`, but responseValidators.ts L35-44 handles `jsonMarkers.length > textMarkers.length` by appending the markers and returning success (no throw); the partial-match test (L139) asserts `.toThrow()` but production L62-77 REMAPS markers and returns success. So the real illustration-reconciliation path (which feeds image generation) has zero coverage and these 16 green assertions encode the inverse of production behavior — the real function could be deleted or inverted and every test stays green.

**Verifier note.** The 'zero coverage' / 'real function could be deleted or inverted and stay green' portion is incorrect. The production validateAndFixIllustrations IS covered by tests/services/aiService.internal.test.ts (imports the real function via __testUtils and tests all four branches: align L50-61, append-extras L63-72, remap L74-79, throw L81-85). The genuine issue is narrower: illustration-validation.test.ts is a redundant self-referential test whose local copies throw-only, so two of its assertions (L129, L139) document the OPPOSITE of what production does (production auto-appends and auto-remaps). It cannot catch a production regression (it never touches production code) but it also does not leave the production path uncovered. Severity is low (misleading/dead test to delete), not high.

**Fix.** Delete the three in-file copies, `import { validateAndFixIllustrations } from '../../services/ai/responseValidators'`, and rewrite the specs to assert the real auto-fix/append/remap/throw outcomes.

### ⚪ LOW 8. CI runs only `vitest run` — the entire Playwright e2e layer plus all render/diagnostic/grounding smoke tests never execute in CI

- **File:** `.github/workflows/test.yml:28`
- **Lens:** Test-suite honesty · **verifier confidence:** 0.9 · _(finder said medium, verifier adjusted to low)_

**Evidence.** test.yml's only test step is `run: npx vitest run` with env `CI:'true'` (L28-30); there is no Playwright job in either workflow (.github/workflows/ holds only test.yml and codex-review.yml). vitest.config.ts L8-11 excludes `tests/e2e/**`, so all 11 e2e specs (initialization, fojin-fan-translation, sutta-studio, chapterview-large/media, etc.) never run in CI, and the only real-LLM grounding+cache test (tests/e2e/sutta-studio-grounding-smoke.spec.ts L39 `test.skip` unless `RUN_GROUNDING_SMOKE==='1'`) is reachable only via the `smoke:sutta-studio` npm script that CI never calls. On top of that, render-level smoke assertions are gated off by default (`tests/smoke/critical-components.smoke.test.tsx:18 const itRender = process.env.LF_SMOKE_RENDER === '1' ? it : it.skip` — so only import-does-not-throw checks run in CI) and diagnostic specs are gated on `LF_E2E_DIAGNOSTICS==='1'` (debug-console.spec.ts:3, diagnostic.spec.ts:14). None of these env flags are set anywhere in CI. The green CI badge therefore certifies unit/integration only while presenting a rich e2e/render suite that no automated gate ever exercises.

**Verifier note.** Factual claims are all correct. Two calibrations: (1) the grounding smoke requires BOTH OPENROUTER_API_KEY and RUN_GROUNDING_SMOKE=1 (via SHOULD_RUN), not just RUN_GROUNDING_SMOKE. (2) The 'theater' characterization is overstated — the e2e exclusion is explicitly documented in vitest.config.ts, and the paid-LLM / flaky-render / diagnostic gates are deliberate, appropriate tradeoffs. The real, narrower finding is: no Playwright job exists in CI at all, so the 11 e2e regression specs (initialization, fojin, sutta-studio, chapterview) are never exercised by any automated gate.

**Fix.** Add a Playwright CI job (`playwright test`) — even a smoke subset — and either run the render smoke tests with `LF_SMOKE_RENDER=1` in CI or delete the opt-in gating so the assertions actually run.

### ⚪ LOW 9. tsconfig silently excludes real (non-test) source files from typecheck

- **File:** `tsconfig.json:34`
- **Lens:** Config, scripts & docs drift · **verifier confidence:** 0.9

**Evidence.** The `exclude` array drops three actual source modules from `tsc --noEmit`: services/audio/storage/cache.ts (line 34), opfs.ts (35), pinning.ts (36) — alongside the expected node_modules/dist/tests entries. These are .ts product files, not tests, so any type errors in them are permanently invisible to a 'green typecheck'. They are currently unimported by services/, components/, store/, or hooks/ (verified via grep) so runtime impact is nil today, but the exclusion is an undocumented hole in the type safety net that a maintainer trusting `tsc` would not expect.

**Verifier note.** The 'green typecheck a maintainer trusts' framing overstates exposure slightly: package.json has NO typecheck/tsc script and no CI workflow runs tsc, so this tsconfig (noEmit:true) drives only editor/manual tsc --noEmit, not an automated gate. The structural hole is exactly as described, but the practical blast radius is even smaller. Also worth noting these three files are currently dead/orphaned code (unreferenced even within services/audio), so runtime impact is genuinely nil today, consistent with the claim.

**Fix.** Either delete the dead audio-storage files, or fix their types and remove them from `exclude` so they are actually checked.

### ⚪ LOW 10. Three divergent balanced-JSON extractors; OpenAIAdapter's copy mishandles escaped quotes differently from the other two

- **File:** `adapters/providers/OpenAIAdapter.ts:583`
- **Lens:** Copy-paste drift across providers · **verifier confidence:** 0.9

**Evidence.** There are three independent 'extract the first balanced JSON object' implementations that have drifted in their string/escape handling:
- services/ai/textUtils.ts:extractBalancedJson — walks strings and skips escapes via `i += 2`, only handles `{...}`, throws on failure.
- services/ai/providers/gemini.ts:119 extractFirstBalancedJson — full esc/inStr state machine, retries from later `{`, falls back to `[...]`, returns null.
- adapters/providers/OpenAIAdapter.ts:583 (private extractBalancedJson) — uses the naive `char === '"' && prevChar !== '\\'` test. This misjudges a legitimately-escaped backslash immediately before a closing quote (e.g. a JSON string value ending in `...\\`): prevChar is a backslash so the real closing quote is treated as escaped, `inString` never flips back, and the object is reported as unbalanced -> parse failure the other two extractors would survive. The live OpenAI/OpenRouter/DeepSeek path (OpenAIAdapter.ts:648) uses this weakest copy.

**Verifier note.** Two details in the claim are slightly off: (1) OpenAI proper is NOT a live path — adapters/providers/index.ts:19 deliberately does not register the OpenAI provider (needs a backend proxy for CORS); the live adapters that use this weakest extractor are OpenRouter and DeepSeek only. (2) The failing condition is precisely an even number of backslashes immediately before a real closing quote (simplest: a string ending in one literal backslash, encoded `\\"`); an odd run (a genuinely escaped quote `\"`) is handled correctly by the naive test, which is why the divergence is narrow. The bug also only manifests on the fallback path (direct JSON.parse must first fail, i.e. preamble/postamble around the JSON), reinforcing low severity.

**Fix.** Consolidate to a single exported balanced-JSON extractor (the gemini.ts state-machine version is the most correct) and have textUtils and OpenAIAdapter import it instead of each keeping a variant.

### ⚪ LOW 11. EPUB export worker is fully built but never instantiated; the heavy DOMParser-per-chapter + base64 + JSZip DEFLATE packaging runs synchronously on the main thread

- **File:** `workers/epub.worker.ts:1`
- **Lens:** Performance & bundle · **verifier confidence:** 0.9 · _(finder said medium, verifier adjusted to low)_

**Evidence.** workers/epub.worker.ts is a complete worker (defines `EpubJob`, `EpubProgress`, `SerializedSnapshot`, orchestrates a background export pipeline) but is never spawned — grep for `new Worker(` and `?worker` across the whole repo (excluding node_modules/dist/archive) returns ZERO hits. The actual export path runs on the main thread: store/slices/exportSlice.ts:268 `exportEpub` → services/epubService.ts:148 `generateEpub3WithJSZip`. Inside services/epubService/packagers/epubPackager.ts the packager loops every chapter synchronously (lines 171-215): `new DOMParser().parseFromString(...)` per chapter, `querySelectorAll('img[src^="data:image"]')`, then `base64Data.replace(/\s/g,'')` over each full base64 image string, before `zip.file(path, base64, {base64:true})` and `zip.generateAsync({type:'arraybuffer'})` (line 315, default DEFLATE). For a large illustrated novel this blocks the UI thread for the whole extract/compress pass. The docs (docs/architecture/ARCHITECTURE.md:21) still claim workers "offload heavy tasks," but the offload was never wired up.

**Verifier note.** JSZip's default compression is STORE, not DEFLATE (verified in node_modules/jszip/lib/object.js:321 `compression:\"STORE\"` and defaults.js `exports.compression=null`); the packager only passes {compression:'STORE'} on the mimetype entry and never requests DEFLATE, so the EPUB is generated uncompressed — the 'heavy DEFLATE compress pass' is overstated and the real main-thread cost is DOM parsing + base64 handling, not compression. Also the packager does TWO DOMParser-per-chapter passes (image-extraction loop l171-215 plus XML-validation loop l280-296), not one, so the DOM work is heavier than the claim states. Call chain is exportEpub -> generateEpub (exportSlice l566) -> generateEpub3WithJSZip (epubService l148), not a direct call.

**Fix.** Either delete the dead workers/epub.worker.ts or actually wire it up via a `?worker` import so packaging runs off the main thread; at minimum move the DOMParser/base64 extraction and JSZip generateAsync into the worker so exports don't freeze the reader.

### ⚪ LOW 12. Published board and the auditable 'View'/compare artifact disagree on which phases count for a model

- **File:** `scripts/sutta-studio/publish-compare.ts:96`
- **Lens:** Benchmark aggregation & publication · **verifier confidence:** 0.9 · _(finder said medium, verifier adjusted to low)_

**Evidence.** publish-compare includes any phase that has a golden + a model anatomist pass — `buildPhase` returns non-null whenever `ga?.words?.length && oa` (96) and is emitted per pipeline-*.json (191-198) — whereas the ranked mean only counts phases that reached a COMPLETE scored pipeline. So the two published artifacts describe different phase sets for the same model. VERIFIED: public/benchmarks/compare/qwen3-235b.json contains 30 phases including phase-ab (scores {segF1:0, contentF1:0, overall:null}), while the leaderboard entry for qwen3-235b reports `phasesCount: 29` and averages phase-ab's 0 out of existence. A reader auditing the side-by-side 'View' (30 phases, one clearly scored 0) cannot reconcile it with the ranked number (29 phases), and the 0 they see in the View is not in the mean that ranked the model.

**Verifier note.** Nuances: (1) phase-ab's `overall` is null (renders "—"), not 0; only segF1 and contentF1 render as 0 — but the claim's own stated scores {segF1:0,contentF1:0,overall:null} are exactly correct. (2) phase-ab is entirely absent from quality-scores.json (the scoring source), so it was never averaged in — not "averaged out of existence." (3) The 29-vs-30 contradiction is at the published-JSON level; the leaderboard UI table shows no per-model phase-count column and its board-level coverageNote says "30" (board max), which coincidentally matches the View's "30", so a UI-only reader may not see a numeric clash. The concrete defect is that the audit View displays an aborted/ungraded phase (lexicographer aborted) as a graded phase scored 0, diverging from the ranked phase set. Severity adjusted medium→low: no ranking is materially affected (a null-overall phase cannot enter the mean) and impact is confined to the peripheral sutta-studio benchmark subsystem.

**Fix.** Make publish-compare emit only the phases that entered the ranked mean (read the same quality-scores.json phase set the leaderboard uses), or explicitly tag phases shown-but-unranked so the View and board phase counts reconcile.

### ⚪ LOW 13. Same-novel 'total cost' is computed two contradictory ways inside exportService (all-versions vs active-only), plus a third way in apiMetrics — no single source of truth for dollars

- **File:** `services/exportService.ts:471`
- **Lens:** Cost/budget accounting · **verifier confidence:** 0.88 · _(finder said medium, verifier adjusted to low)_

**Evidence.** Line 471 sums cost over EVERY translation of each chapter:
  for (const translation of ch.translations) { totalCost += translation.estimatedCost || 0; }
but line 791 (a different exported stats function) sums only the active version:
  const activeVersion = versions.find(v => v.isActive) || versions[0];
  totalCost += activeVersion.estimatedCost || 0;
So two functions in the same service report different 'total cost' for the same novel. A third ledger, apiMetricsService.recordMetric (apiType:'translation', costUsd computed via the same calculateCost in adapters/providers/OpenAIAdapter.ts:685), aggregates EVERY successful call across all versions/chunks (getLifetimeSummary), which matches line 471's all-versions notion but NOT budgetOps' active-only notion. There is no shared definition of 'money spent translating this novel', so exports, lifetime totals, and the budget gate can each show a materially different dollar figure for the identical spend.

**Verifier note.** The claim is correct and actually understates the fragmentation: there are FOUR cost definitions, not three. (1) exportService.generateMetadataFile L471 = all-versions; (2) exportService.calculateSessionStats L791 = active-only; (3) services/db/operations/budgetOps.ts:26 getNovelTranslationCost = active-only per-novel — and this one is a LIVE budget-enforcement gate (translationsSlice.ts:281, chaptersSlice.ts:1036) that halts translation when spent>=preloadBudget; (4) apiMetricsService.getLifetimeSummary = every recorded successful call's costUsd. Two nuances that lower real impact: (a) apiMetrics' getLifetimeSummary is a GLOBAL/lifetime total across ALL novels, not a per-novel figure, so it is not strictly a same-novel comparison — it just embodies a different 'cost' definition; (b) the primary confirmed discrepancy (#1 vs #2 writing the same NovelEntry totalCost field) is a published/community-facing reporting stat, not a correctness or financial-control path — hence low, not medium. The one genuinely money-relevant angle is that the budget gate (#3, active-only) undercounts actual spend vs apiMetrics (#4, all calls) when chapters are re-translated, so a user could exceed their set budget; but that gate is a soft warning that stops preload, and in the typical preload-budget flow chapters have a single version so the divergence is bounded. Net: real 'no single source of truth for dollars' defect, confirmed, but low severity.

**Fix.** Define one canonical per-novel cost function (sum all versions, or derive from the api_metrics ledger) and have exportService, the budget gate, and any UI totals all call it.

### ⚪ LOW 14. STRUCTURED OUTPUT SUMMARY reports 'Illustration markers: 0' for every prior chapter, teaching the model that prior chapters had no illustrations and suppressing illustration output

- **File:** `services/prompts.ts:50`
- **Lens:** Prompt-context assembly · **verifier confidence:** 0.86 · _(finder said medium, verifier adjusted to low)_

**Evidence.** formatHistory computes illuCount at L26 and emits it at L50 under the '== STRUCTURED OUTPUT SUMMARY ==' block (L48) that summarizes each previous chapter's output shape for the model to imitate. Because the count is always 0 (the marker-match regex never matches -- known double-escaped-regex bug, not re-reported here), the summary asserts 'Illustration markers: 0' for EVERY previous chapter regardless of how many [ILLUSTRATION-N] markers those chapters actually contain. This is the downstream teaching consequence the lens asked to surface: the per-chapter context summary systematically tells the model prior installments produced zero illustrations, biasing it against emitting illustration markers and quietly undercutting the app's image-generation feature -- an effect invisible except by inspecting generated illustration frequency.

**Fix.** Fix the marker count so the summary reflects the real number of [ILLUSTRATION-N] markers in the previous translated content (single-escaped regex /\[ILLUSTRATION-\d+\]/g), so the context truthfully models the expected output pattern.

### ⚪ LOW 15. The services/epub/ worker pipeline injects unsanitized, XML-invalid chapter content where the production exporter sanitizes and strict-serializes — and its own repair step manufactures the invalid XML

- **File:** `services/epub/contentBuilder.ts:217`
- **Lens:** Behaviorally divergent duplicate pathways · **verifier confidence:** 0.85 · _(finder said medium, verifier adjusted to low)_

**Evidence.** The two exportEpub implementations diverge on sanitization. Production (store/slices/exportSlice.ts:509 -> services/epubService.ts:121 `xhtml: buildChapterXhtml(chapter)`) runs `sanitizeHtmlAllowlist(withPlaceholders)` (epubService/generators/chapter.ts:124) and serializes via `htmlFragmentToXhtml(toStrictXhtml(root.innerHTML))` (:218) with void-element self-closing enforcement (sanitizers/xhtmlSanitizer.ts:149-151). The worker pipeline's builder pastes body content RAW into an application/xhtml+xml template: contentBuilder.ts:216-218 `<div class="chapter-body">\n      ${content}\n    </div>` — only the title/footnotes are escaped (:211, :215), never the body. Worse, its dataCollector first applies HtmlRepairService (dataCollector.ts:99), whose `normalize-hr` rule (translate/HtmlRepairService.ts:60-62 `pattern: /<hr\s*\/?>|<\s*hr\s*>/gi, replacement: '<hr>'`) rewrites XML-valid `<hr />` into XML-invalid `<hr>` — so any chapter with a scene break, `<br>`, unclosed tag, bare `&`, or an LLM-emitted `<script>` yields a chapter file strict EPUB readers reject (production's strict re-serialization is exactly what makes the same repair safe on the live path). The pipeline also ignores the user's selected image version: assetResolver.ts:49 `const version = imageRef.cacheKey.version ?? 1;` vs production exportSlice.ts:384-386 `activeImageVersion[versionKey] || imageVersions[versionKey] || 1`. Reachability: only workers/epub.worker.ts:53 imports it, and no `new Worker`/`?worker` instantiation exists anywhere in the repo — dead today, but it is the tested (tests/epub/*), documented 'typed pipeline' replacement, so wiring the worker as designed silently ships unsanitized, reader-rejected EPUBs with wrong image versions.

**Verifier note.** Minor phrasing fix: contentBuilder.ts is directly imported by services/epub/exportService.ts:10 (and by tests/epub/*), and the worker imports exportService at epub.worker.ts:53 — so it is one hop, not a direct worker import of contentBuilder. Two strengthening facts the claim omits: (a) a fully-featured sanitizer (sanitizeHtmlAllowlist/htmlFragmentToXhtml) already exists in the SAME directory at services/epub/XhtmlSerializer.ts but contentBuilder never imports it, so the fix is trivial; (b) packageBuilder.ts performs NO XHTML well-formedness validation (only counts chapters/manifest items) and writes chapter.content verbatim, confirming the invalid XHTML would be silently shipped rather than caught. Severity reduced medium->low because the worker is dead (never instantiated anywhere) and the duplication itself is a previously-known finding; the divergence is a valid latent defect to fix before ever wiring the worker.

**Fix.** Before anyone spawns the worker, route contentBuilder output through the same sanitizeHtmlAllowlist + strict-XHTML serialization used by epubService/generators/chapter.ts and thread activeImageVersion into the snapshot — or delete workers/epub.worker.ts and services/epub/ to close the trap.

### ⚪ LOW 16. Preload worker is a floating async promise (setTimeout, no catch) — a rejected DB/import call becomes an unhandled rejection that silently kills the preload chain

- **File:** `store/slices/chaptersSlice.ts:1055`
- **Lens:** Async / error-handling topology · **verifier confidence:** 0.85

**Evidence.** `preloadNextChapters` defines `const worker = async () => { ... }` and launches it with `setTimeout(worker, 1500);` (line 1055). The returned promise is neither awaited nor `.catch`'d, and the worker body has no top-level try/catch — only a narrow try around the web-fetch (lines 943-996). Several awaited calls outside that try can reject: `await ChapterOps.findByNumber(...)` (919), `await loadChapterFromIDB(...)` (925), `await import('../../services/db/operations/budgetOps')` + `getNovelTranslationCost` (1035-1036), `await fetchTranslationVersions(...)` (1006). Any of these rejecting throws out of the async worker into nothing — an unhandled promise rejection that aborts the remaining look-ahead iterations with no user-visible signal (preloads just silently stop).

**Fix.** Wrap the worker invocation (or its whole body) in a try/catch that logs and exits cleanly, e.g. `setTimeout(() => { worker().catch(err => debugWarn('worker','summary','[Worker] preload aborted', err)); }, 1500);`

### ⚪ LOW 17. Runtime value-import cycle in db/operations barrel: sessionExport imports DiffOps back from the barrel that re-exports it one line later

- **File:** `services/db/operations/sessionExport.ts:3`
- **Lens:** Import graph & dead code · **verifier confidence:** 0.8 · _(finder said medium, verifier adjusted to low)_

**Evidence.** This is the only value (non-type) import cycle in store+services. services/db/operations/index.ts is a barrel that at line 28 does `export { SessionExportOps } from './sessionExport';` and at line 29 does `export { DiffOps } from './diffResults';`. But services/db/operations/sessionExport.ts:3-10 imports value bindings straight back from the barrel: `import { ChapterOps, FeedbackOps, SettingsOps, TemplatesOps, TranslationOps, MappingsOps, DiffOps } from './index';`. When index.ts evaluates line 28 it begins evaluating sessionExport.ts, whose top-level import of `DiffOps` from './index' resolves against a barrel that has NOT yet reached its line-29 `DiffOps` re-export — i.e. DiffOps is in the temporal dead zone at that instant. It only avoids a crash because every use is inside a closure (e.g. sessionExport.ts:31 `getAllDiffResults: () => DiffOps.getAll()`), so ES live bindings are resolved lazily at call time. Any future refactor that touches DiffOps/these ops at module-init top-level (or a bundler that reorders/hoists) turns this latent cycle into an `undefined is not an object` at load.

**Verifier note.** The claim's causal phrasing ("barrel has not yet reached its line-29 DiffOps re-export") is imprecise: indirect `export {X} from './y'` bindings are wired up during ESM linking BEFORE any evaluation, so the re-export binding already exists. The actual reason DiffOps is in TDZ when sessionExport.ts's body runs is that diffResults.ts's module body has not executed yet (its evaluation is triggered by index.ts line 29, which comes after line 28's sessionExport) — same net effect. Also, only DiffOps is at risk; the other six ops (ChapterOps/FeedbackOps/SettingsOps/TemplatesOps/TranslationOps/MappingsOps) come from modules evaluated at index.ts lines 2-7, before sessionExport, so they are already initialized. Import span is lines 3-11, not 3-10.

**Fix.** Import each Ops object from its concrete module (`import { DiffOps } from './diffResults'`, `import { ChapterOps } from './chapters'`, etc.) instead of from the './index' barrel, breaking the barrel<->member cycle.

### ⚪ LOW 18. Five new dead files with real implementations and zero importers (liturgy UI, settings tabs, two hooks)

- **File:** `components/settings/SettingsTabs.tsx:14`
- **Lens:** Import graph & dead code · **verifier confidence:** 0.8

**Evidence.** Basename grep across the whole repo (imports, `from`, `lazy(`, `require(`, `new URL`, barrels, and tests) returns zero references for each of these substantial, non-stub files: components/settings/SettingsTabs.tsx (36 LOC, exports a real `SettingsTabs` React.FC at line 14 — settings tabs are evidently rendered by other means), components/liturgy/PaliLine.tsx (118 LOC React component), components/liturgy/CitationChip.tsx (45 LOC), components/sutta-studio/hooks/usePhaseNavigation.ts (96 LOC hook), and hooks/usePersistentState.ts (62 LOC hook). These are distinct from the three already-known dead files (interfaceIdea.tsx, config/novelCatalog.ts, components/AudioControls.tsx). Verified not dynamically loaded: no `import(`/`lazy(` line anywhere contains these basenames, and no barrel `export ... from` re-exports them (a `from './PaliLine'` re-export would contain the basename and was searched — 0 hits).

**Verifier note.** Four (not five) files are true zero-importer dead code: components/settings/SettingsTabs.tsx, components/liturgy/PaliLine.tsx (a duplicate of a live inline PaliLine in TripleScriptWitness.tsx), components/liturgy/CitationChip.tsx, and components/sutta-studio/hooks/usePhaseNavigation.ts. The fifth, hooks/usePersistentState.ts, is NOT importer-free — it is imported by tests/hooks/usePersistentState.test.tsx and documented in TEST_MANIFEST.md; it is test-only code (no production consumer), not a zero-importer dead file, which contradicts the claim's stated evidence that the tests search returned zero references. The files are also not recently created ("new" means newly-surfaced in this audit, not new in git history).

**Fix.** Delete the five files (or, for PaliLine/CitationChip, wire them into the liturgy render path if they were intended to ship); confirm by checking `git log` that no in-flight branch depends on them first.

### ⚪ LOW 19. Chapter-number arithmetic selection: duplicate chapterNumbers duplicate one prior chapter and drop another (and short-circuit DB hydration); non-integer numbers empty context

- **File:** `services/translationService.ts:620`
- **Lens:** Prompt-context assembly · **verifier confidence:** 0.8 · _(finder said medium, verifier adjusted to low)_

**Evidence.** collectMemoryHistoryCandidates builds targetNumbers = currentNumber-1..currentNumber-contextDepth (L610-614) and pushes EVERY map entry whose chapterNumber is in that set (L620-623) with no de-duplication by number. If two chapters share a chapterNumber (re-import/re-scrape producing two stableIds for one logical chapter -- a case the diagnostics themselves acknowledge, L555), candidates can be e.g. [8,9,10,10]; buildTranslationHistory then does `candidates.slice(-contextDepth)` (L660) -> [9,10,10], DROPPING chapter 8 and DUPLICATING 10 in the prompt. In the async path this also short-circuits: memoryHistory=[9,10,10], and `if (memoryHistory.length >= contextDepth) return memoryHistory` (L687) means chapter 8 is never hydrated from IDB. Separately, selection uses strict numeric equality (`targetNumbers.includes(num)`) on currentNumber - i, so a non-integer chapterNumber (e.g. a 10.5 side-story: targets become 9.5, 8.5, ...) matches no integer neighbor and yields EMPTY context even when adjacent translated chapters exist -- the L469 diagnostic guard only catches missing/<=0 numbers, not decimals or gaps.

**Verifier note.** Minor imprecision in the async framing: in the duplicate-number scenario, chapter 8 is already present in memory (it is in candidates) and is dropped by slice(-contextDepth), not lost to a missing-from-IDB gap — the early return at L687 short-circuits hydration, but hydration would not have recovered chapter 8 anyway since it was never missing. The accurate net defect is: the unbounded duplicate consumes a context slot, so slice() evicts a legitimately-needed adjacent chapter and the prompt receives a duplicated one. Line numbers are ~correct (async guard is L687 in the described block).

**Fix.** Resolve prior chapters by sorted numeric distance with de-duplication per chapter number (and fall back to prevUrl-order for non-integer/gapped numbering) instead of exact `currentNumber - i` integer matching.

### ⚪ LOW 20. Stale duplicate scripts/generate-steering-image-list.js lacks the missing-dir guard the live .cjs has

- **File:** `scripts/generate-steering-image-list.js:9`
- **Lens:** Config, scripts & docs drift · **verifier confidence:** 0.7

**Evidence.** package.json's `prepare` runs `scripts/generate-steering-image-list.cjs`; nothing references the `.js` sibling (grep across json/md/sh/cjs/js shows only the .cjs is wired up). The `.cjs` guards the read with `if (!fs.existsSync(steeringDir)) { ...write '[]'... process.exit(0); }` — a guard the WORKLOG says was added specifically to 'unblock Vercel builds' when `public/steering/` is absent. The stale `.js` (line 9) calls `fs.readdirSync(steeringDir)` with NO such guard, so it is the pre-fix buggy copy. It is dead today, but is a footgun: re-pointing `prepare` at it would reintroduce the build failure on a checkout without public/steering/.

**Verifier note.** The footgun rationale is mischaracterized. (1) The .js already handles a missing public/steering via its own try/catch: readdirSync throws ENOENT, the catch writes '[]', and the process exits 0 (verified empirically) — it prints a console.error but does not fail the build. So re-pointing `prepare` at it would NOT reintroduce a missing-dir build failure. (2) The actual reason the .js is dead/broken is that package.json declares `"type": "module"` while the .js uses CommonJS `require()`, so `node scripts/generate-steering-image-list.js` throws `ReferenceError: require is not defined in ES module scope` (exit code 1) on EVERY run regardless of whether public/steering exists — which is exactly why the wired-up script uses the .cjs extension. Net: this is an inert, unreferenced stale duplicate (the pre-guard copy) that would fail loudly and immediately if ever wired up, not a silent trap. Valid low-severity dead-code cleanup, but not the described build-failure footgun.

**Fix.** Delete scripts/generate-steering-image-list.js (single source of truth is the .cjs).

### ⚪ LOW 21. 'Latest' run selection picks the max-timestamp directory with no completion/status guard → an in-progress or errored run can be surfaced as canonical

- **File:** `scripts/sutta-studio/benchmark.ts:353`
- **Lens:** Benchmark aggregation & publication · **verifier confidence:** 0.6

**Evidence.** buildBenchIndex sets `latestTimestamp` purely by string order (`if (!latestTimestamp || timestamp > latestTimestamp) latestTimestamp = timestamp`, 353) over every directory matching a date prefix, with no check that the run's progress.json is `status: complete`; run-scoring.ts:findLatestBenchmarkRun does the same (`entries.filter(...startsWith('2026-')).sort().reverse()` then takes `runDirs[0]`, 54-67). A run that is still writing outputs (or ended in `status: error`) is the newest dir and is therefore selected as 'latest' for index.json and for ad-hoc scoring, so partial/aborted outputs can be presented as the current results. The published leaderboard is protected by explicit LEADERBOARD_DIRS pinning, but the in-app index and the scoring CLI are not.

**Verifier note.** The 'no completion guard' observation is real, but the harm is narrower than 'surfaced as canonical for index.json': BenchIndexPayload.latestTimestamp is never consumed anywhere (dead metadata) — the app renders all entries and lets the user filter, and the canonical leaderboard is separately pinned by LEADERBOARD_DIRS. Also note writeBenchIndex runs mid-run (benchmark.ts:1166,1366), so an in-progress run trivially becomes latestTimestamp within a single run. The one genuinely-used unguarded selector is run-scoring.ts findLatestBenchmarkRun (an ad-hoc dev scoring CLI), which could score a partial run's subset; loadBenchmarkOutputs skips files lacking all four passes, so an errored run yields fewer/zero outputs rather than corrupt scores.

**Fix.** Filter run directories to those whose progress.json/active-run pointer reports `status: complete` before choosing the latest, so partial or errored runs are never selected as canonical.

### ⚪ LOW 22. Comment in compiler/prompts.ts declares the LIVE production skeleton module 'dead' and schedules its deletion — the swap-in replacement has already drifted behaviorally

- **File:** `services/compiler/prompts.ts:6`
- **Lens:** Behaviorally divergent duplicate pathways · **verifier confidence:** 0.55 · _(finder said medium, verifier adjusted to low)_

**Evidence.** services/compiler/prompts.ts:5-6 says the shim exists 'for backward-compat with services/compiler/index.ts (and the dead services/compiler/skeleton.ts)' and :9-10 'Phase 4 cleanup will delete this shim'. But services/compiler/index.ts:64 `import { runSkeletonPass } from './skeleton';` — that 'dead' module IS the skeleton pass every production compile runs (UI -> suttaStudioCompiler.ts -> compiler/index.ts:273 `phaseSkeleton = await runSkeletonPass({...})`). The natural Phase-4 move — delete compiler/skeleton.ts and switch index.ts to the canonical services/sutta-studio/passes/skeleton.ts — silently changes production behavior because the twins have drifted: token budget 4000 (compiler/skeleton.ts:70) vs 16000 (passes/skeleton.ts:69), return type SkeletonPhase[] with console-only silent fallback (compiler/skeleton.ts:127-129) vs SkeletonRunResult carrying per-chunk `fallbackUsed`/`error` diagnostics (passes/skeleton.ts:171-181), and no `onChunkProgress`/`throttle` hooks in the passes copy (compiler copy: :36-38) so UI progress and rate-limiting would be dropped in a naive swap.

**Verifier note.** The core verifiable defect is narrower than claimed: prompts.ts:6 imprecisely labels a live, still-referenced module (compiler/skeleton.ts, used by the production compile at index.ts:64/:273) as "dead." But (a) prompts.ts:9-10 "will delete this shim" schedules deletion of prompts.ts itself, not skeleton.ts — skeleton.ts's deletion is in CONSOLIDATION.md Phase 4 (line 14/254), not prompts.ts; (b) the compiler/skeleton.ts vs passes/skeleton.ts drift (4000 vs 16000 tokens, SkeletonPhase[] vs SkeletonRunResult, missing throttle/onChunkProgress) is already an explicitly documented, mitigated known risk in CONSOLIDATION.md lines 154/221/279 — not a hidden trap; (c) a naive swap would be a compile-time type error and a naive delete a module-not-found error, i.e. loud, not a "silent" production behavior change. Overlaps the known "services/compiler shims" prior finding.

**Fix.** Fix the comment to say compiler/skeleton.ts is live, then converge index.ts onto passes/skeleton.ts deliberately — passing production's explicit maxTokens/throttle/progress and consuming the chunk diagnostics — before any Phase-4 deletion.

### ⚪ LOW 23. Translation version allocation spans three separate transactions: concurrent stores collide on the unique version index and a crash mid-sequence leaves no active version

- **File:** `services/db/repositories/TranslationRepository.ts:192`
- **Lens:** IndexedDB persistence / silent data loss · **verifier confidence:** 0.55 · _(finder said high, verifier adjusted to low)_

**Evidence.** storeTranslation runs read-compute-write across independent transactions: `const existing = await this.fetchTranslationsByUrl(chapterUrl)` (line 180, readonly txn) → `const nextVersion = existing.reduce((max, record) => Math.max(max, record.version || 0), 0) + 1` (line 192) → `await this.deactivateTranslations(existing)` (line 194, second readwrite txn) → `await this.writeTranslation(newRecord)` (line 224, third readwrite txn). Two concurrent stores for the same chapter (e.g. a background/preload translation racing a user retranslate, or two imported translations racing) both compute the same nextVersion; the second put violates the unique 'chapterUrl_version' index (connection.ts:250) and that translation is rejected — and the caller's catch (translationsSlice.ts:1008) only console.warns, so the result the user just read on screen is silently absent from the DB. Separately, if the page unloads between deactivateTranslations and writeTranslation, ALL versions are left isActive=false with the new one never written — getTranslation falls back to `versions[0]` (line 255) so the highest version silently becomes active regardless of the user's prior selection.

**Verifier note.** The code IS non-atomic across three transactions as claimed, but severity is low, not high. No path in the repo produces concurrent same-chapter version allocation: preload is for different chapters (no key collision), same-chapter retranslate is single-flight-guarded and LLM-latency-separated, and the import path is sequential (importService.ts:674 for...await) — the 'two imported translations racing' and 'preload racing retranslate' triggers do not hold. The cited catch at translationsSlice.ts:1008 is the footnote/illustration persist path, which updates existing records in place (has id) rather than allocating a new version. The crash-mid-sequence case does not leave the app with 'no active version' in practice: getTranslation deterministically falls back to versions[0] (highest version), so it degrades gracefully to a possible change of which version appears active rather than data loss.

**Fix.** Perform read-version/deactivate/insert inside one readwrite transaction on the translations store (cursor over index('chapterUrl') to deactivate and compute max version, then put the new record before the transaction commits).

---

## Refuted (dropped after verification)

These were proposed by a finder but a verifier refuted them — recorded so they don't get re-raised:

- Entire services/epub/ pipeline + epub.worker.ts are unreachable dead code; a second, live EPUB path is used instead (workers/epub.worker.ts): Every technical assertion is independently verified and reproducible: (1) workers/epub.worker.ts is a never-constructed Web Worker — a full repo sweep for new Worker / new SharedWorker / ?worker / Wor
- IDB history fallback selects the HIGHEST version number, not the active version, when no active translation flag is set -- can inject a stale/rejected translation into context (services/translationService.ts): The claim's core mechanism — a warm/cold divergence where cold IDB context feeds the highest version while warm memory uses the active version — does not exist. (1) The warm-memory `chapter.translatio
- costUsd `|| null` reports a genuinely-free ($0) model as 'unknown cost', corrupting the 'expensive≠better' comparison the board exists for (scripts/sutta-studio/generate-leaderboard.ts): Line 282 does literally contain `... reduce(...,0) || null`, so a summed cost of exactly 0 collapses to null in leaderboard.json — that part of the claim is accurate. However, the claimed impact is re

## Lenses run (13)

`divergent-duplicates`, `state-concurrency`, `data-integrity`, `dependency-graph`, `security-deep`, `async-topology`, `test-honesty`, `config-docs-drift`, `copy-paste-drift`, `perf-resource`, `money-accounting-correctness`, `prompt-context-assembly-correctness`, `benchmark-aggregation-and-publication-correctness`

_Audit token spend ≈ 5.4M across 72 agents. Findings are read-verified against the working tree at audit time; line numbers may shift as the tree changes._

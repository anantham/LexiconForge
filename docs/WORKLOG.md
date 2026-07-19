### [2026-07-16 10:52 IST] [Agent: Codex]
**Status:** Complete; draft PR open
**Task:** Prevent API credentials from surviving full-session export.
**PR:** https://github.com/anantham/LexiconForge/pull/115
**Root cause:** The modern exporter used a case-sensitive `startsWith('apiKey')` predicate, which missed `deeplApiKey` and `googleTranslateApiKey`. Investigation also found that the IndexedDB-unavailable memory fallback exported the entire settings object without any credential redaction.
**Hypothesis results:** H1 confirmed by a red integration test leaking `deeplApiKey`; H2 confirmed after all eight current credential fields were removed while `fontSize` survived; duplicate-path audit added H3 and confirmed the memory fallback leak with a second red test.
**Files modified (line numbers + why):**
- `services/db/exportSettings.ts:1-9` - add one shared, case-insensitive credential-redaction boundary for every setting name containing `apiKey`.
- `services/db/operations/export.ts:12-14,42-64,286` - type settings as `AppSettings` and route the modern full-session exporter through the shared boundary.
- `services/db/index.ts:36,619` - route the production memory fallback through the same boundary.
- `types.ts:400-406,445-449` - derive exported settings by removing every credential-shaped `AppSettings` key, keeping the type contract aligned with runtime behavior.
- `tests/current-system/export-import.test.ts:64-119` - regression coverage for all eight current keys in both modern and memory export paths while proving ordinary settings survive.
- `docs/roadmaps/TECH-DEBT-INBOX.md` - `[DEBT][TEST]` receipt for Node 26 local-storage incompatibility discovered during full-suite validation.
**Verification:**
- Red before green: modern path failed on `deeplApiKey`; memory path failed on `apiKeyGemini` before their respective fixes.
- Export-related suites: 4 files, 22 tests passed.
- Production build passed.
- TypeScript reports the existing 17 baseline diagnostics documented by recent work; none name a touched file.
- Full Vitest under local Node 26: 217 files passed, 1 skipped, 11 failed; 8,709 tests passed / 355 skipped / 115 failed. Every failure family was rooted in unavailable `localStorage`, and a representative failure reproduced on untouched `main`. CI uses Node 20, so the PR gate remains authoritative.
**ADR:** None. This restores the existing privacy-first contract and does not introduce a new architectural decision.

### [2026-07-16 10:44 IST] [Agent: Codex]
**Status:** Starting
**Task:** Prevent API credentials from surviving full-session export.
**Worktree:** `/Users/aditya/Documents/Ongoing Local/LexiconForge.worktrees/codex-session-export-secrets`
**Branch:** `fix/codex-session-export-secrets`
**Issue:** `exportFullSessionToJson()` removes only setting names that start with `apiKey`, so `deeplApiKey` and `googleTranslateApiKey` are currently written into exported JSON despite the privacy-first contract that keys stay on-device.
**Files likely affected:** `services/db/operations/export.ts`; `types.ts`; `tests/current-system/export-import.test.ts`; `docs/WORKLOG.md`.
**Hypotheses:**
- H1 (0.99): an integration test storing all current credential fields will show only the suffix-named DeepL and Google Translate keys leaking on current `main`.
- H2 (0.95): treating any setting name containing `apiKey`, case-insensitively, as sensitive will redact all current credential fields without removing ordinary settings.
**Predicted test outcome:** the new regression fails before the production change because two secrets remain, then passes after the redaction predicate and exported-settings type are aligned; the existing export/import suite remains green.
**Fallback:** if credential naming cannot be represented safely by the naming predicate, replace it with an explicit typed sensitive-key registry and fail a coverage test whenever `AppSettings` gains a credential-shaped field outside that registry.

### [2026-07-13 06:57 IST] [Agent: Codex]
**Status:** Complete
**Task:** Rebase the durable transaction kernel onto current `main` after overnight P0.1 overlap.
**Progress:** Current `main` independently landed commit-waiting and operation-abort behavior in `txn.ts` and `TranslationRepository`, superseding focused PR #106. The kernel branch now targets `main` directly. Conflicts were resolved in favor of the shared terminal-event kernel because main's inline implementation still rejected from pre-terminal `transaction.onerror` and duplicated repository lifecycles. Main's new fake-indexeddb durability test was retained and passes against the kernel.
**Files affected:**
- `services/db/core/txn.ts` - retain the small connection/retry facade over `runTransaction`.
- `services/db/repositories/TranslationRepository.ts` - retain shared-kernel delegation instead of main's repeated direct wrappers.
- `services/db/core/txn.durability.test.ts` - retain main's real fake-indexeddb commit/rollback coverage.
**Verification:** 24 focused transaction/repository tests, 55 DB tests, and the full 8,790-test Vitest suite passed after conflict resolution; `tsc --noEmit` remains blocked only by the unchanged repository baseline errors.
**Next:** publish the replacement PR against `main`, then close #106 as superseded.

### [2026-07-12 08:50 IST] [Agent: Codex]
**Status:** Complete
**Task:** Durable IndexedDB transaction kernel, stacked on PR #106.
**Progress:** Added an injected-database transaction state machine that waits for terminal commit/abort events, captures but does not settle on pre-terminal `error`, aborts scheduled writes when an operation fails, and preserves the operation error through the resulting abort. `withTxn()` now owns only connection/retry policy, and `TranslationRepository` delegates its write/deactivate/delete paths to the same kernel instead of maintaining a second lifecycle implementation.
**Files modified (line numbers + why):**
- `services/db/core/transactionKernel.ts:1-153` - canonical transaction lifecycle and event-ordering state machine.
- `services/db/core/txn.ts:8-55` - public re-export plus connection/retry facade; existing request and batch helpers retained.
- `services/db/repositories/TranslationRepository.ts:3,125-165,365-370` - remove local commit helper and use the shared kernel for durable writes.
- `tests/services/db/txn.test.ts:13-172` - cover operation-first/commit-first ordering, pre-terminal error, abort, and typed error preservation.
- `tests/services/db/TranslationRepository.durability.test.ts:13-165` - cover commit waits, quota abort, request-triggered abort, and multi-put durability.
- `docs/adr/DB-002-atomic-transaction-boundaries.md:8-27` - record the corrected implementation contract and migration sequence.
**Refactoring metrics:**
- Lifecycle implementations: 2 -> 1; `withTxn()` delegates and `awaitTransactionCommit()` is removed.
- File size: `txn.ts` 214 -> 163 LOC; `TranslationRepository.ts` 430 -> 400 LOC; new focused kernel 153 LOC. Total production LOC 644 -> 716 (+11.2%) in exchange for explicit state/error handling and one reusable lifecycle.
- Cyclomatic proxy (TypeScript AST branch count including callbacks): `withTxn` 13 -> 2; new `runTransaction` 22; repository lifecycle helper removed. Complexity is concentrated in one tested state machine rather than duplicated across callers.
- Targeted coverage: statements 72.54% -> 74.75%, branches 52.10% -> 58.01%, functions 69.89% -> 78.88%, lines 77.82% -> 78.70%; new kernel lines 88.52%.
- Main production chunk: 4,146.22 -> 4,145.93 kB minified (-0.29 kB); gzip 992.89 -> 992.93 kB (+0.04 kB, effectively neutral).
- Type safety: no `any` added; repository interfaces unchanged. Runtime transaction count and IndexedDB I/O are unchanged.
**Tests:**
- Focused durability/repository tests: 19 passed.
- `tests/services/db`: 50 passed.
- Full Vitest suite: 8,785 passed, 356 skipped.
- Production build passed with the repository's existing chunk warnings.
- `git diff --check` passed.
- `npx tsc --noEmit --pretty false` reports only the pre-existing baseline errors; no changed file remains in the error list.
**Next:** migrate Settings, Feedback, Prompt Templates, and Chapter metadata in the next stacked PR after review of this kernel.

### [2026-07-12 08:40 IST] [Agent: Codex]
**Status:** Starting
**Task:** Durable IndexedDB transaction kernel, stacked on PR #106.
**Worktree:** `/private/tmp/LexiconForge.worktrees/codex-db-transaction-kernel`
**Branch:** `debt/codex-db-transaction-kernel`
**Files likely affected:**
- `services/db/core/transactionKernel.ts` and `services/db/core/txn.ts` - extract one injected-database transaction lifecycle that settles only on terminal commit/abort events while keeping the public facade small.
- `services/db/repositories/TranslationRepository.ts` - replace the repository-local lifecycle implementation with the shared kernel.
- `tests/services/db/txn.test.ts` and `tests/services/db/TranslationRepository.durability.test.ts` - cover event ordering, operation-triggered aborts, error precedence, and exactly-once settlement.
- `docs/adr/DB-002-atomic-transaction-boundaries.md` - append an implementation correction to the existing transaction-boundary decision.
- `docs/WORKLOG.md` - record hypothesis, verification, and final scope.
**Hypothesis:** A low-level runner that accepts an `IDBDatabase` can serve both `withTxn()` and injected repositories, eliminating divergent commit/error lifecycles without changing repository interfaces.
**Predicted tests:** success waits for both operation fulfillment and `oncomplete`; `onerror` alone does not settle; operation rejection calls `abort()` and survives the later `onabort`; commit-time quota aborts remain typed; repository writes retain commit durability.
**Confidence:** 0.92
**Fallback:** Keep the kernel internal to `txn.ts` and defer repository migration if callers prove dependent on raw DOMException error shapes.

### [2026-07-11 09:38 IST] [Agent: Codex]
**Status:** Complete
**Task:** Refresh PR #106 onto current `main` and clarify the reviewed durability scope.
**Progress:** Merged current `main` without force-pushing and reverified the transaction changes. This PR fixes the shared `withTxn` lifecycle and the named direct `TranslationRepository` write/deactivate/delete paths. It does not close the codebase-wide duplicate transaction-wrapper pattern: settings, feedback, prompt templates, chapter metadata, backup storage, and summary operations remain the explicit scope of the immediate durability-kernel consolidation.
**Tests:**
- `tests/services/db`: 46 passed.
- Full Vitest suite: 8,775 passed, 356 skipped.
- `git diff --check` passed.
- `npx tsc --noEmit --pretty false` remains blocked only by the pre-existing repo-wide errors in Sutta/liturgy/script files; no PR file appears in the error list.
**PR:** https://github.com/anantham/LexiconForge/pull/106

### [2026-07-08 19:15 IST] [Agent: Codex]
**Status:** Complete
**Task:** P0.1 IndexedDB transaction durability fix.
**Progress:** Changed shared DB transactions and translation repository direct write paths to resolve only after `transaction.oncomplete`, so request-level success no longer reports durable persistence. Added focused regression tests for pre-commit resolution and commit-time aborts. Flagged `TranslationRepository.ts` as an architecture hotspot because the durability fix touched a 405-line module with versioning, keyspace, and write concerns mixed together.
**Files modified (line numbers + why):**
- `services/db/core/txn.ts:31-48,67-80,83-94` — keep operation result pending until the enclosing transaction completes; map abort errors through DB error taxonomy so quota aborts are not swallowed as success.
- `services/db/repositories/TranslationRepository.ts:124-183,392-397` — wait for commit in `writeTranslation`, `deactivateTranslations`, and `deleteTranslationVersion` instead of resolving from request `onsuccess`.
- `tests/services/db/txn.test.ts:1-82` — regression coverage for shared transaction helper resolving after commit and rejecting commit-time quota aborts.
- `tests/services/db/TranslationRepository.durability.test.ts:1-139` — regression coverage for repository write/deactivate helpers waiting for commit.
- `docs/architecture/ARCHITECTURE.md:197` — hotspot registration for `TranslationRepository.ts`.
- `docs/WORKLOG.md` — start/end entries for this work.
**Tests:**
- `env NODE_OPTIONS=--localstorage-file=/private/tmp/codex-vitest-localstorage-single npx vitest run tests/services/db/txn.test.ts tests/services/db/TranslationRepository.durability.test.ts tests/services/db/TranslationRepository.test.ts --maxWorkers=1` ✅ 15 passed.
- `env NODE_OPTIONS=--localstorage-file=/private/tmp/codex-vitest-localstorage-db npx vitest run tests/services/db --maxWorkers=1` ✅ 46 passed.
- `npx tsc --noEmit` ⚠️ blocked by existing unrelated repo-wide errors in Sutta/liturgy/script files; no errors referenced the changed transaction files or new tests.
- `git diff --check` ✅

### [2026-07-08 19:07 IST] [Agent: Codex]
**Status:** Starting
**Task:** Fix IndexedDB transaction durability so write promises resolve after transaction commit, not request `onsuccess`.
**Worktree:** `/private/tmp/LexiconForge.worktrees/codex-txn-durability`
**Branch:** `fix/codex-txn-durability`
**Files likely affected:**
- `services/db/core/txn.ts`
- `services/db/repositories/TranslationRepository.ts`
- Targeted DB tests under `tests/`
**Notes:** Root checkout has unrelated dirty files (`package-lock.json`, `public/steering-images.json`) and untracked roadmap docs; this work is isolated in a separate worktree.
### [2026-07-15 17:09 IST] [Agent: Codex]
**Status:** Ready to publish
**Task:** Resume the approved README publication through local Git plus the connected GitHub app.
**Authentication finding:** The stale `gh` token is not a workflow blocker. `git ls-remote origin HEAD` succeeded through the repository's HTTPS/macOS-Keychain path, and the connected GitHub app exposes PR creation, inspection, and merge operations.
**Scope:** `README.md`; `docs/WORKLOG.md` only. The dirty root checkout remains untouched.
**Verification:** 20 relative README links checked with 0 missing; all five public interface/evaluation URLs returned HTTP 200; no em dashes remain in `README.md`; `git diff --check` passed.
**Upstream state:** `origin/main` is 9 commits ahead of the branch base. `README.md` is unchanged upstream; `docs/WORKLOG.md` has one upstream entry to preserve during rebase.

### [2026-07-13 13:18 IST] [Agent: Codex]
**Status:** Publishing
**Task:** Commit, push, review, and merge the approved README interface-hub rewrite.
**Recovery note:** The OS removed the uncommitted `/private/tmp` worktree between review turns. The exact approved patch was reconstructed in the persistent sibling worktree without touching the dirty root checkout.
**Worktree:** `/Users/aditya/Documents/Ongoing Local/LexiconForge.worktrees/codex-readme-interface-index`
**Branch:** `docs/codex-interface-index`
**Files in scope:** `README.md`; `docs/WORKLOG.md` only.
**Verification plan:** Re-run local link checks, public URL checks, em-dash check, and `git diff --check`; stage only the two scoped files; use the required PR and automated-review gate before merging.

### [2026-07-13 12:50 IST] [Agent: Codex]
**Status:** Complete
**Task:** Remove em dashes from the README draft and determine whether a canonical web-novel reader documentation folder already exists.
**Files modified (line numbers + why):**
- `README.md:3,50-54,60,97` — replace em-dash constructions with commas, colons, or complete sentences while preserving meaning.
- `docs/WORKLOG.md:10-17` — record the follow-up and the documentation-location finding.
**Finding:** No existing web-novel or reader-specific documentation directory was found. The old README has been condensed into the root README's collapsed Web Novel Reader section; it has not been moved wholesale. Creating a dedicated reader document remains a human-gated documentation-structure decision.
**Verification:** `rg -n "—" README.md` returns no matches. Application tests not run; documentation-only change.

### [2026-07-13 12:44 IST] [Agent: Codex]
**Status:** Complete
**Task:** Restructure the root README as a maturity-labelled hub for LexiconForge's distinct translation interfaces and shared inspectable-interoperation vision.
**Progress:** Replaced the web-novel-first product catalogue with a progressive project hub: separate public reader links, honest research-prototype statuses, language-specific interface rationale, an inspectability contract, model-as-interface-compiler evaluation framing, and a bounded catastrophic-risk coordination theory of impact. Preserved the web-novel product material in a collapsed section.
**Files modified (line numbers + why):**
- `README.md:1-159` — make the umbrella vision and interface choices visible before product detail; distinguish live, early-foundation, branch-only, and pipeline-only states; include the previously omitted Italian reader and Pinocchio pipeline; correct all moved documentation links.
- `docs/WORKLOG.md:19-40` — record the approved option, hypotheses, affected files, verification, and handoff state.
**Verification:**
- All 16 relative README targets resolve to files or directories in this worktree.
- All five public interface/evaluation URLs returned HTTP 200 on 2026-07-13.
- `git diff --check` passed.
- Branch evidence confirms Malayalam routes exist only on `feat/opus-malayalam-reader`; the local Calvino route and route-less, failing-gate Pinocchio artifact exist only on `feat/local-grounding-pipeline`.
- Application tests not run; documentation-only change with no runtime files modified.
**Outcome against prediction:** The first screenful now names the shared protocol and the public interfaces; later sections reveal design, evaluation, impact, limitations, and legacy web-novel detail progressively.

### [2026-07-13 12:38 IST] [Agent: Codex]
**Status:** Starting
**Task:** Restructure the root README as a maturity-labelled hub for LexiconForge's distinct translation interfaces and shared inspectable-interoperation vision.
**Worktree:** `/private/tmp/LexiconForge.worktrees/codex-readme-interface-index`
**Branch:** `docs/codex-interface-index`
**Files likely affected:** `README.md`; `docs/WORKLOG.md`.
**Hypotheses:**
- H1 (0.85): The current web-novel-first README hides the umbrella project's reader-and-evaluation architecture.
- H2 (0.90): A status-labelled interface index can expose Pāli, liturgy, Chinese, Malayalam, and Italian work without implying every prototype is deployed.
- H3 (0.80): Progressive disclosure can preserve useful web-novel product details without making them compete with the project thesis.
**Predicted outcome:** Readers should be able to identify the shared protocol, choose an interface, and distinguish live, partial, branch-only, and pipeline-only work from the first screenful.

### [2026-07-16] [Agent: Fable 5] — probe v1.1 retraction · PR review-and-merge sequence · tap test
**Status:** merged to main (tip 336a0ae). Operator ratifications for the v2.2 fleet run still pending.
- **Probe v1.1 + RETRACTION:** with morph rendered into the student material, ordering held (gemini-3-flash 0.738 edges grok 0.728) but v1.0's headline ('bad page worse than no page', baseline 49% retention) was substantially the PROBE RENDERER's omission of grammar fields — 84% with faithful rendering. Retracted in docs/benchmarks/probe-results-v1.1-2026-07-16.json; residual retention signal real (deepseek-v3.2 0.63). Lesson: the probe's material renderer is part of the instrument.
- **PR sequence (operator-directed):** #107/#108 closed superseded by 4f11a03 (verified line-level; additive slivers ported in 8ef2193 w/ user approval). #109 txn kernel MERGED after grok REVISE found 4 real commit/abort races (worst: committed-then-op-failed was RETRIED = double-commit; now non-retryable Constraint) — fixed on-branch, 4 regression tests, re-review GO. #110 migration MERGED (66/66 db tests; contract-change finding caller-grep-verified). Grok non-blocking notes parked: optional start-to-finish txn timeout; ChapterRepository cursor-fallback still raw request.error.
- **Repo cleanup:** 7 merged branches deleted, stale worktrees pruned, #113 worktree removed. Remaining: #114/#115 (live peer lane), 2 feature worktrees, ambient dirty pair, the 2026-07-07 tech-debt docs (uncommitted, author absent).
- **TAP TEST** (scripts/sutta-studio/tap-test.ts): interaction-level audit of the LIVE flagship vs the alignment golden — 144/160 links live, 0 words missing, **16 DEAD links** (quotative ti / sub-split particles never woven into English; weaver-layer fix queued with v2.2). Content column separates the variant confound (page English is pre-Sujato).
- Also: partition-aware surface matching had shipped earlier in this window (flagship 46 false flags → 0 after 4 more real corruption fixes); interface-integrity-findings doc's 'next session: partition-aware matching' note is now DONE.

### [2026-07-10 → 2026-07-11] [Agent: Fable 5] — suttabench construct + probe + baseline + dogfood arc
**Status:** All merged to main and deployed. A PARALLEL session was active simultaneously (its a4f4431 committed the coverage tripwire + MN117 hand-repairs + the 2026-07-07 tech-debt fixes).
**Construct RATIFIED by operator:** suttabench measures LLMs as INTERFACE COMPILERS ("designing UI and populating UI"); human pedagogy explicitly unmeasured; probe renamed in spirit to SUFFICIENCY+RETENTION (code/ADR rename still pending).
- **SUTTA-013 completed in advisory mode:** facts layer v2 (macro categories; fabricated/silent/dropped roots; morph = consistency vs DPD reading sets from data/dpd/mn10/grammar.json + morphCoverage); alignment golden v1 (160 links, layered provenance, ~70 API calls, holes disclosed) + Align scorer (index-verified matching, tests); weight-grid stability; negative judge-Spearman = survivorship caveat.
- **Pedagogical→sufficiency probe stages 1+2:** 597-question deterministic bank (authority-tagged) + gemma-4-26b student; closed-book control 46.3%; conditional lift ranks grok 72.8% … dictionary 57.2% … deepseek-v3.2 49.4%; NEW retention dimension (baseline material CONFUSES readers, 49% vs 66-85%).
- **Dictionary baseline** (non-LLM floor): contentF1 0.071 but facts 0.510 beats three models with zero fabrications.
- **Flagship dogfood:** published mn10 packet had EMPTY canonicalSegments (unmeasurable) + 2 real a+ā corruptions — fixed, goldens verified clean; 46 remaining flags = pedagogical sub-token splits → partition-aware matching queued.
- **Design-consequences table** (4 MN117 compiles): same model, 175 vs 121 self-chosen phases = 99% vs 77% coverage — design is load-bearing.
- **Mistral MN117 audition REJECTED:** fine 147-phase design but 78% coverage / 88 repairs / 12 degraded — benchmark facts lead ≠ production packet quality; production stays gemini-3-flash.
Full thread state: portfolio auto-memory `_session-handover-2026-07-11.md`.
### [2026-07-12] [Agent: Opus 4.8 (1M)] — alignment GATE FULLY GREEN (embedding anchor) + completeness gates
**Status:** `feat/local-grounding-pipeline` — all invariants pass on all 22 units; both completeness gates green.
An adversarial sonnet workflow (44 confirmed misalignments vs 1 refuted) exposed that global-conservation
checks cannot see local pair swaps → new I5-I8 invariants (neighbour-lexical-dominance etc.). Heuristic fixes
(fake-sentence glue, per-clause lexical guard, bracket-depth clauses, abbrev-aware splits, per-bead weight
selection) got real drift 5→2; the last two (dialogue-paragraph mismatch u6, early 1:2 bead u19) were the
proven CEILING of length+gloss alignment. Closed by a **cross-lingual embedding anchor**
(`scripts/grounding/embeddings.py`, MiniLM multilingual, local/free/deterministic-inference, npz cache in
data/) weighted into the alignment DP + a per-clause cosine guard → **I5 = 0**. Completeness: I2 is now EXACT
(whitespace-free char stream; caught the sentence-splitter EATING closing quotes at dialogue ends — uncaptured
["")]* in re.split) and a Playwright DOM gate (`tests/e2e/calvino-completeness.spec.ts`, 22/22) proves every
pair renders. `npm run check:calvino` = validator + DOM gate. CI reality: Calvino data is gitignored
(copyright) so this is a LOCAL gate; a PD book (Pinocchio+Murray) gets it in CI. Remaining unchecked link:
EPUB→session adapter coverage. Next: Pinocchio manifest (reusability acceptance test), then PR.

### [2026-07-11] [Agent: Opus 4.8 (1M)] — reusable source-grounding pipeline (Calvino first) — IN PROGRESS
**Status:** Stage 1 (align) COMPLETE on branch `feat/local-grounding-pipeline` (worktree `../LexiconForge.worktrees/local-grounding`). Building a reusable pipeline: source-language original + witness translation(s) → per-word grounded (spaCy+Wiktionary) library work. First book: Calvino *Se una notte d'inverno un viaggiatore* (IT source, import/calvino/, gitignored) + Weaver EN witness. `scripts/grounding/align-calvino.ts` emits a 22-unit bilingual session (IT `content` + Weaver `fanTranslation`) to `out/calvino-session.json` (gitignored — full prose); all 22 units verified 1:1 by eyeball (frames [1]..[12] + 10 incipits, incipit titles line up exactly).
**Stage 2a (grounding fact layer) DONE:** `scripts/grounding/ground_source.py` (spaCy, Python 3.12 venv at scripts/grounding/.venv, requirements.txt) grounds all 22 IT units → **87,919 tokens** with lemma/UPOS/morph → `data/calvino/<unitId>.grounded.json` (gitignored — reconstructs prose). Verified: elisions (dell'→di il), gerunds (leggendo→leggere), clitics handled; it_core_news_sm == it_core_news_lg here so sm (13MB) chosen. Stage 2b Wiktionary gloss layer (kaikki Italian JSONL, lemma→senses) downloads untended (build_glosses.py); slots into the payload on rebuild.
**Stage 3 (reader) DONE — renders in the UI at `/calvino`:** `components/calvino/CalvinoReader.tsx` (route wired in App.tsx) reads `data/calvino/reader-payload.json` (built by build_reader_payload.py: Italian token stream + paragraph breaks + English witness). One unit at a time (prev/next, ←/→ keys); Cardo serif on slate per DESIGN.md; every content word hover→facet tooltip (click cycles), Weaver English toggle. Verified in browser (Playwright screenshots). Grounding paragraph-break bug fixed (spaCy emits "\n\n" as a skipped whitespace token → measure the char-offset gap to the next non-space token for ws/pbr).
**LENS LAYER BUILT (the tooltip no longer leaks substrate).** `services/italian/lens/` is the FIRST real `render(facts, lens) → copy` layer (LENSES.md said none existed — Malayalam hand-authored its copy). `render.ts` + `tables.ts` turn spaCy morph + Wiktionary gloss into reader-facing copy, deterministic, no LLM: MEANING first (not POS/lemma); verbs → who-acts + when, naming the passato remoto ("the story-telling past — the tense books use"); imperatives ("stretch out! — a command"); register-inverted cognate anchors (notte→"kin to nocturnal"); false-friend warnings fired loud in amber (romanzo→"⚠ a novel — NOT romance"); fused prepositions (nell'→"in + the"); suffix word-building (-tore→-er). Wired into CalvinoReader; function words no longer clutter (only content words + fused preps are hoverable). Verified in-browser (amber false-friend tooltip + cycle dots). Also fixed two grounding-quality bugs feeding it: sentence-initial capitals broke lemmatization (Stai→"Stai" not "stare"; re-lemmatize lowercased caps content words) and Wiktionary "inflection of…" form-glosses are dropped in favour of the base lemma's real definition.
NEXT (open): widen COGNATES/FALSE_FRIENDS beyond the ~100 curated (etymology from the kaikki dump can auto-widen cognates); optionally converge the reader onto the shared ConceptInterlinear via a facts→AlignSegment converter (the renderer is reusable; prose shell is fine for a novel); stress-as-grammar marks (parlo/parlò). SOURCING unchanged: Calvino+Weaver copyright → local-only, gitignored, never published; public Italian = PD Pinocchio + Murray 1892 (a new books/pinocchio/book.json, not a rewrite).
**Done this commit:** (1) Fixed a GENERIC bug in `scripts/lib/adapters/epub-adapter.ts` — the manifest `<item>` regex required attribute order `id` before `href`; EPUBs that emit `href` first (both Calvino files, very common) produced an empty manifest → **0 chapters extracted**. Now parses each `<item>` tag and reads id/href order-independently (IT 0→14, EN 0→27 chapters). (2) Added `books/calvino/book.json` manifest + `scripts/grounding/substrates.json` language registry (it verified; fr/de/es/ru stubs).
**Verified structure:** EN extracts 22 clean logical units (12 frame chapters titled [1]..[12] + 10 titled incipits). IT extracts 14 chunks that MERGE each frame+following incipit; must split at incipit-title headings to recover 22 units, then pair by reading order. Next: the 22-unit split/align (local model), then grounding (spaCy `it_core_news_lg` + kaikki Italian Wiktionary), then reader. Design in `docs/GROUNDING-BRIEF.md`; escalate alignment only if verifier won't go green in 3 tries.
### [2026-07-11] [Agent: Opus 4.8] — Malayalam studio reader, pilot slice (`/malayalam`)
**Status:** In progress on `feat/opus-malayalam-reader` (worktree `../LexiconForge.worktrees/opus-malayalam-reader`).
**What:** First slice of a Malayalam decomposition lens (POLYGLOT.md charter applied to Malayalam): sentence 1 of Aithihyamala ch. 64 (ഊരകത്ത് അമ്മതിരുവടി, ml.wikisource, PUBLIC DOMAIN 1909) hand-curated as `AlignSegment[]` — clause-per-line, sandhi-resolved morpheme pieces with practical romanization under each glyph, English as an `opus-draft` witness rendering (page-level toggle, off by default).
- `data/malayalam/urakam-ammathiruvadi.ts` — curated segments (design decisions in header).
- `data/concepts/malayalam.ts` — 4 pilot ConceptNodes (Urakam geography, thiruvadi, kṣetra tatsama, Menon title), all `ungroundedCitation`-flagged pending native review; merged into `lookup.ts` registry (`ALL_CONCEPTS`).
- `Mlym` font/size in ConceptInterlinear + Noto Serif Malayalam in index.html; route `/malayalam` in App.tsx.
**Why hand-curated:** UI-first pilot to converge the interface before automating (mlmorph FST + Olam glosses are the planned substrate; see session discussion). Reader is a heritage speaker relearning script — romanization always-on is the point.
**Next:** native review of glosses; remaining ~30 paragraphs via semi-automated pipeline; Jnanappana verse mode; ISO 15919 facet.
**Resolved 2026-07-11 (same session):**
- ✅ SURFACE LAW ADOPTED (SUTTA-025 applied to Malayalam): pieces must concatenate to the exact written surface; clean boundaries keep morpheme pieces (ഊരക|ത്ത്), sandhi-fused junctions collapse with tooltip pedagogy (പണ്ടൊരു, മേനോന്മാരിൽ, കാവലും, കണക്കെഴുത്തുമുണ്ടായിരുന്നു re-curated). Enforced: `scripts/malayalam/validate-surface.ts` (also checks sound↔cluster sliceability) — wire into CI when this merges.
- ✅ Letter-vs-spoken value: etym tooltip now names the softening rule (single unvoiced stop after a vowel → "letter says ta, mouth drifts toward da"; geminates exempt).
- ▣ Sub-cluster hover (ര vs ു inside രു): RESOLVED BY DESIGN, not built — the akshara is the atomic unit of INK: splitting the combining sequence into DOM spans breaks shaping (dotted-circle/detached sign), and in ligated forms the sub-parts have no separate ink to point at. The cluster tooltip enumerates the typed parts instead. Revisit only with a shaping-aware rendering approach (e.g. harfbuzz cluster metrics); pointer-x heuristics rejected as false precision.

### [2026-07-01 → 2026-07-03] [Agents: Opus 4.8 / Fable 5] — sutta-studio benchmark + MN117 production arc
**Status:** All merged to main and deployed. Written retroactively after a codex review flagged the missing WORKLOG entries for this burst (~34 commits over ~45h; data commits separate from code commits).
**Arc 1 — public leaderboard + fairness overhaul** (`/bench/sutta-studio`):
- 7-model board on 30 held-out MN10 phases; LLM hang fixes (90s call timeout + 15s capability-fetch timeout — retries alone never catch silent hangs).
- Rubric v2.0 → **v2.1 (SUTTA-012)**: dropped golden words charge misses (kills survivorship bias — one model dropped 41% of words yet posted competitive per-kept-word fidelity); content F1 decomposed into published precision/recall.
- **Golden v2** (SUTTA-011 path B): 51-phase curator+adversarial-skeptic workflow, DPD-verbatim-only additions; codex plan review (REVISE, acted on); grok cross-family data verify upheld 17/17. SUTTA-011's accepted-senses metric loosening was built, dual-family REVISE'd, and **reverted** — widen the golden, never loosen the instrument.
- Statistical honesty: bootstrap 95% CIs + adjacent-tie markers (whole board is adjacent-ties; top-vs-bottom real), hallucination-rate column, goldenSuspect judge flag, grounding/provenance panel + closed-book badge.
- Compare View: per-stage phase strips, exact token diffs, judge rationales.
- Process failure worth remembering: a board with 2 models' judge scores from the OLD golden was live ~19 min because a re-judge loop outlived its watcher — publish-gates now key on completion MARKERS ("ALL JUDGED"), never watcher timeouts.
**Arc 2 — MN117 through the PRODUCTION pipeline** (`/sutta/compare`, `/sutta/mn117`):
- Headless production compile (`scripts/sutta-studio/compile-packet.ts`): the real compiler (DPD grounding via fs-injection — the Vite glob loader silently returns {} under Node; morphology; retrieval) with a COMPILE COMPLETE marker contract. `npm run build:dpd -- mn117` (345 forms, 88.1% DPD coverage).
- **Skeleton bug fixed** (crashed the first full MN117 compile): dedup stripped duplicate segment claims AFTER the empty-phase filter, gutting wordRange sub-split phases (one long segment legitimately becomes several phases) into zero-segment phases that crashed pre-try/catch. Both skeleton copies fixed + 3 regression tests + compiler skip-guard.
- **Bake-off** gemini-3-flash vs deepseek-v4-flash, identical pipeline: gemini 100% word coverage / real per-word pedagogy / 72% DPD-cited senses; deepseek 40% coverage (lumps whole sentences as single "words" mid-sutta, drops citation fields). Confirms the MN10 board ranking → **gemini-3-flash is the production pick**. gemini-3.5-flash (new slug) audition in flight.
- **SUTTA-025 production enforcement (#31)**: production prompts already had the surface-faithful instruction (compiler/prompts.ts is a shim) — models disobey it ~6-16% on fusion-heavy words (asthi/saāsavā/lokauttarā). Fix is structural, not "prompt harder": deterministic `repairAnatomistSurfaces` (positional word↔token alignment; collapse-with-tooltip-pedagogy for unsalvageable splits; skip-never-guess) on fresh AND cached anatomist output, disclosed as `surface_repaired` validation issues; packet-validator check 0 (exact canonical-token membership — substring membership false-passed 9-11 words/packet) + compare-page integrity/coverage chips measuring the same thing in-browser.
- Post-arc codex review verdict: hygiene pass (option B) executed — cached-path repair, tightened metric, this WORKLOG entry, leaderboard selection-text fix (completeness-first, regenerated byte-identical except description).
**Correction to the 2026-06-19 entry below:** the liturgy concept-align prototype HAS since merged to main (`types/liturgyAlign.ts`, `components/liturgy/proto/`, later commits build on it); its branch/worktree are gone. Its "NOT merged" status is stale.

### [2026-06-19] [Agent: Opus 4.8 (1M)]
**Status:** Prototype committed on branch (NOT merged); follow-up data pass pending.
**Task:** Fix cross-script alignment in the liturgy reader. Root cause (measured): the renderer is Sanskrit-word-centric — each non-Latin script hangs off a `WordGloss` via a single `scriptAlts[lang]` matched 1:1, so tokens that don't line up 1:1 with a Sanskrit word render DEAD. Measured dead-token rate: **Tibetan 63% (408/643), Japanese 52%, Chinese 38%**; Heart Sutra Tibetan 66%. Same disease as the morpheme-gloss bug (source segmentation imposed on target), one level up. The fix isn't a new schema — `types/conceptGraph.ts` already models the right thing (no canonical pivot; `ghost`/`transliteration`/`calque` relations); it's just not load-bearing (only powers hover-highlight, not tooltips/alignment).
**Worktree:** ../LexiconForge.worktrees/opus-concept-align · **Branch:** feat/opus-concept-align (committed, local only — NOT pushed/merged).
**Built — a working prototype at `/liturgy/_proto`** (not linked from the index):
- **Model** `types/liturgyAlign.ts`: per-language token streams + a shared per-phrase **unit** spine; units link to the global concept registry (`data/concepts/`) via `conceptId`. Handles what the 1:1 model can't — 1→many compounds, repeated-token disambiguation, reordering, `ghost` grammatical glue, `phonetic` transliteration chars, multi-reading glyphs (`readings: {zh,ja}`).
- **Data** `data/liturgy/_proto/opening-practice-aligned.ts`: the **first 5 Heart Sutra phrases** (invocation → form-is-emptiness), all scripts. Drafted by a Sonnet subagent (grounded in `heart-sutra.ts` + the concept registry), then linguistically reviewed by me: plain glosses for every particle (no case jargon, §3.4), three sandhi compounds kept whole for correct Devanāgarī spelling. vitest `…opening-practice-aligned.test.ts` (6 pass).
- **Reader** `components/liturgy/proto/ConceptInterlinear.tsx` (+ page, + `LiturgyApp` route): DESIGN.md aesthetic (centered Cardo serif, words in open space). Per-language eye toggles; per-language pronunciation (on by default for non-Latin); merged **Chinese · Japanese** Han row with 中/日 readings; per-syllable Tibetan + per-character CJK stacks (glyph + sound); de-duplicated hover tooltips. **Two hover modes:** *Alignment* (undirected SVG thread linking a word's match across shown languages — no canonical pivot) and *Etymology* (inward: a hovered syllable lights only itself, sound↔script).
- **Design context** captured via `/impeccable init`: `PRODUCT.md`, `DESIGN.md`, `.impeccable/live/config.json`.
**Verified:** vitest 6/6; tsc clean on new files; vite renders both modes with 0 console errors (screenshots in `/tmp/liturgy-review/shots/`).
**Next — wire this model into the LIVE reader** (`/liturgy/maple/heart-sutra`), replacing `scriptAlts` 1:1 matching. (Per-akshara Sanskrit + the two hover modes are DONE in the prototype.) Three requirements the user specified for the live version (2026-06-19):
- (a) **Cycle the multiple English witnesses** (MAPLE / Conze / Red Pine / TNH — already per-witness in the concept registry) while the cross-script alignment holds.
- (b) **Click cycles tooltip facets** per segment/morpheme — sound · pronunciation · root · grammar — beyond the quick hover gloss. (The sutta-studio mn10 reader already does click-to-cycle-facets; the DPD substrate has the roots/grammar to fill them.)
- (c) **Multilingual title** — model the sutra's name as its own concept-aligned phrase (प्रज्ञा·पारमिता·हृदय = wisdom·perfection·heart), so each tradition's title surfaces when its language is enabled (Skt *Prajñāpāramitā­hṛdaya* · Zh 般若波羅蜜多心經 · Ja 般若心経 *Hannya Shingyō* · Bo · En), with the various English renderings ("Heart of Transcendent Wisdom", "The Perfection of Wisdom", …) cyclable below.
These are exactly what the live concept-registry + DPD substrate already provide — the argument for wiring to live rather than hand-authoring. **Decisions locked:** Heart-Sutra-first; uncertain dharani rendered as sound; alignment threads undirected; no on-screen instructional hints; pronunciation always on for non-Latin (no per-language toggle).

### [2026-05-30 17:16 EDT] [Agent: Opus 4.8 (1M)]
**Status:** Complete (kernel)
**Task:** Continue Codex's liturgy-generator — the user-chosen "kernel first" path (commit, consolidate validation, harden alignment, drop redundant draft). Not the LLM content-authoring slice.
**Worktree:** ../LexiconForge.worktrees/codex-liturgy-generator/ · **Branch:** feat/codex-liturgy-generator (4 commits, local only — NOT pushed, NOT merged)
**Findings that shaped the work (grounded, not from the transcript):**
- The "generator" authors zero linguistic content — every gloss/morpheme/etymology is hand-authored in the input packet; it only computes alignTo/morphemeAlignTo + serializes. It is an aligner + linter, not a content generator. It does NOT address the user's actual complaint (depth/grounding inconsistency).
- Its validate.ts duplicated 5/6 invariants already in the corpus tests; the Pāli tokenizer was a 4th hand-synced copy of the renderer's.
- The alignment inference silently produces wrong-but-valid arrays on real chants (mass gloss collisions → content words fall to -1 → rendered as false "glue"); `infer` was the silent default.
- No schema collision with feat/opus-liturgy-community (additive phraseId only). Follow-on: generated chants need phraseId to join cross-community pools.
**Commits:** 44e4ba9 preserve WIP · f134627 consolidate validation into services/liturgy/validation.ts (one validateLiturgyDoc run over BOTH drafts and the shipped corpus) · 9abc235 loud alignment (low_alignment_coverage + inferred_alignment_unreviewed warns; CLI REVIEW REQUIRED banner) · 6d6a6f7 relocate redundant Three Refuges draft to test-fixtures (it duplicated ti-sarana with 0 citations).
**Verification:** full repo suite + tsc on touched files (see commit bodies); liturgy+generator: 5777 passed | 101 skipped (was 5756; +20 corpus-validation, +1 coverage test, no regressions).
**Next (unstarted — user's fork):** LLM content-authoring stage (the real lever for depth/grounding consistency, per ADR LITURGY-001 "Next steps"), OR audit the shipped corpus for sub-Metta depth. The em-dash voice rule appears unenforced (metta-sutta.ts has 251) — reconcile before any voice pass.

### [2026-05-30 10:27 EDT] [Agent: Codex]
**Status:** Starting
**Task:** Build Option B: a dedicated liturgy generator pipeline inspired by Sutta Studio.
**Worktree:** ../LexiconForge.worktrees/codex-liturgy-generator/
**Branch:** feat/codex-liturgy-generator
**Files likely affected:** docs/adr/LITURGY-001-liturgy-generator-pipeline.md; services/liturgy-generator/*; scripts/liturgy-generator/*; tests/services/liturgy-generator/*; test-fixtures/liturgy-generator/*; package.json.
**Hypotheses:** H1 inconsistent chant-sheet quality is primarily caused by hand-authored alignment/morpheme drift; H2 a staged generator with mandatory validation can make those failure modes loud; H3 raw OCR/markdown-to-polished-sheet is too broad for the first implementation slice, so this pass should consume structured source packets and emit `LiturgyDoc` drafts.

### [2026-05-30 10:34 EDT] [Agent: Codex]
**Status:** Complete
**Progress:** Implemented initial liturgy generator scaffold on `feat/codex-liturgy-generator`.
**Files modified:**
- `docs/WORKLOG.md:1` — session start/end entries for multi-agent continuity.
- `docs/adr/LITURGY-001-liturgy-generator-pipeline.md:1` — architecture decision for a dedicated `LiturgyDoc` generator rather than direct Sutta Studio adaptation.
- `services/liturgy-generator/types.ts:1` — generator input, diagnostics, alignment hint, and stats contracts.
- `services/liturgy-generator/tokenize.ts:1` — renderer-compatible source/witness token helpers and export-name helper.
- `services/liturgy-generator/align.ts:1` — deterministic witness alignment + morpheme alignment inference with explicit unmapped-token diagnostics.
- `services/liturgy-generator/validate.ts:1` — generator-side guardrails for morpheme reconstruction, alignment shape/range, internal-ID leaks, and plain-register jargon tripwires.
- `services/liturgy-generator/emit.ts:1` — TypeScript `LiturgyDoc` draft module emitter.
- `services/liturgy-generator/pipeline.ts:1` — staged draft builder orchestration.
- `scripts/liturgy-generator/build-liturgy-draft.ts:1` — CLI for structured input packet → draft `.ts` output.
- `test-fixtures/liturgy-generator/ti-sarana-mini.json:1` — fixture packet including an explicit idiom alignment hint for "take refuge".
- `tests/services/liturgy-generator/pipeline.test.ts:1` — coverage for inferred alignment, emitter output, and loud morpheme failures.
- `package.json:22` — `build:liturgy-draft` script.
**Verification:**
- PASS `../../LexiconForge/node_modules/.bin/vitest run tests/services/liturgy-generator/pipeline.test.ts`
- PASS `../../LexiconForge/node_modules/.bin/tsx scripts/liturgy-generator/build-liturgy-draft.ts test-fixtures/liturgy-generator/ti-sarana-mini.json --out /private/tmp/ti-sarana-mini.draft.ts`
- PASS `../../LexiconForge/node_modules/.bin/vitest run tests/components/liturgy/liturgy-data-quality.test.ts tests/components/liturgy/alignment-audit.test.ts`
- BLOCKED/known repo debt: `../../LexiconForge/node_modules/.bin/tsc --noEmit --pretty false` still fails in unrelated existing files (`components/sutta-studio/AboutThisText.tsx`, `data/liturgy/song-of-zazen.ts`, `scripts/build-dpd.ts`, `services/db/operations/chapters.ts`, `services/providers/scBilaraVariants.ts`, `tests/current-system/unwrap-nested-scoped-ids.test.ts`, `utils/spaNavigate.ts`). No reported diagnostic named `services/liturgy-generator`, `scripts/liturgy-generator`, or the new test file.
**Next steps:** Add a model-backed authoring stage only after this deterministic scaffold is reviewed; likely first target is raw MAPLE/Bodhi markdown or OCR normalization into the structured generator packet.

### [2026-05-30 13:28 EDT] [Agent: Codex]
**Status:** Starting
**Task:** Option 1 pilot — run the dedicated liturgy generator against a real small chant before adding LLM ingestion.
**Worktree:** ../LexiconForge.worktrees/codex-liturgy-generator/
**Branch:** feat/codex-liturgy-generator
**Files likely affected:** test-fixtures/liturgy-generator/*; data/liturgy/drafts/*; tests/services/liturgy-generator/*; docs/WORKLOG.md.
**Assumptions:** Use a compact Bodhi Sangha Three Refuges pilot because it contains real ritual wording and the "take refuge" idiom but stays small enough for review. Do not register the generated draft in `data/liturgy/index.ts`.

### [2026-05-30 13:31 EDT] [Agent: Codex]
**Status:** Complete
**Progress:** Added the real Three Refuges pilot as a structured packet and generated unregistered draft artifact.
**Files modified:**
- `test-fixtures/liturgy-generator/three-refuges-pilot.json:1` — real compact Bodhi Sangha Three Refuges source packet with explicit idiom hints for "take refuge".
- `data/liturgy/three-refuges.generated.draft.ts:1` — generated draft `LiturgyDoc`, intentionally not registered in `data/liturgy/index.ts`.
- `services/liturgy-generator/align.ts:50` — word-level candidates now include morpheme text/root/gloss/note so base forms like English "Buddha" match source `Buddhaṁ`.
- `tests/services/liturgy-generator/pipeline.test.ts:1` — pilot reproducibility test verifies the committed draft is exactly regenerated from the source packet with zero warnings.
- `docs/WORKLOG.md:1` — pilot start/end notes.
**Verification:**
- PASS `../../LexiconForge/node_modules/.bin/vitest run tests/services/liturgy-generator/pipeline.test.ts`
- PASS `../../LexiconForge/node_modules/.bin/tsx scripts/liturgy-generator/build-liturgy-draft.ts test-fixtures/liturgy-generator/three-refuges-pilot.json --out data/liturgy/three-refuges.generated.draft.ts` → 3 inferred alignments, 0 unmapped tokens, 0 warnings.
- PASS `../../LexiconForge/node_modules/.bin/vitest run tests/components/liturgy/liturgy-data-quality.test.ts tests/components/liturgy/alignment-audit.test.ts`
- BLOCKED/known repo debt: `../../LexiconForge/node_modules/.bin/tsc --noEmit --pretty false` still fails in unrelated existing files; no diagnostic names the new generator or draft files.
**Next steps:** Review the draft artifact for taste. If accepted, the next implementation step is a structured-packet authoring helper for raw markdown/OCR lines, not a full model-backed generator yet.

2026-05-15 (PLANS folder seeded for parallel agent pickup) - [Agent: Opus 4.7 (1M)]
- Status: COMMITTED to main. Three pickup-ready plans seeded under `docs/sutta-studio/PLANS/`:
  - `cost-preview-confirm.md` (2-4 hr) — modal before full compile shows estimated cost + duration; cancel option discards skeleton cleanly. Touches compiler entry + new modal.
  - `refrain-detector.md` (2-3 hr) — post-pass that surfaces "this phrase appears N times" as a reader affordance for MN10-style refrains.
  - `polyglot-foundations.md` (4-8 hr) — minimum-investment polyglot step: SC parallels sidebar showing Pāli/Sanskrit/Chinese/Tibetan parallel texts. Deliberately NO decomposition, NO lens, NO concept registry (those are 6-10 weeks per POLYGLOT.md and stay parked).
- All three plans designed for parallel execution by separate agents — no overlapping files. Each plan has a "How to start" worktree-creation block matching the multi-agent coordination rules in CLAUDE.md.
- README at `docs/sutta-studio/PLANS/README.md` is the index agents read first.
- Companion merges this session: PR #56 (persistent segmentCache → IDB) and PR #57 (GROUNDING Phase 4 via Eudoxos Vism TEI) — both landed on main via merge commits 16cdb77 and 1cf1b37. The PLANS folder is the next-actions list now that those threads are closed.

---

2026-05-14 (continued — GROUNDING Phase 2/2.5/3/5 + v12-b + registry expansion) - [Agent: Opus 4.7 (1M)]
- Status: MERGED. PR #54 landed via merge commit af58a0f. 7 commits forming a coherent GROUNDING completion unit.
- Sources of truth: docs/sutta-studio/GROUNDING.md (architecture), docs/sutta-studio/AMORTIZATION.md (irreducible-gap finding + external resources backlog + new-sutta playbook), data/sutta-studio/grounding/contested-terms.json (11 terms), services/sutta-studio/grounding/ (provider + translator-bank), services/sutta-studio/passes/grounding.ts (pass + tests).
- Task arc:
  1. GROUNDING Phase 2 — TS provider + groundingPass + 7 tests + CLI (replaces apply-contested-terms.py)
  2. GROUNDING Phase 2.5 — wired into live compiler/index.ts (auto-grounds future v11 outputs)
  3. Registry expansion +6 terms — ātāpī, sampajāno, vedanā, citta, dhammā, kāyānupassī (covers MN10's body vocab; 8 procedural phases auto-grounded from this alone)
  4. GROUNDING Phase 5 — UI grounded-vs-interpretive affordance (italic + "synthesis ·" marker for senses without citationIds)
  5. v12-b prompt — sliding-window prior-phase context (last 3 phases) injected into PhaseStateEnvelope; bumps prompt version to v12-prior-phase-context
  6. GROUNDING Phase 3 — translator-bank fetching SC bilara API per-verse renderings; integrated into runGroundingPass via optional verseBank param
  7. AMORTIZATION.md — captures the 75-80% pipeline ceiling, external-resources backlog (PTS, CPD, GRETIL, CBETA, VRI, Anālayo monographs, etc.), new-sutta playbook (~5-6 hr per sutta)
- Architectural milestone: pipeline + grounding quality on a NEW sutta projected at ~85% out-of-the-box (was ~50-60% before this PR). Every MN10 phase now has chips wired — verse-level Sujato + term-level Bodhi/Sujato/Thanissaro/Wikipedia where applicable.
- What's NOT in (next-session pickup):
  - GROUNDING Phase 4 — commentarial-gloss seed (~30 Vism entries). DEFERRED: requires human Pāli reading expertise OR programmatic VRI/Ñāṇamoli digitization with chapter index. Pickup gate documented in task #49.
  - Path B continuation — 35 procedural phases. Now much less urgent — every phase has verse grounding. Hand-polish would add cross-phase narrative + voice consistency, not chip count.
  - Refrain-detector post-pass — independent infrastructure (~2-3 hr)
  - Live compiler-pipeline translator-bank wiring — currently CLI-only; compile-time fetch adds 1-3s latency per sutta
  - Final inspection — visual walk through all 39 phases in app (~1-2 hr)
- Resume: PR #54 merged. Pick from "what's NOT in". DN22 pilot would be the highest-leverage way to validate the architecture's amortization claims.

---

2026-05-14 (continued — GROUNDING bootstrap + Path B 5/6/7 + UX separation) - [Agent: Opus 4.7 (1M)]
- Status: MERGED. PR #53 landed via merge commit 072f351. Worktree `../LexiconForge.worktrees/opus-path-b` will be removed; branch `feat/opus-path-b` deleted.
- Sources of truth: docs/sutta-studio/GROUNDING.md (architecture design + 6-phase bootstrap sequence), data/sutta-studio/grounding/contested-terms.json (5-term registry seed, all URLs verified), scripts/sutta-studio/{mint-citation-urls,wire-citation-ids,apply-contested-terms}.py (Phase 0+1.5 application).
- Principles instantiated:
  - Phantom-consumer audit symmetry — retired LLM CLAIMS no source backs (sibling to retiring DATA FIELDS no UI consumer reads)
  - Lean toward reverse direction — architecture SHRINKS LLM footprint (~70% of curator work was DB-substitution, not synthesis)
  - Telic breadcrumbs — GROUNDING.md is the WHY for future agents reading sourced tooltips
- Task arc:
  1. Path B 5/6/7 — formula chain close + bridge to four foundations (commits f9a6119, 7738564, 7a628f9)
  2. GROUNDING design doc (d138799) — symmetric move to phantom-consumer audit
  3. GROUNDING Phase 0 (98cc5a7) — URL minting + citation wiring on 32 DPD citations
  4. GROUNDING Phase 1 (bed09c6) — contested-terms registry seed: satipaṭṭhāna, dukkha, nibbāna, ñāya, sati
  5. GROUNDING Phase 1.5 (a35c334) — apply-contested-terms.py wires registry to 110 senses
  6. Architecture-caught-errors round 1 (59f62b8) — phase-7 Bodhi parse + Thanissaro rendering corrections via Wikipedia + dhammatalks WebFetch verification
  7. UX separation (9771d12) — tooltip on hover / audit on click (separate gestures, not auto-pin)
  8. Architecture-caught-errors round 2 (43a8f28) — phase-5 ñāya 3rd sense corrected from "Buddhaghosa scholarship" to Thanissaro's verified translator rendering
- What's NOT in (next-session pickup):
  - GROUNDING Phase 2 — provider + groundingPass compiler-pass automation (~4-6 hr; earns existence when registry > 20 entries)
  - GROUNDING Phase 3 — translator-bank wiring per-verse SC Bilara (~4-6 hr)
  - GROUNDING Phase 4 — commentarial-gloss seed ~30 Vism entries (~6-10 hr; requires Pāli reading skill)
  - GROUNDING Phase 5 — UI grounded-vs-interpretive affordance (~1-2 hr)
  - Registry expansion — ~10 more contested-terms entries (dukkha-depth, domanassa, sampajañña, viharati, kāyānupassanā, vedanā, citta, dhamma, sacchikiriyā, adhigama)
  - Path B continuation — 35 procedural phases (x-bg) at much faster pace once Phase 2 automation in place
- Resume: PR #53 merged; pick from "what's NOT in" list. Phase 2 (groundingPass automation) is the highest-leverage next move because it unlocks faster Path B continuation.

---

2026-05-14 (long session — V2 wiring + audit UX + syllabifier + phantom purge + Path B start) - [Agent: Opus 4.7 (1M)]
- Status: MERGED. PR #52 landed via merge commit 3791e42. Worktree `../LexiconForge.worktrees/opus-phase2-experiment` will be removed; branch `feat/opus-phase2-experiment` deleted.
- Sources of truth: merge commit 3791e42 body (thread summary), docs/sutta-studio/curation/phase-{2,3,4}.md (per-phase logs), services/sutta-studio/postPasses/syllabify.ts (deterministic post-pass pattern).
- Task arc (across compactions):
  1. A1 — Wired SUTTA_STUDIO_V2 amendments into live compiler (register, anchor, relations, translator-debate, cross-phase). SENSE_METADATA retired.
  2. A2 — Validated V2 amendments empirically (phase-2 hand vs pipeline diff). Lift is structural, not metadata.
  3. C — Hand-curated phase-2, then phase-3, phase-4 via Path B pattern (~7 min/phase post-purge).
  4. Audit panel iteration: mobile bottom-sheet, draggable+persisted on desktop, inline copy + toast, clickable citation chips.
  5. Legend panel: visual reference for colors/diacritics/relations (example-first descriptions, no technical terms).
  6. Syllabifier post-pass: deterministic Pāli syllable+stress for 269/269 words. 29 tests pass. Sets the post-pass pattern.
  7. Batch v11 pipeline: ran 40 un-curated MN10 phases through compiler (~$0.96 total via Gemini Flash). Outputs in docs/sutta-studio/experiments/.
  8. Phantom-metadata purge: stripped epistemicBasis, confidence, sourceCitationIds, morph from data + prompts + UI. Audit found them never rendered in default-on paths. Net -500 lines.
- Principles ratified (in ~/.claude/CLAUDE.md):
  - "Lean toward the reverse direction" (papañca framing for subtraction)
  - Rule Stacker anti-pattern
  - Phantom Consumer anti-pattern
  - Leave telic breadcrumbs (commit bodies + ADRs capture WHY)
- DO NOT add back without building a UI consumer first: epistemicBasis, confidence, sourceCitationIds, morph.
- What's NOT in (next-session pickup):
  - Path B continuation — 39 phases (5, 6, 7, x, y, z, aa-bg) to polish at ~7 min/phase, total ~5 hours
  - Dead toggles (Emoji in tooltips, Grammar terms) — wired but target data was stripped, safe to remove
  - DPD URL minting on existing 32 citations (chips are wired to be clickable)
  - Refrain-detector post-pass (sibling to syllabifier)
  - F task — Translator-tradition database
  - Compiler consolidation Phase 3+4 (LLM caller merge + shim cleanup) — partial work landed via PR #51
- Resume: PR #52 is merged; pick from "what's NOT in" list. Path B is highest-leverage continuation.

---

2026-05-12 (long session — Tier-1 grounded data layer + batch 2 complete + renderer arc) - [Agent: Opus 4.7 (1M)]
- Status: 28 commits on feat/opus-grounded-data-layer pushed to origin. PR #38 (ready). Worktree at ../LexiconForge.worktrees/opus-grounded-data-layer. Merging back to main this session.
- Note: supersedes the temporary "2026-05-11 (continuing — provider build)" claim entry that landed on main (1242e43); the work is now done and captured below.
- Sources of truth: docs/HANDOVER.md (full session inventory), docs/adr/SUTTA-008-grounded-curation-data-layer.md (architecture), docs/sutta-studio/CURATION_PROTOCOL.md (curation discipline), docs/sutta-studio/curation/phase-{a,b,c,d}.md (per-phase logs).
- Task arc (spans two calendar dates because session ran past midnight UTC, then continued 2026-05-12 afternoon after compact):
  1. Tier-1 data-layer architecture (provider abstraction; DPD + SC bilara + suttaplex providers; compiler wired; curation helper)
  2. Grounded Curation Loop protocol ratified
  3. CURATION_PROTOCOL §6 batch 2 complete — four MN10 phases re-curated (phase-a evaṁ-me-sutaṁ, phase-b ekaṁ-samayaṁ-bhagavā, phase-c kurūsu-viharati, phase-d Kammāsadhammaṁ-nāma-kurūnaṁ-nigamo)
  4. Renderer arc — anchor styling, calm-default arrows, pin model, click-cycles-facets, tooltip overflow flip, About-this-text panel with linked acknowledgments, citation chips in pinned tooltips
  5. Schema tension #1 (DPD stripper conflation) FULLY RESOLVED across all u-stem oblique plurals (-su/-hi via c33b115, -naṁ via be2b141, with regression-test coverage via b1b7fdb)
  6. Schema tension #7 (EpistemicBasis enum) RESOLVED via 4323310; first real load on 'curatorial' in phase-d (Jātaka derivation + trading-center expansion)
- Milestone commits (full list in PR #38):
  - Tier-1: 9168b5a, 82fae37, 49d3eba, 5ff46c0, bc46e47, 8c82f73
  - Protocol: b5f56dc, e1a77fa (§3.4 amendment)
  - Phases applied: 8e7b197, 23b1481, 69b8eda, 3485523 (evaṁ backfill), b5a52a9 (phase-d)
  - Renderer: 00fe9ab, 29d5c35, 8df4aba, b290ff0, e379062, 13164b2, 0515dd4
  - Provider quality: c33b115 (DPD bug fix #1, -su/-hi; coverage 81.6→86.5%), be2b141 (DPD bug fix #2, -naṁ; coverage 86.5→86.9%), b1b7fdb (regression tests for both fixes, 37 cases), 4323310 (EpistemicBasis enum extension)
- What's NOT in (next-session pickup list, see HANDOVER §Pending threads):
  - Tooltip plain-first rewrite (§3.4 protocol applied to existing tooltip content — phase-c §6 and phase-d §6 already flag specific tooltips)
  - Renderer Chunk 3 (structured tooltip {plain, grammar, example?} facet shape replacing string[] arrays)
  - Tier-1 commit C — VRI edition + Aṭṭhakathā commentary providers (originally deferred per ADR Open Questions #4)
  - GitHub issues for remaining schema tensions (8 documented in phase logs)
  - Phase-e through phase-h (batch 3 of CURATION_PROTOCOL §6) — protocol can be re-evaluated first if needed
- Resume: read docs/HANDOVER.md (full session inventory + pending), then pick from the "what's worth doing" matrix in HANDOVER §Pending threads.

---

2026-05-11 (long session) - [Agent: Opus 4.7 (1M)]
- Status: All 8 commits pushed to origin/main. Clean tree.
- Task: Chapter identity migrations (V4 unwrap + V5 chapter-number drift), Sutta Studio fixes (chip honesty, cheap-model default, partial-phase fallback), Sutta Studio architectural docs (FEATURES + TEXT_GRAPH + POLYGLOT, ~1700 lines).
- Branch: main (all on main; no worktrees this session — small fixes + docs)
- Commits: dd0de8c, 3a08f4b (V4 unwrap), bef65dd (V5 chapter-number + boot wiring + issue #20 postmortem), d78b62f (chip honesty), 5cb15b7 (cheap model), 4ff787e (partial-phase fallback), efa7c8f (3 docs), plus repo cleanup commits 851b8d0 / e9dcced.
- What's in:
  - V4 unwrap migration: 6544 → 3271 chapters in user's local IDB; 130 translations preserved
  - V5 chapter-number drift fix + defensive guard at setChapterNumberByStableId + walker IDB write removed
  - Boot pipeline runs both migrations idempotently for all users on next visit
  - Sutta Studio compiler defaults to gemini-3-flash-preview (~100x cheaper than Sonnet)
  - Three architectural docs: FEATURES.md (current bilingual MVP spec), TEXT_GRAPH.md (transmission architecture, design only), POLYGLOT.md (multi-language charter with honest scope warnings)
  - Issue #20 postmortem at issues/20-chapter-number-drift-from-history-walker/
- What's NOT in (deferred to next session):
  - Additive bilingual schema fields (task #16) — MorphHint extensions, CompoundType, expanded GhostKind, Span, EpistemicBasis, Provenance, ParallelRef. All optional, all additive. ~30 min one commit.
  - MN10 demo phase-by-phase re-curation (task #14). User cleared rhythm: phase-by-phase with clearance. Start with phase-a → continue through phases 1-15 first, then 16-51.
- Resume: read docs/HANDOVER.md, then task #16, then task #14.

---

2026-05-05 21:55 PDT - [Agent: Opus]
- Status: Ready to merge (worktree)
- Task: Issue #19 Phase 3 (partial) — telemetry instrumentation + failure routing
- Worktree: ../LexiconForge.worktrees/opus-telemetry-and-failure-routing / branch: feat/opus-telemetry-and-failure-routing (branched off feat/opus-bg-work-visibility)
- 1 commit (e2aad08): feat(telemetry,routing): translation lifecycle events + failure routing
- What's in:
  - Lifecycle events: translation_started/completed/aborted with origin,
    queue_depth, is_background, duration_ms, cancel_reason. Analytics-only
    (not server callback).
  - New TelemetryExtras free-form map field, threaded through buildPayload
    and emitAnalytics so dashboards can group by extras.
  - isSystemicFailure helper (missing_api_key, trial_limit).
  - Failure routing: foreground → setError; background+systemic → global toast;
    background+per-chapter → silent (translationProgress[chapterId] still
    captures the error for on-return inline rendering).
  - 6 new regression tests in tests/current-system/translation.test.ts.
  - Tests set viewMode:'original' explicitly to prevent autoTranslateMediator
    from racing — caught a real test-environment surprise (mediator fires on
    setState when viewMode defaults to 'english').
- What's NOT in (deferred per Phase 3 evidence-required design):
  - Priority queue / depth bounds / preemption — needs telemetry data first.
  - Cost guardrails — same.
  - Amendment proposal routing — conditional, low priority while
    enableAmendments default is false.
- Verified: npx vitest run → 1171 pass, 16 skip (1165 baseline + 6 new). TS clean.
- Pending: Aditya merges chain in order (Phase 1 → Phase 2 → Phase 3 partial).

2026-05-05 17:50 PDT - [Agent: Opus]
- Status: Ready to merge (worktree)
- Task: Issue #19 Phase 2 — background-work visibility cleanup
- Worktree: ../LexiconForge.worktrees/opus-bg-work-visibility / branch: feat/opus-bg-work-visibility (branched off feat/opus-translation-survives-nav)
- Phase 2 changes (2 commits):
  - b6216cf fix(images,beforeunload): clear isLoading on throw + widen unload check
    - imageSlice handleGenerateImages/handleRetryImage now wrap awaits in try/catch
      and clear isLoading + progress on throw (the leak the handover suspected)
    - MainApp beforeunload now reads pendingTranslations.size (any in-flight work)
      not just current chapter — correct after Phase 1 background continuation
    - 2 regression tests: imageSlice.leak-on-throw.test.ts
  - 3abcc35 feat(ui): background-work banner for non-current chapter translations
    - <BackgroundWorkBanner /> floating bottom-right; shows count + first title;
      click navigates to that chapter so the inline cancel surface is reachable
    - No Cancel-by-default per CORE-012 Q4; "Stop" affordance is Phase 3 work
    - 6 tests in BackgroundWorkBanner.test.tsx
- Verified: npx vitest run → 1165 pass, 16 skip (1157 Phase 1 baseline + 8 new Phase 2 tests, no regressions)
- Deliberately NOT in Phase 2:
  - Per-chapter amendment proposal routing — conditional, low priority because
    enableAmendments default is false (recent fix). Revisit if real use shows noise.
  - Banner "Stop" button — Phase 3 alongside priority-queue / cost-guardrail work.
- Pending: Aditya merges feat/opus-translation-survives-nav (Phase 1) + feat/opus-bg-work-visibility (Phase 2) into main when ready.

2026-05-05 17:25 PDT - [Agent: Opus]
- Status: Ready to merge (worktree)
- Task: Issue #19 Phase 1 — translation survives SPA navigation
- Worktree: ../LexiconForge.worktrees/opus-translation-survives-nav / branch: feat/opus-translation-survives-nav
- Phase 0 docs already on main (commit e05057f): issue #19 spec + CORE-012 ADR draft
- Phase 1 changes:
  - Removed auto-cancel in chaptersSlice.setCurrentChapter (the bug — was
    killing in-flight translations on every nav, dropping LLM work)
  - Split TranslationOrigin: 'auto_translate' → 'auto_visit' + 'auto_preload'
  - Updated 3 call sites (autoTranslateMediator, chaptersSlice preload,
    SuttaStudioApp) and 2 internal checks in translationsSlice
  - Gated auto-image-gen by origin: 'auto_preload' never auto-fires image
    generation (per Q1 ratification — preload is speculative, image gen
    expensive; user explicitly wants manual control via toolbar)
  - 4 new regression tests in tests/store/slices/setCurrentChapter-survives-nav.test.ts
- Verified: npx vitest run → 1157 pass, 16 skip (vs baseline 1153/1; +4 my new tests, no regressions)
- Pending before merge: live Playwright spec for full flow (translation A
  completes + persists after nav to B); Aditya ratification of CORE-012 Q1-Q5

2026-05-04 20:55 PDT - [Agent: Opus]
- Status: Complete — merged to main
- Task: FoJin/Sutta Studio refactor wrap-up + main-branch test debt cleanup
- Worktree: ../LexiconForge.worktrees/opus-fojin / branch: feat/opus-fojin (17 commits)
- Headline:
  - Buddhist text reading end-to-end: search "heart sutra" → curated 84000 fan
    + multiple FoJin raws → click → load → Sutta Studio with Chinese + English
    side-by-side + source provenance metadata strip
  - 4 real product bugs fixed (registry crash on thin schemas, retranslate-button
    falsely lit, env-var fallback gap, image caption fallback chain)
  - Unit tests: 1136-failing-or-skipped → 1153 passing, 1 skip with documented
    reason. Main had 33 fails before; branch ends at 0.
- Highlights of the 17-commit stack (chronological after rebase):
  - feat(scraping): FoJin adapter + LLM Buddhist scripture identity resolution
  - fix(librarySearch): route FoJin search through local fetch-proxy (CORS)
  - feat(librarySearch): LLM-enrich FoJin candidates with English disambiguation
  - feat(sutta-studio): M1 — open FoJin chapters in Sutta Studio
  - feat(sutta-studio): M2 — AI translation as the English column
  - docs(sutta-studio): Pali/English design rationale + Chinese design intent
  - fix(sutta-studio): strip HTML from AI translation before paragraph splitting
  - feat: 84000.co adapter + fan-URL probe + actually fetch picked fan card
  - fix(library): persist fan translation through hard nav + e2e
  - feat(sutta-studio): SPA-nav studio button + side-by-side columns + source metadata
  - refactor(store): generic chapter merge — preserve in-memory-only fields
  - feat(librarySearch): curated 84000 toh-ID lookup
  - feat(chapter): plumb blurb + sourceLanguage through fetch → IDB → studio
  - fix(librarySearch): simplify unsupported-URL error message (carried orphan)
  - chore: untrack test-results/.last-run.json
  - chore: clean repo — fix all 28 inherited test failures, root-caused
- Verified:
  - npx vitest run: 1153 pass, 1 skip
  - npx playwright test (4 fojin e2e files): 4/4 pass
  - npx tsx scripts/smoke-real-fojin.ts: real-network smoke validates the
    full search → fan-translation-attach → studio-render flow with screenshots
  - npm run build: clean
- Notes for next agent:
  - The 1 skipped test (appScreen auto-retry-suppression) needs a focused unit
    test against autoTranslateMediator, not MainApp — see comment in
    tests/store/appScreen.integration.test.tsx
  - Chinese-pipeline implementation (Sutta Studio for Mahayana texts) is
    designed but not implemented — see docs/sutta-studio/CHINESE_DESIGN.md
    open questions before starting
  - 84000 curated table at services/librarySearch/known84000.ts has 6 entries;
    add more by verifying toh-IDs on https://84000.co/translation/toh{N}

2026-05-03 18:45 PDT - [Agent: Opus]
- Status: Complete (worktree)
- Task: Add FoJin (fojin.app) adapter + LLM-driven Buddhist scripture search integration
- Worktree: ../LexiconForge.worktrees/opus-fojin / branch: feat/opus-fojin
- Files:
  - services/scraping/siteAdapters.ts (added FojinAdapter — REST API based, like SuttaCentral)
  - services/scraping/fetcher.ts (wired isFojin path through proxy / Playwright / direct fetch fallbacks)
  - services/scraping/urlUtils.ts (example URL)
  - config/constants.ts (registered fojin.app in SUPPORTED_WEBSITES_CONFIG)
  - services/librarySearch/searchService.ts (extended LLM prompt for Buddhist scripture identity; added searchFojinDirect that queries /api/search with the LLM's canonical Chinese title and merges results)
  - tests/services/adapters.fojin.test.ts (5 tests)
  - tests/services/librarySearch.fojin.test.ts (4 tests)
- Why:
  - User wanted to read Heart Sutra; library search returned nothing because (a) prompt was novel-only, (b) fojin's English search itself is broken ("heart sutra" → "Queen Gentle-heart"), (c) fojin.app wasn't a recognized adapter site.
  - Fix uses the LLM (already in the search loop) to translate user query into canonical Chinese title (e.g. "Heart Sutra" → "般若波羅蜜多心經"), then queries fojin's API with that — id=9 ranks at score 505.8 cleanly.
  - Adapter mirrors SuttaCentralAdapter (REST API, not HTML scrape). Uses /api/texts/{id}/juans/{n} for content, prev_juan/next_juan for navigation.
- Verified:
  - 9 fojin tests pass + 23 other adapter tests still pass
  - npm run build succeeds
  - Live API responses confirmed via curl during development (Heart Sutra T0251 returns 1282-char content)
- Known caveats:
  - fojin's `has_content` field in search results is unreliable; we don't filter on it (see adapter test for empty-content error path)
  - Live browser end-to-end test not done — needs dev server + manual UI
2026-05-02 18:34 EDT - [Agent: Codex]
- Status: Complete
- Task: Align launcher browser URL with Vite dev server port.
- Worktree: none (single-agent small fix in root checkout)
- Files:
  - start-lexiconforge.command:30,46,51
  - vite.config.ts:217
- Why:
  - The launcher was still printing and opening `http://localhost:5173/`, while the Vite dev server is configured with `port: 5180`.
  - Double-clicking the launcher therefore opened the wrong browser tab even though the app actually started on `localhost:5180`.
- Details:
  - Updated the launcher status text and `open` target from `5173` to `5180`.
  - Left Vite unchanged because it was already correctly pinned to `5180`.

2026-04-10 10:15 EDT - [Agent: Claude]
- Status: Complete
- Task: Change autoGenerateImages default to false, add footnote min/max to prompts
- Files:
  - services/sessionManagementService.ts:64 (added autoGenerateImages: false)
  - config/prompts.json:3-4 (updated footnote min/max to 1-3, images optional)
  - types.ts:362 (updated comment to reflect default: false)
- Why:
  - Images were auto-generating after every translation when image model was set, no manual control
  - Footnotes had no explicit min/max bounds

2026-04-09 11:35 EDT - [Agent: Codex]
- Status: Starting
- Task: Harden library-scoped chapter identity boundaries so already-scoped stable IDs are not silently re-scoped during import/bootstrap flows.
- Worktree: none (root checkout intentionally used because the active dev server on `localhost:5180` is serving this checkout)
- Branch: current checkout
- Files likely affected:
  - services/libraryScope.ts
  - services/importService.ts
  - services/db/operations/imports.ts
  - tests/services/stableIdService.test.ts
  - tests/current-system/export-import.test.ts
- Why:
  - Runtime logs show recursively wrapped IDs like `lf-library:...:lf-library:...ch2...`, which indicates the import boundary is accepting ambiguous `stableId` strings and scoping them more than once.
  - The current API contract does not distinguish `baseStableId` from `scopedStableId`, so multiple layers can reinterpret identity strings differently.

2026-04-09 11:40 EDT - [Agent: Codex]
- Status: Complete
- Task: Harden library-scoped chapter identity boundaries so already-scoped stable IDs are not silently re-scoped during import/bootstrap flows.
- Files:
  - services/libraryScope.ts:19-79
  - services/importService.ts:104-180
  - services/db/operations/imports.ts:78-148
  - tests/services/libraryScope.test.ts:1-46
  - tests/current-system/export-import.test.ts:304-343
- Why:
  - `buildScopedStableId(...)` previously accepted any string and relied on callers to know whether it was receiving a base ID or an already-scoped ID.
  - Import code was sourcing “base” IDs from `chapter.stableId` and `chapter.id`, which allowed pre-scoped exported IDs to be wrapped again.
- Details:
  - Added `isScopedStableId(...)` and `parseScopedStableId(...)` so the library identity layer can distinguish base IDs from scoped IDs explicitly.
  - Made `buildScopedStableId(...)` throw a descriptive error when a caller tries to scope an already-scoped ID, including both the existing and requested scope keys.
  - Updated `ImportService` and `ImportOps.resolveStoredChapterIdentity(...)` to preserve already-scoped IDs only when their scope matches the active novel/version, and to fail loudly on mismatches instead of silently nesting identities.
  - Added focused contract tests for the scope helpers and an integration test proving full-session import preserves an already-scoped chapter ID rather than double-scoping it.
- Tests:
  - `npx vitest run tests/services/libraryScope.test.ts tests/current-system/export-import.test.ts -t "scoped stableId import boundaries|libraryScope stableId boundaries"` ✅
  - `npx tsc --noEmit --pretty false` ✅

2026-04-09 11:49 EDT - [Agent: Codex]
- Status: Complete
- Task: Add and verify a one-time repair pass for already-corrupted scoped chapter identities and duplicate bookshelf resume entries.
- Files:
  - services/db/operations/maintenance.ts:1-629
  - store/bootstrap/initializeStore.ts:133-141
  - tests/current-system/scoped-identity-repair.test.ts:1-89
  - tests/store/bootstrap/bootstrapHelpers.test.ts:8-26,293-314,492-495
- Why:
  - Guarding new identity creation stops future nested IDs, but the user’s current IndexedDB already contains duplicate chapter rows and duplicate bookshelf-state entries.
  - The “two books to resume” symptom shows the persisted bookshelf state had duplicate entries for the same novel/version scope in addition to duplicated chapter identities.
- Details:
  - Added `MaintenanceOps.repairScopedStableIdDuplicates()` to detect duplicate chapter groups by `(novelId, libraryVersionId, chapterNumber, canonical source URL)`, choose a survivor, collapse nested scoped IDs, and rewrite dependent stores.
  - The repair rewrites `chapters`, `translations`, `feedback`, `url_mappings`, `chapter_summaries`, `amendment_logs`, `diffResults`, `navigation-history`, `lastActiveChapter`, and `bookshelf-state`.
  - Added the repair to boot initialization so it runs automatically as part of startup repairs and is tracked by a dedicated settings flag.
  - Added an integration test that seeds a clean and nested copy of the same chapter plus duplicate bookshelf entries, then verifies the repair collapses them to a single chapter and a single bookshelf scope key.
- Tests:
  - `npx vitest run tests/current-system/scoped-identity-repair.test.ts tests/store/bootstrap/bootstrapHelpers.test.ts` ✅
  - `npx tsc --noEmit --pretty false` ✅

2026-04-09 11:25 EDT - [Agent: Codex]
- Status: Progress
- Task: Split amendment proposals into prompt vs glossary kinds and route glossary accepts into a local override layer instead of mutating the imported base glossary.
- Files:
  - types.ts:57-80, 367-372
  - services/db/types.ts:1-7, 100-109, 190-199
  - services/glossaryService.ts:38-54
  - components/NovelLibrary.tsx:132-143
  - services/sessionManagementService.ts:45-48
  - services/prompts.ts:67-76, 86-111
  - services/translate/translationResponseSchema.ts:10-31, 236-254
  - services/ai/providers/openai.ts:99-124
  - services/ai/providers/gemini.ts:91-112
  - services/translationService.ts:74-138
  - store/slices/translationsSlice.ts:88-119, 843-949
  - components/AmendmentModal.tsx:22-180
  - tests/store/amendmentProposal.test.ts:16-49, 70-89, 167-186
  - tests/services/translationService.test.ts:97-104
  - tests/services/structured-outputs.test.ts:216-315
  - tests/utils/test-data.ts:122-128
- Why:
  - The old amendment pipeline had no way to distinguish prompt edits from glossary edits, so “glossary amendment” language either lied or risked silently rewriting prompt text instead of term data.
  - Imported library glossaries should remain the base source of truth, while user-approved term changes need a separate reversible local layer.
- Details:
  - Added explicit proposal kind metadata plus optional glossary payload fields, and validated them in the amendment-review response parser.
  - Introduced `glossaryBase` and `glossaryOverrides` settings fields; library imports now populate the base layer and keep the effective `glossary` as a merged view.
  - Updated the amendment accept path so glossary proposals write only to the override layer while prompt proposals keep editing `systemPrompt`.
  - Updated the modal and amendment-copy surfaces so glossary proposals are displayed and labeled differently from prompt proposals.
- Tests:
  - `npx vitest run tests/store/amendmentProposal.test.ts` ✅
  - `npx vitest run tests/services/translationService.test.ts` ✅
  - `npx vitest run tests/services/structured-outputs.test.ts` ✅
  - `npx vitest run components/settings/PromptPanel.test.tsx components/settings/AdvancedPanel.test.tsx` ✅

2026-04-09 13:20 EDT - [Agent: Codex]
- Status: Progress
- Task: Clarify the amendment/glossary contract and expose the active runtime glossary in the prompt workspace UI.
- Files:
  - components/settings/PromptPanel.tsx:28-37, 121-235
  - components/settings/PromptPanel.test.tsx:9-26, 121-137
  - components/settings/TranslationParametersSection.tsx:189-193
  - services/prompts.ts:67-115
  - components/settings/AdvancedPanel.test.tsx:194-204
  - docs/WORKLOG.md:1-17
- Why:
  - The library-imported glossary is persisted in `settings.glossary` and used in prompt construction, but the amendment UX still implies accepted proposals can update the glossary even though the current accept path only mutates `settings.systemPrompt`.
  - The active prompt editor is cramped for long prompts, and the loaded glossary is not visible where prompt context is actually managed.
- Details:
  - Made the amendment copy prompt-only in both the advanced settings checkbox and the amendment-review prompt builder so the AI no longer proposes glossary edits the accept flow cannot apply.
  - Added a read-only “Active glossary context” table to the Prompt panel, sourced directly from `currentSettings.glossary`, with term counts and truncation messaging for larger imports.
  - Improved prompt readability by making the active prompt editor taller, monospace, resizable, spellcheck-free, and expandable/collapsible for long prompt review.
  - Added focused tests covering the visible glossary summary, prompt editor expansion affordance, and the corrected amendment copy.
- Tests:
  - `npx vitest run components/settings/PromptPanel.test.tsx` ✅
  - `npx vitest run components/settings/AdvancedPanel.test.tsx` ✅

2026-04-09 10:58 EDT - [Agent: Codex]
- Status: Starting
- Task: Implement the principled chapter-deletion fix by moving the delete/dropdown boundaries to stableId + active library scope.
- Worktree: ../LexiconForge.worktrees/codex-scoped-chapter-delete/
- Branch: fix/codex-scoped-chapter-delete
- Files likely affected:
  - services/db/types.ts
  - services/db/operations/chapters.ts
  - services/db/operations/summaries.ts
  - services/db/operations/index.ts
  - services/importTransformationService.ts
  - hooks/useChapterDropdownOptions.ts
  - components/SessionInfo.tsx
  - tests/components/SessionInfo.test.tsx
  - docs/WORKLOG.md
- Why:
  - The current delete path uses `originalUrl` from the UI even though chapter persistence may be keyed by scoped storage URLs, so destructive actions can silently miss the actual chapter row.
  - The chapter dropdown currently consumes unscoped summaries plus in-memory state, which allows chapters from other novels to pollute the active novel’s dropdown and be auto-retranslated after selection.

2026-04-09 11:04 EDT - [Agent: Codex]
- Status: Complete
- Task: Implement the principled chapter-deletion fix by moving the delete/dropdown boundaries to stableId + active library scope.
- Files:
  - components/SessionInfo.tsx:40-49, 191-203
  - hooks/useChapterDropdownOptions.ts:109-229
  - services/db/operations/chapters.ts:13-16, 434-527, 620-622
  - services/db/operations/summaries.ts:123-126, 160-172, 265-280
  - services/db/operations/index.ts:12-20
  - services/db/types.ts:18-28
  - services/importTransformationService.ts:197-218
  - tests/components/SessionInfo.test.tsx:69-97, 153-157, 481-516, 605-640, 995-1018
- Why:
  - Chapter deletion needed to target the persisted chapter identity (`stableId` + active scope), not whichever URL the UI happened to hold.
  - Dropdown population needed to be scoped to the active novel/version before merging in-memory chapters so foreign chapters cannot reappear and trigger auto-translate.
- Details:
  - Added `ChapterOps.deleteByStableId(...)` with scope validation and cleanup across `chapters`, `chapter_summaries`, `translations`, and `url_mappings`.
  - Added `fetchChapterSummariesByScope(...)` and exposed it through `ImportTransformationService` so dropdown consumers can query the active library scope directly.
  - Updated `useChapterDropdownOptions()` to load scoped summaries and merge only in-memory chapters that match the active scope, while still supporting scope-less/manual sessions from memory.
  - Updated `SessionInfo` to call the new stableId delete contract when the user chooses “Delete chapter from database”.
  - Added regression coverage for the new delete contract and for excluding foreign-scope chapters from the dropdown; refreshed related formatting expectations to match the current display contract.
  - Added gated diagnostics on the delete intent, `deleteByStableId(...)` execution, scoped summary query, and final dropdown merge so we can trace whether a ghost chapter survived in IndexedDB summaries or was reintroduced from memory.
- Tests:
  - `npx vitest run tests/components/SessionInfo.test.tsx -t "handles chapter delete mode|loads chapter options from the active novel scope only|shows translated title when available|avoids duplicating chapter prefixes"` ✅
  - `npx tsc --noEmit --pretty false` ✅
  - `npx vitest run tests/components/SessionInfo.test.tsx` ⚠️ still has pre-existing publish-flow expectation drift around `Update Stats Only` in unrelated tests.

2026-04-05 08:30 EDT - [Agent: Gemini]
- Status: Complete
- Task: Resolve four user-reported friction points and bugs across translation, navigation, and UI.
- Files:
  - services/translate/Translator.ts
  - components/NovelLibrary.tsx
  - components/ChapterView.tsx
  - components/chapter/ChapterHeader.tsx
  - components/chapter/DiffMarkersPanel.tsx
  - docs/roadmaps/TECH-DEBT-STATUS.md
- Why:
  - Translation timeouts on OpenRouter lacked exponential backoff, causing immediate (and often failing) retries.
  - "Continue Reading" was restricted to library-curated novels, hiding manually fetched books.
  - The reader UI lacked a novel-level indicator, making it hard to track the active book.
  - Diff heatmap tooltips were cut off by the viewport edge due to fixed right-side positioning.
- Details:
  - Updated `Translator.ts` to include exponential backoff for all retryable errors (including timeouts).
  - Modified `NovelLibrary.tsx` to include and synthesize metadata for manually imported novels in "Continue Reading".
  - Updated `ChapterView.tsx` and `ChapterHeader.tsx` to resolve and display the novel title above chapter titles.
  - Flipped `DiffMarkersPanel.tsx` tooltips to `right-full` (left of marker) and added responsive max-width to prevent cutoffs.
- Tests:
  - Manual verification of UI layout and logic flow.
  - `npx tsc --noEmit` (to verify no type regressions in modified files)

2026-04-03 23:58 EDT - [Agent: Codex]
- Status: Progress
- Task: Resolve PR #25 merge conflicts against `main` without dropping the pasted-text regression fix or the new library/reader guardrails.
- Files:
  - components/InputBar.tsx:35-45, 113-133
  - store/slices/chaptersSlice.ts:12-17
  - tests/components/InputBar.test.tsx:1-214
  - docs/WORKLOG.md:1-18
- Why:
  - `main` added shelving and reader-handoff behavior around imports while the PR added pasted-text import plus a failure-preservation fix; the merge conflict had to preserve both behaviors, and pasted-text import now needs to re-enter the reader in the newer app shell.
- Details:
  - Merged `InputBar` so pasted imports keep the failure-preservation behavior, shelf the active library novel before import, and call `setReaderReady()` only after a successful custom-text import.
  - Merged `chaptersSlice` imports so the PR keeps `importCustomText(...)` and `main` keeps bookshelf persistence wiring.
  - Rebuilt the `InputBar` test file to cover both `main`’s shelving guardrails and the custom-text regression path, including the successful paste reader-handoff expectation.
- Tests:
  - `npx vitest run tests/components/InputBar.test.tsx` ✅

2026-04-03 11:40 EDT - [Agent: Codex]
- Status: Progress
- Task: Fix PR #25 review regression where failed custom-text imports clear the paste form and force the user to re-paste everything.
- Files:
  - components/InputBar.tsx
  - tests/components/InputBar.test.tsx
  - docs/WORKLOG.md
- Why:
  - `InputBar` was clearing the paste form unconditionally after awaiting `importCustomText(...)`, even though the store reports failure by returning `undefined` instead of throwing.
- Details:
  - Updated the paste-submit path to clear the title/language/content fields only when `importCustomText(...)` returns a chapter id.
  - Added focused component coverage for both failure preservation and success clearing so the UI contract stays explicit.
- Tests:
  - `npx vitest run tests/components/InputBar.test.tsx` ✅
2026-04-03 11:40 EDT - [Agent: Codex]
- Status: Progress
- Task: Fix the PR #30 review regression where selection-based illustration planning still fails hard when the planner request or JSON parse path breaks.
- Files:
  - services/imagePlanPlanner.ts
  - tests/services/imagePlanPlanner.test.ts
  - docs/WORKLOG.md
- Why:
  - Caption-based planning already fell back to a caption-derived `ImagePlan`, but the text-selection flow still returned `null` on the same planner failures because it skipped that fallback wrapper.
- Details:
  - Extracted a shared planner-with-fallback helper so both caption-based and selection-based illustration planning degrade to a caption-derived `ImagePlan`.
  - Added a regression test that forces the selection planner path to reject and verifies that the returned payload still contains a usable fallback prompt and plan.
- Tests:
  - `npx vitest run tests/services/imagePlanPlanner.test.ts` ✅

2026-04-02 23:02 EDT - [Agent: Codex]
- Status: Starting
- Task: Fix OpenRouter model picker ordering so free text models sort first, and replace the brittle OpenRouter image-model/filter path with a verified adapter aligned to current OpenRouter image-generation docs.
- Worktree: ../LexiconForge.worktrees/codex-openrouter-image-json/
- Branch: fix/codex-openrouter-image-json
- Files likely affected:
  - store/slices/settingsSlice.ts
  - services/openrouterService.ts
  - components/settings/ProvidersPanel.tsx
  - components/settings/TranslationEngineSection.tsx
  - services/imageService.ts
  - services/imageGenerationService.ts
  - config/constants.ts
  - tests/components/ProvidersPanel.test.tsx
  - docs/WORKLOG.md
- Why:
  - Free OpenRouter text models currently sort as unknown-price entries and sink to the bottom of the picker.
  - OpenRouter’s website, `/models` filters, and image-generation docs now expose a clearer image-capable contract than the app’s current mixed static-list plus stale-cache behavior.

2026-04-02 23:19 EDT - [Agent: Codex]
- Status: Complete
- Progress:
  - Treated OpenRouter zero-cost text pricing as real `0.00` pricing in `store/slices/settingsSlice.ts:465-500`, which lets free models participate in price sorting instead of being pushed to the bottom as unknown-price entries.
  - Reordered the OpenRouter text dropdown in `components/settings/ProvidersPanel.tsx:260-307` so free models are grouped first, followed by paid recents, then the remaining priced models.
  - Replaced stale OpenRouter image-model UI assembly with a verified adapter in `services/openrouterImageModelAdapter.ts:1-298`, using `https://openrouter.ai/api/v1/models?output_modalities=image`, cache-backed profiles, request modality derivation, and conservative `image_config` shaping for supported Google image models.
  - Switched the image picker to that verified catalog in `components/settings/ProvidersPanel.tsx:120-131` and `components/settings/ProvidersPanel.tsx:334-379`, and removed stale hardcoded OpenRouter image entries from `config/constants.ts:44-54`.
  - Updated OpenRouter image execution in `services/imageService.ts:79-97` and `services/imageService.ts:255-333` to validate against the verified catalog before requests, select the correct `modalities`, and attach `image_config` only when the verified model profile supports it.
  - Corrected image-pricing/help copy in `components/settings/TranslationEngineSection.tsx:203-226` so the UI no longer implies all image generation uses Gemini credentials or fixed per-image pricing.
  - Added regression coverage in `components/settings/ProvidersPanel.test.tsx:8-31`, `components/settings/ProvidersPanel.test.tsx:155-160`, and `components/settings/ProvidersPanel.test.tsx:493-514`, plus a new adapter suite in `tests/services/openrouterImageModelAdapter.test.ts:1-133`.
- Validation:
  - `npx vitest run components/settings/ProvidersPanel.test.tsx tests/services/openrouterImageModelAdapter.test.ts` ✅
  - `npx tsc --noEmit --pretty false` ⚠️ blocked by pre-existing unrelated `scripts/sutta-studio/*` errors:
    - `scripts/sutta-studio/benchmark.ts`
    - `scripts/sutta-studio/debug-single-model.ts`
    - `scripts/sutta-studio/generate-new-phases.ts`
- Notes:
  - Linked the worktree to the main checkout’s existing `node_modules` for validation only; no dependency manifest changes were made.

2026-04-02 23:42 EDT - [Agent: Codex]
- Status: Complete
- Task: Add a structured `ImagePlan` layer while keeping the caption human-facing, and expose a JSON editor toggle in the illustration UI.
- Files:
  - `types.ts`
  - `services/imagePlanService.ts`
  - `services/illustrationService.ts`
  - `services/ai/responseValidators.ts`
  - `services/translate/translationResponseSchema.ts`
  - `services/ai/providers/openai.ts`
  - `services/ai/providers/gemini.ts`
  - `services/claudeService.ts`
  - `services/imageGenerationService.ts`
  - `store/slices/imageSlice.ts`
  - `store/slices/translationsSlice.ts`
  - `components/Illustration.tsx`
  - `components/illustration/IllustrationPromptEditor.tsx`
  - `services/db/types.ts`
  - `services/db/index.ts`
  - `services/readerHydrationService.ts`
  - `store/slices/exportSlice.ts`
  - `tests/services/imagePlanService.test.ts`
  - `tests/services/structured-outputs.test.ts`
  - `config/prompts.json`
- Why:
  - `imagePrompt` was overloaded as caption, editable prompt, persisted source of truth, and provider payload, which made it impossible to introduce structured prompting without breaking the reader-facing caption flow.
  - The reader explicitly asked for a visible JSON plan editor rather than a hidden internal plan.
- Details:
  - Added typed `ImagePlan` and `imagePlanMode` (`auto` vs `manual`) to suggested illustrations and generation metadata.
  - Added `services/imagePlanService.ts` to seed plans from captions, normalize/parse editable JSON, and compile provider-aware prompts from caption + plan.
  - Translation/manual illustration generation now produces or backfills `imagePlan`, while schema-based translation providers may emit it directly.
  - Image generation now compiles prompts from the structured plan but preserves the human caption separately in metadata/exports.
  - The illustration UI now exposes caption vs JSON-plan tabs, supports manual JSON edits, and preserves the “caption stays readable” requirement.
- Validation:
  - `npx vitest run tests/services/imagePlanService.test.ts tests/services/structured-outputs.test.ts components/settings/ProvidersPanel.test.tsx tests/services/openrouterImageModelAdapter.test.ts` ✅
  - `npx tsc --noEmit --pretty false` remains blocked by unrelated existing `scripts/sutta-studio/*` errors.
  - Filtered `tsc` pass over touched files produced no matching errors. ✅

2026-04-03 00:12 EDT - [Agent: Codex]
- Status: Complete
- Task: Replace heuristic auto-plan seeding with a real AI-backed `caption -> ImagePlan` planner, and add an explicit UI action to regenerate JSON from the caption.
- Files:
  - `config/prompts.json:51-53`
  - `docs/adr/FEAT-003-image-service-architecture.md:6-14`
  - `services/imagePlanPlanner.ts:1-431`
  - `services/illustrationService.ts:1-34`
  - `store/slices/imageSlice.ts:16-18,51-53,166-189,1085-1207`
  - `components/Illustration.tsx:23-40,198-206,336-381,474,563,702`
  - `components/illustration/IllustrationPromptEditor.tsx:9-22,47,101-110`
  - `tests/services/imagePlanPlanner.test.ts:1-134`
  - `tests/store/slices/imageSlice.imagePlan.test.ts:1-179`
- Why:
  - `auto` mode was still using `buildImagePlanFromCaption(...)`, which only produced a shallow structural seed and did not satisfy the requirement that AI should author the JSON plan from prompt examples.
  - The JSON toggle needed a recovery path so manual editors could hand control back to AI without writing the schema from scratch.
- Details:
  - Updated `docs/adr/FEAT-003-image-service-architecture.md` implementation notes so the image architecture doc reflects the new structured planning layer and verified OpenRouter image-model adapter.
  - Added `services/imagePlanPlanner.ts` as a provider-aware planner transport for OpenAI/DeepSeek/OpenRouter, Gemini, and Claude, using the new few-shot planner prompts plus JSON/schema enforcement where available and caption-derived fallback only when the planner fails.
  - Refactored `services/illustrationService.ts` to reuse that shared planner path so selection-based illustration prompts and editor auto-plans follow the same structured prompt contract.
  - Replaced heuristic auto-plan writes in `store/slices/imageSlice.ts` with planner calls, preserved manual JSON ownership on caption edits, and added `regenerateIllustrationPlanFromCaption(...)` to explicitly switch an illustration back to AI-owned JSON.
  - Updated the illustration editor UI to expose an `AI Regenerate JSON` action and guard against stomping unsaved local JSON edits.
- Validation:
  - `npx vitest run tests/services/imagePlanPlanner.test.ts tests/store/slices/imageSlice.imagePlan.test.ts tests/services/imagePlanService.test.ts tests/services/structured-outputs.test.ts components/settings/ProvidersPanel.test.tsx tests/services/openrouterImageModelAdapter.test.ts` ✅
  - `npx tsc --noEmit --pretty false` ⚠️ still blocked only by pre-existing unrelated `scripts/sutta-studio/benchmark.ts`, `scripts/sutta-studio/debug-single-model.ts`, and `scripts/sutta-studio/generate-new-phases.ts` errors.

### [2026-04-02 23:15 EDT] [Agent: Codex]
**Status:** Progress
**Task:** Address the two concrete PR review bugs without expanding scope into the `translationsSlice.ts` refactor.
**Files modified / created:**
- `services/clientTelemetry.ts:104-106`
  - Removed the `VERCEL_URL` fallback from `getBuildId()` so telemetry only records an actual build identifier (`VERCEL_GIT_COMMIT_SHA`, `VITE_APP_BUILD_ID`) or `null`.
- `MainApp.tsx:216-245`
  - Kept the auto-translate fingerprint guard intact on unexpected failures so the same chapter/settings pair is not auto-requested again after a rejected translation attempt.
- `tests/services/clientTelemetry.test.ts:100-126`
  - Added focused coverage that `VERCEL_URL` alone does not populate `build_id` in the callback payload.
- `tests/store/appScreen.integration.test.tsx:36-38,76-77,194-218`
  - Added a regression test that an unexpected auto-translate failure does not trigger the same chapter again after the component re-renders.
**Verification:**
- `export PATH="$HOME/.nvm/versions/node/v22.17.0/bin:$PATH" && npx vitest run tests/services/clientTelemetry.test.ts tests/store/appScreen.integration.test.tsx` ✅
- `export PATH="$HOME/.nvm/versions/node/v22.17.0/bin:$PATH" && npm run build` ✅

### [2026-04-02 21:49 EDT] [Agent: Codex]
**Status:** Progress
**Task:** Address the post-review async-boundary regression, rebase the telemetry branch onto current `main`, and rerun the merge-blocking checks.
**Files modified / created:**
- `MainApp.tsx:216-247`
  - Normalized the auto-translate call through `Promise.resolve().then(...)` so the catch path handles sync throws, `undefined` returns, and real promises uniformly instead of assuming a thenable.
- `tests/store/appScreen.integration.test.tsx:19-22,60-63`
  - Updated the mocked `handleTranslate` contract to match the intended async shape and locked in the regression coverage that originally failed on `.catch()` against `undefined`.
- `docs/WORKLOG.md:1-14`
  - Recorded the post-review regression fix, the rebase result, and the verification nuance around mixed-suite timeout noise versus isolated passing runs.
**Rebase / branch maintenance:**
- Rebasing `fix/codex-telemetry-ux` onto `origin/main` picked up `ff5d821` (fresh-install v16 schema fix) and `54d4279` (navigationService debugWarn mock fix).
- The only rebase conflict was this worklog file; code paths rebased cleanly.
**Verification:**
- `export PATH="$HOME/.nvm/versions/node/v22.17.0/bin:$PATH" && npx vitest run tests/store/appScreen.integration.test.tsx` ✅ before rebase
- `export PATH="$HOME/.nvm/versions/node/v22.17.0/bin:$PATH" && npx vitest run tests/store/appScreen.integration.test.tsx tests/db/migrations/fresh-install.test.ts tests/services/navigationService.test.ts tests/components/NotificationToast.test.tsx tests/components/DefaultKeyBanner.test.tsx tests/components/chapter/ChapterContent.test.tsx tests/current-system/translation.test.ts tests/services/clientTelemetry.test.ts tests/services/api-key-validation.test.ts tests/api/client-telemetry.test.ts tests/smoke/critical-components.smoke.test.tsx` ⚠️ `fresh-install` and `navigationService` passed after rebase, but `appScreen.integration` and the smoke import hit timeout-shaped failures under the combined suite.
- `export PATH="$HOME/.nvm/versions/node/v22.17.0/bin:$PATH" && npx vitest run tests/store/appScreen.integration.test.tsx` ✅ after rebase
- `export PATH="$HOME/.nvm/versions/node/v22.17.0/bin:$PATH" && npx vitest run tests/smoke/critical-components.smoke.test.tsx` ✅ after rebase
- `export PATH="$HOME/.nvm/versions/node/v22.17.0/bin:$PATH" && npm run build` ✅
**Notes:**
- The remaining timeout-shaped failures reproduced only in the large mixed suite and not in isolated reruns, matching the earlier cold-cache contention pattern already documented for this branch.

### [2026-04-02 02:22 EDT] [Agent: Codex]
**Status:** Progress
**Task:** Close the remaining app-shell review gap and verify deployed Vercel routing for the client telemetry callback.
**Files modified / created:**
- `MainApp.tsx:307-394`
  - Collapsed the duplicated `NotificationToast` mounts into a single top-level render while preserving the existing branch-specific screen content, so screen transitions no longer remount the toast six times.
- `docs/guides/DEPLOYMENT.md:67-78`
  - Recorded the actual Vercel proof results: local `vercel build` recognized the function, deployed `vercel curl` hit the handler on `/api/client-telemetry`, and the current catch-all Vite rewrite did not shadow the API route.
- `docs/WORKLOG.md:1-13`
  - Logged the review-follow-up fix and the route-verification evidence so the deployment decision does not have to be re-investigated later.
**Operational notes:**
- `vercel pull --yes` linked this isolated worktree to a temporary Vercel project named `codex-telemetry-ux` and downloaded local env/project metadata. I kept those artifacts out of the tracked diff via the local Git exclude file instead of committing generated ignore noise.
- `vercel build` briefly regenerated `public/steering-images.json` because the build prepare script could not find `public/steering/` in the worktree environment; that generated change was restored so the branch stays scoped to telemetry/app-shell work.
**Verification:**
- `export PATH="$HOME/.nvm/versions/node/v22.17.0/bin:$PATH" && npx vitest run tests/components/NotificationToast.test.tsx tests/components/DefaultKeyBanner.test.tsx tests/components/chapter/ChapterContent.test.tsx tests/current-system/translation.test.ts tests/services/clientTelemetry.test.ts tests/services/api-key-validation.test.ts` ✅
- `export PATH="$HOME/.nvm/versions/node/v22.17.0/bin:$PATH" && npm run build` ✅
- `export PATH="$HOME/.nvm/versions/node/v22.17.0/bin:$PATH" && npx vercel build` ✅
- `export PATH="$HOME/.nvm/versions/node/v22.17.0/bin:$PATH" && npx vercel deploy --prebuilt --archive=tgz --yes` ✅ after one inconclusive raw-upload attempt failed with `FetchError: write EPIPE`
- `export PATH="$HOME/.nvm/versions/node/v22.17.0/bin:$PATH" && npx vercel curl /api/client-telemetry --deployment https://codex-telemetry-fa9kmjyhm-adityas-projects-9c03351d.vercel.app` ✅ returned the function’s `405` JSON for GET
- `export PATH="$HOME/.nvm/versions/node/v22.17.0/bin:$PATH" && npx vercel curl /api/client-telemetry --deployment https://codex-telemetry-fa9kmjyhm-adityas-projects-9c03351d.vercel.app -- --request POST --header 'content-type: application/json' --data '{"event_type":"translation_failed"}'` ✅ returned `200 {"ok":true,...}`

### [2026-04-01 16:51 EDT] [Agent: Codex]
**Status:** Starting
**Task:** Implement the approved Phase 0.5 UX fixes for translation failures and add a Vercel `/api/client-telemetry` proof of concept in an isolated worktree.
**Worktree:** ../LexiconForge.worktrees/codex-telemetry-ux/
**Branch:** fix/codex-telemetry-ux
**Files likely affected:**
- components/DefaultKeyBanner.tsx
- components/ChapterView.tsx
- components/chapter/ChapterContent.tsx
- store/slices/translationsSlice.ts
- services/translationService.ts
- services/translate/Translator.ts
- store/slices/uiSlice.ts
- MainApp.tsx
- vercel.json
- api/client-telemetry.js
- docs/guides/DEPLOYMENT.md
- docs/WORKLOG.md
**Why:**
- Current production behavior still has three concrete gaps: the trial banner logic is inverted, notifications are written but not rendered, and auto-translate is still fire-and-forget with no catch path.
- Inline reader errors and provider timeout support are already present on `origin/main`, so this slice will only close the remaining UX and ingress gaps instead of redoing those changes.

### [2026-04-01 17:10 EDT] [Agent: Codex]
**Status:** Progress
**Task:** Phase 0.5 UX fixes and Phase 1 Vercel callback proof completed in the isolated worktree.
**Files modified / created:**
- `components/DefaultKeyBanner.tsx:22-30`
  - Fixed the shared-trial banner gate so it shows when `VITE_DEFAULT_OPENROUTER_KEY` is actually present and no user OpenRouter key is active.
- `store/slices/translationsSlice.ts:117-130`
  - Kept fail-fast API-key validation before translation state starts and now explicitly clear stale `ui.error` once validation passes so an old error does not linger into a valid retry.
- `components/NotificationToast.tsx:1-73` (new)
  - Added the missing renderer for store-backed notifications with auto-dismiss and manual dismiss so `showNotification()` produces visible UI.
- `MainApp.tsx:12,216-223,284-385`
  - Mounted the new notification toast on every app screen and added a `.catch(...)` on the fire-and-forget auto-translate path so unexpected promise failures surface as visible errors instead of disappearing.
- `api/client-telemetry.js:1-80` (new)
  - Added a minimal Vercel Node function proof for `POST /api/client-telemetry` with method checks, size guard, basic payload validation, and normalized log output.
- `docs/guides/DEPLOYMENT.md:61-75`
  - Documented the callback proof route and the explicit best-effort policy: callback failures must never degrade reader UX and should be dropped silently.
- `tests/components/chapter/ChapterContent.test.tsx:97-110`
  - Locked in the user-facing fix that inline translation errors win over the loader.
- `tests/components/DefaultKeyBanner.test.tsx:1-55` (new)
  - Added coverage for the corrected trial-banner visibility rules.
- `tests/components/NotificationToast.test.tsx:1-53` (new)
  - Added coverage for toast rendering, auto-dismiss, and manual dismiss.
- `tests/api/client-telemetry.test.ts:1-76` (new)
  - Added request-shape coverage for the callback proof handler.
**Verification:**
- `npx vitest run tests/components/DefaultKeyBanner.test.tsx tests/components/NotificationToast.test.tsx tests/components/chapter/ChapterContent.test.tsx tests/api/client-telemetry.test.ts tests/smoke/critical-components.smoke.test.tsx` ✅
- `npm run build` ✅
- `npx vercel build` ❌ blocked locally because the repo does not have Vercel project settings checked in (`No Project Settings found locally. Run vercel pull --yes to retrieve them.`). The handler proof is implemented and unit-tested, but deployed-function verification still needs either `vercel pull --yes` or a preview deployment.
- Note: the first cold Vitest run timed out once on `tests/smoke/critical-components.smoke.test.tsx > Smoke: App.tsx > imports without error` while the production build was running in parallel. The same smoke test passed immediately on a clean rerun in both the isolated worktree and the untouched root checkout, so this looks like a cache/timing artifact rather than a functional regression from this slice.

### [2026-04-01 17:49 EDT] [Agent: Codex]
**Status:** Progress
**Task:** Implemented the approved v1 client telemetry slice on top of the UX fixes.
**Files modified / created:**
- `types/telemetry.ts:1-109` (new)
  - Added the narrow v1 runtime contract: event/failure/surface enums, callback payload shape, analytics payload shape, and the `TelemetryErrorContext` carried from failure detection to visible render.
- `services/clientTelemetry.ts:1-286` (new)
  - Added a single redacting transport layer for analytics + best-effort callback delivery, including route/loading-state capture, payload hashing, dedupe windows, and silent drop on callback failure.
- `store/slices/uiSlice.ts:38-40,80,131-132,240-248`
  - Added `errorTelemetry` alongside `error` and taught `setError(...)` to carry optional telemetry metadata so UI render paths know the underlying failure class without re-parsing error strings.
- `services/ai/apiKeyValidation.ts:18-22,24-33,74-80`
  - Extended API-key validation to return structured `failureType` values (`trial_limit`, `missing_api_key`, `unknown`) instead of only free-form strings.
- `services/translationService.ts:30-39,109-117,214-225,232-249`
  - Extended `TranslateChapterResponse` with `failureType`/`expected` metadata and classified thrown translator errors into `timeout`, `provider_malformed_response`, or `unknown`.
- `store/slices/translationsSlice.ts:41-43,85-130,146-198,311-359,474-476,791-793`
  - Added the translation-failure emitter at the slice boundary, recorded fail-fast validation failures in `translationProgress`, propagated telemetry metadata into `setError(...)`, and distinguished `auto_translate` vs `manual_translate`.
- `services/telemetryService.ts:7,11-19,48-55,138-140,146-186,220-261`
  - Kept the existing local telemetry buffer/export path but now forwards uncaught errors, unhandled rejections, and queued boot-time failures into the new client telemetry channel.
- `components/ChapterView.tsx:53-55,409-410`
  - Passed store-backed error telemetry into the reader content surface when an English translation error is being rendered.
- `components/chapter/ChapterContent.tsx:10-11,39-40,72-99`
  - Emitted `ui_error_rendered` from the component that actually renders the inline translation failure state.
- `components/DefaultKeyBanner.tsx:63-80`
  - Emitted `ui_error_rendered` when the exceeded-trial banner becomes visible, so trial-limit visibility is measurable rather than inferred.
- `MainApp.tsx:217-240`
  - Classified unexpected auto-translate promise failures as `translation_failed` and attached matching telemetry metadata to the surfaced store error.
- `tests/services/clientTelemetry.test.ts:1-118` (new)
  - Added transport tests for analytics-only expected failures, callback dedupe for unexpected translation failures, and full-event dedupe for visibility events.
- `tests/current-system/translation.test.ts:9-17,73-81,137-164`
  - Added a slice-level assertion that a classified service error becomes a `translation_failed` telemetry event at the store boundary.
- `tests/components/DefaultKeyBanner.test.tsx:5-7,26-30,68-87`
  - Added coverage that the visible exceeded-trial banner emits `ui_error_rendered`.
- `tests/components/chapter/ChapterContent.test.tsx:9-17,111-139`
  - Added coverage that the inline reader error emits `ui_error_rendered` with the underlying failure type.
- `tests/services/api-key-validation.test.ts:74-87,188-198`
  - Locked in the new structured `failureType` outputs for missing-key and unknown-provider cases.
**Verification:**
- `npx vitest run tests/services/clientTelemetry.test.ts tests/services/api-key-validation.test.ts tests/current-system/translation.test.ts tests/components/DefaultKeyBanner.test.tsx tests/components/chapter/ChapterContent.test.tsx tests/components/NotificationToast.test.tsx tests/api/client-telemetry.test.ts` ✅
- `npx vitest run tests/smoke/critical-components.smoke.test.tsx` ✅
- `npm run build` ✅
- Notes:
  - Build still reports the pre-existing dynamic-import chunking warnings from the DB/telemetry/image graph, but the bundle completes successfully.
  - The `setError stack trace` stderr in `tests/current-system/translation.test.ts` is expected from the existing debug-heavy `uiSlice.setError(...)` implementation and not a test failure.

2026-03-30 05:17 PDT - [Agent: Codex] /metaupdate debt capture workflow
- Files:
  - AGENTS.md:274-292
  - docs/WORKLOG.md:1-8
- Why:
  - The repo had chronology in `WORKLOG` and curated debt in `TECH-DEBT-STATUS`, but no formal inbox for organic maintainability findings discovered during feature work.
- Details:
  - Added `DEBT_CAPTURE_PROTOCOL` to `AGENTS.md`.
  - Standardized the split between `docs/WORKLOG.md` for chronology, `docs/roadmaps/TECH-DEBT-INBOX.md` for append-only raw debt receipts, `docs/roadmaps/TECH-DEBT-STATUS.md` for curated debt, and `docs/architecture/ARCHITECTURE.md` §7 for structural hotspots only.
  - Added grep-friendly `[DEBT]`-style prefixes so actionable findings can be filtered later instead of disappearing into rotated logs.
- Tests: Not run (docs/process update only).

2026-03-29 22:35 PDT - [Agent: Codex] FMC partial artifact finalized for publication
- Files:
  - external repo: /Users/aditya/Documents/Ongoing Local/lexiconforge-novels/novels/forty-millenniums-of-cultivation/metadata.json
  - external repo: /Users/aditya/Documents/Ongoing Local/lexiconforge-novels/novels/forty-millenniums-of-cultivation/session.json
  - external repo: /Users/aditya/Documents/Ongoing Local/lexiconforge-novels/novels/forty-millenniums-of-cultivation/build-report.json
  - external repo: /Users/aditya/Documents/Ongoing Local/lexiconforge-novels/novels/forty-millenniums-of-cultivation/recovery/alignment-maps/hole-766.json
  - external repo: /Users/aditya/Documents/Ongoing Local/lexiconforge-novels/novels/forty-millenniums-of-cultivation/recovery/alignment-maps/hole-1911.json
  - external repo: /Users/aditya/Documents/Ongoing Local/lexiconforge-novels/novels/forty-millenniums-of-cultivation/recovery/alignment-maps/hole-2187.json
  - external repo: /Users/aditya/Documents/Ongoing Local/lexiconforge-novels/novels/forty-millenniums-of-cultivation/recovery/alignment-maps/hole-2348.json
  - external repo: /Users/aditya/Documents/Ongoing Local/lexiconforge-novels/novels/forty-millenniums-of-cultivation/cover.jpg
  - external repo: /Users/aditya/Documents/Ongoing Local/lexiconforge-novels/registry.json
- Why:
  - The FMC partial release needed honest runtime metadata, a local cover asset, and the four verified hole recoveries before any attempt to extend the translation past chapter 2387.
- Details:
  - Rebuilt the hosted-library artifact from the GB18030 raw TXT plus the PDF-backed English range and the four manually verified NovelHi recoveries.
  - Verified chapters 766, 1911, 2187, and 2348 now carry English fan translation, while chapter 2388 remains raw-only.
  - Added richer title/tag/source metadata and switched the provided cover image to an optimized derived JPEG for publication rather than a 10 MB raw PNG.
  - Confirmed the build report now shows `translatedChapterCount = 2387` with missing fan-translation warnings beginning at chapter 2388.
- Tests:
  - `npx tsx scripts/build-library-session.ts /tmp/fmc-hole-recovery-manifest.json` ✅
  - targeted JSON inspection of chapters `766`, `1911`, `2187`, `2348`, and `2388` ✅

2026-03-29 21:50 PDT - [Agent: Codex] Hole-resolution prep: adapter-spec aware alignment CLI
- Files:
  - scripts/lib/source-input.ts
  - scripts/discover-chapter-alignment.ts
  - tests/scripts/source-input.test.ts
- Why:
  - The alignment discovery CLI incorrectly treated all source inputs as filesystem paths, which broke `novelhi://...` range specs even though the adapter itself supported them.
  - FMC hole recovery needs the existing binary-search alignment pipeline to work directly against NovelHi candidate windows.
- Details:
  - Added a small source-input helper that preserves URL/custom-scheme adapter specs and only resolves real filesystem paths.
  - Updated `discover-chapter-alignment.ts` to use the helper for `--raw` and `--fan`.
  - Added focused tests for URL/spec preservation vs. filesystem path resolution.
- Tests:
  - `npx vitest run tests/scripts/source-input.test.ts tests/scripts/novelhi-adapter.test.ts tests/scripts/chapter-alignment-discovery.test.ts tests/scripts/library-session-builder.test.ts` ✅

2026-03-29 17:28 PDT - [Agent: Codex] Starting principled novel import pipeline
- Status: Starting
- Task: Build a reusable source-import pipeline for monolithic TXT, PDF, and EPUB inputs that can emit hosted-library `metadata.json + session.json` artifacts, then use it to generate Forty Millenniums of Cultivation with PDF chapters 1-2387 and `@NovelsZaraki.epub` for 2388+.
- Worktree: ../LexiconForge.worktrees/codex-book-switching-shelf/
- Branch: feat/codex-book-switching-shelf
- Files likely affected:
  - scripts/lib/translation-sources.ts
  - scripts/lib/*.ts (new importer helpers)
  - scripts/polyglot-merge.ts or successor builder script
  - tests/scripts/* or adjacent vitest coverage
  - docs/WORKLOG.md
- Why:
  - Existing importer foundation supports EPUB, TXT directories, and Polyglotta JSON only.
  - Hosted library artifacts use `lexiconforge-session`, not the richer `lexiconforge-full-1` payload emitted by `polyglot-merge`.
  - This title needs principled range-based source selection: raw Chinese TXT for `content`, PDF for English `fanTranslation` chapters 1-2387, and `@NovelsZaraki.epub` after that.

2026-03-29 17:04 PDT - Planned future feature: raw source discovery and library search
- Files:
  - docs/superpowers/specs/2026-03-29-raw-source-discovery-library-search-design.md
  - docs/superpowers/plans/2026-03-29-raw-source-discovery-library-search.md
- Why: Capture the approved future feature for searching fan titles, resolving canonical Chinese novel identity, finding likely raw sources, and adding books to the library without manually hunting for raw sites.
- Details:
  - Recorded the approved design direction as a metadata-first resolver: `Novel Updates -> canonical Chinese identity -> official-platform search -> mirror fallback`.
  - Explicitly classified UUkanshu, Piaotian, Dxmwx, and Kanunu as discovery/fallback sources rather than canonical identity sources.
  - Marked the feature as approved and waiting for implementation in both the spec and plan docs.
- Tests: Not run (docs only).

2026-03-29 16:42 PDT - Principled deep links + principled public/developer error split
- Files:
  - services/appError.ts:1-54
  - services/scraping/fetcher.ts:18-34, 199-231
  - services/navigation/fetcher.ts:11, 175-184
  - services/navigation/history.ts:4-59
  - services/navigation/index.ts:393-400
  - store/slices/chaptersSlice.ts:410-416, 497-504, 522-525
  - services/registryService.ts:51-63
  - store/bootstrap/initializeStore.ts:23-35, 137-267
  - MainApp.tsx:148-165
  - tests/store/bootstrap/bootstrapHelpers.test.ts
  - tests/services/navigationService.test.ts
  - tests/services/registryService.test.ts
- Why: Shared links only carried `?chapter=...`, so incognito/device-open flows lost the library novel/version context and landed on the library first. Separately, scraper diagnostics were crossing the boundary into UI state, exposing proxy health internals directly to readers.
- Details:
  - Added `AppError` so failures can keep a short `userMessage` alongside verbose `developerMessage` and diagnostics.
  - Updated the scraper fetch path to throw typed public-vs-debug errors instead of one giant user-visible blob.
  - Updated navigation fetch handling to surface only the public message to UI state while preserving console diagnostics.
  - Extended reader browser history to preserve `novel`, optional `version`, and `chapter` so links can reconstruct the reading target.
  - Moved `?chapter` handling fully into bootstrap so `?novel + ?version + ?chapter` composes as import/hydrate first, then navigate, without a library-first flash.
  - Added registry lookup by `novel.id` so bootstrap can resolve principled shared links from canonical library identity.
- Tests:
  - `npx vitest run tests/store/bootstrap/bootstrapHelpers.test.ts tests/services/navigationService.test.ts tests/services/registryService.test.ts tests/current-system/navigation.test.ts tests/components/InputBar.test.tsx tests/store/appScreen.integration.test.tsx` ✅
  - `npx tsc --noEmit --pretty false` ⚠️ pre-existing failures only in `scripts/sutta-studio/*`

2026-01-31 14:40 UTC - Ripple examples empirically validated
- Files: services/suttaStudioPassPrompts.ts, config/suttaStudioExamples.ts, scripts/sutta-studio/benchmark-config.ts
- Why: Fix "was dwells" grammatical issue where ghost words don't match selected verb tense.
- Details:
  - Added ripple example to lexicographer prompt showing how to adjust ghost words based on sense selection
  - Pre-ripple: trinity-large/minimax-m2 generated 0 ripples for viharati (p5)
  - Post-ripple: trinity-large generates 3 proper ripples:
    - "dwells" (habitual) → `ripples: { "e10": "" }` (removes "was")
    - "stays" (temporary) → `ripples: { "e10": "was" }` (keeps "was")
    - "abides" (spiritual) → `ripples: { "e10": "" }` (removes "was")
  - Models now understand when/how to use ripples for grammatical English
- Tests: Benchmark phase-b with trinity-large confirmed ripple generation.

2026-01-28 13:00 UTC - Full docs/ reorganization into subfolders
- Files: 38 docs moved from docs/ root into docs/features/, docs/guides/, docs/architecture/, docs/roadmaps/, docs/infrastructure/
- Why: Flat structure with 41 files was hard to navigate; organize by domain for discoverability.
- Details:
  - Created 5 new folders: features/ (9 docs), guides/ (8 docs), roadmaps/ (7+3 new docs), infrastructure/ (3+2 new docs), architecture/ (1 doc)
  - Archived 4 stale docs (TECH-DEBT-REDUCTION-PLAN, TYPESCRIPT-ERROR-ANALYSIS, TYPESCRIPT-FIX-PLAN, RELEASE_NOTES) with superseded-by headers
  - Archived 3 completed plans (INDEXEDDB-DECOMPOSITION-PLAN, INDEXEDDB-FACADE-MIGRATION, LEGACY_REPO_RETIREMENT_PLAN) to archive/completed/
  - Created 3 new replacement docs: TYPESCRIPT-HEALTH.md, TECH-DEBT-STATUS.md, CHANGELOG.md
  - Added status banners to 4 incomplete docs (NOVEL_LIBRARY_STATUS, MEMORY_OPTIMIZATION, COMPONENT-DECOMPOSITION, COMMUNITY_LIBRARY)
  - Created README.md with content index and "Missing Documentation" checklist in each folder
  - Updated START_HERE.md with new folder structure and links
  - docs/ root now has only 4 files: START_HERE.md, ONBOARDING.md, WORKLOG.md, Vision.md
- Tests: Not run (docs only).

2026-01-28 12:30 UTC - Archive stale root docs with superseded-by headers
- Files: DIAGNOSTIC_LOGGING.md → docs/archive/; TEST_QUALITY_AUDIT.md → docs/archive/testing-evolution/; TEST_IMPROVEMENTS_IMPLEMENTED.md → docs/archive/testing-evolution/; PHASE_2_GOLDEN_TEST_LEARNINGS.md → docs/archive/testing-evolution/; NEXT_STEPS_DETAILED.md → docs/archive/testing-evolution/; Vision.md → docs/Vision.md
- Why: Clean up root directory by archiving stale docs while preserving historical context.
- Details:
  - Created docs/archive/testing-evolution/ folder to preserve test infrastructure evolution journey.
  - Added "superseded by" headers to each archived file pointing to current reference docs.
  - DIAGNOSTIC_LOGGING.md → superseded by docs/Debugging.md
  - TEST_*.md files → superseded by docs/TEST_MANIFEST.md (historical records preserved)
  - Moved Vision.md to docs/ (not stale, just misplaced).
- Tests: Not run (docs only).

2026-01-28 12:13 UTC - Create START_HERE.md as newcomer documentation index
- Files: docs/START_HERE.md (new)
- Why: Provide a single entry point for newcomers to navigate the codebase documentation.
- Details:
  - Created comprehensive TOC linking to all key docs organized by role (contributor, architect, feature dev, ops).
  - Includes directory structure overview, ADR index with domain prefixes, and key design principles.
  - Links to ONBOARDING.md for detailed walkthrough.
- Tests: Not run (docs only).

2026-01-28 12:00 UTC - Unify ADR files under docs/adr/ with domain prefixes
- Files: docs/ADR-001-Decompose-Monolithic-IndexedDB-Service.md → docs/adr/DB-001-decompose-monolithic-indexeddb.md; docs/ADR-002-Atomic-Transaction-Boundaries.md → docs/adr/DB-002-atomic-transaction-boundaries.md; docs/ADR-003-Version-Centric-Data-Model.md → docs/adr/DB-003-version-centric-data-model.md; docs/ADR-004-Service-Layer-Architecture.md → docs/adr/CORE-004-service-layer-architecture.md; docs/ADR-005-Agent-First-Code-Organization.md → docs/adr/CORE-005-agent-first-code-organization.md; docs/ADR-006-Tree-Shakeable-Service-Architecture.md → docs/adr/CORE-006-tree-shakeable-service-architecture.md; docs/ADR-007-Schema-Evolution-And-Migrations.md → docs/adr/DB-007-schema-evolution-and-migrations.md; docs/adr/001-preloader-strategy.md → docs/adr/FEAT-001-preloader-strategy.md; docs/adr/002-typescript-debt-remediation.md → docs/adr/FEAT-002-typescript-debt-remediation.md; docs/adr/003-sutta-studio-mvp.md → docs/adr/SUTTA-003-sutta-studio-mvp.md
- Why: Fix ADR numbering collision between docs/ and docs/adr/; consolidate all ADRs under single directory with domain prefixes (DB, CORE, FEAT, SUTTA).
- Details:
  - Moved 7 ADR files from docs/ root to docs/adr/ with domain prefixes.
  - Renamed 3 existing docs/adr/ files to use domain prefixes.
  - Updated all internal cross-references (ADR-001→DB-001, ADR-002→DB-002, etc.).
  - Updated document headers to match new naming scheme.
- Tests: Not run (file organization only).

2026-01-28 12:00 UTC - Archive diagnostic artifacts and stale files
- Files: ts-prune-output.txt → docs/archive/diagnostics/ts-prune-output-2025.txt; diagnostics/*.txt → docs/archive/diagnostics/; formattingIssues.md → docs/archive/formattingIssues.md; ISSUES.md → docs/archive/ISSUES.md; COVERAGE_REPORT.md → docs/archive/quality/COVERAGE_REPORT.md
- Why: Clean up root directory by moving stale diagnostic artifacts and outdated backlog files to archive.
- Details:
  - Moved ts-prune-output.txt with year suffix to diagnostics archive.
  - Moved 4 TSC diagnostic files from diagnostics/ folder to archive/diagnostics/.
  - Moved formattingIssues.md and ISSUES.md (stale backlog) to archive root.
  - Moved COVERAGE_REPORT.md to archive/quality/ subfolder.
  - Removed empty diagnostics/ directory.
- Tests: Not run (file organization only).

2026-01-28 12:00 UTC - Fix outdated statements in README.md
- Files: README.md:42-50, 57, 125, 149, 163
- Why: README had stale info about site count, OpenAI support, and broken/inconsistent links.
- Details:
  - Updated site list from 5 to 8 (added BookToki Korean, SuttaCentral Pali/Suttas).
  - Changed "Coming Soon: Direct OpenAI integration" to reflect that OpenAI is now supported.
  - Added VITE_OPENAI_API_KEY to .env.local example.
  - Fixed broken link to PROJECT_STRUCTURE.md, now points to docs/adr/.
  - Simplified ADR path from "docs/ and docs/adr/" to just "docs/adr/".
- Tests: Not run (docs only).

2026-01-28 08:04 UTC - Untrack .serena files from git index
- Files: .serena/.gitignore; .serena/memories/project_overview.md; .serena/memories/project_structure.md; .serena/memories/style_and_conventions.md; .serena/memories/suggested_commands.md; .serena/memories/task_completion.md; .serena/project.yml; docs/WORKLOG.md
- Why: Keep local assistant memory out of version control while preserving local functionality.
- Details:
  - Removed .serena files from git index using update-index; files remain on disk and are ignored.
- Tests: Not run (git hygiene only).

2026-01-28 07:59 UTC - Docs hygiene: options-first response format + ignore .serena + remove cookie file
- Files: AGENTS.md:25-37; .gitignore:91-94; data/Novels/booktoki468.com_cookies.txt (removed); docs/WORKLOG.md
- Why: Enforce options-first response framing and prevent assistant artifacts/sensitive cookies from entering git.
- Details:
  - Updated Prime Directive #11 to include decision dimensions and added RESPONSE_FORMAT section.
  - Added `.serena/` to .gitignore; removed local Booktoki cookie file.
- Tests: Not run (docs/git hygiene only).

2026-01-28 04:56 UTC - Add options-first directive to AGENTS
- Files: AGENTS.md:25; docs/WORKLOG.md
- Why: Enforce presenting options with open questions, tradeoffs, and uncertainties before proceeding.
- Details:
  - Added Prime Directive #11 requiring options-first framing.
- Tests: Not run (docs only).

2026-01-28 04:43 UTC - ADR-003 amendment: assembly-line compiler pipeline + phase state envelope (proposed)
- Files: docs/adr/003-sutta-studio-mvp.md:151-194; docs/WORKLOG.md
- Why: Align architecture doc with the quality-first assembly-line compiler plan and prompt contracts.
- Details:
  - Added an ADR amendment describing chunked skeleton, anatomist/lexicographer/weaver/typesetter passes, phase state envelope, flattened schema, polysemy contract, layout hints + UI fallback, and staged validation.
- Tests: Not run (docs only).

2026-01-28 04:53 UTC - Accept ADR-003 and enable chunked skeleton pass (in progress)
- Files: docs/adr/003-sutta-studio-mvp.md:1-4, 151-155; services/suttaStudioCompiler.ts:37, 380-494, 730-753; docs/WORKLOG.md
- Why: Mark the assembly-line amendment as accepted and prevent skeleton truncation by chunking inputs.
- Details:
  - Updated ADR-003 status to Accepted (including the assembly-line amendment block).
  - Added chunked skeleton helper to run per-50 segment windows with per-chunk fallback.
  - Bumped prompt version to v6 to invalidate cached packets.
- Tests: Not run (not requested).

2026-01-28 04:50 UTC - Add assembly-line pipeline implementation roadmap (accepted)
- Files: docs/plans/2026-01-28-sutta-studio-assembly-line-roadmap.md; docs/WORKLOG.md
- Why: Capture the detailed implementation plan (rehydrator, throttling, error handling, tokenization, golden set) so it survives across sessions.
- Details:
  - Added a step-by-step roadmap covering chunked skeleton, throttled queue, flattened anatomist pass, rehydration utility, lexicographer/weaver/typesetter passes, degraded-state fallback, and benchmarking.
- Tests: Not run (docs only).

2026-01-28 08:25 UTC - Stale-build invalidation for Sutta Studio (in progress)
- Files: components/sutta-studio/SuttaStudioApp.tsx:214-289; services/suttaStudioCompiler.ts:724-879; types/suttaStudio.ts:106-118; docs/WORKLOG.md
- Why: Prevent cached packets stuck in `building` from blocking new compiles after refresh.
- Details:
  - Added `lastProgressAt` to packet progress and update it on skeleton/phase/error/complete.
  - Compile gate treats `building` packets as stale if no progress within 3 minutes, and triggers a recompile.
- Tests: Not run (local).

2026-01-28 09:13 UTC - Route compiler calls through provider adapters (in progress)
- Files: adapters/providers/OpenAIAdapter.ts:1-260; adapters/providers/GeminiAdapter.ts:1-210; adapters/providers/ClaudeAdapter.ts:1-150; adapters/providers/Provider.ts:1-40; adapters/providers/index.ts:1-30; services/apiMetricsService.ts:12-120; services/suttaStudioCompiler.ts:1-520; docs/WORKLOG.md
- Why: Unify compiler LLM calls with the shared provider adapter layer so cost/usage metrics match translation accounting.
- Details:
  - Added chatJSON support to OpenAI/Gemini/Claude adapters with apiMetrics recording under `sutta_studio`.
  - Compiler now resolves providers through adapter registry and uses adapter chatJSON (no direct OpenAI SDK calls).
  - ApiMetrics now includes `sutta_studio` type for aggregation.
- Tests: Not run (local).

2026-01-28 08:17 UTC - Bootstrap ETA with historical EMA (in progress)
- Files: services/suttaStudioTelemetry.ts:1-92; services/suttaStudioCompiler.ts:715-733; docs/WORKLOG.md
- Why: Provide a Phase 1 estimate from prior runs and smooth ETA updates with EMA.
- Details:
  - Telemetry now persists EMA (per uid + global) and derives EMA from existing samples for backward compatibility.
  - Compiler seeds avgPhaseMs/etaMs after skeleton using stored EMA; ETA continues to update per phase.
- Tests: Not run (local).

2026-01-28 02:34 UTC - Simplify hover tooltips and move relation hooks to arrows (in progress)
- Files: components/sutta-studio/PaliWord.tsx:1-88; components/sutta-studio/SuttaStudioView.tsx:11-142; docs/WORKLOG.md
- Why: Reduce tooltip clutter and make relation cues appear only on intended hover targets.
- Details:
  - Segment hover now prioritizes relation labels (e.g., “Agent of hearing”) over morph jargon.
  - Removed inline relation hook bubble from segments; arrow hover shows relation hook (BY/WITH, etc.).
  - Suppressed the “Hover: segment details” hint while a segment tooltip is active.
- Tests: Not run (not requested).

2026-01-28 02:25 UTC - Allow negative ETA countdown with overdue styling (in progress)
- Files: components/sutta-studio/hooks/useEtaCountdown.ts:1-33; components/sutta-studio/utils.ts:40-52; components/sutta-studio/SuttaStudioView.tsx:32-55; components/sutta-studio/StudioHeader.tsx:4-36; components/sutta-studio/StudioProgress.tsx:1-22; components/sutta-studio/SuttaStudioFallback.tsx:19-127; docs/WORKLOG.md
- Why: Let ETA count past zero to reflect overdue phases, and highlight overdue status visually.
- Details:
  - Countdown now returns negative values once ETA elapses (no clamping).
  - Duration formatting preserves a leading “-” for overdue time.
  - Progress chips switch to red styling when ETA is negative.
- Tests: Not run (not requested).

2026-01-28 02:16 UTC - Prevent compile abort on render churn (in progress)
- Files: components/sutta-studio/SuttaStudioApp.tsx:55-342; docs/WORKLOG.md
- Why: StrictMode/effect churn was aborting compiler fetches, causing proxy errors and stalled builds.
- Details:
  - Added a stable route key + abort ref so compiles only abort on route changes.
  - Removed effect cleanup abort; compiler now finishes unless the route changes.
- Tests: Not run (not requested).

2026-01-28 02:08 UTC - Subscribe to chapter map for Studio hydration (in progress)
- Files: components/sutta-studio/SuttaStudioApp.tsx:44-64; docs/REFACTOR_CANDIDATES.md:12-17; docs/WORKLOG.md
- Why: Fix Loading... stall caused by using a non-reactive getter; ensure re-render when chapters map updates.
- Details:
  - Replaced `getChapter(currentChapterId)` with a store selector that reads `chapters` directly.
  - Keeps `currentChapterId` reactive so Studio updates after IDB hydration.
- Tests: Not run (not requested).

2026-01-28 01:50 UTC - Add Sutta Studio flow debug gating + control-path logs (in progress)
- Files: services/suttaStudioDebug.ts:1-30; components/sutta-studio/SuttaStudioApp.tsx:1-422; components/sutta-studio/SuttaStudioFallback.tsx:1-89; services/navigationService.ts:12-825; docs/REFACTOR_CANDIDATES.md:14-16; docs/WORKLOG.md
- Why: Provide reason-coded, sutta-specific logging to trace gating decisions and URL normalization without flooding general logs.
- Details:
  - Added `LF_SUTTA_DEBUG_FLOW` gate + helpers to emit `[SuttaStudioFlow]` logs on demand.
  - Logged resolve/navigate/compile/render gate reasons + snapshot state to pinpoint where Loading stalls.
  - Logged fallback render state when blocks are empty and when updateBrowserHistory rewrites `/sutta` URLs.
  - Noted oversized view/navigation files in refactor candidates list.
- Tests: Not run (not requested).

2026-01-28 01:41 UTC - Soft-cap phase size via prompt guidance (in progress)
- Files: config/suttaStudioPromptContext.ts:10-17; services/suttaStudioCompiler.ts:37; docs/WORKLOG.md
- Why: Encourage smaller per-phase word counts (soft cap at 8) without hard enforcement.
- Details:
  - Added a soft-cap instruction in skeleton prompt context to bias splitting when >8 words.
  - Bumped prompt version to v5 to invalidate cached packets and apply the new guidance.
- Tests: Not run (not requested).

2026-01-28 01:35 UTC - Curve relation edges + plain-language morph examples (in progress)
- Files: components/sutta-studio/SuttaStudioView.tsx:3-266; config/suttaStudioExamples.ts:44-103; docs/WORKLOG.md
- Why: Make relation arcs visibly curved and avoid arrow clipping; remove jargon from prompt examples.
- Details:
  - Relation arrows now curve more, extend SVG canvas, and end at the bottom of the target when it sits above the source.
  - Morph example tooltips/notes now use plain language (“marks belonging”) instead of “genitive plural.”
- Tests: Not run (not requested).

2026-01-28 01:27 UTC - Add pre-flight exception for single-agent small fixes (in progress)
- Files: AGENTS.md:32-50; docs/WORKLOG.md
- Why: Allow skipping full pre-flight for trivial single-agent edits while keeping minimal safeguards.
- Details:
  - Added a PRE-FLIGHT_EXCEPTION block with small-fix criteria and minimum requirements.
- Tests: Not run (not requested).

2026-01-28 01:23 UTC - Ownership graph arcs extended + unclipped (in progress)
- Files: components/sutta-studio/SuttaStudioView.tsx:225-252; docs/WORKLOG.md
- Why: Ownership relation arrows felt cramped/clipped; extend canvas + curvature for aesthetic arc length.
- Details:
  - Increased ownership curveness and added `_extendSVGcanvas` + `SVGcanvasStyle` overflow visible for ownership edges only.
- Tests: Not run (not requested).

2026-01-27 23:09 UTC - Sutta Studio stitching + retrieval + validator + grammar graph toggle (in progress)
- Files: services/suttaStudioRetrieval.ts:1-55; services/suttaStudioValidator.ts:1-146; services/suttaStudioCompiler.ts:29-881; components/sutta-studio/SuttaStudioApp.tsx:13-167; components/sutta-studio/SuttaStudioView.tsx:219-259; types/suttaStudio.ts:12-129; config/suttaStudioPromptContext.ts:10-16; docs/sutta-studio/IR.md:110-146; docs/WORKLOG.md
- Why: Support stitched multi-chapter compilation with boundary-aware phases, add retrieval context + validator pass, and show grammar graphs only when the study toggle is on.
- Details:
  - Compiler now accepts stitched uid lists, tracks boundaries, and avoids cross-chapter chunking unless allowed.
  - Retrieval context adds nearby segments into phase + morph prompts without overriding ambiguity.
  - Validator cleans missing relations/links, patches empty segments/senses, and records issues in compiler metadata.
  - Studio renders relation graph edges for all segments when study mode is enabled, with labels only on hover.
  - Bumped prompt version to v4 to invalidate cached packets with new prompts.
- Tests: Not run (not requested).

2026-01-27 22:28 UTC - Preserve /sutta query params when updating chapter URL (in progress)
- Files: services/navigationService.ts:790-814; docs/WORKLOG.md
- Why: Keep `lang`, `author`, and `recompile` in the Studio URL while still adding `chapter=...`.
- Details:
  - `updateBrowserHistory` now merges a small whitelist of params when the current pathname starts with `/sutta`.
  - The chapter param is still set from `chapter.canonicalUrl`, but the query no longer clobbers Studio-specific flags.
- Tests: Not run (not requested).

2026-01-27 22:11 UTC - Sutta Studio progress countdown + phase-only labels (in progress)
- Files: components/sutta-studio/hooks/useEtaCountdown.ts:1-32; components/sutta-studio/utils.ts:40-63; components/sutta-studio/SuttaStudioView.tsx:1-53; components/sutta-studio/SuttaStudioFallback.tsx:1-78; components/sutta-studio/SuttaStudioApp.tsx:184-212; docs/WORKLOG.md
- Why: Replace “Building/Compiler” copy with live phase + countdown display per request.
- Details:
  - Added an ETA countdown hook to tick between compiler phase updates.
  - Added duration/phase helpers to keep labels consistent across views.
  - Updated studio header + fallback progress UI to show “Phase X/Y · <countdown>” with no compiler/status text.
- Tests: Not run (not requested).

2026-01-27 05:49 UTC - Sutta Studio ADR + IR schema (proposed)
- Files: docs/adr/003-sutta-studio-mvp.md; docs/sutta-studio/IR.md; docs/WORKLOG.md
- Why: Define the MVP architecture, data model, and LLM pipeline for Sutta Studio before implementation.
- Details:
  - ADR-003 formalizes the dedicated `/sutta/:uid` route, SuttaCentral-only scope, hybrid IR (canonical segments + derived phases), CSP-style pipeline, and citations registry.
  - IR schema doc captures canonical segments, phase view types, citation registry, and embedding inside Chapter records.
- Tests: Not run (docs only).

2026-01-26 21:49 UTC - SuttaCentral early API routing + Tailwind import order (in progress)
- Files: services/adapters.ts; tests/services/adapters.suttacentral.test.ts; index.css; docs/WORKLOG.md
- Why: Bypass HTML proxy failures for SuttaCentral navigation and fix Tailwind PostCSS @import ordering error.
- Details:
  - fetchAndParseUrl routes SuttaCentral URLs directly to API fetchers before HTML proxy attempts.
  - Added test to assert SuttaCentral fetch uses API endpoints without HTML proxy usage.
  - Reordered Tailwind directives to satisfy PostCSS @import rule.
- Tests: Not run (local).

2026-01-26 13:31 UTC - SuttaCentral adapter fixes + metadata + tests (complete)
- Files: AGENTS.md:41-55, 78-83, 319-326; types.ts:2-16; services/adapters.ts:218-414, 398-405, 685-711, 744-785; services/navigationService.ts:20-39, 582-607, 728-777; tests/services/adapters.suttacentral.test.ts:1-106; docs/WORKLOG.md
- Why: Preserve fan translation, support SuttaCentral API fallback, improve URL parsing, and add adapter tests; align repo coordination rules for single-agent small fixes.
- Details:
  - SuttaCentral adapter now parses query/path lang + author, supports dotted UID navigation, avoids injecting blurb into content, and returns blurb/locale metadata.
  - SuttaCentral fetch updates proxy health on success and uses API fetcher in direct fallback.
  - NavigationService stores SuttaCentral blurb into novel metadata (only when description is empty/placeholder) and passes fanTranslation into imports.
  - Added SuttaCentral adapter tests for support listing, lang override, and dotted UID navigation.
- Tests: Not run (local).
### [2026-01-07 05:04] [Agent: Codex]
**Status:** Starting
**Task:** Add structured EPUB export warnings (missing translations, cache misses) and package validation logs without changing output.
**Worktree:** ../LexiconForge.worktrees/codex-epub-diagnostics/
**Branch:** feat/codex-epub-diagnostics
**Files likely affected:** store/slices/exportSlice.ts; services/epubService/packagers/epubPackager.ts; tests/services/epubPackager.diagnostics.test.ts; docs/WORKLOG.md

### [2026-01-07 12:21] [Agent: Codex]
**Status:** Complete
**Progress:** Added structured export warnings for missing translations/cache misses, added EPUB package validation warnings, and added diagnostics test coverage.
**Files modified (line numbers + why):**
- store/slices/exportSlice.ts:31,270,342,405,442,587 - track/export structured warnings, log to telemetry, surface warning counts in progress + performance telemetry.
- services/epubService/packagers/epubPackager.ts:15,21,27,33,146,307 - emit package validation warnings (missing title/identifier, no chapters, invalid cover image, XHTML parse errors).
- tests/services/epubPackager.diagnostics.test.ts:1,4,32 - verify structured warnings for missing title and invalid cover image.
- docs/WORKLOG.md:1 - session log updates.
**Tests:** npx vitest run tests/services/epubPackager.diagnostics.test.ts

2025-12-26 20:31 UTC - Provider contract VCR replay tests
- Files: tests/contracts/provider.contract.test.ts; tests/contracts/vcr/loadCassette.ts; tests/contracts/vcr/types.ts; tests/contracts/cassettes/*.json; docs/WORKLOG.md
- Why: Provider contract tests were a skipped scaffold; we need deterministic replay tests to validate real adapter behavior without network calls and without placeholder assertions.
- Details: Adds replay-only VCR cassettes that drive real `OpenAIAdapter.translate()` and `GeminiAdapter.translate()` while mocking only provider SDK boundaries; asserts JSON parsing, token accounting, cost wiring, and OpenAI metrics recording.
- Tests: `npm test`

2025-12-24 11:23 UTC - Migration recovery UI gate
- Files: App.tsx; components/MigrationRecovery.tsx; tests/components/MigrationRecovery.test.tsx; docs/WORKLOG.md
- Why: When the DB is newer/corrupted/blocked or a migration failed, users need a clear recovery path (restore from backup, upload backup, or start fresh) instead of a silent failure.
- Details: `App.tsx` calls `prepareConnection()` before store init and blocks into a full-screen `MigrationRecovery` overlay when `shouldBlockApp()` is true.
- Tests: `npx tsc --noEmit`; `npx vitest run tests/components/MigrationRecovery.test.tsx`

2025-12-24 11:15 UTC - Fix diffResults import + test hardening
- Files: services/db/operations/imports.ts; tests/current-system/export-import.test.ts; tests/services/comparisonService.test.ts; tests/adapters/providers/OpenAIAdapter.test.ts; tests/contracts/provider.contract.test.ts; tests/hooks/useChapterTelemetry.test.tsx; docs/WORKLOG.md
- Why: Imported diffResults could throw `DataError` because export emits `fanVersionId: null` but IndexedDB keys must be valid strings; plus expand coverage for provider/adversarial parsing paths.
- Details:
  - Normalized diffResults records during full-session import (coerce `fanVersionId` to `''`, fill hash nulls) so composite keys remain valid.
  - Strengthened tests around diffResults export/import, OpenAI adapter error paths, comparison JSON extraction, and chapter telemetry perf/logging.
- Tests: `npx tsc --noEmit`; `npx vitest run tests/current-system/export-import.test.ts`; `npx vitest run tests/services/comparisonService.test.ts`; `npx vitest run tests/adapters/providers/OpenAIAdapter.test.ts`; `npx vitest run tests/hooks/useChapterTelemetry.test.tsx`

--- Archived entries available at docs/archive/WORKLOG-2025-11-and-earlier.md ---
2026-01-27 01:28 UTC - Sutta Studio MVP scaffolding + chapter IR wiring (in progress)
- Files: App.tsx (router split); MainApp.tsx (full app logic moved); components/sutta-studio/* (new modular studio UI); types/suttaStudio.ts (new IR types); types.ts (Chapter/ImportedChapter embed); services/db/types.ts (ChapterRecord embed); services/db/operations/chapters.ts (persist IR); services/db/operations/imports.ts (import IR); services/db/operations/export.ts (export IR); services/stableIdService.ts (propagate IR); services/navigationService.ts (propagate IR + hydrate); interfaceIdea.tsx (now a small preview wrapper); index.css (tailwind directives reset); package.json (add studio deps); docs/WORKLOG.md
- Why: Split the monolithic InterfaceIdea into reusable components, add a dedicated /sutta/:uid route, embed Sutta Studio IR inside chapter records for persistence, and keep the UI minimal with a single study toggle.
- Details:
  - Created Sutta Studio components (Pali/English engines, LensPanel, arrows, palette) and a demo packet for MN10.
  - Added SuttaStudioApp route handler and moved the original App logic into MainApp.
  - Embedded suttaStudio packets into Chapter/ChapterRecord and persisted through import/export + IDB hydration.
  - Reset Tailwind CSS to base/components/utilities directives to avoid @import ordering errors.
- Tests: Not run (local).

2026-01-27 01:32 UTC - Reader -> Sutta Studio entry point (in progress)
- Files: components/ChapterView.tsx; components/chapter/ChapterHeader.tsx; docs/WORKLOG.md
- Why: Add a minimal in-reader navigation path into the Sutta Studio route for SuttaCentral chapters.
- Details:
  - Compute `/sutta/:uid?lang=&author=` from the chapter’s SuttaCentral URL.
  - Show a subtle “Studio” link next to Source (desktop) and near the language toggle (mobile).
- Tests: Not run (local).

2026-01-27 01:36 UTC - Studio/Reader icon navigation polish (in progress)
- Files: components/chapter/ChapterHeader.tsx; components/sutta-studio/SuttaStudioView.tsx; components/sutta-studio/SuttaStudioApp.tsx; docs/WORKLOG.md
- Why: Make the Studio entry/exit feel like a mode switch with icon-only controls.
- Details:
  - Replace “Studio” text with a minimal icon button in the reader header (desktop + mobile).
  - Add a top-left back icon in Sutta Studio that returns to reader via `?chapter=` URL.
- Tests: Not run (local).

2026-01-27 01:41 UTC - Studio progressive loading rules (in progress)
- Files: components/sutta-studio/SuttaStudioApp.tsx; components/sutta-studio/SuttaStudioView.tsx; components/sutta-studio/SuttaStudioFallback.tsx; types/suttaStudio.ts; components/sutta-studio/demoPacket.ts; docs/WORKLOG.md
- Why: Show Pāli + fan translation while compiler runs and only reveal completed phases with a subtle progress chip when incomplete.
- Details:
  - Added packet progress metadata (total/ready/state) and demo marks complete.
  - Studio renders only ready phases; navigation clamps to completed range.
  - Fallback view shows Pāli + fan translation with a “Building” chip only while incomplete.
- Tests: Not run (local).

2026-01-27 02:12 UTC - Sutta Studio compiler pipeline wired (in progress)
- Files: services/suttaStudioCompiler.ts (new); services/adapters.ts (export PROXIES); components/sutta-studio/SuttaStudioApp.tsx (auto-run compiler + persist); docs/WORKLOG.md
- Why: Run the Sutta Studio compiler automatically on /sutta/:uid load, log progress, and persist packet updates.
- Details:
  - Added compiler service with proxy-backed SuttaCentral API fetch, skeleton pass + per-phase compile calls, progress updates, and error logging.
  - Auto-runs compiler in SuttaStudioApp once chapter is loaded, persists intermediate packets to IndexedDB via ChapterOps, and shows progress in UI.
  - Reset demo packet usage to only show when no fetched chapter matches (so compiler progress isn’t masked).
- Tests: Not run (local).

2026-01-27 02:26 UTC - Studio compiler ETA panel + telemetry (in progress)
- Files: services/suttaStudioTelemetry.ts (new); services/suttaStudioCompiler.ts; types/suttaStudio.ts; components/sutta-studio/SuttaStudioView.tsx; components/sutta-studio/SuttaStudioFallback.tsx; components/sutta-studio/SuttaStudioApp.tsx; docs/WORKLOG.md
- Why: Give users a clear sense of compilation progress with a simple status panel and an ETA based on observed phase timings.
- Details:
  - Telemetry stores last 12 phase durations (per sutta + global) in localStorage to compute average phase time.
  - Compiler records per-phase timings and updates packet.progress with avgPhaseMs, lastPhaseMs, etaMs, and currentPhaseId.
  - Studio + fallback views render a minimal top-right status card (hidden on mobile) with phase + ETA while building.
- Tests: Not run (local).

2026-01-27 02:41 UTC - Studio fallback interleaving + header extraction (in progress)
- Files: components/sutta-studio/SuttaStudioView.tsx; components/sutta-studio/SuttaStudioFallback.tsx; components/sutta-studio/SuttaStudioApp.tsx; components/sutta-studio/StudioHeader.tsx (new); components/sutta-studio/StudioProgress.tsx (new); components/sutta-studio/hooks/usePhaseNavigation.ts (new); docs/WORKLOG.md
- Why: Interleave Pāli + English segments while compiler runs, simplify progress messaging to “Building X/Y”, and split large view file to respect modularity rules.
- Details:
  - Fallback now renders interleaved segments from canonicalSegments when available, else zips chapter content + fan translation.
  - Progress chip shows “Building X/Y”; removed extra status card.
  - Extracted header + progress chip + navigation hook to keep SuttaStudioView under 300 LOC.
- Tests: Not run (local).

2026-01-27 06:02 UTC - Update agent size rule + refactor candidate log (complete)
- Files: AGENTS.md; docs/REFACTOR_CANDIDATES.md; docs/WORKLOG.md
- Why: Allow reading large files without warning while preserving maintainability via explicit refactor tracking.
- Details:
  - Replaced the >300 LOC warning rule with a requirement to log refactor-worthy files.
  - Added `docs/REFACTOR_CANDIDATES.md` and logged `services/suttaStudioCompiler.ts` as a split candidate.
  - Added WORKLOG bloat control note for `./scripts/cycle-worklog.sh` in AGENTS.
- Tests: Not run (docs only).

2026-01-27 06:12 UTC - Sutta Studio compiler structured outputs (in progress)
- Files: services/suttaStudioCompiler.ts; docs/WORKLOG.md
- Why: Fix truncated JSON by using strict JSON schema outputs for skeleton + phase compile calls.
- Details:
  - Added JSON schemas for skeleton and phase responses.
  - Compiler now checks structured output support and sends `response_format: json_schema` when available.
  - Added fallback retry without schema if provider rejects response_format.
- Tests: Not run (local).

2026-01-27 06:21 UTC - Add Sutta Studio golden examples for prompts (in progress)
- Files: config/suttaStudioExamples.ts; services/suttaStudioCompiler.ts; docs/WORKLOG.md
- Why: Provide concrete few-shot examples so compiler output matches expected IR shape.
- Details:
  - Added skeleton + phase examples from demo-style data (full fields) and injected into prompts.
  - Examples are always included and labeled “do NOT copy ids”.
- Tests: Not run (local).

2026-01-27 06:33 UTC - Add Sutta Studio prompt context blocks (in progress)
- Files: config/suttaStudioPromptContext.ts; config/suttaStudioExamples.ts; services/suttaStudioCompiler.ts; docs/WORKLOG.md
- Why: Provide the LLM with the translation ethos + grammar/polysemy guidance per pipeline stage.
- Details:
  - Added base, skeleton, and phase context blocks (Pali vs English, zero copula, polysemy, relations, morph hints).
  - Injected context blocks into skeleton + phase prompts.
  - Enriched golden example with morph hint + relation status.
- Tests: Not run (local).

2026-01-27 06:45 UTC - Add full compiler request/response debug logs (in progress)
- Files: services/suttaStudioCompiler.ts; docs/WORKLOG.md
- Why: Enable full visibility into compiler model calls (params, request, response).
- Details:
  - Added debug logs for model/params and full request/response bodies gated by LF_AI_DEBUG_FULL.
  - Logs exclude API keys (SDK handles keys out-of-band).
- Tests: Not run (local).

2026-01-27 06:58 UTC - Fix Sutta Studio progress display + partial fallback (in progress)
- Files: types/suttaStudio.ts; services/suttaStudioCompiler.ts; components/sutta-studio/SuttaStudioApp.tsx; components/sutta-studio/SuttaStudioFallback.tsx; docs/WORKLOG.md
- Why: Progress chip wasn’t showing counts and fallback showed all segments instead of only completed phases.
- Details:
  - Added totalSegments/readySegments to packet.progress and updated compiler to track them.
  - Progress label now uses the active packet (not only resolved demo) so counts render in fallback.
  - Fallback now shows only segments corresponding to completed phases when progress counts exist.
- Tests: Not run (local).

2026-01-27 07:14 UTC - Sutta Studio interaction + alignment visuals (in progress)
- Files: components/sutta-studio/SuttaStudioView.tsx; components/sutta-studio/PaliWord.tsx; components/sutta-studio/EnglishWord.tsx; docs/WORKLOG.md
- Why: Remove the lens drawer, make word click only rotate, and keep faint alignment edges always visible.
- Details:
  - Disabled pin/drawer behavior and removed LensPanel rendering.
  - Word clicks now only cycle meanings; hover tooltips remain in study mode.
  - Alignment arrows are always drawn as faint dotted lines, with a brighter line on hover.
  - Added subtle segment underline/hover cursor so morphology segmentation is visible.
- Tests: Not run (local).

2026-01-27 07:24 UTC - Remove phase title label from studio view (in progress)
- Files: components/sutta-studio/SuttaStudioView.tsx; docs/WORKLOG.md
- Why: Keep UI minimal; back arrow alone indicates navigation, no phase title text.
- Details: Removed rendering of `currentPhase.title` label in the studio view header area.
- Tests: Not run (local).

2026-01-27 07:38 UTC - Recompile invalidation + adaptive layout blocks (in progress)
- Files: components/sutta-studio/SuttaStudioApp.tsx; components/sutta-studio/SuttaStudioView.tsx; types/suttaStudio.ts; services/suttaStudioCompiler.ts; config/suttaStudioPromptContext.ts; config/suttaStudioExamples.ts; docs/WORKLOG.md
- Why: Allow iterative recompiles and reduce edge crossings with adaptive block layout.
- Details:
  - Added `?recompile=1` and prompt-version mismatch invalidation to trigger recompiles without clearing existing packet.
  - Phase schema now allows `layoutBlocks`; prompts request max-5 word blocks.
  - Studio view renders Pali/English in blocks (<=5 words) and assigns ghost tokens to nearest linked word.
  - Added dedupe for adjacent English tokens using first-sense text.
- Tests: Not run (local).

2026-01-27 07:40 UTC - Bump Sutta Studio prompt version (in progress)
- Files: services/suttaStudioCompiler.ts; docs/WORKLOG.md
- Why: Force auto-recompile after prompt/context changes.
- Details: Updated SUTTA_STUDIO_PROMPT_VERSION to v2.
- Tests: Not run (local).

2026-01-27 07:58 UTC - Add Morphology pass to Sutta Studio compiler (in progress)
- Files: services/suttaStudioCompiler.ts; config/suttaStudioPromptContext.ts; config/suttaStudioExamples.ts; types/suttaStudio.ts; docs/WORKLOG.md
- Why: Ensure word segmentation + morph hints exist even when the phase pass returns a single stem per word.
- Details:
  - Added a dedicated morphology pass that returns updated segments only.
  - Added morph JSON schema + prompt context + golden example.
  - Bumped prompt version to v3 to auto-recompile.
- Tests: Not run (local).

2026-01-28 08:07 UTC - Align phase label with readyPhases/totalPhases
- Files: components/sutta-studio/SuttaStudioFallback.tsx:19-27; components/sutta-studio/SuttaStudioView.tsx:9
- Why: Keep top progress label consistent with ready/total counts and remove unused phase resolver import.
- Details: Fallback now renders "Phase {readyPhases}/{totalPhases}" directly with clamped ready count; cleaned unused import in studio view.
- Tests: Not run (local).
2026-01-30 07:36 UTC - Sutta Studio pass runner + benchmark harness (complete)
- Files: services/suttaStudioPromptVersion.ts:1; services/suttaStudioLLM.ts:1-149; services/suttaStudioPassPrompts.ts:1-706; services/suttaStudioPassRunners.ts:1-584; services/suttaStudioCompiler.ts:56,65; scripts/sutta-studio/benchmark.ts:1-594; scripts/sutta-studio/benchmark-config.ts:1-74; docs/benchmarks/sutta-studio.md:1-77; docs/roadmaps/REFACTOR_CANDIDATES.md:18-20; docs/WORKLOG.md
- Why: Provide per-pass benchmarking with JSON/CSV telemetry plus reusable pass runners and prompt helpers.
- Details:
  - Added shared prompt+schema module and LLM caller helper for pass-level benchmarking.
  - Added per-pass runner module (skeleton/anatomist/lexicographer/weaver/typesetter/morphology) with injectable LLM caller.
  - Added benchmark script + config to run passes and write `reports/sutta-studio/<timestamp>/metrics.json|csv`.
  - Documented benchmark usage/fields and logged new >300 LOC files as refactor candidates.
- Tests: Not run (not requested).
2026-01-28 10:18 UTC - Add compiler throttling between LLM calls (in progress)
- Files: services/suttaStudioCompiler.ts:38, 278-311, 448-498, 714-879; docs/WORKLOG.md
- Why: Reduce bursty LLM traffic and lower the chance of 429s during multi-phase compilation.
- Details:
  - Added a compiler throttle helper with abort-aware delay and a 1s minimum gap between calls.
  - Applied throttling to skeleton chunk calls, phase compile, and morphology pass.
- Tests: Not run (not requested).
2026-01-28 07:51 UTC - Phase 2 anatomist pass (assembly-line) wired into compiler (in progress)
- Files: services/suttaStudioCompiler.ts:42, 69-139, 318-407, 821-883, 1027-1157; types/suttaStudio.ts:65-104; config/suttaStudioPromptContext.ts:30-38; config/suttaStudioExamples.ts:1-124; docs/WORKLOG.md
- Why: Introduce the Anatomist pass with a flattened schema to reduce LLM overload and make segmentation authoritative.
- Details:
  - Added Anatomist types, prompt context, and a golden example JSON.
  - Added Anatomist JSON schema, phase state envelope, prompt builder, and compiler call (structured outputs).
  - Use anatomist segments to override phase output and skip morphology when anatomist succeeds.
  - Bumped prompt version to v7 to invalidate cached packets.
- Tests: Not run (not requested).
2026-01-30 10:45 UTC - Sutta Studio pass runner + benchmark harness (starting)
- Status: Starting
- Task: Add per-pass runners (skeleton/anatomist/lexico/weaver/typesetter/morph) with injectable LLM caller, plus JSON/CSV benchmark outputs.
- Files likely: services/suttaStudioCompiler.ts; services/suttaStudioPassRunners.ts (new); scripts/sutta-studio/benchmark.ts (new); scripts/sutta-studio/benchmark-config.ts (new); tests/sutta-studio/* (new); test-fixtures/sutta-studio/* (new); docs/benchmarks/sutta-studio.md (new); docs/WORKLOG.md
- Notes: Will add line-number details once edits land.
2026-01-30 10:45 UTC - Sutta Studio pass runner + benchmark harness (starting)
- Status: Starting
- Task: Add per-pass runners (skeleton/anatomist/lexico/weaver/typesetter/morph) with injectable LLM caller, plus JSON/CSV benchmark outputs.
- Files likely: services/suttaStudioCompiler.ts; services/suttaStudioPassRunners.ts (new); scripts/sutta-studio/benchmark.ts (new); scripts/sutta-studio/benchmark-config.ts (new); tests/sutta-studio/* (new); test-fixtures/sutta-studio/* (new); docs/benchmarks/sutta-studio.md (new); docs/WORKLOG.md
- Notes: Will add line-number details once edits land.
2026-01-30 08:03 UTC - Skeleton-only benchmark outputs + repeat runs
- Files: scripts/sutta-studio/benchmark.ts:13-739; test-fixtures/sutta-studio-golden-data.json:6-40; docs/benchmarks/sutta-studio.md:30-75; docs/WORKLOG.md
- Why: Capture skeleton outputs for manual diffing and enable repeated runs per model.
- Details:
  - Added skeleton fixture parsing with fallback to phase1+phase2 segments and recorded skeleton source metadata.
  - Wrote skeleton golden baseline + per-run chunk/aggregate outputs under `reports/sutta-studio/<timestamp>/outputs/`.
  - Added repeatRuns and captureOutputs metadata to metrics payload.
  - Documented new config knobs and output folder layout.
- Tests: Not run (not requested).
2026-01-30 09:03 UTC - Skeleton benchmark run (OpenRouter models) + script fixes
- Files: scripts/sutta-studio/benchmark.ts:1-746; scripts/sutta-studio/benchmark-config.ts:1-145; services/suttaStudioPassRunners.ts:1-60; docs/WORKLOG.md
- Why: Run manual-diff benchmark against multiple OpenRouter models without Vite-only imports.
- Details:
  - Added direct OpenRouter LLM caller in benchmark script and injected it into all pass runners to avoid loading translator prompt dependencies.
  - Added a missing loop-closing brace before metrics write to fix a parse error.
  - Removed session default settings import; added minimal BASE_SETTINGS to avoid `.md` import chain.
  - Updated benchmark config with OpenRouter model list (Gemini 3 Flash, Gemini 2.5 Flash, Kimi K2/K2.5, GLM 4.7/4.7 Flash, DeepSeek v3.2).
  - Benchmark output written to `reports/sutta-studio/2026-01-30T08-56-47-761Z/` (metrics + outputs).
- Tests: `./node_modules/.bin/tsx scripts/sutta-studio/benchmark.ts`
2026-01-30 09:43 UTC - Add Sutta Studio benchmark viewer route
- Files: App.tsx:1-22; components/bench/SuttaStudioBenchmarkView.tsx:1-203; docs/WORKLOG.md
- Why: Provide a minimal side-by-side viewer for skeleton aggregate outputs with golden baseline.
- Details:
  - Added `/bench/sutta-studio` route in App to render the benchmark viewer.
  - Viewer loads `reports/sutta-studio/**/outputs/**/skeleton-aggregate.json` plus `skeleton-golden.json` via `import.meta.glob`.
  - Minimal UI with two dropdowns and plain cards listing phases/segments.
- Tests: Not run (UI route only).
2026-01-30 15:40 UTC - Add benchmark index + runtime refresh for Sutta Studio bench
- Files: scripts/sutta-studio/benchmark.ts; components/bench/SuttaStudioBenchmarkView.tsx; docs/benchmarks/sutta-studio.md
- Why: Avoid Vite import.meta.glob cache; allow new benchmark runs to appear in /bench/sutta-studio without dev-server restart.
- Details:
  - Benchmark now writes reports/sutta-studio/index.json by scanning outputs for skeleton aggregates + golden baselines.
  - Bench view fetches the index at runtime with a Refresh button and lazy-loads selected outputs.
  - Docs updated to mention index.json and live refresh behavior.
- Tests: Not run (not requested).
2026-01-30 16:10 UTC - Add per-run cost/time summaries to benchmark index
- Files: scripts/sutta-studio/benchmark.ts; components/bench/SuttaStudioBenchmarkView.tsx; docs/benchmarks/sutta-studio.md
- Why: Provide run-level totals in reports/sutta-studio/index.json for future UI rollups.
- Details:
  - Index builder now reads metrics.json and aggregates duration/cost/token totals per run.
  - Summaries avoid double-counting by using skeleton chunk rows + pass rows (excluding aggregate rows).
  - Bench view index types updated; docs mention summary fields.
- Tests: Not run (not requested).

2026-01-30 16:35 UTC - Add live benchmark progress tracking
- Files: scripts/sutta-studio/benchmark.ts:150,358,625-1280; components/bench/SuttaStudioBenchmarkView.tsx:171,204,351; docs/benchmarks/sutta-studio.md:42-63
- Why: Surface per-model/pass/chunk progress during long benchmark runs.
- Details:
  - Benchmark writes progress snapshots to reports/sutta-studio/<timestamp>/progress.json and a root active-run.json pointer.
  - Bench UI polls active-run.json and renders a live progress bar with current run/pass/chunk.
  - Progress totals include per-chunk skeleton steps to reflect chunk-level work.
- Tests: Not run (not requested).
2026-01-30 16:48 UTC - Limit benchmark models to two for cheaper runs
- Files: scripts/sutta-studio/benchmark-config.ts:36-90
- Why: Reduce token spend while iterating on benchmark workflow.
- Details:
  - Kept only openrouter-gemini-3-flash and openrouter-kimi-k2.5 in BENCHMARK_CONFIG.runs.
  - Temporarily removed other OpenRouter models from the run list.
- Tests: Not run (not requested).
2026-01-30 16:12 UTC - Fix benchmark runner try/catch block
- Files: scripts/sutta-studio/benchmark.ts:1274-1276
- Why: tsx build failed with “Unexpected catch” due to missing try block closure.
- Details:
  - Added missing closing brace before the catch block in runBenchmark().
- Tests: Running benchmark (in progress).

2026-01-30 16:52 UTC - Incrementally refresh benchmark index during runs
- Files: scripts/sutta-studio/benchmark.ts:659,842
- Why: Allow /bench/sutta-studio to show partial results while a run is still executing.
- Details:
  - Write index.json after skeleton-golden is created and after each skeleton-aggregate output.
- Tests: Not run (not requested).

2026-01-30 16:58 UTC - Fast benchmark mode (skeleton-only, single repeat)
- Files: scripts/sutta-studio/benchmark-config.ts:24-33
- Why: Speed up experimental loops while keeping 2-model coverage.
- Details:
  - repeatRuns set to 1
  - passes limited to ['skeleton']
- Tests: Not run (not requested).
2026-01-30 17:02 UTC - Fix bench dropdown labels for index-driven options
- Files: components/bench/SuttaStudioBenchmarkView.tsx:72-117,388-389
- Why: Dropdown options were blank because BenchCard expected BenchEntry labels while receiving index entries.
- Details:
  - BenchCard now accepts BenchIndexEntry options and uses buildLabel() for option text.
- Tests: Not run (not requested).

2026-01-30 17:10 UTC - Sort benchmark dropdown by newest timestamp
- Files: components/bench/SuttaStudioBenchmarkView.tsx:45-51
- Why: Make recent runs easier to select in the bench dropdowns.
- Details:
  - Sorting now prioritizes newest timestamps, then golden entries, then runId.
- Tests: Not run (not requested).

2026-01-30 17:28 UTC - Add demo-based skeleton map + generator
- Files: test-fixtures/sutta-studio-demo-map.json; scripts/sutta-studio/generate-golden-from-demo.ts; test-fixtures/sutta-studio-golden-from-demo.json
- Why: Create a golden skeleton fixture derived from the demo packet with explicit phase-to-segment mapping.
- Details:
  - Added demo→segment mapping for mn10:1.1–2.6 (merging demo sub-phases that share a single canonical segment).
  - Generator reads the mapping + base fixture and writes a filtered golden file.
- Tests: Ran `./node_modules/.bin/tsx scripts/sutta-studio/generate-golden-from-demo.ts`.

2026-01-30 17:34 UTC - Point benchmark fixture to demo-derived golden
- Files: scripts/sutta-studio/benchmark-config.ts:18-23
- Why: Use demo-derived golden fixture for skeleton benchmarking.
- Details:
  - fixture.path now points to test-fixtures/sutta-studio-golden-from-demo.json
- Tests: Not run (not requested).

2026-01-30 17:42 UTC - Align skeleton prompt + example to demo-derived golden
- Files: config/suttaStudioPromptContext.ts:8-27; config/suttaStudioExamples.ts:6-64
- Why: Reduce over-grouping and match demo-derived golden expectations (mostly one segment per phase).
- Details:
  - Skeleton guidance now defaults to one segment per phase and explicitly avoids merging response/transition and benefit lines.
  - Skeleton example updated to show separate phases for 1.3/1.4/1.5/1.6 and 2.2–2.6.
- Tests: Not run (not requested).
2026-01-30 12:57 UTC - Add retries + stacked errors for Sutta Studio benchmark (in progress)
- Files: scripts/sutta-studio/benchmark.ts:367-568, 706-903, 1002-1315, 1348-1358; components/bench/SuttaStudioBenchmarkView.tsx:53-84, 361-421
- Why: Retry transient 429/5xx failures and surface all errors in the bench UI without digging into files.
- Details:
  - Added retry/backoff with Retry-After support for OpenRouter calls; network/timeouts retry once.
  - Progress state now accumulates per-chunk/pass errors and writes them to active-run.json.
  - Bench UI shows a stacked error list with timestamps/run/pass/chunk context.
- Tests: Not run (not requested).
2026-03-29 10:32 PDT - Patch book-switching shelf implementation plan before coding
- Files: docs/superpowers/plans/2026-03-29-book-switching-shelf.md:9,95,274,367,490,663,802,854,968,1277,1425; docs/WORKLOG.md
- Why: Remove implementation blockers and paper over fewer ambiguities before any code changes for the shelf feature.
- Details:
  - Added a Phase 1 scope gate so legacy cached novels without persisted `novelId` are treated as requiring one re-import instead of being silently misclassified as shelf-ready library novels.
  - Corrected Task 2/4 surface details by removing direct `store/storeTypes.ts` edits, making steady-state DB `novelId` fields `string | null`, and requiring fresh-DB index parity in `services/db/core/connection.ts` alongside the schema upgrade.
  - Reworked Task 5/6 so canonical `registryNovelId` is threaded through `ImportService` callers, `ensureChapterUrlMappings(...)` preserves mapping `novelId`, and legacy backfill only normalizes `undefined -> null` instead of pretending to recover ambiguous historical identity.
  - Split hydration planning into `loadNovelIntoStore(novelId)` for library novels and `loadAllIntoStore()` for ephemeral/full-session flows, updated Task 9 replacements accordingly, and clarified that consolidation must preserve caller-owned reader state like `currentChapterId` and `navigationHistory`.
  - Tightened bootstrap/navigation/new-book tasks so `?novel` imports pass canonical `novel.id`, reader transitions explicitly call `setReaderReady()`, and store-owned navigation sets active novel context after successful deep-link navigation.
  - Fixed remaining plan nits: corrected `ChapterHeader` test command to `.test.tsx` and expanded verification to include the legacy-cache re-import limitation.
- Tests: Not run (documentation-only plan patch).
2026-03-29 21:14 PDT - Conservative git cleanup: preserve live WIP, remove only stale merged local state
- Files: docs/WORKLOG.md
- Why: Clean up merged local branches/worktrees without discarding active work or replaying old stashes onto `main`.
- Details:
  - Re-read `docs/WORKLOG.md`, inspected local branches/worktrees/stashes, and confirmed `main` is still dirty.
  - Moved the dirty merged worktrees onto `codex/wip-book-switching-shelf-2026-03-29` and `codex/wip-roadmap-docs-2026-03-29`, then deleted the stale local branches `feat/codex-book-switching-shelf` and `feat/codex-roadmap-docs`.
  - Preserved `stash@{1}` on `codex/stash-epub-export-modal-2026-03-29` and `stash@{0}` on `codex/stash-gemini-pre-lfs-migrate-2026-03-29`, removed the temporary stash worktrees, and cleared the stash list.
  - Removed the clean merged `feat/codex-epub-diagnostics` worktree and local branch, and intentionally left dirty `main` plus the unmerged `feat/opus-library-search` worktree/branch untouched.
- Tests: Not run (git hygiene only).
### [2026-03-29 10:39 PDT] [Agent: Codex]
**Status:** Starting
**Task:** Implement book-switching shelf Phase 0/1 from patched plan, beginning with explicit appScreen routing and novel identity groundwork.
**Worktree:** ../LexiconForge.worktrees/codex-book-switching-shelf/
**Branch:** feat/codex-book-switching-shelf
**Files likely affected:** store/slices/uiSlice.ts; MainApp.tsx; store/bootstrap/initializeStore.ts; services/db/types.ts; services/db/core/schema.ts; services/db/core/connection.ts; services/stableIdService.ts; services/importService.ts; services/db/operations/imports.ts; services/db/operations/chapters.ts; services/db/operations/maintenance.ts; services/navigation/hydration.ts; services/navigation/index.ts; components/NovelLibrary.tsx; components/InputBar.tsx; store/slices/chaptersSlice.ts; components/ChapterView.tsx; components/chapter/ChapterHeader.tsx; tests/store/*; tests/components/*; docs/adr/*; docs/WORKLOG.md
### [2026-03-29 11:12 PDT] [Agent: Codex]
**Status:** In Progress
**Progress:** Landed the first feature slice: explicit app shell routing via `appScreen`, with reader entry points now driving library/loading/reader state instead of `MainApp` inferring it from loaded chapters.
**Files modified (line numbers + why):**
- MainApp.tsx:51,308-330 - replace derived `hasSession` routing with `appScreen` and add explicit `reader-loading` shell loader.
- store/slices/uiSlice.ts:14-18,54-60,116-155 - add `appScreen`, `activeNovelId`, and shell transition actions (`openLibrary`, `setReaderLoading`, `openNovel`, `setReaderReady`, `shelveActiveNovel`).
- store/bootstrap/initializeStore.ts:26,75-116 - initialize boot into library mode, set loading/ready shell state for `?novel` and `?import` deep-link imports, and return to library on failure.
- store/bootstrap/importSessionData.ts:20,55-56 - set `appScreen` to `reader` when a restored session resolves a current chapter.
- store/bootstrap/clearSession.ts:7-8 - reset shell routing to library and clear `activeNovelId` on clear-session.
- store/slices/chaptersSlice.ts:146-152,355-356,442,476 - mark successful chapter selection/navigation/fetch as reader mode.
- components/InputBar.tsx:27-29,45,97-111,143,163,173 - drive ephemeral import flows through reader loading/ready state and return to library on failures.
- components/NovelLibrary.tsx:25-27,69,122-125,222-224,266 - mark library-started reads as novel-scoped reader transitions and restore library mode on errors.
- tests/store/bootstrap/bootstrapHelpers.test.ts:112-113,148-166,239-367 - extend bootstrap test harness/state with shell actions and assert initialize/clear flows keep library as the default shell.
- tests/store/appScreen.integration.test.tsx (new) - add regression coverage proving `MainApp` renders library vs reader from `appScreen`, not from loaded chapter presence.
**Tests:** `npx vitest run tests/store/bootstrap/bootstrapHelpers.test.ts tests/store/appScreen.integration.test.tsx` ✅; `npx tsc --noEmit` ⚠️ fails in pre-existing unrelated `scripts/sutta-studio/*` files, not in this slice.
### [2026-03-29 11:35 PDT] [Agent: Codex]
**Status:** In Progress
**Progress:** Finished the novel-identity groundwork and consolidated the duplicated reader hydration paths behind a new `readerHydrationService`, while keeping `currentChapterId` and `navigationHistory` caller-owned.
**Files modified (line numbers + why):**
- services/db/types.ts:4-17,148-154 - make `novelId` first-class on persisted chapter and URL-mapping records.
- services/stableIdService.ts:48-58,111-160,200-251 - add `novelId` to runtime `EnhancedChapter` and thread canonical `registryNovelId` through transformed imports.
- services/db/core/schema.ts:24-25,365-377 - bump schema to v14 and restore missing `novelId` / `novelChapter` indexes as an explicit migration.
- services/db/core/connection.ts:237-278 - create the same `novelId` and compound mapping indexes on fresh installs.
- services/db/operations/imports.ts:101-169,237-253,349-374 - persist `novelId` and `chapterNumber` through both full-session and stable-session import paths.
- services/db/operations/chapters.ts:11-39,124-154,243-266,376-464 - preserve mapping `novelId`, store chapter membership, and make chapter-number lookup optionally novel-scoped.
- services/db/operations/maintenance.ts:15,36-49,128-145,304-325 - normalize legacy `undefined` `novelId` fields to `null` without pretending to recover ambiguous old library identity.
- services/db/operations/rendering.ts:30-57,88-127,247-275 - expose `novelId` in rendering records and add `fetchChaptersForNovel(novelId)`.
- services/db/core/stable-ids.ts:32-36 - stop URL-mapping rewrites from stripping `novelId` / `chapterNumber`.
- services/importService.ts:18-23,54-58,152-161,700-778 - thread canonical `registryNovelId` through imports and replace inline post-import hydration with `readerHydrationService`.
- services/readerHydrationService.ts (new) - centralize map/index reconstruction for `loadNovelIntoStore()` and `loadAllIntoStore()` without importing the Zustand store directly.
- components/NovelLibrary.tsx:11-12,67-98,131-206 - replace both inline hydration branches with `loadNovelIntoStore(novel.id, useAppStore.setState)` and make the cache path novel-scoped instead of global.
- components/InputBar.tsx:5,61-82 - replace ephemeral streaming hydration with `loadAllIntoStore(useAppStore.setState, { limit: 10 })`.
- store/bootstrap/importSessionData.ts:1-28 - replace full-session inline hydration with `loadAllIntoStore(...)` and keep navigation/current-chapter restore logic local.
- services/navigation/hydration.ts:52-80; services/navigation/index.ts:306-313 - propagate `novelId` back into runtime chapters loaded from IDB.
- services/db/index.ts:153-180,228-242,382-402,429-439; services/db/repositories/ChapterRepository.ts:27-62 - update legacy/memory repo compatibility paths for required persisted `novelId`.
- tests/db/migrations/fresh-install.test.ts:143-214 - verify fresh installs get the new chapter and URL-mapping indexes.
- tests/services/importService.test.ts:123-151 - assert `registryNovelId` is threaded into imported session payloads.
- tests/services/readerHydrationService.test.ts (new) - assert novel-scoped hydration, `novelId` preservation, and `loadAllIntoStore()` behavior.
- tests/current-system/*.test.ts; tests/services/navigationService.test.ts; tests/store/nullSafety.test.ts; tests/utils/test-data.ts - update helpers/builders to construct `EnhancedChapter` with explicit `novelId`.
**Tests:** `npx vitest run tests/db/migrations/fresh-install.test.ts tests/store/appScreen.integration.test.tsx tests/services/importService.test.ts tests/store/bootstrap/bootstrapHelpers.test.ts` ✅; `npx vitest run tests/current-system/export-import.test.ts tests/current-system/feedback.test.ts tests/current-system/navigation.test.ts tests/current-system/settings.test.ts tests/current-system/translation.test.ts tests/services/navigationService.test.ts tests/store/nullSafety.test.ts` ✅; `npx vitest run tests/services/readerHydrationService.test.ts tests/services/importService.test.ts tests/store/bootstrap/bootstrapHelpers.test.ts tests/store/appScreen.integration.test.tsx` ✅; `npx tsc --noEmit --pretty false` ⚠️ still fails only in pre-existing unrelated `scripts/sutta-studio/*` files.
### [2026-03-29 11:38 PDT] [Agent: Codex]
**Status:** In Progress
**Progress:** Split `initializeStore` into explicit phases and added a bootstrap regression so explicit startup intent (`?novel`, `?import`) no longer competes with passive last-active restoration.
**Files modified (line numbers + why):**
- store/bootstrap/initializeStore.ts:1-309 - replace the monolithic bootstrap body with named phase functions (`loadPromptTemplateState`, `runBootRepairs`, `handleBootstrapIntents`, `hydratePersistedState`, `initializeAudioServices`) and gate passive bookmark restoration behind `restoreReaderState`.
- tests/store/bootstrap/bootstrapHelpers.test.ts:6-57,184-209,357-384 - mock `NavigationOps`, `novelCatalog`, and `ImportService`, then add a deep-link regression proving `?novel` intent is honored without restoring an unrelated last-active chapter.
**Tests:** `npx vitest run tests/store/bootstrap/bootstrapHelpers.test.ts tests/services/readerHydrationService.test.ts tests/services/importService.test.ts tests/store/appScreen.integration.test.tsx` ✅; `npx tsc --noEmit --pretty false` ⚠️ still fails only in pre-existing unrelated `scripts/sutta-studio/*` files.
### [2026-03-29 11:46 PDT] [Agent: Codex]
**Status:** In Progress
**Progress:** Added the first end-to-end shelf layer: persisted `bookshelf-state`, debounced bookmark autosave, explicit shelf flush on “Library”, resume-point resolution, and a “Continue Reading” section in the library.
**Files modified (line numbers + why):**
- services/bookshelfStateService.ts (new) - define the `bookshelf-state` settings record, normalize persisted entries, upsert/list bookmarks, and resolve stale resume points by `lastChapterId` then `lastChapterNumber`.
- store/slices/uiSlice.ts:12,137-161 - flush the active novel’s bookmark immediately when shelving the reader before clearing `activeNovelId`.
- store/slices/chaptersSlice.ts:15,94-124,159-160,380-381,467-468,494-495 - add debounced bookmark autosave keyed by `activeNovelId` so chapter changes persist reading position without synchronous writes on every navigation.
- components/chapter/ChapterHeader.tsx:12,43,93-101,161-168 - add a reader-visible `Library` action on desktop and mobile.
- components/ChapterView.tsx:54,334 - wire the new header action to `shelveActiveNovel()`.
- components/InputBar.tsx:24-27,102-105 - treat pasted one-off chapter URLs as ephemeral by shelving any active library novel before fetching them.
- components/NovelCard.tsx:7-15,35-66 - support optional progress badge/label rendering for in-progress shelf cards.
- components/NovelLibrary.tsx:3-14,18-37,72-151,220-272 - load bookshelf entries on mount, resume cached novels from saved position with stale-bookmark fallback, and render a `Continue Reading` shelf section above the main catalog.
- tests/services/bookshelfStateService.test.ts (new) - verify bookshelf-state normalization, upsert behavior, and stale-resume fallback.
- tests/store/bookshelfPersistence.test.ts (new) - verify debounced autosave and immediate shelf flush both write the expected bookmark.
- tests/components/NovelLibrary.test.tsx:1-163 - mock bookshelf state and assert `Continue Reading` renders with resume metadata.
- tests/components/chapter/ChapterHeader.test.tsx:6-58 - cover the new library button.
**Tests:** `npx vitest run tests/services/bookshelfStateService.test.ts tests/components/NovelLibrary.test.tsx tests/components/chapter/ChapterHeader.test.tsx tests/store/bootstrap/bootstrapHelpers.test.ts tests/services/readerHydrationService.test.ts tests/services/importService.test.ts tests/store/appScreen.integration.test.tsx` ✅; `npx vitest run tests/store/bookshelfPersistence.test.ts tests/services/bookshelfStateService.test.ts tests/components/NovelLibrary.test.tsx tests/components/chapter/ChapterHeader.test.tsx tests/store/bootstrap/bootstrapHelpers.test.ts tests/services/readerHydrationService.test.ts tests/services/importService.test.ts tests/store/appScreen.integration.test.tsx` ✅; `npx tsc --noEmit --pretty false` ⚠️ still fails only in pre-existing unrelated `scripts/sutta-studio/*` files.
### [2026-03-29 13:57 PDT] [Agent: Codex]
**Status:** In Progress
**Progress:** Refined the shelf UX to remember the last-read library version per novel and resume it directly from shelf cards, while keeping the current IDB model honest by bypassing cache only when the user explicitly switches to a different version.
**Files modified (line numbers + why):**
- store/slices/uiSlice.ts:17-21,55-61,118-121,136-181 - add `activeVersionId` to shell state, thread it through `openNovel`/`setReaderLoading`, and persist/clear it when shelving back to the library.
- store/slices/chaptersSlice.ts:109-127 - include `activeVersionId` in debounced bookshelf autosaves so saved bookmarks know which library version was last read.
- store/bootstrap/clearSession.ts:5-10 - reset `activeVersionId` alongside `activeNovelId` on full session clears.
- components/NovelCard.tsx:5-26 - add an optional `onSelect` override so Continue Reading cards can resume directly while the main grid still opens the detail sheet.
- components/NovelLibrary.tsx:35-70,100-139,153-204,255-330 - persist version-aware resume entries, skip stale cache when the user chooses a different version than the saved one, and turn Continue Reading cards into one-tap resume actions with version labels.
- tests/components/NovelLibrary.test.tsx:1-258 - replace the shelf test harness with a real mocked store/service boundary, then cover version labels and direct shelf resume into the saved version.
- tests/services/bookshelfStateService.test.ts:30-71 - verify `versionId` survives bookshelf normalization/upsert.
- tests/store/bookshelfPersistence.test.ts:17-66 - verify immediate shelf flush and debounced autosave both persist the active version identifier.
**Tests:** `npx vitest run tests/components/NovelLibrary.test.tsx tests/services/bookshelfStateService.test.ts tests/store/bookshelfPersistence.test.ts tests/components/chapter/ChapterHeader.test.tsx` ✅; `npx vitest run tests/store/appScreen.integration.test.tsx tests/store/bootstrap/bootstrapHelpers.test.ts tests/store/chaptersSlice.test.ts tests/current-system/navigation.test.ts tests/current-system/translation.test.ts tests/services/navigationService.test.ts tests/services/importService.test.ts` ✅; `npx tsc --noEmit --pretty false` ⚠️ still fails only in pre-existing unrelated `scripts/sutta-studio/*` files.
### [2026-03-29 14:10 PDT] [Agent: Codex]
**Status:** In Progress
**Progress:** Patched the two confirmed bug families before manual QA: preload now stays novel-scoped, and every reader-switching InputBar import/fetch variant shelves the active library novel before proceeding.
**Files modified (line numbers + why):**
- store/slices/chaptersSlice.ts:730-766 - thread `activeNovelId` into the preload worker and pass it to `ChapterOps.findByNumber(...)` so preloading cannot cross into another cached novel.
- components/InputBar.tsx:26-40,47-55,96-107,120-125 - add a shared `shelveActiveLibraryNovel()` guard and call it for session JSON URL imports, regular chapter fetches, example-site clicks, and local file imports.
- tests/store/chaptersSlice.test.ts:7-20,196-230 - add a fake-timer preload regression proving the worker calls `findByNumber(…, activeNovelId)`.
- tests/components/InputBar.test.tsx (new) - add guardrail regressions proving session JSON URL imports, local file imports, and example-link fetches all shelve first when a library novel is active.
**Tests:** `npx vitest run tests/components/InputBar.test.tsx tests/store/chaptersSlice.test.ts` ✅; `npx vitest run tests/components/InputBar.test.tsx tests/store/chaptersSlice.test.ts tests/store/appScreen.integration.test.tsx tests/store/bootstrap/bootstrapHelpers.test.ts tests/current-system/navigation.test.ts tests/current-system/translation.test.ts tests/services/navigationService.test.ts tests/services/importService.test.ts tests/store/bookshelfPersistence.test.ts tests/components/NovelLibrary.test.tsx` ✅; `npx tsc --noEmit --pretty false` ⚠️ still fails only in pre-existing unrelated `scripts/sutta-studio/*` files.
### [2026-03-29 14:28 PDT] [Agent: Codex]
**Status:** In Progress
**Progress:** Investigated broken library/detail-sheet cover images and fixed the actual transport issue instead of masking it. Root cause: some remote hosts, including Imgur, reject direct image requests when the browser sends the local app URL as the `Referer`. Verified with `curl`: the same image returned `200 image/jpeg` with no referer, `403` with `Referer: http://127.0.0.1:4173/`, and `200 image/jpeg` with `Referer: https://imgur.com/`.
**Files modified (line numbers + why):**
- components/NovelCoverImage.tsx:1-46 (new) - centralize cover rendering so remote images are requested with `referrerPolicy="no-referrer"`, reset error state when the source changes, and render a consistent placeholder on load failure.
- components/NovelCard.tsx:4,28-37 - replace the inline cover `<img>` with the shared `NovelCoverImage` component so the library grid uses the same transport-safe behavior.
- components/NovelDetailSheet.tsx:6,175-185 - replace the inline cover `<img>` with the shared `NovelCoverImage` component so the detail sheet does not regress independently.
- tests/components/NovelCoverImage.test.tsx:1-69 (new) - verify the `no-referrer` policy, the fallback placeholder on error, and resetting error state when a new image URL arrives.
**Tests:** `npx vitest run tests/components/NovelCoverImage.test.tsx tests/components/NovelLibrary.test.tsx tests/components/VersionPicker.test.tsx` ✅; `npx vitest run tests/components/NovelCoverImage.test.tsx tests/components/NovelLibrary.test.tsx tests/components/InputBar.test.tsx tests/store/appScreen.integration.test.tsx` ✅; `npx tsc --noEmit --pretty false` ⚠️ still fails only in pre-existing unrelated `scripts/sutta-studio/*` files.
### [2026-03-29 21:24 PDT] [Agent: Codex]
**Status:** In Progress
**Progress:** Added a narrow NovelHi chapter adapter so the importer can ingest specific missing fan-translation chapters by URL without broadening into a generic crawler. Verified the real FMC hole URLs (`766`, `1911`, `2187`, `2348`) all return structured chapter bodies with usable paragraph counts, which is enough to support principled hole recovery after raw/PDF cross-checking.
**Files modified (line numbers + why):**
- scripts/lib/adapters/novelhi-adapter.ts:1-136 (new) - add a URL-based `NovelHiAdapter`, parse real chapter HTML with `jsdom`, strip ad/script noise from `#showReading`, preserve paragraph boundaries, and return importer-compatible `TranslationSourceOutput`.
- scripts/lib/translation-sources.ts:12-35 - register/export the new adapter so manifests can point directly at `https://novelhi.com/s/.../<chapter>` URLs.
- tests/scripts/novelhi-adapter.test.ts:1-66 (new) - cover HTML parsing and adapter extraction with mocked fetch so the behavior stays stable without relying on live network during tests.
**Tests:** `npx vitest run tests/scripts/novelhi-adapter.test.ts tests/scripts/library-session-builder.test.ts` ✅; `npx tsx -e "import { NovelHiAdapter } from './scripts/lib/adapters/novelhi-adapter.ts'; const run = async () => { const adapter = new NovelHiAdapter(); const urls = ['https://novelhi.com/s/Forty-Millenniums-of-Cultivation/766','https://novelhi.com/s/Forty-Millenniums-of-Cultivation/1911','https://novelhi.com/s/Forty-Millenniums-of-Cultivation/2187','https://novelhi.com/s/Forty-Millenniums-of-Cultivation/2348']; for (const url of urls) { const result = await adapter.extract(url); console.log(JSON.stringify({ url, title: result.chapters[0]?.title, paragraphs: result.chapters[0]?.paragraphs.length, first: result.chapters[0]?.paragraphs[0]?.text.slice(0, 120) }, null, 2)); } }; run().catch((error) => { console.error(error); process.exit(1); });"` ✅
### [2026-03-29 21:44 PDT] [Agent: Codex]
**Status:** In Progress
**Progress:** Broadened the NovelHi adapter into a range-capable batch source without turning it into a full crawler. The importer can now fetch local candidate windows like `novelhi://Forty-Millenniums-of-Cultivation?from=765&to=767`, which is exactly what the FMC hole resolver needs for widened local search around drift points.
**Files modified (line numbers + why):**
- scripts/lib/adapters/novelhi-adapter.ts:10-25,32-76,159-223 - add explicit range-spec parsing, reuse a single chapter-fetch path for both single and batched inputs, and return multi-chapter outputs for local candidate windows.
- tests/scripts/novelhi-adapter.test.ts:33-112 - add parser coverage for the custom range input and a mocked multi-fetch regression proving the adapter returns a batch of chapters from a `novelhi://...?...` spec.
**Tests:** `npx vitest run tests/scripts/novelhi-adapter.test.ts tests/scripts/library-session-builder.test.ts` ✅; `npx tsx -e "import { NovelHiAdapter } from './scripts/lib/adapters/novelhi-adapter.ts'; const run = async () => { const adapter = new NovelHiAdapter(); const out = await adapter.extract('novelhi://Forty-Millenniums-of-Cultivation?from=765&to=767'); console.log(JSON.stringify({ chapterCount: out.chapters.length, numbers: out.chapters.map((ch) => ch.chapterNumber), titles: out.chapters.map((ch) => ch.title) }, null, 2)); }; run().catch((error) => { console.error(error); process.exit(1); });"` ✅
### [2026-03-29 22:55 PDT] [Agent: Codex]
**Status:** In Progress
**Task:** Principled split for book-switching before merge: make version-aware shelf state truthful all the way down to persistence and live navigation.
**Worktree:** `/Users/aditya/Documents/Ongoing Local/LexiconForge.worktrees/codex-book-switching-shelf`
**Branch:** `codex/wip-book-switching-shelf-2026-03-29`
**Hypothesis:** The shelf/version UX is only partially real today because version scope is threaded through library import and hydration, but live chapter fetch/navigation plus some DB summary/mapping paths still operate at novel-only scope. If true, switching versions can still cross-contaminate cached chapters or resume behavior whenever the app fetches new chapters beyond the already-imported set.
**Files under investigation (line numbers + why):**
- services/libraryScope.ts:1-40 - define the canonical scoped identity helpers for version-aware bookshelf keys, stable IDs, and synthetic storage URLs.
- services/stableIdService.ts:190-260 - ensure imported library chapters carry `libraryVersionId` and receive scoped stable IDs.
- services/importService.ts:150-240,520-610 - keep library imports and streaming imports version-aware at the session payload and per-chapter persistence layers.
- services/db/core/schema.ts:25-40,360-392 - add compound chapter/url-mapping indexes for `(novelId, libraryVersionId, chapterNumber)` lookups.
- services/db/operations/imports.ts:60-120,140-240,285-460 - normalize imported full/stable sessions into scoped storage URLs and scoped URL mappings.
- services/db/operations/chapters.ts:12-95,108-165,257-298,399-505 - persist `libraryVersionId` on chapter records, recompute summaries, and make chapter-number lookups version-aware.
- services/db/operations/rendering.ts:31-121,252-296 - hydrate only the requested library version and keep rendered `sourceUrls` honest when chapter URLs are synthetic storage keys.
- services/bookshelfStateService.ts:1-94 - make persisted resume entries version-aware and retain compatibility with older novel-only keys.
- services/readerHydrationService.ts:12-95,139-193 - hydrate only the requested novel/version slice into the reader store.
- services/navigation/fetcher.ts:1-210; services/navigation/index.ts:20-40,380-382 - propagate `{ novelId, versionId }` through live chapter fetches so on-demand navigation stores fetched chapters in the correct scoped namespace.
- store/slices/chaptersSlice.ts:96-124,318-477,730-813 - persist bookshelf positions with version IDs and pass version scope into preload/fetch flows.
- components/NovelLibrary.tsx:40-230 - continue reading and version-picker flows should use the same version-aware import/hydration contract as the lower layers.
- tests/services/bookshelfStateService.test.ts, tests/services/readerHydrationService.test.ts, tests/components/NovelLibrary.test.tsx, tests/store/bookshelfPersistence.test.ts, tests/services/navigationService.test.ts, tests/store/chaptersSlice.test.ts, tests/store/appScreen.integration.test.tsx - cover version-aware resume/fetch behavior and catch remaining novel-only assumptions.
**Diagnostics so far:** `npx vitest run tests/store/appScreen.integration.test.tsx --reporter=verbose` ✅ standalone; earlier mixed-suite timeout appears to be test interaction, not a confirmed shell regression. No version-aware fetch coverage has been run yet after the current storage changes.
### [2026-03-29 23:07 PDT] [Agent: Codex]
**Status:** In Progress
**Progress:** Completed the first principled version-awareness slice. Runtime scope is now threaded through library resume keys, reader hydration, live chapter fetches, scoped cache lookup, and preload. The key corrective change was refusing to fall back to global URL mappings when a library-scoped lookup misses; scoped reads now either resolve inside the requested `(novelId, versionId)` namespace or honestly fetch.
**Files modified (line numbers + why):**
- services/bookshelfStateService.ts:13-36,42-74 - preserve the persisted composite key while keeping `entry.novelId` truthful, so `orv::alice-v1` no longer normalizes into a fake novel id.
- services/navigation/types.ts:17-27 - add explicit optional library fetch scope to the navigation contract.
- services/navigation/fetcher.ts:9,67-79 - thread scope into fetch-time cache lookup and stable-id transformation.
- services/navigation/hydration.ts:11,66-89,217-246 - hydrate versioned chapters with real `sourceUrls` instead of synthetic storage URLs and make cache lookup scoped when a library novel/version is active.
- services/navigation/index.ts:13,40-81,205-243,274-303,404-405 - add scoped IDB lookup before global fallbacks and forbid cross-version global mapping reuse during scoped navigation.
- services/db/operations/chapters.ts:12-15,72-131,206-262,471-478 - persist summary `libraryVersionId`, add scoped source-url lookup, and expose it through `ChapterOps`.
- services/db/operations/rendering.ts:31-57,99-118 - retain `novelId`/`libraryVersionId` in hydrated rendering packets so versioned reader hydration remains lossless.
- store/slices/chaptersSlice.ts:320-329,447-450,803-806 - pass active `(novelId, versionId)` into navigation and preload fetches.
- tests/services/bookshelfStateService.test.ts:24-50 - lock in composite-key normalization without corrupting `novelId`.
- tests/store/nullSafety.test.ts:19-34,90-106 - assert `chaptersSlice.handleFetch()` forwards the active version scope.
- tests/store/chaptersSlice.test.ts:194-231 - assert preload chapter-number lookup is version-aware.
- tests/current-system/navigation.test.ts:7-15,61-76 - align runtime expectations with scoped `handleFetch` calls.
- tests/services/readerHydrationService.test.ts:15-79 - assert hydrated chapters preserve `libraryVersionId`.
- tests/db/migrations/fresh-install.test.ts:357-360; tests/store/bootstrap/bootstrapHelpers.test.ts:420-529; tests/current-system/export-import.test.ts:27-54; tests/current-system/feedback.test.ts:12-37; tests/current-system/settings.test.ts:21-46; tests/current-system/translation.test.ts:21-32; tests/services/navigationService.test.ts:109-121 - update assertions/fixtures to match the now-explicit version-aware contract and `EnhancedChapter` shape.
- scripts/lib/adapters/novelhi-adapter.ts:131-136 - tighten DOM typing so the branch returns to the pre-existing TypeScript baseline after `EnhancedChapter`/navigation changes.
**Tests:** `npx vitest run tests/services/bookshelfStateService.test.ts tests/services/readerHydrationService.test.ts tests/store/bookshelfPersistence.test.ts tests/store/nullSafety.test.ts tests/store/chaptersSlice.test.ts tests/current-system/navigation.test.ts tests/services/navigationService.test.ts tests/components/NovelLibrary.test.tsx tests/store/bootstrap/bootstrapHelpers.test.ts tests/store/appScreen.integration.test.tsx tests/db/migrations/fresh-install.test.ts` ✅; `npx vitest run tests/current-system/export-import.test.ts tests/current-system/feedback.test.ts tests/current-system/settings.test.ts tests/current-system/translation.test.ts tests/services/importService.test.ts` ✅; `npx tsc --noEmit --pretty false` ⚠️ only pre-existing `scripts/sutta-studio/*` errors remain.
### [2026-05-05 16:41 EDT] [Agent: Codex]
**Status:** Progress
**Task:** Ratify Phase 1 decisions for issue #19 translation-survives-navigation policy.
**Files modified (line numbers + why):**
- `issues/19-translation-survives-nav-policy/README.md:200-205,223` - recorded Aditya's ratification of D1-D4 as written and marked the Phase 1 decision gate complete.
- `docs/WORKLOG.md` - logged this documentation-only ratification step per project protocol.
**Tests:** Not run; documentation-only change.

### [2026-04-02 23:56 EDT] [Agent: Codex]
**Status:** Starting
**Task:** Split chapter translation from prompt-amendment proposal generation so raw-only translation can stay fan-blind while amendment proposals can optionally inspect the fan translation as a separate pass.
**Worktree:** `/Users/aditya/Documents/Ongoing Local/LexiconForge.worktrees/codex-separate-amendment-pass`
**Branch:** `feat/codex-separate-amendment-pass`
**Hypothesis:** The current single-call structured-output contract couples translation quality evaluation and prompt/glossary refinement too tightly. If translation and proposal generation are separated, the app can preserve a clean raw-only translation benchmark while still using the fan translation as inspiration for amendment proposals after the translation is complete.
**Files under investigation (line numbers + why):**
- `adapters/providers/OpenAIAdapter.ts` - split translation request construction from proposal request construction and parse a proposal-only follow-up response.
- `adapters/providers/GeminiAdapter.ts` - mirror the split for Gemini so the provider layer stays behaviorally aligned.
- `services/translate/translationResponseSchema.ts` - introduce a proposal-only schema instead of overloading the translation schema.
- `services/translate/Translator.ts` - keep chunked translation behavior coherent and avoid per-chunk proposal leakage.
- `services/translationService.ts` - orchestrate translation first, then optional proposal generation, and merge the results before persistence.
- `store/slices/translationsSlice.ts` - keep proposal queueing behavior correct after the service split and fix version-identity assumptions.
- `types.ts` - persist the relevant toggle settings so duplicate-version detection reflects actual prompt conditions.
- `components/settings/TranslationParametersSection.tsx` - verify the user-facing toggle semantics still match the backend behavior.
- `tests/services/*`, `tests/store/*`, `tests/components/settings/*` - add regressions for raw-only translation, proposal-only follow-up calls, and duplicate-version matching across toggle changes.
### [2026-04-03 03:02 EDT] [Agent: Codex]
**Status:** Complete
**Progress:** Finished the translation/proposal split. Chapter translation now always runs as a translation-only call with Part A stripped from the system prompt, while amendment proposals run as a separate follow-up pass that can inspect the completed AI translation and the fan translation without contaminating the main translation request. I also fixed the version snapshot gap so `enableAmendments` and `includeFanTranslationInPrompt` now participate in duplicate-version detection and persistence, and cleaned up the chunk-merging type drift in `Translator.ts`.
**Files modified (line numbers + why):**
- `services/translationService.ts:62-156,294-356,803-870` - add proposal parsing/validation helpers, run a second provider `chatJSON` call for amendment review after translation succeeds, always pass fan translation only to the amendment review prompt, persist the new toggle fields, and treat toggle changes as meaningful for retranslation checks.
- `services/prompts.ts:57-114` - add dedicated amendment-review system/user prompt builders so the second pass reviews the current prompt and completed translation instead of reusing translation instructions.
- `services/translate/translationResponseSchema.ts:10-205` - split the schema layer into translation-only, proposal-only, and legacy combined helpers for both JSON-schema and Gemini-schema providers.
- `adapters/providers/OpenAIAdapter.ts:12-13,342-350` - switch translation requests to the translation-only schema and strip Part A unconditionally for the translation pass.
- `adapters/providers/GeminiAdapter.ts:11-12,91,238-240` - mirror the OpenAI change for Gemini so translation remains proposal-free and fan-gated only by `includeFanTranslationInPrompt`.
- `services/claudeService.ts:9,57-82,302` - strip Part A before Claude translation requests and force the Claude translation result to return `proposal: null`, leaving amendment generation to the second pass.
- `utils/promptUtils.ts:19-24` - replace the old conditional helper with `getTranslationSystemPrompt()` to make the split explicit.
- `types.ts:189-205` - extend `TranslationSettingsSnapshot` with `enableAmendments` and `includeFanTranslationInPrompt`.
- `services/translationPersistenceService.ts:15-20`; `services/db/repositories/interfaces/ITranslationRepository.ts:5-13`; `services/db/operations/translations.ts:15-32,97-149`; `store/slices/translationsSlice.ts:173-179,554-555,1034-1035`; `store/slices/imageSlice.ts:108-121` - persist and compare the new toggle fields everywhere translation snapshots are stored or reused.
- `components/settings/TranslationParametersSection.tsx:185-188` - update the settings copy to describe the new “extra AI call” behavior truthfully.
- `services/translate/Translator.ts:1-8,241-312` - fix chunk-merge typing so aggregated `usageMetrics.provider` stays a valid provider enum and `tokensUsed` uses the current `promptTokens/completionTokens/totalTokens` shape.
- `tests/services/translationService.test.ts:1-224` (new) - cover the separate proposal pass, fan-reference inclusion during proposal generation, proposal suppression when amendments are disabled, and retranslation when either toggle changes.
- `tests/adapters/providers/GeminiAdapter.test.ts:17-18` - update the prompt-utils mock to the renamed translation helper used by the new adapter path.
**Tests:** `npx vitest run tests/services/translate/Translator.test.ts tests/services/translationService.test.ts tests/adapters/providers/GeminiAdapter.test.ts tests/adapters/providers/OpenAIAdapter.test.ts tests/adapters/providers/ClaudeAdapter.test.ts tests/services/aiService.translateChapter.test.ts` ✅; `./node_modules/.bin/tsc --noEmit 2>&1 | rg "services/translate/Translator.ts|tests/services/translationService.test.ts|tests/adapters/providers/GeminiAdapter.test.ts|services/translationService.ts|adapters/providers/OpenAIAdapter.ts|adapters/providers/GeminiAdapter.ts|services/claudeService.ts|utils/promptUtils.ts|services/translate/translationResponseSchema.ts|services/prompts.ts|store/slices/translationsSlice.ts|types.ts"` ✅ (no matches). Full `tsc` still reports unrelated pre-existing errors in `scripts/sutta-studio/*`.
2026-04-09 09:10 EDT - [Agent: Codex]
- Status: Progress
- Task: Restore library backward compatibility for changed novel metadata so stale version links/bookshelf entries still open cached novels safely.
- Files:
  - services/registryService.ts
  - store/bootstrap/initializeStore.ts
  - components/NovelLibrary.tsx
  - types/novel.ts
  - tests/services/registryService.test.ts
  - tests/store/bootstrap/bootstrapHelpers.test.ts
  - tests/components/NovelLibrary.test.tsx
  - docs/WORKLOG.md
- Why:
  - Relative metadata asset URLs like `./session.json` and `./glossary.json` were being consumed as app-root URLs, causing import/glossary 404s.
  - Stale deep links and bookshelf entries failed hard when an upstream version id was renamed or removed, even when cached chapters were still safe to open.
- Details:
  - Added metadata URL normalization in the registry layer so version session files, glossary layers, and cover images resolve relative to the fetched `metadata.json`.
  - Added version compatibility resolution with explicit legacy aliases plus a conservative single-version fallback when the requested version no longer exists.
  - Updated bootstrap and library resume flows to warn when a saved version was substituted, but continue loading the compatible cached/remote novel when safe.
- Tests:
  - `npx vitest run tests/services/registryService.test.ts` ✅
  - `npx vitest run tests/store/bootstrap/bootstrapHelpers.test.ts` ✅
  - `npx vitest run tests/components/NovelLibrary.test.tsx` ✅

2026-04-09 09:50 EDT - [Agent: Codex]
- Status: Progress
- Task: Fix FMC session artifact resolution so Git LFS-backed `session.json` imports fetch real JSON and fail clearly when a pointer slips through.
- Files:
  - services/registryService.ts
  - services/importService.ts
  - tests/services/registryService.test.ts
  - tests/services/importService.test.ts
  - docs/WORKLOG.md
- Why:
  - The FMC metadata now resolved correctly, but `raw.githubusercontent.com` still served the Git LFS pointer for `session.json`, producing `Unexpected token 'v'` during JSON parsing.
- Details:
  - Rewrote GitHub raw session artifact URLs to `media.githubusercontent.com` during registry metadata normalization.
  - Added importer-side GitHub session URL normalization so direct/raw session links are upgraded before fetch.
  - Added explicit Git LFS pointer detection with a clear error message instead of an opaque JSON parse failure.
- Tests:
  - `npx vitest run tests/services/registryService.test.ts` ✅
  - `npx vitest run tests/services/importService.test.ts` ✅

2026-04-09 10:26 EDT - [Agent: Codex]
- Status: Progress
- Task: Capture temporary library compatibility debt introduced during the FMC/version-migration fix.
- Files:
  - docs/roadmaps/TECH-DEBT-INBOX.md
  - docs/WORKLOG.md
- Why:
  - The new library compatibility behavior is intentionally temporary and should be removed once metadata/version migration is complete.
- Details:
  - Created `docs/roadmaps/TECH-DEBT-INBOX.md` and added a receipt for the temporary version-alias fallback, raw→media session URL rewrite, and Git LFS pointer guard.
  - [DEBT] The receipt includes explicit exit criteria so this compatibility code can be removed deliberately rather than forgotten.

### [2026-05-15 03:00 UTC] [Agent: Codex]
**Status:** Complete
**Task:** Implement plan 3 (`polyglot-foundations`) by adding a SuttaCentral parallels panel in Sutta Studio.
**Progress:** Added SC parallels service helpers, a new UI panel to list/open parallels, and unit coverage for nested parallels flattening. Kept scope to view-layer only (no schema/storage migration).
**Files modified (line numbers + why):**
- `services/scraping/scParallels.ts` — new fetch/normalize helpers (`fetchParallels`, `fetchParallelText`) using the existing fetch proxy route.
- `types/suttaStudio.ts` — added `ParallelType` and `ParallelInfo` for typed panel/service contract.
- `components/sutta-studio/ParallelsPanel.tsx` — new collapsible panel UI + open-on-demand text rendering.
- `components/sutta-studio/SuttaStudioApp.tsx` — mounted `ParallelsPanel` for SuttaCentral routes only.
- `tests/services/scraping/scParallels.test.ts` — verifies nested endpoint shape flattening + normalization.
**Tests:**
- `npx vitest run tests/services/scraping/scParallels.test.ts`

### [2026-05-15 12:30 UTC] [Agent: Codex]
**Status:** Complete
**Task:** Close out polyglot pickup-plan bookkeeping after PR merge.
**Progress:** Marked polyglot plan as shipped in plans index and moved plan document to `PLANS/SHIPPED/` per plan workflow.
**Files modified:**
- `docs/sutta-studio/PLANS/README.md`
- `docs/sutta-studio/PLANS/SHIPPED/polyglot-foundations.md` (moved from root plans folder)
- `docs/WORKLOG.md`
**Tests:** Not run (docs-only update).

### [2026-05-15 13:25 UTC] [Agent: Codex]
**Status:** Complete
**Task:** Address PR #58 review blockers for polyglot parallels (SC shape + non-Pali text fetch).
**Progress:** Reworked SC parallels parser to read `type` from outer entry + `uid/root_lang/acronym` from nested `to`, switched text fetch from `/api/bilarasuttas/<uid>/sujato` to `/api/suttas/<uid>` for non-Pali compatibility, updated tests to real endpoint shape, and added CJK-friendly font stack + acronym display in panel.
**Files modified (line numbers + why):**
- `services/scraping/scParallels.ts` — fix shape parsing and cross-language text endpoint.
- `tests/services/scraping/scParallels.test.ts` — use real-shaped parallels fixture and add `/api/suttas` text test.
- `components/sutta-studio/ParallelsPanel.tsx` — display acronym and use readable CJK-capable fallback stack.
- `docs/WORKLOG.md` — log review-driven follow-up.
**Tests:**
- `npx vitest run tests/services/scraping/scParallels.test.ts`

### [2026-05-15 13:40 UTC] [Agent: Codex]
**Status:** Complete
**Task:** Address remaining PR #58 text-rendering bug for SC parallels across Pali/Chinese/fragment shapes.
**Progress:** Implemented shape-specific text extraction in `fetchParallelText`: strips HTML from `root_text.text` payloads, falls back to Bilara segmented fetch using discovered `author_uid` for Pali, and returns a clear unsupported-source message when neither shape is available. Also wired panel error text to display detailed service message.
**Files modified (line numbers + why):**
- `services/scraping/scParallels.ts` — robust multi-shape SC text handling and clear failure messaging.
- `tests/services/scraping/scParallels.test.ts` — coverage for html-blob roots, bilara-author segmented fallback, and unsupported fragment case.
- `components/sutta-studio/ParallelsPanel.tsx` — show thrown error message for better UX/debug clarity.
- `docs/WORKLOG.md` — record follow-up work.
**Tests:**
- `npx vitest run tests/services/scraping/scParallels.test.ts`

2026-05-17 14:45 UTC - [Agent: Codex]
- Status: Complete
- Task: Build a visual HTML mockup for task manager UX with Capture / Do Next / Clarify modes and mock task sorting.
- Files:
  - public/task-planner-mockup.html
  - docs/WORKLOG.md
- Why:
  - User requested a concrete, beautiful UI mockup (not text wireframes) focused on front-end behavior for quick capture, next-action selection, and clarification with dependencies.
- Details:
  - Added a standalone local mock page with a modern glassmorphism aesthetic and 3-mode navigation.
  - Implemented mock-data task list in Do Next mode with quick sort/filter by time, energy, and genre (logistical vs thinking).
  - Added Clarify mode fields for next physical action and dependency edges.

### [2026-05-28 08:47 EDT] [Agent: Codex]
**Status:** Progress
**Task:** Treat Playwright failures as signal before closing stale issues.
**Worktree:** `/private/tmp/LexiconForge-e2e-issues`
**Branch:** `fix/codex-e2e-signal-triage`
**Files modified (line numbers + why):**
- `tests/e2e/chapterview-media.spec.ts:8-9` - enable the audio feature explicitly before asserting the generated background-music control; the product gates audio UI behind `settings.enableAudio`.
- `tests/e2e/initialization.spec.ts:14-75,118,132,150,171-185,197,213-223,238-254` - replace stale exact `[Store:init]` prefix checks and hard-coded 10-store expectations with current timestamped init-log detection, schema-derived store assertions, and actual prompt-template persistence checks.
- `tests/e2e/stale-issues-verification.spec.ts:1-143` - add issue-specific e2e coverage for Hetushu loading/watermark cleanup (#26) and Sutta tooltip-vs-audit-panel citation behavior (#45).
**Investigation notes:**
- `chapterview-media.spec.ts` failed deterministically because the test asserted audio UI while using default settings where audio is intentionally disabled.
- `fojin-sutta-studio-m2.spec.ts` passed in isolation; its earlier full-suite failure was cascade/timing noise after prior failures.
- `initialization.spec.ts` failed deterministically even though debug output showed `initializeStore complete – isInitialized true`; root cause was stale log matching and stale store-count assertions after `api_metrics` became part of schema v16.
**Tests:**
- `npx playwright test tests/e2e/chapterview-media.spec.ts tests/e2e/initialization.spec.ts --reporter=list --workers=1` ✅ 6 passed.
- `npx playwright test --reporter=list --workers=1` ✅ 13 passed, 7 skipped.

### [2026-05-28 14:03 EDT] [Agent: Codex]
**Status:** Progress
**Task:** Harden PR #78 after Claude review flagged residual e2e flake vectors.
**Worktree:** `/private/tmp/LexiconForge-e2e-issues`
**Branch:** `fix/codex-e2e-signal-triage`
**Files modified (line numbers + why):**
- `tests/e2e/initialization.spec.ts:164-176,212-224,233-244` - replace remaining fixed sleeps with init-complete log waits before checking stores, prompt templates, and reload behavior.
- `tests/e2e/stale-issues-verification.spec.ts:74-106,124-132` - remove serial coupling so #26 and #45 report independently; scope Hetushu error capture to Hetushu/scraping runtime errors and page exceptions; select the tooltip by its visible content instead of Tailwind classes.
**Investigation notes:**
- Claude review found no blocking goodharting issue, but correctly identified flake risks in serial test mode, fixed init sleeps, and broad console-error gating.
- Targeted tests passed with default parallel workers after hardening.
**Tests:**
- `npx playwright test tests/e2e/initialization.spec.ts tests/e2e/stale-issues-verification.spec.ts --reporter=list` ✅ 7 passed.
- `npx playwright test --reporter=list` ✅ 13 passed, 7 skipped.

### [2026-05-28 14:09 EDT] [Agent: Codex]
**Status:** Progress
**Task:** Fix PR #78 CI vitest blocker without weakening test signal.
**Worktree:** `/private/tmp/LexiconForge-e2e-issues`
**Branch:** `fix/codex-e2e-signal-triage`
**Files likely affected:**
- `services/ai/cost.ts` - exact static model costs should be resolved before dynamic OpenRouter lookup so configured slash-model costs do not require network.
- `tests/current-system/cost-calculation.test.ts` - cover the static slash-model path and assert no OpenRouter fetch occurs.
**Investigation notes:**
- CI failed in `tests/current-system/cost-calculation.test.ts`, outside the e2e PR scope.
- Local reproduction showed `calculateCost('openrouter/google/gemini-3-pro-image-preview', ...)` attempted `openrouterService.fetchModels()` and failed when `openrouter.ai` was unreachable.
- Root cause: `calculateCost()` routes every model ID containing `/` through dynamic OpenRouter pricing before checking the exact static `COSTS_PER_MILLION_TOKENS` entry.
**Files modified (line numbers + why):**
- `services/ai/cost.ts:39-66` - resolve exact/static configured model costs before attempting dynamic OpenRouter pricing.
- `tests/current-system/cost-calculation.test.ts:65-75` - add regression coverage that a configured OpenRouter-style static model does not call OpenRouter fetch/pricing APIs.
- `docs/WORKLOG.md` - record CI blocker investigation, root cause, and verification.
**Tests:**
- `npx vitest run tests/current-system/cost-calculation.test.ts` ✅ 16 passed.
- `npx vitest run` ⚠️ local environment failure in `scripts/build-dpd.test.ts` because root symlinked `node_modules` lacks installed `better-sqlite3`; cost suite passed in this run.
- `npx playwright test --reporter=list` ✅ exit 0 with configured retry; 12 passed, 1 flaky (`fojin-sutta-studio-m2`, Chinese-title wait), 7 skipped.
**Residual signal:**
- FoJin M2 first attempt rendered the FoJin chapter with English title `The Heart Sūtra` and the Sutta Studio link, then passed on retry. This appears to be pre-existing test brittleness around the chapter heading expectation, not caused by the cost fix.

### [2026-05-30] [Agent: Opus]
**Status:** In progress
**Task:** Liturgy community-chant model (Option B) — let one chant serve many sanghas with a per-community default translation, instead of forking a `LiturgyDoc` file per (sangha, chant).
**Worktree:** `../LexiconForge.worktrees/opus-liturgy-community`
**Branch:** `feat/opus-liturgy-community`
**Why:** `heart-sutra.ts`/`bodhi-heart-sutra.ts` and `enmei-jikku-kannon-gyo.ts`/`bodhi-enmei-jikku-kannon-gyo.ts` are forks of the same chant. Bodhi's Heart Sutra reuses MAPLE's exact four witnesses (pure dup); the two Enmei files carry genuinely distinct English + word scholarship. A third community (Sariputta Ambedkar Monastery, Rinzai sheets) is incoming.
**Design (cross-validated with Codex gpt-5.5; it rejected my original `sanghas[]` overlay → Option B):** `docs/sutta-studio/COMMUNITY_CHANT_MODEL.md`. Key finding: segments differ across communities in IDs (`line-1-kan-ze-on` vs `kanzeon`), word scholarship, and section topology (MAPLE Heart Sutra: 39 TSW segments incl. `dharani-japanese-extended`; Bodhi: 27 + 2 prose, none of those). So the truly-shared unit is the *canonical phrase source text*; English **witnesses pool by phrase identity** while word glosses stay per-community — no sacred-text re-curation.
**Scope this pass (safe, additive, nothing deleted):** design doc + resolver foundation (`data/liturgy/resolve.ts`) + types + unit test on synthetic data. Content migration (Heart Sutra hard-dedupe, Enmei witness-pool) + Sariputta registration deferred to a checkpoint.

**Enmei pilot DONE (commit 4ed51ed):** tagged both Enmei files' 10 phrases with shared `phraseId`s, converted to `CommunityChant`s (MAPLE default `Literal English gloss`, Bodhi default `Bodhi Sangha`), resolved via `index.ts`. Both `/liturgy/<sangha>/enmei-jikku-kannon-gyo` routes now cycle all 4 translations (Literal/Soto/Red Cedar/Bodhi), leading with the route's own. **Key correctness finding:** `alignTo`/`morphemeAlignTo` index into the authoring segment's `words[]`; communities segment differently (MAPLE `Bup·pō` vs Bodhi `bup-pō`), so pooled-foreign witnesses get their alignment **stripped** (English text pools, arrows don't) — added to resolver + unit-tested. Regression guards added: route-topology snapshot + default-witness coverage. Browser-verified.

**Heart Sutra witness layer DONE (commit pending):** Converted both heart-sutra files to `CommunityChant`s, tagged the 27 shared core/middle/result segments with `phraseId`. **Discovered a lost-translation bug:** the shipped `bodhi-heart-sutra.ts` showed *MAPLE's* translation (hand-authored "at MAPLE depth", commit e8c8478, by copying MAPLE — dropping Bodhi's own English). Bodhi's real translation survived only in the orphaned+stale `scripts/build-bodhi-heart-sutra.py` (`BODHI_TEXTS`, booklet p.3). **Verified `BODHI_TEXTS` verbatim against takeout photo IMG_2342**, restored it as the `Bodhi Sangha` witness (assertion-guarded transform: 27 phraseId + 27 witness swaps, aborts on mismatch), deleted the dead generator. Browser-verified: Bodhi route now leads with Bodhi's own words; MAPLE route gains Bodhi as a 5th cyclable witness. Topology snapshot **unchanged** (no structural edit). Full suite 7227 pass; tsc 0 new errors. **Deferred (honest):** source-data dedup — scripts/words/Conze-Red Pine-TNH still duplicated across both files (~2k lines); extracting to a shared module is higher-risk hygiene with no user-visible change.

**Sariputta Ambedkar Monastery STARTED (commits c8e520e + pending):** Registered the sangha (`mixed` tradition — its chant sheets blend Theravāda Pali devotion + Rinzai Zen; full inventory ~12 chants, many overlapping). Built the **shared-content module** `heart-sutra-content.ts` (derives canonical body segments from MAPLE, strips community-only witnesses) + Sariputta's Heart Sutra (`sariputta-heart-sutra.ts`, Rochester/Kapleau English transcribed from the sheet, `overlayWitness` onto shared body — no copied script/word data; `alignTo` deferred). **Heart Sutra now cycles 6 translations across 3 sanghas**, each leading with its own — browser-verified all 3 routes. Full suite 8133 pass; tsc 0 new errors; topology snapshot gained the Sariputta route only. **Next for Sariputta:** remaining chants at full depth (Dai Hi Shu / Daisegaki / Teidai Dempo / Vandana set + overlapping Enmei/Sho Sai/Vows/Refuges); + alignTo for the Sariputta Heart Sutra witness; + deferred MAPLE/Bodhi retrofit onto the shared body.

### [2026-05-31] [Agent: Opus]
**Status:** In progress
**Task:** Sariputta Ambedkar Monastery remaining chants (prior PR #79 merged to main).
**Worktree:** `../LexiconForge.worktrees/opus-sariputta-chants`  **Branch:** `feat/opus-sariputta-chants`
**Workflow note:** Pali/Sanskrit on the sheet photos (`chants/rinzai zen chants/`) is small/low-contrast — crop+upscale with PIL (`python3` + Pillow 11) into `/tmp/sariputta-crops/` to read diacritics faithfully before authoring. Don't author scripture you can't read from source.
**Gotchas (for the next chant):** (1) data-quality test bans grammar jargon in reader text — no "genitive/accusative/nominative/…" in gloss OR etymology (CURATION_PROTOCOL §3.4); say it plainly. (2) accent colours amber/sky/rose are reserved for Buddha/Dharma/Sangha — don't decorate other words with them. (3) `alignTo` length must equal the witness's whitespace-split word count.
**Done:** Three Pure Precepts (`sariputta-three-pure-precepts.ts`, Ovāda Pāṭimokkha / Dhp 183) — plain LiturgyDoc, 4 Pali segments at full word-by-word depth, Literal + Buddharakkhita witnesses. Browser-verified (`/liturgy/sariputta-ambedkar` lists 2 chants; renders Pali + morphemes + pronunciation). Liturgy suite 6736 pass; tsc 0 new errors.

### [2026-06-06] [Agent: Opus] — session close
**Status:** Done (all Sariputta chant work merged). **main `48e2cf4`.**
PR #81 (Sariputta Heart Sutra + Three Pure Precepts + Refuges/Pañcasīla) + PR #82 (cross-model adversarial-review fixes) both MERGED. Ran Codex (gpt-5.5, photos via `-i`) + an Opus skeptic panel, 3 rounds, on the sacred-text content — caught real errors incl. two I'd authored myself; restored the full Buddha Vandana (Itipiso + homage stanza) from photo 2. Full handover + remaining-work inventory in `docs/HANDOVER.md`. **Next:** Dhamma/Sangha Vandana + Dai Hi Shu / Daisegaki / Teidai Dempo (resume workflow `wf_d0f5930b-04c` ≤3 agents, or Codex's LLM-authoring pipeline) → cross-model review before merge.
### [2026-07-13 09:50 IST] [Agent: Codex]
**Status:** Starting
**Task:** Option 2 - migrate the next repository transaction boundaries onto the durable transaction kernel from PR #109.
**Worktree:** `/private/tmp/LexiconForge.worktrees/codex-db-repository-migration`
**Branch:** `debt/codex-db-repository-migration` (stacked on `debt/codex-db-transaction-kernel`)
**Files likely affected:**
- `services/db/repositories/SettingsRepository.ts` - remove the repository-local request-success wrapper.
- `services/db/repositories/FeedbackRepository.ts` - remove the duplicate transaction lifecycle while preserving feedback CRUD behavior.
- `services/db/repositories/PromptTemplatesRepository.ts` - move reads and writes through the shared lifecycle without changing default-template semantics.
- `services/db/repositories/ChapterRepository.ts` - consolidate all repository transactions and the duplicated stable-ID lookup while making metadata writes commit-durable.
- `tests/services/db/*Repository*.test.ts` - add terminal commit/abort regression coverage for migrated write paths.
- `docs/adr/DB-002-atomic-transaction-boundaries.md` - append implementation notes after verification.
**Hypotheses:** H1 the three private wrappers are behaviorally equivalent except for store/domain labels and can delegate to `runTransaction`; H2 `setChapterNumberByStableId` can preserve index/fallback behavior while moving settlement to the kernel; H3 request helpers plus terminal-event tests will expose any transaction-inactivity or error-precedence regression.
**Predicted tests:** existing CRUD suites remain green; a successful request does not settle a write before `complete`; a post-request quota abort rejects as `DbError(kind=Quota)`; missing chapter errors remain descriptive and trigger transaction abort.
**Confidence:** 0.91
**Fallback:** migrate only the repositories whose public behavior and typed errors remain stable, and split any incompatible path into a separate follow-up PR.

### [2026-07-13 10:02 IST] [Agent: Codex]
**Status:** Complete
**Task:** Option 2 - migrate Settings, Feedback, Prompt Templates, and Chapter repositories onto the durable transaction kernel.
**Progress:** Removed three request-success transaction wrappers and all direct transaction lifecycles from `ChapterRepository`. All four repositories now delegate to `runTransaction`; request work uses `promisifyRequest`; Chapter index and legacy cursor stable-ID lookups share one helper; missing chapter metadata updates throw a descriptive typed `DbError`.
**Files modified (line numbers after change + why):**
- `services/db/repositories/SettingsRepository.ts:1-68` - kernel-backed store adapter and request helpers.
- `services/db/repositories/FeedbackRepository.ts:1-117` - kernel-backed CRUD, consistent helper naming, and two legacy `any` casts removed.
- `services/db/repositories/PromptTemplatesRepository.ts:1-122` - kernel-backed CRUD while preserving numeric default-index records and legacy scan fallback.
- `services/db/repositories/ChapterRepository.ts:1-169` - one transaction adapter and one shared stable-ID lookup for all chapter repository paths.
- `tests/services/db/RepositoryDurability.test.ts:1-145` - table-driven post-request quota abort coverage for every migrated repository.
- `tests/services/db/ChapterRepository.test.ts:9-121` - real legacy cursor fallback and typed missing-record coverage.
- `tests/services/db/PromptTemplatesRepository.test.ts:21-111` - real missing-index fallback coverage.
- `docs/adr/DB-002-atomic-transaction-boundaries.md:24-44` - append repository-migration implementation notes and remaining raw-operation scope.
- `docs/roadmaps/TECH-DEBT-INBOX.md` - `[DEBT][TEST]` receipt for Node 26 experimental Web Storage shadowing jsdom.
**Refactoring metrics:**
- Direct transaction lifecycle implementations in these repositories: 4 -> 0; Chapter stable-ID lookup paths: 2 -> 1.
- Production LOC: 543 -> 480 (-11.6%); Settings 71 -> 69, Feedback 132 -> 118, Prompt Templates 159 -> 123, Chapter 181 -> 170.
- Cyclomatic branch proxy: 59 -> 49 (-16.9%).
- Targeted coverage: statements 74.73% -> 92.70%; branches 53.91% -> 66.31%; functions 73.01% -> 96.77%; lines 82.35% -> 93.93%.
- Main production chunk: 4,146.71 -> 4,144.57 kB minified (-2.14 kB); 993.16 -> 992.97 kB gzip (-0.19 kB).
- Type safety: 2 `any` casts removed; no `any` added; repository interfaces unchanged.
- Performance signal: the same 14 pre-existing repository behavior tests ran in 28 ms before and 22 ms after; this is a noisy local test-time signal, while transaction and IndexedDB request counts are structurally unchanged.
**Verification:**
- Focused transaction/repository tests: 35 passed.
- Complete DB suite: 62 passed.
- Full Vitest suite: 8,797 passed, 356 skipped with `NODE_OPTIONS=--no-experimental-webstorage` on Node 26.
- Production build passed with pre-existing chunk/dynamic-import warnings.
- `tsc --noEmit --pretty false` reports only the unchanged baseline diagnostics; no modified file appears.
- Initial full-suite run without the Node flag failed 71 unrelated localStorage tests; isolated rerun confirmed the Node 26/jsdom environment cause, and the corrected full run passed.
**Review:** External Grok execution was denied because it would transmit private repository context to xAI. No external review was performed; local adversarial review found no actionable defect.
**PR:** https://github.com/anantham/LexiconForge/pull/110 (draft, stacked on PR #109)
**Next:** After review of PRs #109 and #110, migrate raw summary deletion and backup-storage writes in a separate PR.
### [2026-07-15 17:12 IST] [Agent: Codex]
**Status:** Starting
**Task:** Finish PR #112: P2.1 production/benchmark Anatomist grounding parity and P2.3 token-budget/publication consistency.
**Worktree:** `/private/tmp/LexiconForge.worktrees/codex-benchmark-parity-finish`
**Branch:** `debt/codex-benchmark-parity-finish` (from `worktree-opus-p2-benchmark` at `fc7c2f9`)
**Files likely affected:** `services/sutta-studio/dpdGrounding.ts`, `services/compiler/index.ts`, `scripts/sutta-studio/benchmark.ts`, shared pass-budget/config modules, `scripts/sutta-studio/publish-compare.ts`, focused tests, `docs/adr/SUTTA-014-grounded-benchmark-track.md`, `docs/architecture/ARCHITECTURE.md`, `docs/WORKLOG.md`.
**Coordination:** The locked Claude worktree contains uncommitted P2.1 edits in overlapping files, but its recorded process is no longer alive. That worktree is preserved untouched; this branch starts from PR #112's committed head and will be fast-forwarded into the PR only after verification.
**Hypotheses:**
- H1 (0.90): production omits Anatomist DPD lookups while the benchmark builds them privately; one shared tokenization/lookup helper will make prompt inputs structurally identical. Prediction: focused tests will show punctuation-normalized tokens and the same lookup map entering both paths.
- H2 (0.85): pass token caps drift because production and benchmark own independent literals/defaults. Prediction: extracting one per-pass budget contract will make a literal-search test fail before the change and both call paths consume the same values after it.
- H3 (0.85): compare publication drifts because it mixes frozen `quality-scores.json` fields with recomputation, and run discovery trusts timestamps without completion status. Prediction: replay/status tests will reproduce inconsistent rows and reject incomplete latest runs before the fix.
**Decision rule:** Implement only hypotheses confirmed by direct call-path evidence and red-before-green tests. If two investigation cycles are inconclusive, stop and report rather than widen scope.
**Confidence:** 0.86. Fallback: split P2.1 and P2.3 into separate commits/PR layers if shared-file overlap makes the combined diff hard to review.

### [2026-07-15 17:43 IST] [Agent: Codex]
**Status:** Implementation complete; PR publication/review pending
**Task:** Finish PR #112 P2.1/P2.3 production-benchmark parity and publication consistency.
**Hypothesis results:**
- H1 confirmed. Production Anatomist had no DPD prompt input; benchmark owned a divergent raw-whitespace lookup path. Both now call `services/sutta-studio/dpdGrounding.ts:12-49`. Corpus replay: 59.3% raw lookup hits -> 89.3% normalized hits; measured local lookup assembly remained sub-millisecond (0.037 ms -> 0.064 ms per full fixture run).
- H2 confirmed. Canonical benchmark runners defaulted every pass to 16,000 completion tokens, and the pipeline forwarded the Anatomist override to downstream passes. `services/sutta-studio/passBudgets.ts:3-11` now owns production defaults; `scripts/sutta-studio/benchmark.ts:944-1057,1443-1452` preserves independent per-pass overrides.
- H3 confirmed. Discovery trusted timestamp directories regardless of status, while compare publication mixed recomputed component scores with frozen aggregate fields. `scripts/sutta-studio/benchmark-run-status.ts:8-50` now defines the completion gate; indexing/ranking/publishing consume it, and compare publication replays all rubric fields before asserting the persisted receipt at `scripts/sutta-studio/publish-compare.ts:77-137`.
**Files modified and rationale:**
- `services/compiler/index.ts:408-432,558-718`, `services/compiler/skeleton.ts:7,71`: production grounding plus shared completion-token contract.
- `services/sutta-studio/dpdGrounding.ts`, `services/sutta-studio/passBudgets.ts`, `services/sutta-studio/passes/{skeleton,anatomist,lexicographer,weaver,typesetter,morphology}.ts`: shared contracts consumed by both execution pathways.
- `scripts/sutta-studio/benchmark.ts:344-431,944-1057,1439-1453,2268-2316`, `scripts/sutta-studio/benchmark-run-status.ts`, `scripts/sutta-studio/generate-leaderboard.ts:304-316`: complete-run discovery and parity-safe benchmark orchestration.
- `scripts/sutta-studio/publish-compare.ts:67-272`: one scorer replay, full receipt comparison, explicit rubric provenance, descriptive refusal for stale/missing scores, and import-safe main guard.
- `tests/services/sutta-studio/{dpdGrounding,passBudgets}.test.ts`, `tests/scripts/sutta-studio/{benchmark-run-status,publish-compare-parity}.test.ts`: focused regressions for the new boundaries. Existing `leaderboard-survivorship.test.ts` covers PR #112 P2.2.
- `docs/adr/SUTTA-014-grounded-benchmark-track.md:110-137`: appended factual correction and partial implementation notes; status remains `Proposed` for the broader track.
- `docs/architecture/ARCHITECTURE.md:190`: `[DEBT][MONOLITH]` benchmark orchestrator recorded as a split candidate after completion-boundary test friction.
**Verification:** 228 Vitest files passed, 8,825 tests passed / 355 skipped; focused contract coverage 94.11% statements and 93.54% lines; Vite production build passed; real completed-run replay produced 0 score mismatches across 30 phases; actual index replay retained 49 complete artifacts and excluded known running runs. `tsc --noEmit` remains at the PR's 17 known baseline errors, with no new diagnostics in added modules.
**Refactor metrics:** `publish-compare.buildPhase` cyclomatic complexity 18 -> 14; benchmark pipeline runner 22 -> 22; index builder 26 -> 27 for the required status branch. Four `any` occurrences removed from publication code and none added in the new contracts. Built asset bytes 5,531,648 -> 5,534,044 (+2,396, +0.04%); no network calls or additional model spend introduced.
**Review:** Local Claude `-p` review was attempted as previously authorized but blocked by the environment's untrusted-data-export policy before execution. Use the configured Codex PR review after push; do not bypass the review gate.
**Remaining after this scope:** Run the grounded fleet again before trusting new rankings, then complete SUTTA-014's broader SC dictionary/retrieval/prior-phase parity work. Split `scripts/sutta-studio/benchmark.ts` in a dedicated refactor PR rather than mixing that architectural change into this correctness PR.

### [2026-07-15 18:14 IST] [Agent: Codex]
**Status:** Reconciled concurrent P2.1 commit; verification complete
**Coordination:** Before push, `origin/worktree-opus-p2-benchmark` advanced from `fc7c2f9` to Claude's `f6e9d41` P2.1 commit. The Codex commit was rebased onto that remote head without force. Conflict resolution retained Claude's corrected ADR parity table, outer production fallback, and committed-MN10 hit-rate regression, while retaining Codex's provider-agnostic helper, per-token warning path, P2.3 contracts, and publication tests.
**Verification after reconciliation:** Focused combined suite: 20/20 passed. Full suite: 228 files, 8,825 passed / 355 skipped. Production build passed. TypeScript remains at 17 pre-existing baseline diagnostics. Branch history is linear (`f6e9d41` -> rebased Codex commit), so PR #112 can be updated by ordinary fast-forward push.

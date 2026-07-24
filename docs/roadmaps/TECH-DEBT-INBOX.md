# TECH-DEBT-INBOX

Append-only raw debt receipts discovered during implementation.

[DEBT][COMPAT][2026-04-09 10:26 EDT] Temporary novel-library migration compatibility layer
- Files:
  - `services/registryService.ts`
  - `services/importService.ts`
  - `store/bootstrap/initializeStore.ts`
  - `components/NovelLibrary.tsx`
  - `types/novel.ts`
- Symptom:
  - Legacy deep links/bookshelf entries still referenced removed version ids such as `v1-composite`.
  - Some library `session.json` assets resolved through `raw.githubusercontent.com`, which returned Git LFS pointer text instead of the real JSON payload.
- Temporary compatibility added:
  - Legacy version resolution via `legacyVersionIds` plus single-version fallback.
  - Session artifact normalization from raw GitHub to media GitHub.
  - Explicit Git LFS pointer detection in import.
- Follow-up:
  - Remove version-id fallback logic once all active library metadata and saved links/bookmarks have been migrated to canonical version ids.
  - Re-evaluate whether raw→media session URL rewriting is still needed once all published metadata uses canonical artifact URLs directly.
  - Keep or remove the Git LFS pointer guard intentionally; it may still be worth keeping as a defensive diagnostic even after migration cleanup.
- Suggested exit criteria:
  - All registry novels use canonical version ids with no remaining legacy aliases needed.
  - Existing user-facing deep links/bookmarks have either been migrated or are no longer supported by policy.
  - Published metadata points directly at final session artifact URLs without importer-side rewriting.

[DEBT][TEST][2026-07-13 10:02 IST] Node 26 experimental Web Storage shadows jsdom localStorage
- Files:
  - `vitest.config.ts`
  - `tests/setup.ts`
  - `package.json` / the eventual Node-version or test-command policy
- Symptom:
  - On Node `v26.0.0`, the experimental global `localStorage` accessor exists but yields `undefined` without `--localstorage-file`.
  - This shadows jsdom's storage in tests that access the global directly, causing 71 unrelated UI tests to fail before their assertions.
  - `NODE_OPTIONS=--no-experimental-webstorage` restores jsdom ownership and the full 8,797-test suite passes.
- Suggested follow-up:
  - Pin a supported Node version, or make the Vitest command/setup explicitly disable or replace Node's experimental Web Storage global.
  - Keep this separate from database transaction changes so verification-environment policy receives its own review.
- Exit criteria:
  - `npm test -- --run` passes on the documented Node version without an undocumented shell flag.
[DEBT][TEST][2026-07-16 10:52 IST] Node 26 disables the test DOM's `localStorage`
- Files:
  - `vitest.config.ts`
  - `tests/setup.ts`
  - `package.json`
  - `.github/workflows/test.yml`
- Symptom:
  - A full `vitest run` under the locally active Node 26.0.0 reports `localStorage is not available because --localstorage-file was not provided`, then 115 tests fail because `localStorage` is undefined.
  - A representative failure reproduces unchanged on `main`; export-focused suites that do not exercise local storage remain green.
  - CI is pinned to Node 20, so the issue does not currently invalidate the pull-request gate.
- Friction:
  - Local full-suite validation looks like a broad product regression even when the changed code is unrelated, and the repository does not declare a supported local Node range.
- Suggested follow-up:
  - Decide whether to declare and enforce Node 20/22 for local development or make test setup explicitly replace Node 26's experimental storage global with the Happy DOM implementation.
  - Add a small environment preflight so an unsupported runtime fails once with a descriptive message instead of cascading into hundreds of tests.

[DEBT][BENCH][2026-07-22 10:00 IST] Benchmark call-cache / phase-level resume
- Files:
  - `scripts/sutta-studio/benchmark.ts` (createOpenRouterLLMCaller, runPipelineForPhase)
  - `scripts/sutta-studio/benchmark-config.ts` (repeatRuns)
- Motivation (priced from the 2026-07-21/22 arc):
  - A mid-run failure (key exhaustion) loses the in-flight MODEL's whole progress —
    gemini-3.5-flash's 20/27 good phases (~$2, ~2h) were repeated from scratch.
    Three infra-fix re-runs this week re-billed phases that had already succeeded.
- Design (agreed in-session):
  - Content-addressed cache keyed by hash(model, pass, phaseId, promptVersion,
    maxTokens, structuredOutputs, temperature); check before call, write raw+parsed
    after. Per-phase artifacts in outputs/<model>/pipeline-<phase>.json already
    serialize everything needed.
  - HONESTY CONSTRAINTS (each needs a red-proofed test, not a comment):
    1. Forced OFF when repeatRuns > 1 — a cache defeats variance measurement; must
       be a code branch (cf. the onlyRunIds/continue-vs-break lessons).
    2. Cached calls carry `cached: true` in metrics rows; cost attributed once, in
       the run that paid — board cost/duration columns must not count cache hits
       as fresh spend (interacts with the money-honesty accounting, d55d9ff).
    3. Methodology note: re-runs may reuse cached passes (one frozen sample at
       temperature 0.2).
  - Live-chained dependencyMode must include upstream-output hash in the key, or
    be excluded from caching (fixture mode is the benchmark default).
- Effort: resume-shaped (skip valid phases in a --resume run dir) ~1-2h;
  general cross-run cache ~half a day incl. tests.
- Exit criteria: killing a run mid-model and relaunching re-bills ONLY failed/missing
  phases; a repeatRuns>1 run provably bypasses the cache; suite green with a test
  proving a cache hit writes cached:true and adds $0 to the run's accrued spend.

[DEBT][BENCH][2026-07-22 17:00 IST] OpenAI strict-schema dialect adapter (gpt-5.4-mini unrankable)
- Files: `scripts/sutta-studio/benchmark.ts` (createOpenRouterLLMCaller), `services/sutta-studio/schemas.ts`
- Root cause (probe-verified, verbatim provider error): OpenAI's strict json_schema
  validator requires `required` to include EVERY property key ("Missing 'isAnchor'",
  code invalid_json_schema); optional fields must be nullable-unions instead.
  Anthropic/Google accept our schemas; every gpt-5.4-mini call 400s before scoring.
- Fix: mechanical schema transformer applied for openai/* models only (walk objects:
  required := all keys; formerly-optional props get type unioned with null). Same
  logical contract, provider-dialect compliance. Needs a red-proof (the probe reproduces
  the 400) + a green-proof one-model run, and a disclosure line in methodology.
- Exit criteria: gpt-5.4-mini completes a full 27-phase run and enters the board.

[DEBT][BENCH][2026-07-22 17:00 IST] Anatomist prompt: referential completeness is demonstrated, never stated
- File: `services/sutta-studio/prompts/anatomist.ts`
- Evidence (claude-sonnet-5, phase-at, raw artifacts): model declared 24 segmentIds
  across 6 words, delivered 6 segment objects (word 1 only), finish=end_turn with 5.4k
  tokens headroom — its own handoff notes DISCUSS the decomposition of the words it
  never delivered. Prompt has CRITICAL 1 (decompose) and CRITICAL 2 (surface-faithful)
  but referential completeness (every declared id gets an object) is only implied by
  the 3 worked examples (all 3-word phases; all complete).
- Fix: add CRITICAL 3 stating the contract + one longer worked example. PROMPT-VERSION
  BUMP — comparability break: schedule with the next full fleet re-run, never mid-board.
- Exit criteria: promptVersion bumped, full roster re-run, gate-damage rates compared
  before/after (the delta measures how much of today's Gate column was contract-implicitness).

[DEBT][UI][2026-07-24 · reader-report] Ghost/sense particle collision renders doubled function words
- Files:
  - `components/sutta-studio/EnglishWord.tsx` (renders linked tokens as the word's sense)
  - `services/suttaStudioPacketValidator.ts` (natural home for the tripwire)
  - `content/references/sutta/mn10.json` (live instance: phase-5)
- Symptom:
  - phase-5 renders "for the attainment of the of the true way": the ghost token supplies "(of the)" while the linked word's first sense already begins with "of the" (ñāyassa → "of the true way").
  - Class: any ghost label whose trailing word equals the leading word of the adjacent linked token's displayed sense.
- Suggested follow-up:
  - Mechanical validator check over englishStructure: for each ghost, compare its label's last word against the next linked token's sense[0] first word (case-folded); flag as `ghost_sense_collision`.
  - Fix instances by trimming either the ghost or the sense's leading particle; senses that embed case particles ("of the X") are the deeper cause.
- Exit criteria:
  - Validator flags the phase-5 instance on the committed packet (proven red), then the packet is repaired and the check stays green.
- Source: docs/benchmarks/reader-report-mn10-2026-07-24.md (first strong-reader qualitative pass; also documents the quotation-ghosting root cause of the 16 dead 'ti links and a cross-phase cut inconsistency for bhikkhave).

[DEBT][UI][2026-07-24 · reader-report-II] Morpheme-level weave degrades to gloss stutter (90% of MN117 phases)
- Files: `components/sutta-studio/EnglishWord.tsx` (segment-link fallback), `services/sutta-studio/passes/lexicographer.ts` (no per-segment senses), `content/references/sutta/mn117.json` (399 stuttered words / 158 of 175 phases)
- Symptom: production weaver links one english token per SEGMENT (morpheme-level alignment — the ambition is right), but segments carry no senses, so the view's parent-word fallback renders the full gloss once per morpheme: "right view right view comes first comes first".
- Fixes, cheapest first: (a) view dedupe — only the first segment-token of a word renders the parent gloss; (b) validator `segment_link_without_segment_senses`; (c) lexicographer emits per-segment senses for compounds (unlocks true morpheme-level hover).
- Invisible to: senses F1, alignment scorer, tap test (all stuttered tokens light correctly). Only a reader sees it.
- STATUS 2026-07-24: (a) view backstop + (b) validator SHIPPED same day (repairEnglishStructure + english_gloss_stutter; mn117 migrated, 445 collapsed); (c) lexicographer per-segment senses ALSO SHIPPED same day — schema + prompt v13 (rājaputta example, leak-guard green) + thread guards + live smoke (gemini-3-flash produced right·view / before·going, skipped the ·ā ending). Future compiles get morpheme-level hover; already-shipped packets still render via the backstop.

[DEBT][VALIDATOR][2026-07-24 · reader-report-II] Repair renumbers words; english links dangle (59/1,374 in MN117)
- Files: `services/sutta-studio/utils.ts` (repairAnatomistSurfaces), `services/suttaStudioPacketValidator.ts` (relationsValid), `content/references/sutta/mn117.json` (phases 5/6 link nonexistent p2)
- Symptom: v1 surface repair dropped/renumbered anatomist words without remapping englishStructure; 59 linked tokens point at missing words/segments and render as empty pills. relationsValid either doesn't cover english→pali refs or absorbed the hit silently.
- Fix: repair remaps or drops affected english tokens; validator fails loudly on dangling english links (prove red on committed mn117).
- STATUS 2026-07-24: SHIPPED — english_link_dangling (error) in packet validator; compile validator's linkedSegmentId blind spot closed; mn117 migrated (57 dropped, red→green proven).

[DEBT][VALIDATOR][2026-07-24 · reader-report-II] Punctuation inside segment texts + garbage senses
- Symptom: production segments keep clause punctuation (`bhikkhav·e,`, `ho·ti.`), bare comma as its own morpheme (`ca·,` ×10), quote chars inside segments (`“bhikkhav·o”·ti.`), and a literal `"` emitted as a sense.
- Fix: validator rule — no punctuation-only segments; flag trailing clause punctuation in segment text; flag senses that contain no letters.
- Refinement to the 2026-07-24 ghost/sense receipt: the collision check must compare n-word OVERLAP (ghost tail vs sense head), not single words — the single-word heuristic missed the motivating instance ("of the" + "of the true way").

[DEBT][PIPELINE][2026-07-24 · reader-report-II] Stateless phases make cut consistency luck — add a per-run cut cache
- Evidence: bhikkhave ×88 with 2 different cuts; hoti ×23 with 2; 61 of MN117's 391 distinct surfaces are cut inconsistently (flagship: 4 of 113). The most repeated words are the least consistent because every phase re-analyzes from scratch.
- Fix: per-run memoization — first anatomist analysis of a surface wins, later phases reuse it. Kills the class AND saves paid tokens. Candidate metric: cross-phase cut-consistency rate (countable today; see docs/benchmarks/reader-report-mn117-2026-07-24.md for the sweep script's logic).

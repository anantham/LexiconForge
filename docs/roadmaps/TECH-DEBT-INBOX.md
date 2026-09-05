[DEBT][DECISION][2026-07-28] Chrome extension: both main lanes dead — keep-or-delete needs the operator
- BookToki lane: popup gates every command on a PING the content script never answers (broken by the
  2026-01-11 popup rewrite); Polyglotta lane: progress persisted to the BookToki session key, resumes
  at section 0 forever, downloads always stamped _PARTIAL_. Extraction logic has drifted from the app
  adapter (title regex, paragraph filters, nav discovery). ~3,000 lines of drift tax if kept.
- Decide: re-sync contracts + add a parity test against siteAdapters, or delete the extension.

[DEBT][PERIPHERAL][2026-07-28] Round-two P3 tail (scan reports have full detail; highest-value first)
- publish-compare/ committed artifacts are add-only from 2026-07-01: half the live board 404s in the
  View panel, the rest serve old-rubric numbers. Regenerate + add drift detection at publish time.
- benchmark.ts legacy lexicographer pass: identical error-block pasted 4x (one failure logs 4);
  legacy weaver/typesetter push zero. Fix when the legacy path is next touched.
- capabilityService endpoints sub-cache frozen per session; clearCapabilityCache dead; three pricing
  surfaces with two unit conventions (per-token vs per-million) — a units mixup is a latent money bug.
- telemetry sessionDurationMs becomes ring-buffer-window duration after 500 events; redactString
  misses bare AIza-style keys.
- audio: opfs.ts is excluded from tsc AND eslint (never checked); config audioGeneration block has
  zero readers (providers hardcode); OST library serves 8 URLs into a gitignored absent dir; the
  eslint comment claims tsc tolerates literal-\n files (false).
- imageService: 'image://' filter dead code; retry version-defaulting fork; stale per-token warning;
  imagen-3.0-generate-001 default not in any table; ImageCacheKey declared twice.
- fetcher.ts vs siteAdapters host-predicate mismatch (endsWith vs includes) can save the literal
  'Loading Sutta content...' placeholder as chapter content on lookalike hosts.
- liturgy-generator tokenize.ts is an undisclosed byte-identical fork of the declared single source
  of truth (validation.ts) — import it instead before the regex evolves.
- kanjiToNumber positional-digit misparse (第一四八話 → 8); siteAdapters' second chapter-number
  derivation fabricates 0 on no-match.
- store round-two P3s (report §P3): NovelLibrary render-phase mutation of registry state, VersionPicker
  NaN%, EPUB metadata from one global localStorage key (multi-novel bleed), memory-fallback session
  export drops version history, ChapterView dead editing scaffolding since 2025-08, uiSlice duplicate
  action, oscilloscope tone threads never created, audioSlice provider-stats crash edge.

[DEBT][DB][2026-07-28] maintenance.ts integrity-scan deferrals (fixed tier shipped same day — see WORKLOG)
Full scan report findings NOT fixed in the first pass, each verified with quoted code:
- Mapping-upsert FORK (P2): buildUrlMappingEntries (~L440) + normalizeStableIds inline puts (~L542)
  blind-put url_mappings rows that omit libraryVersionId and clobber existing dateAdded/novelId —
  exactly the drift StableIdManager.ensureUrlMappings' docstring says it exists to prevent. Consolidate
  through the canonical upsert (txn-shape care needed: these run inside open batch txns).
- Summary-record FORK (P2): two inline ChapterSummaryRecord literals (~L1070, ~L2261) bypass the
  canonical buildSummaryRecord (which is IMPORTED and never called). hasTranslation semantics quick-fixed;
  full delegation deferred.
- consolidateBookshelfDuplicates DECISION (P1): zero production callers since bef65dd (2026-05-10)
  unwired it; render-side dedup in NovelLibrary is the only live defense; its tests exercise dead code.
  Decide: rewire post-boot with flag-check-first, or delete (+ keep render dedup + fix tests).
- Bookshelf dedupe THREE contradictory keep-policies in one file: V2 keeps best-per-VERSION (~L1231),
  consolidate keeps one-per-NOVEL (~L1360), V4 keeps one-per-novel forced-canonical (~L2378); render
  dedup is a fourth. Pick ONE policy, document it, make the others delegate.
- clearAllData can hang forever on another open tab (~L2685: onblocked only warns; promise never
  settles). Add timeout + rejection.
- V2 urlMappingsUpdated counter inflation (~L1031-1057): counts survivor-refresh rows as "updated".
- buildDuplicateFingerprint (~L324): the URL component degenerates to the stableId itself for scoped
  storage URLs — the fingerprint's discriminating power silently halves exactly where dedup matters.
- Dead surface: 9 exported types with zero importers; MaintenanceOps.auditChapterDuplicates has zero
  callers in prod AND tests (console-only via window.MaintenanceOps) — document as console tool or delete.
- summaries.ts:191 fetchNovelChapterCounts logs unconditionally on a full-store getAll at library render
  ("Processing N total summaries") — debug-gate it.
- Naming sprawl: one store-rewrite concept under seven verbs (backfill/normalize/repair/sync/
  consolidate/unwrap/correct) — add the rule to docs/CONVENTIONS.md when the next rename happens.

[DEBT][LIBRARY][2026-07-28] VITE_DEFAULT_OPENROUTER_KEY is dead — keyless visitors' translate/search 401s
- Evidence: live repro 2026-07-28 — auto-translate fell back to the baked trial key and
  OpenRouter answered 401 "User not found" (key deleted). Every deployed build's trial lane
  (auto-translate, library search) is broken for visitors without their own key.
- Fix: OPERATOR ACTION — mint a fresh, separately-capped trial key on openrouter.ai, set it
  as VITE_DEFAULT_OPENROUTER_KEY in Vercel env, redeploy. Never reuse the working key.

[DEBT][DB][2026-07-28] normalizeUrlAggressively mangles custom schemes into "null/chapter/N"
- Evidence: live IDB dump — url_mappings row { url: "null/chapter/64", isCanonical: true }
  for lexiconforge://aithihyamala/chapter/64 (origin computes as null for custom schemes,
  then string-concatenates). Lookups still succeed via stableId, so severity is low, but the
  mappings table is accumulating corrupt canonical keys.
- Fix: normalizeUrlAggressively should pass through (or explicitly namespace) non-http(s)
  schemes instead of URL-parsing them.

[DEBT][LIBRARY][2026-07-28] Intermittent: cold first-visit stream import stored chapter but NOT its translation
- Evidence: one live repro (fresh profile, ~20s cold LFS fetch): chapters=1, translations=0
  in IDB, no console error; an immediate replay with a warm fetch (~10s) stored both. The
  auto-translate that then fired (and 401'd on the dead default key) shows the billing
  exposure: a race that loses the packaged translation re-bills the user for it.
- Next: instrument TranslationOps.store failures on the stream path loudly (they currently
  reject the whole stream promise only if they THROW synchronously into the loop) and replay
  cold-cache imports with devtools throttling to pin the race. Not reproduced under debug.

# TECH-DEBT-INBOX

Append-only raw debt receipts discovered during implementation.

[DEBT][DUPLICATION][2026-08-21] Image generation initial/retry result assembly drift
- File: `services/imageGenerationService.ts` (631 LOC).
- Symptom: batch generation and retry independently assemble execution metrics, provenance,
  persistence metadata, and version state. Retry already reported the executed fallback model;
  batch generation continued reporting the configured local model until PR #138 review caught it.
- Follow-up: extract one result-to-metrics/provenance/persistence boundary after the provider
  integration ships; do not mix that decomposition into the fallback correctness fix.

[DEBT][MONOLITH][2026-08-21] Provider settings catalogue lifecycle remains centralized
- File: `components/settings/ProvidersPanel.tsx` (565 LOC).
- Symptom: one component owns provider credits, capability checks, OpenRouter catalogue state,
  IndrasNet endpoint discovery, pricing assembly, and model selection. PR #138 review found an
  endpoint transition that left workflow state from the previous broker visible.
- Follow-up: extract the IndrasNet discovery lifecycle and image-model assembly behind a focused
  hook after this provider ships; keep endpoint normalization and catalogue invalidation together.

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

[DEBT][SECURITY][2026-08-13] Resolution: client-side provider keys and trial fallback removed
- Supersedes the 2026-07-28 receipt recommending a new `VITE_DEFAULT_OPENROUTER_KEY`.
- Evidence: Vite `define` serialized six provider credentials; browser services also carried Settings/env/trial resolution paths. Client-side limits could not protect the shared key.
- Resolution: browser provider calls are Settings-only BYOK; the shared trial service/banner and all provider env fallbacks were removed; Google Drive import uses its existing public-download path without a browser API key.
- Release gate: CI injects synthetic legacy env canaries, builds, and scans `dist/` for canaries and provider-shaped credentials.
- Operator action completed: all provider variables were removed from Vercel, the exposed Gemini key was revoked, and the exact OpenAI/OpenRouter/DeepSeek keys were confirmed invalid. The active production aliases were redeployed without credentials; the BYOK-only application deploys when this change lands.
- Decision record: `docs/adr/SEC-001-browser-provider-credential-boundary.md`.

[DEBT][MONOLITH][2026-08-21] Image result application remains in a 1,580-line slice
- File: `store/slices/imageSlice.ts`.
- Symptom: provider-neutral lifecycle moved to `imageJobsSlice`, but recovered-task orchestration, result application, translation persistence, cache migration, advanced controls, and version deletion still share one slice.
- Friction in the image-job change: generation and recovery needed parallel copies of the context/result-to-version wiring, making it easy for a provider resume path to drift from an ordinary completion path.
- Suggested follow-up: extract one tested result-application service/action that accepts `chapterId`, marker, version, and `GeneratedImageResult`; then separate version/cache migration actions from generation orchestration.
- Blocker status: non-blocking for the approved job system; current paths share the existing persistence implementation and focused regressions are required before merge.

[DEBT][MONOLITH][2026-08-21] Illustration rendering and controls remain in an 822-line component
- File: `components/Illustration.tsx`.
- Symptom: marker normalization, job/ETA state, prompt and plan editing, provider controls, image rendering, generation actions, and version controls share one component.
- Friction in the image-job change: durable `interrupted` ownership was enforced in the store and global banner but omitted from the component's separate inline status selector, exposing controls that intentionally no-op.
- Suggested follow-up: extract a tested illustration-job status panel/selector first, then separate prompt-plan controls and version controls without changing the persisted illustration contract.
- Blocker status: non-blocking after the inline interrupted-state regression; decomposition belongs in a focused follow-up PR.

---

[DEBT][AUDIT][2026-08-16; corrected 2026-08-22] State, DB, migration, and de-sprawl audit

- Full evidence: `docs/roadmaps/tech-debt-audit-db-state-migrations.md` and `docs/roadmaps/DESPRAWL-ROADMAP-2026-08-16.md`.
- Confirmed themes: dual settings persistence; scattered repair flags; operations/repositories coupling; duplicate skeleton implementations; contradictory retry classification; stale ADR/index references; and missing completeness gates around some migrations, capability lookups, and e2e discovery.
- Rereview corrections: `services/diff/`, `services/librarySearch/`, `services/import/booktoki.ts`, the providers barrel, and `services/db/index.ts` have live consumers and are not deletion candidates as a group. `migrateImagesToCacheFromDB` is a supported operator/debug command exposed on `window`, not a dead export. The translation service/router/translator chain needs a responsibility map before any duplication verdict.
- Guardrail: re-run an entrypoint-aware import audit before deleting any candidate; side-effect imports, relative imports, barrel re-exports, aliases, and literal dynamic imports must be resolved.
- Status: audit evidence only. The de-sprawl roadmap remains proposed, and every `DECISION NEEDED` item retains its human gate.

- [DEBT][TOOLING][2026-08-22] scripts/cycle-worklog.sh inverted cutoff: `grep -n "^2026-07\|^2026-08"` never matches because entry headers start with `### [`, so the fallback CUTOFF_LINE = LINE_COUNT - 100 archives the TAIL of a newest-first file — i.e. every future bottom-append self-deletes on next run (nearly ate four ox-alpha entries at lines ~3261+). Fix: anchor on `^### \[`.
- [DEBT][RATELIMIT][CAP-003][2026-08-22] adapters/providers/ClaudeAdapter.ts never calls rateLimitService.acquireRequestSlot — Claude translations bypass per-model rate limiting entirely while OpenAI/Gemini honor it (#140 made the contract explicit; this is its third provider violating it). Symptom would be OpenRouter/Gemini-style 429s surfacing raw on Claude lanes.

- [DEBT][SECURITY][2026-08-23] Official SillyTavern 1.18.0 production lock reports 44 npm audit findings (27 moderate, 16 high, 1 critical) before the LexiconForge tailnet portal is exposed. Critical: `protobufjs` via `onnxruntime-web`; high: `axios`, `simple-git`, `ws`, `multer`, `form-data`, `fast-uri`, `ip-address`, and others. Several transitive image/transformer/markdown findings have no published fix. Files: upstream runtime `package-lock.json`; integration boundary `integrations/sillytavern-bridge/`; decision record `docs/adr/FEAT-004-sillytavern-tailnet-portal.md`. Follow-up requires a human ruling between accepting a narrow tailnet-only exposure, maintaining a tested dependency overlay/fork, or retaining localhost-only operation. No Serve listener was added after discovery.
- [DEBT][SECURITY][2026-08-23; Option A disposition] The owner selected identity-gated tailnet exposure without a second app-specific ACL. A version/revision/integrity-checked overlay updates portal-reachable Multer 2.1.1 to 2.2.0, reducing `npm audit --omit=dev` from 44 to 43 (27 moderate, 15 high, 1 critical). This is not an audit-zero claim. `image-size` remains portal-reachable when trusted card images are imported and has no fix in the audited graph; `protobufjs`/transformer and remaining endpoint/development paths are not portal preconditions but remain upstream risk. Controls: owner Serve identity at the bridge, loopback binds, exact forwarded-IP device whitelist at SillyTavern, pre-parse body cap, request-hash idempotency, single-flight plus cooldown, no Funnel, exact-route cutover/rollback. Reassess on SillyTavern upgrade or when `image-size` publishes a compatible fix.

- [DEBT][MONOLITH][2026-08-24] `services/importService.ts` is 1,152 LOC and owns URL normalization/retries, buffered and streaming JSON parsing, chapter/translation persistence, loss reconciliation, reader hydration, and portable semantic-graph hydration. Adding a top-level session field required editing state across the entire stream lifecycle. Follow-up: first extract a format-aware streaming envelope/parser that emits metadata, chapters, and bounded top-level artifacts; then isolate persistence/reconciliation from post-import hydration. Keep the existing ordering and first-chapter readiness regression suites as behavior gates. Blocker status: non-blocking after focused semantic streaming coverage; do not mix decomposition into the current correctness PR.
[DEBT][DATA][2026-08-30] Cached summary counts overwrite registry chapter denominators
- Files: `components/NovelLibrary.tsx:492-508`; `services/db/operations/summaries.ts:187-240`; `components/VersionPicker.tsx:31-32,143-159`.
- Symptom: `fetchNovelChapterCounts()` reports locally cached summary counts, then `NovelLibrary` mutates `novel.metadata.chapterCount` with that cache count. `VersionPicker` divides the registry package's raw count by the mutated cache denominator. A live partial Dungeon Defense import therefore rendered `Novel Coverage 230.3% (509/221 chapters)` while import was still progressing.
- Friction: the same number is being asked to mean published novel size, packaged artifact size, and current local cache size. Its global `Processing N summaries` log is also non-causal for a selected version.
- Suggested follow-up: keep immutable registry/package denominators separate from scoped local cache progress; pass both explicitly to the card/detail components; make logs include novel and version scope; add partial-cache coverage regressions.
- Blocker status: non-blocking for CORE-015 because cache completeness now reads selected-version stats before novel metadata, but the library coverage display remains misleading.

[DEBT][INDEXEDDB][2026-08-30] Unversioned source-URL lookup still constructs a null compound key
- File: `services/db/operations/chapters.ts` (`findChapterModernBySourceUrl`).
- Symptom: the `novelVersion` lookup receives `[novelId, null]`; IndexedDB compound keys cannot contain null, so an unversioned scoped source lookup can throw `DataError` before reaching its existing `novelId` scan/filter fallback.
- Scope decision: PR #166 corrects the reviewed chapter-number path only. Expanding the follow-up to source-URL lookup would add an unreviewed behavioral contract.
- Suggested follow-up: share one null-safe scoped-candidate helper between source-URL and chapter-number lookup, with real fake-IndexedDB tests for versioned and unversioned rows.
- Blocker status: non-blocking for canonical `lexiconforge://` number navigation; remains a risk for unversioned external source-URL hydration.

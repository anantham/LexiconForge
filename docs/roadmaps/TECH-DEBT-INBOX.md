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

- [DEBT][LITURGY][2026-08-25] The semantic-alignment audit reports 179 unreviewed many-to-one groups outside `maple/morning-chants`: Maple Metta (18), Maple Heart Sutra (63), Maple Shō Sai Myō Kichijō Dhāraṇī (2), Bodhi Sangha Heart Sutra (41), Sāriputta Ambedkar Heart Sutra (36), Refuges and Precepts (17), and Three Pure Precepts (2). The renderer now fails honestly to whole-word precision, so this is not a false-arrow runtime defect. Follow-up is evidence-led route curation using `npm run audit:liturgy-alignments -- --json`; do not bulk-mark targets reviewed or infer them by position. Exit criterion: each route reaches zero with citations and human review.

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


[DEBT][IMPORT][2026-09-05] Streaming session metadata and hydration ownership
- Files: `services/importService.ts:600-760,1186-1235`; `store/bootstrap/importSessionData.ts:60-126`.
- Symptom: graph-specific completion is now guarded, but the broader import pipeline has no cancellation/ownership token. String-based header/trailer extraction also assumes metadata placement relative to the chapters array.
- Follow-up: reproduce a book switch during DB hydration and reordered top-level metadata before selecting the smallest parser/ownership repair. Preserve readable partial imports; do not add more parser wrappers speculatively.
- Pickup: Issues.md item 17; non-blocking for the verified complete synthetic export round-trip.

[DEBT][OFFLINE][2026-09-05] Frozen graph cold-launch and legacy binding remain unproven
- Files: `store/slices/oscilloscopeSlice.ts`; `components/oscilloscope/loadOscilloscopeData.ts`; `tests/e2e/semantic-session.spec.ts`.
- Symptom: offline reimport in an already loaded app passes; a full browser restart/cold offline launch is not covered. Legacy FMoC tracks have no verified translation hash, so export deliberately omits them until bound to a verifiable corpus.
- Follow-up: decide whether offline acceptance requires cold app launch, then test it with an installed/cached app. Do not label legacy tracks as portable verified data merely to satisfy export tests.
- Pickup: Issues.md item 17 and semantic acceptance checklist; real-device acceptance still pending.

### 2026-09-05 [DEBT][PRIVACY] Public handoff boundary
- Files: `docs/WORKLOG.md`, public PR descriptions, deployment examples, broker defaults.
- Finding: operator-specific configuration and live diagnostics had accumulated in public source records.
- Current correction: explicit runtime configuration, generic examples, sanitized records, and a private-host check in the existing build scanner.
- Follow-up: keep incident/runtime evidence outside Git; historical refs and cached artifacts require a separate owner decision. Public receipts must describe categories and acceptance, never repeat removed values.

### 2026-09-05 graph review

[DEBT][DUPLICATION][EXPORT] `services/exportService.ts` repeats portable chapter
serialization across quick/publish/fork; general metadata/stat helpers and
`store/slices/exportSlice.ts` EPUB selection still read across cached books. #160
fixes the three portable builders only. Follow up with two-book fixtures and
selected-corpus statistics; preserve full backup semantics. Pickup: Issues.md 19.

[DEBT][LIFECYCLE] `store/slices/chaptersSlice.ts` independently updates chapter maps
in hydration, navigation, fetch, import and preload paths. Explicit insertion,
deletion and clear operations now invalidate their graph; audit remaining bypasses
without introducing full-book hashing on each store update.

[DEBT][MUTATION] `components/session-info/VersionSelector.tsx:40` uses in-place `versions.sort()`
on its input. Check cross-component array reuse before a scoped correction.


## 2026-09-05 latency pass

[DEBT][LEGACY][DUPLICATION] App-shell subscriptions and repeated discovery
- `MainApp.tsx` retains unused store subscriptions/ref/memo after auto-translation moved to the store; both settings panels force discovery despite the service's endpoint cache.
- Pickup tickets with evidence and acceptance: [LAT-02](../../Issues.md#lat-02--delete-abandoned-app-shell-subscriptions-and-scaffolding), [LAT-03](../../Issues.md#lat-03--stop-rediscovering-an-unchanged-broker-on-every-settings-panel-visit).

[DEBT][TEST] Validation and local QA gaps
- Missing React declarations weaken JSX type checks; a wrong-endpoint UI test asserts no fetch before the 300ms fetch window. Worktree LFS filtering and a fixed dev-server E2E config complicate reproducible production checks.
- Pickup tickets: [QA-01](../../Issues.md#qa-01--restore-meaningful-react-type-checking), [QA-02](../../Issues.md#qa-02--make-wrong-endpoint-coverage-actually-observe-the-debounce-window), [QA-03](../../Issues.md#qa-03--reproducible-worktree-and-production-browser-verification).

[DEBT][DUPLICATION] Shared provenance panel carries MN10-specific copy
- `components/sutta-studio/AboutThisText.tsx:67-69` calls every packet Satipatthana regardless of its actual work ID.
- Pickup ticket: [COPY-01](../../Issues.md#copy-01--remove-the-hardcoded-sutta-title-from-shared-provenance-ui). Recorded without expanding the route-loading patch.
[DEBT][TEST][2026-09-05] Copied marker-insertion implementation
- `tests/store/slices/illustration-marker-insertion.test.ts:14` reimplements the
  production algorithm, so the suite can stay green when the real action breaks.
- Delete/replace with a few actual store-action cases. Pickup: Issues.md TEST-01.

[DEBT][IMPORT][2026-09-05] Ownership follow-up after streamed graph correction
- The earlier streaming ownership receipt is partly corrected: selected book/version guards now cover streamed final hydration and the library's cache/first-batch hydration and completion.
- `services/importService.ts` still combines the parser, storage, translation reconciliation and UI orchestration inside an async Promise executor. File/ordinary URL acquisition begins before the bootstrap import guard; independently reproduce selection changes during those reads. Same-selection overlapping imports need an explicit request-identity decision if supported.
- Keep parser ordering, acquisition cancellation and broader import decomposition as focused follow-ups, not a new framework inside #160. Pickup: Issues.md 19.

[DEBT][QA][2026-09-05] Native Safari offline file acceptance
- `tests/e2e/semantic-session.spec.ts:65`: desktop and Pixel Chromium upload the exported multi-corpus file offline; pinned WebKit 2215 returns NotReadableError before JSON import.
- Isolated blank-page diagnostic reproduces offline failure for native-file text(), memory-file text(), and FileReader; all three work online. Changing Playwright's buffer upload to native file paths does not repair it.
- Keep the offline test and surface this limitation. Verify a downloaded backup through Safari Files while in airplane mode on a physical iPhone; then check graph navigation, title, translation switching and cold app reopening. Pickup: Issues.md 20.

[DEBT][IMPORT][2026-09-05] Acquisition follow-up narrowed
- File and ordinary URL acquisition now guard selected book/version before applying session metadata or invoking bootstrap; InputBar's streamed first-batch hydration is also guarded.
- Same-selection overlapping requests, stale failure notifications, ordered stream parsing, and replacement of the global tooltip-title cache remain broader lifecycle/decomposition follow-ups. Preserve these as separate receipts rather than growing #160 into a parser rewrite.

[DEBT][LEGACY][2026-09-05] Legacy binding and global tooltip receipts narrowed
- #160 deletes the automatic unbound legacy loader/action and the global tooltip-title cache. Selected reader chapters now supply tooltip titles for every hydration path. The earlier fallback/title-cache follow-ups above are closed by deletion.
- Bundled analysis assets remain available as data. Any future portable conversion must establish the exact corpus hash and translation first. Cold offline launch, same-selection import ordering and stale failure notifications remain open under Issues.md 17/19/20.

[DEBT][IMPORT][2026-09-05] Unknown-scope streaming removed from pasted URL input
- InputBar now uses ordinary `importFromUrl`, which parses the complete session identity before storage. Registry streaming requires a known novel scope; its unscoped ID/hydration branches and unused novel metadata inference are deleted.
- Tradeoff: arbitrary pasted session URLs await complete download; registry first-batch reading is unchanged. Keep parser-order/request-identity work separate. Pickup: Issues.md 19.

[DEBT][UI][2026-09-05] Current-chapter plot marker may retain a stale closure
- `components/oscilloscope/OscilloscopeGraph.tsx` builds `youAreHerePlugin` from currentChapterNumber, but the uPlot creation effect intentionally does not depend on that callback. Static observation only: verify marker movement after navigation with unchanged tracks, then use current state without rebuilding the chart if reproduced. Pickup: Issues.md 19.


### 2026-09-06 — [DEBT][IMPORT][LATENCY] Verify body download bounds before changing buffering

`services/importService.ts:220-272` clears the ordinary URL timeout after headers
and checks the 500 MB limit only against declared Content-Length. A chunked or
underdeclared body has no observed-byte limit, and a stalled body is outside that
timer. This behavior predates the final URL-scope correction; the current packet
review also noted the headers-only timeout. No runtime failure is claimed here.
Follow up with a controlled chunked/stalled response, preserve the full-payload
identity-before-persistence contract, and bound/cancel acquisition at the existing
reader loop. Use a repeated small chunk fixture instead of allocating a giant
test payload. Record time and memory on a representative novel before adding
staging, workers, caching, or another import path. Non-blocking for this reviewed
scope correction; do not close the full-novel QA gate from synthetic checks.

### 2026-09-06 — [DEBT][DATA][CORPUS] Published metadata does not prove a complete indexable novel

Pinned FMoC bytes contain 3,273 records, duplicate numbers and `unknown / quick-export`
identity despite a 3,521-chapter registry entry. Dungeon Defense contains 476 records
with duplicate numbers despite 509 declared book chapters. Both actual corpus
validators reject them. Existing publisher PR #3 fixes Dungeon Defense numbering
with source-bound stable-ID proof, but still covers only 476 chapters, including
30 source-text fallbacks. Capture data repair under Issues.md 21 and reuse the
publisher integrity work; do not weaken semantic validation, silently relabel
versions, or treat a complete supplied array as a complete novel. Exact public
artifact and cross-language parity evidence:
`docs/reviews/SEMANTIC-CORPUS-PREFLIGHT-2026-09-06.md`.


### 2026-09-06 — [DEBT][TEST][BROWSER] Native fetch and scalar-export QA gaps closed

The old capability class invoked stored native fetch with the wrong receiver;
mocked fetch tests passed while real Chromium sent no request. Delete the
single-method wrapper and retain a production-browser capability/popup regression.
A broad `/vectors/i` receipt assertion also matched the allowed `vectorSpace`
provenance key. Restrict forbidden-field assertions to exact serialized keys;
do not delete privacy assertions or drop scoring provenance to pass them.

### 2026-09-06 — [DEBT][LATENCY] Capability rechecks need measurement, not another cache

`hooks/useSemanticOscilloscopeCapability.ts` depends on corpus object identity as
well as its value key. Review suggested repeated equal-object probes, but the
actual browser fixture emitted one capability GET. Current corpus state is not
recreated on ordinary renders. Before changing dependencies or caching readiness,
record repeated requests for one unchanged corpus and preserve endpoint/selection
invalidation. Unused refresh state is deleted. Pickup: Issues.md 22.

## 2026-09-06 consolidation review

[DEBT][PUBLICATION] #171 artifact names omit changed-byte identity; republishing overwrites files still referenced by old manifests. Actual builder probe reproduces same URL/different SHA. Files and publication acceptance: Issues.md CONS-01. Blocks #172 artifact release too.

[DEBT][TEST] #165's manual coverage exclusions drift from Vitest; an excluded configuration file passes its floor validator. Share the effective scope and delete the no-op mapping. Probe and acceptance: Issues.md CONS-02.

[DEBT][PROCESS] #164's receipt schema rejects four real approvals because producer/validator key names differ; controller bootstrap and duplicate ADR numbering are separate problems. Defer automation; Issues.md CONS-03.

[DEBT][COORDINATION] WORKLOG alone conflicts across five original PRs and the reader/QA merge. Preserve both histories while consolidating; evaluate existing task receipts afterward, without a synchronization service. Issues.md CONS-04.

[DEBT][UI] IllustrationRouteDialog's static model insertion can overwrite the saved-default annotation for the same ID. Cosmetic; source review found no submission problem. Pickup: Issues.md UI-01.

[DEBT][UI][2026-09-06] Both offline graph screenshots show a separate unlabelled red outline beneath the plot and above the custom thread chip. Inspect uPlot/default legend DOM in `OscilloscopeGraph.tsx` before choosing a deletion; this is a visual observation, not a confirmed cause or scan failure. Pickup: Issues.md UI-02.

[DEBT][NAVIGATION][2026-09-06] Late targeted acquisition crossed reader scopes on #172. Production held-response repro and local deletion-based correction: Issues.md CONS-05. Existing general source fetching and same-scope overlapping requests need separate measured request-ownership review; no new request coordinator added here.

[DEBT][LATENCY][2026-09-06] `hooks/useChapterDropdownOptions.ts` eagerly creates full chapter diagnostics and uses `summaries.some` inside the considered-ID filter even when debug logging is disabled. `services/navigation/hydration.ts` emits detailed translation logs unconditionally. Measure a representative large catalog, then delete unused diagnostic payloads or gate their construction using existing debug controls; avoid adding observers or caching. Do not mix this into the chapter-publication correction.

[DEBT][IMPORT][2026-09-06] Actual published two-chapter export/offline native-file reopen loses active novel/version selection while retaining readable scoped rows. Synthetic graph-backed selection is a different path. Pickup and acceptance: Issues.md CONS-07. Do not add top-level novel defaults that silently re-scope unrelated or legacy-null chapter rows.

[DEBT][LATENCY][2026-09-06] `components/liturgy/shapes/alignmentGeometry.ts:45-49` reads every claimed element's rectangle but only consumes the first rectangle. The full element set is still needed for morpheme identities. Measure calls during actual hover/layout, then delete unused rectangle reads while preserving one shared source anchor for a multi-token mapping. Static extra-work finding; no latency improvement claimed. WORKLOG: September 6 alignment consolidation.

[DEBT][TEST][LEGACY][2026-09-06] `HtmlRepairService.validate`, `getRepairPreview`, `getAvailableRules` and `repairWithDisabledRules` currently have no production callers in the TypeScript/TSX reference scan; calls are internal to the service or its tests. Existing coverage PR tests exercise this public API surface. Before expanding those tests, decide whether to retire the unused methods and associated tests in a focused deletion; retain real repair/disabled-rule behavior and earned floors. Also reconcile the entity-decoding rule's stale "disabled by default" comment with its actual enabled behavior. This receipt does not change decoding or remove an API during coverage-policy repair.

[DEBT][LEGACY][2026-09-06] Merged parser recovery #178 intentionally excludes later hardening idempotency and process-lifecycle work. Before recovering more code, reproduce repeated no-write hardening and verify process ownership in disposable native Windows fixtures. Current public source: `integrations/sillytavern-bridge/deploy/windows/apply-sillytavern-hardening.ps1`. Do not copy an older deployment aggregate over current configuration/provider behavior. Detailed observations about unpublished local implementations remain in local Git metadata; Issues CONS-08 identifies the pickup record. No later supervisor was recovered or activated.

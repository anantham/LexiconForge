# De-Sprawl Roadmap — LexiconForge (re-anchored to live repo)

**Date:** 2026-08-16
**Revision:** 2.1 (post-rereview — see "Rev 2.1 changes")
**Owner:** Aditya (human gate) + agent execution
**Status:** Proposed — audit draft. NOT approved for execution: architectural choices await decision packets (see Open decisions).
**Source of truth:** `/Users/aditya/Documents/Ongoing Local/LexiconForge` (live repo). The `~/.codex/.chatgpt-projects/.../sources/` mirror is a stale pre-refactor snapshot and is not authoritative.

---

## Rev 2.1 changes (post-rereview)

1. **Calvino evidence corrected.** The spec generates tests in a loop over the payload; with payload absent it defines **zero** tests (not 22 skipped). T0.3 now separates zero-test discovery, payload preflight, and the external-server prerequisite.
2. **Image-migration command recognized as live.** `migrateImagesToCacheFromDB` is exposed on `window` by design (`store/index.ts:26` + `imageMigrationService.ts:154-156`). Removed from the dead-export list; retirement is a product decision that removes both the import and the global.
3. **Sutta prerequisite strengthened.** T1.1 resolves the option-B conflict; T1.4/T1.5 now require the CONSOLIDATION.md gates: canonical orchestrator, zero legacy production imports, full tests, benchmark CLI smoke, live UI compile smoke.
4. **Decision register reconciled.** All 12 `DECISION NEEDED` headings are listed; T1.3 downgraded to investigation; each decision is flagged as needing a decision packet (impact/effort/risk/reversibility/time/tradeoffs) before execution.
5. **T2.4 split** into correctness bug / dead-migration cleanup / optional registry.
6. **Pricing invariant narrowed** (fail-closed for budgeted work; explicit unknown for post-hoc; validated defaults).
7. **Doc-path test scoped** to Markdown links + designated current paths, excluding historical ADR content.
8. **Import-audit guardrail concretized** (deliverable + fixtures, including the exact paths this audit missed).

---

## Legend

- **Verdict:** verified (confirmed against live tree) / inferred / **DECISION NEEDED** (human picks from options) / **INVESTIGATION** (responsibility map required before any decision).
- **Confidence:** 0.0–1.0.
- **Effort:** S (<2h) · M (half-day) · L (1–2 days) · XL (multi-day).

---

## Already done — do NOT re-scope these

| Item | Evidence |
|---|---|
| Monolithic `services/indexeddb.ts` removed | `ls services/indexeddb.ts` → no such file |
| `useAppStore.ts` → `store/` slices | `store/index.ts` composes slices |
| `services/adapters.ts` → `adapters/providers/` | file absent |
| `navigationService.ts` / `suttaStudioCompiler.ts` → shims | both pure re-export shims |
| Stable-ID canonical for **persistence** | `services/db/core/stable-ids.ts`, `url_mappings`, `navigation/` stores `stableIds[]` |
| `normalizeUrlAggressively` custom-scheme fix | `stableIdService.ts:156,161-164`; V6 migration |
| SEC-001 credential boundary + canary scan | `test.yml`, `scripts/security/scan-client-secrets.mjs` |
| `codex-review.yml` false-green deleted | only `test.yml` remains |
| Pass-prompts/runner consolidated to `sutta-studio/` | 47/35-line shims (verified) |
| TypeScript clean | `npm run typecheck` → exit 0 |

---

## Phase 0 — Trustworthy baseline (0–2 days) · BLOCKER

### T0.0 — Operator: rotate or verify the `.env.local` key
**Verdict:** DECISION NEEDED · **Effort:** S
- `.env.local` is gitignored and carries an in-file note that a key was shared over chat. **I did not inspect its value.** If known-exposed, rotation is a Phase-0 operator blocker. Otherwise unverified hygiene.
- **Acceptance:** key rotated (if exposed) OR explicitly confirmed not-exposed; no rotation required by default.

### T0.1 — Node runtime enforcement / jsdom localStorage
**Verdict:** verified · **Confidence:** 0.95 · **Effort:** S
- On Node 26, jsdom exposes no `localStorage` → `vitest list` exits 1 with zero tests; 116 tests fail across 11 files. Fix (`NODE_OPTIONS=--no-experimental-webstorage`) is documented in `TECH-DEBT-INBOX.md:111-138` but wired nowhere.
- **Two options, each with its own acceptance:**
  - (a) **Reject unsupported Node:** preflight fails once with a descriptive message → acceptance = Node-26 dev sees the one-line error.
  - (b) **Support Node 26:** wire the webstorage flag into the test script/setup → acceptance = full suite green on Node 26.
- **Acceptance (shared):** the chosen strategy is proven with the probe; no undocumented shell flag remains.

### T0.2 — Re-point dead coverage thresholds
**Verdict:** verified · **Confidence:** 0.95 · **Effort:** S
- `vitest.config.ts:38,42,49-50` thresholds target `services/aiService.ts` (deleted) and `services/HtmlSanitizer.ts`/`HtmlRepairService.ts` (moved to `services/translate/`).
- **Acceptance:** every threshold path resolves; a smoke proves they fire.

### T0.3 — Kill e2e false-green (zero-test discovery, payload preflight, external server)
**Verdict:** verified (read the spec) · **Confidence:** 0.9 · **Effort:** S
- `npm run smoke:sutta-studio` → exit 0 with 1 skipped (gated on `OPENROUTER_API_KEY`).
- `calvino-completeness.spec.ts` generates its tests in a `for (unit of payload.units)` loop: payload present → **22 active tests**; payload absent → `units: []` → **zero tests defined** → Playwright "no tests found" → exit 0. It also targets `localhost:5210` while the default webServer runs `:5177`.
- **Acceptance (four separate conditions):** (a) zero-test discovery fails loudly; (b) a payload preflight runs before discovery; (c) the external-server prerequisite (`:5210`) is explicit or the spec uses the harness webServer; (d) an unexpected-skip assertion gates every e2e run.

### T0.4 — Add an e2e job to CI (hermetic)
**Verdict:** verified · **Confidence:** 0.85 · **Effort:** M
- No Playwright job in `test.yml`. But the e2e set is not CI-ready: Calvino needs gitignored payload + a separate server, one smoke is paid, diagnostics are opt-in.
- **Acceptance:** a CI job that installs browsers, selects a hermetic project/test subset, and asserts against zero tests and unexpected skips — not merely `npm run test:e2e`.

---

## Phase 1 — Kill the genuine dual systems (Week 1)

### T1.1 — Two `runSkeletonPass` bodies → one (de-sprawl, NOT a SUTTA-014 parity fix)
**Verdict:** verified · **Confidence:** 0.95 · **Effort:** M · **DECISION NEEDED** (which is canonical)
- `compiler/skeleton.ts:20` (138 LOC, production) vs `sutta-studio/passes/skeleton.ts:54` (196 LOC, benchmark via shim). Both live; no orchestrator port has occurred.
- **Options:** (a) production adopts `sutta-studio/passes/skeleton` and `compiler/skeleton.ts` is deleted, or (b) `sutta-studio/passes/skeleton` re-exports the compiler impl. **Constraint:** if the end state is deleting `services/compiler/`, option (b) is invalid (it would keep `compiler/skeleton.ts` canonical). Pick (a) if `services/compiler/` is to be retired.
- **Acceptance:** exactly one `runSkeletonPass` symbol, consistent with the intended `services/compiler/` fate.

### T1.2 — Un-invert the Claude adapter
**Verdict:** verified · **Confidence:** 0.95 · **Effort:** M · **DECISION NEEDED** (adapter-owns vs service-owns)
- `adapters/providers/ClaudeAdapter.ts:8` 100%-delegates to the old `services/claudeService.ts` (inline schema + prompt construction `:45-100`, no rate limiting).
- **Options:** (a) move `claudeService` logic into the adapter, or (b) make `claudeService` a proper adapter dependency. **Acceptance:** Claude uses the shared schema + rate-limit path.

### T1.3 — Translation call chain (INVESTIGATION, not a decision)
**Verdict:** INVESTIGATION · **Confidence:** 0.7 · **Effort:** M
- `translationService.ts` (1,019 LOC) → `ai/translatorRouter.ts` → `translate/Translator.ts` (465 LOC). Two layers on one path is not proven duplication: `TranslationService` owns history/persistence/cancellation; `Translator` owns provider retries/chunking/normalization.
- **Deliverable:** a responsibility map. Only if it shows real overlap does this become a decision. **Acceptance:** the map is produced and reviewed; collapse only if overlap is proven, else the split is documented.

### T1.4 — Land the compiler's un-finished decomposition (orchestrator port is the completion gate)
**Verdict:** verified · **Confidence:** 0.9 · **Effort:** L
- `compiler/index.ts` (947 LOC) imports ~9 flat files alongside `sutta-studio/`. `CONSOLIDATION.md:248` requires the orchestrator port + consumer migration + full tests + benchmark smoke + manual UI compile smoke.
- **Acceptance (must include):** a canonical orchestrator; zero legacy production imports; full test suite; benchmark CLI smoke; live UI compile smoke. Moving the flat cluster alone does not pass.

### T1.5 — Shim deletion ONLY after consumer + orchestrator migration (and the T1.4 gates)
**Verdict:** verified · **Confidence:** 0.9 · **Effort:** M
- `suttaStudioPassPrompts.ts`/`suttaStudioPassRunners.ts` are true shims, but `benchmark.ts` still imports them. `compiler/index.ts` still imports `./llm`, `./prompts`, `./skeleton` — so `compiler/llm.ts`/`prompts.ts`/`skeleton.ts` are production dependencies, not deletable shims.
- **Acceptance:** shims deleted only after benchmark + compiler import canonical paths directly AND all T1.4 gates pass.

---

## Phase 2 — Dead code & capability islands (Week 2) · re-verified with entrypoint-aware audit

### T2.1 — DB factory: migrate navigation off `getRepoForService` first
**Verdict:** verified · **Confidence:** 0.9 · **Effort:** M · **DECISION NEEDED** (keep factory or migrate navigation)
- `services/db/index.ts` is **live** via `getRepoForService` (navigation/index.ts, navigation/hydration.ts). Slices bypass it and call operations directly. `makeIdbRepo` has an inverted "placeholder" comment at `:711`.
- **Options:** (a) migrate navigation onto operations directly and retire the factory, or (b) make the factory the single entry. **Acceptance:** one DB entry convention; the placeholder comment corrected either way.

### T2.2 — Delete only genuinely-dead exports (re-verified)
**Verdict:** inferred · **Confidence:** 0.7 · **Effort:** M
- Candidates (must be re-confirmed entrypoint-aware before deletion): `migrateFromLocalStorage`/`isMigrationCompleted`, `dbUtils`, `resetToModernBackend`, `validateSchema`/`exportSchema`/`DOMAIN_STORES`/`getStoresForDomain`.
- **Explicitly NOT here:** `migrateImagesToCacheFromDB` — it is live by design (window exposure via `store/index.ts:26` + `imageMigrationService.ts:154-156`).
- **Acceptance:** delete only after a dynamic-import-aware audit confirms zero entrypoints; keep a removal note for anything retained.

### T2.3 — Keep-or-delete for low-consumer islands (NO deletions as-is)
**Verdict:** verified · **Confidence:** 0.85 · **Effort:** M · **DECISION NEEDED**
- These are **live** (do NOT delete): `services/diff/` (`MainApp.tsx:24`), `services/librarySearch/` (`LibrarySearch.tsx`, `NovelLibrary.tsx`), `services/import/booktoki.ts` (`importService.ts`), providers barrel (`lookup-phase.ts`).
- **Action:** re-run an entrypoint-aware audit to find what is truly unreachable, then decide wire-or-delete per island.

### T2.4a — Correctness bug: `repairMissingModelFields` stamps completion despite errors (NO architecture dependency)
**Verdict:** verified · **Confidence:** 0.9 · **Effort:** S
- `migrationService.ts:269` writes `model-field-repair-completed` unconditionally, even when `errors.length > 0`; `ensureModelFieldsRepaired` returns normally so boot treats it as success.
- **Acceptance:** failed records are never recorded as success; a regression test proves a partial failure is retried, not stamped done.

### T2.4b — Dead localStorage migration cleanup
**Verdict:** verified · **Confidence:** 0.85 · **Effort:** S
- `migrateFromLocalStorage` (`migrationService.ts:47`) sets `indexeddb-migration-completed` prematurely (`:63`), swallows per-section errors, and has zero importers.
- **Acceptance:** the function and its flag are deleted or given a real owner with correct exit semantics.

### T2.4c — Repair-flag registry (OPTION, not a decided fact)
**Verdict:** verified problem, solution TBD · **Confidence:** 0.8 · **Effort:** L · **DECISION NEEDED**
- **Problem:** ~19 ad-hoc flags; two different `resetMigrationState()`.
- **Options:** (a) versioned repairs record keyed by `SCHEMA_VERSIONS`; (b) keep flags but add completeness gates + failure-retry; (c) per-repair explicit exit conditions. **Acceptance:** failed/obsolete repairs are re-runnable and removable.

---

## Phase 3 — Single-owner state & config (Week 3)

### T3.1 — One canonical owner for `AppSettings` (fix acceptance)
**Verdict:** verified · **Confidence:** 0.9 · **Effort:** M · **DECISION NEEDED** (localStorage vs IDB)
- **Problem (verified):** dual-persisted with no reconciliation — localStorage (`sessionManagementService.ts:128-180`) vs IDB (`operations/imports.ts:243`, `repositories/SettingsRepository.ts:22`), plus a third reader (`SettingsModal.tsx:147`). Import writes IDB; startup reads localStorage without reconciling the imported value. Credentials ride inside.
- **Acceptance:** ONE canonical source + a one-time migration + import/export bridging + credential-redaction invariant + removal of the second runtime owner. (Not "copies agree" — that would preserve two copies.)

### T3.2 — Credentials/baseURL vs model catalog/pricing (SEPARATE concerns)
**Verdict:** verified problem, solution TBD · **Confidence:** 0.85 · **Effort:** L · **DECISION NEEDED**
- **Credentials/baseURL (verified):** 4+ key read routes; baseURL map ×5 (`explanationService`, `comparisonService`, `SimpleLLMAdapter`, `imagePlanPlanner`, `imageService`).
- **Model catalog/pricing (verified, reframed):** default `google/gemini-3.1-flash-lite-preview` has no static entry but `cost.ts:46` fetches OpenRouter pricing dynamically for slash models.
- **Pricing invariant (corrected):** (a) paid/budgeted work **fails closed** when pricing cannot be verified; (b) post-hoc accounting reports an explicit unknown (never silent 0); (c) built-in defaults have validated pricing. (Not "any selectable model is priced" — external catalogs cannot guarantee that.)
- **Options:** (a) one registry for credentials/baseURL and a separate catalog/pricing source; (b) keep per-feature credential resolution but add a contract test for parity.

### T3.3 — Retry: fix the CONTRADICTORY classification, do NOT force one global policy
**Verdict:** verified · **Confidence:** 0.9 · **Effort:** M · **DECISION NEEDED** (mechanism sharing vs domain policies)
- **Problem (verified):** `utils/retry.ts:34-35` excludes `AbortError` (user cancel); `db/core/errors.ts:64-67` maps abort→Transient→retry. Network abort (user cancel, must not re-bill) and IndexedDB abort (different causes) are conflated. Separately, `capabilityService.getModelMetadata:323-326` drops `loadError` after retry exhausts; `supportsParameters:296-299` fails open.
- **Options:** (a) share retry MECHANICS but keep domain-specific classification/policy; (b) leave separate, but reconcile the AbortError semantics + fix capability-result provenance. **Acceptance:** no caller converts exhaustion to silent `null`/permissive-true; abort semantics are consistent per domain.

### T3.4 — URL alias indexes (separate architectural question; defect already fixed)
**Verdict:** verified · **Confidence:** 0.85 · **Effort:** M · **DECISION NEEDED**
- `normalizeUrlAggressively` already preserves custom schemes; the `null/chapter/N` corruption is resolved (V6 migration).
- **Remaining question:** whether the URL-keyed in-memory caches (`chaptersSlice.ts:36-37` `urlIndex`/`rawUrlIndex`) should remain alongside stable-ID — a separate architectural decision, not a defect.

---

## Phase 4 — Doc/code sync + verification confidence (Week 4)

### T4.1 — Refresh stale LOC tables
**Verdict:** verified · **Confidence:** 0.95 · **Effort:** S
- `ARCHITECTURE.md` §4.5/§7 lists `suttaStudioPassPrompts.ts`=725, `PassRunners.ts`=586, `compiler/prompts.ts`=347 — actuals are 47 / 35 / 26 (shims). §5 `ChapterView.tsx` 433 vs actual 581 LOC (22,376 bytes).
- **Acceptance:** every cited LOC matches the file.

### T4.2 — Reconcile ADR index and DB-007 (DB-001 is fine)
**Verdict:** verified · **Confidence:** 0.9 · **Effort:** S
- `START_HERE.md` advertises DB-001..DB-007 (DB-004/005/006 don't exist) and omits SUTTA-009..014, SEC-001, CORE-007/012, LITURGY-001, DB-002/003.
- `DB-001` already carries an implementation note explaining the 8 named services were not built — correctly amended, NOT drift. `DB-007` is stale (its note claims schema v13; actual `SCHEMA_VERSIONS.CURRENT=16`).
- **Acceptance:** index matches `docs/adr/`; DB-007 gets an amendment note.

### T4.3 — Fix dead doc references (scoped to links + designated paths)
**Verdict:** verified · **Confidence:** 0.9 · **Effort:** S
- `ONBOARDING.md:48` → `services/aiService.ts` (gone); `docs/guides/Providers.md` → `docs/Audio.md` (actual `docs/features/Audio.md`); `docs/guides/ADDING_AI_PROVIDER.md:47` imports `services/aiService`.
- **Acceptance (scoped):** Markdown **links** and explicitly designated current repo-relative paths resolve. Backtick content that is symbols/examples/historical paths/commands/globs is excluded; historical ADR bodies are excluded.

### T4.4 — Canonical index + archive policy (NOT one tracker)
**Verdict:** verified · **Confidence:** 0.9 · **Effort:** M · **DECISION NEEDED** (which is canonical)
- `AGENTS.md` deliberately assigns separate roles: WORKLOG (chronological), `TECH-DEBT-INBOX` (raw), `TECH-DEBT-STATUS` (curated), ARCHITECTURE §7 (structural hotspots). Do not collapse these.
- **Problem (verified):** 9+ dated roadmaps (`DEEP-AUDIT`, `FIX-PRIORITY`, `INTEGRITY-SCAN`, `GOLDEN-CONTRACT-REPAIR`, `JANE-STREET-RECON`, `REMEDIATION-ROADMAP`, `ADDITIONAL-ARCHITECTURAL-ISSUES`) with no canonical index; INBOX is prepended despite its append-only header; STATUS metrics are frozen at Mar-29.
- **Acceptance:** a canonical index + archive policy that maps each artifact to its role and end-state, preserving the four AGENTS.md roles.

---

## Phase 5 — Prevention guardrails (ongoing)

1. **PR checklist** (extend `AGENTS.md`/PR template): migration complete-condition · doc/code sync check · single owner for any state · removal plan for one-shots.
2. **Legacy sweep cadence:** quarterly review that retires ambient compatibility branches with deadlines.
3. **Provider/privacy central gate:** forbid new direct-SDK instantiations outside `adapters/providers/` + `providerCredentials.ts`.
4. **Entrypoint-aware import audit (concrete deliverable):** build a small graph tool (or script) that resolves side-effect imports, relative imports, `@/...` aliases, directory-barrel re-exports, literal dynamic `import()`, and flags unresolved computed imports. **Fixtures/regression set = the exact paths this audit missed:** `MainApp.tsx:24` (side-effect), `importService.ts` → `./import/booktoki` (relative), `navigation` → `getRepoForService` (barrel), `lookup-phase.ts` → providers barrel. **Acceptance:** the tool re-derives the live-consumer set from Phase 2 and reproduces no false-dead verdicts.

---

## Open decisions for the human (complete register — all 12)

Each requires a **decision packet** (impact / effort / risk / reversibility / time / confidence / open questions / uncertainties) before execution. This is the Option-B follow-on.

| # | Ticket | Decision |
|---|---|---|
| D1 | T0.0 | `.env.local` key disposition (rotate vs unverified) |
| D2 | T1.1 | Which `runSkeletonPass` is canonical; is `services/compiler/` retired? |
| D3 | T1.2 | Claude: adapter-owns vs service-owns |
| D4 | T2.1 | DB factory: migrate navigation off `getRepoForService` vs make it single entry |
| D5 | T2.3 | Low-consumer islands: wire vs delete (per island) |
| D6 | T2.4c | Repair-flag registry shape (or keep flags + gates) |
| D7 | T3.1 | `AppSettings` canonical store (localStorage vs IDB) |
| D8 | T3.2 | Credential/baseURL + catalog/pricing registry shape |
| D9 | T3.3 | Retry: shared mechanics vs per-domain policies |
| D10 | T3.4 | URL alias indexes: keep vs remove |
| D11 | T4.4 | Debt-index location (canonical index + archive policy) |
| D12 | T0.0/Phase 0 | Manual vs CI paid smoke (`smoke:sutta-studio`) |

**Note:** T1.3 is INVESTIGATION, not a decision — no packet until its responsibility map exists. The `migrateImagesToCacheFromDB` retirement is a separate product decision (remove both the `window` exposure and the `store/index.ts:26` import together).

---

## Confidence & evidence note

Rev 2.1 corrects all rereview findings; contested facts (Calvino test generation, image-migration window exposure) were re-verified against the source this session. This is an **audit draft**, not an approved execution plan — every `DECISION NEEDED` item awaits a decision packet. Nothing has been executed.

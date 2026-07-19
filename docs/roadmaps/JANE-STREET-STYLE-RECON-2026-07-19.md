# Jane Street House-Style Recon — 2026-07-19

**Question asked:** "can we rewrite the code in Jane Street house style? it looks like we
can improve stuff by a lot" — recon, no code changes.

**Verdict: yes, the improvement is large — but the play is a phased hardening, not a
rewrite.** The decisive evidence is that this repo's *shipped bug ledger maps 1:1 onto
specific house-style principles*: every class of bug we paid for this month is a class
one of these disciplines makes unrepresentable. This is bug-debt wearing style-debt's
clothes.

Method: 3 parallel read-only recon agents (error-handling, type discipline, module
boundaries) + inline compiler-substrate measurement; every load-bearing claim below was
independently re-verified at the file before inclusion (SSRF drift, barrel cycle,
compiler/passes duplication, strict-flag counts).

---

## 0. The argument in one table — shipped bugs vs. missing disciplines

| Shipped bug (real, from git/ledger) | Style deficit | Discipline that makes it unrepresentable |
|---|---|---|
| Looking up ch-4 returned ch-3 (`ef5dbd9`, issue #9 — url matched against prev/next) | Four ID kinds all bare `string` | Branded `CanonicalUrl` ≠ `NeighbourUrl` ≠ `StableId` |
| API keys leaked into session export (PR #115) | Secrecy = field-name substring `apikey`, in BOTH the runtime filter and the type-level `Omit` | `Sensitive<T>` brand — export site can't accept one |
| Duplicate illustration marker → double-billed paid image gen (`9e2b634`) | Marker = raw string cache key, deduped at 3 runtime sites | Parse-don't-validate: unique-marker type at parse time |
| Translation succeeded, persist failed, user shown success (translationService.ts:383) | `catch { console.warn }` then return success | Result-typed persist folded into the return union |
| Error-path spend uncharged to the $50 cap (audit B3, fixed `d55d9ff`) | Exceptions skip the accounting line | Errors-as-values: accrue is unskippable in a Result pipeline |
| Correct validator dead in prod while 3 forks diverged (#111 root cause) | Wide boundaries, no dead-export detection | Interface-first modules + lint for unimported exports |
| SSRF allowlist: canonical module dead, 2 live forks drifted (§4) | Duplicated security boundary | One canonical import, forks deleted |
| Benchmark ranks models through code prod doesn't run (§5) | Whole pass-pipeline implemented twice | One pass kernel shared by app + bench |

---

## 1. Foundation: the type checker is largely switched off

- **`tsconfig.json` has no `"strict"`. `strictNullChecks` is OFF** → all **855 `| null`
  annotations are decorative**; the compiler enforces none of them.
- **No ESLint config exists at all.**
- Debt decomposition (measured 2026-07-19, tip `d55d9ff`):
  - `--strictNullChecks` alone: **131 errors** — thin spread, worst file 11
    (`benchmark.ts`), then `translationsSlice` 10. *An afternoon.*
  - `--noImplicitAny` alone: **6,813 errors** — the mountain (plus `allowJs: true`).
  - `--strictFunctionTypes`: ≈ baseline (17). Baseline without flags: 17.
- 281 `: any` + 114 `as any` are only the *visible* any-debt.

## 2. Type discipline (agent-verified, spot-checked)

- **Zero branded/newtype types and zero secret-wrapper types in the entire repo.** All
  IDs (chapter URL, canonical URL, stableId, novelId, versionId, provider, model) are
  bare `string`.
- The wrong-chapter fix survives only as *comment discipline*
  (`services/translationService.ts:879-901` splits identity from adjacency in prose).
- The db API **doubled itself** because ID kinds are indistinguishable: parallel
  `…ByUrl` / `…ByStableId` families across `services/db/index.ts:64-73`.
- Swappable signatures, worst offenders: `ensureUrlMappings(chapterUrl, stableId)`
  (`db/core/stable-ids.ts:26`); `(providerName, modelId)` in capabilityService vs
  **reversed** `(model, provider?)` in `apiMetricsService.ts:584`.
- **Optional-field bags where discriminated unions belong:** `Chapter` (types.ts:3-25,
  four competing nullable identities); `EnhancedChapter` load-state
  (`stableIdService.ts:50-72`: loaded/error/never-translated as two independent
  optionals — `{both set}` is representable and meaningless).
- **Behavior-selecting booleans in the ID machinery:** `isCanonical: boolean` picks
  *which URL index a mapping writes to* (`db/core/stable-ids.ts:30`); `getLinkByDirection(isNext: boolean)`
  (`scraping/siteAdapters.ts:188`) — the same next/prev axis as the navigation bug.
- The codebase already writes discriminated unions well in leaf value types
  (`types/suttaStudio.ts` state machines) — the internal style anchor; it was just never
  lifted to entity/identity level.
- `AppSettings` = one flat ~33-field bag mixing credentials with font sizes.

## 3. Error handling: three taxonomies and one Result type, all quarantined

- **`PassCallResult<T>`** (`services/sutta-studio/passes/types.ts:23`) is a real
  errors-as-values type — consumed **only by scripts/benchmarks**, never by the app.
- **`DbError`** (`services/db/core/errors.ts`) is a full taxonomy (9 kinds,
  `isRetryable`, `requiresUserAction`, DOMException mapping) — and **no consumer
  anywhere switches on it**. The ops layer directly above destroys it:
  `db/operations/mappings.ts:36,63` `catch { return null }` on the URL↔stableId
  resolvers (navigation + import dedup cannot tell "no mapping" from "DB failed");
  `db/core/restoreStorage.ts:51-168` does the same on the *disaster-recovery* path.
- **`AppError`** (`services/appError.ts`): orphaned (2 importers). Three taxonomies,
  none crosses its module boundary.
- **Phantom success:** `translationService.ts:383-385` — persist failure warned and
  ignored, success returned (silent data loss).
- 9+ fully-empty `catch {}` in services; components re-classify untyped errors by
  string-matching (`error.name === 'AbortError'`) because services throw bare `Error`.

## 4. Module boundaries

- **SSRF allowlist triplicated + canonical DEAD + drifted** *(re-verified)*:
  `services/scraping/allowedDomains.ts` self-describes as "single source of truth,"
  has **zero importers**, and is **missing `fojin.app` + `84000.co`** which both live
  copies (`vite.config.ts:14-30`, `api/fetch-proxy.js:14-31`) contain — wiring the
  proxies to the canonical module naively would silently block two live domains.
  Parity today is held by a test that regex-scrapes the source text.
- **Barrel cycle** *(re-verified)*: `db/operations/sessionExport.ts:11` imports the Ops
  from `./index`; `operations/index.ts:28` re-exports sessionExport → A↔barrel↔A,
  TDZ/init-order hazard in the persistence layer. Fix is a 7-import redirect.
- `services/db/index.ts` (829 LOC) is a factory *and* a barrel.
- **Store entanglement:** slices import 41 services (business logic in the store
  layer); `importService.ts` statically imports the store and reaches into it 10+
  times; the store's bootstrap dynamically imports importService back — a
  cycle-breaking hack that admits the boundary is broken.
  **Clean template already in-repo:** `readerHydrationService.ts` takes an injected
  `setState` — copy this pattern.
- Retry/backoff: canonical `utils/retry.ts` used by 3 files; ≥5 hand-rolled forks;
  `shouldRetryStatus` verbatim-duplicated twice.
- Truly dead exports found: `validateImageFile`, `isAlignmentFresh`,
  `estimateImageCostFromHistory`; `archive/useAppStore.ts` (2,218 LOC) is an
  importer-less fossil still carrying forked normalizeUrl/illustration logic.
- Monolith seams: `maintenance.ts` 2,713 LOC = ~400 backfills + ~1,900 self-contained
  scoped-ID repair cluster (cleanest split of the four); `translationService.ts` has a
  ~320-LOC history cluster; export logic is split across FOUR files non-canonically.

## 5. The architecture-level coverage inversion (flagged for the paid run)

`services/compiler/index.ts` (production compile path) implements all five LLM passes
inline with throw/warn-continue ("Anatomist pass failed … continuing without it"),
importing only `passes/grounding` — while the Result-based `services/sutta-studio/passes/*`
runners are consumed **only** by the benchmark and scripts. Two skeleton
implementations exist. *(Re-verified at imports level 2026-07-19.)*

**Implication:** the benchmark ranks models through a code path production doesn't
run — the responseValidators inversion at architecture scale. PR #112 restored parity
at some level; **before leaning on paid-run rankings for product decisions, check the
two paths assemble identical prompts**; then unify on one pass kernel so parity is
structural, not aspirational.

---

## Phased plan (each phase independently shippable; never mixed with correctness work)

**P0 — enforcement substrate + verified point-fixes (≈ half a day, zero behavior change)**
1. `strictNullChecks: true` + fix the 131. (Then the 855 `| null` start meaning something.)
2. ESLint flat-config baseline: `no-floating-promises`, `no-unused-vars`/dead-export
   detection, `switch-exhaustiveness-check`, ban new `: any` (warn-ratchet).
3. SSRF unification: add the 2 missing domains to `allowedDomains.ts`, import it from
   both proxies, delete forks + the regex-parity test.
4. Break the operations-barrel cycle (7 imports).
5. Delete confirmed-dead exports + `archive/useAppStore.ts`.

**P1 — the type spine (2–4 focused sessions)**
1. Branded IDs (`CanonicalUrl`, `RawUrl`, `StableId`, `NovelId`, `VersionId`,
   `ProviderName`, `ModelId`) with parse-at-boundary constructors; start at the db +
   navigation seam (`stable-ids.ts`, `mappings.ts`, translationService history).
   Collapses the doubled `…ByUrl/…ByStableId` API as a follow-on.
2. `Sensitive<string>` for all credentials in `AppSettings`; export serializer accepts
   no `Sensitive` — retires the #115 class structurally.
3. `Result<T, DbError>` on `db/operations/` (mappings, restoreStorage first) — stops
   destroying the existing taxonomy; callers branch on `kind === 'NotFound'`.
4. Fold persist-failure into `translateChapter`'s return union (kills phantom success).

**P2 — structural unifications (1–2 sessions each, order by appetite)**
1. One pass kernel: production compiler consumes `passes/*` runners (prompt-parity
   check first — see §5). Benchmark↔production parity becomes structural.
2. Store inversion: importService gets injected setters (readerHydrationService
   pattern); slices thin toward state-only.
3. Chapter identity + load-state discriminated unions; `isCanonical`/`isNext` booleans
   → two-variant unions.
4. `maintenance.ts` split (scoped-ID repair cluster out); retry unification on
   `utils/retry.ts`.

**P3 — the mountain (ongoing ratchet, not a project)**
- `noImplicitAny` per-directory (6,813): ratchet via CI count-must-not-increase, chew
  a directory at a time. Monolith splits (exportService 4-file canonicalization,
  translationService clusters) as they're touched.

**Do NOT:** big-bang rewrite (92k LOC, one dev-week of pure churn risk); mix any of
this into benchmark/correctness PRs (standing repo rule); start P1 before P0.1 lands
(branded types without strictNullChecks build on sand).

---

*Recon by 3 parallel Explore agents + inline verification, session 2026-07-19. Raw
agent reports in the session transcript; every §-headline claim re-verified at file
level before inclusion.*

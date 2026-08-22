# Velocity Cruft Patterns — LexiconForge

**Status:** Reference ledger (v1, audit of 2026-08-22)
**Provenance:** Static-analysis audit of the full tree against the cross-project catalogue
[`CAPABILITY_ACCRETION_PATTERNS.md`](https://github.com/anantham/TemporalCoordination/blob/codex/consolidate-open-work/docs/ops/CAPABILITY_ACCRETION_PATTERNS.md)
(TemporalCoordination, branch `codex/consolidate-open-work`), plus a native-class hunt.
Score: **12 PRESENT · 6 PARTIAL · 2 ABSENT**, plus **8 repo-native classes**.

## How to use

- Each entry names the mechanism by which velocity converts speed into permanent weight,
  its strongest local evidence (`path:line`), the generator hypothesis, and a response rule.
- New instances are appended as dated receipts under the pattern they belong to — never
  deleted. When a finding is fixed in code, append a `Closed:` line citing the PR;
  do not rewrite history (same discipline as ADRs).
- Raw new observations go to `TECH-DEBT-INBOX.md` with `[DEBT]` prefixes; promote here
  only once verified.

---

## Scorecard vs origin catalogue

| CAP | Pattern | Verdict | Strongest local instance |
|-----|---------|---------|--------------------------|
| 001 | Migration without exit condition | PRESENT | `scripts/backfillChapterNumbers.ts` — gated at boot but no telemetry/deletion path |
| 002 | One-shot becomes shadow subsystem | PARTIAL | ~7 private OpenRouter clients in `scripts/sutta-studio/` |
| 003 | Split-after-extraction divergence | PRESENT ★ | Debug gates copied 6× with divergent behavior per provider |
| 004 | Ambient-target maintenance | PRESENT | `start-lexiconforge.command` hardcoded `/Users/aditya`; broken venv npm scripts |
| 005 | Selector identity drift | PRESENT | Chapter identity via title regexes vs canonical `stableId` |
| 006 | Exclusive tests preserve obsolete ownership | PRESENT | Suite for zero-caller `consolidateBookshelfDuplicates` |
| 007 | Safety guards around dead paths | PARTIAL | Unguarded `migrateFromLocalStorage` armor with no tests |
| 008 | Docs record starts > endings | PRESENT | REMEDIATION-ROADMAP "Active" while targeting deleted files |
| 009 | Repo policy ↔ deployed reality fork | PRESENT | Extension popup PING gate no content.js answers; dev-only route shipped |
| 010 | Silent config no-ops | PARTIAL | `maxSessionSize` (removed in #140) |
| 011 | Compat tail without deletion trigger | PRESENT | Legacy base64 image dual-read, console-only migration tool |
| 012 | Verification multiplier becomes product | PRESENT | 5 major audits in 6 weeks re-documenting same findings |
| 013 | Derived state w/o completeness boundary | PRESENT | Nine ungated boot repairs run every startup |
| 014 | Execution boundaries follow labels | PARTIAL | Rate-limiter parked-callers bug (fixed #140) |
| 015 | Capability island mistaken for feature | PARTIAL | liturgy-generator CLI-only; `/sutta/pipeline` 404s deployed |
| 017 | Outcome class ≠ branch evidence | PARTIAL | ~8% weak assertions; over-deletion passes range asserts |
| 037 | Global test target escapes fixtures | PRESENT | fake-indexeddb never reset; 12/112 files clean stores |
| 038 | Discovery presence = authorization | ABSENT ✓ | Explicit provider registry + domain allowlist |
| 039 | Verdict crosses boundary w/o identity | PRESENT | Positional paragraph alignment in `polyglot-merge.ts` |
| 040 | Deletion credited without ledger | ABSENT ✓ (mechanism) | Promises exist; no promise→actual tracking |

---

## Part I — Imported patterns (origin catalogue, confirmed operating here)

### CAP-003 — Split-after-extraction divergence ★ strongest in this repo

**Local shape:** shared concepts (debug gating, prompt assembly, formatting, summary
building) were copied into sibling modules during extraction sprints; fixes land in one
copy only. The copies are not peers — each silently owns different behavior.

**Evidence:**
- Debug gate ×6+: `adapters/providers/OpenAIAdapter.ts:26-41` reads localStorage with
  **no NODE_ENV gate**; `GeminiAdapter.ts:16-52` is production-gated → prod builds log
  OpenAI calls but never Gemini; `services/claudeService.ts:15-20` reads legacy keys only.
- Prompt construction triplicated across providers (Gemini `:220-253`, OpenAI
  `:355-391`, claudeService inline schema).
- `formatPerMillion` ×3 with divergent zero-handling (`openrouterService.ts:227`,
  `settingsSlice.ts:437`, `openrouterImageModelAdapter.ts:113`).
- Summary builders diverged: `operations/chapters.ts:54-87` vs `operations/summaries.ts:138-185`.

**Generator:** extraction optimizes file modularity, never assigns a single semantic
owner; each subsequent fix takes the shortest path (nearest copy).

**Response:** one pure owner per concept; characterize both callers before deleting a
duplicate; forbid "copied from X" comments except as deletion TODOs with dates.

### CAP-013 — Derived state without a completeness boundary

**Local shape:** derived stores (summaries, url mappings, manifests) accumulate writers;
when drift appears, the answer is another boot-time repair instead of a single write owner.

**Evidence:** nine repair generations run **every boot** outside the done-gate
(`store/bootstrap/initializeStore.ts:135-218`; comment admits gating would strand users);
chapter summaries have 4+ direct mutators incl. two divergent builders; steering manifest
regenerated only via `prepare` hook → stale-by-design between installs.

**Generator:** each incident patch is locally correct ("add a heal step"); nobody owns
the invariant, so heals become infrastructure.

**Response:** measure whether the projection earns its cost; else one mutation owner +
drift telemetry + stability receipt. Boot repairs need graduation criteria (flag + date),
not open-ended accumulation.

### CAP-011 — Compatibility tail without a deletion trigger

**Evidence:** legacy base64 image dual-read (`imageGenerationService.ts:84-90`) whose
migration tool is console-invocable only (`store/index.ts:26,155-156`); fields kept
"for backwards-compatibility" with no removal condition (`openrouterService.ts:33-37`);
legacy debug keys maintained indefinitely (`AdvancedPanel.tsx:118-127` shim);
"Phase 4 cleanup" shims named but unbound to any issue/date.

**Response:** every tail binds to a measured activation gate or dated issue at
introduction; delete false controls rather than retaining aspirational parameters.

### CAP-008 / CAP-012 — Documentation starts, audits multiply

**Evidence (pre-closure pass):** START_HERE advertised nonexistent ADRs (DB-004/005/006);
HANDOVER listed merged PRs (#109/#110) as unmerged for months; REMEDIATION-ROADMAP stayed
"✅ Active" while targeting deleted `services/indexeddb.ts`. Five major audits in six weeks
(Jul 7–Aug 16) with ≥3 findings re-documented across ≥3 audits each (runSkeletonPass
duplication, claudeService fork, illustration double-billing) — findings fixed in code
while audit docs stayed open. Meta-instance: while writing this very ledger, PR #142
listed an **untracked** roadmap as indexed and Codex caught it.

**Response:** closure transitions are mandatory (status flips require evidence links);
audit docs get retired or receive `Closed:` addenda when their findings land; measure
findings-per-pass and stop passes that add no new failure class.

### CAP-009 — Repository policy ↔ deployed reality fork

**Evidence:** chrome extension popup gates on PING→pong (`popup.js:118-136`) that
`content.js:45-59` never answers — BookToki lane dead since the popup rewrite;
`/sutta/pipeline` route ships against vite-dev-only middleware (404 deployed); docs
promised 21 steering images while manifest ships `[]`.

**Response:** completion = merge + deployment receipts (built output, effective routes);
extension keep-or-delete decision owned explicitly (Tier B pending).

### CAP-001 / CAP-002 / CAP-004 / CAP-005 — script-side accretion

- **Exit-less migrations:** `backfillChapterNumbers.ts` runs once-per-user behind
  `chapterNumbersBackfilled` (boot-wired at `initializeStore.ts:222` — earlier audit claim
  of console-only was corrected) yet nothing measures flag coverage or schedules deletion.
  Zero "delete when…" language exists repo-wide. Best-in-class counter-example:
  `backfill-pronunciation.ts` HALT banner.
- **Shadow subsystems:** benchmark/experiment scripts own private fetch+retry+prompt
  stacks (~7 clients); good counter-examples import canonical services
  (`polyglot-merge.ts:40-43` anti-drift comment).
- **Ambient targets:** `start-lexiconforge.command:10,43` hardcodes personal absolute
  paths; `check:calvino`/`check:pinocchio` invoke a `.venv` that doesn't exist → broken
  as-shipped; `gemini_research.py:30` inherits whatever browser session it finds.
- **Selector drift:** title-regex chapter identity (`backfillChapterNumbers.ts:23-57`)
  vs canonical `stableId`; translator chosen by key-insertion order
  (`polyglot-merge.ts:296-298`); timestamp-dir sort order as run identity.

**Response:** exact targets mandatory; scripts import canonical modules; migrations ship
with completion probes and deletion criteria; identity derives from public contracts.

### CAP-006 / CAP-007 / CAP-037 / CAP-039 — verification & identity debt

- **Exclusive tests as ownership proof:** substantial suite exercises zero-production-caller
  `MaintenanceOps.consolidateBookshelfDuplicates` (unwired bef65dd); vitest thresholds
  targeted three nonexistent files until #141 (false metric); a tripwire test *defends*
  schema duplication DESPRAWL wants collapsed.
- **Guards on dead paths:** `migrateFromLocalStorage` has zero importers yet keeps
  try/catch swallows and no test; double-cleanup guards paper the CORE-012 image leak
  (`imageSlice.ts:365-372,524-548`).
- **Global test target leaks:** fake-indexeddb installed globally, never reset
  (`tests/setup.ts` clears localStorage only); 12/112 beforeEach-files clear stores;
  handcrafted resets must remember emergent fields (`navigation.test.ts:18-31`);
  payload-loop E2E yields vacuous green when fixture missing (`calvino-completeness.spec.ts:43`).
- **Verdicts without subject identity:** positional fallback writes source paragraph i's
  text into base paragraph i (`polyglot-merge.ts:209-215`); one checkpoint verdict stamped
  across a 64-chapter window with hardcoded `confidence: 0.99, evidence: []`
  (`chapter-alignment-discovery.ts:237-248`).

**Rate-limiter instance (fixed):** parked callers could hang forever — `clearLimits()`
dropped queues unsettled, `processQueue` broke silently on missing state, abort was
invisible, and (post-fix review) an abort during the async limits lookup still charged a
slot. All closed in #140 with 8 regression cases.

### PARTIAL briefs

- **CAP-010 silent no-ops:** dead capability helpers exported (`imageModelUtils.ts:16-38`),
  settings documented-but-unread (maxSessionSize removed), tsconfig excluding phantom dirs
  (fixed #141). Most other settings verified wired — better than average.
- **CAP-014 label≠effects:** otherwise disciplined async (AbortController threading,
  streamed imports); residual risk was the limiter (fixed) and deferred
  `no-floating-promises`.
- **CAP-015 islands:** liturgy-generator unreachable from app; `/sutta/pipeline` dev-only;
  benchmark lane genuinely production-wired (negative against strongest form).
- **CAP-017 outcome-class tests:** ~310/3,819 weak asserts concentrated in
  integration/current-system layers; delegation proven by bare `toHaveBeenCalled`
  (`aiService.translateChapter.test.ts:62`); `toBeGreaterThanOrEqual(1)` passes 100×
  over-deletion (`scoped-identity-repair.test.ts:77-79`).

---

## Part II — Repo-native classes (not in origin catalogue)

### LXF-A — Gitignore-as-tombstone-log
`.gitignore` grows as an append-only register of previously-committed artifacts while the
offending blobs stay reachable in pack history (~62 MB session JSON despite its rule; ≥10
Illustration blobs; copyright-flagged `out/`+`data/calvino/`). One rule even fights LFS:
`session-files/*.json` is both ignored and tracked via `.gitattributes`.
**Response:** ignore rules pair with either a history purge receipt or a
"committed-once-is-fine" decision; layers (ignore vs attributes vs LFS) reconciled explicitly.

### LXF-B — Evidence-strata accretion
Verification residue settles in four half-life layers: tracked forensics dossiers
(`issues/01…20/` with committed PNGs/transcripts) → untracked root screenshots named as
provenance (`reader-after-fix.png`, `calvino-fixed.png`) → automation exhaust
(`.playwright-mcp/`, 239 files) → machine output committed under docs/. Naming encodes the
ritual (`-live2`, `-tip2`, `-after-fix`).
**Response:** screenshots live outside git or under one dated `media/evidence/` convention
with expiry; dossiers close like issues.

### LXF-C — Inverted-facade adapter
The adapter layer wraps legacy engines instead of replacing them, laundering the old path
as "architected": `ClaudeAdapter.ts:8` is a 100% pass-through to `claudeService.ts`; seven
files import vendor SDKs directly, bypassing adapters; the copy shipped a real bug
(over-escaped illustration regex — since fixed; audits recorded it open for months).
**Response:** adapter introduction requires engine retirement plan with date; SDK imports
outside adapters/ fail lint.

### LXF-D — Dual-generation vendor SDK drift
Two generations of one vendor's SDK frozen into separate feature domains: text uses
deprecated `@google/generative-ai`, images use new `@google/genai`, **both imported in one
file** (`imageService.ts:2-3`). Per-feature migration cost guarantees it never happens.
**Response:** one SDK generation per vendor at any commit; migration is a tracked
programme, not a side effect of touching a file.

### LXF-E — Lineage-copy shells (per-book vertical forks)
Each book mode forks the whole vertical slice; ancestry is documented in comments
("page shell is the Malayalam studio's… which credits Sutta Studio"); verbatim `ReaderPrefs`
fork malayalam→gita differing only in storage key. Replication reaches build config and
package scripts (per-book checks, dedicated Playwright config).
**Response:** page-shell extraction before book #7; fork unit shrinks from vertical slice
to themed component set.

### LXF-F — Experiment-output-as-docs
~40 generated pipeline JSONs (`docs/sutta-studio/experiments/phase-{x…bf}-*-output.json`),
benchmark apply logs, and probe results occupy the documentation namespace — docs/ doubles
as a results database, blurring where truth lives.
**Response:** outputs belong under a gitignored `runs/` with only curated summaries committed.

### LXF-G — Prompt-homes proliferation
≥6 unrelated homes for prompts plus a V1/V2 pair both live (`suttaStudioPromptContext{,V2}.ts`)
and a name collision (`utils/promptUtils.ts` vs `services/diff/promptUtils.ts`). No owner
concept for "prompt", so every subsystem grew its own.
**Response:** single prompt registry module; version-suffixed twins require a retirement date.

### LXF-H — Generated-but-tracked artifacts
Files regenerated by scripts yet committed guarantee perpetually dirty checkouts
(`public/steering-images.json` modified at audit time; zombie twin generator `.js` diverged
from the `.cjs` actually wired to `prepare` — twin deleted in #141; debug script shipped in
`public/`).
**Response:** generated ⇒ ignored, or generation moves to CI with dirty-check enforcement.

---

## Part III — Clean negatives (what currently protects us)

Recorded so future refactors don't regress them:

- **CAP-038 absent:** provider registration is an explicit array; scraping dispatches via
  explicit domain allowlist with redirect re-validation; capability service labels default
  answers as guesses rather than acting on them.
- **Async discipline:** per-attempt AbortControllers chained through user signals into SDK
  calls; fire-and-forget sites attach catches; session imports stream instead of blocking parse.
- **Book isolation in shared code:** store/chapter components contain zero per-title
  branching (one comment total) — the fork problem lives in shells, not shared logic.
- **Closure culture exists locally:** `issues/README.md` status table + self-documented
  meta-findings; GOLDEN-CONTRACT-REPAIR opens "Status: DONE"; aiService suites were
  re-pointed after deletion rather than left behind.

## Open Tier-B disposition decisions (deletion gates)

1. `consolidateBookshelfDuplicates` + exclusive suite (dead code kept alive by tests)
2. Chrome extension keep-or-delete (pending since 2026-07-28)
3. Legacy base64 dual-read endgame + migration tool trigger
4. liturgy-generator island integrate-or-delete
5. ~19 orphaned scripts (`debug-*`, `gemini_research.py`, …)
6. Legacy `LF_AI_DEBUG*` key retirement after one release

# Handover: 2026-05-13 (long session — DPD root-cause fix + batches 3 & 4 + v2 prompt overlay + strategic-pivot decision pending)

> Session led by Claude Opus 4.7 (1M context). Three branches shipped today, 17 commits across them, all pushed. PR #47 (tooltip plain-first, from prior session) and PR #48 (batch-3 curation, today) are OPEN. Branch `feat/opus-batch4-curation` shipped but has no PR yet. `main` unchanged from prior session.

## Session summary

Started inside batch-3 curation (phases e/f/g/h, the framing closers of MN10's nidāna) and ended having opened batch 4 with the first teaching-content phase. Mid-session, schema tension #1 (DPD stripper conflations) accumulated to four hits and triggered protocol §9.1's Root-Cause Gate — escalated to architecture and replaced the heuristic stem-stripper with DPD's authoritative SQLite Lookup table. Three protocol amendments codified from the session's empirical learnings. Closing discussion converged on a strategic pivot — pipeline-with-v2 + post-passes for the remaining ~40 routine MN10 phases — captured in `docs/sutta-studio/COMPILER_STRATEGY.md` and a ready-to-wire `config/suttaStudioPromptContextV2.ts` overlay, but pivot decision NOT executed.

## Commits this session (17 across 3 branches, all pushed)

### Branch 1: `feat/opus-tooltip-plain-first` (PR #47, OPEN, from prior session — 8 commits)

Hover-only tooltips + plain-first batches a–d + perf cleanup. Detailed in prior handover (now superseded by this doc). Status: OPEN, awaiting review/merge. Independent of branches 2 & 3.

### Branch 2: `feat/opus-batch3-curation` (PR #48, OPEN, 7 commits today)

```
aaa1ff9 feat: DPD root-cause fix — replace heuristic stripper with SQLite Lookup table
d2110c0 feat: apply phase-e re-curation — Tatra kho bhagavā bhikkhū āmantesi
c6b150f docs: protocol §9.1 — Root-Cause Gate amendment
593f0f4 feat: apply phase-f re-curation — Bhikkhavo"ti
a5ab6a0 feat: apply phase-g re-curation — Bhadante"ti te bhikkhū bhagavato paccassosuṁ
7fa4cef feat: apply phase-h re-curation — Bhagavā etad avoca (batch 3 complete)
9830ef1 docs: arrow-earning rule (FEATURES §1.3) + cross-phase facet rule (CURATION_PROTOCOL §3.4.1)
```

Headline: closed schema tension #1 at the root via DPD SQLite Lookup table replacement; completed batch 3 (phases e/f/g/h, the nidāna framing closers); codified 3 protocol amendments.

### Branch 3: `feat/opus-batch4-curation` (no PR yet, branches off branch-2 HEAD — 2 commits)

```
110f1d0 feat: apply phase-1 re-curation — Ekāyano ayaṁ Bhikkhave maggo (batch 4 opens; first teaching content)
2d198f6 feat: v2 prompt context amendments — codify MN10 curation learnings as compiler-prompt overlay
```

Headline: opened batch 4 with the first content-bearing phase (after 8 phases of framing); shipped v2 prompt overlay codifying session learnings, ready to wire into compiler.

## What landed (categorized)

### 1. DPD root-cause fix (key empirical win)

Schema tension #1 (DPD stripper conflations) accumulated 4 hits across batches 2–3 (`evaṁ`→`eva`, `kurūsu`→`kura`, `kurūnaṁ`→`kura`, `bhikkhū`→`bhikkhā`). Per §9.1 Root-Cause Gate (codified mid-session), escalated to architecture.

`scripts/build-dpd.ts` rewritten: heuristic stem-stripper replaced with DPD's authoritative SQLite Lookup table. The Lookup table is dpd-db's curated inflection→headword map — deterministic, not heuristic. 168 MB compressed bz2 download is one-time per dev, gitignored under `data/_raw/dpd/`. `better-sqlite3` dependency added.

Coverage on MN10: 86.9% → 89.5%; 458/478 surfaces resolve via deterministic Lookup; 20 via residual heuristic fallback; 56 genuinely unmatched (quotative-attached forms like `cittan'ti`, long compounds, vocative variants — see Lookup-gap pattern below).

4 explicit regression tests in `services/providers/dpd.test.ts` cover the prior four conflations.

### 2. Batch 3 completed (phases e/f/g/h)

| Phase | Pāli | Anchor | Notable |
|---|---|---|---|
| **phase-e** | Tatra kho bhagavā bhikkhū āmantesi | `āmantesi` | First refrain-explanation facet (bhagavā nom-sg, bhikkhū acc-pl) |
| **phase-f** | Bhikkhavoti | `Bhikkhavo` | Lookup-gap fallback: vocative-pl alt form |
| **phase-g** | Bhadanteti te bhikkhū bhagavato paccassosuṁ | `paccassosuṁ` | Refrain peak: bhikkhū nom-pl + bhagavato gen-sg; 3 arrow-earning denials |
| **phase-h** | Bhagavā etad avoca | `avoca` | Batch 3 closer; aorist + demonstrative; both Lookup-gap fallbacks |

All four logs in `docs/sutta-studio/curation/phase-{e,f,g,h}.md` with §0–§11 sections.

### 3. Batch 4 opens (phase-1, first teaching content)

| Phase | Pāli | Anchor | Notable |
|---|---|---|---|
| **phase-1** | Ekāyano ayaṁ Bhikkhave maggo | `ekāyano` | First teaching content after 8 framing phases; famously-contested word |

Log in `docs/sutta-studio/curation/phase-1.md`. Phase-1 is also where the "pedagogically-critical" tier kicks in per the COMPILER_STRATEGY analysis — hand-curation justified independent of pivot decision.

### 4. Protocol amendments codified

Three amendments, all earned by empirical pattern recurrence this session:

- **CURATION_PROTOCOL §9.1 Root-Cause Gate** (`c6b150f`) — when ≥2 patches accumulate to the same shape, escalate to architectural investigation rather than patching forward. Empirical example: DPD stripper #1 hit count grew to 4; `aaa1ff9` closed the whole class.
- **CURATION_PROTOCOL §3.4.1 Cross-phase facet rule** (`9830ef1`) — when a recurring lemma takes a new form/context, the new phase's tooltip should cross-reference the prior appearance. Conservative default: ≤4 phases back.
- **FEATURES.md §1.3 Arrow-earning rule** (`9830ef1`) — relations earn their arrow when Pāli's case-marker does work English doesn't share. NOT for subject-of-active-verb, direct-object-of-verb, or demonstrative agreement. Resolves schema tension #12 via documentation (not schema change).

### 5. v2 prompt overlay + strategic pivot framing

`config/suttaStudioPromptContextV2.ts` (`2d198f6`) — a ready-to-append-to-compiler-prompts overlay codifying every learning from this session and prior: arrow-earning rule, cross-phase facet rule, refrain-explanation pattern, plain-register §3.4 check, Lookup-gap curatorial fallback, etc. Not yet wired into `services/compiler/prompts.ts`.

`docs/sutta-studio/COMPILER_STRATEGY.md` — strategic-economic analysis of pipeline-vs-curation. Headline: pipeline-with-v2 + 4 deterministic post-passes estimated at ~85% of hand-curated quality, sufficient for ~35–40 routine MN10 phases, with hand-polish reserved for the ~10–15 pedagogically-critical ones (famously-contested words, pattern-establishing phases, doctrinally-loaded passages).

## Schema tensions status

- **#1 DPD stripper conflations** — RESOLVED at root by `aaa1ff9`. 4 regression tests in `services/providers/dpd.test.ts`.
- **#7 EpistemicBasis enum gap** — RESOLVED in prior session (`4323310` from PR #38).
- **#12 RelationType S-V-O palette gap** — RESOLVED via documentation in `9830ef1` (FEATURES §1.3 arrow-earning rule). Hit 3/4 batch-3 phases (e/g/h); ratified as policy rather than schema change.
- **Lookup-gap pattern** (new observation, not yet a numbered tension) — 5 surfaces across batches 3–4 needed curatorial fallback (Bhikkhavo, Bhadante, etad, avoca, Ekāyono). Pattern: augmented aorists, some vocative variants, demonstratives fall outside DPD's Lookup enumeration. Defer action — could be DPD upstream issue OR morphology-generator fallback layer.

## Refrain status (mature)

- **bhikkhu**: 5/9 phases (e acc-pl, f voc-pl alt, g nom-pl + roots in all, 1 voc-pl canonical). Definitively recurring.
- **bhagavā**: 4/9 phases (b nom-sg, e nom-sg, g gen-sg, h nom-sg) across 3 morphological forms. Refrain-explanation facet pattern (first shipped phase-e) is mature.
- **viharati**: 1/9 (phase-c only). Expected to recur in phase-2+ as the satipaṭṭhāna formula's verb.

## Pending threads (next session pickup, priority-ordered)

### Continue immediately (high-context-value)

1. **Wire v2 prompt overlay into `services/compiler/prompts.ts`** (~30 min). Overlay exists at `config/suttaStudioPromptContextV2.ts`; needs to be appended to `buildPhasePrompt` + relevant Anatomist/Lexico contexts behind a feature flag.

2. **Build 4 deterministic post-passes** (~2–3 days total):
   - morph-from-DPD-POS (populate `morph` from POS tags)
   - citation-linker (deterministic `sourceCitationIds` wiring)
   - cross-phase facet detector (scan corpus for recurring lemmas; inject references)
   - §3.4 linter (flag tooltips with bracket jargon / emoji / unglossed terms)

3. **Run pipeline+post-passes on phase-2** (~30 min after #1 + #2). Empirical test of v2 quality vs hand-curated. **This is the natural "decide the pivot" moment** — diff between pipeline-with-v2 output and what hand-curation would produce.

### Worth doing soon

4. **Add `phaseId` to `ApiCallMetric` type + thread through `callCompilerLLM`** (~30 min). Enables per-phase cost attribution. `services/apiMetricsService.ts` already records every API call to IndexedDB with `apiType=sutta_studio`; missing per-phase attribution + UI.

5. **Phase-2 hand-curation** (if pivot is NOT chosen) — ~45–60 min for the satipaṭṭhāna formula opener `kāye kāyānupassī viharati ātāpī sampajāno satimā vineyya loke abhijjhādomanassa…`. Dense; 5–6 famously-contested terms.

6. **Prompt caching for system + bilara block** (~30–60 min Anthropic; ~1 hr Gemini). 50–70% input-cost reduction.

### Larger arcs deferred

7. **Tier-1 commit C — VRI edition + Aṭṭhakathā commentary providers** (originally deferred per ADR SUTTA-008 §Open Questions #4). Buddhaghosa's commentary on the satipaṭṭhāna formula would deepen phase-1+ substantially. Estimated 2–4 hours.

8. **File GitHub issues for remaining schema tensions and observations** (~30 min total) — DPD Lookup-gap pattern, translator-tradition database, prompt caching, cost telemetry next steps.

9. **Phases 2 through 7** (satipaṭṭhāna formula proper) — if hand-curating: ~30–45 min each. Highest pedagogical value of remaining MN10 work.

10. **Phases x/y/z through bg** (33 phases of contemplation sections) — mostly formula recurrence; ~10–15 min each with refrain machinery, OR pipeline+polish per the strategic pivot.

### Deferred (explicit reasons)

- **Refrain-facet backport to phase-b** — small but not urgent; pattern already shipped phase-e onward.
- **Aorist-class chip / structural diagram for compound verbs** — renderer Chunk 3 territory.
- **8 GH issues from earlier backlog** — small but not blocking.

## Key context (non-obvious things the next instance needs)

### Three branches, three different bases

- `feat/opus-tooltip-plain-first` (PR #47) — off main directly.
- `feat/opus-batch3-curation` (PR #48) — off main directly, PARALLEL to #47 (different file regions; independent).
- `feat/opus-batch4-curation` — off `feat/opus-batch3-curation` HEAD (inherits DPD fix + protocol amendments).

Merge order: #47 and #48 are independent. Once both merge to main, `feat/opus-batch4-curation` rebases cleanly onto updated main and shared commits dedupe.

### Worktree convention

`feat/opus-batch3-curation` → `../LexiconForge.worktrees/opus-batch3-curation/`. `feat/opus-batch4-curation` → `../LexiconForge.worktrees/opus-batch4-curation/`. Each has `node_modules` symlinked to the main checkout.

### Bash sandbox quirk

The bash tool's CWD became un-readable from worktree paths this session (EPERM on `uv_cwd`). Workaround: `GIT_DIR=…/.git/worktrees/<branch>` + `GIT_WORK_TREE=…/<worktree>` env vars for git operations from any other CWD. Filesystem reads/writes via Read/Write/Edit work fine in worktrees.

### The strategic pivot is pending decision

Closing discussion converged on: hand-curation has done the hardest work (protocol discovery, exemplar shipping, DPD fix). Continuing per-phase hand-curation for the remaining ~42 MN10 phases has diminishing returns. Better leverage: wire v2 into compiler + build 4 post-passes + run pipeline+polish for the routine ~35–40 phases. User said "yes, pivot" in principle but didn't commit to action. Next session should ratify or reject before doing more curation. **Read `docs/sutta-studio/COMPILER_STRATEGY.md` first if uncertain.**

### The DPD Lookup-gap pattern (curatorial fallback discipline)

When a surface form doesn't resolve via the SQLite Lookup table (augmented aorists, vocative variants, demonstratives), don't patch the Lookup table — fall back to curator-supplied lemma resolution in the phase log. The pattern is real (5 hits this session) but the right layer to fix it is unclear: could be DPD upstream OR a morphology-generator fallback we own. Don't preempt the decision.

### House style for protocol amendments

Each amendment cites the empirical pattern that earned it (e.g., §9.1 cites the 4-hit DPD #1 escalation). No speculative protocol additions; only those ratified by ≥2 empirical hits.

## Running processes

None. Dev server at `http://localhost:5191/sutta/demo` was running during the session (worktree, Vite); needs restart next session. Main repo's dev server (port 5173) untouched.

## Resume instructions

1. **Read this handover.**
2. **`cd ../LexiconForge.worktrees/opus-batch4-curation`** (default for continuing batch-4 work).
3. **Decide the strategic pivot**: continue hand-curation for phase-2 onward, OR wire v2 + build post-passes first. Read `docs/sutta-studio/COMPILER_STRATEGY.md` if uncertain.
4. **Pick from pending threads** based on the pivot decision:
   - Pivot YES: start with wire v2 (#1) → run on phase-2 (#3) → diff against expected hand-curation → decide which post-passes are highest-value.
   - Pivot NO: continue phase-2 hand-curation (#5) following CURATION_PROTOCOL with v2 amendments now codified.
5. **Don't extend the schema speculatively.** All schema tensions resolved or deferred; no open schema gaps blocking curation.

---

*Handover by Claude Opus 4.7 (1M context) at end of session 2026-05-13. Three branches, 17 commits across them, all pushed. PR #47 + #48 open; batch-4 branch shipped but no PR yet. Estimated context usage at handover: ~70% of 1M.*

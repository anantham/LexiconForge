# Issues — Investigation Index

This folder is the working space for investigating items in the top-level [`Issues.md`](../Issues.md). Aditya adds raw observations there; agents build evidence here.

## Rules

- **Don't fix anything in these investigations.** Investigations are read-only on production code. Logging, repro scripts, and tests are fine.
- One folder per issue, numbered to match `Issues.md`.
- Per-issue README follows [`_template/README.md`](./_template/README.md). Sections may be marked `_TBD_` if not yet investigated; the index below tracks which sections are filled.
- Archaeology uses [`../scripts/issue-archaeology.py`](../scripts/issue-archaeology.py) to map suspect files → sessions → agent + prompt + tools.

## Classification: where the failure lives

The dimension that matters isn't "is this a bug?" — it's **where in the spec → code → vision stack the failure lives**, because that determines what kind of fix will actually hold.

### Axis A — Spec state

| Code | Meaning |
|---|---|
| **A1** | ADR + Vision say what should happen, clearly and consistently |
| **A2** | ADR underspecified — names the principle but doesn't commit to behavior. ("Be modular" doesn't say "register once.") |
| **A3** | Spec missing or contradictory — no ADR, or ADR vs CONVENTIONS vs Vision disagree |

Suffix `*` (e.g. `A1*`) = **ADR-rot suspected** — ADR was drafted by an agent, never ratified, may be aspirational rather than authoritative.

### Axis B — Code vs whatever spec exists

| Code | Meaning |
|---|---|
| **B1** | Code matches spec |
| **B2** | Code falls short — spec says streaming, code blocks |
| **B3** | Code overshoots — spec is silent, code added complexity (often Goodharting "looks configurable") |

### Axis C — Vision alignment

| Code | Meaning |
|---|---|
| **C1** | Aligned with [`docs/Vision.md`](../docs/Vision.md) and the IndrasNet philosophy in `../TemporalCoordination/docs/indrasnet/VISION.md` |
| **C2** | Drifted — no doc says it's wrong, but the spirit is gone (e.g. precomputed canonical view where JIT was intended) |
| **C3** | Directly contradicts vision — vision says X with full justification, code does ¬X |

### How to use the matrix

For each issue, the per-issue README's section 4 records `(A?, B?, C?)` plus a one-sentence justification. The fix-direction depends on the cell:

| Cell | What the right fix looks like |
|---|---|
| `(A1, B2, C1)` | Patch the code; spec already says what to do |
| `(A2, B2, *)` | **Write the missing piece of ADR first.** Code follows. Otherwise you're just guessing the user's intent. |
| `(A3, *, *)` | **Write or reconcile the ADR.** Code change without spec is fragile. |
| `(*, *, C2/C3)` | Vision-anchor the decision before any local fix. Otherwise the patch will drift again. |
| `(A1*, B1, C2)` | The ADR itself is the bug. Re-derive from Vision, then update ADR + code. |

## Status

Legend: `R`=Reproduced · `V`=Verdict · `E`=Evidence/code paths · `T`=Test-gap analysis · `A`=Archaeology · `G`=Generator function · `Themes` = cross-cutting layers it instances

| # | Slug | R | V | E | T | A | G | Class | Themes |
|---|---|---|---|---|---|---|---|---|---|
| 1 | [bootup-time](./01-bootup-time/) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | `(A1*, B2, C2)` — **CORE-006 violated** (commits to "render shell immediately, lazy non-critical"; init blocks on import + audio); status drift | [jit-vs-precompute](./_themes/jit-vs-precompute.md), [completion-only-guards](./_themes/completion-only-guards.md), [silent-failure-deep](./_themes/silent-failure-deep.md), [co-mingled-commits](./_themes/co-mingled-commits.md) |
| 2 | [fan-toggle-restarts-translation](./02-fan-toggle-restarts-translation/) | — | ◐ | ✓ | ✓ | ◐ | ✓ | **paused on user repro** · `(A1, B1, C2)` for in-flight axis · `(A3, B3, C2)` for settings-fingerprint axis · matrix prediction partially **falsified** | ~~completion-only-guards~~ (defended), [jit-vs-precompute](./_themes/jit-vs-precompute.md) (settings-as-identity) |
| 3 | [metadata-empty-and-glossary](./03-metadata-empty-and-glossary/) | ✓ | ✓ | ✓ | ✓ | · | ✓ | `(A3, B2, C2)` — **compound: 5 anomalies** (virtual+imported dup, Hangul cross-contamination ch478-509, untranslated Korean placeholders, "Chapter N" placeholder, no glossary UI). 2 escalations pending. | [jit-vs-precompute](./_themes/jit-vs-precompute.md), candidate: `catalog-cross-contamination` |
| 4 | [portal-no-feedback](./04-portal-no-feedback/) | ✓ | ✓ | ✓ | ✓ | — | ✓ | **FIXED 2026-05-04** · 9 regression tests · pre-fix: 5 fail · pending manual validation in dev server | [silent-feedback-gaps](./_themes/silent-feedback-gaps.md) |
| 5 | [illustration-no-feedback](./05-illustration-no-feedback/) | ✓ | ✓ | ✓ | ✓ | — | ✓ | **FIXED 2026-05-04** · twin of #4 (skip-and-reference per skill v0.2) · 2 new regression tests | [silent-feedback-gaps](./_themes/silent-feedback-gaps.md) |
| 6 | [image-models-dynamic-and-tested](./06-image-models-dynamic-and-tested/) | ✓ | ✓ | ✓ | ✓ | · | ✓ | `(A1/A2 split, B2, C2)` — **OpenRouter dynamic ✓**, Gemini/Imagen/PiAPI static + date-stamped preview IDs, PiAPI misfiled under "Gemini" key. Action: re-key + draft ADR-010 (liveness). | [jit-vs-precompute](./_themes/jit-vs-precompute.md), candidate: `unverified-external-resource` |
| 7 | [provider-registration-inefficiency](./07-provider-registration-inefficiency/) | ✓ | ✓ | ✓ | ✓ | · | ✓ | `(A2, B1, C1)` — **confusion / superseded by #1.** Cold-boot trace shows `[Providers] All providers registered:` fires **0×**; module-level singleton verified. User's "again and again" was the StrictMode double-init that #1 owns. | NOT [completion-only-guards](./_themes/completion-only-guards.md) at this layer |
| 8 | [wasted-logs-audit](./08-wasted-logs-audit/) | ✓ | ✓ | ✓ | ✓ | · | ✓ | `(A3, B3, C2)` — **158 console lines in 1.5s cold boot**. Single-line offender: `initializeStore.ts:30 logStep` = 82/158 (52%) of trace. Action: draft ADR-009 (logging policy). | _propose:_ `logging-policy-missing` |
| 9 | [chapter-change-perf-logging](./09-chapter-change-perf-logging/) | ✓ | ✓ | ✓ | ✓ | · | ✓ | `(A1*, B2, C2)` — **CORE-006 SLO violated: 574ms visible transition (>500ms)**, plus serial URL→stableId fallback wastes ~330ms. Action: enforce_existing_ADR + Promise.any race. | [jit-vs-precompute](./_themes/jit-vs-precompute.md), [completion-only-guards](./_themes/completion-only-guards.md) |
| 10 | [library-to-home-icon](./10-library-to-home-icon/) | · | · | · | · | · | · | `(A3, B1, —)` _provisional_ — preference, not bug | — |
| 11 | [comparison-panel-follows-chapter](./11-comparison-panel-follows-chapter/) | — | ✓ | ✓ | ✓ | ✓ | ✓ | **already fixed in `0c5162b`** · `(A3, B1, C1)` post-fix · test gap remains | [jit-vs-precompute](./_themes/jit-vs-precompute.md) |
| 12 | [background-preload-spinner-restart](./12-background-preload-spinner-restart/) | ◐ | ✓ | ✓ | ✓ | ✓ | ✓ | **FIXED 2026-05-05 via #19's `72a2a80572`** — cancellation block at `chaptersSlice.ts:170-199` removed; shared regression test at `tests/store/slices/setCurrentChapter-survives-nav.test.ts`. README staleness caught by 2026-05-15 archaeology pass. | [jit-vs-precompute](./_themes/jit-vs-precompute.md), `nav-cancels-bg-work` (ratified N=2 via #12+#19) |
| 13 | [eta-not-model-specific](./13-eta-not-model-specific/) | ◐ | ✓ | ✓ | ✓ | · | ✓ | `(A3, B3, C2)` — **system IS model-aware** at `apiMetricsService.ts:457`, but 2-sample threshold + mean (not median) hurts fresh state. 4-part fix_local (~2 hr). | [jit-vs-precompute](./_themes/jit-vs-precompute.md) |
| 14 | [retry-spinner-not-clickable](./14-retry-spinner-not-clickable/) | ✓ | ✓ | ✓ | ✓ | — | ✓ | **FIXED 2026-05-04** · same-theme-different-fix-shape · 4 new regression tests · brings silent-feedback-gaps to N=3 fixed | [silent-feedback-gaps](./_themes/silent-feedback-gaps.md) |
| 15 | [comparison-cycle-modes](./15-comparison-cycle-modes/) | ◐ | ✓ | ✓ | ✓ | · | ✓ | `(A3, B3, C3)` — boolean `showRawComparison` (2 modes only) + "Selected: ..." duplication confirmed. Action: fix_local 3-part; 9.3 (Google Translate) blocked on user provider strategy. | [jit-vs-precompute](./_themes/jit-vs-precompute.md) |
| 16 | [version-switch-comments-vanish](./16-version-switch-comments-vanish/) | · | ◐ | ✓ | ◐ | · | ✓ | **triaged — needs §2 live repro**. Static analysis revealed bug-shape is not the simple `useEffect`-on-active-id I'd assumed. Probably interacts with #17/#18 | [jit-vs-precompute](./_themes/jit-vs-precompute.md) |
| 17 | [feedback-not-loaded-from-idb](./17-feedback-not-loaded-from-idb/) | ✓ | ✓ | ✓ | ✓ | · | ✓ | **FIXED 2026-05-04** · 3 regression tests · pre-fix: 2 fail | (none) |
| 18 | [submit-feedback-not-persisted](./18-submit-feedback-not-persisted/) | ✓ | ✓ | ✓ | ✓ | · | ✓ | **FIXED 2026-05-04** · 4 regression tests · pre-fix: 3 fail | candidate: [co-mingled-commits](./_themes/co-mingled-commits.md) |
| 19 | [translation-survives-nav-policy](./19-translation-survives-nav-policy/) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | **FIXED 2026-05-05 in `72a2a80572`** — CORE-012 ratified in `5f170b0`. Cancellation block at `chaptersSlice.ts:170-199` removed; 4 regression tests at `tests/store/slices/setCurrentChapter-survives-nav.test.ts`. README left in stale `investigated` state for 10 days; archaeology audit caught it 2026-05-15. | `nav-cancels-bg-work` (ratified N=2 via this + #12) |
| 20 | [chapter-number-drift-from-history-walker](./20-chapter-number-drift-from-history-walker/) | ◐ | ✓ | ✓ | ✓ | ✓ | ✓ | **FIXED 2026-05-10 in `bef65dd534`** — `services/translationService.ts:858-876` bug-introducing write removed (now gated on `chapterNumber == null`); `correctChapterNumberDriftV5` repair migration at `services/db/operations/maintenance.ts:2640+` runs once per user. README labeled `root-caused` but fix landed same day; archaeology audit caught it 2026-05-15. | candidate: `stale-issue-readme` |

`·` = not yet done · `✓` = done · `◐` = partial · `—` = not applicable · `?` = blocked / open question

`_provisional_` on the Class column means it was assigned at the index level without a full per-issue investigation; the per-issue README is the authoritative coordinate once it's filled in.

## Themes — cross-cutting failure classes

When two issues share a generator, both cite the same theme rather than re-litigating. New themes can be proposed in any issue's section 8.

| Theme | Instances | Spec coverage (post-audit) |
|---|---|---|
| [jit-vs-precompute](./_themes/jit-vs-precompute.md) | **1, 2, 3, 6, 9, 11, 12, 13, 15, 16** (N=10 confirmed; #20 indirectly) | **Partial.** CORE-006 commits to "render shell immediately + lazy-load non-critical" (boot scope). FEAT-001 commits to "ensure *a* translation is available, prevent waiting" (preload scope). FEAT-003 commits to dynamic OpenRouter model list. **Missing:** generalized "derived views are recomputed, not stored" principle covering comparison/version/ETA/glossary cases. **Dominant theme — present in 50%+ of issues.** |
| [completion-only-guards](./_themes/completion-only-guards.md) | **1, 9** (~~2 refuted 2026-05-02~~ · ~~7 NOT-an-instance per 2026-05-15 investigation~~) | **Partial.** DB-002 has full "Idempotency & Retry Strategy" at data-op layer. Issue #7 was reclassified to non-instance after live trace showed module-level singleton works; the StrictMode double-init that #7 was filed against actually belongs to #1's domain. **Missing:** equivalent at the call-site / init / register layer — no "single-flight" wrapper, no ADR commits to "ensureX is run-at-most-once under concurrent callers" |
| [silent-feedback-gaps](./_themes/silent-feedback-gaps.md) | 4, 5, 14 | **None.** No UX-feedback ADR or convention. CORE-006 mentions "loading states for async features" in passing but doesn't commit to user-action signal SLA. Theme retired — all instances fixed 2026-05-04. |
| [silent-failure-deep](./_themes/silent-failure-deep.md) | 1 (so far — likely 2, 16) | **None.** CORE-007 (fetch-transport, *Proposed*) covers proxy boundaries but not request-boundary validation. DB-002 has "check inside transaction to prevent races" but that's the post-acceptance shape, not the pre-acceptance shape |
| [co-mingled-commits](./_themes/co-mingled-commits.md) | 1 | **None.** No policy in CONTRIBUTING.md against bundling control-flow changes with cleanups |
| [nav-cancels-bg-work](./_themes/nav-cancels-bg-work.md) | **12, 19** (ratified N=2 on 2026-05-15) | **None.** No ADR governs "speculative work survives navigation." `chaptersSlice.ts:170-199` actively cancels in-flight requests on any nav. Worth its own ADR. |
| `logging-policy-missing` _(proposed)_ | **8** + indirect: 9 (runtime), 7 (façade) | **None.** No logging-level discipline. Cold boot fires 158 lines in 1.5s. ADR-009 sketched in issue #8 §9. |
| `unverified-external-resource` _(proposed)_ | **6** + indirect: pricing, translation models | **None.** Provider catalogues treated as static config; no liveness probe SLA. ADR-010 sketched in issue #6 §9. |
| `catalog-cross-contamination` _(proposed)_ | **3** (Hangul-in-Dungeon-Defense ch478-509) | **None.** No invariant test that a novel's catalog contains only that novel's chapters. Single instance so far; could expand if upstream registry is polluted. |

### What the audit changed about earlier classifications

- **#1 (boot)** upgraded from `(A2, B2, C2)` to `(A1*, B2, C2)` — CORE-006 isn't aspirational, it's marked Implemented but the code drifted. **ADR-vs-code drift, not under-specification.** The asterisk is a flag that the ADR's `Implemented` claim itself needs verification.
- **#9 (chapter perf)** upgraded similarly — CORE-006's `featureLoading: '< 500ms from trigger'` is a real SLO commitment.
- **#12 (preload spinner)** upgraded from C2 to C1 — the ADR (FEAT-001) IS the vision-aligned principle; the *code* failed to honor it. The vision isn't drifting; the implementation is.
- **#6 (image models)** is a **split classification**: A1 for OpenRouter (FEAT-003 says dynamic; static would violate), A2 for Imagen/Gemini/PiAPI (FEAT-003 keeps `config/costs.ts` static).
- Several A2s downgraded to A3 (#3, #11, #13, #15) once it became clear no ADR speaks to the area at all — they need new spec, not amendments.

### Implication for next steps

The matrix now suggests two distinct kinds of leverage:
1. **Ratify-and-enforce** (#1, #6, #9, #12): the spec already says the right thing, the code is the bug. Tests + refactor.
2. **Write missing spec** (#2, #4, #5, #7, #11, #13, #14, #15, #16, plus #8): no ADR exists. Drafting comes first, then code.

So `CORE-008-derived-views-recomputed-not-stored` is still worth drafting (covers most of category 2's JIT items), but the boot-time fix doesn't need it — CORE-006 already commits.

## Tier ordering (2026-05-15 — post-Playwright-investigation sweep + archaeology audit)

> **Full verbatim RCA with JSONL conversation quotes:** [`docs/postmortem/2026-05-15-issue-rca-with-jsonl-quotes.md`](../docs/postmortem/2026-05-15-issue-rca-with-jsonl-quotes.md) — quotes the actual user prompts and assistant responses that produced the #19 + #20 fixes (and the README staleness around them). The pre-archive bugs (#3 anomaly B, #6, #7, #9, #13, #15) are cited via commit message only — their bug-introducing conversations predate the JSONL archive.


After full §2-§9 investigation of 8 remaining issues (#3, #6, #7, #8, #9, #12, #13, #15) AND a deep git-blame + JSONL archaeology pass, the universe of 20 issues collapses to a clear fix-direction order. **The archaeology revealed that #19, #20, and #12 are already FIXED on main — but their READMEs were stale by 10 days, causing the initial Tier 1 to mis-classify them as pending.** This is a meta-finding worth recording (see "Deeper generator: stale-issue-readme" below).

Tiers run sequentially; within a tier, work is parallelizable across agents.

### Tier 1 — Foundation (~2-4 hr — was 10+ hr before archaeology corrected the picture)

| Order | Issue | Effort | Why first | Confidence |
|---|---|---|---|---|
| 1 | **[#1](./01-bootup-time/)** bootup-time / single-flight init | 2-4 hr | `enforce_existing_ADR` (CORE-006). Reduces #8's wasted-logs trace mechanically (~50%). Eliminates #7's symptom. Reduces #9's noise. **Only remaining Tier 1 item.** | 0.9 |

Items previously in Tier 1, now removed because already FIXED:
- ~~#20 chapter-number-drift~~ — FIXED 2026-05-10 in `bef65dd534`
- ~~#19 nav-cancels-bg-work~~ — FIXED 2026-05-05 in `72a2a80572` (CORE-012 ratified)
- ~~#12 background-preload-spinner~~ — FIXED via #19's same commit

### Tier 2 — Quick wins (~5 hr; parallelizable)

| # | Effort | Synergy |
|---|---|---|
| **[#9](./09-chapter-change-perf-logging/)** chapter-change-perf | 1-2 hr | Post-#1: race the URL/stableId lookups (Promise.any). Closes the 574ms → <500ms gap with margin. |
| **[#13](./13-eta-not-model-specific/)** ETA polish | 2 hr | Independent. 4-part: mean→median, threshold 2→1, source indicator in compact timer, "Estimating…" mode. |
| **[#10](./10-library-to-home-icon/)** library-to-home icon | <30 min | Cosmetic preference. |

### Tier 3 — Policy + escalation-gated (ADR ratification + user input first)

| # | Gate | Once unblocked |
|---|---|---|
| **[#3](./03-metadata-empty-and-glossary/)** Hangul cross-contamination | "Did you import a Necromancer School session JSON, or is registry polluted?" | varies (data repair vs registry validation) |
| **[#3](./03-metadata-empty-and-glossary/)** glossary UI | "Was a reader-side glossary panel ever in scope, or translator-time only?" | 1 day build vs documentation |
| **[#15](./15-comparison-cycle-modes/)** comparison cycle | "Google Translate: free unofficial, paid Cloud API, or browser iframe?" | 6-8 hr after answer |
| **[#8](./08-wasted-logs-audit/)** ADR-009 logging | Sketch in #8 §9 — ratify or modify | 4-6 hr enforcement |
| **[#6](./06-image-models-dynamic-and-tested/)** ADR-010 liveness | Sketch in #6 §9 — ratify or modify | 4-6 hr + cron infra |

### Tier 4 — Paused on user repro

- **[#2](./02-fan-toggle-restarts-translation/)** fan-toggle-restarts-translation
- **[#16](./16-version-switch-comments-vanish/)** version-switch-comments-vanish

### Closes by subsume (no independent work needed)

- **[#7](./07-provider-registration-inefficiency/)** — confusion, subsumed by #1

### Already FIXED (verified against current code 2026-05-15)

- **#4, #5, #11, #14, #17, #18** — FIXED 2026-05-04 (READMEs accurately reflect status)
- **#12** — FIXED 2026-05-05 via #19's `72a2a80572` (README staleness caught by audit)
- **#19** — FIXED 2026-05-05 in `72a2a80572`, CORE-012 ratified in `5f170b0` (README staleness caught by audit)
- **#20** — FIXED 2026-05-10 in `bef65dd534`, V5 migration shipped (README staleness caught by audit)

### Deeper generator (meta-finding from 2026-05-15 archaeology pass)

**`stale-issue-readme`** — Issue READMEs in `issues/NN-slug/` do not get auto-updated when fixes ship. Three of the most-load-bearing issues (#19, #20, #12) shipped on main between 2026-05-05 and 2026-05-10 but their READMEs continued to assert pre-fix state through 2026-05-15.

This had a real cost in this very session: the agent (Claude Opus 4.7) trusted READMEs as truth, recommended Tier 1 work that's already done, and proposed live-Playwright verification of bugs that are no longer reproducible. The user approved "ship #20 next" based on this stale-data recommendation.

**Why it happens:** the sessions that ship fixes (e.g., `830d8ff9-c9da-4e63-ac33-3ab1d5ada9ea`, which shipped both `bef65dd534` and `5f170b0`) are multi-feature, long-horizon, and focus on code, not bookkeeping. The single-issue sessions DO update READMEs (#4, #5, #14, #17, #18 from 2026-05-04 are correctly marked FIXED). The multi-feature sessions don't.

**Three fix-shapes:**
1. **Pre-recommendation verification** (cheapest): before recommending fix work for an issue, agent must `git log -L <line>:<file>` the suspect code path and confirm the bug-introducing pattern still exists. Already required by CLAUDE.md's "Verify before recommending from memory" — extend to issue READMEs as a class of memory.
2. **Fix-commit closes README** (medium): convention that fix commits include a one-liner update to the issue README's status block. Could be enforced by a CI hook or a pre-commit script that grep's `fix(...): issue #N` style commits.
3. **Periodic audit** (heavy): a script `scripts/issue-staleness-audit.py` that runs `git log -L` for each "real-bug" issue's §5 suspect lines, flags any that have a `fix(...)` commit touching them after the README's last-updated date.

Fix-shape 1 is the cheapest and applies to every agent (not just author of fix commit) — recommended.

### Strategic observation

`jit-vs-precompute` at **10/20 issues** (50%) is the load-bearing signal. CORE-006 commits to JIT semantics but the codebase has 10 confirmed instances of derived-view-as-stored-data. Two paths:

- **Patch each site as you encounter it** (Tiers 1-3 above) — fixes ship faster, theme stays implicit.
- **Draft `CORE-008-derived-views-recomputed-not-stored` ADR + introduce `recomputableView<T>()` primitive**, then mechanically apply — ~4 hr upfront, then each Tier 2/3 fix becomes a 1-line application of the primitive.

The template's `fix_generator` rule fires at N≥2 with shared primitive. We have N=10. The case for the primitive-first sprint is strong, but `Bulldozer` risk (rewriting more than needed) is real. Recommend `enforce_existing_ADR` on CORE-006 first (Tier 1), see whether the pattern emerges naturally, then decide on CORE-008 ratification.

## Workflow

1. New observation → Aditya appends to `Issues.md`.
2. Agent creates `issues/NN-slug/` folder, copies the verbatim claim into `README.md`, sets `Status: not-investigated`, assigns a *provisional* `(A?, B?, C?)` in the index.
3. Agent reproduces (Playwright at `localhost:5180`), reads relevant code, identifies test gap, runs archaeology.
4. **Agent assigns a verdict** (real-bug / already-fixed / cannot-reproduce / confusion / preference / paused-on-repro / **needs-human-clarification** / underspecified-claim).
5. **Agent finalizes `(A?, B?, C?)`** in section 4 of the per-issue README, links to themes under [`_themes/`](./_themes/), and **picks one Action** (§9 of the template).
6. **Agent names regression-test obligations** in §6 — specific tests that must pass before close.
7. Agent suggests fix directions but does not implement.
8. Aditya reviews. Final `Status:` is set; if action is `escalate_to_human`, Aditya answers the question; if `fixed`, the closing gate (§9a) confirms tests are in.

## State machine

```
not-investigated  → triaged  → investigated → fixed
                                            → wontfix
                                            → superseded
                                  ↘ if escalate_to_human → blocked-on-aditya → ratified-direction → investigated
                                  ↘ if paused-on-repro    → blocked-on-user-input → investigated
                  ↘ if already-fixed / cannot-reproduce / confusion / preference / underspecified-claim → done (no §4-9)
```

Lightweight verdicts (`already-fixed`, `cannot-reproduce`, `confusion`, `preference`, `underspecified-claim`) close at §3 — no need to fill out the rest of the template. Heavy verdicts (`real-bug`) unlock §4-§9. **No issue closes as `fixed` without §9a's gate satisfied.**

## The Action decision tree (when verdict = real-bug)

After investigation, exactly one of these is the next move:

| Action | When | Cost |
|---|---|---|
| `fix_local` | N=1 instance, no shared generator with other issues, contained scope | low |
| `fix_generator` | Theme N≥2, shared primitive applies to all sites | medium (need primitive + audit) |
| `enforce_existing_ADR` | Classification is `A1*` (existing ADR drifted from). Add failing test, fix code | low — *cheaper than drafting* |
| `draft_new_ADR` | `A3` + blast radius large, OR theme N≥3 + design rule emerging | high |
| `escalate_to_human` | Spec is genuinely ambiguous, ADRs disagree, or fix-direction depends on user intent that isn't documented | low (but blocks until answered) |
| `wait` | Need user repro, more data, or external dependency | none |

Three rules, in order:
1. Prefer `enforce_existing_ADR` over `draft_new_ADR` whenever an existing ADR plausibly covers the case. Drafting is the more expensive path.
2. **ADRs are not sacred.** If two ADRs disagree or an ADR's spirit feels confused, escalate. Don't pick a side.
3. **Fixed = test in.** No issue closes as `fixed` without a regression test that would have failed against the bug.

## What the matrix changed about earlier categorizations

The previous "Audit tasks (6, 7, 8, 9)" label was wrong — it conflated "needs investigation across many sites" with "isn't a real issue." Issues #6, #7, #9 are the same shape as #1, just at different layers (image models / provider registration / chapter-change). Issue #8 is a missing-policy issue (A3, B3) — not a sweep, but a real spec-gap.

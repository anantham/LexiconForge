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
| 3 | [metadata-empty-and-glossary](./03-metadata-empty-and-glossary/) | · | · | · | · | · | · | `(A3, B2, C2)` _provisional_ — no ADR governs glossary loading lifecycle | [jit-vs-precompute](./_themes/jit-vs-precompute.md) |
| 4 | [portal-no-feedback](./04-portal-no-feedback/) | · | · | · | · | · | · | `(A3, B2, C2)` _provisional_ — no UX-feedback ADR exists | [silent-feedback-gaps](./_themes/silent-feedback-gaps.md) |
| 5 | [illustration-no-feedback](./05-illustration-no-feedback/) | · | · | · | · | · | · | `(A3, B2, C2)` _provisional_ — same gap as #4 | [silent-feedback-gaps](./_themes/silent-feedback-gaps.md) |
| 6 | [image-models-dynamic-and-tested](./06-image-models-dynamic-and-tested/) | · | · | · | · | · | · | `(A1/A2 split, B2, C2)` _provisional_ — **FEAT-003 explicitly says OpenRouter is dynamic** ("replacing the earlier stale static list approach"). Static for OpenRouter = ADR violation; static for non-OpenRouter = under-specified | [jit-vs-precompute](./_themes/jit-vs-precompute.md) |
| 7 | [provider-registration-inefficiency](./07-provider-registration-inefficiency/) | · | · | · | · | · | · | `(A2, B2, C1)` _provisional_ — DB-002 idempotency precedent at data layer; no equivalent at registration | [completion-only-guards](./_themes/completion-only-guards.md) |
| 8 | [wasted-logs-audit](./08-wasted-logs-audit/) | · | · | · | · | · | · | `(A3, B3, C2)` _provisional_ — no logging policy in any ADR or CONVENTIONS | _propose:_ logging-policy-missing |
| 9 | [chapter-change-perf-logging](./09-chapter-change-perf-logging/) | · | · | · | · | · | · | `(A1*, B2, C2)` _provisional_ — **CORE-006 commits to <500ms feature-loading SLO**; chapter change exceeds | [jit-vs-precompute](./_themes/jit-vs-precompute.md), [completion-only-guards](./_themes/completion-only-guards.md) |
| 10 | [library-to-home-icon](./10-library-to-home-icon/) | · | · | · | · | · | · | `(A3, B1, —)` _provisional_ — preference, not bug | — |
| 11 | [comparison-panel-follows-chapter](./11-comparison-panel-follows-chapter/) | — | ✓ | ✓ | ✓ | ✓ | ✓ | **already fixed in `0c5162b`** · `(A3, B1, C1)` post-fix · test gap remains | [jit-vs-precompute](./_themes/jit-vs-precompute.md) |
| 12 | [background-preload-spinner-restart](./12-background-preload-spinner-restart/) | · | · | · | · | · | · | `(A1*, B2, C1)` _provisional_ — **FEAT-001 violated**: ADR commits to "ensure *a* translation is available, prevent waiting", spinner restart violates this. C1 because FEAT-001 IS the JIT-aligned ADR | [jit-vs-precompute](./_themes/jit-vs-precompute.md), [completion-only-guards](./_themes/completion-only-guards.md) |
| 13 | [eta-not-model-specific](./13-eta-not-model-specific/) | · | · | · | · | · | · | `(A3, B3, C2)` _provisional_ — no ADR on ETA reporting | [jit-vs-precompute](./_themes/jit-vs-precompute.md) |
| 14 | [retry-spinner-not-clickable](./14-retry-spinner-not-clickable/) | · | · | · | · | · | · | `(A3, B2, C2)` _provisional_ | [silent-feedback-gaps](./_themes/silent-feedback-gaps.md) |
| 15 | [comparison-cycle-modes](./15-comparison-cycle-modes/) | · | · | · | · | · | · | `(A3, B3, C3)` _provisional_ — explicit vision contradiction | [jit-vs-precompute](./_themes/jit-vs-precompute.md) |
| 16 | [version-switch-comments-vanish](./16-version-switch-comments-vanish/) | · | ◐ | ◐ | ✓ | · | ✓ | `(A2, B2, C1)` triaged — **HIGH PRIORITY**: load-bearing override for auto-active. UI re-render fix at chapter-translation switch | [jit-vs-precompute](./_themes/jit-vs-precompute.md) |

`·` = not yet done · `✓` = done · `◐` = partial · `—` = not applicable · `?` = blocked / open question

`_provisional_` on the Class column means it was assigned at the index level without a full per-issue investigation; the per-issue README is the authoritative coordinate once it's filled in.

## Themes — cross-cutting failure classes

When two issues share a generator, both cite the same theme rather than re-litigating. New themes can be proposed in any issue's section 8.

| Theme | Instances | Spec coverage (post-audit) |
|---|---|---|
| [jit-vs-precompute](./_themes/jit-vs-precompute.md) | 1, 2, 3, 6, 9, 11, 12, 13, 15, 16 | **Partial.** CORE-006 commits to "render shell immediately + lazy-load non-critical" (boot scope). FEAT-001 commits to "ensure *a* translation is available, prevent waiting" (preload scope). FEAT-003 commits to dynamic OpenRouter model list. **Missing:** generalized "derived views are recomputed, not stored" principle covering comparison/version/ETA/glossary cases |
| [completion-only-guards](./_themes/completion-only-guards.md) | 1, 7, 9, 12 (~~2 refuted 2026-05-02~~) | **Partial.** DB-002 has full "Idempotency & Retry Strategy" at data-op layer (`generateTranslationIdempotent`, idempotency keys, race-protection inside transactions). **Missing:** equivalent at the call-site / init / register layer — no "single-flight" wrapper, no ADR commits to "ensureX is run-at-most-once under concurrent callers" |
| [silent-feedback-gaps](./_themes/silent-feedback-gaps.md) | 4, 5, 14 | **None.** No UX-feedback ADR or convention. CORE-006 mentions "loading states for async features" in passing but doesn't commit to user-action signal SLA |
| [silent-failure-deep](./_themes/silent-failure-deep.md) | 1 (so far — likely 2, 16) | **None.** CORE-007 (fetch-transport, *Proposed*) covers proxy boundaries but not request-boundary validation. DB-002 has "check inside transaction to prevent races" but that's the post-acceptance shape, not the pre-acceptance shape |
| [co-mingled-commits](./_themes/co-mingled-commits.md) | 1 | **None.** No policy in CONTRIBUTING.md against bundling control-flow changes with cleanups |

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

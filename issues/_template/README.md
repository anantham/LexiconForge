# Issue NN — short title

> Status: investigating · Last updated: YYYY-MM-DD · Investigator: <agent>

## 1. Claim (verbatim from Issues.md)

> _Paste the user's exact text from `Issues.md`, unedited. Quote it so it is unmistakable that this section is not the agent's analysis._

**Calibration rule:** **re-read this section after every architectural decision.** The verbatim claim often already encodes the user's mental model precisely; agents (and humans) gloss it under interpretation pressure and end up debating things the user already decided. If your fix-direction implies a different mental model than the verbatim claim does, you've drifted — fix the drift, don't rationalize past it. (See issue #16 for a worked example: the verbatim "comments tied to that version" was correct; the agent twice tried to "decouple from version" against the claim.)

**Code-first rule:** when investigating, **read the code yourself instead of asking the user "does the system already do X?"** The user's CLAUDE.md anti-pattern "Yes-Bot" exists in the inverse direction too — never let the user become your search engine.

## 2. Reproduction

**Goal:** can I make this happen on demand?

- Environment: dev server at `http://localhost:5180`, fresh IndexedDB unless noted.
- Steps:
  1. ...
  2. ...
- Observed result: ...
- Expected result: ...
- Repro artifacts: `traces/<file>` (screenshots, console dumps, perf traces).
- Verdict: `reproduced` / `partial` / `cannot-reproduce` / `not-applicable`.

If a Playwright script was used, store it under `traces/repro.spec.ts` (or similar) and link it.

### HARD RULE — added 2026-05-04 after a calibration miss on issue #16

**§2 must NOT be marked `_TBD_` when the issue's status moves to `ready-for-fix`.** Static analysis can support a verdict of `real-bug` provisionally, but **fix-shape claims** (especially regression-test obligations in §6) presuppose a concrete observed symptom. Without §2's live evidence, an agent (or the same agent later) is liable to fix the wrong layer of code that *looks like* it could produce the symptom but doesn't actually.

State-machine invariant: `triaged → ready-for-fix` requires §2.observed_result populated. If §2 is genuinely not reproducible (verdict `cannot-reproduce`), that's a different terminal state — the issue doesn't transition to `ready-for-fix` at all.

The only exception: an `already-fixed` verdict can skip §2 if the fix-commit is identified and its diff plus the user's verbatim claim make the symptom self-evident (issue #11's case).

## 3. Verdict

One of:
- **Real bug** — symptom matches claim, code path explains it. Section 4 onward fills in.
- **Already-fixed** — a recent commit addresses the claim. Cite the commit; investigation can stop at §7 (archaeology) for context. Note any test gap.
- **Cannot reproduce** — symptom does not occur with these steps. Document what was tried; close with `wait_for_repro` if the user can supply more steps.
- **Confusion** — the behavior is by design or already fixed; the user's mental model is the gap. Investigation usually stops at §5 (evidence) explaining the design intent.
- **Preference** — not a bug; user wants different behavior (e.g. icon choice). Stops at §3.
- **Paused-on-repro** — investigation needs user input to continue (specific click sequence, particular state).
- **Needs-human-clarification** — the spec is contradictory, the ADR's spirit is unclear, or two reasonable interpretations imply different fixes. **DO NOT pick one and proceed.** Section 8 (Action) names the disagreement and the question for Aditya. Don't draft new ADRs over genuine ambiguity — escalate.
- **Underspecified-claim** — the claim itself isn't precise enough to investigate. Ask the user to clarify what they observed.

State **confidence (0.0–1.0)** and **why**. If &lt; 0.7, list what would raise confidence.

### When to escalate to human (don't auto-fix)

ADRs are not sacred. If you find that:
- The ADR's stated principle conflicts with another ADR or with `Vision.md`,
- The ADR's example code disagrees with its prose,
- The fix-direction depends on user intent that isn't documented anywhere (e.g. "is X raw or derived?"), or
- Two reasonable interpretations of the same paragraph imply contradictory implementations,

then the verdict is **needs-human-clarification**, not "follow the ADR" and not "draft a new ADR." Surface the disagreement, sketch each plausible interpretation, name what concrete user input would unblock. The user's CLAUDE.md says exactly this: *"Surface Contradictions Proactively. When reading docs, code, or discussing designs — notice tensions, surface immediately, propose meta-amendments, invite dialogue."*

## 4. Where the failure lives  (A / B / C)

A coordinate in the spec → code → vision stack. See [`issues/README.md`](../README.md#classification-where-the-failure-lives) for the full scheme.

- **A — Spec state**: A1 = ADR clear & consistent · A2 = ADR underspecified (principle without behavior) · A3 = ADR missing or contradictory
- **B — Code vs spec**: B1 = matches · B2 = falls short · B3 = overshoots / unspecified extras
- **C — Vision alignment**: C1 = aligned with `Vision.md` & IndrasNet philosophy · C2 = drifted (no doc says it's wrong, but the spirit is gone) · C3 = directly contradicts vision

Format: `(A?, B?, C?)` plus a one-sentence justification. If the ADR itself looks aspirational (drafted by an agent, never ratified), tag `A1*` or `A2*` — the asterisk flags **ADR-rot suspected**.

Example: `(A2, B2, C2)` — "FEAT-003 says image models are dynamic in spirit but never commits to live verification; code froze a snapshot; vision wants JIT, not precomputed."

### Themes (cross-cutting failure classes)

If this issue is an instance of a known generator, link it under [`issues/_themes/`](../_themes/) and add the issue to that theme's roster. If it's a *new* generator, propose a theme name in section 7 below.

## 5. Evidence and code paths

What the code actually does. Use `file_path:line_number` references so they're clickable.

- Entry point: `path/to/file.ts:NN`
- Hot path: ...
- Suspected fault location: ...
- Cross-references: ...

If the claim included an analysis (e.g. issue #1), validate each line ref by reading the current code. Note any drift.

## 6. Test coverage gap & regression-test obligations

Two parts:

### What's missing

- What tests exist for this code path? List them.
- What invariants are not covered? List them as bullet points.

### Regression-test obligations (HARD GATE for closing the issue)

For **every defect** identified in §3-§5, name the **specific regression test that must exist** before this issue can transition from `investigated` → `fixed`. Each test must:

1. Fail against the buggy code (verify by running it on the unfixed version, or describe the failure mode if the code path can't be unit-tested in isolation).
2. Pass against the fix.
3. Be committed in the same PR as the fix. **No "test in a follow-up PR" excuses.**

Format:

| Defect | Required regression test |
|---|---|
| <one-line defect> | <one-line test obligation: file, what to assert> |

**Do not write the tests in this investigation** — that's a separate phase. Just *name* them precisely enough that a fix-time agent (or you) can write them without reinterpreting the bug.

If a defect's test obligation depends on a primitive that doesn't exist yet (e.g. a `singleFlight` wrapper for the completion-only-guards theme), say so — that's evidence the fix is generator-level, not local.

### §6a Verification ladder (HARD GATE — added 2026-05-15 after #16 overclaim incident)

A unit test alone is not "verified." Pin which level(s) the fix achieved, and what's still open. Closing-gate (§9a) cannot be checked without explicitly marking the levels achieved.

| Level | What it proves | Pass criterion |
|---|---|---|
| **L1** Static | The bug-shape exists in the code | Code reading identifies the §5 evidence with confidence ≥ 0.7 |
| **L2** Unit-mechanical | The fix's mechanism works | Vitest/RTL test that PASSES post-fix AND FAILS pre-fix (verified by running with `git stash` of the fix) |
| **L3** Programmatic data-path | The fix works when the app's state is driven via store actions | Playwright with instrumented `window.fetch` / store calls — exercises real data flow without UI clicks |
| **L4** Real-event chain | The fix works through real React events | Headed Playwright clicking real UI elements (not programmatic state changes) |
| **L5** User-driven manual | The symptom the user reported actually resolves | Trace file in `traces/` lists the exact click sequence; user confirms 👍 or 👎 |

**Rules:**
- L1 alone = `triaged`. Never `fixed`.
- L2 alone IS sufficient for `fixed` ONLY when ALL of:
  - The bug is purely mechanical (e.g., a Map.set inside a guard, a wrong dependency array).
  - L1 confidence ≥ 0.9 (the bug-shape is unambiguous from code reading).
  - No plausible user-visible symptom that the L2 mechanism wouldn't cover.
- L3+ required when:
  - Bug involves UI rendering, event handling, async flow, or any user-visible interaction.
  - L1 confidence < 0.9.
  - User reported a specific symptom that L2 cannot reproduce.
- L5 required when:
  - Fix changes user-visible behavior AND L4 wasn't achieved.
  - Previous levels couldn't actually drive the user-event chain (e.g., programmatic store call returned without error but didn't propagate).
- If a level is environmentally blocked (paid API, manual user action only) — **say so explicitly**. Don't pretend a lower level is sufficient.

**Format for §9a:**
```
- [x] L1 Static — confidence X.XX
- [x] L2 Unit-mechanical — tests at <file>, verified to FAIL pre-fix
- [x] L3 Programmatic data-path — trace at <file>
- [ ] L4 Real-event chain — blocked on: <reason>
- [ ] L5 User-driven manual — instructions at <trace-file>
```

The motivating incident: 2026-05-15 #16 fix landed with only L2 + partial L3. The fix's mechanism (key-based remount) is correct; the user-visible cycle wasn't directly observed. The issue README's first version said "FIXED" — which overclaimed. Subsequent honest commit downgraded to "FIX-IN-PLACE, MECHANICAL TESTS PASSING, REAL-BOOK CYCLE PARTIALLY VERIFIED" and saved a trace for user-driven test.

## 7. Archaeology

Run `python3 scripts/issue-archaeology.py <suspect_file>` and summarize:

- Most-likely-introducing commit: `<sha>` — `<commit message>` — `<date>`
- Session: `<sessionId>` (`~/.claude/projects/.../<sessionId>.jsonl`)
- Agent: `<model id>` (e.g. `claude-opus-4-5-20251101`, `claude-sonnet-...`, `gpt-5-codex`)
- First user prompt that drove this work: `> "..."`
- Tools used: `Edit, Write, Bash, ...`
- Sibling files touched in same session: ...

If multiple commits/sessions are relevant, list them all in chronological order.

## 8. Generator function

The **class** of mistake this is an instance of, expressed generally enough to predict where else it might surface.

Examples (one per line):
- "Async work started without a user-visible signal between the click and the first network call."
- "StrictMode-induced double-mount allowed to re-enter init because guard only checks `isInitialized`, not `isInitializing`."
- "Optimistic state copy that loses fields when the source schema gains new fields."

Then: **other places this generator might have produced the same class of bug.** List candidates to check (do not check them in this investigation; just list).

## 9. Action — which kind of fix this is

Pick exactly one (or `escalate_to_human` if you're not sure which fits):

- **`fix_local`** — small, contained change at a single site. Use when the bug has no shared generator with other instances. Example: fix one specific URL parser bug.
- **`fix_generator`** — a shared primitive or pattern, applied to all instances of a theme. Use when N≥2 issues instance the same generator function. Example: introduce `singleFlight()` wrapper, apply to bootstrap + provider-registration + registry-fetches.
- **`enforce_existing_ADR`** — the spec already says the right thing; the code drifted. Add a failing test that demands the ADR's behavior, then fix the code. *Cheaper than drafting new spec.* Use when classification is `A1*` (drift suspected). Example: CORE-006 already says "render shell immediately"; add a test that fails when init blocks on remote work.
- **`draft_new_ADR`** — no spec covers the area, and the bug class is broad enough or the blast radius large enough to justify writing one. Theme has N≥3 instances or a single instance has data-loss/security potential. The ADR draft goes to `issues/_themes/proposed-adrs/` and waits for human ratification before influencing code.
- **`escalate_to_human`** — see §3 verdict guidance. Don't pick a side when the spec is genuinely ambiguous.
- **`wait`** — issue is paused on user repro / external dependency / blocked theme.

For the chosen action, sketch the directions at the level of paragraphs, not code. For each:
- Impact / Effort / Risk / Reversibility / Confidence
- Pros, cons, tradeoffs
- Open questions

End with a recommendation (or "no recommendation; need a decision from Aditya"). Do **not** implement.

## 9a. Closing gate

This issue can transition to `fixed` only when ALL of the following are true:

- [ ] Fix is implemented (or PR linked) for the chosen action in §9.
- [ ] Every regression test obligation in §6 has been written and is passing.
- [ ] Every regression test was verified to FAIL on the unfixed code (or has a documented reason it couldn't be exercised against the unfixed state).
- [ ] If theme-listed: the theme's roster in `_themes/<theme>.md` has been updated to record this instance as `addressed`.
- [ ] If `enforce_existing_ADR`: a comment in the test file links to the ADR section being enforced, so future maintainers don't accidentally weaken the test.
- [ ] If `draft_new_ADR`: the ADR has been ratified by Aditya (moved into `docs/adr/`), not just left in `proposed-adrs/`.

## 10. Status

State machine — fill in `Status:` at the top with one of these:

```
not-investigated → triaged → (real-bug | already-fixed | cannot-reproduce | confusion | preference | paused-on-repro | needs-human-clarification | underspecified-claim)
                      ↘ if real-bug → investigated → action chosen → (fixed | wontfix | superseded)
```

Status transitions:
- **not-investigated** — claim seeded from Issues.md; no work done.
- **triaged** — verdict assigned but evidence sections still TBD. Light depth.
- **investigated** — full template filled, A/B/C confirmed, action chosen.
- **fixed** — closing gate (§9a) cleared. Reference the fix commit.
- **wontfix** — Aditya decided not to address; record reason here.
- **superseded** — a different issue subsumes this one; link.

## 11. Open questions

- ...

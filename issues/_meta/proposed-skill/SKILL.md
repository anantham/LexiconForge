---
name: investigation-pipeline
version: 0.2.0
description: |
  Systematically investigate a queue of bug claims with verdict classification,
  spec-vs-code matrix (A/B/C), cross-cutting theme noticing, and a hard closing
  gate that prevents wrong-layer fixes. Produces durable evidence artifacts
  (per-issue READMEs, theme docs, regression tests). Includes archaeology
  tooling that maps Claude Code transcripts to git commits to identify the
  agent + prompt + tools that introduced a bug.
when-to-use: |
  User has 3+ bug claims they want triaged + investigated. Codebase is multi-agent
  and bug attribution matters. Codebase has ADRs/docs and you want to enforce-vs-extend
  them rather than drafting new spec for every issue. You want fixes to come with
  verified-failing-pre-fix regression tests.
when-NOT-to-use: |
  Single quick-fix bug — overkill. No ADR culture — the matrix's A axis becomes
  uninformative. No Claude Code transcripts — archaeology degrades to git-only.
changelog:
  0.2.0: |
    Five patches from skill-update on the LexiconForge load-test:
    - §3 hard rule: code-reading-confirmed §2 added as a fourth completion mode
    - §1 Scaffold: twin-issues handling (skip-and-reference for same-shape bugs)
    - §1 Scaffold: optional Calibration check inline subsection
    - §7 Archaeology: skip-conditions for structural bugs
    - §5 Theme-noticing: explicit suspected vs confirmed status with promotion thresholds
  0.1.0: Initial extraction from LexiconForge investigation framework
---

# investigation-pipeline

You are about to investigate a queue of bug claims. This skill prevents two specific failure modes that an agent operating without it tends to hit:

1. **Fixing the wrong layer.** Without live evidence, code-reading suggests fix-shapes that look plausible but address a code path that isn't the bug. The closing gate (§9a) exists to block this.
2. **Conflating "is this a bug?" with "where does the failure live?"** A claim might be a real bug whose fix is "extend an existing ADR with tests" rather than "patch this file." The matrix (A/B/C) exists to surface this.

## Setup (run once per project)

If `issues/` doesn't exist in the repo, create it from this skill's templates:

```bash
mkdir -p issues/{_template,_themes,_themes/proposed-adrs,_meta}
cp ${CLAUDE_PLUGIN_ROOT}/skills/investigation-pipeline/templates/issues-index.md issues/README.md
cp ${CLAUDE_PLUGIN_ROOT}/skills/investigation-pipeline/templates/per-issue.md issues/_template/README.md
cp ${CLAUDE_PLUGIN_ROOT}/skills/investigation-pipeline/templates/theme.md issues/_themes/_template.md
```

Locate the issues queue. Default: `Issues.md` at repo root. Configurable.

Locate Claude Code transcripts. Default: `~/.claude/projects/<encoded-cwd>/*.jsonl` where the encoded cwd replaces `/` with `-`. Configurable via `--transcripts-dir` on the archaeology script.

## Per-issue workflow

For each unfiled item in the queue:

### 1. Scaffold

Create `issues/NN-slug/` (number matches queue order; slug is a 2-4 word kebab-case description). Copy the per-issue template. Paste the **verbatim claim** from the queue into §1 — do not paraphrase, do not interpret.

#### Twin issues — skip-and-reference

If this issue is a TWIN of another (same bug shape, different site or surface): scaffold the folder, copy the verbatim claim, then write `Twin of #N — see that issue's investigation. Differences specific to this site: [list].` **Skip §4-§9 if no meaningful differences.** The fix lands as one PR touching all sites; both/all issues close together. Theme roster lists each instance separately so N counting stays accurate.

Examples (LexiconForge load-test): #4 (portal button) and #5 (illustration button) and #14 (retry button) are TWINS — same bug shape (no in-flight visual state on async-triggering button), three different sites. Investigating #4 in full + porting to #5 and #14 mechanically is correct; investigating each in full would 3x the work without 3x the insight.

#### Calibration check — optional inline pattern

When you reach a verdict or fix-direction that depends on a non-obvious reading of the verbatim claim, add a "Calibration check" sub-paragraph in §1 stating which interpretation you're using and why. Future-you (or a reviewer) can quickly compare the claim's literal text against the interpretation; drift becomes visible at the moment of architectural decision.

Use sparingly — only when interpretation pressure is high. Most issues don't need this. The case for: from the LexiconForge load-test, issue #16's verbatim ("comments tied to that version! and the floating comment icons also have vanished with version switch") was correctly read by the user but mis-read by the agent twice in a row before triangulating. A calibration-check note would have prevented at least one of the wrong turns.

### 2. Triage → assign verdict

One of:

- `real-bug` — symptom matches claim, code path explains it. Unlocks §4-§9.
- `already-fixed` — recent commit addresses the claim. Cite commit. Stop at §7 (archaeology) for context.
- `cannot-reproduce` — symptom doesn't occur with the steps you tried. Document what you tried.
- `confusion` — behavior is by design / already fixed; user's mental model is the gap. Stop at §5 explaining the design intent.
- `preference` — not a bug; user wants different behavior (icon choice, label change). Stop at §3.
- `paused-on-repro` — needs user input to continue.
- **`needs-human-clarification`** — spec is contradictory, two reasonable interpretations imply different fixes, ADR's spirit is unclear. **DO NOT pick a side.** Document the disagreement in §8.
- `underspecified-claim` — claim isn't precise enough to investigate.

### 3. HARD RULE — §2 (Reproduction) must not be `_TBD_` for `real-bug`

You may set `verdict=real-bug` provisionally based on static analysis, but **`triaged → ready-for-fix` requires §2 (Reproduction) to be filled in with observed evidence.** One of:

- **Live repro** at the dev server (Playwright trace, console log, video).
- **Vitest unit test** that reproduces the bug.
- **Playwright trace** of the failing user flow.
- **Code-reading-confirmed** when the bug is mechanically determinable from static analysis without hidden async lifecycle, state-machine, or rendering complexity. **Heuristic:** if you can write the failing-pre-fix unit test directly from reading the code without observing any runtime state, code-reading suffices. If you find yourself saying "we'd have to see what happens at runtime" at any point during analysis, live repro is mandatory.

If you can't reproduce by any of these, the verdict is `cannot-reproduce`, not `real-bug`.

This rule exists because static analysis often suggests fix-shapes that look right but address the wrong layer.

**Examples (LexiconForge load-test):**
- Issue #16 (comments vanish on chapter-translation switch): code-reading suggested 3 different mechanisms; live repro forced — code-reading would have led to a wrong-layer fix.
- Issue #4 (portal button no feedback): button has no `disabled` prop, observable directly in JSX. Code-reading-confirmed sufficed; the failing test was directly derivable from the code.

The distinction matters because forcing live-repro on every issue makes simple bugs expensive; allowing code-reading on every issue allows the #16-class trap. The "would I need to see runtime state?" heuristic is the cut.

### 4. Classify with A/B/C

Three axes, each ternary:

- **A — Spec state**: A1 = ADR + Vision say what should happen, clearly and consistently · A2 = ADR underspecified (principle without behavior) · A3 = spec missing or contradictory. Suffix `*` flags ADR-rot suspected.
- **B — Code vs spec**: B1 matches · B2 falls short · B3 overshoots / unspecified extras.
- **C — Vision alignment**: C1 aligned · C2 drifted (no doc says it's wrong, but the spirit is gone) · C3 contradicts vision.

Format: `(A?, B?, C?)` plus a one-sentence justification per axis. Mark `_provisional_` if assigned at index level without a full per-issue investigation.

The matrix tells you what kind of fix the issue needs:

| Cell pattern | Fix shape |
|---|---|
| `(A1, B2, C1)` | Patch the code; spec already says what to do |
| `(A1*, B2, *)` | ADR-vs-code drift. Add failing test that demands the ADR's behavior, then fix code. **Cheaper than drafting new ADR.** |
| `(A2, B*, *)` | Write the missing behavior in the ADR first. Code follows. |
| `(A3, *, *)` | Write or reconcile spec. Code change without spec is fragile. |
| `(*, *, C2/C3)` | Vision-anchor first. Otherwise the patch will drift again. |

### 5. Theme-noticing

Pattern-match against existing `_themes/*.md` documents. Two issues sharing a *generator function* (not just a symptom) instance the same theme.

If this issue instances an existing theme, add it to that theme's roster table. If you notice a new generator, propose a theme name in §8 of the per-issue README.

#### Suspected vs confirmed — explicit status

Theme docs' roster tables MUST distinguish **suspected** from **confirmed**:

- **Suspected**: instance proposed but not investigated end-to-end. The bug shape is asserted from the user's claim or a quick read; A/B/C is provisional; generator articulation is sketch-level.
- **Confirmed**: investigated end-to-end. A/B/C established. Generator function articulated precisely enough that another instance can be tested against it. §6 test obligations named.
- **Addressed**: confirmed + fixed via the closing gate.

Roster format (use this column shape in every theme doc):

```
| # | What's missing / wrong | Class | Status |
```

#### Promotion thresholds

- N≥2 **confirmed** → consider `fix_generator` action (build the shared primitive).
- N≥3 suspected, regardless of confirmed count → invest in investigating one to promote it. Suspected-only themes can drift; confirmation forces the generator-function to be articulated precisely.
- N=1 confirmed + N≥2 suspected → if the confirmed instance's fix shape generalizes cleanly, consider proactive `fix_generator`. Otherwise wait for a second confirmation.

Example (LexiconForge): silent-feedback-gaps reached N=3 suspected, then #4 was investigated end-to-end and fixed → roster became "1 fixed + 2 suspected". After fixing #5 and #14 mechanically (twins), the theme reaches N=3 confirmed-fixed and the generator-fix (`<AsyncButton>` / `useAsyncAction`) becomes a *refactor* not speculation.

### 6. Action — pick exactly one

For `real-bug` verdicts:

- `fix_local` — small, contained, no shared generator with other issues
- `fix_generator` — theme N≥2, build shared primitive, regression test for the primitive
- `enforce_existing_ADR` — ADR already exists; code drifted. Add failing test, fix code
- `draft_new_ADR` — no spec covers the area; theme N≥3 or single-instance with high blast radius
- `escalate_to_human` — spec ambiguous; don't pick a side
- `wait` — paused on user repro / external dependency

**Three ordering rules:**
1. Prefer `enforce_existing_ADR` over `draft_new_ADR` whenever an existing ADR plausibly covers. Drafting is the more expensive path.
2. ADRs are not sacred. If two ADRs disagree or an ADR's spirit feels confused, escalate.
3. Fixed = test in. No issue closes as `fixed` without a regression test that would have failed against the bug.

### 7. Archaeology (run when introduced; skip when structural)

When the bug appears to have been INTRODUCED at some point — when the file used to work or didn't have this code path — run:

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/skills/investigation-pipeline/scripts/issue-archaeology.py \
  <suspect_file> --git
```

Map suspect file edits → Claude Code session → agent model + first user prompt + tools used + sibling files edited. Cross-references with `git log` for commit attribution. Treats the "Likely commit" as a **shortlist hint, not a verdict** — pair with `git blame` on specific lines for line-level attribution.

**Skip archaeology** when the bug is **structural** (missing-state, missing-call, omitted-handler) rather than introduced by a specific commit. Heuristic: if `git log --follow <file>` shows the file always had this shape from inception, archaeology will produce noise — every commit that touched the file, none of which "introduced" the bug. Mark §7 with "skipped — structural bug, no introducing commit" and move on.

Examples:
- **Run** when: a previously-working flow broke (the StrictMode duplicate-init guard in LexiconForge issue #1 was added in a specific commit that archaeology pinned; commit title hid it).
- **Skip** when: a feature was never wired up correctly from inception (LexiconForge issue #4's portal button never had a pending state from inception; no introducing commit to find).

### 8. Test obligations + closing gate

**For every defect** identified in §3-§5, name the **specific regression test** that must exist before this issue can transition `investigated → fixed`. Each test must:

1. Fail against the buggy code.
2. Pass against the fix.
3. Be committed in the same PR as the fix. **No "test in a follow-up PR."**

Format as a table with columns: `Defect | Required regression test | File path`.

**Do not write the tests in this investigation phase** — name them precisely enough that a fix-time agent can write them without reinterpreting the bug.

### 9. Closing gate — HARD

Before marking the issue `fixed`:

- [ ] Fix is implemented (or PR linked)
- [ ] Every regression test obligation has been written and is passing
- [ ] Every regression test was verified to **FAIL on the unfixed code** (proof: run the test against `git stash`-ed fix, observe failure, restore)
- [ ] If theme-listed: theme's roster updated to record this instance as `addressed`
- [ ] If `enforce_existing_ADR`: a comment in the test file links to the ADR section being enforced
- [ ] If `draft_new_ADR`: ADR has been ratified (moved into `docs/adr/`), not just left as a draft

## Calibration rules (encoded; do not skip)

These were learned the hard way from real failures during the framework's load-test:

1. **Re-read the verbatim claim after every architectural decision.** The user's mental model is often already encoded in the claim text; agents gloss it under interpretation pressure.
2. **Code-first.** Don't ask the user "does the system already do X?" — read the codebase. The user is not a search engine.
3. **§2-not-TBD before ready-for-fix.** Static analysis can support a verdict provisionally, but fix-shape claims need a live-repro foundation.
4. **Prefer enforce-existing over draft-new.** ADR violations + failing tests are cheaper than ADR drafting.
5. **ADRs aren't sacred.** Genuine ambiguity → escalate, don't pick a side.
6. **Fixed = test in.** No exceptions.

## Anti-patterns this skill exists to prevent

- "Static analysis says the bug is in this hook" → fix → ship → user reports same bug. (Caught by §3 hard rule.)
- "Comments are tied to version" → "let me decouple them" → user explains they SHOULD be tied to version, fix went the wrong direction. (Caught by calibration rule #1.)
- "There's no ADR for this; let me write CORE-009" → existing ADR already covered it but was being violated. (Caught by ordering rule 1.)
- "I'll add the test in a follow-up PR" → follow-up never lands → regression ships. (Caught by closing gate.)
- "The verdict was 'paused-on-repro' but we'll act on it anyway because we're confident" → wrong-layer fix. (Caught by §3 hard rule.)

## What the agent does NOT do without explicit user authorization

- Modify production code outside `issues/` and `tests/` during the investigation phase.
- Push commits to remote branches.
- Open PRs.
- Mark an issue `fixed` while §9a's checkboxes aren't all ticked.
- Promote a theme draft into `docs/adr/` (that's a human ratification step).

## Tool inventory

This skill provides:

- **`scripts/issue-archaeology.py`** — file → sessions → agent + prompt + tools. UTC-normalized timestamp comparison. Configurable transcript dir.
- **`scripts/co-mingled-commits-survey.py`** — surveys recent commits for "title-says-cleanup-but-diff-includes-control-flow" pattern. Configurable hotspot paths.
- **Templates**: `issues-index.md`, `per-issue.md`, `theme.md`, `proposed-adr.md`.

## Reference: case studies

The framework was developed and load-tested in the LexiconForge codebase. Worked examples (link from the user's session, not vendored here):

- **Investigation that produced a real-bug verdict + 7 defects + multiple themes**: issue #1 (boot time)
- **Investigation that produced an already-fixed verdict via static analysis only**: issue #11 (comparison panel)
- **Investigation where the matrix prediction was falsified by code reading**: issue #2 (fan toggle)
- **Investigation where the agent was caught backing off ready-for-fix because §2 was TBD**: issue #16 (version-switch comments)
- **End-to-end fix with closing gate exercised**: issues #17 + #18 (feedback persistence)
- **Theme survey that promoted a theme from N=1 to N=3-4**: co-mingled-commits theme

## Open known limits (be honest with the user)

- The closing gate's "verify fail-pre-fix" via `git stash` doesn't catch all classes of test-against-mock bugs. If the test mocks the thing it's supposed to be testing, the verification can pass spuriously. Cross-check by reading the test against the bug shape.
- Theme generators can be over-fit. A theme with N=2 is a hypothesis, not a finding; act on it cautiously until N≥3 or a clear shared primitive emerges.
- The `(A?, B?, C?)` matrix's `A1*` (ADR-rot suspected) is meaningful but unfalsifiable without a human ratifier weighing in.
- Live-repro at `localhost:5180` (or wherever the dev server is) requires the user to have it running. The skill cannot start the dev server unilaterally.

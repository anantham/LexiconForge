# Issue NN — short title

> Status: investigating · Last updated: YYYY-MM-DD · Investigator: <agent>

## 1. Claim (verbatim from Issues.md)

> _Paste the user's exact text from `Issues.md`, unedited. Quote it so it is unmistakable that this section is not the agent's analysis._

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

## 3. Verdict

One of:
- **Real bug** — symptom matches claim, code path explains it.
- **Confusion** — the behavior is by design or already fixed; the user's mental model is the gap.
- **Cannot reproduce** — symptom does not occur for me with these steps.
- **Underspecified** — need more info from Aditya.

State **confidence (0.0–1.0)** and **why**. If &lt; 0.7, list what would raise confidence.

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

## 6. Test coverage gap

- What tests exist for this code path? List them.
- What invariants are not covered? List them as bullet points.
- **Do not add tests in this investigation.** Just identify the gap.

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

## 9. Fix directions (sketches only)

A few options at the level of paragraphs, not code. For each:
- Impact / Effort / Risk / Reversibility / Confidence
- Pros, cons, tradeoffs
- Open questions

End with a recommendation (or "no recommendation; need a decision from Aditya"). Do **not** implement.

## 10. Open questions

- ...

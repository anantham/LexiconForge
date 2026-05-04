# `expansion:investigation-pipeline` (proposed skill)

> Draft skill package extracted from the LexiconForge investigation framework after 9 commits' worth of load-testing. Not yet shipped to expansion-marketplace.

A systematic pipeline for investigating an issues queue, with classification, theme-noticing, archaeology tooling, and a hard closing-gate that prevents wrong-layer fixes.

## What the skill does

Given:
- A queue of bug claims (default: `Issues.md` at repo root)
- A codebase with ADRs/docs (default: `docs/adr/`)
- Claude Code transcripts (default: `~/.claude/projects/<encoded-cwd>/`)

It produces:
- An `issues/` folder with per-issue investigation READMEs
- A `_themes/` layer documenting cross-cutting failure-class generators
- Proposed-ADR drafts (`_themes/proposed-adrs/`) awaiting human ratification
- Regression tests for every defect, verified to fail-pre-fix
- Archaeology reports mapping bug introductions to specific (agent, prompt, tools) tuples

## Why this skill exists

Two specific failure modes that an agent operating without it tends to hit:

1. **Fixing the wrong layer.** Without live evidence, code-reading suggests fix-shapes that look plausible but address a code path that isn't actually the bug. The skill's hard rule (verdict `real-bug` requires §2 Reproduction filled with observed evidence) prevents this.

2. **Conflating "is this a bug?" with "where does the failure live?"** A claim might be a real bug whose fix is "extend an existing ADR with tests" rather than "patch this file." The skill's A/B/C matrix (spec state × code-vs-spec × vision alignment) surfaces this.

Both failure modes were observed in real time during the LexiconForge load-test. The framework caught them; without it they would have shipped.

## Package contents

| File | Purpose |
|---|---|
| `SKILL.md` | The agent-facing instructions. The single load-bearing file. |
| `README.md` | This file — human-facing intro. |
| `templates/` | Templates for `issues/README.md`, per-issue README, theme docs, ADR drafts. _Not yet ported from the LexiconForge live versions._ |
| `scripts/issue-archaeology.py` | Maps suspect file → Claude Code sessions that edited it → agent + prompt + tools. UTC-normalized timestamp comparison. Configurable transcripts dir. |
| `scripts/co-mingled-commits-survey.py` | Surveys recent commits for "title says cleanup but diff also includes control-flow change" pattern. Configurable hotspot paths. |
| `docs/` | Long-form docs on the matrix, verdicts/actions, calibration rules, case studies. _Stub for now._ |

## Quick test of the archaeology tool

```bash
python3 scripts/issue-archaeology.py path/to/some/file.ts --git
```

Auto-derives the Claude Code transcripts dir from your cwd. Override with `--transcripts-dir DIR` or set `CLAUDE_TRANSCRIPTS_DIR`.

Validation passing as of 2026-05-04: tested on `services/audio/storage/serviceWorker.ts` and `components/sutta-studio/SuttaStudioView.tsx` — both files I didn't touch in the session that built this skill. The script correctly identified the original sessions, agent models, first-user-prompts, and sibling files.

## Calibration rules baked into SKILL.md

Each was learned from a real failure during the LexiconForge load-test:

1. **Re-read the verbatim claim after every architectural decision.** Mental models drift under interpretation pressure.
2. **Code-first.** Don't ask the user "does the system already do X?" — read the codebase.
3. **§2-not-TBD before ready-for-fix.** Live repro is mandatory.
4. **Prefer enforce-existing-ADR over draft-new-ADR.** Cheaper, more targeted.
5. **ADRs aren't sacred.** Genuine ambiguity → escalate.
6. **Fixed = test in.** No exceptions.

## Status: NOT YET SHIPPED

Validation gates that should be cleared before this lands in expansion-marketplace:

- [x] Archaeology script tested on non-author files (LexiconForge: 2026-05-04)
- [x] Closing gate exercised with real fixes (LexiconForge: issues #17 + #18 fixed via the gate)
- [ ] One non-author agent runs the framework cold on a queue of bugs
- [ ] One human follows the rules through a single issue end-to-end
- [ ] One full theme→ratify→enforce-on-other-instances cycle (no theme has been ratified yet)
- [ ] Archaeology + survey scripts tested on a non-LexiconForge codebase

## Open questions

(see also `issues/_meta/skill-sketch.md` in this LexiconForge repo for the full context)

- **Skill name.** `investigation-pipeline` is the working title. Alternatives: `triage-and-fix`, `bug-archaeology`, `matrix-investigation`.
- **Single skill or split?** Current draft is one skill covering investigate + classify + theme + fix + close. Could split into `investigation-pipeline` + `closing-gate` + `theme-curation` if too dense.
- **Templates.** SKILL.md references templates under `templates/` but none are ported yet. The LexiconForge live versions at `issues/_template/README.md`, `issues/README.md`, `issues/_themes/README.md` are the source — they need light de-LexiconForging (remove specific-issue references) before becoming generic templates.

## Source case studies

The framework was developed in conversation between Aditya and Claude Opus 4.7 (1M context) during May 2026, in the LexiconForge codebase. Worked examples:

- Issue #1 (boot time) — full investigation, 6 defects, 4 themes
- Issue #11 (comparison panel) — already-fixed verdict via static analysis
- Issue #2 (fan toggle) — matrix prediction falsified, useful negative result
- Issue #16 (version-switch comments) — agent caught backing off ready-for-fix because §2 was TBD; deepened from "single useEffect bug" to "render-layer position lifecycle issue"
- Issues #17 + #18 (feedback persistence) — end-to-end fixes via the closing gate; 7 regression tests verified to fail-pre-fix
- Theme survey: co-mingled-commits promoted from N=1 to N=3-4 confirmed via the survey script

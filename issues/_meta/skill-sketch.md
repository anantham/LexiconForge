# Skill sketch — `expansion:investigation-pipeline`

> One-page draft of what the extracted skill would look like. Written 2026-05-04 from the LexiconForge framework after 8 commits' worth of load-testing.

## What it is

A systematic pipeline for investigating an issues queue with classification, theme-noticing, archaeology, and a closing gate. Designed to be invoked by an agent (or human + agent) given a list of bug claims that need triage + investigation + (optional) fix.

## SKILL.md frontmatter (proposed)

```yaml
---
name: investigation-pipeline
description: |
  Systematically investigate a queue of bug claims with verdict classification,
  spec-vs-code matrix (A/B/C), cross-cutting theme noticing, and a hard closing
  gate that prevents wrong-layer fixes. Produces durable evidence artifacts
  (per-issue READMEs, theme docs, regression tests). Includes archaeology
  tooling that maps Claude Code transcripts to git commits to identify the
  agent + prompt + tools that introduced a bug.
type: workflow
when-to-use: |
  - User has 3+ bug claims they want triaged + investigated
  - Codebase is multi-agent and bug attribution matters
  - Codebase has ADRs/docs and you want to enforce-vs-extend them rather than
    drafting new spec for every issue
  - You want fixes to come with verified-failing-pre-fix regression tests
when-NOT-to-use: |
  - Single quick-fix bug ("the button is the wrong color") — overkill
  - No ADR culture — the matrix's A axis becomes uninformative
  - Codebase has no Claude Code transcripts — archaeology degrades to git-only
---
```

## What it provides

**1. Three-tier investigation structure** (created per-project):
```
issues/
├── README.md                  # index with status table + state machine + matrix legend
├── _template/README.md         # 11-section per-issue template
├── _themes/*.md                # cross-cutting failure-class docs (user-specific generators)
├── _themes/proposed-adrs/*.md  # ADR drafts awaiting human ratification
├── NN-slug/README.md           # one folder per investigated issue
└── NN-slug/traces/             # repro scripts + result JSONs
```

**2. The A/B/C matrix** for each issue:
- A — Spec state (A1 ratified / A2 underspec / A3 missing); `*` suffix flags ADR-rot
- B — Code vs spec (B1 matches / B2 falls short / B3 overshoots)
- C — Vision alignment (C1 / C2 drift / C3 contradiction)

**3. Eight verdicts + six actions:**
- Verdicts: `not-investigated → triaged → investigated/already-fixed/cannot-reproduce/confusion/preference/paused-on-repro/needs-human-clarification/underspecified-claim → fixed/wontfix/superseded`
- Actions (when verdict=real-bug): `fix_local / fix_generator / enforce_existing_ADR / draft_new_ADR / escalate_to_human / wait`

**4. Closing gate** (HARD): `triaged → fixed` requires regression tests that have been verified to fail pre-fix and pass post-fix, committed in the same PR.

**5. Two scripts** (parametrized):
- `issue-archaeology.py <path>` — scans Claude Code JSONL transcripts, maps file edits → sessions → agent model + first user prompt + tools used. UTC timezone normalization. Optional `--git` for commit cross-reference.
- `co-mingled-commits-survey.py [--n 100]` — surveys recent commits for "title says one thing, diff also includes unrelated control-flow change" pattern. Bucketed by stated intent (cleanup_only / chore_other / docs_only / fix_bug / feat / refactor) with scope-aware hotspot detection.

## Workflow the skill teaches

```
NEW CLAIM (Issues.md)
    │
    ▼
SCAFFOLD ── creates issues/NN-slug/, copies verbatim claim
    │
    ▼
TRIAGE ──── §3 verdict + provisional (A?, B?, C?) in index
    │
    ├── lightweight verdicts (preference / already-fixed / cannot-reproduce / confusion / underspecified-claim) → DONE at §3
    │
    └── real-bug → INVESTIGATE
                       │
                       ▼
            §2 LIVE REPRO (HARD: must not be TBD)
                       │
                       ▼
            §4-5 EVIDENCE (code paths, classification finalized)
                       │
                       ▼
            §6 TEST OBLIGATIONS (named, not yet written)
                       │
                       ▼
            §7 ARCHAEOLOGY (script run, agent attribution)
                       │
                       ▼
            §8 GENERATOR FUNCTION (theme it or note it)
                       │
                       ▼
            §9 ACTION CHOSEN (fix_local / enforce_existing_ADR / etc.)
                       │
                       ▼
            §9a CLOSING GATE: write tests, verify fail-pre-fix, fix, verify pass, commit
                       │
                       ▼
                     FIXED
```

## Calibration rules baked into the template

Each was learned the hard way during this codebase's load test:

- **Re-read the verbatim claim after every architectural decision.** The user's mental model is often already encoded in the claim text; agents gloss it under interpretation pressure. (Issue #16 needed three framings before triangulating.)
- **Code-first, don't ask the user "does the system already do X?"** The codebase is the source of truth.
- **§2-not-TBD before ready-for-fix.** Static analysis can support a verdict provisionally, but fix-shape claims need a live-repro foundation. (Caught me trying to fix #16 at the wrong layer.)
- **Prefer enforce_existing_ADR over draft_new_ADR.** ADRs that already exist but are violated → add a failing test, fix the code. Cheaper than drafting new spec.
- **ADRs aren't sacred.** When two ADRs disagree or an ADR's spirit is unclear, escalate to human. Don't pick a side.
- **Fixed = test in.** No issue closes as `fixed` without a regression test that would have failed against the bug.

## What's user-configurable

- **Hotspot paths** — `co-mingled-commits-survey.py`'s `PATH_IS_HOTSPOT` regex defaults to common patterns (`store/`, `services/`, `hooks/`) but should be overridden per-project.
- **CLEANUP_KEYWORDS** — what counts as a "cleanup" title; default list is conservative.
- **Transcript path** — `issue-archaeology.py`'s `PROJECTS_DIR` defaults to `~/.claude/projects/<dir-encoded-cwd>` but accepts override.
- **ADR location** — defaults to `docs/adr/`; configurable.
- **Issues source** — defaults to `Issues.md` at repo root; configurable.

## What stays user-specific (not in skill)

- **Specific themes.** The skill teaches HOW to notice and document a theme; the themes themselves emerge per-codebase. LexiconForge's `jit-vs-precompute` is not a universal concept.
- **Specific ADR drafts.** CORE-008/009/010 are LexiconForge-specific; reference only.
- **Specific issues.** All worked examples (#1, #11, #16, #17, #18) live in this repo as case studies; the skill's docs LINK to them, doesn't ship them.

## Validation gates before shipping the skill

I wouldn't ship until:

1. **One non-author agent runs the framework cold** on a queue of bugs in this repo. Does the framework work without a co-designer? Are the rules clear from the docs alone?
2. **One human runs a single issue through the full pipeline as a test** — read the rules, follow them, see if the rules produce the same conclusion the framework's author would have reached.
3. **One issue goes through the FULL theme→ratify→enforce-on-other-instances cycle.** We have themes, we have proposed ADRs, but we haven't ratified one and used it as the basis for fixing 3+ issues. That's the missing validation that the leverage-point hypothesis actually compounds.
4. **The archaeology script gets parametrized + tested** on a different Claude Code project (not LexiconForge). UTC normalization works; transcript-path resolution works; commit attribution holds.

## Plausible package shape (in expansion-marketplace)

```
expansion-marketplace/expansion/skills/investigation-pipeline/
├── SKILL.md                          # the agent-facing instructions
├── README.md                         # human-facing intro
├── templates/
│   ├── issues-index.template.md      # the README.md for issues/
│   ├── per-issue.template.md         # the 11-section template
│   ├── theme.template.md             # how to write a theme doc
│   └── proposed-adr.template.md      # ADR draft shape
├── scripts/
│   ├── issue-archaeology.py          # parametrized version
│   └── co-mingled-commits-survey.py  # parametrized version
├── docs/
│   ├── matrix.md                     # A/B/C explained
│   ├── verdicts-and-actions.md       # state machine + decision tree
│   ├── calibration-rules.md          # the hard-won rules
│   └── case-studies/
│       └── lexiconforge-2026-05.md   # link to this repo's worked examples
└── examples/
    └── (samples of completed investigations from anonymized open-source repos)
```

## What the SKILL.md body teaches the agent (sketch)

1. **Setup**: scaffold `issues/` if not present; copy templates.
2. **Read the queue** (`Issues.md` or equivalent); for each unfiled item, create a stub.
3. **Triage**: assign verdict; lightweight verdicts close at §3.
4. **Investigate**: live-repro is mandatory before ready-for-fix.
5. **Classify**: `(A?, B?, C?)` based on ADR audit (the skill teaches how to do the audit).
6. **Theme**: notice patterns N≥2; document under `_themes/`.
7. **Action**: pick one of six (decision tree).
8. **Test obligations**: name them precisely.
9. **Closing gate**: write tests, verify fail-pre-fix, fix, verify pass, commit together.
10. **Promote** (optional): theme N≥3 → propose ADR draft; ADR ratified → enforce across instances.

## Open questions for you to weigh in on

- **Skill name.** Options: `investigation-pipeline`, `issue-pipeline`, `triage-and-fix`, `bug-archaeology`, `matrix-investigation`. Lean: `investigation-pipeline` (broadest, matches what it does).
- **Single skill or split?** The full thing (investigate + theme + draft ADR + fix) is ~big. Could split into `investigation-pipeline` (steps 1-7) + `closing-gate` (steps 8-10) + `theme-curation` (themes + proposed ADRs). My lean: ship as one skill first; split if it's too dense.
- **Should the skill `Read` Issues.md, or assume agent already has it?** Skills usually assume context is set up; but a "this is the queue" pointer is useful.
- **License / attribution.** The framework was co-developed in conversation with Aditya; the worked examples are LexiconForge's; the methodology is generalizable. Probably ship under the same license as the rest of expansion-marketplace.
- **Distribution.** Drop into expansion-marketplace as a new skill folder; update the marketplace metadata; bump version.

## What I think is the strongest argument for shipping it

Across this session the framework caught me twice from doing wrong work:
- **§2-not-TBD rule** — pulled me back from fixing #16 at the wrong layer. Without it I'd have shipped a broken regression test.
- **Closing gate** — the verify-fail-pre-fix step on #17/#18 is what made the fixes load-bearing rather than ceremonial.

A skill that prevents two distinct categories of bad agent work, with two real fixes shipped in the same session as evidence, is more valuable than most workflow skills that just "remind the agent to be careful." The rules emerged from real failures, not speculation.

## What I think is the strongest argument AGAINST shipping yet

It's been used by exactly one agent (me) and one human (you) — both of whom co-designed it. The portability question is unanswered. If we ship now and it doesn't work for someone else, we'd be teaching a method that was load-bearing on a specific collaboration shape rather than a general technique.

Mitigation: ship with the explicit caveat "this framework was developed and validated in conversation; if it feels alien to read alone, please tell us — that's evidence the docs need rewriting for cold-read." Treat the first 3-5 external uses as a beta.

That gets shipping over the line for me. Your call.

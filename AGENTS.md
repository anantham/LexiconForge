
Operating Manual for Computational Peers  
SCOPE: Codex CLI, Claude Code, Gemini CLI (and other LLM agents) 

PHILOSOPHY: We are computational peers collaborating with human developers. Operate with humility, form hypotheses, validate with humans, build sustainably.

---

# PRIME_DIRECTIVES 

1. **Hypothesis Before Action:** Never jump to conclusions. Form hypotheses, design minimal diagnostics, validate with humans, then implement. 
2. **Tests Are Signal:** Failing tests are valuable information about system state. Never "goodhart" by hacking around failures. Investigate root causes with diagnostic logging. 
3. **Modularity Is Mandatory:** Files approaching ~300 LOC must be split. Large monoliths break agent workflows and context windows. 
4. **Human Gates Are Sacred:** Architectural changes, solution selection, and root cause confirmation require explicit human validation. The goal is to keep humans in the loop with interfaces designed to make it easy for humans to give feedback frictionlessly.
5. **Documentation Is Design:** Every feature needs intent documentation. Use ADRs for significant decisions. 
6. **Don't be trigger happy** - When I ask you a question, just answer, don't assume the implicit request is for you to fix it immediately you can offer to fix it with precise plans and I may approve but do not proactively edit files and patch code.
7. **Epistemic Hygiene** - Every fix proposal includes: assumptions, predicted test outcomes, confidence (0.0–1.0), fallback plan. If confidence < 0.7 or unsafe → "decline & explain" using STOP template


8. **Meta update protocol** - if I ask you to do something and mention /metaupdate then incorporate that request into the appropriate section in this AGENTS.md document itself after confirming with me. If you offer me an investigation plan as part of the bug squashing protocol below and I say "make sure you also note all relevant files that will be affected /metaupdate" then you will append that rule to the protocol below specifying concrete paths to files that are relevant and will be investigated.

9. **Error logging** - Always ensure error messages are descriptive and detailed. We do not want silent failures to happen. Log every step carefully and gate it behind workflows so if we need to debug any feature we can set the appropriate variable and see those logs.

10. **Push back and critique** - You are encouraged to notice if your code is overly defensive, hyper specific, goodharted, bloated. Reflect on existing code you see and on code you are about to write and ask the human for confirmation, clarification, "Am I right to interpret your desire this way? shall I do X" before implementing it. In fact you get extra points for offering to refactor existing code to make it simpler, removing things, slicing it up to make it modular so it follows SOLID principles - Single Responsibility Principle (SRP), Open/Closed Principle (OCP), Liskov Substitution Principle (LSP), Interface Segregation Principle (ISP) and Dependency Inversion Principle (DIP). You have permission to flag when following a convention seems wrong for this specific case. State your confidence level when uncertain about architectural decisions. If there's a tension between conventions (e.g., DRY vs. explicit), name it rather than silently choosing.
11. **Options first** - Always present a list of options with open questions, tradeoffs, and uncertainties explicitly evaluated across dimensions (impact, effort, risk, reversibility, time, confidence) before proceeding.

---

RESPONSE_FORMAT (mandatory for non-trivial responses)

- Issues: concise list
- Options: at least 2, each with
  - Pros/Cons across dimensions: impact, effort, risk, reversibility, time, confidence
  - Tradeoffs: explicit
  - Open questions
  - Uncertainties
- Recommendation (if asked), with confidence

---

Below is the Bug Squashing protocol that might be invoked when we are dealing with difficult bugs that need careful precise repair. This protocol is designed to prevent you from goodharting and trying to quickly get the app working. The idea is to do it beautifully, completely like a work of art.

---

PRE‑FLIGHT_CHECKLIST (before ANY code changes)  
- [ ] Read docs/WORKLOG.md  
- [ ] Make sure to update it with time stamp with details about which files were modifed, line numbers and why
- [ ] Read relevant files in full (no skimming)  
- [ ] Write explicit hypotheses  
- [ ] Create a git worktree if parallel work is needed

---

PRE‑FLIGHT_EXCEPTION (single‑agent small fix)  
If you are the only active agent and the change qualifies as a small fix (≤2 files, ≤150 LOC, no deps/schema/ADR/architectural changes), you may skip the full checklist. Minimum requirements still apply:  
- [ ] Read relevant files in full (no skimming)  
- [ ] Update docs/WORKLOG.md with timestamp + files/lines + rationale  
- [ ] State assumptions + confidence in the response  

---

# WORKTREE_POLICY (Default)

Goal: avoid stash hell and keep the main checkout clean.

Scope: Required when multiple agents are active or when the task is non-trivial. Single-agent small fixes may work directly on `main` without a separate worktree.

Small fix definition:
- ≤2 files changed
- ≤150 LOC changed
- No new dependencies, schema/ADR changes, or architectural refactors

- Default to **one worktree per branch** for any non-trivial task or whenever you need to context-switch.
- Keep the root repo checkout on `main` and clean; avoid developing on `main` except for single-agent small fixes.
- Prefer worktrees **outside** the repo to avoid untracked noise: `../LexiconForge.worktrees/<branch-name>/`.
- Avoid `git stash` unless it’s an emergency; if you stash, name it and log `stash@{n}` + reason in `docs/WORKLOG.md`.

Quickstart
```bash
mkdir -p ../LexiconForge.worktrees
git worktree add ../LexiconForge.worktrees/<branch-name> -b <branch-name> main
# or for an existing branch:
git worktree add ../LexiconForge.worktrees/<branch-name> <branch-name>
```

Cleanup after PR merge
```bash
git worktree remove ../LexiconForge.worktrees/<branch-name>
git branch -d <branch-name>
git worktree prune
```

Notes
- One branch can only be checked out in one worktree at a time (Git enforces this).
- Node projects duplicate `node_modules` per worktree; prune old worktrees regularly.

---

# MULTI-AGENT COORDINATION PROTOCOL

When multiple agents (Claude Code, Gemini CLI, Codex, etc.) work on this repo concurrently, follow these rules to avoid conflicts:

Scope: This protocol applies only when multiple agents are working in the same repo at the same time. Single-agent small fixes do not require PRs or worktrees.

## Core Rules

| Rule | Rationale |
|------|-----------|
| **Main repo stays on `main`** | Never checkout other branches in the root repo |
| **Each agent = dedicated worktree** | Isolates work completely |
| **WORKLOG entry on start/end** | Signals ownership and progress |
| **No stashing** | Commit WIP to branch or lose it; stashes create ownership confusion |
| **Claim branches explicitly** | Include agent identifier in branch name |

## Branch Naming Convention

Use agent-prefixed branches to signal ownership:
```
feat/opus-<feature-name>      # Claude Opus
feat/gemini-<feature-name>    # Gemini CLI
feat/codex-<feature-name>     # Codex / Claude 5.2
fix/opus-<bug-name>           # Bug fixes follow same pattern
```

## Worktree Naming Convention

```
../LexiconForge.worktrees/opus-<task>/
../LexiconForge.worktrees/gemini-<task>/
../LexiconForge.worktrees/codex-<task>/
```

## WORKLOG Coordination

On session start, append to `docs/WORKLOG.md`:
```markdown
### [YYYY-MM-DD HH:MM] [Agent: Opus/Gemini/Codex]
**Status:** Starting
**Task:** <brief description>
**Worktree:** ../LexiconForge.worktrees/<name>/
**Branch:** <branch-name>
**Files likely affected:** <list>
```

On session end or context overflow:
```markdown
### [YYYY-MM-DD HH:MM] [Agent: Opus/Gemini/Codex]
**Status:** Pausing/Complete
**Progress:** <what was done>
**Next steps:** <what remains>
**PR:** <link if created>
```

WORKLOG bloat control:
- Run `./scripts/cycle-worklog.sh` periodically to archive older entries when `docs/WORKLOG.md` grows too large.

## Conflict Prevention

1. **Check WORKLOG before starting** - see if another agent is working on overlapping files
2. **Don't touch files outside your task scope** - especially shared configs
3. **If you need a file another agent owns** - note it in WORKLOG and coordinate via human
4. **Never force-push to branches you didn't create**
5. **Keep PRs focused** - one logical change, easy to review and merge independently

## Emergency Recovery

If you find the repo in a dirty state (uncommitted changes, detached HEAD, etc.):
1. **Don't try to fix it** - you may destroy another agent's work
2. **Log the state** in WORKLOG with `git status` output
3. **Ask human** for guidance
4. **Create your own worktree** from `origin/main` and proceed there

---

# HYPOTHESIS‑DRIVEN_PROTOCOL  

PHASE 1 — Hypothesis Formation

TEMPLATE: Investigation Plan
```json
{
  "issue": "User-reported behavior that violates spec",
  "hypotheses": {
    "H1": {"description": "Most likely cause", "prior": 0.4, "test": "How to disprove"},
    "H2": {"description": "Alternative cause", "prior": 0.3, "test": "How to disprove"},
    "H3": {"description": "Boring cause (typo, cache, etc)", "prior": 0.3, "test": "How to disprove"}
  },
  "evidence_plan": {
    "logs_to_add": ["Location and what to log"],
    "metrics_to_capture": ["What to measure"],
    "predictions": ["If H1 true, will see X", "If H2 true, will see Y"]
  },
  "confidence": 0.7,
  "decision_rule": "How we'll know which hypothesis is correct"
}
```

- User asks for help. There is empirical evidence that the human needs to give you. What is the behaviour of the app that is against the product specification
- Make sure the ADR document has this feature clearly promised and the user is highlighting a failure or update the ADR to align with the user wishes

If human is satisfied you understand the issue then we can start investigation or phase 2

PHASE 2 — Investigation Loop (max 3 attempts)  
Attempt 1/3

- hypothesis 1: what is causing this behaviour, trace the causal links. What if removed will remove this issue. Try to isolate the underlying 
    
- test: run tests to falsify, make sure to explicitly state what you predict will be the results of your experiment because your beliefs must pay rent
    
- result: confirmed | rejected | inconclusive
    
Note all this 

Attempt 2/3

- refined_hypothesis:
    
- test:
    
- result: <…>
    

Attempt 3/3

- final_hypothesis: <…>
    
- if still failing → MANDATORY STOP
    

HARD_STOP: after 3 failed attempts OR 2 inconclusive cycles.
Inform the user

If tests allowed you to collect enough evidence to convince human that the root cause was identified we can move to phase 3.

PHASE 3 — Map out solution space

Present options using this comparison table:

| Option | Files | LOC Δ | Complexity | Hours | Reversible | Risks | Perf Impact | Tests |
|--------|-------|-------|------------|-------|------------|-------|-------------|-------|
| A: Quick patch | 2 | +20 | Low | 1 | Yes | Bandaid | None | 2 |
| B: Refactor service | 5 | -200 | Medium | 4 | Partial | Breaking API | +10% | 8 |
| C: Redesign module | 12 | -500 | High | 16 | No | Migration | +30% | 20 |

**Recommendation:** [Which option and why, given constraints]
**Confidence:** [0-1 scale]

The important aspects are tradeoffs, constraints, affects on future features, how many files are affected the breakdown of how we will go about implementing are shown to the human and explained.

Human picks one for writing to files, testing is done manually and then if it is satisfactory, you can commit with clear commit message

    Approval → git stage → test → commit.
    

---


---

## FILE_SIZE_MANAGEMENT 

Decomposition protocol for files > 300 LOC  
Plan: identify files that are monolithic or bloated and log them in `docs/REFACTOR_CANDIDATES.md` with a brief reason + suggested split.  
Notes: 300 LOC is a rule of thumb; prioritize maintainability, cohesion, and testability over raw line count. No warning is required before reading large files.


---

Use WORKLOG to ensure valuable context about current work is saved so that if your work is disconnected in the middle, future iterations of you can continue on in the roadmap. 

Every leg of your roadmap, todo list, uncertainties, discoveries, antipatterns discovered, friction should be noted that as a form of escalating it to human and to other AI for attention

---

# STOP_CONDITIONS (immediate)

1. loop limit reached (3 fails or 2 inconclusive cycles of trying to replace text, edit file, run command)
    
2. context overflow (> 80% of window) prepare to make best use of remaining tokens
    
3. file > 300 LOC without adding it to `docs/REFACTOR_CANDIDATES.md` when it warrants refactoring
    
4. security risk (auth/crypto/sanitization/secrets)
    
5. destructive operation detected (rm/drop/truncate to evade or goodhart tests)
    
6. If you notice a general quick hacky fix to bypass the slow careful principled solution
    

### STOP_MESSAGE_TEMPLATE  

TRIGGER:  
INVESTIGATION_SUMMARY (attempts)

- 1/3: hypothesis=<…> | test=<…> | result=<…>
    
- 2/3: hypothesis=<…> | test=<…> | result=<…>
    
- 3/3: hypothesis=<…> | test=<…> | result=<…>  
    context_used: / tokens  
    files_examined: (~)  
    what_we_know:  
    unknowns:  
    next_steps (human‑first):
    

---

## What to commit (granularity)

One logical change per commit. Don’t mix formatting, refactors, and feature code.

Small, consistent steps. Commit when tests pass and behavior is coherent.

Stage intentionally: git add -p to include only the hunks you mean.

Separate noise: run formatters in a dedicated “style” commit.


### DO

Write for a future teammate (or future you): clear, specific, searchable.

Record intent and impact (why it’s safe; what it fixes; user-visible effects).

Use scopes meaningfully: api, ui, parser, auth, infra.

Point to issues/PRs/spec; include migration notes when needed.

Mark breaking changes with ! in type or BREAKING CHANGE: in footer.

### DON’T

Don’t write “update stuff”, “WIP”, or pile many unrelated files.

Don’t encode implementation trivia in tests/messaging.

Don't rely on CI logs to explain context—put essentials in the body.



---

## PULL_REQUEST_WORKFLOW (Default for Multi-Agent and Non-Trivial Changes)

### Scope
Required when multiple agents are active or when changes are non-trivial. Single-agent small fixes may go directly to `main` without a PR.

### All Changes Must Go Through Pull Requests

**CRITICAL:** Direct commits to main branch are PROHIBITED except for single-agent small fixes (as defined above). All other changes must be submitted via Pull Request to trigger Codex automated code review.

### PR Creation Protocol

1. **Create feature branch** from latest main: `git checkout -b [type]/[description]`
   - Examples: `fix/indexeddb-refactor`, `feat/add-telemetry`, `debt/split-monolithic-services`

2. **Make atomic commits** following the templates below
   - One logical change per commit
   - Include tests with implementation
   - Follow commit message format strictly

3. **Push branch and create PR**
   ```bash
   git push -u origin [branch-name]
   gh pr create --title "[TYPE]: Brief description" --body "..."
   ```

4. **Wait for Codex review** before any merge
   - Address all review comments
   - Add follow-up commits for fixes
   - DO NOT force-push after review starts

### PR Size Guidelines

- **Small PRs preferred:** 200-400 lines ideal, 800 lines max
- **Split large refactors:** Create sequential PRs for reviewability
- **Tech debt PRs:** One monolithic file split per PR

### PR Description Requirements

```markdown
## Summary
[What and why in 2-3 sentences]

## Root Cause (if bug fix)
[Link to investigation/hypothesis validation]

## Changes
- [ ] file1.ts: Specific changes
- [ ] file2.ts: Specific changes
- [ ] tests added/modified

## Testing
- [ ] All tests pass locally
- [ ] New tests cover the changes
- [ ] Manual testing completed

## Review Checklist
- [ ] No direct commits to main (unless small-fix exception applies)
- [ ] Follows commit format
- [ ] Ready for Codex review
- [ ] No unrelated changes mixed in
```

### Agent-Specific PR Rules

1. **Never bypass PR process** unless the small-fix exception applies
2. **Each PR addresses ONE issue** - no scope creep
3. **Include PR number in commits** after creation: `fix(db): Split indexeddb service (#123)`
4. **Tech debt PRs:** Include metrics (before/after LOC, complexity reduction)
5. **If PR blocked by review:** Create follow-up PR rather than force-pushing

---

## REFACTORING METRICS

Required measurements for any refactoring PR:
- Line count: [before] → [after] with % change
- Cyclomatic complexity: [before] → [after] per function
- Test coverage: [before]% → [after]%
- Bundle size: [before] KB → [after] KB
- Type safety: # of 'any' types removed
- Performance: [method] shows [before] ms → [after] ms

---

COMMIT_MESSAGE_TEMPLATES  


Context:  
Changes:  
Impact:  
Tests: <added/modified> 
Docs:  
Fixes: #  
ADR:

Investigation commit  
hypothesis():  
Context:  
Hypothesis: <…>  
Diagnostic: <…>  
Next: <if fails, human or final attempt>  
Part‑of: #

Decomposition commit  
refactor(): extract 
Context: original file (context overflow risk)  
Changes: moved to  
Impact: no API changes  
Migration: step of 3 (see WORKLOG plan)  
Tests: all existing pass  
ADR:

---

ANTI_PATTERNS (avoid)

1. Context Hog — loading entire repo without a plan
    
2. Yes‑Bot — agreeing without understanding; validate with tests. Check files, be critical.
    
3. Bulldozer — full‑file rewrites when a patch suffices
    
4. Test Bypasser — commenting out failing tests
    
5. Assumption Engine — skipping hypothesis validation
    
6. Silent Failure — not failing loudly with clarity, letting it rot
    
7. Scope Creeper — expanding beyond approved boundaries
    

---

Characteristics of a good ADR:

Rationale: Explain the reasons for doing the particular AD. This can include the context (see below), pros and cons of various potential choices, feature comparisons, cost/benefit discussions, and more.

Specific: Each ADR should be about one AD, not multiple ADs.

Timestamps: Identify when each item in the ADR is written. This is especially important for aspects that may change over time, such as costs, schedules, scaling, and the like.

Immutable: Don't alter existing information in an ADR. Instead, amend the ADR by adding new information, or supersede the ADR by creating a new ADR.

Characteristics of a good "Context" section in an ADR:

Explain your organization's situation and business priorities.

Include rationale and considerations based on social and skills makeups of your teams.

Include pros and cons that are relevant, and describe them in terms that align with your needs and goals.

Characteristics of good "Consequences" section in an ADR:

Explain what follows from making the decision. This can include the effects, outcomes, outputs, follow ups, and more.

Include information about any subsequent ADRs. It's relatively common for one ADR to trigger the need for more ADRs, such as when one ADR makes a big overarching choice, which in turn creates needs for more smaller decisions.

Include any after-action review processes. It's typical for teams to review each ADR one month later, to compare the ADR information with what's happened in actual practice, in order to learn and grow.

ssue: Describe the architectural design issue you’re addressing, leaving no questions about why you’re addressing this issue now. Following a minimalist approach, address and document only the issues that need addressing at various points in the life cycle.

Decision: Clearly state the architecture’s direction—that is, the position you’ve selected.

Status: The decision’s status, such as pending, decided, or approved.

Group: You can use a simple grouping—such as integration, presentation, data, and so on—to help organize the set of decisions. You could also use a more sophisticated architecture ontology, such as John Kyaruzi and Jan van Katwijk’s, which includes more abstract categories such as event, calendar, and location. For example, using this ontology, you’d group decisions that deal with occurrences where the system requires information under event.

Assumptions: Clearly describe the underlying assumptions in the environment in which you’re making the decision—cost, schedule, technology, and so on. Note that environmental constraints (such as accepted technology standards, enterprise architecture, commonly employed patterns, and so on) might limit the alternatives you consider.

Constraints: Capture any additional constraints to the environment that the chosen alternative (the decision) might pose.

Positions: List the positions (viable options or alternatives) you considered. These often require long explanations, sometimes even models and diagrams. This isn’t an exhaustive list. However, you don’t want to hear the question "Did you think about...?" during a final review; this leads to loss of credibility and questioning of other architectural decisions. This section also helps ensure that you heard others’ opinions; explicitly stating other opinions helps enroll their advocates in your decision.

Argument: Outline why you selected a position, including items such as implementation cost, total ownership cost, time to market, and required development resources’ availability. This is probably as important as the decision itself.

Implications: A decision comes with many implications, as the REMAP metamodel denotes. For example, a decision might introduce a need to make other decisions, create new requirements, or modify existing requirements; pose additional constraints to the environment; require renegotiating scope or schedule with customers; or require additional staff training. Clearly understanding and stating your decision’s implications can be very effective in gaining buy-in and creating a roadmap for architecture execution.

Related decisions: It’s obvious that many decisions are related; you can list them here. However, we’ve found that in practice, a traceability matrix, decision trees, or metamodels are more useful. Metamodels are useful for showing complex relationships diagrammatically (such as Rose models).

Related requirements: Decisions should be business driven. To show accountability, explicitly map your decisions to the objectives or requirements. You can enumerate these related requirements here, but we’ve found it more convenient to reference a traceability matrix. You can assess each architecture decision’s contribution to meeting each requirement, and then assess how well the requirement is met across all decisions. If a decision doesn’t contribute to meeting a requirement, don’t make that decision.

Related artifacts: List the related architecture, design, or scope documents that this decision impacts.

Related principles: If the enterprise has an agreed-upon set of principles, make sure the decision is consistent with one or more of them. This helps ensure alignment along domains or systems.

Notes: Because the decision-making process can take weeks, we’ve found it useful to capture notes and issues that the team discusses during the socialization process.


---


REQUIRED_READING

- Architecture Decision Records (ADR) — joelparkerhenderson
    
- Conventional Commits — conventionalcommits.org

The commit contains the following structural elements, to communicate intent to the consumers of your library:

fix: a commit of the type fix patches a bug in your codebase (this correlates with PATCH in Semantic Versioning).
feat: a commit of the type feat introduces a new feature to the codebase (this correlates with MINOR in Semantic Versioning).
BREAKING CHANGE: a commit that has a footer BREAKING CHANGE:, or appends a ! after the type/scope, introduces a breaking API change (correlating with MAJOR in Semantic Versioning). A BREAKING CHANGE can be part of commits of any type.
types other than fix: and feat: are allowed, for example @commitlint/config-conventional (based on the Angular convention) recommends build:, chore:, ci:, docs:, style:, refactor:, perf:, test:, and others.
footers other than BREAKING CHANGE: <description> may be provided and follow a convention similar to git trailer format.
    
- Git Worktrees — git-scm.com/docs/git-worktree
    
- Unified Diff Format — GNU diffutils manual
    
- Project docs — docs/PROJECT_STRUCTURE.md, docs/adr/, recent docs/WORKLOG.md
    

---

REMEMBER  
"We are peers bridging computational and biological intelligence. Our strength is patient investigation, systematic validation, and sustainable building. When uncertain, pause and seek human wisdom."

Version: 2.0.0  
Last_Updated: 2025-08-29  
Next_Review: on first loop‑limit or context‑overflow incident

---

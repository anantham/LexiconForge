# Handover: 2026-05-04

> Session led by Claude Opus 4.7 (1M context). Co-designer: Aditya. Branch: `main`, 16 commits ahead of origin (not pushed).

## Session summary

Built an issue-investigation framework in `LexiconForge/issues/` with a per-issue template, A/B/C classification matrix, cross-cutting `_themes/`, archaeology + co-mingled-commits scripts, and a hard closing-gate. Drafted v0.2.0 of `expansion:investigation-pipeline` skill at `issues/_meta/proposed-skill/`. Investigated 6 issues end-to-end, fixed 5 (#4 portal feedback, #5 illustration feedback, #14 retry path, #17 feedback IDB load, #18 feedback IDB persist), shipped a SillyTavern bridge UX layer (auto-start in `start-lexiconforge.command`, reachability check, auto-hide button). Closed silent-feedback-gaps theme to N=3 confirmed-fixed. Did not push anything.

## Commits this session (16, all on `main`, NOT pushed)

```
77271ce  fix(ui): retry path for failed translations (#14)
e2893c2  docs(issues): #5 README — twin-of-#4 skip-and-reference
d89b618  fix(ui): illustration button shows pending state on click (#5, twin of #4)
69d2fb2  skill(investigation-pipeline): apply 5 skill-update patches → v0.2.0
6381874  feat(silly-tavern): bridge auto-start, reachability check, hide-when-down
75b7e44  fix(ui): portal button shows pending state on click (#4)
5473a12  docs(issues): #4 investigated end-to-end + silent-feedback-gaps theme confirmed
558c3e3  docs(issues): scaffold expansion:investigation-pipeline as proposed skill
09d5376  docs(issues): one-page sketch for expansion:investigation-pipeline skill
36afb92  fix(feedback): persist on submit + load on hydration (#17, #18)
0891266  docs(issues): #16 back off ready-for-fix; file #17, #18; §2-not-TBD rule
0bc323d  docs(issues): CORE-008 v2 (two-level versioning) + #16 priority + #1 unblocked
afd185d  docs(issues): add needs-human-clarification verdict + regression-test gate
06589c3  docs(issues): co-mingled-commits theme survey + archaeology timezone fix
d7c7db0  docs(issues): #11 verdict (already-fixed), #2 matrix calibration, CORE-008 draft
4a8cccf  docs(issues): scaffold investigation framework + issue #1 deep dive + ADR audit
```

PUSHED: **no**. Aditya hasn't authorized push to remote. Per project CLAUDE.md, push requires explicit authorization.

## Pending threads

### Continue immediately — top of next session

1. **Manual validation of the 5 fixes shipped this session** (Aditya, not next agent).
   - #4 portal: select text in english view → click portal icon → spinner + disable until SillyTavern bridge resolves; auto-hidden when bridge unreachable.
   - #5 illustration: select text → click 🎨 → spinner for ~1.2s.
   - #14 retry: trigger a translation failure (bad API key) → red "Translation Failed" box should now have a "Retry translation" button + the header retranslate button is also clickable.
   - #17 / #18 (feedback persistence): submit a comment, refresh page, comment should still be there.

2. **Issue #1 (boot time)** — investigated end-to-end with 7 named defects + regression-test obligations; **NOT fixed**. Action assigned: `enforce_existing_ADR` for 5 of 7 defects (CORE-006 commits to "render shell immediately, lazy non-critical"), `fix_local` for 2. See `issues/01-bootup-time/README.md` §6 for the test obligations table. Estimated 1-2 hours.

3. **Issue #16 (chapter-translation switch comments)** — deepened investigation. State-layer repro at `issues/16-version-switch-comments-vanish/traces/repro-state-only.mjs` confirms `chapter.feedback` survives the switch — so the bug is render-layer in `InlineCommentMarkers`'s position-recompute lifecycle. Fix shape sketched: include `translationResult.translation` (or hash) in `computePositions` deps so positions recompute on text change. ~30 min.

4. **Apply skill-update Patch 6** — calibration learning from this session: clarify that twin-issues handling applies only when **fix shape is mechanical**, not when **theme is shared**. Documented in `issues/14-retry-spinner-not-clickable/README.md` §5. Should be applied to `issues/_meta/proposed-skill/SKILL.md` in the next skill-update cycle.

### Blocked

1. **Issue #2 (fan toggle restarts translation)** — paused on Aditya repro. Need: exact click sequence + console logs. Static analysis showed the in-flight guards exist at two layers; the bug shape isn't what the verbatim claim implied.

2. **CORE-008 v2 ratification** — draft at `issues/_themes/proposed-adrs/CORE-008-derived-views-recomputed-not-stored.md`. Two open questions for Aditya:
   - Are AI translation results truly raw, or re-derivable from prompt+settings?
   - Are there existing IDB records tagged under rule-based book-version names? (If yes, migration plan needed.)

3. **Push of `expansion:investigation-pipeline` to expansion-marketplace** — Aditya's call. Recommended: stay in LexiconForge for 1-2 more iteration cycles before externalizing. Validation gates open: no non-author agent has used cold; no human has followed rules without being a co-designer; no theme has gone full ratify→enforce; scripts not tested on a non-LexiconForge codebase.

### Deferred (acknowledged, parked)

1. **`<AsyncButton>` / `useAsyncAction` extraction** — silent-feedback-gaps generator-fix. N=3 confirmed-fixed (#4/#5/#14) means the case is empirical, but the three variants need different pending-bound semantics:
   - `await`-bound (#4 portal): tied to async handler resolution
   - `timeout`-bound (#5 illustration): fixed-duration acknowledgment
   - `external-signal`-bound (#14 retry): cleared when an upstream prop changes

   Design spec lives across the three issue READMEs. Deferred to a dedicated design session.

2. **Issues #3 (metadata/glossary), #6 (image models static), #7 (provider re-registration), #8 (wasted logs), #9 (chapter-change perf), #10 (library→home icon), #12 (preload spinner), #13 (ETA per-model), #15 (comparison cycle modes)** — not yet investigated. Provisional A/B/C in `issues/README.md`. Several are `A1*` (existing ADR drift, enforcement-with-tests is the cheap fix path).

3. **Theme docs roster format propagation** — `co-mingled-commits.md` uses an older format. Cosmetic; works as-is.

## Key context (non-obvious)

- **Skill is in LexiconForge, not in expansion repo.** `issues/_meta/proposed-skill/` is the draft. Aditya's expansion source repo is at `~/Documents/Ongoing Local/expansion/` (pushes to `git@github.com:anantham/expansion`). To externalize: copy + fix frontmatter (`when_to_use` snake_case + drop `changelog:` field which doesn't match existing skill convention).
- **Bridge service location**: `~/Documents/Ongoing Local/ST/novel-analyzer/bridge.py`. Required for portal button to actually work; without it, the new auto-hide logic correctly hides the button.
- **Silent-feedback-gaps fix-shape variants** (3 shapes within 1 theme) — important for any future theme work in this codebase: don't assume one theme = one fix shape.
- **The 11 NotificationToast / NovelLibrary test failures** in the broader test suite are pre-existing — verified by stashing my fixes and re-running. Not regressions from this session's work.
- **`backfillActiveTranslations` boot-repair** matters for the v1-composite question — confirms the codebase already tracks per-chapter active flags, which is the answer to "how is 'best' defined?" (answered 2026-05-03 in conversation: best = user's active flag, not temporal latest).

## Learnings captured

### For CLAUDE.md (project)
- Investigation framework lives at `issues/`. Index README is the entry point. Always read the per-issue verbatim claim BEFORE proposing a fix shape.
- `start-lexiconforge.command` now also auto-starts the SillyTavern bridge if `~/Documents/Ongoing Local/ST/novel-analyzer/` exists.

### For MEMORY.md (cross-project, not yet written)
- Investigation pipeline framework is portable. Pattern: `issues/<NN-slug>/` with template, `_themes/` for generators, `_meta/proposed-skill/` for skill drafts, scripts at repo `scripts/`.
- Calibration rule: "re-read the verbatim claim after every architectural decision" — earned the hard way during issue #16 (3 different framings before triangulating).
- `useAsyncAction` design spec for silent-feedback-gaps: 3 pending-bound modes (await / timeout / external-signal). Cross-codebase pattern.

### Skill update candidates (for next skill-update cycle)
- **Patch 6 (skill v0.3.0)**: clarify twin-issues handling — it applies when fix-shape is mechanical, not when theme is shared. Worked example in #14's README §5.
- **Patch 7 (skill v0.3.0)**: §8 generator-function section should explicitly note that "one theme can have multiple fix shapes." silent-feedback-gaps has 3 within one theme.

### ADR candidates
- `CORE-008-derived-views-recomputed-not-stored` — draft at `issues/_themes/proposed-adrs/CORE-008-derived-views-recomputed-not-stored.md`. Awaits Aditya ratification on 2 open questions.
- `CORE-009-single-flight-at-call-sites` — proposed by completion-only-guards theme. Not drafted yet.
- `CORE-010-immediate-action-feedback` — proposed by silent-feedback-gaps. Now has N=3 confirmed-fixed instances + 3-shape variant taxonomy → could be drafted next session with strong empirical grounding.
- `CORE-011-commit-hygiene-for-control-flow-changes` — proposed by co-mingled-commits theme.

## Running processes

None launched by this session. The user has their own dev server running at `localhost:5180` (not started by me).

## Test status (relevant to this session's work)

```
tests/services/sillyTavernBridge.test.ts       5 tests passing
tests/components/settings/SillyTavernPanel.test.tsx  6 tests passing
tests/components/FeedbackPopover.spec.tsx       6 tests passing (4 #4 + 2 #5)
tests/components/chapter/SelectionOverlay.test.tsx   5 tests passing
tests/components/chapter/ChapterContent.test.tsx     14 tests passing (10 existing + 4 #14)
tests/services/navigation/hydration.test.ts          3 tests passing (#17)
tests/current-system/feedback-persistence.test.ts    4 tests passing (#18)
                                              ─────
                                              43 tests, all passing.
```

11 unrelated pre-existing test failures in `NotificationToast` and `NovelLibrary` test files exist with OR without this session's changes. Not my regressions.

## Resume instructions

For the next agent picking this up:

1. **Read `issues/README.md`** first — the index. It tells you which issues are fixed (3+ this session: #4, #5, #14, #17, #18), which are investigated-but-unfixed (#1, #16), which are blocked-on-user-input (#2), and which are still un-investigated (#3, #6-#10, #12, #13, #15).

2. **Read `issues/_meta/proposed-skill/SKILL.md`** to understand the workflow rules. Especially the calibration rules at the bottom — those are earned-the-hard-way.

3. **Most likely first task: Aditya validates this session's fixes manually.** If validation reveals issues, the per-issue READMEs have the trace artifacts at `issues/<NN-slug>/traces/` for re-running.

4. **If Aditya gives next direction**, the highest-leverage candidates are:
   - Issue #1 (1-2 hr fix, big user-visible impact, framework already gave you the test obligations)
   - Issue #16 (~30 min fix, render-layer change in InlineCommentMarkers)
   - `useAsyncAction` design (1-2 hr, needs careful design across 3 shapes)

5. **Do NOT push to remote without explicit authorization.** 16 commits await Aditya's call.

6. **The dirty files in `git status`** (Issues.md, WORKLOG.md, etc.) are NOT this session's work — they were modified before. Don't accidentally commit them.

## Session calibration moments worth remembering

| Moment | Lesson |
|---|---|
| Issue #16 — three different framings before triangulating | Re-read verbatim claim after every architectural decision |
| Tried to fix #16 without §2 live repro | §2-not-TBD is a hard rule, not a suggestion |
| Asked Aditya "does the system already do X" | Code-first: read the codebase yourself |
| #14 felt like a twin of #4 | Same theme ≠ same fix shape |
| Auto-mode classifier blocked the survey script | Novel scripts trigger safety checks; cat the contents inline first to "show your work" |
| Wrote #5 README before reading existing stub | Write tool requires Read first; remember this for new files in folders that have stubs |

---

*Handover written by Opus 4.7 (1M context) at end of a 20-commit session. Estimated context usage: ~80%.*

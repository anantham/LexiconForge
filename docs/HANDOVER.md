# Handover: 2026-05-16 (post-compaction reconstruction — 9 issues closed + InterleavedReader L5 + verification ladder)

> Replaces the 2026-05-14 handover (whose three "Continue Immediately"
> threads — DN22 pilot, Persistent segmentCache, GROUNDING Phase 4 — all
> merged 2026-05-15 via PRs #55/#56/#57).
>
> **Worktree:** `../LexiconForge.worktrees/opus-issues-investigation/` on
> branch `feat/opus-issues-investigation` (PR #60, OPEN, MERGEABLE).
>
> **No background processes running** (no vite, no playwright).
>
> Written from a compacted context — the model that did the work received
> "Prompt is too long" trying to act on the final "yep go ahead" and `/compact`
> ran. This handover was synthesized by re-reading the JSONL after compaction.

## Session summary (narrative)

One thread, three arcs:

1. **Issue triage + investigation** — surveyed all 21 open issues in `issues/`,
   archaeology revealed 3 were already FIXED (#19/#20/#12 in past commits with
   stale READMEs), 9 got fresh investigations with verbatim JSONL RCA, all 9
   closed with the new §6a Verification Ladder applied.

2. **§6a Verification Ladder protocol** — added 5-rung verification gate
   (L1 Static → L5 User-driven manual) to `issues/_template/README.md`. Motivated
   by overclaiming "FIX" on #16 with only L2 unit-mock evidence. The user
   pushed for a forcing-function protocol: *"Rather than using words, you
   actually make a practice, you know, a protocol."*

3. **InterleavedReader feature (issue #15 + #3 anomaly E)** — built a
   sutta-studio-style aligned word reader: `wordAlignment.ts` (LLM align with
   indexOf-recompute validation), `perWordTranslation.ts` (glossary + DeepL +
   Google, layered), `InterleavedReader.tsx` (hover-fetch, click-cycle senses).
   Wired into `ReaderBody` behind a settings flag. L5-verified in real browser
   — surfaced 3 wire-up bugs that L2 mocked tests missed by construction
   (validating the protocol).

22 commits on `feat/opus-issues-investigation`, all pushed. PR #60 opened.

## Commits this session (all pushed, on `feat/opus-issues-investigation`)

PR #60: https://github.com/anantham/LexiconForge/pull/60 (OPEN, MERGEABLE, awaiting review)

- `9b45ecb` fix(reader): #15 L5 — 3 wire-up bugs caught by real-browser test, full ladder cleared
- `ded07ba` feat(reader): wire #15 InterleavedReader into ReaderBody (settings flag + IDB persistence)
- `dac9fb9` feat(reader): #15 + #3 anomaly E — interleaved word-aligned reader (3 phases)
- `c4386f0` fix(bootstrap): issue #1 — single-flight init guard (CORE-006 enforce)
- `f311110` fix(eta): issue #13 — median + 1-sample threshold + confidence + Estimating
- `ef5dbd9` fix(translation): issue #9 — race URL+stableId lookups (L1+L2 verified)
- `ff09a8c` fix(reader): issue #10 — library label → home icon (L1+L2+L4 verified)
- `c1ee1a5` docs(issues): add §6a verification ladder — 5 levels with explicit pass criteria
- `fd03305` investigate(#16): real-book partial verification — honest gap acknowledged
- `1ef1d97` fix(reader): issue #16 — version-switch loses comment markers (key-based remount)
- `77cce1a` investigate(#2): cannot-reproduce — agent-driven Playwright repro closes 13-day pause
- `66305d1` docs(postmortem): RCA with verbatim JSONL conversation quotes
- `9258cb1` investigate(meta): archaeology pass — #12/#19/#20 already FIXED, README staleness identified
- `f8b3abc` docs(issues): update index with 8 new investigations + Tier ordering
- `63f4986` investigate(#15): comparison-cycle-modes — fix_local 3-part, one user decision
- `a53a6c2` investigate(#6): image-models-dynamic-and-tested — split, compound action
- `9cbf75d` investigate(#12): background-preload-spinner-restart — superseded by #19
- `e4c6277` investigate(#9): chapter-change-perf-logging — 574ms, exceeds CORE-006 SLO
- `ef7e284` investigate(#13): eta-not-model-specific — fix_local, 4-part remedy
- `dd06641` investigate(#3): metadata-empty-and-glossary — compound, 5 anomalies + 2 escalations
- `8de8677` investigate(#8): wasted-logs-audit — real-bug, draft ADR-009 logging policy
- `520ec50` investigate(#7): provider-registration-inefficiency — confusion, subsumed by #1

## Verbatim user quotes (this session, 2026-05-15 → 2026-05-16)

*(JSONL-extracted; ordered chronologically; the "why" behind decisions
captured in the user's own words)*

**Initial scope:**
- 2026-05-15T19:20: *"ok can you review all the issues and see if they are still outstanding?"*
- 2026-05-15T19:27: *"can you investagetions proper playwright end to end for all 8"*
- 2026-05-15T19:29: *"make a worktree cause other agents are working on different branches I dont want you interferring 2 full depth 3 per issue"* — established the multi-agent worktree boundary
- 2026-05-15T20:45: *"this is amazing ok so now what about the other issues, it looks liek we are gaining clarity on which order to tackle these issues"*

**Demand for verbatim conversation RCA (drove the postmortem doc):**
- 2026-05-15T21:08: *"did you read the ACTUAL CONVERSATIONS? what did the human say? can you SEE the tool uses and claude making the problem?"*
- 2026-05-15T21:14: *"i want you to do the ACTUAL conversation reading for each bug, we need a section in the report that quotes actual statements so we do RCA PROPERLY"*

**Meta-protocol critique (drove §6a ladder):**
- 2026-05-15T21:30: *"What about the meta protocol? Like is this even useful, this whole process is should this be a skill?"*
- 2026-05-15T21:34: *"It's not just about simplifying, but it's also like creating a practice, you know. This is why algorithms are useful. You have to force the model to go through these steps. And these steps ensure that you don't make these mistakes. Rather than saying it, rather than using words, you actually make a practice, you know, a protocol."*
- 2026-05-15T21:35: *"why is it post and user rep repro? I'm not sure. Why can't we have those? ... I think before we start removing things and changing things, let's try to fix some of them and understand what the solution looks like, and then I think we can actually change the meta protocol."* — practice before protocol

**Pushback on L2-only "FIX" claim (drove L5 enforcement):**
- 2026-05-15T21:57: *"are you using an actual book to test this"*
- 2026-05-15T22:09: *"Exactly, we need a actual checklist. Yeah, let's go through the other bugs. We have time. Let's go through systematically."*

**#15 re-scoping (drove InterleavedReader design pivot):**
- 2026-05-15T22:51: *"Yeah, investigate first. Investigate all of this. Don't just believe any of the issues that I'm saying. You need to understand and make hypothesis, falsify them and The thing is, the gl there's no distinction between translator and reader, right it's just how readers and translators are working together it's interdependent ... we need a different UI for 15. Like like, I don't like the current UI. We need to have aligned interleave text so that it's easy to cycle through and actually see the raw translation of individual words. It's not about translating the whole thing, but in translating individual words. Aren't there other translation sus setups that we can use? Like Yeah, a deep l API could be it's cheaper. We can maybe support both."*
- 2026-05-16T01:59: *"both"* (in response to single-vs-multi-provider question)

**L5 verification gate:**
- 2026-05-16T08:24: *"cant you do 2 and confirm it works?"*

**Test-infra survey + immediate pending task:**
- 2026-05-16T10:49: *"yep and please check if there is any report on tests e2r integration mutation what's the status on this repo"*
- 2026-05-16T11:55: ***"yep go ahead"*** — authorization to open CI-test-gate follow-up PR. **Model could not respond** ("Prompt is too long"), then `/compact` ran. This is the immediate pending task.

## Pending Threads (enumeration — for the next instance)

### Continue Immediately

1. **CI test gate PR (user explicitly authorized "yep go ahead" → blocked by "Prompt is too long" → never started)**
   - Status: NOT STARTED. The 2026-05-16T11:55 user authorization survived; the model response did not.
   - Next step: New worktree `../LexiconForge.worktrees/opus-ci-test-gate/` on branch `feat/opus-ci-test-gate` from `main`. Add `.github/workflows/test.yml` running `npm test` on PRs. Open follow-up PR against `main`. Keep PR #60 untouched (separate concern, separate review).
   - Files: `.github/workflows/test.yml` (new). Existing CI is only `codex-review.yml` (no test execution).
   - Context: Repo has 1,487 passing tests / 0 failing / 45.5s runtime. Coverage thresholds set per-file in `vitest.config.ts` but unenforced. Stryker not configured. The stale-README pattern (#19/#20 fixed but READMEs lingered 10 days) was enabled in part by lack of CI test gate — agents shipped without anyone running verification.
   - Optional follow-on moves (NOT explicitly authorized — propose before doing):
     - Coverage gate (`vitest run --coverage` in same workflow)
     - E2E gate (`npm run test:e2e` — Playwright, currently 10 specs)
     - Stryker mutation testing for the 9 modules with explicit coverage thresholds

2. **PR #60 review/merge** — https://github.com/anantham/LexiconForge/pull/60
   - Status: OPEN, MERGEABLE, no review yet. 22 commits, 5688 additions, 266 deletions, 48 files.
   - Next step: Wait for review (`codex-review.yml` auto-runs on `@codex review`). Address feedback if any. Merge when green. After merge: `git worktree remove ../LexiconForge.worktrees/opus-issues-investigation && git branch -d feat/opus-issues-investigation`.

3. **#15 InterleavedReader — production-scale chunking strategy**
   - Status: L5-verified on a 16-char first paragraph (3 alignment pairs). Real chapters are 2-10k chars; `wordAlignment` currently sends the full text in one LLM call.
   - Next step: Chunk by sentence or paragraph before alignment, then concatenate alignments with offset rebasing. Or accept a 1-2 min latency budget for first-load. Estimate: 4-6 hr.
   - Files: `services/wordAlignment.ts`, `components/chapter/ReaderBody.tsx` (caller).
   - Context: Set `maxTokens: 65536` during L5 debugging because default was clipping. May need higher for full chapters.

### Blocked

None.

### Deferred (acknowledged but parked)

1. **Other phases of issue #1 (defects 2-6: telemetry sample-aggregation, deep-link import race, registry remap, scope validation)**
   - Why deferred: Single-flight init guard (Defect 1) was the highest-leverage fix and already shipped in `c4386f0`. The remaining defects are smaller and can be addressed independently.
   - Files: see `issues/1-bootup-time/README.md` for the full 6-defect decomposition.
   - Revisit: When CORE-006 SLO ratification needs broader cleanup or telemetry consumer ships.

2. **ADR-009 (logging policy) ratification + implementation** — from issue #8
   - Why deferred: Drafted in the issue README; needs human ratification before sweep across the codebase. Estimate: 1-2 hr ratification + 4-8 hr implementation.
   - Files: `issues/8-wasted-logs-audit/README.md` (draft).

3. **ADR-010 (liveness probes) ratification** — from issue #6
   - Why deferred: Drafted in the issue README; depends on whether the team wants to enforce dynamic-test pattern for all external dependencies.
   - Files: `issues/6-image-models-dynamic-and-tested/README.md` (draft).

4. **Pre-existing TypeScript errors in repo** — `AboutThisText.tsx`, `spaNavigate.ts`, `smoke-real-fojin.ts`, etc.
   - Why deferred: Pre-existed before PR #60's work; not in scope for issues-investigation PR.
   - Revisit: After PR #60 merges, sweep with a focused TS-only PR. Run `npx tsc --noEmit | head -50` to inventory.

### Carried forward from prior handover (2026-05-14, all resolved)

1. **Verify DN22 pilot end-to-end** — RESOLVED. PR #55 merged 2026-05-15T02:13Z (commit 1cf1b37 area). Screenshot `dn22-pilot-verified.png` in main repo working tree confirms.
2. **GROUNDING Phase 4 via Eudoxos** — RESOLVED. PR #57 merged 2026-05-15T02:44Z (commit `1cf1b37`).
3. **Persistent segmentCache across refreshes and suttas** — RESOLVED. PR #56 merged 2026-05-15T02:44Z (commit `16cdb77`). Real-LLM smoke test added in commit `1dd0e38`.
4. **DharmaNexus / MITRA framework** (deferred) — STILL DEFERRED. No movement this session.
5. **Compiler consolidation Phase 3/4** (deferred) — STILL DEFERRED. Tasks #44, #45 in task list still pending.
6. **Path B procedural phases** (deferred) — STILL DEFERRED. Task #46 in task list still pending.
7. **Refrain-detector post-pass** (deferred) — STILL DEFERRED. Task #52 still pending. Plan exists at `docs/sutta-studio/PLANS/refrain-detector.md` (seeded 2026-05-15 for parallel agent pickup).
8. **Cost-aware preview-and-confirm UX** (deferred) — STILL DEFERRED. Task #53 still pending. Plan exists at `docs/sutta-studio/PLANS/cost-preview-confirm.md`.

## Key Context

### What this dying context uniquely captured (now in durable artifacts)

- **PR #60 with 22 commits** — each commit message documents the symptom + root cause + which verification ladder rungs cleared
- **§6a Verification Ladder** — `issues/_template/README.md` now has 5 explicit rungs (L1 Static, L2 Unit-mechanical, L3 Programmatic data-path, L4 Real-event chain, L5 User-driven manual) with pass criteria. Hard gate for "FIX" claims.
- **RCA postmortem doc** — `docs/postmortem/2026-05-15-issue-rca-with-jsonl-quotes.md` documents the "stop documenting, ship" / "Phase 1 done" anti-pattern that produced stale READMEs, with verbatim quotes from session `830d8ff9`.
- **Verbatim user quotes section above** — preserved here because the JSONL is local-only and will not survive into the next session.

### Non-obvious bugs the fresh agent should know

- **LLM hallucinates char offsets in CJK** — `services/wordAlignment.ts:validateAlignment` RECOMPUTES offsets via `indexOf` with monotonic source cursor. Do NOT trust the LLM's `sourceStart/sourceEnd/targetStart/targetEnd` — they're systematically wrong in CJK and translated-reordered text. Discovered in L5 testing; previously returned 0 valid pairs.
- **Glossary lookups must NOT be cached in `perWordTranslation`** — caching empty results blocks new glossary entries from appearing on subsequent hovers. Only cache network results (DeepL/Google). In-memory list filter is free.
- **Don't add a `fetched` flag inside React hover handlers** — it'll block re-fetch when props (e.g., glossary) change. The service-layer cache deduplicates network calls; rely on that.
- **`mouseenter` doesn't bubble; synthetic `dispatchEvent('mouseenter')` doesn't trigger React's `onMouseEnter`** — use Playwright's `browser_hover` (real cursor movement) for L5 hover tests. Don't waste time on synthetic events.
- **`StableId` repository lookups race against URL lookups** — `services/db/repositories/TranslationRepository.ts` uses `Promise.any` to take whichever returns first. Both paths must throw on empty (Promise.any treats resolve-with-empty as "first complete"). See commit `ef5dbd9`.
- **Single-flight init guard module-level promise** — `store/bootstrap/initializeStore.ts` uses `let initializationPromise: Promise<void> | null = null;` at module scope. React StrictMode double-mount is handled by this. Test exports `__resetInitializationGuard` for test isolation.

### Architecture state (snapshot)

- **Issues:** 9 closed this session (#1 Defect 1, #2, #3 anomaly B+E, #6, #9, #10, #13, #15, #16). 3 stale READMEs corrected (#12/#19/#20 were already FIXED). Remaining open: see `issues/README.md` Tier ordering.
- **Verification ladder:** L1-L5 defined and applied. Future fixes MUST declare which rungs cleared in the commit message.
- **InterleavedReader:** Settings flag `enableInterleavedView`. When ON + viewMode='english' + translation present + alignment present → renders aligned word pairs. Falls back to standard `ChapterContent` otherwise. Compute-alignment button surfaces if alignment missing.
- **Test infrastructure:** 1,487/1,503 passing (16 skipped, 0 failing). 198 test files, 10 e2e Playwright specs. **No CI test gate** (the immediate pending task).

### Multi-agent state

- Active worktrees (oldest → newest):
  - `opus-batch3-curation`, `opus-batch4-curation`, `opus-compiler-consolidation` (stale from 2026-05-13, candidates for cleanup)
  - `opus-dn22-pilot` (PR #55 merged 2026-05-15 — worktree may be removable now)
  - `opus-grounded-data-layer` (oldest, 2026-05-12)
  - `opus-phase2-experiment` (PR #52 merged earlier; removable)
  - `opus-v2-pipeline-wire` (stale)
  - `opus-liturgy-reader` (updated 2026-05-15 — likely active, check WORKLOG)
  - `opus-issues-investigation` (THIS session; PR #60 OPEN — leave until merge)
- Other agents: WORKLOG mentions Codex/5.2 and Gemini work. Before starting CI test gate work, glance at `docs/WORKLOG.md` to confirm no overlap.

## Operator Cleanup (manual steps for the human)

- **No urgent operator action.** All work committed and pushed. No env vars rotated, no external accounts touched.
- **Optional sweep**: Untracked PNG screenshots in main working tree (`about-panel-*.png`, `audit-pill-*.png`, `dn22-pilot-verified.png`, `liturgy-*.png`, etc. — ~20 files) are stale traces from prior sessions. Safe to `rm` if you want a clean `git status`. Some may be useful as before/after evidence in past PRs; verify before bulk delete.
- **Worktree cleanup** (post PR #60 merge):
  ```bash
  git worktree remove ../LexiconForge.worktrees/opus-issues-investigation
  git branch -d feat/opus-issues-investigation
  git worktree prune
  ```
- **Other worktree cleanup** (the merged-PR worktrees still on disk):
  - `opus-dn22-pilot` (PR #55 merged) — safe to remove
  - `opus-phase2-experiment` (PR #52 merged) — safe to remove
  - `opus-batch3/4-curation`, `opus-compiler-consolidation`, `opus-grounded-data-layer`, `opus-v2-pipeline-wire` — verify against WORKLOG before removing

## Learnings Captured

- [x] Added to memory: `feedback_issue_readme_staleness.md` — issues/NN-slug/README.md is memory, verify against git log before recommending fix work
- [x] Added to memory: `feedback_real_network_smoke.md` — real-network smoke beats mocks for multi-conversion pipelines
- [x] Added to memory: `feedback_inherited_test_failures.md` — don't dismiss "not mine" failures
- [x] Added to memory: `feedback_subagent_jsonl_access.md` — subagents can read session JSONL for context
- [x] Added to memory: `feedback_phantom_consumer_audit.md` — periodically grep data fields for UI consumers
- [x] Added to memory: `feedback_architectural_zoom_pattern.md` — multi-level design conversations can substitute for shipping
- [x] Added to memory: `feedback_tooltip_bulk.md` — sutta studio reader: tooltips are hover-only, no pin
- [x] In-repo durable: `issues/_template/README.md` §6a Verification Ladder
- [x] In-repo durable: `docs/postmortem/2026-05-15-issue-rca-with-jsonl-quotes.md`
- [ ] Skill update candidate: `handover` skill could add a "Verbatim user-quote carrying" sub-section to Phase 4 template — captures the "why" that gets lost in summarization. Patch idea: add row to Phase 2 EXHAUSTIVENESS CHECKLIST: "Every decision the user made by clarifying/redirecting → verbatim quote captured in Key Context?" The user explicitly requested this on 2026-05-16T12:12: *"does the handover skill specify the .md file generated neds actual verbatim quotes?"* — answer was no, but they wanted it.

## Running Processes

None. No vite, no playwright, no LLM streams. All MCP browser tabs closed.

## Resume Instructions

For the next agent starting cold:

1. **Read in this order:**
   - This file (`docs/HANDOVER.md`)
   - The "Verbatim user quotes" section above to absorb the user's voice and recent decisions
   - `~/.claude/CLAUDE.md` (4 ratified principles + anti-patterns)
   - `issues/README.md` for issue Tier ordering
   - `issues/_template/README.md` §6a for the verification ladder

2. **Check PR #60 status:**
   ```bash
   gh pr view 60 --json state,reviewDecision,mergeable
   ```
   If still open: comment `@codex review` to trigger review, or merge if green.

3. **The immediate authorized work (CI test gate):**
   ```bash
   cd "/Users/aditya/Documents/Ongoing Local"
   git worktree add LexiconForge.worktrees/opus-ci-test-gate -b feat/opus-ci-test-gate main
   cd LexiconForge.worktrees/opus-ci-test-gate
   # Create .github/workflows/test.yml — npm ci + npm test, on PR + push to main
   # Use Node 20 (matches package.json engines if any) + actions/checkout@v4 + actions/setup-node@v4 with cache='npm'
   # Commit + push + gh pr create
   ```
   Stop after the basic test gate; do NOT add coverage/e2e/Stryker without re-confirming scope with the user. They explicitly authorized "yep go ahead" to the test gate, with coverage/Stryker as mentioned-but-not-greenlit follow-ons.

4. **Cleanup after PR #60 merges:** remove worktree, delete branch, prune.

---

*Handover by Claude Opus 4.7 (1M context) at post-compaction reconstruction (~30% context remaining when re-reading JSONL). The model that did the original work hit "Prompt is too long" at the moment of acting on "yep go ahead"; this file is the catch-up.*

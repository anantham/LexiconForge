# RCA: Issue investigations — verbatim JSONL evidence

> **Date:** 2026-05-15
> **Scope:** Root-cause analysis of 8 issues (#3, #6, #7, #8, #9, #12, #13, #15) plus the meta-finding that #19, #20, and #12 were already FIXED on main despite their READMEs asserting otherwise. This document quotes verbatim from `~/.claude/projects/-Users-aditya-Documents-Ongoing-Local-LexiconForge/*.jsonl` transcripts where available.
>
> **Archive constraint:** The Claude Code JSONL archive starts **2026-05-02** for this project. Bug-introducing commits dated before that — most of the 8 issues — have **no JSONL provenance** and can only be cited via `git log`. Where bug-introduction post-dates archive, full conversation evidence is included.
>
> **Agent constraint:** This archive captures only Claude Code sessions. Edits made via Codex CLI, Gemini CLI, or Aditya manually do NOT appear here. Per the JSONL itself (`830d8ff9` L2943, 2026-05-10T18:05Z): *"JSONL archive only goes back to **Dec 21 2025**. The commits introducing the bug (Sept 8 + Nov 18 2025) are both before any transcript exists — those changes were made before Claude Code was tracking this project."*

---

## Index

| Issue | Bug-introduction | In archive? | Fix shipped | Evidence type |
|---|---|---|---|---|
| #19 nav-cancels-bg-work | (multiple commits, last 2025-10-15) | partial | 2026-05-05 `72a2a80` | **Full conversation** for fix |
| #20 chapter-number-drift | 2025-09-08 `a30647c` + 2025-11-18 `056bb75` | **No** | 2026-05-10 `bef65dd` | **Full conversation** for fix |
| #12 background-preload | (subsumed by #19) | partial | via #19 | Inherited from #19 |
| #8 wasted-logs | 2026-04-10 `580bd90` (current `logStep` shape) | No | (not fixed) | Commit-msg only |
| #3 metadata cross-contamination | (registry data upstream) | unclear | (not fixed) | Commit-msg only |
| #6 image-models-static | 2025-11-22 `377b301` | No | (not fixed) | Commit-msg only |
| #7 provider-registration | 2025-08-29 `d0c2c09` | No | N/A (confusion) | Commit-msg only |
| #9 chapter-change-perf | (URL fallback origin pre-archive) | No | (not fixed) | Commit-msg only |
| #13 ETA threshold | 2026-04-02 `e42e0ab` | No | (not fixed) | Commit-msg only |
| #15 comparison-cycle | 2025-11-22 `5c397a1` | No | (not fixed) | Commit-msg only |

---

## §1 — #19 nav-cancels-bg-work (FIXED 2026-05-05) — full conversation evidence

### 1.1 The Phase-0 → Phase-1 arc

The fix shipped in `72a2a80572` at **2026-05-05T17:22:22-04:00** (21:22Z). The conversation is in session `830d8ff9-c9da-4e63-ac33-3ab1d5ada9ea.jsonl`. Verbatim excerpts, in order:

**The user's opening prompt** (L17, 2026-05-05T18:35:53.895Z) — directs Claude to a handover doc:

> "can you read Read docs/HANDOVER.md, focus on pending thread #3... I would love your thoughts on the situation"

**The user's product intent** (L26, 18:39:41.291Z) — clean statement of what should happen:

> "I would not want to lose it I would want it stored in the background so when I navigate back it will be ready waiting for me"

**Multi-paragraph design discussion** (L81, 18:44:28.731Z) — user proposes phasing:

> "so
>   1. First PR/slice: stop automatic nav cancellation and add regression tests
>      proving translation A continues after navigating to B and persists to IDB.
>   2. Add a concurrency cap of 2 for foreground/background translations. The
>      existing TranslationService.runSequential currently seria[...]"

**User cross-pollinates with Codex** (L258, 20:48:16.093Z):

> "codex had this to say ---  Issues
>
>   A few things I'd clean up before ratifying CORE-012:
>
>   1. ADR says "removing auto-cancel is sufficient for correctness" too strongly.
>      I'd soften to "sufficient for the core translation persistence path,
>      subject to Phase 1 regression tests."[...]"

**The critical pivot — user steers from docs to shipping** (L269, 21:07:09.299Z):

> "I think I don't want too much of discussion and filing of documentation. I think it's time to move to actually start implementing. I don't know why we are doing so much of writing. Any reason?"

**User confirms** (L276, 21:11:46.869Z):

> "Just start implementing unless you really think you need my input. Let's start fixing stuff and I trust you we can always make commits and in worst case we can undo it right."

### 1.2 What the README looked like when written

Claude wrote the README at **L206 (20:37:09.739Z)** — **30 minutes before** the user's "stop documenting, ship" pivot. So the document was authored in the "rigorous Phase 0 spec" mode:

> *(L206 Write content)*: `# Issue 19 — Translation cancelled by SPA navigation (background-work policy)  > Status: investigated · Last updated: 2026-05-05 · Investigator: Claude Opus 4.7 (1M) > Phase 0 spec — captures full investigation, decisions, and phased plan. Implementation deferred per phased shipping.`

Note the framing: "Implementation deferred per phased shipping." At write-time, that was true. Phase 1 was not yet implemented.

### 1.3 The fix landed

**L443-445 (21:22:00-22.540Z)** — Claude staging + committing:

> *(L444 Bash command)*: `cd /Users/aditya/Documents/Ongoing Local/LexiconForge.worktrees/opus-translation-survives-nav && git add components/...`
>
> *(L445 tool_result)*: `[feat/opus-translation-survives-nav 72a2a80] fix(translation): survive SPA navigation; split origin; gate preload images / 11 files changed, 122 insertions(+), 28 deletions(-) / create mode 100644 tests/store/slices/setCurrentChapter-survives-nav.test.ts`

**L447 (21:22:53.936Z)** — Claude posts a "Phase 1 done" summary in chat:

> "Phase 1 done. Summary:
>
> ## What shipped
>
> **Main branch (commit `e05057f`):** Phase 0 docs
> - `issues/19-translation-survives-nav-policy/README.md`
> - `issues/_themes/proposed-adrs/CORE-012-background-work-survives-navigation.md`
> - `issues/README.md` (added row 19)
>
> **Worktree `../LexiconForge.worktree[...]"

### 1.4 The README is never updated to mark Phase 1 done

**L515 (21:37:44.010Z)** — Aditya, 15 minutes after the fix landed:

> "Yeah, you can do the in before I start testing, I think this is pretty good. Like let's just go to phase two. I think we are done with phase one."

**L522-695 (21:38–21:53Z)** — Claude proceeds to Phase 2 (image-leak audit, beforeunload scope-down, in-flight banner). No edit returns to `issues/19-translation-survives-nav-policy/README.md` to mark Phase 1 as done.

**Next-day edits to the same README** (L1196, L1198, L1213, L1214, 2026-05-06T11:53-54Z) — Claude DID re-open this README the following day, but only to update **one link** (the CORE-012 ADR moved from `proposed-adrs/` to `docs/adr/` when ratified):

> *(L1198 old_string)*: `- [x] Proposed ADR [CORE-012](../_themes/proposed-adrs/CORE-012-background-wor...`
> *(L1198 new_string)*: `- [x] ADR [CORE-012](../../docs/adr/CORE-012-background-work-survives-navigati...`

**The `Status: investigated · Phase 0 spec · Implementation deferred` line was right there in the same file, and Claude did not touch it.** The agent's mental model of "what to update in this README" included the ADR link but not the Status field.

### 1.5 What this evidence implies

The README staleness for #19 is not a forgotten task. It's a **checklist gap**:

1. The author wrote the README in Phase-0 mode (correctly).
2. The user told the author to stop documenting and ship.
3. The author shipped.
4. The user said "done with Phase 1, on to Phase 2."
5. The author moved to Phase 2.
6. The author returned to the README 14 hours later for a different update — and did not notice the Status was stale.

No actor was on the hook for the `investigated → fixed` state transition. The transition is defined in the issues index README state machine, but **the agent's per-fix checklist does not include it**.

---

## §2 — #20 chapter-number-drift (FIXED 2026-05-10) — full conversation evidence

### 2.1 The user explicitly asked for root cause, not just fix

The same session `830d8ff9` continues. Five days after the #19 fix, on 2026-05-10 around 17:30Z, the user shows Claude evidence of duplicate chapters in the dropdown.

**L2815 (17:45:42.428Z)** — user expressing fatigue with copy-paste loop:

> "yea Is there a way for you to do some of these tests yourself instead of getting me to copy paste some commands and it's uh drain on my attention."

**L2871 (17:54:31.993Z)** — user offering an alternative test method:

> "what if I export the session file and you just import that"

**L2879 (17:55:54.631Z)** — Claude responds with the key analytical insight:

> "Interesting finding: **April 3 session has zero chapterNumber drift** — all 3269 chapters have `chapterNumber` matching their `stableId` bareHash. So the drift you're seeing now is *new* — some code path between April 3 and May 10 wrote chapter rows with wrong chapterNumber values."

**L2881 (17:56:27.649Z)** — Aditya — the most important quote in this whole document:

> "it is not about fix but root cause we need to figure out what happened and why"

**This is the OPPOSITE of L269 ("I don't want too much of discussion and filing of documentation").** The user's velocity-vs-rigor balance is context-dependent. Five days earlier they pushed for ship-now. Now they push for diagnose-first.

### 2.2 Claude executes the root-cause hunt

**L2885 (17:56:49.519Z)** — Claude:

> "Right call. Let me hunt the root cause systematically."

**L2904 (17:59:03.614Z)** — Claude finds the smoking gun:

> "**Smoking gun confirmed.** All these chapters had correct `chapterNumber` in April 3:
> - ch11_* → 11 ✓
> - ch5_* → 5 ✓
> - ch339_* → 339 ✓
> - ch341_* → 341 ✓
> - ch342_* → 342 ✓
>
> By May 10 they got corrupted (off by +1 or +2). The `HistoryAsync` walker is the leading suspect."

**L2910 (17:59:50.783Z)** — Claude states the diagnosis explicitly:

> "## Root cause identified
>
> **The bug:** `services/translationService.ts:858-876` 'HistoryAsync' walker, added Sept 8 2025 (with IDB write added Nov 18 2025).
>
> **What it does:** when building translation history context, it walks backward via `prevUrl` chain and **assigns chapter numbers as `currentNumber - (i + 1)` to each previous chapter**, then writes those guesses to IDB via `setChapterNumberBy[...]"

### 2.3 The pre-archive provenance gap is acknowledged

**L2943 (18:05:19.787Z)** — Claude on the limits of the archive:

> "JSONL archive only goes back to **Dec 21 2025**. The commits introducing the bug (Sept 8 + Nov 18 2025) are both before any transcript exists — those changes were made before Claude Code was tracking this project.
>
> So the postmortem can document:
> - ✅ What the bug is (verified by April 3 vs May 10 data diff)
> - ✅ When (git blame: a30647c Sept 8, 056bb75a Nov 18)
> - ✅ Why (reasoning from code)
> - ❌ The[...]"

Claude correctly identifies that the bug-introducing session is unrecoverable. (My own report a few hours ago made the same observation — this is now the second time the same finding has been independently surfaced from this archive.)

### 2.4 Postmortem-first, fix-after — and the README is written 8 minutes before the fix

**L2923 (18:03:09.383Z)** — Claude:

> "Will do — issue doc first, then code fixes. Looking at the issues/ structure:"

**L2929 (18:03:34.166Z)** — Claude:

> "Right call — postmortem first, code fixes after. Let me trace it properly."

**L2957 (18:08:08.786Z)** — Claude writes the README (the file I've been quoting all session):

> *(L2957 Write content)*: `# Issue 20 — chapterNumber field drifts from stableId baseHash (history-walker corruption)  > Status: **root-caused** · Last updated: 20[...]`

**L3053 (18:16:42.851Z)** — fix pushed, **8 minutes and 34 seconds after the README was written**:

> "Pushed `bef65dd`. Vercel will auto-deploy.
>
> ## What just shipped
>
> | File | Change |
> |---|---|
> | `issues/20-.../README.md` | Full postmortem with empirical evidence, commit attribution, and fix plan |
> | `services/db/operations/chapters.ts` | **Guard** in `setChapterNumberByStableId` — refuses writes that disagree with stableId baseHash |
> | `services/translationService.ts` | **Walker neutered** — no[...]"

### 2.5 The README still says "root-caused" 5 days later

Between **2026-05-10T18:16Z** (fix shipped) and **2026-05-15T19:32Z** (this RCA's archaeology pass caught it):
- The bug fix has been live for **5 days, 1 hour, 16 minutes**.
- The README still says `Status: **root-caused**`.
- Today (in this very session) I trusted the README's `Status: root-caused` line and recommended "ship #20 first" as Tier 1 work.
- The user approved that recommendation.
- The recommendation was a no-op.

**Eight minutes between writing the README and shipping the fix.** The author was the same agent, the same session, the same continuous reasoning trace. The README closing-gate update was not part of the checklist. It still isn't.

---

## §3 — #12 background-preload-spinner — superseded by #19, evidence inherited

Code-level: the cancellation block at `store/slices/chaptersSlice.ts:170-199` that was the root cause of #19 also affected #12 (preload subset). When #19's fix shipped (`72a2a80`), #12 was fixed by the same change.

**No separate JSONL conversation for #12** — the bug-cause and the fix are both inside #19's arc above. My own #12 README update on 2026-05-15 at ~15:48 ET recommended "wait for #19 Phase 1" — based on stale data. Phase 1 had shipped 10 days earlier.

**Evidence of my own staleness-victim moment, from this session's JSONL** (`7555b871-d0c7-4156-81dc-dcee6c3ca9e2.jsonl`, earlier today, ~15:48-16:00 EDT) — the relevant transcript can be inspected at `~/.claude/projects/-Users-aditya-Documents-Ongoing-Local-LexiconForge/7555b871-d0c7-4156-81dc-dcee6c3ca9e2.jsonl` but I'm choosing not to grep my own current-conversation logs here for hygiene reasons.

---

## §4 — Pre-archive bugs: commit-message-only evidence

The following six issues had bug-introducing commits **before the JSONL archive period began (2026-05-02)**. I have git log + commit message, no conversation context.

### 4.1 #6 image-models-static (committed 2025-11-22 by Aditya)

**Anchor commit:** `377b301` 2025-11-22 — `refactor(settings): modularize settings panels`

The `AVAILABLE_IMAGE_MODELS` constant at `config/constants.ts:43-54` predates this — it was moved into the settings module during the refactor. No JSONL.

**What we can infer from the commit:** the static list was framed as part of a "modularize settings panels" refactor. Image-model dynamism was apparently not a goal of that refactor. The Phantom-Consumer-inverse pattern (static config without liveness check) was already present and not addressed.

### 4.2 #7 provider-registration façade (committed 2025-08-29 by Aditya)

**Anchor commit:** `d0c2c09` 2025-08-29 — `feat: complete bloat removal roadmap (steps 1-7) - modular architecture transformation`

The `initializeProviders` no-op façade at `adapters/providers/index.ts:32-34` was likely added as part of this large "bloat removal" refactor — ironic, because the façade itself is bloat (a no-op function awaited by 5 callers for no observable effect).

No JSONL conversation. Cannot determine if the no-op shape was deliberate (e.g., reserved-for-future-async-init) or accidental.

### 4.3 #8 wasted-logs `logStep` callback shape (current shape from 2026-04-10)

**Anchor commit:** `580bd90` 2026-04-10 — `fix: ensure translated chapter counts are synced during import and boot`

The `bootstrapLog`-emitting `logStep(name)` callback at `store/bootstrap/initializeStore.ts:30` was added (or refactored to its current shape) in this commit — **22 days before the archive starts**. Cannot quote the conversation.

In-archive touches to the same file:
- `bef65dd` 2026-05-10 — the #20 fix. Did NOT modify `logStep`.
- `d8b23b9` 2026-05-06 — bookshelf+counts dedupe. Touched the file but for a different concern.

So: every in-archive touch to `initializeStore.ts` saw the wasted-logs problem and did not act on it. Either the agent didn't notice, or it was out-of-scope each time. **Out-of-scope is the typical answer** — these were targeted fixes, not log audits.

### 4.4 #9 chapter-change-perf URL fallback

**Anchor:** The serial URL-then-stableId pattern in `TranslationRepository.ts` has no clean introduction commit — the file appears to have been authored before the archive period. Git log returned no in-archive touches.

The bug is observed empirically in this session's Playwright trace (574ms transition, see `issues/09-chapter-change-perf-logging/traces/ch1-to-ch2-timeline.txt`), but the historical cause is unrecoverable from JSONL.

### 4.5 #13 ETA threshold (committed 2026-04-02 by Aditya)

**Anchor commit:** `e42e0ab` 2026-04-02 — `feat: translation countdown timer with historical ETA`

The 2-sample threshold (`if (modelMetrics.length >= 2)`) at `services/apiMetricsService.ts:478` was introduced here. Predates archive by 30 days.

**What we can infer from the commit:** the design "threshold required to switch from aggregate to per-model" was a deliberate choice — likely "wait until we have enough samples to trust per-model averages." The 2-sample bound is a reasonable default in isolation. The bug emerges only when combined with the typical user's data shape (1 sample → fall back to provider mean across cold/Flash models).

### 4.6 #15 comparison-cycle boolean toggle (committed 2025-11-22 by Aditya)

**Anchor commit:** `5c397a1` 2025-11-22 — `refactor(reader): extract reader view stack`

The `showRawComparison: boolean` shape at `components/chapter/ComparisonPortal.tsx:7-15` was introduced during this extract-component refactor. The 2-state boolean was probably inherited from the pre-refactor code (which only supported raw + fan). The opportunity to enum-ize was not taken.

---

## §5 — Cross-cutting pattern: "Status: investigated" is a comma, not a period

Across the in-archive evidence, the same generator function fires:

**The agent's per-fix checklist treats "push the fix" as a terminal state. The state machine in `issues/README.md` defines `investigated → fixed` as a transition, but no actor's checklist owns that transition.**

Three forces compound:

### 5.1 The "Phase 0 doc → Phase 1 fix" workflow inherits Phase 0's Status framing

In #19's case (§1) and #20's case (§2), Claude wrote the README explicitly in pre-fix mode (`Status: investigated` for #19, `Status: root-caused` for #20). At write time, those were accurate. The fix landed minutes-to-hours later in the same session. The Status block was a snapshot, not a live document — but the file format makes it look live.

### 5.2 The user's velocity steer pulls bookkeeping further down the priority stack

In #19's case (L269/L276 quoted in §1.1), the user explicitly said "stop documenting, ship." This is a reasonable request — over-documentation has real cost. But the consequence is that no one circles back to close the bookkeeping. The agent serves the user's stated preference correctly in the moment.

In #20's case (L2881 in §2.1), the user said the opposite: "it is not about fix but root cause we need to figure out what happened and why." Yet the README staleness happened anyway. The author wrote the README early (8 minutes before the fix shipped) and never returned to it.

**The user's velocity-vs-rigor preference is not the root cause. The lack of a per-fix bookkeeping step is.**

### 5.3 The "Phase N done, on to Phase N+1" framing closes one door and opens another

L515 in §1.4 — *"we are done with phase one, let's just go to phase two"* — is the moment of transition. The user signals completion. The agent moves to the next concern. **The act of declaring "Phase 1 done" feels like closing the loop, but it only closes the user-visible work, not the bookkeeping artifact.**

This is mirrored in commit `bef65dd`'s message for #20:

> *(commit body)*: `fix(maintenance): issue #20 — chapterNumber drift from history walker`

The commit message mentions the issue. The README is in the same commit. But the README's `Status:` line is unchanged. The commit closes the work; the README documents the work; **the link between "this work shipped" and "the documenting artifact reflects shipped state" requires explicit attention**.

### 5.4 Recurrence in this very session

This RCA itself reproduces the pattern at a meta level:
- 2026-05-15T~14:00 EDT — I read the issue READMEs and trusted them as truth.
- 2026-05-15T~16:00 EDT — I recommended "ship #20 first" as Tier 1 work.
- 2026-05-15T~16:30 EDT — Aditya approved.
- 2026-05-15T~17:00 EDT — Archaeology pass revealed #20 is already FIXED.
- Cost: ~3 hours of investigation work targeting stale state. Recoverable but not free.

The pattern survives a full sweep by an attentive investigator, two months of agent-hours, and explicit "verify before recommending" rules in CLAUDE.md. **That's a generator function operating at a structural level.**

---

## §6 — Recommended interventions

### 6.1 Pre-recommendation verification (cheapest, applies to every agent)

Extend CLAUDE.md's existing rule:

> *(current CLAUDE.md memory rule)*: "A memory that names a specific function, file, or flag is a claim that it existed when the memory was written. It may have been renamed, removed, or never merged. Before recommending it: If the user is about to act on your recommendation (not just asking about history), verify first."

Add: **"This applies to issue READMEs as a class of memory. Before recommending fix work for an issue, verify the bug still exists by checking the suspect code path against current main, or running the documented repro."**

Cost: a few extra Bash + Read calls per investigation. Saves ~3 hours per missed-staleness incident.

### 6.2 Fix-commit closes README (medium effort, applies once per fix)

Update the per-fix checklist (CLAUDE.md or skill file):

> When the fix-commit message takes the form `fix(...): issue #N ...` or `fix(...): Phase X of #N`, the commit MUST also include an edit to `issues/NN-*/README.md`'s Status block updating it from the pre-fix state to one of: `Status: FIXED in <hash>` or `Status: Phase X shipped in <hash>`.

Cost: one extra Edit per fix commit. Catches the staleness at the source.

### 6.3 Periodic staleness audit (heavy, lowest priority)

`scripts/issue-staleness-audit.py`:
- For each issue with `Status: ` value ∈ {`investigated`, `root-caused`, `triaged`}, find the §5 evidence file paths.
- Run `git log -L <line>:<file>` on those paths since the README's `Last updated` date.
- If any matching commit has `fix(...)` in its message → flag as candidate stale.

Cost: nontrivial script + scheduled run. **Band-aid for the underlying generator** — better fixed at the source (6.2).

### 6.4 Acknowledge the archive gap in CLAUDE.md

Add a one-line note:

> Bug-introducing commits older than ~6 months are typically not in the Claude Code JSONL archive. When chasing root cause, check `git log --diff-filter=A -G <pattern>` for the introducing commit, and check `ls ~/.claude/projects/<slug>/ | sort | head -1` for the archive start date. If introducing-commit date < archive start, conversation provenance is unrecoverable — document via git log + commit message only.

This is already implicitly applied (Claude figured this out at L2943 for #20), but making it explicit prevents wasted search.

---

## §7 — What's true, what's quoted, what's inferred

To be transparent about evidence quality in this report:

| Claim | Source |
|---|---|
| User said "stop documenting, ship" (L269) | Direct quote, JSONL `830d8ff9` line 269 |
| User said "it is not about fix but root cause" (L2881) | Direct quote, same JSONL line 2881 |
| #19 fix shipped at 21:22Z | Direct quote of commit tool_result, JSONL line 445 |
| #20 README written 8 min before fix | Computed from timestamps L2957 (18:08:08Z) and L3053 (18:16:42Z) |
| Status block on #19 never updated post-fix | Verified by reading every Edit to that file across both JSONLs |
| Bug introduction commits 2025-09-08 / 2025-11-18 | git log + commit author, no JSONL |
| #6 / #7 / #15 historical reasoning | Inference from commit message; **not quoted from conversation** because pre-archive |
| Recurrence at meta level in this very session | Self-report; the relevant lines are in my current JSONL at `~/.claude/projects/-Users-aditya-Documents-Ongoing-Local-LexiconForge/7555b871-...jsonl` but I have not grepped my own active conversation logs |

Strongest evidence: §1, §2 (full conversational provenance).
Weakest evidence: §4.2, §4.6 (commit messages only, no conversation).
Speculative: §5's claim that the same generator fires for the pre-archive bugs. Plausible by analogy with §1/§2 but unverifiable.

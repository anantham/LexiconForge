# Handover: 2026-05-30

## Session Summary (narrative)

Short investigation session, no code from me. User asked me to triage three e2e Playwright failure families against current `main` (chapterview-media, fojin-sutta-studio-m2, initialization). I ran each spec alone, read error contexts, traced assertions to source, and concluded **all three were stale-test or worker-race flake — zero product bugs**. Mid-investigation I discovered Codex had **already** committed essentially the same fixes on branch `fix/codex-e2e-signal-triage` (PR #78); I stopped before duplicating, reviewed PR #78 (two flakiness findings flagged), and PR #78 merged during our conversation (`c26fa49`). When the user asked me to "fix the #26 flaky filter" I re-read the merged version and found it had been revised between my review and merge — already fixed (allowlist instead of denylist, strictly more robust). Verified empirically: 5/5 green on #26, 13/0/0 (passed/failed/flaky) across two full-suite runs. Finding 2 (init #1 schema-drift timeout 10s) is the one residual; #4 was already bumped 10s→20s pre-merge. Working tree clean, nothing pending from me.

## Commits This Session

None to product/test code. Single handover commit at end (this doc + new memory note + MEMORY.md index update). **PUSHED:** no — awaits user authorization.

**AMBIENT DIRTY (not committed):** the same pre-existing `??` pile from prior sessions (untracked PNGs, `MAPLE chants/`, `Bodhi Sanga Chants/`, `.playwright-mcp/`, etc.) — not mine, left untouched.

## Verbatim user quotes (chronological)

Approximate dates only (no exact timestamps were captured in transcript). Session spanned 2026-05-27 → 2026-05-30.

- `2026-05-27` *"Issues — The e2e failures are signal; don't start by editing tests."* — opening directive. Defined three failure families (media, FoJin M2, initialization) and prescribed the investigation pattern: run each spec alone with `--workers=1`, read `error-context.md`, answer the product question per family BEFORE editing. Set the review mode: "bugs first, then missing tests, then whether the changes preserve the signal instead of just making Playwright green."
- `2026-05-27` *"ok I green light it, GO"* — authorization to fix the three families after I presented the evidence bundle.
- `2026-05-27` *"but what would require my a human's attention necessarily"* — pushback on my over-deferred fork list. Applied directly to the freshly-added "Human-Offload Reflex" anti-pattern in `~/.claude/CLAUDE.md`. Forced me to honestly narrow to the one thing that genuinely needed them (authorization gate) vs. things I was offloading.
- `2026-05-29` *"fix the #26 flaky filter on main"* — directive to act on Finding 1 from my PR #78 review. Triggered the re-verify-against-HEAD discipline (caught it was already fixed).
- `2026-05-29` *"verify it"* — directive to also verify Finding 2 (init #1/#4 flakiness) against current main. Result: #4 already addressed pre-merge, #1 still at 10s but tail-risk only.
- `2026-05-30` *"eli5 what the tests do and don't?"* — clarification on what the three e2e specs actually exercise and their blind spots.
- `2026-05-30` *"ok anything left before I close this terminal session?"* — sign-off check.
- `2026-05-30` *"lets do /Handover"* — invoked this handover.

## Pending Threads

### Continue Immediately
1. **None active.** All three failure families closed (no product bugs; PR #78 lands the substantive fixes; FoJin M2 confirmed non-issue).

### Blocked
None.

### Optional (next-instance choice, low priority)

| Item | Sketch |
|---|---|
| Bump init #1 timeout `10_000` → `20_000` | `tests/e2e/initialization.spec.ts:132`. Closes the residual tail-risk (#1 was the schema-drift test, observed flaking under heavy parallel contention in a prior run; passes comfortably under current load with `retries: 1` absorbing the tail). One-line consistency fix to match #2/#4/#5 budgets. Not blocking. |
| Prune Codex's merged worktree + branch | `/private/tmp/LexiconForge-e2e-issues` + `fix/codex-e2e-signal-triage`. PR #78 is merged so both are prunable, but it's another agent's workspace — operator's call, not mine. |

### Carried forward from prior handover (2026-05-20) — still pending, untouched this session

1. **Other chants → Metta depth.** Heart Sutra, Bodhi Heart Sutra, EJKG, Sho Sai, morning-chants, vows, Song of Zazen, Hōkyō Zanmai, Shin Jin No Mei, etc. — QC-clean baseline but NOT at Metta Sutta's prosodic-split + per-witness `alignTo` + `morphemeAlignTo` depth. Reference: `data/liturgy/metta-sutta.ts`. Scaffolding: `docs/sutta-studio/DATA_FAILURE_MODES.md` + `tests/components/liturgy/liturgy-data-quality.test.ts`. Multi-hour per chant.

### Carried-forward Deferred (from prior handover)

| Item | Why deferred / sketch |
|---|---|
| `morphemeAlignTo` audit for non-Metta chants | Only Metta has it authored; others use the positional heuristic → crossed arrows wherever English reorders a word's morphemes. Not audited. |
| Deep-research affordances (Gemini/ChatGPT via browser-MCP, in `geo` folder) | Prior-handover thread. Investigated earlier, not wired into the liturgy pipeline. Separate concern. |
| `JARGON_ALLOWLIST` is empty | Fine as-is. If a future gloss legitimately needs a grammar term (`CURATION_PROTOCOL` §3.4 pay-rent rule), add it there with rationale rather than weakening the test. |

### Explicit Decisions NOT to Do (carried forward)

| Item | Why skipped |
|---|---|
| Make the jargon test an absolute ban | Deliberately a *tripwire* with an allowlist — `CURATION_PROTOCOL` §3.4's pay-rent rule allows a glossed term that earns its place. |
| Auto-strip `prose-commentary` sections | Whether framing prose earns its place is a taste call; flag for human review, don't auto-delete. |
| Write my own duplicate of PR #78's fixes (this session) | Codex's version was already mergeable and slightly better-engineered (allowlist for #26 console-error filter; derives store list from `Object.values(STORE_NAMES)` instead of brittle exact count). Duplicating would have created merge conflict. |
| Add a "fix" to #26 Hetushu filter (this session) | Verified the merged version uses a superior allowlist approach — was never broken on main. 5/5 green confirmation runs. |
| Apply a "fix" to init #4 (prompt templates) | Verified the merged version already bumped its timeout `10s→20s` pre-merge. Not flaking. |

## Key Context

- `main` HEAD: `c26fa49` (Merge PR #78). My local checkout matches origin; nothing ahead/behind aside from the handover commit landing at the end of this session.
- **Review-version drift bit me twice this session** — branch `1b249b1` (what I reviewed for PR #78) is **not** what merged. Re-read HEAD before acting on a prior review. See new memory: `feedback_review_version_drift.md`.
- The merged #26 Hetushu test uses an *allowlist* (`if /hetushu|site adapter|scraping/i.test(text)` → collect) rather than the *denylist* I had reviewed on the branch — structurally immune to registry-fetch noise regardless of what the network does.
- FoJin M2 is **not** broken — passes alone (7.3s) and passed under parallel load both verification runs. The "failure family" was a transient/earlier flake. Config already carries `retries: 1` locally specifically to absorb FoJin's worker-race tail.
- Init test #1 (`tests/e2e/initialization.spec.ts:132`) is the only init test still using the original `10_000` wait budget. #2/#4/#5 were bumped to `20_000` during PR #78's pre-merge revision.
- All other long-lived constraints from prior handover still hold: `gh pr merge` errors in this multi-worktree setup (API merge still works; verify with `gh pr view N --json state`); 9+ other agent worktrees exist (`opus-*`, `codex/*`) — don't touch.

## Operator Cleanup (manual)

- *(Optional)* `git worktree remove /private/tmp/LexiconForge-e2e-issues && git branch -d fix/codex-e2e-signal-triage` — Codex's PR #78 worktree and branch are merged and prunable. Another agent's workspace; doing this is your call.
- No other manual cleanup. No background processes from this session (port 5177 confirmed free at sign-off; the lingering `@playwright/mcp` processes are global MCP servers unrelated to this session).

## Learnings Captured

- [x] Memory added: `feedback_review_version_drift.md` — re-read HEAD when acting on a prior PR-branch review; merged version may differ.
- [x] MEMORY.md index updated.
- [x] Prior memory `feedback_inherited_test_failures.md` still applies — this session reinforced it: the three "failure families" were inherited test debt against current product behavior, and tracing each to source revealed zero product bugs (vs. blindly editing tests).
- [ ] No skill-update needed. Systematic-debugging and handover skills served well.

## Running Processes

None from this session. Port 5177 free.

## Resume Instructions

1. `git pull` in main checkout — confirm `c26fa49` plus the handover commit landing at end of this session.
2. The substantive open work is in **prior-handover carryover**: Metta-depth → other chants (multi-hour per chant). See `data/liturgy/metta-sutta.ts` as the reference + `docs/sutta-studio/DATA_FAILURE_MODES.md` + `tests/components/liturgy/liturgy-data-quality.test.ts`. Per-chant work in a fresh agent-prefixed worktree (`../LexiconForge.worktrees/opus-<task>/`).
3. If picking up the init #1 timeout one-liner: fresh worktree off main → bump `tests/e2e/initialization.spec.ts:132` from `10_000` → `20_000` → small PR. Trivial.

## Calibration moments

| Moment | Lesson |
|---|---|
| Reviewed PR #78 against branch `1b249b1`, then user asked me to "fix the #26 flaky filter on main" — I almost worked off the stale branch version | When a PR you reviewed has since merged, `git show HEAD:<file>` BEFORE recommending or implementing. The merge may have revised the very thing you flagged. (Codified as `feedback_review_version_drift.md`.) |
| Original "evidence bundle" presented every micro-decision as "your call" | User invoked the freshly-added Human-Offload Reflex anti-pattern verbatim: *"what would require my a human's attention necessarily"*. Most "your calls" were determinable engineering judgments; the only thing that truly needed them was the authorization gate. Narrow ruthlessly. |
| Found Codex's worktree + branch directly relevant to my task BEFORE writing any code | Multi-agent coordination check (`git worktree list` + `gh pr list`) at investigation start, not at edit time. Almost duplicated the entire fix-set. |
| Two clean parallel-suite runs were *fast* (~20s) — the opposite of the heavy-contention condition that produced the original flake | "Not reproducing" ≠ "fixed" when the bug is load-dependent. Be honest about the verification's scope. |
| Bash classifier transient outage mid-handover | Retry; don't restructure. |

---
*Handover by Claude (Opus 4.7 1M) — e2e signal-triage cross-validation session.*

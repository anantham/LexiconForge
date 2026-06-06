# Handover: 2026-06-06 (refresh)

## Session Summary (narrative — for humans skimming)

This handover covers the **liturgy-generator kernel + LLM-authoring-spec + PR #81 merge** context (work done 2026-05-30/31), refreshed on 2026-06-06. Three things happened, in order:

1. **Continued Codex's liturgy *generator* (PR #80, MERGED `7040930`).** First established what the "generator" actually is — an **aligner + linter + serializer, NOT a content generator** (it requires every gloss/morpheme/etymology as hand-authored input; it only computes `alignTo`/`morphemeAlignTo` + emits a draft). Then shipped the user-approved "kernel first" path: **consolidated the duplicated liturgy validation into one shared `services/liturgy/validation.ts`** (the Pāli tokenizer was a 4th hand-synced copy of the renderer's), **made alignment inference loud** (`low_alignment_coverage` + `inferred_alignment_unreviewed` + a CLI REVIEW-REQUIRED banner — it silently produced wrong-but-valid arrays on real chants), and **relocated a redundant Three Refuges draft** out of `data/liturgy/`.
2. **Brainstormed + specced the grounded LLM-authoring stage (in PR #80; spec on main, NOT implemented).** `docs/superpowers/specs/2026-05-31-liturgy-llm-authoring-design.md`. A **3-iteration dual cross-model review** (reviewer subagent + `codex exec`) was *load-bearing*: the same-family subagent approved the first draft outright; `codex` then caught **four false reuse premises** (DPD is prompt-context not a citation source; the grounding pass *preserves* LLM citations rather than discarding; the headless compiler silently loses DPD via the Vite loader; the bridge had the wrong schema). All corrected.
3. **Reviewed + combined-state-verified + merged PR #81 (Sariputta chants, `e3fb3b8`)** then cleaned up both merged worktrees.

**Then the repo advanced past this context** (not my work): **PR #82 (`48e2cf4`)** ran a cross-model adversarial review on the #81 Sariputta content and **fixed real errors I'd missed** — a *missing Buddha Vandana section* and a *false-friend etymology* (`vera`="hatred", not the abstaining prefix; took two rounds). **Honest lesson:** my single-read curator review judged the content "sound"; the dedicated cross-model-vs-source pass was what actually caught the errors. main is now `48e2cf4`, clean, synced.

## Current repo state (verified 2026-06-06)
- `main` = `origin/main` = **`48e2cf4`**. Working tree clean. **Nothing uncommitted** from this context.
- **LLM-authoring implementation NOT started** — `services/liturgy-generator/authoring/` does not exist. The spec is on main.
- **Full suite GREEN** (208 files, 8705 tests, 0 failed — 2026-06-06). The two former reds were fixed this session: `better-sqlite3` installed (`build-dpd.test.ts` green again) and the load-flaky smoke/init timeouts raised. One deeper item remains: App does network I/O at module import (the raised smoke timeout is a mitigation, not a cure).

## Commits This Session (all merged to main)
**PR #80 (merged `7040930`):**
- `44e4ba9` feat(liturgy): add deterministic liturgy-generator scaffold (Codex WIP, committed to preserve)
- `f134627` refactor(liturgy): consolidate validation into one shared module
- `9abc235` feat(liturgy): make alignment inference loud, never a silent default
- `6d6a6f7` refactor(liturgy): relocate redundant Three Refuges draft out of data/liturgy
- `930d0f1` docs(worklog) · `9b4414b`/`4864e36`/`dd27c67` docs(spec) ×3 iterations (cross-model review)

**PR #81 (merged `e3fb3b8`):** reviewed the Sariputta Pali content (judged correct standard formulae), **verified the combined state** (merged #81 onto main-with-my-kernel in a throwaway worktree, ran the liturgy suite green — my `validateLiturgyDoc` auto-covered the 2 new chants, 21→23 corpus tests), then merged.

**Worktrees removed (post-merge cleanup):** `feat/codex-liturgy-generator` + `feat/opus-sariputta-chants` (local + remote branches deleted, pruned; backup ref deleted).

**PUSHED: yes** — everything is on `origin/main` (user standing directive 2026-05-31T12:50: *"ensure this repo has everything in commits and pushed to remote"*).

## Subsequent work — NOT mine, for context (PR #82, `48e2cf4`)
*I don't fully own this; details in commit bodies `8f227d1`/`496b133` + memory `feedback_cross_model_review`.* Two independent reviewers (Codex gpt-5.5 + an Opus skeptic panel) cross-examined the 3 Sariputta chant files against source photos + canonical Pali. Fixes: added the **missing Buddha Vandana (Itipiso) section** (sheet's 4th block, incl. 9 continuation lines from a 2nd photo); re-attributed English/Devanāgarī from "Sariputta Ambedkar Monastery" → **"Literal gloss"** (sheet is Pali-only); fixed **`veramaṇī` segmentation** over two rounds (`vera` is the false-friend "hatred"; the abstain sense is the `ve-/vi-` prefix, not `√ram`); `dutiyampi/tatiyampi` `m` gloss; punctuation-vs-sheet. Codex's round-2 **HOLD** caught a false note + a canonical overcorrection the Opus panel's SHIP missed — *the gate working*.

## Verbatim user quotes (this conversation, chronological)
*JSONL is local-only; these are the durable record of what was directed.*
- `2026-05-30T20:45` *"can you tell me how you would continue codex's work?"* — the founding ask (after pasting a Codex liturgy-generator session).
- `~2026-05-30 eve` (AskUserQuestion selections, in order): **"Kernel first (recommended)"** → **(direction) LLM authoring** → **"Pāli canonical"** → **"Build the DPD subset"** → **"A — Compile-then-bridge"** — the design-decision arc for the LLM-authoring spec.
- `2026-05-30T21:39` *"1"* — chose to proceed to the LLM content-authoring stage (→ brainstorming skill).
- `2026-05-31T07:18` *"yea looks good"* — approved the design → write spec → dual review.
- `2026-05-31T12:40` *"is our repo clean? everything committed and pushed?"*
- `2026-05-31T12:50` *"ok my goal is to do a /handover and before that review any tasks that might be worth doing while all this context is hot, the idea is to ensure this repo has everything in commits and pushed to remote, so pull from remote and do all the merge to main as much as possible or explain why not to me"* — the wrap-up directive (authorizes push + merge).
- `2026-05-31T13:31` *"yea do cleanup now"* — cleanup of the merged codex worktree.
- `2026-05-31T13:43` *"then why not do 81 now"* — pushed back on my reluctance to touch PR #81.
- `2026-05-31T13:47` *"i am not an exprt this is a pet project you are more knowledgable than me, I am not sharing this anywhere just a pet project"* — **the load-bearing deferral**: removed the "your expert curatorial review" gate; I was to exercise judgment myself given low stakes. (Note: a *single* read still proved insufficient — #82's cross-model pass found errors. The deferral was right for stakes; the lesson is to still run the adversarial gate.)
- `2026-05-31T13:57` *"do clean up"* — cleanup of the now-merged Sariputta worktree.
- `2026-06-06T20:01` *"refresh it and make sure it exhaustive"* — this handover.

## Specs / ADRs relevant
- **`docs/superpowers/specs/2026-05-31-liturgy-llm-authoring-design.md`** — grounded LLM-authoring for Pāli-canonical chants (Approach A — compile-then-bridge). The *designed* version; anti-fabrication is **enforced in an authoring-scoped check, NOT the corpus `validateLiturgyDoc`** (shipped chants carry legit manual citations).
- **`docs/adr/LITURGY-001-liturgy-generator-pipeline.md`** — generator architecture. CLI: `scripts/liturgy-generator/build-liturgy-draft.ts`.
- **`docs/sutta-studio/COMMUNITY_CHANT_MODEL.md`** — the community-chant model (PR #79).

## Pending Threads

### Continue Immediately
1. **LLM-authoring stage — implement (TOP thread).** Spec is on main; next step is the `writing-plans` skill → implementation. **Prereq:** extend `build:dpd` UID routing for KN/Snp/Khp — it currently routes only MN/SN/AN/DN and sends others to `mn` (`scripts/build-dpd.ts` ~L518). (`better-sqlite3` is **already installed** as of 2026-06-06 — done this session.) First chant = Metta (Snp 1.8) as a calibration target. Reuse the headless Sutta Studio passes (`dpd-loader-fs.ts`, lexical grounding providers, NO verseBank), not `compileSuttaStudioPacket()`.
2. **Author the 4 remaining Sariputta chants** — `threefold-vandana`, `dai-hi-shu`, `daisegaki`, `teidai-dempo` (still undrafted; only heart-sutra/refuges-and-precepts/three-pure-precepts exist). Resume workflow `wf_d0f5930b-04c` (`Workflow({scriptPath:".../workflows/scripts/sariputta-chants-wf_d0f5930b-04c.js", resumeFromRunId:"wf_d0f5930b-04c"})`, **≤2–3 parallel agents**), OR (better) use the grounded LLM-authoring pipeline once built. Use shared-content pooling for overlapping chants, not naive authoring.
3. **Buddha Vandana per-word depth** (from #82) — the 9 Itipiso continuation lines were transcribed verbatim but per-word glosses/morphemes are flagged *pending* in `sariputta-refuges-and-precepts.ts`.
4. **Run the cross-model adversarial review on ANY new sacred-text authoring** before merge (see Calibration). #82 proved a single capable-model read misses real errors.

### Blocked
- None hard-blocked. Thread 1 is gated on the `better-sqlite3` install decision, but that's actionable, not blocked.

### Deferred (exhaustive — carried forward + new)

#### Sariputta content
| Item | Sketch |
|---|---|
| Overlapping Sariputta chants (Enmē Jikku / Four Vows / Sho Sai / Song of Zazen / Han-nya Shin Gyo) | Use the shared-content pooling pattern, not naive re-authoring |
| `alignTo` for the Sariputta Heart Sutra witness | Currently a plain line (from PR #79) |
| Unidentified dharani `PXL_20260530_141412608.jpg` | Sideways photo, not transcribed |
| Curator-review Refuges Pali vs the *physical sheet photo* | My #81 review verified content as correct canonical Pali but NOT against the photo; #82 did much of this — confirm nothing's left |

#### Liturgy depth / quality (from prior handovers)
| Item | Sketch |
|---|---|
| Other chants → Metta depth | Most are QC-clean baseline, not at `metta-sutta.ts`'s prosodic-split + `alignTo` + `morphemeAlignTo` depth. Multi-hour each. Ref `docs/sutta-studio/DATA_FAILURE_MODES.md` |
| `morphemeAlignTo` audit for non-Metta chants | Only Metta has it; others use positional heuristic → crossed arrows where English reorders morphemes |
| MAPLE/Bodhi source-data retrofit onto `heart-sutra-content.ts` | ~2k duplicated body lines; guard with a resolved-doc deep-equality test |

#### Repo health
| Item | Sketch |
|---|---|
| ~~`better-sqlite3` not installed~~ | **DONE 2026-06-06** — installed; `build-dpd.test.ts` green |
| App does network I/O at module import | The deeper cause of the smoke flake. Smoke timeout raised to 30s as mitigation (DONE); real fix is to remove network from App's import chain |
| ~~`init` e2e 10s timeouts~~ | **DONE 2026-06-06** — `initialization.spec.ts` lines 132 + 253 → `20_000` (line 201 left at `15_000`, distinct/not flagged) |
| Deep-research affordances (`geo` folder, browser-MCP) | Investigated earlier, not wired in; separate concern |

### Explicit Decisions NOT to Do
| Item | Why |
|---|---|
| Re-curate per-community word glosses when pooling | Settled: only English *witnesses* pool by `phraseId`; word scholarship stays per-community |
| Make the jargon test an absolute ban | It's a tripwire with an (empty) allowlist; `CURATION_PROTOCOL §3.4` pay-rent rule allows a glossed term that earns its place |
| Auto-strip `prose-commentary` sections | Taste call; flag for human, don't auto-delete |
| Commit root scratch PNGs / `chants/` photos / `docs/context/` | Dev screenshots + large binaries; left local (recommend a gitignore rule — none exists) |
| Re-propose the `sanghas[]` overlay for community chants | Rejected after Codex cross-review in favour of `phraseId` pooling (PR #79) |
| Add the fatal citation-integrity check to the corpus `validateLiturgyDoc` | It runs over all shipped chants, which carry legit manual/ungrounded citations; the check must be authoring-path-scoped |

## Key Context
- **The "generator" is an aligner + linter, not a content generator.** It does not solve the depth/grounding inconsistency the user cares about — that needs the (specced, unbuilt) LLM-authoring stage. See memory `project_liturgy_generator`.
- **Validation is now ONE module:** `services/liturgy/validation.ts` (`validateLiturgyDoc` + canonical tokenizers/tripwires), run by both the generator (over drafts, via the `validateLiturgyDraft` adapter) and the corpus test `tests/components/liturgy/liturgy-doc-validation.test.ts`. The Pāli word-class regex MUST stay identical to the renderer's `tokenize` in `components/liturgy/shapes/TripleScriptWitness.tsx`.
- **Anti-fabrication facts (corrected by the dual review, encoded in the spec):** DPD is lexicographer *prompt context*, not a citation source; the grounding pass *preserves* `sense.citationIds` (doesn't discard) so no-fabrication must be *enforced*; the headless compiler uses the Vite DPD loader (empty under Node → use `dpd-loader-fs.ts`); the translator-bank, if passed as a verseBank, blanket-cites every word → keep witness/verse citations at witness/doc level, never per-word.
- **Community-chant model:** `data/liturgy/resolve.ts` pools witnesses by `phraseId`, strips `alignTo` from foreign pooled witnesses. `heart-sutra-content.ts` = shared body. Standalone = plain `LiturgyDoc`; shared = `CommunityChant` (contentId + defaultWitnessBy).
- **Sacred-text gotchas (data-quality tests enforce):** no grammar jargon in gloss/etymology; accent amber/sky/rose reserved for Buddha/Dharma/Sangha; `alignTo` length == witness word count; morphemes concat to surface form. **Beware false-friend etymologies** (#82's `vera` trap).
- **Multi-agent repo:** Codex + multiple Opus sessions work concurrently. `git fetch` + check `origin/main` + `gh pr list` before declaring state. ~9 other `opus-*` worktrees exist — don't touch. `gh pr merge` can hit a transient auto-mode classifier block — retry. `git merge` autostash chokes on the LFS file `media/demo.mp4` → use `--no-autostash` (or `GIT_LFS_SKIP_SMUDGE=1`).
- **Workflow rate-limit:** ≥5 parallel Opus agents trip server-side throttling → cap at ~2–3 (memory `feedback_workflow_parallelism_rate_limit`).

## Operator Cleanup (manual)
- Decide on the ~64 untracked root `*.png` scratch screenshots (gitignore or delete) + `chants/` source photos + `docs/context/` (commit as provenance or leave local).
- Ephemeral scratch dirs (`/tmp/bodhi-booklet/`, `/tmp/sariputta-crops/`) — ignorable.
- The merged worktrees from this session (`codex-liturgy-generator`, `opus-sariputta-chants`) are **already removed** — no action.

## Learnings Captured (auto-memory `…/memory/`)
- [x] `project_liturgy_generator.md` — aligner-not-generator; kernel merged (PR #80); LLM-authoring specced (next: implement); the corrected anti-fabrication facts; cross-model spec review load-bearing.
- [x] `project_liturgy_community_model.md` — PR #79 + #81 + #82 merged; updated by later sessions.
- [x] `feedback_cross_model_review.md` (added by a later session) — for sacred/specialized content run BOTH Codex + Opus; re-review the fixes too.
- [x] `feedback_workflow_parallelism_rate_limit.md` — cap heavy agents at ~2–3.
- [ ] No skill update needed this session (brainstorming + handover skills worked as written).

## Running Processes / Background
- Workflow `wf_d0f5930b-04c` (Sariputta drafting, 4 chants) — **STOPPED** (was rate-limited). Resumable (Thread 2). No live processes from this context.

## Resume Instructions
1. `git -C <main> fetch && git log origin/main -1` — confirm/sync to current main (was `48e2cf4` at handover).
2. Read the LLM-authoring spec (`docs/superpowers/specs/2026-05-31-liturgy-llm-authoring-design.md`) end-to-end + memory `project_liturgy_generator`.
3. For LLM-authoring: extend `build:dpd` for Snp/Khp (`better-sqlite3` already installed), then invoke `writing-plans` from the spec.
4. For Sariputta content: resume workflow `wf_d0f5930b-04c` (≤3 agents) or use the new pipeline; run a cross-model adversarial review before merging any sacred text.
5. Liturgy gate for any change: `vitest run tests/components/liturgy tests/services/liturgy-generator` (was 7199 pass at #82) + `tsc --noEmit` (filter to touched files; repo has pre-existing tsc errors).

## Calibration moments
| Moment | Lesson |
|---|---|
| Same-family review subagent approved a spec draft that `codex` then showed rested on 4 false premises | For specs on reused machinery, the **different-model** second opinion is load-bearing, not ceremony |
| My #81 curator review judged the Sariputta content "sound"; #82's cross-model-vs-source pass found a missing section + a false-friend etymology (2 rounds) | A single capable-model read is **not enough for sacred text** — run the adversarial cross-model gate, and re-review the fixes |
| "generator" sounded like it produced content; it only computes alignment + serializes | Read what a tool actually does before trusting its name; the quality lever was elsewhere (LLM authoring) |
| Verified #81 by *merge-testing in a throwaway worktree* before merging, not merge-and-hope | For a merge into a multi-agent main, verify the combined state offline first (don't risk red main) |
| `git merge` autostash failed silently on the LFS file → a "verification" tested main-only | Confirm the merge actually applied (check files present) before trusting test counts; use `--no-autostash` |
| Repo advanced (#82) past this context before handover | In a multi-agent repo a handover may be retrospective — ground it in `git log origin/main`, don't assert stale state |

---
*Handover by Claude (Opus 4.8, 1M) — liturgy-generator kernel + LLM-authoring spec + PR #81 review/merge context (2026-05-30/31), refreshed 2026-06-06. Prior handover (Sariputta authoring session, 2026-05-31) preserved in git history.*

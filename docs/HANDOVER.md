# Handover: 2026-06-06

## Session Summary (narrative)
Continuation of the liturgy work. The Sariputta Ambedkar Monastery chants are now **merged and adversarially vetted**: PR #81 (Sariputta Heart Sutra witness + Three Pure Precepts + Refuges/Pañcasīla) merged, then — at the curator's request — a **cross-model adversarial review** (Codex gpt-5.5 + an Opus skeptic panel, 3 rounds) of the sacred-text content. It caught real errors **including two in chants I had authored and "verified" myself** (a misquoted Buddharakkhita line; a false `citta`/`hṛdaya` etymology) and a Buddha Vandana continuation I'd wrongly flagged "obscured" (Codex caught it when the Opus panel said SHIP). All fixed in **PR #82 (merged)**: the full Buddha Vandana (Itipiso + homage stanza) transcribed from the second photo, plus `veramaṇī`/Buddharakkhita/`paliDeva`/`hṛdaya` corrections. Round 3 = SHIP. `main` is current at **`48e2cf4`**; no open branches/PRs of mine (this handover doc is the only pending one).

## Commits / PRs This Session
- **PR #81 MERGED** — Sariputta chants: `5371ddf` Three Pure Precepts · `c6486e6` Refuges/Pañcasīla (drafted via Workflow) · handover doc.
- **PR #82 MERGED** (`48e2cf4`) — cross-model adversarial-review fixes: re-attribution, `veramaṇī`, the restored Buddha Vandana continuation, the citta/hṛdaya + Buddharakkhita + paliDeva + hṛdaya corrections.
**PUSHED:** yes (user authorized; both PRs merged). **Tracked working tree:** clean. **AMBIENT (not mine, not committed):** ~64 untracked scratch `*.png` + `chants/` source photos + `docs/context/` in main — pre-existing pile, decision deferred to operator.

## Verbatim user quotes (chronological; this segment, exact times not in context)
- *"lets do 1"* — author Sariputta's remaining chants at full reader-depth.
- *"actually do /handover if context is a problem cant we use pipeline to automate this rather than handcrafting it"* — directed using the Workflow pipeline to parallelize authoring.
- *"my goal is to do a /handover and before that review any tasks… ensure this repo has everything in commits and pushed to remote, so pull from remote and do all the merge to main as much as possible or explain why not to me"* — wrap-up directive.
- *"yea this sounds good do that"* — ratified ship-then-handover.
- *"why dont you run checks then?"* — **run the checks, don't keep asking.** (After I'd offered a confirming review instead of running it.)
- *"i am not an expert just a student I trust you more and would like multi agent eyes on it for adversarial review"* — **the gate reframe.** Sacred-text correctness is gated on cross-model AI review, NOT his manual Pāli sign-off; he merges on AI consensus and trusts that more than his own read.
- *"lets do /Handover"* — this handover.

## Pending Threads

### Continue Immediately
1. **Sariputta's remaining chants.** Source photos `chants/rinzai zen chants/PXL_2026053*.jpg` (small — crop+upscale with PIL). EITHER resume the rate-limited workflow (`Workflow({scriptPath: "<session>/workflows/scripts/sariputta-chants-wf_d0f5930b-04c.js", resumeFromRunId: "wf_d0f5930b-04c"})`, ≤2–3 agents) OR use **Codex's grounded-LLM-authoring pipeline** (spec: `docs/superpowers/specs/2026-05-31-liturgy-llm-authoring-design.md`, generator `scripts/liturgy-generator/`). Then run the cross-model adversarial review before merge ([[feedback_cross_model_review]] in auto-memory).
   - **Dhamma Vandana + Sangha Vandana** (the other two recollections, on photo `PXL_20260530_141420478` below Buddha Vandana) — NOT yet authored; pair with the existing `sariputta-refuges-and-precepts.ts` Buddha Vandana.
   - **Dai Hi Shu** (Great Compassion Dharani), **Daisegaki**, **Teidai Dempo** (lineage) — new standalone chants.
2. **Per-word depth for the Buddha Vandana continuation** — `sariputta-refuges-and-precepts.ts` lines 3–11 (`itipiso-line-3/4`, `buddha-homage-1..7`) are faithful Pali + working English, no word-by-word `words`/`alignTo` yet.

### Blocked
- None of mine. (Everything merged.)

### Deferred
- **Overlapping Sariputta chants** (Enmē Jikku / Four Vows / Sho Sai / Song of Zazen / Han-nya Shin Gyo): need the shared-content pooling pattern, not naive authoring.
- **MAPLE/Bodhi source-data retrofit** onto `data/liturgy/heart-sutra-content.ts` (~2k duplicated body lines; guard with a resolved-doc deep-equality test).
- **`alignTo` for the Sariputta Heart Sutra witness** (currently a plain line).
- **Unidentified dharani** `PXL_20260530_141412608.jpg` (sideways photo) — not transcribed.

### Carried forward from prior handovers (still pending)
- **Other chants → Metta depth** — most chants are QC-clean baseline, NOT at `metta-sutta.ts`'s prosodic-split + per-witness `alignTo` + `morphemeAlignTo` depth. Ref `docs/sutta-studio/DATA_FAILURE_MODES.md`.
- **`morphemeAlignTo` audit for non-Metta chants** — only Metta has it; others use the positional heuristic.
- **init #1 e2e timeout one-liner** — `tests/e2e/initialization.spec.ts:132` still `10_000` (others `20_000`); trivial.
- **Deep-research affordances** (`geo` folder, browser-MCP) — not wired in.

### Explicit Decisions NOT to Do
| Item | Why |
|---|---|
| **Gate sacred text on the curator's manual Pāli check** | He's a student, not a Pāli authority (his words). The gate is **cross-model adversarial review** (Codex + Opus); merge on SHIP consensus. This SUPERSEDES the prior "don't auto-merge unreviewed Pali" rule — the AI review IS the sign-off. |
| Run a single model for sacred-content review | Model diversity is load-bearing — Codex caught what the Opus panel passed. Run BOTH. |
| Trust a "correction" without re-review | A fix can be wrong/over-correct (the `veramaṇī` round). Re-review the diff. |
| Commit the ~64 root scratch PNGs | Dev screenshots; recommend gitignore (no rule exists). |
| Commit `chants/` photos / `docs/context/` | Operator's call — left local (large binaries / provenance). |
| Re-curate per-community word glosses when pooling | Settled: only English *witnesses* pool; word scholarship stays per-community. |
| ≥4 parallel Opus workflow agents | Trips server-side rate-limiting; cap ~2–3. Codex (separate API quota) doesn't count against it. |

## Key Context
- **Model:** `data/liturgy/resolve.ts` pools witnesses by `phraseId`, strips `alignTo` from foreign pooled witnesses. `heart-sutra-content.ts` = shared Heart Sutra body (`overlayHeartBody`). Standalone chant = plain `LiturgyDoc`; shared chant = `CommunityChant` (contentId + defaultWitnessBy). Validation is consolidated in one module (`validateLiturgyDoc`, Codex PR #80).
- **Sacred-text authoring gotchas** (data-quality tests enforce): (1) NO grammar jargon (genitive/accusative/nominative/…) in any gloss/etymology; (2) accent amber/sky/rose reserved for Buddha/Dharma/Sangha; (3) `alignTo` length == witness word count; (4) morphemes concat to surface form. Policy: transcribe the sheet **verbatim** (incl. its non-standard spellings) + flag sheet-vs-canonical divergences in curator notes.
- **Cross-model review recipe** ([[feedback_cross_model_review]]): Codex via `codex exec --skip-git-repo-check -c sandbox_mode=read-only -i <photo> - < brief.md` (attach photos with `-i`; it can `git diff`). Detached `&` survives the launcher → add a `until ! pgrep -f "codex exec"; do sleep 15; done` waiter task for the real completion signal. Opus panel = a Workflow with one schema'd agent per artifact.
- **Multi-agent repo:** Codex/Gemini also work liturgy. `git fetch` + check `origin/main` + `gh pr list` before declaring state; other agents' worktrees exist — don't touch. `gh pr merge` can hit a transient auto-mode classifier block — retry; API merge works.

## Operator Cleanup (manual)
- Decide on ~64 untracked root `*.png` scratch screenshots (gitignore or delete) + `chants/` source photos + `docs/context/` (commit as provenance or leave local).
- Optional: prune this handover's worktree/branch after merge (`../LexiconForge.worktrees/opus-handover`, `docs/opus-handover-2026-06-06`).
- Ephemeral `/tmp` scratch (`/tmp/sariputta-crops/`, `/tmp/bodhi-booklet/`, `/tmp/codex-*.out`) — ignorable.

## Learnings Captured (auto-memory `~/.claude/projects/<proj>/memory/`)
- [x] `project_liturgy_community_model.md` — updated (PR #81+#82 merged; cross-model review; remaining work).
- [x] `feedback_cross_model_review.md` — NEW (run both models for sacred/specialized content; it caught errors in my own work; re-review fixes).
- [x] `feedback_workflow_parallelism_rate_limit.md` — NEW (cap heavy/Opus pipeline agents ~2–3; resumable).
- [x] `user_aditya.md` — updated (software-senior but a STUDENT in the domain; prefers AI adversarial review over self-verification for Pāli).

## Running Processes / Background
- None active. (Workflow `wf_d0f5930b-04c` STOPPED earlier, resumable — see thread 1. Codex review processes all exited.)

## Resume Instructions
1. `main` is current (`48e2cf4`); `git fetch` + `gh pr list` to check for other agents' new work first.
2. To continue Sariputta chants: read `docs/superpowers/specs/2026-05-31-liturgy-llm-authoring-design.md` (Codex's authoring approach) + `docs/sutta-studio/COMMUNITY_CHANT_MODEL.md` (the model). Author in a fresh `../LexiconForge.worktrees/opus-<task>` worktree (symlink `node_modules` to main to run tests).
3. Before merging ANY new sacred-text chant: run the cross-model adversarial review (recipe above) and merge on SHIP consensus.

## Calibration moments
| Moment | Lesson |
|---|---|
| Caught two errors in chants I'd authored + "verified" myself | A single author has blind spots; cross-model adversarial review is not optional for sacred text. |
| Opus panel SHIP, Codex HOLD — Codex was right (false-"obscured" continuation; over-correction) | Resolve a SHIP/HOLD split toward the more-skeptical model; verify its claims. Model diversity > one model. |
| Fixed `veramaṇī`, my fix over-corrected the root gloss | A "correction" can introduce a new error — re-review the diff, don't assume the fix is right. |
| User: *"why dont you run checks then?"* | When the gate is agreed, RUN it — don't keep asking permission to run it. |
| 5 parallel Opus agents → API throttle | Cap heavy workflow agents ~2–3; offload one reviewer to Codex (separate quota). |

---
*Handover by Claude (Opus 4.8) — Sariputta cross-model-review session, 2026-06-06.*

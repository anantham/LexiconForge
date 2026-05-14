# Handover: 2026-05-14 (Sutta Studio — phantom purge + pipeline+polish validated + Path B in flight)

> Replaces the 2026-05-13 handover. **Branch:** `feat/opus-phase2-experiment` on PR #52 (~33 commits, unmerged).
> **Active worktree:** `../LexiconForge.worktrees/opus-phase2-experiment/`
> **Cost this session:** ~$1.00 of OpenRouter API spend (Gemini Flash bulk)
> **Context at handover:** ~7% remaining — running handover skill to preserve continuity

## What this session was

Validated the V2-amended compiler pipeline empirically (phase-2 hand-curation + pipeline output + diff = A2 experiment), then escalated through a long UX iteration on the audit panel, the Legend, mobile responsiveness, pronunciation infrastructure, and finally a deep subtractive pass that retired four V2 metadata fields the UI never actually rendered.

Textbook case of "Lean toward the reverse direction" — ends with **Leave telic breadcrumbs** added to CLAUDE.md as a new principle. This doc is itself an instance of that principle.

## Headline accomplishments

| What | Where |
|---|---|
| **V2 amendments live in production** (pay-rent tooltip register, arrow-earning relation rule, anchor selection, translator-debate, cross-phase awareness). SENSE_METADATA retired. | `config/suttaStudioPromptContextV2.ts` |
| **Audit panel iterated** — bottom-sheet on mobile, draggable+persisted on desktop, inline copy icons + toast feedback, clickable citation chips. | `components/sutta-studio/LensPanel.tsx` |
| **Legend panel** — visual reference for colors/diacritics/relations. | `components/sutta-studio/Legend.tsx` |
| **Syllabifier post-pass** — deterministic Pāli syllable + stress. 269/269 words covered. 29 tests pass. | `services/sutta-studio/postPasses/syllabify.ts` |
| **v11 batch run on 40 un-curated phases** — $0.96 total, outputs in `docs/sutta-studio/experiments/`. | `scripts/sutta-studio/batch-v11-pipeline.sh` |
| **phase-4 polished** — first Path B worked example. ~18 min. Sets the pattern. | `docs/sutta-studio/curation/phase-4.md` |
| **Phantom-metadata purge** — stripped `epistemicBasis`, `confidence`, `sourceCitationIds`, `morph` from data + prompts + UI. Audit found them never rendered in default-on paths. | `scripts/sutta-studio/strip-phantom-metadata.ts` |

## Principles ratified this session

Added to `~/.claude/CLAUDE.md`:
1. **Lean toward the reverse direction** (added earlier, applied throughout)
2. **Rule Stacker** anti-pattern
3. **Phantom Consumer** anti-pattern
4. **Leave telic breadcrumbs** (added at session end — this doc embodies it)

Added to project memory (`~/.claude/projects/.../memory/`):
- `feedback_phantom_consumer_audit.md` — empirical grep-for-consumers method

## Pending threads

### Continue Immediately
1. **Path B — 39 phases to polish.**
   Per-phase budget after purge: ~6-8 min. Total ~5 hours.
   Order: phase-5, 6, 7, x, y, z, aa-bg.
   Pattern (per phase-4):
   - Read `docs/sutta-studio/experiments/phase-N-v11-output.json`
   - Write `phase-N-hand-curated.json` adding cross-phase notes + etymological depth + (selectively) translator notes for famously-contested compounds
   - Splice into `components/sutta-studio/demoPacket.json` via line-based python pattern
   - Write `docs/sutta-studio/curation/phase-N.md`
   - Commit

2. **PR #52 merge.** ~33 commits accumulated. Large but landed atomically because the threads are intertwined.

### Deferred (acknowledged, not blocking)
- **Dead toggles** (Emoji in tooltips + Grammar terms) — wired but their target data was stripped. Safe to remove in a follow-up.
- **DPD URL minting** — chips are wired to be clickable; existing 32 citations need URLs added.
- **F task (translator-tradition DB)** — would harden the claimed citations in curation logs. ~3-5 hr.
- **Refrain-detector post-pass** — sibling to syllabifier; would unlock "this word recurs N times" affordance. ~2-3 hr.
- **A3 metadata-filler module** — mostly unnecessary after purge; only DPD-citation-linker remains valuable.
- **Compiler consolidation Phase 2c/3/4** — orchestrator refactor + LLM caller merge + shim cleanup. Not blocking.
- **Vestigial branches cleanup** — `feat/opus-tooltip-plain-first`, batch3, batch4, consolidation, v2-pipeline-wire — all merged. Worktrees may still exist.

## Critical context — DON'T add back

Four fields were retired this session: `epistemicBasis`, `confidence`, `sourceCitationIds`, `morph`. The V2 prompt amendment for them is no longer in the active assembly. Older curation logs reference these — **they are intentionally absent**. Don't reinstate without building a UI consumer FIRST.

Named export `SUTTA_STUDIO_V2_SENSE_METADATA` is kept in source for historical reference only — see comment block above `SUTTA_STUDIO_V2_AMENDMENTS` array.

## What we empirically validated

- V2 amendments lift structural quality (register, anchor, relations, segmentation) but NOT metadata fields (LLMs ignore epistemicBasis/confidence even when prompted)
- Pipeline+polish is 2-3× faster than from-scratch on routine phases
- Cost is negligible (~$0.02/phase with Gemini Flash)
- Hallucinated confidence is worse than absent confidence (user's "trust me bro" framing)
- The empirical audit method: `grep -rn "<field>"` for consumers; zero hits = phantom

## Resume Instructions

1. **First read:** this doc + `~/.claude/CLAUDE.md` (the 4 principles) + `docs/sutta-studio/CONSOLIDATION.md` for architecture.

2. **Verify state:**
   ```bash
   cd "/Users/aditya/Documents/Ongoing Local/LexiconForge.worktrees/opus-phase2-experiment"
   git log --oneline -5
   gh pr view 52 --json state,title
   ```

3. **Decide next move:**
   - **Path B continuation** → phase-5, ~7 min
   - **Merge PR #52** → review the bundle, land it
   - **Refrain-detector post-pass** → sibling to syllabifier, ~2-3 hr

4. **Path B recipe:** see phase-4 pattern in `docs/sutta-studio/curation/phase-4.md` and matching `experiments/phase-4-hand-curated.json`. Same shape per phase.

## File map

```
config/suttaStudioPromptContextV2.ts          V2 amendments (SENSE_METADATA retired)
components/sutta-studio/
  LensPanel.tsx                                Audit drawer, clickable chips
  Legend.tsx                                   Color/symbol reference panel
  SettingsPanel.tsx                            Flat settings list
  EnglishWord.tsx                              Subtle cycle dots
  Tooltip.tsx                                  Viewport clamp for mobile
  demoPacket.json                              Live runtime data (post-purge)
services/sutta-studio/
  prompts/                                     Canonical prompt builders
  passes/                                      Canonical pass functions
  postPasses/syllabify.ts                      Deterministic pronunciation
scripts/sutta-studio/
  run-phase-experiment.ts                      Single-phase v11 runner
  batch-v11-pipeline.sh                        Bulk 40-phase runner
  backfill-pronunciation.ts                    Syllabifier batch
  strip-phantom-metadata.ts                    This session's purge
  strip-tooltip-cruft.ts                       Emoji + brackets strip
docs/sutta-studio/
  CONSOLIDATION.md                             Architecture refactor doc
  COMPILER_STRATEGY.md                         Pipeline+polish thesis
  CURATION_PROTOCOL.md                         §3.4 tooltip register
  curation/                                    Per-phase polish logs
  experiments/                                 v11 outputs + hand-curated diffs
```

---
*Handover by Claude Opus 4.7 (1M context) at ~7% context. Read cold and pick up.*

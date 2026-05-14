# Phase 3 — sokaparidevānaṁ samatikkamāya

> "For the surmounting of grief and lamentation" — second dative-of-purpose in the satipaṭṭhāna
> formula. Curated 2026-05-13 in **pipeline+polish** mode (the workflow validated empirically
> in this session): started from the v11 Gemini Flash draft (`phase-3-v11-output.json`),
> hand-polished to add V2 metadata fields and cross-phase awareness the LLM doesn't generate.

## The pipeline+polish workflow demonstration

This is the first phase curated via the workflow that COMPILER_STRATEGY.md §5 predicted and
that today's A2 experiment empirically validated. Time breakdown:

| Step | Time |
|---|---|
| Run `run-phase-experiment.ts --phase phase-3` | 30 sec, $0.019 |
| Open the v11 PhaseView output, scan structure | 1 min |
| Identify what to keep (most of structure + tooltips + senses) | 2 min |
| Add `epistemicBasis` / `confidence` / `notes` on all 7 senses | 5 min |
| Add 1 additional sense per word (`burning & crying` for soka, `going beyond` for samatikkama) | 3 min |
| Add cross-phase tooltip notes (parallel to phase-2's parallels) | 2 min |
| Refine 1-2 tooltips for deeper etymology (Sanskrit cognates, prefix family) | 3 min |
| Add `gender: 'm'` on samatikkamāya's morph | 30 sec |
| Splice into demoPacket.json, validate JSON, write this log | 5 min |
| **Total: ~22 min** | vs ~45 min from scratch — roughly **2x speedup** |

The speedup is real but smaller than the headline `~15 min` from the analysis prediction because
this is the first time through and I'm writing the log + splicing + validating. Steady-state
phases should hit ~15 min once the curator has the rhythm.

## What v11 got right (kept as-is)

- **Segmentation of samatikkamāya**: 4 segments (sam + ati + kkam + āya). Correct morphological
  parse with the doubled root spelling.
- **Anchor on p8 (samatikkamāya)**: verb-anchor per V2 ANCHOR rule §4. Phase-3's semantic
  center is the action (overcoming), not the noun being overcome (grief).
- **Relation arrow**: p7s4 → p8, ownership, "Surmounting OF". Earns the arrow per V2
  ARROW_EARNING_RULE (genitive-of-purpose).
- **morph on -āya (dat-sg) and -ānaṁ (gen-pl)**: V2 amendments worked at the Phase composition
  pass. Just added gender on -āya by hand.
- **Tooltip register**: plain-first prose throughout, no bracketed grammar prefixes, no emoji.
  V2 TOOLTIP_REGISTER amendment landing strong on phase-3 just as it did on phase-2.
- **Core senses**: "sorrow and lamentation" / "overcoming" / "surpassing" — all defensible
  primary translations. Polysemy count of 3 per word is reasonable.

## What v11 got partially right (refined)

- **Segmentation of sokaparidevānaṁ**: v11 split the suffix into "āna" + "ṁ" (4 segments
  total). Hand-curated merges to single segment "ānaṁ" (3 segments). Both are defensible
  but the merged form matches the conventional Pāli grammar split.
- **Etymology on tooltips**: v11 mentioned "root 'suc' means burn or grieve" — solid but
  brief. Hand version added the Sanskrit cognate (śoka) explicitly, the inner-vs-outer
  contrast with parideva, and the "soka, parideva, dukkha, domanassa, upāyāsa" standard
  five-afflictions reference.

## What v11 missed (added by hand)

These gaps are CONSISTENT with what phase-2 v11 also missed — same workflow as the analysis
predicts. The LLM treats the V2 amendments asymmetrically: structural fields (anchor, morph,
relation, tooltip register) work; metadata fields (epistemicBasis, confidence, notes) get
ignored even when the prompt mentions them.

- **epistemicBasis on all 7 senses**: lexical (the standard renderings) / curatorial (defensible
  variants) / etymological (literal compositional readings). Hand-added.
- **confidence rankings**: high (canonical) / medium (defensible) / low (etymological gloss).
  Hand-added.
- **Translator citations in notes**: Sujato uses 'surmounting'; Ñāṇamoli-Bodhi prefers
  'overcoming'; etc. Hand-added — v11 has no way to attribute readings to specific scholars
  without a tradition database (the F task).
- **Cross-phase awareness**: connecting -ānaṁ here to phase-2's sattānaṁ, and -āya here to
  phase-2's visuddhiyā. The same parallel-construction observation phase-2's curation made
  about phase-3 — now made bidirectionally. v11 lacks phaseState envelope context so it
  can't do this naturally.
- **gender on -āya morph**: masculine (atikkama is a masculine action-noun). v11 set
  case+number but not gender. Easy hand-add; deterministic from DPD's POS tag would also
  solve this as part of the proposed `morph-from-POS` post-pass (A3 #1).

## Where this maps onto A3 post-pass priorities

This phase strengthens the empirical signal from phase-2 about which deterministic post-passes
would close the LLM's gaps:

1. **morph-from-POS** (HIGH): v11 got case+number; hand had to add gender. Deterministic from
   DPD POS tag. Both phase-2 and phase-3 have this gap consistently.

2. **citation-linker** (HIGH): v11 has no `sourceCitationIds`. Deterministic linker from DPD
   context to senses would populate this without curator effort.

3. **epistemicBasis inference** (HIGH): v11 doesn't set this. A deterministic rule could
   populate it: if sense matches a DPD entry → `lexical`; if it's from compositional parse →
   `etymological`; otherwise default to `curatorial` and flag for review. ~80% accurate
   without LLM help.

4. **§3.4 linter** (LOW): v11 already does §3.4 well. No gaps to close.

5. **cross-phase facet detector** (MEDIUM): requires phaseState envelope plumbing into the
   compiler call. Wider work than a simple post-pass; the v11 prompts already have the
   CROSS_PHASE_AWARENESS amendment but it only fires when the envelope is supplied.

The translator-tradition citations (the F task) remain the hardest LLM-irreducible gap.
A3 post-passes don't help here; only a curated database does.

## Verdict on the polish workflow

Pipeline+polish is **definitively viable**. The v11 draft saves real curator time and produces
the right SHAPE of output — the curator's job becomes filling metadata and adding scholarly
context, not generating structure from scratch. For the ~35-40 routine phases per sutta that
COMPILER_STRATEGY.md identified, this workflow is the path forward.

The few phases that need full hand-curation (~10-15 per sutta, the doctrinally-loaded ones
and famously-contested compounds like ekāyano) remain hand-curation from scratch. Pipeline
output for those would still be a useful starting draft, but the metadata depth would still
need most of the time investment.

# Sutta Studio Compiler Experiments

> Empirical comparisons of compiler output across prompt versions and against hand-curation.
> Each experiment captures a snapshot for diffing — these files are read-only references,
> not source-of-truth for the live app.

## phase-2-experiment (2026-05-13)

The first three-way comparison after V2 amendments landed in production via PR #51 (compiler
consolidation merged 2026-05-13). Goal: empirically validate that V2 amendments lift LLM
quality and identify which gaps require deterministic post-passes (the proposed A3 work).

| File | Source | Purpose |
|---|---|---|
| `phase-2-v10-baseline.json` | The phase-2 entry in `components/sutta-studio/demoPacket.json` before this experiment | Pre-amendment LLM output |
| `phase-2-v11-output.json` | Run the compiler with `SUTTA_STUDIO_PROMPT_VERSION = 'sutta-studio-v11-mn10-amendments'` on phase-2 segments | Post-amendment LLM output (TBD — user runs) |
| `phase-2-hand-curated.json` | Curator (this session) following CURATION_PROTOCOL §3.4 + §3.4.1 + the 6 V2 amendments | Gold standard for the 90% ceiling discussion |

## The three questions this experiment answers

1. **v10 → v11 lift**: Do the V2 amendments actually move LLM output toward hand-curation?
2. **v11 vs hand**: How much of the 90% ceiling does v11 hit? Concretely measurable as
   percentage of hand-curated fields present in v11.
3. **Where post-passes (A3) should focus**: Specific gaps between v11 and hand-curation
   that a deterministic post-pass (morph-from-POS, citation-linker, cross-phase-facet
   detector, §3.4 linter) could close without LLM cost.

## How to read the diff after v11 is generated

The hand-curated entry is the comparison target. For each paliWord, compare:

- **Segment structure**: do v11 and hand agree on root/suffix/prefix split?
- **Tooltip register**: does v11 carry §3.4 plain-first prose, or fall back to v10's
  bracketed grammar prefixes (`[Genitive Plural]`) and emoji (`🔗 ✨ 🎯`)?
- **morph field on suffixes**: does v11 populate the new field, or skip it?
- **Sense count + content**: does v11 reproduce the polysemy range hand-curation captured?
- **Sense metadata (epistemicBasis, sourceCitationIds, confidence, notes)**: does v11
  carry these, or are they hand-only?
- **isAnchor**: does v11 set exactly one anchor per phase?
- **Relations**: does v11's arrow-earning behavior match the rule? (KEEP genitive-of-possession,
  DROP subject-of-active-verb)
- **Cross-phase awareness**: does v11 reference bhikkhū / earlier phases when discussing
  sattānaṁ? (only if phaseState envelope was provided to the compiler)

## Follow-up

After A2 + C complete, a `phase-2-analysis.md` will be added here capturing:
- What v11 lifted vs v10 (quantitative)
- What gap remains v11 → hand (qualitative)
- Whether to proceed with A3 post-passes (decision)
- Implications for scaling to phases 3-51 (or DN22, etc.)

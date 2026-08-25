# LITURGY-001: Dedicated Liturgy Generator Pipeline

**Date:** 2026-05-30  
**Status:** Implemented (initial scaffold)  
**Authors:** Aditya + Codex  
**Group:** liturgy / data generation

## Issue

The liturgy reader renders high-quality chant sheets from hand-authored
`LiturgyDoc` files under `data/liturgy/`. The current registry explicitly says
there is no automated generation. That has kept the renderer flexible, but it
also means sheet quality varies by authoring session: alignment arrays drift,
morpheme splits silently degrade, and some chants stop short of the Metta Sutta
standard.

Sutta Studio already proves a better production pattern: staged generation,
explicit handoff objects, validation after every meaningful boundary, and a
separate grounding pass. Liturgy needs its own version of that pattern because
its target schema is not `DeepLoomPacket`; it is `LiturgyDoc`, with ritual
sources, witnesses, chant shapes, script variants, `alignTo`, and
`morphemeAlignTo`.

## Decision

Build a dedicated liturgy generator pipeline that consumes structured source
packets and emits `LiturgyDoc` drafts. The first implementation slice is
deterministic:

1. Normalize a structured chant packet.
2. Preserve authored section shapes.
3. Infer missing witness `alignTo` arrays for `triple-script-witness` segments
   using source word glosses, morphemes, script alternates, and conservative
   stop-word handling.
4. Infer `morphemeAlignTo` when a matched English token clearly maps to one
   morpheme.
5. Validate the draft against the renderer's silent assumptions.
6. Emit a TypeScript module ready for human review before registration.

Live LLM calls are intentionally out of the first slice. The generator should
earn trust as a deterministic compiler over structured packets before it starts
calling models for OCR cleanup, section classification, or word gloss authoring.

## Positions Considered

| Option | Impact | Effort | Risk | Reversible | Confidence |
|---|---:|---:|---:|---:|---:|
| Adapt Sutta Studio output directly | Medium | Low | Medium | Yes | 0.65 |
| Dedicated liturgy generator | High | Medium | Low-medium | Yes | 0.85 |
| Draft-only manual helper | Medium | Low | Low | Yes | 0.90 |

The chosen path is the dedicated generator, shipped first as a draft-only
helper. This keeps the correct target schema while preserving a human review
gate.

## Assumptions

- Structured source packets are acceptable as the initial interface; raw
  OCR/markdown ingestion can be added later as another stage.
- `triple-script-witness` is the highest-leverage first shape because it carries
  the alignment failure modes seen in the current corpus.
- A conservative aligner that leaves uncertain tokens unmapped is better than a
  confident but wrong aligner.
- Existing liturgy tests are the right quality floor; generator validation
  should mirror those invariants and add generator-specific diagnostics.

## Constraints

- Do not weaken the current liturgy schema to fit the generator.
- Do not auto-register generated files in `data/liturgy/index.ts`; generated
  drafts must pass human review first.
- Do not emit broken morphemes. If a split fails reconstruction, diagnostics
  must make it loud.
- Do not treat prose commentary as automatic filler. Commentary remains a
  review item.

## Consequences

Positive:

- Gives future agents one clear place to build chant-generation logic.
- Makes alignment and morpheme problems visible before a draft reaches the app.
- Keeps Sutta Studio's best architectural lesson without forcing its packet
  schema onto liturgy.

Negative:

- The first scaffold does not solve raw OCR or LLM-authored word glosses.
- The deterministic aligner cannot understand all translation choices; it must
  surface uncertain tokens rather than guess.
- A second pass will be needed for model-backed section classification and
  richer word/morpheme authoring.

## Implementation Notes

Initial scaffold files:

- `services/liturgy-generator/types.ts` — generator input, diagnostics, result
  contracts.
- `services/liturgy-generator/tokenize.ts` — renderer-compatible token helpers.
- `services/liturgy-generator/align.ts` — conservative witness and morpheme
  aligner.
- `services/liturgy-generator/validate.ts` — draft diagnostics for silent
  failure classes.
- `services/liturgy-generator/emit.ts` — TypeScript `LiturgyDoc` module emitter.
- `services/liturgy-generator/pipeline.ts` — orchestration.
- `scripts/liturgy-generator/build-liturgy-draft.ts` — CLI entry point.
- `tests/services/liturgy-generator/pipeline.test.ts` — fixture-level coverage.
- `test-fixtures/liturgy-generator/ti-sarana-mini.json` — first structured
  source packet.

## Amendment: reviewed semantic targets (2026-08-25)

**Status:** Implemented in PR #161 follow-up

The renderer now distinguishes reviewed whole-word, exact surface-morpheme,
and layered lexical/grammar targets. This extends the generator's alignment
boundary: `alignmentMode: preserve` is the only mode allowed to retain
`tokenAlignTo`. `none` clears every alignment layer, while `infer` creates a new
unreviewed word/morpheme alignment and clears any stale reviewed target array.

Structural validation is part of the same contract, not a later audit add-on.
It rejects non-parallel arrays, invalid word/morpheme indexes, missing or
duplicate/DOM-unsafe analysis IDs, invalid surface references, and fine targets
whose aligned word or analysis unit does not exist.

Implementation files:

- `services/liturgy-generator/pipeline.ts`
- `services/liturgy/validation.ts`
- `data/liturgy/resolve.ts`
- `components/liturgy/shapes/analysisPresentation.ts`
- `components/liturgy/shapes/alignmentGeometry.ts`
- `components/liturgy/shapes/TripleScriptWitness.tsx`
- focused resolver, validation, generator, renderer-bridge, and geometry tests

## Amendment: route-visible audit denominators (2026-08-25)

**Status:** Implemented

The semantic-alignment audit intentionally inspects every registered reader
route because pooled witnesses and shared documents can appear in more than one
route context. Its summary therefore distinguishes route-visible English
tokens, tokens in witnesses with authored `alignTo`, and tokens linked to a
source word. This removes the earlier ambiguous “English tokens” versus
“aligned English tokens” labels without deduplicating away affected URLs.

Implementation:

- `services/liturgy/alignmentAudit.ts`
- `scripts/liturgy-generator/audit-liturgy-alignments.ts`
- `tests/services/liturgy/alignmentAudit.test.ts`
- `docs/liturgy/SEMANTIC-ALIGNMENT-CONVENTION.md`

### Implementation amendment — evidence-bounded Morning Chants alignment (2026-08-25)

The renderer and validation boundary now implement the conservative premise in
this ADR for hand-authored and generated content, not only draft generation.
Unauthored many-to-one alignments no longer use English token order to invent
surface-morpheme targets. They render at whole-word precision until reviewed.

Implemented files:

- `types/liturgy.ts` — reviewed word, surface-morpheme, and layered-analysis
  target contract plus lexical/grammar/transformation records.
- `services/liturgy/alignmentTargets.ts` — fail-honest target resolution with
  no positional fallback.
- `components/liturgy/shapes/alignmentGeometry.ts` — isolated DOM measurement
  for whole-word, surface, and layered targets.
- `services/liturgy/alignmentAudit.ts` and
  `scripts/liturgy-generator/audit-liturgy-alignments.ts` — exhaustive corpus
  inventory and route-visible review ledger.
- `services/liturgy/validation.ts` — rejecting checks for invalid target arrays,
  missing units, invalid surface references, and renderer-compatible authored
  source-token hints.
- `data/liturgy/morning-chants.ts` — first complete route curation under the
  convention, including layered `pāṇātipātā` analysis.
- `docs/liturgy/SEMANTIC-ALIGNMENT-CONVENTION.md` — stopping rule and authoring
  workflow.

The remaining audit findings on other routes are deliberately not auto-cleared.
The renderer is safe immediately; each sacred-text target still requires
evidence and human review before it becomes fine-grained.

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

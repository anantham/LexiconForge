# Liturgy semantic-alignment convention

**Adopted:** 2026-08-25
**Status:** Implemented for rendering, structural validation, and corpus audit

## Intent

Alignment arrows are linguistic claims. They must show only the precision that
has actually been reviewed. A pleasing fan of evenly distributed arrows is not
evidence that the first English token corresponds to the first visible slice.

The reader therefore keeps four layers distinct:

1. **Surface:** exact consecutive substrings displayed in the active script.
2. **Lexical analysis:** meaning-bearing units, including underlying forms that
   may be fused by compounding or sandhi.
3. **Grammar:** endings or other grammatical contributions that a translation
   may render as a separate word.
4. **Transformation:** the documented relation between underlying forms and the
   displayed spelling, such as sandhi or inflection.

## Stopping rule

Use the smallest unit whose identity and contribution are stable in this
context and supported by the cited analysis. Do not split merely because the
displayed characters permit a cut.

- Target an exact surface morpheme when the substring itself carries the
  translated contribution.
- Target a lexical or grammar analysis unit when fusion prevents an honest
  one-to-one substring cut.
- Record an explicit whole-word target when the translation is paraphrastic or
  the available evidence does not justify finer precision.
- Leave a token unaligned only when it is supplied by the English witness and
  has no source contribution.
- Mark uncertain analyses `needs-review`; uncertainty must never be converted
  into an apparently exact arrow by token order.

## Data and presentation contract

`Witness.alignTo` remains the word-level bridge. `Witness.tokenAlignTo` records
the reviewed decision for each aligned English token:

- `{ kind: 'word' }` — intentionally coarse, reviewed whole-word alignment.
- `{ kind: 'morpheme', index }` — exact rendered surface slice.
- `{ kind: 'analysis', unitId }` — lexical or grammar unit declared in the
  aligned `WordGloss.analysis`.
- `null` entry — unresolved; render at the whole word without guessing and
  suppress any legacy target at that index.

When `tokenAlignTo` exists, it is the complete target contract for that witness
and the legacy `morphemeAlignTo` array is ignored. Legacy targets are consulted
only when `tokenAlignTo` is absent from the witness.

Several coarse English tokens aligned to one source word intentionally share
that word's truthful center while retaining distinct English endpoints. The
result is a visible fan from one source point, not overlapping lines. Spreading
their source endpoints across unreviewed character positions would fabricate
precision and is prohibited.

`WordGloss.analysis` names lexical and grammar units, their supporting surface
slices, review status, citations, and any transformations. Unit IDs are unique
lowercase kebab-case tokens because the renderer serializes them into DOM
attributes.

Review status must remain visible rather than living only in metadata:

- `confirmed` uses a solid emerald underline;
- `alternative` uses a dotted amber underline;
- `needs-review` uses a dashed rose underline.

The hover tooltip names the status and every layered unit carried by the
surface slice. If an analysis unit spans several slices, its connector must end
on the first claimed surface slice in authored order, never on the empty
union-box gap between them. Repeated English tokens targeting that same unit
must share this stable source anchor; their distinct English endpoints form the
fan. Alternate-script analysis targets remain whole-word until an explicit
per-script mapping is authored.

## Failure behavior

Foreign community witnesses lose all alignment layers because their indexes
belong to another community's word segmentation. Generator `none` and `infer`
modes likewise clear reviewed fine targets; only `preserve` may retain them.
Malformed lengths, indexes, identifiers, surface references, or unknown units
are validation errors. Missing precision falls back to the whole word rather
than to a positional guess.

## Audit counting contract

The corpus audit traverses registered **routes**, not unique document object
identities. If the same document or a pooled witness is visible at several
routes, its route-visible records are intentionally counted at every route.
The summary reports three English-token populations rather than calling them
all “aligned”:

- `routeVisibleEnglishTokens` counts every witness token rendered by each
  registered route, including pooled witnesses whose foreign indexes were
  stripped;
- `tokensInWitnessesWithAlignTo` counts every token belonging to a witness with
  an authored word-alignment array, including `-1` supplied-English entries;
- `sourceAlignedEnglishTokens` counts only tokens whose `alignTo` entry names a
  source-word index.

`explicitReviewedTargets` is a subset of `sourceAlignedEnglishTokens`. Review
group counts remain route-addressed so every affected reader URL is visible to
the curator, even when several routes share underlying content.

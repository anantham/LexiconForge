# Liturgy semantic-alignment convention

**Adopted:** 2026-08-25
**Status:** Implemented for rendering, structural validation, corpus audit, and Morning Chants curation

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
  has no source contribution. Do not use `-1` for source grammar such as an
  ablative ending rendered by “from.”
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
attributes. Several analysis units may share a surface slice when spelling is
fused. Analysis slice indexes currently apply to the base Latin segmentation;
an alternate-script segmentation falls back to the whole word unless and until
an explicit per-script analysis mapping is added.

Every rendered surface boundary must also fall between Unicode extended
grapheme clusters. “Fine-grained” means the smallest honest **renderable**
surface unit, not the smallest code-point or code-unit range. A Devanāgarī
vowel sign, anusvāra, or virāma conjunct stays in the same DOM span as its base
grapheme. When that forces a lexical stem and grammatical ending to share one
alternate-script span, the tooltip says so and the separate underlying analysis
remains available on the Latin evidence layer. Invalid client-side metadata
falls back to one whole-word span; corpus validation rejects the same boundary.

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

## Example: pāṇātipātā

The exact Latin surface is recorded as `pāṇā | tipāt | ā`. The middle surface
slice is not presented as an independent `ti-` prefix. The analysis records:

- lexical `pāṇa`, “a living being,” carried by `pāṇā`;
- lexical `atipāta`, “striking down / killing,” carried by fused `tipāt`;
- grammatical ablative `-ā`, rendered by “from”;
- `pāṇa + atipāta → pāṇātipāta`, then
  `pāṇātipāta → pāṇātipātā`.

The compound analysis and declension are grounded in the Digital Pāḷi
Dictionary record for `pāṇātipātā`; the witness translation is linked to
SuttaCentral Kp 2 in the chant data.

The Devanāgarī surface is safely divided as `पाणा | तिपाता`, not
`पाणा | तिपात | ा`: the final vowel sign cannot be shaped independently from
its base grapheme. This is intentionally coarser than the Latin surface while
the grammar unit remains explicit in the layered analysis.

## Failure behavior

Foreign community witnesses lose all alignment layers because their indexes
belong to another community's word segmentation. Generator `none` and `infer`
modes likewise clear reviewed fine targets; only `preserve` may retain them.
Malformed lengths, indexes, identifiers, surface references, or unknown units
are validation errors. Missing precision falls back to the whole word rather
than to a positional guess.

## Audit workflow

Run:

```bash
npm run audit:liturgy-alignments
npm run audit:liturgy-alignments -- --json
```

The audit traverses every registered route, source-word record, witness, and
English token. It reports the dangerous review class: multiple English tokens
mapped to a multi-morpheme source word while one or more tokens still lack an
explicit reviewed target. A route reaches zero only after each reported group
has an authored exact, layered, or intentional whole-word decision.

### Counting contract

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

Zero findings do not prove the underlying linguistic analysis true. Corpus
validation proves structural integrity; citations and human review establish
the content claim.

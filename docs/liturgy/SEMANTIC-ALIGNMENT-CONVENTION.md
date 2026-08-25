# Liturgy semantic-alignment convention

**Adopted:** 2026-08-25
**Status:** Implemented for rendering and auditing; Morning Chants curated

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

## Data contract

`Witness.alignTo` remains the word-level bridge. `Witness.tokenAlignTo` records
the reviewed decision for each aligned English token:

- `{ kind: 'word' }` — intentionally coarse, reviewed whole-word alignment.
- `{ kind: 'morpheme', index }` — exact rendered surface slice.
- `{ kind: 'analysis', unitId }` — lexical or grammar unit declared in the
  aligned `WordGloss.analysis`.
- `null` or absent — unresolved; render at the whole word without guessing.

`WordGloss.analysis` names lexical and grammar units, their supporting surface
slices, review status, citations, and any sandhi or inflection transformations.
Several analysis units may share a surface slice when the spelling is fused.
Analysis slice indexes currently apply to the base Latin segmentation. An
alternate-script segmentation falls back to the whole word unless and until an
explicit per-script analysis mapping is added.

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

Zero findings do not prove the underlying linguistic analysis true. Corpus
validation proves structural integrity; citations and human review establish
the content claim.

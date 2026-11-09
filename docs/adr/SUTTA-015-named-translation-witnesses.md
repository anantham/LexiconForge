# SUTTA-015 — Named translation witnesses with explicit span alignment

**Status:** Implemented locally, 2026-10-19. Uncommitted; scholarly and final independent code review pending.
**Scope:** The owner requested translation and language cycling for the Triṃśikā reader, then selected Malayalam alongside English. This implements the bounded reader/data contract, not the full TextGraph or language-specific decomposition charters.

## Context

An alternative lexical gloss within a generated draft is not a different translator or language. Published witnesses also need not follow the canonical Sanskrit verse numbering. Equating numbered verses or forcing each translated word onto a Sanskrit word would fabricate correspondence. The current draft must remain available with its sense/ghost interactions, while later witnesses keep their own wording and attribution.

## Decision

Add a packet-local `translations` catalog. A witness identifies language/script/direction, translator and/or publisher, edition, revision, license, normalization, and the actual source language/witness. Original draft metadata must say it is AI-assisted and unreviewed; it must never borrow a scholar's name. No modern witness is imported merely because a URL or translator is known.

Two content modes coexist. `legacy-interlinear` explicitly reuses the existing draft senses and grammatical ripples. `translation` holds immutable ordered passages, with the witness's own locators, separately from alignment assertions. Target spans use half-open Unicode code-point offsets into those passages; grapheme checks prevent splitting dependent marks. Source spans name ordered contiguous written-token IDs in a phase. Multiple spans on either side express phrases, discontinuities and cross-verse correspondence. No automatic verse-number matching, tokenization, morphology, translation or provider call is introduced.

Every assertion carries a relation (`corresponds`, `reordered`, `expanded`, `omitted`, or `uncertain`), an alignment status, evidence and review status. Every target code point must be covered exactly once, explicitly including unaligned text. A source omission may have no target text. `displayAt` is a layout anchor only: it does not upgrade a candidate correspondence to an asserted link. Invalid references, coverage gaps/overlaps and unsafe character boundaries display a clear error, without substituting another translator.

One compact disclosure selects language and witness for the entire reading. This stronger-than-per-verse coherence prevents silent mixing. Returning to a language restores its chosen witness; returning to the interlinear draft restores sense/ripple choices. Fixed witness text never changes when a source sense cycles. Commentary remains the packet's separately attributed study annotations. The chosen witness's attribution is in the disclosure; the source provenance panel labels its old translation metadata as the interlinear study draft.

Phrase text is placed once beside its authored source group. Other groups touched by a wider mapping link to that phrase. Exact original witness order remains accessible in the disclosure. Phrase-level arrows connect all asserted source words to the phrase container on focus/hover; uncertain and unaligned mappings have no such arrows. Missing source coverage stays visible. The canonical Sanskrit and its 3-word target/5-word maximum layout never change to fit a translation.

## Alternatives and tradeoffs

| Approach | Benefit | Cost / risk |
| --- | --- | --- |
| Add languages as more lexical senses | Small patch | Misattributes translators, encourages mixed readings and false word correspondence; rejected. |
| Packet-local catalog and explicit span assertions | Bounded, additive, inspectable; preserves legacy packets | Metadata remains local; later TextGraph migration must preserve stable IDs and offsets. Chosen for this task. |
| Implement the full external TextGraph now | Shared cross-work provenance | Much larger ownership, migration and content scope than the authorized reader revision; deferred. |

## Consequences and limits

Structural coverage is evidence of data integrity, not accuracy of translation or complete morphology. Existing Sanskrit compound slices still have whole-written-token English links; this work does not create internal morpheme alignments. A many-to-many Malayalam phrase likewise makes no token-by-token equivalence claim. New witness curation requires explicit source/reuse verification and independent linguistic review. The Malayalam working translation is original AI-assisted prose based on this packet's normalized Lévi Sanskrit, pending independent review; it is not an established translator edition or a Malayalam-script transliteration.

The initial packet-local shape follows [POLYGLOT](../sutta-studio/POLYGLOT.md) and [TEXT_GRAPH](../sutta-studio/TEXT_GRAPH.md) distinctions without claiming those broader designs are implemented. Further language editions and external publication remain outside this revision.

## Implementation Notes

- `types/suttaStudioWitness.ts`: witness, immutable passage and separate alignment contract; additive `DeepLoomPacket.translations` in `types/suttaStudio.ts`.
- `services/sutta-studio/witnesses.ts`: structural and Unicode validation, exact span reading and source membership.
- `components/sutta-studio/TranslationControls.tsx`, `WitnessReading.tsx`: separate selectors, attribution, phrase mappings, original-order disclosure and explicit coverage gaps.
- `components/sutta-studio/SuttaStudioView.tsx`: one coherent selected witness, per-language witness memory, preserved lexical state, unchanged Sanskrit groups.
- `data/trimsika/build.ts` and `content/references/sutta/trimsika.json`: deterministic offline witness assembly alongside the existing canonical source.
- `tests/services/suttaStudioWitnesses.test.ts`, `components/sutta-studio/TranslationWitness.test.tsx`: synthetic cross-verse, many-to-many, RTL, Unicode, state and failure-path cases. Existing Triṃśikā tests retain 30-verse source/ID/layout coverage.

Revisit after a qualified Sanskrit/Malayalam reader reviews the first complete witness or before migrating to shared TextGraph storage. No assumption of independent review clearance is made from passing tests.


## Implementation amendment — 2026-10-19

The owner additionally requested a real alternate English witness. `data/trimsika/lapis-lazuli.json` now imports the publisher's explicitly CC0 English translation from Chinese Taishō31 no1586, with publisher credit and no invented individual translator. Immutable passage text retains its original numbering and wording; 109 provisional mappings include 20 uncertain and 2 unaligned entries. All mappings remain unreviewed, and three Sanskrit tokens have no mapping. This exercises the existing separate-text/assertion contract without assuming equal verse numbers or changing the architecture.

`data/trimsika/malayalam.ts` and `malayalam.json` supply the 30-verse original AI-assisted Malayalam witness. `tests/data/trimsikaLapis.test.ts` locks exact publisher-text preservation and honest cross-verse/uncertainty boundaries; `TrimsikaNamedWitness.test.tsx` verifies the real English/Malayalam selection and retained draft state. The full affected 123-test suite, typecheck, build and client-secret scan pass. Fresh visual/browser acceptance and independent code/scholarly clearance remain pending as detailed in the curation record.

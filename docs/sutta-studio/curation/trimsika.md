# Triṃśikā study packet — local draft

Date: 2026-10-19. Status: source-complete, scholarly review pending. This packet is not a critical edition or an approved translation.

## Intent and existing workflow

The owner requested the same library treatment as MN10. MN10 is bundled as `content/references/sutta/mn10.json`, a `DeepLoomPacket` rendered by `SuttaStudioView`, with 51 phases over 26 canonical source segments (the opening through MN10 5.3), 269 written words and 96 citations. Its library card routes via `/sutta/demo` to `/sutta/mn10`. We reuse that packet/reader workflow, including word senses, English replacement, explicit ghost tokens, opacity, audit notes and grammar/alignment arrows. MN10 retains its tooltip facets; Sanskrit adds the contextual reading disclosure described below. The separate Gītā reader is not used.

The new card is `sutta-trimsika`, opening `/sutta/trimsika` (also accepts a trailing slash). The root verses load lazily from a bundled packet and need no live compiler, dictionary service, API key, external upload or generation credits. `publicationStatus: Completed` and packet progress refer to root-text/render coverage, not scholarly acceptance; draft status is stated in the card, always-visible reader note, and provenance panel.

## Files and regeneration

- `data/trimsika/source.json`: 30 numbered IAST source records, metrical line markers, edition page.
- `data/trimsika/annotations.json`: original draft glosses, explicit English order/scaffolding, selected alternatives, morphology, relations and display slices.
- `data/trimsika/provenance.json`: edition, source limits, emendation, licensing distinction and annotation status.
- `data/trimsika/build.ts` and `scripts/build-trimsika.ts`: deterministic offline assembly.
- `content/references/sutta/trimsika.json`: generated `DeepLoomPacket`.
- `tests/data/trimsika.test.ts` and `components/sutta-studio/Trimsika.test.tsx`: structural/source and rendered-interaction checks.

With the repository's required Node 24 and installed dependencies:

```sh
node --import tsx scripts/build-trimsika.ts
npx vitest run tests/data/trimsika.test.ts components/sutta-studio/Trimsika.test.tsx components/sutta-studio/sanskritReading.test.ts components/sutta-studio/SuttaStudioView.test.tsx tests/components/sutta-studio/EnglishWord.cycleDots.test.tsx tests/services/registryService.test.ts components/liturgy/concept/devanagari.test.ts
npm run typecheck
npm run build
npm run security:scan-client
```

The legacy `pali`, `paliWords`, and `linkedPaliId` keys remain intact for v1 compatibility. Additive `source.language: sa` and `source.provider: local-edition` distinguish Sanskrit from Pāli. No Pāli syllabifier or Sanskrit-letter filtering is applied. Schema/compiler ingestion for arbitrary local-edition live generation is not enabled by this reader-only change.

## Source and editorial decisions

Base edition: Sylvain Lévi, *Vijñaptimātratāsiddhi: Deux traités de Vasubandhu* (1925), printed pp. 13–14; [Gallica catalogue](https://gallica.bnf.fr/ark:/12148/bpt6k326626j), [scan mirror](http://prajnaquest.fr/downloads/BookofDzyan/Sanskrit%20Buddhist%20Texts/vijnaptimatratasiddhi_1925.pdf). The companion source research visually checked the root verses: vv. 1–14 on printed p. 13 / PDF spread 15 right; vv. 15–30 on p. 14 / PDF spread 16 left. The adopted IAST study transcription standardizes spacing, punctuation, anusvāra and sandhi layout. Metre markers remain in `metricalText`; display text drops only those markers. Verse 5 uses standard `arhattve`.

One explicit emendation in v. 13 removes the misleading printed avagraha: `mado ’vihiṃsāhrīr` → `mado vihiṃsāhrīr`, parsed as vihiṃsā + ahrīḥ, harmfulness + shamelessness. Edition readings such as v. 12 `krodhopanahane`, v. 13 `uddhavaḥ` / `kausīdyaṃ`, v. 26 `nāvatiṣṭhati`, and v. 28 `yadālambanaṃ vijñānaṃ` / `vijñānamātratve` are retained and disclosed. All manuscript variants and the 1932 corrigenda have not been audited.

The 1925 Sanskrit edition is the public-domain source. The modern GRETIL/Buescher transcription has a distinct CC BY-NC-SA 4.0 notice and was used only for comparison, not imported. The original interlinear draft reproduces no modern English translation; the separate Lapis Lazuli witness added later is documented below. The interlinear English glosses, alternatives, explanatory notes, morphology and relations are original Codex draft inferences. Edition citations support wording only; separate annotation citations identify the unreviewed inference, not independent lexical attestation. No DPD, named translator or Sanskrit dictionary grounding is claimed.

## Coverage and alignment contract

- 30/30 verses; 307 written Sanskrit tokens; every token has one English phrase binding.
- 371 display slices across those tokens; 41 tokens have multiple slices.
- 345 draft senses, with 38 tokens offering two contextual phrasings.
- 29 selective morphology hints and 11 selective relations, all marked curatorial; this is not exhaustive morphology or dependency annotation.
- 146 explicitly classified ghost tokens, including punctuation; opacity 0.3, italic, and hideable.
- 60 citation records: one source citation plus one unreviewed annotation record per verse.
- One grammatical ripple example: v. 17 `vikalpo`, “construction” → “act of discrimination”, changes the supplied article from “is a” to “is an”; wraparound restores both.

**Alignment is at the full written-token level.** A multiword English phrase may render a single sandhi-combined Sanskrit token. Compound display slices preserve every written character; they are not independently translated, reconstructed unsandhied morphemes or precise subword alignments. Every slice of such a token points back to the whole-token English gloss. Words with whole-token morphology or relations remain a single display segment, so the metadata cannot misleadingly attach to one substring. The packet deliberately has no `linkedSegmentId` or segment senses. The existing segment-sense cycling/synchronization path is not relied on.

The explicit `order` list reorders English while including each written token once. Free-standing English scaffolding is separately declared with `ghostKind`; no automatic stopword heuristic is used. Faded opacity means supplied English, not uncertainty. Alternative phrasings are not presented as equally attested doctrinal alternatives. MN10 source clicks retain their tooltip facets. Sanskrit hover/focus shows a reading aid and tap/Enter/Space pins it; English clicks rotate word senses independently, with cycle dots indicating available word senses. Text selection suppresses accidental cycling, using the shared reader behavior.

Unresolved interpretation includes the v. 3 compound, v. 18 syntax, v. 19 `tat`, v. 22 pronoun reference and the edition-dependent v. 28. The draft does not settle these. It is a study aid pending review by a Sanskrit/Yogācāra reader, not a polished literary translation.

## Validation and browser acceptance

All 30 source surfaces reconstruct exactly from their written-token display slices. The deterministic rebuild equals the checked-in packet. Existing packet, phase and ID validators pass; tests additionally check unique IDs, complete ordered source coverage, one English binding per token, closed citation/relation/ripple targets and explicitly typed ghosts. Negative cases reject missing verses, changed Sanskrit, duplicated alignment indices and dangling relations.

The optional external-source argument of the old packet validator is Pāli-oriented and counts English labels excluding ghosts. It cannot certify this packet's source/English round trip; exact Unicode reconstruction and explicit ghost checks are therefore separate tests, rather than treating that optional path as an authority on Sanskrit.

Local Chrome checks verified Library → card → Start Reading → `/sutta/trimsika`, rendered English sense replacement and wraparound, the v. 17 article ripple, ghost hide/restore, opacity, audit selection and close, and word/slice behavior. Native Enter while hovering English restored a cycled sense and its article. The final script-disclosure revision was also checked in Chrome: no Devanāgarī in the default row; tapping Sanskrit opens a compact card; closing it leaves the changed English sense and article intact. At a requested 390×844 viewport (354×767 CSS pixels in this browser), the long v. 3 compound and disclosure wrapped with no horizontal page overflow. The disclosure content bounds were x=20.91–333.64 within a 354px viewport and the Devanāgarī had equal scroll/client width (313px). Screenshots were visually inspected. The temporary override was successfully reset to the normal 1356px viewport. Earlier browser-control timeouts are superseded by these successful final checks. Real touch-device behavior is not certified; synthetic touch-pointer, keyboard and dismissal paths are covered.

Technical validation: 39 focused tests in 7 files passed; TypeScript and production build passed; client-secret scan passed. Lint over changed code reported 42 warnings and zero errors, including inherited hooks/typing warnings and one ignored-data-file warning. No billed generation, push, publication or deployment was performed.

## Contextual Sanskrit reading aid

The accepted design keeps IAST as the only default Sanskrit source row. Devanāgarī is a deterministic display transliteration inside the existing compact tooltip treatment, shown on hover/focus and pinned by tap or Enter/Space. One card can be pinned; another Sanskrit word switches it. Close, Escape and outside pointer-down dismiss it, including the touch-like hover state. A small Word note control reveals the current unreviewed note. Sanskrit interaction never changes the English sense, and opening/closing the aid preserves an already selected English rendering. The shared MN10 layout, menus and Pāli source behavior remain intact.

`components/sutta-studio/sanskritReading.ts` reuses the existing pure Devanāgarī akṣara parser, but requires an **exact** reverse IAST match rather than its looser chant-oriented comparator. All 307 written tokens round-trip; unsupported spellings fall back to IAST. The derived script is not a new source witness. Conjuncts stay together. The unit line is labeled as written akṣaras, not morphemes or metrical beats; no audio or phonetic performance is supplied. The distinction follows [Unicode's Devanāgarī description](https://www.unicode.org/versions/Unicode16.0.0/core-spec/chapter-12/), which distinguishes orthographic syllables from phonological syllables. The IAST remains the canonical aligned text.

## Review status

Independent source-only code review was attempted through the existing Claude Code Pro login; the organization refused subscription access. No API key fallback was used. The authorized AGY fallback (Google Gemini 4 Argon High) completed a source-only review. Supported findings were fixed: misleading audit instructions, whole-token grammar on display substrings, incomplete alternate/ripple validation and an empty Unknowns section. Its proposed common-reader source-click change was not adopted: MN10 retains its existing facet workflow. A later explicit design correction authorized the separate Sanskrit reading disclosure and native source-keyboard support described above. A bounded follow-up review of those fixes timed out after 240 seconds without a report. A separate source-only review of the final Sanskrit disclosure also timed out after 240 seconds with a turn still in progress and no report. A last reduced source-only packet using available AGY/Gemini 3.8 Flash High also reached its 180-second limit with a turn in progress and no report. Review retries stopped. Final independent clearance of the final revision remains pending; none of these timeouts is approval. The review payload contains relevant source and synthetic technical notes, excluding this source text, annotations, packet, credentials, private runtime data and personal memory.

Review receipts and exact outgoing-payload hashes are preserved outside the repository in `../trimsika-review/manifest.json` , `disclosure-manifest.json` and `disclosure-compact-manifest.json`. Initial findings and the timeout are retained there; neither is presented as final approval.

## Remaining work before scholarly acceptance

A Sanskrit/Yogācāra reviewer should validate the glosses, alternatives, compound interpretation, selective grammatical claims and source normalization. Proper morpheme alignment or exhaustive morphology requires additional grounded curation, not relabeling the present whole-token links. Integration into the main checkout, publication and deployment remain separate actions outside this task.


## Smaller reading groups — 2026-10-19 revision

The owner requested roughly three Sanskrit words per line, at most five. `lineEnds` in `annotations.json` now supplies inclusive one-based ends of contiguous groups. Offline assembly rejects unordered, fractional, oversized or incomplete groups. The written token is the counting unit: existing compound slices are never promoted into extra words to satisfy the limit. These are reading groups, not new metrical lines or new source segments; the canonical verses and their metrical source records remain unchanged. Narrow screens may wrap a group further with the existing responsive styling.

There are **102 groups / 307 words (mean 3.01)**: 2 one-word, 27 two-word, 46 three-word, 22 four-word and 5 five-word groups. Five-word groups preserve larger phrases in vv. 6, 14, 15, 18 and 21. The long final compound of v. 6 stays intact as one written token. Verse 17 has four groups: 3 + 3 + 2 + 3.

English bindings follow their source group, retaining their authored relative order within that group. Smaller groups expose interlinear fragments where Sanskrit and English syntax span different boundaries; this revision does not rewrite the draft into a new translation. Four explicit ghost-only `layoutWordId` anchors keep supplied material with its phrase: v1g1 (“occurs”) with v1w6; v8g3 (“the”) with v8w4; v23g2 (“the”) with v23w8; v29g5 (“the”) with v29w9. These anchors affect placement only, never gloss lookup, opacity, meaning cycling or translation-link claims. Packets without anchors retain their existing placement behavior.

All source text, all word and display-slice identities, English token IDs/order/text, senses, citations, morphology, relations, ripple targets and provenance are exactly equal to the pre-revision packet once the layout fields are removed. `source.json` is byte-identical; annotations differ only by `lineEnds` and the four `layoutWith` values. **Alignment remains at the whole written-token level; 307-token coverage does not certify exhaustive morphology or internal compound alignment.**

| Verse | Written words in successive groups |
| --- | --- |
| 1 | 3 + 4 + 4 |
| 2 | 3 + 3 + 2 + 2 |
| 3 | 3 + 2 |
| 4 | 2 + 3 + 2 + 4 |
| 5 | 3 + 3 + 4 |
| 6 | 5 + 1 |
| 7 | 4 + 3 + 2 + 4 |
| 8 | 3 + 4 + 2 |
| 9 | 3 + 3 + 4 |
| 10 | 2 + 4 + 3 |
| 11 | 3 + 4 + 2 |
| 12 | 2 + 2 + 3 + 3 |
| 13 | 3 + 3 + 3 + 3 |
| 14 | 3 + 4 + 5 + 2 |
| 15 | 5 + 3 + 3 |
| 16 | 2 + 2 + 4 |
| 17 | 3 + 3 + 2 + 3 |
| 18 | 3 + 4 + 1 + 5 |
| 19 | 2 + 2 + 2 + 4 |
| 20 | 3 + 4 + 3 + 3 |
| 21 | 4 + 2 + 5 |
| 22 | 3 + 3 + 2 + 4 |
| 23 | 2 + 3 + 3 |
| 24 | 3 + 4 + 3 |
| 25 | 4 + 3 + 2 + 2 |
| 26 | 4 + 4 |
| 27 | 3 + 3 + 3 + 2 |
| 28 | 3 + 3 + 2 |
| 29 | 3 + 4 + 2 + 2 |
| 30 | 3 + 3 + 3 + 3 |

Validation: 71 tests in the seven documented focused files pass, including a rendered alignment check for each of the 30 verses, unique English/ghost rendering, ghost placement, cycle/wraparound, the v17 article ripple, compact Devanāgarī disclosure and MN10 fallback. TypeScript, production build, client-secret scan and whitespace checks pass. Focused lint has zero errors and eight existing view warnings. The initial single full-document alignment test exceeded Vitest’s five-second limit; it was split into independently timed verse cases with the same coverage, without relaxing timeouts.

The unchanged local and private preview URLs both return HTTP 200; their served JSON exactly matches the revised packet. A fresh native Chrome window loaded the revision and its accessibility tree confirmed the four verse-17 source/English groups and compact reading controls. **Fresh desktop screenshot, live cycling and narrow-width visual acceptance remain incomplete**: extension tab/session controls timed out, while native app targeting repeatedly switched away from the verification window. No new viewport override was applied. Earlier visual results in this document refer to the preceding revision, not these new groups. No service restart, network change, macOS Preview operation, commit, push, deployment or paid API call was performed. Final independent code clearance remains pending after the already-recorded Claude refusal and AGY timeouts; unchanged blocked reviews were not retried.

Translation attribution was rechecked during this revision: “Codex — original unreviewed study draft.” The 30 edition citations contain Sanskrit excerpts and explicitly support wording only; the 30 annotation citations mark original unreviewed curator inference. There is no credited published English translation or copied published-English excerpt in the citation records. The provenance states that no published modern English translation is reproduced; this code/layout pass does not independently establish textual originality by comparison against every published translation. The always-visible draft note and expandable provenance panel remain discoverable without another permanent row.


## Named witnesses and Malayalam working translation — 2026-10-19

The reader now has a compact **Reading** disclosure with separate language and named-witness selectors. Language changes remember the previously selected witness, and returning to English preserves the chosen lexical sense and ghost ripple. A witness applies across the whole reading. Lexical alternatives remain alternatives within the original draft; they are never presented as other translators. Attribution, source language/edition, revision, license statement and normalization are available in the disclosure. The source panel labels its prior English metadata as the interlinear study draft rather than crediting it for every selected language.

The bilingual checkpoint bundled **Codex English study draft** and **Malayalam working translation, AI-assisted and not yet independently reviewed**. The later Lapis Lazuli import below adds a third witness and an actual alternate English edition. The Malayalam is original prose drafted directly against this packet's normalized Lévi Sanskrit, with the existing curation notes consulted for ambiguities. It is neither a Malayalam-script transliteration nor a published scholar's translation. A targeted source search did not verify an established reusable Malayalam edition; that does not prove none exists. No Salvini, Anacker, Cook, Chinese-language, Tibetan or Hindi text is imported. Lapis Lazuli’s Chinese-derived English is added in the subsequent revision below; verified texts and reviewed correspondences for further editions still require curation.

`data/trimsika/malayalam.json` contains all 30 verses as 99 authored phrase mappings, assembled by `malayalam.ts`. All 307 Sanskrit token IDs occur once in source order. Three Malayalam phrases span adjacent Sanskrit reading groups: v16 groups1–2, v21 groups2–3 and v24 groups2–3. Their source spans contain 4/7/7 written tokens respectively; **the displayed Sanskrit groups remain the existing 102 groups, maximum five words**. Each wider translation appears once, with links from the other covered groups. There is no invented word-by-word subdivision to force the Malayalam into the Sanskrit layout.

Seven mappings retain explicit uncertainty: v3g1, v18g2, v19g4, v22g4, v24g2, v28g1 and v28g3. Their notes preserve compound scope, edition syntax, unresolved pronouns and the v24→25 transition. They receive no definite-correspondence arrows. Every mapping is unreviewed. An additional AI-only language pass read all 30 verses; it produced two wording corrections (neutral feeling in v4 and arhat wording in v7) and a correction to the v28 note's grammatical-voice description. All three were incorporated. This is not independent human, native-speaker or scholarly clearance. Confidence in the provisional Malayalam is approximately 0.72, lower for the explicitly uncertain passages; specialist review remains necessary.

The shared contract is in [SUTTA-015](../../adr/SUTTA-015-named-translation-witnesses.md). Immutable ordered witness passages and their own numbering are separate from source/target span assertions. Many-to-many source spans can cross verses without assuming equal numbering. Target offsets count Unicode code points and must respect grapheme boundaries. Every target code point must be mapped exactly once, including explicitly unaligned text; omissions are explicit. Placement anchors are not correspondence evidence. Missing source coverage and unavailable/invalid witnesses remain visible, without falling back to another translator. The full witness can be read in its original order inside the disclosure. Phrase evidence/commentary is disclosed separately from its fixed text.

Source, annotations, provenance, all 30 canonical verses, word/slice IDs, English glosses/senses/ripples, grammar relations and layout groups are exactly unchanged from the post-layout baseline; only the new `translations` catalog differs in the generated packet. **English alignment is still whole-written-token alignment, and Malayalam alignment is phrase-level. Neither 307-token coverage nor internal display slices establish complete morphology or internal compound alignment.**

Validation: 120 tests in 11 files pass, including every Malayalam verse, cross-language state preservation, synthetic cross-verse/many-to-many cases, Unicode/RTL, uncertain/unaligned handling, missing witnesses and invalid mapping rejection. After the final note correction, the 10 packet/data tests pass again. TypeScript, production build, client-secret scan and whitespace checks pass. New witness modules lint without warnings; the broader touched components retain 10 inherited warnings and no errors. Both existing local/private previews serve HTTP200 and the exact current bilingual packet.

Fresh desktop/narrow-width screenshot and live switching acceptance remain **pending**. The existing preview tab belongs to the original task; creation of a separate controlled verification tab timed out, and the subsequent inventory returned no connected browsers. No viewport override, macOS Preview operation, listener/forward change or browser permission bypass was attempted. Automated DOM tests cover wrapping classes and all rendered phrase/source placements, but do not certify pixel-level responsive layout. Final independent code review remains pending after the already-recorded Claude refusal/AGY timeouts; those unchanged failures were not retried. No commit, push, deployment, publication or billed API call occurred.


## Lapis Lazuli alternate English witness — 2026-10-19

The catalog now has **three witnesses in two languages**: the original Codex English interlinear draft, the original AI-assisted Malayalam working translation, and **Lapis Lazuli Texts · English from Chinese**. The latter is an actual published English witness, not a second generated draft or a lexical alternative. The [publisher page](https://lapislazulitexts.com/tripitaka/T1586-LL-trimsika/) explicitly links [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/). It credits no individual English translator, so attribution names the publisher and states its Chinese source: Taishō Tripiṭaka volume 31, no. 1586. The Sanskrit source panel's original draft metadata does not claim authorship of this selected witness.

`data/trimsika/lapis-lazuli.json` preserves all **30 publisher verses / 120 lines** with original numbering, spelling and punctuation. Only HTML line breaks become newlines; apparent errors such as “conveyence” and “unconsciousness” are intentionally retained. The ordered passage JSON has SHA-256 `3fbd01c545e0959c879d327850b635bde5cdcb9898e6f32d3f1eb62c56703e0d`, independently captured from the publisher HTML on 2026-10-19. The full original-order translation remains available in the Reading disclosure even when the interlinear presentation follows the Sanskrit source positions.

The 109 curator-authored phrase mappings comprise **87 asserted, 20 uncertain and 2 explicitly unaligned** mappings. Every mapping remains unreviewed. All target characters are retained exactly once; source spans touch 304 of the 307 Sanskrit written tokens, including uncertain candidates. Source tokens `v5w7` (tadālambaṃ), `v24w9` (aparā) and `v24w10` (niḥsvabhāvatā) have no asserted or candidate span. The reader displays missing coverage instead of inventing equivalence. These counts measure structural completeness, not translation accuracy.

The two unaligned passages are LL10's final sentence (“And the object of each of these is not the same.”) and LL24's final two lines. They remain readable, with placement anchors that create no correspondence arrows. Uncertain mappings likewise receive no definite arrows. In particular LL22's final polarity and LL28's conditioned/wisdom terminology differ from the adopted Sanskrit and are disclosed without silently correcting the English. Cross-verse spans represent actual numbering shifts: LL3→Sanskrit4, LL4→5, LL5→8, LL6/7↔6/7, LL11→10/11, LL12→11/12, LL13→12/13 and LL14→13/14. Equal verse numbers are not treated as evidence.

The broad location comparison is provisional (confidence approximately 0.85, lower for flagged readings). Qualified comparison of the Chinese-derived English with this exact Sanskrit edition remains outstanding. **Neither fixed witness claims internal compound or morpheme alignment.** The original English draft still links whole written tokens; Malayalam and Lapis Lazuli use phrase spans over whole tokens. No 307-token coverage claim establishes complete morphology.

Final technical checks: **123 tests in 13 files pass**, covering all 30 Malayalam verses, source/ID/layout preservation, actual named-English switching, language-specific witness memory, return to the draft's selected sense/article ripple, exact Lapis wording, cross-verse spans, Unicode/grapheme boundaries, explicit uncertainty and invalid data. TypeScript, production build, client-secret scan, new-module lint and whitespace checks pass. Existing production chunk-size warnings remain. Source, annotations and original provenance are byte-identical to the post-layout baseline; removing the new catalog makes the generated packet exactly equal to that baseline. The Sanskrit remains 102 groups / 307 words, mean 3.01, maximum five.

The existing local and approved private reader routes both return HTTP200, and both serve JSON exactly equal to the final three-witness packet. No services or network settings changed. **Fresh desktop/narrow visual and live switching acceptance remain incomplete** for the previously recorded browser-control reason: existing tabs are owned by the original task, new controlled-tab creation timed out with uncertain outcome, and the subsequent inventory showed no connected browsers. A final read-only inventory later recovered one Chrome connection, but attaching to the apparent verification tab again timed out after 30 seconds; no page interaction or viewport change was verified. The tab-attachment outcome remains uncertain. Automated DOM coverage does not replace that visual check. Final independent code clearance and scholarly review remain pending; the unchanged Claude refusal/AGY timeouts were not retried. No Preview action, permission bypass, billed API, commit, push, public publication or deployment occurred.

# Phase-g — curation log

**Date:** 2026-05-13
**Curator:** Adi + assistant (Opus 4.7 1M)
**Commit:** filled in commit metadata below
**Outcome:** ✅ Applied. 6 words / 10 segments. Three pedagogical firsts: (a) same surface 'bhikkhū' in its 3rd grammatical role across e/f/g (acc/voc/nom); (b) bhagavā stem in genitive (1st gen-bhagavā in the corpus, contra phase-b/e's nom-sg); (c) aorist 3pl (contra phase-e's aorist 3sg — number contrast).
**Pāli:** Bhadante"ti te bhikkhū bhagavato paccassosuṁ
**Readable:** "Sir!" those monks replied to the Blessed One.
**Canonical segments:** mn10:1.5

---

## 0. Phase brief

```json
{
  "phaseId": "phase-g",
  "pali": "Bhadante ti te bhikkhū bhagavato paccassosuṁ",
  "literal": "Venerable-Sir end-quote those monks of-Buddha they-replied-back",
  "readable": "\"Sir!\" those monks replied to the Blessed One",
  "function": "The monks' response to the Buddha's call. Completes the call-and-response that opens MN10. Pedagogically rich: same surface 'bhikkhū' appears in its third grammatical role; same stem 'bhagavā' appears in a new case; aorist tense shifts from singular (phase-e āmantesi) to plural (paccassosuṁ).",
  "tensions": [
    {
      "id": "same surface, three cases",
      "primary": true,
      "description": "'bhikkhū' is the surface for nom-pl (phase-g), acc-pl (phase-e), AND voc-pl (with -avo ending; phase-f Bhikkhavo is the alternative voc-pl form). Across three consecutive phases, the same monks-noun does three different grammatical jobs. Pedagogical gold: shows how Pāli leverages context to disambiguate identical surface forms."
    },
    {
      "id": "bhagavā in genitive (case contrast)",
      "primary": true,
      "description": "Phase-b/e had nominative 'bhagavā' (the Buddha as subject). Phase-g has 'bhagavato' (genitive — 'of/to the Buddha', recipient of the reply). Same lemma, same refrain (the bhagavā stem), different role. The genitive-as-dative pattern is also pedagogically useful: Pāli verbs of speaking take genitive recipients."
    },
    {
      "id": "aorist 3sg vs 3pl",
      "description": "Phase-e āmantesi was aorist 3rd-singular ('he addressed'). Phase-g paccassosuṁ is aorist 3rd-plural ('they replied'). Same tense, different number. The -si ending vs the -suṁ ending tracks the subject's number — a small but reliable Pāli pattern."
    },
    {
      "id": "compound verb paṭi+su (paccassosuṁ)",
      "description": "paṭi (back) + su (hear) → 'to hear-back' → 'to reply'. The compound logic is transparent: replying IS hearing-back in Pāli's mental model. Cf. English 'reply' < Latin 're-plicare' ('to fold back') — similar compound logic in a different family."
    },
    {
      "id": "Bhadante — Lookup coverage gap",
      "description": "Like phase-f's 'Bhikkhavo', the vocative-sg 'Bhadante' isn't directly in DPD's Lookup table. The bhadanta lemma exists; -e is the standard vocative-sg masc ending. Grounded curatorially."
    }
  ],
  "register": "monks respond; the call-and-response is complete",
  "scope": ["mn10:1.5"]
}
```

**Plain-language summary:** Six words: the monks answer "Sir!" to the Buddha. Phase-g teaches three things: (a) how the same surface form ('bhikkhū') can be nominative, accusative, or vocative depending on context; (b) how the bhagavā stem takes different case-endings for different roles (nom 'bhagavā' / gen 'bhagavato'); (c) how Pāli's aorist marks past tense and tracks number on the verb itself.

---

## 1. Current packet snapshot (pre-curation)

| word | id | wordClass | refrain | new-field gaps |
|---|---|---|---|---|
| `Bhadante` | g1 | content | — | no morph; no basis/citations; tooltips use `√bhad` / `[Vocative]` jargon |
| `ti` | g2 | function | — | no basis/citations; tooltips use `[Quotation marker]` |
| `te` | g3 | function | — | no morph; no basis/citations; `[Demonstrative Pronoun]` jargon |
| `bhikkhū` | g4 | content | bhikkhu | no morph; no basis/citations; **`relation: "Replied BY"` — schema tension #12** (subject-of-verb doesn't fit palette) |
| `bhagavato` | g5 | content | bhagava | no morph; no basis/citations; `relation: "Replied TO"` semantically OK (dative-recipient) but lacks epistemicBasis |
| `paccassosuṁ` | g6 | content | — | no isAnchor; no morph on g6s2; no basis/citations; `√su` symbol |

---

## 2. Evidence bundle

```json
{
  "phaseId": "phase-g",
  "providers": ["sc-dictionary-full", "dpd"],
  "usableCitations": [
    {
      "id": "cite:dpd:dpd:30431",
      "lemma": "ti",
      "excerpt": "ti [ind]: (end of direct speech) ' '",
      "decisionRelevance": "PRIMARY for g2. REUSED from phase-f."
    },
    {
      "id": "cite:dpd:dpd:31134",
      "lemma": "te",
      "pos": "pron",
      "excerpt": "te [pron]: they; those",
      "decisionRelevance": "PRIMARY for g3 sense 'those'. DPD has 8 te entries; this is the nominative plural reading."
    },
    {
      "id": "cite:dpd:dpd:49885",
      "lemma": "bhikkhu",
      "excerpt": "bhikkhu [masc]: monk; monastic; mendicant; fully ordained monk; lit. beggar",
      "decisionRelevance": "PRIMARY for g4 senses. REUSED from phase-e/f. Confirms bhikkhū's three-case-pattern is anchored to ONE lemma."
    },
    {
      "id": "cite:dpd:dpd:49136",
      "lemma": "bhagavato",
      "pos": "masc",
      "excerpt": "bhagavato [masc]: to the Buddha; for the Buddha",
      "decisionRelevance": "PRIMARY for g5 'to the Blessed One' (the dative-like reading). DPD ATTESTS the dative reading explicitly — earns the 'Replied TO' arrow."
    },
    {
      "id": "cite:dpd:dpd:49137",
      "lemma": "bhagavato",
      "pos": "masc",
      "excerpt": "bhagavato [masc]: of the Buddha",
      "decisionRelevance": "Secondary for g5 'of the Blessed One' (the bare genitive reading)."
    },
    {
      "id": "cite:dpd:dpd:39413",
      "lemma": "paccassosi",
      "pos": "aor",
      "morphology": { "tenseAspect": "aorist", "form": "finite" },
      "excerpt": "paccassosi [aor]: replied (to); agreed (with); assented (to)",
      "decisionRelevance": "PRIMARY for g6 senses. DPD attests the lemma as aorist; paccassosuṁ is the 3pl form of the same headword."
    }
  ],
  "providerNotes": {
    "bhadanteGap": "DPD's Lookup table doesn't index 'Bhadante' — similar gap to 'Bhikkhavo' in phase-f. Grounded curatorially in the bhadanta lemma + standard vocative-sg morphology.",
    "paccassosumLemmaResolution": "DPD returned the lemma as 'paccassosi' (3sg aorist surface) for the plural form 'paccassosuṁ'. The lemma identification is correct (-si and -suṁ are 3sg/3pl variants of the same aorist stem)."
  },
  "parallels": [
    { "note": "Same 16 mn10 work-level parallels." }
  ],
  "variants": [
    { "note": "Zero variants for mn10:1.5 — line stable across witnesses." }
  ]
}
```

**Citation count: 6 DPD entries (2 reused from phases e/f, 4 new).**

---

## 3. Applied diff (highlights)

- **g1 Bhadante**: morph on g1s2 (case=voc, number=sg, gender=m). Senses: curatorial basis with notes about the Lookup gap; etymological for the literal "good one" reading.
- **g2 ti**: cross-reference facet ("same iti/ti as phase-f"); lexical + dpd:30431.
- **g3 te**: color-explanation facet (pointing pronoun) + cross-reference to phase-e's tatra (same demonstrative system); morph nom/pl/m; lexical + dpd:31134.
- **g4 bhikkhū**: **DROPPED** "Replied BY" relation (tension #12); morph nom/pl/m. **3-case cross-reference facet** explicitly teaches the bhikkhū-acc/voc/nom pattern across phases e/f/g.
- **g5 bhagavato**: **KEPT** "Replied TO" relation (legitimate dative-recipient, type=direction earns the arrow); morph gen/sg/m; epistemicBasis='grammatical' on relation. **Case-contrast facet** teaches nom→gen with phase-b/e cross-reference. 3 senses with lexical basis (dpd:49136 dative + dpd:49137 genitive).
- **g6 paccassosuṁ**: `isAnchor: true` (verb of the response, pivot of the phase). morph on g6s2 (person=3, number=pl, tenseAspect=aorist, form=finite). 3 senses lexical + dpd:39413. Plain-first explanation of the paṭi+su compound logic.

### Citations

- New: dpd:31134 (te), dpd:49136 (bhagavato dat), dpd:49137 (bhagavato gen), dpd:39413 (paccassosi). 4 new.
- Reused: dpd:30431 (ti from phase-f), dpd:49885 (bhikkhu from phase-e).
- Total: 24 → **28**.

---

## 4. Summary of changes

| Change | Where | Verdict |
|---|---|---|
| `isAnchor: true` | g6 paccassosuṁ | Verb of the response — the pivot |
| `morph` on 5 segments (g1s2, g3s1, g4s2, g5s2, g6s2) | g1-g6 | All cases covered: voc-sg, nom-pl, nom-pl, gen-sg, aor-3pl |
| **3-case cross-reference facet** on g4s2 | g4s2 | Explicit teaching of bhikkhū-acc/voc/nom across e/f/g |
| **Case-contrast facet** on g5s2 | g5s2 | Teaches nom-sg (phase-b/e) vs gen-sg (here) for bhagavā stem |
| Color-explanation facet on g3 te | g3s1 | Pointing-pronoun framing |
| **DROPPED** relation on g4s2 | g4s2 | Schema tension #12 hit #2 (subject-of-verb doesn't fit palette) |
| **KEPT** relation on g5s2 (with epistemicBasis 'grammatical') | g5s2 | Legitimate dative-recipient — Pāli genitive functions as dative for verbs of speaking |
| Plain-first rewrites across all 10 tooltip arrays | g1-g6 | §3.4 applied; jargon brackets dropped throughout |
| Senses (15 total) with epistemicBasis + sourceCitationIds + confidence | g1-g6 | 13 lexical / 1 etymological / 1 curatorial — healthy distribution |
| 4 new packet.citations + 2 reused | packet.citations | Total 24 → 28 |

---

## 5. Schema tensions

### Tension #12 (S-V-O palette gap) — HIT #2 (now qualifies for action per §3.3)

Phase-e dropped two relations (subject + object both mis-labeled). Phase-g surfaces the same gap on ONE relation (g4s2 subject-of-verb "Replied BY") while ANOTHER is legitimate (g5s2 dative-recipient "Replied TO" — Pāli gen-as-dative for verbs of speaking).

**Pattern clearer now: the arrow palette earns its keep when the Pāli case-marker does work English doesn't have an analog for.** Genitive-as-dative (g5s2 "Replied TO") = pedagogically interesting → arrow earns it. Subject-of-verb (g4s2) = universal across English/Pāli → no arrow needed.

**Hit count now 2/3 batch-3 phases (e + g)**. Qualifies per §3.3 to file as a real schema issue. Action: file GH issue documenting the **arrow-earning rule** discovered through curation — "RelationType is for case-quirks English doesn't share, not for S-V-O." Could be a clarification commit to FEATURES.md §1.3 rather than a schema change. Defer the actual filing to a separate commit; surface in curation log here.

### Tension #1 (DPD stripper) — STAYS RESOLVED

No conflations. Bhadante gap is Lookup coverage (dialectal variant), not a stripper bug.

### Refrain status update

- **bhikkhu**: **4/6 phases** (e bhikkhū-acc, f Bhikkhavo-voc, g te bhikkhū-nom + roots). Definitively recurring; the refrain-explanation facet pattern is mature.
- **bhagavā**: **3/6 phases** (b bhagavā-nom, e bhagavā-nom, g bhagavato-gen). Different morphological forms but same lemma — the refrain claim ALREADY confirmed at 2 hits, now reinforced.
- **viharati**: 1/6 (phase-c). Still a single-appearance.

### Senses-distribution observation

13 lexical / 1 etymological (g1 "Good sir!") / 1 curatorial (g1 "Venerable sir!") + 1 curatorial-marked (g1 "Reverend!"). EpistemicBasis distribution this phase: **86% lexical** — highest yet, reflecting that the DPD root-cause fix delivers clean evidence for most surfaces, with curatorial only when Lookup has a gap.

---

## 6. Plain-register observations

All 10 tooltip arrays pass §3.4 self-check post-rewrite. No leftover failing tooltips flagged.

**Cross-phase observation:** the cross-reference facets (g4s2 referring to phase-e/f, g5s2 referring to phase-b/e) introduce a **new pedagogical pattern**: explicitly teaching by *contrast across phases*. Worth ratifying as a §3.4 sub-pattern: when the same lemma appears in a new case/form, the new phase's tooltip facet should reference the prior appearance — letting the reader build a case-paradigm incrementally as they read.

Proposed §3.4.X amendment (deferred to separate commit): "Cross-phase facet rule — when a recurring lemma takes a new morphological role, the new phase's tooltip should include a cross-reference facet pointing back to the prior form."

---

## 7. Open questions

1. **Bhadante/Bhikkhavo Lookup gaps**: two vocative-sg/pl forms not in DPD's enumerated index. Should we file a DPD upstream issue, or is the lookup gap acceptable when the underlying lemma is attested? **Defer**: when hit count crosses 3, file.
2. **bhagavā stem displays inconsistently across forms**: nom 'bhagavā' (phase-b/e) vs gen 'bhagavato' (here). Both have refrainId='bhagava' but renderer treats them as the same refrain — visually they share underline color, which is correct (same lemma). But the cross-form pedagogy is currently in tooltip facets, not visual. Should refrain styling differentiate same-lemma-different-form? **No**: confusing. The current visual (same color) + tooltip explanation (case-contrast facet) is right.
3. **paccassosuṁ as anchor vs the call (Bhadante)**: both are anchor candidates. The reply-verb (g6) is the syntactic anchor of the response clause; "Sir!" (g1) is the emotionally direct part. Chose g6 because the phase teaches the aorist-3pl + paṭi+su compound — verb-centric pedagogy. Could revisit.
4. **Should the dropped relation (g4s2 "Replied BY") be deleted permanently or just dropped this phase?** Currently the packet shape supports a relation field on any segment; we dropped this one but didn't constrain the schema. Right move: keep the schema permissive, codify the **arrow-earning rule** in FEATURES.md §1.3 (separate commit) so future curators have guidance without a hard schema constraint.

---

## 8. Outcome

- **Packet diff:** applied; commit in metadata.
- **Tests:** ✅ 220 component pass.
- **JSON:** validates; phase-g structure confirmed (g6.isAnchor=true; 5 morph hints; 15 senses with epistemicBasis; 1 relation kept (g5s2 dative-recipient); 28 total citations).
- **Schema tension #12** — hit count 2/3 batch-3 phases — qualifies per §3.3 for follow-up GH issue or FEATURES.md clarification. **Insight surfaced this phase: arrows earn their keep when the Pāli case-marker does work English doesn't have an analog for.**
- **Refrain bhikkhu**: 4/6 phases; bhagavā 3/6 phases. Both definitively recurring.
- **Batch 3 progress:** **3/4 phases complete** (e ✓ / f ✓ / g ✓ / phase-h remaining).
- **Cross-phase facet pattern** (case-contrast cross-references) introduced; proposed for §3.4 amendment.

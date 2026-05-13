# Phase-h — curation log

**Date:** 2026-05-13
**Curator:** Adi + assistant (Opus 4.7 1M)
**Commit:** filled in commit metadata below
**Outcome:** ✅ Applied. 3 words / 6 segments. Closes the narrative-framing arc (phases a-h); the teaching proper begins in phase-1. Refrain bhagavā now hits 4 phases (b/e/g/h) across three morphological forms (nom/gen/nom); third aorist verb in batch 3 (avoca after āmantesi + paccassosuṁ).
**Pāli:** Bhagavā etad avoca
**Readable:** The Blessed One said this.
**Canonical segments:** mn10:1.6

---

## 0. Phase brief

```json
{
  "phaseId": "phase-h",
  "pali": "Bhagavā etad avoca",
  "literal": "Blessed-One this said",
  "readable": "The Blessed One said this.",
  "function": "Closes the narrative framing of MN10. After the response (phase-g), the Buddha begins his speech-act. The phrase is a *cataphoric pointer*: 'etad' looks forward to the teaching that follows in phase-1+. This is the LAST line before the satipaṭṭhāna teaching proper begins.",
  "tensions": [
    {
      "id": "bhagavā returns to nominative",
      "primary": true,
      "description": "Phase-b had bhagavā-nom (introduction). Phase-e had bhagavā-nom (action initiator). Phase-g had bhagavato-gen (recipient of reply). Phase-h returns to bhagavā-nom (back to subject, now speaking). Same stem, three forms across the corpus, cycling between roles as the dialogue alternates."
    },
    {
      "id": "cataphoric 'etad' (this points forward)",
      "primary": true,
      "description": "Where phase-g's 'te' was anaphoric ('those' looking back to bhikkhū already mentioned), phase-h's 'etad' is cataphoric ('this' pointing to what's about to come). Same demonstrative system, opposite temporal direction. Pedagogically: Pāli pronouns can both backward- and forward-reference; case-marking is identical but pragmatics differ."
    },
    {
      "id": "third aorist verb in three phases",
      "description": "āmantesi (phase-e, -si ending) → paccassosuṁ (phase-g, -suṁ ending) → avoca (phase-h, -a ending with augment a-). Three aorist verbs, three different stem-classes and ending patterns. Pāli's aorist is morphologically diverse — the function (past tense) is consistent but the *form* depends on the verb class."
    },
    {
      "id": "etad + avoca Lookup gaps",
      "description": "Like Bhadante (phase-g) and Bhikkhavo (phase-f), the specific surface forms 'etad' and 'avoca' aren't enumerated in DPD's Lookup table. The lemmas (eta- demonstrative, vac- speech-root) are attested but these inflected forms aren't directly indexed. Grounded grammatically / curatorially with notes."
    }
  ],
  "register": "narrative frame closes; the teaching is about to begin",
  "scope": ["mn10:1.6"]
}
```

**Plain-language summary:** Three words: "The Blessed One said this." Closes the call-and-response opening of MN10. Three things to teach: (a) bhagavā stem returns to nominative (4th appearance overall, 3rd form), (b) 'etad' is a *cataphoric* demonstrative — points forward rather than back, (c) 'avoca' uses a different aorist pattern than the prior two verbs (āmantesi, paccassosuṁ).

---

## 1. Current packet snapshot (pre-curation)

| word | id | wordClass | refrain | new-field gaps |
|---|---|---|---|---|
| `Bhagavā` | h1 | content | bhagava | no morph; no basis/citations; `[Possessive suffix]` / `[Nominative]` jargon; **`relation: "Said BY"` — tension #12** |
| `etad` | h2 | function | — | no morph; no basis/citations; `[Demonstrative Pronoun]` jargon; **`relation: "Said WHAT"` — tension #12** (direct object isn't dative — palette type 'direction' mis-fits) |
| `avoca` | h3 | content | — | no isAnchor; no morph on h3s3; no basis/citations; `[Augment]` / `√vac` / `[Aorist 3rd singular]` jargon |

Both relations mis-shaped by the arrow-earning rule (phase-g §5). h1s2 is subject-of-verb (universal grammar); h2s1 is direct-object-of-verb (also universal, though English uses word order rather than case-marking). Drop both.

---

## 2. Evidence bundle

```json
{
  "phaseId": "phase-h",
  "providers": ["sc-dictionary-full", "dpd"],
  "usableCitations": [
    {
      "id": "cite:dpd:dpd:49147",
      "lemma": "bhagavā",
      "excerpt": "bhagavā [masc]: Sublime One; Blessed One; Fortunate One; epithet of the Buddha",
      "decisionRelevance": "PRIMARY for h1 senses. REUSED from phase-b/e. 4th appearance of the refrain (also via gen-form bhagavato in phase-g)."
    }
  ],
  "providerNotes": {
    "etadGap": "DPD Lookup doesn't index 'etad' surface — but eta-/etad- as demonstrative lemma is grammatically standard across Pāli reference works. Curatorially grounded.",
    "avocaGap": "DPD Lookup doesn't index 'avoca' surface — but 'vac' is the underlying root and 'avoca' is its standard aorist 3sg form (a-augment + voc + -a). Grammatically grounded; this is the kind of inflected verbal form DPD's enumeration sometimes misses."
  },
  "parallels": [
    { "note": "Same 16 mn10 work-level parallels." }
  ],
  "variants": [
    { "note": "Zero variants for mn10:1.6 — line stable across witnesses." }
  ]
}
```

**Citation count: 1 reused, 0 new.** (Phase-h is grounded mostly grammatically / curatorially due to Lookup gaps on etad + avoca.)

---

## 3. Applied diff (highlights)

- **h1 Bhagavā**: morph nom/sg/m. 3 senses with lexical basis (dpd:49147 REUSED) + 1 etymological. **DROPPED** "Said BY" relation. h1s2 includes a recurrence-tracking facet ("4th appearance — form has cycled nom→gen→nom").
- **h2 etad**: color-explanation facet (function-word demonstrative, neuter) + cataphoric-vs-anaphoric note + cross-reference to phase-e tatra + phase-g te. morph acc/sg/n. **DROPPED** "Said WHAT" relation. Curatorial basis on the sense (Lookup gap).
- **h3 avoca**: isAnchor=true (verb of saying — final action of the framing). morph on h3s3 (person=3, number=sg, tenseAspect=aorist, form=finite). Plain-first across all 3 segment tooltips. h3s1 explains the augment 'a-' with the Indo-European parallel; h3s2 explains 'vac' → English 'voice'; h3s3 names the aorist-class diversity (compared to āmantesi -si and paccassosuṁ -suṁ). 3 senses: 2 grammatical + 1 curatorial ("declared").

### Citations

No new citations. dpd:49147 REUSED for bhagavā. etad + avoca grounded grammatically/curatorially with notes.

---

## 4. Summary of changes

| Change | Where | Verdict |
|---|---|---|
| `isAnchor: true` | h3 avoca | Final verb of the framing — the Buddha's said-act |
| `morph` on 3 segments (h1s2, h2s1, h3s3) | h1-h3 | nom-sg-m (refrain), acc-sg-n (demonstrative), aor-3sg-finite |
| Recurrence facet on h1s2 | h1s2 | Cross-form tracking (nom→gen→nom across b/e/g/h) |
| Cataphoric note on h2s1 | h2s1 | Pedagogical contrast with phase-g's anaphoric 'te' |
| Aorist-class diversity facet on h3s3 | h3s3 | Compares -si / -suṁ / -a endings across the three aorist verbs of batch 3 |
| **DROPPED** relations on h1s2 + h2s1 | h1, h2 | Both subject-of-verb and direct-object — universal grammar, no arrow-earning quirk |
| Plain-first rewrites across all 6 tooltip arrays | h1-h3 | §3.4 applied; jargon brackets dropped |
| Senses (7 total) with epistemicBasis + citations + confidence | h1-h3 | 3 lexical (bhagavā) / 1 etymological (h1 "Lucky") / 2 grammatical (avoca said/spoke) / 1 curatorial (avoca "declared", h2 "this") |

---

## 5. Schema tensions

### Tension #12 (S-V-O palette gap) — HIT #3 across batch 3

Phase-e dropped 2 relations. Phase-g dropped 1 (kept 1 legitimate dative-recipient). Phase-h drops 2 more (subject-of-verb + direct-object).

**Pattern now fully clear: the relation palette earns its arrow only when Pāli's case-marker does work English doesn't share.**

- ✓ Arrow earns it: gen-as-agent (phase-a me sutaṁ "Heard BY"), acc-of-time (phase-b "Time WHEN"), loc-of-membership (phase-c "Dwelling IN"), gen-of-possession (phase-d "Town OF"), gen-as-dative-recipient (phase-g g5s2 "Replied TO").
- ✗ Arrow doesn't earn it: subject-of-active-verb (phase-e e3s2, phase-g g4s2, phase-h h1s2), direct-object-of-verb (phase-e e4s2, phase-h h2s1).

Hit count is now **3/4 batch-3 phases** (e + g + h). Solidly qualifies per §3.3 for a documentation amendment. **Recommend filing as separate commit**: add a §1.3 clarification to FEATURES.md formalizing the arrow-earning rule ("relations encode case-quirks English doesn't share — not S-V-O").

### Tension #1 (DPD stripper) — STAYS RESOLVED

No conflations. The two Lookup gaps (etad, avoca) are coverage gaps in DPD's enumeration, not stripper bugs. Curatorial grounding with explicit notes about the gap is the right move.

### Lookup-gap pattern (NEW observation, not yet a tension)

Across batch 3 (phases e-h), DPD's Lookup misses these specific surface forms despite having the underlying lemmas:
- phase-f: Bhikkhavo (vocative pl alt-form; bhikkhave IS indexed)
- phase-g: Bhadante (vocative sg honorific; bhadanta lemma not enumerated as 'bhadante')
- phase-h: etad (neuter nom/acc demonstrative; lemma eta- not enumerated as 'etad')
- phase-h: avoca (aorist 3sg of vac; lemma 'vac' not enumerated with augment)

**Pattern: DPD's Lookup indexes most inflected forms but misses some — specifically (a) augmented aorists, (b) certain vocative forms, (c) demonstrative pronouns in specific case-forms.** Hit count: 4/4 surfaces across batch 3 needing curatorial fallback.

**This is NOT a stripper bug** (the architectural fix in aaa1ff9 is working correctly — the heuristic fallback handled some of these). It's a DPD enumeration limitation. Two paths to address (deferred):
1. File an upstream issue with DPD-DB suggesting these forms be enumerated.
2. Build a Pāli morphology generator as a fallback layer between SQLite Lookup and the heuristic stripper — would programmatically generate aorists, demonstratives, etc. from the lemma table.

Defer; pattern needs another batch to confirm before action.

### Refrain status — batch 3 complete

- **bhagavā**: 4/8 phases (b, e, g, h) across 3 morphological forms (nom-sg / gen-sg / nom-sg). Definitively recurring; the refrain-explanation facet pattern (started in phase-e) is mature.
- **bhikkhu**: 4/8 phases (e, f, g + roots) across 3 cases (acc-pl, voc-pl, nom-pl). Same status.
- **viharati**: 1/8 (phase-c only). Single appearance through batch 3. Likely recurs in satipaṭṭhāna formula (phase-1+).

Both bhagavā + bhikkhu are now stable refrains. The refrain-color palette is earning its keep.

---

## 6. Plain-register observations

All 6 phase-h tooltip arrays pass §3.4 self-check post-rewrite.

**Cross-phase pedagogical pattern, batch 3 retrospective:** the cross-reference facets introduced in phase-d ("kurū- same as in phase-c") and matured in phase-g (3-case cross-reference for bhikkhū, nom→gen contrast for bhagavato) and phase-h (cycling through bhagavā's three forms, comparing demonstrative anaphoric vs cataphoric, comparing three aorist verb classes) — this **cross-phase contrastive facet** is now a stable curation pattern, worth ratifying.

**Proposed §3.4.X amendment** (separate commit): "Cross-phase facet rule — when a recurring lemma or grammatical category takes a new form or context, the new phase's tooltip should include a cross-reference facet pointing back to the prior appearance, letting the reader build the paradigm incrementally."

---

## 7. Open questions

1. **etad and avoca Lookup gaps**: same shape as Bhikkhavo / Bhadante. Hit count 4 across batch 3. Worth filing an upstream DPD issue or building a morphology fallback layer? Defer to post-batch-3 retrospective; for now, curatorial grounding with notes is honest enough.
2. **avoca aorist pattern is morphologically interesting**: a-augment + voc + -a. Different from āmantesi (causative aorist) and paccassosuṁ (compound aorist with -suṁ ending). Should batch 3 add a "Pāli aorist classes" section to the legend? Probably YES (~20 min, separate small commit). Defer.
3. **Multiple aorist verbs in a row**: phases e/g/h all have aorist verbs. The reader sees this pattern emerge; the tooltips on h3s3 explicitly compare endings. Worth a more structural representation? Maybe a small "verb class" chip near the anchor? Renderer Chunk 3 territory.
4. **Three forms of bhagavā traversed in 4 phases**: refrain-color is the same across all forms, but the case-contrast facets carry the morphological story. This works in tooltip prose — but the legend's "refrain" entry could mention that *the same refrain spans multiple morphological forms of the lemma*. Trivial legend update; defer.

---

## 8. Outcome

- **Packet diff:** applied; commit in metadata.
- **Tests:** ✅ 220 component pass.
- **JSON:** validates; phase-h structure confirmed (h3.isAnchor=true; 3 morph hints; 7 senses with epistemicBasis; 2 relations dropped; 28 total citations unchanged from phase-g).
- **Schema tension #12** — hit count 3/4 batch-3 phases — definitively qualifies for FEATURES.md §1.3 clarification (separate commit recommended).
- **DPD Lookup-gap pattern** observed (4 surfaces across batch 3); not a stripper bug, but a coverage issue worth tracking for batch 4 retrospective.
- **Batch 3 COMPLETE: 4/4 phases curated** (e ✓ / f ✓ / g ✓ / h ✓). Narrative-framing arc of MN10 (phases a-h) fully grounded.
- **Refrain machinery is mature**: bhagavā 4/8, bhikkhu 4/8 — both definitively recurring across multiple forms.

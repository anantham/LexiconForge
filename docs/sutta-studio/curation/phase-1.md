# Phase-1 — curation log

**Date:** 2026-05-13
**Curator:** Adi + assistant (Opus 4.7 1M)
**Commit:** filled in commit metadata below
**Outcome:** ✅ Applied. First teaching content of MN10 after 8 phases of framing. 4 words / 8 segments. Centerpiece: the famously-debated compound `ekāyano` — 5 legitimate translator readings curated as separate senses with explicit basis distinctions.
**Pāli:** Ekāyano ayaṁ, bhikkhave, maggo
**Readable:** This, monks, is the direct path
**Canonical segments:** mn10:2.1 (opens batch 4 of CURATION_PROTOCOL §6)

---

## 0. Phase brief

```json
{
  "phaseId": "phase-1",
  "pali": "Ekāyano ayaṁ Bhikkhave maggo",
  "literal": "One-going this monks path",
  "readable": "This, monks, is the direct path",
  "function": "Opens the satipaṭṭhāna teaching proper — the famous declaratory claim that mindfulness is THE path. After 8 phases of narrative framing (a-h: Thus I have heard, on one occasion, the Buddha was dwelling in the Kurus, addressed the monks, the monks responded, the Buddha said this) we finally hear what he said. The first content-word ekāyano carries enormous weight — it's been translated as 'direct', 'one-and-only', 'solitary', 'convergent', 'unique' by different scholars; the choice shapes what the entire sutta is claiming.",
  "tensions": [
    {
      "id": "ekāyano — the famous compound",
      "primary": true,
      "description": "Ekāyana = ek + āyana. ek means 'one' / 'single' / 'alone' / 'unified'; āyana (from root i, 'to go') means 'going' / 'way' / 'goal'. The compound has FIVE legitimate readings: (1) 'one-going' = direct, no detours (Sujato's choice); (2) 'going to one' = convergent path, all approaches merge here; (3) 'going alone' = solitary, the path one walks inwardly (Bhikkhu Bodhi); (4) 'one and only' = THE method, no alternative (doctrinally controversial); (5) 'unified' = the integrated path. Most-debated word in MN10."
    },
    {
      "id": "ayaṁ — demonstrative agreement",
      "description": "Pāli 'ayaṁ' (this) agrees with maggo (path) — both masc nom sg. The agreement is grammatical and the three-word chain (Ekāyano, ayaṁ, maggo, all masc nom sg) is the syntactic spine: adjective-modifier + demonstrative + head-noun, all matched in case/number/gender. English needs explicit word order ('this direct path'); Pāli uses case-marker agreement and word-order is freer."
    },
    {
      "id": "Bhikkhave — vocative interjection",
      "description": "Refrain bhikkhu hit #5 (canonical voc-pl form, alternative to phase-f's Bhikkhavo). The Buddha addresses the monks AGAIN here — he's been speaking to them for two phases already. Vocative is rhetorical: 'pay attention now'. Pedagogically the vocative MID-SENTENCE is distinctive in Pāli; English would typically front-load or trail it."
    },
    {
      "id": "maggo — the head noun",
      "description": "Magga is the central Pāli word for 'way / path / road' — covers physical roads, abstract methods, and the Buddha's eightfold path. DPD glosses 'road; path; track; way' (lexical) AND 'way; means; method' (abstract). The phase's claim is about a path that's both literal (going somewhere) and methodological (a way of practice)."
    },
    {
      "id": "Ekāyano — Lookup gap",
      "description": "DPD's Lookup table doesn't index 'Ekāyano' specifically (5th Lookup-gap observation in batch 3+4: Bhikkhavo, Bhadante, etad, avoca, Ekāyano). The lemma ekāyana is grammatically standard; the masc-nom-sg surface isn't enumerated. Grounded curatorially with explicit translator-debate notes."
    }
  ],
  "register": "the teaching opens; the Buddha makes his bold declaratory claim",
  "scope": ["mn10:2.1"]
}
```

**Plain-language summary:** Four words: "This, monks, is the direct path." The Buddha makes the central claim of MN10 — mindfulness practice is THE path. Three pedagogical layers: (a) the centerpiece word `ekāyano` is genuinely contested by translators, with 5 different legitimate readings; (b) Pāli's case-agreement chains adjective + demonstrative + noun (all masc nom sg) where English would use word order; (c) the refrain bhikkhu hits its 5th appearance, now firmly established.

---

## 1. Current packet snapshot (pre-curation)

| word | id | wordClass | senses | new-field gaps |
|---|---|---|---|---|
| `Ekāyano` | p1 | content | 5 (already a rich translator-debate cycle!) | no isAnchor; no morph; no basis/citations; **relation 'Way TO' type=ownership mis-fits palette** |
| `ayaṁ` | p2 | function | 1 | no morph; no basis/citations; `[Demonstrative]` / `[Nominative Masculine Singular]` jargon; **relation 'This IS' type=direction doesn't fit case-quirk rule** |
| `Bhikkhave` | p3 | content (refrain=bhikkhu) | 5 (also rich!) | no morph; no basis/citations; `[Vocative Plural]` + emoji jargon |
| `maggo` | p4 | content | 3 | no morph; no basis/citations; `√magg` jargon |

**Strengths already present:** the 5-sense cycle on Ekāyono ALREADY captures the translator debate (direct/one-way/solitary/convergent/only) — pedagogically remarkable; the cycling alone teaches the controversy. The ripples on Ekāyono ghost1 adjust the English helper word per sense ("is the" / "is a" / "is the point of"). This is the packet's existing pedagogical density.

---

## 2. Evidence bundle

```json
{
  "phaseId": "phase-1",
  "providers": ["sc-dictionary-full", "dpd"],
  "usableCitations": [
    {
      "id": "cite:dpd:dpd:8757",
      "lemma": "ayaṁ",
      "pos": "pron",
      "excerpt": "ayaṁ [pron]: this; this person; this thing",
      "decisionRelevance": "PRIMARY for p2 single sense. Demonstrative pronoun masc nom sg."
    },
    {
      "id": "cite:dpd:dpd:49868",
      "lemma": "bhikkhave",
      "pos": "masc",
      "morphology": { "gender": "m" },
      "excerpt": "bhikkhave [masc]: monks",
      "decisionRelevance": "PRIMARY for p3 first two senses. The canonical voc-pl form (DPD enumerates this; phase-f's Bhikkhavo was the alternate)."
    },
    {
      "id": "cite:dpd:dpd:50495",
      "lemma": "magga",
      "pos": "masc",
      "morphology": { "gender": "m" },
      "excerpt": "magga [masc]: road; path; track; way",
      "decisionRelevance": "PRIMARY for p4 senses 'path' and 'road'. The core path-word."
    },
    {
      "id": "cite:dpd:dpd:50496",
      "lemma": "magga",
      "pos": "masc",
      "morphology": { "gender": "m" },
      "excerpt": "magga [masc]: way; means; method",
      "decisionRelevance": "PRIMARY for p4 sense 'method'. The abstract sense — frames satipaṭṭhāna as a methodological path, not just a physical one."
    }
  ],
  "providerNotes": {
    "ekāyanoGap": "DPD Lookup doesn't index 'Ekāyano' surface. The compound ekāyana is grammatically constructed (ek + āyana). 5 translator readings curated as senses with curatorial basis + per-sense notes citing the relevant translator/commentary tradition.",
    "bhikkhaveSecondaryGlosses": "DPD only attests 'monks' for bhikkhave. The 5 senses (Mendicants/Monks/Sharers/Seekers/Friends) include 3 etymologically- or curatorially-derived alternatives — flagged as etymological or curatorial basis with notes."
  },
  "parallels": [
    { "note": "Same 16 mn10 work-level parallels — including the famously-titled EA 12.1 'The One Way In Sūtra' (Chinese), whose Chinese title explicitly endorses the 'one way' reading of ekāyana — a comparative datum about how the compound was translated cross-tradition." }
  ],
  "variants": [
    { "note": "Zero variant readings for mn10:2.1 — line stable across witnesses." }
  ]
}
```

**Citation count: 4 unique DPD entries, all new (ayaṁ, bhikkhave, magga-road, magga-method).**

---

## 3. Applied diff (highlights)

- **p1 Ekāyono**: `isAnchor: true` (centerpiece word). morph nom/sg/m on p1s3. **DROPPED** "Way TO" type=ownership relation (didn't fit case-quirk palette). 5 senses all `curatorial` with per-sense translator-tradition notes:
  - "direct" — Sujato's choice (high confidence)
  - "one-way" — older translations (medium)
  - "solitary" — Bhikkhu Bodhi (medium)
  - "convergent" — interpretive (low)
  - "only" — doctrinally controversial (low)

- **p2 ayaṁ**: color-explanation facet (function-word pointer) + cross-reference to phase-h etad and phase-g te (same demonstrative system, different cases). morph nom/sg/m. **DROPPED** "This IS" type=direction relation (universal grammar, no case-quirk). 1 sense lexical + dpd:8757.

- **p3 Bhikkhave**: refrain hit #5 — refrain-explanation facet on p3s2 references all 5 prior appearances. morph voc/pl/m. 5 senses: 2 lexical (DPD-attested "Mendicants"/"Monks" + dpd:49868), 2 etymological ("Sharers" from bhaj-share, "Seekers" from bhī-kkh danger-seer), 1 curatorial ("Friends" — Thanissaro-style relational rendering). Each with notes explaining its basis.

- **p4 maggo**: plain-first rewrite (√magg → "magga is the central Pāli word for…"). morph nom/sg/m. 3 senses lexical: "path"/"road" + dpd:50495, "method" + dpd:50496 (the abstract sense — frames satipaṭṭhāna as method, not just road).

### Citations

4 new entries (dpd:8757 ayaṁ, dpd:49868 bhikkhave, dpd:50495 magga-road, dpd:50496 magga-method). Total: 28 → **32**.

---

## 4. Summary of changes

| Change | Where | Verdict |
|---|---|---|
| `isAnchor: true` on Ekāyono | p1 | The contested compound; pedagogical centerpiece |
| `morph` on 4 segments (p1s3, p2s1, p3s2, p4s2) | p1-p4 | All four words show case-agreement chain (nom/sg/m — Ekāyono, ayaṁ, maggo) + voc/pl/m (Bhikkhave); explicit morphological grounding |
| **DROPPED** "Way TO" relation on p1s2 | p1 | type=ownership doesn't fit (no genitive); ekāyano describes path's nature not destination |
| **DROPPED** "This IS" relation on p2s1 | p2 | Universal grammar (demonstrative + noun); no case-quirk arrow earns |
| Color-explanation facet on p2 ayaṁ | p2s1 | Function-word pointer pattern; cross-references etad/te demonstratives |
| Refrain-explanation facet on p3s2 (refrain hit #5) | p3s2 | Mature pattern; references all prior bhikkhu appearances |
| Senses (14 total) with epistemicBasis + notes + confidence | p1-p4 | **8 lexical + 4 curatorial + 2 etymological** — highest epistemic-diversity phase so far, reflecting that Ekāyono and Bhikkhave both carry translator-debate dimensions |
| Plain-first rewrites across all 8 tooltip arrays | p1-p4 | §3.4 applied; all jargon brackets dropped |
| 4 new packet.citations | packet.citations | 28 → 32 |

---

## 5. Schema tensions

### Tension #12 (arrow-earning rule) — STAYS STABLE post-codification

The FEATURES.md §1.3 amendment (`9830ef1`) codified the rule. Phase-1's two pre-existing relations both failed the rule and were dropped. The rule is now reliable; no new schema decisions surfaced.

### Tension #1 (DPD stripper) — STAYS RESOLVED

No conflations. Ekāyono is a Lookup gap (5th occurrence of this pattern across batch 3 + 4), not a stripper bug.

### Lookup-gap pattern (running count)

Across batch 3 + phase-1, 5 surfaces needed curatorial fallback because DPD's Lookup didn't enumerate them despite the underlying lemmas being attested:
- Bhikkhavo (alt voc-pl)
- Bhadante (voc-sg honorific)
- etad (neuter demonstrative)
- avoca (augmented aorist)
- **Ekāyono (compound surface) ← NEW**

The pattern is consistent: certain inflected/compound forms fall outside DPD's enumeration even when the morphology is grammatically standard. **5 hits across 5 phases now.** Action: defer the upstream-fix decision (DPD issue OR morphology generator) until phase-2/3 surface another to see if there's a pattern in WHICH forms fall outside. If the next 2-3 phases each have 1+, the case for a morphology-generator fallback layer becomes strong.

### Translator-debate as first-class curation pattern (NEW observation)

Phase-1's Ekāyono is the first phase where the SENSES themselves encode a translator debate — 5 distinct readings of one word, each with its own scholarly tradition. This is qualitatively different from earlier phases where senses were mostly attestation+nuance variations.

**The packet shape supports this well**: `Sense.epistemicBasis: 'curatorial'` + `Sense.notes` carrying the tradition reference + `Sense.confidence` ranking the readings. The cycle-through-facets affordance lets the reader experience the debate by clicking.

**Worth ratifying as a curation pattern**: for words with significant scholar disagreement, surface the debate in the sense cycle rather than picking a single canonical reading. The reader chooses which lens (or none — Pāli is genuinely ambiguous here).

Proposed §3.4.2 (deferred to separate commit): "Translator-debate cycle rule — when a word has multiple legitimate scholarly readings, surface them as distinct senses with `'curatorial'` basis, per-sense `notes` citing the tradition, and explicit `confidence` ranking. The reader experiences the debate via facet-cycling, not via authorial dictate."

### Refrain status — now mature

- **bhikkhu**: 5/9 phases (now solidly recurring across e/f/g/h/1)
- **bhagavā**: 4/9 phases (across 3 forms — nom/gen/nom — through b/e/g/h)
- **viharati**: 1/9 (single appearance phase-c; **expected to recur in phase-2 onward as the verb of the satipaṭṭhāna formula** — "kāye kāyānupassī viharati")

---

## 6. Plain-register observations

All 8 phase-1 tooltip arrays pass §3.4 self-check post-rewrite.

**Cross-phase facet density**: phase-1 makes heavy use of cross-references (p1s1→ekaṁ phase-b; p2s1→etad phase-h + te phase-g; p3s1→bhikkhu phase-e/f/g; p3s2→Bhikkhavo phase-f; p4s1→sanskrit/english cognates). The cross-phase facet rule §3.4.1 is in heavy use; the pattern is mature.

---

## 7. Open questions

1. **Anchor on Ekāyono vs maggo**: the phrase's syntactic head is maggo (path); the pedagogical center is Ekāyono (the contested modifier). Chose Ekāyono because the whole phase is teaching what this compound means; the 5 cycling senses ARE the lesson. Could revisit.
2. **5 senses for Bhikkhave**: 2 lexical + 2 etymological + 1 curatorial. The etymological "Sharers" and "Seekers" are real interpretive traditions but might dilute the canonical "Monks" reading. Worth retrospective review after batch 4.
3. **EA 12.1 'The One Way In Sūtra'** in suttaplex parallels endorses the 'one way' reading via its Chinese translation choice. Cross-tradition comparative datum worth surfacing in p1's tooltips? Defer — would need Chinese-text adapter for proper grounding (Tier-2 work).
4. **Ekāyono Lookup gap**: 5th surface across batch 3+4. If phase-2's evidence sweep also surfaces gaps (likely — anupassī, ātāpī, sampajāno are all derived adjectives), the morphology-generator fallback becomes the natural next architectural fix. Defer to post-batch-4 retrospective.

---

## 8. Outcome

- **Packet diff:** applied; commit in metadata.
- **JSON:** validates; phase-1 structure confirmed (p1.isAnchor=true; 4 morph hints; 14 senses with epistemicBasis; 2 relations dropped per arrow-earning rule; 32 total citations).
- **Tests:** worktree sandbox restriction prevented in-place test execution this commit (environmental; not packet-related). JSON validation + structural assertions confirm packet integrity.
- **Schema tensions:** #1 stays resolved; #12 (arrow-earning rule) stable post-codification; Lookup-gap pattern at 5/9 surfaces — defer.
- **Translator-debate as curation pattern** newly surfaced — proposed §3.4.2 amendment deferred to next commit cycle.
- **Batch 4 progress:** 1/? phases complete. Total curated so far: 9/51 phases (a-h + phase-1).
- **Pedagogical milestone:** first teaching content phase shipped — after 8 phases of framing, the satipaṭṭhāna sutta now opens its actual claim.

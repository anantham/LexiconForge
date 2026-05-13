# Phase-f — curation log

**Date:** 2026-05-13
**Curator:** Adi + assistant (Opus 4.7 1M)
**Commit:** filled in commit metadata below
**Outcome:** ✅ Applied. Small phase (2 words, 3 segments) — opens the Buddha's direct speech. First vocative case in the corpus + first iti quote-marker + 3rd bhikkhu refrain hit (confirms recurrence threshold).
**Pāli:** Bhikkhavo"ti
**Readable:** "Monks!"
**Canonical segments:** mn10:1.4

---

## 0. Phase brief

```json
{
  "phaseId": "phase-f",
  "pali": "Bhikkhavo ti",
  "literal": "O-monks end-quote",
  "readable": "\"Monks!\"",
  "function": "The Buddha's actual first word in the sutta. After phase-e's narration ('the Blessed One addressed the monks'), phase-f opens the direct speech he addressed them with.",
  "tensions": [
    {
      "id": "vocative case (first appearance)",
      "primary": true,
      "description": "Pāli marks 'who you're calling' with the vocative case ending. Phase-e had bhikkhū (accusative — the monks the Buddha addressed); phase-f has Bhikkhavo (vocative — the same monks being directly called). Same noun, different morphological role."
    },
    {
      "id": "iti / ti direct-speech marker",
      "primary": true,
      "description": "Pāli marks the end of quoted speech with a word (ti, shortened from iti = 'thus'). English uses typographic quote marks for the same job. Cross-language: same function, different surface."
    },
    {
      "id": "bhikkhu refrain — confirmed",
      "description": "Third appearance of the bhikkhu stem (phase-e bhikkhū-acc, phase-f Bhikkhavo-voc, plus root bhikkh- in both). The refrain status is now empirically definitive: ≥2-phase rule (§3.3) cleared; first phase to add a refrain-explanation facet under recurring evidence rather than promise."
    },
    {
      "id": "bhikkhavo dialectal variant",
      "description": "Pāli has two vocative-pl forms for bhikkhu: 'bhikkhave' (more common) and 'bhikkhavo' (used here). DPD's Lookup table indexes 'bhikkhave' but not 'bhikkhavo' specifically. Both are dialectally valid; bhikkhu (dpd:49885) is the underlying lemma."
    }
  ],
  "register": "Buddha's voice opens; the audience receives the call",
  "scope": ["mn10:1.4"]
}
```

**Plain-language summary:** Phase-f is two words: "Monks!" + a closing-quote particle. It marks the transition from narration (phases a-e) to direct speech. Three things to teach: (a) the vocative case (calling someone), (b) Pāli's quote-marker word `ti`, and (c) the same bhikkhu refrain stem from phase-e in a new form.

---

## 1. Current packet snapshot (pre-curation)

| word | id | wordClass | senses | tooltips | new-field gaps |
|---|---|---|---|---|---|
| `Bhikkhavo` | f1 | content (refrain=bhikkhu) | 3 ("Bhikkhus!"/"Monks!"/"Mendicants!") | 1+3 | no isAnchor; no morph on f1s2 (vocative pl); no basis/citations; tooltips use `[Vocative Plural]` bracket jargon |
| `ti` | f2 | function | 1 (quote marker) | 2 | no basis/citations; tooltips use `[Quotation marker]` bracket |

Both tooltips fail §3.4 register-check. Both senses lack epistemic grounding. The anchor candidate is f1 (the only content word; the Buddha's actual address).

---

## 2. Evidence bundle

```json
{
  "phaseId": "phase-f",
  "providers": ["sc-dictionary-full", "dpd"],
  "usableCitations": [
    {
      "id": "cite:dpd:dpd:49885",
      "lemma": "bhikkhu",
      "pos": "masc",
      "morphology": { "gender": "m" },
      "excerpt": "bhikkhu [masc]: monk; monastic; mendicant; fully ordained monk; lit. beggar",
      "decisionRelevance": "PRIMARY for f1 senses. REUSED from phase-e. The vocative-pl surface 'Bhikkhavo' isn't directly in DPD's Lookup but the underlying lemma is; the related form 'bhikkhave' IS in DPD's enumeration, confirming bhikkhu as the lemma."
    },
    {
      "id": "cite:dpd:dpd:30431",
      "lemma": "ti",
      "pos": "ind",
      "excerpt": "ti [ind]: (end of direct speech) ' '",
      "decisionRelevance": "PRIMARY for f2 sense. The specific 'end-of-direct-speech' marker reading (DPD has 3 ti entries; this is the relevant one — the others are 'three' [card] and the verb-ending [ve])."
    }
  ],
  "providerNotes": {
    "lookupCoverageGap": "Bilara's surface form 'Bhikkhavo' (capitalized, with quotative '\"ti') wasn't in DPD's per-sutta forms.json — neither lowercased 'bhikkhavo' nor 'ti' alone is in the indexed inflections (ti always appears as a clitic attached to another word in bilara). This isn't a stripper-conflation bug — it's a coverage gap in DPD's Lookup for this specific dialectal variant. Curatorial decision: ground in the underlying lemma bhikkhu + the canonical ti entry."
  },
  "parallels": [
    { "note": "Same 16 mn10 work-level parallels — per phase-a gate (c), NOT placed in PhaseView.parallels." }
  ],
  "variants": [
    { "note": "Zero variant readings for mn10:1.4 — line stable across all witnesses." }
  ],
  "gaps": [
    "DPD doesn't index 'bhikkhavo' (the dialectal variant Sujato's edition uses) — only 'bhikkhave'. Curatorially grounded in bhikkhu (dpd:49885) and noted in sense.notes.",
    "Aṭṭhakathā commentary's standard discussion of why the Buddha opens with 'Bhikkhavo' (rather than e.g. 'āvuso') not yet wired."
  ]
}
```

---

## 3. Applied diff

### 3.1 f1 Bhikkhavo — anchor + vocative morph + refrain facet

```diff
 f1:
+  isAnchor: true   (vocative call = the Buddha's first word; semantic centerpiece of the short phase)
   refrainId: 'bhikkhu'  (unchanged; 3rd hit confirms recurrence)

 f1s1 (Bhikkh):
-  tooltips: ["√bhikkh: To share / beg"]
+  tooltips: ["Same root as 'bhikkhū' in phase-e — religious mendicant, 'one who lives on alms'."]

 f1s2 (avo):
+  morph: { case: 'voc', number: 'pl', gender: 'm' }
   tooltips:
+    "Highlighted in the same recurring color as 'bhikkhū' in phase-e — both are forms of bhikkhu. Matching color across phases marks the refrain (you'll see this stem every time the Buddha addresses the monks).",
+    "The -avo ending is vocative plural — used when calling out to a group. Like English 'O ____!' or 'Hey, ____!'",
+    "Phase-e had 'bhikkhū' (the monks the Buddha was addressing, accusative); phase-f has 'Bhikkhavo' (the same monks, now being called directly, vocative). Same noun, different role."

 f1.senses (all 3):
+  epistemicBasis: 'lexical', sourceCitationIds: ['cite:dpd:dpd:49885'] (REUSED from phase-e)
+  confidence: 'high'
+  f1.senses[0]: notes about bhikkhavo vs bhikkhave dialectal variants
```

### 3.2 f2 ti — color/role + iti etymology + cross-language note

```diff
 f2s1 (ti):
-  tooltips: ["[Quotation marker] From iti", "End of speech"]
+  tooltips:
+    "Colored differently because it's a tiny grammar word — a closing-quote marker. Pāli writes 'ti' (or 'iti') at the END of a quoted speech to say 'end quote'.",
+    "Shortened from 'iti' meaning 'thus' or 'in this way' — Pāli marks quoted speech by saying 'thus' after it: 'X-iti' = '\"X\"'.",
+    "Cross-language pattern: English uses quote marks (typographic); Pāli uses a word (lexical). Same function, different surface."

 f2.senses[0]:
+  epistemicBasis: 'lexical', sourceCitationIds: ['cite:dpd:dpd:30431'], confidence: 'high'
```

### 3.3 packet.citations

```
+ cite:dpd:dpd:30431 (ti — end of direct speech)
  cite:dpd:dpd:49885 (bhikkhu) — REUSED from phase-e
```

Total packet.citations: 23 → **24** (1 new).

---

## 4. Summary of changes

| Change | Where | Verdict |
|---|---|---|
| `isAnchor: true` | f1 Bhikkhavo | Vocative call is the Buddha's first word — semantic centerpiece |
| `morph` on f1s2 (case=voc, number=pl, gender=m) | f1s2 | First vocative in the corpus; clean morphology |
| Refrain-explanation facet on f1s2 (1/3) | f1s2 | Third bhikkhu hit confirms recurrence; refrain claim now empirically grounded |
| Cross-reference facet (acc → voc) on f1s2 (3/3) | f1s2 | Teaches case morphology by contrast with phase-e |
| Color-explanation facet on f2s1 (1/3) | f2s1 | Function-word framing — extends pattern from a1/a2/b1/d2/e1/e2 |
| Plain-first rewrites on all 4 tooltip arrays | f1, f2 | Dropped `[Vocative Plural]`, `[Quotation marker]`, `√bhikkh` jargon |
| Senses (4 total) with lexical basis + citations | f1, f2 | bhikkhu (dpd:49885 REUSED) + ti (dpd:30431 NEW) |
| 1 new packet.citation | packet.citations | Total 23 → 24 |

---

## 5. Schema tensions

### Tension #1 (DPD stripper) — STAYS RESOLVED

No conflation surfaced in phase-f. Bhikkhavo's "no DPD entry" is a coverage gap (dialectal variant not in Lookup), not a stripper bug. Curatorially grounded in the underlying lemma.

### Tension #12 (S-V-O palette gap from phase-e) — NOT REVISITED

Phase-f has no relations at all (the phrase is just vocative + iti — no case-relations to teach). Hit count stays at 1; defer.

### Refrain status update

- **bhikkhu** refrain: now **3/5 phases** (phase-e bhikkhū-acc, phase-f Bhikkhavo-voc, also stem in both f1s1 and e4s1). Definitively confirmed. The refrain-explanation facet shipped in this commit (f1s2 1/3) makes the recurrence claim honest — pointing back to phase-e's bhikkhū and forward to expected re-appearances in the satipaṭṭhāna formula opener (phase-g onward: "Idha bhikkhave bhikkhu kāye…").
- **bhagavā** refrain: 2/5 phases (phase-b, phase-e). Stable.
- **viharati** refrain: 1/5 phases (phase-c). Single appearance so far.

### No new schema tensions surfaced

Phase-f is one of the simplest phases (2 words, 3 segments). The morphological + pedagogical work is small. The biggest single insight is the **case-contrast pattern (acc → voc)** teaching, which is content not schema.

---

## 6. Plain-register observations (post-rewrite)

All 4 tooltip arrays pass the §3.4 self-check:
- f1s1: prose only; no jargon
- f1s2: 3 facets — refrain explanation, vocative explanation, case-contrast cross-reference
- f2s1: 3 facets — color/role, iti etymology, cross-language pattern

No leftover failing tooltips.

---

## 7. Open questions

1. **Vocative case in the morph index**: phase-f is the first to use `case: 'voc'`. The MorphHint schema supports it. No tension.
2. **Bhikkhavo vs bhikkhave**: should phase-f also surface that Sujato's edition uses the less-common bhikkhavo? Currently noted in sense.notes for one sense. Probably enough; revisit if dialectal-variant awareness becomes a pattern.
3. **iti vs ti distinction**: Pāli uses both forms (full iti, shortened ti). Sujato's text uses ti here. Could teach the alternation explicitly but feels niche; defer.
4. **Quoted-speech rendering**: should the English row render `"Monks!"` with actual quote marks (currently just `Monks!`)? Renderer affordance question; defer.

---

## 8. Outcome

- **Packet diff:** applied; commit in metadata.
- **Tests:** ✅ 220 component pass.
- **JSON:** validates; phase-f structure confirmed (f1.isAnchor=true; f1s2 voc/pl/m morph; refrain-explanation facet present; 4 senses with epistemic basis; 24 total citations).
- **Batch 3 progress:** 2/4 phases complete (phase-e ✓, phase-f ✓ / phase-g / phase-h).
- **Refrain bhikkhu**: 3/5 hits — definitively a refrain. Pattern is now established for later "Idha bhikkhave bhikkhu kāye…" appearances in the satipaṭṭhāna formula.

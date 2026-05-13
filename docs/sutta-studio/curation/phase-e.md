# Phase-e — curation log

**Date:** 2026-05-13
**Curator:** Adi + assistant (Opus 4.7 1M)
**Commit:** filled in commit metadata below
**Outcome:** ✅ Applied with DPD root-cause fix in place (commit `aaa1ff9` upstream). First curation phase running on the corrected pipeline — `bhikkhū` now resolves to `bhikkhu` (monk) authoritatively via SQLite Lookup, not `bhikkhā` (alms) via heuristic conflation.
**Pāli:** Tatra kho bhagavā bhikkhū āmantesi
**Readable:** There, the Blessed One addressed the monks
**Canonical segments:** mn10:1.3 (opens batch 3 of CURATION_PROTOCOL §6)

---

## 0. Phase brief

```json
{
  "phaseId": "phase-e",
  "pali": "Tatra kho bhagavā bhikkhū āmantesi",
  "literal": "There indeed Blessed-One monks addressed",
  "readable": "There, the Blessed One addressed the monks",
  "function": "Pivots narrative from setting (phases a-d locative frame) to action. Introduces the Buddha's voice + the audience. First tense shift from historical-present (viharati, phase-c) to true past-aorist (āmantesi).",
  "tensions": [
    {
      "id": "discourse-particle stack",
      "primary": true,
      "description": "Pāli marks narrative beats with particles like 'kho' that English usually drops. 'tatra kho' = 'there indeed/now' but English typically says just 'there, then'. Teaches the discourse-marker role without making them essential."
    },
    {
      "id": "aorist (true past) vs historical-present",
      "primary": true,
      "description": "Phase-c had viharati — present-rendered-past. Phase-e has āmantesi — morphologically aorist (true past, marker -si). Pedagogical contrast: Pāli distinguishes these tenses; English flattens both to '-ed'."
    },
    {
      "id": "bhikkhū = nom/voc/acc pl ambiguity",
      "description": "u-stem masc nouns: bhikkhū is the same surface form for all three plural cases. Sujato reads acc pl ('addressed the monks') — grammatically the object of āmantesi. The reader should see this is contextually determined, not formally distinct."
    },
    {
      "id": "compound verb āmantesi",
      "description": "ā- (intensive prefix) + mant (root: counsel) + -e- (causative marker) + -si (3sg aorist ending). Four morphological layers in one verb — pedagogically rich; parallels phase-c's vi-har-a-ti but in past tense."
    }
  ],
  "register": "narrator pivots from frame to scene; the Buddha enters as speaker",
  "scope": ["mn10:1.3"]
}
```

**Plain-language summary:** Phase-e teaches three things: (a) how Pāli's small particles like `kho` carry narrative rhythm English drops; (b) how the aorist (`-si`) marks real past tense, contrasting with phase-c's historical-present `viharati`; (c) how a single Pāli verb (`āmantesi`) packs four morphological layers (prefix + root + causative + person/tense ending) into one word.

---

## 1. Current packet snapshot (pre-curation)

| word | id | wordClass | senses | tooltips | relation | new-field gaps |
|---|---|---|---|---|---|---|
| `tatra` | e1 | function | 1 ("There") | 2+2 | — | no morph; no basis/citations |
| `kho` | e2 | function | 2 ("indeed" / untranslated) | 3 | — | no basis/citations |
| `bhagavā` | e3 | content (refrain=bhagava) | 3 | 2+2 | "Addressed BY" → e5 (action) | no morph; no basis/citations; **relation semantically off** (active-voice subject is not "BY") |
| `bhikkhū` | e4 | content (refrain=bhikkhu) | 3 | 3+2 | "Addressed TO" → e5 (direction) | no morph; no basis/citations; **relation semantically off** (accusative object is not "TO") |
| `āmantesi` | e5 | content | 3 | 2+3+1+2 | — | no isAnchor; no morph on e5s4; no basis/citations |

**Strengths already present:** dual-register tooltips; explicit naming of historical-present-vs-aorist contrast in e5s4; etymology-stack for āmantesi (ā + mant + e + si). Pedagogical content rich; just needs §3.4 register-check + epistemic grounding.

---

## 2. Evidence bundle

```json
{
  "phaseId": "phase-e",
  "providers": ["sc-dictionary-full", "dpd", "sc-bilara-variants", "sc-suttaplex"],
  "usableCitations": [
    {
      "id": "cite:dpd:dpd:29605",
      "lemma": "tatra",
      "pos": "ind",
      "excerpt": "tatra [ind]: there; in that place",
      "decisionRelevance": "PRIMARY for e1 sense 'There'. Clean lexical attestation for the deictic place-marker."
    },
    {
      "id": "cite:dpd:dpd:29606",
      "lemma": "tatra",
      "pos": "ind",
      "excerpt": "tatra [ind]: in that case; in that regard; in this matter; in this connection",
      "decisionRelevance": "Secondary attestation; the discourse-marker reading of tatra ('in that case'). Not used in e1 senses but available."
    },
    {
      "id": "cite:dpd:dpd:23966",
      "lemma": "kho",
      "pos": "ind",
      "excerpt": "kho [ind]: indeed; surely; certainly; truly",
      "decisionRelevance": "PRIMARY for e2 sense 'indeed'. The 'often untranslated' sense is a curatorial expansion based on translator convention."
    },
    {
      "id": "cite:dpd:dpd:49147",
      "lemma": "bhagavā",
      "pos": "masc",
      "excerpt": "bhagavā [masc]: Sublime One; Blessed One; Fortunate One; epithet of the Buddha",
      "decisionRelevance": "PRIMARY for e3 senses. REUSED from phase-b (b3 bhagavā) — refrain count is now 2/4 phases."
    },
    {
      "id": "cite:dpd:dpd:49885",
      "lemma": "bhikkhu",
      "pos": "masc",
      "morphology": { "gender": "m" },
      "excerpt": "bhikkhu [masc]: monk; monastic; mendicant; fully ordained monk; lit. beggar",
      "decisionRelevance": "PRIMARY for e4 senses. **First curation phase running with the DPD root-cause fix** — pre-aaa1ff9, the heuristic stripper conflated bhikkhū → bhikkhā (alms, fem). Now resolves authoritatively via SQLite Lookup."
    },
    {
      "id": "cite:dpd:dpd:12086",
      "lemma": "āmantesi",
      "pos": "aor",
      "morphology": { "tenseAspect": "aorist", "form": "finite" },
      "excerpt": "āmantesi [aor]: addressed; said (to); advised",
      "decisionRelevance": "PRIMARY for e5 senses. DPD's pos='aor' tag projects directly to MorphHint.tenseAspect='aorist' + form='finite' — confirms the true-past reading structurally."
    }
  ],
  "providerNotes": {
    "rootCauseFixActive": "Phase-e is the first curation phase post-aaa1ff9 (DPD SQLite Lookup replaces heuristic stripper). 458/478 MN10 surfaces now resolve via DPD's enumerated form index; only 20 via residual heuristic fallback; 56 unmatched (quotative-attached forms like ‘ti, long compounds). All five phase-e surfaces resolve cleanly via Lookup.",
    "noConflations": "Unlike phases a/b/c/d which each surfaced a stripper conflation (eva, kura, kura, kura), phase-e's evidence is uniformly clean."
  },
  "parallels": [
    { "note": "Same 16 mn10 work-level parallels — per phase-a gate (c), NOT placed in PhaseView.parallels." }
  ],
  "variants": [
    { "note": "Zero variant readings for mn10:1.3 — line stable across all witnesses." }
  ],
  "gaps": [
    "SC dictionary_full still produces opaque payloads for these specialized lemmas — known parser limitation tracked in issue #41.",
    "Aṭṭhakathā commentary not yet wired (Tier-1 commit C deferred). Would deepen the discourse-particle reading of 'tatra kho' — Buddhaghosa often discusses these narrative beats."
  ]
}
```

**Citation count: 6 unique DPD entries (1 reused from phase-b, 5 new).**

---

## 3. Applied diff

### 3.1 e1 tatra — deictic + color facet

```diff
 e1s1 (ta):
   tooltips:
-    "[Demonstrative] Stem: that",
-    "Points to the place just mentioned"
+    "Colored differently because it's a small pointing word. Pāli uses short fixed forms for 'this/that' — they don't change like nouns do.",
+    "'ta' is the demonstrative stem — the part meaning 'that'. By itself it's just the pointer; the next part (-tra) adds 'in that place'."

 e1s2 (tra):
   tooltips:
-    "[Locative suffix] \"in that place\"",
-    "ta + tra = tatra"
+    "The -tra suffix means 'in that place'. ta (that) + -tra (place) = tatra = 'there'.",
+    "Built like English 'there' = th- (pointer) + -ere (place). Same morpheme-stacking, different sounds."

 e1.senses[0]:
+  epistemicBasis: 'lexical', sourceCitationIds: ['cite:dpd:dpd:29605'], confidence: 'high'
```

### 3.2 e2 kho — discourse particle + color facet

```diff
 e2s1 (kho):
   tooltips:
-    "[Emphatic particle] \"Indeed, surely\"",
-    "From khalu",
-    "Marks narrative transition"
+    "Colored differently because it's a small narrative beat — Pāli uses particles like this to pace storytelling. English usually drops them or replaces with pauses.",
+    "'kho' is an emphatic particle, like English 'indeed', 'now', or 'so' inserted to mark the rhythm of a story.",
+    "From an older Pāli word 'khalu' — both mean 'indeed' or 'truly'. The shorter 'kho' is the canonical form in the suttas.",
+    "Often left untranslated in English. Pāli wraps narrative timing in these little words; English uses pauses, punctuation, or simply omits them."

 e2.senses:
   - "indeed" + lexical + dpd:23966 + high
   - "" (untranslated) + curatorial + notes explaining translator decision
```

### 3.3 e3 bhagavā — refrain facet + morph + plain-first

```diff
 e3s1 (bhaga): tooltips rewrite (√bhaj → "the root 'bhaj'")

 e3s2 (vā):
+  morph: { case: 'nom', gender: 'm', number: 'sg' }
   tooltips:
+    "Highlighted in a recurring color because 'bhagavā' is a refrain — the Buddha-epithet appears throughout the canon. The matching underline color marks the recurrence (you saw it back in phase-b's 'Ekaṁ samayaṁ bhagavā…').",
     "The -vā suffix means 'one who has' or 'is endowed with'. bhaga (fortune) + -vā = 'the fortunate one'.",
     "'The Fortunate One' / 'The Blessed One' — a respectful name for the Buddha, used through the canon."
-  relation: { targetWordId: 'e5', type: 'action', label: 'Addressed BY' }    // DROPPED

 e3.senses:
   - "the Blessed One" + lexical + dpd:49147 (REUSED from phase-b)
   - "the Fortunate One" + lexical + dpd:49147
   - "the Lucky One" + etymological + notes (compositional reading, not standard DPD)
```

### 3.4 e4 bhikkhū — morph + plain-first

```diff
 e4s1 (bhikkh): tooltips rewrite (drop √ symbols; explain mendicancy clearly)

 e4s2 (ū):
+  morph: { case: 'acc', number: 'pl', gender: 'm' }
   tooltips:
+    "The -ū ending makes it plural. The same form serves multiple roles (subject pl, object pl, vocative pl) — only context tells you which.",
+    "Here 'bhikkhū' is the object: who the Buddha is addressing. The case is technically called accusative."
-  relation: { targetWordId: 'e5', type: 'direction', label: 'Addressed TO' }    // DROPPED

 e4.senses:
   - "the bhikkhus" + lexical + dpd:49885 + high
   - "the monks" + lexical + dpd:49885 + high
   - "the mendicants" + lexical + dpd:49885 + high + notes
```

### 3.5 e5 āmantesi — anchor + morph + plain-first

```diff
+ e5.isAnchor: true

 e5s4 (si):
+  morph: { person: '3', number: 'sg', tenseAspect: 'aorist', form: 'finite' }
   tooltips:
+    "The -si ending marks past tense — 'he/she/it did'. Specifically aorist (a real past), different from Pāli's storytelling-present (compare 'viharati' back in phase-c).",
+    "'he addressed' — completed action, situated in narrative time. The Buddha did this thing, then-and-there."

 e5.senses: all 3 → lexical + dpd:12086 + high
```

### 3.6 packet.citations — 5 new entries (1 reused)

```
+ cite:dpd:dpd:29605 (tatra "there")
+ cite:dpd:dpd:29606 (tatra "in that case" — alt reading, not currently used)
+ cite:dpd:dpd:23966 (kho)
+ cite:dpd:dpd:49885 (bhikkhu — the masc noun, NOT bhikkhā/alms)
+ cite:dpd:dpd:12086 (āmantesi)
  cite:dpd:dpd:49147 (bhagavā) — REUSED from phase-b
```

Total packet.citations: 18 → **23** (5 new).

---

## 4. Summary of changes

| Change | Where | Verdict |
|---|---|---|
| `isAnchor: true` | e5 āmantesi | The action verb pivoting frame → scene |
| `morph` on e3s2 (case=nom, gender=m, num=sg) | e3s2 | Standard noun morphology |
| `morph` on e4s2 (case=acc, number=pl, gender=m) | e4s2 | Sujato's accusative-pl reading |
| `morph` on e5s4 (person=3, num=sg, tenseAspect=aorist, form=finite) | e5s4 | DPD-attested aorist tag |
| Senses (12 total) with epistemicBasis + sourceCitationIds + confidence | e1-e5 | All lexical except: e2 "untranslated" (curatorial) + e3 "Lucky" (etymological) |
| Color-explanation facet on e1 tatra (1/2) | e1s1 | Function-word framing — extends pattern from a1 evaṁ, a2 me, b1 ekaṁ, d2 nāma |
| Color-explanation facet on e2 kho (1/4) | e2s1 | Function-word narrative-beat framing |
| **Refrain-explanation facet on e3 bhagavā (1/3)** | e3s2 | **First refrain-explanation in the corpus** — bhagavā now 2/4 phases qualifies per §3.3 |
| Plain-first rewrites across all 12 segment-tooltip arrays | e1-e5 | §3.4 register-check applied |
| **Relations DROPPED** on e3s2 + e4s2 | e3, e4 | Schema tension (see §5) — active-voice subject-object doesn't fit the 4-color palette |
| 5 new packet.citations (+1 reused) | packet.citations | Total 18 → 23 |

---

## 5. Schema tensions surfaced

### Tension #1 (DPD stripper) — **STAYS RESOLVED**

Hit count holds at 4 (evaṁ, kurūsu, kurūnaṁ, bhikkhū) but the root-cause fix in `aaa1ff9` means phase-e is the first curation phase where the bug DID NOT recur as a forking decision. The four prior conflations are all closed; 4 explicit regression tests in `services/providers/dpd.test.ts` lock them in.

### Tension #12 (NEW): RelationType palette doesn't cover active-voice subject-object

Surfaced this phase. The existing 4-color palette (ownership/direction/location/action) was designed for the *interesting* Pāli case-relations: genitive-as-agent (phase-a `me sutaṁ` "Heard BY"), accusative-of-time (phase-b `samayaṁ` "Time WHEN"), locative-of-membership (phase-c `kurūsu` "Dwelling IN"), genitive-of-possession (phase-d `kurūnaṁ` "Town OF").

Phase-e is an **active-voice S-V-O sentence**: bhagavā (subject, nom) + bhikkhū (object, acc) + āmantesi (verb). The relations *would* be:
- bhagavā → āmantesi : subject-of-verb
- bhikkhū → āmantesi : direct-object-of-verb

Neither role has a slot in the 4-color palette. The current packet tried to encode them as `type: 'action'` (label "Addressed BY") and `type: 'direction'` (label "Addressed TO") — both semantically misleading. "Addressed BY" reads passive in English (it's not); "Addressed TO" suggests dative case (it's accusative).

**Resolution this phase: drop both relations.** Phase-e doesn't need arrows; English already shows S-V-O via word order, and the linkedSegmentId mappings already cross-highlight. The arrows would clutter without teaching.

**Schema decision deferred to future**: should `RelationType` be extended with `'predicate'` (or similar) for subject-verb-object relations? Or should we accept that the palette is for *case-quirks* that English doesn't share, and S-V-O is handled by the English row's word order alone? **Hit count: 1/5 batches (phase-e only).** Per §3.3, defer; revisit if phase-f/g/h shows the same gap.

Issue worth filing eventually: `[Schema] RelationType palette doesn't cover S-V-O — should we extend or formalize that arrows are case-quirk-only?`

### Other observations

- **Refrain bhagavā** now confirmed (2/4 phases). First refrain-explanation facet shipped (e3s2 1/3). **Future work**: backport this facet to phase-b (where bhagavā first appears) for consistency. Tracked as a follow-up.
- **Refrain bhikkhu** is single-appearance so far. No refrain-explanation facet added. Revisit when it recurs in phase-f/g (the satipaṭṭhāna formula opener "Idha bhikkhave bhikkhu kāye…" appears multiple times).
- **EpistemicBasis distribution this phase**: 9 lexical (DPD-attested) + 1 curatorial (kho "untranslated") + 1 etymological (bhagavā "Lucky One"). No `'grammatical'` claims this phase since morph hints aren't claim-level. Healthier distribution than earlier phases where 'etymological' was being misused as placeholder.

---

## 6. Plain-register observations (deferred follow-ups)

All 12 tooltip arrays rewritten per §3.4 in this commit; no leftover failing tooltips flagged for follow-up rewrite within phase-e itself.

**Cross-phase follow-up**: backport refrain-explanation facet to phase-b b3s2 bhagavā (parallel to phase-e e3s2) — once bhagavā recurred, the refrain claim is honest for phase-b too. ~5 min, separate commit.

---

## 7. Open questions

1. **RelationType for S-V-O** (see §5 Tension #12): defer until phase-f/g surface another active sentence. Hit count is 1; per §3.3, need ≥2 for action.
2. **bhikkhū voc-pl alternate reading**: should phase-e expose the vocative reading ("O monks!") as a sense alternative, given it's grammatically possible? Currently only acc-pl. Sujato chose acc-pl; the imperative-style commentary tradition often reads voc-pl. Defer; surface once a phase has the vocative reading as the only grammatical option.
3. **Compound verb tooltip strategy**: e5 has 4 segments × 8 facets total. Reader could feel overwhelmed clicking through. Is the facet-cycle pedagogically right for densely-compound words, or do they want a different affordance (collapsed structural diagram?)? Renderer Chunk 3 territory; defer.
4. **The "Lucky One" sense (e3.senses[2])**: kept as etymological with notes per the §3.4 distinguish-curatorial-from-lexical discipline. Re-evaluate in batch retrospective: is the compositional gloss adding pedagogical value or just bloat?

---

## 8. Outcome

- **Packet diff:** applied; commit in metadata.
- **Tests:** ✅ 220 component pass.
- **JSON:** validates; phase-e structure confirmed (e5.isAnchor=true; e5s4 aorist morph; 12 senses with epistemicBasis; both phase-e relations removed; 23 total citations).
- **DPD pipeline:** first curation phase running on the corrected (SQLite Lookup) pipeline; no provider-side bug recurred.
- **Coverage of new tension counts:** Tension #1 stays RESOLVED. Tension #12 (S-V-O palette gap) newly opened — hit count 1/5 batches, defer.
- **Batch 3 progress:** 1/4 phases complete (phase-e ✓ / phase-f / phase-g / phase-h).

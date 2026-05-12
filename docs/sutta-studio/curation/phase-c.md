# Phase-c — curation log

**Date:** 2026-05-12
**Curator:** Adi + assistant (Opus 4.7 1M)
**Commit:** filled in commit metadata below
**Outcome:** ✅ Applied with DPD-bug-fix in-flight (commit c33b115 fixed the stripper; kurūsu now has real DPD citations). 5 localized changes + 4 new citations in packet.
**Pāli:** Kurūsu viharati
**Readable:** [Was] dwelling among the Kurus
**Canonical segments:** mn10:1.2 (continues from phase-b within the same line)

---

## 0. Phase brief

```json
{
  "phaseId": "phase-c",
  "pali": "Kurūsu viharati",
  "literal": "Among-Kurus dwells",
  "readable": "[He] was dwelling among the Kurus",
  "function": "Place + action clause. Locates the Buddha geographically (the Kuru country) and names the activity (viharati — dwelling/abiding, the canon's standard verb for 'where the Buddha was when this teaching happened').",
  "tensions": [
    {
      "id": "locative-plural-as-preposition",
      "primary": true,
      "scope": "phase-local",
      "description": "Pāli `-su` is the locative plural ending. It compresses 'among the X-people' or 'in the X-region' into a single case-marker on a plural noun. English requires a prepositional phrase ('among', 'in'). UNLIKE phase-b's accusative-of-time-when (which surfaces as English 'at' ghost), phase-c's locative gets absorbed into the sense gloss ('among the Kurus' is the sense — no separate ghost preposition needed)."
    },
    {
      "id": "historical-present",
      "primary": false,
      "scope": "phase-local",
      "description": "Pāli viharati is morphologically present tense (3sg present indicative). English renders as past ('was dwelling') — the historical-present narrative convention of Pāli suttas. Sujato's translation choice is past, signalling the framing voice ('Ānanda recounting'). The existing c2s4 tooltip ('Pali tells past events in present') already names this."
    },
    {
      "id": "place-vs-people-vs-region",
      "primary": false,
      "scope": "phase-local",
      "description": "'Kurūsu' can read as 'among the Kuru people' (locative of social membership), 'in the Kuru region' (locative of geographical place), or 'with the Kuru people' (locative of company). All three are grammatical readings of the same form. The existing 3 senses already enumerate them."
    }
  ],
  "register": "narrator continues; place + verb sit together as a stock geographical-frame clause across the canon",
  "scope": ["mn10:1.2"]
}
```

**Plain-language summary:** Phase-c teaches how Pāli's locative case alone does the prepositional work English needs ("among the Kurus" emerges from the `-su` ending), and how the historical-present (`viharati` literally "dwells") gets routinely rendered past-tense ("was dwelling") in narrative voice.

---

## 1. Current packet snapshot

| word | id | class | segments | senses | tooltips | relation | refrainId | new-field gaps |
|---|---|---|---|---|---|---|---|---|
| `kurūsu` | c1 | content | `kurū` (stem) + `su` (suffix) | 3 ("among the Kurus" / "in Kuru territory" / "with the Kuru people") | 3+2 | **location → c2 "Dwelling IN"** on c1s2 | — | no morph; no sourceCitationIds (DPD bug — see §2) |
| `viharati` | c2 | content | `vi` + `har` + `a` + `ti` | 3 ("was dwelling" / "was staying" / "was abiding") | 3+3+1+3 | — | `'viharati'` | **no isAnchor** (candidate); no morph; no sourceCitationIds |

**English structure:** `ec2` (→c2s2 har) · `ec1` (→c1s1 kurū). **Zero ghosts** — the senses already absorb the locative preposition.

**Strengths already present:** dual-register tooltips, root identification (`√hṛ`), refrainId on viharati (recurs at every sutta-opening "the Buddha was dwelling at X"), explicit naming of the historical-present convention in c2s4 tooltip.

**Gaps from new schema:**
- No `MorphHint` on any segment — most acutely: c1s2 (the `-su` locative-plural is the central grammatical fact and is invisible structurally); c2s4 (the `-ti` present-3sg ending carries 4 distinct grammatical claims that aren't structurally recorded)
- No `Sense.epistemicBasis` + `sourceCitationIds` on any sense
- `viharati` is the action-verb of the clause + refrainId already marks it — candidate for `isAnchor: true`

---

## 2. Evidence bundle

```json
{
  "phaseId": "phase-c",
  "providers": ["sc-dictionary-full", "dpd", "sc-bilara-variants", "sc-suttaplex"],
  "usableCitations": [
    {
      "id": "cite:dpd:dpd:69661",
      "lemma": "viharati",
      "pos": "pr",
      "morphology": { "tenseAspect": "present", "form": "finite" },
      "excerpt": "viharati [pr]: lives; dwells; stays (in)",
      "decisionRelevance": "PRIMARY for c2 senses 'was dwelling' and 'was staying'. DPD's POS=pr explicitly maps to MorphHint.tenseAspect='present' + form='finite' — confirms the historical-present analysis structurally."
    },
    {
      "id": "cite:dpd:dpd:69662",
      "lemma": "viharati",
      "pos": "pr",
      "morphology": { "tenseAspect": "present", "form": "finite" },
      "excerpt": "viharati [pr]: stays; remains; continues; dwells; abides (in)",
      "decisionRelevance": "PRIMARY for c2 sense 'was abiding'. 'Continues' / 'remains' attestations support the 'extended sojourn' reading."
    }
  ],
  "providerIssue_kurūsu": {
    "problem": "DPD lookup for kurūsu matched 'kura [nt]: rice; boiled rice'. This is the SAME STEM-STRIPPER CONFLATION BUG as phase-a's evaṁ→eva. The script's heuristic stripped `-su` locative-plural ending, then `-ū` long vowel restoration, landing on `kura` — which is the unrelated noun 'rice'. Kurūsu IS the locative-plural of `kuru` (the Kuru people, one of the 16 mahājanapada). DPD does have `kuru` as a headword somewhere but the stem-stripper's heuristics found the wrong one.",
    "decisionEffect": "DO NOT cite cite:dpd:dpd:22496 ('kura [nt]: rice') as evidence for kurūsu's senses. Ground kurūsu in: existing tooltips (which correctly name 'Kuru people' + 'mahājanapada' + locative-plural grammar) + manual curator inference. Same posture as phase-a's evaṁ.",
    "schemaTension": "Increments §10 tension #1 hit-count from 1 to 2. Second of three phases (phase-a evaṁ, phase-c kurūsu) hit the same conflation. Strong signal — see protocol §3.4 amendment to count tension recurrences."
  },
  "parallels": [
    { "note": "Same 16 mn10 work-level parallels — per phase-a gate (c), NOT placed in PhaseView.parallels." }
  ],
  "variants": [
    { "note": "Zero variant readings for mn10:1.2 — line stable across all witnesses (bj, sya-all, pts1ed, mr)." }
  ],
  "gaps": [
    "kurūsu has no usable DPD attestation due to provider bug; grounded in grammar + manual.",
    "SC dictionary_full still produces opaque payloads (parser limitation from phase-a §10.5 — known issue).",
    "Aṭṭhakathā commentary on 'kurūsu viharati' (Buddhaghosa discusses why the Buddha taught Satipaṭṭhāna SPECIFICALLY in the Kuru country — argues the Kuru people were temperamentally suited for deep teaching) is not yet wired (C deferred). Would add a strong commentarial layer to phase-c."
  ]
}
```

**Citation count: 2 usable from DPD (viharati only); 0 for kurūsu (provider bug, NOT a gap); 0 from SC; 0 commentary; 0 variants.**

---

## 3. Proposed packet diff

### 3.1 `c1` kurūsu — morph + manual basis (NO DPD citations)

```diff
 {
   "id": "c1",
   "wordClass": "content",
   "segments": [
     {
       "id": "c1s1",
       "text": "kurū",
       "type": "stem",
+      "morph": { "number": "pl" },
       "tooltips": [
         "[Stem] Kuru (the Kuru people)",
         "Lengthened to kurū before -su",
         "One of 16 Great Nations (mahājanapada)"
       ]
     },
     {
       "id": "c1s2",
       "text": "su",
       "type": "suffix",
+      "morph": { "case": "loc", "number": "pl" },
       "tooltips": [...],
       "relation": {
         "targetWordId": "c2",
         "type": "location",
         "label": "Dwelling IN",
+        "confidence": "high",
+        "epistemicBasis": "etymological"
       }
     }
   ],
   "senses": [
-    { "english": "among the Kurus", "nuance": "Location" },
-    { "english": "in Kuru territory", "nuance": "Geographical" },
-    { "english": "with the Kuru people", "nuance": "Among inhabitants" }
+    {
+      "english": "among the Kurus",
+      "nuance": "Location",
+      "notes": "kurūsu = locative plural of kuru (the Kuru people). DPD stem-stripper conflates kurūsu with the unrelated 'kura' (rice); no usable DPD citation here. Grounded in Pāli grammar + manual curation.",
+      "epistemicBasis": "etymological",
+      "confidence": "high"
+    },
+    {
+      "english": "in Kuru territory",
+      "nuance": "Geographical",
+      "epistemicBasis": "etymological",
+      "confidence": "high"
+    },
+    {
+      "english": "with the Kuru people",
+      "nuance": "Among inhabitants",
+      "epistemicBasis": "etymological",
+      "confidence": "medium"
+    }
   ]
 }
```

### 3.2 `c2` viharati — isAnchor + morph + citations

```diff
 {
   "id": "c2",
   "wordClass": "content",
+  "isAnchor": true,
   "refrainId": "viharati",
   "segments": [
     { "id": "c2s1", "text": "vi", "type": "prefix", "tooltips": [...] },
     { "id": "c2s2", "text": "har", "type": "root", "tooltips": [...] },
     { "id": "c2s3", "text": "a", "type": "suffix", "tooltips": [...] },
     {
       "id": "c2s4",
       "text": "ti",
       "type": "suffix",
+      "morph": { "person": "3", "number": "sg", "tenseAspect": "present", "form": "finite" },
       "tooltips": [...]
     }
   ],
   "senses": [
-    { "english": "was dwelling", "nuance": "Historical present" },
-    { "english": "was staying", "nuance": "Sojourning" },
-    { "english": "was abiding", "nuance": "Remaining" }
+    {
+      "english": "was dwelling",
+      "nuance": "Historical present",
+      "epistemicBasis": "lexical",
+      "sourceCitationIds": ["cite:dpd:dpd:69661"],
+      "confidence": "high"
+    },
+    {
+      "english": "was staying",
+      "nuance": "Sojourning",
+      "epistemicBasis": "lexical",
+      "sourceCitationIds": ["cite:dpd:dpd:69661", "cite:dpd:dpd:69662"],
+      "confidence": "high"
+    },
+    {
+      "english": "was abiding",
+      "nuance": "Remaining",
+      "epistemicBasis": "lexical",
+      "sourceCitationIds": ["cite:dpd:dpd:69662"],
+      "confidence": "high"
+    }
   ]
 }
```

### 3.3 `packet.citations` — add 2 new entries

```json
{ "id": "cite:dpd:dpd:69661", "short": "DPD s.v. viharati (pr — lives, dwells, stays in)", "provenance": "dpd", "query": "viharati", "excerpt": "viharati [pr]: lives; dwells; stays (in)", "license": "CC BY-NC-SA 4.0 — Digital Pāli Dictionary by Bryan Levman et al.", "fetchedAt": "2026-05-12" },
{ "id": "cite:dpd:dpd:69662", "short": "DPD s.v. viharati (pr — stays, remains, continues, dwells, abides)", "provenance": "dpd", "query": "viharati", "excerpt": "viharati [pr]: stays; remains; continues; dwells; abides (in)", "license": "CC BY-NC-SA 4.0 — Digital Pāli Dictionary by Bryan Levman et al.", "fetchedAt": "2026-05-12" }
```

---

## 4. Summary of changes

**Five localized changes** in phase-c:

| Change | Where | Verdict needed |
|---|---|---|
| `morph` on c1s1 (number=pl) + c1s2 (case=loc, number=pl) | c1 segments | OK? |
| `morph` on c2s4 (person=3, number=sg, tenseAspect=present, form=finite) | c2s4 | OK? |
| confidence + epistemicBasis on c1s2 relation "Dwelling IN" | c1s2.relation | OK? |
| **`isAnchor: true` on viharati (c2)** | c2 | OK? (the verb of the geographical-frame clause; the action) |
| Sense fields: NO citations on c1 kurūsu (DPD bug), DPD citations on c2 viharati's 3 senses, all with confidence + epistemicBasis | senses | OK? |
| 2 new packet.citations entries (viharati only) | packet.citations | OK? |

---

## 5. Schema tensions surfaced

### Tension #1 (recurrence — significant)

**DPD stem-stripper conflates derivational/morphological with unrelated lemmas.** Hit #2 from phase-a's `evaṁ → eva`. Phase-c: `kurūsu → kura` (rice). The bug is now visible in **2 of 3 phases curated** — strong evidence that this is a real provider issue, not a one-off.

The user's earlier instruction (paraphrased): "more phases first, more data before deciding." Two hits is still a small sample. Suggested action: **keep curating; if phase-d hits the bug a third time, the case for fixing the stripper is overwhelming**. The fix is small (~10 LOC patch in `scripts/build-dpd.ts`): don't strip case endings when the stripped result is in a "known short particle / non-trivially-stem-able lemma" set.

### Other schema tensions

No new tensions surfaced from phase-c. All other §10 items from phase-a + phase-b stand.

**Notable absences (tensions that DID NOT recur):**
- `EpistemicBasis 'grammatical'` gap: phase-c uses `'etymological'` for the c1 senses (kurūsu morphological inference) and the relation — same placeholder pattern as phase-a + phase-b. So actually this tension DOES recur (3rd hit). Strong signal.
- `RelationType 'temporal'`: not applicable in phase-c (the relation is `location` for real this time, not a temporal-as-location hack).

---

## 6. Plain-register observation (NOT proposed in diff)

c2s3's only tooltip is `"[Thematic vowel] Class I verb marker"` — when grammar-terms is off, this strips to **empty**. Per protocol §3.4 plain-register check, plain prose must stand alone. This tooltip fails the check.

Not fixed in this diff (tooltip rewrite is a separate chunk). Flag for the plain-first rewrite pass.

---

## 7. Open questions

1. `c2s4` morph carries 4 grammatical claims (person, number, tense, form). When grammar-terms is on, the renderer would show all 4 as chips? Or merge into a single chip "3sg present indicative"? Renderer affordance question; defer.
2. The DPD bug surfacing twice now — should I file the small fix patch as a separate provider-quality commit BEFORE phase-d (so phase-d's lookups don't hit the same trap)? Or continue with the manual-override pattern and batch the fix later?
3. Tension #7 (`EpistemicBasis 'grammatical'`) has now hit 3 times across the 3 phases. At what hit-count do we cut a small enum-extension commit? My instinct: 5 hits or after batch 2 (b+c+d) complete, whichever first.

---

## 8. Applied with mid-flight provider fix

Aditya's gate verdict mid-curation: "Can we fix the DPD bug?" Investigated
and fixed three root causes (commit `c33b115`):

  1. Niggahīta diacritic mismatch (ṃ U+1E43 vs ṁ U+1E41) — primary cause
     for evaṁ's earlier mis-resolution to bare `eva`.
  2. Over-greedy `-ūsu`/`-ūhi` endings — caused kurūsu to over-strip to
     `kur` and then match the unrelated `kura` (rice).
  3. Missing bare `-su`/`-hi` endings + missing vowel-shortening — needed
     to reach `kuru` after stripping the locative-plural marker.

Coverage on MN10: 81.6% → 86.5%. 22 previously-unmatched surfaces now resolve.

**The fix changed phase-c's evidence landscape mid-curation.** Originally the
draft had kurūsu grounded in `etymological` basis only (DPD provider bug
meant no usable citation). After the fix:

  - `kurūsu` → `['kurū', 'kuru']` — both real DPD entries.
    - `cite:dpd:dpd:22524` (kurū, masc — "name of the people of Kuru; Kurus")
    - `cite:dpd:dpd:22502` (kuru, masc — "name of a country")

Applied diff vs original draft proposal:

| Field | Original draft | Applied |
|---|---|---|
| c1 senses' `epistemicBasis` | `'etymological'` (manual basis) | `'lexical'` (DPD-backed) |
| c1 senses' `sourceCitationIds` | absent (provider bug noted in `notes`) | populated with real DPD IDs |
| `notes` field on senses | "DPD stem-stripper conflates kurūsu with the unrelated 'kura' (rice); no usable DPD citation here." | removed (no longer accurate) |
| Everything else | unchanged | unchanged |

New packet.citations entries: **4 added** (kurū, kuru, viharati×2).
Total packet.citations: 9 → 13.

## 9. Outcome

- **Packet diff:** applied; commit in metadata.
- **Tests:** ✅ 21 (component + types tests pass; provider suites continue passing on the re-ingested data; Vite build green in the DPD-fix commit).
- **Renderer:** HMR-updated; not yet visually inspected in this commit (next browser session).
- **Coverage of new tension counts:** Tension #1 (DPD stripper) → **RESOLVED** by `c33b115`. Tension #7 (`EpistemicBasis` enum gap) still active; phase-c's relation still uses `'etymological'` as placeholder.

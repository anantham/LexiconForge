# Phase-b — curation log

**Date:** 2026-05-11
**Curator:** Adi + assistant (Opus 4.7 1M)
**Commit:** filled in commit metadata below
**Outcome:** ✅ Applied with gate-2 amendments. 6 localized changes + 5 new citations. Tests + Vite build green. See §8 for amendments record.
**Pāli:** Ekaṁ samayaṁ bhagavā
**Readable:** At one time the Blessed One [was dwelling…]
**Canonical segments:** mn10:1.2

---

## 0. Phase brief

```json
{
  "phaseId": "phase-b",
  "pali": "Ekaṁ samayaṁ bhagavā",
  "literal": "One-time, the Blessed One",
  "readable": "At one time the Blessed One",
  "function": "Time + protagonist clause. Establishes the temporal frame (deliberately indefinite — 'on one occasion', not a dated event) and introduces the subject of the entire sutta (the Buddha, by epithet rather than by name).",
  "tensions": [
    {
      "id": "time-adverbial",
      "primary": true,
      "scope": "phase-local",
      "description": "Pāli uses 'ekaṁ samayaṁ' as an accusative-of-time-when adverbial — literally 'one occasion' rather than 'at one occasion'. English forces a preposition ('at'/'on'/'in') that has no direct Pāli source. The accusative -ṁ marker on both ekaṁ and samayaṁ does the prepositional work."
    },
    {
      "id": "epithet-vs-name",
      "primary": false,
      "scope": "phase-local",
      "description": "Bhagavā is an epithet (the Sublime/Blessed/Fortunate One), not a name. The Buddha is consistently referred to by epithet throughout the canon — translating naively as 'the Blessed One' (Sujato) flattens the etymological force (bhaga = good fortune, from √bhaj 'to share' — 'fortune-bearer')."
    },
    {
      "id": "transmission-frame-recurs",
      "primary": false,
      "scope": "packet-level",
      "description": "This phrase is part of the same opening formula as phase-a (Evaṁ me sutaṁ + Ekaṁ samayaṁ Bhagavā). Together they establish the entire transmission frame. Resolution lives in DeepLoomPacket.provenance, not in phase-b alone."
    }
  ],
  "register": "narrator-as-Ānanda continues; formal sutta opening; epithet-bearing register for Buddha-reference",
  "scope": ["mn10:1.2"]
}
```

**Plain-language summary:** Phase-b teaches two things at once — (1) how Pāli marks "at one time" without a preposition (via accusative-of-time-when), and (2) why the Buddha is named by his epithet `bhagavā` rather than a personal name. The packet's job: surface the case-as-preposition trick + preserve the etymological texture of bhagavā ("fortune-bearer" not just "lord").

---

## 1. Current packet snapshot

| word | id | class | segments | senses | tooltips | relation | new-field gaps |
|---|---|---|---|---|---|---|---|
| `ekaṁ` | b1 | function | `eka` (stem) + `ṁ` (suffix) | 1 ("one" / "At one (time)") | 2 stem + 1 suffix | — | no morph; no sourceCitationIds |
| `samayaṁ` | b2 | content | `sam` (prefix) + `aya` (root) + `ṁ` (suffix) | 3 ("occasion" / "time" / "opportunity") | 2+3+1 | **location → b3 "Time WHEN"** | no morph; no sourceCitationIds; relation lacks confidence/basis |
| `bhagavā` | b3 | content, `refrainId: 'bhagava'` | `bhaga` (root) + `vā` (suffix) | 3 ("the Blessed One" / "the Fortunate One" / "the Lucky One") | 2+2 | — | **no isAnchor** (candidate); no morph; no sourceCitationIds |

**English structure:** `eb1g` ("At", ghost `'required'`) · `eb1` (→b1) · `eb2` (→b2s2 aya) · `eb3` (→b3s1 bhaga).

**Strengths already present:** dual-register tooltips, root identification (`√bhaj`, `√i`), refrainId on bhagavā (recurs throughout the sutta).

**Gaps from new schema:**
- No `MorphHint` on any segment (the `-ṁ` accusative-of-time-when is the central grammatical fact and is invisible structurally)
- No `Sense.epistemicBasis` + `sourceCitationIds` (every gloss floats unattested)
- `bhagavā` is the protagonist of the sutta — should be `isAnchor: true`
- `eb1g` "At" uses catch-all `ghostKind: 'required'`; specific kind exists: `'preposition_from_case'` (Pāli accusative-of-time-when surfaces as English "at"/"on")

---

## 2. Evidence bundle

```json
{
  "phaseId": "phase-b",
  "providers": ["sc-dictionary-full", "dpd", "sc-bilara-variants", "sc-suttaplex"],
  "usableCitations": [
    {
      "id": "cite:dpd:dpd:17376",
      "lemma": "eka",
      "pos": "card",
      "excerpt": "eka [card]: one (1)",
      "decisionRelevance": "primary cardinal-number attestation for b1's gloss 'one'. PRIMARY."
    },
    {
      "id": "cite:dpd:dpd:17382",
      "lemma": "eka",
      "pos": "ind",
      "excerpt": "eka [ind]: once",
      "decisionRelevance": "the adverbial 'once' reading — closer to ekaṁ-samayaṁ's adverbial function. SECONDARY (rhetorically supports the time-adverbial tension)."
    },
    {
      "id": "cite:dpd:dpd:59451",
      "lemma": "samaya",
      "pos": "masc",
      "morphology": { "gender": "m" },
      "excerpt": "samaya [masc]: time; occasion; lit. going together",
      "decisionRelevance": "PRIMARY for b2 senses 'occasion' and 'time'. The 'lit. going together' is the etymology preserved across all DPD samaya entries — matches the existing 'sam + aya' breakdown in the packet."
    },
    {
      "id": "cite:dpd:dpd:59452",
      "lemma": "samaya",
      "pos": "masc",
      "excerpt": "samaya [masc]: right time; suitable occasion; lit. going together",
      "decisionRelevance": "SECONDARY for b2 sense 'opportunity' ('suitable moment')."
    },
    {
      "id": "cite:dpd:dpd:49147",
      "lemma": "bhagavā",
      "pos": "masc",
      "morphology": { "gender": "m" },
      "excerpt": "bhagavā [masc]: Sublime One; Blessed One; Fortunate One; epithet of the Buddha",
      "decisionRelevance": "PRIMARY (and only) entry covering all three b3 senses. The single DPD entry packages 'Blessed One' / 'Fortunate One' / 'Sublime One' together and labels it as Buddha-epithet. Strong attestation."
    }
  ],
  "parallels": [
    { "note": "Same 16 work-level mn10 parallels — per gate decision (c) from phase-a, NOT placed in PhaseView.parallels (work-level parallels need a packet-level field; schema gap §10.2 of phase-a)." }
  ],
  "variants": [
    { "note": "Zero variant readings for mn10:1.2 — line stable across all witnesses (bj, sya-all, pts1ed, mr)." }
  ],
  "gaps": [
    "SC dictionary_full first-sense extraction still '(no sense)' (parser limitation flagged in phase-a §10.5).",
    "DPD lookup conflation issue from phase-a (evaṁ → eva) does NOT affect phase-b — ekaṁ correctly resolved to eka (legitimate accusative inflection), samayaṁ correctly to samaya (legitimate accusative), bhagavā IS the headword form.",
    "VRI Aṭṭhakathā commentary on the formula still not wired (C deferred). Buddhaghosa discusses 'ekaṁ samayaṁ' specifically — argues against reading 'at one time' as 'at one particular dated event'; he frames it as a stylistic indefinite to avoid pinning the teaching to one occasion. Would deepen the time-adverbial tension significantly."
  ]
}
```

**Citation count: 5 usable from DPD; 0 from SC dictionary_full; 0 commentary; 0 variants (stable line).**

---

## 3. Proposed packet diff

### 3.1 `b1` ekaṁ — add morph + citations

```diff
 {
   "id": "b1",
   "wordClass": "function",
   "segments": [
     {
       "id": "b1s1",
       "text": "eka",
       "type": "stem",
+      "morph": { "case": "acc", "number": "sg" },
       "tooltips": [
         "[Adjective] One, a certain",
         "Modifies samayaṁ"
       ]
     },
     {
       "id": "b1s2",
       "text": "ṁ",
       "type": "suffix",
+      "morph": { "case": "acc" },
       "tooltips": [
         "[Accusative of Time] \"at/on\"",
         "Tells us when, not what"
       ]
     }
   ],
   "senses": [
-    { "english": "one", "nuance": "At one (time)" }
+    {
+      "english": "one",
+      "nuance": "At one (time)",
+      "epistemicBasis": "lexical",
+      "sourceCitationIds": ["cite:dpd:dpd:17376", "cite:dpd:dpd:17382"],
+      "confidence": "high"
+    }
   ]
 }
```

### 3.2 `b2` samayaṁ — add morph + citations + relation upgrade

```diff
 {
   "id": "b2",
   "wordClass": "content",
   "segments": [
     { "id": "b2s1", "text": "sam", "type": "prefix", "tooltips": [...] },
-    { "id": "b2s2", "text": "aya", "type": "root", "tooltips": [...] },
+    { "id": "b2s2", "text": "aya", "type": "root", "morph": { "gender": "m" }, "tooltips": [...] },
     {
       "id": "b2s3",
       "text": "ṁ",
       "type": "suffix",
+      "morph": { "case": "acc", "gender": "m", "number": "sg" },
       "tooltips": [
         "[Accusative of Time] \"At this occasion\""
       ],
       "relation": {
         "targetWordId": "b3",
         "type": "location",
-        "label": "Time WHEN"
+        "label": "Time WHEN",
+        "confidence": "high",
+        "epistemicBasis": "etymological"
       }
     }
   ],
   "senses": [
-    { "english": "occasion", "nuance": "A coming together" },
-    { "english": "time", "nuance": "The specific event" },
-    { "english": "opportunity", "nuance": "Suitable moment" }
+    {
+      "english": "occasion",
+      "nuance": "A coming together",
+      "epistemicBasis": "lexical",
+      "sourceCitationIds": ["cite:dpd:dpd:59451"],
+      "confidence": "high"
+    },
+    {
+      "english": "time",
+      "nuance": "The specific event",
+      "epistemicBasis": "lexical",
+      "sourceCitationIds": ["cite:dpd:dpd:59451"],
+      "confidence": "high"
+    },
+    {
+      "english": "opportunity",
+      "nuance": "Suitable moment",
+      "epistemicBasis": "lexical",
+      "sourceCitationIds": ["cite:dpd:dpd:59452"],
+      "confidence": "medium"
+    }
   ]
 }
```

### 3.3 `b3` bhagavā — add isAnchor + morph + citations

```diff
 {
   "id": "b3",
   "wordClass": "content",
+  "isAnchor": true,
   "refrainId": "bhagava",
   "segments": [
     { "id": "b3s1", "text": "bhaga", "type": "root", "tooltips": [...] },
     {
       "id": "b3s2",
       "text": "vā",
       "type": "suffix",
+      "morph": { "case": "nom", "gender": "m", "number": "sg" },
       "tooltips": [...]
     }
   ],
   "senses": [
-    { "english": "the Blessed One", "nuance": "Standard" },
-    { "english": "the Fortunate One", "nuance": "Literal" },
-    { "english": "the Lucky One", "nuance": "Fortune-bearer" }
+    {
+      "english": "the Blessed One",
+      "nuance": "Standard",
+      "epistemicBasis": "lexical",
+      "sourceCitationIds": ["cite:dpd:dpd:49147"],
+      "confidence": "high"
+    },
+    {
+      "english": "the Fortunate One",
+      "nuance": "Literal",
+      "epistemicBasis": "lexical",
+      "sourceCitationIds": ["cite:dpd:dpd:49147"],
+      "confidence": "high"
+    },
+    {
+      "english": "the Lucky One",
+      "nuance": "Fortune-bearer",
+      "epistemicBasis": "lexical",
+      "sourceCitationIds": ["cite:dpd:dpd:49147"],
+      "confidence": "medium"
+    }
   ]
 }
```

### 3.4 `eb1g` "At" — specific ghostKind

```diff
 {
   "id": "eb1g",
   "label": "At",
   "isGhost": true,
-  "ghostKind": "required"
+  "ghostKind": "preposition_from_case"
 }
```

### 3.5 `packet.citations` — add 5 new entries

```json
{ "id": "cite:dpd:dpd:17376", "short": "DPD s.v. eka (card — one)", "provenance": "dpd", "query": "eka", "excerpt": "eka [card]: one (1)", "license": "CC BY-NC-SA 4.0 — Digital Pāli Dictionary by Bryan Levman et al.", "fetchedAt": "2026-05-11" },
{ "id": "cite:dpd:dpd:17382", "short": "DPD s.v. eka (ind — once)", "provenance": "dpd", "query": "eka", "excerpt": "eka [ind]: once", "license": "CC BY-NC-SA 4.0 — Digital Pāli Dictionary by Bryan Levman et al.", "fetchedAt": "2026-05-11" },
{ "id": "cite:dpd:dpd:59451", "short": "DPD s.v. samaya (masc — time, occasion)", "provenance": "dpd", "query": "samaya", "excerpt": "samaya [masc]: time; occasion; lit. going together", "license": "CC BY-NC-SA 4.0 — Digital Pāli Dictionary by Bryan Levman et al.", "fetchedAt": "2026-05-11" },
{ "id": "cite:dpd:dpd:59452", "short": "DPD s.v. samaya (masc — right time, suitable occasion)", "provenance": "dpd", "query": "samaya", "excerpt": "samaya [masc]: right time; suitable occasion; lit. going together", "license": "CC BY-NC-SA 4.0 — Digital Pāli Dictionary by Bryan Levman et al.", "fetchedAt": "2026-05-11" },
{ "id": "cite:dpd:dpd:49147", "short": "DPD s.v. bhagavā (masc — Sublime/Blessed/Fortunate One; Buddha-epithet)", "provenance": "dpd", "query": "bhagavā", "excerpt": "bhagavā [masc]: Sublime One; Blessed One; Fortunate One; epithet of the Buddha", "license": "CC BY-NC-SA 4.0 — Digital Pāli Dictionary by Bryan Levman et al.", "fetchedAt": "2026-05-11" }
```

---

## 4. Summary of changes

**Six localized changes** in `phase-b`:

| Change | Where | Verdict needed |
|---|---|---|
| `morph` on b1s1 + b1s2 (case=acc) | b1 segments | OK? |
| `morph` on b2s2 (gender=m) + b2s3 (case=acc, gender=m, number=sg) | b2 segments | OK? |
| `morph` on b3s2 (case=nom, gender=m, number=sg) | b3 segment | OK? |
| `isAnchor: true` on bhagavā | b3 word | OK? (the Buddha as anchor of phase-b) |
| citations + epistemicBasis + confidence on all 7 senses (b1×1 + b2×3 + b3×3) | senses | OK? |
| confidence + epistemicBasis on b2→b3 "Time WHEN" relation | b2s3.relation | OK? |
| eb1g.ghostKind: 'required' → 'preposition_from_case' | englishStructure | OK? |
| 5 new packet.citations entries | packet.citations | OK? |

**Five new packet.citations entries** added.

---

## 5. Tooltip-content note (NOT proposed in this diff)

Phase-b's existing tooltips use the dual-register `[bracket] + plain prose` style. When grammar-terms is off (default per the renderer), the bracketed parts are stripped — leaving prose that mostly stands alone, but some short snippets ("\"at/on\"", "Together, completely") read as fragments without the bracket context.

A **plain-first tooltip rewrite** for phase-b is a separate proposed chunk (matches the renderer-rewriting work flagged after the dev server inspection). NOT included in this diff to keep the gate clean.

---

## 6. Open questions

1. Should bhagavā's `refrainId: 'bhagava'` carry through to all other instances of bhagavā in MN10? (It currently exists only on phase-b's b3; later phases may have separate bhagavā words without the refrainId.) Worth a sweep.
2. The relation on `b2s3` labels `samayaṁ → bhagavā` as `'location'` type with label "Time WHEN". Is `location` the right type for a temporal frame? FEATURES.md §1.3 has 4 types: ownership/direction/location/action. None is `time`. `location` is closest but stretches it. Worth noting; defer to future Affordance Gate review.

---

## 7. Schema/UI tensions surfaced (new from phase-b)

10. **`RelationType` enum lacks `'temporal'`.** Phase-b's `b2s3 → b3` relation expresses "samayaṁ is the temporal frame within which bhagavā [was dwelling]." Currently encoded as `type: 'location'` with label "Time WHEN" — a hack. The 4 enum values (`ownership` / `direction` / `location` / `action`) don't have a clean home for temporal relations. Proposed:
   ```ts
   export type RelationType = 'ownership' | 'direction' | 'location' | 'action' | 'temporal';
   ```
   - Requires renderer palette update (5th color for temporal — perhaps muted blue-violet to distinguish from `location` green).
   - Per FEATURES.md §1.3 "Adding a new `type` value would be a breaking change for older renderers (they'd skip rendering, console-warn). Bump version if added."
   - For now: keep `location` on phase-b, file as **Issue to file: `[Schema] Add 'temporal' RelationType value + renderer color`**.

11. **Note: phase-a §10.7 already flags `EpistemicBasis` enum missing `'grammatical'`/`'curatorial'`.** This phase reinforces the gap — phase-b's relation epistemicBasis is grammatical (accusative-of-time-when syntax rule), not etymological. Currently using `'etymological'` as the closest enum fit; should migrate to `'grammatical'` once the enum extends. No new tension; cross-reference only.

---

## 8. Amendments applied (gate-2 verdict)

Aditya's gate verdict: **approve to apply with two amendments.**

1. **isAnchor moved from b3 (bhagavā) → b2 (samayaṁ).** Reason: the bridge-learning point of phase-b is "ekaṁ samayaṁ → at one time" (the accusative-of-time-when ghost preposition). Anchoring `samayaṁ` aligns visual weight with the pedagogical problem. `bhagavā` retains its `refrainId: 'bhagava'` which is sufficient to mark it as a recurring sacred term.
2. **Relation epistemicBasis remains `'etymological'`** in code (closest enum fit) but logged in §7.11 as part of the enum gap (`grammatical` / `curatorial` needed). Cross-referenced with phase-a §10.7.

Other approvals:
- ghostKind `'preposition_from_case'` on "At" ✓
- morph + citationIds + confidence on all senses ✓
- Relation type kept as `'location'` (with schema tension §7.10 filed) ✓

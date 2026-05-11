# Phase-a — curation log

**Date:** _(filled at commit time)_
**Curator:** Adi + assistant (Opus 4.7 1M)
**Commit:** _(filled at commit time)_
**Pāli:** Evaṁ me sutaṁ
**Readable:** Thus have I heard
**Canonical segments:** mn10:1.1

> This file is the curation log for phase-a per the Grounded Curation Loop
> protocol (`docs/sutta-studio/CURATION_PROTOCOL.md`). Section order matches
> the loop: brief → evidence → alignment → linguistic → bridge → pedagogy →
> epistemic → decisions → open questions → tensions surfaced.

---

## 0. Phase brief

```json
{
  "phaseId": "phase-a",
  "pali": "Evaṁ me sutaṁ",
  "literal": "Thus by-me heard",
  "readable": "Thus have I heard",
  "function": "Opening transmission formula; establishes oral authority and witness-frame. Ānanda speaking, recounting what he heard from the Buddha. This phrase opens nearly every sutta in the Pāli canon and signals 'what follows is reported speech, not my own composition.'",
  "tensions": [
    {
      "id": "grammar-bridge",
      "primary": true,
      "description": "English word order conceals three things at once: (1) 'me' is oblique (genitive form functioning as instrumental agent), not English subject 'me'; (2) 'sutaṁ' is a past participle in nom/acc neuter singular, not a tensed finite verb; (3) the English subject 'I' is a ghost — it has no Pāli source; it is supplied by the oblique agent's required English subject."
    },
    {
      "id": "evaṁ-polysemy",
      "primary": false,
      "description": "'Evaṁ' has multiple attested senses (only/just; indeed/really; in this way). The formulaic narrative-opener reading ('in this way / thus' as cataphoric reference forward) is correct here, but the curator must signal *which* reading — not let the LLM compiler or the reader assume."
    },
    {
      "id": "transmission-frame",
      "primary": false,
      "description": "The phrase establishes that the entire sutta is reported by Ānanda — a transmission-frame, not the Buddha's first-person discourse. This frame applies retroactively to every later phase. Phase-a is where it's named."
    }
  ],
  "register": "narrator-as-Ānanda, formal sutta opening; the most stable phrase in the canon",
  "scope": ["mn10:1.1"]
}
```

**Plain-language summary:** Phase-a teaches that "Thus have I heard" is *grammatically thicker than its English appearance* — three concealed grammatical facts (oblique pronoun, past participle, ghost subject) and one transmission-frame claim (Ānanda speaking, not the Buddha) live inside four English words. The packet's job is to expose all four without flattening the line for reading.

---

## 1. Current packet snapshot (before this run)

**Structure:** 3 paliWords, 4 englishTokens, 1 relation, no spans/parallels/provenance populated.

| word | id | class | segments | senses | tooltips | relation | new-field gaps |
|---|---|---|---|---|---|---|---|
| `evaṁ` | a1 | function | `eva` (stem) + `ṁ` (suffix) | 1 ("Thus") | 3 across segments | — | no morph hints; no sourceCitationIds; no epistemicBasis |
| `me` | a2 | function | `me` (stem, single) | 1 ("by me") | 2 on the stem | **action → a3 "Heard BY"** | no morph (would be `gen` case); no sourceCitationIds |
| `sutaṁ` | a3 | content | `su` (root) + `ta` (suffix) + `ṁ` (suffix) | 3 ("heard" / "what was heard" / "that which has been received") | 5 across segments | (target of a2's relation) | no `isAnchor` flag; no `form: 'participle'` morph on the `ta` segment; no sourceCitationIds |

**English structure:** `ea1` (linked→a1) · `ea2g` (ghost, label "have", `ghostKind: 'required'`) · `ea2` (linked→a2s1) · `ea3` (linked→a3s1).

**Strengths already present:** dual-register tooltips (e.g. `[Genitive/Agent] Form is "of me", function is "by me"`), root identification (`√su: To hear`), a content-vs-function split that respects the formula's economy.

**Gaps that the new schema + grounded providers enable:**
- `MorphHint` is empty on every segment — `me.morph.case = 'gen'`, `sutaṁ.morph` should carry `form: 'participle'` + `gender: 'n'` + `number: 'sg'` + (loose nom/acc).
- `Sense.epistemicBasis` and `sourceCitationIds` unset across all senses — every claim currently floats unattested.
- `PaliWord.isAnchor` unset — by FEATURES.md §1.7 the past-participle `sutaṁ` is the semantic centerpiece of this phase (the act of receiving is what the phrase names).
- `EnglishToken.ghostKind` for `ea2g` (the ghost "have") is set to the catch-all `'required'`; the Ghost Gate prefers a specific kind — this is `'auxiliary'` (English perfect construction).
- `PhaseView.spans` could mark the whole phrase as `quoted_speech` (since it's Ānanda quoting what was heard) — but this is interpretive; deferred to step 6 below.
- `refrainId` not set — `evaṁ me sutaṁ` recurs in every sutta. This is a *cross-sutta* refrain; refrainId currently scopes within a packet. Open question for step 10.

---

## 2. Evidence bundle

```json
{
  "phaseId": "phase-a",
  "providers": ["sc-dictionary-full", "dpd", "sc-bilara-variants", "sc-suttaplex"],
  "usableCitations": [
    {
      "id": "cite:dpd:dpd:18054",
      "lemma": "eva",
      "pos": "ind",
      "excerpt": "eva [ind]: indeed; really; certainly; absolutely",
      "decisionRelevance": "supports the emphatic narrative-opener reading of 'evaṁ' — 'thus' as cataphoric pointer to what follows, not the restrictive 'only/just' reading. PRIMARY for a1 sense."
    },
    {
      "id": "cite:dpd:dpd:18051",
      "lemma": "eva",
      "pos": "ind",
      "excerpt": "eva [ind]: only; just; merely; exclusively",
      "decisionRelevance": "the restrictive sense — NOT the reading intended here, but worth surfacing as the most common alternate so the polysemy tooltip can honestly enumerate. Secondary."
    },
    {
      "id": "cite:dpd:dpd:53164",
      "lemma": "me",
      "pos": "pron",
      "excerpt": "me [pron]: by me",
      "decisionRelevance": "primary attestation that 'me' here is oblique-agent in a passive construction. Directly supports a2's existing sense + the existing relation (action → a3 'Heard BY'). PRIMARY."
    },
    {
      "id": "cite:dpd:dpd:53163",
      "lemma": "me",
      "pos": "pron",
      "excerpt": "me [pron]: myself; me (object)",
      "decisionRelevance": "shows the polysemy of 'me' across cases; lets the tooltip explain 'this is one of six possible case-readings; here it's the agent of a passive past-participle.' Secondary."
    },
    {
      "id": "cite:dpd:dpd:63769",
      "lemma": "suta",
      "pos": "pp",
      "morphology": { "form": "participle" },
      "excerpt": "suta [pp]: heard",
      "decisionRelevance": "primary attestation for a3 sense 1 ('heard'). Confirms `form: 'participle'` on the `ta` segment's morph. PRIMARY."
    },
    {
      "id": "cite:dpd:dpd:63771",
      "lemma": "suta",
      "pos": "nt",
      "morphology": { "gender": "n" },
      "excerpt": "suta [nt]: what is heard; something heard; lit. heard",
      "decisionRelevance": "primary attestation for a3 sense 2 ('what was heard'). The participle has been substantivised as a neuter noun — this is exactly what the `ṁ` segment marks (nom/acc neuter sg). PRIMARY."
    },
    {
      "id": "cite:dpd:dpd:63770",
      "lemma": "suta",
      "pos": "pp",
      "excerpt": "suta [pp]: learned; lit. heard",
      "decisionRelevance": "supports the existing 3rd sense ('that which has been received / orally transmitted') without claiming 'received' as a distinct primary meaning. The literal-derivative voice on the tooltip can quote this. Secondary."
    }
  ],
  "parallels": [
    { "note": "16 work-level parallels exist for mn10 (DN22 most pedagogically relevant; MA98/MA31/MA81/EA12.1/SHT-11/T32 cross-canon). These are NOT phase-a-specific — they're the whole-sutta parallels suttaplex returns at the work key. See §10 for the schema tension about where these belong." }
  ],
  "variants": [
    { "note": "Zero variant readings for mn10:1.1 — the opening 'Evaṁ me sutaṁ' is stable across all witnesses (bj, sya-all, pts1ed, mr). This is the most stable line in the canon. Worth surfacing in the provenance/excerpt UI." }
  ],
  "gaps": [
    "SC dictionary_full first-sense extraction returns '(no sense)' for most lemmas — known parser limitation in suttaCentralDictionary.ts; the raw payload IS preserved in rawExcerpt for the LLM and would render in a future audit UI, but our structured Sense glosses must rely on DPD.",
    "VRI Aṭṭhakathā commentary not yet wired (commit C per ADR SUTTA-008 deferred per Open Questions #4). Buddhaghosa has a famous gloss on 'Evaṁ me sutaṁ' in Sumaṅgalavilāsinī / Papañcasūdanī — he discusses oral transmission, Ānanda-as-witness, and the structural force of this formula. This would meaningfully deepen the transmission-frame tension. Reserved for a follow-up enrichment pass when C lands.",
    "No `epistemicBasis: 'comparative'` evidence wired yet — DN22 has the same opening but we don't have a cross-text alignment provider returning '#identical at the line level'. The fact of formula-recurrence is known in scholarship; here it's only inferable from suttaplex's work-level parallel list, not from a per-segment provider."
  ]
}
```

**Citation count: 7 usable from DPD; 0 from SC dictionary_full (parser limitation); 0 commentary (deferred); 0 variants (stable line).**

---

---

## 1. Current packet snapshot (before this run)

(filled at curation start — summary of existing fields: 3 paliWords, 1-3 senses each, 1 relation, dual-register tooltips, no compoundType / isAnchor / refrainId / sourceCitationIds / epistemicBasis populated yet)

---

## 2. Evidence bundle

(filled by curator during the evidence sweep step; format per CURATION_PROTOCOL.md §2.2)

```json
{
  "phaseId": "phase-a",
  "providers": ["sc-dictionary-full", "dpd", "sc-bilara-variants", "sc-suttaplex"],
  "usableCitations": [],
  "parallels": [],
  "variants": [],
  "gaps": []
}
```

---

## 3. Alignment scaffold

(filled — Pāli ↔ English mapping including ghosts + reorderings)

```
evaṁ     →
me       →
sutaṁ    →
[ghost]  →
[reorder]
```

---

## 4. Linguistic pass

Morphology, compounds, sandhi, syntax. Every nontrivial claim is sourced or marked inferred.

- (to fill)

---

## 5. Translation-bridge pass

Ghost words + supplied-English rationale. Each ghost names its `GhostKind` from the expanded set (article / copula / auxiliary / pronoun_from_verb / preposition_from_case / punctuation / quote_marker / interpretive / required).

- (to fill)

---

## 6. Pedagogical pass

Tooltip / anchor / refrain / relation proposals. Each justified by the three Affordance Gate questions.

- (to fill)

---

## 7. Epistemic audit

Every Sense / Relation / MorphHint / Compound claim mapped to its `epistemicBasis` + `sourceCitationIds`. No naked authoritative claims.

| Field | Value | Basis | Citation(s) |
|---|---|---|---|
| (filled per row) | | | |

---

## 8. Decisions

The why-behind-the-what. This is the section future-curators will read.

- **Decision:** (e.g., "Render 'me' as English subject 'I' despite oblique Pāli form")
  - **Reason:** (e.g., "English idiom requires subject position; tooltip preserves Pāli structure with `[Genitive/Agent]` dual-register")
  - **Evidence:** (citationIds)
  - **Tension resolved:** (which phase-brief tension this addresses)

---

## 9. Open questions

Captured during the run; resolved later or filed as follow-ups.

- (to fill)

---

## 10. Schema / UI tensions surfaced

Extracted from the curation, **not** implemented inside this phase's diff. Tensions go here so the packet diff stays minimal.

- (to fill — may be empty if no tensions surfaced)

---

## 11. Outcome

- **Packet diff:** _(filled at apply step — link to commit)_
- **Tests run:** _(filled — yes/no, what passed)_
- **Build verified:** _(filled — Vite build green / not run / failed)_
- **Renderer inspected:** _(filled — yes/no, screenshot path if captured)_

---

*This log is filled in during the phase-a curation run that follows this commit. The skeleton is committed first so the protocol's structure is locked before the work begins.*

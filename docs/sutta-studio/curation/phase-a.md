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
  "literal": "Thus by me heard",
  "readable": "Thus have I heard",
  "function": "Opening transmission formula; establishes oral authority and witness-frame. Ānanda speaking, recounting what he heard from the Buddha.",
  "tension": "(to fill) — primary English/Pāli bridge tension this phase must resolve",
  "register": "narrator-as-Ānanda, formal sutta opening; the most stable phrase in the canon",
  "scope": ["mn10:1.1"]
}
```

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

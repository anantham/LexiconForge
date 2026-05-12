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
      "scope": "phase-local",
      "description": "English word order conceals three things at once: (1) 'me' is oblique (genitive form functioning as instrumental agent), not English subject 'me'; (2) 'sutaṁ' is a past participle in nom/acc neuter singular, not a tensed finite verb; (3) the English subject 'I' is a ghost — it has no Pāli source; it is supplied by the oblique agent's required English subject."
    },
    {
      "id": "evaṁ-deixis",
      "primary": false,
      "scope": "phase-local",
      "description": "Evaṁ is the adverbial form of the emphatic particle eva (with niggahīta -ṁ), but functionally it's a cataphoric deictic — it points FORWARD to what's about to be recited. The translation 'Thus' must signal this is the narrative-opener deictic 'in this way', not the emphatic 'only/just/indeed' senses of bare eva. The curator must teach which reading is meant, not assume."
    },
    {
      "id": "transmission-frame",
      "primary": false,
      "scope": "packet-level (not resolvable inside phase-a JSON alone)",
      "resolutionSurface": "DeepLoomPacket.provenance.attribution + narrator-frame metadata + possible quoted/recited-speech span at the work level",
      "phaseRole": "introduces the frame but does not fully resolve it",
      "description": "The phrase establishes that the entire sutta is reported by Ānanda — a transmission-frame, not the Buddha's first-person discourse. This frame applies retroactively to every later phase. Phase-a is where it's named; the schema field that carries the resolution (provenance.attribution) lives at packet level."
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
      "providerIssue": "DPD lookup for evaṁ matched eva (the bare emphatic particle), via the build-dpd.ts stem-stripper which collapsed evaṁ → strip -ṁ → eva. Verified directly: dpd.txt has NO entry for evaṁ/evaṃ; only eva (+ many evam-prefixed sandhi compounds). The senses of eva (only/just/merely/indeed/still) do NOT include the 'thus / in this way' reading required here. This is a derivational-vs-inflectional conflation: evaṁ is the adverbial form of eva, not an inflection of it. Do NOT cite cite:dpd:dpd:18051-18055 as evidence for a1's gloss until provider is fixed (see §10 schema/UI tensions). For now, evaṁ is grounded in Pāli grammar (adverbial formation rule) + manual curator inference, not DPD."
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

**Citation count: 0 reliable from DPD for evaṁ (provider issue, see §10); 2 reliable from DPD for me; 3 reliable from DPD for suta(ṁ); 0 from SC dictionary_full (parser limitation); 0 commentary (deferred); 0 variants (stable line).**

---

## 3. Alignment scaffold

```
evaṁ     → "Thus"                  (1:1 lexical; adverbial deictic — "in this way")
me       → "I"                     (subject position in English — NOT a 1:1 mapping;
                                    Pāli "me" is oblique-agent, English requires subject;
                                    tooltip preserves Pāli structure via [Genitive/Agent])
sutaṁ    → "heard"                 (past participle rendered with English perfect tense;
                                    also carries the "what was heard" substantive sense
                                    that English perfect collapses into the verb form)
[ghost]  → "have"                  (ghostKind: 'auxiliary' — required by English perfect;
                                    NOT 'required' catch-all)
[reorder] me sutaṁ → I have heard   (Pāli agent-genitive + past participle;
                                    English subject + perfect-aspect verb)
```

Every English token visible to the reader maps back to: a Pāli word (Thus / I / heard), a Pāli case-ending (the oblique-agent reading that surfaces "I"), or an English grammatical requirement (have).

---

## 4. Linguistic pass

Every nontrivial grammatical claim is either sourced (citation), grammatical-rule (named), or marked curator-inference.

### evaṁ (a1)

- **Form:** adverbial. Pāli grammar: emphatic particle `eva` + niggahīta `-ṁ` produces the adverb. (Grammatical rule; see Geiger §66 or Warder Ch. 13 on adverbial formation. NOT attested in DPD as a distinct headword — provider issue logged in §10.)
- **Function here:** cataphoric deictic — "in this way" pointing FORWARD to what's about to be recited. The formula evaṁ me sutaṁ is conventionally fixed in this reading across the canon.
- **What it is NOT:** the emphatic-particle senses of bare `eva` (only/just/merely/indeed) are NOT in play here. DPD's `eva` entries (`cite:dpd:dpd:18051-18055`) attest the particle but not the adverbial-deictic reading the formula needs.

### me (a2)

- **Form:** 1sg pronoun, oblique. Pāli `me` is morphologically the genitive/dative/instrumental syncretism of `mayaṁ` paradigm — the surface form serves all three.
- **Function here:** oblique agent of the passive past-participle construction `me sutaṁ` = "(by) me (was) heard". This is the classical Pāli agent-in-genitive-of-passive-participle pattern (Warder Ch. 9 / Geiger §107).
- **Evidence:** `cite:dpd:dpd:53164` ("me [pron]: by me") attests the agent reading directly. The polysemy of `me` across cases (`cite:dpd:dpd:53163` "myself; me (object)") supports the tooltip's "form is 'of me', function is 'by me'" framing.
- **`MorphHint`:** `{ case: 'gen' }` — surface form is genitive; the agentive function is grammatical, not encoded in case morphology.

### sutaṁ (a3)

- **Form:** past participle of √su "to hear" (root `su` + pp suffix `ta` + nom/acc neuter singular ending `-ṁ`). The full word is `suta` (pp) declined into the neuter substantive paradigm.
- **Function here:** participial/substantive — "heard" or "what was heard". The neuter form supports either reading; English perfect "have heard" collapses them but the Pāli leaves both available.
- **Evidence:**
  - `cite:dpd:dpd:63769` ("suta [pp]: heard") — primary participle attestation.
  - `cite:dpd:dpd:63771` ("suta [nt]: what is heard; something heard") — primary substantive attestation. DPD lists these as separate homonyms; in our context the substantive reading is what makes the formula compress so elegantly.
- **`MorphHint`:** the `ta` segment carries `{ form: 'participle' }`; the `ṁ` segment carries `{ gender: 'n', number: 'sg' }` (the case is nominative or accusative — ambiguous, both grammatical; nominative if reading "was heard" as subject, accusative if reading "(I) heard (it)").
- **Careful framing (per gate amendment):** the `-aṁ`/`-ṁ` ending marks neuter nom/acc singular declensional case; it does NOT itself "nominalize" the participle. The participle's substantive use is a syntactic possibility of past participles in Pāli generally, not produced by the ending.

### Construction overall

- **Agent-genitive + past participle** (zero copula). Classical Pāli pattern for impersonal-passive "by X (it was) Y-ed." English requires unfolding to subject + perfect-tense ("I have heard").
- **No explicit subject:** the English subject "I" is supplied by the rule that oblique agents of past participles surface as English subjects in the readable rendering. This is the source of the ghost "I" (which we render via `linkedSegmentId` from `me`, not as a separate ghost token).

---

## 5. Translation-bridge pass

### Existing English structure

| token id | English | source | ghostKind | rationale |
|---|---|---|---|---|
| ea1 | "Thus" | linked → a1 (evaṁ) | — | 1:1 deictic |
| ea2g | "have" | ghost | `'required'` → **`'auxiliary'`** | English perfect construction supplied to render past participle |
| ea2 | "I" | linked → a2s1 (me) | — | the oblique agent surfaces as English subject; tooltip preserves Pāli grammar |
| ea3 | "heard" | linked → a3s1 (su) | — | past participle rendered with perfect aspect |

### Ghost Gate check (per CURATION_PROTOCOL.md §3.2)

Only one ghost in this phase: `ea2g` "have". Currently flagged as `'required'` — the catch-all. **Specific reason exists**: English perfect tense (have + past participle) is the natural rendering of the Pāli past-participle-as-main-verb. The ghost is grammatical, not interpretive, not punctuation, not pronoun-from-verb. **Specific GhostKind: `'auxiliary'`** — exactly matches the FEATURES.md §2.3 expanded definition ("'have', 'will', 'do' (modal/perfect/future)").

**Diff to ea2g:** `ghostKind: 'required'` → `ghostKind: 'auxiliary'`.

### Why no other ghosts?

- No article needed (Thus / I / heard — none take "the" or "a").
- No copula needed (English perfect carries its own auxiliary).
- No preposition-from-case needed (the oblique reading is rendered structurally, not lexically — there's no English "by").

### Reorder note

Word order in Pāli: `Evaṁ me sutaṁ` (adverb / agent / participle).
Word order in English: `Thus / I (subject from agent) / have heard (perfect from participle)`.
The reorder is grammatical, not pedagogical — English doesn't admit "Thus by-me heard" naturally for narrative prose.

---

## 6. Pedagogical pass

Proposals scoped to one tension at a time. Each affordance answers the three Affordance Gate questions: helps cross from Pāli to English? teaches reusable pattern? clutters or not?

### evaṁ (a1)

- **Senses:** upgrade to one primary + one alternate-warning.
  - Primary: `english: "Thus"`, `nuance: "Narrative-opening deictic ('in this way') — points forward to what is about to be recited"`.
  - Secondary (study mode): `english: "in this way"`, `nuance: "the cataphoric reading; signals that what follows is the reported speech"`.
- **Tooltip on `eva` segment:** "Evaṁ: 'thus; in this way.' In the opening formula evaṁ me sutaṁ, it frames what follows as something heard and now recited. **Not** the emphatic particle eva ('only', 'just', 'indeed')."
- **Tooltip on `ṁ` segment:** "Adverbial niggahīta — turns the particle eva into the adverb evaṁ ('in this way')."
- **Affordance Gate check:** all three Yes (helps cross / teaches reusable adverbial-formation pattern / does not clutter — already two-segment word).

### me (a2)

- **Existing senses + tooltips are already strong.** Keep `[Genitive/Agent] Form is "of me", function is "by me"`.
- **Add citation attestation** to the existing sense (no new sense text needed): `sourceCitationIds: ["cite:dpd:dpd:53164"]`, `epistemicBasis: 'lexical'`.
- **Add `MorphHint`** `{ case: 'gen' }` to `me.morph` on the single stem segment. The tooltip can stay prose-only.
- **Existing relation (action → a3 'Heard BY')** keeps its label. Add `confidence: 'high'`, `epistemicBasis: 'etymological'` (the agent-in-genitive-of-passive-participle pattern is grammatically attested, not just lexical).
- **Affordance Gate check:** existing affordances pass all three.

### sutaṁ (a3)

- **Mark `isAnchor: true`** on the word. By the Affordance Gate: this is where the English sentence secretly turns (past participle becomes perfect verb); marking it teaches readers that sutaṁ is the semantic center of the phrase.
- **Senses:** retain existing 3 senses; attach `sourceCitationIds`:
  - "heard": `["cite:dpd:dpd:63769"]`, `epistemicBasis: 'lexical'`
  - "what was heard": `["cite:dpd:dpd:63771"]`, `epistemicBasis: 'lexical'`
  - "that which has been received": `["cite:dpd:dpd:63770"]`, `epistemicBasis: 'lexical'`
- **Add `MorphHint` to segments:**
  - `ta` segment: `{ form: 'participle' }`
  - `ṁ` segment: `{ gender: 'n', number: 'sg' }`
- **Tooltip refinement on `ta` segment** (per gate amendment, careful framing):
  - Existing: `"[Past participle] Marks completed action: 'heard'"` — KEEP.
- **Tooltip refinement on `ṁ` segment** (per gate amendment, careful framing):
  - Replace: `"[Neuter singular] 'the thing that...'"` → `"[Neuter nom/acc singular] Declensional ending. Supports reading sutaṁ as either 'was heard' or 'what was heard' — both grammatical; English perfect collapses them."`
  - Replace: `"Makes it the subject of the sentence"` → `"In the formula 'me sutaṁ' (oblique agent + past participle), the participial form can function substantively — giving the phrase its compressed 'Thus by me heard' structure."`

### Refrain / cross-sutta recurrence — defer

`evaṁ me sutaṁ` opens nearly every sutta. This is the canonical formula. But `refrainId` per current schema is *within-packet*; cross-sutta refrains have no schema support. Logged as §10 tension. Do not set `refrainId` in this phase.

### Parallels — defer per gate decision

Per gate decision (c): do NOT populate `phase-a.parallels` with the 16 work-level parallels. Logged in §10 as schema gap — packet-level parallels field needed.

---

## 7. Epistemic audit

Every claim mapped to its basis + citation. No naked authoritative claims; provider-issue claims explicitly downgraded.

| Field | Value | Basis | Citation(s) / source |
|---|---|---|---|
| `a1.senses[0].english` | "Thus" | `etymological` + curator inference | adverbial-formation rule (Geiger §66 / Warder Ch.13); **NOT** the DPD eva entries (provider issue §10) |
| `a1.senses[0].nuance` | "Narrative-opening deictic..." | curator inference (grammatical convention) | — |
| `a1.s1.tooltips` | (revised) | `etymological` / pedagogical | grammatical rule; curator inference for the contrast claim |
| `a2.morph.case` | `'gen'` | `etymological` (morphological identity) | Pāli paradigm; corroborated by `cite:dpd:dpd:53164` "by me" |
| `a2.senses[0].english` | "by me" | `lexical` | `cite:dpd:dpd:53164` |
| `a2.senses[0].confidence` | `'high'` | — | — |
| `a2.relation` | existing (action → a3 "Heard BY") | `etymological` (agent-in-gen pattern) | `confidence: 'high'`, `epistemicBasis: 'etymological'` |
| `a3.isAnchor` | `true` | curator inference (pedagogical) | Affordance Gate q1+q2: sutaṁ is where Pāli compression unfolds |
| `a3.senses[0].english` | "heard" | `lexical` | `cite:dpd:dpd:63769` |
| `a3.senses[1].english` | "what was heard" | `lexical` | `cite:dpd:dpd:63771` |
| `a3.senses[2].english` | "that which has been received" | `lexical` | `cite:dpd:dpd:63770` |
| `a3.s2 (ta).morph` | `{ form: 'participle' }` | `etymological` | DPD pos `pp` from `cite:dpd:dpd:63769` |
| `a3.s3 (ṁ).morph` | `{ gender: 'n', number: 'sg' }` | `etymological` | DPD pos `nt` from `cite:dpd:dpd:63771` + Pāli declensional paradigm |
| `ea2g.ghostKind` | `'auxiliary'` (was `'required'`) | curator inference (English grammar) | English perfect-tense rule |

**Naked claims:** none. **Provider-issue downgrades:** 1 (evaṁ DPD evidence). **Curator inferences explicitly marked:** 5.

---

## 8. Decisions

The why-behind-the-what.

- **Decision: Render `evaṁ` as primary "Thus" with deictic-clarifying tooltip; do NOT cite DPD evidence.**
  - Reason: provider issue — DPD's stem-stripper conflates evaṁ with the base particle eva, whose senses don't match. Adverbial-deictic reading is grammatically required by the formula; manually inferred from grammar rule, not lookup.
  - Evidence: Pāli grammar (Geiger §66; Warder Ch.13). NOT `cite:dpd:dpd:18051-18055` (downgraded).
  - Tension resolved: §0 evaṁ-deixis (partial; tooltip teaches the contrast).

- **Decision: Keep `me` rendered as English subject "I"; preserve Pāli oblique structure in tooltip.**
  - Reason: English idiom requires subject position; the dual-register tooltip preserves the Pāli grammar fact rather than naturalising it away.
  - Evidence: `cite:dpd:dpd:53164` ("by me"), corroborated by `cite:dpd:dpd:53163` ("myself; me-object") for the polysemy.
  - Tension resolved: §0 grammar-bridge fact 1.

- **Decision: Mark ghost "have" as `ghostKind: 'auxiliary'` instead of `'required'`.**
  - Reason: Specific kind exists per FEATURES.md §2.3 expanded set. `'required'` is the catch-all; we should not default to catch-all when a precise kind fits.
  - Evidence: English perfect-tense construction rule.
  - Tension resolved: §0 grammar-bridge fact 3.

- **Decision: Mark `sutaṁ` as `isAnchor: true`.**
  - Reason: Per Affordance Gate — sutaṁ is the word where the English sentence secretly turns. Past participle → perfect verb is the central grammatical bridge of the phrase.
  - Evidence: FEATURES.md §1.7 anchor definition.
  - Tension resolved: §0 grammar-bridge fact 2.

- **Decision: Add `MorphHint` to `a2.s1` (case=gen), `a3.s2 ta` (form=participle), `a3.s3 ṁ` (gender=n, number=sg).**
  - Reason: Schema fields populated by real grammatical facts. The `MorphHint` extension landed in commit 7d38402 exists precisely for this.
  - Evidence: DPD POS attestations + Pāli declensional paradigms.
  - Tension resolved: §0 grammar-bridge facts 1+2.

- **Decision: Refine `a3.s3 ṁ` tooltips to avoid "ṁ nominalizes" framing.**
  - Reason: Per gate amendment — the ending marks declensional case, not nominalization; the participle's substantive use is a syntactic possibility, not produced by the ending.
  - Evidence: Pāli declensional paradigms (the same -aṁ ending appears across countless neuter nouns and adjectives without any "nominalizing" force).
  - Tension resolved: pedagogical accuracy.

- **Decision: Do NOT populate `phase-a.parallels` with work-level parallels.**
  - Reason: Per gate option (c) — work-level parallels belong on a packet-level field (not yet in schema). Stuffing 16 of them on phase-a would duplicate across 51 phases.
  - Evidence: suttaplex returned 16 parallels for mn10 at work-level keys.
  - Tension resolved: schema separation (logged §10).

---

## 9. Open questions

Carried out of the run; resolved later or filed as follow-ups.

- **Cross-sutta refrain markers:** `evaṁ me sutaṁ` opens nearly every sutta. The current `refrainId` field is within-packet. Should there be `crossSuttaRefrainId` or equivalent? Or does this live on Span (per §10)?
- **Tooltip for the implicit "I":** the English subject "I" is rendered via `linkedSegmentId` from `me`, not as a separate ghost token. Is the dual-register tooltip on `me` sufficient to teach the ghost-I phenomenon, or does the renderer need a separate affordance (a small superscript marker on "I" indicating "supplied")?
- **`a3` sense ordering:** currently "heard" is primary, "what was heard" is secondary. Both DPD homonyms attest the senses with comparable status. Should they cycle equally, or does primary/secondary reflect English-target translation preference rather than Pāli-source ambiguity?
- **SC dictionary_full parser fix priority:** the `(no sense)` extraction failure means SC is currently dead-weight for our curation. Fixing the parser would attest evaṁ properly (PED almost certainly has it as a distinct headword). Worth lifting to a real issue.

---

## 10. Schema / UI tensions surfaced

Captured for separate follow-up. **NOT** implemented inside this phase's diff.

1. **DPD lookup conflates derivational forms with base lemmas.** The stem-stripper in `scripts/build-dpd.ts` collapsed `evaṁ → eva` mechanically, but these are not in an inflectional relationship — `evaṁ` is the adverbial DERIVED from `eva`. Senses don't transfer.
   - **Proposed fix:** the build script's `forms.json` should distinguish `'inflection'` from `'derivation'` mappings, and the DpdProvider should never return derivational matches under `lookup(lemma)` without explicit opt-in. Alternatively, the stem-stripper should NOT strip `-ṁ`/`-aṁ` for forms where the stripped result is a known short particle (`eva`, `iti`, `kho`, `pi`, …).
   - **Issue to file:** `[DPD] stem-stripper conflates derivational forms with base lemmas (evaṁ → eva)`.

2. **Packet-level / work-level parallels have no schema home.** Suttaplex returns 16 work-level parallels for mn10 (DN22, MN119, MA98, …). Per gate decision (c) these don't belong on `PhaseView.parallels`. Proposed shape:
   ```ts
   type DeepLoomPacket = {
     // existing fields...
     workParallels?: ParallelRef[];          // work-level (suttaplex)
     // or via TextGraphRefs:
     textGraphRefs?: { workParallelIds?: string[]; };
   };
   ```
   - **Issue to file:** `[Schema] Add packet-level workParallels field separate from PhaseView.parallels`.

3. **Cross-sutta formula recurrence has no schema home.** `evaṁ me sutaṁ` is the canonical opening formula across the Pāli canon — a kind of refrain at canon scale, not within-packet. Current `refrainId` is within-packet only. Proposed: extend `Span` to carry formula-recurrence references:
   ```ts
   type Span = {
     id: string;
     kind: 'quoted_speech' | 'cited_phrase' | 'parenthetical' | 'formula' | 'refrain';
     startWordId: string;
     endWordId: string;
     parallels?: ParallelRef[];   // for cross-sutta formula recurrence
     note?: string;
   };
   ```
   - **Issue to file:** `[Schema] Extend Span.kind with 'formula' / 'refrain'; add Span.parallels for cross-sutta phrase recurrence`.

4. **The implicit-subject "I" has no first-class representation.** Currently `ea2` is rendered with `linkedSegmentId: 'a2s1'` (the segment id of `me`). The reader sees "I" highlighted when hovering `me`, but there's no marker saying "this English word is structurally supplied by the Pāli case, not by a Pāli pronoun." This is a renderer-affordance question, not necessarily a schema gap — but a flag for the eventual UI pass.

5. **SC dictionary_full parser limitation.** Returns opaque payload that our parser surfaces as `(no sense)` for first-sense extraction. Raw excerpt is preserved (good for LLM, good for future audit UI), but our structured `Sense` glosses can't draw from SC currently. Particularly painful for words like `evaṁ` where DPD doesn't have a direct entry but PED (in SC's response) almost certainly does.
   - **Issue to file:** `[Provider] Fix SuttaCentralDictionaryProvider parser to extract Sense-level glosses, not just rawExcerpt`.

6. **No first-class "curator inference" marker.** Several decisions above (evaṁ sense, ghostKind='auxiliary', isAnchor=true) are curator-inferred — grammatically grounded but not from a citation. Currently the basis is recorded only in this curation log, not in the packet itself. A `Sense.curatorInferred?: boolean` or `Sense.epistemicBasis: 'inferred'` enum value would let the renderer attribute correctly. Open protocol question §10.3 in CURATION_PROTOCOL.md flags this.

7. **`EpistemicBasis` enum missing `grammatical` / `curatorial` / `philological`.** Several claims in phase-a are grammatical (the agent-in-genitive-of-passive-participle pattern; the adverbial-deictic reading of evaṁ; the substantive use of past participles). Current enum is `'etymological' | 'commentarial' | 'contextual' | 'lexical' | 'comparative'`. Using `etymological` as the closest fit is borderline misleading — etymology is word-history; these are syntactic/grammatical facts. Proposed addition:
   ```ts
   export type EpistemicBasis =
     | 'etymological'   // word-history; sandhi; cognate
     | 'grammatical'    // syntactic/morphological rule (NEW)
     | 'commentarial'
     | 'contextual'
     | 'lexical'
     | 'comparative'
     | 'curatorial';    // explicit curator inference, grammatically grounded (NEW)
   ```
   Per the gate's instruction, all `'etymological'` values on phase-a where the claim is grammatical (evaṁ sense, me→a3 relation) are tagged with this issue: they should migrate to `'grammatical'` once the enum extends. Issue to file: `[Schema] Extend EpistemicBasis with 'grammatical' and 'curatorial'`.

8. **`MorphHint` lacks `function` / `semanticRole`.** The current `case: 'gen'` on `a2.s1` records the surface form. The pedagogically load-bearing fact — that this genitive surface is *functioning as agent* — is preserved only in tooltips. Future shape (per gate amendment):
   ```ts
   type MorphHint = {
     // existing fields...
     function?: 'agent' | 'patient' | 'recipient' | 'instrument' | 'possessor' | 'location' | ...;
     semanticRole?: string;  // free-form fallback
   };
   ```
   This separates morphology (declensional case) from syntax (function in the clause). Issue to file: `[Schema] Add function/semanticRole to MorphHint to capture oblique-agent and similar form/function divergences`.

9. **`GhostKind` could be more specific.** `'auxiliary'` works for "have" in the perfect construction, but a more precise kind would be `'auxiliary_from_english_perfect'` — naming why the English grammar requires it. Current enum collapses several distinct grammatical motivations under `'auxiliary'`. Defer; revisit after several phases reveal whether the finer distinctions matter pedagogically.

---

## 11. Outcome

- **Packet diff:** applied in same commit as this log update. Seven localized changes in `components/sutta-studio/demoPacket.json` phase-a + four new entries in `packet.citations`. Verified by `python3 -c "json.load(...)"` and field-by-field readback.
- **Tests run:** ✅ 173/173 pass across 11 suites (services/providers/, services/suttaStudioRehydrator.test, tests/components/sutta-studio-utils.test, tests/services/compiler/, types/suttaStudio.test). No regressions from packet content or schema extensions.
- **Build verified:** ✅ `npx vite build` succeeds (built in 23.30s). DPD JSON shards bundle in cleanly. Pre-existing chunk-size warnings unrelated.
- **Renderer inspected:** not in this commit — the live `/sutta/demo` will reflect the change once main is updated. Visual inspection deferred to merge/preview review.

**Date:** 2026-05-11
**Commit:** (filled at commit time below)

---

## 13. Backfill (2026-05-12) — evaṁ citation after DPD fix

Phase-a's `a1.senses[0]` (evaṁ "Thus") originally had no DPD citation
because the stem-stripper conflated evaṁ with bare `eva` (Tension #1).
After commit `c33b115` fixed three DPD-stripper bugs (niggahīta
normalization + over-greedy -ūsu/-ūhi + missing bare -su/-hi +
vowel-shortening), evaṁ now resolves correctly to DPD's `evaṃ`
headword (normalized to ṁ): `cite:dpd:dpd:18134` — "thus; this; like
this; similarly; in the same manner; just as; such."

Backfill change:
  - `a1.senses[0].epistemicBasis`: 'etymological' → 'lexical'
  - `a1.senses[0].sourceCitationIds`: + `["cite:dpd:dpd:18134"]`
  - `a1.senses[0].confidence`: + 'high'
  - `a1.senses[0].notes`: updated to reflect DPD's actual treatment
    of evaṁ vs eva as distinct headwords (still teaches the
    distinction, but now grounded in DPD's own taxonomy rather than
    in curator wisdom)
  - `packet.citations`: + 1 new entry (cite:dpd:dpd:18134)

The polysemy / "Do not confuse evaṁ with bare eva" framing on the
a1.s1 tooltips remains accurate — DPD itself treats them as distinct
headwords. The fix VALIDATED the curation logic, didn't supersede it.

## 12. Pre-ratification log: gate-amendment summary

Aditya's verdict on the proposed JSON diff (chat artifact, second gate) was "approve to apply, with small wording/schema-basis amendments before commit." Seven amendments applied:

1. Summary counts corrected to "seven localized changes; four citation entries."
2. evaṁ `epistemicBasis: 'etymological'` retained for now (enum lacks `'grammatical'`/`'curatorial'`); flagged as schema tension §10.7.
3. evaṁ tooltip on `a1.s1` softened to "Do not confuse evaṁ with bare eva…"
4. `a1.s2` tooltip changed to "[Niggahīta -ṁ] Marks the surface form evaṁ…"
5. me→a3 relation `epistemicBasis: 'etymological'` retained (same enum constraint); flagged §10.7.
6. `me.morph = { case: 'gen' }` accepted as-is; future `function: 'agent'` extension flagged §10.8.
7. `ea2g.ghostKind: 'auxiliary'` accepted; future `'auxiliary_from_english_perfect'` flagged §10.9.

---

*This log is filled in during the phase-a curation run that follows this commit. The skeleton is committed first so the protocol's structure is locked before the work begins.*

# Sutta Studio Curation Protocol — the Grounded Curation Loop

> **Status:** Ratified 2026-05-11 (with this commit).
> **Companions:** `docs/adr/SUTTA-008-grounded-curation-data-layer.md` (the data-layer architecture this protocol depends on), `docs/sutta-studio/FEATURES.md` (the schema fields curation populates).
> **Operationalises:** task #14 (MN10 phase-by-phase re-curation) and every subsequent re-curation effort.

This document is the single source of truth for **how a phase of `demoPacket.json` gets curated**. It exists because earlier iterations mixed data curation, schema discovery, UI brainstorming, and commit workflow in the same pass — every phase felt like a philosophical council. The protocol below separates those concerns into ordered passes with explicit gates.

The discipline: **schema and UI insights are extracted *after* the packet diff, not allowed to hijack the packet diff.**

---

## 0. Five invariant questions

Every curation pass is in service of these. Re-read before each phase.

1. **What does the Pāli say?**
2. **What does English have to add, move, or omit?**
3. **What evidence supports each claim?**
4. **What should the UI reveal?**
5. **What uncertainty should remain visible?**

When in doubt during any step, return to the question that's load-bearing for that step.

---

## 1. The Loop

```
brief → evidence → alignment → linguistic → bridge → pedagogy → epistemic → diff → review → apply → commit → issue extraction
```

| # | Step | Owner | Output | Exit criterion |
|---|---|---|---|---|
| 0 | **Phase brief** | curator | `phaseBrief` object | The pedagogical *job* of this phase is articulated |
| 1 | **Current packet snapshot** | curator | JSON summary of existing fields | No hidden edits; we see what we'd change |
| 2 | **Evidence sweep** | curator | `evidenceBundle` with usable citations + gaps | Every usable source has a citation id + inline excerpt |
| 3 | **Alignment scaffold** | curator | Pāli ↔ English mapping (including ghosts + reorderings) | Every English token has a reason |
| 4 | **Linguistic pass** | curator | Morphology / compounds / sandhi / syntax notes | Every nontrivial grammar claim is sourced or marked inferred |
| 5 | **Translation-bridge pass** | curator | Ghost-word rationale + supplied-English notes | Each ghost passes the Ghost Gate (see §3) |
| 6 | **Pedagogical pass** | curator | Tooltip / anchor / refrain / relation proposals | Each affordance passes the Affordance Gate (see §3) |
| 7 | **Epistemic audit** | curator | `sourceCitationIds` + `epistemicBasis` + confidence + uncertainty notes | No naked authoritative claim; every factual claim is classified |
| 8 | **Minimal JSON diff** | curator | Patch only — no brainstorming inside the diff | Diff is reviewable in one sitting |
| 9 | **Human review** | Aditya | Approve / reshape / reject | Taste, doctrinal sensitivity, epistemic care |
| 10 | **Apply + validate** | curator | Edited packet + tests/build green | Packet renders + compiles |
| 11 | **Commit + curation log** | curator | One commit (one phase or cleared batch) + `docs/sutta-studio/curation/phase-<id>.md` entry | Git history + decisions both clean |
| 12 | **Schema/UI issue extraction** | both | Follow-up issues / ADR amendments — NEVER inside the packet diff | Tensions captured without scope creep |

---

## 2. Artifact shapes

### 2.1 Phase brief

Produced before any lookup. Forces articulation of the phase's *job*.

```json
{
  "phaseId": "phase-a",
  "pali": "Evaṁ me sutaṁ",
  "literal": "Thus by me heard",
  "readable": "Thus have I heard",
  "function": "Opening transmission formula; establishes oral authority and witness-frame",
  "tension": "English word order hides that 'me' is oblique and 'sutaṁ' is a past participle. The English subject 'I' is supplied by the verb's required agent; there is no Pāli word for 'I' here.",
  "register": "narrator-as-Ānanda, formal sutta opening",
  "scope": ["mn10:1.1"]
}
```

The **tension field is load-bearing**. Every tooltip, anchor, relation, and ghost in the phase exists to *resolve a named tension*. If no tension is articulable, the phase is decorative and should be left alone.

### 2.2 Evidence bundle

Curated, not raw. Decision-grade signal.

```json
{
  "phaseId": "phase-a",
  "providers": ["sc-dictionary-full", "dpd", "sc-bilara-variants", "sc-suttaplex"],
  "usableCitations": [
    {
      "id": "cite:dpd:dpd:18054",
      "lemma": "eva",
      "excerpt": "eva [ind]: indeed; really; certainly; absolutely",
      "decisionRelevance": "supports the contextually-felt 'indeed' reading of evaṁ when used as an emphatic narrative opener"
    },
    {
      "id": "cite:dpd:dpd:53164",
      "lemma": "me",
      "excerpt": "me [pron]: by me",
      "decisionRelevance": "primary attestation that 'me' here is oblique-agent in a passive construction"
    }
  ],
  "parallels": [
    { "workId": "dn22", "type": "full", "title": "Mahāsatipaṭṭhānasutta", "note": "long-discourse parallel" }
  ],
  "variants": [],
  "gaps": [
    "SC dictionary_full entries low-information for this phase (raw payload only)",
    "VRI Aṭṭhakathā commentary not yet wired (commit C deferred)"
  ]
}
```

**Why excerpts inline (not just IDs):** the gate-check ("does this gloss have a citation?") must be semantic, not syntactic. Without the excerpt, the curator can't tell whether the citation actually supports the gloss. Inline excerpts close the audit loop in one pass.

### 2.3 Alignment scaffold

Before any tooltips, decide the bridge:

```
evaṁ     → Thus
me       → by me   ⟶   rendered as English subject "I" via Pāli oblique-agent convention
sutaṁ    → heard
[ghost]  → "have"  ⟶   ghostKind: auxiliary_from_english_grammar; required by English perfect tense
[reorder] me sutaṁ → I have heard
```

Every English token visible to the reader maps back to *something* — a Pāli word, a Pāli case-ending, a grammatical requirement, or an interpretive choice.

### 2.4 Epistemic classification table

Every annotation in the phase carries one of these basis tags:

| Basis | When to use | `epistemicBasis` value |
|---|---|---|
| **Lexical** | Gloss derives from a dictionary entry | `'lexical'` |
| **Morphological** | Claim follows from Pāli grammar / DPD POS | `'etymological'` or unset with explanatory `nuance` |
| **Translation-supplied** | English added for English grammar; no Pāli source | (no epistemicBasis — ghost or `notes` field) |
| **Interpretive** | Curator's reading; not a source claim | (no epistemicBasis — `nuance` or `notes` field) |
| **Commentarial** | Backed by Aṭṭhakathā or a commentary citation | `'commentarial'` |
| **Contextual** | Disambiguated by surrounding sutta context | `'contextual'` |
| **Comparative** | Parallel-passage agreement (Pāli ↔ Skt ↔ Chinese) | `'comparative'` |

The tooltip voice must not blend these. A reader looking at "[Past participle] Marks completed action" should be able to ask "what kind of claim is this?" and get *morphological*, not "dictionary + grammar + tradition + your interpretation in a single beige paste."

### 2.5 Curation log entry

One markdown file per phase under `docs/sutta-studio/curation/phase-<id>.md`. Captures **why** the packet looks the way it does — the kind of context that rots out of git commit messages.

```markdown
# Phase-a — curation log

**Date:** 2026-05-11
**Curator:** Adi + assistant
**Commit:** <hash>
**Pāli:** Evaṁ me sutaṁ
**Readable:** Thus have I heard

## Phase brief
(copy of §2.1)

## Decisions

- **Render 'me' as English subject 'I' despite oblique Pāli form.**
  Reason: English idiom requires subject position; the tooltip preserves Pāli structure with `[Genitive/Agent]` dual-register.
  Evidence: `cite:dpd:dpd:53164` ("by me"), `cite:dpd:dpd:53165` ("to me; for me").
  Tension resolved: §phaseBrief.tension item 1.

- **Mark 'have' as ghost auxiliary.**
  Reason: No direct Pāli token; required by English perfect rendering of past participle `sutaṁ`.
  GhostKind: `auxiliary` (per FEATURES.md §2.3 expanded set).
  Evidence: morphological — `sutaṁ` is participle (DPD `cite:dpd:dpd:63769`).

## Open questions
- Should `Evaṁ me sutaṁ` get a cross-sutta refrain marker once we curate other sutta openings?
- Renderer behaviour question: should ghost auxiliaries render at lower opacity than ghost articles?

## Schema/UI tensions surfaced (extracted, not implemented)
- (link to follow-up issue if filed)
```

---

## 3. Three Gates

These are quality controls. A phase does not pass to the diff step until all three gates clear.

### 3.1 Evidence Gate

A phase cannot be curated until **every Sense, Relation, MorphHint, and Compound claim** has at least one of:

- a dictionary citation,
- a morphology citation,
- a known grammatical rule (named in the curation log),
- or a manual note explicitly marked as `curator inference`.

This avoids *"pretty but ungrounded"* packets. Particularly forbidden: assigning `epistemicBasis: 'lexical'` without a `sourceCitationIds` entry that resolves to a real citation.

### 3.2 Ghost Gate

Every `EnglishToken.isGhost: true` must answer: **why is this English word here?**

Allowed `GhostKind` values (per FEATURES.md §2.3, expanded set):
- `article` — "the", "a"
- `copula` — "is", "are", "was"
- `auxiliary` — "have", "will", "do" (modal/perfect/future)
- `pronoun_from_verb` — "I" supplied by 1sg verb ending
- `preposition_from_case` — "at"/"in"/"by" supplied by locative/instrumental case
- `punctuation` — commas/quotes added for English readability
- `quote_marker` — `iti` / `ti` bracket equivalents
- `interpretive` — translator's expansion
- `required` — catch-all (use only when none of the above fits)

`required` is **discouraged as the default**. If the curator can name a more specific kind, they should.

### 3.3 Affordance Gate

Every UI affordance (anchor, refrain, relation, layout block, ripple) must justify itself by answering:

1. **Does this help the reader cross from Pāli to English?**
2. **Does this teach a reusable pattern?**
3. **Does this clutter the line?** (negative — affordances that clutter without teaching are vetoed)

Particularly:
- `isAnchor: true` — **at most one per phase**. If you can't pick, the phase is probably too big.
- `refrainId` — must appear in **≥2 phases** to count as a refrain. Local-to-one-phase rhythm is not a refrain.
- New `relation.type` values — high bar. The 4-color palette (ownership/direction/location/action) is one of the most legible parts of the UI; do not dilute.

---

### 3.4 Plain-Register Check (tooltip prose)

Every tooltip's **plain prose** (the part that shows when grammar-terms is off) must stand alone and teach the bridge without requiring the technical chip. Format prescription for the dual-register layout lives in `FEATURES.md §6`; this gate is the *writing discipline* applied during curation steps 5 (translation bridge) and 6 (pedagogy).

**Earlier drafts used a forbidden-words list** (adverbial, deictic, cataphoric, niggahīta, neuter nom/acc singular, declensional ending, past participle, genitive, oblique, …). The list was fragile — it scales poorly to new phases, pattern-matches words instead of concepts, forces euphemism, has arbitrary cutoffs, and risks **mode collapse** (writers avoid the *word* rather than teach the *concept*).

**Replaced with three criteria.** Apply them per-tooltip, not globally.

#### Criterion 1 — Reader profile (default)

Write the plain prose for a single, stated default reader. The current default:

> A thoughtful adult, no Pāli training, possibly familiar with popular Buddhism but not with Indic linguistics. Reading carefully but not academically.

If this reader would stumble on a word in *this* sentence, replace it — even if the same word is fine in another sentence. Decisions are *contextual*, not lexical.

Other readers (Pāli student, Sanskrit scholar, linguist) are served through the structured registers below, not by reshaping the default prose.

#### Criterion 2 — Pay-rent rule

For every technical term you reach for, answer:

1. **What concept does this label that the reader needs precision about?**
2. **Why is precision needed here?**

If you can't answer both, the term **doesn't pay rent** — replace with plain English.

If you can answer both, the term pays rent — keep it **and** gloss it in the same sentence so the reader doesn't depend on prior knowledge of the term.

Example (pays rent): "The -ṁ is the **accusative** ending — Pāli uses this case where English uses 'at' or 'on' for time." The reader meets *accusative* with a working definition; it's worth the precision because the same ending recurs across many phases.

Example (doesn't pay rent): "The genitive form 'me' functions adverbially." Both technical terms; neither does work the plain English "the form 'of me' here works like 'by me'" can't carry.

#### Criterion 3 — Register layering

The protocol commits to three registers per tooltip, each with its own job:

| Register | Job | When to use technical terms |
|---|---|---|
| **Plain prose** (default visible) | Teach the bridge for the default reader | Only when the term pays rent + is glossed in the same sentence |
| **Grammar chip** (toggle-revealed) | Surface the structural label for readers who want it | Always allowed — that's the chip's whole job |
| **Audit modal** (citation excerpts) | Show the upstream source verbatim | Whatever the provider says |

Plain prose doing the work of all three registers is the failure mode. Don't make the default reader pay for the scholar's precision.

#### Status of the old forbidden-words list

Preserved as **diagnostic examples** of the failure tone, not as a rule. If the curator finds themselves reaching for one of those words in plain prose, that's a *signal* to pause and check whether plain English carries the load. Sometimes it does (drop the word). Sometimes the term pays rent (keep it, gloss it). Either is acceptable; the answer is contextual.

#### Quick self-check before approving a tooltip

Ask, in order:

1. **Read aloud.** Does the plain prose make sense to the default reader without the bracketed chip?
2. **Re-read the technical terms.** For each, can you answer the two pay-rent questions?
3. **Layer check.** Is anything in plain prose that would be better in the grammar chip or the audit modal?

If all three pass, the tooltip is in register.

---

## 4. Role locks (when single-agent vs multi-agent)

This protocol runs in **single-agent mode by default**. The same instance produces all artifacts and writes the packet diff. The human reviews at the gate.

**If/when this graduates to multi-agent** (per the angels infrastructure in `TemporalCoordination/`), the role locks below apply. Documenting them here so the boundary is articulable even before multi-agent runs land.

| Role | Can edit | Cannot edit | Purpose |
|---|---|---|---|
| **Curator** | `components/sutta-studio/demoPacket.json`, `docs/sutta-studio/curation/**` | `services/**`, `components/**/*.tsx` (except fixtures) | Apply this protocol phase by phase |
| **Builder** | `types/suttaStudio.ts`, `services/**`, `components/sutta-studio/**` (renderer code), `tests/**` | `components/sutta-studio/demoPacket.json` | Schema, compiler, UI affordances, validation |
| **Observer** | `.runs/<run-id>/**` only (event ledger + run reports) | everything else | Summarise progress, detect stuckness, flag role-bleed |
| **Human** | by direction (curator/builder), directly for protocol amendments | — | Meaning, taste, epistemic boundaries, approval |

**Failure mode to prevent:** the curator notices a schema limitation while curating and is tempted to extend `types/suttaStudio.ts` mid-phase. Wrong move. Curator captures the limitation in §12 issue-extraction; builder addresses it in a separate commit. The packet diff stays a packet diff.

---

## 5. Human-gate moments

Not every step needs human approval. The human is needed at moments where **meaning, values, or irreversible commitments** enter. Below: where the gate is, what gets asked.

| Gate | What's asked | Why human |
|---|---|---|
| **Semantic translation choice** | Approve "bhikkhus" vs "monks", "emptiness" vs "voidness", "knows" vs "discerns" | Pedagogy and doctrine, not lookup |
| **Ghost-word rationale** | Approve specific `GhostKind` when ambiguous (auxiliary vs interpretive) | Whether English additions reveal or distort |
| **Epistemic classification** | Distinguish commentarial vs interpretive vs contextual at edge cases | Authority claims must not blur |
| **Schema semantics change** | Approve any new field added to `types/suttaStudio.ts` driven by phase curation | Cheap to add, expensive to unwind |
| **Affordance taste** | Approve anchor/refrain/relation choices when not obviously forced | Contemplative reading vs over-annotation |
| **Commentarial use** | Approve Aṭṭhakathā citations being used as gloss support | Don't laundry tradition into fact |
| **Commit ritual** | One commit per phase? Batch? Push? PR? | Human chooses cadence |
| **Protocol amendment** | Any change to *this document* | Process changes are ratified by you |

Not human-needed: running lookups, gathering citations, drafting the bundle, drafting the diff, running tests, formatting curation log. All of those can be done by the curator agent and presented for review.

---

## 6. Batching

For the first 15 phases of MN10, the recommended cadence is:

| Batch | Phases | Purpose |
|---|---|---|
| **1** | phase-a only | Establishes the rhythm; protocol shakedown |
| **2** | phase-b, phase-c, phase-d | Tests place-name + person + title handling |
| **3** | phase-e through phase-h | Tests verbs + particles in instructional voice |
| **4** | phase-i through phase-o | Tests compounds + refrains + longer clauses |

After batch 4, re-evaluate whether the protocol needs revision before doing 16-51. Real friction from 15 phases tells us what's actually missing.

---

## 7. Machine-observability (deferred, sketched)

When this protocol stabilises, multi-agent observability becomes useful. Three levels, escalate only when needed:

| Level | What | When to adopt |
|---|---|---|
| **L1 — log-file watching** | Wrap curator session in `script(1)`; observer reads `tail` | When a second human or agent wants to watch from a different terminal |
| **L2 — tmux panes + capture-pane** | Named sessions per role; cross-pane inspection | When builder and curator have genuinely independent work queues |
| **L3 — event ledger** (`.runs/<run-id>/events.jsonl`) | Structured append-only events; observer watches events not noise | After L2 has run for several phases and event vocabulary stabilises |

A `sutta_curation_conductor` angel matching the `TemporalCoordination/angels/` shape would live at L3. Its job is not to code or curate — it summarises progress, detects stuckness, flags role-bleed. Its config and gate definitions live in this protocol; the script implementation comes later.

**Why deferred:** the protocol matters more than the infrastructure. Lock the protocol from one phase of real friction before building orchestration around it. Per the user-memory entry on "earn-the-externalization": iterate in the source repo before pushing skill drafts to expansion marketplaces.

---

## 8. What goes in the curation log vs what goes elsewhere

| Where | What lives there |
|---|---|
| `docs/sutta-studio/curation/phase-<id>.md` | Phase brief, decisions made, evidence cited, open questions, schema/UI tensions surfaced (extracted, not implemented). One file per phase. |
| Commit message | What changed (the packet diff), why now, evidence summary. **Not** the curation reasoning — that lives in the log. |
| `FEATURES.md` | When a new schema field actually lands — add a row in §1 and §3 and §7. |
| `SUTTA-008` ADR | If a curation lesson causes us to amend ratified architecture decisions. Otherwise no. |
| Open issues / new ADRs | Schema/UI tensions that warrant follow-up but didn't block the phase. |
| Inline code comments | Almost never. The curation log + ADR + FEATURES cover the why; comments rot. |

---

## 9. When the protocol fails

The protocol will fail. When it does, the failure mode tells us what to amend:

| Symptom | Likely cause | Remedy |
|---|---|---|
| Phase brief feels forced or empty | Phase is decorative; doesn't have a real tension | Leave the phase alone or recombine with neighbours |
| Evidence bundle is huge but the diff is tiny | Over-lookup; not every word needs every provider | Trim providers per phase based on word class |
| Diff balloons during review | Pedagogical pass leaked into the diff | Re-run with the affordance gate questions explicitly |
| Curation log entry is just a restatement of the diff | The "why" wasn't captured; the curator was on autopilot | Slow down; the log is where the principal value of the protocol accrues |
| You keep wanting to amend `types/suttaStudio.ts` mid-phase | Schema is genuinely insufficient | Stop curation, file an issue, fix schema, resume |

---

## 10. Open protocol questions

Captured here so the next refinement cycle has a target. Not currently blocking.

1. **Curation log format**: Markdown is portable but harder to query. JSON would let an observer agent index decisions across phases. Defer until L3 observability lands.
2. **Cross-phase decisions**: When phase-a decides "render 'me' as English 'I' via oblique-agent convention," that decision *should* propagate to phase-b/c/d when they have similar constructions. How? For now, the log entries cross-reference manually. A "decision precedent" index could land later.
3. **Curator inference marker**: The Evidence Gate allows "manual note marked as `curator inference`" — but the schema has no first-class field for this. Currently we'd put it in `Sense.notes` with the marker written into the prose. A `Sense.curatorInferred?: boolean` flag might be cleaner. Decide after phase-a.
4. **Multi-curator attribution**: Eventually Aditya might curate alongside (or instead of) the assistant. The log says `"curator: Adi + assistant"` — fine for now, but if curators diverge on a decision the record needs to capture that.

---

*This protocol is ratified pending phase-a's outcome. Amendments after phase-a (and after each subsequent batch) are expected and welcome.*

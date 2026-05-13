# Sutta Studio Features — Catalogue and Schema Reference

> **Status:** current implementation — bilingual (Pāli ↔ English) MVP. Last updated 2026-05-11.
> **Source of truth for code:** `types/suttaStudio.ts`.
> **Historical context:** `docs/sutta-studio/IR.md` (predates several fields; do not treat as current).
> **Design rationale:** `docs/sutta-studio/PALI_ENGLISH_DESIGN.md` (sections 1–3 explain *why* of existing features; this file is *what + how + back-compat*).
> **Architecture beyond bilingual:** `docs/sutta-studio/TEXT_GRAPH.md` (witness/expression/claim model — design, not yet implemented).
> **Multi-language vision:** `docs/sutta-studio/POLYGLOT.md` (per-language decomposition lenses for Sanskrit, Chinese, Tibetan — charter, requires scholar collaboration).

## Manifesto

> A study reader should not collapse transmission into immediacy. It should let the user feel the bridge: word → grammar → phrase → translation → tradition → witness → history.

Scripture is not a finished object handed down from the past. It is a **living transmission object** — uttered, remembered, recited, supported, edited, translated, copied, printed, digitized, aligned, annotated, and read. Every feature in this catalogue exists to preserve some part of that chain visibly to the reader. Features that hide the chain (collapsing translator choices into "the meaning", flattening grammatical inflection into English word order, presenting variant readings as if there were one canonical text) work against the design.

This document is the single answer to:
*"What features does Sutta Studio support, and how do I extend them without breaking the world?"*

---

## 0. The Three-Layer Mental Model

The current schema entangles three conceptually distinct layers. Documenting them separately here prevents future extensions from making the entanglement worse.

| Layer | What it captures | Examples in current schema |
|---|---|---|
| **L1 · Linguistic** | Pure facts about the source text — morphology, syntax, sandhi, compound type, verb form. Independent of any reader. | `WordSegment.type`, `MorphHint.case`, `Relation.type` |
| **L2 · Bridge** | Source-to-target alignment. Which English token came from which Pali unit. Which idea moved across languages. | `EnglishToken.linkedPaliId`, `EnglishToken.linkedSegmentId`, `Sense.ripples` |
| **L3 · Pedagogy** | How the renderer should display the above for a learner. Colors, opacity, anchors, ghost styles. | `PaliWord.wordClass`, `PaliWord.isAnchor`, `EnglishToken.ghostKind`, `renderDefaults.ghostOpacity` |

**Why this matters:** several existing fields conflate layers. `wordClass: 'vocative'` is half-linguistic (the word IS in vocative case) and half-pedagogy (the renderer colors it yellow). `Relation.label` is half-linguistic (this IS an action relation) and half-pedagogy ("Heard BY" is a chosen English phrasing). Future fields should be tagged with their layer at design time. When in doubt, prefer L1 (raw fact) and let renderers compute L3.

---

## 1. Feature Catalogue

Each feature uses this template:

> **Layer:** L1 / L2 / L3 / cross-cutting
> **Schema fields:** TS path
> **Renderer behavior:** what the UI does with it
> **Example JSON:** minimal snippet
> **Common mistakes:** failure modes
> **Back-compat status:** stable / additive-safe / breaking-if-changed

---

### 1.1 Word Segmentation (root / prefix / suffix / stem)

- **Layer:** L1
- **Schema fields:** `WordSegment.type: 'root' | 'suffix' | 'prefix' | 'stem'`, `WordSegment.text`, `WordSegment.id`
- **Renderer behavior:** segments render in sequence forming the surface word; type may drive subtle styling (e.g., dim the suffix). Hovering individual segments fires the focus state.
- **Example:**
  ```json
  {
    "id": "a3",
    "wordClass": "content",
    "segments": [
      { "id": "a3s1", "text": "su",  "type": "root" },
      { "id": "a3s2", "text": "ta",  "type": "suffix" },
      { "id": "a3s3", "text": "ṁ",   "type": "suffix" }
    ]
  }
  ```
- **Common mistakes:**
  - Splitting *every* word into segments — short function words (`kho`, `me`, `vā`) often have a single `stem` segment and that's correct.
  - Marking the verbal root as `stem` instead of `root`. The renderer may treat them identically today, but L1 distinction matters for any future morphology UI.
- **Back-compat:** stable. The four-value enum is unlikely to grow without a major version bump.

---

### 1.2 Morphological hints (case + number)

- **Layer:** L1
- **Schema fields:** `WordSegment.morph: MorphHint`
  ```ts
  type MorphHint = {
    case?: 'gen' | 'dat' | 'loc' | 'ins' | 'acc' | 'nom' | 'voc';
    number?: 'sg' | 'pl';
    note?: string;
  };
  ```
- **Renderer behavior:** **currently unused for display.** The data sits there for future inflection-aware UI (e.g., a "show me all locative nouns in this phase" filter). Tooltips re-state morphology in prose for now.
- **Example:**
  ```json
  { "id": "p1s2", "text": "ave", "type": "suffix",
    "morph": { "case": "voc", "number": "pl" } }
  ```
- **Common mistakes:**
  - Putting morphology in `tooltips` and skipping `morph`. The tooltip is L3 prose; `morph` is L1 fact. Both should be present.
  - Forgetting that Pali ablative often surfaces with the same form as genitive/dative — record the *function* in `morph`, not the surface form.
- **Back-compat:** additive-safe. Proposed extensions (gender, ablative, verb fields) are covered in §2.1.

---

### 1.3 Grammatical relations (4 colored types)

- **Layer:** L1 (the relation IS) + L3 (the color, the English label)
- **Schema fields:** `WordSegment.relation: Relation`
  ```ts
  type Relation = {
    targetWordId?: string;     // word-to-word
    targetSegmentId?: string;  // segment-to-segment (for compounds)
    type: 'ownership' | 'direction' | 'location' | 'action';
    label: string;             // human-readable, e.g. "Heard BY"
    status?: 'confirmed' | 'pending';
  };
  ```
- **Grammar palette (UI mapping):**

  | type | English semantic | Color |
  |---|---|---|
  | `ownership` | OF | gold |
  | `direction` | TO / FOR | blue |
  | `location` | IN / AT | green |
  | `action` | BY / WITH | orange |

- **Renderer behavior:** draws an SVG arrow (Xarrow) from the source segment/word to the target. Arrow is dim by default, brightens on hover. Direction inferred from element positions (arc up if same row, straight if not).
- **Example:**
  ```json
  { "id": "a2s1", "text": "me", "type": "stem",
    "relation": { "targetWordId": "a3", "type": "action", "label": "Heard BY" } }
  ```
- **Common mistakes:**
  - Missing target — arrow won't render, no visible warning.
  - Using all four types for everything. **Choose the dominant grammatical link.** A word can have only one outgoing relation today.
  - Putting English semantics into `type` ("OF", "TO") instead of `label`. `type` is L1 (the kind of relation); `label` is L3 (how to phrase it).
- **Back-compat:** additive-safe at the value level. Adding a new `type` value would be a breaking change for older renderers (they'd skip rendering, console-warn). Bump version if added.

#### Arrow-earning rule (when to add a relation)

Ratified after batch-3 curation surfaced this question 3 times. **A relation earns its arrow when the Pāli case-marker does work English doesn't have an analog for.** If the same role exists transparently in English (via word order or a direct preposition), the arrow adds clutter without pedagogical lift.

**Earns the arrow** (curated examples across batches 1-3):
- `me sutaṁ` — genitive functioning as agent of a passive verb (phase-a). English uses 'by' for the same role; Pāli uses the genitive case. The arrow teaches the case-quirk.
- `samayaṁ` — accusative-of-time-when (phase-b). English uses 'at/on' as a preposition; Pāli marks time on the noun itself.
- `kurūsu viharati` — locative of social-membership (phase-c). "Among the Kurus" in English; Pāli stacks the locative onto the noun.
- `kurūnaṁ nigamo` — genitive of possession (phase-d). The 'of' relationship is universal but Pāli's gen-pl ending packs it; arrow earns it as a recurring pattern.
- `bhagavato paccassosuṁ` — genitive functioning as dative recipient of speech-verb (phase-g). Pāli quirk: verbs of speaking take the genitive where English uses 'to'. Arrow earns it.

**Does NOT earn the arrow** (curated cases where relations were tried then dropped):
- Subject of an active-voice verb (phase-e bhagavā, phase-g bhikkhū, phase-h Bhagavā). The role is universal across English and Pāli; word order alone communicates it.
- Direct object of a transitive verb (phase-e bhikkhū, phase-h etad). Pāli marks with accusative; English marks with word order. Universal role, no quirk to teach.

**Rule of thumb:** if you can write the relation label as a plain English preposition (BY, AT, IN, OF, TO/FOR) AND that preposition reveals a Pāli morphological choice that English doesn't make, the arrow earns it. If the label reads as "subject", "object", "predicate", or otherwise names a universal grammatical role, drop the relation — the linkedSegmentId on the English row already cross-highlights the role.

**Practical implication:** the schema isn't constrained — any segment may carry a relation. But the curator's discipline is to use the affordance for *case-quirks pedagogy*, not for universal grammar. The 4-color palette stays uncluttered; arrows mean "look here, English doesn't do this."

---

### 1.4 Polysemy (multiple senses per word/segment)

- **Layer:** L2 (each sense is a bridge to a possible English) + L3 (cycle-on-click is pedagogy)
- **Schema fields:** `PaliWord.senses: Sense[]`, `WordSegment.senses?: Sense[]`
  ```ts
  type Sense = {
    id?: string;
    english: string;
    nuance: string;
    notes?: string;
    citationIds?: string[];
    ripples?: Record<string, string>;  // ghostId -> replacement text
  };
  ```
- **Renderer behavior:** displays the first sense by default; clicking the word/segment cycles through alternatives. Word-level senses and segment-level senses can both exist; segment-level wins for compound parts that have distinct meanings (e.g., *Sati-paṭṭhāna* → "Mindfulness" + "Foundation").
- **Example:**
  ```json
  "senses": [
    { "english": "heard",                "nuance": "Past participle" },
    { "english": "what was heard",       "nuance": "The teaching itself" },
    { "english": "that which has been received", "nuance": "Orally transmitted" }
  ]
  ```
- **Common mistakes:**
  - One sense for everything. The whole point of the feature is to surface translator choices; if a word has only one sense in your packet you've already chosen for the reader.
  - Sense order matters — first one shown by default; put the most contextual/idiomatic first.
  - Function words (`kho`, `vā`, `iti`) often genuinely have 1-2 senses; that's fine.
- **Back-compat:** additive-safe.

---

### 1.5 Refrains (shared-color recurring formulas)

- **Layer:** L3
- **Schema fields:** `PaliWord.refrainId?: string`
- **Renderer behavior:** in **study mode**, words sharing a `refrainId` render in the same accent color. Visual rhythm cue for repeating formulas (the 4-fold breath pattern, the satipaṭṭhāna closing refrain, "evameva kho bhikkhave bhikkhu" used N times).
- **Example:**
  ```json
  { "id": "aw3", "wordClass": "content", "refrainId": "breath-formula", ... }
  ```
- **Renderer notes:** kept off by default in non-study mode to avoid visual clutter. `studyToggleDefault` in `renderDefaults` controls initial state.
- **Common mistakes:**
  - Using a unique `refrainId` per phase — defeats the purpose. Reuse the same string across all instances.
  - Using `refrainId` for grammatical similarity rather than recurring textual formulas. Two locative nouns are not a refrain. Two repetitions of "evameva kho bhikkhave bhikkhu" are.
- **Back-compat:** additive-safe.

---

### 1.6 Ghost tokens (English glue without Pali source)

- **Layer:** L2 (the bridge admits some English has no Pali) + L3 (the rendering as faded)
- **Schema fields:** `EnglishToken.isGhost`, `EnglishToken.ghostKind`, `EnglishToken.label`
  ```ts
  type EnglishToken = {
    id: string;
    label?: string;                      // for ghosts
    linkedSegmentId?: string;            // segment-level link (preferred for compounds)
    linkedPaliId?: string;               // word-level link (fallback)
    isGhost?: boolean;
    ghostKind?: 'required' | 'interpretive';
  };
  ```
- **Renderer behavior:** ghost tokens render at reduced opacity (`renderDefaults.ghostOpacity`, default 0.3). `required` ghosts are necessary for English grammar (auxiliaries, articles); `interpretive` ghosts reflect the translator's expansion choice.
- **Example:**
  ```json
  { "id": "ea2g", "label": "have", "isGhost": true, "ghostKind": "required" }
  ```
- **Common mistakes:**
  - Forgetting that **a verb form can supply a pronoun ghost**: `assasāmī` (1sg) → English needs "I" → that "I" is a ghost token, technically `pronoun_from_verb` (proposed expansion §2.3). Today people mark it as `required`, which is true but loses information.
  - Marking quote markers (`'`, `"`) and case-derived prepositions ("at", "for") as plain `required`. They're all genuinely required, but **why** they're required differs.
- **Back-compat:** the proposed `ghostKind` expansion in §2.3 is purely additive (new enum values). Old renderers see new kinds as "ghost" generally and render at default opacity.

---

### 1.7 Anchors (semantic centerpiece of a phase)

- **Layer:** L3
- **Schema fields:** `PaliWord.isAnchor?: boolean`
- **Renderer behavior:** the anchor word may receive emphasis styling (bigger, bolder, or accent color). Useful for phases with one verb that drives the whole instruction (`pajānāti` "knows" in the breath formula, `viharati` "abides" in the satipaṭṭhāna refrain).
- **Example:**
  ```json
  { "id": "p7", "wordClass": "content", "isAnchor": true, ... }
  ```
- **Common mistakes:**
  - Marking multiple anchors per phase — defeats the point. **One per phase.** If you can't pick, the phase is probably too big and should be split.
  - Marking function words as anchors. Anchors are semantic verbs/nouns, not particles.
- **Back-compat:** additive-safe.

---

### 1.8 Layered tooltips (per-segment hover text)

- **Layer:** L3
- **Schema fields:** `WordSegment.tooltips?: string[]`, `WordSegment.tooltip?: string` (legacy single), `WordSegment.tooltipsBySense?: Record<string, string>` (sense-specific, **never used in current demo**)
- **Renderer behavior:** on hover, displays each tooltip line. House style is **dual register** — formal grammar in brackets + accessible explanation:
  > [Past participle] Marks completed action: "heard"
- **Example:**
  ```json
  { "id": "a3s2", "text": "ta", "type": "suffix",
    "tooltips": [
      "[Past participle] Marks completed action: \"heard\""
    ] }
  ```
- **Common mistakes:**
  - Single line of grammar with no explanation. Loses the "jargon-with-explanation" pedagogy.
  - Tooltips that just restate the English gloss. Tooltips should explain the *Pali grammar*; the gloss is in `Sense.english`.
- **Back-compat:** stable.

---

### 1.9 Citation IDs (link to canonical references)

- **Layer:** L2 (cross-reference) + L1 (provenance of a sense)
- **Schema fields:** `Sense.citationIds?: string[]`, `DeepLoomPacket.citations: Citation[]`
  ```ts
  type Citation = {
    id: string;
    kind?: 'sutta' | 'commentary' | 'dictionary' | 'parallel';
    short: string;       // "MN 10:4.4" or "PED s.v. assasati"
    url?: string;
    note?: string;
  };
  ```
- **Renderer behavior:** **never used in current demo.** Renderer would surface citation badges next to senses, click → modal with reference details.
- **Example:**
  ```json
  // packet.citations
  [{ "id": "ped-assasati", "kind": "dictionary", "short": "PED s.v. assasati",
     "url": "https://dsal.uchicago.edu/dictionaries/pali/" }]
  // sense
  { "english": "breathes in", "nuance": "Active voice", "citationIds": ["ped-assasati"] }
  ```
- **Back-compat:** additive-safe; never used means renderer hasn't shipped UI for it. Adding UI doesn't break existing data.

---

### 1.10 Ripples (sense changes ghost text)

- **Layer:** L2 (different bridges depending on sense choice)
- **Schema fields:** `Sense.ripples?: Record<string, string>` (ghost token id → replacement label)
- **Renderer behavior:** **never used in current demo.** When a user cycles to a non-default sense, listed ghost tokens swap their `label`. Example: cycling *Sati* from "Mindfulness" to "Memory" might ripple a downstream ghost "[meditation]" → "[recollection]".
- **Example:**
  ```json
  "senses": [
    { "english": "Mindfulness", "nuance": "Standard rendering",
      "ripples": { "ghost-meditation": "meditation" } },
    { "english": "Memory",      "nuance": "Older sense",
      "ripples": { "ghost-meditation": "recollection" } }
  ]
  ```
- **Common mistakes:**
  - Ripples only fire when the user *cycles*, so default sense's ripples may be a no-op. Test both default and alternate states.
- **Back-compat:** additive-safe; underused but in schema.

---

### 1.11 Word class colors (content / function / vocative)

- **Layer:** L1 (which class) + L3 (which color)
- **Schema fields:** `PaliWord.wordClass?: 'content' | 'function' | 'vocative'`
- **Renderer behavior:** content = green, function = white, vocative = yellow.
- **Common mistakes:**
  - Marking pronouns as `function` vs `content` — they straddle. Today pronouns are usually `function`.
  - Vocative is rare but distinct (the addressee, e.g., "bhikkhave!"). Use sparingly.
- **Back-compat:** stable.

---

### 1.12 Layout blocks (visual grouping of words)

- **Layer:** L3
- **Schema fields:** `PhaseView.layoutBlocks?: string[][]` (arrays of word IDs)
- **Renderer behavior:** wraps groups of words on the same row, with English tokens beneath each block. If absent, all words form one block.
- **Example:**
  ```json
  "layoutBlocks": [["p1", "p2", "p3"], ["p4"]]
  ```
- **Common mistakes:**
  - Including IDs that aren't in `paliWords` — silently ignored.
  - Over-blocking — small clauses don't need it.
- **Back-compat:** stable.

---

### 1.13 Validation issues (compiler warnings/errors)

- **Layer:** cross-cutting
- **Schema fields:** `compiler.validationIssues: ValidationIssue[]`
  ```ts
  type ValidationIssue = {
    level: 'warn' | 'error';
    code: string;
    message: string;
    phaseId?: string;
    wordId?: string;
    segmentIndex?: number;
    tokenId?: string;
  };
  ```
- **Renderer behavior:** logged to console; surfaced in debug mode. Live pipeline emits these.
- **Back-compat:** stable.

---

### 1.14 Sense-specific tooltips

- **Layer:** L3
- **Schema fields:** `WordSegment.tooltipsBySense?: Record<string, string>` (sense id → tooltip text)
- **Renderer behavior:** **never used in current demo.** When a user cycles to a particular sense, hovering the segment shows a sense-specific tooltip.
- **Example:**
  ```json
  { "id": "p4s1", "text": "Sati", "type": "root",
    "tooltipsBySense": {
      "sati.mindfulness": "Awareness of the present moment",
      "sati.memory":      "Recall of teachings (older sense)"
    },
    "senses": [
      { "id": "sati.mindfulness", "english": "Mindfulness", "nuance": "..." },
      { "id": "sati.memory",      "english": "Memory",      "nuance": "..." }
    ] }
  ```
- **Back-compat:** additive-safe.

---

## 2. Proposed Extensions (not yet in schema)

Each proposal includes the layer it belongs to and a back-compat assessment.

### 2.1 Verb morphology fields

- **Layer:** L1
- **Need:** Pali verbs carry person, tense/aspect, mood, voice, and form (finite/participle/gerund/infinitive/absolutive). The current `MorphHint` only models nouns.
- **Schema delta:**
  ```ts
  type MorphHint = {
    // existing
    case?: 'nom' | 'acc' | 'ins' | 'dat' | 'abl' | 'gen' | 'loc' | 'voc';   // + 'abl' added
    number?: 'sg' | 'du' | 'pl';                                            // + 'du' (dual, rare in Pali but real)
    gender?: 'm' | 'f' | 'n';                                               // new
    note?: string;
    // new — verbal morphology
    person?: '1' | '2' | '3';
    tenseAspect?: 'present' | 'aorist' | 'future' | 'perfect' | 'imperfect' | 'participle';
    mood?: 'indicative' | 'imperative' | 'optative' | 'conditional';
    voice?: 'active' | 'middle' | 'passive' | 'causative';
    form?: 'finite' | 'participle' | 'gerund' | 'infinitive' | 'absolutive';
  };
  ```
- **Renderer:** initially no UI change. Tooltips can quote these fields. Future: filter "show me all aorists" or "show all 1sg verbs".
- **Common mistakes (anticipated):**
  - Conflating `tenseAspect` (linguistic) with English tense translation choice (translator's choice). Record the Pali fact; let the translator gloss it.
  - Marking absolutives as both `form: 'absolutive'` and `tenseAspect: 'past'`. The absolutive is morphologically a non-finite form expressing prior action — record `form: 'absolutive'` and leave `tenseAspect` unset.
- **Back-compat:** additive-safe (all new fields optional).

### 2.2 Compound type classification

- **Layer:** L1
- **Need:** Pali (and Sanskrit) compounds have classical types. *Kāyānupassī* is a tappurisa (dependent: "observer-of-body"); *cakkhusota* would be dvandva (and: "eye-and-ear"); *bahussuta* is bahubbīhi (possessive: "much-heard one"). Conflating them changes phenomenological reading.
- **Schema delta:**
  ```ts
  type CompoundType =
    | 'tappurisa'       // dependent (case-relation): kāy[a]-anupassī = "observer of body"
    | 'kammadhāraya'    // descriptive (apposition): mahā-purisa = "great person"
    | 'dvandva'         // copulative (and): nāma-rūpa = "name and form"
    | 'bahubbīhi'       // possessive (exocentric): bahu-ssuta = "one who has heard much"
    | 'avyayībhāva'     // adverbial: yathā-bala = "according to ability"
    | 'dvigu'           // numerical kammadhāraya: ti-loka = "three worlds"
    ;

  type PaliWord = {
    // existing fields...
    /** When this word is a compound, the classical type. */
    compoundType?: CompoundType;
    /** Optional segment IDs in resolution order: ["a3s1", "a3s2"] */
    compoundSegments?: string[];
  };
  ```
- **Renderer:** badge near the word ("tappurisa") in study mode. Tooltip explains how to read it.
- **Common mistakes (anticipated):**
  - Marking single-morpheme words as compounds. Compounds have ≥2 lexical members.
  - Ambiguity — *kammadhāraya* vs *tappurisa* can be genuinely contested. Use `confidence` (§2.5) when uncertain.
- **Back-compat:** additive-safe.

### 2.3 Expanded ghost kinds

- **Layer:** L2 + L3 (kind affects styling)
- **Need:** `'required' | 'interpretive'` is too coarse. A pronoun supplied by a 1sg verb and an article supplied for English grammar are both "required" but semantically distinct.
- **Schema delta:**
  ```ts
  type GhostKind =
    | 'article'              // "the", "a"
    | 'copula'               // "is", "are"
    | 'auxiliary'            // "have", "will"
    | 'pronoun_from_verb'    // "I" supplied by 1sg ending
    | 'preposition_from_case'// "at" / "in" / "by" supplied by locative/instrumental
    | 'punctuation'          // commas, quotes added for English readability
    | 'quote_marker'         // 'iti' bracket equivalents
    | 'required'             // catch-all when none above fits
    | 'interpretive'         // translator expansion
    ;
  ```
- **Renderer:** can subtly differentiate (different shade of dim, or icon). Old renderers see new kinds and treat as generic ghost.
- **Common mistakes (anticipated):**
  - Marking optional translator additions as `required`. If the English would parse without it, it's `interpretive`.
  - Marking copulas as `auxiliary`. Auxiliary = "have/will/do" (modal/perfect/future); copula = "is/are/was" (linking).
- **Back-compat:** additive-safe (new enum values).

### 2.4 Quote / speech-act spans

- **Layer:** L1 (the source has speech markers) + L2 (English brackets are a bridge choice)
- **Need:** Pali uses `'iti'` / `'ti'` to close direct/indirect speech. Currently rendered as raw quotes in English with no structural marker. Marking the span enables consistent styling and explanation.
- **Schema delta:**
  ```ts
  type Span = {
    id: string;
    kind: 'quoted_speech' | 'cited_phrase' | 'parenthetical';
    startWordId: string;
    endWordId: string;
    note?: string;
  };

  type PhaseView = {
    // existing
    spans?: Span[];
  };
  ```
- **Renderer:** can underline/bracket the span; show a "this is direct speech" hint on hover.
- **Back-compat:** additive-safe.

### 2.5 Confidence + Epistemic basis

- **Layer:** cross-cutting (applies to senses, relations, compound types, etc.)
- **Need:** some glosses are settled (PED + Bodhi + Sujato all agree); some are contested. Some are derived from raw morphology; others from later commentaries; others from sutta context.
- **Schema delta:**
  ```ts
  type EpistemicBasis = 'etymological' | 'commentarial' | 'contextual' | 'lexical' | 'comparative';

  type Sense = {
    // existing
    confidence?: 'high' | 'medium' | 'low';
    epistemicBasis?: EpistemicBasis;
    sourceCitationIds?: string[];   // points into packet.citations
  };

  type Relation = {
    // existing
    confidence?: 'high' | 'medium' | 'low';
    epistemicBasis?: EpistemicBasis;
  };
  ```
- **Renderer:** low-confidence senses dimmed or marked with "?"; basis surfaced in tooltip ("commentarial — Buddhaghosa Pp 240").
- **Common mistakes (anticipated):**
  - Marking everything `high` to look authoritative. The whole point is calibration. Reserve `high` for genuinely uncontested glosses.
  - Conflating `confidence` (how sure we are) with `epistemicBasis` (where we got it). A commentarial gloss can be high confidence (well attested in commentaries) — they're orthogonal.
- **Back-compat:** additive-safe.

### 2.6 Provenance (whole-packet level)

- **Layer:** cross-cutting (provenance of the SOURCE TEXT, not of one gloss)
- **Need:** the 2,500-year chain from "the Buddha said" through Aluvihare → Mahāvihāra → Sixth Council → VRI → SuttaCentral → this packet is currently invisible. Captures epistemic chain of custody.
- **Schema delta:**
  ```ts
  type Provenance = {
    attribution?: {
      speaker?: string;
      audience?: string;
      legendaryDate?: string;
      legendaryPlace?: string;
      confidence?: 'traditional' | 'attested' | 'disputed';
    };
    oralLineage?: {
      school: string;                  // "Theravāda" / "Sarvāstivāda"
      transmissionLanguage: string;    // "Pāli"
      estimatedPeriod?: string;
      method?: string;                 // "bhāṇaka recitation"
    };
    firstWritten?: {
      estimatedDate?: string;
      place?: string;
      medium?: string;                 // "palm leaf"
      citation?: string;
    };
    manuscripts?: Array<{
      id?: string;                     // BDRC URI etc.
      repository?: string;
      estimatedDate?: string;
      script?: string;                 // "Sinhala" / "Burmese" / "Khom"
      digitizer?: string;
      digitizedDate?: string;
      url?: string;
    }>;
    edition?: {
      name: string;                    // "Mahāsaṅgīti Tipiṭaka Buddhavasse 2500"
      year?: string;
      council?: string;
      digitalSource?: string;          // "Vipassana Research Institute"
      license?: string;
    };
    translation?: {
      translator: string;
      year?: string;
      license?: string;
      institution?: string;
      methodology?: string;
    };
    external?: Array<{
      type: 'bdrc' | 'gretil' | 'cbeta' | 'suttacentral' | 'pts' | 'tipitaka.org' | 'other';
      url: string;
      note?: string;
    }>;
    segmentVariants?: Record<string, Array<{
      witness: string;
      reading: string;
      note?: string;
    }>>;
  };

  type DeepLoomPacket = {
    // existing
    provenance?: Provenance;
  };
  ```
- **Renderer:** "About this text" expandable header. Per-segment variant markers when `segmentVariants[segmentId]` non-empty.
- **Back-compat:** additive-safe.

### 2.7 Cross-references (parallel passages — bilingual scope)

- **Layer:** L2
- **Need:** the 4-fold breath formula in MN10:4.9 also appears in MN10:4.10, AN5.114, SN54.1, etc. Surfacing parallels enriches study even within the Pāli canon.
- **Schema delta:**
  ```ts
  type ParallelRef = {
    workId: string;
    segmentId?: string;
    note?: string;                     // "verbatim" / "near-parallel" / "thematic"
  };

  type PhaseView = { parallels?: ParallelRef[]; /* ... */ };
  ```
- **Renderer:** badge in phase header listing parallels; click → opens parallel in new tab.
- **Back-compat:** additive-safe.

### Lifted out of this document

The following architectural extensions are deferred to dedicated specs because they require schema work beyond bilingual MVP:

- **Concept layer (cross-language anchors)** — lives in `POLYGLOT.md` §3 and `TEXT_GRAPH.md` §4. Until polyglot rendering exists there's no UI surface for `conceptId`.
- **Witness / Expression / Work / Claim model** — lives in `TEXT_GRAPH.md`. Restructures provenance from a packet-nested object into an addressable graph that packets reference. Larger surgery; not blocking bilingual work.
- **TextLayer / TextUnit per-language decomposition** — lives in `POLYGLOT.md`. Sanskrit sound ladder, Chinese term kinds + xíngshēng analysis, Tibetan syllable stack. Each requires scholar collaboration to do honestly.
- **Context graph (doctrinal/social/economic/transmission lenses)** — lives in `POLYGLOT.md` §6. Requires sourced academic scholarship; sketchy claims would be worse than no claims.

---

## 3. Layer-by-layer mapping (cheat sheet)

| Field | L1 | L2 | L3 |
|---|:-:|:-:|:-:|
| `WordSegment.type` | ✓ | | |
| `WordSegment.morph` (existing + proposed verb fields) | ✓ | | |
| `WordSegment.relation.type` | ✓ | | |
| `WordSegment.relation.label` | | | ✓ |
| `WordSegment.tooltips` | | | ✓ |
| `Sense.english` / `nuance` | | ✓ | |
| `Sense.confidence` (proposed) | | ✓ | |
| `Sense.epistemicBasis` (proposed) | | ✓ | |
| `Sense.ripples` | | ✓ | |
| `Sense.citationIds` | | ✓ | |
| `PaliWord.compoundType` (proposed) | ✓ | | |
| `PaliWord.wordClass` | ✓ | | ✓ |
| `PaliWord.isAnchor` | | | ✓ |
| `PaliWord.refrainId` | | | ✓ |
| `PaliWord.conceptId` (deferred to POLYGLOT.md) | | ✓ | |
| `EnglishToken.linkedPaliId` / `linkedSegmentId` | | ✓ | |
| `EnglishToken.isGhost` / `ghostKind` | | ✓ | ✓ |
| `PhaseView.layoutBlocks` | | | ✓ |
| `PhaseView.spans` (proposed) | ✓ | ✓ | |
| `PhaseView.parallels` (proposed) | | ✓ | |
| `DeepLoomPacket.provenance` (proposed §2.6) | ✓ | | |
| `DeepLoomPacket.concepts` (deferred — see POLYGLOT.md) | | ✓ | |
| `DeepLoomPacket.textGraphRefs` (deferred — see TEXT_GRAPH.md) | ✓ | | |
| `renderDefaults.*` | | | ✓ |

When introducing a new field, check this matrix. If your new field belongs to L3 only, **do not** put it on the linguistic structure — find a render-hint container or a `studyHints` sidecar.

---

## 4. Backward compatibility policy

| Change kind | Cost | When |
|---|---|---|
| Add optional field | Free. No migration. Old renderers ignore. | Most new features. Default. |
| Add enum value | Free for additive-safe enums (`relation.type`, `ghostKind`, `compoundType`). Old renderers should fall through gracefully — verify before merging. | Most enum extensions. |
| Make required field optional | Free. Old data still validates. | When relaxing schema. |
| Make optional field required | Breaking. Bump packet version. Migrate. | Avoid. |
| Rename field | Breaking. Bump version, add migration shim. | Only for serious clarity wins. |
| Change semantics of existing field | Breaking. Bump version. Renderer branches on version. | Last resort. |
| Remove field | Deprecation cycle: ignore in renderer for 1 release, then remove. | Only when truly unused. |

**Packet version field**: `DeepLoomPacket.version?: string` — when changing semantics, set `version: 'v2'` on new packets. Renderers branch on `packet.version ?? 'v1'`. Old packets default to v1.

---

## 5. Validation & test invariants

Anything new should have at least one assertion in the test suite that checks the packet still validates:

- Every `EnglishToken.linkedPaliId` resolves to a real word in the same phase.
- Every `EnglishToken.linkedSegmentId` resolves to a segment of a word in the same phase.
- No duplicate `PaliWord.id` within a phase.
- Every `canonicalSegmentId` referenced by a phase exists in `packet.canonicalSegments` (when canonicalSegments populated).
- Compound words (when `compoundType` set) have ≥2 segments of type `root`/`stem`.
- Refrain IDs appear in ≥2 phases (otherwise they're not a refrain).
- Anchor: at most one per phase.

Existing validators live in `services/suttaStudioPacketValidator.ts` and `services/suttaStudioValidator.ts`. New invariants belong there.

---

## 6. House style for tooltips

Established by phase-a in the demo packet:

> **Dual register**: formal grammar in brackets + accessible explanation, pipe-separated:
> `[Past participle] Marks completed action: "heard"`

For multi-line tooltips in `tooltips: string[]`, separate concerns by line:
1. Definition / part of speech
2. Grammatical role
3. Pedagogical note (function in this passage / common confusion)

Avoid:
- Tooltips that just restate the English gloss (gloss lives in `Sense.english`).
- Tooltips that describe the renderer ("This word is colored green because..."). Renderer behavior belongs in this doc, not tooltips.
- Tooltips longer than ~3 lines per segment. If you need more, split into segments or add a `notes` field on the relevant `Sense`.

---

## 7. Feature implementation status

| Feature | Schema | Renderer | Used in demo | Notes |
|---|:-:|:-:|:-:|---|
| Word segmentation | ✅ | ✅ | ✅ | |
| Morph hints (case/number) | ✅ | 🟡 data-only | 🟡 partial | UI doesn't read them yet |
| Verb morphology (Pāli) | ❌ proposed §2.1 | — | — | additive; for MN10 |
| Compound type (Pāli/Sanskrit) | ❌ proposed §2.2 | — | — | additive; for MN10 |
| Relations | ✅ | ✅ | ✅ phase-a | |
| Polysemy | ✅ | ✅ | ✅ phase-a | |
| Refrains | ✅ | ✅ | ❌ | unused — easy win for re-curation |
| Ghost tokens | ✅ | ✅ | ✅ | only `required`/`interpretive` |
| Expanded ghost kinds | ❌ proposed §2.3 | — | — | |
| Quote spans | ❌ proposed §2.4 | — | — | |
| Anchors | ✅ | 🟡 styled | ❌ | unused |
| Tooltips | ✅ | ✅ | ✅ | |
| Sense-specific tooltips | ✅ | 🟡 | ❌ | |
| Citations | ✅ | ❌ | ❌ | |
| Ripples | ✅ | 🟡 | ❌ | |
| Word class colors | ✅ | ✅ | ✅ | |
| Layout blocks | ✅ | ✅ | 🟡 | |
| Validation issues | ✅ | 🟡 logged | ✅ live pipeline | |
| Confidence + EpistemicBasis | ❌ proposed §2.5 | — | — | additive; for MN10 |
| Provenance (packet-nested form) | ❌ proposed §2.6 | — | — | bilingual MVP form; long-term moves to TextGraph (`TEXT_GRAPH.md`) |
| Cross-references / parallels | ❌ proposed §2.7 | — | — | additive; for MN10 |
| Concept layer (cross-language) | deferred → `POLYGLOT.md` §3 | — | — | requires polyglot UI |
| TextGraph (witness/expression/claim) | deferred → `TEXT_GRAPH.md` | — | — | larger restructure |
| Per-language decomposition lenses | deferred → `POLYGLOT.md` §2 | — | — | scholar collaboration |
| Context graph (doctrinal/social/economic) | deferred → `POLYGLOT.md` §6 | — | — | requires sourced scholarship |

---

## 8. Where to go from here

### Bilingual MVP (this document's scope)

1. **Use unused existing features** before adding new ones. `refrainId`, `isAnchor`, `tooltipsBySense`, `ripples`, `citationIds` all exist and would enrich any re-curation immediately.
2. **Bilingual additive schema additions**, in order of priority:
   - Provenance (§2.6) — non-controversial, high educational value, small.
   - Verb morphology (§2.1) — fixes a real linguistic gap for Pāli/Sanskrit, small.
   - Compound type (§2.2) — meaningful pedagogy gain, small.
   - Confidence + EpistemicBasis (§2.5) — epistemic hygiene, small.
   - Expanded ghost kinds (§2.3) — small refinement.
   - Quote spans (§2.4) — moderate.
   - Cross-references / parallels (§2.7) — small.
3. **One PR per feature**. Each PR adds the schema field, updates this doc, adds a test, optionally adds a renderer hook.
4. **Don't expand `relation.type` lightly**. The 4-color palette is one of the most legible parts of the existing UI. New relation types should clear a high bar.

### Beyond bilingual

For the multi-language vision (Heart Sutra polyglot, Sanskrit/Chinese/Tibetan lenses, context graph), see `POLYGLOT.md`.

For the textual transmission architecture (witness/expression/claim/alignment, externalized TextGraph), see `TEXT_GRAPH.md`.

These docs are **design / charter only**. Implementation comes after MN10 bilingual is complete and after explicit scope commitment to multi-language work.

---

*Maintenance: when you add a new feature, add a row to §1 and §3 and §7. When you remove or rename, leave a "Deprecated" stub in §1 with the version it disappeared in.*

# Sutta Studio — Pali / English Design Rationale

> **Purpose**: Capture *what* the existing Pali↔English Sutta Studio pipeline
> does and *why* each feature was designed that way. This document is the
> baseline from which any non-Pali extension (Classical Chinese, Sanskrit,
> Tibetan) must be planned — by knowing what the existing assumptions are,
> we know which parts transfer cleanly and which need new design work.
>
> **Last verified against code**: 2026-05-04
>
> **Authoritative sources**: this document is a synthesis. The actual sources
> of truth are:
> - `types/suttaStudio.ts` — schema (298 LOC)
> - `config/suttaStudioPromptContext.ts` — prompt rationale embedded in code (272 LOC)
> - `services/compiler/prompts.ts` — prompt builders (347 LOC)
> - `docs/adr/SUTTA-003-sutta-studio-mvp.md` — original architectural decisions
> - `docs/sutta-studio/IR.md` — schema spec (Pali-only by design)

---

## 1. What Sutta Studio is

An interactive study tool that takes a single Pali sutta (or stitched bundle)
from SuttaCentral and produces a **DeepLoomPacket** — a richly annotated,
phase-organised view that lets a learner read Pali word-by-word while seeing:

- Each word's morphological breakdown (root + prefix + suffix + stem)
- Multiple English senses per word (polysemy, cycled by clicking)
- Grammatical relations between words drawn as colored arrows
- English alignment showing which English token came from which Pali source
- Repeated formulas underlined together (rhythmic cues)

Source URL: `https://suttacentral.net/{uid}/{lang}/{author}` (e.g. `mn10/en/sujato`).
Studio URL: `/sutta/{uid}?lang=en&author=sujato`.

**It is built specifically for fusional, inflected, whitespace-tokenised
languages (Pali and Sanskrit family).** Every design decision below either
exploits or is constrained by that assumption.

---

## 2. The Five-Pass Pipeline

```
fetch → Skeleton → Anatomist → Lexicographer → Weaver → Typesetter → render
```

Each pass is **optional** and writes its output incrementally to the packet.
If a later pass fails, earlier passes still produce a usable artifact (the
"degraded" rendering shows raw text without arrows/morphology).

| Pass | Input | Output | Why this pass exists |
|---|---|---|---|
| **Skeleton** | Raw segments from Bilara API | Phase grouping (≤8 Pali words per phase) | Cognitive load — learners can't absorb a whole sutta at once. ~1–3 segments per phase keeps a study unit visually small. |
| **Anatomist** | Phase segments | Words, morphological segments, relations, refrains | Pali meaning is encoded in **inflectional endings**, not word order. Decomposing words into root + suffix + prefix is the *whole point* of the study tool. |
| **Lexicographer** | Anatomist output + (optional) dictionary entries | English senses (1–3 per word/segment) | Pali words are **highly polysemous**. `Ekāyano` can mean Direct / Solitary / Convergent — all three are valid in different traditions. Forcing a single translation discards meaning. |
| **Weaver** | Anatomist words + tokenised English | English↔Pali alignment, ghost-token classification | Lets learners **see** which English word came from which Pali word/segment. Some English tokens have no Pali source ("the", "is") — these get classified as **ghosts** so users know they're translator scaffolding, not original meaning. |
| **Typesetter** | All previous passes | `layoutBlocks: string[][]` (max 5 words/block) | Visual readability. Pali phrase boundaries are not punctuation-marked; the typesetter groups words into ~5-word semantic blocks to minimise crossing arrows. |

Why split into passes at all? From the prompts (`SUTTA_STUDIO_BASE_CONTEXT`):

> "Your output is ONE PASS in a multi-pass pipeline. […] If unsure, keep
> output minimal and mark relations as pending rather than guessing."

Specialisation reduces hallucination. An LLM asked to "produce everything at
once" tends to invent. An LLM asked only "where are the morpheme boundaries"
is grounded by the surface form.

---

## 3. Linguistic Assumptions Baked Into Each Feature

### 3.1 Tokenisation (Anatomist)

> "Each space-separated Pali token = ONE word entry."
> "`Evaṁ me sutaṁ` has 3 words: p1='Evaṁ', p2='me', p3='sutaṁ'"
> — `SUTTA_STUDIO_ANATOMIST_CONTEXT`

**Assumption**: whitespace reliably separates words.
**Why it works for Pali**: Latin-script transliteration of Pali uses
explicit word-spacing. Rare ambiguities (sandhi compounds) are handled
case-by-case at the segment level, not the word level.
**Failure mode for other languages**: Classical Chinese has no spaces.
Tibetan uses tsheg (་) per syllable, not per word. Sanskrit Devanagari
runs words together with sandhi.

### 3.2 Morphological segmentation: root / prefix / suffix / stem

> "When suffixes carry distinct grammatical meaning, split them:
>   `sutaṁ → [su (root: √hear), ta (suffix: past participle), ṁ (suffix: nominative)]`
>   `viharati → [vi (prefix), har (root), a (thematic), ti (3rd person)]`"

**Why this matters for Pali**: Pali is **fusional** — multiple morphemes
fuse into one surface form. The grammatical role (case, person, tense) lives
inside the word. Decomposing reveals how meaning is built. From the prompt:

> "Pali is fusional: relationships encoded in word endings (inflections), not word order.
>  English is analytic and forces specificity."

**Mapping to the type system**: `WordSegment.type ∈ {'root' | 'suffix' | 'prefix' | 'stem'}`.
The four-way split is specifically tuned to Pali grammar:
- **root** (√): a verbal root, often glossed with `√` symbol (`√su` = "to hear")
- **prefix** (`vi-`, `sam-`, `pa-`, `upa-`): directional/intensifying particles
- **suffix** (`-āya`, `-assa`, `-aṁ`, `-ta`): case/tense/voice endings
- **stem**: residual / unsegmented base

**Where this fails**: Languages without inflectional morphology (Classical
Chinese; partially Mandarin). Languages where compounds are formed
differently (German nominal compounds, agglutinative Turkish/Tibetan).

### 3.3 Morph hints: case + number

```ts
type MorphHint = {
  case?: 'gen' | 'dat' | 'loc' | 'ins' | 'acc' | 'nom' | 'voc';
  number?: 'sg' | 'pl';
  note?: string;
};
```

**Why these specific cases**: these are **the seven Pali noun cases** that
appear in canonical texts (excluding ablative which Pali merges with
dative/genitive in some classes). They're the grammatical signal that drives
the entire relation system in §3.4.

**Where this fails**: Chinese has no case system. Word order + function
particles do this work. Tibetan has its own case set (different from Pali).
Even Sanskrit needs the ablative which Pali drops.

### 3.4 Grammatical relations: ownership / direction / location / action

```ts
type RelationType = 'ownership' | 'direction' | 'location' | 'action';
```

> "Encode relationships via suffix segments when possible
>  (genitive → ownership, dative → direction, locative → location,
>  instrumental → action)."
> — `SUTTA_STUDIO_PHASE_CONTEXT`

This is the **direct mapping from Pali case to grammatical relation**:

| Case | Plain meaning | RelationType | Visual color |
|---|---|---|---|
| Genitive (`-assa`, `-ssa`, `-ānaṁ`) | "of", "whose" | `ownership` | gold |
| Dative (`-āya`, `-assa`) | "to", "for whom" | `direction` | blue |
| Locative (`-e`, `-smiṁ`, `-mhi`) | "in", "at" | `location` | green |
| Instrumental (`-ena`, `-ehi`, `-bhi`) | "by", "with" | `action` | orange |

The relation arrows in the UI are **a visualization of Pali case morphology**.
Without case morphology, the relation system has no source signal.

**The four nominative/accusative/vocative cases don't get arrows** — they're
positional/structural, not relational in the same way.

### 3.5 Polysemy: 3 senses for content words, 1–2 for function words

> "Content words: exactly 3 senses. Function words: 1-2 senses."
> — `SUTTA_STUDIO_LEXICO_CONTEXT`

**Why this number**: `Ekāyano` example from the prompts has Direct / Solitary /
Convergent — three traditional readings each defended by major commentators.
Three slots roughly correspond to (1) the most common modern translation,
(2) a traditional alternative, (3) an etymologically defensible third.

For function words (particles, pronouns, connectives) the semantic range is
narrower so 1-2 senses suffice.

**Transfers cleanly to other languages** — polysemy is not Pali-specific.
The "3 for content, 1-2 for function" heuristic isn't language-bound; what
*is* Pali-bound is the underlying word classification:

```
content: nouns, verbs, adjectives → green
function: particles, pronouns, connectives → white
vocative: direct address (bhante, bhikkhave, āvuso) → yellow
```

The vocative class is **specifically Pali-shaped** — it gets its own color
because vocative forms are common enough in chant texts (`bhikkhave!` =
"O monks!") to warrant visual rhythm. Languages without a morphological
vocative case (English, Chinese) wouldn't need this distinction at the same
prominence.

### 3.6 Refrains: shared-color underlines for recurring formulas

> "Common refrains:
>  - 'bhagava': bhagavā, bhagavato, bhagavantaṁ (Blessed One in different cases)
>  - 'bhikkhu': bhikkhū, bhikkhave (monks/mendicants)
>  - Formula patterns: 'ātāpī sampajāno satimā' (ardent, clearly knowing, mindful)"

**Why this exists**: Pali sutras come from an **oral tradition**. Repetition
is structural: the same epithets, same refrains, same numbered lists recur
constantly. Highlighting them helps the reader feel the textual rhythm.

`refrainId` is a string tag — words sharing a tag get the same underline color.

**Transfers conceptually but not literally** — repetition exists in many
literary traditions (Classical Chinese has 四字格 four-char parallelism;
Buddhist Chinese sutras quote the same Sanskrit dhāraṇī patterns). But the
*specific* refrains differ.

### 3.7 Ghost tokens: English glue without Pali source

```ts
type EnglishToken = {
  id: string;
  label?: string;
  linkedSegmentId?: string;
  linkedPaliId?: string;
  isGhost?: boolean;
  ghostKind?: 'required' | 'interpretive';
};
```

> "Ghost classification (only when English word has no Pali source):
>  - 'required': grammatically necessary (articles, verb helpers, case-implied prepositions)
>  - 'interpretive': added for clarity (parentheticals, explanatory additions)"

**Why ghosts exist**: English requires articles, copulas, and prepositions
that Pali leaves implicit (Pali has no "is/are", no "a/the"). When a learner
sees "the monk is sitting", they need to know "the" and "is" weren't *in*
the Pali — they're translator scaffolding.

Ghosts render at reduced opacity (`renderDefaults.ghostOpacity = 0.3`) by default.

**This concept transfers cleanly to any source-target pair** where the target
adds structural words the source omits. Pali→English, Chinese→English,
Sanskrit→English all need ghosts. The *content* of the ghost set differs but
the mechanism is universal.

### 3.8 Anchors: semantic centerpieces

```ts
isAnchor?: boolean
```

The `isAnchor` flag marks the **semantic anchor** of a phase — typically the
main verb or the topic noun. Used for visual emphasis. The Anatomist passes
heuristically pick anchors based on word class and position in phrase.

**Transfers cleanly** — every language has emphasis-worthy words.

### 3.9 Phase grouping rules (Skeleton)

> "DEFAULT: 1 segment per phase. HARD LIMIT: Maximum 8 Pali words per phase."
> "Title block: Collection name + sutta title → group TOGETHER in ONE phase."
> "Opening formula: 'Evaṁ me sutaṁ...' → its own phase."
> "Setting/nidāna: Keep the full setting line as ONE phase."
> "Parallel benefit lines are SEPARATE phases."

These rules are **specifically tuned to canonical Pali sutta structure**:
- Title block (Majjhima Nikāya / Satipaṭṭhānasutta)
- Opening formula ("Evaṁ me sutaṁ" = "Thus I have heard")
- Nidāna (setting: where the Buddha is, who's present)
- Sutta body (often parallel/repetitive lists)
- Closing formula

Different traditions have different macro-structures:
- Mahayana sutras (Chinese T0251 etc.) often skip the formal opening
  formula or expand it ("Thus I have heard. At one time…")
- Vinaya texts have rule + commentary structure
- Abhidhamma is dense lists, not narrative

**The grouping heuristics are sutta-shaped** but the *concept* of grouping
into ≤8-word phases for cognitive load transfers.

### 3.10 Tooltip pedagogy: jargon-with-explanation

> "Pattern: 'Technical term — plain explanation'
>  'Indeclinable — never changes form'
>  'Absolutive — like English -ing but completed'"

**Design choice unrelated to Pali**: this is a *pedagogical* convention. Use
the technical term so motivated learners build vocabulary, but always pair it
with plain language so casual readers aren't gatekept.

Emoji markers (📍 location, 🔗 belonging, 📢 calling out, 👥 group, 🎯 receiving)
are an accessibility/UX layer that's language-neutral.

**Transfers to any language**, with the technical terms swapped per tradition.

---

## 4. The IR Envelope (DeepLoomPacket)

```ts
type DeepLoomPacket = {
  packetId: string;
  source: { provider: SourceProvider; workId: string; workIds?: string[] };
  canonicalSegments: CanonicalSegment[];
  phases: PhaseView[];
  citations: Citation[];
  progress?: { ... };
  renderDefaults: { ghostOpacity, englishVisible, studyToggleDefault };
  compiler: { provider, model, promptVersion, createdAtISO, sourceDigest };
};
```

This top-level shape is **mostly language-neutral**:

- `canonicalSegments` = ordered atomic units of the source text
- `phases` = view-level study chunks
- `citations`, `compiler`, `progress`, `renderDefaults` = metadata

The **language coupling is concentrated in `CanonicalSegment.pali`** (a string
field literally named "pali") and in `PhaseView.paliWords: PaliWord[]`.

**For a non-Pali extension**, the envelope can stay; the leaves need to
generalise. See the deeper-into-the-stack table below.

| Layer | Language coupling | Refactor effort |
|---|---|---|
| `DeepLoomPacket` | None (just contains everything) | None |
| `source.provider: 'suttacentral'` | Hardcoded literal type | Trivial (add union member) |
| `CanonicalSegment.pali: string` | Field name | Rename to `text` or make language-keyed |
| `CanonicalSegment.baseEnglish?: string` | Implies a single target language | Generalise to translations map |
| `PhaseView.paliWords: PaliWord[]` | Type name | Rename to `Word[]` |
| `WordSegment.type: 'root' \| 'prefix' \| 'suffix' \| 'stem'` | Pali morphology | Whole new vocabulary needed for non-fusional langs |
| `MorphHint.case` | Pali noun cases | Whole new vocabulary needed |
| `RelationType` mapping from cases | Pali grammar | Source-of-relation differs by language |
| `EnglishToken` / Ghost concept | Source has no `the`/`is`; target does | Transfers cleanly |
| Refrain IDs | Pali oral repetition | Concept transfers; specific refrains differ |
| Word class (content/function/vocative) | Vocative is Pali-shaped | Reduce to content/function for non-Pali |
| Phase grouping rules | Sutta macrostructure | Different rules per tradition |
| Tooltip pattern | Pedagogical | Transfers cleanly |

---

## 5. URL Format

```
/sutta/<uid>[?lang=<lang>&author=<author>&recompile=1&stitch=<uid2,uid3>&cross=1]
```

Example: `/sutta/mn10?lang=en&author=sujato`

`uid` is the SuttaCentral identifier. `author` is the Bilara translator slug.
This URL shape is **inherently SuttaCentral-shaped**.

For multi-source extension, the URL must either:
- Carry a `provider` segment: `/sutta/{provider}/{workId}` (M1 chose this for fojin)
- Or use a generic `/study/{provider}/{workId}` route to avoid the "sutta" name

---

## 6. The Provider/Backend Contract

The compiler at `services/compiler/segments.ts` calls **two SuttaCentral
endpoints** to get raw text:

```
GET https://suttacentral.net/api/bilarasuttas/{uid}/{author}
GET https://suttacentral.net/api/suttaplex/{uid}
```

The Bilara endpoint returns:

```json
{
  "root_text": { "mn10:1.1": "Evaṁ me sutaṁ.", ... },
  "translation_text": { "mn10:1.1": "So I have heard.", ... }
}
```

So `CanonicalSegment` is built directly from Bilara's `root_text` (Pali) +
`translation_text` (English). The pipeline assumes:

1. **Source comes pre-segmented** with stable IDs (Bilara's `mn10:1.1` form).
   You don't need a "tokenise the raw text into atoms" step.
2. **Segment IDs are stable across translators and traditions** (every
   English/German/etc. translation in Bilara aligns to the same Pali segment IDs).
3. **An English baseline exists** for free (Bilara's `translation_text`).
   Lexicographer and Weaver passes use this as a reference.

**When extending to other sources**, all three assumptions need new answers:
- fojin's `/api/texts/{id}/juans/{n}` returns one Chinese blob per juan, not
  pre-segmented atoms.
- 84000.co returns HTML with custom segment markers (`UT22084-034-009-section-1`).
- CBETA XML has its own structure.

Each source needs a **fetcher + segmenter** pair to produce `CanonicalSegment[]`
in the shape the rest of the pipeline expects.

---

## 7. Validation

`services/suttaStudioValidator.ts` enforces invariants like:

- Every English token's `linkedPaliId` resolves to a real word
- No duplicate word IDs within a phase
- Every canonical segment is referenced by at least one phase
- Compound ghost handling

These rules are **structurally Pali-aware**: "linked **Pali** ID" is in the
field name. For multi-language packets, validation needs to operate on
`linkedSourceId` instead, but the *kind* of validation (referential integrity,
no-duplicates, coverage) is language-neutral.

---

## 8. Summary: What Transfers, What Doesn't

**Transfers cleanly to any source language**:
- The five-pass pipeline structure (Skeleton → Anatomy → Lexicon → Weaver → Typesetter)
- Polysemy rendering (cycle-on-click, multiple senses)
- Ghost-token concept (target-only structural words)
- Anchor / refrain visual emphasis
- Tooltip pedagogy (jargon-with-explanation, emoji markers)
- Phase chunking for cognitive load (≤8 word units)
- Layout blocks (max 5 per block, semantic grouping)
- Validation principles (referential integrity, coverage)

**Pali-specific, requires re-design for any other language**:
- Whitespace tokenisation (Anatomist input rule)
- Root/prefix/suffix/stem segment vocabulary (`WordSegment.type`)
- Pali noun cases as `MorphHint.case` enum
- Case→relation mapping (`gen→ownership`, `dat→direction`, etc.)
- Vocative as a top-level word class
- SuttaCentral as the only `SourceProvider`
- The two SuttaCentral API endpoints as the only segment source
- Sutta macrostructure rules (Title Block / Opening Formula / Nidāna)
- Field names: `pali`, `paliWords`, `linkedPaliId`, `baseEnglish`

**Pali-shaped but neutralisable**:
- The DeepLoomPacket envelope (rename a few fields, generalise providers)
- The validator (swap "linkedPaliId" for "linkedSourceId")

---

## 9. Implications for Multi-Source Extensions

A non-Pali source (fojin Chinese, 84000 Tibetan, Sanskrit Devanagari) requires:

1. **A new segmenter + fetcher** producing `CanonicalSegment[]` for that source.
2. **A language-aware Anatomist prompt set** — the Pali one assumes whitespace
   tokenisation and inflectional morphology; replacing it requires understanding
   how meaning is encoded in the target language (character morphology for
   Chinese, sandhi resolution for Sanskrit, etc.).
3. **A new MorphHint vocabulary** if the source language uses morphological
   features (or a no-op MorphHint for analytic languages like Classical Chinese).
4. **A new Word class enum** (probably narrower than Pali's content/function/vocative).
5. **Possibly a new RelationType set** if the source signals relations
   differently (Chinese particles, Tibetan ergative-absolutive markers, etc.).
6. **Updated validator codes** to allow source-specific shapes.
7. **No change to**: Lexicographer (polysemy is universal), Weaver (ghost concept
   is universal), Typesetter (layout is universal), the rendering UI components
   (they consume the IR, not the source).

Stage 7 is the leverage point — the renderer doesn't care what language the
source is, as long as the IR shape holds. **Generalising the IR + writing a
new Anatomist prompt set is the bulk of the work** for any new language.

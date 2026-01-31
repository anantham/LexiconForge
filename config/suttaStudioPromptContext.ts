export const SUTTA_STUDIO_BASE_CONTEXT = `
PURPOSE:
You are helping build an interactive study tool for learners of Pali Buddhist texts.
The goal is word-by-word understanding, not just translation.

LEARNER EXPERIENCE:
- Hovering a word shows tooltips explaining its morphology and etymology
- Colored arrows connect grammatically related words (genitive → ownership, etc.)
- Repeated formulas (bhagavā, bhikkhu) share underline colors to show textual rhythm
- English words align to their Pali source via connecting lines
- Learners can cycle through multiple senses for polysemous terms

PIPELINE CONTEXT:
Your output is ONE PASS in a multi-pass pipeline:
1. Skeleton: Groups segments into study phases
2. Anatomist: (YOU) Word segmentation, morphology, relations, tooltips
3. Lexicographer: English senses for each word/segment
4. Weaver: Maps English tokens to Pali sources
5. Typesetter: Final layout arrangement

LINGUISTIC CONTEXT:
- Pali is fusional: relationships encoded in word endings (inflections), not word order.
- English is analytic and forces specificity; preserve Pali ambiguity when justified.
- Ghost words show English glue (articles, "is/are", prepositions); they're UI scaffolding.
- If unsure, keep output minimal and mark relations as pending rather than guessing.
`.trim();

export const SUTTA_STUDIO_SKELETON_CONTEXT = `
Skeleton guidance:
- Group segments into SMALL study phases for focused learning.
- DEFAULT: 1 segment per phase.
- HARD LIMIT: Maximum 8 Pali words per phase. Split if exceeding this.
- Only group multiple segments when explicitly instructed (e.g., Title Block).

GROUPING RULES (in priority order):
1. Title block: Collection name (e.g., "Majjhima Nikāya 10") + sutta title (e.g., "Satipaṭṭhānasutta") → group TOGETHER in ONE phase called "Title Block".
2. Opening formula: "Evaṁ me sutaṁ..." → its own phase called "Opening Formula".
3. Setting/nidāna: Keep the full setting line as ONE phase (do not split).
4. Speaker line, vocative, response, and transition are SEPARATE phases when they are separate segments.
5. Parallel benefit lines are SEPARATE phases (even if they are grammatically similar).
6. Direct speech markers: keep the marker with its segment; do NOT merge across segments.

ANTI-PATTERNS (avoid these):
- Do NOT merge adjacent segments just because they are related.
- Do NOT separate collection title from sutta title — they form one "Title Block".
- Do NOT merge response + transition (e.g., mn10:1.5 and mn10:1.6 must stay separate).
- Do NOT merge parallel benefit lines (e.g., mn10:2.2, mn10:2.3, mn10:2.4, mn10:2.5 must each be separate).

If a boundary map is provided, do not cross chapter boundaries unless explicitly allowed.

SUB-SEGMENT SPLITTING:
When a single segment exceeds 8 Pali words, split it across multiple phases using wordRange.

- wordRange is [start, end) - 0-indexed, end is exclusive
- Count words by splitting on whitespace (punctuation stays with its word)
- Each split phase references the SAME segmentId but different wordRange

Example - segment "Ekāyano ayaṁ, bhikkhave, maggo sattānaṁ visuddhiyā" (6 words):
  { "id": "phase-1", "segmentIds": ["mn10:2.1"], "wordRange": [0, 4] }  // words 0-3: "Ekāyano ayaṁ, bhikkhave, maggo"
  { "id": "phase-2", "segmentIds": ["mn10:2.1"], "wordRange": [4, 6] }  // words 4-5: "sattānaṁ visuddhiyā"

WHEN TO SPLIT:
- Segment has > 8 words
- Natural phrase boundary exists (vocative, punctuation, grammatical break)
- Prefer splits at: vocatives (bhikkhave), punctuation, clause boundaries

WHEN NOT TO SPLIT:
- Segment ≤ 8 words (no wordRange needed)
- Would break a compound or tight grammatical unit
`.trim();

export const SUTTA_STUDIO_PHASE_CONTEXT = `
Phase guidance:
- Provide multiple senses when a term is polysemous (e.g., Ekāyano can be Direct / Solitary / Convergent).
- Encode relationships via suffix segments when possible (genitive → ownership, dative → direction, locative → location, instrumental → action).
- Include morph hints on suffixes when known (case/number + brief note).
- Use ghost tokens for zero copula (“is/are”) and English prepositions implied by Pali endings.
- Include ripple overrides when a sense choice changes nearby ghost words.
- Do not repeat the same English token twice in a row.
- If there are many Pali words, provide layoutBlocks (arrays of word IDs) with a max of 5 words each, ordered to minimize crossing.
`.trim();

export const SUTTA_STUDIO_ANATOMIST_CONTEXT = `
Anatomist pass:
You are the "word surgeon" - breaking Pali words into their morphological pieces so learners can understand how meaning is built from roots, prefixes, and suffixes.

WHAT YOU PRODUCE:
- Words: each space-separated Pali token becomes one word object
- Segments: each morphological piece (root, prefix, suffix) with hover tooltips
- Relations: grammar arrows connecting related words (genitive → ownership, etc.)
- Refrain IDs: tags for repeated formulas so they share visual styling

WHAT YOU DON'T DO (other passes handle these):
- English senses (Lexicographer does this)
- English-Pali alignment (Weaver does this)
- Layout arrangement (Typesetter does this)

Rules:
1. Each space-separated Pali token = one word. "Evaṁ me sutaṁ" = 3 words (p1, p2, p3).
2. Strip punctuation from surface forms:
   - "ayaṁ," → "ayaṁ", "sutaṁ—" → "sutaṁ", "\"Ekāyano" → "Ekāyano"
3. Every segment must have non-empty text.

─────────────────────────────────────────────────────────────────────────────
SEGMENTATION - Split suffixes when meaningful:

When suffixes carry distinct grammatical meaning, split them:
  sutaṁ → [su (root: √hear), ta (suffix: past participle), ṁ (suffix: nominative)]
  viharati → [vi (prefix), har (root), a (thematic), ti (3rd person)]
  sattānaṁ → [satt (stem), ānaṁ (suffix: genitive plural)]

Short function words can remain unsplit:
  evaṁ → [evaṁ (stem)] or [eva, ṁ] - either is acceptable
  ayaṁ → [ayaṁ (stem)]

The goal is helping learners see how meaning is built from pieces.

─────────────────────────────────────────────────────────────────────────────
SEGMENT IDs - Why they matter:
Learners can hover on individual segments to see tooltips. Compound words like
"Satipaṭṭhānasutta" have multiple English translations (Mindfulness + Foundation + Discourse),
and each English word needs to link to its specific segment.

Format: wordId + "s" + index (e.g., p1s1, p1s2 for first word's segments)

─────────────────────────────────────────────────────────────────────────────
WORD CLASS - Why it matters:
Color coding helps learners distinguish grammatical roles at a glance.
- "content": nouns, verbs, adjectives → rendered GREEN (carry main meaning)
- "function": particles, pronouns, connectives → rendered WHITE (grammatical glue)

─────────────────────────────────────────────────────────────────────────────
SEGMENT TYPES - For morphological analysis:
- "root": √verb roots (e.g., √su "to hear", √bhū "to be", √gam "to go")
- "prefix": vi-, sam-, pa-, upa- (directional/intensifying)
- "suffix": case/tense/voice endings (-āya, -assa, -aṁ, -ta, -ṁ)
- "stem": unsegmented base or unclear morphology

─────────────────────────────────────────────────────────────────────────────
TOOLTIPS - Context for learners:
Each segment should have 1-3 tooltips explaining meaning/function.

Good examples:
  "[Emphatic particle] Just so - Points back to the occasion"
  "√su: To hear (suṇāti) - The act of receiving teaching"
  "[Past participle] Marks completed action"

Include when relevant:
- [Bracketed grammar terms] for display toggling
- Root citations with √ symbol
- Brief notes on why this form matters in context

─────────────────────────────────────────────────────────────────────────────
RELATIONS - Grammar arrows connecting words:
These draw colored lines between related words in the UI.
- Attach to the suffix segment that carries the grammatical marker
- Types: ownership (genitive), direction (dative), location (locative), action (instrumental)
- Use targetSegmentId within compounds, targetWordId between words

─────────────────────────────────────────────────────────────────────────────
REFRAIN IDs - Visual rhythm for repeated formulas:
Buddhist texts have recurring phrases. Learners benefit from seeing these patterns.
Words with the same refrainId share an underline color.

Common refrains:
- "bhagava": bhagavā, bhagavato, bhagavantaṁ (Blessed One in different cases)
- "bhikkhu": bhikkhū, bhikkhave (monks/mendicants)
- Formula patterns: "ātāpī sampajāno satimā" (ardent, clearly knowing, mindful)

Only tag genuinely repeated terms, not every common word.
`.trim();

export const SUTTA_STUDIO_LEXICO_CONTEXT = `
Lexicographer pass:
- Goal: provide contextual senses only (no segmentation, no English mapping).

WORD-LEVEL SENSES (default):
- Content words: exactly 3 senses.
- Function words: 1-2 senses.
- Use dictionary data if provided; do not invent etymology.
- If dictionary data is missing or unclear, use contextual inference and mark notes.

SEGMENT-LEVEL SENSES (for compounds):
- When a compound word has segments with distinct meanings, provide senses per segment.
- Use segmentSenses array with segmentId references (from Anatomist pass).
- Example: Satipaṭṭhānasutta has segments p1s1 (sati), p1s2 (paṭṭhāna), p1s3 (sutta)
  - p1s1: [Mindfulness, Memory, Awareness]
  - p1s2: [Foundation, Establishment, Basis]
  - p1s3: [Discourse, Thread, Teaching]
- When segments have senses, the word-level senses array should be empty.
- This enables users to cycle meanings of individual compound parts independently.
`.trim();

export const SUTTA_STUDIO_WEAVER_CONTEXT = `
Weaver pass:
- Goal: map pre-tokenized English tokens to Pali segments or words. Do NOT reword or reorder.
- You receive: (1) tokenized English with indices, (2) Pali words with segment IDs, (3) senses for context.

SEGMENT-LEVEL LINKING (preferred):
- Use linkedSegmentId to link English tokens to specific Pali segments.
- This is the PRIMARY linking method, especially for compound words.
- Example: Satipaṭṭhānasutta (p1) with segments p1s1="sati", p1s2="paṭṭhāna", p1s3="sutta"
  - English "Mindfulness" → linkedSegmentId: "p1s1"
  - English "Meditation" → linkedSegmentId: "p1s2"
  - English "Discourse" → linkedSegmentId: "p1s3" (if present)

WORD-LEVEL LINKING (fallback):
- Use linkedPaliId when segment-level linking is not applicable.
- For simple (non-compound) words where the whole word maps to one English word.
- Example: "Evaṁ" (p1) → English "Thus" linkedPaliId: "p1"

Compound words:
- A single Pali compound translates to multiple English words.
- Link each English word to its corresponding segment (not word-level).
- These have Pali source, so they are not ghosts.

Ghost classification (only when English word has no Pali source):
- "required": grammatically necessary (articles, verb helpers, case-implied prepositions)
- "interpretive": added for clarity (parentheticals, explanatory additions)

Notes:
- Whitespace and punctuation tokens: pass through (not linked, not ghost).
- Do not change token text. Only provide mapping metadata.
- If a token could map to multiple segments, choose the primary semantic match.
`.trim();

export const SUTTA_STUDIO_TYPESETTER_CONTEXT = `
Typesetter pass:
- Goal: arrange Pali word IDs into layout blocks to minimize visual crossing lines.
- Input: Pali word IDs with relations, English token ordering.
- Output: layoutBlocks as arrays of word ID arrays, max 5 words per block.

Group words into semantic phrases (not one word per block):
- "Evaṁ me sutaṁ" (Thus I heard) → [[p1, p2, p3]] (one block)
- "ekāyano ayaṁ maggo" (this is the direct path) → [[p1, p2, p3]] or [[p1, p2], [p3]]
- Subject + verb → same block
- Noun + modifiers → same block

Split at natural phrase boundaries: after verbs, before new clauses.
Order blocks to follow English reading order while respecting Pali dependencies.
When unsure, prefer fewer larger blocks over many single-word blocks.
`.trim();

export const SUTTA_STUDIO_MORPH_CONTEXT = `
Morphology pass:
- Only return paliWords with updated segments (do NOT modify senses or englishStructure).
- Split words into prefix/root/stem/suffix where possible; if unsure keep a single stem.
- Add morph hints on suffixes when known (case/number + brief note).
- Add relation metadata on suffix segments when the relation is clear.
`.trim();

export const SUTTA_STUDIO_BASE_CONTEXT = `
Context:
- Pali is a fusional, synthetic language: relationships are encoded in word endings (inflections), not word order.
- English is analytic and forces specificity; avoid collapsing polysemy into a single meaning.
- This UI is for *study*, not just translation. Preserve ambiguity when justified.
- Ghost words exist to show English glue (zero copula, prepositions); they are UI scaffolding, not source truth.
- If unsure, keep output minimal and mark relations as pending rather than guessing.
`.trim();

export const SUTTA_STUDIO_SKELETON_CONTEXT = `
Skeleton guidance:
- Group segments into SMALL study phases for focused learning.
- HARD LIMIT: Maximum 8 Pali words per phase. Split if exceeding this.
- Typical phase: 1-3 segments (a single sentence or clause).

GROUPING RULES (in priority order):
1. Title block: Collection name (e.g., "Majjhima Nikāya 10") + sutta title (e.g., "Satipaṭṭhānasutta") → group TOGETHER in ONE phase called "Title Block".
2. Opening formula: "Evaṁ me sutaṁ..." → its own phase called "Opening Formula".
3. Setting/nidāna: Place + time + occasion → group together if under 8 words.
4. Speaker + vocative + main verb: "Bhagavā bhikkhū āmantesi" → group together.
5. Direct speech markers: "...ti" quotation closers stay with the quoted content.
6. Grammatically linked clauses: Keep case-chains and relative clauses together.

ANTI-PATTERNS (avoid these):
- Do NOT split each segment into its own phase by default.
- Do NOT separate collection title from sutta title — they form one "Title Block".
- Do NOT split mid-clause when a grammatical relation spans segments.

If a boundary map is provided, do not cross chapter boundaries unless explicitly allowed.
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
- Goal: Pali word segmentation + morphology + relations + etymological tooltips. Do NOT add English senses.
- CRITICAL: Each space-separated Pali token is ONE word. "Evaṁ me sutaṁ" = 3 words (p1, p2, p3), NOT 1 word.

SEGMENT IDs (REQUIRED):
- Every segment MUST have a unique ID in format: wordId + "s" + index (e.g., p1s1, p1s2, p2s1).
- This enables segment-level English linking for compounds.

WORD CLASS (for color coding):
- "content": nouns, verbs, adjectives, adverbs → rendered green
- "function": particles, pronouns, connectives → rendered white

COMPOUND WORDS (e.g., Satipaṭṭhānasutta):
- Keep as ONE word with MULTIPLE segments, each with its own ID.
- Add segment-to-segment relations showing compound structure.
- Example: Satipaṭṭhānasutta → segments: [p1s1:"Sati", p1s2:"paṭṭhāna", p1s3:"sutta"]
- Relations: p1s1→p1s2 (ownership: "Mindfulness of"), p1s2→p1s3 (location: "Foundation in")

SEGMENT TYPES:
- "root": √verb roots (e.g., √su, √bhū, √gam)
- "prefix": vi-, sam-, pa-, upa-, etc.
- "suffix": case/tense/voice endings
- "stem": unsegmented base or unclear morphology

TOOLTIPS (REQUIRED for each segment):
- Format: "√root: meaning / meaning" for roots
- Format: "Prefix: function" for prefixes
- Format: "Case (number): grammatical function" for suffixes
- Include 2-3 meanings separated by /

RELATIONS (for grammar arrows in study mode):
- Attach to the segment that carries the grammatical marker (usually suffix).
- Use targetSegmentId for segment-to-segment (within compounds).
- Use targetWordId for segment-to-word (between words).
- Types: ownership (genitive), direction (dative), location (locative), action (instrumental).
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

COMPOUND WORDS (CRITICAL):
- A single Pali compound translates to multiple English words.
- Link EACH English word to its corresponding SEGMENT, not word.
- These are NOT ghosts - they have Pali source (the segment).

GHOST CLASSIFICATION (use ONLY when English word has NO Pali source):
- "required": grammatically necessary in English (articles, verb helpers, case-implied prepositions)
- "interpretive": added for clarity (parentheticals, explanatory additions)

RULES:
- Whitespace and punctuation tokens: pass through (not linked, not ghost).
- Do NOT change token text. Only provide mapping metadata.
- If a token could map to multiple segments, choose the primary semantic match.
`.trim();

export const SUTTA_STUDIO_TYPESETTER_CONTEXT = `
Typesetter pass:
- Goal: arrange Pali word IDs into layout blocks to minimize visual crossing lines.
- Input: Pali word IDs with relations, English token ordering.
- Output: layoutBlocks as arrays of word ID arrays, max 5 words per block.
- Order blocks to follow English reading order while respecting Pali dependencies.
- If unsure, use source order chunked into groups of ≤5.
`.trim();

export const SUTTA_STUDIO_MORPH_CONTEXT = `
Morphology pass:
- Only return paliWords with updated segments (do NOT modify senses or englishStructure).
- Split words into prefix/root/stem/suffix where possible; if unsure keep a single stem.
- Add morph hints on suffixes when known (case/number + brief note).
- Add relation metadata on suffix segments when the relation is clear.
`.trim();

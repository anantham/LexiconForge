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
- Group segments by grammatical/semantic dependency (case chains, relative clauses, enumerations).
- Avoid splitting a clause if a relation crosses segment boundaries.
- Phase size target: 6–12 segments.
- Soft cap: aim for ≤8 Pali words per phase; prefer splitting if a phase would exceed this.
- If a boundary map is provided, do not cross chapter boundaries unless explicitly allowed.
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

export const SUTTA_STUDIO_MORPH_CONTEXT = `
Morphology pass:
- Only return paliWords with updated segments (do NOT modify senses or englishStructure).
- Split words into prefix/root/stem/suffix where possible; if unsure keep a single stem.
- Add morph hints on suffixes when known (case/number + brief note).
- Add relation metadata on suffix segments when the relation is clear.
`.trim();

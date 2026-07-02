# SUTTA-013 — Facts-vs-prose scoring split (scoping) + alignment golden (scoping)

**Status:** Proposed — scoped 2026-07-02, not yet built. Target: rubric v2.2.
**Why:** the two remaining validity gaps the operator prioritized after v2.1/golden-v2.

## Part 1 — Grade facts against the dictionary, prose against the judge

### Problem
A word's root, POS, case, and sandhi analysis are **facts** with a human authority (DPD).
Its explanation is **prose**. Today both are graded by token overlap with one teacher's
phrasing, so models are pushed to mimic the golden's writing style. This is also the main
circularity residue: the golden's prose is Claude-worded.

### Design (deterministic FACTS layer, per aligned content word)
1. **rootMatch** — the scorer's tokenizer already preserves `√`-marked tokens. Extract the
   model's claimed root(s) from its tooltips/morph fields and compare against the word's DPD
   root (`data/dpd/<sutta>/headwords.json`). Catches fabricated etymologies deterministically
   (the hallucination class that matters most pedagogically).
2. **posMatch** — model `wordClass` vs DPD POS via the mapping `verify-golden.ts` already uses.
3. **morphMatch** — suffix segments' structured `morph` tags vs the golden's structured morph
   fields (data, not prose).
4. **senseInContext** — token-F1 restricted to the SENSES arrays only (golden-v2-curated,
   DPD-grounded); tooltip prose LEAVES the deterministic metric entirely.
5. Tooltip prose quality becomes judge-only territory (SUTTA-010 already rewards correct
   pedagogy and hard-caps hallucination).

Proposed v2.2 fidelity: `0.4·seg + 0.3·facts + 0.3·senseF1` (weights to be reviewed
cross-family before adoption; any change is a rubric bump + full re-score, per SUTTA-012).

### Effort and risks
- Scorer + tests: ~1 day. DPD is already on disk for MN10; no new APIs.
- **Root canonicalization is the fiddly part**: DPD root notation vs model notation
  (√gam vs gam vs gacchati allomorphs) needs a normalization table; `verify-golden.ts` has
  the seed of it.
- **DPD coverage**: the current golden has 55 words DPD can't match (proper nouns, sandhi
  compounds). Facts layer falls back to golden-structured-fields for those; never grade a
  fact against prose.
- Benefit: `contentPrecision` comes to mean "factually right", not "phrased like us", and
  fabricated roots become a deterministic catch instead of a judge judgment call.

## Part 2 — Alignment (Weaver) golden

### Problem
Which English word links to which Pāli word is half the reading experience; a misaligned
link teaches a wrong word-mapping. Today only structural validity is checked. The existing
`sutta-studio-weaver-golden.json` turned out to hold **placeholder tokens** (`text: "ea1"`),
so no correctness reference exists.

### Design
- Reference translation: Bhikkhu Sujato's MN 10 (public domain / CC0, already the SC basis).
- Curation: same two-stage workflow as golden v2 (curator + adversarial skeptic per phrase,
  51 phrases): for each golden Pāli word, the expected English word(s) in the reference
  translation, plus expected ghost tokens (English-only words like articles).
- Metric: F1 over normalized `(paliWordId ↔ englishToken)` link pairs, pooled per phase;
  published as an advisory **Align** column first, folded into the ranked total in v2.2+ only
  after review.

### Effort
- Extraction script + curation workflow: ~half a day (pattern proven today).
- Scorer + column: ~2 hours. Blocked on: choosing/storing the reference translation per phase.

## Explicitly out of scope here
The pedagogical probe (a student model answering teacher questions from the compiled output
alone) stays the north-star experiment; it needs its own design round.

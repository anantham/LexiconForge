# SUTTA-013 — Facts-vs-prose scoring split (scoping) + alignment golden (scoping)

**Status:** Part 1 IMPLEMENTED as advisory 2026-07-03 (`facts-scorer.ts`, 8 tests,
`report-facts-layer.ts` dry run below); ranked-total wiring waits for the v2.2 bump
with SUTTA-014. Part 2 (alignment golden) still scoped-only — its curation workflow
needs an ultracode session. Target: rubric v2.2.
**Why:** the two remaining validity gaps the operator prioritized after v2.1/golden-v2.

## Part 1 dry run (2026-07-03, existing board runs re-scored, zero API cost)

| model | contentF1 (v2.1) | senseF1 | facts | root | pos | morph |
|---|---|---|---|---|---|---|
| grok-4.20 | 0.335 | 0.485 | 0.692 | 46% | 85% | 59% |
| deepseek-v4-flash | 0.327 | 0.388 | 0.658 | 50% | 71% | 0% |
| mistral-small-3.2 | 0.326 | 0.406 | 0.708 | 48% | 82% | 24% |
| gemini-3-flash | 0.318 | 0.378 | 0.526 | 35% | 70% | 0% |
| qwen3-235b | 0.282 | 0.414 | 0.532 | 28% | 74% | 0% |
| deepseek-v3.2 | 0.281 | 0.400 | 0.500 | **7%** | 76% | 59% |
| gemini-2.5-flash | 0.256 | 0.312 | 0.381 | 27% | 50% | 0% |

Findings: (a) the v2.1 flat band (0.26-0.34) opens to 0.38-0.71 on facts and the
ordering CHANGES (mistral/grok lead facts; gemini-3-flash mid-pack) — the split
measures something prose overlap could not see; (b) root accuracy is the
discriminator (7%-50%) — the fabricated/omitted-etymology class, now mechanical;
(c) senseF1 > contentF1 for every model, confirming tooltip prose dragged scores
for true-but-differently-worded content; (d) **morph checks are too sparse to
carry ranked weight** (17 checks / 30 phases — golden morph hints live on few
suffix segments): before v2.2 either enrich golden morph fields or fold morph
into an unweighted diagnostic column.

## Implementation decisions (part 1, as built)

- **Sense tokens = the senses' `english` strings only.** Nuance is Claude-worded
  prose → judge territory, same as tooltips. (Refines the scoping text's "SENSES
  arrays"; the DPD-verbatim guarantee from golden v2 covers `english`, not nuance.)
- **Silence on a graded fact is WRONG, not ungraded** — otherwise models learn to
  omit facts to stay safe, the survivorship shape SUTTA-012 killed. Follow-up for
  the report: split the root column into fabricated-vs-silent so the hallucination
  question stays separately answerable.
- **Root authority = DPD root set for the surface (homonym union + Sanskrit
  brackets), falling back to the golden's own √tooltips** for DPD-unresolvable
  words. POS authority = golden wordClass (DPD-verified upstream by verify-golden).

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

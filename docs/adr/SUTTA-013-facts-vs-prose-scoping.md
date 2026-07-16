# SUTTA-013 — Facts-vs-prose scoring split (scoping) + alignment golden (scoping)

**Status:** Parts 1 AND 2 IMPLEMENTED as advisory (part 1: 2026-07-03; part 2 +
refinements: 2026-07-10/11). Ranked-total wiring waits for the v2.2 bump with
SUTTA-014. Target: rubric v2.2.
**Why:** the two remaining validity gaps the operator prioritized after v2.1/golden-v2.

## Part 2 as built (2026-07-10/11) — alignment golden v1 + Align scorer

The scoped "curator + adversarial skeptic per phrase" workflow was REDESIGNED
before spending: a dictionary-anchored MECHANICAL draft first (golden-sense/DPD
gloss tokens matched against Sujato's phrase under a strict unambiguity rule),
model curation only for the residue. Result: 160 links + 117 ghost tags,
provenance layered per link (71 mechanical, 3 mechanical+extended, 86 curated =
gemini-3-flash proposal surviving a grok-4.20 skeptic; extensions each
skeptic-proposed AND curator-confirmed), invariants enforced in the assembly
code (caught 59 hallucinated token indexes). Disclosed holes: 68% of content
words linked; 55 tokens unclassified (logged); mn10:4.9 ungraded (its segment's
baseEnglish is EMPTY — Sujato merges segments). ~70 API calls total.

Align scorer: F1 over (golden word ↔ english token) pairs; tokens identified by
INDEX-VERIFIED matching with folded-text+occurrence fallback; both link
encodings normalized; golden-silent words ungraded; dropped words owe their
links; empty-English groups ungraded. Dry run over stored outputs (free):

| model | alignF1 | P | R |
|---|---|---|---|
| mistral-small-3.2 | 0.694 | 0.725 | 0.715 |
| grok-4.20 | 0.682 | 0.718 | 0.695 |
| deepseek-v3.2 | 0.619 | 0.677 | 0.604 |
| gemini-3-flash | 0.612 | 0.711 | 0.589 |
| deepseek-v4-flash | 0.572 | 0.655 | 0.586 |
| gemini-2.5-flash | 0.542 | 0.713 | 0.466 |
| qwen3-235b | 0.451 | 0.497 | 0.524 |

mistral leads alignment AND facts while sitting 3rd on v2.1 contentF1 — the
prose-overlap metric was hiding real strengths (the ADR's thesis, twice over).

## Morph redesign (2026-07-11) — consistency vs DPD readings, not golden enrichment

The morph-sparsity problem (17 checks/30 phases) is solved WITHOUT touching the
golden: DPD's lookup.grammar carries every legitimate analysis of an inflected
form (kāye → acc pl | loc sg …), extracted per sutta by
`extract-dpd-grammar.ts` (mn10: 66/98 content surfaces). The check is now
CONSISTENCY: graded only on words where the model ASSERTED morph, correct iff
the assertion fits SOME legitimate reading (fabricated case/number = fits none;
contextual disambiguation stays judge territory). Because the prompt only
exemplifies morph, omission is NOT charged — a separate morphCoverage stat
makes it visible (grok asserts on 90% of eligible words at 99% consistency;
gemini-2.5/gemma assert none). If v2.2 wants morph REQUIRED, strengthen the
prompt first, then flip to silence-is-wrong.

## Weight selection (2026-07-10) — measured, not hand-picked

A 6-point weight grid over stored outputs shows the v2.2 fidelity ranking is
STABLE across all reasonable weightings (one adjacent swap) — the proposed
0.4·seg + 0.3·facts + 0.3·sense is disclosable as "the ordering does not
depend on this choice". MEASURED CAVEAT: rank agreement with the semantic
judge is NEGATIVE (ρ≈-0.27) because the judge grades only surviving words
(survivorship) — judge agreement is invalid as a weight-selection criterion,
and the judge's own scores must never be read as drop-adjusted.

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

## Amendment — 2026-07-16: v2.2 formula implemented (final-score weights)

The reviewer flagged (#3) that "40/30/30" was underspecified — the *fidelity*-internal weights
nested inside the v2.1 `0.60·fidelity + 0.25·usability + 0.15·richness`, or the final score?
**Operator decision: they are the FINAL-score weights.** So the ranked score is now:

```
overall = gateFactor × (0.40·segmentationF1 + 0.30·factsCore + 0.30·senseF1)
```

Implemented in `quality-scorer.ts` (`RUBRIC_VERSION` → `2.2`; leaderboard `RANKED_RUBRIC_VERSION`
→ `2.2`):
- `segmentationF1` — morpheme-boundary micro-F1 vs golden (unchanged).
- `factsCore` — root + word-class macro from `scoreFactsDetail`. Morphology is EXCLUDED (advisory)
  this cycle, per the recommendation; its gaming + vocabulary were fixed separately (review #4), so
  it can be promoted later.
- `senseF1` — strict sense-english micro-F1 (`scoreSenseFidelityDetail`, SUTTA-012 drop-penalised).
- **Usability and richness are RETIRED from rank** (still computed for display). Alignment, the LLM
  judge and the reader probe stay advisory.
- Missing components (e.g. a function-only phase with no golden senses) renormalise over the present
  weights rather than being charged 0.

This is a rubric bump: v2.1 and v2.2 scores are not comparable (the version gate enforces it), so it
lands BEFORE the next multi-model pass and needs a full fleet re-run. Board columns for factsCore /
senseF1 and the fleet re-run are the remaining follow-ups.

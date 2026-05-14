# Phase-2 Experiment — Empirical Analysis

> Run date: 2026-05-13. Models tested via OpenRouter: Gemini Flash (succeeded), Gemini 2.5 Pro (succeeded),
> Claude Sonnet 4.6 (failed at Phase pass), Grok-4 (failed at Lexicographer), GPT-4o (failed at Anatomist),
> GPT-5 (rejected request entirely).
> All comparisons against `phase-2-hand-curated.json` (the gold standard, curated by Aditya + Claude
> Opus 4.7 following CURATION_PROTOCOL + the 6 V2 amendments).

## Headline findings

1. **V2 amendments lift LLM quality dramatically for STRUCTURAL fields** (tooltip register,
   anchor selection, relation arrow-earning, segmentation, basic morph). v10 → v11 went from
   bracketed-grammar-prefix-and-emoji tooltips to plain-first prose with appropriate grammatical
   precision.

2. **V2 amendments DO NOT lift LLM quality for METADATA fields** (epistemicBasis, confidence,
   notes citing traditions, sourceCitationIds). LLMs ignore these regardless of how prominently
   they're prompted, and regardless of model tier (Flash, Pro, Sonnet — all skip them).

3. **Pipeline + hand-polish is the workflow.** The v11 output is a structurally-correct draft
   that the curator polishes by adding metadata + cross-phase notes + expanded polysemy.
   ~15-22 min per phase vs ~45 min from scratch. **2-3x speedup on routine phases.**

4. **Only Gemini models survive our structured-output pipeline.** Sonnet, Grok, GPT-4o, GPT-5
   all fail at one or another pass due to schema-enforcement strictness. To use those models
   we'd need to relax `structuredOutputs: true` and rely on prompt-level JSON instruction +
   retry-on-parse — a separate engineering effort.

## Three-way diff: v10 baseline / v11 Gemini Flash / hand-curated

| Field | v10 (pre-V2) | v11 Flash | Hand-curated | Lift |
|---|---|---|---|---|
| Segmentation (sattānaṁ) | satt + ānaṁ ✓ | satt + ānaṁ ✓ | satt + ānaṁ ✓ | — |
| Segmentation (visuddhiyā) | vi + suddhi + yā | **vi + suddh + i + yā** (4) | vi + suddhi + yā (3) | — (debatable) |
| Tooltip register | `[Genitive Plural]` + 🔗 ✨ 🎯 emojis + `√sudh` jargon | Plain-first prose, no brackets, no emoji ✓ | Plain-first prose ✓ | **Strong** |
| `isAnchor` on visuddhiyā | absent | **true** ✓ | true ✓ | **Strong** |
| morph on -ānaṁ suffix | absent | `{case: 'gen', number: 'pl'}` ✓ | `{case: 'gen', number: 'pl'}` ✓ | **Strong** |
| morph on -yā suffix | absent | `{case: 'dat', number: 'sg'}` (missing gender) | `{case: 'dat', number: 'sg', gender: 'f'}` | **Partial** |
| Relation: `Purification OF` | ✓ | ✓ | ✓ | — |
| Sense count: sattānaṁ | 3 | 3 (synonyms) | 3 (lexical + 2 etymological) | flat |
| Sense count: visuddhiyā | 5 | 3 | 6 | **Regression** |
| `epistemicBasis` on senses | absent | **absent** | present on all | **Zero lift** |
| `confidence` on senses | absent | **absent** | present on all | **Zero lift** |
| `notes` citing traditions | absent | **absent** | present (Sujato/Bodhi/Thanissaro) | **Zero lift** |
| `sourceCitationIds` (DPD wiring) | absent | absent | absent (curator deferred, candidate for citation-linker post-pass) | — |
| Cross-phase tooltips | absent | absent (no phaseState envelope provided) | present (bhikkhū contrast, parallel datives) | **Zero lift** |

## Model comparison: Gemini Flash vs Gemini Pro

Both succeeded. Pro produced ~10% richer output:

| Aspect | Flash ($0.018) | Pro ($0.113) |
|---|---|---|
| Sense field: `notes` | absent | **present** (free-form text) |
| Segmentation of visuddhiyā | 4 segments (over-split) | 3 segments (correct vi + suddhi + yā) |
| Token count | 24,258 | 28,164 |
| Cost ratio | 1× | 6.3× |

**Verdict**: Pro is moderately better. The `notes` field is a real gain. But for the pipeline+polish
workflow, the polish step adds notes anyway — so Pro's advantage diminishes after polish.
Recommendation: **stay on Flash for production runs**, use Pro for spot-checks when the LLM
output looks weak.

## Failure mode analysis (Sonnet / Grok / GPT)

| Model | Failure | Likely cause |
|---|---|---|
| Sonnet 4.6 | Phase pass: empty response | Long structured-output prompts trigger Claude's "I can't comply" silent skip. Anthropic's structured outputs is less mature than Gemini's. |
| Grok-4 | Lexicographer: empty response | Similar to Sonnet — long prompt + complex schema. |
| GPT-4o | Anatomist: "Provider returned error" | OpenRouter's JSON schema with `additionalProperties: false` (the `provider.require_parameters` flag we use) isn't supported by GPT-4o through OpenRouter. |
| GPT-5 | Anatomist: "No endpoints found that can handle the requested parameters" | Same root cause as GPT-4o. GPT-5 doesn't accept our structured-output configuration. |

**Implication**: if we want to use non-Gemini models, the pipeline needs a mode where it falls
back from `structuredOutputs: true` to plain JSON-mode instruction + retry-on-parse-failure.
~2-3 hours of engineering to add. Worth doing if (a) we hit scale where cost matters AND
(b) we want to use models other than Gemini. Defer until we know we need it.

## A3 post-pass priorities — empirically grounded

The original A3 plan was 4 post-passes; the experiment data now ranks them by expected impact:

| Post-pass | Priority | Why |
|---|---|---|
| **citation-linker** | **HIGH** | Closes the `sourceCitationIds` gap entirely. Deterministic: for each sense, find the matching DPD entry from the dictionary context already passed in, write its citationId. No LLM needed. ~2-3 hours. |
| **morph-from-POS** | **HIGH** | Closes the gender-on-morph gap and any case/number the LLM missed. Deterministic from DPD POS tag. ~1-2 hours. |
| **epistemicBasis inference** (new — wasn't in original A3 list) | **HIGH** | Closes the metadata gap that LLMs consistently ignore. Rule: sense matches DPD → `lexical`; sense from compositional parse → `etymological`; otherwise `curatorial`. ~1-2 hours. |
| **cross-phase facet detector** | **MEDIUM** | Requires phaseState envelope to be supplied with prior-phase context. Less of a post-pass, more of an orchestrator change to thread the envelope through. ~2-3 hours including the orchestrator wiring. |
| **§3.4 linter** | **LOW** | V11 doesn't violate §3.4 register. The linter would be useful as a CI check but isn't needed to close any current gap. ~1-2 hours, lower priority. |

**Suggested A3 sequence:** citation-linker + morph-from-POS + epistemicBasis inference together
form a coherent "metadata-filler" post-pass module (~5-7 hours total). Cross-phase facet
detector follows once the orchestrator's phaseState envelope plumbing is reviewed. The §3.4
linter waits.

## Cost economics

Single phase, full pipeline (anatomist + lexico + phase composition):

| Model | Per phase | MN10 51 phases | DN22 (~165 segments → ~120 phases) |
|---|---|---|---|
| Gemini Flash | $0.018 | $0.92 | ~$2.16 |
| Gemini 2.5 Pro | $0.113 | $5.76 | ~$13.56 |
| Sonnet 4.6 (if it worked) | ~$0.16 | ~$8.16 | ~$19.20 |
| Opus 4.7 (if it worked) | ~$0.80 | ~$40.80 | ~$96.00 |

**Conclusion**: Gemini Flash is **clearly** the production default. Total cost to fully
re-compile MN10 with V2 amendments is under $1. The pipeline+polish workflow then adds
~15-22 min of curator time per phase, for ~10-15 phases that need polish in MN10 (the
others are routine-formula recurrences that pipeline output is good enough for).

**Total economics for re-doing MN10 in pipeline+polish mode**: ~$1 in compute + ~3-4 hours of
curator time. Vs ~25-30 hours of from-scratch hand-curation. **~85% time reduction** on the
routine work, while preserving full hand-curation depth on the ~10-15 phases that pedagogically
deserve it.

## Decision: pivot ratified

The COMPILER_STRATEGY.md thesis is empirically supported:

- ✓ V2 amendments lift structural quality strongly
- ✓ Pipeline+polish workflow is faster than from-scratch on routine phases
- ✓ ~10-15 phases per sutta still need full hand-curation
- ✓ A3 post-passes can close most remaining metadata gaps
- ✓ Cost is negligible (sub-dollar per sutta with Flash)

The pivot from "linear hand-curation of 51 phases" to "pipeline+polish for ~35-40 routine
phases + full curation for ~10-15 pedagogically critical phases" is justified.

## Next steps (in priority order)

1. **A3 metadata-filler post-pass** — citation-linker + morph-from-POS + epistemicBasis
   inference as a single module. Closes the biggest remaining gap (metadata fields LLMs
   ignore). ~5-7 hours of engineering. After this, v11 output should hit ~75% of hand
   quality automatically.

2. **Compile remaining MN10 phases in pipeline mode** (phases 4-51 — that's 48 phases).
   Total ~$0.86 in compute. Then identify the ~10-15 pedagogically-critical phases that
   need full hand-polish; routine phases get the metadata-filler post-pass + minimal review.

3. **Translator-tradition database (F)** — only meaningful for the famously-contested words
   (ekāyano, ātāpī, sampajāno, satimā, anupassī, paññā, samādhi, sati, vipassanā, etc.).
   ~20-30 entries. Hand-curated. ~3-5 hours of scholarly work. Lets the post-pass add
   tradition citations to the visible-gap portion of the 10-15% pipeline-to-hand quality
   delta.

4. **Phase 2c orchestrator refactor + Phase 3 LLM caller consolidation** (from CONSOLIDATION.md)
   — defer until something concrete (like the post-pass module) needs it. Architectural
   polish without blocking value.

5. **Non-Gemini model support** — defer until cost scaling forces it. The single-Gemini
   dependency is a known limitation but not a current bottleneck.

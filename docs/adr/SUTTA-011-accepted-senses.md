# SUTTA-011 — Golden expansion via DPD-attested "accepted" senses

**Status:** Implemented, **pending dual-family review** (touches the SUTTA-009 ranked metric).
**Date:** 2026-07-01

## Problem

Content-F1 (SUTTA-009) is symmetric micro-token-F1 of a model's etymology+glosses vs the
golden. Across the 3-model, 30-phase board Content sat at ~0.30–0.35 while the semantic
LLM-judge saw the same output at ~0.82. Diagnostic on the real outputs:

| model | sense-token F1 | tp | fp | fn |
|---|---|---|---|---|
| gemini-3-flash | 0.47 | 168 | 152 | 221 |
| deepseek-v3.2 | 0.44 | 161 | 168 | 242 |

Sampling the FPs (model senses "not in golden") showed ~40% are **correct, DPD-attested
alternates** the golden's short curated list omits: `nibbāna→extinguishment/emancipation`,
`satta→creature/sentient`, `dukkha→stress`, `visuddhi→purity`. Good models were being
penalised for right answers.

## Decision

Keep the golden's **core** senses as the recall reference, and add a per-word **accepted**
set = the DPD English senses for that word (`data/dpd/mn10`). In `scoreContentFidelity`:

- `tp` — model token in the **core** golden (unchanged).
- `fp` — model token in **neither** core **nor** accepted (i.e. not DPD-attested → a
  genuine hallucination). Attested alternates go **neutral** (no reward, no penalty).
- `fn` — core golden token missing from the model (**unchanged** — recall vs core only).

This is *not* the recall-weighting SUTTA-009 rejected as "synonym-spraying": random extra
words are not DPD-attested, so they still count as `fp`; and because `fn` is unchanged, a
model cannot raise its score by omitting content. It is the SUTTA-009 "golden-update
protocol" (model exceeds golden → widen the golden) done at scale, sourced from DPD rather
than by hand.

## Effect (measured, sense-token F1)

gemini-3-flash 0.47→0.53 · deepseek 0.44→0.52 · gemini-2.5-flash 0.49→0.55. Only attested
alternates were neutralised (79 / 108 / 69 tokens). 15-test regression vector stays green
(no-op when `acceptedSenses` is absent).

## Known limitations (for the review)

- The accepted set currently unions **all DPD homonyms** of a surface, so an in-context-wrong
  but attested homonym sense (e.g. `satta→"seven"` for *beings*) also goes neutral. Mildly
  over-generous; core `tp`/`fn` still measure the right sense. A homonym-disambiguated
  accepted set would tighten this.
- The golden itself still carries a few wrong core senses (e.g. `sattānaṁ→"seven types"`) —
  a separate golden-correctness pass (cf. the DPD folk-etymology fixes).

## Files
`scripts/sutta-studio/expand-golden-accepted.ts` (generator) ·
`scripts/sutta-studio/quality-scorer.ts` (`wordAcceptedTokens` + `scoreContentFidelity`) ·
`test-fixtures/sutta-studio-lexicographer-golden.json` (`acceptedSenses` per word).

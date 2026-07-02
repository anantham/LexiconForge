# SUTTA-012 — Metric v2.1: dropped golden words owe their content; expose precision/recall

**Status:** Accepted, implemented (rubric `2.1`)
**Date:** 2026-07-02

## Problem (two holes found while auditing fairness with the operator)

1. **Survivorship bias.** v2.0 fidelity (seg + content F1) pooled counts only over
   *surface-aligned* words. A golden word the model **dropped entirely** contributed
   nothing — so skipping hard words inflated fidelity. Measured on the live board:
   gemini-2.5-flash dropped **59/144 (41%)** of golden words yet posted competitive
   per-kept-word fidelity (seg 0.54); the only prices paid were the gate's soft factor
   (paliWordCoverage is ¼ of a [0.7, 1.0] swing ≈ ≤2.2% of overall) and a display column.
2. **F1 hid the two dimensions.** Operators asking "is the model *wrong* or *incomplete*?"
   could not tell: only the harmonic mean was reported. Computed from the published token
   diffs, precision was nearly flat across all 7 models (0.29–0.37, the statistical
   signature of a too-thin golden), while recall separated them (0.27–0.43) — invisible
   on the v2.0 board.

## Decision

- **Drop penalty**: in `scoreSegmentationFidelity` and `scoreContentFidelity(Detail)`,
  every unaligned golden word now charges its boundaries / knowledge tokens as false
  negatives. Unaligned *model* words stay unpenalized (a golden silent on a model's
  extra word is a golden gap, not a model error — SUTTA-009's golden-update protocol).
- **Decomposition**: `scoreContentFidelityDetail` returns `{f1, precision, recall, tp, fp, fn}`;
  `QualityScore` gains `contentPrecision`/`contentRecall`; the board gains P and R columns;
  the compare View's phase strip shows them per phase.
- `RUBRIC_VERSION` and `RANKED_RUBRIC_VERSION` bump to `2.1` — v2.0 scores are not
  comparable (droppers score lower now) and must be re-scored via backfill before ranking.

## Consequences

- Models that drop golden words (gemini-2.5-flash 41%, gemini-3-flash 29%, deepseek-v4 26%)
  lose fidelity roughly in proportion to what they skipped; full-coverage models are
  unaffected. Ranking shifts are expected and *correct*.
- Regression tests: a model that keeps only the easy word of a two-word golden used to
  score seg/content **1.0**; it now scores seg 0.5 and content < 1 with precision 1 /
  recall < 1 (`quality-scorer.test.ts`, "v2.1 drop penalty").
- Companion change (golden v2, same session): context-valid DPD senses are curated into
  the core golden per SUTTA-011 path B, raising everyone's precision honestly. The two
  changes land in one board republish.

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

## Second opinion (codex gpt-5.5, plan-level review, 2026-07-02) — verdict REVISE, dispositions

Requested by the operator as an independent check before republish. 12 findings; how each landed:

| # | Finding (abridged) | Disposition |
|---|---|---|
| 1 | drop-fn is the right survivorship fix; the gate term can't substitute | agreement — no change |
| 2 | **blocking**: unpenalized unaligned MODEL words = insertion gaming vector | **assessed not exploitable here**: unaligned model words can never earn tp (fidelity and judge score only golden-aligned words), inserted words add no gate credit (all gate terms are ratios), and post-v2.1 breaking alignment CHARGES the dropped golden word. Documented as a watch-item; revisit if tp paths ever open to unaligned words |
| 3+4 | core additions must be "expected competent answer", not merely context-true, or widened golden punishes concise-correct models | **acted on**: dropped the 4 commentarial "(comm) …" additions from core (13 adds remain); commentary stays judge-rewarded enrichment |
| 5 | Claude-phrased golden wording could contaminate token-F1 | mitigated by design: sense additions are DPD-verbatim (hard guard); the 3 free-text tooltip rewrites (falsehood fixes) are disclosed to the operator |
| 6 | DPD coverage/granularity becomes benchmark truth; need an attested-but-not-in-DPD escape path | accepted as policy: tooltip-fix path already bypasses DPD; a non-DPD sense addition requires an ADR note + operator sign-off (this line is that policy) |
| 7 | rebaselining embedded goldens is provenance-risky | **acted on**: reports/ is gitignored (originals were NOT in git) → refresh now snapshots the run-time golden per run dir (`golden-v1-snapshot.json`) and stamps each file `goldenRebaselined` |
| 8 | **blocking**: never mix runs from different pipeline conditions | already satisfied (all ranked runs use the identical harness); made explicit in the published methodology text |
| 9 | judge trusting the golden propagates golden errors into semantic scores | **acted on**: judge now emits a `goldenSuspect` flag per word (golden-QA telemetry, shown in the View); scoring semantics unchanged — the judge does not get override power |
| 10 | don't claim fairness fixed while split alternates are deferred | **acted on**: methodology text names alternate segmentations as a known limitation; this ADR does the same |
| 11 | clarify what drives rank | methodology text now states ranking is overallScore only |
| 12 | regression tests for drop-fn + mixed-version build failure | drop-fn tests exist (this ADR); generate-leaderboard now HARD-FAILS on a 0-entry board instead of publishing an empty ranking |

Still deferred after this round: dictionary-attested alternate segmentations (unfairness #3)
and benchmark↔production parity (#19). The board is a *relative* ranking under an identical
harness; publish language must not claim more.

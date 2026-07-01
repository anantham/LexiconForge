# SUTTA-010: Semantic Content Judge — reward enrichment, penalize hallucination

**Date:** 2026-07-01
**Status:** Proposed — built + empirically validated on MN10; **pending cross-family review** (grok-build + agy/Gemini) before it becomes authoritative, per the SUTTA-009 gate.
**Authors:** Aditya + Opus 4.8
**Companions:** SUTTA-009 (the deterministic Gate/Fidelity/Usability rubric this sits beside), SUTTA-008 (the golden/provider substrate), SUTTA-005 (leaderboard)

## TL;DR

SUTTA-009's `contentFidelity` is a **strict token-F1 against one golden**. It is excellent at catching *regressions* (lumping, sandhi, garbage) but it is **structurally unable to reward enrichment**: a model that adds correct commentarial depth — or simply words a correct gloss differently — scores *lower*, not higher, because its tokens diverge from the golden's idiosyncratic phrasing. We proved this empirically (below): grounding models with real Vism/commentarial context did not raise `contentFidelity`, and token-F1 collapsed two clearly-different models to an identical 0.34. This ADR adds a **second, optional content dimension** — an LLM examiner (`contentSemantic`) that scores each aligned word with a deliberately **asymmetric** rubric: reward correct enrichment, ignore paraphrase, penalize hallucination hard, penalize omission mildly. It is a *separate* dimension, never part of the ranked deterministic total, so reproducibility (SUTTA-009) holds.

## Context

### The ceiling token-F1 can't break

`contentFidelity` pools TP/FP/FN of *knowledge tokens* (anatomist tooltips + lexicographer senses) against the golden, then takes one micro-F1. Two failure modes are baked into the metric, not the models:

1. **Paraphrase is punished.** The golden says a hindrance gloss with a specific synecdoche note; the model says the same thing in its own words. Different tokens → false positives + false negatives → lower F1, despite being correct.
2. **Enrichment is punished.** A model that adds a *correct* extra fact the golden lacks (a Jātaka etymology, a translator debate, a finer morpheme gloss) adds tokens the golden doesn't have → precision drops → F1 drops. The metric literally cannot score "better than golden."

### The evidence (MN10, `deepseek-v3.2` + `gemini-2.5-flash`, phase-ab + phase-d, held-out test phases)

- **The tie that shouldn't be.** `contentFidelity`: deepseek **0.336**, gemini **0.340** — indistinguishable. Yet the outputs are visibly different in quality (deepseek segments perfectly, gemini writes richer glosses). Token-F1 threw that signal away.
- **Grounding-as-input (SUTTA-009 companion experiment, task #20) did not move it.** Feeding the Anatomist/Lexicographer the 909-entry Ñāṇamoli Vism glossary + curated translator renderings *as prompt context* left content flat-to-worse (deepseek 0.336 → 0.232), because the grounded output diverged further from the golden's exact wording (and, in the naive version, caused morpheme lumping). Crucially, **the semantic judge confirmed grounding didn't help either** (deepseek 0.657 → 0.557) — so it was a genuine non-improvement, not a metric artifact. Grounding-as-input is a documented dead-end; its wiring was reverted.

### What the user asked for

> "we should not punish enrichment, I think our benchmark should be smart about this."

## Decision

Add **`contentSemantic`** — an optional, LLM-judged content dimension — implemented in `scripts/sutta-studio/judge-content.ts` and surfaced (but not ranked-on) in the leaderboard.

### The rubric (asymmetric — this is the whole point)

For each golden↔model **aligned** word (LCS by surface, reusing `alignWords`), the judge is given the golden analysis (segmentation, tooltips, senses) and the model analysis of the same word, and scores 0.0–1.0. The asymmetry is on the **penalty** side, not the reward side:

- **FAITHFUL + CORRECT ⇒ ~1.0, even if concise.** A correct analysis that captures the essential meaning scores at the top — it does **not** need extra detail to get there. Conciseness is not a fault. *(This is the fix to the v1 rubric flaw the review caught: capping a perfect faithful match at 0.8 while reserving 1.0 for "enriched" incentivized verbosity/padding — Goodhart. Removed.)*
- **IGNORE PARAPHRASE** — different wording conveying the same correct meaning is never penalized.
- **ENRICHMENT WELCOME, NOT REQUIRED** — correct depth beyond the golden never *lowers* the score, but padding/filler/length for its own sake earns **nothing**. Reward correctness and completeness, not verbosity.
- **PENALIZE HALLUCINATION HARD** — a confident false claim about the Pāli (wrong root, invented etymology, wrong grammatical role, fabricated reference) caps the word at **≤ 0.4** even if the rest is good. This implements the "confidently-wrong-gloss asymmetric penalty" deferred by SUTTA-009: a confident error is worse than an omission. (Longer answers have more room to be wrong — verbosity must not hide an error.)
- **PENALIZE OMISSION MILDLY** — missing an essential golden point docks points, but less than a hallucination.

Anchors: faithful + complete (concise or rich) ≈ 0.95–1.0; faithful with a minor gap ≈ 0.8; missing the core sense ≈ 0.5; a real factual error ≤ 0.4. Only words the golden actually grades (has tooltips or senses) are scored.

### Keeping it reproducible (the SUTTA-009 constraint)

SUTTA-009 deliberately kept LLM-judging **out of the deterministic core** so the benchmark stays reproducible. This ADR honors that:

- `contentSemantic` is a **separate dimension**, never folded into the ranked `overallScore`. The ranked total stays 100% deterministic.
- The judge runs at **temperature 0** with **structured JSON** output. In practice this is stable: re-judging the same run reproduced **0.657 exactly**.
- Every judge score is stamped with `judgeModel` + `judgeVersion` (currently `1.0`). Mixing judge versions/models on one board is treated like mixing rubric versions — a data-hygiene error to surface, not silently average.
- The judge is an **audit lens**, not a gate: it never changes whether a run is "valid"; it adds a quality read the token metric can't provide.

### Leaderboard integration

`generate-leaderboard.ts` reads `judge-scores-<model>.json` (written to the run-dir root) and shows a `Semantic` column beside the deterministic dims; `null`/`—` when no judge run exists. The ranked metric is still deterministic `overallScore`. The board now makes the token-vs-semantic gap legible: token `Content` is a 0.34 tie for all models, while `Semantic` separates them (deepseek 0.61, gemini 0.73).

## Validation

On the runs above, judged by `google/gemini-2.5-flash` at temp 0:

| model | `contentFidelity` (token) | `contentSemantic` (judge) |
|---|---|---|
| deepseek-v3.2 | 0.336 | **0.657** |
| gemini-2.5-flash | 0.340 | **0.733** |

The judge **sees quality token-overlap missed** (2× the score for the same output; separates the models where token-F1 tied them), and its per-word rationales are expert-grade:

- `nigamo` → **0.9 [enriched]**: *"enriches it by explicitly stating the literal meaning of the compound 'a going down into', a correct and valuable addition"* — i.e., scored **above** the golden-match anchor for correct added depth. The asymmetry works.
- `Kammāsadhammaṁ` → **0.4 [error, hallucination]**: *"hallucinates that 'Kammāsa' is a proper name of uncertain meaning… missing the golden's correct etymology and Jātaka reference."* Caught a confident error.
- `abhijjhādomanassaṁ` → **0.5 [omission]**: *"entirely misses the significant synecdochical meaning where these two terms represent all five hindrances."*

## Consequences

**Positive**
- The benchmark can finally reward *better-than-golden* output. It stops penalizing correct enrichment and paraphrase.
- It partially **decouples the benchmark from golden-completeness**: because the judge rewards correct content the golden lacks, a partial golden hurts less than it does under strict token-F1 (relevant to the parallel "improve the golden" work).
- It implements the long-deferred hallucination penalty, and separates models the deterministic content metric couldn't.

**Costs / risks (and mitigations)**
- **Non-determinism.** Mitigated by temp 0 + structured output (reproduced exactly once); flagged as a monitored risk, not eliminated. Reserve for offline scoring, never a CI gate on exact values.
- **Self-judge bias.** Using `gemini-2.5-flash` to judge `gemini-2.5-flash` is biased. For the SUTTA-009 #20 A/B (same model, grounded vs ungrounded) the bias cancels, but for cross-model ranking it does not. **Deferred fix: use a neutral third-party judge** and/or an N-judge panel with disagreement flagged.
- **Cost.** One LLM call per phase per model; bounded, but real. It's opt-in, not part of every run.
- **The judge's own errors.** An LLM judge can be wrong. Mitigation: it is advisory (not ranked), rationales are stored for audit, and a human can spot-check.

## Open questions / deferred

- **Neutral judge + panel.** Swap to a model that is neither contestant; run 2–3 judges and report variance. Calibrate judge scores against a small human-rated set.
- **Golden construction methodology.** The judge measures *against* the golden even as it rewards going beyond it — so golden quality still matters. A companion effort should define how the golden is pushed to "peak" (e.g., learn from several strong models, then freeze it as a static reference and evaluate held-out models against it). This is out of scope here but is the natural next design note.
- **Semantic segmentation?** Segmentation is deterministic and trustworthy; no judge needed there. Keep it as the deterministic anchor of the ranked total.

## Review log

**Round 1 — pre-publish cross-family review (grok-build REVISE, agy/Gemini-3.1-Pro NO-GO).** Reviewed the judge, the leaderboard generator, this ADR, and the actual published board JSON before merging to `main`. Both converged; all must-fixes applied:

| Finding | Source | Fix |
|---|---|---|
| **Verbosity farming** — capping a perfect faithful match at 0.8 while reserving 1.0 for "enriched" forces padding to score top | Gemini | rubric rewritten: faithful+correct ⇒ ~1.0; enrichment welcome but **not required**; padding earns nothing |
| **Self-judge bias live in the board** — gemini-2.5-flash judged itself to the top Semantic score | both | re-judge with a **neutral** `--judge` (non-contestant); `selfJudge` flag written per run + surfaced per row + in the coverageNote |
| **Frankenstein aggregation** — best-per-phase across runs is a score no single run achieved (Goodhart-invites run-spam) | both | switched to **single best run per model** (highest mean overall); use only that run's phases |
| **Summed metrics across runs** — tokens/cost/latency inflated N× | Gemini | metrics taken from the chosen run, not summed |
| **Un-pinned public overwrite + no provenance** | grok | public write gated on `LEADERBOARD_DIRS`; `sourceRunTimestamps` recorded in the JSON |
| **Judge output unvalidated** — a subset/invented wordIds → wrong avg | grok | validate returned words == sent words (ids + score∈[0,1]); skip the phase otherwise |
| **Judge drops whole model on one phase's failure** | both | per-phase try/catch; only drop a model if zero words scored |
| **`packetPath` 404 in prod** | Gemini | the View link is not rendered for gitignored `/reports/` packets |
| **Float noise** (`0.8000000000000002`) | both | all published scores rounded to 4 dp |

Both reviewers noted the honesty framing (caveats, deterministic-vs-advisory split, exclusion transparency) was already strong; the gate was execution + the self-judge in the live data. A neutral-judge re-run + re-review is required before GO.

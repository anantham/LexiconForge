# SUTTA-009: Principled Benchmark Scoring — Gate / Fidelity / Usability

**Date:** 2026-06-30
**Status:** v2.0 spec — hardened across two review rounds (grok-build ×2 → REVISE, Gemini-3.1-Pro-High → NO-GO); findings reconciled below (Gemini overrides grok on recall-weighting, fidelity weight, matching, and `paliWordCoverage`). Ready to implement.
**Authors:** Aditya + Opus 4.8
**Companions:** SUTTA-004 (benchmark development phases), SUTTA-005 (benchmark leaderboard), SUTTA-008 (grounded curation data layer — the golden/provider substrate this relies on)

## TL;DR

The sutta-studio benchmark scorer (`scripts/sutta-studio/quality-scorer.ts`) measured **output density**, not **quality**. It never read the golden packet until very recently, and several of its dimensions set arbitrary "produce N of X" targets (2 tooltips/segment, 3 senses/word, morph on every segment, 0.5 relations/content-word). Those targets reward volume and are actively gamed by *wrong* behavior — most sharply, lumping a word into a single un-split stem earns a vacuous perfect morphology score. We have now fixed the same underlying bug four separate times in four metrics. This ADR replaces the ad-hoc dimension bag with a rule: **every metric must be exactly one of three kinds — a structural Gate, a Fidelity measure against the expert golden, or a Usability measure of a genuine user-facing property.** Anything that sets an arbitrary volume target is removed; quality is measured by agreement with the golden, not by how much the model emitted.

## Context

### What's broken

The scorer's dimensions were "empirically derived" by eyeballing a couple of models' outputs. In practice they encode *density heuristics with invented thresholds*:

- `tooltipDensity = min(1, avgTooltipsPerSegment / 2)` — "2 tooltips per segment = 100%".
- `sensePolysemy` — credits up to 3 senses for content words, 1.5 for function words.
- `morphDataPresent = segmentsWithMorph / totalSegments` — wanted morphology on *every* segment.
- `relationDensity = min(1, relationCount / (contentWords * 0.5))` — "~0.5 arrows per content word".

None of these compared the output to the curated golden packet. `scorePhase()` only ever read `data.output.*`. So the scorer could not see whether a gloss was *correct* — only whether enough glosses existed.

This produces three failure modes, all observed empirically on MN10 with `deepseek-v4-flash`:

1. **Correctness is invisible.** Grounding the Anatomist/Lexicographer with the Digital Pāli Dictionary fixed real errors — `nigamo` gloss "village" → "market town"; `kammāsa` "cloth or color" → "spotted" — yet the overall score moved +0.006 (noise). The rubric counts senses by *number*, not *accuracy*, so a fix and a non-fix score identically.

2. **Wrong behavior is rewarded.** When DPD grounding caused the model to stop splitting morphemes (it anchored on the dictionary *headword* and emitted one lumped stem), the old rubric scored that run *flat-to-better*. A lumped word has no suffix segments, so `morphDataPresent` returns a vacuous `1.0` ("nothing to tag → full marks"), and its few segments carry dense tooltips, so `tooltipDensity` is high. The model got worse and the score went up.

3. **Whack-a-mole.** We fixed `morphDataPresent` (score only suffix segments), then `tooltipDensity` (→ coverage, split-invariant), and the artifact simply reappeared in the next metric: after both fixes, the *lumped* run still scored **highest** on richness (0.958) versus the correctly-split run (0.710), because the vacuous `morphDataPresent = 1.0` and per-segment effects still favor fewer, denser segments. Patching individual thresholds does not converge.

### What already exists (and points the way)

- **SUTTA-008** established a typed Provider layer and the principle that *every factual claim traces to a source*. It gives us curated golden packets per phase and a notion of grounded correctness.
- The recent fidelity work (the immediately-prior change) added the first two metrics that actually read the golden: `segmentationFidelity` (morpheme-boundary F1 vs golden, matched by surface) and `contentFidelity` (etymology + gloss token-F1 vs golden). These immediately did their job: they ranked the lumped run *below* the split run and caught the regression the density metrics missed. They are the template for the whole rubric.

### What the user has said this should become

> "I want to understand why we have a lot of rubrics that don't make sense. We should clean it up. We should have clear work on why we are using each rubric."

Every metric must justify its existence. A metric that cannot be explained as "this is structurally invalid output" or "this disagrees with the expert" or "this hurts the reader" does not belong.

## Decision

### Principle

**Every scoring metric must be exactly one of three kinds:**

1. **Gate** — an objective structural-validity check. The output is malformed or it is not. (Does it reconstruct? Are there empty segments? Do alignment links duplicate? Do relation refs resolve?) A Gate is correctness, not credit.
2. **Fidelity** — agreement with the curated expert golden, matched word-by-word by surface form. (Do the morpheme boundaries match? Does the etymology/gloss content match? Do the relations match?) Fidelity is the *only* quality signal.
3. **Usability** — a genuine, objective, user-facing property. (Are the Pāli↔English alignment links present? Does the English read in source order? Is there an entry per Pāli word?)

**Any metric that sets an arbitrary "produce N of X" target is removed.** Quality is measured by agreement with the golden, never by output volume. If we want the model to be "rich," we measure richness as *fidelity to a rich golden*, not as a raw count against an invented threshold.

### The rubric, restructured

| Bucket | Metrics | Kind | Notes |
|---|---|---|---|
| **Validity (Gate)** | `textIntegrity`, `noEmptySegments`, `noDuplicateMappings`, `relationsValid`, `paliWordCoverage` | structural | objective; failures multiply the score down (gateFactor), they are not soft credit. `paliWordCoverage` moved here (Gemini): translating 10% of the text is a structural failure, not a UX nicety. |
| **Fidelity** | `segmentationFidelity`, `contentFidelity` (+ future `relationFidelity`, `layoutFidelity`) | vs golden | the core quality measure, strict micro-F1 over sequence-aligned words |
| **Usability** | `alignmentCoverage`, `englishOrderScore` | user-facing | objective properties, not invented targets |

**Removed entirely** (arbitrary volume targets, now subsumed by Fidelity):

- `sensePolysemy` — "have 3 senses" is arbitrary; gloss quality is `contentFidelity`'s job.
- `morphDataPresent` — vacuous `1.0` on lumped words; if we want morphology, measure it as `relationFidelity`-style agreement with the golden's `MorphHint`s, not as raw presence.
- `relationDensity` — "0.5 arrows per content word" contradicts the project's own rule (nominative/accusative/vocative words get no arrow); replace with relation agreement vs golden.
- `tooltipDensity` — already converted to `tooltipCoverage`; with quality moved to `contentFidelity`, even the coverage signal is at most a minor Usability nicety, not a richness score.

**Demoted:** `englishMappingRatio` (the weaver "non-ghost token" fraction) is a structural internal, not a quality signal — fold into Validity or drop.

### Scoring formula (v2.0, hardened across two review rounds)

Validity is a **multiplier**, not an additive bucket. `textIntegrity` (do a word's segments concatenate back to its surface?) is the **fraction** of words that reconstruct, and it multiplies the score directly — total corruption → 0 (Gemini #4: garbage must not bank credit and outrank a model that got the text right), while a single Pāli **sandhi** slip (`loka`+`e` → surface `loke`, so the stem split doesn't literally concatenate) is a *proportional* dent, not a binary cliff (resolving grok's "binary-per-phase is too harsh"). This calibration was found by validating v2.0 on real MN10 runs, where a hard `0.1` cap crushed a mostly-correct phase to 0.059 over 4 sandhi slips:

```
overall    = gateFactor × ( wF·Fidelity + wU·Usability + wR·TransitionalRichness )

gateFactor = textIntegrity × softFactor
  textIntegrity = fraction of words whose segments concatenate back to the surface (0..1)
  softFactor    = 0.7 + 0.3 · mean(noEmptySegments, noDuplicateMappings, relationsValid, paliWordCoverage)

Fidelity             = 0.5·segmentationFidelity + 0.5·contentFidelity   // a null component is dropped + the other renormalized
Usability            = mean(alignmentCoverage, englishOrderScore)
TransitionalRichness = mean(tooltipCoverage, sensePolysemy, morphDataPresent)
```

**Weights (v2.0): wF 0.60, wU 0.25, wR 0.15.** Fidelity dominates (Gemini overrides grok's 0.40 cap): keeping the *proven-bad* density metrics heavy guarantees the lumping exploit survives. The old metrics are **kept computed but capped at wR 0.15** — small enough that the lumping advantage (≈0.24 richness × 0.15 ≈ 0.036 overall) is dwarfed by the fidelity swing it causes (≈0.30) — which reconciles grok's "don't delete before replacements exist" with Gemini's "shrink it hard." v2.1 retires wR once `relationFidelity` + morph-agreement land.

**Fidelity uses strict balanced F1 (β=1), NOT Fβ** — this reverses grok's must-fix #1. Gemini: recall-weighting rewards "synonym spraying" (vomit comma-separated synonyms to farm recall) — it just swaps the lumping game for a spamming game. The metric stays strict; "model exceeds the golden" is handled **only** by the golden-update protocol + a surpass regression test: *fix the data, never warp the instrument.*

**Fidelity is micro-F1, not macro** (Gemini #3): aggregate TP / FP / FN across **all aligned words in the phase**, then compute one F1 — so a 20-token compound carries more weight than a 1-token particle, and tiny per-word samples don't inject noise.

**No-golden phases are excluded from the ranked leaderboard entirely** — separate, explicitly unranked "ungraded" table, never averaged against fidelity-scored runs.

### Surface-form matching — sequence alignment (Gemini #1 overrides Nth-to-Nth)

Golden and model word arrays are aligned by **edit-distance sequence alignment** (LCS / Needleman-Wunsch) over normalized surfaces — NOT positional Nth-to-Nth. Nth-to-Nth *cascades*: if the model drops or merges one instance of a repeated word (e.g. a refrain `iti`), every subsequent instance misaligns, trading a duplication bug for a worse one. Sequence alignment degrades gracefully — a dropped word leaves a single golden word `unmatched` without shifting the rest. The normalized key is `lowercase + Unicode NFC`; a diacritic-fold fallback and DPD-lemma matching for true sandhi are v2.x. Unmatched golden words are recorded `unmatched` (a *coverage* signal, already gated by `paliWordCoverage`), never scored 0.

### Golden maintenance and model-exceeds-golden (review MUST-FIX #1)

Fidelity assumes a *maintained* golden. The protocol: when a model disagrees with the golden and a reviewer (the adjudicator pattern) judges the model **correct**, the resolution is to **update the golden** — never to bank the model's penalty. This carries a standing assumption: **golden curation velocity must keep pace with model improvement**, or Fidelity dominance systematically rewards "matches today's golden" over "best analysis." A regression test vector — a deliberately richer-but-correct model output against a thinner golden — guards that recall-weighting does not punish genuine surpassing.

### Phased transition (review MUST-FIX #6, #7)

The ADR target and the code must not diverge silently. Migration is explicit and `rubricVersion`-stamped:

1. **v2.0 (this change):** add the `gateFactor` multiplier (fractional `textIntegrity` multiplies the gate directly — a *proportional* dent, not a hard cap; see §Validity above), strict **micro-F1** `contentFidelity` + `segmentationFidelity` over **sequence-aligned** words, `paliWordCoverage` moved into the Gate; reweight to **wF 0.60 / wU 0.25 / wR 0.15**; **keep** `sensePolysemy` / `morphDataPresent` / `relationDensity` computed but folded into the reduced-weight transitional-richness bucket (not deleted). The earlier "relations not wholly absent" presence gate is **dropped** — grok's catch: a single dummy relation satisfies it, recreating the exact volume target this ADR bans.
2. **v2.x:** build the fidelity replacements — `relationFidelity` and morph-agreement-vs-golden (`MorphHint` F-score) — and back-fill the golden's missing `MorphHint`s + relations.
3. **v2.1:** retire transitional richness (wR→0), delete the dead density code, raise wF to 0.55.

`rubricVersion` is first-class and CI-enforced: mixing v1 and v2 scores on one leaderboard is a build failure. v1 numbers are strictly archival. The `layoutDimension`/block metrics are demoted out of the headline (treated like `englishMappingRatio` — structural, not a quality signal).

### Versioning

Introduce a `rubricVersion` stamped into every `quality-scores.json` and the leaderboard. This redesign is `v2`. Scores produced under `v1` (density) are **not comparable** to `v2` and must not share a leaderboard.

## Consequences

- **Every ranking changes.** That is the point — the old rankings measured the wrong thing. We re-score all retained MN10 runs under v2 and treat v1 numbers as historical.
- **Fidelity is only as good as the golden.** This makes golden quality load-bearing: the known golden gaps (missing `MorphHint`s, an unencoded phase-ab relation — tracked separately) must be fixed, and the golden is explicitly *not assumed perfect*. Where the model legitimately beats the golden, the fix is to improve the golden, not to discount the model.
- **`contentFidelity` is strict micro-F1 over token sets, and still token-based.** It does not understand paraphrase — a correct gloss worded differently from the golden scores low — and that is accepted on purpose: the deterministic, reproducible metric stays strict, and genuine "model better than golden" cases are resolved by updating the golden, not by loosening the metric. A later revision may weight roots/prefixes or add an optional LLM-judge for a separate "deep audit" mode, kept out of the core rubric.
- **Suttas without a golden cannot be fidelity-scored.** The benchmark's headline metric requires a curated reference per benchmarked text. This is acceptable: the benchmark's job is to rank models on texts we can grade.
- **The whack-a-mole bug class is eliminated.** With no "produce N of X" targets left, there is no volume metric for lumping or padding to game.

## Alternatives considered

- **Keep the density metrics, fix each threshold.** Rejected: this is exactly the whack-a-mole we have done four times. Arbitrary targets remain arbitrary.
- **Pure LLM-judge scoring.** Rejected for the core rubric: non-deterministic, costly per phase, and non-reproducible — a benchmark must be stable across reruns. Reserve LLM judging for an optional deep-audit pass over flagged items.
- **Normalize density against the golden's density** (e.g. "match the golden's tooltips-per-segment"). Rejected: still a proxy; segmentation-invariant content agreement (`contentFidelity`) measures the thing we actually care about directly.

## Review log

**grok-build adversarial review (2026-06-30) — verdict: REVISE.** Endorsed the core diagnosis ("the density metrics were gamed and correctness was invisible is correct") and the Gate/Fidelity/Usability rule as "a sound forcing function," but blocked on the noisy/incomplete/surface-fragile Fidelity component being made both dominant and punitive while the safety rails were absent. All 7 must-fixes incorporated above:

| # | Must-fix | Resolution |
|---|---|---|
| 1 | Fidelity punishes models that exceed the imperfect golden | recall-weighted `contentFidelity` (Fβ, β≥2) + golden-update protocol + surpass test vector |
| 2 | Surface-matching broken for duplicates / sandhi | instance-aware Nth-to-Nth matching; ambiguous → `unmatched`, not 0 |
| 3 | Validity additive 15% | Validity is now a `gateFactor` floor/multiplier |
| 4 | 0.55 Fidelity dominance premature | phased weights — Fidelity 0.40 in v2.0, 0.55 only after hardening |
| 5 | No-golden two-tier leaderboard | no-golden runs excluded from the ranked board entirely |
| 6 | Deleting old metrics before replacements exist | phased transition — old metrics kept at reduced weight until `relationFidelity` / morph-agreement land |
| 7 | ADR ↔ code out of sync | explicit `rubricVersion`-stamped v2.0 → v2.x → v2.1 transition plan |

**Round 2 — grok-build re-review (REVISE) + Gemini-3.1-Pro-High (NO-GO), 2026-06-30.** The re-reviews confirmed Round-1's structural fixes (RESOLVED: phased weights, no-golden exclusion, keep-until-ready, rubricVersion) but caught that the *algorithmic* fixes were prose, not math — and Gemini overrode grok on substance:

| Finding | Source | Resolution (above) |
|---|---|---|
| Nth-to-Nth matching cascades on a dropped/merged word | Gemini #1 | edit-distance **sequence alignment** |
| recall-weighted Fβ rewards "synonym spraying" | Gemini #2 (overrides grok #1) | **strict F1 (β=1)**; exceed-golden via golden-update + surpass test |
| macro-average F1 is noisy on tiny per-word samples | Gemini #3 | **micro-F1** (pool TP/FP/FN per phase) |
| gateFactor 0.4 floor lets garbage bank 40% | Gemini #4 | fractional `textIntegrity` **multiplies** the gate (garbage → 0); the initially-proposed hard `0.1` cap was superseded by a *proportional* dent after real-run validation (§Validity) |
| `paliWordCoverage` is structural, not Usability | Gemini | moved to the **Validity Gate** |
| Fidelity 0.40 cap under-weights the only real signal | Gemini (overrides grok #4) | **wF 0.60**; transitional richness shrunk to **wR 0.15** |
| gateFactor / Fβ / sub-weights underspecified | grok re-review (PARTIAL ×3) | exact formulas pinned in the scoring section |
| "relations not wholly absent" is itself a volume target | grok re-review | gate **dropped** |
| code ≠ ADR (must-fix #7 not actually done) | both | implemented in this change set |

**Still carried (not blocking v2.0):** Fidelity internal split (seg/content 50/50; revisit with `relationFidelity`/`layoutFidelity`); a confidently-wrong-gloss asymmetric penalty (hallucination is pedagogically worse than silence) → follow-up ADR.

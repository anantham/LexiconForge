# Issue 13 — ETA is generic, not model-specific

> Status: **investigated** · Last updated: 2026-05-15 · Investigator: Claude Opus 4.7 (1M) · Worktree `opus-issues-investigation`

## 1. Claim (verbatim from Issues.md)

> file:///var/folders/68/.../Screenshot%202026-04-08%20at%2011.30.08%E2%80%AFPM.png - the eta for how long it will take is generic and should be made model specific, flash models are faster than other models, aggregation ruins the value

## 2. Reproduction

**Goal:** Verify that the translation ETA displayed during in-flight translation is or isn't model-specific.

**Environment:** dev server `http://localhost:5183/`, isolated worktree.

**Live repro deferred** — empirical reproduction would require actually triggering translations with multiple models (Flash + Claude + GPT-5) to populate the `apiMetricsService` IDB store with samples of each, then observing the displayed ETA. Each translation costs $0.05-0.50 and the user has stated cost concerns elsewhere. **The code path admits a fully static investigation** because:
- The ETA computation lives entirely in `services/apiMetricsService.ts:457-503` with a clear fallback chain.
- The UI surfaces are two known components (`ChapterContent.tsx`, `TranslationStatusPanel.tsx`).
- We can reason about exactly when the model-specific path vs the aggregate path fires from sample-count thresholds.

**Observed result (static):** The ETA system IS model-aware, but **the fallback threshold (≥2 model-specific samples) means new users / new models always fall back to aggregate.** The user's complaint maps exactly to this fallback behavior: "aggregation ruins the value."

**Trace:** none captured (static investigation; live capture deferred until user signals interest in empirical confirmation).

## 3. Verdict

**Real bug** (latent UX issue rooted in fallback-threshold design) — Confidence: **0.85**.

The system IS model-specific in spec — `getAverageTranslationTime(model, provider)` at `services/apiMetricsService.ts:457` returns a per-model average when ≥ 2 samples exist. **But in practice:**

1. **The 2-sample threshold is hostile to first-time use of a model.** First translation with any new model returns either the provider average (if ≥ 2 other models from same provider) or global average. The displayed ETA is then derived from samples that don't apply to the current model.

2. **Flash-vs-Claude asymmetry is real.** Per the user's anecdote, Gemini Flash typically completes in 5-15s while Claude/GPT-5 take 60-120s. A "provider average" mixing both is meaningless because the variance dominates the mean.

3. **The `source` indicator (model/provider/global/default) is exposed but inconsistently displayed:**
   - `components/chapter/ChapterContent.tsx:259-286` shows `(${source})` as a small gray annotation — user can see when they're getting a fallback.
   - `components/chapter/TranslationStatusPanel.tsx:25-54` (the compact `RetranslationTimer`) does **NOT** display source — user has no way to tell.

Confidence below 1.0 because empirical confirmation (live translations across models) wasn't run. But the code-path analysis is unambiguous.

## 4. Where the failure lives (A / B / C)

**`(A3, B3, C2)`** — confirmed from index's provisional assignment.

Justification:
- **A3** — No ADR governs ETA accuracy SLOs (e.g., "ETA must match observed completion within ±30% when ≥1 model-specific sample exists"). No CONVENTIONS spec.
- **B3** — Code overshoots in fallback design (defaults to 30s when 0 samples; lumps cross-model samples under provider/global aggregate); undershoots on disclosure (compact UI hides the source).
- **C2** — Vision implicitly favors "show what's actually relevant" but no doc says aggregate ETA is wrong. Drifted; not contradicted.

### Themes (cross-cutting failure classes)

- [`jit-vs-precompute`](../_themes/jit-vs-precompute.md) — adds an instance. The aggregate-average is a precomputed view over model-divergent data; per-model on-the-fly recomputation is the JIT-aligned answer.
- Mild overlap with the (proposed) `silent-feedback-gaps` cousin: the user can't see WHY the ETA is wrong because the source indicator is hidden in one of the UI surfaces.

## 5. Evidence and code paths

**ETA computation:** `services/apiMetricsService.ts:457-503`

```ts
async getAverageTranslationTime(model: string, provider?: string): Promise<{
  avgTimeSeconds: number;
  sampleCount: number;
  source: 'model' | 'provider' | 'global' | 'default';
}> {
  // ... fetch translation metrics from IDB ...

  // Try exact model match (≥ 2 samples)
  const modelMetrics = translationMetrics.filter(m => m.model === model);
  if (modelMetrics.length >= 2) {
    const avg = modelMetrics.reduce((s, m) => s + m.duration!, 0) / modelMetrics.length;
    return { avgTimeSeconds: avg, sampleCount: modelMetrics.length, source: 'model' };
  }

  // Try same provider (≥ 2 samples)
  if (provider) {
    const providerMetrics = translationMetrics.filter(m => m.provider === provider);
    if (providerMetrics.length >= 2) {
      const avg = providerMetrics.reduce((s, m) => s + m.duration!, 0) / providerMetrics.length;
      return { avgTimeSeconds: avg, sampleCount: providerMetrics.length, source: 'provider' };
    }
  }

  // Global average (≥ 1 sample)
  if (translationMetrics.length >= 1) {
    const avg = translationMetrics.reduce((s, m) => s + m.duration!, 0) / translationMetrics.length;
    return { avgTimeSeconds: avg, sampleCount: translationMetrics.length, source: 'global' };
  }

  return { avgTimeSeconds: 30, sampleCount: 0, source: 'default' };
}
```

**UI consumers:**
- `components/chapter/ChapterContent.tsx:259-286` — main in-flight translation panel. Shows `~Xs remaining (Y past calls)` with source if non-default.
- `components/chapter/TranslationStatusPanel.tsx:25-54` (RetranslationTimer) — compact inline timer. Shows `· Xs / ~Ys` with no source indicator.

**Image-side reference (for comparison):** `components/Illustration.tsx:213-235` — image ETA uses the same pattern (model-specific via `getAverageImageGenerationTime`, falls back to `getMedianImageGenerationTime`). Median (not mean) is a notable improvement over the translation side's mean — median is more robust to outliers (e.g., a single bad timeout).

**Suspected fault location:** the 2-sample threshold (`if (modelMetrics.length >= 2)`). For typical use:
- After translation #1 of model M: 1 sample → falls back to provider or global. Displayed ETA ignores this very datapoint.
- After translation #2: now ≥ 2 → finally uses model-specific. But the user has already lost trust during translation #1.

**Worse:** the per-model variance is wider than per-provider variance for translation (Flash vs Pro within Google), so the fallback to "provider" aggregate is actively misleading.

## 6. Test coverage gap & regression-test obligations

### What's missing

- No tests on `getAverageTranslationTime`'s threshold transitions (1-sample → provider, 2-sample → model).
- No tests on UI behavior when `source === 'default'` vs `'global'` vs `'model'` — should the UI suppress the ETA entirely below a confidence threshold?
- No test asserting `RetranslationTimer` displays a source/confidence indicator.

### Regression-test obligations

| Defect | Required regression test |
|---|---|
| Threshold-cliff between 1 and 2 model samples produces misleading "provider average" | `tests/services/apiMetricsService.eta.test.ts` — seed 1 model + 5 cross-model samples, assert returned source is `'model'` with relaxed-confidence flag OR display is suppressed entirely. |
| Compact timer hides source | `tests/components/RetranslationTimer.test.tsx` — assert source indicator renders when source !== 'default' (mirror `ChapterContent`'s behavior). |
| Default 30s misleads (zero data) | `tests/components/TranslationStatusPanel.defaultEta.test.tsx` — when source === 'default', UI shows "Estimating…" instead of `~30s remaining`. |

## 7. Archaeology

Three sites worth tracing at fix-time:

1. `services/apiMetricsService.ts:457` — `getAverageTranslationTime` introduction. When was the 2-sample threshold chosen? Was median considered?
2. `components/chapter/ChapterContent.tsx:259` — when was the source indicator added? Was the compact `RetranslationTimer` (without source) introduced before or after?
3. `components/Illustration.tsx:213` — the image-side pattern used median, not mean. When did this divergence emerge?

## 8. Generator function

**Class:** "Per-segment statistic surfaced as a global aggregate, with a fallback threshold that makes the per-segment path unreachable for new data."

The pattern: code DOES support per-model accuracy in spec, but the threshold gates it behind enough data to be irrelevant. Twin to the Phantom Consumer anti-pattern: the model-specific path is the "consumer" but its activation threshold means it almost never fires in fresh state.

**Other places this generator might surface:**
- Per-novel translation cost estimates (likely lives somewhere — could exhibit the same fallback cliff).
- Per-model token-cost estimation (often static defaults until N usages observed).
- Cache-hit rate display per-IDB-cache (could over-aggregate across heterogeneous caches).

## 9. Action — which kind of fix this is

**`fix_local`** — small UI + threshold tightening, no new ADR required. Three sub-changes:

1. **Show source indicator in `RetranslationTimer`** (parity with `ChapterContent`). 5-min change.

2. **Switch translation ETA from mean to median**, matching `Illustration.tsx`'s pattern. Robust to outlier-translation-stalls. ~30-min change in `apiMetricsService.ts:457` + tests.

3. **Lower threshold from 2 → 1 model-specific sample, with confidence annotation.** With 1 sample, show source `'model'` but tag as "low confidence — based on 1 past call". Eliminates the 1-sample cliff. 1-hr change including tests + UI annotation.

4. **(Optional, larger)** Add an "Estimating…" mode when source === 'default'. Suppress numeric ETA entirely. ~30-min change.

| Direction | Impact | Effort | Risk | Reversibility | Confidence |
|---|---|---|---|---|---|
| Source indicator in compact timer | UX clarity | 5 min | None | High | 0.95 |
| Mean → median switch | Stability | 30 min | Low | High | 0.9 |
| 2 → 1 sample threshold + confidence tag | UX accuracy | 1 hr | Low | High | 0.85 |
| Suppress on `default` source | UX honesty | 30 min | Low | High | 0.9 |

**Recommendation:** ship all four as one PR. Total ~2 hours of work. None requires ADR ratification.

## 9a. Closing gate

This issue closes as `fixed` when ALL of the following:

- [ ] `RetranslationTimer` shows source indicator (parity with `ChapterContent`).
- [ ] `getAverageTranslationTime` uses median, not mean.
- [ ] Threshold lowered from 2 → 1 sample with confidence-tag UI.
- [ ] `source === 'default'` UI shows "Estimating…", not numeric value.
- [ ] All three regression tests from §6 written and passing.

## 10. Status

`investigated` — `fix_local` action, four-part remedy sketched. No ADR draft needed.

## 11. Open questions

- Should the 30s default be lowered to better-match Flash users (e.g., 15s)? Probably no — defaults should reflect global mean, and Flash users will quickly populate model-specific data.
- Should "Estimating…" replace the elapsed counter too, or just the ETA? (Probably keep elapsed; only suppress prediction.)
- Is there appetite to add a percentile band (e.g., "between 8s and 22s") instead of a point estimate? Outside scope for this issue but worth a Phase 2.

# SUTTA-005: Benchmark Leaderboard

**Status:** Accepted
**Date:** 2026-01-31
**Author:** Claude + Aditya

## Context

We run benchmarks across 13+ LLM models to evaluate Sutta Studio pipeline quality. Currently, users must manually inspect benchmark outputs or run `quality-scorer.ts` to compare models. There's no easy way to see which model performs best or compare cost/quality tradeoffs.

Users need a leaderboard to make informed model choices.

## Decision

Add a **Leaderboard tab** to the existing `/bench/sutta-studio` view that displays model rankings with quality scores and cost metrics.

### Data Flow

1. **Pre-aggregated file**: Benchmark script generates `reports/sutta-studio/leaderboard.json` after each run
2. **Best run per model**: For each model, show the run with highest `overallScore`
3. **Single fetch**: Frontend loads one file, no client-side aggregation

### Leaderboard Schema

```typescript
type LeaderboardEntry = {
  rank: number;
  modelId: string;                // "gemini-2-flash"
  modelName: string;              // "google/gemini-2.0-flash-001"

  // Quality scores (0-1)
  overallScore: number;
  coverageScore: number;
  validityScore: number;
  richnessScore: number;
  grammarScore: number;

  // Cost/performance
  tokensTotal: number;
  durationMs: number;
  costUsd: number | null;

  // Metadata
  phasesCount: number;
  runTimestamp: string;
  runId: string;
};

type Leaderboard = {
  generatedAt: string;
  promptVersion: string;
  methodology: {
    docsUrl: string;
    rankingMetric: "overallScore";
    aggregation: "bestPerModel";
  };
  entries: LeaderboardEntry[];
};
```

**Location:** `reports/sutta-studio/leaderboard.json`

### UI Design

```
┌─────────────────────────────────────────────────────────────────┐
│  Sutta Studio Benchmarks                                        │
├─────────────────────────────────────────────────────────────────┤
│  [Leaderboard]  [Run Inspector]                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Model Leaderboard                    Last updated: 2026-01-31  │
│  Ranking by: Overall Score            Methodology: [?]          │
│                                                                 │
│  ┌───┬────────────────┬───────┬───────┬───────┬───────┬───────┐ │
│  │ # │ Model          │Overall│Valid. │Rich.  │Tokens │ Cost  │ │
│  ├───┼────────────────┼───────┼───────┼───────┼───────┼───────┤ │
│  │ 1 │ minimax-m2     │ 0.79  │ 0.83  │ 0.65  │ 12.4k │ $0.02 │ │
│  │ 2 │ gemini-2-flash │ 0.77  │ 0.89  │ 0.54  │ 15.1k │ $0.03 │ │
│  │ 3 │ glm-4.7-flash  │ 0.76  │ 0.72  │ 0.58  │ 11.2k │ free  │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Click column headers to sort • Click row to view run details   │
└─────────────────────────────────────────────────────────────────┘
```

**Interactions:**
- Column headers → sort ascending/descending
- Row click → switch to Run Inspector with that run selected
- `[?]` icon → links to `docs/benchmarks/sutta-studio.md#quality-scoring`

**Visual indicators:**
- Rank 1-3: medal styling or highlight
- Scores: color-coded (green > 0.8, yellow 0.6-0.8, red < 0.6)
- Cost: "free" label for $0 models

### Columns

| Column | Source | Sortable |
|--------|--------|----------|
| Rank | Computed from overall score | No |
| Model | leaderboard.json | Yes |
| Overall Score | quality-scores.json | Yes |
| Validity | quality-scores.json | Yes |
| Richness | quality-scores.json | Yes |
| Coverage | quality-scores.json | Yes |
| Grammar | quality-scores.json | Yes |
| Tokens (Total) | metrics.json | Yes |
| Duration (ms) | metrics.json | Yes |
| Cost (USD) | metrics.json | Yes |
| Phases Tested | metrics.json | Yes |

## Implementation Plan

| Step | File | Action |
|------|------|--------|
| 1 | `scripts/sutta-studio/benchmark.ts` | Add `generateLeaderboard()` after quality scoring |
| 2 | Run benchmark | Generate initial `leaderboard.json` |
| 3 | `components/bench/SuttaStudioBenchmarkView.tsx` | Add Leaderboard tab with sortable table |
| 4 | `docs/benchmarks/sutta-studio.md` | Add quality scoring methodology section |

## Alternatives Considered

### Client-side aggregation
Fetch `index.json` + N `quality-scores.json` files, aggregate in browser.

**Rejected:** Multiple fetches (1 + 13 models), repeated computation on every page load.

### Embed scores in index.json
Extend existing index entries to include quality metrics.

**Rejected:** Bloats index.json, tight coupling between benchmark and scoring logic.

## Not Doing (YAGNI)

- Filtering by prompt version
- Historical trends/charts
- Export to CSV
- Live polling for updates

## Consequences

**Positive:**
- Users can compare models at a glance
- Single fetch for fast page load
- Methodology is documented and linked

**Negative:**
- Leaderboard only updates when benchmark runs (acceptable - benchmarks are the source of truth)
- New file to maintain (`leaderboard.json`)

## References

- Quality scoring: `scripts/sutta-studio/quality-scorer.ts`
- Benchmark harness: `scripts/sutta-studio/benchmark.ts`
- Existing bench UI: `components/bench/SuttaStudioBenchmarkView.tsx`
- Methodology docs: `docs/benchmarks/sutta-studio.md`

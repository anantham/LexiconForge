# Sutta Studio Benchmarks

This benchmark harness runs each Sutta Studio pass in isolation (skeleton/anatomist/lexicographer/weaver/typesetter/morphology) and records per-call telemetry. It is designed for model + prompt tuning and regression tracking.

## How to run

```
tsx scripts/sutta-studio/benchmark.ts
```

Required environment variables (example):
- `OPENROUTER_API_KEY` for OpenRouter runs
- `GEMINI_API_KEY` for Gemini runs
- `OPENAI_API_KEY` for OpenAI runs
- `CLAUDE_API_KEY` for Claude runs
- `DEEPSEEK_API_KEY` for DeepSeek runs

The harness reads defaults from `scripts/sutta-studio/benchmark-config.ts`.

## Configuration

Edit `scripts/sutta-studio/benchmark-config.ts` to control:
- `runs`: list of model/provider combos to test
- `passes`: which passes to execute
- `dependencyMode`:
  - `fixture` (default): fixed inputs for each pass (stable, comparable)
  - `live`: chain outputs from earlier passes (more realistic, less stable)
- `fixture.path`: input fixture JSON
- `fixture.phaseKey`: which phase to use
- `repeatRuns`: number of repeats per model (useful for variance)
- `captureOutputs`: store raw/parsed outputs for manual diffing (skeleton only for now)

## Output

Reports are written to:

```
reports/sutta-studio/<timestamp>/metrics.json
reports/sutta-studio/<timestamp>/metrics.csv
reports/sutta-studio/<timestamp>/outputs/
reports/sutta-studio/index.json
reports/sutta-studio/<timestamp>/progress.json
reports/sutta-studio/active-run.json
```

`metrics.json` includes metadata + a `rows` array. `metrics.csv` is a flat table for charting.

When `captureOutputs.skeleton` is enabled, the `outputs/` folder includes:
- `skeleton-golden.json` (fixture baseline segments + expected phases)
- `outputs/<runId>/skeleton-chunk-*.json` (raw + parsed chunk responses)
- `outputs/<runId>/skeleton-aggregate.json` (combined phases for the run)

`reports/sutta-studio/index.json` is updated after each benchmark run and powers the
`/bench/sutta-studio` view without needing a dev-server restart.

Index entries also include per-run summaries (total duration/cost/tokens) derived from
`metrics.json` to make it easy to surface rollups in the UI.

During a live run, the benchmark script writes:
- `reports/sutta-studio/<timestamp>/progress.json` (detailed progress state)
- `reports/sutta-studio/active-run.json` (pointer + latest progress snapshot)

The bench UI polls `active-run.json` to show a live progress bar.

### Fields captured

Each row includes:
- `timestamp`
- `runId`
- `pass` and `stage` (pass | chunk | aggregate)
- `provider`, `model`
- `promptVersion`
- `structuredOutputs`
- `durationMs`, `costUsd`
- `tokensPrompt`, `tokensCompletion`, `tokensTotal`
- `success`, `errorMessage`
- `schemaName`, `requestName`
- `phaseId`
- `chunkIndex`, `chunkCount`, `segmentCount` (skeleton only)
- `dependencyMode`, `fixturePhase`, `workId`

### Why some fields can be null

- `costUsd` and `tokens*` are null when a provider does not return usage data.
- Skeleton aggregate rows are null for `durationMs/cost/tokens` if any chunk is missing metrics.
- Failed calls do not always return usable metadata.

### Data we intentionally do not store

We do not store full prompts in any report files. Raw model responses are only written when `captureOutputs` is enabled and are stored under `outputs/` so they can be diffed manually without bloating the metrics CSV/JSON. If you need full prompt tracing, use `LF_AI_DEBUG_FULL` in the app and capture logs separately.

## Fixtures

By default, the harness uses:

```
test-fixtures/sutta-studio-golden-data.json
```

The fixture contains canonical segments plus sample pass outputs for MN10. You can swap to a different phase or create a new fixture file and update the config.

## Quality Scoring

> **Source of truth:** the rubric lives in `scripts/sutta-studio/quality-scorer.ts`
> (`RUBRIC_VERSION`) and its design record lives in the ADRs — SUTTA-009 (principled
> scoring), SUTTA-012 (drop penalty + precision/recall), SUTTA-010 (advisory semantic
> judge), SUTTA-013/014 (v2.2 direction). This page deliberately summarizes rather
> than duplicates them; an earlier version of this section copied the v1 formulas and
> silently drifted for weeks.

The original density-based rubric (Coverage/Validity/Richness/Grammar, 25/35/20/20)
is **retired** — SUTTA-009 documents how wrong behavior could outscore right behavior
under it. Ranked scoring is golden-referenced:

- `overall = gateFactor × (0.60·fidelity + 0.25·usability + 0.15·richness)` — the
  gate scales with text integrity (mangled source text caps everything else).
- **Fidelity** = 0.5·segmentation + 0.5·content, strict pooled micro-F1 against the
  hand-curated golden. Since v2.1 (SUTTA-012), golden words a model DROPS are charged
  as misses (no survivorship bias), and content F1 publishes precision and recall
  separately.
- The **semantic judge** (SUTTA-010) is a separate advisory column, never part of the
  ranked total. Its scores are not drop-adjusted — measured rank agreement with
  drop-adjusted fidelity is negative, so never read judge scores as overall quality.
- v2.2 (in progress) splits deterministic FACTS (root/POS/morph vs the Digital Pāli
  Dictionary) from prose, adds alignment scoring against a curated link golden, and
  moves ranked runs onto production-parity inputs (SUTTA-013, SUTTA-014).

### Leaderboard

The published artifact is `public/benchmarks/sutta-studio-leaderboard.json`, rendered
at `/bench/sutta-studio`. Key properties (all enforced by
`scripts/sutta-studio/generate-leaderboard.ts`, which hard-fails rather than publish
a violation):

- One rubric version per board — mixing versions is a build failure.
- Each model is represented by its **single best run**, selected by most completed
  phases FIRST, then mean overall — completeness beats score, and per-phase
  cherry-picking across runs is explicitly rejected.
- A coverage floor excludes models that completed too few phases to rank.
- Bootstrap 95% CIs with adjacent-tie markers, a hallucination-rate column from judge
  flags, and a grounding/provenance panel (sources, authorities, known circularity,
  closed-book badge) ship with every board.

Regenerate (runs are pinned by directory to keep boards reproducible):

```bash
LEADERBOARD_DIRS=<runTs1>,<runTs2> npx tsx --env-file=.env.local scripts/sutta-studio/generate-leaderboard.ts
```

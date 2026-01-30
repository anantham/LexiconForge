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
```

`metrics.json` includes metadata + a `rows` array. `metrics.csv` is a flat table for charting.

When `captureOutputs.skeleton` is enabled, the `outputs/` folder includes:
- `skeleton-golden.json` (fixture baseline segments + expected phases)
- `outputs/<runId>/skeleton-chunk-*.json` (raw + parsed chunk responses)
- `outputs/<runId>/skeleton-aggregate.json` (combined phases for the run)

`reports/sutta-studio/index.json` is updated after each benchmark run and powers the
`/bench/sutta-studio` view without needing a dev-server restart.

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

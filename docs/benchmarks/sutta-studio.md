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

After each benchmark run, the harness computes quality scores for each model. These scores are aggregated into a leaderboard at `reports/sutta-studio/leaderboard.json`.

### Scoring Dimensions

| Dimension | Weight | Description |
|-----------|--------|-------------|
| **Coverage** | 25% | How well does the output cover the input? |
| **Validity** | 35% | Is the output structurally correct? |
| **Richness** | 20% | How informative are tooltips, senses, etc.? |
| **Grammar** | 20% | Are grammatical relations present and valid? |

### Coverage Metrics

- **Pali Word Coverage** (33%): Ratio of output words to input Pali words (split by whitespace)
- **English Mapping Ratio** (17%): Ratio of non-ghost English tokens to total tokens
- **Alignment Coverage** (50%): Ratio of English tokens with actual Pali segment links (`linkedSegmentId`) to non-ghost tokens. This is the critical metric for visible alignment edges in the UI.

### Validity Metrics

- **No Empty Segments**: Percentage of segments with non-empty text
- **No Duplicate Mappings**: Percentage of segment links that are unique (same Pali segment linked by multiple English tokens is a bug)
- **Text Integrity**: Do concatenated segments match the word's surface form?

### Richness Metrics

- **Tooltip Density**: Average tooltips per segment, normalized (2 tooltips/segment = 100%)
- **Sense Polysemy**: Content words expected to have 3 senses, function words 1-2
- **Morph Data Present**: Percentage of segments with morphological data

### Grammar Metrics

- **Relation Count**: Total grammatical relations in output
- **Relation Density**: Relations per content word (expect ~0.5-1)
- **Relations Valid**: Percentage of relations with valid from/to references

### Overall Score

The overall score is a weighted average:

```
overall = coverage * 0.25 + validity * 0.35 + richness * 0.20 + grammar * 0.20
```

### Leaderboard

The leaderboard aggregates scores across **ALL unique phases** completed by each model across all benchmark runs. This gives a true representation of model capability across the full test set (15 phases).

Each entry includes:
- Quality scores averaged across all completed phases
- Number of phases successfully scored (out of 15 total)
- Token usage and cost (aggregated across runs)
- Link to view the best output in Sutta Studio

**Aggregation rules**:
- Scores are averaged across all unique phase IDs per model
- When a model has multiple runs with the same phase, the best score is used
- The packet link points to the run with the most completed phases

**Interpreting results**: Models with fewer phases completed may have high scores on easy phases but struggle with complex ones. A model with 15/15 phases has proven reliability across the full test set, while 1/15 is not representative.

Generate/update the leaderboard:
```bash
npx tsx scripts/sutta-studio/generate-leaderboard.ts
```

Backfill quality scores for existing runs:
```bash
npx tsx scripts/sutta-studio/backfill-quality-scores.ts
```

View the leaderboard at `/bench/sutta-studio` → Leaderboard tab.

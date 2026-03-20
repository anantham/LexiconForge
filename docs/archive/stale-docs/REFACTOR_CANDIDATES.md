# Refactor Candidates

> **Superseded:** March 2026. Active watchlist items migrated to `docs/architecture/ARCHITECTURE.md` §7 (Current Hotspots). See `docs/CONVENTIONS.md` §4 for the friction-based file-size policy.

Purpose: Track files that are becoming monolithic or hard to maintain. This list is a prompt for future decomposition work (not an immediate to-do).

Guidelines:
- Add files that are hard to reason about, brittle, or > ~300 LOC.
- Include a brief reason and a suggested split.
- 300 LOC is a heuristic, not a rule.

## Watchlist

| File | Reason | Suggested Split |
| --- | --- | --- |
| ~~services/suttaStudioCompiler.ts~~ | ✅ **Done** (Mar 2026) — split into `services/compiler/` (8 modules) | — |
| ~~services/navigationService.ts~~ | ✅ **Done** (Mar 2026) — split into `services/navigation/` (8 modules) | — |
| components/sutta-studio/SuttaStudioView.tsx | Rendering, arrow layout, focus state, and navigation logic in one file (414 LOC) | Extract relation arrow renderer, phase block renderer, and navigation controls into separate components/hooks |
| components/sutta-studio/SuttaStudioApp.tsx | Store wiring, navigation, compilation, and render gating in one file (498 LOC) | Extract route parsing, gate/log hooks, and packet resolution into helpers |
| services/suttaStudioPassPrompts.ts | Prompt builders + schemas + JSON parsing in one file (723 LOC), no ADR, no tests | Split schemas, prompt builders, and parsing helpers into separate modules |
| services/suttaStudioPassRunners.ts | All per-pass runners in one file (586 LOC), no ADR, no tests | Split each pass runner into its own module or group by pipeline stage |
| components/bench/SuttaStudioBenchmarkView.tsx | Fixture loading + runner orchestration + metrics display in one file (1272 LOC) | Extract fixture loader, metrics builder, and chart renderer |
| scripts/sutta-studio/benchmark.ts | Fixture loading + runner orchestration + CSV/JSON export in one file (>500 LOC) | Extract fixture loader, metrics builder, and report writer into helper modules |

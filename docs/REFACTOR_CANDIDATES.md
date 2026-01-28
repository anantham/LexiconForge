# Refactor Candidates

Purpose: Track files that are becoming monolithic or hard to maintain. This list is a prompt for future decomposition work (not an immediate to-do).

Guidelines:
- Add files that are hard to reason about, brittle, or > ~300 LOC.
- Include a brief reason and a suggested split.
- 300 LOC is a heuristic, not a rule.

## Watchlist

| File | Reason | Suggested Split |
| --- | --- | --- |
| services/suttaStudioCompiler.ts | Large orchestration + proxy fetch + schema + LLM call logic in one file (~415 LOC) | Extract proxy fetcher, schema/prompt builders, LLM call wrapper, and pipeline orchestration into separate modules |
| components/sutta-studio/SuttaStudioView.tsx | Rendering, arrow layout, focus state, and navigation logic in one file (>350 LOC) | Extract relation arrow renderer, phase block renderer, and navigation controls into separate components/hooks |
| services/navigationService.ts | Multiple concerns (navigation resolution, hydration, fetch, history) in one file (>1k LOC) | Split into resolver, hydrator, fetcher, and history updater modules |
| components/sutta-studio/SuttaStudioApp.tsx | Store wiring, navigation, compilation, and render gating in one file (>400 LOC) | Extract route parsing, gate/log hooks, and packet resolution into helpers |

# Coverage Baseline — CORE-013 PR-2

**Date:** 2026-08-23 · **Runtime:** Node 24.19 (CI-authoritative) · **Provider:** v8

## What this PR changes

1. `coverage.include` now scopes measurement to product sources (`services/`,
   `adapters/`, `store/`, `hooks/`, `utils/`, `components/`, `types.ts`).
   Completely untested in-scope files now appear at 0% instead of being
   invisible (Vitest reports only imported files unless include is set).
2. Thresholds moved from inline vitest config into
   [`config/coverage-policy.json`](../../config/coverage-policy.json) — single
   source of truth with owners and rationale. Validated by
   `npm run verify:coverage-policy`: any glob matching zero real files fails
   the build (kills the phantom-threshold class found 2026-08-22).
3. `perFile: true` is explicit — Vitest 4 requires it for per-file enforcement.
4. CI's `unit-coverage` job runs the suite once WITH coverage and uploads
   `coverage/` as an artifact on failure.
5. Known-broken / declaration files excluded from instrumentation
   (`*.d.cts`, tsconfig-excluded audio modules) — they crash the v8 remapper.

## Floors currently enforced (all earned)

| Glob | Lines | Functions | Note |
|---|---|---|---|
| components/diff/** | 95 | 95 | unchanged |
| components/ChapterView.tsx | 30 | 15 | unchanged |
| adapters/providers/{OpenAI,Gemini,Claude}Adapter.ts | 50 | 40 | unchanged |
| services/diff/DiffAnalysisService.ts | 70 | 60 | unchanged |
| services/translate/HtmlSanitizer.ts | 80 | 80 | holds |
| services/translate/HtmlRepairService.ts | 75 | 75 | **earned this PR**: was measuring 53.7%L / 72.7%F; behavior tests added for disabledRules, verbose logging, validate/preview/rules API, hr-edge spacing, entity decoding → 88.9%L / 90.9%F locally |

## Baseline status

The full-surface total is measured by CI on Node 24 (local Node 26 has a
documented webstorage env-failure class; `reportOnFailure: true` keeps
reports flowing either way). Global floors stay at 0 until the first CI run's
total is accepted as the baseline; raising them afterwards is an
ADR-noteworthy event. Expect large honest zeros across islands (liturgy
generator, parts of sutta-studio) — that visibility is the point.

## Rules

- Floors are earned by tests, never lowered to reach green.
- Every new floor needs an owner recorded in the policy file.
- A threshold glob that matches nothing must fail validation, not silently skip.

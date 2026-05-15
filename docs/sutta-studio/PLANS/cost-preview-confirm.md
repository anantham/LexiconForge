# Plan — Cost-aware preview-and-confirm before full compile

**Status:** ready to claim
**Estimated effort:** 2–4 hours
**Independence:** high — touches compiler entry + a new modal; no overlap with the polyglot or refrain-detector plans.

## Goal

Before paying for a full Sutta Studio compile, show the user a one-screen
estimate (phases, dollars, minutes) and require explicit confirmation.
Today the compile starts as soon as the skeleton finishes; on a
451-phase sutta like DN22 that's a >170-minute commit the user only
notices after the first phase API bill rolls in.

## Non-goals (DO NOT DO)

- Pause / resume mid-compile (separate plan — out of scope here)
- Per-phase cost preview (just total + best-effort breakdown)
- Variance estimation, confidence intervals, or risk wording — keep
  the UX a single dollar figure + duration with the words "estimate"
- Changing the budget-enforcement pipeline (api budgets are a separate system)

## Architecture sketch

1. **Skeleton finishes** (existing code, `services/compiler/index.ts`
   line ~297 after phaseLimit truncation).
2. **NEW: emit an "estimate-pending" progress stage** before entering the
   per-phase loop. Payload:
   ```ts
   {
     stage: 'estimate-pending',
     estimate: {
       phaseCount: number;          // phaseSkeleton.length after limit
       segmentCount: number;        // totalSegments
       estimatedCostUsd: number;    // avg sutta_studio call cost × ~4 per phase
       estimatedDurationMs: number; // getAveragePhaseDuration() × phaseCount
       basis: 'seeded-from-prior-compiles' | 'cold-default';
     }
   }
   ```
3. **NEW: caller (SuttaStudioApp) decides**. The compiler must NOT block
   here — it pauses until the caller resolves a returned `confirm` promise.
   Simplest API change:
   ```ts
   compileSuttaStudioPacket({
     ...,
     onEstimate?: (estimate) => Promise<'compile' | 'cancel'>;
   })
   ```
   If `onEstimate` is omitted, compile proceeds without prompt (preserves
   tests + the `?phaseLimit=N` pilot flow).
4. **UI: a single modal** shown only when `onEstimate` fires. Two buttons:
   - **Compile (~$X.YZ · ~Nm)** — confirms
   - **Cancel** — aborts; skeleton work is discarded (cheap; skeleton is ~$0.10).
5. On confirm: per-phase loop runs as today. On cancel: throw a tagged
   error like `CompileCancelledByUser` so existing error logging records it.

## How to compute the cost estimate

- The skeleton pass already cost something; query `apiMetricsService` for
  the average cost of recent `sutta_studio` calls.
- A phase compile is 4 sub-calls (anatomist, lexicographer, weaver,
  typesetter). Use a constant `CALLS_PER_PHASE = 4`.
- `estimatedCostUsd = avgCallCost × CALLS_PER_PHASE × phaseCount`
- If no prior data exists (fresh install), use a cold-default constant
  derived from MN10 numbers in `docs/sutta-studio/AMORTIZATION.md`
  (currently ~$0.03/phase end-to-end on Gemini 3 Flash Preview). Mark
  `basis: 'cold-default'` so the modal can append "(no prior data,
  cold estimate)" in small text.

## How to compute the duration estimate

- Already available: `getAveragePhaseDuration(uidKey)` in
  `services/suttaStudioTelemetry.ts` returns ms-per-phase EMA. Multiply
  by phaseCount.
- Fallback: 60_000 ms × phaseCount (1 min/phase) if no telemetry yet.

## Files to touch

| Path | Change |
|---|---|
| `services/compiler/index.ts` | Add `onEstimate?` to options; after skeleton + phaseLimit cap, compute estimate, call `onEstimate`, await result, throw `CompileCancelledByUser` on cancel |
| `services/compiler/costEstimate.ts` | NEW — pure functions `estimatePhaseCost(metrics)` and `estimateCompile(phaseSkeleton, telemetry, metrics)`. Unit-testable. |
| `components/sutta-studio/CostPreviewModal.tsx` | NEW — small modal: title, two-line estimate, two buttons. Use the existing modal/dialog pattern in the codebase (search `Dialog`, `Modal` in `components/`). |
| `components/sutta-studio/SuttaStudioApp.tsx` | Pass `onEstimate` to the compile call; return a promise resolved by the modal's button clicks |
| `tests/services/compiler/costEstimate.test.ts` | NEW — unit tests for the pure estimate function |

## Validation gate (must pass before opening PR)

- [ ] `npx vitest run tests/services/compiler/costEstimate.test.ts` — all green
- [ ] `npx vitest run tests/services/` — no regression vs main
- [ ] Manual: `/sutta/mn10` cold (no prior phase-duration data) — modal appears with `basis: 'cold-default'`; click Cancel — compile aborts cleanly; no half-built packet persists.
- [ ] Manual: `/sutta/mn10?phaseLimit=4` — modal still appears with phaseCount=4; click Compile — completes as today.
- [ ] Manual: `/sutta/dn22` cold — modal shows phaseCount ≈ 450 and a large dollar estimate (this is the bug-class the feature exists to prevent).
- [ ] No new TypeScript errors introduced (baseline diff against main).

## How to start

```bash
# 1. Check WORKLOG
grep -A2 "cost-preview\|costPreview" docs/WORKLOG.md
# 2. Claim
echo "- $(date -u +%Y-%m-%d) codex starting cost-preview-confirm" >> docs/WORKLOG.md
git -C "$REPO" add docs/WORKLOG.md && git -C "$REPO" commit -m "worklog: codex claiming cost-preview-confirm"
# 3. Worktree
mkdir -p ../LexiconForge.worktrees
git worktree add ../LexiconForge.worktrees/codex-cost-preview -b feat/codex-cost-preview main
cd ../LexiconForge.worktrees/codex-cost-preview
ln -s "/Users/aditya/Documents/Ongoing Local/LexiconForge/node_modules" node_modules
# 4. Implement per the architecture sketch
# 5. Tests + manual smoke
# 6. Open PR
```

## Useful context

- Existing progress events: search `onProgress?\(` in
  `services/compiler/index.ts` — there are ~15 call sites, all carrying
  a `{packet, stage, message}` shape. New `estimate-pending` stage
  follows the same pattern.
- Cost data sourced from `apiMetricsService.recordMetric` calls
  (`type: 'sutta_studio'`) scattered through compiler passes.
- Phase-duration EMA: `recordPhaseDuration` is already called at end of
  each phase iteration in `services/compiler/index.ts`. The compile
  doesn't need to do anything new here — the telemetry already exists.
- `AMORTIZATION.md` documents the cold-start cost numbers — use those
  as the fallback when `apiMetricsService` has no prior data.

## Out-of-scope follow-ups (do NOT bundle)

- Mid-compile budget alarms (e.g., "you've spent $1 on phase 8 of 50, abort?")
- Showing per-phase cost as phases complete (separate UX iteration)
- Confidence intervals or risk wording on the estimate
- Pause/resume — needs a separate state machine and is its own plan

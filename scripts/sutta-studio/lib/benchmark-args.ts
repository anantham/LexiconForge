/**
 * CLI arg parsing for benchmark.ts / benchmark-parallel.ts.
 *
 * Integrity finding (2026-07 scan, P0): benchmark-parallel.ts spawned
 * `benchmark.ts --model <id>` per roster model, but benchmark.ts never parsed
 * `--model` — so EVERY child ran the FULL roster (N models × N children ×
 * $-cap exposure). The flag is now parsed here, in a dependency-free module so
 * both scripts and the unit test share one implementation.
 *
 * Contract:
 *  - no `--model` flag        → { model: null, error: null }  (full configured run)
 *  - `--model <roster-id>`    → { model: id,   error: null }  (single-model run)
 *  - `--model` missing value  → error (fail loudly, never fall through to a full paid run)
 *  - `--model <unknown-id>`   → error naming the roster (an unknown id would
 *                               otherwise filter runsToExecute to [] and exit 0 silently)
 */
export type BenchmarkModelArg = { model: string | null; error: string | null };

export const parseBenchmarkArgs = (argv: string[], rosterIds: string[]): BenchmarkModelArg => {
  const i = argv.indexOf('--model');
  if (i === -1) return { model: null, error: null };
  const value = argv[i + 1];
  if (value === undefined || value.startsWith('--')) {
    return { model: null, error: '--model requires a value (a run id from the roster)' };
  }
  if (!rosterIds.includes(value)) {
    return {
      model: null,
      error: `--model "${value}" is not in the roster. Known run ids: ${rosterIds.join(', ')}`,
    };
  }
  return { model: value, error: null };
};

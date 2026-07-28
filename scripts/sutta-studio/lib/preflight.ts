/**
 * OpenRouter key preflight, shared by the paid one-off scripts
 * (probe-student, run-phase-experiment, generate-new-phases).
 *
 * Parameterized copy of the benchmark.ts preflight (promised 2026-07-22, the
 * day a key died mid-run at $40.11/$40.00): GET /api/v1/key is free and
 * returns limit_remaining, so a run that will die on key exhaustion is fully
 * predictable BEFORE the first billed call. Fail-closed on an exhausted key;
 * warn (with the numbers) when remaining < the run's own expected spend; a
 * preflight NETWORK failure only warns, so a probe outage can't block a valid
 * run. benchmark.ts keeps its own copy wired to BENCHMARK_CONFIG.
 */
export const preflightOpenRouterKey = async (
  opts: { apiKey?: string | undefined; expectedSpendUsd?: number | null } = {},
): Promise<void> => {
  const apiKey = opts.apiKey ?? process.env.OPENROUTER_API_KEY;
  if (!apiKey) return; // the caller's own missing-key handling applies
  try {
    const res = await fetch('https://openrouter.ai/api/v1/key', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const data = (await res.json())?.data;
    const remaining: number | null = data?.limit_remaining ?? null;
    const limit = data?.limit ?? 'none';
    const usage = data?.usage ?? '?';
    console.log(
      `[Preflight] OpenRouter key: usage $${usage} / limit ${limit} / remaining ${remaining ?? 'unlimited'}`,
    );
    if (remaining !== null && remaining < 0.5) {
      throw new Error(
        `KEY EXHAUSTED before launch: limit_remaining $${remaining.toFixed(2)}. ` +
          'Raise the key limit or rotate the key — launching would fail every call at $0.',
      );
    }
    const cap = opts.expectedSpendUsd ?? null;
    if (remaining !== null && cap != null && remaining < cap) {
      console.warn(
        `[Preflight] WARNING: key remaining ($${remaining.toFixed(2)}) < expected spend ($${cap}). ` +
          'The run may die mid-way on key exhaustion.',
      );
    }
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('KEY EXHAUSTED')) throw e;
    console.warn(
      `[Preflight] key check unreachable (${e instanceof Error ? e.message : e}) — proceeding.`,
    );
  }
};

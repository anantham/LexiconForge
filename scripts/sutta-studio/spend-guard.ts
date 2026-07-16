/**
 * Fail-closed cumulative spend guard for the benchmark fleet run (review #6).
 *
 * The runner previously estimated cost per response, let an unknown price become null, and had NO
 * cumulative stop — a mispriced model or a runaway loop could spend unbounded. This tracks spend
 * across every LLM call and lets the run ABORT (via assertUnderBudget, called at loop boundaries)
 * once the cap is reached.
 */
export class BudgetExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BudgetExceededError';
  }
}

/** A call we can't price (missing usage or no pricing) is charged this much, so unpriced spend
 *  still drives toward the cap instead of counting as $0 and slipping through unseen. Deliberately
 *  high for a single compiler call. */
export const UNPRICED_CALL_ESTIMATE_USD = 0.25;

export class SpendGuard {
  private cumulative = 0;
  private unpriced = 0;

  /** @param capUsd hard cap in USD, or null to disable tracking (not recommended for paid runs). */
  constructor(private readonly capUsd: number | null) {}

  /** Accrue one call's cost. A null cost is charged the conservative unpriced estimate. */
  accrue(costUsd: number | null): void {
    if (this.capUsd == null) return;
    if (costUsd == null) {
      this.unpriced += 1;
      this.cumulative += UNPRICED_CALL_ESTIMATE_USD;
    } else {
      this.cumulative += costUsd;
    }
  }

  /**
   * Throw if the cap has been reached. MUST be called at a loop boundary, never inside a pass
   * runner — a pass runner's try/catch would swallow the throw into a per-phase failure and let
   * the run keep spending.
   */
  assertUnderBudget(where: string): void {
    if (this.capUsd == null || this.cumulative < this.capUsd) return;
    const unpricedNote = this.unpriced > 0
      ? ` (${this.unpriced} call(s) charged the $${UNPRICED_CALL_ESTIMATE_USD} unpriced estimate)`
      : '';
    throw new BudgetExceededError(
      `[Budget] cap $${this.capUsd.toFixed(2)} reached — ~$${this.cumulative.toFixed(2)} spent${unpricedNote}. ` +
      `Aborting before ${where}.`,
    );
  }

  /** Cumulative spend so far, in USD (includes unpriced-call estimates). */
  get spentUsd(): number {
    return this.cumulative;
  }
}

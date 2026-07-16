import { describe, it, expect } from 'vitest';
import { SpendGuard, BudgetExceededError, UNPRICED_CALL_ESTIMATE_USD } from '../../../scripts/sutta-studio/spend-guard';

describe('SpendGuard (fail-closed benchmark budget)', () => {
  it('does not throw while under the cap', () => {
    const g = new SpendGuard(10);
    g.accrue(3);
    g.accrue(4);
    expect(() => g.assertUnderBudget('next phase')).not.toThrow();
    expect(g.spentUsd).toBeCloseTo(7);
  });

  it('throws once cumulative spend reaches the cap', () => {
    const g = new SpendGuard(10);
    g.accrue(6);
    g.accrue(5); // 11 ≥ 10
    expect(() => g.assertUnderBudget('phase-x')).toThrow(BudgetExceededError);
    expect(() => g.assertUnderBudget('phase-x')).toThrow(/cap \$10\.00 reached/);
  });

  it('charges an unpriced (null) call the conservative estimate — it does NOT slip through as $0', () => {
    const g = new SpendGuard(1);
    // Five unpriced calls at $0.25 = $1.25 ≥ $1 cap. If null counted as $0, this would never trip.
    for (let i = 0; i < 5; i++) g.accrue(null);
    expect(g.spentUsd).toBeCloseTo(5 * UNPRICED_CALL_ESTIMATE_USD);
    expect(() => g.assertUnderBudget('phase-y')).toThrow(/unpriced estimate/);
  });

  it('disables tracking when the cap is null', () => {
    const g = new SpendGuard(null);
    g.accrue(1000);
    g.accrue(null);
    expect(g.spentUsd).toBe(0);
    expect(() => g.assertUnderBudget('anything')).not.toThrow();
  });

  it('the thrown error names where it stopped', () => {
    const g = new SpendGuard(1);
    g.accrue(2);
    expect(() => g.assertUnderBudget('model "grok-4.20"')).toThrow(/Aborting before model "grok-4\.20"/);
  });
});

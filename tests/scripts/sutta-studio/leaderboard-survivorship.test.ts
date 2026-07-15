import { describe, it, expect } from 'vitest';
import { chargeMissingGoldenPhases } from '../../../scripts/sutta-studio/generate-leaderboard';

// Minimal PhaseScore-shaped record. Only the fields the ranked mean reads matter here.
const phase = (id: string, overall: number, model = 'm') => ({
  phase: id,
  model,
  rubricVersion: '2.1',
  fidelityScore: overall,
  segmentationFidelity: overall,
  contentFidelity: overall,
  paliWordCoverage: overall,
  coverageScore: overall,
  validityScore: overall,
  richnessScore: overall,
  grammarScore: overall,
  overallScore: overall,
  alignmentCoverage: overall,
}) as any;

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const UNIVERSE = ['p1', 'p2', 'p3', 'p4', 'p5'];

describe('chargeMissingGoldenPhases (phase-level survivorship fix)', () => {
  it('charges every golden-backed phase the model did not complete as a 0', () => {
    const scored = [phase('p1', 0.9), phase('p2', 0.8)]; // completed 2 of 5
    const { phases, missing, completed } = chargeMissingGoldenPhases(scored, UNIVERSE);

    expect(completed).toBe(2);
    expect(missing).toEqual(['p3', 'p4', 'p5']);
    expect(phases).toHaveLength(UNIVERSE.length); // the denominator is the universe, always
    expect(phases.filter((p) => p.overallScore === 0).map((p) => p.phase)).toEqual(['p3', 'p4', 'p5']);
  });

  it('leaves a fully-complete run untouched', () => {
    const scored = UNIVERSE.map((id) => phase(id, 0.7));
    const { phases, missing, completed } = chargeMissingGoldenPhases(scored, UNIVERSE);
    expect(missing).toEqual([]);
    expect(completed).toBe(UNIVERSE.length);
    expect(mean(phases.map((p) => p.overallScore))).toBeCloseTo(0.7, 10);
  });

  it('a zero-charged phase kills recall but leaves precision undefined (null)', () => {
    const { phases } = chargeMissingGoldenPhases([phase('p1', 0.9)], UNIVERSE);
    const charged = phases.find((p) => p.phase === 'p2') as any;
    expect(charged.contentRecall).toBe(0);       // recalled none of the golden
    expect(charged.contentPrecision).toBeNull();  // no predictions → precision is undefined
  });

  it('THE FIX: a model that only did the easy phases can no longer outrank a complete one', () => {
    // "Cherry" completed 2 phases, both near-perfect, and skipped the 3 hard ones.
    // "Steady" completed all 5 at a solid-but-lower 0.65.
    const cherry = [phase('p1', 0.98, 'cherry'), phase('p2', 0.97, 'cherry')];
    const steady = UNIVERSE.map((id) => phase(id, 0.65, 'steady'));

    // The OLD behaviour: mean over surviving phases only. This is the survivorship bias — and
    // it ranks the cherry-picker ABOVE the model that actually did the work.
    const oldCherryMean = mean(cherry.map((p) => p.overallScore));   // 0.975
    const oldSteadyMean = mean(steady.map((p) => p.overallScore));   // 0.65
    expect(oldCherryMean).toBeGreaterThan(oldSteadyMean); // the bug, demonstrated

    // The FIX: charge the 3 skipped phases as 0, then average over the universe.
    const newCherryMean = mean(
      chargeMissingGoldenPhases(cherry, UNIVERSE).phases.map((p) => p.overallScore),
    ); // (0.98 + 0.97 + 0 + 0 + 0) / 5 = 0.39
    const newSteadyMean = mean(
      chargeMissingGoldenPhases(steady, UNIVERSE).phases.map((p) => p.overallScore),
    ); // 0.65

    expect(newSteadyMean).toBeGreaterThan(newCherryMean); // ranking restored
    expect(newCherryMean).toBeCloseTo(0.39, 10);
  });
});

// @vitest-environment node

import { describe, expect, it } from 'vitest';
import type { QualityScore } from '../../../scripts/sutta-studio/quality-scorer';
import { assertPublishedScoreParity } from '../../../scripts/sutta-studio/publish-compare';

const score = (overrides: Partial<QualityScore> = {}): QualityScore => ({
  phase: 'phase-d',
  model: 'test-model',
  rubricVersion: '2.1',
  segmentationFidelity: 0.75,
  overallScore: 0.625,
  ...overrides,
} as QualityScore);

describe('publish-compare score provenance', () => {
  it('accepts a persisted score receipt that matches a current scorer replay', () => {
    expect(() => assertPublishedScoreParity(score(), score(), 'test-model/phase-d')).not.toThrow();
  });

  it('fails loudly instead of mixing stale aggregate and current component scores', () => {
    expect(() => assertPublishedScoreParity(
      score({ overallScore: 0.91 }),
      score({ overallScore: 0.625 }),
      'test-model/phase-d',
    )).toThrow(/Scorer drift.*overallScore.*Re-run quality scoring/s);
  });

  it('rejects score receipts from a different rubric version', () => {
    expect(() => assertPublishedScoreParity(
      score({ rubricVersion: '2.0' }),
      score({ rubricVersion: '2.1' }),
      'test-model/phase-d',
    )).toThrow(/rubricVersion/);
  });
});

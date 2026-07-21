// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { runSkeletonPass } from './skeleton';
import type { LLMCaller } from './types';
import type { CanonicalSegment } from '../../../types/suttaStudio';
import type { AppSettings } from '../../../types';

/**
 * Regression guard for the wordRange sub-split vs duplicate-dedup collision
 * that crashed the first full MN117 compile (2026-07-02):
 *
 * The skeleton LLM legitimately assigns the SAME segment id to several
 * phases when sub-splitting a long segment by wordRange. The old dedup
 * stripped every claim after the first regardless, running AFTER the
 * empty-phase filter — so sub-split phases reached the compiler with
 * segmentIds: [] and applyWordRangeToSegments crashed on segments[0].ref.
 */

const seg = (id: string, pali: string): CanonicalSegment => ({
  ref: { provider: 'suttacentral', workId: 'mnTEST', segmentId: id },
  order: Number(id.split('.').pop()),
  pali,
  baseEnglish: `english for ${id}`,
});

const SEGMENTS = [
  seg('mnTEST:1.1', 'ekaṁ samayaṁ bhagavā sāvatthiyaṁ viharati jetavane'),
  seg('mnTEST:1.2', 'tatra kho bhagavā bhikkhū āmantesi'),
  seg('mnTEST:1.3', 'bhadante ti te bhikkhū bhagavato paccassosuṁ'),
];

const settings = { provider: 'OpenRouter', model: 'test-model' } as AppSettings;

const callerReturning = (phases: unknown): LLMCaller => async () =>
  ({ text: JSON.stringify({ phases }) } as Awaited<ReturnType<LLMCaller>>);

describe('runSkeletonPass duplicate-claim handling', () => {
  it('keeps wordRange sub-split phases that re-claim an already-claimed segment', async () => {
    const llmCaller = callerReturning([
      { id: 'a', segmentIds: ['mnTEST:1.1'], wordRange: [0, 3] },
      { id: 'b', segmentIds: ['mnTEST:1.1'], wordRange: [3, 7] },
      { id: 'c', segmentIds: ['mnTEST:1.2'] },
      { id: 'd', segmentIds: ['mnTEST:1.3'] },
    ]);

    const result = await runSkeletonPass({ segments: SEGMENTS, settings, structuredOutputs: false, llmCaller });

    expect(result.chunks[0].fallbackUsed).toBe(false);
    expect(result.phases).toHaveLength(4);
    // The second sub-split must still own its segment — this is the exact
    // shape that used to arrive at the compiler as segmentIds: [].
    expect(result.phases[1].segmentIds).toEqual(['mnTEST:1.1']);
    expect(result.phases[1].wordRange).toEqual([3, 7]);
    expect(result.phases.every((p) => p.segmentIds.length > 0)).toBe(true);
  });

  it('drops a non-wordRange phase whose every id is an earlier phase\'s (true double-claim)', async () => {
    const llmCaller = callerReturning([
      { id: 'a', segmentIds: ['mnTEST:1.1', 'mnTEST:1.2'] },
      { id: 'b', segmentIds: ['mnTEST:1.2'] }, // duplicate claim, no wordRange
      { id: 'c', segmentIds: ['mnTEST:1.3'] },
    ]);

    const result = await runSkeletonPass({ segments: SEGMENTS, settings, structuredOutputs: false, llmCaller });

    expect(result.chunks[0].fallbackUsed).toBe(false);
    expect(result.phases).toHaveLength(2);
    expect(result.phases.every((p) => p.segmentIds.length > 0)).toBe(true);
  });

  it('still falls back to chunking when the skeleton misses a segment entirely', async () => {
    const llmCaller = callerReturning([
      { id: 'a', segmentIds: ['mnTEST:1.1'] },
      // mnTEST:1.2 and 1.3 never claimed → completeness check must throw → fallback
    ]);

    const result = await runSkeletonPass({ segments: SEGMENTS, settings, structuredOutputs: false, llmCaller });

    expect(result.chunks[0].fallbackUsed).toBe(true);
    const claimed = new Set(result.phases.flatMap((p) => p.segmentIds));
    expect(claimed.size).toBe(3);
  });
});

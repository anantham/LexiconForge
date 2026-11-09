// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runSkeletonPass as runCompilerSkeleton } from '../../../services/compiler/skeleton';
import { runSkeletonPass as runStandaloneSkeleton } from '../../../services/sutta-studio/passes/skeleton';
import { callCompilerLLMText } from '../../../services/sutta-studio/llm';
import type { LLMCaller } from '../../../services/sutta-studio/passes/types';
import type { SkeletonPhase } from '../../../services/sutta-studio/utils';
import type { CanonicalSegment } from '../../../types/suttaStudio';
import type { AppSettings } from '../../../types';

vi.mock('../../../services/sutta-studio/llm', () => ({ callCompilerLLMText: vi.fn() }));
vi.mock('../../../services/suttaStudioPipelineLog', () => ({ logPipelineEvent: vi.fn() }));

const segments: CanonicalSegment[] = Array.from({ length: 10 }, (_, index) => ({
  ref: { provider: 'suttacentral', workId: 'synthetic', segmentId: `s${index + 1}` },
  order: index,
  pali: `synthetic ${index + 1}`,
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(callCompilerLLMText).mockReset();
});
afterEach(() => vi.restoreAllMocks());

const settings: AppSettings = {
  provider: 'OpenRouter', model: 'synthetic', temperature: 0.2,
  contextDepth: 0, preloadCount: 0, fontSize: 16, fontStyle: 'serif',
  lineHeight: 1.6, systemPrompt: '', imageModel: 'none',
};

const paths = ['compiler', 'standalone'] as const;
describe.each(paths)('%s skeleton phase contract', (path) => {
  const run = async (phases: SkeletonPhase[] | undefined, allowCrossChapter = false) => {
    const text = JSON.stringify({ phases });
    vi.mocked(callCompilerLLMText).mockResolvedValue(text);
    const llmCaller: LLMCaller = async () => ({
      text, provider: 'OpenRouter', model: 'synthetic', durationMs: 0,
    });
    const params = {
      segments,
      boundaries: [{ workId: 'second', startSegmentId: 's4' }],
      allowCrossChapter,
      settings,
      structuredOutputs: false,
    };
    return path === 'compiler'
      ? runCompilerSkeleton(params)
      : (await runStandaloneSkeleton({ ...params, llmCaller })).phases;
  };

  it('preserves sub-segment word ranges and removes only duplicate whole claims', async () => {
    const phases: SkeletonPhase[] = [
      { id: 'first', segmentIds: ['s1'], wordRange: [0, 2] },
      { id: 'second', segmentIds: ['s1'], wordRange: [2, 4] },
      { id: 'duplicate', segmentIds: ['s1'] },
      { id: 'unknown-only', segmentIds: ['unknown'] },
      { id: 'rest', segmentIds: ['s1', 'unknown', ...segments.slice(1).map((s) => s.ref.segmentId)] },
    ];
    const result = await run(phases);
    expect(result).toEqual([
      { id: 'phase-1', segmentIds: ['s1'], wordRange: [0, 2] },
      { id: 'phase-2', segmentIds: ['s1'], wordRange: [2, 4] },
      { id: 'phase-3', segmentIds: segments.slice(1).map((s) => s.ref.segmentId) },
    ]);
    expect(phases[2].segmentIds).toEqual(['s1']);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('dropping duplicate'));
  });

  it.each([
    undefined,
    [],
    [{ id: 'incomplete', segmentIds: ['s1'] }],
  ])('falls back to bounded chunks on missing or incomplete phases (%j)', async (phases) => {
    const result = await run(phases);
    expect(result.map((phase) => phase.segmentIds)).toEqual([
      ['s1', 's2', 's3'],
      ['s4', 's5', 's6', 's7', 's8', 's9', 's10'],
    ]);
  });

  it('allows fallback chunks across work boundaries only when requested', async () => {
    const result = await run(undefined, true);
    expect(result.map((phase) => phase.segmentIds)).toEqual([
      ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'], ['s9', 's10'],
    ]);
  });
});

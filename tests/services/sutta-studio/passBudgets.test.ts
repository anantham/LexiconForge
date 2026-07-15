// @vitest-environment node

import { describe, expect, it } from 'vitest';
import type { AppSettings } from '../../../types';
import type {
  AnatomistPass,
  CanonicalSegment,
  LexicographerPass,
  PhaseView,
  WeaverPass,
} from '../../../types/suttaStudio';
import { SUTTA_STUDIO_TOKEN_BUDGETS } from '../../../services/sutta-studio/passBudgets';
import { runAnatomistPass } from '../../../services/sutta-studio/passes/anatomist';
import { runLexicographerPass } from '../../../services/sutta-studio/passes/lexicographer';
import { runMorphologyPass } from '../../../services/sutta-studio/passes/morphology';
import { runSkeletonPass } from '../../../services/sutta-studio/passes/skeleton';
import { runTypesetterPass } from '../../../services/sutta-studio/passes/typesetter';
import { runWeaverPass } from '../../../services/sutta-studio/passes/weaver';
import type { LLMCaller } from '../../../services/sutta-studio/passes/types';

const settings = { provider: 'OpenRouter', model: 'test-model' } as AppSettings;
const segments: CanonicalSegment[] = [{
  ref: { provider: 'suttacentral', workId: 'mn10', segmentId: 'mn10:1.1' },
  order: 0,
  pali: 'idha bhikkhave',
  baseEnglish: 'here, monks',
}];
const anatomist = { id: 'phase-test', words: [], segments: [], relations: [] } as AnatomistPass;
const lexicographer = { id: 'phase-test', senses: [] } as LexicographerPass;
const weaver = { id: 'phase-test', tokens: [] } as WeaverPass;
const phaseView = {
  id: 'phase-test',
  title: 'Test',
  sourceSpan: [],
  paliWords: [],
  englishStructure: [],
} as unknown as PhaseView;

describe('Sutta Studio pass token budgets', () => {
  it('uses the production budgets as every canonical runner default', async () => {
    const seen = new Map<string, number | undefined>();
    const llmCaller: LLMCaller = async ({ maxTokens, options }) => {
      const stage = options?.meta?.stage ?? 'unknown';
      seen.set(stage, maxTokens);
      const text = stage === 'skeleton'
        ? JSON.stringify({ phases: [{ id: 'phase-test', segmentIds: ['mn10:1.1'] }] })
        : '{}';
      return { text } as Awaited<ReturnType<LLMCaller>>;
    };

    await runSkeletonPass({ segments, settings, structuredOutputs: false, llmCaller });
    await runAnatomistPass({ phaseId: 'phase-test', workId: 'mn10', segments, settings, structuredOutputs: false, llmCaller });
    await runLexicographerPass({ phaseId: 'phase-test', workId: 'mn10', segments, anatomist, settings, structuredOutputs: false, llmCaller });
    await runWeaverPass({ phaseId: 'phase-test', workId: 'mn10', segments, anatomist, lexicographer, settings, structuredOutputs: false, llmCaller });
    await runTypesetterPass({ phaseId: 'phase-test', workId: 'mn10', segments, anatomist, weaver, settings, structuredOutputs: false, llmCaller });
    await runMorphologyPass({ phaseId: 'phase-test', segments, phaseView, settings, structuredOutputs: false, llmCaller });

    expect(Object.fromEntries(seen)).toEqual({
      skeleton: SUTTA_STUDIO_TOKEN_BUDGETS.skeleton,
      anatomist: SUTTA_STUDIO_TOKEN_BUDGETS.anatomist,
      lexicographer: SUTTA_STUDIO_TOKEN_BUDGETS.lexicographer,
      weaver: SUTTA_STUDIO_TOKEN_BUDGETS.weaver,
      typesetter: SUTTA_STUDIO_TOKEN_BUDGETS.typesetter,
      morph: SUTTA_STUDIO_TOKEN_BUDGETS.morphology,
    });
  });
});

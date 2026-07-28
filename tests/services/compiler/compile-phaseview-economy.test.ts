/**
 * PhaseView call economy + failure isolation (integrity item 1, 2026-07).
 *
 * The fallback PhaseView pass was a FIFTH billed LLM call per phase that
 * (a) ran even when all four pass outputs were cached — the SegmentCacheEntry
 * has no phaseView slot, so a fully-cached compile still paid for it while
 * using only `parsed.title`, and (b) sat inside the phase-fatal try, so its
 * failure threw away 4 successful billed passes into a degraded view.
 *
 * These tests were RED-PROOFED against the pre-fix compiler:
 *   - "makes ZERO LLM calls" failed pre-fix with 1 call (phase_view)
 *   - "yields a NON-degraded phase" failed pre-fix with degraded: true
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { CanonicalSegment } from '../../../types/suttaStudio';
import { createMockAppSettings } from '../../utils/test-data';

const llmMock = vi.hoisted(() => vi.fn());
const segmentsMock = vi.hoisted(() => vi.fn());
const skeletonMock = vi.hoisted(() => vi.fn());

vi.mock('../../../services/compiler/llm', () => ({
  callCompilerLLM: (...args: any[]) => llmMock(...args),
  resolveCompilerProvider: vi.fn(),
}));

vi.mock('../../../services/compiler/segments', () => ({
  fetchCanonicalSegmentsForUid: (...args: any[]) => segmentsMock(...args),
}));

vi.mock('../../../services/compiler/skeleton', () => ({
  runSkeletonPass: (...args: any[]) => skeletonMock(...args),
}));

vi.mock('../../../services/capabilityService', () => ({
  supportsStructuredOutputs: vi.fn(async () => false),
}));

// Grounding is network/registry-backed and out of scope here.
vi.mock('../../../services/sutta-studio/grounding', () => ({
  buildDefaultProviders: vi.fn(async () => ({})),
}));
vi.mock('../../../services/sutta-studio/passes/grounding', () => ({
  runGroundingPass: vi.fn(async () => ({ citationsAdded: [], senseCitations: [] })),
  applyGroundingToPhase: vi.fn(),
}));

// The bundled DPD loader is vite-glob based; not needed on cached paths.
vi.mock('../../../services/providers/dpd-loader-vite', () => ({
  getBundledDpdData: vi.fn(() => ({})),
}));

import { compileSuttaStudioPacket } from '../../../services/compiler/index';
import { segmentCache } from '../../../services/suttaStudioPipelineCache';

const makeSegment = (segmentId: string, pali: string, baseEnglish: string): CanonicalSegment => ({
  ref: { provider: 'suttacentral', workId: 'mn1', segmentId },
  order: 0,
  pali,
  baseEnglish,
});

const anatomistFor = (id: string) => ({
  id,
  words: [
    { id: 'p1', surface: 'evaṁ', wordClass: 'function', segmentIds: ['p1s1'] },
    { id: 'p2', surface: 'me', wordClass: 'function', segmentIds: ['p2s1'] },
    { id: 'p3', surface: 'sutaṁ', wordClass: 'content', segmentIds: ['p3s1'] },
  ],
  segments: [
    { id: 'p1s1', text: 'evaṁ', type: 'stem', tooltips: ['thus'] },
    { id: 'p2s1', text: 'me', type: 'stem', tooltips: ['by me'] },
    { id: 'p3s1', text: 'sutaṁ', type: 'stem', tooltips: ['heard'] },
  ],
  relations: [],
}) as any;

const lexicographerFor = (id: string) => ({
  id,
  senses: [
    { wordId: 'p1', wordClass: 'function', senses: [{ english: 'Thus', nuance: 'narrative opener' }] },
    { wordId: 'p2', wordClass: 'function', senses: [{ english: 'by me', nuance: 'agent' }] },
    { wordId: 'p3', wordClass: 'content', senses: [{ english: 'heard', nuance: 'received teaching' }] },
  ],
}) as any;

// Token indices for tokenizeEnglish('Thus have I heard.'): words at 0/2/4/6.
const weaverFor = (id: string) => ({
  id,
  tokens: [
    { tokenIndex: 0, text: 'Thus', isGhost: false, linkedPaliId: 'p1' },
    { tokenIndex: 2, text: 'have', isGhost: true, ghostKind: 'required' },
    { tokenIndex: 4, text: 'I', isGhost: false, linkedPaliId: 'p2' },
    { tokenIndex: 6, text: 'heard', isGhost: false, linkedPaliId: 'p3' },
  ],
}) as any;

const typesetterFor = (id: string) => ({
  id,
  layoutBlocks: [['p1', 'p2', 'p3']],
}) as any;

const settings = createMockAppSettings({ provider: 'OpenRouter', model: 'test-model', apiKeyOpenRouter: 'k' } as any);

const compileOptions = (uid: string) => ({
  uid,
  lang: 'en',
  author: 'sujato',
  settings,
});

beforeEach(() => {
  llmMock.mockReset();
  segmentsMock.mockReset();
  skeletonMock.mockReset();
});

const requestNamesOf = () => llmMock.mock.calls.map((c) => c[4]?.meta?.requestName);

describe('compileSuttaStudioPacket — phaseView call economy', () => {
  it('a compile with FULL cache hits makes ZERO LLM calls (fifth call eliminated)', async () => {
    // Distinct pali per test: the segment cache singleton persists across tests.
    const pali = 'evaṁ me sutaṁ';
    segmentsMock.mockResolvedValue([makeSegment('mn1:1.1', pali, 'Thus have I heard.')]);
    skeletonMock.mockResolvedValue([{ id: 'phase-1', title: 'Opening', segmentIds: ['mn1:1.1'] }]);

    await segmentCache.initialize();
    segmentCache.setAnatomist(pali, anatomistFor('phase-1'));
    segmentCache.setLexicographer(pali, lexicographerFor('phase-1'));
    segmentCache.setWeaver(pali, weaverFor('phase-1'));
    segmentCache.setTypesetter(pali, typesetterFor('phase-1'));

    const packet = await compileSuttaStudioPacket(compileOptions('mn1'));

    // The load-bearing assertion: no billed calls at all. Pre-fix this was 1
    // (requestName 'phase_view') on every phase of every fully-cached compile.
    expect(llmMock).toHaveBeenCalledTimes(0);

    expect(packet.phases).toHaveLength(1);
    expect(packet.phases[0].degraded).toBeFalsy();
    // Title synthesized locally from the skeleton, not bought from an LLM.
    expect(packet.phases[0].title).toBe('Opening');
    // Item 3: compiled phases now carry their canonical segment ids.
    expect(packet.phases[0].canonicalSegmentIds).toEqual(['mn1:1.1']);
    // Item 4: the stamp matches the validator that actually ran.
    expect(packet.compiler?.validatorVersion).toBe('1.0.0');
    // Item 7c: honest provider label.
    expect(packet.compiler?.provider).toBe('openrouter');
    // Item 7d: final progress counts what actually happened.
    expect(packet.progress?.readyPhases).toBe(1);
    expect(packet.progress?.readySegments).toBe(1);
  });

  it('a phaseView failure with anatomist+lexicographer present degrades ONLY the title, never the phase', async () => {
    const pali = 'ekāyano ayaṁ maggo';
    segmentsMock.mockResolvedValue([makeSegment('mn1:2.1', pali, 'This is the direct path.')]);
    skeletonMock.mockResolvedValue([{ id: 'phase-2', title: 'Direct Path', segmentIds: ['mn1:2.1'] }]);

    await segmentCache.initialize();
    segmentCache.setAnatomist(pali, {
      id: 'phase-2',
      words: [
        { id: 'p1', surface: 'ekāyano', wordClass: 'content', segmentIds: ['p1s1'] },
        { id: 'p2', surface: 'ayaṁ', wordClass: 'function', segmentIds: ['p2s1'] },
        { id: 'p3', surface: 'maggo', wordClass: 'content', segmentIds: ['p3s1'] },
      ],
      segments: [
        { id: 'p1s1', text: 'ekāyano', type: 'stem', tooltips: ['direct'] },
        { id: 'p2s1', text: 'ayaṁ', type: 'stem', tooltips: ['this'] },
        { id: 'p3s1', text: 'maggo', type: 'stem', tooltips: ['path'] },
      ],
      relations: [],
    } as any);
    segmentCache.setLexicographer(pali, {
      id: 'phase-2',
      senses: [
        { wordId: 'p1', wordClass: 'content', senses: [{ english: 'direct', nuance: 'straight' }] },
        { wordId: 'p2', wordClass: 'function', senses: [{ english: 'this', nuance: 'deictic' }] },
        { wordId: 'p3', wordClass: 'content', senses: [{ english: 'path', nuance: 'way' }] },
      ],
    } as any);
    // No weaver/typesetter cached → weaver LLM call runs (fails), typesetter
    // is skipped (needs weaver), phaseView runs (fails).
    llmMock.mockRejectedValue(new Error('provider 500'));

    const packet = await compileSuttaStudioPacket(compileOptions('mn1'));

    expect(requestNamesOf()).toEqual(['weaver', 'phase_view']);
    expect(packet.phases).toHaveLength(1);
    // Pre-fix: the phaseView rejection hit the phase-fatal catch and this
    // phase shipped degraded, discarding both successful cached passes.
    expect(packet.phases[0].degraded).toBeFalsy();
    expect(packet.phases[0].title).toBe('Direct Path');
    // The pass outputs survived into the rendered phase.
    expect(packet.phases[0].paliWords.map((w) => w.id)).toEqual(['p1', 'p2', 'p3']);
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  stripCodeFences,
  parseJsonResponse,
  buildPhaseStateEnvelope,
  buildSourceRefs,
  computeSourceDigest,
  buildBoundaryContext,
  applyWordRangeToSegments,
  chunkPhases,
  waitFor,
  createCompilerThrottle,
} from '../../../services/compiler/utils';
import type { CanonicalSegment } from '../../../types/suttaStudio';

// Helper to build minimal CanonicalSegments for tests
const seg = (segmentId: string, pali: string, english?: string, order = 0): CanonicalSegment => ({
  ref: { provider: 'suttacentral', workId: 'mn10', segmentId },
  order,
  pali,
  baseEnglish: english,
});

// --- stripCodeFences ---
describe('stripCodeFences', () => {
  it('strips ```json fences', () => {
    expect(stripCodeFences('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it('strips plain ``` fences', () => {
    expect(stripCodeFences('```\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it('leaves plain JSON untouched', () => {
    expect(stripCodeFences('{"a":1}')).toBe('{"a":1}');
  });

  it('trims surrounding whitespace', () => {
    expect(stripCodeFences('  {"a":1}  ')).toBe('{"a":1}');
  });
});

// --- parseJsonResponse ---
describe('parseJsonResponse', () => {
  it('parses clean JSON', () => {
    expect(parseJsonResponse<{ x: number }>('{"x":42}')).toEqual({ x: 42 });
  });

  it('parses JSON wrapped in code fences', () => {
    expect(parseJsonResponse<{ x: number }>('```json\n{"x":42}\n```')).toEqual({ x: 42 });
  });

  it('throws on completely invalid input', () => {
    expect(() => parseJsonResponse('not json at all!!!')).toThrow();
  });
});

// --- buildPhaseStateEnvelope ---
describe('buildPhaseStateEnvelope', () => {
  const segments = [seg('mn10:1.1', 'Evaṃ'), seg('mn10:1.2', 'me', 'me', 1)];

  it('includes work and phase ids', () => {
    const envelope = buildPhaseStateEnvelope({
      workId: 'mn10',
      phaseId: 'phase-1',
      segments,
      currentStageLabel: 'Anatomist',
      currentStageKey: 'anatomist',
    });
    expect(envelope).toContain('mn10');
    expect(envelope).toContain('phase-1');
  });

  it('shows segment range', () => {
    const envelope = buildPhaseStateEnvelope({
      workId: 'mn10',
      phaseId: 'phase-1',
      segments,
      currentStageLabel: 'Anatomist',
    });
    expect(envelope).toContain('mn10:1.1 — mn10:1.2');
  });

  it('marks current stage as IN PROGRESS', () => {
    const envelope = buildPhaseStateEnvelope({
      workId: 'mn10',
      phaseId: 'phase-1',
      segments,
      currentStageLabel: 'Weaver',
      currentStageKey: 'weaver',
      completed: { anatomist: true, lexicographer: true },
    });
    expect(envelope).toContain('[x] Anatomist: complete');
    expect(envelope).toContain('[x] Lexicographer: complete');
    expect(envelope).toContain('[ ] Weaver: IN PROGRESS');
    expect(envelope).toContain('[ ] Typesetter: pending');
  });

  it('handles empty segments gracefully', () => {
    const envelope = buildPhaseStateEnvelope({
      workId: 'mn10',
      phaseId: 'phase-1',
      segments: [],
      currentStageLabel: 'Anatomist',
    });
    expect(envelope).toContain('n/a');
  });
});

// --- buildSourceRefs ---
describe('buildSourceRefs', () => {
  it('maps segment ids to source refs using the map', () => {
    const map = new Map([['mn10:1.1', 'mn10'], ['mn10:1.2', 'mn10']]);
    const refs = buildSourceRefs(['mn10:1.1', 'mn10:1.2'], map, 'fallback');
    expect(refs).toEqual([
      { provider: 'suttacentral', workId: 'mn10', segmentId: 'mn10:1.1' },
      { provider: 'suttacentral', workId: 'mn10', segmentId: 'mn10:1.2' },
    ]);
  });

  it('falls back to fallbackWorkId when segment not in map', () => {
    const map = new Map<string, string>();
    const refs = buildSourceRefs(['mn10:9.9'], map, 'fallback-work');
    expect(refs[0].workId).toBe('fallback-work');
  });
});

// --- computeSourceDigest ---
describe('computeSourceDigest', () => {
  it('returns a hex string', () => {
    const digest = computeSourceDigest([seg('mn10:1.1', 'Evaṃ me')]);
    expect(digest).toMatch(/^[0-9a-f]+$/);
  });

  it('is deterministic', () => {
    const segs = [seg('mn10:1.1', 'Evaṃ'), seg('mn10:1.2', 'me')];
    expect(computeSourceDigest(segs)).toBe(computeSourceDigest(segs));
  });

  it('differs for different pali content', () => {
    const a = computeSourceDigest([seg('mn10:1.1', 'Evaṃ')]);
    const b = computeSourceDigest([seg('mn10:1.1', 'suttaṃ')]);
    expect(a).not.toBe(b);
  });
});

// --- buildBoundaryContext ---
describe('buildBoundaryContext', () => {
  it('returns empty string for no boundaries', () => {
    expect(buildBoundaryContext([], false)).toBe('');
  });

  it('includes boundary work ids and segment ids', () => {
    const ctx = buildBoundaryContext(
      [{ workId: 'mn11', startSegmentId: 'mn11:1.1', afterSegmentId: 'mn10:9.9' }],
      false
    );
    expect(ctx).toContain('mn11');
    expect(ctx).toContain('mn11:1.1');
    expect(ctx).toContain('mn10:9.9');
  });

  it('notes cross-chapter allowed when flag set', () => {
    const ctx = buildBoundaryContext(
      [{ workId: 'mn11', startSegmentId: 'mn11:1.1' }],
      true
    );
    expect(ctx).toContain('cross-chapter phases are allowed');
  });

  it('notes cross-chapter forbidden when flag not set', () => {
    const ctx = buildBoundaryContext(
      [{ workId: 'mn11', startSegmentId: 'mn11:1.1' }],
      false
    );
    expect(ctx).toContain('do not place segments from different works');
  });
});

// --- applyWordRangeToSegments ---
describe('applyWordRangeToSegments', () => {
  const segments = [
    seg('mn10:1.1', 'Evaṃ me sutaṃ', 'Thus have I heard', 0),
    seg('mn10:1.2', 'ekaṃ samayaṃ', 'at one time', 1),
  ];

  it('returns segments unchanged when no wordRange', () => {
    expect(applyWordRangeToSegments(segments)).toBe(segments);
  });

  it('slices pali words from joined text', () => {
    const result = applyWordRangeToSegments(segments, [0, 2]);
    expect(result).toHaveLength(1);
    expect(result[0].pali).toBe('Evaṃ me');
  });

  it('collapses to single segment using first segment ref', () => {
    const result = applyWordRangeToSegments(segments, [1, 3]);
    expect(result[0].ref.segmentId).toBe('mn10:1.1');
  });

  it('concatenates english from all segments', () => {
    const result = applyWordRangeToSegments(segments, [0, 1]);
    expect(result[0].baseEnglish).toContain('Thus have I heard');
    expect(result[0].baseEnglish).toContain('at one time');
  });
});

// --- chunkPhases ---
describe('chunkPhases', () => {
  const makeSegs = (n: number) =>
    Array.from({ length: n }, (_, i) => seg(`mn10:${i + 1}`, `word${i}`));

  it('creates one phase when segments <= size', () => {
    const phases = chunkPhases(makeSegs(5), 8);
    expect(phases).toHaveLength(1);
    expect(phases[0].segmentIds).toHaveLength(5);
  });

  it('splits into multiple phases based on size', () => {
    const phases = chunkPhases(makeSegs(10), 3);
    expect(phases).toHaveLength(4); // 3+3+3+1
  });

  it('flushes at boundary starts', () => {
    const segs = makeSegs(6);
    const boundaryStarts = new Set(['mn10:4']);
    const phases = chunkPhases(segs, 10, boundaryStarts);
    // Should flush before mn10:4
    expect(phases).toHaveLength(2);
    expect(phases[0].segmentIds).toEqual(['mn10:1', 'mn10:2', 'mn10:3']);
    expect(phases[1].segmentIds).toEqual(['mn10:4', 'mn10:5', 'mn10:6']);
  });

  it('assigns sequential phase ids', () => {
    const phases = chunkPhases(makeSegs(10), 5);
    expect(phases[0].id).toBe('phase-1');
    expect(phases[1].id).toBe('phase-2');
  });

  it('returns empty array for empty input', () => {
    expect(chunkPhases([], 8)).toEqual([]);
  });
});

// --- waitFor ---
describe('waitFor', () => {
  it('resolves immediately for ms <= 0', async () => {
    await expect(waitFor(0)).resolves.toBeUndefined();
    await expect(waitFor(-1)).resolves.toBeUndefined();
  });

  it('rejects if signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(waitFor(100, controller.signal)).rejects.toThrow('aborted');
  });

  it('rejects when signal aborts mid-wait', async () => {
    const controller = new AbortController();
    const promise = waitFor(500, controller.signal);
    controller.abort();
    await expect(promise).rejects.toThrow('aborted');
  });
});

// --- createCompilerThrottle ---
describe('createCompilerThrottle', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('resolves immediately on first call', async () => {
    const throttle = createCompilerThrottle(1000);
    const p = throttle();
    vi.runAllTimers();
    await expect(p).resolves.toBeUndefined();
  });

  it('is a no-op when minGapMs is 0', async () => {
    const throttle = createCompilerThrottle(0);
    await expect(throttle()).resolves.toBeUndefined();
    await expect(throttle()).resolves.toBeUndefined();
  });
});

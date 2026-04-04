import { extractBalancedJson } from '../ai/textUtils';
import type { CanonicalSegment, SourceRef } from '../../types/suttaStudio';

export const stripCodeFences = (text: string): string => {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
  if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
  return cleaned.trim();
};

export const parseJsonResponse = <T>(raw: string): T => {
  const cleaned = stripCodeFences(raw);
  try {
    return JSON.parse(cleaned) as T;
  } catch (e) {
    const balanced = extractBalancedJson(cleaned);
    return JSON.parse(balanced) as T;
  }
};

export type PhaseStageKey = 'anatomist' | 'lexicographer' | 'weaver' | 'typesetter';

export const buildPhaseStateEnvelope = (params: {
  workId: string;
  phaseId: string;
  segments: CanonicalSegment[];
  currentStageLabel: string;
  currentStageKey?: PhaseStageKey;
  completed?: Partial<Record<PhaseStageKey, boolean>>;
}) => {
  const { workId, phaseId, segments, currentStageLabel, currentStageKey, completed } = params;
  const start = segments[0]?.ref.segmentId ?? 'n/a';
  const end = segments[segments.length - 1]?.ref.segmentId ?? start;
  const stages: Array<{ key: PhaseStageKey; label: string }> = [
    { key: 'anatomist', label: 'Anatomist' },
    { key: 'lexicographer', label: 'Lexicographer' },
    { key: 'weaver', label: 'Weaver' },
    { key: 'typesetter', label: 'Typesetter' },
  ];
  const statusLines = stages.map((stage) => {
    const done = Boolean(completed?.[stage.key]);
    const inProgress = !done && currentStageKey === stage.key;
    const stateLabel = done ? 'complete' : inProgress ? 'IN PROGRESS' : 'pending';
    return `${done ? '[x]' : '[ ]'} ${stage.label}: ${stateLabel}`;
  });

  return [
    '=== PHASE STATE (READ ONLY) ===',
    `• Work: ${workId}`,
    `• Phase: ${phaseId}`,
    `• Segments: ${start} — ${end}`,
    `• Current Stage: ${currentStageLabel}`,
    '',
    'STATUS CHECK:',
    ...statusLines,
    '',
    'INVARIANTS:',
    '1) Do NOT add/remove Pali IDs (p1, p2...).',
    '2) Segment texts must concatenate to the surface text exactly.',
    '3) Preserve source word order and spelling (no normalization).',
    '===============================',
  ].join('\n');
};

export const getTimeoutSignal = (ms: number, external?: AbortSignal): AbortSignal | undefined => {
  if (external && typeof AbortSignal !== 'undefined' && 'any' in AbortSignal) {
    return AbortSignal.any([external, AbortSignal.timeout(ms)]);
  }
  if (external) return external;
  if (typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal) {
    return AbortSignal.timeout(ms);
  }
  return undefined;
};

export const waitFor = (ms: number, signal?: AbortSignal): Promise<void> => {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (signal) signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', onAbort);
      reject(new Error('Compiler throttle aborted.'));
    };
    if (signal) {
      if (signal.aborted) {
        clearTimeout(timer);
        reject(new Error('Compiler throttle aborted.'));
        return;
      }
      signal.addEventListener('abort', onAbort, { once: true });
    }
  });
};

export const createCompilerThrottle = (minGapMs: number) => {
  let nextAllowedAt = 0;
  return async (signal?: AbortSignal) => {
    if (!minGapMs || minGapMs <= 0) return;
    const now = Date.now();
    const waitMs = Math.max(0, nextAllowedAt - now);
    if (waitMs > 0) {
      await waitFor(waitMs, signal);
    }
    nextAllowedAt = Date.now() + minGapMs;
  };
};

export const buildSourceRefs = (
  segmentIds: string[],
  segmentIdToWorkId: Map<string, string>,
  fallbackWorkId: string
): SourceRef[] =>
  segmentIds.map((id) => ({
    provider: 'suttacentral',
    workId: segmentIdToWorkId.get(id) || fallbackWorkId,
    segmentId: id,
  }));

export const computeSourceDigest = (segments: CanonicalSegment[]): string => {
  const text = segments.map((seg) => seg.pali).join('\n');
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 33) ^ text.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
};

export type BoundaryNote = {
  workId: string;
  startSegmentId: string;
  afterSegmentId?: string;
};

export const buildBoundaryContext = (boundaries: BoundaryNote[], allowCrossChapter: boolean) => {
  if (!boundaries.length) return '';
  const lines = boundaries
    .map((b) =>
      b.afterSegmentId
        ? `- ${b.workId} begins at ${b.startSegmentId} (after ${b.afterSegmentId})`
        : `- ${b.workId} begins at ${b.startSegmentId}`
    )
    .join('\n');
  const rule = allowCrossChapter
    ? 'Boundary map provided (cross-chapter phases are allowed).'
    : 'Boundary map provided: do not place segments from different works in the same phase.';
  return `\n${rule}\n${lines}\n`;
};

export type SkeletonPhase = {
  id: string;
  title?: string;
  segmentIds: string[];
  wordRange?: [number, number];
};

/**
 * Apply wordRange slicing to phase segments when sub-segment splitting is used.
 * When wordRange is present, slice the Pali text to only include the specified word indices.
 * English is NOT sliced - the full text is passed through for the weaver to handle mapping.
 */
export const applyWordRangeToSegments = (
  segments: CanonicalSegment[],
  wordRange?: [number, number]
): CanonicalSegment[] => {
  if (!wordRange) return segments;

  const [start, end] = wordRange;
  const fullPali = segments.map((s) => s.pali).join(' ');
  const paliWords = fullPali.split(/\s+/).filter(Boolean);
  const slicedPali = paliWords.slice(start, end).join(' ');

  const fullEnglish = segments
    .map((s) => s.baseEnglish || '')
    .filter(Boolean)
    .join(' ');

  return [
    {
      ref: segments[0].ref,
      order: segments[0].order,
      pali: slicedPali,
      baseEnglish: fullEnglish || undefined,
    },
  ];
};

export const chunkPhases = (
  segments: CanonicalSegment[],
  size = 8,
  boundaryStarts?: Set<string>
) => {
  const phases: Array<{ id: string; title?: string; segmentIds: string[] }> = [];
  let buffer: CanonicalSegment[] = [];
  const flush = () => {
    if (!buffer.length) return;
    phases.push({
      id: `phase-${phases.length + 1}`,
      title: undefined,
      segmentIds: buffer.map((seg) => seg.ref.segmentId),
    });
    buffer = [];
  };
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (boundaryStarts?.has(seg.ref.segmentId) && buffer.length) {
      flush();
    }
    buffer.push(seg);
    if (buffer.length >= size) flush();
  }
  flush();
  return phases;
};

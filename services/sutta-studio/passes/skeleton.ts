/**
 * Skeleton pass — groups SuttaCentral segments into small study phases.
 *
 * Chunks the input into manageable batches; each chunk is sent to the LLM
 * for grouping. Falls back to deterministic 8-segment chunks if the LLM
 * fails or produces a malformed response.
 *
 * Pure-ish function: takes inputs explicitly via params, returns
 * SkeletonRunResult with per-chunk diagnostics. Telemetry/progress
 * callbacks are NOT inside this pass — they wrap the call externally.
 */

import type { AppSettings } from '../../../types';
import type { CanonicalSegment } from '../../../types/suttaStudio';
import { buildSkeletonPrompt } from '../prompts';
import { parseJsonResponse, type BoundaryNote, type SkeletonPhase } from '../utils';
import { skeletonResponseSchema } from '../schemas';
import { defaultLLMCaller } from './_defaultCaller';
import type { LLMCaller, SkeletonChunkResult, SkeletonRunResult } from './types';
import { SUTTA_STUDIO_TOKEN_BUDGETS } from '../passBudgets';

const fallbackChunkPhases = (
  segments: CanonicalSegment[],
  size = 8,
  boundaryStarts?: Set<string>
): SkeletonPhase[] => {
  const phases: SkeletonPhase[] = [];
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

export const runSkeletonPass = async (params: {
  segments: CanonicalSegment[];
  boundaries?: BoundaryNote[];
  allowCrossChapter?: boolean;
  settings: AppSettings;
  structuredOutputs: boolean;
  signal?: AbortSignal;
  llmCaller?: LLMCaller;
  chunkSize?: number;
  maxTokens?: number;
}): Promise<SkeletonRunResult> => {
  const {
    segments,
    boundaries = [],
    allowCrossChapter,
    settings,
    structuredOutputs,
    signal,
    llmCaller = defaultLLMCaller,
    chunkSize = 50,
    maxTokens = SUTTA_STUDIO_TOKEN_BUDGETS.skeleton,
  } = params;

  const phases: SkeletonPhase[] = [];
  const chunks: SkeletonChunkResult[] = [];
  const safeChunkSize = Math.max(1, Math.min(chunkSize, segments.length));
  const chunkCount = Math.ceil(segments.length / safeChunkSize);

  for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex++) {
    const start = chunkIndex * safeChunkSize;
    const chunkSegments = segments.slice(start, start + safeChunkSize);
    const chunkSegmentIds = new Set(chunkSegments.map((seg) => seg.ref.segmentId));
    const chunkBoundaries = boundaries.filter((b) => chunkSegmentIds.has(b.startSegmentId));
    const fallbackBoundaryStarts =
      !allowCrossChapter && chunkBoundaries.length
        ? new Set(chunkBoundaries.map((b) => b.startSegmentId))
        : undefined;

    const schemaName = `sutta_studio_skeleton_${chunkIndex + 1}`;
    const requestName = 'skeleton';
    const fallback = () => fallbackChunkPhases(chunkSegments, 8, fallbackBoundaryStarts);

    try {
      const skeletonPrompt = buildSkeletonPrompt(chunkSegments, {
        exampleSegmentId: chunkSegments[0]?.ref.segmentId,
        boundaries: chunkBoundaries,
        allowCrossChapter: Boolean(allowCrossChapter),
      });

      const llm = await llmCaller({
        settings,
        messages: [
          { role: 'system', content: 'Return JSON only.' },
          { role: 'user', content: skeletonPrompt },
        ],
        signal,
        maxTokens,
        options: {
          schemaName,
          schema: skeletonResponseSchema,
          structuredOutputs,
          meta: {
            stage: 'skeleton',
            phaseId: `chunk-${chunkIndex + 1}`,
            requestName,
          },
        },
      });

      const parsed = parseJsonResponse<{ phases?: SkeletonPhase[] }>(llm.text);
      if (!parsed.phases || !parsed.phases.length) {
        throw new Error('Skeleton chunk response missing phases.');
      }

      const filtered = parsed.phases
        .map((phase) => ({
          ...phase,
          segmentIds: (phase.segmentIds || []).filter((id) => chunkSegmentIds.has(id)),
        }))
        .filter((phase) => phase.segmentIds.length > 0);

      // Duplicate-claim handling: a phase WITH a wordRange legitimately
      // re-claims a segment an earlier phase already owns — that is how one
      // long segment becomes several sub-split phases. Only phases WITHOUT a
      // wordRange lose duplicate ids (true LLM double-claims), and any phase
      // left empty is dropped loudly so it can never reach the compiler as a
      // zero-segment phase. Mirrors services/compiler/skeleton.ts.
      const seen = new Set<string>();
      filtered.forEach((phase) => {
        phase.segmentIds = phase.segmentIds.filter((id) => {
          if (!seen.has(id)) {
            seen.add(id);
            return true;
          }
          return Boolean(phase.wordRange);
        });
      });
      const nonEmpty = filtered.filter((phase) => {
        if (phase.segmentIds.length > 0) return true;
        console.warn(`[SuttaStudio] Skeleton chunk ${chunkIndex + 1}: dropping ${phase.id} — every segmentId already claimed by an earlier phase and no wordRange.`);
        return false;
      });

      if (seen.size !== chunkSegmentIds.size) {
        throw new Error('Skeleton chunk missing or duplicate segments; falling back to chunking.');
      }

      phases.push(...nonEmpty);
      chunks.push({
        output: nonEmpty,
        llm,
        requestName,
        schemaName,
        phaseId: `chunk-${chunkIndex + 1}`,
        chunkIndex,
        chunkCount,
        segmentCount: chunkSegments.length,
        fallbackUsed: false,
      });
    } catch (e: any) {
      const fallbackPhases = fallback();
      phases.push(...fallbackPhases);
      chunks.push({
        output: fallbackPhases,
        error: e?.message || String(e),
        requestName,
        schemaName,
        phaseId: `chunk-${chunkIndex + 1}`,
        chunkIndex,
        chunkCount,
        segmentCount: chunkSegments.length,
        fallbackUsed: true,
      });
    }
  }

  const normalized = phases.map((phase, index) => ({
    ...phase,
    id: `phase-${index + 1}`,
  }));

  return { phases: normalized, chunks };
};

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
 *
 * NOT yet the production compile path (CONSOLIDATION Phase 4 pending) —
 * services/compiler/index.ts still orchestrates its own inline pass calls;
 * this module serves benchmark/experiment callers until the orchestrator port.
 */

import type { AppSettings } from '../../../types';
import type { CanonicalSegment } from '../../../types/suttaStudio';
import { buildSkeletonPrompt } from '../prompts';
import { chunkPhases, parseJsonResponse, type BoundaryNote, type SkeletonPhase } from '../utils';
import { validateSkeletonPhases } from '../skeletonPhases';
import { skeletonResponseSchema } from '../schemas';
import { defaultLLMCaller } from './_defaultCaller';
import type { LLMCaller, SkeletonChunkResult, SkeletonRunResult } from './types';
import { SUTTA_STUDIO_TOKEN_BUDGETS } from '../passBudgets';

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
    const fallback = () => chunkPhases(chunkSegments, 8, fallbackBoundaryStarts);

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
      const nonEmpty = validateSkeletonPhases(parsed.phases, chunkSegmentIds, (phaseId) => {
        console.warn(`[SuttaStudio] Skeleton chunk ${chunkIndex + 1}: dropping ${phaseId} — every segmentId already claimed by an earlier phase and no wordRange.`);
      });

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

import type { AppSettings } from '../../types';
import type { CanonicalSegment } from '../../types/suttaStudio';
import { logPipelineEvent } from '../suttaStudioPipelineLog';
import { callCompilerLLM } from './llm';
import { buildSkeletonPrompt } from './prompts';
import { skeletonResponseSchema } from './schemas';
import {
  chunkPhases,
  parseJsonResponse,
  type BoundaryNote,
  type SkeletonPhase,
} from './utils';

const log = (message: string, ...args: any[]) =>
  console.log(`[SuttaStudioCompiler] ${message}`, ...args);
const warn = (message: string, ...args: any[]) =>
  console.warn(`[SuttaStudioCompiler] ${message}`, ...args);

export const runSkeletonPass = async ({
  segments,
  boundaries,
  allowCrossChapter,
  settings,
  structuredOutputs,
  signal,
  throttle,
  chunkSize = 50,
  onChunkProgress,
}: {
  segments: CanonicalSegment[];
  boundaries: BoundaryNote[];
  allowCrossChapter?: boolean;
  settings: AppSettings;
  structuredOutputs: boolean;
  signal?: AbortSignal;
  throttle?: (signal?: AbortSignal) => Promise<void>;
  chunkSize?: number;
  onChunkProgress?: (chunkIndex: number, chunkCount: number, segmentCount: number) => void;
}): Promise<SkeletonPhase[]> => {
  const phases: SkeletonPhase[] = [];
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

    try {
      log(`Running skeleton pass (chunk ${chunkIndex + 1}/${chunkCount}, ${chunkSegments.length} segments)...`);
      onChunkProgress?.(chunkIndex, chunkCount, chunkSegments.length);
      const skeletonPrompt = buildSkeletonPrompt(chunkSegments, {
        exampleSegmentId: chunkSegments[0]?.ref.segmentId,
        boundaries: chunkBoundaries,
        allowCrossChapter: Boolean(allowCrossChapter),
      });
      await throttle?.(signal);
      const raw = await callCompilerLLM(
        settings,
        [
          { role: 'system', content: 'Return JSON only.' },
          { role: 'user', content: skeletonPrompt },
        ],
        signal,
        4000,
        {
          schemaName: `sutta_studio_skeleton_${chunkIndex + 1}`,
          schema: skeletonResponseSchema,
          structuredOutputs,
          meta: {
            stage: 'skeleton',
            phaseId: `chunk-${chunkIndex + 1}`,
            requestName: 'skeleton',
          },
        }
      );
      const parsed = parseJsonResponse<{ phases?: SkeletonPhase[] }>(raw);
      if (!parsed.phases || !parsed.phases.length) {
        throw new Error('Skeleton chunk response missing phases.');
      }

      const filtered = parsed.phases
        .map((phase) => ({
          ...phase,
          segmentIds: (phase.segmentIds || []).filter((id) => chunkSegmentIds.has(id)),
        }))
        .filter((phase) => phase.segmentIds.length > 0);

      const seen = new Set<string>();
      filtered.forEach((phase) => {
        phase.segmentIds = phase.segmentIds.filter((id) => {
          if (seen.has(id)) return false;
          seen.add(id);
          return true;
        });
      });

      if (seen.size !== chunkSegmentIds.size) {
        throw new Error('Skeleton chunk missing or duplicate segments; falling back to chunking.');
      }

      phases.push(...filtered);
      logPipelineEvent({
        level: 'info',
        stage: 'skeleton',
        message: 'skeleton.chunk.complete',
        data: { chunkIndex, chunkCount, phaseCount: filtered.length },
      });
    } catch (e) {
      warn(`Skeleton chunk ${chunkIndex + 1}/${chunkCount} failed; falling back to chunked phases.`, e);
      phases.push(...chunkPhases(chunkSegments, 8, fallbackBoundaryStarts));
    }
  }

  return phases.map((phase, index) => ({
    ...phase,
    id: `phase-${index + 1}`,
  }));
};

import type { SkeletonPhase } from './utils';

/** Keep complete segment coverage while allowing wordRange sub-splits. */
export const validateSkeletonPhases = (
  phases: SkeletonPhase[] | undefined,
  segmentIds: ReadonlySet<string>,
  onDuplicatePhase: (_phaseId: string) => void
): SkeletonPhase[] => {
  if (!phases || !phases.length) {
    throw new Error('Skeleton chunk response missing phases.');
  }

  const filtered = phases
    .map((phase) => ({
      ...phase,
      segmentIds: (phase.segmentIds || []).filter((id) => segmentIds.has(id)),
    }))
    .filter((phase) => phase.segmentIds.length > 0);

  const seen = new Set<string>();
  filtered.forEach((phase) => {
    phase.segmentIds = phase.segmentIds.filter((id) => {
      if (!seen.has(id)) {
        seen.add(id);
        return true;
      }
      // Several wordRange phases may intentionally share one source segment.
      return Boolean(phase.wordRange);
    });
  });
  const nonEmpty = filtered.filter((phase) => {
    if (phase.segmentIds.length > 0) return true;
    onDuplicatePhase(phase.id);
    return false;
  });

  if (seen.size !== segmentIds.size) {
    throw new Error('Skeleton chunk missing or duplicate segments; falling back to chunking.');
  }

  return nonEmpty;
};

export interface ChapterRevisionCandidate {
  stableId?: string;
  id?: string;
  lastAccessed?: string | Date | null;
  dateAdded?: string | Date | null;
  importSource?: {
    importDate?: string | Date | null;
  } | null;
}

const toEpoch = (value: string | Date | null | undefined): number => {
  if (value instanceof Date) {
    const epoch = value.getTime();
    return Number.isFinite(epoch) ? epoch : 0;
  }
  if (typeof value !== 'string') return 0;
  const epoch = Date.parse(value);
  return Number.isFinite(epoch) ? epoch : 0;
};

const revisionEpoch = (candidate: ChapterRevisionCandidate): number => {
  return Math.max(
    toEpoch(candidate.lastAccessed),
    toEpoch(candidate.importSource?.importDate),
    toEpoch(candidate.dateAdded)
  );
};

const revisionId = (candidate: ChapterRevisionCandidate): string => {
  return candidate.stableId ?? candidate.id ?? '';
};

/**
 * Choose one scoped chapter revision deterministically without deleting older
 * rows or their translations. Import writes refresh lastAccessed, so the most
 * recently replayed package row wins; the stable ID is a deterministic tie
 * breaker for legacy rows with missing/equal timestamps.
 */
export const selectLatestChapterRevision = <T extends ChapterRevisionCandidate>(
  candidates: Iterable<T>
): T | null => {
  let selected: T | null = null;
  for (const candidate of candidates) {
    if (!selected) {
      selected = candidate;
      continue;
    }

    const candidateEpoch = revisionEpoch(candidate);
    const selectedEpoch = revisionEpoch(selected);
    if (candidateEpoch > selectedEpoch) {
      selected = candidate;
      continue;
    }
    if (candidateEpoch === selectedEpoch && revisionId(candidate) > revisionId(selected)) {
      selected = candidate;
    }
  }
  return selected;
};

import type { CanonicalSegment } from '../types/suttaStudio';

type RetrievalOptions = {
  windowSize?: number;
  maxSegments?: number;
  allowCrossChapter?: boolean;
};

export const buildRetrievalContext = ({
  canonicalSegments,
  phaseSegments,
  windowSize = 2,
  maxSegments = 6,
  allowCrossChapter = false,
}: {
  canonicalSegments: CanonicalSegment[];
  phaseSegments: CanonicalSegment[];
} & RetrievalOptions): string | null => {
  if (!canonicalSegments.length || !phaseSegments.length) return null;

  const indexMap = new Map<string, number>();
  canonicalSegments.forEach((seg, idx) => indexMap.set(seg.ref.segmentId, idx));

  const indices = phaseSegments
    .map((seg) => indexMap.get(seg.ref.segmentId))
    .filter((idx): idx is number => typeof idx === 'number');
  if (!indices.length) return null;

  const minIdx = Math.min(...indices);
  const maxIdx = Math.max(...indices);
  const phaseWorkIds = new Set(phaseSegments.map((seg) => seg.ref.workId));
  const restrictWorkId =
    allowCrossChapter || phaseWorkIds.size !== 1 ? null : Array.from(phaseWorkIds)[0];

  const neighbors: CanonicalSegment[] = [];
  for (let i = Math.max(0, minIdx - windowSize); i < minIdx; i++) {
    neighbors.push(canonicalSegments[i]);
  }
  for (let i = maxIdx + 1; i <= Math.min(canonicalSegments.length - 1, maxIdx + windowSize); i++) {
    neighbors.push(canonicalSegments[i]);
  }

  const filtered = restrictWorkId
    ? neighbors.filter((seg) => seg.ref.workId === restrictWorkId)
    : neighbors;

  const limited = filtered.slice(0, maxSegments);
  if (!limited.length) return null;

  return limited
    .map((seg) => {
      const english = seg.baseEnglish ? ` | english: ${seg.baseEnglish}` : '';
      return `${seg.ref.segmentId} | pali: ${seg.pali}${english}`;
    })
    .join('\n');
};

import type { PaliWord, WordSegment } from '../../types/suttaStudio';

export const hasTextSelection = () => {
  if (typeof window === 'undefined') return false;
  const sel = window.getSelection?.();
  return !!sel && sel.toString().trim().length > 0;
};

export const safeSlug = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

export const wordDomId = (phaseId: string, wordId: string) => `${phaseId}-${wordId}`;
export const segDomId = (phaseId: string, wordId: string, segIndex: number) =>
  `${phaseId}-${wordId}-seg-${segIndex}`;
export const targetDomId = (phaseId: string, structureId: string) =>
  `${phaseId}-target-${structureId}`;

export const buildPaliText = (w: PaliWord) => w.segments.map((s) => s.text).join('');

export const resolveSenseId = (w: PaliWord, idx: number) => {
  const t = w.senses[idx];
  return t?.id ?? `${w.id}-${idx}-${safeSlug(t?.english ?? 'sense')}`;
};

export const resolveSegmentTooltip = (
  seg: WordSegment,
  senseId: string,
  activeIndex: number
) => {
  if (seg.tooltipsBySense?.[senseId]) return seg.tooltipsBySense[senseId];
  if (seg.tooltip) return seg.tooltip;
  const arr = seg.tooltips ?? [];
  return arr[activeIndex] || arr[0] || '';
};

export const formatDuration = (ms?: number | null) => {
  if (ms == null) return null;
  const isNegative = ms < 0;
  const totalSeconds = Math.max(0, Math.round(Math.abs(ms) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const label = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
  return isNegative ? `-${label}` : label;
};

export const resolvePhaseNumber = ({
  totalPhases,
  readyPhases,
  state,
}: {
  totalPhases: number;
  readyPhases: number;
  state?: string;
}) => {
  if (!totalPhases || totalPhases <= 0) return null;
  if (state === 'building' && readyPhases < totalPhases) {
    return Math.max(1, readyPhases + 1);
  }
  if (readyPhases <= 0) return 1;
  return Math.min(totalPhases, readyPhases);
};

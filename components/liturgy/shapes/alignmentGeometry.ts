import type { TokenAlignmentTarget } from '../../../types/liturgy';
import { resolveAlignmentTargets } from '../../../services/liturgy/alignmentTargets';

export type AlignmentLine = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  engIdx: number;
  paliIdx: number;
  targetKind: 'word' | 'morpheme' | 'analysis';
  surfaceMorphemeIndices?: number[];
  analysisUnitId?: string;
};

export type AlignmentGeometryInput = {
  alignTo: number[] | undefined;
  morphemeAlignTo?: (number | null)[];
  tokenAlignTo?: (TokenAlignmentTarget | null)[];
};

type RectLike = Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom' | 'width'>;

function wordAnchor(rect: RectLike, containerRect: DOMRect): { x: number; y: number } {
  return {
    x: rect.left + rect.width / 2 - containerRect.left,
    y: rect.bottom - containerRect.top,
  };
}

function analysisElements(wordElement: HTMLElement, unitId: string): HTMLElement[] {
  return Array.from(
    wordElement.querySelectorAll<HTMLElement>('[data-analysis-unit-ids]')
  ).filter((element) =>
    (element.dataset.analysisUnitIds ?? '').split(/\s+/).includes(unitId)
  );
}

function claimedElementAnchor(
  elements: HTMLElement[],
  containerRect: DOMRect,
  englishCenter: number
): { x: number; y: number; morphemeIndices: number[] } | null {
  if (elements.length === 0) return null;
  const rects = elements.map((element) => element.getBoundingClientRect());
  const chosen = rects.reduce((best, candidate) => {
    const bestDistance = Math.abs(best.left + best.width / 2 - englishCenter);
    const candidateDistance = Math.abs(
      candidate.left + candidate.width / 2 - englishCenter
    );
    return candidateDistance < bestDistance ? candidate : best;
  });
  const morphemeIndices = elements
    .map((element) => Number.parseInt(element.dataset.morphemeIdx ?? '', 10))
    .filter(Number.isFinite);
  return {
    x: chosen.left + chosen.width / 2 - containerRect.left,
    y: chosen.bottom - containerRect.top,
    morphemeIndices,
  };
}

/**
 * Measure authored English-to-source targets against the live DOM.
 * Missing or invalid fine-grained anchors fall back to the whole word; this
 * geometry layer never fabricates a morpheme based on English token order.
 */
export function computeAlignmentLines(
  container: HTMLDivElement,
  input: AlignmentGeometryInput
): AlignmentLine[] {
  const targets = resolveAlignmentTargets(input);
  if (targets.length === 0) return [];

  const containerRect = container.getBoundingClientRect();
  const paliElements = container.querySelectorAll<HTMLElement>('[data-pali-idx]');
  const englishElements = container.querySelectorAll<HTMLElement>('[data-en-idx]');
  const lines: AlignmentLine[] = [];

  targets.forEach((target, engIdx) => {
    if (!target) return;
    const paliElement = paliElements[target.paliIdx];
    const englishElement = englishElements[engIdx];
    if (!paliElement || !englishElement) return;

    const englishRect = englishElement.getBoundingClientRect();
    const fallback = wordAnchor(paliElement.getBoundingClientRect(), containerRect);
    let source = fallback;
    let targetKind: AlignmentLine['targetKind'] = 'word';
    let surfaceMorphemeIndices: number[] | undefined;
    let analysisUnitId: string | undefined;

    if (target.kind === 'morpheme') {
      const morphemeElement = paliElement.querySelector<HTMLElement>(
        `[data-morpheme-idx="${target.morphemeIdx}"]`
      );
      if (morphemeElement) {
        source = wordAnchor(morphemeElement.getBoundingClientRect(), containerRect);
        targetKind = 'morpheme';
        surfaceMorphemeIndices = [target.morphemeIdx];
      }
    } else if (target.kind === 'analysis') {
      const anchor = claimedElementAnchor(
        analysisElements(paliElement, target.unitId),
        containerRect,
        englishRect.left + englishRect.width / 2
      );
      if (anchor) {
        source = { x: anchor.x, y: anchor.y };
        targetKind = 'analysis';
        surfaceMorphemeIndices = anchor.morphemeIndices;
        analysisUnitId = target.unitId;
      }
    }

    lines.push({
      x1: source.x,
      y1: source.y,
      x2: englishRect.left + englishRect.width / 2 - containerRect.left,
      y2: englishRect.top - containerRect.top,
      engIdx,
      paliIdx: target.paliIdx,
      targetKind,
      surfaceMorphemeIndices,
      analysisUnitId,
    });
  });

  return lines;
}

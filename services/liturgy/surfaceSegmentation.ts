import type { WordMorpheme } from '../../types/liturgy';

export type SurfaceMorphemePiece = {
  text: string;
  morpheme: WordMorpheme;
};

export type SurfaceSegmentationFailure = {
  ok: false;
  reason: 'reconstruction' | 'grapheme-boundary' | 'segmenter-unavailable';
  morphemeIndex?: number;
  boundary?: number;
};

export type SurfaceSegmentationResult =
  | { ok: true; pieces: SurfaceMorphemePiece[] }
  | SurfaceSegmentationFailure;

function graphemeBoundaries(surface: string): Set<number> | null {
  if (typeof Intl.Segmenter !== 'function') return null;
  const boundaries = new Set<number>([0, surface.length]);
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  for (const segment of segmenter.segment(surface)) {
    boundaries.add(segment.index);
  }
  return boundaries;
}

/**
 * Split an authored surface only when every slice reconstructs the word and
 * every boundary is a Unicode extended-grapheme boundary. A client without
 * `Intl.Segmenter` fails closed so dependent marks are never isolated merely
 * because the environment cannot prove a safe split.
 */
export function segmentSurfaceMorphemes(
  surface: string,
  morphemes: readonly WordMorpheme[],
  options: { caseSensitive?: boolean } = {}
): SurfaceSegmentationResult {
  const boundaries = graphemeBoundaries(surface);
  if (!boundaries) return { ok: false, reason: 'segmenter-unavailable' };

  const pieces: SurfaceMorphemePiece[] = [];
  let cursor = 0;
  for (const [morphemeIndex, morpheme] of morphemes.entries()) {
    if (morpheme.text.length === 0) {
      return { ok: false, reason: 'reconstruction', morphemeIndex };
    }
    const candidate = surface.slice(cursor, cursor + morpheme.text.length);
    const expected = options.caseSensitive
      ? morpheme.text
      : morpheme.text.toLocaleLowerCase();
    const actual = options.caseSensitive ? candidate : candidate.toLocaleLowerCase();
    if (actual !== expected) {
      return { ok: false, reason: 'reconstruction', morphemeIndex };
    }

    cursor += morpheme.text.length;
    if (!boundaries.has(cursor)) {
      return {
        ok: false,
        reason: 'grapheme-boundary',
        morphemeIndex,
        boundary: cursor,
      };
    }
    pieces.push({ text: candidate, morpheme });
  }

  if (cursor !== surface.length) {
    return { ok: false, reason: 'reconstruction', morphemeIndex: morphemes.length };
  }
  return { ok: true, pieces };
}

export function splitSurfaceByMorphemes(
  surface: string,
  morphemes: readonly WordMorpheme[],
  options?: { caseSensitive?: boolean }
): SurfaceMorphemePiece[] | null {
  const result = segmentSurfaceMorphemes(surface, morphemes, options);
  return result.ok ? result.pieces : null;
}

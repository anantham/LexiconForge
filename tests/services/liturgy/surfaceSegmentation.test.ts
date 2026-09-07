import { describe, expect, it } from 'vitest';
import {
  segmentSurfaceMorphemes,
  splitSurfaceByMorphemes,
} from '../../../services/liturgy/surfaceSegmentation';
import type { WordMorpheme } from '../../../types/liturgy';

function morph(text: string): WordMorpheme {
  return { text, type: 'stem', gloss: text };
}

describe('surface morpheme segmentation', () => {
  it('preserves the authored casing of safe Latin slices', () => {
    expect(
      splitSurfaceByMorphemes('Namo', [morph('nam'), morph('o')])?.map(
        (piece) => piece.text
      )
    ).toEqual(['Nam', 'o']);
  });

  it('accepts Devanagari boundaries between complete grapheme clusters', () => {
    expect(
      splitSurfaceByMorphemes(
        'पाणातिपाता',
        [morph('पाणा'), morph('तिपाता')],
        { caseSensitive: true }
      )?.map((piece) => piece.text)
    ).toEqual(['पाणा', 'तिपाता']);
  });

  it.each([
    ['dependent vowel sign', 'पाणातिपाता', ['पाणा', 'तिपात', 'ा']],
    ['anusvara', 'सिक्खापदं', ['सिक्खा', 'पद', 'ं']],
    ['virama conjunct', 'क्ष', ['क्', 'ष']],
  ])('rejects a %s split inside one grapheme', (_label, surface, texts) => {
    const result = segmentSurfaceMorphemes(
      surface,
      texts.map(morph),
      { caseSensitive: true }
    );

    expect(result).toMatchObject({ ok: false, reason: 'grapheme-boundary' });
    expect(splitSurfaceByMorphemes(surface, texts.map(morph), { caseSensitive: true })).toBeNull();
  });
});

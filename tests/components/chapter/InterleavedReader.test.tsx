/**
 * Tests for components/chapter/InterleavedReader.tsx (issue #15 Phase 3).
 *
 * Verifies:
 *  - Empty alignment renders the "compute alignment" prompt
 *  - Non-empty alignment renders aligned WordPairTokens with source above target
 *  - Hover triggers a per-word lookup (Phase 2 service)
 *  - Click cycles through senses (sutta-studio pattern)
 *  - Source-gap and target-gap segments render between pairs
 *  - Pair with target='' renders muted (dropped in translation)
 */
import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const lookupWordSpy = vi.fn();
vi.mock('../../../services/perWordTranslation', () => ({
  lookupWord: (...args: any[]) => lookupWordSpy(...args),
  __resetPerWordCache: () => {},
}));

import InterleavedReader from '../../../components/chapter/InterleavedReader';
import type { WordAlignment } from '../../../services/wordAlignment';

const makeAlignment = (
  pairs: Array<Partial<WordAlignment['pairs'][number]>>,
): WordAlignment => ({
  pairs: pairs.map((p) => ({
    source: '',
    target: '',
    sourceStart: 0,
    sourceEnd: 0,
    targetStart: 0,
    targetEnd: 0,
    ...p,
  })),
  translationVersionId: 'v1',
  alignedAt: '',
  modelUsed: 'test',
  pairCount: pairs.length,
});

describe('InterleavedReader', () => {
  beforeEach(() => {
    lookupWordSpy.mockReset();
    lookupWordSpy.mockResolvedValue([]);
  });

  describe('alignment-absent state', () => {
    it('renders compute-alignment prompt when alignment is null', () => {
      const onRequestAlignment = vi.fn();
      render(
        <InterleavedReader
          source="李逍遥"
          target="Li Xiaoyao"
          alignment={null}
          onRequestAlignment={onRequestAlignment}
        />,
      );
      expect(screen.getByTestId('interleaved-request-alignment')).toBeInTheDocument();
      expect(screen.getByText(/Compute word alignment/i)).toBeInTheDocument();
    });

    it('disables button while computing', () => {
      render(
        <InterleavedReader
          source="李逍遥"
          target="Li Xiaoyao"
          alignment={null}
          onRequestAlignment={vi.fn()}
          isComputingAlignment
        />,
      );
      const btn = screen.getByTestId('interleaved-request-alignment');
      expect(btn).toBeDisabled();
      expect(btn.textContent).toMatch(/Computing alignment/i);
    });

    it('invokes onRequestAlignment on click', () => {
      const onRequestAlignment = vi.fn();
      render(
        <InterleavedReader
          source="x"
          target="y"
          alignment={null}
          onRequestAlignment={onRequestAlignment}
        />,
      );
      fireEvent.click(screen.getByTestId('interleaved-request-alignment'));
      expect(onRequestAlignment).toHaveBeenCalledTimes(1);
    });
  });

  describe('alignment-present rendering', () => {
    it('renders one WordPairToken per alignment pair', () => {
      const alignment = makeAlignment([
        { source: '李逍遥', target: 'Li Xiaoyao', sourceStart: 0, sourceEnd: 3, targetStart: 0, targetEnd: 10 },
        { source: '很', target: 'is', sourceStart: 3, sourceEnd: 4, targetStart: 11, targetEnd: 13 },
        { source: '强', target: 'strong', sourceStart: 4, sourceEnd: 5, targetStart: 14, targetEnd: 20 },
      ]);
      render(<InterleavedReader source="李逍遥很强" target="Li Xiaoyao is strong" alignment={alignment} />);
      const pairs = screen.getAllByTestId('interleaved-pair');
      expect(pairs).toHaveLength(3);
      expect(pairs[0].dataset.source).toBe('李逍遥');
      expect(pairs[0].dataset.target).toBe('Li Xiaoyao');
      expect(pairs[2].dataset.source).toBe('强');
    });

    it('renders source-gap between pairs (e.g., punctuation)', () => {
      const alignment = makeAlignment([
        { source: 'hello', target: 'bonjour', sourceStart: 0, sourceEnd: 5, targetStart: 0, targetEnd: 7 },
        { source: 'world', target: 'monde', sourceStart: 6, sourceEnd: 11, targetStart: 11, targetEnd: 16 },
      ]);
      render(<InterleavedReader source="hello world" target="bonjour le monde" alignment={alignment} />);
      // gap between pairs at source[5..6] = " "; target[7..11] = " le "
      const sgaps = screen.getAllByTestId('interleaved-source-gap');
      expect(sgaps.length).toBeGreaterThan(0);
      // The space is the source gap
      expect(sgaps.some((g) => g.textContent === ' ')).toBe(true);
    });

    it('renders pair with target="" as muted', () => {
      const alignment = makeAlignment([
        { source: 'こんにちは', target: 'hi', sourceStart: 0, sourceEnd: 5, targetStart: 0, targetEnd: 2 },
        { source: 'よ', target: '', sourceStart: 5, sourceEnd: 6, targetStart: 0, targetEnd: 0 },
      ]);
      render(<InterleavedReader source="こんにちはよ" target="hi" alignment={alignment} />);
      const pairs = screen.getAllByTestId('interleaved-pair');
      expect(pairs).toHaveLength(2);
      expect(pairs[1].className).toContain('opacity-50');
      expect(pairs[1].dataset.target).toBe(''); // dropped
    });
  });

  describe('hover & cycle behavior', () => {
    it('triggers lookupWord on first mouseenter, not on subsequent re-hovers', async () => {
      lookupWordSpy.mockResolvedValueOnce([
        { english: 'mindfulness', provider: 'glossary' },
        { english: 'memory', provider: 'glossary' },
      ]);
      const alignment = makeAlignment([
        { source: 'sati', target: 'mindfulness', sourceStart: 0, sourceEnd: 4, targetStart: 0, targetEnd: 11 },
      ]);
      render(<InterleavedReader source="sati" target="mindfulness" alignment={alignment} sourceLang="pi" />);
      const pair = screen.getByTestId('interleaved-pair');

      fireEvent.mouseEnter(pair);
      // wait for state update
      await new Promise((r) => setTimeout(r, 10));
      expect(lookupWordSpy).toHaveBeenCalledTimes(1);

      // Leave + re-enter should not re-fetch (cached at component level)
      fireEvent.mouseLeave(pair);
      fireEvent.mouseEnter(pair);
      await new Promise((r) => setTimeout(r, 10));
      expect(lookupWordSpy).toHaveBeenCalledTimes(1);
    });

    it('cycles through senses on click', async () => {
      lookupWordSpy.mockResolvedValueOnce([
        { english: 'memory', provider: 'glossary' },
        { english: 'awareness', provider: 'deepl' },
      ]);
      const alignment = makeAlignment([
        { source: 'sati', target: 'mindfulness', sourceStart: 0, sourceEnd: 4, targetStart: 0, targetEnd: 11 },
      ]);
      render(<InterleavedReader source="sati" target="mindfulness" alignment={alignment} sourceLang="pi" />);
      const pair = screen.getByTestId('interleaved-pair');

      fireEvent.mouseEnter(pair);
      await new Promise((r) => setTimeout(r, 10));

      // After hover-fetch: 3 senses total (mindfulness from translation + memory + awareness from lookup)
      expect(pair.dataset.senseCount).toBe('3');
      expect(pair.dataset.target).toBe('mindfulness'); // initial active

      fireEvent.click(pair);
      expect(pair.dataset.target).toBe('memory'); // cycle 0→1

      fireEvent.click(pair);
      expect(pair.dataset.target).toBe('awareness'); // cycle 1→2

      fireEvent.click(pair);
      expect(pair.dataset.target).toBe('mindfulness'); // wrap to 0
    });

    it('does not cycle when only one sense exists', () => {
      // No alts returned from lookupWord
      lookupWordSpy.mockResolvedValueOnce([]);
      const alignment = makeAlignment([
        { source: 'a', target: 'A', sourceStart: 0, sourceEnd: 1, targetStart: 0, targetEnd: 1 },
      ]);
      render(<InterleavedReader source="a" target="A" alignment={alignment} />);
      const pair = screen.getByTestId('interleaved-pair');

      fireEvent.click(pair);
      // Single sense: clicking is no-op
      expect(pair.dataset.target).toBe('A');
    });
  });
});

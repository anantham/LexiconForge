import React from 'react';
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

// jsdom has no ResizeObserver; the interlinear's align-mode thread
// re-measure constructs one on hover. Inert stub — geometry isn't under test.
beforeAll(() => {
  if (!('ResizeObserver' in globalThis)) {
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});
import { GitaSthitaprajnaPage } from '../../../components/gita/GitaSthitaprajnaPage';
import { GitaIndexPage } from '../../../components/gita/GitaIndexPage';

/**
 * Render contract for the Gītā pages: the reader shows all 23 verses with
 * their sounds, both interaction modes are offered, hover produces a gloss,
 * and both pages carry the honest draft/provenance labeling.
 */

afterEach(cleanup);

describe('GitaSthitaprajnaPage', () => {
  it('renders all 23 verse-end markers, the two speaker lines, and per-akshara sounds', () => {
    const { container } = render(<GitaSthitaprajnaPage />);
    for (let v = 50; v <= 72; v++) {
      const deva = String(v).replace(/\d/g, (d) => '०१२३४५६७८९'[Number(d)]);
      expect(
        screen.getByText(`॥२- ${deva}॥`),
        `verse marker 2.${v} missing`,
      ).toBeTruthy();
    }
    // Words render as their akshara pieces, so query at the syllable level:
    // र्जु occurs only in अर्जुन (2.54's speaker line), श्री only in श्रीभगवानुवाच.
    expect(screen.getByText('र्जु')).toBeTruthy();
    expect(screen.getByText('श्री')).toBeTruthy();
    // akshara sound row: the famous 2.56 word renders as syllable stacks
    // स्थि·त·धी·र्मु·नि·रु·च्य·ते, each with its sound beneath.
    expect(screen.getAllByText('स्थि').length).toBeGreaterThan(0);
    expect(screen.getAllByText('sthi').length).toBeGreaterThan(0);
    expect(container.textContent).toContain('र्मु');
  });

  it('offers both modes and the language rail (Sanskrit + English witness)', () => {
    render(<GitaSthitaprajnaPage />);
    expect(screen.getByText('alignment')).toBeTruthy();
    expect(screen.getByText('etymology')).toBeTruthy();
    expect(screen.getByText('Sanskrit')).toBeTruthy();
    expect(screen.getByText('English (Fable draft)')).toBeTruthy();
  });

  it('hovering a word shows its meaning as a tooltip', async () => {
    render(<GitaSthitaprajnaPage />);
    // 2.59: दृष्ट्वा "having seen" — दृ occurs in no other word, and the gloss
    // text appears nowhere else on the page (so the match IS the tooltip).
    const dr = screen.getByText('दृ');
    fireEvent.mouseEnter(dr.closest('[id^="pc-"]')!);
    expect(await screen.findByText('having seen')).toBeTruthy();
  });

  it('labels the English witness as an unreviewed draft, and cites the mūla source', () => {
    const { container } = render(<GitaSthitaprajnaPage />);
    expect(container.textContent).toContain('unreviewed machine translation');
    expect(container.textContent).toContain('sa.wikisource');
    expect(container.textContent).toContain('public domain');
  });
});

describe('GitaIndexPage', () => {
  it('shows the passage card linking to the reader, with honest labeling', () => {
    const { container } = render(<GitaIndexPage />);
    const link = container.querySelector('a[href="/gita/sthitaprajna"]');
    expect(link).toBeTruthy();
    expect(link!.textContent).toContain('स्थितप्रज्ञः');
    expect(link!.textContent).toContain('2.50–2.72');
    expect(container.textContent).toContain('public domain');
    expect(container.textContent).toContain('Fable draft');
  });
});

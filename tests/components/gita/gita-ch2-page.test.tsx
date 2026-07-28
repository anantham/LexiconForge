import React from 'react';
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';

// jsdom has no ResizeObserver; the interlinear's align-mode thread re-measure
// constructs one on hover. Inert stub — geometry isn't under test.
beforeAll(() => {
  if (!('ResizeObserver' in globalThis)) {
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

import { GitaChapter2Page } from '../../../components/gita/GitaChapter2Page';
import { GitaIndexPage } from '../../../components/gita/GitaIndexPage';
import { GITA_CHAPTER2_TIER1 } from '../../../data/gita/chapter2-tier1';
import { aksharasOf } from '../../../components/liturgy/concept/devanagari';
import type { AlignSegment, AlignToken } from '../../../types/liturgyAlign';

/**
 * Render contract for the free Tier-1 chapter-2 reader: it shows the whole
 * chapter with per-akshara sounds, offers both interaction modes, produces a
 * dictionary gloss on hover, and carries the honest mechanical-provenance
 * labeling (and does NOT overclaim a reviewed translation).
 */

afterEach(cleanup);

const saRow = (s: AlignSegment) => s.renderings.find((r) => r.lang === 'sa-Deva')!;
const isMarker = (t: AlignToken) => !t.pronunciation;

describe('GitaChapter2Page', () => {
  it('renders the chapter with verse-end markers and per-akshara sound rows', () => {
    const { container } = render(<GitaChapter2Page />);
    // The verse marker "॥२- NN॥" whitespace-splits into "॥२-" (one per verse)
    // and the numbered close; there is one verse-end per verse (72).
    expect(screen.getAllByText('॥२-').length, 'expected 72 verse-end markers').toBe(72);
    expect(screen.getAllByText('१॥').length, 'verse 2.1 close missing').toBeGreaterThan(0);
    expect(screen.getAllByText('७२॥').length, 'verse 2.72 close missing').toBeGreaterThan(0);
    // an akshara sound row is present (glyph stacked over its IAST)
    expect(container.querySelector('[id^="pc-"]')).toBeTruthy();
  });

  it('offers both interaction modes and the Sanskrit rail', () => {
    render(<GitaChapter2Page />);
    expect(screen.getByText('alignment')).toBeTruthy();
    expect(screen.getByText('etymology')).toBeTruthy();
    // "Sanskrit" appears in both the language rail and the labeling copy.
    expect(screen.getAllByText('Sanskrit').length).toBeGreaterThan(0);
  });

  it('hovering a word shows its dictionary meaning as a tooltip', async () => {
    render(<GitaChapter2Page />);
    // Data-driven: find a glossed word whose FIRST akshara glyph is unique on
    // the page, so hovering that glyph unambiguously targets that word.
    const freq = new Map<string, number>();
    const words = GITA_CHAPTER2_TIER1.flatMap((s) => saRow(s).tokens.filter((t) => !isMarker(t)));
    for (const t of words) for (const a of aksharasOf(t.text)) freq.set(a.text, (freq.get(a.text) ?? 0) + 1);
    const pick = words.find((t) => {
      const first = aksharasOf(t.text)[0]?.text;
      return !!t.gloss && !!first && freq.get(first) === 1;
    });
    expect(pick, 'no glossed word with a unique first akshara found').toBeTruthy();
    const firstAkshara = aksharasOf(pick!.text)[0].text;
    const glyph = screen.getByText(firstAkshara);
    fireEvent.mouseEnter(glyph.closest('[id^="pc-"]')!);
    // the gloss text (its first sense fragment) appears in a tooltip
    const senseFragment = pick!.gloss!.split(/[,+]/)[0].trim();
    expect(await screen.findByText((c) => c.includes(senseFragment))).toBeTruthy();
  });

  it('labels the layer as mechanical/public-domain and does NOT claim a reviewed translation', () => {
    const { container } = render(<GitaChapter2Page />);
    const text = container.textContent ?? '';
    expect(text).toContain('sa.wikisource');
    expect(text).toContain('public domain');
    expect(text).toContain('Monier-Williams');
    expect(text.toLowerCase()).toContain('mechanical');
    // honest: it points at the curated Tier-2 passage rather than pretending to be it
    expect(container.querySelector('a[href="/gita/sthitaprajna"]')).toBeTruthy();
  });
});

describe('GitaIndexPage — chapter-2 card', () => {
  it('links to the free chapter-2 reader with honest two-layer labeling', () => {
    const { container } = render(<GitaIndexPage />);
    const link = container.querySelector('a[href="/gita/chapter/2"]');
    expect(link).toBeTruthy();
    expect(within(link as HTMLElement).getByText('साङ्ख्ययोगः')).toBeTruthy();
    expect(link!.textContent).toContain('2.1');
    expect(container.textContent).toContain('curated');
  });
});

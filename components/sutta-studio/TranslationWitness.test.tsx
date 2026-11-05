import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SuttaStudioView } from './SuttaStudioView';
import { DEFAULT_SETTINGS } from './SettingsPanel';
import { witnessFixture } from '../../tests/fixtures/suttaWitnesses';

vi.mock('react-xarrows', () => ({
  default: ({ start, end }: { start: string; end: string }) => <span data-arrow-start={start} data-arrow-end={end} />,
  Xwrapper: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useXarrow: () => () => {},
}));
beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} });
  localStorage.setItem('sutta-studio-settings', JSON.stringify({ ...DEFAULT_SETTINGS, grammarArrows: false, alignmentLines: true }));
});
afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); });

const choose = (id: string) => fireEvent.change(screen.getByLabelText('Translation witness'), { target: { value: id } });

describe('separate language, witness, lexical-sense and commentary choices', () => {
  it('switches the entire reading, preserves draft senses/ripples, and never mutates source or fixed witness text', async () => {
    const packet = witnessFixture();
    const before = JSON.stringify(packet);
    const { container } = render(<SuttaStudioView packet={packet} />);
    const sourceIds = () => [...container.querySelectorAll('[data-layout-block]')].map(el => el.getAttribute('data-layout-block'));
    const groups = sourceIds();
    fireEvent.click(container.querySelector('#p1-target-p1e1')!);
    await waitFor(() => expect(container.querySelector('#p1-target-p1e1')?.textContent).toBe('p1-alternative-0'));
    expect(container.querySelector('#p1-target-p1g')?.textContent).toBe('an');
    choose('named');
    expect(container.querySelector('#p1-target-p1e1')).toBeNull();
    expect(container.querySelector('#p2-target-p2e1')).toBeNull();
    expect(container.querySelector('#witness-named-cross')?.textContent).toContain('Alpha 🪷 bridge … Tail.');
    expect(container.querySelector('[data-layout-block="p1-2"]')?.textContent).toContain('No mapped passage');
    expect(container.querySelector('[data-layout-block="p2-0"]')?.textContent).toContain('Phrase spans other groups');
    expect(sourceIds()).toEqual(groups);
    fireEvent.click(container.querySelector('#witness-named-cross summary')!);
    fireEvent.keyDown(container.querySelector('#witness-named-cross summary')!, { key: 'Enter' });
    expect(container.querySelector('#witness-named-cross')?.textContent).toContain('Alpha 🪷 bridge … Tail.');
    choose('draft');
    expect(container.querySelector('#p1-target-p1e1')?.textContent).toBe('p1-alternative-0');
    expect(container.querySelector('#p1-target-p1g')?.textContent).toBe('an');
    expect(container.querySelector('[lang="sa-Deva"]')).toBeNull();
    expect(JSON.stringify(packet)).toBe(before);
  });
  it('cycles named witnesses within a language and languages independently, including RTL', () => {
    const { container } = render(<SuttaStudioView packet={witnessFixture()} />);
    fireEvent.click(screen.getByText('Next translation'));
    expect(screen.getByLabelText('Translation language')).toHaveProperty('value', 'en');
    expect(screen.getByLabelText('Translation witness')).toHaveProperty('value', 'named');
    fireEvent.click(screen.getByText('Next language'));
    expect(screen.getByLabelText('Translation language')).toHaveProperty('value', 'ar');
    expect(screen.getByLabelText('Translation witness')).toHaveProperty('value', 'rtl');
    expect(container.querySelector('#witness-rtl-r [lang="ar"]')?.getAttribute('dir')).toBe('rtl');
    expect(container.querySelector('#witness-named-cross')).toBeNull();
    expect(screen.getByText(/Publisher: Synthetic test publisher/)).toBeTruthy();
    fireEvent.click(screen.getByText('Next language'));
    expect(screen.getByLabelText('Translation witness')).toHaveProperty('value', 'named');
    fireEvent.keyDown(screen.getByLabelText('Translation witness'), { key: 'ArrowRight' });
    expect(screen.getByLabelText('Translation witness')).toHaveProperty('value', 'named');
  });
  it('highlights all definite source spans, with phrase-level arrows only; uncertain/unaligned text gets none', () => {
    const { container } = render(<SuttaStudioView packet={witnessFixture()} />);
    choose('named');
    fireEvent.mouseEnter(container.querySelector('#witness-named-cross')!);
    expect([...container.querySelectorAll('[data-arrow-end="witness-named-cross"]')].map(el => el.getAttribute('data-arrow-start'))).toEqual(['p1-p1w1', 'p1-p1w2', 'p2-p2w1']);
    expect(container.querySelector('#p1-p1w1')?.parentElement?.className).toContain('ring-1');
    fireEvent.mouseLeave(container.querySelector('#witness-named-cross')!);
    for (const id of ['maybe', 'unknown']) {
      fireEvent.mouseEnter(container.querySelector(`#witness-named-${id}`)!);
      expect(container.querySelector(`[data-arrow-end="witness-named-${id}"]`)).toBeNull();
    }
  });
  it('surfaces invalid mappings and missing selected witnesses without falling back to another translator', () => {
    const packet = witnessFixture();
    const { container, rerender } = render(<SuttaStudioView packet={packet} />);
    choose('named');
    const bad = structuredClone(packet);
    bad.translations!.witnesses = bad.translations!.witnesses.filter(w => w.id !== 'named');
    rerender(<SuttaStudioView packet={bad} />);
    expect(screen.getByRole('alert').textContent).toContain('Witness named is unavailable');
    expect(container.querySelector('#p1-target-p1e1')).toBeNull();
    const broken = structuredClone(packet);
    const named = broken.translations!.witnesses[1];
    if (named.content.kind !== 'translation') throw new Error('fixture');
    named.content.alignments[0].targetSpans[0].end--;
    rerender(<SuttaStudioView packet={broken} />);
    expect(screen.getByRole('alert').textContent).toContain('each target code point');
    expect(container.querySelector('#witness-named-cross')).toBeNull();
    expect(container.querySelector('#p1-target-p1e1')).toBeNull();
  });
});

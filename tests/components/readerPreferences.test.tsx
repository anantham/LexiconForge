import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GitaChapter2Page } from '../../components/gita/GitaChapter2Page';
import { GitaSthitaprajnaPage } from '../../components/gita/GitaSthitaprajnaPage';
import { UrakamProtoPage } from '../../components/malayalam/UrakamProtoPage';

vi.mock('../../components/liturgy/concept/ConceptInterlinear', () => ({
  ConceptInterlinear: ({ tooltips }: { tooltips: boolean }) => (
    <div data-testid="reader" data-tooltips={String(tooltips)} />
  ),
}));
vi.mock('../../data/gita/chapter2-tier1', () => ({ GITA_CHAPTER2_TIER1: [] }));
vi.mock('../../data/gita/sthitaprajna', () => ({ GITA_STHITAPRAJNA: [] }));
vi.mock('../../data/malayalam/urakam-ammathiruvadi', () => ({ URAKAM_SENTENCE_1: [] }));
vi.mock('../../data/malayalam/urakam-tier1', () => ({ URAKAM_TIER1: [] }));

beforeEach(() => {
  localStorage.clear();
  document.documentElement.style.fontSize = '';
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe.each([
  { name: 'Gita chapter', Page: GitaChapter2Page, key: 'gita-reader-prefs' },
  { name: 'Gita passage', Page: GitaSthitaprajnaPage, key: 'gita-reader-prefs' },
  { name: 'Malayalam passage', Page: UrakamProtoPage, key: 'ml-reader-prefs' },
])('$name preferences', ({ Page, key }) => {
  it('loads, changes and persists its reader preferences and clears font scaling on leave', async () => {
    const user = userEvent.setup();
    localStorage.setItem(key, JSON.stringify({ tooltips: false, scale: 1.25 }));
    const otherKey = key === 'gita-reader-prefs' ? 'ml-reader-prefs' : 'gita-reader-prefs';
    localStorage.setItem(otherKey, JSON.stringify({ tooltips: true, scale: 0.9 }));
    const { unmount } = render(<Page />);
    expect(await screen.findByTestId('reader')).toHaveAttribute('data-tooltips', 'false');
    expect(document.documentElement.style.fontSize).toBe('125%');

    await user.click(screen.getByRole('button', { name: 'Reader settings' }));
    await user.click(screen.getByRole('checkbox', { name: 'Tooltips' }));
    fireEvent.change(screen.getByRole('slider', { name: 'Text size' }), { target: { value: '1.4' } });

    expect(screen.getByTestId('reader')).toHaveAttribute('data-tooltips', 'true');
    expect(document.documentElement.style.fontSize).toBe('140%');
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual({ tooltips: true, scale: 1.4 });
    expect(JSON.parse(localStorage.getItem(otherKey)!)).toEqual({ tooltips: true, scale: 0.9 });
    unmount();
    expect(document.documentElement.style.fontSize).toBe('');
  });

  it('closes settings on Escape or outside click', async () => {
    const user = userEvent.setup();
    render(<Page />);
    await screen.findByTestId('reader');
    const settings = screen.getByRole('button', { name: 'Reader settings' });
    await user.click(settings);
    expect(settings).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard('{Escape}');
    expect(settings).toHaveAttribute('aria-expanded', 'false');
    await user.click(settings);
    await user.click(document.body);
    expect(settings).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('slider')).toBeNull();
  });
});

it.each(['not json', 'null', '3'])('uses reader defaults for unusable stored preferences %j', (stored) => {
  localStorage.setItem('gita-reader-prefs', stored);
  render(<GitaSthitaprajnaPage />);
  expect(screen.getByTestId('reader')).toHaveAttribute('data-tooltips', 'true');
  expect(document.documentElement.style.fontSize).toBe('100%');
});

it('keeps reader controls usable when browser storage is blocked', async () => {
  const user = userEvent.setup();
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
  render(<GitaSthitaprajnaPage />);
  await user.click(screen.getByRole('button', { name: 'Reader settings' }));
  await user.click(screen.getByRole('checkbox', { name: 'Tooltips' }));
  fireEvent.change(screen.getByRole('slider', { name: 'Text size' }), { target: { value: '1.2' } });
  expect(screen.getByTestId('reader')).toHaveAttribute('data-tooltips', 'false');
  expect(document.documentElement.style.fontSize).toBe('120%');
});

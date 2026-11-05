import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SuttaStudioView } from './SuttaStudioView';
import { DEFAULT_SETTINGS } from './SettingsPanel';
import packetJson from '../../content/references/sutta/trimsika.json';
import type { DeepLoomPacket } from '../../types/suttaStudio';

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} });
  localStorage.setItem('sutta-studio-settings', JSON.stringify({ ...DEFAULT_SETTINGS, grammarArrows: false, alignmentLines: false }));
});
afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); });

it('switches a real named English witness, remembers it across Malayalam, and retains the separate draft sense', async () => {
  const packet = packetJson as DeepLoomPacket;
  const phase = packet.phases[16];
  const witnesses = packet.translations!.witnesses.map(w => {
    if (w.content.kind === 'legacy-interlinear') return w;
    const alignments = w.content.alignments.filter(a => a.displayAt.phaseId === phase.id);
    const passages = new Set(alignments.flatMap(a => a.targetSpans.map(s => s.passageId)));
    return { ...w, content: { kind: 'translation' as const, alignments, passages: w.content.passages.filter(p => passages.has(p.id)) } };
  });
  const { container } = render(<SuttaStudioView packet={{ ...packet, phases: [phase], translations: { ...packet.translations!, witnesses } }} />);
  fireEvent.click(container.querySelector('#verse-17-target-v17e4')!);
  await waitFor(() => expect(container.querySelector('#verse-17-target-v17e4')?.textContent).toBe('act of discrimination'));
  fireEvent.change(screen.getByLabelText('Translation witness'), { target: { value: 'lapis-lazuli-en' } });
  expect(container.querySelector('#witness-lapis-lazuli-en-ll-v17-l4-4 [lang="en"]')?.textContent).toBe('Thus they are all Consciousness Only.');
  expect(screen.getByText(/Publisher: Lapis Lazuli Texts/)).toBeTruthy();
  expect(screen.getByText(/Translated from zh:/)).toBeTruthy();
  expect(container.querySelector('#verse-17-target-v17e4')).toBeNull();
  fireEvent.change(screen.getByLabelText('Translation language'), { target: { value: 'ml' } });
  expect(container.querySelector('[lang="ml"]')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Translation language'), { target: { value: 'en' } });
  expect(screen.getByLabelText('Translation witness')).toHaveProperty('value', 'lapis-lazuli-en');
  expect(container.querySelector('#witness-lapis-lazuli-en-ll-v17-l4-4')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Translation witness'), { target: { value: 'codex-study-en' } });
  expect(container.querySelector('#verse-17-target-v17e4')?.textContent).toBe('act of discrimination');
  expect(container.querySelector('#verse-17-target-v17g1')?.textContent).toBe('is an');
  expect(container.querySelector('[lang="sa-Deva"]')).toBeNull();
});

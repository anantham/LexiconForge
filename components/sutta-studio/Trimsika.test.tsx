import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AboutThisText } from './AboutThisText';
import { EnglishWordEngine } from './EnglishWord';
import { DEFAULT_SETTINGS } from './SettingsPanel';
import { SuttaStudioView } from './SuttaStudioView';
import data from '../../content/references/sutta/trimsika.json';
import mn10 from '../../content/references/sutta/mn10.json';
import type { DeepLoomPacket } from '../../types/suttaStudio';
import { sanskritReading } from './sanskritReading';
const packet = data as DeepLoomPacket;
// These one-verse legacy-renderer fixtures deliberately carry only the interlinear witness.
// Full Malayalam source/target coverage and its rendered verses have separate tests.
const draftPacket = { ...packet, translations: packet.translations ? {
  ...packet.translations, witnesses: packet.translations.witnesses.filter(w => w.content.kind === 'legacy-interlinear'),
} : undefined };
beforeEach(() => { vi.stubGlobal('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} }); });
afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); });

describe('Sanskrit in the MN10 reader', () => {
  it('shows truthful Sanskrit draft provenance without borrowed MN10/DPD claims', () => {
    render(<AboutThisText packet={packet} />);
    expect(screen.getByText(/Sanskrit · all 30 verses/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Expand About This Text panel' }));
    expect(screen.queryByText(/Foundations of Mindfulness/)).toBeNull();
    expect(screen.queryByText(/Lexical glosses backed by Digital Pāli/)).toBeNull();
    expect(screen.getByText(/Explicit v. 13 emendation/)).toBeTruthy();
  });
  it('keeps the legacy MN10 provenance fallback', () => {
    render(<AboutThisText packet={mn10 as DeepLoomPacket} />);
    fireEvent.click(screen.getByRole('button', { name: 'Expand About This Text panel' }));
    expect(screen.getByText(/MN10 — Satipaṭṭhāna Sutta/)).toBeTruthy();
    expect(screen.getByText(/Lexical glosses backed by Digital Pāli/)).toBeTruthy();
  });
  it('omits an explicitly empty unknowns section', () => {
    render(<AboutThisText packet={{ ...packet, provenance: { ...packet.provenance, unknowns: [] } }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Expand About This Text panel' }));
    expect(screen.queryByText('Unknowns')).toBeNull();
  });
  it.each(packet.phases.map(phase => [phase.id, phase] as const))(
    '%s keeps every English binding and ghost beside its small Sanskrit group',
    (_id, phase) => {
      localStorage.setItem('sutta-studio-settings', JSON.stringify({ ...DEFAULT_SETTINGS, grammarArrows: false, alignmentLines: false }));
      const { container } = render(<SuttaStudioView packet={{ ...draftPacket, phases: [phase] }} />);
      const elementsById = new Map<string, Element[]>();
      for (const element of container.querySelectorAll('[id]')) {
        elementsById.set(element.id, [...(elementsById.get(element.id) ?? []), element]);
      }
      for (const [index, words] of phase.layoutBlocks!.entries()) {
        const group = container.querySelector(`[data-layout-block="${phase.id}-${index}"]`)!;
        for (const id of words) expect(group.querySelector(`#${phase.id}-${id}`)).toBeTruthy();
        for (const token of phase.englishStructure.filter(t => t.linkedPaliId && words.includes(t.linkedPaliId))) {
          expect(group.querySelector(`#${phase.id}-target-${token.id}`)).toBeTruthy();
        }
      }
      for (const token of phase.englishStructure) {
        expect(elementsById.get(`${phase.id}-target-${token.id}`)).toHaveLength(1);
        if (token.layoutWordId) {
          const source = container.querySelector(`#${phase.id}-${token.layoutWordId}`)!;
          const group = source.closest('[data-layout-block]')!;
          expect(group.querySelector(`#${phase.id}-target-${token.id}`)?.textContent).toBe(token.label);
        }
      }
      expect(container.querySelector('[lang="sa-Deva"]')).toBeNull();
      if (phase.id === 'verse-23') {
        const article = container.querySelector('#verse-23-target-v23g2')!;
        expect(article.textContent).toBe('the');
        expect(article.closest('[data-layout-block]')?.getAttribute('data-layout-block')).toBe('verse-23-2');
      }
    }
  );
  it('cycles the real English word and its grammatical ghost, then wraps back', async () => {
    localStorage.setItem('sutta-studio-settings', JSON.stringify({ ...DEFAULT_SETTINGS, grammarArrows: false, alignmentLines: false }));
    const phase = packet.phases[16];
    const limited = { ...draftPacket, phases: [phase], progress: { totalPhases: 1, readyPhases: 1, state: 'complete' as const } };
    const { container } = render(<SuttaStudioView packet={limited} />);
    const token = phase.englishStructure.find(t => t.linkedPaliId === 'v17w3')!;
    const english = () => container.querySelector(`#verse-17-target-${token.id}`)!;
    const ghost = () => container.querySelector('#verse-17-target-v17g1')!;
    expect(english().textContent).toBe('construction');
    expect(ghost().textContent).toBe('is a');
    fireEvent.click(english());
    await waitFor(() => expect(english().textContent).toBe('act of discrimination'));
    await waitFor(() => expect(ghost().textContent).toBe('is an'));
    fireEvent.click(english());
    await waitFor(() => expect(english().textContent).toBe('construction'));
    await waitFor(() => expect(ghost().textContent).toBe('is a'));
    expect(container.querySelector('#verse-17-seg-v17w3s1')?.textContent).toBe('vikalpo');
  });
  it('renders supplied grammar at 0.3 opacity and removes it when ghosts are hidden', () => {
    const phase = packet.phases[16];
    const ghost = phase.englishStructure.find(t => t.id === 'v17g1')!;
    const props = { phaseId: phase.id, structure: ghost, paliWords: phase.paliWords, activeIndices: {}, hovered: null, setHovered: () => {}, cycle: () => {}, ghostOpacity: 0.3 };
    const { container, rerender } = render(<EnglishWordEngine {...props} />);
    expect(container.querySelector('[style]')?.getAttribute('style')).toContain('opacity: 0.3');
    rerender(<EnglishWordEngine {...props} showGhosts={false} />);
    expect(container.textContent).toBe('');
  });
  it('keeps repeated spellings distinct in both hover directions', () => {
    localStorage.setItem('sutta-studio-settings', JSON.stringify({ ...DEFAULT_SETTINGS, grammarArrows: false, alignmentLines: false }));
    const phase = packet.phases[17];
    const { container } = render(<SuttaStudioView packet={{ ...draftPacket, phases: [phase] }} />);
    const target = (wordId: string) => container.querySelector(`#verse-18-target-${phase.englishStructure.find(t => t.linkedPaliId === wordId)!.id}`)!;
    const first = container.querySelector('#verse-18-seg-v18w5s1')!;
    const secondWord = container.querySelector('#verse-18-v18w6')!;
    expect(first.textContent).toBe('tathā');
    expect(secondWord.textContent).toBe('tathā');
    fireEvent.mouseEnter(first);
    expect(target('v18w5').className).toContain('text-emerald-400');
    expect(target('v18w6').className).not.toContain('text-emerald-400');
    fireEvent.mouseLeave(first);
    fireEvent.mouseEnter(target('v18w6'));
    expect(secondWord.className).toContain('ring-1');
    expect(container.querySelector('#verse-18-v18w5')!.className).not.toContain('ring-1');
  });
  it('discloses script on Sanskrit hover/tap without changing the English sense', async () => {
    localStorage.setItem('sutta-studio-settings', JSON.stringify({ ...DEFAULT_SETTINGS, grammarArrows: false, alignmentLines: false }));
    const phase = packet.phases[2];
    const word = phase.paliWords[0];
    const { container } = render(<SuttaStudioView packet={{ ...draftPacket, phases: [phase] }} />);
    const source = container.querySelector('#verse-3-seg-v3w1s1')!;
    const target = container.querySelector(`#verse-3-target-${phase.englishStructure.find(t => t.linkedPaliId === word.id)!.id}`)!;
    const iast = word.segments.map(s => s.text).join('');
    const deva = sanskritReading(iast)!.devanagari;
    expect(container.querySelector('[lang="sa-Deva"]')).toBeNull();
    fireEvent.mouseEnter(source);
    expect(target.className).toContain('text-emerald-400');
    expect(container.querySelector('[lang="sa-Deva"]')?.textContent).toBe(deva);
    fireEvent.click(source);
    expect(screen.getByRole('dialog', { name: `Reading ${iast}` })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Word note' }));
    expect(screen.getByText(word.senses[0].notes!)).toBeTruthy();
    expect(target.textContent).toBe(word.senses[0].english);
    fireEvent.click(screen.getByRole('button', { name: 'Reading' }));
    fireEvent.keyDown(source, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(container.querySelector('[lang="sa-Deva"]')).toBeNull();
    fireEvent.mouseEnter(target);
    fireEvent.keyDown(window, { key: 'Enter' });
    await waitFor(() => expect(target.textContent).toBe(word.senses[1].english));
    fireEvent.mouseEnter(source);
    fireEvent.click(source);
    fireEvent.click(screen.getByRole('button', { name: 'Close Sanskrit reading' }));
    await waitFor(() => expect(container.querySelector('[lang="sa-Deva"]')).toBeNull());
    expect(target.textContent).toBe(word.senses[1].english);
    expect(container.querySelectorAll('#verse-3-v3w1')).toHaveLength(1);
  });
  it('opens the reading aid from the keyboard and keeps only one tapped disclosure open', async () => {
    localStorage.setItem('sutta-studio-settings', JSON.stringify({ ...DEFAULT_SETTINGS, tooltips: false, grammarArrows: false, alignmentLines: false }));
    const phase = packet.phases[16];
    const { container } = render(<SuttaStudioView packet={{ ...draftPacket, phases: [phase] }} />);
    const first = container.querySelector('#verse-17-seg-v17w3s1')!;
    const second = container.querySelector('#verse-17-seg-v17w2s1')!;
    fireEvent.focus(first);
    fireEvent.keyDown(first, { key: 'Enter' });
    expect(screen.getByRole('dialog', { name: 'Reading vikalpo' })).toBeTruthy();
    expect(container.querySelector('#verse-17-target-v17e4')!.textContent).toBe('construction');
    fireEvent.pointerDown(second, { pointerType: 'touch' });
    fireEvent.click(second);
    await waitFor(() => expect(screen.getAllByRole('dialog')).toHaveLength(1));
    expect(screen.getByRole('dialog', { name: "Reading 'yaṃ" })).toBeTruthy();
    fireEvent.pointerDown(document.body);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});

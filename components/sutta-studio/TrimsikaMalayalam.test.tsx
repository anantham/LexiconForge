import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SuttaStudioView } from './SuttaStudioView';
import { DEFAULT_SETTINGS } from './SettingsPanel';
import { witnessSpanText } from '../../services/sutta-studio/witnesses';
import packetJson from '../../content/references/sutta/trimsika.json';
import type { DeepLoomPacket, PhaseView } from '../../types/suttaStudio';

const packet = packetJson as DeepLoomPacket;
const malayalam = packet.translations!.witnesses.find(w => w.language === 'ml')!;
function singleVerse(phase: PhaseView): DeepLoomPacket {
  if (malayalam.content.kind !== 'translation') throw new Error('Malayalam fixture missing');
  const content = malayalam.content;
  const alignments = content.alignments.filter(e => e.displayAt.phaseId === phase.id);
  const passageIds = new Set(alignments.flatMap(e => e.targetSpans.map(s => s.passageId)));
  return { ...packet, phases: [phase], translations: {
    defaultWitnessId: packet.translations!.defaultWitnessId,
    witnesses: [packet.translations!.witnesses[0], { ...malayalam, content: { kind: 'translation', alignments, passages: content.passages.filter(p => passageIds.has(p.id)) } }],
  } };
}
beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} });
  localStorage.setItem('sutta-studio-settings', JSON.stringify({ ...DEFAULT_SETTINGS, grammarArrows: false, alignmentLines: false }));
});
afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); });

describe('Malayalam in the small-group Sanskrit reader', () => {
  it.each(packet.phases.map(phase => [phase.id, phase] as const))('%s renders its exact Malayalam phrases and preserves every source group', (_id, phase) => {
    const fixture = singleVerse(phase);
    const { container } = render(<SuttaStudioView packet={fixture} />);
    const groups = () => [...container.querySelectorAll('[data-layout-block]')].map(g => g.getAttribute('data-layout-block'));
    const before = groups();
    fireEvent.change(screen.getByLabelText('Translation language'), { target: { value: 'ml' } });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(groups()).toEqual(before);
    expect(container.querySelector('[lang="sa-Deva"]')).toBeNull();
    const witness = fixture.translations!.witnesses[1];
    if (witness.content.kind !== 'translation') throw new Error('fixture');
    for (const edge of witness.content.alignments) {
      const el = container.querySelector(`#witness-${witness.id}-${edge.id}`)!;
      expect(el.querySelector('[lang="ml"]')?.textContent).toBe(edge.targetSpans.map(span => witnessSpanText(witness, span)).join(' … '));
      const source = container.querySelector(`#${phase.id}-${edge.displayAt.wordId}`)!;
      expect(el.closest('[data-layout-block]')).toBe(source.closest('[data-layout-block]'));
      expect(el.querySelector('[lang="ml"]')?.className).toContain('break-words');
    }
    for (const word of phase.paliWords) expect(container.querySelectorAll(`#${phase.id}-${word.id}`)).toHaveLength(1);
    expect(container.querySelectorAll('[id*="-target-"]')).toHaveLength(0);
  });
  it('returns from Malayalam to the same English sense and grammar ripple', async () => {
    const { container } = render(<SuttaStudioView packet={singleVerse(packet.phases[16])} />);
    fireEvent.click(container.querySelector('#verse-17-target-v17e4')!);
    await waitFor(() => expect(container.querySelector('#verse-17-target-v17e4')?.textContent).toBe('act of discrimination'));
    fireEvent.change(screen.getByLabelText('Translation language'), { target: { value: 'ml' } });
    expect(container.querySelector('[lang="ml"]')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Translation language'), { target: { value: 'en' } });
    expect(container.querySelector('#verse-17-target-v17e4')?.textContent).toBe('act of discrimination');
    expect(container.querySelector('#verse-17-target-v17g1')?.textContent).toBe('is an');
  });
});

import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { TripleScriptWitness } from '../../../components/liturgy/shapes/TripleScriptWitness';
import { computeAlignmentLines } from '../../../components/liturgy/shapes/alignmentGeometry';
import type { TripleScriptWitnessSection } from '../../../types/liturgy';

beforeAll(() => {
  if (!('ResizeObserver' in globalThis)) {
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      observe() {}
      disconnect() {}
    };
  }
});

afterEach(cleanup);

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
    toJSON: () => ({}),
  } as DOMRect;
}

const section: TripleScriptWitnessSection = {
  id: 'body',
  shape: 'triple-script-witness',
  segments: [{
    id: 'line',
    pali: 'Pāṇātipātā',
    words: [{
      form: 'pāṇātipātā',
      gloss: 'from killing living beings',
      morphemes: [
        { text: 'pāṇā', type: 'stem', gloss: 'living being' },
        { text: 'tipāt', type: 'stem', gloss: 'killing' },
        { text: 'ā', type: 'suffix', gloss: 'from' },
      ],
      analysis: {
        status: 'confirmed',
        units: [
          { id: 'living-being', layer: 'lexical', label: 'pāṇa', gloss: 'living being', surfaceMorphemeIndices: [0] },
          { id: 'killing', layer: 'lexical', label: 'atipāta', gloss: 'killing', surfaceMorphemeIndices: [1], status: 'alternative' },
          { id: 'ablative-source', layer: 'grammar', label: '-ā', gloss: 'from', surfaceMorphemeIndices: [2], status: 'needs-review' },
        ],
      },
    }],
    witnesses: [{
      by: 'Test',
      text: 'living killing from',
      alignTo: [0, 0, 0],
      tokenAlignTo: [
        { kind: 'analysis', unitId: 'living-being' },
        { kind: 'analysis', unitId: 'killing' },
        { kind: 'analysis', unitId: 'ablative-source' },
      ],
    }],
  }],
};

describe('semantic alignment renderer-to-geometry bridge', () => {
  it('emits review status and analysis identity into reader-visible morpheme spans', () => {
    const { container } = render(
      <TripleScriptWitness
        section={section}
        preferredWitnessBy="Test"
        onCycleWitness={() => undefined}
      />
    );

    const spans = container.querySelectorAll<HTMLElement>('[data-morpheme-idx]');
    expect(spans).toHaveLength(3);
    expect(spans[0]).toHaveAttribute('data-analysis-unit-ids', 'living-being');
    expect(spans[0]).toHaveAttribute('data-analysis-status', 'confirmed');
    expect(spans[0].className).toContain('border-solid');
    expect(spans[1]).toHaveAttribute('data-analysis-status', 'alternative');
    expect(spans[1].className).toContain('border-dotted');
    expect(spans[2]).toHaveAttribute('data-analysis-status', 'needs-review');
    expect(spans[2].className).toContain('border-dashed');

    fireEvent.mouseEnter(spans[1]);
    expect(
      screen.getByText(/Layered analysis \(alternative reading\): lexical atipāta: killing/)
    ).toBeInTheDocument();
  });

  it('feeds renderer-emitted analysis attributes into claimed-slice geometry', () => {
    const { container } = render(
      <TripleScriptWitness
        section={section}
        preferredWitnessBy="Test"
        onCycleWitness={() => undefined}
      />
    );
    const segment = container.querySelector<HTMLDivElement>('#line')!;
    segment.getBoundingClientRect = () => rect(0, 0, 300, 180);
    const pali = segment.querySelector<HTMLElement>('[data-pali-idx="0"]')!;
    pali.getBoundingClientRect = () => rect(10, 20, 100, 20);
    pali.querySelectorAll<HTMLElement>('[data-morpheme-idx]').forEach((element, index) => {
      const left = [10, 50, 95][index];
      const width = [40, 45, 15][index];
      element.getBoundingClientRect = () => rect(left, 20, width, 20);
    });
    segment.querySelectorAll<HTMLElement>('[data-en-idx]').forEach((element, index) => {
      element.getBoundingClientRect = () => rect(20 + index * 60, 100, 40, 20);
    });

    const lines = computeAlignmentLines(segment, {
      alignTo: [0, 0, 0],
      tokenAlignTo: section.segments[0].witnesses[0].tokenAlignTo,
    });
    expect(lines.map((line) => [line.analysisUnitId, line.x1])).toEqual([
      ['living-being', 30],
      ['killing', 72.5],
      ['ablative-source', 102.5],
    ]);
  });

  it('falls back to one whole-word span when alternate-script metadata splits a grapheme', () => {
    const unsafe = structuredClone(section);
    const segment = unsafe.segments[0];
    segment.paliDeva = 'पाणातिपाता';
    const sourceWord = segment.words![0];
    sourceWord.scriptAlt = 'पाणातिपाता';
    sourceWord.scriptMorphemes = {
      'pi-Deva': [
        { text: 'पाणा', type: 'stem', gloss: 'living being' },
        { text: 'तिपात', type: 'stem', gloss: 'killing' },
        { text: 'ा', type: 'suffix', gloss: 'from' },
      ],
    };

    const { container } = render(
      <TripleScriptWitness
        section={unsafe}
        preferredWitnessBy="Test"
        onCycleWitness={() => undefined}
      />
    );
    fireEvent.click(screen.getByTitle('Click to switch script (Pāli)'));

    const paliWord = container.querySelector<HTMLElement>('[data-pali-idx="0"]')!;
    const hoverSpans = paliWord.querySelectorAll<HTMLElement>('[data-hover-span="true"]');
    expect(hoverSpans).toHaveLength(1);
    expect(hoverSpans[0]).toHaveTextContent('पाणातिपाता');
    expect(hoverSpans[0]).not.toHaveAttribute('data-morpheme-idx');
  });
});

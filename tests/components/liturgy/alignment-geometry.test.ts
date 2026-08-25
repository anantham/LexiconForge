import { describe, expect, it } from 'vitest';
import { computeAlignmentLines } from '../../../components/liturgy/shapes/alignmentGeometry';

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

function fixture(): HTMLDivElement {
  const container = document.createElement('div');
  container.innerHTML = `
    <span data-pali-idx="0">
      <span data-morpheme-idx="0" data-analysis-unit-ids="living-being">pāṇā</span>
      <span data-morpheme-idx="1" data-analysis-unit-ids="killing">tipāt</span>
      <span data-morpheme-idx="2" data-analysis-unit-ids="ablative-source">ā</span>
    </span>
    <span data-en-idx="0">killing</span>
    <span data-en-idx="1">living</span>
    <span data-en-idx="2">from</span>
  `;
  container.getBoundingClientRect = () => rect(0, 0, 300, 200);
  const pali = container.querySelector<HTMLElement>('[data-pali-idx="0"]')!;
  pali.getBoundingClientRect = () => rect(10, 20, 100, 20);
  const morphs = pali.querySelectorAll<HTMLElement>('[data-morpheme-idx]');
  morphs[0].getBoundingClientRect = () => rect(10, 20, 40, 20);
  morphs[1].getBoundingClientRect = () => rect(50, 20, 45, 20);
  morphs[2].getBoundingClientRect = () => rect(95, 20, 15, 20);
  container.querySelectorAll<HTMLElement>('[data-en-idx]').forEach((element, index) => {
    element.getBoundingClientRect = () => rect(20 + index * 60, 100, 40, 20);
  });
  return container;
}

describe('computeAlignmentLines', () => {
  it('anchors every unauthored many-to-one token at the whole word centre', () => {
    const lines = computeAlignmentLines(fixture(), { alignTo: [0, 0, 0] });
    expect(lines.map((line) => [line.targetKind, line.x1])).toEqual([
      ['word', 60],
      ['word', 60],
      ['word', 60],
    ]);
    expect(lines.map((line) => line.x2)).toEqual([40, 100, 160]);
    expect(new Set(lines.map((line) => `${line.x1}:${line.x2}`)).size).toBe(3);
  });

  it('measures explicit surface-morpheme targets', () => {
    const lines = computeAlignmentLines(fixture(), {
      alignTo: [0],
      tokenAlignTo: [{ kind: 'morpheme', index: 1 }],
    });
    expect(lines[0]).toMatchObject({
      targetKind: 'morpheme',
      x1: 72.5,
      surfaceMorphemeIndices: [1],
    });
  });

  it('measures layered analysis targets by their declared surface slices', () => {
    const lines = computeAlignmentLines(fixture(), {
      alignTo: [0],
      tokenAlignTo: [{ kind: 'analysis', unitId: 'living-being' }],
    });
    expect(lines[0]).toMatchObject({
      targetKind: 'analysis',
      x1: 30,
      analysisUnitId: 'living-being',
      surfaceMorphemeIndices: [0],
    });
  });

  it('anchors a multi-slice analysis on a claimed element instead of the gap between them', () => {
    const container = fixture();
    const pali = container.querySelector<HTMLElement>('[data-pali-idx="0"]')!;
    const morphs = pali.querySelectorAll<HTMLElement>('[data-morpheme-idx]');
    morphs[0].dataset.analysisUnitIds = 'distributed-unit';
    morphs[2].dataset.analysisUnitIds = 'distributed-unit';
    const lines = computeAlignmentLines(container, {
      alignTo: [0],
      tokenAlignTo: [{ kind: 'analysis', unitId: 'distributed-unit' }],
    });
    expect(lines[0]).toMatchObject({
      targetKind: 'analysis',
      x1: 30,
      surfaceMorphemeIndices: [0, 2],
    });
    expect(lines[0].x1).not.toBe(60);
  });

  it('fails honestly to the whole word when a declared fine target is absent from the DOM', () => {
    const lines = computeAlignmentLines(fixture(), {
      alignTo: [0],
      tokenAlignTo: [{ kind: 'analysis', unitId: 'missing-unit' }],
    });
    expect(lines[0]).toMatchObject({ targetKind: 'word', x1: 60 });
  });
});

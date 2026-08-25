import { describe, expect, it } from 'vitest';
import { resolveAlignmentTargets } from '../../../services/liturgy/alignmentTargets';

describe('resolveAlignmentTargets', () => {
  it('falls back to the whole source word instead of inventing positional morpheme targets', () => {
    expect(
      resolveAlignmentTargets({
        alignTo: [0, 0, 0, -1],
      })
    ).toEqual([
      { kind: 'word', paliIdx: 0, reviewed: false },
      { kind: 'word', paliIdx: 0, reviewed: false },
      { kind: 'word', paliIdx: 0, reviewed: false },
      null,
    ]);
  });

  it('preserves explicit legacy morpheme targets without applying them to null entries', () => {
    expect(
      resolveAlignmentTargets({
        alignTo: [0, 0, 0],
        morphemeAlignTo: [2, null, 0],
      })
    ).toEqual([
      { kind: 'morpheme', paliIdx: 0, morphemeIdx: 2 },
      { kind: 'word', paliIdx: 0, reviewed: false },
      { kind: 'morpheme', paliIdx: 0, morphemeIdx: 0 },
    ]);
  });

  it('supports reviewed word-level, surface-morpheme, and layered-analysis targets', () => {
    expect(
      resolveAlignmentTargets({
        alignTo: [0, 0, 0],
        tokenAlignTo: [
          { kind: 'word' },
          { kind: 'morpheme', index: 1 },
          { kind: 'analysis', unitId: 'ablative-source' },
        ],
      })
    ).toEqual([
      { kind: 'word', paliIdx: 0, reviewed: true },
      { kind: 'morpheme', paliIdx: 0, morphemeIdx: 1 },
      { kind: 'analysis', paliIdx: 0, unitId: 'ablative-source' },
    ]);
  });

  it('lets the new explicit contract override a legacy morpheme index', () => {
    expect(
      resolveAlignmentTargets({
        alignTo: [0],
        morphemeAlignTo: [2],
        tokenAlignTo: [{ kind: 'analysis', unitId: 'lexeme' }],
      })
    ).toEqual([{ kind: 'analysis', paliIdx: 0, unitId: 'lexeme' }]);
  });
});

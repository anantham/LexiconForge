import { describe, expect, it } from 'vitest';
import {
  buildLibraryScopeKey,
  buildScopedStableId,
  isScopedStableId,
  parseScopedStableId,
} from '../../services/libraryScope';

describe('libraryScope stableId boundaries', () => {
  it('builds and parses scoped stable IDs consistently', () => {
    const stableId = buildScopedStableId('ch2_vtcb2d_td5t', 'forty-millenniums-of-cultivation', 'v1-composite');

    expect(isScopedStableId(stableId)).toBe(true);
    expect(parseScopedStableId(stableId)).toEqual({
      scopeKey: buildLibraryScopeKey('forty-millenniums-of-cultivation', 'v1-composite'),
      novelId: 'forty-millenniums-of-cultivation',
      libraryVersionId: 'v1-composite',
      baseStableId: 'ch2_vtcb2d_td5t',
    });
  });

  it('throws loudly when asked to scope an already scoped stable ID', () => {
    const scopedStableId = buildScopedStableId('ch2_vtcb2d_td5t', 'forty-millenniums-of-cultivation', 'v1-composite');

    expect(() =>
      buildScopedStableId(
        scopedStableId,
        'forty-millenniums-of-cultivation',
        'v1-composite'
      )
    ).toThrow(/already scoped stableId/i);
  });

  it('parses nested scoped stable IDs without losing the embedded payload', () => {
    const nestedScopedId =
      'lf-library:forty-millenniums-of-cultivation%3A%3Av1-composite:' +
      'lf-library:forty-millenniums-of-cultivation%3A%3Av1-composite:ch2_vtcb2d_td5t';

    expect(parseScopedStableId(nestedScopedId)).toEqual({
      scopeKey: buildLibraryScopeKey('forty-millenniums-of-cultivation', 'v1-composite'),
      novelId: 'forty-millenniums-of-cultivation',
      libraryVersionId: 'v1-composite',
      baseStableId: 'lf-library:forty-millenniums-of-cultivation%3A%3Av1-composite:ch2_vtcb2d_td5t',
    });
  });
});

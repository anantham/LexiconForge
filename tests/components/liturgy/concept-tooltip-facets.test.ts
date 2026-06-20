import { describe, it, expect } from 'vitest';
import { conceptFacets } from '../../../data/concepts/tooltipFacets';

describe('conceptFacets', () => {
  it('returns empty array for empty or unknown ids', () => {
    expect(conceptFacets(undefined)).toEqual([]);
    expect(conceptFacets([])).toEqual([]);
    expect(conceptFacets(['concept.does-not-exist'])).toEqual([]);
  });

  it('single concept: the sense facet is the definition only — it does not restate the label', () => {
    const facets = conceptFacets(['concept.wisdom-prajna']);
    expect(facets).toHaveLength(1);
    expect(facets[0]).toMatch(/^◇ /);
    // facet 0 (the hover gloss) already shows "wisdom (prajñā)"; the sense facet
    // must not repeat it — that was the redundancy this fix removed.
    expect(facets[0]).not.toContain('wisdom (prajñā)');
    expect(facets[0].replace(/^◇ /, '').length).toBeGreaterThan(10); // carries the definition
  });

  it('uses only the first sentence of a multi-sentence definition', () => {
    const facets = conceptFacets(['concept.wisdom-prajna']);
    // Should not contain the second sentence about jñāna distinction
    expect(facets[0]).not.toMatch(/\..+\./);
  });

  it('aggregates multiple concepts into multiple facets', () => {
    const facets = conceptFacets(['concept.wisdom-prajna', 'concept.perfection-paramita']);
    expect(facets).toHaveLength(2);
    expect(facets[0]).toContain('wisdom');
    expect(facets[1]).toContain('perfection');
  });
});

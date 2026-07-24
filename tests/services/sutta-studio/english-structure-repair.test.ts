/**
 * @vitest-environment node
 *
 * Guards for repairEnglishStructure (reader-report II, 2026-07-24):
 * the render backstop + at-rest migration for the two weave classes no ranked
 * metric or tap test can see — gloss stutter (morpheme tokens without morpheme
 * senses) and dangling links (repair renumbered words, english never remapped).
 */
import { describe, it, expect } from 'vitest';
import { repairEnglishStructure } from '../../../services/sutta-studio/utils';

const word = (id: string, segIds: string[], segSenses = false) => ({
  id,
  segments: segIds.map((sid) => ({
    id: sid,
    ...(segSenses ? { senses: [{ english: `sense-${sid}` }] } : {}),
  })),
});

describe('repairEnglishStructure', () => {
  it('collapses senseless morpheme tokens to ONE word-level token (the MN117 stutter)', () => {
    // sammā·diṭṭhi: two segment tokens, no segment senses → "right view right view"
    const phase = {
      paliWords: [word('p3', ['p3s1', 'p3s2'])],
      englishStructure: [
        { id: 'e7', linkedSegmentId: 'p3s1', isGhost: false },
        { id: 'e9', linkedSegmentId: 'p3s2', isGhost: false },
      ],
    };
    const { tokens, stats } = repairEnglishStructure(phase);
    expect(stats.collapsedStutter).toBe(1);
    expect(tokens).toHaveLength(1);
    // kept token promoted to word level so hovering EITHER morpheme lights it
    expect(tokens[0].linkedPaliId).toBe('p3');
    expect(tokens[0].linkedSegmentId).toBeUndefined();
  });

  it('collapses ghost-interleaved repeats too (phase-29 shape)', () => {
    const phase = {
      paliWords: [word('p4', ['p4s1', 'p4s2'])],
      englishStructure: [
        { id: 'e1', linkedSegmentId: 'p4s1', isGhost: false },
        { id: 'g1', isGhost: true, label: 'by' },
        { id: 'e2', linkedSegmentId: 'p4s2', isGhost: false },
      ],
    };
    const { tokens, stats } = repairEnglishStructure(phase);
    expect(stats.collapsedStutter).toBe(1);
    expect(tokens.map((t) => t.id)).toEqual(['e1', 'g1']);
  });

  it('drops dangling segment AND word links (the 59 empty pills)', () => {
    const phase = {
      paliWords: [word('p1', ['p1s1'])],
      englishStructure: [
        { id: 'e1', linkedSegmentId: 'p2s1', isGhost: false }, // word p2 does not exist
        { id: 'e2', linkedPaliId: 'p9', isGhost: false },
        { id: 'e3', linkedSegmentId: 'p1s1', isGhost: false },
      ],
    };
    const { tokens, stats } = repairEnglishStructure(phase);
    expect(stats.droppedDangling).toBe(2);
    expect(tokens.map((t) => t.id)).toEqual(['e3']);
  });

  it('NEVER collapses explicit word-level repeats (flagship "or … or" is intentional)', () => {
    const phase = {
      paliWords: [word('an5', ['an5s1'])],
      englishStructure: [
        { id: 'ean5', linkedPaliId: 'an5', isGhost: false },
        { id: 'g', isGhost: true, label: 'x' },
        { id: 'ean5b', linkedPaliId: 'an5', isGhost: false },
      ],
    };
    const { tokens, stats } = repairEnglishStructure(phase);
    expect(stats.collapsedStutter).toBe(0);
    expect(tokens).toHaveLength(3);
  });

  it('keeps multiple segment tokens when segments carry their OWN senses (true morpheme alignment)', () => {
    const phase = {
      paliWords: [word('p3', ['p3s1', 'p3s2'], true)],
      englishStructure: [
        { id: 'e7', linkedSegmentId: 'p3s1', isGhost: false },
        { id: 'e9', linkedSegmentId: 'p3s2', isGhost: false },
      ],
    };
    const { tokens, stats } = repairEnglishStructure(phase);
    expect(stats.collapsedStutter).toBe(0);
    expect(tokens).toHaveLength(2);
    expect(tokens[0].linkedSegmentId).toBe('p3s1'); // untouched — the future path
  });

  it('is a byte-level no-op on a clean flagship-shaped phase', () => {
    const phase = {
      paliWords: [word('p1', ['p1s1']), word('p2', ['p2s1'])],
      englishStructure: [
        { id: 'e0', isGhost: true, ghostKind: 'required', label: 'the' },
        { id: 'e1', linkedSegmentId: 'p1s1', isGhost: false },
        { id: 'e2', linkedSegmentId: 'p2s1', isGhost: false },
      ],
    };
    const { tokens, stats } = repairEnglishStructure(phase);
    expect(stats).toEqual({ droppedDangling: 0, collapsedStutter: 0 });
    expect(tokens).toEqual(phase.englishStructure);
  });
});

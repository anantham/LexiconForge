/**
 * validatePhase ↔ repairEnglishStructure agreement — integrity item 5 (2026-07).
 *
 * validatePhase used to strip a dangling link but KEEP the token. The
 * renderer shows such a token as an empty pill, and the render-time backstop
 * (repairEnglishStructure) can no longer detect it — it keys on the link
 * being present. The two repair layers disagreed.
 *
 * validatePhase now delegates the transformation to repairEnglishStructure:
 * a dangling-linked token is DROPPED entirely and english_link_dangling
 * counts it.
 *
 * RED-PROOFED against the pre-fix code: the dangling token survived as an
 * unlinked empty token (first test failed on presence + on the issue code).
 */
import { describe, it, expect } from 'vitest';
import { validatePhase } from '../../../services/suttaStudioValidator';
import type { PhaseView } from '../../../types/suttaStudio';

const basePhase = (): PhaseView => ({
  id: 'phase-1',
  paliWords: [
    {
      id: 'p1',
      segments: [{ id: 'p1s1', text: 'sutaṁ', type: 'stem' }],
      senses: [{ english: 'heard', nuance: 'received' }],
    },
  ],
  englishStructure: [
    { id: 'e0', linkedPaliId: 'p1' },
    // Dangling: p9 does not exist in this phase.
    { id: 'e2', linkedPaliId: 'p9' },
    // Dangling segment link: p1s9 does not exist.
    { id: 'e4', linkedSegmentId: 'p1s9' },
    { id: 'e6', label: 'the', isGhost: true, ghostKind: 'required' },
  ],
});

describe('validatePhase — dangling english links', () => {
  it('DROPS dangling-linked tokens entirely (matching the renderer backstop)', () => {
    const { phase, issues } = validatePhase(basePhase());
    const ids = (phase.englishStructure ?? []).map((t) => t.id);
    // Pre-fix: e2/e4 survived link-stripped as empty unlinked pills.
    expect(ids).toEqual(['e0', 'e6']);
    const dangling = issues.filter((i) => i.code === 'english_link_dangling');
    expect(dangling).toHaveLength(1);
    expect(dangling[0].message).toContain('2 English token(s)');
    expect(dangling[0].message).toContain('e2');
    expect(dangling[0].message).toContain('e4');
  });

  it('keeps valid word links, ghosts, and segment links with real senses', () => {
    const phase: PhaseView = {
      id: 'phase-2',
      paliWords: [
        {
          id: 'p1',
          segments: [
            { id: 'p1s1', text: 'rāja', type: 'stem', senses: [{ english: 'king', nuance: 'ruler' }] },
            { id: 'p1s2', text: 'putta', type: 'stem', senses: [{ english: 'son', nuance: 'offspring' }] },
          ],
          senses: [{ english: 'prince', nuance: 'compound' }],
        },
      ],
      englishStructure: [
        { id: 'e0', linkedSegmentId: 'p1s1' },
        { id: 'e2', linkedSegmentId: 'p1s2' },
        { id: 'e4', label: 'of', isGhost: true, ghostKind: 'required' },
      ],
    };
    const { phase: cleaned, issues } = validatePhase(phase);
    expect((cleaned.englishStructure ?? []).map((t) => t.id)).toEqual(['e0', 'e2', 'e4']);
    expect(issues.filter((i) => i.code === 'english_link_dangling')).toHaveLength(0);
  });

  it('collapses gloss stutter the same way the backstop does, and reports it', () => {
    const phase: PhaseView = {
      id: 'phase-3',
      paliWords: [
        {
          id: 'p1',
          // Segments WITHOUT their own senses: repeat segment links render the
          // word gloss once per morpheme ("right view right view").
          segments: [
            { id: 'p1s1', text: 'sammā', type: 'stem' },
            { id: 'p1s2', text: 'diṭṭhi', type: 'stem' },
          ],
          senses: [{ english: 'right view', nuance: 'path factor' }],
        },
      ],
      englishStructure: [
        { id: 'e0', linkedSegmentId: 'p1s1' },
        { id: 'e2', linkedSegmentId: 'p1s2' },
      ],
    };
    const { phase: cleaned, issues } = validatePhase(phase);
    expect(cleaned.englishStructure).toHaveLength(1);
    // The kept token is promoted to a word-level link for whole-word hover.
    expect(cleaned.englishStructure?.[0].linkedPaliId).toBe('p1');
    expect(issues.some((i) => i.code === 'english_gloss_stutter')).toBe(true);
  });
});

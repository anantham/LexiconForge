/**
 * @vitest-environment node
 *
 * Layer 1 of the reader-report-II fix: per-segment senses, end to end.
 *
 * The downstream always existed (rehydrator threads segmentSenses onto
 * segments; EnglishWord renders segment senses; repairEnglishStructure
 * deliberately preserves multi-token words WHEN segments carry senses).
 * What was missing was the schema field and the prompt asking for it.
 * This guards the whole thread so no layer can silently drop it again.
 */
import { describe, it, expect } from 'vitest';
import { rehydratePhase } from '../../../services/suttaStudioRehydrator';
import { repairEnglishStructure } from '../../../services/sutta-studio/utils';
import { lexicographerResponseSchema } from '../../../services/sutta-studio/schemas';
import { buildLexicographerPrompt } from '../../../services/sutta-studio/prompts';
import type { AnatomistPass, LexicographerPass } from '../../../types/suttaStudio';

const anatomist: AnatomistPass = {
  id: 'phase-t',
  words: [
    {
      id: 'p1',
      surface: 'sammādiṭṭhi',
      wordClass: 'content',
      isAnchor: true,
      segmentIds: ['p1s1', 'p1s2'],
    },
  ],
  segments: [
    { id: 'p1s1', text: 'sammā', type: 'stem' },
    { id: 'p1s2', text: 'diṭṭhi', type: 'stem' },
  ],
} as unknown as AnatomistPass;

const lexicographer: LexicographerPass = {
  id: 'phase-t',
  senses: [
    {
      wordId: 'p1',
      wordClass: 'content',
      senses: [{ english: 'right view', nuance: 'the whole compound' }],
    },
  ],
  segmentSenses: [
    { segmentId: 'p1s1', senses: [{ english: 'right', nuance: 'sammā — correct' }] },
    { segmentId: 'p1s2', senses: [{ english: 'view', nuance: 'diṭṭhi — outlook' }] },
  ],
} as unknown as LexicographerPass;

describe('segment senses, end to end', () => {
  it('rehydrates lexicographer segmentSenses onto the PhaseView segments', () => {
    const view = rehydratePhase({
      phaseId: 'phase-t',
      anatomist,
      lexicographer,
    } as any);
    const word = view.paliWords.find((w) => w.id === 'p1')!;
    expect(word.segments.find((s) => s.id === 'p1s1')?.senses?.[0]?.english).toBe('right');
    expect(word.segments.find((s) => s.id === 'p1s2')?.senses?.[0]?.english).toBe('view');
    expect(word.senses[0].english).toBe('right view'); // word-level kept too
  });

  it('repairEnglishStructure PRESERVES morpheme tokens once segments carry senses', () => {
    const view = rehydratePhase({
      phaseId: 'phase-t',
      anatomist,
      lexicographer,
    } as any);
    const phase = {
      paliWords: view.paliWords,
      englishStructure: [
        { id: 'e1', linkedSegmentId: 'p1s1', isGhost: false },
        { id: 'e2', linkedSegmentId: 'p1s2', isGhost: false },
      ],
    };
    const { tokens, stats } = repairEnglishStructure(phase);
    expect(stats.collapsedStutter).toBe(0); // true morpheme alignment, not stutter
    expect(tokens).toHaveLength(2);
  });

  it('schema admits segmentSenses (structured outputs will not strip it)', () => {
    const props = (lexicographerResponseSchema as any).properties;
    expect(props.segmentSenses).toBeDefined();
    expect(props.segmentSenses.items.required).toEqual(['segmentId', 'senses']);
    // optional at top level, matching the handoff convention
    expect((lexicographerResponseSchema as any).required).not.toContain('segmentSenses');
  });

  it('prompt lists segment ids and asks for segmentSenses with the inflection prohibition', () => {
    const prompt = buildLexicographerPrompt('phase-t', [], 'STATE', anatomist, {});
    expect(prompt).toContain('p1s1=sammā');
    expect(prompt).toContain('segmentSenses');
    expect(prompt).toMatch(/NEVER give segmentSenses to pure inflectional endings/);
  });
});

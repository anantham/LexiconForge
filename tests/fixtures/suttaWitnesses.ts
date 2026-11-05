import type { DeepLoomPacket } from '../../types/suttaStudio';
import type { TranslationWitness, WitnessAlignment } from '../../types/suttaStudioWitness';

/** Synthetic UI/structure test content. Not a translation of any sacred text. */
export function witnessFixture(): DeepLoomPacket {
  const attribution = {
    publisher: 'Synthetic test publisher', edition: 'TEST ONLY', revision: 'fixture-1',
    license: 'Synthetic fixture', normalization: 'None',
    source: { language: 'sa', witness: 'Synthetic source, not a textual edition' },
  };
  const edge = (id: string, props: Partial<WitnessAlignment>): WitnessAlignment => ({
    id, status: 'aligned', relation: 'corresponds', sourceSpans: [], targetSpans: [],
    displayAt: { phaseId: 'p1', wordId: 'p1w1' }, evidence: 'Synthetic correspondence for a UI test.', review: { status: 'unreviewed' }, ...props,
  });
  const witnesses: TranslationWitness[] = [
    { id: 'draft', label: 'Synthetic draft', language: 'en', languageName: 'English', attribution, content: { kind: 'legacy-interlinear' } },
    { id: 'named', label: 'Synthetic publisher A', language: 'en', languageName: 'English', attribution, content: {
      kind: 'translation', passages: [
        { id: 'a', label: 'Witness stanza IX', text: 'Alpha 🪷 bridge' },
        { id: 'b', label: 'Witness stanza X', text: 'Tail.' },
        { id: 'c', label: 'Witness stanza XI', text: 'Uncertain.' },
        { id: 'd', label: 'Witness stanza XII', text: 'Unplaced.' },
      ], alignments: [
        edge('cross', { sourceSpans: [{ phaseId: 'p1', wordIds: ['p1w1', 'p1w2'] }, { phaseId: 'p2', wordIds: ['p2w1'] }], targetSpans: [{ passageId: 'a', start: 0, end: 14 }, { passageId: 'b', start: 0, end: 5 }], relation: 'reordered' }),
        edge('maybe', { status: 'uncertain', relation: 'uncertain', sourceSpans: [{ phaseId: 'p2', wordIds: ['p2w2'] }], targetSpans: [{ passageId: 'c', start: 0, end: 10 }], displayAt: { phaseId: 'p2', wordId: 'p2w2' } }),
        edge('unknown', { status: 'unaligned', relation: 'uncertain', targetSpans: [{ passageId: 'd', start: 0, end: 9 }], displayAt: { phaseId: 'p2', wordId: 'p2w2' } }),
        edge('omission', { relation: 'omitted', sourceSpans: [{ phaseId: 'p2', wordIds: ['p2w3'] }], displayAt: { phaseId: 'p2', wordId: 'p2w3' } }),
      ],
    } },
    { id: 'rtl', label: 'Synthetic publisher B', language: 'ar', languageName: 'Arabic (synthetic fixture)', direction: 'rtl', attribution, content: {
      kind: 'translation', passages: [{ id: 'r', label: 'Fixture R', text: 'أ ب' }],
      alignments: [edge('r', { sourceSpans: [{ phaseId: 'p1', wordIds: ['p1w1'] }], targetSpans: [{ passageId: 'r', start: 0, end: 3 }] })],
    } },
  ];
  return {
    packetId: 'synthetic-witness-test', source: { provider: 'local-edition', workId: 'synthetic', language: 'sa' },
    canonicalSegments: [], citations: [], translations: { defaultWitnessId: 'draft', witnesses },
    renderDefaults: { ghostOpacity: 0.3, englishVisible: true, studyToggleDefault: false },
    phases: ['p1', 'p2'].map(id => ({
      id, title: id, layoutBlocks: [[`${id}w1`], [`${id}w2`], [`${id}w3`]],
      paliWords: ['a', 'i', 'u'].map((text, i) => ({ id: `${id}w${i + 1}`, segments: [{ id: `${id}w${i + 1}s1`, text, type: 'stem' }], senses: [
        { english: `${id}-gloss-${i}`, nuance: 'synthetic', ...(i === 0 ? { ripples: { [`${id}g`]: 'a' } } : {}) },
        { english: `${id}-alternative-${i}`, nuance: 'synthetic', ...(i === 0 ? { ripples: { [`${id}g`]: 'an' } } : {}) },
      ] })),
      englishStructure: [{ id: `${id}g`, isGhost: true, ghostKind: 'article', label: 'a' }, ...[1, 2, 3].map(i => ({ id: `${id}e${i}`, linkedPaliId: `${id}w${i}` }))],
    })),
  };
}

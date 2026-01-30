import { describe, it, expect } from 'vitest';
import {
  rehydratePhase,
  buildSegmentsMapFromAnatomist,
  buildSensesMapFromLexicographer,
  buildSegmentSensesMapFromLexicographer,
  buildEnglishStructureFromWeaver,
  buildDegradedPhaseView,
  validateSegmentIdUniqueness,
  validateEnglishLinks,
} from './suttaStudioRehydrator';
import type {
  AnatomistPass,
  LexicographerPass,
  WeaverPass,
  TypesetterPass,
  SourceRef,
} from '../types/suttaStudio';
import type { EnglishTokenInput } from './suttaStudioTokenizer';

// ============================================================================
// Mock Pass Outputs - Representing "perfect" AI responses
// ============================================================================

/**
 * Mock Anatomist output for "Majjhima Nikāya 10 / Satipaṭṭhānasutta"
 */
export const mockAnatomistPhase1: AnatomistPass = {
  id: 'anatomist-phase-1',
  words: [
    { id: 'p1', surface: 'Majjhima', wordClass: 'content', segmentIds: ['p1s1'] },
    { id: 'p2', surface: 'Nikāya', wordClass: 'content', segmentIds: ['p2s1'] },
    { id: 'p3', surface: '10', wordClass: 'content', segmentIds: ['p3s1'] },
    { id: 'p4', surface: 'Satipaṭṭhānasutta', wordClass: 'content', segmentIds: ['p4s1', 'p4s2', 'p4s3'], isAnchor: true },
  ],
  segments: [
    { id: 'p1s1', wordId: 'p1', text: 'Majjhima', type: 'stem', tooltips: ['Majjhima: Middle'] },
    { id: 'p2s1', wordId: 'p2', text: 'Nikāya', type: 'stem', tooltips: ['Nikāya: Collection / Group / Volume'] },
    { id: 'p3s1', wordId: 'p3', text: '10', type: 'stem' },
    { id: 'p4s1', wordId: 'p4', text: 'Sati', type: 'root', tooltips: ['Sati: Mindfulness / Awareness / Memory'] },
    { id: 'p4s2', wordId: 'p4', text: 'paṭṭhāna', type: 'stem', tooltips: ['Paṭṭhāna: Foundation / Establishment / Application'] },
    { id: 'p4s3', wordId: 'p4', text: 'sutta', type: 'suffix', tooltips: ['Sutta: Discourse / Text'] },
  ],
  relations: [
    { id: 'r1', fromSegmentId: 'p1s1', targetWordId: 'p2', type: 'ownership', label: 'of' },
  ],
};

/**
 * Mock Anatomist output for "Evaṁ me sutaṁ"
 */
export const mockAnatomistPhase2: AnatomistPass = {
  id: 'anatomist-phase-2',
  words: [
    { id: 'p1', surface: 'Evaṁ', wordClass: 'function', segmentIds: ['p1s1'] },
    { id: 'p2', surface: 'me', wordClass: 'function', segmentIds: ['p2s1'] },
    { id: 'p3', surface: 'sutaṁ', wordClass: 'content', segmentIds: ['p3s1'], isAnchor: true },
  ],
  segments: [
    { id: 'p1s1', wordId: 'p1', text: 'Evaṁ', type: 'stem', tooltips: ['Evaṁ: Thus / In this way'] },
    { id: 'p2s1', wordId: 'p2', text: 'me', type: 'stem', tooltips: ['Me: By me (instrumental)'], morph: { case: 'ins', number: 'sg' } },
    { id: 'p3s1', wordId: 'p3', text: 'sutaṁ', type: 'stem', tooltips: ['Sutaṁ: Heard (past participle)'] },
  ],
};

/**
 * Mock Lexicographer output for Phase 1
 */
export const mockLexicographerPhase1: LexicographerPass = {
  id: 'lexicographer-phase-1',
  senses: [
    { wordId: 'p1', wordClass: 'content', senses: [{ english: 'Middle', nuance: 'middle, medium' }] },
    { wordId: 'p2', wordClass: 'content', senses: [{ english: 'Collection', nuance: 'collection, group' }, { english: 'Group', nuance: '' }] },
    { wordId: 'p3', wordClass: 'content', senses: [{ english: '10', nuance: 'number ten' }] },
    { wordId: 'p4', wordClass: 'content', senses: [{ english: 'Mindfulness Meditation', nuance: 'discourse on mindfulness' }] },
  ],
  // Segment-level senses for compound word p4
  segmentSenses: [
    { segmentId: 'p4s1', senses: [{ english: 'Mindfulness', nuance: '' }, { english: 'Awareness', nuance: '' }, { english: 'Memory', nuance: '' }] },
    { segmentId: 'p4s2', senses: [{ english: 'Foundation', nuance: '' }, { english: 'Establishment', nuance: '' }, { english: 'Application', nuance: '' }] },
  ],
};

/**
 * Mock Lexicographer output for Phase 2
 */
export const mockLexicographerPhase2: LexicographerPass = {
  id: 'lexicographer-phase-2',
  senses: [
    { wordId: 'p1', wordClass: 'function', senses: [{ english: 'Thus', nuance: 'in this way' }, { english: 'So', nuance: '' }] },
    { wordId: 'p2', wordClass: 'function', senses: [{ english: 'I', nuance: 'by me' }, { english: 'me', nuance: '' }] },
    { wordId: 'p3', wordClass: 'content', senses: [{ english: 'heard', nuance: 'was heard' }] },
  ],
};

/**
 * Mock Weaver output for Phase 1
 * Maps English tokens to Pali segments
 */
export const mockWeaverPhase1: WeaverPass = {
  id: 'weaver-phase-1',
  tokens: [
    { tokenIndex: 0, text: 'Middle', linkedSegmentId: 'p1s1', isGhost: false },
    { tokenIndex: 2, text: 'Discourses', linkedSegmentId: 'p2s1', isGhost: false },
    { tokenIndex: 4, text: '10', linkedSegmentId: 'p3s1', isGhost: false },
    { tokenIndex: 6, text: 'Mindfulness', linkedSegmentId: 'p4s1', isGhost: false },
    { tokenIndex: 8, text: 'Meditation', linkedSegmentId: 'p4s2', isGhost: false },
  ],
  handoff: { confidence: 'high', unmappedTokens: [], notes: 'p4s3 (sutta) has no direct English equivalent' },
};

/**
 * Mock Weaver output for Phase 2
 */
export const mockWeaverPhase2: WeaverPass = {
  id: 'weaver-phase-2',
  tokens: [
    { tokenIndex: 0, text: 'So', linkedPaliId: 'p1', isGhost: false },
    { tokenIndex: 2, text: 'I', linkedPaliId: 'p2', isGhost: false },
    { tokenIndex: 4, text: 'have', isGhost: true, ghostKind: 'required' },
    { tokenIndex: 6, text: 'heard', linkedPaliId: 'p3', isGhost: false },
  ],
};

/**
 * Mock Typesetter output for Phase 1
 */
export const mockTypesetterPhase1: TypesetterPass = {
  id: 'typesetter-phase-1',
  layoutBlocks: [['p1', 'p2', 'p3'], ['p4']],
  handoff: { confidence: 'high', notes: 'Title grouped together, sutta name separate' },
};

/**
 * Mock Typesetter output for Phase 2
 */
export const mockTypesetterPhase2: TypesetterPass = {
  id: 'typesetter-phase-2',
  layoutBlocks: [['p1', 'p2', 'p3']],
};

/**
 * Mock English tokens (from tokenizer)
 */
export const mockEnglishTokensPhase1: EnglishTokenInput[] = [
  { index: 0, text: 'Middle', isWhitespace: false, isPunctuation: false },
  { index: 1, text: ' ', isWhitespace: true, isPunctuation: false },
  { index: 2, text: 'Discourses', isWhitespace: false, isPunctuation: false },
  { index: 3, text: ' ', isWhitespace: true, isPunctuation: false },
  { index: 4, text: '10', isWhitespace: false, isPunctuation: false },
  { index: 5, text: ' ', isWhitespace: true, isPunctuation: false },
  { index: 6, text: 'Mindfulness', isWhitespace: false, isPunctuation: false },
  { index: 7, text: ' ', isWhitespace: true, isPunctuation: false },
  { index: 8, text: 'Meditation', isWhitespace: false, isPunctuation: false },
];

export const mockEnglishTokensPhase2: EnglishTokenInput[] = [
  { index: 0, text: 'So', isWhitespace: false, isPunctuation: false },
  { index: 1, text: ' ', isWhitespace: true, isPunctuation: false },
  { index: 2, text: 'I', isWhitespace: false, isPunctuation: false },
  { index: 3, text: ' ', isWhitespace: true, isPunctuation: false },
  { index: 4, text: 'have', isWhitespace: false, isPunctuation: false },
  { index: 5, text: ' ', isWhitespace: true, isPunctuation: false },
  { index: 6, text: 'heard', isWhitespace: false, isPunctuation: false },
  { index: 7, text: '.', isWhitespace: false, isPunctuation: true },
];

const mockSourceSpan: SourceRef[] = [
  { provider: 'suttacentral', workId: 'mn10', segmentId: 'mn10:0.1' },
];

// ============================================================================
// Tests for buildSegmentsMapFromAnatomist
// ============================================================================

describe('buildSegmentsMapFromAnatomist', () => {
  it('should build word-to-segments map', () => {
    const map = buildSegmentsMapFromAnatomist(mockAnatomistPhase1);

    expect(map.get('p1')).toHaveLength(1);
    expect(map.get('p1')![0].text).toBe('Majjhima');

    expect(map.get('p4')).toHaveLength(3);
    expect(map.get('p4')!.map(s => s.text)).toEqual(['Sati', 'paṭṭhāna', 'sutta']);
  });

  it('should include segment IDs for segment-level linking', () => {
    const map = buildSegmentsMapFromAnatomist(mockAnatomistPhase1);

    const p4Segments = map.get('p4')!;
    expect(p4Segments[0].id).toBe('p4s1');
    expect(p4Segments[1].id).toBe('p4s2');
    expect(p4Segments[2].id).toBe('p4s3');
  });

  it('should attach relations to segments', () => {
    const map = buildSegmentsMapFromAnatomist(mockAnatomistPhase1);

    const p1Segments = map.get('p1')!;
    expect(p1Segments[0].relation).toBeDefined();
    expect(p1Segments[0].relation?.targetWordId).toBe('p2');
    expect(p1Segments[0].relation?.type).toBe('ownership');
  });

  it('should preserve tooltips', () => {
    const map = buildSegmentsMapFromAnatomist(mockAnatomistPhase1);

    const p4Segments = map.get('p4')!;
    expect(p4Segments[0].tooltips).toContain('Sati: Mindfulness / Awareness / Memory');
  });
});

// ============================================================================
// Tests for buildSensesMapFromLexicographer
// ============================================================================

describe('buildSensesMapFromLexicographer', () => {
  it('should build word-to-senses map', () => {
    const map = buildSensesMapFromLexicographer(mockLexicographerPhase1);

    expect(map.get('p1')).toHaveLength(1);
    expect(map.get('p1')![0].english).toBe('Middle');

    expect(map.get('p2')).toHaveLength(2);
    expect(map.get('p2')!.map(s => s.english)).toEqual(['Collection', 'Group']);
  });
});

describe('buildSegmentSensesMapFromLexicographer', () => {
  it('should build segment-to-senses map for compounds', () => {
    const map = buildSegmentSensesMapFromLexicographer(mockLexicographerPhase1);

    expect(map.get('p4s1')).toHaveLength(3);
    expect(map.get('p4s1')!.map(s => s.english)).toEqual(['Mindfulness', 'Awareness', 'Memory']);

    expect(map.get('p4s2')).toHaveLength(3);
    expect(map.get('p4s2')!.map(s => s.english)).toEqual(['Foundation', 'Establishment', 'Application']);
  });

  it('should return empty map when no segment senses', () => {
    const map = buildSegmentSensesMapFromLexicographer(mockLexicographerPhase2);
    expect(map.size).toBe(0);
  });
});

// ============================================================================
// Tests for buildEnglishStructureFromWeaver
// ============================================================================

describe('buildEnglishStructureFromWeaver', () => {
  it('should convert weaver tokens to english structure', () => {
    const result = buildEnglishStructureFromWeaver(mockWeaverPhase1, mockEnglishTokensPhase1);

    expect(result).toHaveLength(5); // 5 word tokens (excluding whitespace)
    expect(result[0].linkedSegmentId).toBe('p1s1');
    expect(result[3].linkedSegmentId).toBe('p4s1');
  });

  it('should handle ghost tokens', () => {
    const result = buildEnglishStructureFromWeaver(mockWeaverPhase2, mockEnglishTokensPhase2);

    const ghostToken = result.find(t => t.isGhost);
    expect(ghostToken).toBeDefined();
    expect(ghostToken?.label).toBe('have');
    expect(ghostToken?.ghostKind).toBe('required');
  });

  it('should skip whitespace and punctuation tokens', () => {
    const result = buildEnglishStructureFromWeaver(mockWeaverPhase2, mockEnglishTokensPhase2);

    // Should have 4 tokens: So, I, have, heard (not whitespace or period)
    expect(result).toHaveLength(4);
  });

  it('should support both linkedPaliId and linkedSegmentId', () => {
    const result = buildEnglishStructureFromWeaver(mockWeaverPhase2, mockEnglishTokensPhase2);

    expect(result[0].linkedPaliId).toBe('p1'); // word-level
    expect(result[0].linkedSegmentId).toBeUndefined();
  });
});

// ============================================================================
// Tests for rehydratePhase (full integration)
// ============================================================================

describe('rehydratePhase', () => {
  it('should combine all passes into a PhaseView', () => {
    const result = rehydratePhase({
      phaseId: 'phase-1',
      title: 'Title',
      sourceSpan: mockSourceSpan,
      anatomist: mockAnatomistPhase1,
      lexicographer: mockLexicographerPhase1,
      weaver: mockWeaverPhase1,
      englishTokens: mockEnglishTokensPhase1,
      typesetter: mockTypesetterPhase1,
    });

    expect(result.id).toBe('phase-1');
    expect(result.paliWords).toHaveLength(4);
    expect(result.englishStructure).toHaveLength(5);
    expect(result.layoutBlocks).toEqual([['p1', 'p2', 'p3'], ['p4']]);
  });

  it('should attach segment-level senses to compound words', () => {
    const result = rehydratePhase({
      phaseId: 'phase-1',
      sourceSpan: mockSourceSpan,
      anatomist: mockAnatomistPhase1,
      lexicographer: mockLexicographerPhase1,
    });

    const p4 = result.paliWords.find(w => w.id === 'p4');
    expect(p4?.segments[0].senses).toHaveLength(3);
    expect(p4?.segments[0].senses![0].english).toBe('Mindfulness');
  });

  it('should preserve wordClass for color coding', () => {
    const result = rehydratePhase({
      phaseId: 'phase-2',
      sourceSpan: mockSourceSpan,
      anatomist: mockAnatomistPhase2,
      lexicographer: mockLexicographerPhase2,
    });

    expect(result.paliWords[0].wordClass).toBe('function');
    expect(result.paliWords[2].wordClass).toBe('content');
  });

  it('should preserve isAnchor flag', () => {
    const result = rehydratePhase({
      phaseId: 'phase-1',
      sourceSpan: mockSourceSpan,
      anatomist: mockAnatomistPhase1,
      lexicographer: mockLexicographerPhase1,
    });

    const p4 = result.paliWords.find(w => w.id === 'p4');
    expect(p4?.isAnchor).toBe(true);
  });

  it('should work without weaver/typesetter (fallback mode)', () => {
    const result = rehydratePhase({
      phaseId: 'phase-1',
      sourceSpan: mockSourceSpan,
      anatomist: mockAnatomistPhase1,
      lexicographer: mockLexicographerPhase1,
    });

    expect(result.paliWords).toHaveLength(4);
    expect(result.englishStructure).toHaveLength(0); // No weaver = no english structure
    expect(result.layoutBlocks).toBeUndefined(); // No typesetter = no layout
  });
});

// ============================================================================
// Tests for buildDegradedPhaseView
// ============================================================================

describe('buildDegradedPhaseView', () => {
  it('should create minimal phase view when compilation fails', () => {
    const result = buildDegradedPhaseView({
      phaseId: 'phase-1',
      title: 'Failed Phase',
      sourceSpan: mockSourceSpan,
      paliTexts: [{ surface: 'Majjhima' }, { surface: 'Nikāya' }],
      englishTexts: ['Middle', 'Collection'],
      reason: 'Anatomist failed after 3 retries',
    });

    expect(result.degraded).toBe(true);
    expect(result.degradedReason).toBe('Anatomist failed after 3 retries');
    expect(result.paliWords).toHaveLength(2);
    expect(result.englishStructure).toHaveLength(2);
    expect(result.englishStructure[0].isGhost).toBe(true);
  });
});

// ============================================================================
// Tests for validation functions
// ============================================================================

describe('validateSegmentIdUniqueness', () => {
  it('should return empty array for unique segment IDs', () => {
    const result = rehydratePhase({
      phaseId: 'phase-1',
      sourceSpan: mockSourceSpan,
      anatomist: mockAnatomistPhase1,
      lexicographer: mockLexicographerPhase1,
    });

    const duplicates = validateSegmentIdUniqueness(result.paliWords);
    expect(duplicates).toHaveLength(0);
  });

  it('should detect duplicate segment IDs', () => {
    const badAnatomist: AnatomistPass = {
      id: 'bad',
      words: [
        { id: 'p1', surface: 'A', wordClass: 'content', segmentIds: ['s1'] },
        { id: 'p2', surface: 'B', wordClass: 'content', segmentIds: ['s1'] }, // Duplicate!
      ],
      segments: [
        { id: 's1', wordId: 'p1', text: 'A', type: 'stem' },
        { id: 's1', wordId: 'p2', text: 'B', type: 'stem' }, // Duplicate!
      ],
    };

    const result = rehydratePhase({
      phaseId: 'test',
      sourceSpan: mockSourceSpan,
      anatomist: badAnatomist,
      lexicographer: { id: 'lex', senses: [] },
    });

    const duplicates = validateSegmentIdUniqueness(result.paliWords);
    expect(duplicates).toContain('s1');
  });
});

describe('validateEnglishLinks', () => {
  it('should return empty array for valid links', () => {
    const result = rehydratePhase({
      phaseId: 'phase-1',
      sourceSpan: mockSourceSpan,
      anatomist: mockAnatomistPhase1,
      lexicographer: mockLexicographerPhase1,
      weaver: mockWeaverPhase1,
      englishTokens: mockEnglishTokensPhase1,
    });

    const invalid = validateEnglishLinks(result.englishStructure, result.paliWords);
    expect(invalid).toHaveLength(0);
  });

  it('should detect invalid segment links', () => {
    const result = rehydratePhase({
      phaseId: 'phase-1',
      sourceSpan: mockSourceSpan,
      anatomist: mockAnatomistPhase1,
      lexicographer: mockLexicographerPhase1,
    });

    // Manually add a bad link
    result.englishStructure.push({ id: 'bad', linkedSegmentId: 'nonexistent' });

    const invalid = validateEnglishLinks(result.englishStructure, result.paliWords);
    expect(invalid).toContain('segment:nonexistent');
  });
});

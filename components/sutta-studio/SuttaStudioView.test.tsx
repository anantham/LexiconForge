import { describe, it, expect } from 'vitest';
import type { PhaseView, DeepLoomPacket } from '../../types/suttaStudio';

/**
 * Mock packet representing "perfect" AI output for testing UI rendering.
 *
 * Phase 1: Title
 * - Canonical segment 1: "Majjhima Nikāya 10" → p1 (Majjhima), p2 (Nikāya), p3 (10)
 * - Canonical segment 2: "Satipaṭṭhānasutta" → p4 (compound: Sati + paṭṭhāna + sutta)
 *
 * Expected layout:
 * - Block 1: [p1, p2, p3] → "Middle Collection 10" below "Majjhima Nikāya 10"
 * - Block 2: [p4] → "Mindfulness Foundation" below "Satipaṭṭhānasutta"
 */
export const mockPhase1: PhaseView = {
  id: 'phase-1',
  title: 'Title',
  sourceSpan: [
    { provider: 'suttacentral', workId: 'mn10', segmentId: 'mn10:0.1' },
    { provider: 'suttacentral', workId: 'mn10', segmentId: 'mn10:0.2' },
  ],
  layoutBlocks: [['p1', 'p2', 'p3'], ['p4']],
  paliWords: [
    {
      id: 'p1',
      segments: [{ id: 'p1s1', text: 'Majjhima', type: 'stem', tooltips: ['Majjhima: Middle'] }],
      senses: [{ english: 'Middle', nuance: 'middle, medium' }],
      wordClass: 'content',
    },
    {
      id: 'p2',
      segments: [{ id: 'p2s1', text: 'Nikāya', type: 'stem', tooltips: ['Nikāya: Collection / Group'] }],
      senses: [{ english: 'Collection', nuance: 'collection, group' }],
      wordClass: 'content',
    },
    {
      id: 'p3',
      segments: [{ id: 'p3s1', text: '10', type: 'stem' }],
      senses: [{ english: '10', nuance: 'number ten' }],
      wordClass: 'content',
    },
    {
      id: 'p4',
      segments: [
        { id: 'p4s1', text: 'Sati', type: 'root', tooltips: ['Sati: Mindfulness / Awareness'], senses: [{ english: 'Mindfulness', nuance: '' }, { english: 'Awareness', nuance: '' }] },
        { id: 'p4s2', text: 'paṭṭhāna', type: 'stem', tooltips: ['Paṭṭhāna: Foundation / Establishment'], senses: [{ english: 'Foundation', nuance: '' }, { english: 'Establishment', nuance: '' }] },
        { id: 'p4s3', text: 'sutta', type: 'suffix', tooltips: ['Sutta: Discourse / Text'] },
      ],
      senses: [{ english: 'Mindfulness Meditation', nuance: 'discourse on mindfulness' }],
      wordClass: 'content',
    },
  ],
  englishStructure: [
    { id: 'e0', linkedSegmentId: 'p1s1' },  // Middle → p1s1
    { id: 'e1', linkedSegmentId: 'p2s1' },  // Collection → p2s1
    { id: 'e2', linkedSegmentId: 'p3s1' },  // 10 → p3s1
    { id: 'e3', linkedSegmentId: 'p4s1' },  // Mindfulness → p4s1
    { id: 'e4', linkedSegmentId: 'p4s2' },  // Foundation → p4s2
  ],
};

/**
 * Phase 2: Opening formula
 * - "Evaṁ me sutaṁ" → "Thus have I heard"
 */
export const mockPhase2: PhaseView = {
  id: 'phase-2',
  title: 'Opening',
  sourceSpan: [{ provider: 'suttacentral', workId: 'mn10', segmentId: 'mn10:1.1' }],
  layoutBlocks: [['p1', 'p2', 'p3']],
  paliWords: [
    {
      id: 'p1',
      segments: [{ id: 'p1s1', text: 'Evaṁ', type: 'stem' }],
      senses: [{ english: 'Thus', nuance: '' }],
      wordClass: 'function',
    },
    {
      id: 'p2',
      segments: [{ id: 'p2s1', text: 'me', type: 'stem' }],
      senses: [{ english: 'I', nuance: 'by me' }],
      wordClass: 'function',
    },
    {
      id: 'p3',
      segments: [{ id: 'p3s1', text: 'sutaṁ', type: 'stem' }],
      senses: [{ english: 'heard', nuance: 'was heard' }],
      wordClass: 'content',
    },
  ],
  englishStructure: [
    { id: 'e0', linkedPaliId: 'p1' },     // Thus → p1
    { id: 'e1', label: 'have', isGhost: true, ghostKind: 'required' },  // have (ghost)
    { id: 'e2', linkedPaliId: 'p2' },     // I → p2
    { id: 'e3', linkedPaliId: 'p3' },     // heard → p3
  ],
};

export const mockPacket: DeepLoomPacket = {
  packetId: 'test-packet',
  source: { provider: 'suttacentral', workId: 'mn10' },
  canonicalSegments: [
    { ref: { provider: 'suttacentral', workId: 'mn10', segmentId: 'mn10:0.1' }, order: 0, pali: 'Majjhima Nikāya 10', baseEnglish: 'Middle Discourses 10' },
    { ref: { provider: 'suttacentral', workId: 'mn10', segmentId: 'mn10:0.2' }, order: 1, pali: 'Satipaṭṭhānasutta', baseEnglish: 'Mindfulness Meditation' },
    { ref: { provider: 'suttacentral', workId: 'mn10', segmentId: 'mn10:1.1' }, order: 2, pali: 'Evaṁ me sutaṁ—', baseEnglish: 'So I have heard.' },
  ],
  phases: [mockPhase1, mockPhase2],
  citations: [],
  renderDefaults: { ghostOpacity: 0.5, englishVisible: true, studyToggleDefault: false },
};

// ============================================================================
// Unit tests for assignEnglishBlocks logic
// ============================================================================

/**
 * Helper function extracted from SuttaStudioView for testing.
 * Assigns English tokens to layout blocks based on their linked Pali words.
 */
function assignEnglishBlocks(phase: PhaseView, blocks: string[][]) {
  const blockIndex = new Map<string, number>();
  blocks.forEach((block, idx) => {
    block.forEach((id) => blockIndex.set(id, idx));
  });

  // Build segment-to-word lookup for segment-linked tokens
  const segmentToWord = new Map<string, string>();
  phase.paliWords.forEach((word) => {
    word.segments.forEach((seg) => {
      if (seg.id) segmentToWord.set(seg.id, word.id);
    });
  });

  // Helper to get the linked word ID (handles both linkedPaliId and linkedSegmentId)
  const getLinkedWordId = (token: (typeof phase.englishStructure)[0]): string | null => {
    if (token.linkedPaliId) return token.linkedPaliId;
    if (token.linkedSegmentId) return segmentToWord.get(token.linkedSegmentId) ?? null;
    return null;
  };

  const tokens = phase.englishStructure;
  const nextLinked: Array<string | null> = new Array(tokens.length).fill(null);
  let upcoming: string | null = null;
  for (let i = tokens.length - 1; i >= 0; i--) {
    const id = getLinkedWordId(tokens[i]);
    if (id) upcoming = id;
    nextLinked[i] = upcoming;
  }
  const blocksOut: typeof tokens[] = blocks.map(() => []);
  let lastLinked: string | null = null;
  tokens.forEach((token, idx) => {
    const linked = getLinkedWordId(token);
    if (linked) lastLinked = linked;
    const targetId = linked || lastLinked || nextLinked[idx];
    const idxBlock = targetId && blockIndex.has(targetId) ? blockIndex.get(targetId)! : 0;
    blocksOut[idxBlock].push(token);
  });
  return blocksOut;
}

describe('assignEnglishBlocks', () => {
  it('should assign segment-linked tokens to correct blocks', () => {
    const blocks = mockPhase1.layoutBlocks!;
    const result = assignEnglishBlocks(mockPhase1, blocks);

    // Block 0 should have: Middle (p1s1), Collection (p2s1), 10 (p3s1)
    expect(result[0].map(t => t.id)).toEqual(['e0', 'e1', 'e2']);

    // Block 1 should have: Mindfulness (p4s1), Foundation (p4s2)
    expect(result[1].map(t => t.id)).toEqual(['e3', 'e4']);
  });

  it('should assign word-linked tokens to correct blocks', () => {
    const blocks = mockPhase2.layoutBlocks!;
    const result = assignEnglishBlocks(mockPhase2, blocks);

    // All tokens should be in block 0
    expect(result[0].map(t => t.id)).toEqual(['e0', 'e1', 'e2', 'e3']);
  });

  it('should handle ghost tokens by inheriting from surrounding linked tokens', () => {
    const blocks = mockPhase2.layoutBlocks!;
    const result = assignEnglishBlocks(mockPhase2, blocks);

    // Ghost token 'e1' (have) should be in same block as surrounding tokens
    const ghostToken = result[0].find(t => t.id === 'e1');
    expect(ghostToken).toBeDefined();
    expect(ghostToken?.isGhost).toBe(true);
  });
});

describe('mock packet structure', () => {
  it('should have valid layoutBlocks for phase 1', () => {
    expect(mockPhase1.layoutBlocks).toEqual([['p1', 'p2', 'p3'], ['p4']]);
  });

  it('should have segment-level senses for compound word', () => {
    const p4 = mockPhase1.paliWords.find(w => w.id === 'p4');
    expect(p4?.segments.length).toBe(3);
    expect(p4?.segments[0].senses).toBeDefined();
    expect(p4?.segments[0].senses![0].english).toBe('Mindfulness');
  });

  it('should have all English tokens linked', () => {
    const linkedCount = mockPhase1.englishStructure.filter(
      t => t.linkedPaliId || t.linkedSegmentId
    ).length;
    expect(linkedCount).toBe(5);
  });
});

import { describe, expect, it } from 'vitest';
import { runGroundingPass, applyGroundingToPhase } from './grounding';
import { ContestedTermProvider } from '../grounding/contestedTermProvider';
import type { PhaseView } from '../../../types/suttaStudio';

/**
 * Minimal in-memory registry mirroring the production contested-terms.json
 * schema. Two terms (satipaṭṭhāna, dukkha) cover the match strategies that
 * matter: substring, stem-prefix, and the per-entry citation accumulation.
 */
const TEST_REGISTRY = {
  _meta: { schema: 'test-fixture@1' },
  satipaṭṭhāna: {
    parses: [
      {
        morphology: 'sati + paṭṭhāna',
        translatorRenderings: [
          {
            translator: 'Bhikkhu Bodhi',
            rendering: 'foundations of mindfulness',
            url: 'https://suttacentral.net/mn10/en/bodhi',
            verified: '2026-05-14',
          },
        ],
      },
    ],
    encyclopedicReferences: [
      {
        source: 'Wikipedia',
        url: 'https://en.wikipedia.org/wiki/Satipatthana',
        quotedClaim: 'Test quote about satipaṭṭhāna',
      },
    ],
    curatorNote: 'Test curator note',
  },
  dukkha: {
    parses: [
      {
        morphology: 'du + kha',
        translatorRenderings: [
          {
            translator: 'Bhikkhu Bodhi',
            rendering: 'suffering',
            url: 'https://suttacentral.net/mn10/en/bodhi',
            verified: '2026-05-14',
          },
        ],
      },
    ],
  },
} as const;

function makePhase(overrides: Partial<PhaseView> = {}): PhaseView {
  return {
    id: 'phase-test',
    canonicalSegmentIds: ['mn10:2.1'],
    paliWords: [],
    englishStructure: [],
    layoutBlocks: [['p1']],
    ...overrides,
  };
}

describe('runGroundingPass', () => {
  it('attaches no citations when no word matches any registry term', async () => {
    const provider = new ContestedTermProvider(TEST_REGISTRY);
    const phase = makePhase({
      paliWords: [
        {
          id: 'p1',
          wordClass: 'content',
          segments: [{ id: 'p1s1', text: 'unrelatedword', type: 'stem' }],
          senses: [{ english: 'unrelated', nuance: 'test' }],
        },
      ],
    });

    const result = await runGroundingPass(phase, [provider]);
    expect(result.citationsAdded).toHaveLength(0);
    expect(result.citationIdsByWord.size).toBe(0);
  });

  it('substring-matches a compound (dukkhadomanassānaṁ → dukkha)', async () => {
    const provider = new ContestedTermProvider(TEST_REGISTRY);
    const phase = makePhase({
      paliWords: [
        {
          id: 'p1',
          wordClass: 'content',
          segments: [
            { id: 'p1s1', text: 'dukkha', type: 'stem' },
            { id: 'p1s2', text: 'domanassānaṁ', type: 'suffix' },
          ],
          senses: [{ english: 'suffering', nuance: 'test' }],
        },
      ],
    });

    const result = await runGroundingPass(phase, [provider]);
    expect(result.citationIdsByWord.has('p1')).toBe(true);
    const match = result.matches.find((m) => m.term === 'dukkha');
    // 'dukkha' appears as both substring and segment-exact; segment-exact
    // is checked AFTER substring, so the classifier reports substring.
    expect(match?.match.strategy).toBe('substring');
  });

  it('stem-prefix-matches inflected nominative (satipaṭṭhānā → satipaṭṭhāna)', async () => {
    const provider = new ContestedTermProvider(TEST_REGISTRY);
    const phase = makePhase({
      paliWords: [
        {
          id: 'p17',
          wordClass: 'content',
          segments: [
            { id: 'p17s1', text: 'sati', type: 'stem' },
            { id: 'p17s2', text: 'paṭṭhānā', type: 'stem' }, // long ā = nom pl
          ],
          senses: [{ english: 'foundations', nuance: 'test' }],
        },
      ],
    });

    const result = await runGroundingPass(phase, [provider]);
    const match = result.matches.find((m) => m.term === 'satipaṭṭhāna');
    expect(match?.match.strategy).toBe('stem-prefix');
    expect(match?.match.matchedAgainst).toBe('satipaṭṭhānā');
  });

  it('returns no claims for missing entries — no LLM fallback', async () => {
    const provider = new ContestedTermProvider(TEST_REGISTRY);
    const phase = makePhase({
      paliWords: [
        {
          id: 'p1',
          wordClass: 'content',
          // Word that's not in the registry at all
          segments: [{ id: 'p1s1', text: 'nibbāna', type: 'stem' }],
          senses: [{ english: 'extinguishment', nuance: 'test' }],
        },
      ],
    });

    const result = await runGroundingPass(phase, [provider]);
    expect(result.citationsAdded).toHaveLength(0);
    expect(result.matches).toHaveLength(0);
    // Critically: the sense receives NO citationIds — interpretive, not fabricated.
  });

  it('produces stable citation IDs (idempotent identity)', async () => {
    const provider = new ContestedTermProvider(TEST_REGISTRY);
    const phase = makePhase({
      paliWords: [
        {
          id: 'p17',
          wordClass: 'content',
          segments: [
            { id: 'p17s1', text: 'sati', type: 'stem' },
            { id: 'p17s2', text: 'paṭṭhānā', type: 'stem' },
          ],
          senses: [{ english: 'foundations', nuance: 'test' }],
        },
      ],
    });

    const result1 = await runGroundingPass(phase, [provider]);
    const result2 = await runGroundingPass(phase, [provider]);

    const ids1 = result1.citationsAdded.map((c) => c.id).sort();
    const ids2 = result2.citationsAdded.map((c) => c.id).sort();
    expect(ids1).toEqual(ids2);
  });
});

describe('applyGroundingToPhase', () => {
  it('attaches citation IDs to every sense of the matched word', async () => {
    const provider = new ContestedTermProvider(TEST_REGISTRY);
    const phase = makePhase({
      paliWords: [
        {
          id: 'p17',
          wordClass: 'content',
          segments: [
            { id: 'p17s1', text: 'sati', type: 'stem' },
            { id: 'p17s2', text: 'paṭṭhānā', type: 'stem' },
          ],
          senses: [
            { english: 'foundations', nuance: 'Bodhi' },
            { english: 'establishings', nuance: 'Thanissaro' },
          ],
        },
      ],
    });

    const result = await runGroundingPass(phase, [provider]);
    applyGroundingToPhase(phase, result);

    const w = phase.paliWords[0];
    expect(w.senses[0].citationIds).toBeDefined();
    expect(w.senses[0].citationIds!.length).toBeGreaterThan(0);
    // Both senses get the same citation IDs (per the conservative all-on-all strategy).
    expect(w.senses[0].citationIds).toEqual(w.senses[1].citationIds);
  });

  it('preserves existing citation IDs (idempotent merge)', async () => {
    const provider = new ContestedTermProvider(TEST_REGISTRY);
    const phase = makePhase({
      paliWords: [
        {
          id: 'p17',
          wordClass: 'content',
          segments: [
            { id: 'p17s1', text: 'sati', type: 'stem' },
            { id: 'p17s2', text: 'paṭṭhānā', type: 'stem' },
          ],
          senses: [
            {
              english: 'foundations',
              nuance: 'Bodhi',
              citationIds: ['cite:preexisting:something'],
            },
          ],
        },
      ],
    });

    const result = await runGroundingPass(phase, [provider]);
    applyGroundingToPhase(phase, result);

    const sense = phase.paliWords[0].senses[0];
    expect(sense.citationIds).toContain('cite:preexisting:something');
    expect(sense.citationIds!.length).toBeGreaterThan(1);
  });
});

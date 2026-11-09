// @vitest-environment node
import { describe, expect, it } from 'vitest';
import packetJson from '../../content/references/sutta/trimsika.json';
import draft from '../../data/trimsika/malayalam.json';
import { buildMalayalamWitness } from '../../data/trimsika/malayalam';
import { validateWitnesses, witnessSpanText } from '../../services/sutta-studio/witnesses';
import type { DeepLoomPacket } from '../../types/suttaStudio';

const packet = packetJson as DeepLoomPacket;
describe('Malayalam original working witness', () => {
  it('covers all 30 verses / 307 written tokens once with explicit phrase mappings', () => {
    const witness = packet.translations!.witnesses.find(w => w.language === 'ml')!;
    expect(buildMalayalamWitness(packet.phases, draft, packet.provenance!)).toEqual(witness);
    expect(validateWitnesses(packet)).toEqual([]);
    if (witness.content.kind !== 'translation') throw new Error('Expected fixed Malayalam witness');
    expect(witness.content.passages).toHaveLength(30);
    const actual = witness.content.alignments.flatMap(edge => edge.sourceSpans.flatMap(span => span.wordIds));
    expect(actual).toEqual(packet.phases.flatMap(phase => phase.paliWords.map(word => word.id)));
    expect(actual).toHaveLength(307);
    for (const passage of witness.content.passages) {
      const slices = witness.content.alignments.flatMap(e => e.targetSpans).filter(s => s.passageId === passage.id);
      expect(slices.map(span => witnessSpanText(witness, span)).join('')).toBe(passage.text);
      expect(passage.text).toMatch(/[\u0D00-\u0D7F]/u);
    }
    expect(witness.attribution.translator).toContain('Codex');
    expect(witness.attribution.edition).toContain('not yet independently reviewed');
    expect(witness.attribution.source.language).toBe('sa');
    expect(witness.content.alignments.every(e => e.review.status === 'unreviewed')).toBe(true);
    for (const verse of [3, 18, 19, 22, 28]) {
      expect(witness.content.alignments.some(e => e.displayAt.phaseId === `verse-${verse}` && e.status === 'uncertain')).toBe(true);
    }
  });
  it('rejects missing verses, reordered words, invented word IDs and non-Malayalam placeholders', () => {
    expect(() => buildMalayalamWitness(packet.phases, draft.slice(1), packet.provenance!)).toThrow('exactly verses');
    for (const kind of ['reordered', 'dangling', 'placeholder']) {
      const bad = structuredClone(draft);
      if (kind === 'reordered') bad[0].groups[0].wordIds.reverse();
      if (kind === 'dangling') bad[0].groups[0].wordIds[0] = 'not-a-source-word';
      if (kind === 'placeholder') bad[0].groups[0].text = 'translation pending';
      expect(() => buildMalayalamWitness(packet.phases, bad, packet.provenance!)).toThrow(/Malayalam verse 1/);
    }
  });
});

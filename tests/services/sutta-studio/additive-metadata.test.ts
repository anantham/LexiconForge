import { describe, expect, it } from 'vitest';
import { DEMO_PACKET_MN10 } from '../../../components/sutta-studio/demoPacket';
import { buildSegmentsMapFromAnatomist } from '../../../services/suttaStudioRehydrator';
import { anatomistResponseSchema, morphResponseSchema, phaseResponseSchema } from '../../../services/sutta-studio/schemas';
import type { AnatomistPass, DeepLoomPacket, MorphHint, Span } from '../../../types/suttaStudio';

const packet: DeepLoomPacket = DEMO_PACKET_MN10;

describe('optional grounded Sutta metadata (#39, #40, #42)', () => {
  it('loads whole-work parallels once and keeps formula references at their own scope', () => {
    expect(packet.workParallels?.map(ref => ref.workId)).toContain('dn22');
    expect(packet.workParallels?.every(ref => ref.segmentId === undefined)).toBe(true);
    const opening = packet.phases.find(phase => phase.id === 'phase-a')!;
    const formula = opening.spans!.find(span => span.kind === 'formula')!;
    const wordIds = opening.paliWords.map(word => word.id);
    expect(wordIds).toContain(formula.startWordId);
    expect(wordIds).toContain(formula.endWordId);
    expect(wordIds.indexOf(formula.startWordId)).toBeLessThan(wordIds.indexOf(formula.endWordId));
    expect(formula.parallels).toContainEqual(expect.objectContaining({ workId: 'dn22', segmentId: 'dn22:1.1' }));
    expect(opening.parallels).toBeUndefined();
    expect(packet.citations.find(c => c.id === 'cite:sc-bilara:dn22:1.1:formula')?.excerpt).toContain('Evaṁ me sutaṁ');
  });

  it.each([
    ['phase-a', 'a2s1', 'gen', 'agent'],
    ['phase-b', 'b2s3', 'acc', 'temporal_frame'],
    ['phase-c', 'c1s2', 'loc', 'membership'],
  ])('keeps %s case separate from syntactic function after pass rehydration', (phaseId, segmentId, grammaticalCase, syntacticFunction) => {
    const phase = packet.phases.find(p => p.id === phaseId)!;
    const word = phase.paliWords.find(w => w.segments.some(s => s.id === segmentId))!;
    const segment = word.segments.find(s => s.id === segmentId)!;
    expect(segment.morph).toMatchObject({ case: grammaticalCase, function: syntacticFunction });
    const anatomist: AnatomistPass = {
      id: phaseId,
      words: [{ id: word.id, surface: segment.text, wordClass: word.wordClass!, segmentIds: [segment.id] }],
      segments: [{ ...segment, wordId: word.id }],
    };
    const rehydrated = buildSegmentsMapFromAnatomist(anatomist).get(word.id)![0];
    expect(rehydrated.morph).toEqual(segment.morph);
    expect(rehydrated.morph?.semanticRole).toBeTruthy();
  });

  it('all compiler morphology schemas allow the new optional fields without requiring them', () => {
    const schemas = [
      anatomistResponseSchema.properties.segments.items.properties.morph,
      phaseResponseSchema.properties.paliWords.items.properties.segments.items.properties.morph,
      morphResponseSchema.properties.paliWords.items.properties.segments.items.properties.morph,
    ];
    for (const schema of schemas) {
      expect(schema.properties.function.enum).toContain('temporal_frame');
      expect(schema.properties.semanticRole.type).toBe('string');
      expect(schema).not.toHaveProperty('required');
    }
    // Old callers remain assignable: neither new metadata nor references are mandatory.
    const legacyMorph: MorphHint = { case: 'gen' };
    const legacySpan: Span = { id: 'quote', kind: 'quoted_speech', startWordId: 'a1', endWordId: 'a3' };
    const refrain: Span = { ...legacySpan, kind: 'refrain' };
    expect(legacyMorph.function).toBeUndefined();
    expect(legacySpan.parallels).toBeUndefined();
    expect(refrain.kind).toBe('refrain');
  });
});

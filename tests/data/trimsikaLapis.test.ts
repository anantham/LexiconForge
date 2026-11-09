// @vitest-environment node
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import data from '../../data/trimsika/lapis-lazuli.json';
import packetJson from '../../content/references/sutta/trimsika.json';
import { validateWitnesses, witnessSpanText } from '../../services/sutta-studio/witnesses';
import type { DeepLoomPacket } from '../../types/suttaStudio';
import type { TranslationWitness } from '../../types/suttaStudioWitness';

const witness = data as TranslationWitness;
describe('Lapis Lazuli CC0 witness preservation and explicit correspondence limits', () => {
  it('retains all publisher words, punctuation, spellings and 30 original four-line verses', () => {
    if (witness.content.kind !== 'translation') throw new Error('fixed witness required');
    expect(witness.content.passages).toHaveLength(30);
    expect(witness.content.passages.every(p => p.text.split('\n').length === 4)).toBe(true);
    // Snapshot independently captured from publisher HTML on 2026-10-19; no internet in tests.
    expect(createHash('sha256').update(JSON.stringify(witness.content.passages)).digest('hex')).toBe('3fbd01c545e0959c879d327850b635bde5cdcb9898e6f32d3f1eb62c56703e0d');
    expect(witness.attribution.publisher).toBe('Lapis Lazuli Texts');
    expect(witness.attribution.translator).toBeUndefined();
    expect(witness.attribution.source.language).toBe('zh');
    expect(witness.attribution.license).toContain('CC0');
    expect(validateWitnesses(packetJson as DeepLoomPacket)).toEqual([]);
    for (const passage of witness.content.passages) {
      const spans = witness.content.alignments.flatMap(e => e.targetSpans).filter(s => s.passageId === passage.id);
      expect(spans.map(span => witnessSpanText(witness, span)).join('')).toBe(passage.text);
    }
  });
  it('keeps actual verse-boundary shifts, uncertainty and unaligned text without fabricated equivalence', () => {
    if (witness.content.kind !== 'translation') throw new Error('fixed witness required');
    const edges = witness.content.alignments;
    expect(edges).toHaveLength(109);
    expect(edges.filter(e => e.status === 'uncertain')).toHaveLength(20);
    expect(edges.filter(e => e.status === 'unaligned').map(e => e.id)).toEqual(['ll-v10-l4-4', 'll-v24-l3-4']);
    for (const edge of edges.filter(e => e.status === 'unaligned')) expect(edge.sourceSpans).toEqual([]);
    for (const [id, verse] of [['ll-v3-l4-4', 4], ['ll-v4-l4-4', 5], ['ll-v5-l1-1', 8], ['ll-v6-l4-4', 7], ['ll-v7-l1-1', 6], ['ll-v11-l1-1', 10], ['ll-v14-l1-1', 13]] as const) {
      expect(edges.find(e => e.id === id)?.sourceSpans[0].phaseId).toBe(`verse-${verse}`);
    }
    expect(edges.find(e => e.id === 'll-v12-l1-2')?.sourceSpans.map(s => s.phaseId)).toEqual(['verse-11', 'verse-12']);
    expect(edges.every(e => e.review.status === 'unreviewed')).toBe(true);
  });
});

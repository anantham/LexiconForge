// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { validateWitnesses, witnessSpanText } from '../../services/sutta-studio/witnesses';
import { witnessFixture } from '../fixtures/suttaWitnesses';

describe('immutable witnesses and independent alignment assertions', () => {
  it('accepts explicit many-to-many cross-verse, omission, uncertain and unaligned mappings', () => {
    expect(validateWitnesses(witnessFixture())).toEqual([]);
  });
  it('slices Unicode code points without splitting an astral character', () => {
    const witness = witnessFixture().translations!.witnesses[1];
    expect(witnessSpanText(witness, { passageId: 'a', start: 6, end: 7 })).toBe('🪷');
  });
  it.each(['gap', 'overlap', 'dangling', 'wrong-order', 'anchor', 'unattributed', 'false-review', 'uncertain-as-aligned'])('rejects %s without repairing or inventing correspondence', kind => {
    const packet = witnessFixture();
    const witness = packet.translations!.witnesses[1];
    if (witness.content.kind !== 'translation') throw new Error('fixture');
    const edge = witness.content.alignments[0];
    if (kind === 'gap') edge.targetSpans[0].end--;
    if (kind === 'overlap') edge.targetSpans.push({ ...edge.targetSpans[0] });
    if (kind === 'dangling') edge.sourceSpans[0].wordIds = ['no-such-word'];
    if (kind === 'wrong-order') edge.sourceSpans[0].wordIds.reverse();
    if (kind === 'anchor') edge.displayAt.wordId = 'no-such-word';
    if (kind === 'unattributed') delete witness.attribution.publisher;
    if (kind === 'false-review') edge.review.status = 'reviewed';
    if (kind === 'uncertain-as-aligned') edge.relation = 'uncertain';
    expect(validateWitnesses(packet).length).toBeGreaterThan(0);
  });
  it('rejects a split inside a Malayalam grapheme even when code-point coverage is complete', () => {
    const packet = witnessFixture();
    const witness = packet.translations!.witnesses[2];
    if (witness.content.kind !== 'translation') throw new Error('fixture');
    witness.content.passages[0].text = 'കാ';
    witness.content.alignments[0].targetSpans = [{ passageId: 'r', start: 0, end: 1 }, { passageId: 'r', start: 1, end: 2 }];
    expect(validateWitnesses(packet).join(' ')).toContain('splits a grapheme');
  });
  it('does not infer a Sanskrit verse number from the witness locator', () => {
    const packet = witnessFixture();
    const witness = packet.translations!.witnesses[1];
    if (witness.content.kind !== 'translation') throw new Error('fixture');
    witness.content.passages[0].label = 'Unrelated numbering 999';
    expect(validateWitnesses(packet)).toEqual([]);
    expect(witness.content.alignments[0].sourceSpans.map(s => s.phaseId)).toEqual(['p1', 'p2']);
  });
});

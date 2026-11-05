import type { DeepLoomPacket } from '../../types/suttaStudio';
import type { TranslationWitness, WitnessAlignment, WitnessTargetSpan } from '../../types/suttaStudioWitness';

export function witnessSpanText(witness: TranslationWitness, span: WitnessTargetSpan): string {
  if (witness.content.kind !== 'translation') return '';
  const passage = witness.content.passages.find(p => p.id === span.passageId);
  return Array.from(passage?.text ?? '').slice(span.start, span.end).join('');
}

export function alignmentTouches(alignment: WitnessAlignment, phaseId: string, wordId: string): boolean {
  return alignment.sourceSpans.some(span => span.phaseId === phaseId && span.wordIds.includes(wordId));
}

/** Structural validity is not scholarly approval. Unknown coverage stays explicit. */
export function validateWitnesses(packet: Pick<DeepLoomPacket, 'translations' | 'phases'>): string[] {
  const set = packet.translations;
  if (!set) return [];
  const issues: string[] = [];
  const fail = (id: string, detail: string) => issues.push(`Translation witness ${id}: ${detail}`);
  const unique = (ids: string[]) => new Set(ids).size === ids.length && ids.every(id => id.trim());
  if (!unique(set.witnesses.map(w => w.id))) fail('catalog', 'blank or duplicate witness ID.');
  if (!set.witnesses.some(w => w.id === set.defaultWitnessId)) fail('catalog', 'default witness does not exist.');
  const phases = new Map(packet.phases.map(p => [p.id, p.paliWords.map(w => w.id)]));
  for (const witness of set.witnesses) {
    const { id, attribution: a, content } = witness;
    if (![witness.label, witness.language, witness.languageName, a.edition, a.revision, a.license, a.normalization, a.source.language, a.source.witness].every(s => s?.trim())
      || !(a.translator?.trim() || a.publisher?.trim())) fail(id, 'language, attribution, source, revision, license and normalization must be explicit.');
    if (content.kind === 'legacy-interlinear') continue;
    if (!unique(content.passages.map(p => p.id)) || !unique(content.alignments.map(e => e.id))) fail(id, 'blank or duplicate passage/alignment ID.');
    const passages = new Map(content.passages.map(p => [p.id, Array.from(p.text)]));
    const coverage = new Map(content.passages.map(p => [p.id, Array.from(p.text, () => 0)]));
    const boundaries = new Map(content.passages.map(p => {
      const points = new Set<number>([0, Array.from(p.text).length]);
      if (typeof Intl.Segmenter === 'function') {
        let offset = 0;
        for (const part of new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(p.text)) {
          offset += Array.from(part.segment).length;
          points.add(offset);
        }
      }
      // Without a segmenter only whole-passage spans are safe to display.
      return [p.id, points] as const;
    }));
    for (const passage of content.passages) {
      if (!passage.text.trim() || !passage.label.trim()) fail(id, `passage ${passage.id} needs exact text and its own locator.`);
    }
    for (const edge of content.alignments) {
      const report = (detail: string) => fail(id, `${edge.id}: ${detail}`);
      if (!phases.get(edge.displayAt.phaseId)?.includes(edge.displayAt.wordId)) report('dangling display anchor.');
      if (!edge.evidence.trim()) report('alignment evidence or explicit uncertainty is required.');
      if (edge.review.status === 'reviewed' && !(edge.review.by?.trim() && edge.review.date?.trim())) report('reviewed claim needs reviewer and date.');
      if (edge.status === 'aligned' && (!edge.sourceSpans.length || edge.relation === 'uncertain')) report('aligned claim needs source spans and a definite relation.');
      if (edge.status === 'unaligned' && edge.sourceSpans.length) report('unaligned text cannot assert source correspondence.');
      if (edge.relation === 'omitted' ? (edge.targetSpans.length || !edge.sourceSpans.length) : !edge.targetSpans.length) report('only source omissions may have no target text.');
      const seenSource = new Set<string>();
      for (const span of edge.sourceSpans) {
        const words = phases.get(span.phaseId) ?? [];
        const positions = span.wordIds.map(word => words.indexOf(word));
        if (!positions.length || positions.some((n, i) => n < 0 || (i > 0 && n !== positions[i - 1] + 1))) report('source span must contain existing contiguous words in source order.');
        for (const word of span.wordIds) {
          const key = `${span.phaseId}/${word}`;
          if (seenSource.has(key)) report('source word repeated within one mapping.');
          seenSource.add(key);
        }
      }
      for (const span of edge.targetSpans) {
        const text = passages.get(span.passageId);
        if (!text || !Number.isInteger(span.start) || !Number.isInteger(span.end) || span.start < 0 || span.end <= span.start || span.end > text.length) {
          report('target span outside its immutable passage.');
          continue;
        }
        if (!boundaries.get(span.passageId)?.has(span.start) || !boundaries.get(span.passageId)?.has(span.end)) {
          report('target span splits a grapheme or cannot be verified without Intl.Segmenter.');
        }
        const counts = coverage.get(span.passageId)!;
        for (let i = span.start; i < span.end; i++) counts[i]++;
      }
    }
    for (const [passage, counts] of coverage) {
      if (counts.some(n => n !== 1)) fail(id, `${passage}: each target code point must occur exactly once; mark missing correspondence explicitly unaligned.`);
    }
  }
  return issues;
}

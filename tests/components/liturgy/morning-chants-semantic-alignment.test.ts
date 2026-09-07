import { describe, expect, it } from 'vitest';
import { morningChants } from '../../../data/liturgy/morning-chants';
import { auditLiturgyAlignments } from '../../../services/liturgy/alignmentAudit';
import { segmentSurfaceMorphemes } from '../../../services/liturgy/surfaceSegmentation';
import { validateLiturgyDoc } from '../../../services/liturgy/validation';

describe('Morning Chants semantic alignments', () => {
  it('contains no unreviewed many-to-one morpheme alignment groups', () => {
    const result = auditLiturgyAlignments([
      { route: 'maple/morning-chants', doc: morningChants },
    ]);

    expect(result.issues, JSON.stringify(result.issues, null, 2)).toEqual([]);
    expect(result.summary.fineTargetReviewGroups).toBe(0);
  });

  it('keeps semantic-analysis explanations in the reader-facing register', () => {
    const diagnostics = validateLiturgyDoc(morningChants)
      .filter((diagnostic) => diagnostic.code === 'plain_register_jargon');
    expect(diagnostics, JSON.stringify(diagnostics, null, 2)).toEqual([]);
  });

  it('keeps the first precept surface, lexical, and ablative layers distinct', () => {
    const section = morningChants.sections.find((item) => item.id === 'five-precepts');
    expect(section?.shape).toBe('triple-script-witness');
    if (section?.shape !== 'triple-script-witness') return;

    const segment = section.segments.find((item) => item.id === 'precept-1');
    const word = segment?.words?.find((item) => item.form === 'pāṇātipātā');
    expect(word?.morphemes?.map((item) => item.text)).toEqual(['pāṇā', 'tipāt', 'ā']);
    expect(word?.analysis?.units.map((item) => item.id)).toEqual([
      'living-being',
      'killing',
      'ablative-source',
    ]);
    expect(word?.analysis?.transformations?.map(({ from, to }) => ({ from, to }))).toEqual([
      { from: 'pāṇa + atipāta', to: 'pāṇātipāta' },
      { from: 'pāṇātipāta', to: 'pāṇātipātā' },
    ]);

    const maple = segment?.witnesses.find((item) => item.by === 'MAPLE chant text');
    expect(maple?.alignTo?.[6]).toBe(0);
    expect(maple?.tokenAlignTo?.slice(6)).toEqual([
      { kind: 'analysis', unitId: 'ablative-source' },
      { kind: 'analysis', unitId: 'killing' },
      { kind: 'analysis', unitId: 'living-being' },
      { kind: 'analysis', unitId: 'living-being' },
    ]);
  });

  it('keeps every affected Devanagari range on complete grapheme clusters', () => {
    const section = morningChants.sections.find((item) => item.id === 'five-precepts');
    expect(section?.shape).toBe('triple-script-witness');
    if (section?.shape !== 'triple-script-witness') return;

    const expected: Record<string, string[]> = {
      'pāṇātipātā': ['पाणा', 'तिपाता'],
      'sikkhāpadaṁ': ['सिक्खा', 'पदं'],
      'samādiyāmi': ['समा', 'दि', 'या', 'मि'],
      'adinnādānā': ['अ', 'दिन्ना', 'दाना'],
      'musāvādā': ['मुसा', 'वादा'],
    };
    const words = section.segments.flatMap((segment) => segment.words ?? []);

    for (const [form, ranges] of Object.entries(expected)) {
      const word = words.find((candidate) => candidate.form === form)!;
      const morphemes = word.scriptMorphemes?.['pi-Deva'] ?? [];
      expect(morphemes.map((morpheme) => morpheme.text), form).toEqual(ranges);
      expect(
        segmentSurfaceMorphemes(word.scriptAlt!, morphemes, { caseSensitive: true }),
        form
      ).toMatchObject({ ok: true });
    }
  });
});

import { describe, expect, it } from 'vitest';
import fixture from '../../../test-fixtures/liturgy-generator/ti-sarana-mini.json';
import threeRefugesPilot from '../../../test-fixtures/liturgy-generator/three-refuges-pilot.json';
import threeRefugesGeneratedDraft from '../../../test-fixtures/liturgy-generator/three-refuges.generated.draft';
import { buildLiturgyDraft } from '../../../services/liturgy-generator/pipeline';
import { emitLiturgyDocModule } from '../../../services/liturgy-generator/emit';
import type { LiturgyGeneratorInput } from '../../../services/liturgy-generator/types';

describe('liturgy generator pipeline', () => {
  it('infers witness alignment and morpheme alignment for a structured packet', () => {
    const result = buildLiturgyDraft(fixture as LiturgyGeneratorInput);
    const section = result.doc.sections[0];
    expect(section.shape).toBe('triple-script-witness');
    if (section.shape !== 'triple-script-witness') return;

    const witness = section.segments[0].witnesses[0];
    expect(witness.alignTo).toEqual([2, 1, 1, -1, -1, 0]);
    expect(witness.morphemeAlignTo).toEqual([1, 0, 0, null, null, 0]);
    expect(result.stats.inferredAlignments).toBe(1);
    expect(result.stats.errorCount).toBe(0);
  });

  it('emits a TypeScript module without auto-registering the generated draft', () => {
    const result = buildLiturgyDraft(fixture as LiturgyGeneratorInput);
    const moduleText = emitLiturgyDocModule(result.doc, result.exportName);

    expect(moduleText).toContain("import type { LiturgyDoc } from '../../types/liturgy';");
    expect(moduleText).toContain('export const tiSaranaMini: LiturgyDoc');
    expect(moduleText).toContain('export default tiSaranaMini;');
    expect(moduleText).not.toContain('LITURGY_DOCS_BY_SANGHA');
  });

  it('makes broken morpheme reconstruction loud', () => {
    const broken = structuredClone(fixture) as LiturgyGeneratorInput;
    const section = broken.sections[0];
    if (section.shape !== 'triple-script-witness') {
      throw new Error('fixture invariant failed: expected triple-script-witness section');
    }
    const firstWord = section.segments[0].words?.[0];
    if (!firstWord?.morphemes?.[0]) {
      throw new Error('fixture invariant failed: expected first word morphemes');
    }
    firstWord.morphemes[0].text = 'Budha';

    const result = buildLiturgyDraft(broken);
    expect(result.stats.errorCount).toBeGreaterThan(0);
    expect(result.diagnostics.map((d) => d.code)).toContain(
      'liturgy_generator.morpheme_reconstruction_failed'
    );
  });

  it('reproduces the committed Three Refuges pilot draft and flags it for review', () => {
    const result = buildLiturgyDraft(threeRefugesPilot as LiturgyGeneratorInput);

    expect(result.stats.inferredAlignments).toBe(3);
    expect(result.stats.unmappedTokens).toBe(0);
    expect(result.stats.errorCount).toBe(0);
    // The emitted arrays are deterministic and unchanged...
    expect(result.doc).toEqual(threeRefugesGeneratedDraft);
    // ...but inference is never silent: each inferred witness gets a review
    // warning, so a machine-guessed alignment can't quietly become a chant.
    expect(result.stats.warningCount).toBe(3);
    expect(result.diagnostics.map((d) => d.code)).toContain(
      'liturgy_generator.inferred_alignment_unreviewed'
    );
  });

  it('warns loudly when too few content words align (real-chant collision case)', () => {
    // A witness whose English words do not appear in any source gloss: the
    // matcher can map almost nothing, which on a real chant means most words
    // render as un-arrowed glue. That must surface, not pass silently.
    const sparse = structuredClone(fixture) as LiturgyGeneratorInput;
    const section = sparse.sections[0];
    if (section.shape !== 'triple-script-witness') {
      throw new Error('fixture invariant failed: expected triple-script-witness section');
    }
    section.segments[0].witnesses[0].text = 'Homage devotion reverence prostration entirely.';

    const result = buildLiturgyDraft(sparse);
    expect(result.diagnostics.map((d) => d.code)).toContain(
      'liturgy_generator.low_alignment_coverage'
    );
  });
});

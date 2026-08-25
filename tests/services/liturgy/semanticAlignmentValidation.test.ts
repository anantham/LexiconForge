import { describe, expect, it } from 'vitest';
import { validateLiturgyDoc } from '../../../services/liturgy/validation';
import type { LiturgyDoc, Witness, WordGloss } from '../../../types/liturgy';

function word(): WordGloss {
  return {
    form: 'pāṇātipātā',
    gloss: 'from killing living beings',
    morphemes: [
      { text: 'pāṇā', type: 'stem', gloss: 'living being' },
      { text: 'tipāt', type: 'stem', gloss: 'killing' },
      { text: 'ā', type: 'suffix', gloss: 'from' },
    ],
    analysis: {
      status: 'confirmed',
      units: [
        { id: 'living-being', layer: 'lexical', label: 'pāṇa', gloss: 'living being', surfaceMorphemeIndices: [0] },
        { id: 'killing', layer: 'lexical', label: 'atipāta', gloss: 'killing', surfaceMorphemeIndices: [1] },
        { id: 'ablative-source', layer: 'grammar', label: '-ā', gloss: 'from', surfaceMorphemeIndices: [2] },
      ],
    },
  };
}

function witness(): Witness {
  return {
    by: 'Test',
    text: 'from killing living beings',
    alignTo: [0, 0, 0, 0],
    tokenAlignTo: [
      { kind: 'analysis', unitId: 'ablative-source' },
      { kind: 'analysis', unitId: 'killing' },
      { kind: 'analysis', unitId: 'living-being' },
      { kind: 'analysis', unitId: 'living-being' },
    ],
  };
}

function doc(): LiturgyDoc {
  return {
    slug: 'semantic-alignment-test',
    sangha: 'test',
    title: 'Test',
    tradition: 'theravada',
    sections: [{
      id: 'body',
      shape: 'triple-script-witness',
      segments: [{ id: 'line', pali: 'Pāṇātipātā', witnesses: [witness()], words: [word()] }],
    }],
  };
}

function errorCodes(value: LiturgyDoc): string[] {
  return validateLiturgyDoc(value)
    .filter((diagnostic) => diagnostic.level === 'error')
    .map((diagnostic) => diagnostic.code);
}

describe('layered liturgy alignment validation', () => {
  it('accepts a complete layered alignment', () => {
    expect(errorCodes(doc())).toEqual([]);
  });

  it('rejects tokenAlignTo arrays that are not parallel to alignTo', () => {
    const value = doc();
    const section = value.sections[0];
    if (section.shape !== 'triple-script-witness') return;
    section.segments[0].witnesses[0].tokenAlignTo = [{ kind: 'word' }];
    expect(errorCodes(value)).toContain('token_align_length_mismatch');
  });

  it('rejects fine targets on an unaligned English token', () => {
    const value = doc();
    const section = value.sections[0];
    if (section.shape !== 'triple-script-witness') return;
    section.segments[0].witnesses[0].alignTo![0] = -1;
    expect(errorCodes(value)).toContain('fine_target_without_word_alignment');
  });

  it('rejects unknown analysis units and out-of-range morphemes', () => {
    const value = doc();
    const section = value.sections[0];
    if (section.shape !== 'triple-script-witness') return;
    section.segments[0].witnesses[0].tokenAlignTo![0] = { kind: 'analysis', unitId: 'not-authored' };
    section.segments[0].witnesses[0].tokenAlignTo![1] = { kind: 'morpheme', index: 99 };
    expect(errorCodes(value)).toEqual(
      expect.arrayContaining(['analysis_unit_not_found', 'fine_morpheme_index_out_of_range'])
    );
  });

  it('rejects duplicate, DOM-unsafe analysis IDs and invalid surface references', () => {
    const value = doc();
    const section = value.sections[0];
    if (section.shape !== 'triple-script-witness') return;
    const analysis = section.segments[0].words![0].analysis!;
    analysis.units[1].id = analysis.units[0].id;
    analysis.units[2].id = 'not safe';
    analysis.units[2].surfaceMorphemeIndices = [9];
    expect(errorCodes(value)).toEqual(
      expect.arrayContaining([
        'analysis_unit_id_duplicate',
        'analysis_unit_id_invalid',
        'analysis_surface_index_out_of_range',
      ])
    );
  });

  it('rejects fine alignment metadata when alignTo is absent', () => {
    const value = doc();
    const section = value.sections[0];
    if (section.shape !== 'triple-script-witness') return;
    section.segments[0].witnesses[0].alignTo = undefined;
    expect(errorCodes(value)).toContain('fine_alignment_without_word_alignment');
  });

  it('rejects an out-of-range legacy morpheme target', () => {
    const value = doc();
    const section = value.sections[0];
    if (section.shape !== 'triple-script-witness') return;
    const witness = section.segments[0].witnesses[0];
    witness.tokenAlignTo = undefined;
    witness.morphemeAlignTo = [99, null, null, null];
    expect(errorCodes(value)).toContain('legacy_morpheme_index_out_of_range');
  });

  it('rejects a fine target whose valid source position has no WordGloss', () => {
    const value = doc();
    const section = value.sections[0];
    if (section.shape !== 'triple-script-witness') return;
    section.segments[0].words = [];
    expect(errorCodes(value)).toContain('fine_target_word_not_found');
  });

  it('does not validate ignored legacy precision when tokenAlignTo is present', () => {
    const value = doc();
    const section = value.sections[0];
    if (section.shape !== 'triple-script-witness') return;
    const witness = section.segments[0].witnesses[0];
    witness.morphemeAlignTo = [99, 99, 99, 99];
    witness.tokenAlignTo = [null, null, null, null];
    expect(errorCodes(value)).not.toContain('legacy_morpheme_index_out_of_range');
  });
});

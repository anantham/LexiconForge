import type { LiturgyDoc, TripleScriptWitnessSection, WordGloss } from '../../types/liturgy';
import type { LiturgyGeneratorDiagnostic } from './types';
import { tokenizeSourceText, tokenizeWitnessText } from './tokenize';

const SEGMENT_ID_SHORTHAND = /\bv\d+[a-z]\b/;
const JARGON = /\b(gerundive|accusative|nominative|genitive|locative|ablative|optative|vocative|declension|declensional|instrumental case|past participle|present participle)\b/i;

function diagnostic(
  overrides: Omit<LiturgyGeneratorDiagnostic, 'stage'>
): LiturgyGeneratorDiagnostic {
  return { stage: 'validation', ...overrides };
}

function checkText(
  diagnostics: LiturgyGeneratorDiagnostic[],
  text: string | undefined,
  context: {
    sectionId: string;
    segmentId: string;
    path: string;
  }
): void {
  if (!text) return;
  if (SEGMENT_ID_SHORTHAND.test(text)) {
    diagnostics.push(
      diagnostic({
        level: 'error',
        code: 'liturgy_generator.internal_id_leak',
        message: `validateLiturgyDraft: reader-facing text contains an internal segment id at ${context.path}.`,
        ...context,
      })
    );
  }
  const jargonMatch = text.match(JARGON);
  if (jargonMatch) {
    diagnostics.push(
      diagnostic({
        level: 'warn',
        code: 'liturgy_generator.plain_register_jargon',
        message: `validateLiturgyDraft: reader-facing text uses grammar jargon "${jargonMatch[0]}" at ${context.path}; rewrite or justify before registration.`,
        ...context,
      })
    );
  }
}

function checkWord(
  diagnostics: LiturgyGeneratorDiagnostic[],
  word: WordGloss,
  context: {
    sectionId: string;
    segmentId: string;
    wordIndex: number;
  }
): void {
  const wordPath = `sections.${context.sectionId}.segments.${context.segmentId}.words.${context.wordIndex}`;
  if (word.morphemes && word.morphemes.length > 0) {
    const reconstructed = word.morphemes.map((m) => m.text).join('').toLowerCase();
    if (reconstructed !== word.form.toLowerCase()) {
      diagnostics.push(
        diagnostic({
          level: 'error',
          code: 'liturgy_generator.morpheme_reconstruction_failed',
          message: `validateLiturgyDraft: morphemes for "${word.form}" reconstruct "${reconstructed}", not the surface form.`,
          sectionId: context.sectionId,
          segmentId: context.segmentId,
          path: `${wordPath}.morphemes`,
        })
      );
    }
  }

  checkText(diagnostics, word.gloss, {
    sectionId: context.sectionId,
    segmentId: context.segmentId,
    path: `${wordPath}.gloss`,
  });
  checkText(diagnostics, word.etymology, {
    sectionId: context.sectionId,
    segmentId: context.segmentId,
    path: `${wordPath}.etymology`,
  });
  for (const [morphemeIndex, morpheme] of (word.morphemes ?? []).entries()) {
    checkText(diagnostics, morpheme.gloss, {
      sectionId: context.sectionId,
      segmentId: context.segmentId,
      path: `${wordPath}.morphemes.${morphemeIndex}.gloss`,
    });
  }
}

function checkTripleScriptSection(
  diagnostics: LiturgyGeneratorDiagnostic[],
  section: TripleScriptWitnessSection
): void {
  for (const segment of section.segments) {
    const sourceWordCount = segment.words?.length ?? tokenizeSourceText(segment.pali).length;

    for (const [wordIndex, word] of (segment.words ?? []).entries()) {
      checkWord(diagnostics, word, {
        sectionId: section.id,
        segmentId: segment.id,
        wordIndex,
      });
    }

    for (const witness of segment.witnesses) {
      if (!witness.alignTo) continue;
      const witnessWordCount = tokenizeWitnessText(witness.text).length;
      if (witness.alignTo.length !== witnessWordCount) {
        diagnostics.push(
          diagnostic({
            level: 'error',
            code: 'liturgy_generator.align_length_mismatch',
            message: `validateLiturgyDraft: alignTo for "${witness.by}" in segment "${segment.id}" has ${witness.alignTo.length} entries, expected ${witnessWordCount}.`,
            sectionId: section.id,
            segmentId: segment.id,
            witnessBy: witness.by,
            path: 'witness.alignTo',
          })
        );
      }

      witness.alignTo.forEach((value, index) => {
        if (value === -1) return;
        if (value < 0 || value >= sourceWordCount) {
          diagnostics.push(
            diagnostic({
              level: 'error',
              code: 'liturgy_generator.align_index_out_of_range',
              message: `validateLiturgyDraft: alignTo[${index}]=${value} is outside source word range 0-${sourceWordCount - 1}.`,
              sectionId: section.id,
              segmentId: segment.id,
              witnessBy: witness.by,
              path: `witness.alignTo.${index}`,
            })
          );
        }
      });

      if (
        witness.morphemeAlignTo &&
        witness.morphemeAlignTo.length !== witness.alignTo.length
      ) {
        diagnostics.push(
          diagnostic({
            level: 'error',
            code: 'liturgy_generator.morpheme_align_length_mismatch',
            message: `validateLiturgyDraft: morphemeAlignTo for "${witness.by}" in segment "${segment.id}" must be parallel to alignTo.`,
            sectionId: section.id,
            segmentId: segment.id,
            witnessBy: witness.by,
            path: 'witness.morphemeAlignTo',
          })
        );
      }
    }
  }
}

export function validateLiturgyDraft(doc: LiturgyDoc): LiturgyGeneratorDiagnostic[] {
  const diagnostics: LiturgyGeneratorDiagnostic[] = [];
  for (const section of doc.sections) {
    if (section.shape === 'triple-script-witness') {
      checkTripleScriptSection(diagnostics, section);
    }
    if (section.shape === 'prose-commentary') {
      checkText(diagnostics, section.body, {
        sectionId: section.id,
        segmentId: section.id,
        path: `sections.${section.id}.body`,
      });
    }
  }
  return diagnostics;
}

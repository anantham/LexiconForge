import type {
  LiturgyDoc,
  LiturgySection,
  TripleScriptWitnessSegment,
  TripleScriptWitnessSection,
  Witness,
} from '../../types/liturgy';
import { inferWitnessAlignment } from './align';
import { resolveExportName } from './emit';
import type {
  LiturgyGeneratorDiagnostic,
  LiturgyGeneratorInput,
  LiturgyGeneratorResult,
  LiturgyGeneratorSectionInput,
  LiturgyGeneratorStats,
  LiturgyGeneratorTripleScriptSegmentInput,
  LiturgyGeneratorTripleScriptSectionInput,
  LiturgyGeneratorWitnessInput,
} from './types';
import { validateLiturgyDraft } from './validate';

function initialStats(): LiturgyGeneratorStats {
  return {
    inferredAlignments: 0,
    preservedAlignments: 0,
    skippedAlignments: 0,
    inferredMorphemeAlignments: 0,
    unmappedTokens: 0,
    warningCount: 0,
    errorCount: 0,
  };
}

function stripGeneratorWitnessFields(witness: LiturgyGeneratorWitnessInput): Witness {
  const { alignmentMode: _alignmentMode, ...rest } = witness;
  return rest;
}

function materializeWitness(params: {
  sectionId: string;
  segment: LiturgyGeneratorTripleScriptSegmentInput;
  witness: LiturgyGeneratorWitnessInput;
  diagnostics: LiturgyGeneratorDiagnostic[];
  stats: LiturgyGeneratorStats;
}): Witness {
  const { sectionId, segment, witness, diagnostics, stats } = params;
  const mode = witness.alignmentMode ?? (witness.alignTo ? 'preserve' : 'infer');
  const base = stripGeneratorWitnessFields(witness);

  if (mode === 'none') {
    stats.skippedAlignments++;
    return { ...base, alignTo: undefined, morphemeAlignTo: undefined };
  }

  if (mode === 'preserve' || witness.alignTo) {
    stats.preservedAlignments++;
    return base;
  }

  const inferred = inferWitnessAlignment({ sectionId, segment, witness });
  diagnostics.push(...inferred.diagnostics);
  // Inference is never silent: a machine-guessed alignment must be human-
  // verified before it can back a registered chant. Once reviewed, author the
  // arrays so the witness uses 'preserve' mode and this warning disappears.
  diagnostics.push({
    level: 'warn',
    code: 'liturgy_generator.inferred_alignment_unreviewed',
    stage: 'alignment',
    sectionId,
    segmentId: segment.id,
    witnessBy: witness.by,
    path: `witnesses.${witness.by}.alignTo`,
    message: `materializeWitness: alignment for "${witness.by}" in segment "${segment.id}" was machine-inferred and must be human-verified before registration. To accept it, author the reviewed arrays (alignmentMode "preserve").`,
  });
  stats.inferredAlignments++;
  stats.unmappedTokens += inferred.unmappedTokenCount;
  stats.inferredMorphemeAlignments += inferred.morphemeMatchCount;

  return {
    ...base,
    alignTo: inferred.alignTo,
    morphemeAlignTo: inferred.morphemeAlignTo,
  };
}

function materializeTripleScriptSection(
  section: LiturgyGeneratorTripleScriptSectionInput,
  diagnostics: LiturgyGeneratorDiagnostic[],
  stats: LiturgyGeneratorStats
): TripleScriptWitnessSection {
  const segments: TripleScriptWitnessSegment[] = section.segments.map((segment) => {
    const { alignmentHints: _alignmentHints, ...segmentRest } = segment;
    return {
      ...segmentRest,
      witnesses: segment.witnesses.map((witness) =>
        materializeWitness({
          sectionId: section.id,
          segment,
          witness,
          diagnostics,
          stats,
        })
      ),
    };
  });

  return { ...section, segments };
}

function materializeSection(
  section: LiturgyGeneratorSectionInput,
  diagnostics: LiturgyGeneratorDiagnostic[],
  stats: LiturgyGeneratorStats
): LiturgySection {
  if (section.shape === 'triple-script-witness') {
    return materializeTripleScriptSection(section, diagnostics, stats);
  }
  return section;
}

function finalizeStats(
  stats: LiturgyGeneratorStats,
  diagnostics: LiturgyGeneratorDiagnostic[]
): LiturgyGeneratorStats {
  return {
    ...stats,
    warningCount: diagnostics.filter((d) => d.level === 'warn').length,
    errorCount: diagnostics.filter((d) => d.level === 'error').length,
  };
}

export function buildLiturgyDraft(input: LiturgyGeneratorInput): LiturgyGeneratorResult {
  const diagnostics: LiturgyGeneratorDiagnostic[] = [];
  const stats = initialStats();
  const sections = input.sections.map((section) =>
    materializeSection(section, diagnostics, stats)
  );
  const doc: LiturgyDoc = { ...input.doc, sections };
  diagnostics.push(...validateLiturgyDraft(doc));
  const finalStats = finalizeStats(stats, diagnostics);

  return {
    doc,
    exportName: resolveExportName(doc, input.exportName),
    diagnostics,
    stats: finalStats,
  };
}

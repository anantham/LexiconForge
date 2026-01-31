/**
 * suttaStudioPipelineAssembler.ts
 *
 * Assembles benchmark pipeline outputs into a renderable DeepLoomPacket.
 * This allows pipeline output to be viewed in the Sutta Studio UI.
 */

import type {
  AnatomistPass,
  CanonicalSegment,
  DeepLoomPacket,
  LexicographerPass,
  PhaseView,
  SourceRef,
  TypesetterPass,
  WeaverPass,
} from '../types/suttaStudio';
import { rehydratePhase } from './suttaStudioRehydrator';
import { tokenizeEnglish, type EnglishTokenInput } from './suttaStudioTokenizer';
import { validatePacket, attachValidationToPacket } from './suttaStudioPacketValidator';

const log = (message: string, ...args: any[]) =>
  console.log(`[PipelineAssembler] ${message}`, ...args);

export type PipelinePhaseOutput = {
  phaseId: string;
  segments: CanonicalSegment[];
  englishText: string;
  output: {
    anatomist: AnatomistPass | null;
    lexicographer: LexicographerPass | null;
    weaver: WeaverPass | null;
    typesetter: TypesetterPass | null;
  };
  errors: {
    anatomist: string | null;
    lexicographer: string | null;
    weaver: string | null;
    typesetter: string | null;
  };
};

export type AssemblePacketParams = {
  workId: string;
  phases: PipelinePhaseOutput[];
  modelId?: string;
  promptVersion?: string;
};

/**
 * Assemble pipeline phase outputs into a renderable DeepLoomPacket.
 */
export function assemblePipelineToPacket(params: AssemblePacketParams): DeepLoomPacket {
  const { workId, phases, modelId, promptVersion } = params;

  // Collect all canonical segments
  const allSegments: CanonicalSegment[] = [];
  for (const phase of phases) {
    allSegments.push(...phase.segments);
  }

  // Assemble each phase into PhaseView
  const assembledPhases: PhaseView[] = [];
  let successCount = 0;
  let degradedCount = 0;

  for (const phase of phases) {
    const phaseView = assemblePhase(phase);
    assembledPhases.push(phaseView);

    if (phaseView.degraded) {
      degradedCount++;
    } else {
      successCount++;
    }
  }

  log(`Assembled ${phases.length} phases: ${successCount} success, ${degradedCount} degraded`);

  let packet: DeepLoomPacket = {
    packetId: `pipeline-${workId}-${Date.now()}`,
    source: { provider: 'suttacentral', workId },
    canonicalSegments: allSegments,
    phases: assembledPhases,
    citations: [],
    progress: {
      totalPhases: phases.length,
      readyPhases: phases.length,
      state: 'complete',
    },
    renderDefaults: {
      ghostOpacity: 0.3,
      englishVisible: true,
      studyToggleDefault: true,
    },
    compiler: {
      provider: 'openrouter',
      model: modelId || 'pipeline',
      promptVersion: promptVersion || 'benchmark-v1',
      createdAtISO: new Date().toISOString(),
      sourceDigest: `pipeline-${workId}`,
    },
  };

  // Run post-assembly validation
  const validationResult = validatePacket(packet, allSegments);
  if (validationResult.issues.length > 0) {
    log(`Validation: ${validationResult.issues.length} issues found (${validationResult.stats.duplicateSegments} duplicate segments, ${validationResult.stats.duplicateMappings} duplicate mappings)`);
    packet = attachValidationToPacket(packet, validationResult);
  }

  return packet;
}

/**
 * Assemble a single phase from pipeline output into PhaseView.
 */
function assemblePhase(phase: PipelinePhaseOutput): PhaseView {
  const { phaseId, segments, englishText, output, errors } = phase;

  // Build source span from segments
  const sourceSpan: SourceRef[] = segments.map((seg) => seg.ref);

  // Check for critical errors (anatomist is required)
  if (!output.anatomist || errors.anatomist) {
    log(`Phase ${phaseId}: degraded - anatomist error: ${errors.anatomist}`);
    return buildDegradedPhase(phaseId, segments, englishText, errors.anatomist || 'Anatomist failed');
  }

  // Tokenize English text for the weaver
  const englishTokens: EnglishTokenInput[] = tokenizeEnglish(englishText);

  // Use rehydratePhase to assemble
  try {
    const phaseView = rehydratePhase({
      phaseId,
      sourceSpan,
      anatomist: output.anatomist,
      lexicographer: output.lexicographer || buildFallbackLexicographer(output.anatomist),
      weaver: output.weaver || undefined,
      englishTokens: output.weaver ? englishTokens : undefined,
      typesetter: output.typesetter || undefined,
    });

    // Add canonicalSegmentIds
    phaseView.canonicalSegmentIds = segments.map((seg) => seg.ref.segmentId);

    return phaseView;
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    log(`Phase ${phaseId}: degraded - rehydrate error: ${errorMessage}`);
    return buildDegradedPhase(phaseId, segments, englishText, `Rehydration failed: ${errorMessage}`);
  }
}

/**
 * Build a degraded PhaseView when compilation fails.
 */
function buildDegradedPhase(
  phaseId: string,
  segments: CanonicalSegment[],
  englishText: string,
  reason: string
): PhaseView {
  // Extract Pali words from segments
  const paliTexts = segments
    .flatMap((seg) => seg.pali.split(/\s+/).filter(Boolean))
    .map((surface) => ({ surface: stripPunctuation(surface) }));

  // Split English into words
  const englishWords = englishText.split(/\s+/).filter(Boolean);

  return {
    id: phaseId,
    canonicalSegmentIds: segments.map((seg) => seg.ref.segmentId),
    paliWords: paliTexts.map((item, index) => {
      const wordId = `p${index + 1}`;
      return {
        id: wordId,
        segments: [{ id: `${wordId}s1`, text: item.surface, type: 'stem' as const }],
        senses: [],
      };
    }),
    englishStructure: englishWords.map((text, index) => ({
      id: `e${index + 1}`,
      label: text,
      isGhost: true,
      ghostKind: 'interpretive' as const,
    })),
    degraded: true,
    degradedReason: reason,
  };
}

/**
 * Build a fallback lexicographer pass when missing.
 * Creates minimal senses from anatomist words.
 */
function buildFallbackLexicographer(anatomist: AnatomistPass): LexicographerPass {
  return {
    id: anatomist.id,
    senses: anatomist.words.map((word) => ({
      wordId: word.id,
      wordClass: word.wordClass,
      senses: [{ english: word.surface, nuance: 'No translation available' }],
    })),
  };
}

/**
 * Strip punctuation from a Pali word surface form.
 */
function stripPunctuation(text: string): string {
  return text.replace(/[.,;:!?'"()—\-–…""''«»‹›]/g, '').trim();
}

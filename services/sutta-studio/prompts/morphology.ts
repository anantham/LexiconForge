/**
 * Morphology-pass prompt builder.
 *
 * Adds case/number/gender/tense morphology hints to each segment. Runs AFTER
 * the Phase pass and refines the segment morphology data.
 *
 * The Morphology pass receives no V2 amendments — its concern is grammatical
 * tagging, which doesn't intersect with tooltip register, sense metadata, etc.
 */

import type { CanonicalSegment, PhaseView } from '../../../types/suttaStudio';
import {
  SUTTA_STUDIO_BASE_CONTEXT,
  SUTTA_STUDIO_MORPH_CONTEXT,
} from '../../../config/suttaStudioPromptContext';
import { SUTTA_STUDIO_MORPH_EXAMPLE_JSON } from '../../../config/suttaStudioExamples';

export const buildMorphologyPrompt = (
  phaseId: string,
  phaseView: PhaseView,
  segments: CanonicalSegment[],
  retrievalContext?: string
) => {
  const segmentLines = segments.map((seg) =>
    `${seg.ref.segmentId} | pali: ${seg.pali}${seg.baseEnglish ? ` | english: ${seg.baseEnglish}` : ''}`
  );
  const retrievalBlock = retrievalContext
    ? `\nReference context (adjacent segments; use to disambiguate, do not copy):\n${retrievalContext}\n`
    : '';
  const words = phaseView.paliWords
    .map((word) => {
      const text = word.segments.map((s) => s.text).join('');
      return `${word.id} | ${text}`;
    })
    .join('\n');

  return `You are DeepLoomCompiler.\n\n${SUTTA_STUDIO_BASE_CONTEXT}\n\n${SUTTA_STUDIO_MORPH_CONTEXT}\n\nTask: For each word below, return updated segments with morphology hints.\n\nRules:\n- Output JSON ONLY.\n- Return ONLY { "paliWords": [ { "id": "...", "segments": [...] } ] }.\n- Do NOT add senses or englishStructure.\n- Keep segment text in the original order.\n\nEXAMPLE (do NOT copy ids):\n${SUTTA_STUDIO_MORPH_EXAMPLE_JSON}\n\nPhase: ${phaseId}\n${retrievalBlock}\nSegment context:\n${segmentLines.join('\n')}\n\nWords:\n${words}`;
};

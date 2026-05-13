/**
 * Phase-pass prompt builder.
 *
 * The comprehensive pass that assembles a complete PhaseView JSON. Receives
 * the upstream Anatomist + Lexicographer outputs (when available) as READ-ONLY
 * inputs and adds englishStructure, layoutBlocks, and final polish.
 *
 * Receives V2 amendments — the Phase pass is comprehensive, so it gets the
 * full V2 overlay: TOOLTIP_REGISTER, ARROW_EARNING_RULE, SENSE_METADATA,
 * ANCHOR_SELECTION, TRANSLATOR_DEBATE, CROSS_PHASE_AWARENESS.
 */

import type {
  AnatomistPass,
  CanonicalSegment,
  LexicographerPass,
} from '../../../types/suttaStudio';
import {
  SUTTA_STUDIO_BASE_CONTEXT,
  SUTTA_STUDIO_PHASE_CONTEXT,
} from '../../../config/suttaStudioPromptContext';
import { SUTTA_STUDIO_V2_AMENDMENTS } from '../../../config/suttaStudioPromptContextV2';
import { SUTTA_STUDIO_PHASE_EXAMPLE_JSON } from '../../../config/suttaStudioExamples';

export const buildPhasePrompt = (
  phaseId: string,
  segments: CanonicalSegment[],
  studyDefaults: { ghostOpacity: number; englishVisible: boolean; studyToggleDefault: boolean },
  retrievalContext?: string,
  options?: { anatomist?: AnatomistPass; lexicographer?: LexicographerPass; phaseState?: string }
) => {
  const lines = segments.map((seg) =>
    `${seg.ref.segmentId} | pali: ${seg.pali}${seg.baseEnglish ? ` | english: ${seg.baseEnglish}` : ''}`
  );
  const phaseStateBlock = options?.phaseState ? `\n${options.phaseState}\n` : '';
  const anatomistBlock = options?.anatomist
    ? `\nAnatomist output (READ ONLY; do not change ids or segmentation):\n${JSON.stringify(
        options.anatomist,
        null,
        2
      )}\n\nConstraints:\n- Use exactly these word IDs, surfaces, and segment breakdowns.\n- Only add senses, englishStructure, and layoutBlocks.\n`
    : '';
  const lexicographerBlock = options?.lexicographer
    ? `\nLexicographer output (READ ONLY; use these senses exactly):\n${JSON.stringify(
        options.lexicographer,
        null,
        2
      )}\n\nConstraints:\n- Do NOT invent new senses.\n- Apply senses to the matching word IDs.\n`
    : '';
  const retrievalBlock = retrievalContext
    ? `\nReference context (adjacent segments; use to disambiguate, do not copy):\n${retrievalContext}\n`
    : '';

  return `You are DeepLoomCompiler.\n\n${SUTTA_STUDIO_BASE_CONTEXT}\n\n${SUTTA_STUDIO_PHASE_CONTEXT}\n\n${SUTTA_STUDIO_V2_AMENDMENTS}\n${phaseStateBlock}${anatomistBlock}${lexicographerBlock}\nTask: Build a PhaseView JSON for the segment list below.\n\nRules:\n- Output JSON ONLY.\n- Use the exact phase id: ${phaseId}.\n- Create paliWords with segments (type: root|suffix|prefix|stem). If unsure, use a single segment with type "stem".\n- Provide at least 1 sense per word; if possible, give 2-3 senses with short nuance labels.\n- englishStructure should be an ordered token list that maps to pali words (linkedPaliId) and includes ghost tokens for English glue (isGhost true, ghostKind required).\n- Keep it minimal and readable.\n- Avoid markdown or extra commentary.\n\nEXAMPLE (do NOT copy ids):\n${SUTTA_STUDIO_PHASE_EXAMPLE_JSON}\n\nRender defaults for context: ghostOpacity=${studyDefaults.ghostOpacity}, englishVisible=${studyDefaults.englishVisible}, studyToggleDefault=${studyDefaults.studyToggleDefault}.${retrievalBlock}\nSegments:\n${lines.join('\n')}`;
};

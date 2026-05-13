/**
 * Anatomist-pass prompt builder.
 *
 * Decomposes each Pali surface form into morpheme segments and assigns word
 * classes + tooltip hints. The first semantic pass.
 *
 * Receives V2 amendments — Anatomist sets `relations`, `tooltips`, and the
 * `isAnchor` field, all three of which the V2 amendments directly govern
 * (ARROW_EARNING_RULE, TOOLTIP_REGISTER, ANCHOR_SELECTION).
 *
 * Carries three worked examples (post-consolidation): the basic phase-a
 * opening formula, phase-b's morph-data-on-suffixes pattern, and the refrain
 * formula with `refrainId`. Production previously had only the first.
 */

import type { CanonicalSegment } from '../../../types/suttaStudio';
import {
  SUTTA_STUDIO_BASE_CONTEXT,
  SUTTA_STUDIO_ANATOMIST_CONTEXT,
} from '../../../config/suttaStudioPromptContext';
import { SUTTA_STUDIO_V2_AMENDMENTS } from '../../../config/suttaStudioPromptContextV2';
import {
  SUTTA_STUDIO_ANATOMIST_EXAMPLE_JSON,
  SUTTA_STUDIO_ANATOMIST_EXAMPLE_B_JSON,
  SUTTA_STUDIO_ANATOMIST_EXAMPLE_REFRAIN_JSON,
} from '../../../config/suttaStudioExamples';

export const buildAnatomistPrompt = (
  phaseId: string,
  segments: CanonicalSegment[],
  phaseState: string,
  retrievalContext?: string
) => {
  const lines = segments.map((seg) =>
    `${seg.ref.segmentId} | pali: ${seg.pali}${seg.baseEnglish ? ` | english: ${seg.baseEnglish}` : ''}`
  );
  const retrievalBlock = retrievalContext
    ? `\nReference context (adjacent segments; use to disambiguate, do not copy):\n${retrievalContext}\n`
    : '';

  const paliText = segments.map((seg) => seg.pali).join(' ');
  const approxWordCount = paliText.split(/\s+/).filter(Boolean).length;

  return `You are DeepLoomCompiler.\n\n${SUTTA_STUDIO_BASE_CONTEXT}\n\n${SUTTA_STUDIO_ANATOMIST_CONTEXT}\n\n${SUTTA_STUDIO_V2_AMENDMENTS}\n\n${phaseState}\n\nTask: Build the Anatomist JSON for the segment list below.\n\nCRITICAL WORD BOUNDARY RULE:\n- Each SPACE-SEPARATED Pali token = ONE word entry.\n- Example: "Evaṁ me sutaṁ" has 3 words: p1="Evaṁ", p2="me", p3="sutaṁ"\n- NEVER combine multiple space-separated tokens into one word.\n- Expected word count for this input: approximately ${approxWordCount} words.\n\nRules:\n- Output JSON ONLY.\n- Use the exact phase id: ${phaseId}.\n- Create word IDs p1, p2, ... in surface order (one per space-separated token).\n- Create segment IDs as <wordId>s1, <wordId>s2, ... and list them in word.segmentIds in order.\n- Ensure concatenation of segment texts equals word.surface exactly.\n- Do NOT add English senses or tokens.\n- REQUIRED: For each segment, add tooltips array with 1-3 short etymology/function hints:\n  - For roots: "√root: meaning" (e.g., "√bhikkh: To share / beg")\n  - For suffixes: "Function: description" (e.g., "Function: Marks the Group/Owner")\n  - For prefixes: "Prefix meaning" (e.g., "vi-: Intensive / Apart")\n  - For stems: "Word: meaning" (e.g., "Evaṁ: Thus / In this way")\n\nReturn JSON ONLY with this shape:\n{\n  "id": "phase-1",\n  "words": [\n    { "id": "p1", "surface": "Evaṁ", "wordClass": "function", "segmentIds": ["p1s1"] }\n  ],\n  "segments": [\n    { "id": "p1s1", "wordId": "p1", "text": "Evaṁ", "type": "stem", "tooltips": ["Evaṁ: Thus / In this way"] }\n  ],\n  "relations": [\n    { "id": "r1", "fromSegmentId": "p2s1", "targetWordId": "p3", "type": "action", "label": "Agent", "status": "confirmed" }\n  ],\n  "handoff": { "confidence": "medium", "segmentationIssues": [], "notes": "" }\n}\n\n\nEXAMPLE 1 - Opening formula (phase-a):\n${SUTTA_STUDIO_ANATOMIST_EXAMPLE_JSON}\n\nEXAMPLE 2 - With morph data on suffixes (phase-b):\n${SUTTA_STUDIO_ANATOMIST_EXAMPLE_B_JSON}\n\nEXAMPLE 3 - Refrain formula with refrainId (phase-aa):\n${SUTTA_STUDIO_ANATOMIST_EXAMPLE_REFRAIN_JSON}\n${retrievalBlock}\nSegments:\n${lines.join('\n')}`;
};

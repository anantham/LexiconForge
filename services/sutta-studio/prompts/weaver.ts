/**
 * Weaver-pass prompt builder.
 *
 * Maps English tokens to Pali word IDs — the alignment layer that powers
 * cross-language highlighting in the reader.
 *
 * The Weaver pass receives no V2 amendments — its concern is token mapping,
 * which doesn't intersect with tooltip register, sense metadata, anchor
 * selection, or relations.
 *
 * Includes the duplicate-mapping anti-pattern guard (from benchmark prompts;
 * the production builder previously lacked this).
 */

import type {
  AnatomistPass,
  CanonicalSegment,
  LexicographerPass,
} from '../../../types/suttaStudio';
import {
  SUTTA_STUDIO_BASE_CONTEXT,
  SUTTA_STUDIO_WEAVER_CONTEXT,
} from '../../../config/suttaStudioPromptContext';
import {
  SUTTA_STUDIO_WEAVER_EXAMPLE_JSON,
  SUTTA_STUDIO_WEAVER_ANTI_PATTERN,
} from '../../../config/suttaStudioExamples';
import { buildTokenListForPrompt, type EnglishTokenInput } from '../../suttaStudioTokenizer';

export const buildWeaverPrompt = (
  phaseId: string,
  segments: CanonicalSegment[],
  phaseState: string,
  anatomist: AnatomistPass,
  lexicographer: LexicographerPass,
  englishTokens: EnglishTokenInput[]
) => {
  const segmentTextMap = new Map(anatomist.segments.map((s) => [s.id, s.text]));
  const sensesMap = new Map(lexicographer.senses.map((e) => [e.wordId, e.senses]));
  const wordsList = anatomist.words
    .map((word) => {
      const senses = sensesMap.get(word.id) || [];
      const sensesStr = senses.map((s) => s.english).join(' / ') || '(no senses)';
      const segmentsStr = word.segmentIds
        .map((id) => `${id}="${segmentTextMap.get(id) || '?'}"`)
        .join(', ');
      const hasMultipleSegments = word.segmentIds.length > 1;
      const compoundMarker = hasMultipleSegments ? ' [COMPOUND]' : '';
      return `${word.id} | ${word.surface}${compoundMarker} | segments: ${segmentsStr} | senses: ${sensesStr}`;
    })
    .join('\n');

  const tokenList = buildTokenListForPrompt(englishTokens);

  const englishText = segments
    .map((seg) => seg.baseEnglish || '')
    .filter(Boolean)
    .join(' ');

  return `You are DeepLoomCompiler.\n\n${SUTTA_STUDIO_BASE_CONTEXT}\n\n${SUTTA_STUDIO_WEAVER_CONTEXT}\n\n${phaseState}\n\nTask: Map the English tokens below to Pali word IDs.\n\nRules:\n- Output JSON ONLY.\n- Use the exact phase id: ${phaseId}.\n- For each word token (not whitespace/punctuation), provide a mapping.\n- If a token maps to a Pali word, set linkedPaliId and isGhost: false.\n- If a token is English scaffolding (articles, verb helpers, prepositions), set isGhost: true and ghostKind.\n- Do NOT reword or change the token text.\n\nCRITICAL - NO DUPLICATE MAPPINGS:\n- Each Pali segment can be linked by AT MOST ONE English token.\n- If multiple English words express one Pali segment, choose the PRIMARY meaning.\n- Duplicate mappings cause rendering bugs like "marketplace marketplace".\n\nReturn JSON ONLY with this shape:\n{\n  "id": "phase-1",\n  "tokens": [\n    { "tokenIndex": 0, "text": "Thus", "linkedPaliId": "p1", "isGhost": false },\n    { "tokenIndex": 2, "text": "have", "isGhost": true, "ghostKind": "required" }\n  ],\n  "handoff": { "confidence": "high", "notes": "" }\n}\n\nEXAMPLE (do NOT copy):\n${SUTTA_STUDIO_WEAVER_EXAMPLE_JSON}\n\nANTI-PATTERN (what NOT to do):\n${SUTTA_STUDIO_WEAVER_ANTI_PATTERN}\n\nEnglish sentence: "${englishText}"\n\nTokenized English (index:text):\n${tokenList}\n\nPali words (id | surface | senses):\n${wordsList}`;
};

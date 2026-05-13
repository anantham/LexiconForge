/**
 * Typesetter-pass prompt builder.
 *
 * Arranges Pali words into layout blocks (rows) for visual rendering. Each block
 * holds up to 5 words; words from the same canonical segment stay together.
 *
 * The Typesetter pass receives no V2 amendments — its concern is visual layout,
 * which doesn't intersect with the protocol learnings.
 *
 * Includes the optional `logger` injection (from benchmark prompts; the
 * production builder previously called an inline `log` unconditionally,
 * spamming consoles for every Typesetter invocation).
 */

import type {
  AnatomistPass,
  CanonicalSegment,
  WeaverPass,
} from '../../../types/suttaStudio';
import {
  SUTTA_STUDIO_BASE_CONTEXT,
  SUTTA_STUDIO_TYPESETTER_CONTEXT,
} from '../../../config/suttaStudioPromptContext';
import { SUTTA_STUDIO_TYPESETTER_EXAMPLE_JSON } from '../../../config/suttaStudioExamples';

export const buildTypesetterPrompt = (
  phaseId: string,
  phaseState: string,
  anatomist: AnatomistPass,
  weaver: WeaverPass,
  canonicalSegments?: CanonicalSegment[],
  logger?: (message: string) => void
) => {
  const wordsList = anatomist.words
    .map((word) => {
      const relations = (anatomist.relations || [])
        .filter((r) => anatomist.segments.some((s) => s.wordId === word.id && s.id === r.fromSegmentId))
        .map((r) => `→${r.targetWordId} (${r.type})`)
        .join(', ');
      return `${word.id} | ${word.surface}${relations ? ` | relations: ${relations}` : ''}`;
    })
    .join('\n');

  const englishTokensWithLinks = weaver.tokens.filter((t) => !t.isGhost && (t.linkedPaliId || t.linkedSegmentId));
  const englishOrder = englishTokensWithLinks
    .map((t) => {
      if (t.linkedPaliId) return t.linkedPaliId;
      const parentWord = anatomist.words.find((w) =>
        anatomist.segments.some((s) => s.wordId === w.id && s.id === t.linkedSegmentId)
      );
      return parentWord?.id ?? t.linkedSegmentId;
    })
    .join(' → ');

  const segmentInfo = canonicalSegments?.map((seg) =>
    `${seg.ref.segmentId}: "${seg.pali.trim()}"`
  ).join('\n') || '';

  if (logger) {
    logger(`[Typesetter] Building prompt for ${phaseId}`);
    logger(`[Typesetter] Words: ${anatomist.words.map((w) => `${w.id}=${w.surface}`).join(', ')}`);
    logger(`[Typesetter] Weaver tokens (linked): ${englishTokensWithLinks.map((t) => `"${t.text}"→${t.linkedPaliId || t.linkedSegmentId}`).join(', ')}`);
    logger(`[Typesetter] English order: ${englishOrder}`);
    logger(`[Typesetter] Canonical segments: ${canonicalSegments?.length ?? 0}`);
  }

  return `You are DeepLoomCompiler.\n\n${SUTTA_STUDIO_BASE_CONTEXT}\n\n${SUTTA_STUDIO_TYPESETTER_CONTEXT}\n\n${phaseState}\n\nTask: Arrange the Pali words into layout blocks.\n\nRules:\n- Output JSON ONLY.\n- Use the exact phase id: ${phaseId}.\n- Each block should have at most 5 word IDs.\n- IMPORTANT: Words from the same canonical segment should be kept in the SAME block.\n- Order blocks to minimize crossing lines between related words.\n- Consider the English token order as a guide for reading flow.\n- If words are related (e.g., genitive modifier + head noun), keep them in the same or adjacent blocks.\n\nCanonical segments (words from same segment should be in same block):\n${segmentInfo || '(not available)'}\n\nReturn JSON ONLY with this shape:\n{\n  "id": "phase-1",\n  "layoutBlocks": [["p1", "p2"], ["p3", "p4", "p5"]],\n  "handoff": { "confidence": "high", "notes": "" }\n}\n\nEXAMPLE (do NOT copy):\n${SUTTA_STUDIO_TYPESETTER_EXAMPLE_JSON}\n\nPali words (id | surface | relations):\n${wordsList}\n\nEnglish reading order (Pali IDs):\n${englishOrder || '(no mapping available)'}`;
};

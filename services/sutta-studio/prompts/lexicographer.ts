/**
 * Lexicographer-pass prompt builder.
 *
 * Generates senses for each Pali word, grounded in dictionary attestations
 * (DPD when available; SuttaCentral lookups as fallback). Carries the
 * "ripples" feature that lets a chosen sense override surrounding English
 * ghost tokens.
 *
 * Receives V2 amendments — the Lexicographer sets the `senses` field and the
 * metadata that decorates it (epistemicBasis, sourceCitationIds, confidence,
 * notes). The TRANSLATOR_DEBATE amendment also applies here.
 *
 * Consolidation note: this merges the production lexicographer (DPD support
 * via `dpdLookups` param + structured renderDpdBlock) with the benchmark
 * lexicographer (RIPPLES instruction block + ripple example). Both lineages
 * needed; this is now the single source of truth.
 */

import type { AnatomistPass, CanonicalSegment } from '../../../types/suttaStudio';
import type { LexiconEntry } from '../../providers/types';
import {
  SUTTA_STUDIO_BASE_CONTEXT,
  SUTTA_STUDIO_LEXICO_CONTEXT,
} from '../../../config/suttaStudioPromptContext';
import { SUTTA_STUDIO_V2_AMENDMENTS } from '../../../config/suttaStudioPromptContextV2';
import {
  SUTTA_STUDIO_LEXICO_EXAMPLE_JSON,
  SUTTA_STUDIO_LEXICO_RIPPLE_EXAMPLE_JSON,
} from '../../../config/suttaStudioExamples';

/**
 * Render a structured block summarising DPD attestations per word. Each
 * entry includes the deterministic citationId so the LLM can reference it
 * back in Sense.sourceCitationIds.
 */
const renderDpdBlock = (dpdLookups: Record<string, LexiconEntry[]>): string => {
  const lines: string[] = [];
  for (const [wordId, entries] of Object.entries(dpdLookups)) {
    if (!entries || entries.length === 0) continue;
    lines.push(`- ${wordId}:`);
    // Cap at 5 entries per word to keep the prompt bounded for compound-heavy phases.
    for (const e of entries.slice(0, 5)) {
      const sense = e.senses?.[0]?.english ?? '(no sense)';
      const pos = e.partOfSpeech ? ` [${e.partOfSpeech}]` : '';
      const morph = e.morphology ? ` ${JSON.stringify(e.morphology)}` : '';
      const cid = e.citationId ? ` cite=${e.citationId}` : '';
      lines.push(`    • ${e.lemma}${pos}: ${sense}${morph}${cid}`);
    }
  }
  return lines.join('\n');
};

export const buildLexicographerPrompt = (
  phaseId: string,
  segments: CanonicalSegment[],
  phaseState: string,
  anatomist: AnatomistPass,
  dictionaryEntries: Record<string, unknown | null>,
  retrievalContext?: string,
  /**
   * Optional DPD attestations per wordId, sourced from the provider registry
   * (ADR SUTTA-008). When present, rendered as a structured block alongside
   * the raw SC dictionary entries. Old callers that don't pass this still
   * get exactly the prior prompt.
   */
  dpdLookups?: Record<string, LexiconEntry[]>,
) => {
  const segmentLines = segments.map((seg) =>
    `${seg.ref.segmentId} | pali: ${seg.pali}${seg.baseEnglish ? ` | english: ${seg.baseEnglish}` : ''}`
  );
  const retrievalBlock = retrievalContext
    ? `\nReference context (adjacent segments; use to disambiguate, do not copy):\n${retrievalContext}\n`
    : '';
  const wordsList = anatomist.words
    .map((word) => {
      const wordSegments = word.segmentIds
        .map((id) => `${id}=${anatomist.segments.find((seg) => seg.id === id)?.text ?? ''}`)
        .join(' · ');
      return `${word.id} | ${word.surface} | ${word.wordClass} | segments: ${wordSegments}`;
    })
    .join('\n');
  const dictionaryBlock = Object.entries(dictionaryEntries)
    .map(([wordId, entry]) => `- ${wordId}: ${JSON.stringify(entry)}`)
    .join('\n');
  const dpdBlock = dpdLookups ? renderDpdBlock(dpdLookups) : '';
  const dpdSection = dpdBlock
    ? `\n\nDPD attestations (Digital Pāli Dictionary, structured; prefer these for morphology and citations):\n${dpdBlock}`
    : '';

  return `You are DeepLoomCompiler.\n\n${SUTTA_STUDIO_BASE_CONTEXT}\n\n${SUTTA_STUDIO_LEXICO_CONTEXT}\n\n${SUTTA_STUDIO_V2_AMENDMENTS}\n\n${phaseState}\n\nTask: Build the Lexicographer JSON for the words below.\n\nRules:\n- Output JSON ONLY.\n- Use the exact phase id: ${phaseId}.\n- Provide senses for every wordId listed.\n- Content words must have exactly 3 senses. Function words must have 1-2 senses.\n- If dictionary data is present, use it to ground meanings; do not invent etymology.\n- SEGMENT SENSES for transparent multi-part words: when a word's parts carry independent meaning (compound members like rāja+putta; meaningful prefixes like an-, vi-, sam-), ALSO provide a segmentSenses entry per meaningful part (segment ids are given in the Words list) — 1-2 senses each, one word or a very short phrase, chosen so the part-glosses read in sequence as a natural unpacking of the whole word. This powers morpheme-level hover in the reader.\n- NEVER give segmentSenses to pure inflectional endings (case/number/person endings) or to words that do not decompose meaningfully — omit segmentSenses for those words entirely; word-level senses remain required for EVERY word regardless.\n\nRIPPLES - CRITICAL for grammatical English:\n- When a sense changes verb tense or requires different articles, use ripples to adjust ghost words.\n- Ripple format: { "english": "dwells", "nuance": "...", "ripples": { "e10": "" } }\n- The ripple key is the English token ID; the value is the replacement text (empty string to remove).\n- Example: if ghost "was" (e10) precedes verb, and sense is present tense "dwells", add ripples: { "e10": "" } to remove "was".\n- Example: if sense needs "a" instead of "the", add ripples: { "ghost_article": "a" }.\n\nReturn JSON ONLY with this shape:\n{\n  "id": "phase-1",\n  "senses": [\n    {\n      "wordId": "p1",\n      "wordClass": "function",\n      "senses": [\n        { "english": "Thus", "nuance": "narrative opener" }\n      ]\n    }\n  ],\n  "segmentSenses": [\n    { "segmentId": "p2s1", "senses": [ { "english": "king", "nuance": "rāja - ruler" } ] },\n    { "segmentId": "p2s2", "senses": [ { "english": "son", "nuance": "putta - son; prince when compounded" } ] }\n  ],\n  "handoff": { "confidence": "medium", "missingDefinitions": [], "notes": "" }\n}\n\nEXAMPLE 1 - Basic senses (do NOT copy ids):\n${SUTTA_STUDIO_LEXICO_EXAMPLE_JSON}\n\nEXAMPLE 2 - Ripples for verb tense and articles:\n${SUTTA_STUDIO_LEXICO_RIPPLE_EXAMPLE_JSON}\n\nWords:\n${wordsList}\n\nDictionary entries (raw; do not copy verbatim):\n${dictionaryBlock || '(none)'}${dpdSection}\n${retrievalBlock}\nSegment context:\n${segmentLines.join('\n')}`;
};

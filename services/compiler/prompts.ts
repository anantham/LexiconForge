import type {
  AnatomistPass,
  CanonicalSegment,
  LexicographerPass,
  PhaseView,
  WeaverPass,
} from '../../types/suttaStudio';
import {
  SUTTA_STUDIO_ANATOMIST_EXAMPLE_JSON,
  SUTTA_STUDIO_LEXICO_EXAMPLE_JSON,
  SUTTA_STUDIO_PHASE_EXAMPLE_JSON,
  SUTTA_STUDIO_SKELETON_EXAMPLE_JSON,
  SUTTA_STUDIO_MORPH_EXAMPLE_JSON,
  SUTTA_STUDIO_WEAVER_EXAMPLE_JSON,
  SUTTA_STUDIO_TYPESETTER_EXAMPLE_JSON,
} from '../../config/suttaStudioExamples';
import {
  SUTTA_STUDIO_BASE_CONTEXT,
  SUTTA_STUDIO_ANATOMIST_CONTEXT,
  SUTTA_STUDIO_LEXICO_CONTEXT,
  SUTTA_STUDIO_PHASE_CONTEXT,
  SUTTA_STUDIO_SKELETON_CONTEXT,
  SUTTA_STUDIO_MORPH_CONTEXT,
  SUTTA_STUDIO_WEAVER_CONTEXT,
  SUTTA_STUDIO_TYPESETTER_CONTEXT,
} from '../../config/suttaStudioPromptContext';
import { buildTokenListForPrompt, type EnglishTokenInput } from '../suttaStudioTokenizer';
import { buildBoundaryContext, buildPhaseStateEnvelope, type BoundaryNote } from './utils';

const log = (message: string, ...args: any[]) =>
  console.log(`[SuttaStudioCompiler] ${message}`, ...args);

export const buildSkeletonPrompt = (
  segments: CanonicalSegment[],
  options: { exampleSegmentId?: string; boundaries?: BoundaryNote[]; allowCrossChapter?: boolean }
) => {
  const lines = segments.map((seg) => {
    const english = seg.baseEnglish ? ` | english: ${seg.baseEnglish}` : '';
    return `${seg.ref.segmentId} | pali: ${seg.pali}${english}`;
  });
  const exampleSegment = options.exampleSegmentId || segments[0]?.ref.segmentId || 'mn1:1.1';
  const examplePrefix = exampleSegment.split(':')[0] || 'mn1';
  const boundaryContext = options.boundaries
    ? buildBoundaryContext(options.boundaries, Boolean(options.allowCrossChapter))
    : '';

  return `You are DeepLoomCompiler.\n\n${SUTTA_STUDIO_BASE_CONTEXT}\n\n${SUTTA_STUDIO_SKELETON_CONTEXT}\n${boundaryContext}\nTask: Group the following SuttaCentral segments into SMALL study phases.\n\nCRITICAL RULES:\n- MAXIMUM 8 Pali words per phase (count space-separated tokens).\n- Typical phase: 1-3 segments only.\n- Title/header segments get their own phase.\n- Opening formulas get their own phase.\n- Each segment must appear exactly once.\n- Keep the original order.\n\nReturn JSON ONLY with this shape:\n{\n  "phases": [\n    { "id": "phase-1", "title": "<short title or empty>", "segmentIds": ["${examplePrefix}:1.1", "${examplePrefix}:1.2"] }\n  ]\n}\n\nEXAMPLE (do NOT copy ids):\n${SUTTA_STUDIO_SKELETON_EXAMPLE_JSON}\n\nSegments:\n${lines.join('\n')}`;
};

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

  return `You are DeepLoomCompiler.

${SUTTA_STUDIO_BASE_CONTEXT}

${SUTTA_STUDIO_ANATOMIST_CONTEXT}

${phaseState}

Task: Build the Anatomist JSON for the segment list below.

CRITICAL WORD BOUNDARY RULE:
- Each SPACE-SEPARATED Pali token = ONE word entry.
- Example: "Evaṁ me sutaṁ" has 3 words: p1="Evaṁ", p2="me", p3="sutaṁ"
- NEVER combine multiple space-separated tokens into one word.
- Expected word count for this input: approximately ${approxWordCount} words.

Rules:
- Output JSON ONLY.
- Use the exact phase id: ${phaseId}.
- Create word IDs p1, p2, ... in surface order (one per space-separated token).
- Create segment IDs as <wordId>s1, <wordId>s2, ... and list them in word.segmentIds in order.
- Ensure concatenation of segment texts equals word.surface exactly.
- Do NOT add English senses or tokens.
- REQUIRED: For each segment, add tooltips array with 1-3 short etymology/function hints:
  - For roots: "√root: meaning" (e.g., "√bhikkh: To share / beg")
  - For suffixes: "Function: description" (e.g., "Function: Marks the Group/Owner")
  - For prefixes: "Prefix meaning" (e.g., "vi-: Intensive / Apart")
  - For stems: "Word: meaning" (e.g., "Evaṁ: Thus / In this way")

Return JSON ONLY with this shape:
{
  "id": "phase-1",
  "words": [
    { "id": "p1", "surface": "Evaṁ", "wordClass": "function", "segmentIds": ["p1s1"] }
  ],
  "segments": [
    { "id": "p1s1", "wordId": "p1", "text": "Evaṁ", "type": "stem", "tooltips": ["Evaṁ: Thus / In this way"] }
  ],
  "relations": [
    { "id": "r1", "fromSegmentId": "p2s1", "targetWordId": "p3", "type": "action", "label": "Agent", "status": "confirmed" }
  ],
  "handoff": { "confidence": "medium", "segmentationIssues": [], "notes": "" }
}

EXAMPLE (do NOT copy ids):
${SUTTA_STUDIO_ANATOMIST_EXAMPLE_JSON}
${retrievalBlock}
Segments:
${lines.join('\n')}`;
};

export const buildLexicographerPrompt = (
  phaseId: string,
  segments: CanonicalSegment[],
  phaseState: string,
  anatomist: AnatomistPass,
  dictionaryEntries: Record<string, unknown | null>,
  retrievalContext?: string
) => {
  const segmentLines = segments.map((seg) =>
    `${seg.ref.segmentId} | pali: ${seg.pali}${seg.baseEnglish ? ` | english: ${seg.baseEnglish}` : ''}`
  );
  const retrievalBlock = retrievalContext
    ? `\nReference context (adjacent segments; use to disambiguate, do not copy):\n${retrievalContext}\n`
    : '';
  const wordsList = anatomist.words
    .map((word) => {
      const segments = word.segmentIds
        .map((id) => anatomist.segments.find((seg) => seg.id === id)?.text ?? '')
        .join('');
      return `${word.id} | ${word.surface} | ${word.wordClass} | segments: ${segments}`;
    })
    .join('\n');
  const dictionaryBlock = Object.entries(dictionaryEntries)
    .map(([wordId, entry]) => `- ${wordId}: ${JSON.stringify(entry)}`)
    .join('\n');

  return `You are DeepLoomCompiler.\n\n${SUTTA_STUDIO_BASE_CONTEXT}\n\n${SUTTA_STUDIO_LEXICO_CONTEXT}\n\n${phaseState}\n\nTask: Build the Lexicographer JSON for the words below.\n\nRules:\n- Output JSON ONLY.\n- Use the exact phase id: ${phaseId}.\n- Provide senses for every wordId listed.\n- Content words must have exactly 3 senses. Function words must have 1-2 senses.\n- If dictionary data is present, use it to ground meanings; do not invent etymology.\n\nReturn JSON ONLY with this shape:\n{\n  "id": "phase-1",\n  "senses": [\n    {\n      "wordId": "p1",\n      "wordClass": "function",\n      "senses": [\n        { "english": "Thus", "nuance": "narrative opener" }\n      ]\n    }\n  ],\n  "handoff": { "confidence": "medium", "missingDefinitions": [], "notes": "" }\n}\n\nEXAMPLE (do NOT copy ids):\n${SUTTA_STUDIO_LEXICO_EXAMPLE_JSON}\n\nWords:\n${wordsList}\n\nDictionary entries (raw; do not copy verbatim):\n${dictionaryBlock || '(none)'}\n${retrievalBlock}\nSegment context:\n${segmentLines.join('\n')}`;
};

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

  return `You are DeepLoomCompiler.

${SUTTA_STUDIO_BASE_CONTEXT}

${SUTTA_STUDIO_WEAVER_CONTEXT}

${phaseState}

Task: Map the English tokens below to Pali word IDs.

Rules:
- Output JSON ONLY.
- Use the exact phase id: ${phaseId}.
- For each word token (not whitespace/punctuation), provide a mapping.
- If a token maps to a Pali word, set linkedPaliId and isGhost: false.
- If a token is English scaffolding (articles, verb helpers, prepositions), set isGhost: true and ghostKind.
- Do NOT reword or change the token text.

Return JSON ONLY with this shape:
{
  "id": "phase-1",
  "tokens": [
    { "tokenIndex": 0, "text": "Thus", "linkedPaliId": "p1", "isGhost": false },
    { "tokenIndex": 2, "text": "have", "isGhost": true, "ghostKind": "required" }
  ],
  "handoff": { "confidence": "high", "notes": "" }
}

EXAMPLE (do NOT copy):
${SUTTA_STUDIO_WEAVER_EXAMPLE_JSON}

English sentence: "${englishText}"

Tokenized English (index:text):
${tokenList}

Pali words (id | surface | senses):
${wordsList}`;
};

export const buildTypesetterPrompt = (
  phaseId: string,
  phaseState: string,
  anatomist: AnatomistPass,
  weaver: WeaverPass,
  canonicalSegments?: CanonicalSegment[]
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

  log(`[Typesetter] Building prompt for ${phaseId}`);
  log(`[Typesetter] Words: ${anatomist.words.map((w) => `${w.id}=${w.surface}`).join(', ')}`);
  log(`[Typesetter] Weaver tokens (linked): ${englishTokensWithLinks.map((t) => `"${t.text}"→${t.linkedPaliId || t.linkedSegmentId}`).join(', ')}`);
  log(`[Typesetter] English order: ${englishOrder}`);
  log(`[Typesetter] Canonical segments: ${canonicalSegments?.length ?? 0}`);

  return `You are DeepLoomCompiler.

${SUTTA_STUDIO_BASE_CONTEXT}

${SUTTA_STUDIO_TYPESETTER_CONTEXT}

${phaseState}

Task: Arrange the Pali words into layout blocks.

Rules:
- Output JSON ONLY.
- Use the exact phase id: ${phaseId}.
- Each block should have at most 5 word IDs.
- IMPORTANT: Words from the same canonical segment should be kept in the SAME block.
- Order blocks to minimize crossing lines between related words.
- Consider the English token order as a guide for reading flow.
- If words are related (e.g., genitive modifier + head noun), keep them in the same or adjacent blocks.

Canonical segments (words from same segment should be in same block):
${segmentInfo || '(not available)'}

Return JSON ONLY with this shape:
{
  "id": "phase-1",
  "layoutBlocks": [["p1", "p2"], ["p3", "p4", "p5"]],
  "handoff": { "confidence": "high", "notes": "" }
}

EXAMPLE (do NOT copy):
${SUTTA_STUDIO_TYPESETTER_EXAMPLE_JSON}

Pali words (id | surface | relations):
${wordsList}

English reading order (Pali IDs):
${englishOrder || '(no mapping available)'}`;
};

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

  return `You are DeepLoomCompiler.\n\n${SUTTA_STUDIO_BASE_CONTEXT}\n\n${SUTTA_STUDIO_PHASE_CONTEXT}\n${phaseStateBlock}${anatomistBlock}${lexicographerBlock}\nTask: Build a PhaseView JSON for the segment list below.\n\nRules:\n- Output JSON ONLY.\n- Use the exact phase id: ${phaseId}.\n- Create paliWords with segments (type: root|suffix|prefix|stem). If unsure, use a single segment with type "stem".\n- Provide at least 1 sense per word; if possible, give 2-3 senses with short nuance labels.\n- englishStructure should be an ordered token list that maps to pali words (linkedPaliId) and includes ghost tokens for English glue (isGhost true, ghostKind required).\n- Keep it minimal and readable.\n- Avoid markdown or extra commentary.\n\nEXAMPLE (do NOT copy ids):\n${SUTTA_STUDIO_PHASE_EXAMPLE_JSON}\n\nRender defaults for context: ghostOpacity=${studyDefaults.ghostOpacity}, englishVisible=${studyDefaults.englishVisible}, studyToggleDefault=${studyDefaults.studyToggleDefault}.${retrievalBlock}\nSegments:\n${lines.join('\n')}`;
};

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

export const buildPhaseStateEnvelopeForPhase = buildPhaseStateEnvelope;

import { extractBalancedJson } from './ai/textUtils';
import type {
  AnatomistPass,
  CanonicalSegment,
  LexicographerPass,
  PhaseView,
  WeaverPass,
  TypesetterPass,
} from '../types/suttaStudio';
import {
  SUTTA_STUDIO_BASE_CONTEXT,
  SUTTA_STUDIO_ANATOMIST_CONTEXT,
  SUTTA_STUDIO_LEXICO_CONTEXT,
  SUTTA_STUDIO_MORPH_CONTEXT,
  SUTTA_STUDIO_PHASE_CONTEXT,
  SUTTA_STUDIO_SKELETON_CONTEXT,
  SUTTA_STUDIO_TYPESETTER_CONTEXT,
  SUTTA_STUDIO_WEAVER_CONTEXT,
} from '../config/suttaStudioPromptContext';
import {
  SUTTA_STUDIO_ANATOMIST_EXAMPLE_JSON,
  SUTTA_STUDIO_LEXICO_EXAMPLE_JSON,
  SUTTA_STUDIO_MORPH_EXAMPLE_JSON,
  SUTTA_STUDIO_PHASE_EXAMPLE_JSON,
  SUTTA_STUDIO_SKELETON_EXAMPLE_JSON,
  SUTTA_STUDIO_TYPESETTER_EXAMPLE_JSON,
  SUTTA_STUDIO_WEAVER_EXAMPLE_JSON,
} from '../config/suttaStudioExamples';
import { buildTokenListForPrompt, type EnglishTokenInput } from './suttaStudioTokenizer';

export type PhaseStageKey = 'anatomist' | 'lexicographer' | 'weaver' | 'typesetter';

export type BoundaryNote = {
  workId: string;
  startSegmentId: string;
  afterSegmentId?: string;
};

export type SkeletonPhase = {
  id: string;
  title?: string;
  segmentIds: string[];
  wordRange?: [number, number]; // [start, end) indices into Pali words for sub-segment splitting
};

export const skeletonResponseSchema = {
  type: 'object',
  properties: {
    phases: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          segmentIds: {
            type: 'array',
            items: { type: 'string' },
          },
          wordRange: {
            type: 'array',
            items: { type: 'number' },
            minItems: 2,
            maxItems: 2,
            description: '[start, end) indices into Pali words for sub-segment splitting',
          },
        },
        required: ['id', 'segmentIds'],
        additionalProperties: false,
      },
    },
  },
  required: ['phases'],
  additionalProperties: false,
};

export const anatomistResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    words: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          surface: { type: 'string' },
          wordClass: { type: 'string', enum: ['content', 'function'] },
          segmentIds: { type: 'array', items: { type: 'string' } },
          isAnchor: { type: 'boolean' },
          refrainId: { type: 'string' },
        },
        required: ['id', 'surface', 'wordClass', 'segmentIds'],
        additionalProperties: false,
      },
    },
    segments: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          wordId: { type: 'string' },
          text: { type: 'string' },
          type: { type: 'string', enum: ['root', 'suffix', 'prefix', 'stem'] },
          tooltips: { type: 'array', items: { type: 'string' } },
          morph: {
            type: 'object',
            properties: {
              case: { type: 'string', enum: ['gen', 'dat', 'loc', 'ins', 'acc', 'nom', 'voc'] },
              number: { type: 'string', enum: ['sg', 'pl'] },
              note: { type: 'string' },
            },
            additionalProperties: false,
          },
        },
        required: ['id', 'wordId', 'text', 'type'],
        additionalProperties: false,
      },
    },
    relations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          fromSegmentId: { type: 'string' },
          targetWordId: { type: 'string' },
          type: { type: 'string', enum: ['ownership', 'direction', 'location', 'action'] },
          label: { type: 'string' },
          status: { type: 'string', enum: ['confirmed', 'pending'] },
        },
        required: ['id', 'fromSegmentId', 'targetWordId', 'type', 'label'],
        additionalProperties: false,
      },
    },
    handoff: {
      type: 'object',
      properties: {
        confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        segmentationIssues: { type: 'array', items: { type: 'string' } },
        notes: { type: 'string' },
      },
      additionalProperties: false,
    },
  },
  required: ['id', 'words', 'segments'],
  additionalProperties: false,
};

export const lexicographerResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    senses: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          wordId: { type: 'string' },
          wordClass: { type: 'string', enum: ['content', 'function'] },
          senses: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                english: { type: 'string' },
                nuance: { type: 'string' },
                notes: { type: 'string' },
                citationIds: { type: 'array', items: { type: 'string' } },
                ripples: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      tradition: { type: 'string' },
                      rendering: { type: 'string' },
                    },
                    required: ['tradition', 'rendering'],
                    additionalProperties: false,
                  },
                },
              },
              required: ['english', 'nuance'],
              additionalProperties: false,
            },
          },
        },
        required: ['wordId', 'wordClass', 'senses'],
        additionalProperties: false,
      },
    },
    handoff: {
      type: 'object',
      properties: {
        confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        missingDefinitions: { type: 'array', items: { type: 'string' } },
        notes: { type: 'string' },
      },
      additionalProperties: false,
    },
  },
  required: ['id', 'senses'],
  additionalProperties: false,
};

export const weaverResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    tokens: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          tokenIndex: { type: 'number' },
          text: { type: 'string' },
          linkedSegmentId: { type: 'string' },
          linkedPaliId: { type: 'string' },
          isGhost: { type: 'boolean' },
          ghostKind: { type: 'string', enum: ['required', 'interpretive'] },
        },
        required: ['tokenIndex', 'text', 'isGhost'],
        additionalProperties: false,
      },
    },
    handoff: {
      type: 'object',
      properties: {
        confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        unmappedTokens: { type: 'array', items: { type: 'number' } },
        notes: { type: 'string' },
      },
      additionalProperties: false,
    },
  },
  required: ['id', 'tokens'],
  additionalProperties: false,
};

export const typesetterResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    layoutBlocks: {
      type: 'array',
      items: {
        type: 'array',
        items: { type: 'string' },
      },
    },
    handoff: {
      type: 'object',
      properties: {
        confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        notes: { type: 'string' },
      },
      additionalProperties: false,
    },
  },
  required: ['id', 'layoutBlocks'],
  additionalProperties: false,
};

export const phaseResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    title: { type: 'string' },
    layoutBlocks: {
      type: 'array',
      items: {
        type: 'array',
        items: { type: 'string' },
      },
    },
    paliWords: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          color: { type: 'string' },
          segments: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                text: { type: 'string' },
                type: { type: 'string', enum: ['root', 'suffix', 'prefix', 'stem'] },
                tooltips: { type: 'array', items: { type: 'string' } },
                tooltip: { type: 'string' },
                tooltipsBySense: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      senseId: { type: 'string' },
                      tooltip: { type: 'string' },
                    },
                    required: ['senseId', 'tooltip'],
                    additionalProperties: false,
                  },
                },
                relation: {
                  type: 'object',
                  properties: {
                    targetId: { type: 'string' },
                    type: { type: 'string', enum: ['ownership', 'direction', 'location', 'action'] },
                    label: { type: 'string' },
                    status: { type: 'string', enum: ['confirmed', 'pending'] },
                  },
                  required: ['targetId', 'type', 'label'],
                  additionalProperties: false,
                },
                morph: {
                  type: 'object',
                  properties: {
                    case: { type: 'string', enum: ['gen', 'dat', 'loc', 'ins', 'acc', 'nom', 'voc'] },
                    number: { type: 'string', enum: ['sg', 'pl'] },
                    note: { type: 'string' },
                  },
                  additionalProperties: false,
                },
              },
              required: ['text', 'type'],
              additionalProperties: false,
            },
          },
          senses: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                english: { type: 'string' },
                nuance: { type: 'string' },
                notes: { type: 'string' },
                citationIds: { type: 'array', items: { type: 'string' } },
                ripples: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      tradition: { type: 'string' },
                      rendering: { type: 'string' },
                    },
                    required: ['tradition', 'rendering'],
                    additionalProperties: false,
                  },
                },
              },
              required: ['english', 'nuance'],
              additionalProperties: false,
            },
          },
          isAnchor: { type: 'boolean' },
        },
        required: ['id', 'segments', 'senses'],
        additionalProperties: false,
      },
    },
    englishStructure: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          label: { type: 'string' },
          linkedPaliId: { type: 'string' },
          isGhost: { type: 'boolean' },
          ghostKind: { type: 'string', enum: ['required', 'interpretive'] },
        },
        required: ['id'],
        additionalProperties: false,
      },
    },
  },
  required: ['id', 'paliWords', 'englishStructure'],
  additionalProperties: false,
};

export const morphResponseSchema = {
  type: 'object',
  properties: {
    paliWords: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          segments: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                text: { type: 'string' },
                type: { type: 'string', enum: ['root', 'suffix', 'prefix', 'stem'] },
                tooltips: { type: 'array', items: { type: 'string' } },
                tooltip: { type: 'string' },
                tooltipsBySense: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      senseId: { type: 'string' },
                      tooltip: { type: 'string' },
                    },
                    required: ['senseId', 'tooltip'],
                    additionalProperties: false,
                  },
                },
                relation: {
                  type: 'object',
                  properties: {
                    targetId: { type: 'string' },
                    type: { type: 'string', enum: ['ownership', 'direction', 'location', 'action'] },
                    label: { type: 'string' },
                    status: { type: 'string', enum: ['confirmed', 'pending'] },
                  },
                  required: ['targetId', 'type', 'label'],
                  additionalProperties: false,
                },
                morph: {
                  type: 'object',
                  properties: {
                    case: { type: 'string', enum: ['gen', 'dat', 'loc', 'ins', 'acc', 'nom', 'voc'] },
                    number: { type: 'string', enum: ['sg', 'pl'] },
                    note: { type: 'string' },
                  },
                  additionalProperties: false,
                },
              },
              required: ['text', 'type'],
              additionalProperties: false,
            },
          },
        },
        required: ['id', 'segments'],
        additionalProperties: false,
      },
    },
  },
  required: ['paliWords'],
  additionalProperties: false,
};

const stripCodeFences = (text: string): string => {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
  if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
  return cleaned.trim();
};

export const parseJsonResponse = <T>(raw: string): T => {
  const cleaned = stripCodeFences(raw);
  try {
    return JSON.parse(cleaned) as T;
  } catch (e) {
    const balanced = extractBalancedJson(cleaned);
    return JSON.parse(balanced) as T;
  }
};

export const buildPhaseStateEnvelope = (params: {
  workId: string;
  phaseId: string;
  segments: CanonicalSegment[];
  currentStageLabel: string;
  currentStageKey?: PhaseStageKey;
  completed?: Partial<Record<PhaseStageKey, boolean>>;
}) => {
  const { workId, phaseId, segments, currentStageLabel, currentStageKey, completed } = params;
  const start = segments[0]?.ref.segmentId ?? 'n/a';
  const end = segments[segments.length - 1]?.ref.segmentId ?? start;
  const stages: Array<{ key: PhaseStageKey; label: string }> = [
    { key: 'anatomist', label: 'Anatomist' },
    { key: 'lexicographer', label: 'Lexicographer' },
    { key: 'weaver', label: 'Weaver' },
    { key: 'typesetter', label: 'Typesetter' },
  ];
  const statusLines = stages.map((stage) => {
    const done = Boolean(completed?.[stage.key]);
    const inProgress = !done && currentStageKey === stage.key;
    const stateLabel = done ? 'complete' : inProgress ? 'IN PROGRESS' : 'pending';
    return `${done ? '[x]' : '[ ]'} ${stage.label}: ${stateLabel}`;
  });

  return [
    '=== PHASE STATE (READ ONLY) ===',
    `• Work: ${workId}`,
    `• Phase: ${phaseId}`,
    `• Segments: ${start} — ${end}`,
    `• Current Stage: ${currentStageLabel}`,
    '',
    'STATUS CHECK:',
    ...statusLines,
    '',
    'INVARIANTS:',
    '1) Do NOT add/remove Pali IDs (p1, p2...).',
    '2) Segment texts must concatenate to the surface text exactly.',
    '3) Preserve source word order and spelling (no normalization).',
    '===============================',
  ].join('\n');
};

export const buildBoundaryContext = (boundaries: BoundaryNote[], allowCrossChapter: boolean) => {
  if (!boundaries.length) return '';
  const lines = boundaries
    .map((b) =>
      b.afterSegmentId
        ? `- ${b.workId} begins at ${b.startSegmentId} (after ${b.afterSegmentId})`
        : `- ${b.workId} begins at ${b.startSegmentId}`
    )
    .join('\n');
  const rule = allowCrossChapter
    ? 'Boundary map provided (cross-chapter phases are allowed).'
    : 'Boundary map provided: do not place segments from different works in the same phase.';
  return `\n${rule}\n${lines}\n`;
};

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

  return `You are DeepLoomCompiler.\n\n${SUTTA_STUDIO_BASE_CONTEXT}\n\n${SUTTA_STUDIO_ANATOMIST_CONTEXT}\n\n${phaseState}\n\nTask: Build the Anatomist JSON for the segment list below.\n\nCRITICAL WORD BOUNDARY RULE:\n- Each SPACE-SEPARATED Pali token = ONE word entry.\n- Example: "Evaṁ me sutaṁ" has 3 words: p1="Evaṁ", p2="me", p3="sutaṁ"\n- NEVER combine multiple space-separated tokens into one word.\n- Expected word count for this input: approximately ${approxWordCount} words.\n\nRules:\n- Output JSON ONLY.\n- Use the exact phase id: ${phaseId}.\n- Create word IDs p1, p2, ... in surface order (one per space-separated token).\n- Create segment IDs as <wordId>s1, <wordId>s2, ... and list them in word.segmentIds in order.\n- Ensure concatenation of segment texts equals word.surface exactly.\n- Do NOT add English senses or tokens.\n- REQUIRED: For each segment, add tooltips array with 1-3 short etymology/function hints:\n  - For roots: "√root: meaning" (e.g., "√bhikkh: To share / beg")\n  - For suffixes: "Function: description" (e.g., "Function: Marks the Group/Owner")\n  - For prefixes: "Prefix meaning" (e.g., "vi-: Intensive / Apart")\n  - For stems: "Word: meaning" (e.g., "Evaṁ: Thus / In this way")\n\nReturn JSON ONLY with this shape:\n{\n  "id": "phase-1",\n  "words": [\n    { "id": "p1", "surface": "Evaṁ", "wordClass": "function", "segmentIds": ["p1s1"] }\n  ],\n  "segments": [\n    { "id": "p1s1", "wordId": "p1", "text": "Evaṁ", "type": "stem", "tooltips": ["Evaṁ: Thus / In this way"] }\n  ],\n  "relations": [\n    { "id": "r1", "fromSegmentId": "p2s1", "targetWordId": "p3", "type": "action", "label": "Agent", "status": "confirmed" }\n  ],\n  "handoff": { "confidence": "medium", "segmentationIssues": [], "notes": "" }\n}\n\nEXAMPLE (do NOT copy ids):\n${SUTTA_STUDIO_ANATOMIST_EXAMPLE_JSON}\n${retrievalBlock}\nSegments:\n${lines.join('\n')}`;
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

  return `You are DeepLoomCompiler.\n\n${SUTTA_STUDIO_BASE_CONTEXT}\n\n${SUTTA_STUDIO_WEAVER_CONTEXT}\n\n${phaseState}\n\nTask: Map the English tokens below to Pali word IDs.\n\nRules:\n- Output JSON ONLY.\n- Use the exact phase id: ${phaseId}.\n- For each word token (not whitespace/punctuation), provide a mapping.\n- If a token maps to a Pali word, set linkedPaliId and isGhost: false.\n- If a token is English scaffolding (articles, verb helpers, prepositions), set isGhost: true and ghostKind.\n- Do NOT reword or change the token text.\n\nReturn JSON ONLY with this shape:\n{\n  "id": "phase-1",\n  "tokens": [\n    { "tokenIndex": 0, "text": "Thus", "linkedPaliId": "p1", "isGhost": false },\n    { "tokenIndex": 2, "text": "have", "isGhost": true, "ghostKind": "required" }\n  ],\n  "handoff": { "confidence": "high", "notes": "" }\n}\n\nEXAMPLE (do NOT copy):\n${SUTTA_STUDIO_WEAVER_EXAMPLE_JSON}\n\nEnglish sentence: "${englishText}"\n\nTokenized English (index:text):\n${tokenList}\n\nPali words (id | surface | senses):\n${wordsList}`;
};

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

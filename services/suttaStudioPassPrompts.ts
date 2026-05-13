/**
 * Backward-compat shim — prompt builders moved to services/sutta-studio/prompts/
 * per CONSOLIDATION.md Phase 1.
 *
 * This file retains the schemas, types, and helper utilities (parseJsonResponse,
 * buildPhaseStateEnvelope, buildBoundaryContext) that consumers still expect
 * here. Phase 2 of CONSOLIDATION.md will move those alongside the canonical
 * pass functions; Phase 4 cleanup will delete this file entirely once all
 * consumers import from the canonical location.
 *
 * Note: this file contains DUPLICATES of buildPhaseStateEnvelope and
 * buildBoundaryContext (canonical versions live at services/compiler/utils.ts).
 * The duplicates are byte-identical; Phase 2 will consolidate. Schemas have
 * DIVERGED from services/compiler/schemas.ts (this file has skeleton.wordRange
 * and anatomist.refrainId fields production lacks) — Phase 2 will reconcile.
 */

import { extractBalancedJson } from './ai/textUtils';
import type { CanonicalSegment } from '../types/suttaStudio';

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
          wordClass: { type: 'string', enum: ['content', 'function', 'vocative'] },
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
          wordClass: { type: 'string', enum: ['content', 'function', 'vocative'] },
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
                    targetWordId: { type: 'string' },
                    targetSegmentId: { type: 'string' },
                    type: { type: 'string', enum: ['ownership', 'direction', 'location', 'action'] },
                    label: { type: 'string' },
                    status: { type: 'string', enum: ['confirmed', 'pending'] },
                  },
                  required: ['type', 'label'],
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
                    targetWordId: { type: 'string' },
                    targetSegmentId: { type: 'string' },
                    type: { type: 'string', enum: ['ownership', 'direction', 'location', 'action'] },
                    label: { type: 'string' },
                    status: { type: 'string', enum: ['confirmed', 'pending'] },
                  },
                  required: ['type', 'label'],
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

// Prompt builders moved to services/sutta-studio/prompts/. Re-export for
// backward compat — consumers of suttaStudioPassPrompts.ts (currently
// services/suttaStudioPassRunners.ts and scripts/sutta-studio/benchmark.ts)
// pick them up here without import changes.
export {
  buildSkeletonPrompt,
  buildAnatomistPrompt,
  buildLexicographerPrompt,
  buildWeaverPrompt,
  buildTypesetterPrompt,
  buildMorphologyPrompt,
  buildPhasePrompt,
} from './sutta-studio/prompts';

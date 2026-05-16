/**
 * Canonical JSON response schemas for structured outputs from each
 * Sutta Studio compiler pass.
 *
 * Used by:
 *   - services/sutta-studio/passes/* (the canonical pass functions)
 *   - services/compiler/* (legacy orchestrator — until Phase 4 fully migrates it)
 *   - scripts/sutta-studio/* (benchmark, run-phase-experiment)
 *
 * Both legacy locations (services/compiler/schemas.ts and the schemas
 * section of services/suttaStudioPassPrompts.ts) now re-export from here.
 *
 * History: these schemas were duplicated for months — one copy in each
 * legacy location, with the bench-side copy gaining wordRange + refrainId
 * fields that production needed but production's schema lacked. That
 * mismatch caused the LLM to inconsistently emit these fields. Moving
 * to a single source of truth (this file) closes the gap.
 *
 * Field meanings:
 *   wordRange: [start, end) indices into Pali words. When one segment is
 *     too long for a single study phase, multiple phases reference the
 *     same segment with different wordRanges. ~35 of MN10's 51 phases
 *     rely on this.
 *   refrainId: string tag marking words that recur as a refrain across
 *     phases (e.g., "bhagava" for all instances of bhagavā, "formula-ardent"
 *     for the ātāpī/sampajāno/satimā trio). Words sharing a refrainId get
 *     the same underline color in the reader. See CURATION_PROTOCOL.md §217
 *     for the ≥2-phase rule.
 */

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

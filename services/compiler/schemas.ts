/**
 * JSON response schemas for structured outputs from each compiler pass.
 * Used by callCompilerLLM to constrain LLM output format.
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

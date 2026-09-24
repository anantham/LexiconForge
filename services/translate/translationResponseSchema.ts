import prompts from '../../config/prompts.json';

/**
 * Canonical translation response schema used for providers that support
 * structured JSON outputs (OpenAI-compatible JSON schema format).
 */
const proposalProperty = {
  type: ['object', 'null'],
  description: '' + prompts.proposalDescription,
  properties: {
    kind: { type: 'string', enum: ['prompt', 'glossary'], description: 'Whether the amendment targets the system prompt or glossary.' },
    observation: { type: 'string', description: '' + prompts.proposalObservationDescription },
    currentRule: { type: 'string', description: '' + prompts.proposalCurrentRuleDescription },
    proposedChange: { type: 'string', description: '' + prompts.proposalProposedChangeDescription },
    reasoning: { type: 'string', description: '' + prompts.proposalReasoningDescription },
    glossaryOperation: { type: 'string', enum: ['add', 'replace'], description: 'Required when kind is glossary.' },
    glossaryEntry: {
      type: ['object', 'null'],
      description: 'Required when kind is glossary. The concrete glossary row to add or replace.',
      properties: {
        source: { type: 'string' },
        target: { type: 'string' },
        note: { type: 'string' },
      },
      required: ['source', 'target'],
      additionalProperties: false,
    },
  },
  required: ['kind', 'observation', 'currentRule', 'proposedChange', 'reasoning'],
  additionalProperties: false
} as const;

export const translationOnlyResponseJsonSchema = {
  type: 'object',
  properties: {
    translatedTitle: {
      type: 'string',
      description: '' + prompts.translatedTitleDescription
    },
    translation: {
      type: 'string',
      description: '' + prompts.translationHtmlRules
    },
    footnotes: {
      type: ['array', 'null'],
      description: '' + prompts.footnotesDescription,
      items: {
        type: 'object',
        properties: {
          marker: { type: 'string', description: '' + prompts.footnoteMarkerDescription },
          text: { type: 'string', description: '' + prompts.footnoteTextDescription }
        },
        required: ['marker', 'text'],
        additionalProperties: false
      }
    },
    suggestedIllustrations: {
      type: ['array', 'null'],
      description: '' + prompts.illustrationsDescription,
      items: {
        type: 'object',
        properties: {
          placementMarker: {
            type: 'string',
            description: '' + prompts.illustrationPlacementMarkerDescription
          },
          imagePrompt: {
            type: 'string',
            description: '' + prompts.illustrationImagePromptDescription
          },
          imagePlan: {
            type: ['object', 'null'],
            description: '' + prompts.illustrationImagePlanDescription,
            properties: {
              subject: { type: 'string', description: '' + prompts.illustrationPlanSubjectDescription },
              characters: {
                type: 'array',
                description: '' + prompts.illustrationPlanCharactersDescription,
                items: { type: 'string' }
              },
              scene: { type: 'string', description: '' + prompts.illustrationPlanSceneDescription },
              composition: { type: 'string', description: '' + prompts.illustrationPlanCompositionDescription },
              camera: { type: 'string', description: '' + prompts.illustrationPlanCameraDescription },
              lighting: { type: 'string', description: '' + prompts.illustrationPlanLightingDescription },
              style: { type: 'string', description: '' + prompts.illustrationPlanStyleDescription },
              mood: { type: 'string', description: '' + prompts.illustrationPlanMoodDescription },
              details: {
                type: 'array',
                description: '' + prompts.illustrationPlanDetailsDescription,
                items: { type: 'string' }
              },
              mustKeep: {
                type: 'array',
                description: '' + prompts.illustrationPlanMustKeepDescription,
                items: { type: 'string' }
              },
              avoid: {
                type: 'array',
                description: '' + prompts.illustrationPlanAvoidDescription,
                items: { type: 'string' }
              },
              negativePrompt: {
                type: 'array',
                description: '' + prompts.illustrationPlanNegativePromptDescription,
                items: { type: 'string' }
              }
            },
            required: ['subject', 'characters', 'scene', 'composition', 'camera', 'lighting', 'style', 'mood', 'details', 'mustKeep', 'avoid', 'negativePrompt'],
            additionalProperties: false
          }
        },
        required: ['placementMarker', 'imagePrompt'],
        additionalProperties: false
      }
    }
  },
  required: ['translatedTitle', 'translation', 'footnotes', 'suggestedIllustrations'],
  additionalProperties: false
};

export const proposalResponseJsonSchema = {
  type: 'object',
  properties: {
    proposal: proposalProperty,
  },
  required: ['proposal'],
  additionalProperties: false,
};

export const translationResponseJsonSchema = {
  ...translationOnlyResponseJsonSchema,
  properties: {
    ...translationOnlyResponseJsonSchema.properties,
    proposal: proposalProperty,
  },
  required: [...translationOnlyResponseJsonSchema.required, 'proposal'],
};

/**
 * Get the translation response schema with conditional proposal field
 * based on enableAmendments setting
 */
export function getTranslationResponseJsonSchema(enableAmendments: boolean = false) {
  if (!enableAmendments) {
    return translationOnlyResponseJsonSchema;
  }
  return translationResponseJsonSchema;
}

export function getProposalResponseJsonSchema() {
  return proposalResponseJsonSchema;
}

export function getTranslationOnlyResponseJsonSchema() {
  return translationOnlyResponseJsonSchema;
}

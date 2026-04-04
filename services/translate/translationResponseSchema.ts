import type { Schema } from '@google/generative-ai';
import { SchemaType } from '@google/generative-ai';
import prompts from '../../config/prompts.json';
import type { AppSettings } from '../../types';

/**
 * Canonical translation response schema used for providers that support
 * structured JSON outputs (OpenAI-compatible JSON schema format).
 */
const proposalProperty = {
  type: ['object', 'null'],
  description: '' + prompts.proposalDescription,
  properties: {
    observation: { type: 'string', description: '' + prompts.proposalObservationDescription },
    currentRule: { type: 'string', description: '' + prompts.proposalCurrentRuleDescription },
    proposedChange: { type: 'string', description: '' + prompts.proposalProposedChangeDescription },
    reasoning: { type: 'string', description: '' + prompts.proposalReasoningDescription }
  },
  required: ['observation', 'currentRule', 'proposedChange', 'reasoning'],
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
 * Gemini-compatible representation of the translation response schema.
 * Mirrors the JSON schema above using the Gemini Schema DSL.
 */
export const translationOnlyResponseGeminiSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    translatedTitle: {
      type: SchemaType.STRING,
      description: '' + prompts.translatedTitleDescription
    },
    translation: {
      type: SchemaType.STRING,
      description: '' + prompts.translationHtmlRules
    },
    footnotes: {
      type: SchemaType.ARRAY,
      nullable: true,
      description: 'Optional list of translator footnotes that clarify context',
      items: {
        type: SchemaType.OBJECT,
        properties: {
          marker: { type: SchemaType.STRING, description: '' + prompts.footnoteMarkerDescription },
          text: { type: SchemaType.STRING, description: '' + prompts.footnoteTextDescription }
        },
        required: ['marker', 'text']
      }
    },
    suggestedIllustrations: {
      type: SchemaType.ARRAY,
      nullable: true,
      description: '' + prompts.illustrationsDescription,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          placementMarker: {
            type: SchemaType.STRING,
            description: '' + prompts.illustrationPlacementMarkerDescription
          },
          imagePrompt: {
            type: SchemaType.STRING,
            description: '' + prompts.illustrationImagePromptDescription
          }
        },
        required: ['placementMarker', 'imagePrompt']
      }
    }
  },
  required: ['translatedTitle', 'translation', 'footnotes', 'suggestedIllustrations']
};

const proposalGeminiProperty: Schema = {
  type: SchemaType.OBJECT,
  nullable: true,
  description: '' + prompts.proposalDescription,
  properties: {
    observation: { type: SchemaType.STRING, description: '' + prompts.proposalObservationDescription },
    currentRule: { type: SchemaType.STRING, description: '' + prompts.proposalCurrentRuleDescription },
    proposedChange: { type: SchemaType.STRING, description: '' + prompts.proposalProposedChangeDescription },
    reasoning: { type: SchemaType.STRING, description: '' + prompts.proposalReasoningDescription }
  },
  required: ['observation', 'currentRule', 'proposedChange', 'reasoning']
};

export const proposalResponseGeminiSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    proposal: proposalGeminiProperty,
  },
  required: ['proposal'],
};

export const translationResponseGeminiSchema: Schema = {
  ...(translationOnlyResponseGeminiSchema as GeminiObjectSchema),
  properties: {
    ...((translationOnlyResponseGeminiSchema as GeminiObjectSchema).properties || {}),
    proposal: proposalGeminiProperty,
  },
  required: ['translatedTitle', 'translation', 'footnotes', 'suggestedIllustrations', 'proposal'],
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

/**
 * Get the Gemini translation response schema with conditional proposal field
 * based on enableAmendments setting
 */
type GeminiObjectSchema = Schema & {
  type: SchemaType.OBJECT;
  properties?: Record<string, Schema>;
  required?: string[];
};

export function getTranslationResponseGeminiSchema(enableAmendments: boolean = false): Schema {
  if (!enableAmendments) {
    return translationOnlyResponseGeminiSchema;
  }
  return translationResponseGeminiSchema;
}

export function getProposalResponseJsonSchema() {
  return proposalResponseJsonSchema;
}

export function getProposalResponseGeminiSchema(): Schema {
  return proposalResponseGeminiSchema;
}

export function getTranslationOnlyResponseJsonSchema() {
  return translationOnlyResponseJsonSchema;
}

export function getTranslationOnlyResponseGeminiSchema(): Schema {
  return translationOnlyResponseGeminiSchema;
}

import type { Schema } from '@google/generative-ai';
import { SchemaType } from '@google/generative-ai';
import prompts from '../../config/prompts.json';

/**
 * Canonical translation response schema used for providers that support
 * structured JSON outputs (OpenAI-compatible JSON schema format).
 */
export const translationResponseJsonSchema = {
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
    },
    proposal: {
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
    }
  },
  required: ['translatedTitle', 'translation', 'footnotes', 'suggestedIllustrations', 'proposal'],
  additionalProperties: false
};

/**
 * Gemini-compatible representation of the translation response schema.
 * Mirrors the JSON schema above using the Gemini Schema DSL.
 */
export const translationResponseGeminiSchema: Schema = {
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
    },
    proposal: {
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
    }
  },
  required: ['translatedTitle', 'translation', 'footnotes', 'suggestedIllustrations', 'proposal']
};

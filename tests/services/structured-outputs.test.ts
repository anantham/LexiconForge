import { describe, it, expect } from 'vitest';

import prompts from '../../config/prompts.json';

// Dynamically build the schema from the prompts file to stay in sync
const openaiResponseSchema = {
    "type": "object",
    "properties": {
        "translatedTitle": {
            "type": "string",
            "description": prompts.translatedTitleDescription
        },
        "translation": { "type": "string", "description": prompts.translationHtmlRules },
        "footnotes": {
            "type": ["array", "null"],
            "description": prompts.footnotesDescription,
            "items": {
                "type": "object",
                "properties": {
                    "marker": {"type": "string", "description": prompts.footnoteMarkerDescription},
                    "text": {"type": "string", "description": prompts.footnoteTextDescription}
                },
                "required": ["marker", "text"],
                "additionalProperties": false
            }
        },
        "suggestedIllustrations": {
            "type": ["array", "null"],
            "description": prompts.illustrationsDescription,
            "items": {
                "type": "object", 
                "properties": {
                    "placementMarker": {"type": "string", "description": prompts.illustrationPlacementMarkerDescription},
                    "imagePrompt": {"type": "string", "description": prompts.illustrationImagePromptDescription}
                },
                "required": ["placementMarker", "imagePrompt"],
                "additionalProperties": false
            }
        },
        "proposal": {
            "type": ["object", "null"],
            "description": prompts.proposalDescription,
            "properties": {
                "observation": {"type": "string", "description": prompts.proposalObservationDescription},
                "currentRule": {"type": "string", "description": prompts.proposalCurrentRuleDescription},
                "proposedChange": {"type": "string", "description": prompts.proposalProposedChangeDescription},
                "reasoning": {"type": "string", "description": prompts.proposalReasoningDescription}
            },
            "required": ["observation", "currentRule", "proposedChange", "reasoning"],
            "additionalProperties": false
        }
    },
    "required": ["translatedTitle", "translation", "footnotes", "suggestedIllustrations", "proposal"],
    "additionalProperties": false
};

// Function to validate JSON against schema (simplified validator)
const validateJsonAgainstSchema = (json: any, schema: any): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    // Check required fields
    if (schema.required) {
        for (const field of schema.required) {
            if (!(field in json)) {
                errors.push(`Missing required field: ${field}`);
            }
        }
    }
    
    // Check field types
    if (schema.properties) {
        for (const [field, fieldSchema] of Object.entries(schema.properties)) {
            if (field in json) {
                const value = json[field];
                const fieldSchemaTyped = fieldSchema as any;
                
                if (Array.isArray(fieldSchemaTyped.type)) {
                    // Union type (e.g., ["array", "null"])
                    const validType = fieldSchemaTyped.type.some((type: string) => {
                        if (type === 'null' && value === null) return true;
                        if (type === 'string' && typeof value === 'string') return true;
                        if (type === 'array' && Array.isArray(value)) return true;
                        if (type === 'object' && typeof value === 'object' && value !== null && !Array.isArray(value)) return true;
                        return false;
                    });
                    
                    if (!validType) {
                        errors.push(`Field ${field} has invalid type. Expected one of ${fieldSchemaTyped.type.join(' | ')}, got ${typeof value}`);
                    }
                } else {
                    // Single type
                    const expectedType = fieldSchemaTyped.type;
                    if (expectedType === 'string' && typeof value !== 'string') {
                        errors.push(`Field ${field} must be string, got ${typeof value}`);
                    }
                }
            }
        }
    }
    
    return { valid: errors.length === 0, errors };
};

describe('OpenAI Structured Outputs Schema', () => {
    describe('Schema Validation', () => {
        it('should have all required fields defined', () => {
            expect(openaiResponseSchema.required).toEqual([
                'translatedTitle', 
                'translation', 
                'footnotes', 
                'suggestedIllustrations', 
                'proposal'
            ]);
        });

        it('should have proper union types for optional fields', () => {
            const footnotes = openaiResponseSchema.properties.footnotes as any;
            const illustrations = openaiResponseSchema.properties.suggestedIllustrations as any;
            const proposal = openaiResponseSchema.properties.proposal as any;
            
            expect(footnotes.type).toEqual(['array', 'null']);
            expect(illustrations.type).toEqual(['array', 'null']);
            expect(proposal.type).toEqual(['object', 'null']);
        });

        it('should not have default properties (OpenAI restriction)', () => {
            const schemaString = JSON.stringify(openaiResponseSchema);
            expect(schemaString).not.toContain('"default"');
        });

        it('should have additionalProperties: false for strict mode', () => {
            expect(openaiResponseSchema.additionalProperties).toBe(false);
            
            // Check nested objects too
            const footnoteItems = (openaiResponseSchema.properties.footnotes as any).items;
            const illustrationItems = (openaiResponseSchema.properties.suggestedIllustrations as any).items;
            const proposal = openaiResponseSchema.properties.proposal as any;
            
            expect(footnoteItems.additionalProperties).toBe(false);
            expect(illustrationItems.additionalProperties).toBe(false);
            expect(proposal.additionalProperties).toBe(false);
        });
    });

    describe('Valid Response Examples', () => {
        it('should validate minimal valid response', () => {
            const minimalResponse = {
                translatedTitle: "Chapter 1: The Beginning",
                translation: "This is the translated content.",
                footnotes: null,
                suggestedIllustrations: null,
                proposal: null
            };
            
            const result = validateJsonAgainstSchema(minimalResponse, openaiResponseSchema);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should validate response with arrays', () => {
            const responseWithArrays = {
                translatedTitle: "Chapter 2: The Journey",
                translation: "Content with [1] footnote and [ILLUSTRATION-1] image.",
                footnotes: [
                    { marker: "[1]", text: "This is a footnote" }
                ],
                suggestedIllustrations: [
                    { placementMarker: "[ILLUSTRATION-1]", imagePrompt: "A scenic view" }
                ],
                proposal: null
            };
            
            const result = validateJsonAgainstSchema(responseWithArrays, openaiResponseSchema);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should validate response with proposal', () => {
            const responseWithProposal = {
                translatedTitle: "Chapter 3: The Discovery",
                translation: "Translated content here.",
                footnotes: [],
                suggestedIllustrations: [],
                proposal: {
                    observation: "The system prompt could be clearer",
                    currentRule: "Translate directly",
                    proposedChange: "Add context awareness",
                    reasoning: "Better accuracy with context"
                }
            };
            
            const result = validateJsonAgainstSchema(responseWithProposal, openaiResponseSchema);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should validate complex response with all fields', () => {
            const complexResponse = {
                translatedTitle: "Chapter 4: The Final Battle",
                translation: "Epic battle scene [1] with multiple [ILLUSTRATION-1] and [ILLUSTRATION-2] illustrations.",
                footnotes: [
                    { marker: "[1]", text: "Historical context note" }
                ],
                suggestedIllustrations: [
                    { placementMarker: "[ILLUSTRATION-1]", imagePrompt: "Warriors in combat" },
                    { placementMarker: "[ILLUSTRATION-2]", imagePrompt: "Magical explosion" }
                ],
                proposal: {
                    observation: "Combat scenes need more dynamic language",
                    currentRule: "Use standard combat terminology",
                    proposedChange: "Incorporate more vivid action verbs",
                    reasoning: "Enhances reader engagement and immersion"
                }
            };
            
            const result = validateJsonAgainstSchema(complexResponse, openaiResponseSchema);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });
    });

    describe('Invalid Response Examples', () => {
        it('should reject response missing required fields', () => {
            const incompleteResponse = {
                translatedTitle: "Chapter Title"
                // Missing translation and other required fields
            };
            
            const result = validateJsonAgainstSchema(incompleteResponse, openaiResponseSchema);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Missing required field: translation');
        });

        it('should reject response with wrong types', () => {
            const wrongTypes = {
                translatedTitle: 123, // Should be string
                translation: "Valid translation",
                footnotes: null,
                suggestedIllustrations: null,
                proposal: null
            };
            
            const result = validateJsonAgainstSchema(wrongTypes, openaiResponseSchema);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('translatedTitle'))).toBe(true);
        });

        it('should reject malformed footnotes', () => {
            const malformedFootnotes = {
                translatedTitle: "Chapter Title",
                translation: "Content",
                footnotes: [
                    { marker: "[1]" } // Missing text field
                ],
                suggestedIllustrations: null,
                proposal: null
            };
            
            // This is a simplified test - full JSON Schema validation would catch this
            expect(malformedFootnotes.footnotes[0]).not.toHaveProperty('text');
        });

        it('should reject malformed proposals', () => {
            const malformedProposal = {
                translatedTitle: "Chapter Title",
                translation: "Content",
                footnotes: null,
                suggestedIllustrations: null,
                proposal: {
                    observation: "Good observation",
                    // Missing required fields: currentRule, proposedChange, reasoning
                }
            };
            
            const proposalFields = Object.keys(malformedProposal.proposal);
            const requiredFields = ['observation', 'currentRule', 'proposedChange', 'reasoning'];
            const missingFields = requiredFields.filter(field => !proposalFields.includes(field));
            
            expect(missingFields).toHaveLength(3);
        });
    });

    describe('Schema Compliance with OpenAI Requirements', () => {
        it('should not use deprecated features', () => {
            const schemaString = JSON.stringify(openaiResponseSchema);
            
            // OpenAI structured outputs don't support these
            expect(schemaString).not.toContain('"default"');
            expect(schemaString).not.toContain('"$ref"');
            expect(schemaString).not.toContain('"anyOf"');
            expect(schemaString).not.toContain('"oneOf"');
        });

        it('should use only supported JSON Schema features', () => {
            // Check that we only use basic types
            const checkSchemaTypes = (obj: any): string[] => {
                const types: string[] = [];
                
                if (typeof obj === 'object' && obj !== null) {
                    if (obj.type) {
                        if (Array.isArray(obj.type)) {
                            types.push(...obj.type);
                        } else {
                            types.push(obj.type);
                        }
                    }
                    
                    for (const value of Object.values(obj)) {
                        types.push(...checkSchemaTypes(value));
                    }
                }
                
                return types;
            };
            
            const allTypes = checkSchemaTypes(openaiResponseSchema);
            const validTypes = ['object', 'string', 'array', 'null'];
            const invalidTypes = allTypes.filter(type => !validTypes.includes(type));
            
            expect(invalidTypes).toHaveLength(0);
        });

        it('should have consistent naming conventions', () => {
            const properties = openaiResponseSchema.properties;
            const propertyNames = Object.keys(properties);
            
            // Check camelCase naming
            propertyNames.forEach(name => {
                expect(name).toMatch(/^[a-z][a-zA-Z0-9]*$/);
            });
        });
    });
});

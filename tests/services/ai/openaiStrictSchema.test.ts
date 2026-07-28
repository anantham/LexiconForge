import { describe, it, expect } from 'vitest';
import { toOpenAIStrictSchema, needsOpenAIStrictSchema } from '../../../services/ai/openaiStrictSchema';
// Old benchmark path must keep re-exporting the same functions (shim contract).
import {
  toOpenAIStrictSchema as toOpenAIStrictSchemaViaShim,
  needsOpenAIStrictSchema as needsOpenAIStrictSchemaViaShim,
} from '../../../scripts/sutta-studio/openai-strict-schema';
import { anatomistResponseSchema, lexicographerResponseSchema } from '../../../services/sutta-studio/schemas';

/**
 * OpenAI's strict json_schema dialect (probe-verified 2026-07-22: verbatim
 * "Missing 'isAnchor'", code invalid_json_schema) requires every property in
 * `required`, additionalProperties:false, and null-unions for optionality.
 * The transform must express the SAME logical contract in that dialect.
 */
describe('toOpenAIStrictSchema', () => {
  it('puts every property in required, at every nesting level', () => {
    const input = {
      type: 'object',
      properties: {
        a: { type: 'string' },
        b: { type: 'number' },
        nested: {
          type: 'object',
          properties: { x: { type: 'string' }, y: { type: 'boolean' } },
          required: ['x'],
        },
        list: {
          type: 'array',
          items: {
            type: 'object',
            properties: { id: { type: 'string' }, isAnchor: { type: 'boolean' } },
            required: ['id'],
          },
        },
      },
      required: ['a'],
    };
    const out = toOpenAIStrictSchema(input);
    expect(out.required.sort()).toEqual(['a', 'b', 'list', 'nested']);
    expect(out.properties.nested.required.sort()).toEqual(['x', 'y']);
    expect(out.properties.list.items.required.sort()).toEqual(['id', 'isAnchor']);
  });

  it('formerly-optional properties become null-unions (contract preserved, dialect changed)', () => {
    const out = toOpenAIStrictSchema({
      type: 'object',
      properties: { req: { type: 'string' }, opt: { type: 'string' } },
      required: ['req'],
    });
    expect(out.properties.req.type).toBe('string'); // required stays plain
    expect(out.properties.opt.type).toEqual(['string', 'null']); // optional admits null
  });

  it('sets additionalProperties: false on every object that did not choose otherwise', () => {
    const out = toOpenAIStrictSchema({
      type: 'object',
      properties: {
        open: { type: 'object', properties: { z: { type: 'string' } }, additionalProperties: true },
        closed: { type: 'object', properties: { z: { type: 'string' } } },
      },
    });
    expect(out.additionalProperties).toBe(false);
    expect(out.properties.open.additionalProperties).toBe(true); // explicit choice respected
    expect(out.properties.closed.additionalProperties).toBe(false);
  });

  it('is idempotent', () => {
    const once = toOpenAIStrictSchema(anatomistResponseSchema);
    const twice = toOpenAIStrictSchema(once);
    expect(twice).toEqual(once);
  });

  it('handles the REAL anatomist schema — the one the probe 400d on ("Missing isAnchor")', () => {
    const out = toOpenAIStrictSchema(anatomistResponseSchema);
    const check = (node: any): void => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) return node.forEach(check);
      if (node.properties) {
        expect((node.required ?? []).sort()).toEqual(Object.keys(node.properties).sort());
        expect(node.additionalProperties).toBe(false);
      }
      Object.values(node).forEach(check);
    };
    check(out);
  });

  it('gates on openai/* slugs only', () => {
    expect(needsOpenAIStrictSchema('openai/gpt-5.4-mini')).toBe(true);
    expect(needsOpenAIStrictSchema('anthropic/claude-sonnet-5')).toBe(false);
    expect(needsOpenAIStrictSchema('google/gemini-3.5-flash')).toBe(false);
  });
});

describe('toOpenAIStrictSchema — enum/const optionality (codex review P1)', () => {
  it('optional enum fields admit null IN THE ENUM, not just the type', () => {
    const out = toOpenAIStrictSchema({
      type: 'object',
      properties: {
        req: { type: 'string' },
        ghostKind: { type: 'string', enum: ['implied', 'grammatical'] },
      },
      required: ['req'],
    });
    // A value must satisfy BOTH type and enum — null in type alone would
    // force the model to fabricate an enum value for a field it wants to omit.
    expect(out.properties.ghostKind.enum).toEqual(['implied', 'grammatical', null]);
    expect(out.properties.ghostKind.type).toEqual(['string', 'null']);
  });

  it('required enum fields stay untouched', () => {
    const out = toOpenAIStrictSchema({
      type: 'object',
      properties: { status: { type: 'string', enum: ['a', 'b'] } },
      required: ['status'],
    });
    expect(out.properties.status.enum).toEqual(['a', 'b']);
    expect(out.properties.status.type).toBe('string');
  });

  it('optional const fields become nullable enums', () => {
    const out = toOpenAIStrictSchema({
      type: 'object',
      properties: { req: { type: 'string' }, version: { type: 'string', const: 'v2' } },
      required: ['req'],
    });
    expect(out.properties.version.enum).toEqual(['v2', null]);
    expect(out.properties.version.const).toBeUndefined();
    expect(out.properties.version.type).toEqual(['string', 'null']);
  });

  it('remains idempotent with nullable enums', () => {
    const input = {
      type: 'object',
      properties: { e: { type: 'string', enum: ['x'] } },
      required: [],
    };
    const once = toOpenAIStrictSchema(input);
    expect(toOpenAIStrictSchema(once)).toEqual(once);
  });
});

describe('toOpenAIStrictSchema — open maps (ripples) are inexpressible and DROPPED', () => {
  it('drops an open-map property from properties AND required', () => {
    const out = toOpenAIStrictSchema({
      type: 'object',
      properties: {
        english: { type: 'string' },
        ripples: { type: 'object', additionalProperties: { type: 'string' } },
      },
      required: ['english', 'ripples'],
    });
    expect(out.properties.ripples).toBeUndefined();
    expect(out.required).toEqual(['english']);
    expect(out.properties.english.type).toBe('string');
  });

  it('drops ripples from the REAL lexicographer schema (disclosed degradation for openai/*)', () => {
    const out = toOpenAIStrictSchema(lexicographerResponseSchema);
    const senseSchema = out.properties.senses.items.properties.senses.items;
    expect(senseSchema.properties.ripples).toBeUndefined();
    expect(senseSchema.required).not.toContain('ripples');
    // The rest of the sense contract survives.
    expect(senseSchema.required).toEqual(expect.arrayContaining(['english', 'nuance']));
  });

  it('closed objects (fixed properties) are NOT treated as open maps', () => {
    const out = toOpenAIStrictSchema({
      type: 'object',
      properties: {
        handoff: { type: 'object', properties: { notes: { type: 'string' } }, additionalProperties: false },
      },
      required: [],
    });
    expect(out.properties.handoff).toBeDefined();
    expect(out.required).toEqual(['handoff']);
  });

  it('stays idempotent after the drop', () => {
    const once = toOpenAIStrictSchema(lexicographerResponseSchema);
    expect(toOpenAIStrictSchema(once)).toEqual(once);
  });
});

describe('scripts/sutta-studio/openai-strict-schema shim', () => {
  it('re-exports the same functions the benchmark imports', () => {
    expect(toOpenAIStrictSchemaViaShim).toBe(toOpenAIStrictSchema);
    expect(needsOpenAIStrictSchemaViaShim).toBe(needsOpenAIStrictSchema);
  });
});

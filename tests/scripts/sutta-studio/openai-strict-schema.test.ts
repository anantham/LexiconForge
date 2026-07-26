import { describe, it, expect } from 'vitest';
import { toOpenAIStrictSchema, needsOpenAIStrictSchema } from '../../../scripts/sutta-studio/openai-strict-schema';
import { anatomistResponseSchema } from '../../../services/sutta-studio/schemas';

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

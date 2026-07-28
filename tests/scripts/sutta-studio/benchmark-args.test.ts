// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { parseBenchmarkArgs } from '../../../scripts/sutta-studio/lib/benchmark-args';

const ROSTER = ['grok-4.20', 'gemini-3-flash', 'claude-sonnet-5'];

describe('parseBenchmarkArgs (benchmark --model)', () => {
  it('returns null model with no error when --model is absent (full configured run)', () => {
    expect(parseBenchmarkArgs([], ROSTER)).toEqual({ model: null, error: null });
    expect(parseBenchmarkArgs(['--other', 'x'], ROSTER)).toEqual({ model: null, error: null });
  });

  it('returns the model when --model names a roster id', () => {
    expect(parseBenchmarkArgs(['--model', 'gemini-3-flash'], ROSTER)).toEqual({
      model: 'gemini-3-flash',
      error: null,
    });
  });

  it('errors when --model has no value — never falls through to a full paid run', () => {
    const bare = parseBenchmarkArgs(['--model'], ROSTER);
    expect(bare.model).toBeNull();
    expect(bare.error).toMatch(/requires a value/);

    const flagAsValue = parseBenchmarkArgs(['--model', '--verbose'], ROSTER);
    expect(flagAsValue.model).toBeNull();
    expect(flagAsValue.error).toMatch(/requires a value/);
  });

  it('errors on an unknown id, naming the roster (an unknown id would otherwise run nothing and exit 0)', () => {
    const unknown = parseBenchmarkArgs(['--model', 'not-a-model'], ROSTER);
    expect(unknown.model).toBeNull();
    expect(unknown.error).toContain('not-a-model');
    expect(unknown.error).toContain('grok-4.20');
  });
});

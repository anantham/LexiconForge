// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { OpenRouterAlignmentVerifier } from '../../scripts/lib/chapter-alignment-verifier';

describe('chapter-alignment-verifier', () => {
  it('rejects non-free model ids so alignment runs cannot spend money accidentally', () => {
    expect(() => new OpenRouterAlignmentVerifier('openai/gpt-5', 'test-key')).toThrow(/non-free model/i);
  });

  it('accepts explicit free model ids', () => {
    const verifier = new OpenRouterAlignmentVerifier('openrouter/free', 'test-key');
    expect(verifier.model).toBe('openrouter/free');
  });
});

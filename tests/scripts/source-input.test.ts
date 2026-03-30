// @vitest-environment node

import * as path from 'path';

import { describe, expect, it } from 'vitest';

import { isAdapterSpec, normalizeSourceInput } from '../../scripts/lib/source-input';

describe('source-input', () => {
  it('detects adapter specs and web URLs', () => {
    expect(isAdapterSpec('novelhi://Forty-Millenniums-of-Cultivation?from=765&to=767')).toBe(true);
    expect(isAdapterSpec('https://novelhi.com/s/Forty-Millenniums-of-Cultivation/766')).toBe(true);
    expect(isAdapterSpec('/tmp/raw.txt')).toBe(false);
    expect(isAdapterSpec('./relative/raw.txt')).toBe(false);
  });

  it('resolves filesystem paths but preserves adapter specs', () => {
    expect(normalizeSourceInput('novelhi://Forty-Millenniums-of-Cultivation?from=765&to=767')).toBe(
      'novelhi://Forty-Millenniums-of-Cultivation?from=765&to=767'
    );
    expect(normalizeSourceInput('https://novelhi.com/s/Forty-Millenniums-of-Cultivation/766')).toBe(
      'https://novelhi.com/s/Forty-Millenniums-of-Cultivation/766'
    );
    expect(normalizeSourceInput('./fixtures/raw.txt')).toBe(path.resolve('./fixtures/raw.txt'));
  });
});

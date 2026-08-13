// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest';
import { getEnvVar } from '../../services/env';

const TEST_KEY = 'LF_ENV_BOUNDARY_TEST';

afterEach(() => {
  delete process.env[TEST_KEY];
  vi.unstubAllGlobals();
});

describe('environment boundary', () => {
  it('keeps process variables available to Node scripts', () => {
    process.env[TEST_KEY] = 'node-only-value';

    expect(getEnvVar(TEST_KEY)).toBe('node-only-value');
  });

  it('does not expose process variables when a browser global exists', () => {
    process.env[TEST_KEY] = 'must-not-reach-browser';
    vi.stubGlobal('window', {});

    expect(getEnvVar(TEST_KEY)).toBeUndefined();
  });
});

import { describe, expect, it } from 'vitest';
import {
  applySuttaStudioModelOverride,
  SUTTA_STUDIO_DEFAULT_MODEL,
  SUTTA_STUDIO_DEFAULT_PROVIDER,
} from '../../../services/compiler/index';
import type { AppSettings } from '../../../types';

const makeSettings = (overrides: Partial<AppSettings> = {}): AppSettings => ({
  provider: 'Claude',
  model: 'claude-sonnet-4-6',
  imageModel: 'imagen-3.0-generate-001',
  contextDepth: 2,
  preloadCount: 0,
  fontSize: 18,
  fontStyle: 'serif',
  lineHeight: 1.7,
  systemPrompt: '',
  temperature: 0.7,
  ...overrides,
});

describe('applySuttaStudioModelOverride', () => {
  it('falls back to cheap default when no Sutta Studio override is set', () => {
    const settings = makeSettings({ provider: 'Claude', model: 'claude-sonnet-4-6' });
    const out = applySuttaStudioModelOverride(settings);
    expect(out.provider).toBe(SUTTA_STUDIO_DEFAULT_PROVIDER);
    expect(out.model).toBe(SUTTA_STUDIO_DEFAULT_MODEL);
    // Ensure other settings are preserved
    expect(out.temperature).toBe(0.7);
    expect(out.contextDepth).toBe(2);
  });

  it('respects explicit suttaStudioModel override', () => {
    const settings = makeSettings({
      provider: 'Claude',
      model: 'claude-sonnet-4-6',
      suttaStudioProvider: 'Gemini',
      suttaStudioModel: 'gemini-2.5-pro',
    });
    const out = applySuttaStudioModelOverride(settings);
    expect(out.provider).toBe('Gemini');
    expect(out.model).toBe('gemini-2.5-pro');
  });

  it('returns input unchanged when global model already matches default', () => {
    const settings = makeSettings({
      provider: SUTTA_STUDIO_DEFAULT_PROVIDER,
      model: SUTTA_STUDIO_DEFAULT_MODEL,
    });
    const out = applySuttaStudioModelOverride(settings);
    expect(out).toBe(settings);
  });

  it('partial override (model only) inherits default provider', () => {
    const settings = makeSettings({
      provider: 'Claude',
      model: 'claude-sonnet-4-6',
      suttaStudioModel: 'google/gemini-2.5-flash',
    });
    const out = applySuttaStudioModelOverride(settings);
    expect(out.model).toBe('google/gemini-2.5-flash');
    expect(out.provider).toBe(SUTTA_STUDIO_DEFAULT_PROVIDER);
  });
});

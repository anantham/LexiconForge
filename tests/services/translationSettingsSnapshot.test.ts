import { describe, expect, it } from 'vitest';
import {
  normalizeTranslationSettingsSnapshot,
  type TranslationSettingsSnapshot,
} from '../../services/translationSettingsSnapshot';

describe('normalizeTranslationSettingsSnapshot', () => {
  it('returns a snapshot with all required fields from full settings', () => {
    const settings = {
      provider: 'OpenRouter' as const,
      model: 'anthropic/claude-sonnet-4-6',
      temperature: 0.3,
      systemPrompt: 'Translate carefully',
      contextDepth: 3,
      includeFanTranslationInPrompt: true,
      includeHistoricalFanTranslationsInContext: false,
      // Extra fields that should NOT appear in snapshot
      apiKey: 'secret',
      imageModel: 'flux',
    };

    const snapshot = normalizeTranslationSettingsSnapshot(settings as any);

    expect(snapshot.provider).toBe('OpenRouter');
    expect(snapshot.model).toBe('anthropic/claude-sonnet-4-6');
    expect(snapshot.temperature).toBe(0.3);
    expect(snapshot.systemPrompt).toBe('Translate carefully');
    expect(snapshot.contextDepth).toBe(3);
    expect(snapshot.includeFanTranslationInPrompt).toBe(true);
    expect(snapshot.includeHistoricalFanTranslationsInContext).toBe(false);

    // Should NOT include unrelated settings
    expect((snapshot as any).apiKey).toBeUndefined();
    expect((snapshot as any).imageModel).toBeUndefined();
  });

  it('fills missing fields with defaults', () => {
    const snapshot = normalizeTranslationSettingsSnapshot({} as any);

    // Should have defaults, not undefined
    expect(snapshot.provider).toBeDefined();
    expect(snapshot.temperature).toBeDefined();
    expect(typeof snapshot.temperature).toBe('number');
  });
});

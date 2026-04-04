import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const trackMock = vi.fn();

vi.mock('@vercel/analytics', () => ({
  track: trackMock,
}));

describe('clientTelemetry', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv('VITE_ENABLE_CLIENT_TELEMETRY', '1');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
      })
    );

    (window as any).__APP_STORE__ = {
      getState: () => ({
        appScreen: 'reader',
        currentChapterId: 'chapter-1',
        settings: {
          provider: 'OpenRouter',
          model: 'openrouter/auto',
        },
        isLoading: {
          fetching: false,
          translating: false,
        },
        hydratingChapters: {},
      }),
    };
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    delete (window as any).__APP_STORE__;
  });

  it('tracks expected failures without sending the callback payload', async () => {
    const { emitClientTelemetryEvent } = await import('../../services/clientTelemetry');

    emitClientTelemetryEvent({
      eventType: 'known_limit_reached',
      failureType: 'trial_limit',
      surface: 'auto_translate',
      severity: 'warning',
      expected: true,
      userVisible: null,
      provider: 'OpenRouter',
      model: 'openrouter/auto',
      chapterId: 'chapter-1',
      errorMessage: 'Daily limit reached',
    });

    expect(trackMock).toHaveBeenCalledWith(
      'known_limit_reached',
      expect.objectContaining({
        failure_type: 'trial_limit',
        surface: 'auto_translate',
        expected: true,
        route: 'reader',
      })
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it('dedupes callback delivery for repeated unexpected failures while keeping analytics counts', async () => {
    const { emitClientTelemetryEvent } = await import('../../services/clientTelemetry');

    const event = {
      eventType: 'translation_failed' as const,
      failureType: 'timeout' as const,
      surface: 'auto_translate' as const,
      severity: 'error' as const,
      expected: false,
      userVisible: null,
      provider: 'OpenRouter' as const,
      model: 'openrouter/auto',
      chapterId: 'chapter-1',
      errorMessage: 'Translation timed out after 90s.',
      dedupeCallback: true,
    };

    emitClientTelemetryEvent(event);
    emitClientTelemetryEvent(event);

    expect(trackMock).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('dedupes repeated visible render events entirely when requested', async () => {
    const { emitClientTelemetryEvent } = await import('../../services/clientTelemetry');

    const event = {
      eventType: 'ui_error_rendered' as const,
      failureType: 'trial_limit' as const,
      surface: 'ui_render' as const,
      severity: 'warning' as const,
      expected: true,
      userVisible: true,
      provider: 'OpenRouter' as const,
      model: 'openrouter/auto',
      chapterId: 'chapter-1',
      errorMessage: 'Daily limit reached',
      dedupeAll: true,
    };

    emitClientTelemetryEvent(event);
    emitClientTelemetryEvent(event);

    expect(trackMock).toHaveBeenCalledTimes(1);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not use VERCEL_URL as a build identifier fallback', async () => {
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', '');
    vi.stubEnv('VITE_APP_BUILD_ID', '');
    vi.stubEnv('VERCEL_URL', 'lexicon-forge-git-fix-codex-te-ea669e-adityas-projects-9c03351d.vercel.app');

    const { emitClientTelemetryEvent } = await import('../../services/clientTelemetry');

    emitClientTelemetryEvent({
      eventType: 'translation_failed',
      failureType: 'timeout',
      surface: 'auto_translate',
      severity: 'error',
      expected: false,
      userVisible: null,
      provider: 'OpenRouter',
      model: 'openrouter/auto',
      chapterId: 'chapter-1',
      errorMessage: 'Translation timed out after 90s.',
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    const [, requestInit] = (fetch as any).mock.calls[0];
    expect(JSON.parse(requestInit.body)).toEqual(
      expect.objectContaining({
        build_id: null,
      })
    );
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createAndOpenSelfInsert,
  SelfInsertPopupBlockedError,
} from '../../services/selfInsertPortal';
import type { SelfInsertRequest } from '../../services/selfInsertService';

const request: SelfInsertRequest = {
  chapterNumber: 750,
  characterNames: ['Li Yao'],
  selectedPassage: 'The formation shattered.',
  chapterTranslation: 'Full translated chapter.',
  chapterTitle: 'Chapter 750',
};

describe('createAndOpenSelfInsert', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('reserves a tab before awaiting the bridge and navigates it to the exact chat', async () => {
    let resolveFetch: ((_value: unknown) => void) | undefined;
    global.fetch = vi.fn().mockReturnValue(new Promise((resolve) => {
      resolveFetch = resolve;
    }));
    const replace = vi.fn();
    const close = vi.fn();
    const portalTab = {
      opener: window,
      location: { replace },
      close,
    } as unknown as Window;
    vi.spyOn(window, 'open').mockReturnValue(portalTab);

    const pending = createAndOpenSelfInsert('https://bridge.example.test', request);

    expect(window.open).toHaveBeenCalledWith('', '_blank');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(replace).not.toHaveBeenCalled();

    resolveFetch?.({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: vi.fn().mockResolvedValue({
        success: true,
        chatUrl: 'https://asus.example.test:8000/?lfGroup=123',
        groupId: '123',
      }),
    });
    const result = await pending;

    expect(result.success).toBe(true);
    expect(replace).toHaveBeenCalledWith('https://asus.example.test:8000/?lfGroup=123');
    expect(close).not.toHaveBeenCalled();
    expect(portalTab.opener).toBeNull();
  });

  it('does not create bridge artifacts when the browser blocks the reserved tab', async () => {
    global.fetch = vi.fn();
    vi.spyOn(window, 'open').mockReturnValue(null);

    await expect(createAndOpenSelfInsert('https://bridge.example.test', request))
      .rejects.toBeInstanceOf(SelfInsertPopupBlockedError);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('closes the reserved tab when bridge creation fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      statusText: 'Unprocessable Entity',
      json: vi.fn().mockResolvedValue({
        success: false,
        error: 'no_characters_found',
        message: 'No cards matched.',
      }),
    });
    const close = vi.fn();
    vi.spyOn(window, 'open').mockReturnValue({
      opener: window,
      location: { replace: vi.fn() },
      close,
    } as unknown as Window);

    const result = await createAndOpenSelfInsert('https://bridge.example.test', request);

    expect(result.success).toBe(false);
    expect(close).toHaveBeenCalledTimes(1);
  });
});

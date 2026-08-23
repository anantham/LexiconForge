import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestSelfInsert, type SelfInsertRequest } from '../../services/selfInsertService';

const request: SelfInsertRequest = {
  chapterNumber: 750,
  characterNames: ['Li Yao'],
  selectedPassage: 'The formation shattered.',
  chapterTranslation: 'Full translated chapter.',
  chapterTitle: 'Chapter 750',
};

describe('requestSelfInsert', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('normalizes the bridge URL and accepts an HTTPS exact-chat URL', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: vi.fn().mockResolvedValue({
        success: true,
        chatUrl: 'https://asus.example.test:8000/?lfGroup=123',
        groupId: '123',
      }),
    });

    const result = await requestSelfInsert('https://bridge.example.test:5001/', request);

    expect(global.fetch).toHaveBeenCalledWith(
      'https://bridge.example.test:5001/api/self-insert',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result.success).toBe(true);
    expect(result.chatUrl).toContain('lfGroup=123');
  });

  it('rejects a successful response that lacks a safe exact-chat URL', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: vi.fn().mockResolvedValue({ success: true, chatUrl: 'javascript:alert(1)' }),
    });

    const result = await requestSelfInsert('https://bridge.example.test', request);

    expect(result).toEqual({
      success: false,
      error: 'bridge_error',
      message: 'Bridge did not return a safe exact-chat URL',
    });
  });

  it('preserves a descriptive bridge error response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      statusText: 'Unprocessable Entity',
      json: vi.fn().mockResolvedValue({
        success: false,
        error: 'no_characters_found',
        message: 'No chapter-bounded character cards matched.',
      }),
    });

    await expect(requestSelfInsert('https://bridge.example.test', request)).resolves.toEqual({
      success: false,
      error: 'no_characters_found',
      message: 'No chapter-bounded character cards matched.',
    });
  });
});

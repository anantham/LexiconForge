/**
 * Self-insert service — calls the novel-analyzer bridge to set up
 * a SillyTavern group chat for the current chapter.
 */

export interface SelfInsertRequest {
  chapterNumber: number;
  characterNames: string[];
  selectedPassage: string;
  chapterTranslation: string;
  chapterTitle: string;
}

export interface SelfInsertResponse {
  success: boolean;
  stUrl?: string;
  chatUrl?: string;
  groupId?: string;
  chatId?: string;
  charactersLoaded?: string[];
  charactersSkipped?: string[];
  error?: string;
  message?: string;
}

const normalizeBridgeUrl = (bridgeUrl: string): string => bridgeUrl.replace(/\/+$/, '');

const isSafePortalUrl = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ||
      (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname));
  } catch {
    return false;
  }
};

export async function requestSelfInsert(
  bridgeUrl: string,
  request: SelfInsertRequest,
  idempotencyKey: string = crypto.randomUUID(),
): Promise<SelfInsertResponse> {
  const resp = await fetch(`${normalizeBridgeUrl(bridgeUrl)}/api/self-insert`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(request),
  });

  let payload: unknown;
  try {
    payload = await resp.json();
  } catch {
    return {
      success: false,
      error: 'bridge_error',
      message: `Bridge returned ${resp.status} ${resp.statusText} without a valid JSON response`,
    };
  }

  if (!payload || typeof payload !== 'object') {
    return {
      success: false,
      error: 'bridge_error',
      message: 'Bridge returned an invalid response object',
    };
  }

  const result = payload as SelfInsertResponse;
  if (!resp.ok || result.success !== true) {
    return {
      success: false,
      error: result.error || 'bridge_error',
      message: result.message || `Bridge returned ${resp.status}: ${resp.statusText}`,
    };
  }

  if (!isSafePortalUrl(result.chatUrl)) {
    return {
      success: false,
      error: 'bridge_error',
      message: 'Bridge did not return a safe exact-chat URL',
    };
  }

  return result;
}

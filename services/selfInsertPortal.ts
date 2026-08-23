import {
  requestSelfInsert,
  type SelfInsertRequest,
  type SelfInsertResponse,
} from './selfInsertService';

export class SelfInsertPopupBlockedError extends Error {
  constructor() {
    super('The story portal was blocked. Allow popups for LexiconForge and try again.');
    this.name = 'SelfInsertPopupBlockedError';
  }
}

/**
 * Reserves the tab during the click's user-activation window, before any
 * network work begins. The bridge then supplies the exact group/chat URL.
 */
export async function createAndOpenSelfInsert(
  bridgeUrl: string,
  request: SelfInsertRequest,
): Promise<SelfInsertResponse> {
  const portalTab = window.open('', '_blank');
  if (!portalTab) {
    throw new SelfInsertPopupBlockedError();
  }

  portalTab.opener = null;
  const idempotencyKey = crypto.randomUUID();

  try {
    const result = await requestSelfInsert(bridgeUrl, request, idempotencyKey);
    if (!result.success || !result.chatUrl) {
      portalTab.close();
      return result;
    }

    portalTab.location.replace(result.chatUrl);
    return result;
  } catch (error) {
    portalTab.close();
    throw error;
  }
}

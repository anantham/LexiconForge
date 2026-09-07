import { normalizeSemanticBaseUrl } from './semanticOscilloscopeClient';
import {
  OWNER_SCAN_PATH, OWNER_SCAN_PROTOCOL, SCAN_ERRORS,
  parseOwnerScanRequest, parseOwnerScanReply,
} from './semanticScanProtocol';
import type { SemanticCorpusIdentity, SemanticScanResult } from './semanticScanProtocol';

// Call directly in a user gesture, before awaiting. Each window performs one scan.
export function scanInOwnerWindow(
  baseUrl: string, query: string, corpus: SemanticCorpusIdentity, signal: AbortSignal,
): Promise<SemanticScanResult> {
  const origin = normalizeSemanticBaseUrl(baseUrl);
  const request = parseOwnerScanRequest(JSON.stringify({
    protocol: OWNER_SCAN_PROTOCOL, type: 'scan', requestId: crypto.randomUUID(), corpus, query: query.trim(),
  }));
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(signal.reason); return; }
    let popup: Window | null = null;
    let sent = false;
    let settled = false;
    let deadline: ReturnType<typeof setTimeout>;
    const finish = (error?: Error, result?: SemanticScanResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      window.removeEventListener('message', receive);
      window.removeEventListener('focus', checkClosed);
      window.removeEventListener('pagehide', cancel);
      signal.removeEventListener('abort', cancel);
      popup?.close();
      if (error) reject(error); else resolve(result!);
    };
    const cancel = () => finish(new Error('Private scan cancelled because the reader selection changed or the scan was cancelled.'));
    const checkClosed = () => { if (popup?.closed) finish(new Error('Private scan window was closed. Select Scan to try again.')); };
    const timeout = () => finish(new Error(popup?.closed
      ? 'Private scan window was closed. Select Scan to try again.'
      : sent ? 'Private scan timed out. No automatic retry was made.'
        : 'Private scan window did not connect. Check owner access and popup permissions, then try again.'));
    const receive = (event: MessageEvent) => {
      if (event.origin !== origin || !popup || event.source !== popup) return;
      try {
        const message = parseOwnerScanReply(event.data, request);
        if (message.type === 'ready' && !sent) {
          sent = true;
          clearTimeout(deadline);
          deadline = setTimeout(timeout, 5 * 60_000);
          popup.postMessage(JSON.stringify(request), origin);
        } else if (message.type === 'result' && sent) finish(undefined, message.result);
        else if (message.type === 'error' && sent) finish(new Error(SCAN_ERRORS[message.code]));
        else finish(new Error('Private scan window sent an unexpected message.'));
      } catch (error) { finish(error instanceof Error ? error : new Error('Invalid private scan response.')); }
    };
    window.addEventListener('message', receive);
    window.addEventListener('focus', checkClosed);
    window.addEventListener('pagehide', cancel);
    signal.addEventListener('abort', cancel, { once: true });
    deadline = setTimeout(timeout, 30_000);
    try {
      popup = window.open(`${origin}${OWNER_SCAN_PATH}`, '_blank', 'popup,width=440,height=320');
      if (!popup) finish(new Error('Private scan window was blocked. Allow popups for this reader and select Scan again.'));
    } catch { finish(new Error('Private scan window could not open. Check popup permissions and try again.')); }
  });
}

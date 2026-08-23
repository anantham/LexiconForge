/**
 * SillyTavern self-insert bridge — reachability check.
 *
 * The bridge is an external uvicorn service (default http://localhost:5001).
 * It powers the portal/self-insert button surfaced in the selection popover.
 *
 * Issue #4 follow-on: when the bridge isn't running, hiding the button
 * entirely beats showing one that fails. This module owns the ping logic.
 *
 * The versioned bridge exposes a CORS-enabled `/health` contract. The portal
 * is reachable only when both the bridge and its local SillyTavern dependency
 * are ready, so a stale proxy cannot make the button appear functional.
 */

// Allow first-use tailnet TLS establishment without making the portal flap.
const PING_TIMEOUT_MS = 5000;

interface BridgeHealthResponse {
  ready?: boolean;
  message?: string;
}

const normalizeBridgeUrl = (bridgeUrl: string): string => bridgeUrl.replace(/\/+$/, '');

export type BridgeStatus =
  | { state: 'unknown' }
  | { state: 'reachable'; checkedAt: number }
  | { state: 'unreachable'; checkedAt: number; reason: string };

export async function pingSillyTavernBridge(
  bridgeUrl: string | null | undefined,
): Promise<BridgeStatus> {
  if (!bridgeUrl || !bridgeUrl.trim()) {
    return {
      state: 'unreachable',
      checkedAt: Date.now(),
      reason: 'No bridge URL configured',
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
  try {
    const response = await fetch(`${normalizeBridgeUrl(bridgeUrl)}/health`, {
      method: 'GET',
      mode: 'cors',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Health check returned ${response.status} ${response.statusText}`);
    }
    const health = await response.json() as BridgeHealthResponse;
    if (health.ready !== true) {
      throw new Error(health.message || 'Bridge is running but SillyTavern is not ready');
    }
    clearTimeout(timeout);
    return { state: 'reachable', checkedAt: Date.now() };
  } catch (err) {
    clearTimeout(timeout);
    const reason = err instanceof Error ? err.message : String(err);
    return { state: 'unreachable', checkedAt: Date.now(), reason };
  }
}

/**
 * Higher-level helper for components: returns just true/false. Treats
 * 'unknown' as unreachable so the button stays hidden until first check
 * resolves.
 */
export const isBridgeReachable = (status: BridgeStatus): boolean =>
  status.state === 'reachable';

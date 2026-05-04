/**
 * SillyTavern self-insert bridge — reachability check.
 *
 * The bridge is an external uvicorn service (default http://localhost:5001).
 * It powers the portal/self-insert button surfaced in the selection popover.
 *
 * Issue #4 follow-on: when the bridge isn't running, hiding the button
 * entirely beats showing one that fails. This module owns the ping logic.
 *
 * CORS note: bridge.py only allows POST. A regular GET ping would be blocked
 * by CORS preflight rules. Using `mode: 'no-cors'` returns an opaque response
 * if the server is reachable; throws TypeError if not. We can't read status
 * codes that way, but we can reliably distinguish "server up" from "server down."
 */

const PING_TIMEOUT_MS = 1500;

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
    await fetch(bridgeUrl, {
      method: 'GET',
      mode: 'no-cors',
      signal: controller.signal,
    });
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

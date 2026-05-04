/**
 * Bridge reachability hook for the SillyTavern self-insert feature.
 *
 * Subscribes to the user's `enableSillyTavern` + `sillyTavernBridgeUrl`
 * settings and pings the bridge whenever they change. Components that
 * render the portal button should hide it when the bridge isn't reachable
 * (issue #4 follow-on).
 *
 * Re-pings:
 *   - on mount
 *   - when bridgeUrl or enableSillyTavern changes
 *   - on manual `refresh()` call (e.g., from the Test Connection button)
 */
import { useCallback, useEffect, useState } from 'react';
import { useAppStore } from '../store';
import {
  pingSillyTavernBridge,
  type BridgeStatus,
  isBridgeReachable,
} from '../services/sillyTavernBridge';

export interface UseSillyTavernBridgeStatusReturn {
  status: BridgeStatus;
  isReachable: boolean;
  refresh: () => Promise<BridgeStatus>;
  isChecking: boolean;
}

export function useSillyTavernBridgeStatus(): UseSillyTavernBridgeStatusReturn {
  const enableSillyTavern = useAppStore((s) => s.settings.enableSillyTavern);
  const bridgeUrl = useAppStore((s) => s.settings.sillyTavernBridgeUrl);

  const [status, setStatus] = useState<BridgeStatus>({ state: 'unknown' });
  const [isChecking, setIsChecking] = useState(false);

  const refresh = useCallback(async (): Promise<BridgeStatus> => {
    if (!enableSillyTavern) {
      const next: BridgeStatus = {
        state: 'unreachable',
        checkedAt: Date.now(),
        reason: 'Self-insert is disabled in settings',
      };
      setStatus(next);
      return next;
    }
    setIsChecking(true);
    try {
      const next = await pingSillyTavernBridge(bridgeUrl);
      setStatus(next);
      return next;
    } finally {
      setIsChecking(false);
    }
  }, [enableSillyTavern, bridgeUrl]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next = await refresh();
      if (cancelled) return;
      void next; // already set inside refresh
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  return {
    status,
    isReachable: isBridgeReachable(status) && !!enableSillyTavern,
    refresh,
    isChecking,
  };
}

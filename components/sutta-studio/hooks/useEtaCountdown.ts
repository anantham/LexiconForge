import { useEffect, useRef, useState } from 'react';

type EtaBase = {
  etaMs: number;
  startedAt: number;
};

export function useEtaCountdown(etaMs?: number | null, active: boolean = true) {
  const baseRef = useRef<EtaBase | null>(null);
  const [, forceTick] = useState(0);

  useEffect(() => {
    if (!active || !etaMs || etaMs <= 0) {
      baseRef.current = null;
      return;
    }
    baseRef.current = { etaMs, startedAt: Date.now() };
    forceTick((t) => t + 1);
  }, [etaMs, active]);

  useEffect(() => {
    if (!active || !baseRef.current) return;
    const id = setInterval(() => {
      forceTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [active, etaMs]);

  if (!baseRef.current) return null;
  const elapsed = Date.now() - baseRef.current.startedAt;
  return baseRef.current.etaMs - elapsed;
}

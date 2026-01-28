type PhaseTimingStore = {
  samples: number[];
  emaMs?: number;
};

const GLOBAL_KEY = 'sutta-studio:phase-times:global';
const keyForUid = (uid: string) => `sutta-studio:phase-times:${uid}`;
const MAX_SAMPLES = 12;
const EMA_ALPHA = 0.35;

const normalizeSamples = (samples: unknown): number[] => {
  if (!Array.isArray(samples)) return [];
  return samples
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0)
    .map((value) => Math.round(value))
    .slice(-MAX_SAMPLES);
};

const computeEma = (samples: number[]): number | null => {
  if (!samples.length) return null;
  let ema = samples[0];
  for (let i = 1; i < samples.length; i++) {
    ema = EMA_ALPHA * samples[i] + (1 - EMA_ALPHA) * ema;
  }
  return Math.round(ema);
};

const loadStore = (key: string): PhaseTimingStore => {
  if (typeof localStorage === 'undefined') return { samples: [] };
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { samples: [] };
    const parsed = JSON.parse(raw) as PhaseTimingStore;
    const samples = normalizeSamples(parsed.samples);
    const emaMs = Number.isFinite(parsed.emaMs) ? Math.round(parsed.emaMs as number) : undefined;
    return {
      samples,
      emaMs: emaMs ?? computeEma(samples) ?? undefined,
    };
  } catch {
    return { samples: [] };
  }
};

const saveStore = (key: string, store: PhaseTimingStore) => {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(store));
  } catch {
    // ignore storage errors
  }
};

const pushSample = (samples: number[], ms: number) => {
  const next = [...samples, ms].slice(-MAX_SAMPLES);
  return next;
};

const updateEma = (previous: number | null, nextSample: number) => {
  if (!previous) return nextSample;
  return Math.round(EMA_ALPHA * nextSample + (1 - EMA_ALPHA) * previous);
};

export const recordPhaseDuration = (uid: string, ms: number) => {
  const trimmed = Math.max(0, Math.round(ms));
  if (!trimmed) return;

  const uidStore = loadStore(keyForUid(uid));
  const uidPrevEma = uidStore.emaMs ?? computeEma(uidStore.samples);
  uidStore.samples = pushSample(uidStore.samples, trimmed);
  uidStore.emaMs = updateEma(uidPrevEma, trimmed);
  saveStore(keyForUid(uid), uidStore);

  const globalStore = loadStore(GLOBAL_KEY);
  const globalPrevEma = globalStore.emaMs ?? computeEma(globalStore.samples);
  globalStore.samples = pushSample(globalStore.samples, trimmed);
  globalStore.emaMs = updateEma(globalPrevEma, trimmed);
  saveStore(GLOBAL_KEY, globalStore);
};

const resolveEstimate = (store: PhaseTimingStore): number | null => {
  if (store.emaMs && store.emaMs > 0) return store.emaMs;
  if (store.samples.length) return computeEma(store.samples);
  return null;
};

export const getAveragePhaseDuration = (uid: string): number | null => {
  const uidEstimate = resolveEstimate(loadStore(keyForUid(uid)));
  if (uidEstimate) return uidEstimate;
  return resolveEstimate(loadStore(GLOBAL_KEY));
};

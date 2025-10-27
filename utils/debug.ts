export type DebugLevel = 'off' | 'summary' | 'full';
export type DebugPipeline =
  | 'indexeddb'
  | 'comparison'
  | 'audio'
  | 'worker'
  | 'translation'
  | 'image'
  | 'memory'
  | 'api'
  | 'diff'
  | 'import'
  | 'navigation';

export const KNOWN_DEBUG_PIPELINES: DebugPipeline[] = [
  'indexeddb',
  'comparison',
  'audio',
  'worker',
  'translation',
  'image',
  'memory',
  'api',
  'diff',
  'import',
  'navigation',
];

const LEGACY_SUMMARY_FLAG = 'LF_AI_DEBUG';
const LEGACY_FULL_FLAG = 'LF_AI_DEBUG_FULL';
const LEVEL_KEY = 'LF_AI_DEBUG_LEVEL';
const PIPELINES_KEY = 'LF_DEBUG_PIPELINES';

const parseDebugLevel = (): DebugLevel => {
  try {
    const stored = localStorage.getItem(LEVEL_KEY) as DebugLevel | null;
    if (stored === 'off' || stored === 'summary' || stored === 'full') {
      return stored;
    }
    const legacyFull = localStorage.getItem(LEGACY_FULL_FLAG) === '1';
    const legacySummary = localStorage.getItem(LEGACY_SUMMARY_FLAG) === '1';
    if (legacyFull) return 'full';
    if (legacySummary) return 'summary';
    return 'full';
  } catch {
    return 'full';
  }
};

const parseDebugPipelines = (): { pipelines: DebugPipeline[]; configured: boolean } => {
  try {
    const raw = localStorage.getItem(PIPELINES_KEY);
    if (raw === null) {
      return { pipelines: [], configured: false };
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return { pipelines: [], configured: true };
    }
    const normalized = parsed
      .map((value) => {
        if (typeof value === 'string') {
          return value.trim();
        }
        return null;
      })
      .filter((value): value is string => !!value)
      .filter((value): value is DebugPipeline => (KNOWN_DEBUG_PIPELINES as string[]).includes(value));
    return { pipelines: Array.from(new Set(normalized)), configured: true };
  } catch {
    return { pipelines: [], configured: true };
  }
};

export const getDebugLevel = (): DebugLevel => parseDebugLevel();

export const getDebugPipelines = (): DebugPipeline[] => {
  const { pipelines } = parseDebugPipelines();
  return pipelines;
};

export const logCurrentDebugConfig = (): void => {
  const level = getDebugLevel();
  const pipelines = getDebugPipelines();
  console.log('[DebugConfig] Logging level:', level);
  console.log('[DebugConfig] Enabled pipelines:', pipelines.length ? pipelines.join(', ') : '(all)');
};

export const setDebugPipelines = (pipelines: DebugPipeline[]): void => {
  try {
    if (pipelines.length === 0) {
      localStorage.removeItem(PIPELINES_KEY);
    } else {
      const normalized = pipelines.filter((pipeline) => KNOWN_DEBUG_PIPELINES.includes(pipeline));
      localStorage.setItem(PIPELINES_KEY, JSON.stringify(Array.from(new Set(normalized))));
    }
  } catch {}
};

export const debugPipelineEnabled = (
  pipeline: DebugPipeline,
  minimum: 'summary' | 'full' = 'summary'
): boolean => {
  const level = parseDebugLevel();
  if (minimum === 'full' && level !== 'full') return false;
  if (minimum === 'summary' && level === 'off') return false;

  const { pipelines, configured } = parseDebugPipelines();
  if (!configured || pipelines.length === 0) return true; // default: log all pipelines until explicitly configured or explicitly cleared
  return pipelines.includes(pipeline);
};

export const debugLog = (
  pipeline: DebugPipeline,
  minimum: 'summary' | 'full',
  prefix: string,
  ...args: any[]
): void => {
  if (!debugPipelineEnabled(pipeline, minimum)) return;
  console.log(prefix, ...args);
};

export const debugWarn = (
  pipeline: DebugPipeline,
  minimum: 'summary' | 'full',
  prefix: string,
  ...args: any[]
): void => {
  if (!debugPipelineEnabled(pipeline, minimum)) return;
  console.warn(prefix, ...args);
};

export const dbDebugEnabled = (minimum: 'summary' | 'full' = 'summary'): boolean =>
  debugPipelineEnabled('indexeddb', minimum);

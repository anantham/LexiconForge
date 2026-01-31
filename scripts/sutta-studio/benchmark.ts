import fs from 'fs/promises';
import path from 'path';
import { getModelPricing, supportsStructuredOutputs } from '../../services/capabilityService';
import {
  runAnatomistPass,
  runLexicographerPass,
  runMorphologyPass,
  runSkeletonPass,
  runTypesetterPass,
  runWeaverPass,
  type LLMCaller,
  type PassName,
} from '../../services/suttaStudioPassRunners';
import type { SkeletonPhase } from '../../services/suttaStudioPassPrompts';
import { SUTTA_STUDIO_PROMPT_VERSION } from '../../services/suttaStudioPromptVersion';
import type {
  AnatomistPass,
  CanonicalSegment,
  LexicographerPass,
  PhaseView,
  TypesetterPass,
  WeaverPass,
} from '../../types/suttaStudio';
import { BENCHMARK_CONFIG, resolveSettingsForModel, type AnatomistFixtureConfig } from './benchmark-config';
import {
  assemblePipelineToPacket,
  type PipelinePhaseOutput,
} from '../../services/suttaStudioPipelineAssembler';
import {
  scorePhase,
  type PipelineOutput,
  type QualityScore,
} from './quality-scorer';
import { generateLeaderboard } from './generate-leaderboard';

type MetricRow = {
  timestamp: string;
  runId: string;
  pass: PassName;
  stage: 'pass' | 'chunk' | 'aggregate';
  provider: string | null;
  model: string | null;
  promptVersion: string;
  structuredOutputs: boolean | null;
  durationMs: number | null;
  costUsd: number | null;
  tokensPrompt: number | null;
  tokensCompletion: number | null;
  tokensTotal: number | null;
  success: boolean;
  errorMessage: string | null;
  schemaName: string | null;
  requestName: string | null;
  phaseId: string | null;
  chunkIndex: number | null;
  chunkCount: number | null;
  segmentCount: number | null;
  dependencyMode: string;
  fixturePhase: string;
  workId: string;
};

type FixturePhase = {
  canonicalSegments: CanonicalSegment[];
  anatomist: AnatomistPass;
  lexicographer: LexicographerPass;
  weaver: WeaverPass;
  typesetter: TypesetterPass;
  expectedPhaseView: PhaseView;
  _title?: string;
  _english?: string;
};

type SkeletonFixture = {
  canonicalSegments: CanonicalSegment[];
  expectedPhases?: SkeletonPhase[];
  _title?: string;
  _notes?: string;
};

type GoldenFixture = Record<string, unknown> & {
  phase1?: FixturePhase;
  phase2?: FixturePhase;
  skeleton?: SkeletonFixture;
};

type AnatomistGoldenFixture = {
  _description: string;
  _generatedAt: string;
  _source: string;
  _phases: Array<{
    phaseId: string;
    canonicalSegmentIds: string[];
    wordCount: number;
    segmentCount: number;
    relationCount: number;
    wordRange?: [number, number]; // [start, end) indices for sub-segment splitting
  }>;
  anatomist: Record<string, AnatomistPass>;
};

type LexicographerGoldenFixture = {
  _description: string;
  _generatedAt: string;
  _source: string;
  _phases: Array<{ phaseId: string; wordSenseCount: number; segmentSenseCount: number }>;
  lexicographer: Record<string, LexicographerPass>;
};

type WeaverGoldenFixture = {
  _description: string;
  _generatedAt: string;
  _source: string;
  _phases: Array<{ phaseId: string; tokenCount: number; ghostCount: number; linkedCount: number }>;
  weaver: Record<string, WeaverPass>;
};

type TypesetterGoldenFixture = {
  _description: string;
  _generatedAt: string;
  _source: string;
  _phases: Array<{ phaseId: string; blockCount: number; totalWords: number }>;
  typesetter: Record<string, TypesetterPass>;
};

type AllGoldenFixtures = {
  anatomist: AnatomistGoldenFixture;
  lexicographer: LexicographerGoldenFixture;
  weaver: WeaverGoldenFixture;
  typesetter: TypesetterGoldenFixture;
  allSegments: CanonicalSegment[];
};

const CSV_HEADERS: Array<keyof MetricRow> = [
  'timestamp',
  'runId',
  'pass',
  'stage',
  'provider',
  'model',
  'promptVersion',
  'structuredOutputs',
  'durationMs',
  'costUsd',
  'tokensPrompt',
  'tokensCompletion',
  'tokensTotal',
  'success',
  'errorMessage',
  'schemaName',
  'requestName',
  'phaseId',
  'chunkIndex',
  'chunkCount',
  'segmentCount',
  'dependencyMode',
  'fixturePhase',
  'workId',
];

const toCsvValue = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const writeCsv = async (rows: MetricRow[], outputPath: string) => {
  const headerRow = CSV_HEADERS.join(',');
  const dataRows = rows.map((row) =>
    CSV_HEADERS.map((key) => toCsvValue(row[key])).join(',')
  );
  const csv = [headerRow, ...dataRows].join('\n');
  await fs.writeFile(outputPath, csv, 'utf8');
};

type BenchIndexEntry = {
  id: string;
  kind: 'golden' | 'run';
  timestamp: string;
  runId: string;
  provider?: string | null;
  model?: string | null;
  segmentsCount?: number | null;
  phasesCount?: number | null;
  durationMsTotal?: number | null;
  costUsdTotal?: number | null;
  tokensPromptTotal?: number | null;
  tokensCompletionTotal?: number | null;
  tokensTotal?: number | null;
  rowCount?: number | null;
  missingDurationCount?: number | null;
  missingCostCount?: number | null;
  missingTokenCount?: number | null;
  path: string;
};

type BenchIndexPayload = {
  generatedAt: string;
  latestTimestamp: string | null;
  entries: BenchIndexEntry[];
};

type BenchProgressStatus = 'running' | 'complete' | 'error';

type BenchProgressState = {
  status: BenchProgressStatus;
  startedAt: string;
  updatedAt: string;
  timestamp: string;
  outputDir: string;
  progressPath: string;
  runsTotal: number;
  repeatTotal: number;
  passesTotal: number;
  skeletonChunkEstimate: number;
  stepsTotal: number;
  stepsCompleted: number;
  percent: number;
  errors: Array<{
    at: string;
    runId: string;
    pass: PassName | null;
    stage: MetricRow['stage'] | null;
    message: string;
    chunkIndex?: number | null;
    chunkCount?: number | null;
  }>;
  current?: {
    runId: string;
    model: string | null;
    provider: string | null;
    pass: PassName | null;
    stage: MetricRow['stage'] | null;
    passIndex: number | null;
    runIndex: number | null;
    repeatIndex: number | null;
    chunkIndex: number | null;
    chunkCount: number | null;
  } | null;
  message?: string | null;
  error?: string | null;
};

const pathExists = async (filePath: string) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

const toWebPath = (filePath: string) => {
  const rel = path.relative(process.cwd(), filePath);
  return `/${rel.split(path.sep).join('/')}`;
};

const summarizeMetricsByRun = async (metricsPath: string) => {
  if (!(await pathExists(metricsPath))) return new Map<string, Partial<BenchIndexEntry>>();
  const raw = await fs.readFile(metricsPath, 'utf8');
  const parsed = JSON.parse(raw) as { rows?: MetricRow[] };
  const rows = Array.isArray(parsed.rows) ? parsed.rows : [];
  const summaryMap = new Map<string, Partial<BenchIndexEntry>>();

  for (const row of rows) {
    const includeRow = row.stage === 'pass' || (row.pass === 'skeleton' && row.stage === 'chunk');
    if (!includeRow) continue;
    const runId = row.runId;
    const current = summaryMap.get(runId) ?? {
      durationMsTotal: 0,
      costUsdTotal: 0,
      tokensPromptTotal: 0,
      tokensCompletionTotal: 0,
      tokensTotal: 0,
      rowCount: 0,
      missingDurationCount: 0,
      missingCostCount: 0,
      missingTokenCount: 0,
    };

    current.rowCount = (current.rowCount ?? 0) + 1;

    if (typeof row.durationMs === 'number') {
      current.durationMsTotal = (current.durationMsTotal ?? 0) + row.durationMs;
    } else {
      current.missingDurationCount = (current.missingDurationCount ?? 0) + 1;
    }

    if (typeof row.costUsd === 'number') {
      current.costUsdTotal = (current.costUsdTotal ?? 0) + row.costUsd;
    } else {
      current.missingCostCount = (current.missingCostCount ?? 0) + 1;
    }

    const hasPrompt = typeof row.tokensPrompt === 'number';
    const hasCompletion = typeof row.tokensCompletion === 'number';
    const hasTotal = typeof row.tokensTotal === 'number';

    if (hasPrompt) {
      current.tokensPromptTotal = (current.tokensPromptTotal ?? 0) + row.tokensPrompt;
    }

    if (hasCompletion) {
      current.tokensCompletionTotal =
        (current.tokensCompletionTotal ?? 0) + row.tokensCompletion;
    }

    if (hasTotal) {
      current.tokensTotal = (current.tokensTotal ?? 0) + row.tokensTotal;
    }

    if (!hasPrompt || !hasCompletion) {
      current.missingTokenCount = (current.missingTokenCount ?? 0) + 1;
    }

    summaryMap.set(runId, current);
  }

  // Normalize zero totals to null if every row was missing for that field.
  summaryMap.forEach((value) => {
    if ((value.rowCount ?? 0) === (value.missingDurationCount ?? 0)) {
      value.durationMsTotal = null;
    }
    if ((value.rowCount ?? 0) === (value.missingCostCount ?? 0)) {
      value.costUsdTotal = null;
    }
    if ((value.rowCount ?? 0) === (value.missingTokenCount ?? 0)) {
      value.tokensPromptTotal = null;
      value.tokensCompletionTotal = null;
      value.tokensTotal = null;
    }
  });

  return summaryMap;
};

const buildBenchIndex = async (outputRoot: string): Promise<BenchIndexPayload> => {
  const entries: BenchIndexEntry[] = [];
  const rootAbs = path.resolve(outputRoot);
  let latestTimestamp: string | null = null;

  const timestampDirs = await fs.readdir(rootAbs, { withFileTypes: true }).catch(() => []);

  for (const dirent of timestampDirs) {
    if (!dirent.isDirectory()) continue;
    const timestamp = dirent.name;
    if (!latestTimestamp || timestamp > latestTimestamp) {
      latestTimestamp = timestamp;
    }

    const metricsPath = path.join(rootAbs, timestamp, 'metrics.json');
    const summaryMap = await summarizeMetricsByRun(metricsPath);
    const outputsDir = path.join(rootAbs, timestamp, 'outputs');
    if (!(await pathExists(outputsDir))) continue;

    const goldenPath = path.join(outputsDir, 'skeleton-golden.json');
    if (await pathExists(goldenPath)) {
      const goldenData = JSON.parse(await fs.readFile(goldenPath, 'utf8')) as any;
      entries.push({
        id: `${timestamp}::golden`,
        kind: 'golden',
        timestamp,
        runId: 'golden',
        provider: null,
        model: 'golden',
        segmentsCount: Array.isArray(goldenData?.segments) ? goldenData.segments.length : null,
        phasesCount: Array.isArray(goldenData?.phases) ? goldenData.phases.length : null,
        path: toWebPath(goldenPath),
      });
    }

    const runDirs = await fs.readdir(outputsDir, { withFileTypes: true }).catch(() => []);
    for (const runDir of runDirs) {
      if (!runDir.isDirectory()) continue;
      const aggregatePath = path.join(outputsDir, runDir.name, 'skeleton-aggregate.json');
      if (!(await pathExists(aggregatePath))) continue;
      const aggregate = JSON.parse(await fs.readFile(aggregatePath, 'utf8')) as any;
      const runId = aggregate?.runId ?? runDir.name;
      const metricsSummary = summaryMap.get(runId);
      entries.push({
        id: `${timestamp}::${runId}`,
        kind: 'run',
        timestamp,
        runId,
        provider: aggregate?.provider ?? null,
        model: aggregate?.model ?? null,
        segmentsCount: Array.isArray(aggregate?.segments) ? aggregate.segments.length : null,
        phasesCount: Array.isArray(aggregate?.phases) ? aggregate.phases.length : null,
        durationMsTotal: metricsSummary?.durationMsTotal ?? null,
        costUsdTotal: metricsSummary?.costUsdTotal ?? null,
        tokensPromptTotal: metricsSummary?.tokensPromptTotal ?? null,
        tokensCompletionTotal: metricsSummary?.tokensCompletionTotal ?? null,
        tokensTotal: metricsSummary?.tokensTotal ?? null,
        rowCount: metricsSummary?.rowCount ?? null,
        missingDurationCount: metricsSummary?.missingDurationCount ?? null,
        missingCostCount: metricsSummary?.missingCostCount ?? null,
        missingTokenCount: metricsSummary?.missingTokenCount ?? null,
        path: toWebPath(aggregatePath),
      });
    }
  }

  entries.sort((a, b) => {
    const timeCmp = b.timestamp.localeCompare(a.timestamp);
    if (timeCmp !== 0) return timeCmp;
    return a.runId.localeCompare(b.runId);
  });

  return {
    generatedAt: new Date().toISOString(),
    latestTimestamp,
    entries,
  };
};

const writeBenchIndex = async (outputRoot: string) => {
  const payload = await buildBenchIndex(outputRoot);
  const indexPath = path.resolve(outputRoot, 'index.json');
  await fs.writeFile(indexPath, JSON.stringify(payload, null, 2), 'utf8');
};

const writeProgressState = async (
  progressRoot: string,
  progressFile: string,
  state: BenchProgressState
) => {
  await fs.writeFile(progressFile, JSON.stringify(state, null, 2), 'utf8');
  const pointerPath = path.join(progressRoot, 'active-run.json');
  const pointerPayload = {
    updatedAt: state.updatedAt,
    status: state.status,
    progressPath: state.progressPath,
    timestamp: state.timestamp,
    stepsCompleted: state.stepsCompleted,
    stepsTotal: state.stepsTotal,
    percent: state.percent,
    current: state.current ?? null,
    message: state.message ?? null,
    error: state.error ?? null,
    errors: state.errors,
  };
  await fs.writeFile(pointerPath, JSON.stringify(pointerPayload, null, 2), 'utf8');
};

const addProgressError = (
  state: BenchProgressState,
  payload: Omit<BenchProgressState['errors'][number], 'at'>
) => {
  state.errors.push({ at: new Date().toISOString(), ...payload });
};

const toMetricRow = (params: {
  runId: string;
  pass: PassName;
  stage: MetricRow['stage'];
  promptVersion: string;
  structuredOutputs: boolean | null;
  provider: string | null;
  model: string | null;
  durationMs: number | null;
  costUsd: number | null;
  tokensPrompt: number | null;
  tokensCompletion: number | null;
  tokensTotal: number | null;
  success: boolean;
  errorMessage?: string | null;
  schemaName?: string | null;
  requestName?: string | null;
  phaseId?: string | null;
  chunkIndex?: number | null;
  chunkCount?: number | null;
  segmentCount?: number | null;
  dependencyMode: string;
  fixturePhase: string;
  workId: string;
}): MetricRow => ({
  timestamp: new Date().toISOString(),
  runId: params.runId,
  pass: params.pass,
  stage: params.stage,
  provider: params.provider,
  model: params.model,
  promptVersion: params.promptVersion,
  structuredOutputs: params.structuredOutputs,
  durationMs: params.durationMs,
  costUsd: params.costUsd,
  tokensPrompt: params.tokensPrompt,
  tokensCompletion: params.tokensCompletion,
  tokensTotal: params.tokensTotal,
  success: params.success,
  errorMessage: params.errorMessage ?? null,
  schemaName: params.schemaName ?? null,
  requestName: params.requestName ?? null,
  phaseId: params.phaseId ?? null,
  chunkIndex: params.chunkIndex ?? null,
  chunkCount: params.chunkCount ?? null,
  segmentCount: params.segmentCount ?? null,
  dependencyMode: params.dependencyMode,
  fixturePhase: params.fixturePhase,
  workId: params.workId,
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const parseRetryAfterMs = (value: string | null): number | null => {
  if (!value) return null;
  const seconds = Number(value);
  if (!Number.isNaN(seconds)) {
    return Math.max(0, Math.round(seconds * 1000));
  }
  const dateMs = Date.parse(value);
  if (!Number.isNaN(dateMs)) {
    return Math.max(0, dateMs - Date.now());
  }
  return null;
};

const shouldRetryStatus = (status: number) => status === 429 || (status >= 500 && status < 600);

const isRetryableNetworkError = (error: any) => {
  const message = String(error?.message ?? '').toLowerCase();
  return (
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('econnreset') ||
    message.includes('enotfound')
  );
};

type ProviderPreferences = {
  order?: string[];
  allow_fallbacks?: boolean;
};

/** Factory function to create an LLMCaller with optional provider preferences */
/** Request timeout in ms (10 minutes - some reasoning models take longer) */
const LLM_REQUEST_TIMEOUT_MS = 10 * 60 * 1000;

const createOpenRouterLLMCaller = (modelProviderPrefs?: ProviderPreferences): LLMCaller => {
  return async ({ settings, messages, signal, maxTokens, options }) => {
    const apiKey = (settings as any).apiKeyOpenRouter || process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('Missing OPENROUTER_API_KEY for benchmark runs.');
    }

    // Merge model-level provider preferences with any request-level preferences
    const providerPreferences = {
      ...modelProviderPrefs,
      ...options?.providerPreferences,
    };

    const useStructured = Boolean(options?.schema) && Boolean(options?.structuredOutputs);
  let requestBody: Record<string, any> = {
    model: settings.model,
    messages,
    max_tokens: maxTokens ?? 4000,
    temperature: 0.2,
  };

    if (useStructured && options?.schema) {
      requestBody.response_format = {
        type: 'json_schema',
        json_schema: {
          name: options.schemaName || 'sutta_studio_response',
          schema: options.schema,
          strict: true,
        },
      };
      requestBody.provider = {
        require_parameters: true,
        ...providerPreferences,
      };
    } else {
      requestBody.response_format = { type: 'json_object' };
      // Still apply provider preferences for non-structured outputs
      if (Object.keys(providerPreferences).length > 0) {
        requestBody.provider = { ...providerPreferences };
      }
    }

  const start = performance.now();
  const doFetch = async (body: Record<string, any>) => {
    // Create abort controller with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LLM_REQUEST_TIMEOUT_MS);

    // Combine with external signal if provided
    if (signal) {
      signal.addEventListener('abort', () => controller.abort());
    }

    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost',
          'X-Title': 'LexiconForge SuttaStudio Benchmark',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const rawText = await res.text();
      let json: any = {};
      if (rawText) {
        try {
          json = JSON.parse(rawText);
        } catch {
          json = { message: rawText };
        }
      }
      if (!res.ok) {
        const message = json?.error?.message || json?.message || `HTTP ${res.status}`;
        const err = new Error(message);
        (err as any).raw = json;
        (err as any).status = res.status;
        (err as any).retryAfterMs = parseRetryAfterMs(res.headers.get('retry-after'));
        throw err;
      }
      return json;
    } finally {
      clearTimeout(timeout);
    }
  };

  const maxRetries = 2;
  const baseDelayMs = 1500;
  let response: any;
  let attempt = 0;
  let structuredFallbackApplied = false;
  while (attempt <= maxRetries) {
    try {
      response = await doFetch(requestBody);
      break;
    } catch (error: any) {
      if (
        useStructured &&
        !structuredFallbackApplied &&
        /response_format|structured_outputs|not supported/i.test(error?.message || '')
      ) {
        requestBody = { ...requestBody, response_format: { type: 'json_object' } };
        structuredFallbackApplied = true;
        continue;
      }
      const status = typeof error?.status === 'number' ? error.status : null;
      const retryable =
        (status !== null && shouldRetryStatus(status)) || (status === null && isRetryableNetworkError(error));
      if (!retryable || attempt === maxRetries) {
        throw error;
      }
      const retryAfterMs =
        typeof error?.retryAfterMs === 'number' && error.retryAfterMs > 0 ? error.retryAfterMs : null;
      const backoffMs = Math.min(10_000, baseDelayMs * 2 ** attempt);
      const jitterMs = Math.round(Math.random() * 300);
      const delayMs = retryAfterMs ?? backoffMs + jitterMs;
      await sleep(delayMs);
      attempt += 1;
    }
  }

  const durationMs = Math.max(0, Math.round(performance.now() - start));
  const text = response?.choices?.[0]?.message?.content ?? '';
  if (!text.trim()) {
    // Debug: log the full response when content is empty
    console.error('[DEBUG] Empty response from model. Full response:', JSON.stringify({
      id: response?.id,
      model: response?.model,
      choices: response?.choices?.map((c: any) => ({
        index: c.index,
        finish_reason: c.finish_reason,
        message: c.message,
      })),
      usage: response?.usage,
      error: response?.error,
    }, null, 2));
    throw new Error('Empty compiler response.');
  }

  const promptTokens = response?.usage?.prompt_tokens ?? null;
  const completionTokens = response?.usage?.completion_tokens ?? null;
  const totalTokens =
    typeof promptTokens === 'number' && typeof completionTokens === 'number'
      ? promptTokens + completionTokens
      : null;
  let costUsd: number | null = null;
  if (typeof promptTokens === 'number' && typeof completionTokens === 'number') {
    try {
      const pricing = await getModelPricing(settings.model);
      if (pricing) {
        costUsd =
          (promptTokens / 1_000_000) * pricing.input +
          (completionTokens / 1_000_000) * pricing.output;
      }
    } catch {
      costUsd = null;
    }
  }

    return {
      text,
      tokens: {
        prompt: typeof promptTokens === 'number' ? promptTokens : undefined,
        completion: typeof completionTokens === 'number' ? completionTokens : undefined,
        total: typeof totalTokens === 'number' ? totalTokens : undefined,
      },
      costUsd: costUsd ?? undefined,
      model: response?.model ?? settings.model,
      raw: response,
      provider: settings.provider,
      durationMs,
    };
  };
};

// Default caller without provider preferences (for backward compatibility)
const openRouterLLMCaller = createOpenRouterLLMCaller();

const normalizePhaseId = <T extends { id: string }>(input: T, phaseId: string): T => ({
  ...input,
  id: phaseId,
});

const loadFixture = async (): Promise<{
  phase: FixturePhase;
  phaseKey: string;
  skeletonSegments: CanonicalSegment[];
  skeletonPhases: SkeletonPhase[] | null;
  skeletonSource: 'fixture' | 'phase1+phase2' | 'none';
}> => {
  const fixturePath = path.resolve(BENCHMARK_CONFIG.fixture.path);
  const raw = await fs.readFile(fixturePath, 'utf8');
  const parsed = JSON.parse(raw) as GoldenFixture;
  const phaseKey = BENCHMARK_CONFIG.fixture.phaseKey;
  const phase = parsed[phaseKey];
  if (!phase) {
    throw new Error(`Fixture phase "${phaseKey}" not found in ${fixturePath}.`);
  }

  let skeletonSegments: CanonicalSegment[] = [];
  let skeletonPhases: SkeletonPhase[] | null = null;
  let skeletonSource: 'fixture' | 'phase1+phase2' | 'none' = 'none';
  const fixtureSkeleton = parsed.skeleton;

  if (fixtureSkeleton?.canonicalSegments?.length) {
    skeletonSegments = fixtureSkeleton.canonicalSegments;
    skeletonPhases = fixtureSkeleton.expectedPhases ?? null;
    skeletonSource = 'fixture';
  } else {
    const phase1Segments = parsed.phase1?.canonicalSegments ?? [];
    const phase2Segments = parsed.phase2?.canonicalSegments ?? [];
    const combined = [...phase1Segments, ...phase2Segments];
    if (combined.length) {
      skeletonSegments = combined.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      const fallbackPhases: SkeletonPhase[] = [];
      if (phase1Segments.length) {
        fallbackPhases.push({
          id: 'phase-1',
          title: parsed.phase1?._title,
          segmentIds: phase1Segments.map((seg) => seg.ref.segmentId),
        });
      }
      if (phase2Segments.length) {
        fallbackPhases.push({
          id: `phase-${fallbackPhases.length + 1}`,
          title: parsed.phase2?._title,
          segmentIds: phase2Segments.map((seg) => seg.ref.segmentId),
        });
      }
      skeletonPhases = fallbackPhases.length ? fallbackPhases : null;
      skeletonSource = 'phase1+phase2';
    }
  }

  if (!skeletonSegments.length) {
    throw new Error(`No canonical segments available for skeleton pass in ${fixturePath}.`);
  }

  return { phase, phaseKey, skeletonSegments, skeletonPhases, skeletonSource };
};

const loadAnatomistFixture = async (): Promise<{
  goldenData: AnatomistGoldenFixture;
  allSegments: CanonicalSegment[];
}> => {
  const config = BENCHMARK_CONFIG.anatomistFixture;
  if (!config?.path) {
    throw new Error('anatomistFixture.path not configured in BENCHMARK_CONFIG');
  }

  // Load the anatomist golden fixture
  const goldenPath = path.resolve(config.path);
  const goldenRaw = await fs.readFile(goldenPath, 'utf8');
  const goldenData = JSON.parse(goldenRaw) as AnatomistGoldenFixture;

  // Load segments from the main fixture (skeleton has all segments)
  const mainFixturePath = path.resolve(BENCHMARK_CONFIG.fixture.path);
  const mainRaw = await fs.readFile(mainFixturePath, 'utf8');
  const mainParsed = JSON.parse(mainRaw) as GoldenFixture;

  let allSegments: CanonicalSegment[] = [];
  if (mainParsed.skeleton?.canonicalSegments?.length) {
    allSegments = mainParsed.skeleton.canonicalSegments;
  }

  return { goldenData, allSegments };
};

const loadAllGoldenFixtures = async (): Promise<AllGoldenFixtures> => {
  // Load all golden fixtures
  const [anatomistRaw, lexicographerRaw, weaverRaw, typesetterRaw, mainRaw] = await Promise.all([
    fs.readFile(path.resolve(BENCHMARK_CONFIG.anatomistFixture.path), 'utf8'),
    fs.readFile(path.resolve(BENCHMARK_CONFIG.lexicographerFixture.path), 'utf8'),
    fs.readFile(path.resolve(BENCHMARK_CONFIG.weaverFixture.path), 'utf8'),
    fs.readFile(path.resolve(BENCHMARK_CONFIG.typesetterFixture.path), 'utf8'),
    fs.readFile(path.resolve(BENCHMARK_CONFIG.fixture.path), 'utf8'),
  ]);

  const anatomist = JSON.parse(anatomistRaw) as AnatomistGoldenFixture;
  const lexicographer = JSON.parse(lexicographerRaw) as LexicographerGoldenFixture;
  const weaver = JSON.parse(weaverRaw) as WeaverGoldenFixture;
  const typesetter = JSON.parse(typesetterRaw) as TypesetterGoldenFixture;
  const mainParsed = JSON.parse(mainRaw) as GoldenFixture;

  let allSegments: CanonicalSegment[] = [];
  if (mainParsed.skeleton?.canonicalSegments?.length) {
    allSegments = mainParsed.skeleton.canonicalSegments;
  }

  return { anatomist, lexicographer, weaver, typesetter, allSegments };
};

/**
 * Apply wordRange slicing to segments when sub-segment splitting is used.
 * When wordRange is present, slice the Pali text to only include the specified word indices.
 * English is NOT sliced - the full text is passed through for the weaver to handle mapping.
 */
const applyWordRangeToSegments = (
  segments: CanonicalSegment[],
  wordRange?: [number, number]
): CanonicalSegment[] => {
  if (!wordRange) return segments;

  const [start, end] = wordRange;
  const fullPali = segments.map((s) => s.pali).join(' ');
  const paliWords = fullPali.split(/\s+/).filter(Boolean);
  const slicedPali = paliWords.slice(start, end).join(' ');

  // Return a single "virtual" segment with the sliced Pali
  // Keep full English for weaver to map
  const fullEnglish = segments
    .map((s) => s.baseEnglish || '')
    .filter(Boolean)
    .join(' ');

  return [
    {
      ref: segments[0].ref, // Keep the original segment reference
      order: segments[0].order,
      pali: slicedPali,
      baseEnglish: fullEnglish || undefined,
    },
  ];
};

const getSegmentsForPhase = (
  phaseId: string,
  goldenFixtures: AllGoldenFixtures
): CanonicalSegment[] => {
  const phaseMeta = goldenFixtures.anatomist._phases.find((p) => p.phaseId === phaseId);
  if (!phaseMeta) return [];
  const segments = goldenFixtures.allSegments.filter((seg) =>
    phaseMeta.canonicalSegmentIds.includes(seg.ref.segmentId)
  );
  // Apply wordRange if present in phase metadata (for sub-segment splitting)
  const wordRange = (phaseMeta as any).wordRange as [number, number] | undefined;
  return applyWordRangeToSegments(segments, wordRange);
};

const getEnglishTextForSegments = (segments: CanonicalSegment[]): string => {
  return segments
    .map((seg) => seg.baseEnglish || '')
    .filter(Boolean)
    .join(' ');
};

// ─────────────────────────────────────────────────────────────────────────────
// Per-Phase Pipeline Runner
// ─────────────────────────────────────────────────────────────────────────────
type PipelinePhaseResult = {
  phaseId: string;
  anatomist: { output: AnatomistPass | null; error: string | null; llm: any };
  lexicographer: { output: LexicographerPass | null; error: string | null; llm: any };
  weaver: { output: WeaverPass | null; error: string | null; llm: any };
  typesetter: { output: TypesetterPass | null; error: string | null; llm: any };
};

const runPipelineForPhase = async (params: {
  phaseId: string;
  workId: string;
  segments: CanonicalSegment[];
  englishText: string;
  settings: any;
  structuredOutputs: boolean;
  maxTokens?: number;
  goldenFixtures: AllGoldenFixtures;
  dependencyMode: 'live' | 'fixture';
  llmCaller?: LLMCaller;
}): Promise<PipelinePhaseResult> => {
  const { phaseId, workId, segments, englishText, settings, structuredOutputs, maxTokens, goldenFixtures, dependencyMode, llmCaller: caller = openRouterLLMCaller } = params;

  const result: PipelinePhaseResult = {
    phaseId,
    anatomist: { output: null, error: null, llm: null },
    lexicographer: { output: null, error: null, llm: null },
    weaver: { output: null, error: null, llm: null },
    typesetter: { output: null, error: null, llm: null },
  };

  // 1. ANATOMIST
  const anatomistResult = await runAnatomistPass({
    phaseId,
    workId,
    segments,
    settings,
    structuredOutputs,
    llmCaller: caller,
    maxTokens,
  });
  result.anatomist = {
    output: anatomistResult.output ?? null,
    error: anatomistResult.error ?? null,
    llm: anatomistResult.llm,
  };

  // Get anatomist input for downstream passes
  const anatomistForDownstream = dependencyMode === 'live' && anatomistResult.output
    ? anatomistResult.output
    : goldenFixtures.anatomist.anatomist[phaseId] ?? null;

  if (!anatomistForDownstream) {
    console.warn(`[Pipeline] No anatomist data for ${phaseId}, skipping downstream passes`);
    return result;
  }

  // 2. LEXICOGRAPHER
  const lexicographerResult = await runLexicographerPass({
    phaseId,
    workId,
    segments,
    anatomist: anatomistForDownstream,
    dictionaryEntries: {},
    settings,
    structuredOutputs,
    llmCaller: caller,
    maxTokens,
  });
  result.lexicographer = {
    output: lexicographerResult.output ?? null,
    error: lexicographerResult.error ?? null,
    llm: lexicographerResult.llm,
  };

  // Get lexicographer input for downstream
  const lexicographerForDownstream = dependencyMode === 'live' && lexicographerResult.output
    ? lexicographerResult.output
    : goldenFixtures.lexicographer.lexicographer[phaseId] ?? null;

  // 3. WEAVER
  const weaverResult = await runWeaverPass({
    phaseId,
    workId,
    segments,
    anatomist: anatomistForDownstream,
    lexicographer: lexicographerForDownstream ?? { id: phaseId, senses: [] },
    englishText,
    settings,
    structuredOutputs,
    llmCaller: caller,
    maxTokens,
  });
  result.weaver = {
    output: weaverResult.output ?? null,
    error: weaverResult.error ?? null,
    llm: weaverResult.llm,
  };

  // Get weaver input for downstream
  const weaverForDownstream = dependencyMode === 'live' && weaverResult.output
    ? weaverResult.output
    : goldenFixtures.weaver.weaver[phaseId] ?? null;

  // 4. TYPESETTER
  const typesetterResult = await runTypesetterPass({
    phaseId,
    workId,
    segments,
    anatomist: anatomistForDownstream,
    weaver: weaverForDownstream ?? { id: phaseId, tokens: [] },
    settings,
    structuredOutputs,
    llmCaller: caller,
    maxTokens,
  });
  result.typesetter = {
    output: typesetterResult.output ?? null,
    error: typesetterResult.error ?? null,
    llm: typesetterResult.llm,
  };

  return result;
};

const buildEnglishText = (phase: FixturePhase, segments: CanonicalSegment[]): string => {
  if (phase._english) return phase._english;
  return segments
    .map((seg) => seg.baseEnglish || '')
    .filter(Boolean)
    .join(' ');
};

const runBenchmark = async () => {
  const { phase, phaseKey, skeletonSegments, skeletonPhases, skeletonSource } =
    await loadFixture();
  const workId = BENCHMARK_CONFIG.fixture.workId;
  const segments = phase.canonicalSegments;
  const phaseId = phase.expectedPhaseView?.id || 'phase-1';

  const fixtureAnatomist = normalizePhaseId(phase.anatomist, phaseId);
  const fixtureLexicographer = normalizePhaseId(phase.lexicographer, phaseId);
  const fixtureWeaver = normalizePhaseId(phase.weaver, phaseId);
  const fixtureTypesetter = normalizePhaseId(phase.typesetter, phaseId);
  const fixturePhaseView = normalizePhaseId(phase.expectedPhaseView, phaseId);
  const englishText = buildEnglishText(phase, segments);

  const rows: MetricRow[] = [];
  const repeatRuns = Math.max(1, BENCHMARK_CONFIG.repeatRuns ?? 1);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputDir = path.resolve(BENCHMARK_CONFIG.outputRoot, timestamp);
  await fs.mkdir(outputDir, { recursive: true });
  const progressPath = path.join(outputDir, 'progress.json');
  const progressWebPath = toWebPath(progressPath);
  const skeletonChunkEstimate = Math.max(
    1,
    Math.ceil(skeletonSegments.length / 50)
  );
  // Filter runs early if onlyRunIds is specified
  const runsToExecute = (BENCHMARK_CONFIG as any).onlyRunIds?.length
    ? BENCHMARK_CONFIG.runs.filter((r) => (BENCHMARK_CONFIG as any).onlyRunIds.includes(r.id))
    : BENCHMARK_CONFIG.runs;
  const runsTotal = runsToExecute.length;
  const passesTotal = BENCHMARK_CONFIG.passes.length;
  const hasSkeleton = BENCHMARK_CONFIG.passes.includes('skeleton');
  const usePerPhasePipeline = Boolean(BENCHMARK_CONFIG.phasesToTest?.length);
  const phasesToTestCount = BENCHMARK_CONFIG.phasesToTest?.length ?? 0;

  // Calculate steps: skeleton chunks + (4 passes per phase in pipeline mode)
  const stepsPerRun = usePerPhasePipeline
    ? (hasSkeleton ? skeletonChunkEstimate : 0) + (phasesToTestCount * 4) // 4 passes per phase
    : passesTotal; // legacy mode
  const stepsTotal = runsTotal * repeatRuns * Math.max(1, stepsPerRun);
  const progressState: BenchProgressState = {
    status: 'running',
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    timestamp,
    outputDir,
    progressPath: progressWebPath,
    runsTotal,
    repeatTotal: repeatRuns,
    passesTotal,
    skeletonChunkEstimate,
    stepsTotal,
    stepsCompleted: 0,
    percent: 0,
    errors: [],
    current: null,
    message: 'Starting benchmark run.',
  };
  await writeProgressState(BENCHMARK_CONFIG.outputRoot, progressPath, progressState);
  try {
    const captureSkeletonOutputs = Boolean(BENCHMARK_CONFIG.captureOutputs?.skeleton);
    const outputsDir = path.join(outputDir, 'outputs');

    if (captureSkeletonOutputs) {
      await fs.mkdir(outputsDir, { recursive: true });
      await fs.writeFile(
        path.join(outputsDir, 'skeleton-golden.json'),
        JSON.stringify(
          {
            generatedAt: new Date().toISOString(),
            source: skeletonSource,
            segments: skeletonSegments,
            phases: skeletonPhases,
          },
          null,
          2
        ),
        'utf8'
      );
      await writeBenchIndex(BENCHMARK_CONFIG.outputRoot);
    }

    // runsToExecute is now calculated above with runsTotal

    for (const run of runsToExecute) {
      const runIndex = BENCHMARK_CONFIG.runs.indexOf(run);
      const baseSettings = resolveSettingsForModel(run.model);
      const dependencyMode = BENCHMARK_CONFIG.dependencyMode;
      // Create LLMCaller with model's provider preferences (e.g., routing through Together)
      const llmCaller = run.model.providerPreferences
        ? createOpenRouterLLMCaller(run.model.providerPreferences)
        : openRouterLLMCaller;

      for (let repeatIndex = 0; repeatIndex < repeatRuns; repeatIndex++) {
        const runId =
          repeatRuns > 1 ? `${run.id}-run-${repeatIndex + 1}` : run.id;
        const runOutputDir = captureSkeletonOutputs
          ? path.join(outputsDir, runId)
          : null;
        if (runOutputDir) {
          await fs.mkdir(runOutputDir, { recursive: true });
        }

        let liveAnatomist: AnatomistPass = fixtureAnatomist;
        let liveLexicographer: LexicographerPass = fixtureLexicographer;
        let liveWeaver: WeaverPass = fixtureWeaver;
        let livePhaseView: PhaseView = fixturePhaseView;

        for (const pass of BENCHMARK_CONFIG.passes) {
          const override = run.passOverrides?.[pass];
          const settings = override?.modelId
            ? { ...baseSettings, model: override.modelId }
            : baseSettings;
          const maxTokens = override?.maxTokens;

          const structuredOutputs =
            typeof override?.structuredOutputs === 'boolean'
              ? override.structuredOutputs
              : await supportsStructuredOutputs(settings.provider, settings.model);

          if (pass === 'skeleton') {
            const skeletonResult = await runSkeletonPass({
              segments: skeletonSegments,
              boundaries: [],
              allowCrossChapter: false,
              settings,
              structuredOutputs,
              llmCaller,
              maxTokens: maxTokens ?? undefined,
            });

            let aggregateDuration = 0;
            let aggregateCost = 0;
            let aggregatePromptTokens = 0;
            let aggregateCompletionTokens = 0;
            let aggregateTotalTokens = 0;
            let aggregateComplete = true;
            let segmentOffset = 0;
            const chunkWrites: Array<Promise<void>> = [];

            for (const chunk of skeletonResult.chunks) {
            const llm = chunk.llm;
            const tokensPrompt = llm?.tokens?.prompt ?? null;
            const tokensCompletion = llm?.tokens?.completion ?? null;
            const tokensTotal = llm?.tokens?.total ?? null;
            const chunkSegments = skeletonSegments.slice(
              segmentOffset,
              segmentOffset + chunk.segmentCount
            );
            segmentOffset += chunk.segmentCount;

            if (!llm) {
              aggregateComplete = false;
            } else {
              aggregateDuration += llm.durationMs;
              aggregateCost += llm.costUsd ?? 0;
              aggregatePromptTokens += llm.tokens?.prompt ?? 0;
              aggregateCompletionTokens += llm.tokens?.completion ?? 0;
              aggregateTotalTokens += llm.tokens?.total ?? 0;
            }

            if (captureSkeletonOutputs && runOutputDir) {
              const chunkPayload = {
                generatedAt: new Date().toISOString(),
                runId,
                pass,
                chunkIndex: chunk.chunkIndex,
                chunkCount: chunk.chunkCount,
                segmentCount: chunk.segmentCount,
                segments: chunkSegments,
                response: {
                  text: llm?.text ?? null,
                  parsed: chunk.output ?? null,
                  error: chunk.error ?? null,
                  fallbackUsed: chunk.fallbackUsed,
                },
                llm: llm
                  ? {
                      provider: llm.provider,
                      model: llm.model,
                      durationMs: llm.durationMs,
                      costUsd: llm.costUsd ?? null,
                      tokens: llm.tokens ?? null,
                    }
                  : null,
                structuredOutputs,
                schemaName: chunk.schemaName ?? null,
                requestName: chunk.requestName,
              };
              chunkWrites.push(
                fs.writeFile(
                  path.join(runOutputDir, `skeleton-chunk-${chunk.chunkIndex + 1}.json`),
                  JSON.stringify(chunkPayload, null, 2),
                  'utf8'
                )
              );
            }

            rows.push(
              toMetricRow({
                runId,
                pass,
                stage: 'chunk',
                provider: llm?.provider ?? settings.provider,
                model: llm?.model ?? settings.model,
                promptVersion: SUTTA_STUDIO_PROMPT_VERSION,
                structuredOutputs,
                durationMs: llm?.durationMs ?? null,
                costUsd: llm?.costUsd ?? null,
                tokensPrompt,
                tokensCompletion,
                tokensTotal,
                success: !chunk.error,
                errorMessage: chunk.error ?? null,
                schemaName: chunk.schemaName ?? null,
                requestName: chunk.requestName,
                phaseId: chunk.phaseId ?? null,
                chunkIndex: chunk.chunkIndex,
                chunkCount: chunk.chunkCount,
                segmentCount: chunk.segmentCount,
                dependencyMode,
                fixturePhase: phaseKey,
                workId,
              })
            );

            if (chunk.error) {
              addProgressError(progressState, {
                runId,
                pass,
                stage: 'chunk',
                message: chunk.error,
                chunkIndex: chunk.chunkIndex,
                chunkCount: chunk.chunkCount,
              });
            }

            progressState.stepsCompleted += 1;
            progressState.updatedAt = new Date().toISOString();
            progressState.percent = Math.min(
              100,
              Math.round((progressState.stepsCompleted / progressState.stepsTotal) * 100)
            );
            progressState.current = {
              runId,
              model: settings.model,
              provider: settings.provider,
              pass,
              stage: 'chunk',
              passIndex: BENCHMARK_CONFIG.passes.indexOf(pass),
              runIndex,
              repeatIndex,
              chunkIndex: chunk.chunkIndex,
              chunkCount: chunk.chunkCount,
            };
            progressState.message = `Skeleton chunk ${chunk.chunkIndex + 1}/${chunk.chunkCount}`;
            await writeProgressState(BENCHMARK_CONFIG.outputRoot, progressPath, progressState);
          }

            if (captureSkeletonOutputs && runOutputDir) {
              if (chunkWrites.length) {
                await Promise.all(chunkWrites);
              }
              const aggregatePayload = {
                generatedAt: new Date().toISOString(),
                runId,
                pass,
                segments: skeletonSegments,
                phases: skeletonResult.phases,
                chunkCount: skeletonResult.chunks.length,
                structuredOutputs,
                provider: settings.provider,
                model: settings.model,
              };
              await fs.writeFile(
                path.join(runOutputDir, 'skeleton-aggregate.json'),
                JSON.stringify(aggregatePayload, null, 2),
                'utf8'
              );
              await writeBenchIndex(BENCHMARK_CONFIG.outputRoot);
            }

            rows.push(
              toMetricRow({
                runId,
                pass,
                stage: 'aggregate',
                provider: settings.provider,
                model: settings.model,
                promptVersion: SUTTA_STUDIO_PROMPT_VERSION,
                structuredOutputs,
                durationMs: aggregateComplete ? aggregateDuration : null,
                costUsd: aggregateComplete ? aggregateCost : null,
                tokensPrompt: aggregateComplete ? aggregatePromptTokens : null,
                tokensCompletion: aggregateComplete ? aggregateCompletionTokens : null,
                tokensTotal: aggregateComplete ? aggregateTotalTokens : null,
                success: aggregateComplete,
                errorMessage: aggregateComplete ? null : 'missing chunk metrics',
                schemaName: null,
                requestName: 'skeleton',
                phaseId: null,
                chunkIndex: null,
                chunkCount: skeletonResult.chunks.length,
                segmentCount: skeletonSegments.length,
                dependencyMode,
                fixturePhase: phaseKey,
                workId,
              })
            );

            continue;
          }

        // ─────────────────────────────────────────────────────────────────────
        // PER-PHASE PIPELINE MODE
        // When phasesToTest is configured, run full pipeline for each phase
        // ─────────────────────────────────────────────────────────────────────
        if (pass === 'anatomist' && BENCHMARK_CONFIG.phasesToTest?.length) {
          // Load all golden fixtures once
          const goldenFixtures = await loadAllGoldenFixtures();
          const phasesToTest = BENCHMARK_CONFIG.phasesToTest;

          console.log(`[Pipeline] Running full pipeline for ${phasesToTest.length} phases...`);

          // Collect phase outputs for assembly into DeepLoomPacket
          const pipelinePhaseOutputs: PipelinePhaseOutput[] = [];
          // Collect quality scores for each phase
          const qualityScores: QualityScore[] = [];

          for (const testPhaseId of phasesToTest) {
            const phaseSegments = getSegmentsForPhase(testPhaseId, goldenFixtures);
            if (phaseSegments.length === 0) {
              console.warn(`[Pipeline] No segments found for phase ${testPhaseId}, skipping`);
              continue;
            }

            const englishText = getEnglishTextForSegments(phaseSegments);

            console.log(`[Pipeline] Phase ${testPhaseId}: ${phaseSegments.length} segments`);

            // Run full pipeline for this phase
            const pipelineResult = await runPipelineForPhase({
              phaseId: testPhaseId,
              workId,
              segments: phaseSegments,
              englishText,
              settings,
              structuredOutputs,
              maxTokens: maxTokens ?? undefined,
              goldenFixtures,
              dependencyMode: dependencyMode as 'live' | 'fixture',
              llmCaller,
            });

            // Record metrics for each pass in the pipeline
            const passNames: Array<'anatomist' | 'lexicographer' | 'weaver' | 'typesetter'> = [
              'anatomist', 'lexicographer', 'weaver', 'typesetter'
            ];

            for (const passName of passNames) {
              const passResult = pipelineResult[passName];
              const llm = passResult.llm;

              rows.push(
                toMetricRow({
                  runId,
                  pass: passName,
                  stage: 'pass',
                  provider: llm?.provider ?? settings.provider,
                  model: llm?.model ?? settings.model,
                  promptVersion: SUTTA_STUDIO_PROMPT_VERSION,
                  structuredOutputs,
                  durationMs: llm?.durationMs ?? null,
                  costUsd: llm?.costUsd ?? null,
                  tokensPrompt: llm?.tokens?.prompt ?? null,
                  tokensCompletion: llm?.tokens?.completion ?? null,
                  tokensTotal: llm?.tokens?.total ?? null,
                  success: !passResult.error,
                  errorMessage: passResult.error ?? null,
                  schemaName: null,
                  requestName: passName,
                  phaseId: testPhaseId,
                  chunkIndex: null,
                  chunkCount: null,
                  segmentCount: phaseSegments.length,
                  dependencyMode,
                  fixturePhase: phaseKey,
                  workId,
                })
              );

              if (passResult.error) {
                addProgressError(progressState, {
                  runId,
                  pass: passName,
                  stage: 'pass',
                  message: passResult.error,
                });
              }
            }

            // Save pipeline outputs for this phase
            if (runOutputDir) {
              const goldenAnatomist = goldenFixtures.anatomist.anatomist[testPhaseId];
              const goldenLexicographer = goldenFixtures.lexicographer.lexicographer[testPhaseId];
              const goldenWeaver = goldenFixtures.weaver.weaver[testPhaseId];
              const goldenTypesetter = goldenFixtures.typesetter.typesetter[testPhaseId];

              const pipelinePayload = {
                generatedAt: new Date().toISOString(),
                runId,
                phaseId: testPhaseId,
                dependencyMode,
                segments: phaseSegments,
                englishText,
                golden: {
                  anatomist: goldenAnatomist ?? null,
                  lexicographer: goldenLexicographer ?? null,
                  weaver: goldenWeaver ?? null,
                  typesetter: goldenTypesetter ?? null,
                },
                output: {
                  anatomist: pipelineResult.anatomist.output,
                  lexicographer: pipelineResult.lexicographer.output,
                  weaver: pipelineResult.weaver.output,
                  typesetter: pipelineResult.typesetter.output,
                },
                errors: {
                  anatomist: pipelineResult.anatomist.error,
                  lexicographer: pipelineResult.lexicographer.error,
                  weaver: pipelineResult.weaver.error,
                  typesetter: pipelineResult.typesetter.error,
                },
                llm: {
                  anatomist: pipelineResult.anatomist.llm,
                  lexicographer: pipelineResult.lexicographer.llm,
                  weaver: pipelineResult.weaver.llm,
                  typesetter: pipelineResult.typesetter.llm,
                },
              };

              await fs.writeFile(
                path.join(runOutputDir, `pipeline-${testPhaseId}.json`),
                JSON.stringify(pipelinePayload, null, 2),
                'utf8'
              );

              // Score quality if we have complete outputs
              if (
                pipelineResult.anatomist.output &&
                pipelineResult.lexicographer.output &&
                pipelineResult.weaver.output
              ) {
                try {
                  const scoringInput: PipelineOutput = {
                    output: {
                      anatomist: pipelineResult.anatomist.output,
                      lexicographer: pipelineResult.lexicographer.output,
                      weaver: pipelineResult.weaver.output,
                      typesetter: pipelineResult.typesetter.output,
                    },
                    segments: phaseSegments.map(s => ({ pali: s.pali })),
                  };
                  const score = scorePhase(scoringInput, testPhaseId, settings.model);
                  qualityScores.push(score);
                } catch (scoreError) {
                  console.warn(`[Pipeline] Quality scoring failed for ${testPhaseId}:`, scoreError);
                }
              }

              // Collect for packet assembly
              pipelinePhaseOutputs.push({
                phaseId: testPhaseId,
                segments: phaseSegments,
                englishText,
                output: {
                  anatomist: pipelineResult.anatomist.output,
                  lexicographer: pipelineResult.lexicographer.output,
                  weaver: pipelineResult.weaver.output,
                  typesetter: pipelineResult.typesetter.output,
                },
                errors: {
                  anatomist: pipelineResult.anatomist.error,
                  lexicographer: pipelineResult.lexicographer.error,
                  weaver: pipelineResult.weaver.error,
                  typesetter: pipelineResult.typesetter.error,
                },
              });
            }

            // Update progress
            progressState.stepsCompleted += 4; // 4 passes per phase
            progressState.updatedAt = new Date().toISOString();
            progressState.percent = Math.min(
              100,
              Math.round((progressState.stepsCompleted / progressState.stepsTotal) * 100)
            );
            progressState.current = {
              runId,
              model: settings.model,
              provider: settings.provider,
              pass: 'typesetter',
              stage: 'pass',
              passIndex: BENCHMARK_CONFIG.passes.indexOf('typesetter'),
              runIndex,
              repeatIndex,
              chunkIndex: null,
              chunkCount: null,
            };
            progressState.message = `Completed pipeline for ${testPhaseId}`;
            await writeProgressState(BENCHMARK_CONFIG.outputRoot, progressPath, progressState);
          }

          // ─────────────────────────────────────────────────────────────────────
          // ASSEMBLE AND SAVE PACKET
          // After all phases complete, assemble into a DeepLoomPacket for UI viewing
          // ─────────────────────────────────────────────────────────────────────
          if (runOutputDir && pipelinePhaseOutputs.length > 0) {
            console.log(`[Pipeline] Assembling packet from ${pipelinePhaseOutputs.length} phases...`);
            const assembledPacket = assemblePipelineToPacket({
              workId,
              phases: pipelinePhaseOutputs,
              modelId: settings.model,
              promptVersion: SUTTA_STUDIO_PROMPT_VERSION,
            });

            await fs.writeFile(
              path.join(runOutputDir, 'packet.json'),
              JSON.stringify(assembledPacket, null, 2),
              'utf8'
            );
            console.log(`[Pipeline] Saved assembled packet to ${path.join(runOutputDir, 'packet.json')}`);

            // Save quality scores summary
            if (qualityScores.length > 0) {
              const avgCoverage = qualityScores.reduce((s, q) => s + q.coverageScore, 0) / qualityScores.length;
              const avgValidity = qualityScores.reduce((s, q) => s + q.validityScore, 0) / qualityScores.length;
              const avgRichness = qualityScores.reduce((s, q) => s + q.richnessScore, 0) / qualityScores.length;
              const avgGrammar = qualityScores.reduce((s, q) => s + q.grammarScore, 0) / qualityScores.length;
              const avgOverall = qualityScores.reduce((s, q) => s + q.overallScore, 0) / qualityScores.length;

              const qualitySummary = {
                generatedAt: new Date().toISOString(),
                runId,
                model: settings.model,
                provider: settings.provider,
                promptVersion: SUTTA_STUDIO_PROMPT_VERSION,
                phaseCount: qualityScores.length,
                averages: {
                  coverage: avgCoverage,
                  validity: avgValidity,
                  richness: avgRichness,
                  grammar: avgGrammar,
                  overall: avgOverall,
                },
                phases: qualityScores,
              };

              await fs.writeFile(
                path.join(runOutputDir, 'quality-scores.json'),
                JSON.stringify(qualitySummary, null, 2),
                'utf8'
              );
              console.log(
                `[Pipeline] Quality scores: coverage=${avgCoverage.toFixed(2)}, validity=${avgValidity.toFixed(2)}, richness=${avgRichness.toFixed(2)}, grammar=${avgGrammar.toFixed(2)}, overall=${avgOverall.toFixed(2)}`
              );
            }
          }

          // Skip remaining passes in the old loop - we've handled them all
          continue;
        }

        // ─────────────────────────────────────────────────────────────────────
        // LEGACY MODE: Old per-pass logic (when phasesToTest not configured)
        // ─────────────────────────────────────────────────────────────────────
        if (pass === 'anatomist') {
          // Check if we're using multi-phase anatomist benchmark
          const anatomistConfig = BENCHMARK_CONFIG.anatomistFixture;
          const useMultiPhase = anatomistConfig?.path && anatomistConfig?.phases?.length;

          if (useMultiPhase) {
            // Multi-phase anatomist benchmark
            const { goldenData, allSegments } = await loadAnatomistFixture();
            const phasesToRun = anatomistConfig.phases;

            for (const testPhaseId of phasesToRun) {
              const phaseMeta = goldenData._phases.find((p) => p.phaseId === testPhaseId);
              if (!phaseMeta) {
                console.warn(`[Anatomist] Phase ${testPhaseId} not found in golden fixture, skipping`);
                continue;
              }

              // Filter segments for this phase
              const phaseSegments = allSegments.filter((seg) =>
                phaseMeta.canonicalSegmentIds.includes(seg.ref.segmentId)
              );

              if (phaseSegments.length === 0) {
                console.warn(`[Anatomist] No segments found for phase ${testPhaseId}, skipping`);
                continue;
              }

              const result = await runAnatomistPass({
                phaseId: testPhaseId,
                workId,
                segments: phaseSegments,
                settings,
                structuredOutputs,
                llmCaller,
                maxTokens: maxTokens ?? undefined,
              });

              const llm = result.llm;
              const row = toMetricRow({
                runId,
                pass,
                stage: 'pass',
                provider: llm?.provider ?? settings.provider,
                model: llm?.model ?? settings.model,
                promptVersion: SUTTA_STUDIO_PROMPT_VERSION,
                structuredOutputs,
                durationMs: llm?.durationMs ?? null,
                costUsd: llm?.costUsd ?? null,
                tokensPrompt: llm?.tokens?.prompt ?? null,
                tokensCompletion: llm?.tokens?.completion ?? null,
                tokensTotal: llm?.tokens?.total ?? null,
                success: !result.error,
                errorMessage: result.error ?? null,
                schemaName: result.schemaName ?? null,
                requestName: result.requestName,
                phaseId: testPhaseId,
                chunkIndex: null,
                chunkCount: null,
                segmentCount: phaseSegments.length,
                dependencyMode,
                fixturePhase: phaseKey,
                workId,
              });
              rows.push(row);

              if (result.error) {
                addProgressError(progressState, {
                  runId,
                  pass,
                  stage: 'pass',
                  message: result.error,
                });
              }

              // Save anatomist output for comparison
              if (BENCHMARK_CONFIG.captureOutputs?.anatomist && runOutputDir) {
                const goldenExpected = goldenData.anatomist[testPhaseId];
                const outputPayload = {
                  generatedAt: new Date().toISOString(),
                  runId,
                  pass,
                  phaseId: testPhaseId,
                  segments: phaseSegments,
                  golden: goldenExpected ?? null,
                  response: {
                    output: result.output ?? null,
                    error: result.error ?? null,
                  },
                  llm: llm
                    ? {
                        provider: llm.provider,
                        model: llm.model,
                        durationMs: llm.durationMs,
                        costUsd: llm.costUsd ?? null,
                        tokens: llm.tokens ?? null,
                      }
                    : null,
                  structuredOutputs,
                  schemaName: result.schemaName ?? null,
                  requestName: result.requestName,
                };
                await fs.writeFile(
                  path.join(runOutputDir, `anatomist-${testPhaseId}.json`),
                  JSON.stringify(outputPayload, null, 2),
                  'utf8'
                );
              }

              progressState.stepsCompleted += 1;
              progressState.updatedAt = new Date().toISOString();
              progressState.percent = Math.min(
                100,
                Math.round((progressState.stepsCompleted / progressState.stepsTotal) * 100)
              );
              progressState.current = {
                runId,
                model: settings.model,
                provider: settings.provider,
                pass,
                stage: 'pass',
                passIndex: BENCHMARK_CONFIG.passes.indexOf(pass),
                runIndex,
                repeatIndex,
                chunkIndex: null,
                chunkCount: null,
              };
              progressState.message = `Anatomist ${testPhaseId}`;
              await writeProgressState(BENCHMARK_CONFIG.outputRoot, progressPath, progressState);
            }

            continue;
          }

          // Single-phase anatomist (legacy mode)
          const result = await runAnatomistPass({
            phaseId,
            workId,
            segments,
            settings,
            structuredOutputs,
            llmCaller,
            maxTokens: maxTokens ?? undefined,
          });

          const llm = result.llm;
          const row = toMetricRow({
            runId,
            pass,
            stage: 'pass',
            provider: llm?.provider ?? settings.provider,
            model: llm?.model ?? settings.model,
            promptVersion: SUTTA_STUDIO_PROMPT_VERSION,
            structuredOutputs,
            durationMs: llm?.durationMs ?? null,
            costUsd: llm?.costUsd ?? null,
            tokensPrompt: llm?.tokens?.prompt ?? null,
            tokensCompletion: llm?.tokens?.completion ?? null,
            tokensTotal: llm?.tokens?.total ?? null,
            success: !result.error,
            errorMessage: result.error ?? null,
            schemaName: result.schemaName ?? null,
            requestName: result.requestName,
            phaseId,
            chunkIndex: null,
            chunkCount: null,
            segmentCount: segments.length,
            dependencyMode,
            fixturePhase: phaseKey,
            workId,
          });
          rows.push(row);

          if (result.error) {
            addProgressError(progressState, {
              runId,
              pass,
              stage: 'pass',
              message: result.error,
            });
          }

          if (!result.error && result.output && dependencyMode === 'live') {
            liveAnatomist = result.output;
          }

          progressState.stepsCompleted += 1;
          progressState.updatedAt = new Date().toISOString();
          progressState.percent = Math.min(
            100,
            Math.round((progressState.stepsCompleted / progressState.stepsTotal) * 100)
          );
          progressState.current = {
            runId,
            model: settings.model,
            provider: settings.provider,
            pass,
            stage: 'pass',
            passIndex: BENCHMARK_CONFIG.passes.indexOf(pass),
            runIndex,
            repeatIndex,
            chunkIndex: null,
            chunkCount: null,
          };
          progressState.message = `Completed ${pass}`;
          await writeProgressState(BENCHMARK_CONFIG.outputRoot, progressPath, progressState);

          continue;
        }

      if (pass === 'lexicographer') {
        const anatomistInput = dependencyMode === 'live' ? liveAnatomist : fixtureAnatomist;
        const result = await runLexicographerPass({
          phaseId,
          workId,
          segments,
          anatomist: anatomistInput,
          dictionaryEntries: {},
          settings,
          structuredOutputs,
          llmCaller,
          maxTokens: maxTokens ?? undefined,
        });

        const llm = result.llm;
        rows.push(
          toMetricRow({
            runId,
            pass,
            stage: 'pass',
            provider: llm?.provider ?? settings.provider,
            model: llm?.model ?? settings.model,
            promptVersion: SUTTA_STUDIO_PROMPT_VERSION,
            structuredOutputs,
            durationMs: llm?.durationMs ?? null,
            costUsd: llm?.costUsd ?? null,
            tokensPrompt: llm?.tokens?.prompt ?? null,
            tokensCompletion: llm?.tokens?.completion ?? null,
            tokensTotal: llm?.tokens?.total ?? null,
            success: !result.error,
            errorMessage: result.error ?? null,
            schemaName: result.schemaName ?? null,
            requestName: result.requestName,
            phaseId,
            chunkIndex: null,
            chunkCount: null,
            segmentCount: segments.length,
            dependencyMode,
            fixturePhase: phaseKey,
            workId,
          })
        );

        if (result.error) {
          addProgressError(progressState, {
            runId,
            pass,
            stage: 'pass',
            message: result.error,
          });
        }

        if (result.error) {
          addProgressError(progressState, {
            runId,
            pass,
            stage: 'pass',
            message: result.error,
          });
        }

        if (result.error) {
          addProgressError(progressState, {
            runId,
            pass,
            stage: 'pass',
            message: result.error,
          });
        }

        if (result.error) {
          addProgressError(progressState, {
            runId,
            pass,
            stage: 'pass',
            message: result.error,
          });
        }

        if (!result.error && result.output && dependencyMode === 'live') {
          liveLexicographer = result.output;
        }

        progressState.stepsCompleted += 1;
        progressState.updatedAt = new Date().toISOString();
        progressState.percent = Math.min(
          100,
          Math.round((progressState.stepsCompleted / progressState.stepsTotal) * 100)
        );
        progressState.current = {
          runId,
          model: settings.model,
          provider: settings.provider,
          pass,
          stage: 'pass',
          passIndex: BENCHMARK_CONFIG.passes.indexOf(pass),
          runIndex,
          repeatIndex,
          chunkIndex: null,
          chunkCount: null,
        };
        progressState.message = `Completed ${pass}`;
        await writeProgressState(BENCHMARK_CONFIG.outputRoot, progressPath, progressState);

        continue;
      }

      if (pass === 'weaver') {
        const anatomistInput = dependencyMode === 'live' ? liveAnatomist : fixtureAnatomist;
        const lexicographerInput = dependencyMode === 'live' ? liveLexicographer : fixtureLexicographer;
        const result = await runWeaverPass({
          phaseId,
          workId,
          segments,
          anatomist: anatomistInput,
          lexicographer: lexicographerInput,
          englishText,
          settings,
          structuredOutputs,
          llmCaller,
          maxTokens: maxTokens ?? undefined,
        });

        const llm = result.llm;
        rows.push(
          toMetricRow({
            runId,
            pass,
            stage: 'pass',
            provider: llm?.provider ?? settings.provider,
            model: llm?.model ?? settings.model,
            promptVersion: SUTTA_STUDIO_PROMPT_VERSION,
            structuredOutputs,
            durationMs: llm?.durationMs ?? null,
            costUsd: llm?.costUsd ?? null,
            tokensPrompt: llm?.tokens?.prompt ?? null,
            tokensCompletion: llm?.tokens?.completion ?? null,
            tokensTotal: llm?.tokens?.total ?? null,
            success: !result.error,
            errorMessage: result.error ?? null,
            schemaName: result.schemaName ?? null,
            requestName: result.requestName,
            phaseId,
            chunkIndex: null,
            chunkCount: null,
            segmentCount: segments.length,
            dependencyMode,
            fixturePhase: phaseKey,
            workId,
          })
        );

        if (!result.error && result.output && dependencyMode === 'live') {
          liveWeaver = result.output;
        }

        progressState.stepsCompleted += 1;
        progressState.updatedAt = new Date().toISOString();
        progressState.percent = Math.min(
          100,
          Math.round((progressState.stepsCompleted / progressState.stepsTotal) * 100)
        );
        progressState.current = {
          runId,
          model: settings.model,
          provider: settings.provider,
          pass,
          stage: 'pass',
          passIndex: BENCHMARK_CONFIG.passes.indexOf(pass),
          runIndex,
          repeatIndex,
          chunkIndex: null,
          chunkCount: null,
        };
        progressState.message = `Completed ${pass}`;
        await writeProgressState(BENCHMARK_CONFIG.outputRoot, progressPath, progressState);

        continue;
      }

      if (pass === 'typesetter') {
        const anatomistInput = dependencyMode === 'live' ? liveAnatomist : fixtureAnatomist;
        const weaverInput = dependencyMode === 'live' ? liveWeaver : fixtureWeaver;
        const result = await runTypesetterPass({
          phaseId,
          workId,
          segments,
          anatomist: anatomistInput,
          weaver: weaverInput,
          settings,
          structuredOutputs,
          llmCaller,
          maxTokens: maxTokens ?? undefined,
        });

        const llm = result.llm;
        rows.push(
          toMetricRow({
            runId,
            pass,
            stage: 'pass',
            provider: llm?.provider ?? settings.provider,
            model: llm?.model ?? settings.model,
            promptVersion: SUTTA_STUDIO_PROMPT_VERSION,
            structuredOutputs,
            durationMs: llm?.durationMs ?? null,
            costUsd: llm?.costUsd ?? null,
            tokensPrompt: llm?.tokens?.prompt ?? null,
            tokensCompletion: llm?.tokens?.completion ?? null,
            tokensTotal: llm?.tokens?.total ?? null,
            success: !result.error,
            errorMessage: result.error ?? null,
            schemaName: result.schemaName ?? null,
            requestName: result.requestName,
            phaseId,
            chunkIndex: null,
            chunkCount: null,
            segmentCount: segments.length,
            dependencyMode,
            fixturePhase: phaseKey,
            workId,
          })
        );

        progressState.stepsCompleted += 1;
        progressState.updatedAt = new Date().toISOString();
        progressState.percent = Math.min(
          100,
          Math.round((progressState.stepsCompleted / progressState.stepsTotal) * 100)
        );
        progressState.current = {
          runId,
          model: settings.model,
          provider: settings.provider,
          pass,
          stage: 'pass',
          passIndex: BENCHMARK_CONFIG.passes.indexOf(pass),
          runIndex,
          repeatIndex,
          chunkIndex: null,
          chunkCount: null,
        };
        progressState.message = `Completed ${pass}`;
        await writeProgressState(BENCHMARK_CONFIG.outputRoot, progressPath, progressState);

        continue;
      }

      if (pass === 'morphology') {
        const phaseViewInput = dependencyMode === 'live' ? livePhaseView : fixturePhaseView;
        const result = await runMorphologyPass({
          phaseId,
          segments,
          phaseView: phaseViewInput,
          settings,
          structuredOutputs,
          llmCaller,
          maxTokens: maxTokens ?? undefined,
        });

        const llm = result.llm;
        rows.push(
          toMetricRow({
            runId,
            pass,
            stage: 'pass',
            provider: llm?.provider ?? settings.provider,
            model: llm?.model ?? settings.model,
            promptVersion: SUTTA_STUDIO_PROMPT_VERSION,
            structuredOutputs,
            durationMs: llm?.durationMs ?? null,
            costUsd: llm?.costUsd ?? null,
            tokensPrompt: llm?.tokens?.prompt ?? null,
            tokensCompletion: llm?.tokens?.completion ?? null,
            tokensTotal: llm?.tokens?.total ?? null,
            success: !result.error,
            errorMessage: result.error ?? null,
            schemaName: result.schemaName ?? null,
            requestName: result.requestName,
            phaseId,
            chunkIndex: null,
            chunkCount: null,
            segmentCount: segments.length,
            dependencyMode,
            fixturePhase: phaseKey,
            workId,
          })
        );

        if (!result.error && result.output && dependencyMode === 'live') {
          livePhaseView = {
            ...phaseViewInput,
            paliWords: phaseViewInput.paliWords.map((word) => {
              const updated = result.output?.paliWords?.find((w) => w.id === word.id);
              return updated ? { ...word, segments: updated.segments } : word;
            }),
          };
        }

        progressState.stepsCompleted += 1;
        progressState.updatedAt = new Date().toISOString();
        progressState.percent = Math.min(
          100,
          Math.round((progressState.stepsCompleted / progressState.stepsTotal) * 100)
        );
        progressState.current = {
          runId,
          model: settings.model,
          provider: settings.provider,
          pass,
          stage: 'pass',
          passIndex: BENCHMARK_CONFIG.passes.indexOf(pass),
          runIndex,
          repeatIndex,
          chunkIndex: null,
          chunkCount: null,
        };
        progressState.message = `Completed ${pass}`;
        await writeProgressState(BENCHMARK_CONFIG.outputRoot, progressPath, progressState);
      }
    }
  }

    const jsonPath = path.join(outputDir, 'metrics.json');
    const csvPath = path.join(outputDir, 'metrics.csv');

    const payload = {
      generatedAt: new Date().toISOString(),
      promptVersion: SUTTA_STUDIO_PROMPT_VERSION,
      dependencyMode: BENCHMARK_CONFIG.dependencyMode,
      fixturePhase: phaseKey,
      workId,
      repeatRuns,
      captureOutputs: BENCHMARK_CONFIG.captureOutputs ?? null,
      skeletonSource,
      skeletonSegmentCount: skeletonSegments.length,
      runs: BENCHMARK_CONFIG.runs.map((run) => ({
        id: run.id,
        model: run.model,
      })),
      rows,
    };

    await fs.writeFile(jsonPath, JSON.stringify(payload, null, 2), 'utf8');
    await writeCsv(rows, csvPath);
    await writeBenchIndex(BENCHMARK_CONFIG.outputRoot);

    // Generate/update leaderboard with latest results
    try {
      await generateLeaderboard();
    } catch (err) {
      console.warn('[SuttaStudioBenchmark] Leaderboard generation failed:', err);
    }

    progressState.status = 'complete';
    progressState.updatedAt = new Date().toISOString();
    progressState.percent = 100;
    progressState.message = 'Benchmark complete.';
    progressState.current = null;
    await writeProgressState(BENCHMARK_CONFIG.outputRoot, progressPath, progressState);

    console.log(`[SuttaStudioBenchmark] Wrote ${rows.length} rows to ${outputDir}`);
  }
  } catch (error: any) {
    progressState.status = 'error';
    progressState.updatedAt = new Date().toISOString();
    progressState.message = 'Benchmark failed.';
    progressState.error = error?.message || String(error);
    addProgressError(progressState, {
      runId: progressState.current?.runId ?? 'unknown',
      pass: progressState.current?.pass ?? null,
      stage: progressState.current?.stage ?? null,
      message: progressState.error,
      chunkIndex: progressState.current?.chunkIndex ?? null,
      chunkCount: progressState.current?.chunkCount ?? null,
    });
    await writeProgressState(BENCHMARK_CONFIG.outputRoot, progressPath, progressState);
    throw error;
  }
};

runBenchmark().catch((error) => {
  console.error('[SuttaStudioBenchmark] Failed:', error);
  process.exitCode = 1;
});

import React from 'react';

type SkeletonSegment = {
  ref: { segmentId: string };
  pali?: string;
  baseEnglish?: string;
};

type SkeletonPhase = {
  id: string;
  title?: string | null;
  segmentIds: string[];
};

type BenchEntry = {
  id: string;
  label: string;
  kind: 'golden' | 'run';
  timestamp: string;
  runId: string;
  model?: string | null;
  provider?: string | null;
  segments: SkeletonSegment[];
  phases: SkeletonPhase[];
};

type BenchIndexEntry = {
  id: string;
  kind: 'golden' | 'run';
  timestamp: string;
  runId: string;
  provider?: string | null;
  model?: string | null;
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
  label?: string | null;
};

type BenchIndexPayload = {
  generatedAt: string;
  latestTimestamp?: string | null;
  entries: BenchIndexEntry[];
};

type BenchProgressPointer = {
  updatedAt: string;
  status: 'running' | 'complete' | 'error';
  progressPath: string;
  timestamp: string;
  stepsCompleted: number;
  stepsTotal: number;
  percent: number;
  errors?: Array<{
    at: string;
    runId: string;
    pass: string | null;
    stage: string | null;
    message: string;
    chunkIndex?: number | null;
    chunkCount?: number | null;
  }>;
  current?: {
    runId: string;
    model: string | null;
    provider: string | null;
    pass: string | null;
    stage: string | null;
    passIndex: number | null;
    runIndex: number | null;
    repeatIndex: number | null;
    chunkIndex: number | null;
    chunkCount: number | null;
  } | null;
  message?: string | null;
  error?: string | null;
};

const buildLabel = (entry: BenchIndexEntry) => {
  if (entry.label) return entry.label;
  const modelPart = entry.model ? ` · ${entry.model}` : '';
  const suffix = entry.kind === 'golden' ? ' · golden' : '';
  return `${entry.timestamp} · ${entry.runId}${modelPart}${suffix}`;
};

const sortEntries = (entries: BenchIndexEntry[]) =>
  [...entries].sort((a, b) => {
    const timeCmp = b.timestamp.localeCompare(a.timestamp);
    if (timeCmp !== 0) return timeCmp;
    if (a.kind !== b.kind) return a.kind === 'golden' ? -1 : 1;
    return a.runId.localeCompare(b.runId);
  });

const formatPhaseTitle = (title?: string | null) => {
  if (!title) return '(no title)';
  return title.trim().length ? title : '(no title)';
};

const PhaseList: React.FC<{ phases: SkeletonPhase[] }> = ({ phases }) => {
  if (!phases.length) {
    return <div className="text-sm text-gray-500">No phases generated.</div>;
  }
  return (
    <div className="space-y-2">
      {phases.map((phase, index) => (
        <div key={`${phase.id}-${index}`} className="rounded border border-gray-200 p-3">
          <div className="text-sm font-semibold text-gray-800">
            {phase.id} · {formatPhaseTitle(phase.title)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Segments: {phase.segmentIds.join(', ') || '(none)'}
          </div>
        </div>
      ))}
    </div>
  );
};

const BenchCard: React.FC<{
  entry: BenchEntry | null;
  options: BenchIndexEntry[];
  value: string;
  onChange: (value: string) => void;
}> = ({ entry, options, value, onChange }) => {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Select output
        </label>
        <select
          className="rounded border border-gray-300 bg-white px-2 py-1 text-sm"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          {options.map((item) => (
            <option key={item.id} value={item.id}>
              {buildLabel(item)}
            </option>
          ))}
        </select>
      </div>

      {!entry ? (
        <div className="mt-4 text-sm text-gray-500">No data selected.</div>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="text-sm text-gray-700">
            <span className="font-semibold">Kind:</span> {entry.kind}
          </div>
          <div className="text-sm text-gray-700">
            <span className="font-semibold">Model:</span> {entry.model ?? 'unknown'}
          </div>
          <div className="text-sm text-gray-700">
            <span className="font-semibold">Segments:</span> {entry.segments.length}
          </div>
          <PhaseList phases={entry.phases} />
        </div>
      )}
    </div>
  );
};

export const SuttaStudioBenchmarkView: React.FC = () => {
  const [entries, setEntries] = React.useState<BenchIndexEntry[]>([]);
  const [leftId, setLeftId] = React.useState<string>('');
  const [rightId, setRightId] = React.useState<string>('');
  const [leftEntry, setLeftEntry] = React.useState<BenchEntry | null>(null);
  const [rightEntry, setRightEntry] = React.useState<BenchEntry | null>(null);
  const [dataCache, setDataCache] = React.useState<Record<string, BenchEntry>>({});
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = React.useState<string | null>(null);
  const [progress, setProgress] = React.useState<BenchProgressPointer | null>(null);
  const [progressError, setProgressError] = React.useState<string | null>(null);

  const fetchIndex = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/reports/sutta-studio/index.json?ts=${Date.now()}`, {
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error(`Failed to load index: ${response.status}`);
      }
      const payload = (await response.json()) as BenchIndexPayload;
      const sorted = sortEntries(payload.entries ?? []);
      setEntries(sorted);
      setLastUpdated(payload.generatedAt ?? null);
    } catch (err: any) {
      setError(err?.message || 'Failed to load benchmark index.');
      setEntries([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void fetchIndex();
  }, [fetchIndex]);

  React.useEffect(() => {
    let active = true;
    const fetchProgress = async () => {
      try {
        const response = await fetch(`/reports/sutta-studio/active-run.json?ts=${Date.now()}`, {
          cache: 'no-store',
        });
        if (!response.ok) {
          if (response.status === 404) {
            if (active) {
              setProgress(null);
              setProgressError(null);
            }
            return;
          }
          throw new Error(`Failed to load progress: ${response.status}`);
        }
        const payload = (await response.json()) as BenchProgressPointer;
        if (active) {
          setProgress(payload);
          setProgressError(null);
        }
      } catch (err: any) {
        if (active) {
          setProgressError(err?.message || 'Failed to load progress.');
        }
      }
    };

    void fetchProgress();
    const interval = window.setInterval(fetchProgress, 3000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  React.useEffect(() => {
    if (!entries.length) {
      setLeftId('');
      setRightId('');
      return;
    }
    setLeftId((prev) => {
      if (prev && entries.some((item) => item.id === prev)) return prev;
      const firstRun = entries.find((item) => item.kind === 'run');
      return firstRun?.id ?? entries[0]?.id ?? '';
    });
    setRightId((prev) => {
      if (prev && entries.some((item) => item.id === prev)) return prev;
      const golden = entries.find((item) => item.kind === 'golden');
      return golden?.id ?? entries[0]?.id ?? '';
    });
  }, [entries]);

  const loadEntryData = React.useCallback(
    async (entry: BenchIndexEntry | null): Promise<BenchEntry | null> => {
      if (!entry) return null;
      if (dataCache[entry.id]) return dataCache[entry.id];
      const response = await fetch(`${entry.path}?ts=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Failed to load output: ${response.status}`);
      }
      const data = (await response.json()) as any;
      const resolved: BenchEntry = {
        id: entry.id,
        label: buildLabel(entry),
        kind: entry.kind,
        timestamp: entry.timestamp,
        runId: entry.runId,
        model: entry.model ?? data?.model ?? null,
        provider: entry.provider ?? data?.provider ?? null,
        segments: data?.segments ?? [],
        phases: data?.phases ?? [],
      };
      setDataCache((prev) => ({ ...prev, [entry.id]: resolved }));
      return resolved;
    },
    [dataCache]
  );

  React.useEffect(() => {
    const entry = entries.find((item) => item.id === leftId) ?? null;
    if (!entry) {
      setLeftEntry(null);
      return;
    }
    let cancelled = false;
    loadEntryData(entry)
      .then((result) => {
        if (!cancelled) setLeftEntry(result);
      })
      .catch((err: any) => {
        if (!cancelled) {
          setLeftEntry(null);
          setError(err?.message || 'Failed to load left entry.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [entries, leftId, loadEntryData]);

  React.useEffect(() => {
    const entry = entries.find((item) => item.id === rightId) ?? null;
    if (!entry) {
      setRightEntry(null);
      return;
    }
    let cancelled = false;
    loadEntryData(entry)
      .then((result) => {
        if (!cancelled) setRightEntry(result);
      })
      .catch((err: any) => {
        if (!cancelled) {
          setRightEntry(null);
          setError(err?.message || 'Failed to load right entry.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [entries, rightId, loadEntryData]);

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <header>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">Sutta Studio Bench</h1>
              <p className="text-sm text-gray-600">
                Side-by-side skeleton aggregate comparison (golden included).
              </p>
              {lastUpdated && (
                <p className="text-xs text-gray-500 mt-1">
                  Index updated: {new Date(lastUpdated).toLocaleString()}
                </p>
              )}
            </div>
            <button
              type="button"
              className="rounded border border-gray-300 bg-white px-3 py-1 text-sm text-gray-700 shadow-sm hover:bg-gray-50"
              onClick={() => void fetchIndex()}
            >
              Refresh
            </button>
          </div>
        </header>

        {progress ? (
          <div className="rounded border border-gray-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold text-gray-700">
                Benchmark {progress.status === 'running' ? 'running' : progress.status}
              </div>
              <div className="text-xs text-gray-500">
                Updated {new Date(progress.updatedAt).toLocaleTimeString()}
              </div>
            </div>
            <div className="mt-2 h-2 w-full rounded bg-gray-200">
              <div
                className="h-2 rounded bg-emerald-500"
                style={{ width: `${Math.min(100, Math.max(0, progress.percent))}%` }}
              />
            </div>
            <div className="mt-2 text-xs text-gray-600">
              {progress.stepsCompleted} / {progress.stepsTotal} steps · {progress.percent}%
            </div>
            {progress.current && (
              <div className="mt-2 text-sm text-gray-700">
                {progress.current.runId} · {progress.current.pass}
                {progress.current.chunkCount !== null && progress.current.chunkIndex !== null
                  ? ` · chunk ${progress.current.chunkIndex + 1}/${progress.current.chunkCount}`
                  : ''}
              </div>
            )}
            {progress.message && (
              <div className="mt-1 text-xs text-gray-500">{progress.message}</div>
            )}
            {progress.error && (
              <div className="mt-2 text-xs text-red-600">{progress.error}</div>
            )}
            {progress.errors?.length ? (
              <div className="mt-3 rounded border border-red-100 bg-red-50 p-3">
                <div className="text-xs font-semibold text-red-700">
                  Errors ({progress.errors.length})
                </div>
                <div className="mt-2 max-h-40 space-y-1 overflow-auto text-xs text-red-700">
                  {progress.errors.map((err, index) => {
                    const chunkInfo =
                      err.chunkIndex !== null &&
                      err.chunkIndex !== undefined &&
                      err.chunkCount !== null &&
                      err.chunkCount !== undefined
                        ? ` · chunk ${err.chunkIndex + 1}/${err.chunkCount}`
                        : '';
                    const passInfo = err.pass ? ` · ${err.pass}` : '';
                    const stageInfo = err.stage ? ` · ${err.stage}` : '';
                    return (
                      <div key={`${err.at}-${index}`}>
                        [{new Date(err.at).toLocaleTimeString()}] {err.runId}
                        {passInfo}
                        {stageInfo}
                        {chunkInfo}: {err.message}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        ) : progressError ? (
          <div className="rounded border border-red-200 bg-white p-4 text-sm text-red-600">
            {progressError}
          </div>
        ) : null}

        {isLoading ? (
          <div className="rounded border border-gray-200 bg-white p-6 text-sm text-gray-600">
            Loading benchmark index...
          </div>
        ) : error ? (
          <div className="rounded border border-red-200 bg-white p-6 text-sm text-red-600">
            {error}
          </div>
        ) : entries.length === 0 ? (
          <div className="rounded border border-gray-200 bg-white p-6 text-sm text-gray-600">
            No benchmark outputs found. Run the benchmark to generate reports under
            <code className="mx-1">reports/sutta-studio</code>.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <BenchCard entry={leftEntry} options={entries} value={leftId} onChange={setLeftId} />
            <BenchCard entry={rightEntry} options={entries} value={rightId} onChange={setRightId} />
          </div>
        )}
      </div>
    </div>
  );
};

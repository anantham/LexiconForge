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
  path: string;
  label?: string | null;
};

type BenchIndexPayload = {
  generatedAt: string;
  latestTimestamp?: string | null;
  entries: BenchIndexEntry[];
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
  entries: BenchEntry[];
  value: string;
  onChange: (value: string) => void;
}> = ({ entry, entries, value, onChange }) => {
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
          {entries.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
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
            <BenchCard entry={leftEntry} entries={entries} value={leftId} onChange={setLeftId} />
            <BenchCard entry={rightEntry} entries={entries} value={rightId} onChange={setRightId} />
          </div>
        )}
      </div>
    </div>
  );
};

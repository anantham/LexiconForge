import React from 'react';
import { DEMO_PACKET_MN10 } from '../sutta-studio/demoPacket';

type PassName = 'skeleton' | 'anatomist' | 'lexicographer' | 'weaver' | 'typesetter';

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
  // Pipeline outputs per phase
  pipelineOutputs?: Record<string, {
    anatomist?: any;
    lexicographer?: any;
    weaver?: any;
    typesetter?: any;
    errors?: Record<string, string | null>;
  }>;
  // Full packet for preview
  packet?: any;
};

type BenchIndexEntry = {
  id: string;
  kind: 'golden' | 'run';
  timestamp: string;
  runId: string;
  provider?: string | null;
  model?: string | null;
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
  label?: string | null;
};

type RunStatus = 'complete' | 'partial' | 'failed' | 'golden';

// Derive status from entry metrics
const getEntryStatus = (entry: BenchIndexEntry): RunStatus => {
  if (entry.kind === 'golden') return 'golden';

  // If no phases or very few, it's failed
  const phases = entry.phasesCount ?? 0;
  if (phases === 0) return 'failed';

  // If all phases succeeded (no missing metrics), it's complete
  const missingCount = entry.missingDurationCount ?? 0;
  if (missingCount === 0 && phases >= 7) return 'complete';

  // If most phases are missing, it's failed
  const totalExpected = entry.rowCount ?? 0;
  if (totalExpected > 0 && missingCount > totalExpected * 0.5) return 'failed';

  return 'partial';
};

const STATUS_LABELS: Record<RunStatus, { label: string; color: string }> = {
  complete: { label: 'Complete', color: 'bg-emerald-100 text-emerald-800' },
  partial: { label: 'Partial', color: 'bg-amber-100 text-amber-800' },
  failed: { label: 'Failed', color: 'bg-red-100 text-red-800' },
  golden: { label: 'Golden', color: 'bg-purple-100 text-purple-800' },
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

const PASS_OPTIONS: { value: PassName; label: string }[] = [
  { value: 'skeleton', label: 'Skeleton (phases)' },
  { value: 'anatomist', label: 'Anatomist (words/segments)' },
  { value: 'lexicographer', label: 'Lexicographer (senses)' },
  { value: 'weaver', label: 'Weaver (english structure)' },
  { value: 'typesetter', label: 'Typesetter (layout blocks)' },
];

const PassOutput: React.FC<{ pass: PassName; data: any; phaseId: string }> = ({ pass, data, phaseId }) => {
  if (!data) {
    return <div className="text-xs text-gray-400 italic">No {pass} output</div>;
  }

  if (pass === 'anatomist') {
    const words = data.words || [];
    const segments = data.segments || [];
    const relations = data.relations || [];
    return (
      <div className="text-xs space-y-1">
        <div><span className="font-medium">Words:</span> {words.length}</div>
        <div className="pl-2 space-y-0.5">
          {words.slice(0, 5).map((w: any) => (
            <div key={w.id} className="text-gray-600">
              {w.id}: {w.surface} ({w.wordClass}) → {w.segmentIds?.length || 0} segs
            </div>
          ))}
          {words.length > 5 && <div className="text-gray-400">...and {words.length - 5} more</div>}
        </div>
        <div><span className="font-medium">Segments:</span> {segments.length}</div>
        <div><span className="font-medium">Relations:</span> {relations.length}</div>
      </div>
    );
  }

  if (pass === 'lexicographer') {
    const senses = data.senses || [];
    return (
      <div className="text-xs space-y-1">
        <div><span className="font-medium">Senses:</span> {senses.length}</div>
        <div className="pl-2 space-y-0.5">
          {senses.slice(0, 5).map((s: any, i: number) => (
            <div key={i} className="text-gray-600">
              {s.wordId}: {s.senses?.map((sense: any) => sense.english).join(', ') || '(none)'}
            </div>
          ))}
          {senses.length > 5 && <div className="text-gray-400">...and {senses.length - 5} more</div>}
        </div>
      </div>
    );
  }

  if (pass === 'weaver') {
    const tokens = data.tokens || data.englishStructure || [];
    const ghosts = tokens.filter((t: any) => t.isGhost);
    const linked = tokens.filter((t: any) => t.linkedPaliId || t.linkedSegmentId);
    return (
      <div className="text-xs space-y-1">
        <div><span className="font-medium">Tokens:</span> {tokens.length}</div>
        <div><span className="font-medium">Ghosts:</span> {ghosts.length}</div>
        <div><span className="font-medium">Linked:</span> {linked.length}</div>
      </div>
    );
  }

  if (pass === 'typesetter') {
    const blocks = data.layoutBlocks || [];
    return (
      <div className="text-xs space-y-1">
        <div><span className="font-medium">Layout Blocks:</span> {blocks.length}</div>
        <div className="pl-2 space-y-0.5">
          {blocks.map((block: string[], i: number) => (
            <div key={i} className="text-gray-600">
              Block {i + 1}: [{block.join(', ')}]
            </div>
          ))}
        </div>
        {data.handoff && (
          <div className="text-gray-500 mt-1">
            Confidence: {data.handoff.confidence}
          </div>
        )}
      </div>
    );
  }

  return <pre className="text-xs overflow-auto max-h-32">{JSON.stringify(data, null, 2)}</pre>;
};

const PhaseList: React.FC<{
  phases: SkeletonPhase[];
  pass: PassName;
  pipelineOutputs?: BenchEntry['pipelineOutputs'];
}> = ({ phases, pass, pipelineOutputs }) => {
  if (!phases.length) {
    return <div className="text-sm text-gray-500">No phases generated.</div>;
  }
  return (
    <div className="space-y-2">
      {phases.map((phase, index) => {
        const pipelineData = pipelineOutputs?.[phase.id];
        const passData = pass === 'skeleton' ? null : pipelineData?.[pass];
        const passError = pipelineData?.errors?.[pass];

        return (
          <div key={`${phase.id}-${index}`} className="rounded border border-gray-200 p-3">
            <div className="text-sm font-semibold text-gray-800">
              {phase.id} · {formatPhaseTitle(phase.title)}
            </div>
            {pass === 'skeleton' ? (
              <div className="text-xs text-gray-500 mt-1">
                Segments: {phase.segmentIds.join(', ') || '(none)'}
              </div>
            ) : (
              <div className="mt-2">
                {passError ? (
                  <div className="text-xs text-red-600">Error: {passError}</div>
                ) : (
                  <PassOutput pass={pass} data={passData} phaseId={phase.id} />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const BenchCard: React.FC<{
  entry: BenchEntry | null;
  options: BenchIndexEntry[];
  value: string;
  onChange: (value: string) => void;
  pass: PassName;
  onPassChange: (pass: PassName) => void;
}> = ({ entry, options, value, onChange, pass, onPassChange }) => {
  // For golden data, link directly to /sutta/mn10 which shows DEMO_PACKET_MN10
  const viewFullUrl = entry?.kind === 'golden'
    ? '/sutta/mn10'
    : entry?.packet
      ? `/bench/sutta-studio/preview?entry=${encodeURIComponent(entry.id)}`
      : null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Run
            </label>
            <select
              className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm mt-1"
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
          <div className="w-48">
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Pass
            </label>
            <select
              className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm mt-1"
              value={pass}
              onChange={(event) => onPassChange(event.target.value as PassName)}
            >
              {PASS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {viewFullUrl && (
          <a
            href={viewFullUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-700 text-center"
          >
            View Full Output ↗
          </a>
        )}
      </div>

      {!entry ? (
        <div className="mt-4 text-sm text-gray-500">No data selected.</div>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="flex gap-4 text-sm text-gray-700">
            <div><span className="font-semibold">Kind:</span> {entry.kind}</div>
            <div><span className="font-semibold">Model:</span> {entry.model ?? 'unknown'}</div>
            <div><span className="font-semibold">Phases:</span> {entry.phases.length}</div>
          </div>
          <PhaseList
            phases={entry.phases}
            pass={pass}
            pipelineOutputs={entry.pipelineOutputs}
          />
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
  const [leftPass, setLeftPass] = React.useState<PassName>('skeleton');
  const [rightPass, setRightPass] = React.useState<PassName>('skeleton');

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

      // For golden entries, extract pass outputs from DEMO_PACKET_MN10
      if (entry.kind === 'golden') {
        const goldenPhases = DEMO_PACKET_MN10.phases ?? [];
        const pipelineOutputs: BenchEntry['pipelineOutputs'] = {};

        // Extract pass outputs from the demo packet's phases
        for (const phase of goldenPhases) {
          pipelineOutputs[phase.id] = {
            anatomist: {
              words: phase.paliWords?.map((w: any) => ({
                id: w.id,
                surface: w.surface,
                wordClass: w.wordClass,
                segmentIds: w.segments?.map((s: any) => s.id) ?? [],
              })) ?? [],
              segments: phase.paliWords?.flatMap((w: any) => w.segments ?? []) ?? [],
              relations: phase.paliWords?.flatMap((w: any) =>
                (w.segments ?? []).filter((s: any) => s.relation).map((s: any) => ({
                  segmentId: s.id,
                  ...s.relation,
                }))
              ) ?? [],
            },
            lexicographer: {
              senses: phase.paliWords?.map((w: any) => ({
                wordId: w.id,
                senses: w.senses ?? [],
              })) ?? [],
            },
            weaver: {
              tokens: phase.englishStructure ?? [],
            },
            typesetter: {
              layoutBlocks: phase.layoutBlocks ?? [],
            },
          };
        }

        const resolved: BenchEntry = {
          id: entry.id,
          label: buildLabel(entry),
          kind: entry.kind,
          timestamp: entry.timestamp,
          runId: entry.runId,
          model: 'golden (DEMO_PACKET_MN10)',
          provider: null,
          segments: [],
          phases: goldenPhases.map((p: any) => ({
            id: p.id,
            title: p.title ?? null,
            segmentIds: p.canonicalSegmentIds ?? [],
          })),
          pipelineOutputs,
          packet: DEMO_PACKET_MN10,
        };
        setDataCache((prev) => ({ ...prev, [entry.id]: resolved }));
        return resolved;
      }

      // For benchmark runs, load from files
      const basePath = entry.path.replace(/\/[^/]+$/, '');

      const response = await fetch(`${entry.path}?ts=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Failed to load output: ${response.status}`);
      }
      const data = (await response.json()) as any;

      // Try to load pipeline outputs for each phase
      const pipelineOutputs: BenchEntry['pipelineOutputs'] = {};
      const phases = data?.phases ?? [];

      // Load pipeline files for each phase
      await Promise.all(
        phases.map(async (phase: SkeletonPhase) => {
          try {
            const pipelineResponse = await fetch(
              `${basePath}/pipeline-${phase.id}.json?ts=${Date.now()}`,
              { cache: 'no-store' }
            );
            if (pipelineResponse.ok) {
              const pipelineData = await pipelineResponse.json();
              pipelineOutputs[phase.id] = {
                anatomist: pipelineData.output?.anatomist,
                lexicographer: pipelineData.output?.lexicographer,
                weaver: pipelineData.output?.weaver,
                typesetter: pipelineData.output?.typesetter,
                errors: pipelineData.errors,
              };
            }
          } catch {
            // Ignore pipeline load errors
          }
        })
      );

      // Try to load the packet
      let packet = null;
      try {
        const packetResponse = await fetch(`${basePath}/packet.json?ts=${Date.now()}`, {
          cache: 'no-store',
        });
        if (packetResponse.ok) {
          packet = await packetResponse.json();
        }
      } catch {
        // Ignore packet load errors
      }

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
        pipelineOutputs,
        packet,
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
      <div className="max-w-7xl mx-auto space-y-6">
        <header>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">Sutta Studio Bench</h1>
              <p className="text-sm text-gray-600">
                Compare pipeline outputs across runs. Select pass to view detailed outputs.
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
                  {progress.errors.slice(0, 10).map((err, index) => {
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
                  {progress.errors.length > 10 && (
                    <div className="text-red-500">...and {progress.errors.length - 10} more</div>
                  )}
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <BenchCard
              entry={leftEntry}
              options={entries}
              value={leftId}
              onChange={setLeftId}
              pass={leftPass}
              onPassChange={setLeftPass}
            />
            <BenchCard
              entry={rightEntry}
              options={entries}
              value={rightId}
              onChange={setRightId}
              pass={rightPass}
              onPassChange={setRightPass}
            />
          </div>
        )}
      </div>
    </div>
  );
};

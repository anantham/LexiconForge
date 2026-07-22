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

type ValidationMetrics = {
  paliMismatch: number;
  englishMissing: number;
  duplicateMappings: number;
  degradedPhases: number;
  totalIssues: number;
  hasErrors: boolean;
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
  // Validation metrics from packet.compiler.validationIssues
  validation?: ValidationMetrics;
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

type LeaderboardEntry = {
  rank: number;
  modelId: string;
  modelName: string;
  overallScore: number;
  // v2.0 rubric (ADR SUTTA-009) + semantic judge (SUTTA-010)
  fidelityScore: number;
  segmentationFidelity: number;
  contentFidelity: number;
  // v2.2 ranked trio + score anatomy (optional: older deployed boards predate them)
  factsCore?: number;
  senseF1?: number;
  knowledgeScore?: number;
  gateKept?: number | null;
  gateDamagedPhases?: number;
  contentSemantic: number | null;
  judgeModel: string | null;
  paliWordCoverage: number;
  // legacy v1 aggregates (may be absent on new boards)
  coverageScore?: number;
  validityScore?: number;
  richnessScore?: number;
  grammarScore?: number;
  tokensTotal: number;
  durationMs: number;
  costUsd: number | null;
  phasesCount: number;
  runTimestamp: string;
  runId: string;
  packetPath: string;
};

type Leaderboard = {
  generatedAt: string;
  promptVersion: string;
  rubricVersion?: string;
  status?: string;
  coverageNote?: string;
  methodology: {
    docsUrl: string;
    rankingMetric: string;
    aggregation: string;
    description?: string;
  };
  excluded?: { models: string[]; reasons: string[] };
  entries: LeaderboardEntry[];
};

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

// Extract validation metrics from packet
const extractValidationMetrics = (packet: any): ValidationMetrics | undefined => {
  const issues = packet?.compiler?.validationIssues;
  if (!issues || !Array.isArray(issues)) return undefined;

  const metrics: ValidationMetrics = {
    paliMismatch: 0,
    englishMissing: 0,
    duplicateMappings: 0,
    degradedPhases: 0,
    totalIssues: issues.length,
    hasErrors: false,
  };

  for (const issue of issues) {
    if (issue.level === 'error') metrics.hasErrors = true;
    switch (issue.code) {
      case 'pali_text_mismatch':
        metrics.paliMismatch++;
        break;
      case 'english_content_missing':
        metrics.englishMissing++;
        break;
      case 'english_mapping_duplicate':
        metrics.duplicateMappings++;
        break;
      case 'phase_degraded':
        metrics.degradedPhases++;
        break;
    }
  }

  return metrics;
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

/** Column-header label with an instant, styled hover tooltip (native `title` is
 *  slow to appear and easy to miss). Dotted underline signals it's hoverable. */
function HeaderTip({ label, tip, align = 'left' }: { label: string; tip: string; align?: 'left' | 'right' }) {
  return (
    <span className="group relative inline-flex cursor-help items-center border-b border-dotted border-gray-400/70">
      {label}
      <span
        role="tooltip"
        className={`pointer-events-none absolute top-full z-30 mt-2 hidden w-56 whitespace-normal rounded-md bg-gray-900 px-2.5 py-2 text-[11px] font-normal normal-case leading-snug tracking-normal text-gray-100 shadow-xl ring-1 ring-white/10 group-hover:block ${align === 'right' ? 'right-0' : 'left-0'}`}
      >
        {tip}
      </span>
    </span>
  );
}

const fmtScore = (x: number | null | undefined, digits = 2): string =>
  x == null ? '—' : x.toFixed(digits);

const JUDGE_VERDICT_STYLE: Record<string, string> = {
  faithful: 'bg-green-100 text-green-700',
  enriched: 'bg-sky-100 text-sky-700',
  omission: 'bg-amber-100 text-amber-800',
  error: 'bg-red-100 text-red-700',
};

/** One stat in a phase's score strip. */
function PhaseStat({ label, value, tip }: { label: string; value: string; tip: string }) {
  return (
    <span className="inline-flex items-baseline gap-1 rounded bg-gray-100 px-1.5 py-0.5" title={tip}>
      <span className="text-[10px] uppercase tracking-wide text-gray-400">{label}</span>
      <span className="text-[11px] font-semibold text-gray-700">{value}</span>
    </span>
  );
}

/** The exact token diff the Content-F1 metric counted for one word — makes the score auditable. */
function TokenDiffRow({ tokens }: { tokens: any }) {
  if (!tokens) return null;
  const n = (a: any[]) => a?.length || 0;
  return (
    <details className="mt-1.5 rounded border border-gray-200 bg-white/70 px-2 py-1">
      <summary className="cursor-pointer select-none text-[11px] text-gray-500">
        <span className="font-medium text-gray-600">Content-F1 tokens</span>{' '}
        <span className="text-green-700">✓{n(tokens.matched)} matched</span> ·{' '}
        <span className="text-rose-600">+{n(tokens.modelOnly)} model-only</span> ·{' '}
        <span className="text-amber-700">−{n(tokens.goldenOnly)} golden-missing</span>
        {' '}→ F1 {fmtScore(tokens.f1)}
      </summary>
      <div className="mt-1 space-y-1 text-[11px] leading-relaxed">
        <div><span className="font-medium text-green-700">✓ matched (counted for the model):</span>{' '}
          <span className="text-green-800">{tokens.matched.join(' ') || '(none)'}</span></div>
        <div><span className="font-medium text-rose-600">+ model-only (counted AGAINST precision — not necessarily wrong, just absent from the golden):</span>{' '}
          <span className="text-rose-700">{tokens.modelOnly.join(' ') || '(none)'}</span></div>
        <div><span className="font-medium text-amber-700">− golden-only (counted against recall — golden content the model didn't say):</span>{' '}
          <span className="text-amber-800">{tokens.goldenOnly.join(' ') || '(none)'}</span></div>
      </div>
    </details>
  );
}

/** SUTTA-010 judge verdict for one word: score + verdict badge + one-line rationale. */
function JudgeRow({ judge }: { judge: any }) {
  if (!judge) return null;
  const style = JUDGE_VERDICT_STYLE[judge.verdict] || 'bg-gray-100 text-gray-600';
  return (
    <div className="mt-1.5 flex items-start gap-1.5 text-[11px]">
      <span className={`shrink-0 rounded px-1.5 py-0.5 font-semibold ${style}`}>
        judge {fmtScore(judge.score)} · {judge.verdict}{judge.hallucination ? ' ⚠' : ''}
      </span>
      {judge.goldenSuspect ? (
        <span className="shrink-0 rounded bg-purple-100 px-1.5 py-0.5 font-semibold text-purple-700" title="The judge flagged the GOLDEN itself as possibly wrong or overbroad for this word in context — golden-QA telemetry, does not change the score.">
          ⚑ golden?
        </span>
      ) : null}
      <span className="italic text-gray-500">{judge.rationale}</span>
    </div>
  );
}

/** Side-by-side golden-vs-model comparison, opened from a leaderboard "View" link.
 *  Data comes from public/benchmarks/compare/<modelId>.json (built by publish-compare.ts).
 *  Shows, per phase, how each pipeline stage did: Anatomist (morpheme split), Lexicographer
 *  (tooltips + senses, with the exact Content-F1 token diff), and the semantic judge. */
function ComparePanel({ modelId, data, loading, onBack }: { modelId: string; data: any; loading: boolean; onBack: () => void }) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button onClick={onBack} className="text-sm text-blue-600 hover:underline">← Back to leaderboard</button>
        <div className="text-sm text-gray-500">Golden vs <span className="font-medium text-gray-800">{modelId}</span></div>
      </div>
      {loading && <p className="py-10 text-center text-sm text-gray-500">Loading comparison…</p>}
      {!loading && !data && <p className="py-10 text-center text-sm text-gray-500">No published comparison for this model yet.</p>}
      {!loading && data && (
        <div className="space-y-5">
          <div className="rounded-md border border-gray-200 bg-gray-50 p-2.5 text-xs leading-relaxed text-gray-600">
            <p>
              {data.phases.length} graded phase(s). Each word: the <span className="font-medium">golden reference</span> (left) vs what <span className="font-medium">{modelId}</span> produced (right),
              broken down by pipeline stage:
            </p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              <li><span className="font-medium">Split (Anatomist)</span> — green = same morpheme split as the golden, amber = different split, red = word the model dropped. Scored as Seg-fidelity (F1 of morpheme cut positions).</li>
              <li><span className="font-medium">Content (Lexicographer)</span> — expand “Content-F1 tokens” to see the <em>exact</em> word-overlap the deterministic metric counted. “Model-only” tokens are penalized even when correct, if the golden doesn't contain them — that strictness is why Content scores look low; the judge below compensates.</li>
              <li><span className="font-medium">Judge (semantic)</span> — a neutral LLM reads golden vs model per word and scores <em>meaning</em>: correct-but-differently-worded ≈ 1.0, omission docked mildly, hallucination capped hard.</li>
            </ul>
          </div>
          {data.phases.map((phase: any) => (
            <div key={phase.phaseId} className="rounded-lg border border-gray-200 p-3">
              <div className="mb-1 flex items-baseline gap-2">
                <span className="text-[11px] uppercase tracking-wide text-gray-400">{phase.phaseId}</span>
                <span className="text-base text-gray-800" style={{ fontFamily: 'Georgia, serif' }}>{phase.pali}</span>
              </div>
              {phase.scores ? (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  <PhaseStat label="split" value={fmtScore(phase.scores.segF1)} tip="Anatomist stage: F1 of morpheme cut positions vs golden, pooled over aligned words" />
                  <PhaseStat label="content" value={fmtScore(phase.scores.contentF1)} tip="Lexicographer stage: strict token-overlap F1 of tooltips+senses vs golden (see per-word breakdown)" />
                  {phase.scores.contentPrecision != null ? <PhaseStat label="P" value={fmtScore(phase.scores.contentPrecision)} tip="Content precision: of what the model said, the golden-attested fraction" /> : null}
                  {phase.scores.contentRecall != null ? <PhaseStat label="R" value={fmtScore(phase.scores.contentRecall)} tip="Content recall: of what the golden requires, the fraction the model said (dropped words count as misses)" /> : null}
                  <PhaseStat label="judge" value={fmtScore(phase.scores.semantic)} tip="Semantic judge average over this phase's words (meaning-level, wording-independent)" />
                  <PhaseStat label="coverage" value={phase.scores.coverage == null ? '—' : `${Math.round(phase.scores.coverage * 100)}%`} tip="Fraction of golden words the model reproduced (by surface alignment)" />
                  <PhaseStat label="overall" value={fmtScore(phase.scores.overall)} tip="This phase's overall score: gate × (0.60·Fidelity + 0.25·Usability + 0.15·Richness)" />
                </div>
              ) : null}
              <div className="mb-2 grid grid-cols-2 gap-3 border-b pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                <div>Golden</div><div>{modelId}</div>
              </div>
              <div className="space-y-2">
                {phase.words.map((w: any, i: number) => (
                  <div key={i}>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded bg-gray-50 p-2">
                        <div className="text-sm font-medium text-gray-800">{w.surface} <code className="text-xs text-purple-700">{w.golden.seg}</code></div>
                        {w.golden.tips?.length ? <ul className="mt-1 list-disc pl-4 text-xs text-gray-600">{w.golden.tips.map((t: string, j: number) => <li key={j}>{t}</li>)}</ul> : null}
                        {w.golden.senses?.length ? <div className="mt-1 text-xs text-gray-500">senses: {w.golden.senses.join(' · ')}</div> : null}
                      </div>
                      <div className={`rounded p-2 ${w.model ? (w.model.segMatch ? 'bg-green-50' : 'bg-amber-50') : 'bg-red-50'}`}>
                        {w.model ? (
                          <>
                            <div className="text-sm font-medium text-gray-800">
                              <code className="text-xs text-purple-700">{w.model.seg}</code>{' '}
                              <span className={`text-xs ${w.model.segMatch ? 'text-green-600' : 'text-amber-600'}`}>{w.model.segMatch ? '✓ same split' : '✕ different split'}</span>
                            </div>
                            {w.model.tips?.length ? <ul className="mt-1 list-disc pl-4 text-xs text-gray-600">{w.model.tips.map((t: string, j: number) => <li key={j}>{t}</li>)}</ul> : null}
                            {w.model.senses?.length ? <div className="mt-1 text-xs text-gray-500">senses: {w.model.senses.join(' · ')}</div> : null}
                          </>
                        ) : <div className="text-xs text-red-600">⚠ no aligned word (dropped / different surface)</div>}
                      </div>
                    </div>
                    {w.model ? <TokenDiffRow tokens={w.tokens} /> : null}
                    <JudgeRow judge={w.judge} />
                  </div>
                ))}
              </div>
              {phase.unmatched?.length ? (
                <div className="mt-2 text-xs text-gray-500"><span className="font-medium">Model-only words (no golden reference):</span> {phase.unmatched.map((u: any) => u.surface).join(', ')}</div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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

const ValidationBadges: React.FC<{ validation?: ValidationMetrics }> = ({ validation }) => {
  if (!validation || validation.totalIssues === 0) {
    return <span className="px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">✓ Valid</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {validation.degradedPhases > 0 && (
        <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800" title="Phases that failed compilation">
          {validation.degradedPhases} degraded
        </span>
      )}
      {validation.paliMismatch > 0 && (
        <span className="px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800" title="Pali text doesn't match source">
          {validation.paliMismatch} pali mismatch
        </span>
      )}
      {validation.duplicateMappings > 0 && (
        <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800" title="Same segment linked by multiple English tokens">
          {validation.duplicateMappings} dup mappings
        </span>
      )}
      {validation.englishMissing > 0 && (
        <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800" title="Source English words missing from output">
          {validation.englishMissing} missing english
        </span>
      )}
    </div>
  );
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
  indexEntry: BenchIndexEntry | null;
  options: BenchIndexEntry[];
  value: string;
  onChange: (value: string) => void;
  pass: PassName;
  onPassChange: (pass: PassName) => void;
}> = ({ entry, indexEntry, options, value, onChange, pass, onPassChange }) => {
  // For golden data, link to /sutta/demo. For runs, use pipeline loader with path param
  const getPacketPath = () => {
    if (!indexEntry) return null;
    if (indexEntry.kind === 'golden') return null; // Golden uses /sutta/demo
    // Derive packet path from the output path
    const basePath = indexEntry.path.replace(/\/[^/]+$/, '');
    return `${basePath}/packet.json`;
  };

  const packetPath = getPacketPath();
  const viewFullUrl = entry?.kind === 'golden'
    ? '/sutta/demo'
    : packetPath
      ? `/sutta/pipeline?path=${encodeURIComponent(packetPath)}`
      : null;

  const status = indexEntry ? getEntryStatus(indexEntry) : null;
  const statusInfo = status ? STATUS_LABELS[status] : null;

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
          <div className="flex flex-wrap gap-2 text-sm text-gray-700">
            {statusInfo && (
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusInfo.color}`}>
                {statusInfo.label}
              </span>
            )}
            <span className="text-gray-500">
              {entry.kind === 'golden' ? 'Golden Reference' : (entry.model ?? 'unknown')}
            </span>
            <span className="text-gray-400">·</span>
            <span className="text-gray-500">{entry.phases.length} phases</span>
            {/* Only show expected mismatch for runs, not golden */}
            {entry.kind !== 'golden' && indexEntry?.phasesCount != null && entry.phases.length !== indexEntry.phasesCount && (
              <>
                <span className="text-gray-400">·</span>
                <span className="text-amber-600">(expected {indexEntry.phasesCount})</span>
              </>
            )}
          </div>
          {/* Validation metrics */}
          {entry.kind !== 'golden' && (
            <div className="border-t border-gray-100 pt-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
                Validation
              </div>
              <ValidationBadges validation={entry.validation} />
            </div>
          )}
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
  // Whether the local-dev benchmark index (reports/…/index.json) is actually available.
  // In production that path doesn't exist, so the Run Inspector (a dev tool) is hidden.
  const [indexAvailable, setIndexAvailable] = React.useState<boolean>(false);
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
  const [activeTab, setActiveTab] = React.useState<'leaderboard' | 'inspector'>('leaderboard');

  // Leaderboard state
  const [leaderboard, setLeaderboard] = React.useState<Leaderboard | null>(null);
  const [leaderboardLoading, setLeaderboardLoading] = React.useState<boolean>(true);
  const [leaderboardError, setLeaderboardError] = React.useState<string | null>(null);
  const [sortColumn, setSortColumn] = React.useState<keyof LeaderboardEntry>('rank');
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('asc');

  // Golden-vs-model comparison panel (opened from the "View" link)
  const [compareModel, setCompareModel] = React.useState<string | null>(null);
  const [compareData, setCompareData] = React.useState<any>(null);
  const [compareLoading, setCompareLoading] = React.useState<boolean>(false);
  React.useEffect(() => {
    if (!compareModel) { setCompareData(null); return; }
    let cancelled = false;
    setCompareLoading(true);
    setCompareData(null);
    fetch(`/benchmarks/compare/${encodeURIComponent(compareModel)}.json?ts=${Date.now()}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled) { setCompareData(d); setCompareLoading(false); } })
      .catch(() => { if (!cancelled) { setCompareData(null); setCompareLoading(false); } });
    return () => { cancelled = true; };
  }, [compareModel]);

  // Filters
  const [filterModel, setFilterModel] = React.useState<string>('all');
  const [filterStatus, setFilterStatus] = React.useState<RunStatus | 'all'>('all');
  const [filterTimestamp, setFilterTimestamp] = React.useState<string>('all');
  const [filterMinPhases, setFilterMinPhases] = React.useState<number>(0);
  const [filterQuality, setFilterQuality] = React.useState<'all' | 'valid' | 'has_issues'>('all');

  // Derive unique values for filter options
  const uniqueModels = React.useMemo(() => {
    const models = new Set<string>();
    entries.forEach((e) => {
      if (e.model) models.add(e.model);
    });
    return Array.from(models).sort();
  }, [entries]);

  const uniqueTimestamps = React.useMemo(() => {
    const timestamps = new Set<string>();
    entries.forEach((e) => timestamps.add(e.timestamp));
    return Array.from(timestamps).sort().reverse();
  }, [entries]);

  // Deduplicate golden entries - keep only the latest one since they're all identical
  const deduplicatedEntries = React.useMemo(() => {
    const goldenEntries = entries.filter((e) => e.kind === 'golden');
    const runEntries = entries.filter((e) => e.kind !== 'golden');

    // Keep only the first (latest) golden entry if any exist
    const latestGolden = goldenEntries.length > 0 ? [goldenEntries[0]] : [];

    return [...latestGolden, ...runEntries];
  }, [entries]);

  // Apply filters
  const filteredEntries = React.useMemo(() => {
    return deduplicatedEntries.filter((e) => {
      if (filterModel !== 'all' && e.model !== filterModel) return false;
      if (filterStatus !== 'all' && getEntryStatus(e) !== filterStatus) return false;
      if (filterTimestamp !== 'all' && e.timestamp !== filterTimestamp) return false;
      if (filterMinPhases > 0 && (e.phasesCount ?? 0) < filterMinPhases) return false;
      return true;
    });
  }, [deduplicatedEntries, filterModel, filterStatus, filterTimestamp, filterMinPhases]);

  const fetchIndex = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/reports/sutta-studio/index.json?ts=${Date.now()}`, {
        cache: 'no-store',
      });
      // In production the reports/ dir isn't served, so this path resolves to the SPA
      // index.html (200 + text/html). Treat anything that isn't real JSON as "the run
      // index isn't available here" (dev-only feature) rather than crashing on a parse error.
      const contentType = response.headers.get('content-type') || '';
      if (!response.ok || !contentType.includes('json')) {
        setEntries([]);
        setIndexAvailable(false);
        setError(null);
        return;
      }
      const payload = (await response.json()) as BenchIndexPayload;
      const sorted = sortEntries(payload.entries ?? []);
      setEntries(sorted);
      setLastUpdated(payload.generatedAt ?? null);
      setIndexAvailable(true);
    } catch {
      // Not available here (e.g. published site) — degrade quietly, don't surface a raw error.
      setEntries([]);
      setIndexAvailable(false);
      setError(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void fetchIndex();
  }, [fetchIndex]);

  // Fetch leaderboard
  const fetchLeaderboard = React.useCallback(async () => {
    setLeaderboardLoading(true);
    setLeaderboardError(null);
    try {
      // Prefer the committed/published copy (served in prod); fall back to the local
      // reports copy for dev before a public board has been committed.
      const ts = Date.now();
      let response = await fetch(`/benchmarks/sutta-studio-leaderboard.json?ts=${ts}`, { cache: 'no-store' });
      if (!response.ok) {
        response = await fetch(`/reports/sutta-studio/leaderboard.json?ts=${ts}`, { cache: 'no-store' });
      }
      if (!response.ok) {
        if (response.status === 404) {
          setLeaderboardError('Leaderboard not yet generated. Run a benchmark first.');
          return;
        }
        throw new Error(`Failed to load leaderboard: ${response.status}`);
      }
      const data = (await response.json()) as Leaderboard;
      setLeaderboard(data);
    } catch (err: any) {
      setLeaderboardError(err?.message || 'Failed to load leaderboard.');
    } finally {
      setLeaderboardLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void fetchLeaderboard();
  }, [fetchLeaderboard]);

  // Sorted leaderboard entries
  const sortedLeaderboardEntries = React.useMemo(() => {
    if (!leaderboard?.entries) return [];
    const entries = [...leaderboard.entries];
    entries.sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];
      if (aVal === null) return 1;
      if (bVal === null) return -1;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return sortDirection === 'asc'
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
    return entries;
  }, [leaderboard, sortColumn, sortDirection]);

  const handleSort = (column: keyof LeaderboardEntry) => {
    if (sortColumn === column) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection(column === 'rank' ? 'asc' : 'desc');
    }
  };

  React.useEffect(() => {
    // Live-progress polling is a local-dev concern (watching a running benchmark). The
    // published site has no reports/active-run.json, so don't poll it there.
    if (!indexAvailable) return;
    let active = true;
    const fetchProgress = async () => {
      try {
        const response = await fetch(`/reports/sutta-studio/active-run.json?ts=${Date.now()}`, {
          cache: 'no-store',
        });
        const contentType = response.headers.get('content-type') || '';
        if (!response.ok || !contentType.includes('json')) {
          if (active) {
            setProgress(null);
            setProgressError(null);
          }
          return;
        }
        const payload = (await response.json()) as BenchProgressPointer;
        if (active) {
          setProgress(payload);
          setProgressError(null);
        }
      } catch {
        if (active) {
          setProgress(null);
          setProgressError(null);
        }
      }
    };

    void fetchProgress();
    const interval = window.setInterval(fetchProgress, 3000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [indexAvailable]);

  React.useEffect(() => {
    if (!filteredEntries.length) {
      setLeftId('');
      setRightId('');
      return;
    }
    setLeftId((prev) => {
      if (prev && filteredEntries.some((item) => item.id === prev)) return prev;
      const firstComplete = filteredEntries.find((item) => getEntryStatus(item) === 'complete');
      const firstRun = filteredEntries.find((item) => item.kind === 'run');
      return firstComplete?.id ?? firstRun?.id ?? filteredEntries[0]?.id ?? '';
    });
    setRightId((prev) => {
      if (prev && filteredEntries.some((item) => item.id === prev)) return prev;
      const golden = filteredEntries.find((item) => item.kind === 'golden');
      return golden?.id ?? filteredEntries[0]?.id ?? '';
    });
  }, [filteredEntries]);

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
        validation: extractValidationMetrics(packet),
      };
      setDataCache((prev) => ({ ...prev, [entry.id]: resolved }));
      return resolved;
    },
    [dataCache]
  );

  // Find index entries for passing to BenchCard
  const leftIndexEntry = React.useMemo(
    () => filteredEntries.find((item) => item.id === leftId) ?? null,
    [filteredEntries, leftId]
  );
  const rightIndexEntry = React.useMemo(
    () => filteredEntries.find((item) => item.id === rightId) ?? null,
    [filteredEntries, rightId]
  );

  React.useEffect(() => {
    if (!leftIndexEntry) {
      setLeftEntry(null);
      return;
    }
    let cancelled = false;
    loadEntryData(leftIndexEntry)
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
  }, [leftIndexEntry, loadEntryData]);

  React.useEffect(() => {
    if (!rightIndexEntry) {
      setRightEntry(null);
      return;
    }
    let cancelled = false;
    loadEntryData(rightIndexEntry)
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
  }, [rightIndexEntry, loadEntryData]);

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
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded border border-gray-300 bg-white px-3 py-1 text-sm text-gray-700 shadow-sm hover:bg-gray-50"
                onClick={() => {
                  void fetchIndex();
                  void fetchLeaderboard();
                }}
              >
              Refresh
              </button>
            </div>
          </div>
        </header>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-200">
          <button
            type="button"
            className={`px-4 py-2 text-sm font-medium rounded-t ${
              activeTab === 'leaderboard'
                ? 'bg-white border border-b-0 border-gray-200 text-gray-900'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('leaderboard')}
          >
            Leaderboard
          </button>
          {/* Run Inspector is a local-dev tool (browses reports/ run data). Hide it on the
              published site where that data isn't served. */}
          {indexAvailable && (
            <button
              type="button"
              className={`px-4 py-2 text-sm font-medium rounded-t ${
                activeTab === 'inspector'
                  ? 'bg-white border border-b-0 border-gray-200 text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setActiveTab('inspector')}
            >
              Run Inspector
            </button>
          )}
        </div>

        {/* Leaderboard Tab */}
        {activeTab === 'leaderboard' && (
          <div className="rounded border border-gray-200 bg-white p-4">
            {leaderboardLoading && (
              <div className="text-sm text-gray-500">Loading leaderboard...</div>
            )}
            {leaderboardError && (
              <div className="text-sm text-red-600">{leaderboardError}</div>
            )}
            {leaderboard && !leaderboardLoading && (
              <div className="space-y-4">
                {leaderboard.coverageNote && (
                  <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    <span className="font-semibold uppercase tracking-wide">
                      {leaderboard.status === 'preview' ? 'Preview' : 'Note'}
                    </span>{' '}
                    {leaderboard.coverageNote}
                  </div>
                )}
                {(leaderboard as any).grounding && (
                  <details className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700">
                    <summary className="cursor-pointer select-none font-semibold">
                      Grounding &amp; provenance — whose authority backs each layer
                      {(leaderboard as any).grounding.closedBook ? (
                        <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 font-medium text-slate-700">closed-book</span>
                      ) : null}
                    </summary>
                    <p className="mt-2 text-gray-600">{(leaderboard as any).grounding.closedBookNote}</p>
                    <table className="mt-2 w-full text-left">
                      <thead>
                        <tr className="text-[10px] uppercase tracking-wide text-gray-400">
                          <th className="py-1 pr-2">Source</th><th className="py-1 pr-2">Authority</th><th className="py-1">Role</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(leaderboard as any).grounding.sources.map((s: any, i: number) => (
                          <tr key={i} className="border-t border-gray-200 align-top">
                            <td className="py-1 pr-2 font-medium">{s.name}</td>
                            <td className="py-1 pr-2 whitespace-nowrap">{s.authority}</td>
                            <td className="py-1 text-gray-600">{s.role}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="mt-2 font-semibold text-gray-600">Known circularity (disclosed, being worked down):</p>
                    <ul className="mt-1 list-disc pl-4 text-gray-600">
                      {(leaderboard as any).grounding.knownCircularity.map((c: string, i: number) => <li key={i}>{c}</li>)}
                    </ul>
                  </details>
                )}
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold">
                      Model Leaderboard
                      {leaderboard.rubricVersion && (
                        <span className="ml-2 text-xs font-normal text-gray-400">rubric v{leaderboard.rubricVersion}</span>
                      )}
                    </h2>
                    <p className="text-xs text-gray-500">
                      Ranking by: Overall Score (deterministic) | Best run per model |{' '}
                      <a
                        href={leaderboard.methodology.docsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                        title="View scoring methodology"
                      >
                        Methodology ?
                      </a>
                    </p>
                    {/* Score anatomy — the one line that makes every rank interpretable.
                        Two layers: what the model KNOWS (weighted trio) × what its output
                        structure DELIVERS (the gate). Without this, Gate-damaged models
                        just look mysteriously bad. */}
                    <p className="mt-1 font-mono text-[11px] text-gray-600">
                      Overall = <span title="Structural integrity multiplier: textIntegrity (fraction of the Pāli surface the model's segments reconstruct) × a soft structural factor (empty-segments, duplicate-mappings, relations, word coverage — bounded 0.7–1.0). A brilliant gloss attached to nothing is a dead tooltip — the gate prices it that way." className="cursor-help underline decoration-dotted">Gate</span>
                      {' × ('}0.40·<span title="Morpheme-boundary F1 vs the golden's cuts" className="cursor-help underline decoration-dotted">Seg</span>
                      {' + '}0.30·<span title="Word-class labeling + root recovery, macro-averaged" className="cursor-help underline decoration-dotted">Facts</span>
                      {' + '}0.30·<span title="F1 over the golden's accepted senses — precision-capped, so spraying senses doesn't score" className="cursor-help underline decoration-dotted">Sense</span>
                      {')'}
                      <span className="ml-2 text-gray-400">— Content/P/R/Halluc/Semantic are advisory (never ranked); Coverage feeds the Gate's soft term.</span>
                    </p>
                  </div>
                  <div className="text-xs text-gray-500">
                    Last updated: {new Date(leaderboard.generatedAt).toLocaleString()}
                  </div>
                </div>

                {compareModel ? (
                  <ComparePanel modelId={compareModel} data={compareData} loading={compareLoading} onBack={() => setCompareModel(null)} />
                ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                        <th className="px-3 py-2 cursor-pointer hover:bg-gray-50" onClick={() => handleSort('rank')}>
                          # {sortColumn === 'rank' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="px-3 py-2 cursor-pointer hover:bg-gray-50" onClick={() => handleSort('modelId')}>
                          Model {sortColumn === 'modelId' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="px-3 py-2 cursor-pointer hover:bg-gray-50" onClick={() => handleSort('overallScore')}>
                          <HeaderTip label="Overall" tip="Ranked total (rubric v2.2): Gate × (0.40·Seg + 0.30·Facts + 0.30·Sense). Deterministic against the hand-curated golden — no LLM judge in rank. Higher = closer to the golden reference." />{' '}
                          {sortColumn === 'overallScore' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="px-3 py-2 cursor-pointer hover:bg-gray-50" onClick={() => handleSort('segmentationFidelity')}>
                          <HeaderTip label="Seg" tip="Segmentation fidelity (40% of knowledge) — micro-F1 of the model's morpheme boundaries vs the golden. Did it split each word the same way?" />{' '}
                          {sortColumn === 'segmentationFidelity' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="px-3 py-2 cursor-pointer hover:bg-gray-50" onClick={() => handleSort('factsCore')}>
                          <HeaderTip label="Facts" tip="factsCore (30%) — word-class labeling + root recovery, macro-averaged. Scored over ALL golden words (labeling everything 'content' earns nothing)." />{' '}
                          {sortColumn === 'factsCore' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="px-3 py-2 cursor-pointer hover:bg-gray-50" onClick={() => handleSort('senseF1')}>
                          <HeaderTip label="Sense" tip="senseF1 (30%) — harmonic mean of precision & recall over the golden's accepted sense lists. Precision-capped: offering 19 senses to hit 7 costs you." />{' '}
                          {sortColumn === 'senseF1' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="px-3 py-2 cursor-pointer hover:bg-gray-50" onClick={() => handleSort('gateKept')}>
                          <HeaderTip label="Gate" tip="Share of the model's knowledge score that survived structural integrity (does its analysis anchor to the actual Pāli text?). 100% = clean delivery. Low Gate = the model knows more than its rank shows — but ships it broken, and a tooltip pointing at nothing is a dead link." />{' '}
                          {sortColumn === 'gateKept' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="px-3 py-2 cursor-pointer hover:bg-gray-50" onClick={() => handleSort('contentFidelity')}>
                          <HeaderTip label="Content" tip="Content fidelity — token-F1 of etymology + glosses vs the golden. Deterministic, so it can't reward valid paraphrase or enrichment (that's what Semantic is for)." />{' '}
                          {sortColumn === 'contentFidelity' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="px-3 py-2">
                          <HeaderTip label="P" tip="Content precision — of everything the model said, the fraction the golden attests. A thin golden deflates this for every model roughly equally." />
                        </th>
                        <th className="px-3 py-2">
                          <HeaderTip label="R" tip="Content recall — of everything the golden requires, the fraction the model said. v2.1: words the model dropped count as misses." />
                        </th>
                        <th className="px-3 py-2">
                          <HeaderTip label="Halluc" tip="Hallucination rate — share of judged words where the judge found a confident FALSE claim about the Pāli (wrong root, invented etymology, wrong grammar). Closed-book is not an excuse to make things up. Lower is better." />
                        </th>
                        <th className="px-3 py-2 cursor-pointer hover:bg-gray-50" onClick={() => handleSort('contentSemantic')}>
                          <HeaderTip label="Semantic" tip="Semantic score — an LLM judge (gpt-4o-mini) rating word content 0–1: rewards correct enrichment, penalizes hallucination. Advisory — NOT in the ranked total." />{' '}
                          {sortColumn === 'contentSemantic' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="px-3 py-2 cursor-pointer hover:bg-gray-50" onClick={() => handleSort('paliWordCoverage')}>
                          <HeaderTip label="Coverage" tip="Coverage — fraction of the golden's Pāli words the model actually reproduced by surface (feeds the gate)." />{' '}
                          {sortColumn === 'paliWordCoverage' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="px-3 py-2 cursor-pointer hover:bg-gray-50" onClick={() => handleSort('tokensTotal')}>
                          <HeaderTip label="Tokens" tip="Total tokens (prompt + completion) across all pipeline passes for this model's run." />{' '}
                          {sortColumn === 'tokensTotal' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="px-3 py-2 cursor-pointer hover:bg-gray-50" onClick={() => handleSort('costUsd')}>
                          <HeaderTip label="Cost" align="right" tip="Total OpenRouter API cost (USD) for this model's full run across all phases." />{' '}
                          {sortColumn === 'costUsd' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="px-3 py-2">View</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedLeaderboardEntries.map((entry) => {
                        const scoreColor = (score: number) =>
                          score >= 0.8 ? 'text-green-600' : score >= 0.6 ? 'text-amber-600' : 'text-red-600';
                        const rankBadge =
                          entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : '';
                        const cost = entry.costUsd ? `$${entry.costUsd.toFixed(3)}` : 'free';
                        const tokens =
                          entry.tokensTotal > 1000
                            ? `${(entry.tokensTotal / 1000).toFixed(1)}k`
                            : entry.tokensTotal;

                        return (
                          <tr
                            key={entry.modelId}
                            className="border-b border-gray-100 hover:bg-gray-50"
                          >
                            <td className="px-3 py-2 font-medium">
                              {rankBadge || entry.rank}
                              {(entry as any).tiedWithAbove ? (
                                <span className="ml-0.5 text-xs text-gray-400" title="Statistical tie: this model's 95% confidence interval overlaps the model above (30 phases, bootstrap). The order within a tie is not meaningful.">=</span>
                              ) : null}
                            </td>
                            <td className="px-3 py-2">
                              <div className="font-medium">{entry.modelId}</div>
                              <div className="text-xs text-gray-400">{entry.modelName}</div>
                            </td>
                            <td className={`px-3 py-2 font-semibold ${scoreColor(entry.overallScore)}`}>
                              {entry.overallScore.toFixed(2)}
                              {(entry as any).overallScoreCI ? (
                                <span className="ml-1 text-[10px] font-normal text-gray-400" title={`95% bootstrap CI over per-phase scores: ${(entry as any).overallScoreCI[0].toFixed(2)}–${(entry as any).overallScoreCI[1].toFixed(2)}`}>
                                  ±{(((entry as any).overallScoreCI[1] - (entry as any).overallScoreCI[0]) / 2).toFixed(2)}
                                </span>
                              ) : null}
                            </td>
                            <td className={`px-3 py-2 ${scoreColor(entry.segmentationFidelity)}`}>
                              {entry.segmentationFidelity.toFixed(2)}
                            </td>
                            <td className={`px-3 py-2 ${(entry as any).factsCore == null ? 'text-gray-300' : scoreColor((entry as any).factsCore)}`}>
                              {(entry as any).factsCore == null ? '—' : (entry as any).factsCore.toFixed(2)}
                            </td>
                            <td className={`px-3 py-2 ${(entry as any).senseF1 == null ? 'text-gray-300' : scoreColor((entry as any).senseF1)}`}>
                              {(entry as any).senseF1 == null ? '—' : (entry as any).senseF1.toFixed(2)}
                            </td>
                            {/* Gate cell: % kept, amber under 95, red under 80. The tooltip is the
                                per-model diagnosis — knowledge vs delivered, and how many phases bit. */}
                            <td className={`px-3 py-2 ${(entry as any).gateKept == null ? 'text-gray-300' : (entry as any).gateKept < 0.8 ? 'text-red-600 font-medium' : (entry as any).gateKept < 0.95 ? 'text-amber-600' : 'text-gray-500'}`}>
                              {(entry as any).gateKept == null ? '—' : (
                                <span
                                  className="cursor-help"
                                  title={`Knowledge ${(entry as any).knowledgeScore?.toFixed(2)} × Gate ${(((entry as any).gateKept) * 100).toFixed(0)}% ≈ Overall ${entry.overallScore.toFixed(2)}. ${(entry as any).gateDamagedPhases ? `${(entry as any).gateDamagedPhases} phase(s) with structural damage (textIntegrity < 0.9) — analysis that didn't anchor to the Pāli text.` : 'No structurally damaged phases.'}`}
                                >
                                  {(((entry as any).gateKept) * 100).toFixed(0)}%
                                </span>
                              )}
                            </td>
                            <td className={`px-3 py-2 ${scoreColor(entry.contentFidelity)}`}>
                              {entry.contentFidelity.toFixed(2)}
                            </td>
                            <td className="px-3 py-2 text-gray-500">
                              {(entry as any).contentPrecision == null ? '—' : (entry as any).contentPrecision.toFixed(2)}
                            </td>
                            <td className="px-3 py-2 text-gray-500">
                              {(entry as any).contentRecall == null ? '—' : (entry as any).contentRecall.toFixed(2)}
                            </td>
                            <td className={`px-3 py-2 ${(entry as any).hallucinationRate == null ? 'text-gray-300' : (entry as any).hallucinationRate > 0.1 ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                              {(entry as any).hallucinationRate == null ? '—' : `${((entry as any).hallucinationRate * 100).toFixed(0)}%`}
                            </td>
                            <td className={`px-3 py-2 ${entry.contentSemantic == null ? 'text-gray-300' : scoreColor(entry.contentSemantic)}`}>
                              {entry.contentSemantic == null ? '—' : entry.contentSemantic.toFixed(2)}
                              {entry.selfJudge && (
                                <span className="ml-1 text-amber-600" title="Self-judge: the judge is the same model — this score is biased.">*</span>
                              )}
                            </td>
                            <td className={`px-3 py-2 ${scoreColor(entry.paliWordCoverage)}`}>
                              {entry.paliWordCoverage.toFixed(2)}
                            </td>
                            <td className="px-3 py-2 text-gray-600">{tokens}</td>
                            <td className="px-3 py-2 text-gray-600">
                              {cost === 'free' ? (
                                <span className="text-green-600">free</span>
                              ) : (
                                cost
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {/* Opens the golden-vs-model side-by-side comparison
                                  (public/benchmarks/compare/<model>.json). */}
                              <button
                                onClick={() => setCompareModel(entry.modelId)}
                                className="text-blue-600 hover:underline text-xs"
                              >
                                View
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                )}

                <div className="text-xs text-gray-500">
                  {leaderboard.entries.length} models | Prompt version: {leaderboard.promptVersion}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Run Inspector Tab */}
        {activeTab === 'inspector' && (
          <>
        {/* Filters */}
        {entries.length > 0 && (
          <div className="rounded border border-gray-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Filters
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600">Model:</label>
                <select
                  className="rounded border border-gray-300 bg-white px-2 py-1 text-sm"
                  value={filterModel}
                  onChange={(e) => setFilterModel(e.target.value)}
                >
                  <option value="all">All models</option>
                  {uniqueModels.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600">Status:</label>
                <select
                  className="rounded border border-gray-300 bg-white px-2 py-1 text-sm"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as RunStatus | 'all')}
                >
                  <option value="all">All statuses</option>
                  <option value="complete">Complete</option>
                  <option value="partial">Partial</option>
                  <option value="failed">Failed</option>
                  <option value="golden">Golden</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600">Date:</label>
                <select
                  className="rounded border border-gray-300 bg-white px-2 py-1 text-sm"
                  value={filterTimestamp}
                  onChange={(e) => setFilterTimestamp(e.target.value)}
                >
                  <option value="all">All dates</option>
                  {uniqueTimestamps.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600">Min phases:</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  className="w-16 rounded border border-gray-300 bg-white px-2 py-1 text-sm"
                  value={filterMinPhases}
                  onChange={(e) => setFilterMinPhases(Math.max(0, Number(e.target.value) || 0))}
                />
              </div>
              <div className="text-xs text-gray-500">
                {filteredEntries.length} of {entries.length} entries
              </div>
            </div>
          </div>
        )}

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
        ) : filteredEntries.length === 0 ? (
          <div className="rounded border border-gray-200 bg-white p-6 text-sm text-gray-600">
            No entries match the current filters. Try adjusting the filters above.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <BenchCard
              entry={leftEntry}
              indexEntry={leftIndexEntry}
              options={filteredEntries}
              value={leftId}
              onChange={setLeftId}
              pass={leftPass}
              onPassChange={setLeftPass}
            />
            <BenchCard
              entry={rightEntry}
              indexEntry={rightIndexEntry}
              options={filteredEntries}
              value={rightId}
              onChange={setRightId}
              pass={rightPass}
              onPassChange={setRightPass}
            />
          </div>
        )}
          </>
        )}
      </div>
    </div>
  );
};

/**
 * SuttaStudioCompareView — two compiled packets of the SAME sutta, side by side.
 *
 * Route: /sutta/compare?left=<packet-url>&right=<packet-url>
 * Defaults to the MN117 production-model bake-off (gemini-3-flash vs
 * deepseek-v4-flash). Unranked and qualitative by design: no golden exists
 * for MN117; this page exists so a human can read both renderings of the
 * same canonical input and judge which model earns production.
 *
 * Each pane hosts a full SuttaStudioView in its own scroll container, so the
 * reading experience being compared is the real one (tooltips, senses,
 * citations, alignment), not a stripped summary.
 */

import { useEffect, useState } from 'react';
import type { DeepLoomPacket } from '../../types/suttaStudio';
import { partitionSurfaceMismatches, splitPaliTokens } from '../../services/sutta-studio/utils';
import { SuttaStudioView } from './SuttaStudioView';

type Side = {
  url: string;
  label: string;
  packet: DeepLoomPacket | null;
  error: string | null;
  /** % of rendered Pāli words whose segment-concat appears verbatim in the
   * canonical text — the benchmark's textIntegrity idea, golden-free. */
  surfaceIntegrity: number | null;
  /** rendered Pāli words / canonical words — catches silent word-dropping
   * (a model can be locally faithful while omitting most of the text). */
  wordCoverage: number | null;
  /** share of phases that fell back to raw text because the model CALL failed
   * (truncated output, connection error) — an infrastructure interaction, not
   * model ability; without this the coverage chip blames the model for it. */
  degradedShare: number | null;
  degradedCount: number;
  phaseCount: number;
};

const stripToLetters = (s: string): string =>
  (s || '').normalize('NFC').toLowerCase().replace(/[^a-zāīūṁṃṅñṭḍṇḷ]/g, '');

const measurePacket = (
  packet: DeepLoomPacket
): { surfaceIntegrity: number | null; wordCoverage: number | null; degradedShare: number | null; degradedCount: number; phaseCount: number } => {
  const phaseCount = (packet.phases || []).length;
  const degradedCount = (packet.phases || []).filter((ph) => ph.degraded).length;
  const degradedShare = phaseCount > 0 ? degradedCount / phaseCount : null;
  const segments = packet.canonicalSegments || [];
  const canonWords = segments.flatMap((s) => splitPaliTokens(s.pali || ''));
  // Partition-aware matching (letters-only), mirroring the packet validator's
  // surface check: a word may legitimately be one piece of a sub-split
  // canonical token (quotative ti, sandhi compounds like etad+avoca), so
  // consecutive words that jointly spell a token all count as sound.
  const canonTokens = new Set(canonWords.map(stripToLetters).filter(Boolean));
  if (canonTokens.size === 0) return { surfaceIntegrity: null, wordCoverage: null, degradedShare, degradedCount, phaseCount };
  let total = 0;
  let mismatched = 0;
  for (const phase of packet.phases || []) {
    const letters = (phase.paliWords || [])
      .map((word) => stripToLetters((word.segments || []).map((seg) => seg.text).join('')))
      .filter(Boolean);
    const r = partitionSurfaceMismatches(letters, canonTokens);
    total += r.total;
    mismatched += r.mismatched;
  }
  return {
    surfaceIntegrity: total === 0 ? null : (total - mismatched) / total,
    wordCoverage: canonWords.length === 0 ? null : Math.min(1, total / canonWords.length),
    degradedShare,
    degradedCount,
    phaseCount,
  };
};

// Default pair = the currently-live production question. Other packets stay
// reachable via ?left=/?right= (deepseek-v4-flash remains published).
const DEFAULT_LEFT = '/benchmarks/mn117/gemini-3-flash.packet.json';
const DEFAULT_RIGHT = '/benchmarks/mn117/gemini-3.5-flash.packet.json';

const labelFromUrl = (url: string): string => {
  const file = url.split('/').pop() || url;
  return file.replace(/\.packet\.json$/, '').replace(/\.json$/, '');
};

const useSide = (url: string): Side => {
  const empty = { packet: null, error: null, surfaceIntegrity: null, wordCoverage: null, degradedShare: null, degradedCount: 0, phaseCount: 0 };
  const [side, setSide] = useState<Side>({ url, label: labelFromUrl(url), ...empty });

  useEffect(() => {
    let cancelled = false;
    setSide({ url, label: labelFromUrl(url), ...empty });
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        return r.json();
      })
      .then((packet: DeepLoomPacket) => {
        if (cancelled) return;
        // The packet self-reports which model compiled it — trust that over
        // whatever the URL happens to be named.
        const model = packet?.compiler?.model;
        setSide({ url, label: model || labelFromUrl(url), packet, error: null, ...measurePacket(packet) });
      })
      .catch((e) => {
        if (cancelled) return;
        setSide({ url, label: labelFromUrl(url), ...empty, error: e?.message || String(e) });
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return side;
};

const PaneState = ({ side }: { side: Side }) => (
  <div className="flex h-full items-center justify-center px-6 text-center">
    {side.error ? (
      <div>
        <p className="text-rose-300 text-sm font-medium mb-2">Could not load packet</p>
        <p className="text-slate-400 text-xs break-all">{side.url}</p>
        <p className="text-slate-500 text-xs mt-2">{side.error}</p>
      </div>
    ) : (
      <p className="text-slate-400 text-sm animate-pulse">Loading {side.label}…</p>
    )}
  </div>
);

export function SuttaStudioCompareView() {
  const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const leftUrl = params.get('left') || DEFAULT_LEFT;
  const rightUrl = params.get('right') || DEFAULT_RIGHT;

  const left = useSide(leftUrl);
  const right = useSide(rightUrl);

  const workId = left.packet?.source?.workId || right.packet?.source?.workId || '';

  const pane = (side: Side, edge: 'left' | 'right') => (
    <div
      className={`relative h-full min-h-0 overflow-y-auto overscroll-contain bg-slate-950 ${
        edge === 'left' ? 'lg:border-r lg:border-slate-800' : ''
      }`}
    >
      <div className="sticky top-0 z-40 flex justify-center gap-2 pointer-events-none">
        <span className="mt-2 rounded-full bg-slate-900/95 border border-slate-700 px-3 py-1 text-xs font-medium text-amber-200 shadow-lg">
          {side.label}
        </span>
        {side.wordCoverage != null && (
          <span
            className={`mt-2 rounded-full bg-slate-900/95 border px-3 py-1 text-xs shadow-lg ${
              side.wordCoverage >= 0.9 ? 'border-emerald-700 text-emerald-300' : 'border-rose-800 text-rose-300'
            }`}
            title="Rendered Pāli words as a share of the canonical text's words. Below 100% means the model silently dropped words from the interlinear rendering."
          >
            coverage {(side.wordCoverage * 100).toFixed(0)}%
          </span>
        )}
        {side.surfaceIntegrity != null && (
          <span
            className={`mt-2 rounded-full bg-slate-900/95 border px-3 py-1 text-xs shadow-lg ${
              side.surfaceIntegrity >= 0.97 ? 'border-emerald-700 text-emerald-300' : 'border-rose-800 text-rose-300'
            }`}
            title="Share of rendered Pāli words that spell out a canonical word — alone or together with neighbouring words (curators legitimately split one canonical word into several teaching words). Measured in your browser against the packet's own canonical segments — no reference answer involved."
          >
            surface integrity {(side.surfaceIntegrity * 100).toFixed(1)}%
          </span>
        )}
        {side.degradedShare != null && side.degradedCount > 0 && (
          <span
            className="mt-2 rounded-full bg-slate-900/95 border border-amber-700 px-3 py-1 text-xs text-amber-300 shadow-lg"
            title={`${side.degradedCount} of ${side.phaseCount} phases fell back to raw un-analyzed text because the model's call FAILED (truncated output, connection error) — an infrastructure interaction, not model ability alone. The coverage and integrity numbers include these phases; judge this side with that in mind.`}
          >
            ⚠ {side.degradedCount}/{side.phaseCount} phases degraded
          </span>
        )}
      </div>
      {side.packet ? <SuttaStudioView packet={side.packet} /> : <PaneState side={side} />}
    </div>
  );

  return (
    <div className="h-dvh flex flex-col bg-slate-950 text-slate-100">
      <header className="flex-none border-b border-slate-800 bg-slate-950/95 px-4 py-2">
        <div className="mx-auto flex max-w-6xl flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h1 className="text-sm font-semibold text-slate-100">
            {workId ? workId.toUpperCase() + ' — ' : ''}side-by-side compile
          </h1>
          <p className="text-xs text-slate-400">
            Same sutta, same production pipeline, two models. Unranked — no golden exists for this text; read and judge.
            <a href="/bench/sutta-studio" className="ml-2 text-sky-400 hover:text-sky-300 underline decoration-slate-600">
              MN10 leaderboard
            </a>
          </p>
        </div>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-2 lg:grid-cols-2 lg:grid-rows-1">
        {pane(left, 'left')}
        {pane(right, 'right')}
      </div>
    </div>
  );
}

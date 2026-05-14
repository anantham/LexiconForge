import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import type { PhaseView } from '../../types/suttaStudio';
import type { Focus } from './types';
import { RELATION_COLORS, RELATION_GLYPHS, RELATION_HOOK } from './palette';
import { buildPaliText, resolveSenseId, resolveSegmentTooltip } from './utils';

const CONFIDENCE_COLORS: Record<string, string> = {
  high: 'border-emerald-700 text-emerald-300 bg-emerald-950/40',
  medium: 'border-amber-700 text-amber-300 bg-amber-950/40',
  low: 'border-slate-700 text-slate-400 bg-slate-900/40',
};

const EPISTEMIC_BASIS_LABELS: Record<string, string> = {
  lexical: 'DPD-attested',
  grammatical: 'grammar-derived',
  curatorial: 'curator-chosen',
  etymological: 'compositional',
  commentarial: 'commentary-cited',
  contextual: 'context-disambiguated',
  comparative: 'parallel-supported',
};

// Audit-panel position persists across reloads so the curator can park the
// panel where they like and not have it reset every time they reopen the demo.
const POSITION_STORAGE_KEY = 'sutta-studio-lens-panel-pos';
function loadPanelPosition(): { x: number; y: number } | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(POSITION_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}
function savePanelPosition(pos: { x: number; y: number }): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(pos));
  } catch {
    // ignore
  }
}

export function LensPanel({
  phase,
  pinned,
  onClose,
  activeIndices,
  setActiveIndex,
  showNotes = true,
  showCitationChips = true,
  showConfidenceBadges = true,
}: {
  phase: PhaseView;
  pinned: Focus;
  onClose: () => void;
  activeIndices: Record<string, number>;
  setActiveIndex: (wordId: string, idx: number) => void;
  /** Settings toggles — when false, the corresponding V2 metadata is hidden in the panel. */
  showNotes?: boolean;
  showCitationChips?: boolean;
  showConfidenceBadges?: boolean;
}) {
  const word = phase.paliWords.find((w) => w.id === pinned.wordId);
  if (!word) return null;

  const activeIdx = activeIndices[word.id] ?? 0;
  const activeSense = word.senses[activeIdx];
  const paliText = buildPaliText(word);

  const [tab, setTab] = useState<'senses' | 'grammar' | 'relations'>('senses');
  const [position, setPosition] = useState<{ x: number; y: number }>(() => loadPanelPosition() ?? { x: 0, y: 0 });

  useEffect(() => {
    setTab('senses');
  }, [pinned.wordId, pinned.kind]);

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      console.log('Clipboard unavailable. Text:', text);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        data-interactive="true"
        className="fixed right-4 top-20 bottom-20 w-[440px] max-w-[92vw] z-[90] bg-slate-950 border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col"
        initial={{ opacity: 0, x: 16 + position.x, y: position.y }}
        animate={{ opacity: 1, x: position.x, y: position.y }}
        exit={{ opacity: 0, x: 16 + position.x, y: position.y }}
        drag
        dragMomentum={false}
        dragElastic={0}
        onDragEnd={(_, info) => {
          const newPos = { x: position.x + info.offset.x, y: position.y + info.offset.y };
          setPosition(newPos);
          savePanelPosition(newPos);
        }}
      >
        <div
          className="p-4 border-b border-slate-800 cursor-move select-none"
          title="Drag to reposition"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-slate-200 font-semibold flex items-center gap-2">
                <span className={`${word.color ?? 'text-slate-200'} font-serif text-lg`}>{paliText}</span>
                <span className="text-slate-600 text-xs">
                  {pinned.kind === 'segment' ? `segment ${pinned.segmentIndex + 1}` : 'word'}
                </span>
              </div>
              {word.pronunciation && (
                <div className="text-slate-400 text-sm mt-1 font-mono tracking-wide">
                  {word.pronunciation}
                </div>
              )}
              <div className="text-slate-500 text-xs mt-1">
                Current: <span className="text-slate-300">{activeSense?.english ?? '—'}</span>{' '}
                <span className="text-slate-600">({activeSense?.nuance ?? ''})</span>
              </div>
            </div>

            <button
              className="px-3 py-1 rounded bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 select-none shrink-0"
              onClick={onClose}
              title="Close (Esc)"
            >
              ✕
            </button>
          </div>

          <div className="flex items-center gap-2 mt-3">
            <button
              className={`px-2 py-1 rounded border text-xs ${
                tab === 'senses'
                  ? 'bg-slate-900 border-slate-700 text-slate-200'
                  : 'bg-transparent border-slate-800 text-slate-500 hover:text-slate-300'
              }`}
              onClick={() => setTab('senses')}
            >
              Senses
            </button>
            <button
              className={`px-2 py-1 rounded border text-xs ${
                tab === 'grammar'
                  ? 'bg-slate-900 border-slate-700 text-slate-200'
                  : 'bg-transparent border-slate-800 text-slate-500 hover:text-slate-300'
              }`}
              onClick={() => setTab('grammar')}
            >
              Grammar
            </button>
            <button
              className={`px-2 py-1 rounded border text-xs ${
                tab === 'relations'
                  ? 'bg-slate-900 border-slate-700 text-slate-200'
                  : 'bg-transparent border-slate-800 text-slate-500 hover:text-slate-300'
              }`}
              onClick={() => setTab('relations')}
            >
              Relations
            </button>
          </div>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          {tab === 'senses' && (
            <div className="space-y-3">
              <div className="text-slate-500 text-xs">Click a sense to set it.</div>
              {word.senses.map((t, idx) => {
                const active = idx === activeIdx;
                return (
                  <button
                    key={`${word.id}-sense-${idx}`}
                    className={`w-full text-left p-3 rounded-lg border transition ${
                      active
                        ? 'bg-slate-900 border-slate-700 text-slate-200'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                    }`}
                    onClick={() => setActiveIndex(word.id, idx)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold">{t.english}</div>
                      <div className="text-xs text-slate-500">{t.nuance}</div>
                    </div>
                    {showConfidenceBadges && (t.confidence || t.epistemicBasis) && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {t.confidence && (
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded border ${
                              CONFIDENCE_COLORS[t.confidence] || 'border-slate-700 text-slate-400'
                            }`}
                            title={`Confidence: ${t.confidence}`}
                          >
                            {t.confidence}
                          </span>
                        )}
                        {t.epistemicBasis && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded border border-slate-700 text-slate-400 bg-slate-900/40"
                            title={`Epistemic basis: ${t.epistemicBasis}`}
                          >
                            {EPISTEMIC_BASIS_LABELS[t.epistemicBasis] || t.epistemicBasis}
                          </span>
                        )}
                      </div>
                    )}
                    {showNotes && t.notes && (
                      <div className="text-slate-500 text-sm mt-2">{t.notes}</div>
                    )}
                    {showCitationChips && t.citationIds && t.citationIds.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {t.citationIds.map((c) => (
                          <span
                            key={c}
                            className="text-[11px] px-2 py-1 rounded border border-slate-800 text-slate-500"
                            title={c}
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {tab === 'grammar' && (
            <div className="space-y-3">
              <div className="text-slate-500 text-xs">
                Segment tooltips are shown here for sustained study.
              </div>
              {word.segments.map((seg, i) => {
                const isFocused = pinned.kind === 'segment' && pinned.segmentIndex === i;
                const senseId = resolveSenseId(word, activeIdx);
                const tip = resolveSegmentTooltip(seg, senseId, activeIdx);

                return (
                  <div
                    key={`${word.id}-segpanel-${i}`}
                    className={`p-3 rounded-lg border ${
                      isFocused ? 'bg-slate-900 border-slate-700' : 'bg-slate-950 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className={`${word.color ?? 'text-slate-200'} font-serif text-lg`}>
                        {seg.text}
                        <span className="ml-2 text-xs text-slate-600 font-sans">{seg.type}</span>
                      </div>

                      {seg.relation && (
                        <span
                          className={`text-xs px-2 py-1 rounded border ${RELATION_COLORS[seg.relation.type].border} ${RELATION_COLORS[seg.relation.type].bg} ${RELATION_COLORS[seg.relation.type].tailwind}`}
                        >
                          {RELATION_GLYPHS[seg.relation.type]} {RELATION_HOOK[seg.relation.type]}
                        </span>
                      )}
                    </div>

                    {tip && <div className="text-slate-400 text-sm mt-2">{tip}</div>}
                    {!tip && (
                      <div className="text-slate-600 text-sm mt-2">No tooltip for this segment.</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'relations' && (
            <div className="space-y-3">
              <div className="text-slate-500 text-xs">
                Relations are drawn as tethers when you focus a segment.
              </div>

              {word.segments.filter((s) => !!s.relation).length === 0 && (
                <div className="text-slate-600 text-sm">No relations declared on this word.</div>
              )}

              {word.segments.map((seg, i) => {
                if (!seg.relation) return null;
                const style = RELATION_COLORS[seg.relation.type];
                const targetWordId = seg.relation!.targetWordId ?? seg.relation!.targetSegmentId;
                const target = targetWordId
                  ? phase.paliWords.find((w) => w.id === targetWordId || w.segments.some((s) => s.id === targetWordId))
                  : undefined;
                return (
                  <div
                    key={`${word.id}-rel-${i}`}
                    className={`p-3 rounded-lg border ${style.border} ${style.bg}`}
                  >
                    <div className="text-slate-200 font-semibold flex items-center gap-2">
                      <span className={style.tailwind}>{RELATION_GLYPHS[seg.relation.type]}</span>
                      <span>{seg.relation.label}</span>
                    </div>
                    <div className="text-slate-500 text-sm mt-1">
                      <span className="text-slate-300 font-serif">{seg.text}</span> →
                      <span className="ml-2 text-slate-300 font-serif">
                        {target ? buildPaliText(target) : targetWordId ?? '?'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-slate-800 px-4 py-2 flex items-center gap-2 shrink-0 bg-slate-950">
          <button
            className="px-2 py-1 rounded border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 text-xs"
            onClick={() => copyText(paliText)}
            title="Copy the Pāli word"
          >
            Copy Pāli
          </button>
          <button
            className="px-2 py-1 rounded border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 text-xs"
            onClick={() => copyText(activeSense?.english ?? '')}
            title="Copy the current English rendering"
          >
            Copy English
          </button>
          <div className="flex-1" />
          {word.pronunciation && (
            <button
              className="px-2 py-1 rounded border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 text-xs"
              onClick={() => copyText(word.pronunciation!)}
              title="Copy the pronunciation hint"
            >
              Copy Pron.
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

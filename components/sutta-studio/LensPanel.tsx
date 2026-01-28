import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import type { PhaseView } from '../../types/suttaStudio';
import type { Focus } from './types';
import { RELATION_COLORS, RELATION_GLYPHS, RELATION_HOOK } from './palette';
import { buildPaliText, resolveSenseId, resolveSegmentTooltip } from './utils';

export function LensPanel({
  phase,
  pinned,
  onClose,
  activeIndices,
  setActiveIndex,
}: {
  phase: PhaseView;
  pinned: Focus;
  onClose: () => void;
  activeIndices: Record<string, number>;
  setActiveIndex: (wordId: string, idx: number) => void;
}) {
  const word = phase.paliWords.find((w) => w.id === pinned.wordId);
  if (!word) return null;

  const activeIdx = activeIndices[word.id] ?? 0;
  const activeSense = word.senses[activeIdx];
  const paliText = buildPaliText(word);

  const [tab, setTab] = useState<'senses' | 'grammar' | 'relations'>('senses');

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
        className="fixed right-4 top-20 bottom-20 w-[360px] max-w-[92vw] z-[90] bg-slate-950 border border-slate-800 rounded-xl shadow-2xl overflow-hidden"
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 16 }}
      >
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-slate-200 font-semibold flex items-center gap-2">
                <span className={`${word.color ?? 'text-slate-200'} font-serif`}>{paliText}</span>
                <span className="text-slate-600 text-xs">
                  {pinned.kind === 'segment' ? `segment ${pinned.segmentIndex + 1}` : 'word'}
                </span>
              </div>
              <div className="text-slate-500 text-xs mt-1">
                Current: <span className="text-slate-300">{activeSense?.english ?? '—'}</span>{' '}
                <span className="text-slate-600">({activeSense?.nuance ?? ''})</span>
              </div>
            </div>

            <button
              className="px-3 py-1 rounded bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 select-none"
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

            <div className="flex-1" />

            <button
              className="px-2 py-1 rounded border border-slate-800 text-slate-500 hover:text-slate-300 text-xs"
              onClick={() => copyText(paliText)}
            >
              Copy Pāli
            </button>
            <button
              className="px-2 py-1 rounded border border-slate-800 text-slate-500 hover:text-slate-300 text-xs"
              onClick={() => copyText(activeSense?.english ?? '')}
            >
              Copy English
            </button>
          </div>
        </div>

        <div className="p-4 overflow-y-auto h-full">
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
                    {t.notes && <div className="text-slate-500 text-sm mt-1">{t.notes}</div>}
                    {t.citationIds && t.citationIds.length > 0 && (
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
                const target = phase.paliWords.find((w) => w.id === seg.relation!.targetId);
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
                        {target ? buildPaliText(target) : seg.relation.targetId}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

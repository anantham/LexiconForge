import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import type { Citation, PhaseView } from '../../types/suttaStudio';
import type { Focus } from './types';
import { RELATION_COLORS, RELATION_GLYPHS, RELATION_HOOK } from './palette';
import { buildPaliText, resolveSenseId, resolveSegmentTooltip } from './utils';

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

// Tiny clipboard icon used as the inline copy affordance next to copyable items.
function CopyIcon({ size = 12 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

// Inline copy button: small clipboard icon next to a copyable text item.
function CopyButton({ onCopy, title }: { onCopy: () => void; title: string }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onCopy();
      }}
      title={title}
      aria-label={title}
      className="text-slate-600 hover:text-slate-300 transition-colors p-1 -m-1 shrink-0 align-middle"
    >
      <CopyIcon />
    </button>
  );
}

// Detect coarse-grained viewport width. Used to switch between side panel and
// bottom-sheet layouts.
function useIsMobile(breakpointPx = 640): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < breakpointPx;
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => setIsMobile(window.innerWidth < breakpointPx);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [breakpointPx]);
  return isMobile;
}

export function LensPanel({
  phase,
  pinned,
  onClose,
  activeIndices,
  setActiveIndex,
  citations,
  showNotes = true,
  showCitationChips = true,
}: {
  phase: PhaseView;
  pinned: Focus;
  onClose: () => void;
  activeIndices: Record<string, number>;
  setActiveIndex: (wordId: string, idx: number) => void;
  /** Packet-level citations list. When provided, citationIds chips become
   *  clickable links to the cited source URL (if the citation has one). */
  citations?: Citation[];
  /** Settings toggles — when false, the corresponding metadata is hidden in the panel. */
  showNotes?: boolean;
  showCitationChips?: boolean;
}) {
  // Index citations by id for O(1) lookup when rendering chips.
  const citationsById = new Map<string, Citation>(
    (citations ?? []).map((c) => [c.id, c])
  );
  const word = phase.paliWords.find((w) => w.id === pinned.wordId);
  if (!word) return null;

  const activeIdx = activeIndices[word.id] ?? 0;
  const activeSense = word.senses[activeIdx];
  const paliText = buildPaliText(word);

  const [tab, setTab] = useState<'senses' | 'grammar' | 'relations'>('senses');
  const [position, setPosition] = useState<{ x: number; y: number }>(() => loadPanelPosition() ?? { x: 0, y: 0 });
  const [toast, setToast] = useState<string | null>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    setTab('senses');
  }, [pinned.wordId, pinned.kind]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1600);
    return () => clearTimeout(t);
  }, [toast]);

  const copyText = async (text: string, label?: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      const preview = text.length > 32 ? text.slice(0, 32) + '…' : text;
      setToast(label ? `Copied ${label}: ${preview}` : `Copied: ${preview}`);
    } catch {
      setToast('Copy failed');
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        data-interactive="true"
        // Mobile (< 640px): bottom sheet that takes the lower ~60vh; rounded
        // only on top corners; spans full width; not draggable (drag={false}).
        // Desktop (md+): side panel that floats top-right, full-height with
        // padding; draggable to reposition.
        className={
          isMobile
            ? 'fixed inset-x-0 bottom-0 max-h-[65vh] z-[90] bg-slate-950 border-t border-x border-slate-800 rounded-t-xl shadow-2xl overflow-hidden flex flex-col'
            : 'fixed right-4 top-20 bottom-20 w-[440px] max-w-[92vw] z-[90] bg-slate-950 border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col'
        }
        initial={isMobile ? { opacity: 0, y: 30 } : { opacity: 0, x: 16 + position.x, y: position.y }}
        animate={isMobile ? { opacity: 1, y: 0 } : { opacity: 1, x: position.x, y: position.y }}
        exit={isMobile ? { opacity: 0, y: 30 } : { opacity: 0, x: 16 + position.x, y: position.y }}
        drag={!isMobile}
        dragMomentum={false}
        dragElastic={0}
        onDragEnd={(_, info) => {
          const newPos = { x: position.x + info.offset.x, y: position.y + info.offset.y };
          setPosition(newPos);
          savePanelPosition(newPos);
        }}
      >
        <div
          className={
            isMobile
              ? 'p-4 border-b border-slate-800 select-none'
              : 'p-4 border-b border-slate-800 cursor-move select-none'
          }
          title={isMobile ? '' : 'Drag to reposition'}
        >
          {isMobile && (
            // Drag-handle bar at the top of the bottom-sheet — visual cue that
            // this panel can be dismissed by swiping (future) and is distinct
            // from page content.
            <div className="flex justify-center mb-3 -mt-1">
              <div className="w-10 h-1 rounded-full bg-slate-700" />
            </div>
          )}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-slate-200 font-semibold flex items-center gap-2 flex-wrap">
                <span className={`${word.color ?? 'text-slate-200'} font-serif text-lg`}>{paliText}</span>
                <CopyButton
                  onCopy={() => copyText(paliText, 'Pāli')}
                  title="Copy Pāli word"
                />
                <span className="text-slate-600 text-xs">
                  {pinned.kind === 'segment' ? `segment ${pinned.segmentIndex + 1}` : 'word'}
                </span>
              </div>
              {word.pronunciation && (
                <div className="text-slate-400 text-sm mt-1 font-mono tracking-wide flex items-center gap-2">
                  <span>{word.pronunciation}</span>
                  <CopyButton
                    onCopy={() => copyText(word.pronunciation!, 'pronunciation')}
                    title="Copy pronunciation"
                  />
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
                      <div className="font-semibold flex items-center gap-2">
                        <span>{t.english}</span>
                        <CopyButton
                          onCopy={() => copyText(t.english, 'English')}
                          title="Copy English"
                        />
                      </div>
                      <div className="text-xs text-slate-500">{t.nuance}</div>
                    </div>
                    {showNotes && t.notes && (
                      <div className="text-slate-500 text-sm mt-2">{t.notes}</div>
                    )}
                    {showCitationChips && t.citationIds && t.citationIds.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {t.citationIds.map((id) => {
                          const cite = citationsById.get(id);
                          const label = cite?.short ?? id;
                          const tooltip = cite?.excerpt ?? id;
                          // Clickable when a URL is available (e.g., a real DPD
                          // entry link). Falls back to non-clickable span — the
                          // chip shows what the source CLAIMS to be, even if
                          // not yet navigable.
                          if (cite?.url) {
                            return (
                              <a
                                key={id}
                                href={cite.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] px-2 py-1 rounded border border-slate-700 text-slate-300 hover:text-slate-100 hover:border-slate-500 transition-colors"
                                title={tooltip}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {label} ↗
                              </a>
                            );
                          }
                          return (
                            <span
                              key={id}
                              className="text-[11px] px-2 py-1 rounded border border-slate-800 text-slate-500"
                              title={tooltip}
                            >
                              {label}
                            </span>
                          );
                        })}
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

      </motion.div>

      {toast && (
        <motion.div
          key="lens-toast"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="fixed left-1/2 -translate-x-1/2 bottom-8 z-[110] px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-sm shadow-2xl pointer-events-none"
        >
          {toast}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

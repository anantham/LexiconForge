import React, { useEffect, useRef, useState } from 'react';
import { ConceptInterlinear } from '../liturgy/concept/ConceptInterlinear';
import type { AlignSegment } from '../../types/liturgyAlign';

const SERIF = "'Cardo', 'Gentium Plus', 'Noto Serif', serif";
const DEVA = "'Noto Serif Devanagari', 'Devanagari MT', 'Kohinoor Devanagari', serif";

/** Reader preferences — persisted so the choice survives visits. */
type ReaderPrefs = { tooltips: boolean; scale: number };
const PREFS_KEY = 'gita-reader-prefs';
const loadPrefs = (): ReaderPrefs => {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return { tooltips: p.tooltips !== false, scale: typeof p.scale === 'number' ? p.scale : 1 };
    }
  } catch {
    /* private mode / parse error → defaults */
  }
  return { tooltips: true, scale: 1 };
};

/**
 * Gītā chapter 2 — the FREE TIER-1 reader (`/gita/chapter/2`). All 72 verses of
 * Sāṅkhya-yoga rendered from mechanical sources only: written Devanāgarī with
 * the sound of every akshara beneath it (deterministic romanizer), and a
 * Monier-Williams dictionary gloss on hover. NO alignment threads and no
 * authored translation — those are the curated Tier-2 upgrade (see 2.50–2.72,
 * the sthitaprajña passage, for how a fully-curated passage reads).
 *
 * Etymology mode (sound ↔ script, syllable by syllable) works in full from the
 * deterministic layer alone. The page shell is the studio's (settings gear:
 * tooltips on/off + text size; honest provenance footer).
 */
export const GitaChapter2Page: React.FC = () => {
  const [prefs, setPrefs] = useState<ReaderPrefs>(loadPrefs);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // The generated chapter data is ~468 KB — code-split it out of the initial
  // bundle (the LazyLocalSutta pattern) so it loads only when this page opens.
  const [segments, setSegments] = useState<AlignSegment[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    import('../../data/gita/chapter2-tier1').then((m) => {
      if (!cancelled) setSegments(m.GITA_CHAPTER2_TIER1);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const update = (patch: Partial<ReaderPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      } catch {
        /* best-effort persistence */
      }
      return next;
    });
  };

  // Root font-size drives every rem unit in the interlinear. Reset on leave.
  useEffect(() => {
    document.documentElement.style.fontSize = `${Math.round(prefs.scale * 100)}%`;
    return () => {
      document.documentElement.style.fontSize = '';
    };
  }, [prefs.scale]);

  // Close the panel on outside click or Escape.
  useEffect(() => {
    if (!settingsOpen) return;
    const onDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setSettingsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSettingsOpen(false);
    };
    const t = setTimeout(() => document.addEventListener('mousedown', onDown), 0);
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [settingsOpen]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-3xl mx-auto px-8 py-10">
        <div className="flex items-center justify-between">
          <a href="/gita" className="text-emerald-400/70 hover:text-emerald-300 text-sm">
            ← Bhagavad Gītā
          </a>

          {/* Settings gear — the studio pattern */}
          <div className="relative" ref={panelRef}>
            <button
              onClick={() => setSettingsOpen((v) => !v)}
              className={`w-9 h-9 rounded-full flex items-center justify-center border transition ${
                settingsOpen
                  ? 'border-emerald-500 text-emerald-400 bg-slate-900'
                  : 'border-slate-800 text-slate-500 hover:text-slate-300 hover:border-slate-600 hover:bg-slate-900/60'
              }`}
              title="Reader settings"
              aria-label="Reader settings"
              aria-expanded={settingsOpen}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
              </svg>
            </button>

            {settingsOpen && (
              <div className="absolute top-11 right-0 w-60 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-[100] p-4 text-left">
                <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-3" style={{ fontFamily: SERIF }}>
                  Reader
                </div>

                <label className="flex items-center justify-between gap-3 cursor-pointer select-none">
                  <span className="text-sm text-slate-300">Tooltips</span>
                  <input
                    type="checkbox"
                    checked={prefs.tooltips}
                    onChange={(e) => update({ tooltips: e.target.checked })}
                    className="accent-emerald-500 w-4 h-4"
                  />
                </label>
                <p className="mt-1 text-[11px] leading-snug text-slate-600">
                  Off = quiet reading: the sounds stay, the meaning popups don't.
                </p>

                <div className="mt-4">
                  <div className="flex items-center justify-between text-sm text-slate-300">
                    <span>Text size</span>
                    <span className="text-slate-500 text-xs">{Math.round(prefs.scale * 100)}%</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-slate-500">
                    <span style={{ fontSize: '0.7rem', fontFamily: SERIF }}>Aa</span>
                    <input
                      type="range"
                      min={0.85}
                      max={1.7}
                      step={0.05}
                      value={prefs.scale}
                      onChange={(e) => update({ scale: Number(e.target.value) })}
                      className="w-full accent-emerald-500"
                      aria-label="Text size"
                    />
                    <span style={{ fontSize: '1.05rem', fontFamily: SERIF }}>Aa</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <h1 className="mt-12 text-center text-3xl text-slate-200" style={{ fontFamily: DEVA }}>
          साङ्ख्ययोगः
        </h1>
        <p className="mt-2 text-center text-sm text-slate-500 italic" style={{ fontFamily: SERIF }}>
          Bhagavad Gītā · chapter 2 · all 72 verses · the whole of Sāṅkhya-yoga
        </p>

        {/* Honest labeling: what is mechanical here, and what the curated upgrade adds. */}
        <div className="mx-auto mt-6 mb-14 max-w-xl rounded-lg border border-slate-800 bg-slate-900/40 px-5 py-4 text-[12.5px] leading-relaxed text-slate-400" style={{ fontFamily: SERIF }}>
          <p>
            A <span className="text-slate-300">free, mechanical</span> reading. Every layer here is
            drawn from public sources with no translation written by anyone:
          </p>
          <ul className="mt-2 space-y-1">
            <li>· <span className="text-slate-300">Sanskrit</span> — the mūla from sa.wikisource (public domain), word-for-word as printed.</li>
            <li>· <span className="text-slate-300">Sound</span> — every akshara romanized by a deterministic transliterator; nothing guessed.</li>
            <li>· <span className="text-slate-300">Meaning</span> — a Monier-Williams dictionary gloss per word (public domain), found by mechanical sandhi-splitting. Some words show no gloss rather than a guess.</li>
          </ul>
          <p className="mt-2 text-slate-500">
            What's <span className="text-emerald-400/80">not</span> here yet: alignment threads and a
            reviewed English witness — the curated <span className="text-slate-300">Tier-2</span> upgrade.
            See <a className="underline decoration-slate-700 hover:text-emerald-300" href="/gita/sthitaprajna">2.50–2.72, the sthitaprajña passage</a>, for how a fully-curated passage reads.
          </p>
        </div>

        {segments ? (
          <ConceptInterlinear segments={segments} tooltips={prefs.tooltips} />
        ) : (
          <p className="py-24 text-center text-sm text-slate-600" style={{ fontFamily: SERIF }}>
            loading the chapter…
          </p>
        )}

        <p className="mt-20 text-center text-xs text-slate-600" style={{ fontFamily: SERIF }}>
          Sanskrit text:{' '}
          <a
            className="underline decoration-slate-700 hover:text-slate-400"
            href="https://sa.wikisource.org/wiki/%E0%A4%AD%E0%A4%97%E0%A4%B5%E0%A4%A6%E0%A5%8D%E0%A4%97%E0%A5%80%E0%A4%A4%E0%A4%BE/%E0%A4%B8%E0%A4%BE%E0%A4%99%E0%A5%8D%E0%A4%96%E0%A5%8D%E0%A4%AF%E0%A4%AF%E0%A5%8B%E0%A4%97%E0%A4%83"
            target="_blank"
            rel="noreferrer"
          >
            sa.wikisource
          </a>{' '}
          (public domain) · glosses:{' '}
          <a
            className="underline decoration-slate-700 hover:text-slate-400"
            href="https://www.sanskrit-lexicon.uni-koeln.de/scans/MWScan/2020/web/webtc/indexcaller.php"
            target="_blank"
            rel="noreferrer"
          >
            Monier-Williams
          </a>{' '}
          dictionary (public domain) · padaccheda by rule-based sandhi analysis — mechanical, unreviewed
        </p>
      </div>
    </div>
  );
};

export default GitaChapter2Page;

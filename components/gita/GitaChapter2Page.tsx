import React, { useEffect, useState } from 'react';
import { ConceptInterlinear } from '../liturgy/concept/ConceptInterlinear';
import { ReaderSettings } from '../liturgy/concept/ReaderSettings';
import { useReaderPreferences } from '../../hooks/useReaderPreferences';
import type { AlignSegment } from '../../types/liturgyAlign';

const SERIF = "'Cardo', 'Gentium Plus', 'Noto Serif', serif";
const DEVA = "'Noto Serif Devanagari', 'Devanagari MT', 'Kohinoor Devanagari', serif";

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
  const { preferences, updatePreferences } = useReaderPreferences('gita-reader-prefs');

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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-3xl mx-auto px-8 py-10">
        <div className="flex items-center justify-between">
          <a href="/gita" className="text-emerald-400/70 hover:text-emerald-300 text-sm">
            ← Bhagavad Gītā
          </a>

          <ReaderSettings
            preferences={preferences}
            onChange={updatePreferences}
            tooltipDescription="Off = quiet reading: the sounds stay, the meaning popups don't."
          />
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
          <ConceptInterlinear segments={segments} tooltips={preferences.tooltips} />
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

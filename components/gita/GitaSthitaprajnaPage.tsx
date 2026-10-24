import React from 'react';
import { ConceptInterlinear } from '../liturgy/concept/ConceptInterlinear';
import { ReaderSettings } from '../liturgy/concept/ReaderSettings';
import { useReaderPreferences } from '../../hooks/useReaderPreferences';
import { GITA_STHITAPRAJNA } from '../../data/gita/sthitaprajna';

const SERIF = "'Cardo', 'Gentium Plus', 'Noto Serif', serif";

/**
 * Gītā deep reader (`/gita/sthitaprajna`) — Bhagavad Gītā 2.50–2.72, the
 * sthitaprajña passage, as concept-aligned interlinear segments: Devanāgarī
 * with per-akshara sounds (self-validated against the curated IAST), hover
 * meanings, sandhi taught in the sound layer, and an English draft witness
 * riding alongside. The page shell is the Malayalam studio's (UrakamProtoPage):
 * settings gear with tooltips on/off + text-size, honest provenance footer.
 */
export const GitaSthitaprajnaPage: React.FC = () => {
  const { preferences, updatePreferences } = useReaderPreferences('gita-reader-prefs');

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
            tooltipDescription="Off = quiet reading: highlights and alignment threads stay, popups don't."
          />
        </div>

        <p className="mt-14 text-center text-sm text-slate-500 italic" style={{ fontFamily: SERIF }}>
          Bhagavad Gītā · chapter 2, verses 50–72 · the sthitaprajña passage · mūla: sa.wikisource (public domain)
        </p>
        <p className="mt-1 mb-16 text-center text-xs text-slate-600" style={{ fontFamily: SERIF }}>
          English witness: Fable draft (2026) — unreviewed machine translation, shown for parallel reading, not authority
        </p>

        <ConceptInterlinear segments={GITA_STHITAPRAJNA} tooltips={preferences.tooltips} />

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
          · padaccheda, glosses &amp; English drafted by Fable, Sanskrit review pending
        </p>
      </div>
    </div>
  );
};

export default GitaSthitaprajnaPage;

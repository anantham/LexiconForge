import React, { useMemo, useState } from 'react';
import { ConceptInterlinear } from '../liturgy/concept/ConceptInterlinear';
import { URAKAM_SENTENCE_1 } from '../../data/malayalam/urakam-ammathiruvadi';

const SERIF = "'Cardo', 'Gentium Plus', 'Noto Serif', serif";
const MLYM = "'Noto Serif Malayalam', 'Manjari', serif";

/**
 * PILOT — Malayalam studio reader, first slice (`/malayalam`).
 *
 * One sentence of Aithihyamala ch. 64 (ഊരകത്ത് അമ്മതിരുവടി — public domain,
 * 1909) rendered clause-per-line through the shipped ConceptInterlinear:
 * big Malayalam glyphs, practical romanization directly beneath each piece,
 * hover for one meaning, click to cycle nuances/geography, English witness
 * toggled — off by default so the Malayalam stays foregrounded.
 */
export const UrakamProtoPage: React.FC = () => {
  const [showEnglish, setShowEnglish] = useState(false);

  // English lives in the data as a witness rendering; the toggle simply
  // filters it out of each segment before the interlinear sees it.
  const segments = useMemo(
    () =>
      showEnglish
        ? URAKAM_SENTENCE_1
        : URAKAM_SENTENCE_1.map((s) => ({
            ...s,
            renderings: s.renderings.filter((r) => r.lang.split('-')[0] !== 'en'),
          })),
    [showEnglish],
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-3xl mx-auto px-8 py-10">
        <div className="flex items-center justify-between">
          <a href="/" className="text-emerald-400/70 hover:text-emerald-300 text-sm">
            ← LexiconForge
          </a>
          <button
            onClick={() => setShowEnglish((v) => !v)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              showEnglish
                ? 'border-emerald-500/60 text-emerald-300'
                : 'border-slate-700 text-slate-500 hover:text-slate-300'
            }`}
          >
            English {showEnglish ? 'on' : 'off'}
          </button>
        </div>

        <h1
          className="mt-14 text-center text-3xl text-slate-100"
          style={{ fontFamily: MLYM }}
        >
          ഊരകത്ത് അമ്മതിരുവടി
        </h1>
        <p className="mt-3 mb-16 text-center text-sm text-slate-500 italic" style={{ fontFamily: SERIF }}>
          Aithihyamala · Kottarathil Sankunni, 1909 · sentence one of a pilot
        </p>

        <ConceptInterlinear segments={segments} />

        <p className="mt-20 text-center text-xs text-slate-600" style={{ fontFamily: SERIF }}>
          Source:{' '}
          <a
            className="underline decoration-slate-700 hover:text-slate-400"
            href="https://ml.wikisource.org/wiki/%E0%B4%90%E0%B4%A4%E0%B4%BF%E0%B4%B9%E0%B5%8D%E0%B4%AF%E0%B4%AE%E0%B4%BE%E0%B4%B2/%E0%B4%8A%E0%B4%B0%E0%B4%95%E0%B4%A4%E0%B5%8D%E0%B4%A4%E0%B5%8D%20%E0%B4%85%E0%B4%AE%E0%B5%8D%E0%B4%AE%E0%B4%A4%E0%B4%BF%E0%B4%B0%E0%B5%81%E0%B4%B5%E0%B4%9F%E0%B4%BF"
            target="_blank"
            rel="noreferrer"
          >
            ml.wikisource
          </a>{' '}
          (public domain) · glosses drafted by Opus, native review pending
        </p>
      </div>
    </div>
  );
};

export default UrakamProtoPage;

import React, { useEffect, useState } from 'react';
import { ConceptInterlinear } from '../liturgy/concept/ConceptInterlinear';
import { URAKAM_SENTENCE_1 } from '../../data/malayalam/urakam-ammathiruvadi';

const SERIF = "'Cardo', 'Gentium Plus', 'Noto Serif', serif";
const MLYM = "'Noto Serif Malayalam', 'Manjari', serif";

/**
 * PILOT — Malayalam studio reader, first slice (`/malayalam`).
 *
 * One sentence of Aithihyamala ch. 64 (ഊരകത്ത് അമ്മതിരുവടി — public domain,
 * 1909) rendered clause-per-line through the shipped ConceptInterlinear:
 * big Malayalam glyphs, practical romanization beneath each piece, hover for
 * one meaning, click to cycle nuances/geography. Language visibility is the
 * interlinear's own per-language eye-toggles (no duplicate page control);
 * the page adds a font-size slider — it scales the ROOT font-size, so every
 * rem-based size (glyphs, sounds, tooltips) reflows together, and the
 * thread-overlay geometry stays consistent (no CSS zoom coordinate games).
 *
 * Provenance: Malayalam text is Sankunni 1909 (PD, ml.wikisource); the
 * English rendering is an unreviewed Opus draft witness — named as such in
 * the data (`by: 'opus-draft'`) and on the page. English is a witness, not
 * "the meaning" (POLYGLOT.md).
 */
export const UrakamProtoPage: React.FC = () => {
  const [scale, setScale] = useState(1);

  // Root font-size drives every rem unit in the interlinear. Reset on leave.
  useEffect(() => {
    document.documentElement.style.fontSize = `${Math.round(scale * 100)}%`;
    return () => {
      document.documentElement.style.fontSize = '';
    };
  }, [scale]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-3xl mx-auto px-8 py-10">
        <div className="flex items-center justify-between">
          <a href="/" className="text-emerald-400/70 hover:text-emerald-300 text-sm">
            ← LexiconForge
          </a>
          <label className="flex items-center gap-2 text-slate-500" title="Text size">
            <span style={{ fontSize: '0.7rem', fontFamily: SERIF }}>Aa</span>
            <input
              type="range"
              min={0.85}
              max={1.7}
              step={0.05}
              value={scale}
              onChange={(e) => setScale(Number(e.target.value))}
              className="w-28 accent-emerald-500"
              aria-label="Text size"
            />
            <span style={{ fontSize: '1.05rem', fontFamily: SERIF }}>Aa</span>
          </label>
        </div>

        <h1 className="mt-14 text-center text-3xl text-slate-100" style={{ fontFamily: MLYM }}>
          ഊരകത്ത് അമ്മതിരുവടി
        </h1>
        <p className="mt-3 text-center text-sm text-slate-500 italic" style={{ fontFamily: SERIF }}>
          Aithihyamala · Kottarathil Sankunni, 1909 · public domain
        </p>
        <p className="mt-1 mb-16 text-center text-xs text-slate-600" style={{ fontFamily: SERIF }}>
          English witness: Opus draft (2026) — unreviewed machine translation, shown for alignment, not authority
        </p>

        <ConceptInterlinear segments={URAKAM_SENTENCE_1} />

        <p className="mt-20 text-center text-xs text-slate-600" style={{ fontFamily: SERIF }}>
          Malayalam source:{' '}
          <a
            className="underline decoration-slate-700 hover:text-slate-400"
            href="https://ml.wikisource.org/wiki/%E0%B4%90%E0%B4%A4%E0%B4%BF%E0%B4%B9%E0%B5%8D%E0%B4%AF%E0%B4%AE%E0%B4%BE%E0%B4%B2/%E0%B4%8A%E0%B4%B0%E0%B4%95%E0%B4%A4%E0%B5%8D%E0%B4%A4%E0%B5%8D%20%E0%B4%85%E0%B4%AE%E0%B5%8D%E0%B4%AE%E0%B4%A4%E0%B4%BF%E0%B4%B0%E0%B5%81%E0%B4%B5%E0%B4%9F%E0%B4%BF"
            target="_blank"
            rel="noreferrer"
          >
            ml.wikisource
          </a>{' '}
          · glosses &amp; concept cards drafted by Opus, native review pending
        </p>
      </div>
    </div>
  );
};

export default UrakamProtoPage;

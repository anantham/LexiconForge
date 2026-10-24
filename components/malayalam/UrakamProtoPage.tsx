import React from 'react';
import { ConceptInterlinear } from '../liturgy/concept/ConceptInterlinear';
import { ReaderSettings } from '../liturgy/concept/ReaderSettings';
import { useReaderPreferences } from '../../hooks/useReaderPreferences';
import { URAKAM_SENTENCE_1 } from '../../data/malayalam/urakam-ammathiruvadi';
import { URAKAM_TIER1 } from '../../data/malayalam/urakam-tier1';

// Curated sentence 1 (full unit spine + concepts) followed by the whole
// legend at Tier 1 (deterministic sounds + Opus-draft English witness).
const ALL_SEGMENTS = [...URAKAM_SENTENCE_1, ...URAKAM_TIER1];

const SERIF = "'Cardo', 'Gentium Plus', 'Noto Serif', serif";

/**
 * Malayalam studio reader (`/malayalam/urakam-ammathiruvadi`).
 *
 * Aithihyamala ch. 64 (public domain, 1909): curated opening + Tier-1 rest.
 * Reader controls live behind a subtle gear (the Sutta Studio settings
 * pattern): tooltips on/off (highlights and threads stay either way) and the
 * text-size slider. Scale drives ROOT font-size so every rem-based measure
 * (glyphs, sounds, tooltips, thread geometry) reflows together.
 */
export const UrakamProtoPage: React.FC = () => {
  const { preferences, updatePreferences } = useReaderPreferences('ml-reader-prefs');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-3xl mx-auto px-8 py-10">
        <div className="flex items-center justify-between">
          <a href="/malayalam" className="text-emerald-400/70 hover:text-emerald-300 text-sm">
            ← Malayalam Studio
          </a>

          <ReaderSettings
            preferences={preferences}
            onChange={updatePreferences}
            tooltipDescription="Off = quiet reading: highlights and alignment threads stay, popups don't."
          />
        </div>

        <p className="mt-14 text-center text-sm text-slate-500 italic" style={{ fontFamily: SERIF }}>
          Aithihyamala · Kottarathil Sankunni, 1909 · public domain · the full legend — opening deep-curated, the rest Tier-1
        </p>
        <p className="mt-1 mb-16 text-center text-xs text-slate-600" style={{ fontFamily: SERIF }}>
          English witness: Opus draft (2026) — unreviewed machine translation, shown for alignment, not authority
        </p>

        <ConceptInterlinear segments={ALL_SEGMENTS} tooltips={preferences.tooltips} />

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

import React from 'react';
import { ConceptInterlinear } from './ConceptInterlinear';
import { OPENING_PHRASES } from '../../../data/liturgy/_proto/opening-practice-aligned';

const SERIF = "'Cardo', 'Gentium Plus', 'Noto Serif', serif";

/**
 * PROTOTYPE page — concept-aligned interlinear for one Heart Sutra phrase.
 * Mounted at /liturgy/_proto. Not linked from the reader index.
 */
export const ConceptAlignProtoPage: React.FC = () => (
  <div className="min-h-screen bg-slate-950 text-slate-100">
    <div className="max-w-3xl mx-auto px-8 py-10">
      <a href="/liturgy" className="text-emerald-400/70 hover:text-emerald-300 text-sm">
        ← Liturgy
      </a>

      <p className="mt-14 mb-16 text-center text-sm text-slate-500 italic" style={{ fontFamily: SERIF }}>
        Heart Sutra · open an eye to add a language, ɑ for its sound, hover a word to see what it means and matches.
      </p>

      <ConceptInterlinear segments={OPENING_PHRASES} />
    </div>
  </div>
);

export default ConceptAlignProtoPage;

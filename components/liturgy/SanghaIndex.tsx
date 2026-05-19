import React from 'react';
import { SANGHA_INDEX } from '../../data/liturgy/sanghas';
import { liturgyDocsForSangha } from '../../data/liturgy';

/**
 * Sangha picker — top-level liturgy page.
 *
 *  /liturgy → this page
 *
 * Lists each community/monastery whose chants are in the reader. Click
 * a sangha → see their chants → click a chant → read it.
 *
 * Pluralism-first ordering: chronological by founding date (oldest
 * first) so historical lineages anchor visually when the index grows.
 */

const SERIF_STACK = "'Cardo', 'Gentium Plus', 'Noto Serif', serif";

export const SanghaIndex: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <header className="mb-16">
          <h1 className="text-4xl text-slate-100 mb-3" style={{ fontFamily: SERIF_STACK }}>
            Liturgy
          </h1>
          <p className="text-slate-500 text-sm">
            Chants as practiced by living communities. Pick a sangha.
          </p>
        </header>

        <div className="space-y-6">
          {SANGHA_INDEX.map((sangha) => {
            const docs = liturgyDocsForSangha(sangha.slug);
            return (
              <a
                key={sangha.slug}
                href={`/liturgy/${sangha.slug}`}
                className="block p-6 border border-slate-800 rounded-lg hover:border-emerald-700/50 hover:bg-slate-900/40 transition-colors"
              >
                <div className="flex items-baseline gap-4 mb-2 flex-wrap">
                  <h2 className="text-2xl text-slate-100" style={{ fontFamily: SERIF_STACK }}>
                    {sangha.name}
                  </h2>
                  <span className="text-xs text-slate-600 ml-auto">
                    {docs.length} {docs.length === 1 ? 'chant' : 'chants'}
                  </span>
                </div>
                {sangha.fullName && sangha.fullName !== sangha.name && (
                  <div className="text-slate-400 italic text-sm mb-2">{sangha.fullName}</div>
                )}
                {sangha.description && (
                  <p className="text-slate-500 text-sm leading-relaxed mb-3">{sangha.description}</p>
                )}
                <div className="text-xs text-slate-600 flex flex-wrap gap-x-4 gap-y-1">
                  {sangha.location && <span>📍 {sangha.location}</span>}
                  {sangha.founded && <span>est. {sangha.founded}</span>}
                  {sangha.url && (
                    <span className="text-emerald-400/60">{sangha.url.replace(/^https?:\/\//, '')}</span>
                  )}
                </div>
              </a>
            );
          })}
        </div>

      </div>
    </div>
  );
};

export default SanghaIndex;

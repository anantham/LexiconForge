import React from 'react';
import type { Sangha } from '../../types/liturgy';
import { liturgyDocsForSangha } from '../../data/liturgy';

/**
 * Per-sangha chant index — lists every chant belonging to one community.
 *
 *  /liturgy/<sangha-slug> → this page
 *
 * Each card links to `/liturgy/<sangha-slug>/<chant-slug>` for the
 * individual chant page.
 *
 * Deliberately honest about what this is: the version *this sangha*
 * chants. Different sanghas have different English, different orderings,
 * different framings — all valid.
 */

const SERIF_STACK = "'Cardo', 'Gentium Plus', 'Noto Serif', serif";

export const LiturgyIndex: React.FC<{ sangha: Sangha }> = ({ sangha }) => {
  const docs = liturgyDocsForSangha(sangha.slug);
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <nav className="absolute top-4 left-6 text-xs z-10">
        <a href="/liturgy" className="text-emerald-400/80 hover:text-emerald-300 uppercase tracking-widest">
          ← All sanghas
        </a>
      </nav>
      <div className="max-w-3xl mx-auto px-6 py-16">
        <header className="mb-16">
          <h1 className="text-4xl text-slate-100 mb-2" style={{ fontFamily: SERIF_STACK }}>
            {sangha.name}
          </h1>
          {sangha.fullName && sangha.fullName !== sangha.name && (
            <p className="text-slate-400 italic mb-3">{sangha.fullName}</p>
          )}
          {sangha.description && (
            <p className="text-slate-500 text-sm leading-relaxed">{sangha.description}</p>
          )}
          <div className="text-xs text-slate-600 mt-3 flex flex-wrap gap-x-4 gap-y-1">
            {sangha.location && <span>📍 {sangha.location}</span>}
            {sangha.founded && <span>est. {sangha.founded}</span>}
            {sangha.url && (
              <a
                href={sangha.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400/60 hover:text-emerald-300"
              >
                {sangha.url.replace(/^https?:\/\//, '')}
              </a>
            )}
          </div>
        </header>

        <div className="space-y-6">
          {docs.map((doc) => (
            <a
              key={doc.slug}
              href={`/liturgy/${sangha.slug}/${doc.slug}`}
              className="block p-6 border border-slate-800 rounded-lg hover:border-emerald-700/50 hover:bg-slate-900/40 transition-colors"
            >
              <div className="flex items-baseline gap-4 mb-2">
                <h2 className="text-xl text-slate-100" style={{ fontFamily: SERIF_STACK }}>
                  {doc.title}
                </h2>
                <span className="text-xs uppercase tracking-widest text-slate-500">
                  {doc.tradition}
                </span>
              </div>
              {doc.subtitle && <div className="text-slate-400 italic mb-1">{doc.subtitle}</div>}
              {doc.context && <p className="text-slate-500 text-sm">{doc.context}</p>}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LiturgyIndex;

import React from 'react';
import type { LiturgyDoc } from '../../types/liturgy';
import { SectionRenderer } from './SectionRenderer';
import { ProseBlock } from './ProseBlock';

/**
 * Single-chant page. Renders the document header (title, context, sources)
 * then each section via the shape dispatcher.
 */

const TRADITION_LABELS: Record<LiturgyDoc['tradition'], string> = {
  theravada: 'Theravāda',
  mahayana: 'Mahāyāna',
  zen: 'Zen',
  vajrayana: 'Vajrayāna',
  lakota: 'Lakota',
  maple: 'MAPLE',
  mixed: 'Mixed traditions',
};

export const LiturgyChantPage: React.FC<{ doc: LiturgyDoc }> = ({ doc }) => {
  // Pick the curator's "home" witness as the primary one — first by convention.
  // For MAPLE-curated chants this is MAPLE. The renderer makes the primary
  // visible by default and tucks others behind disclosure.
  const primaryWitness = (() => {
    for (const sec of doc.sections) {
      if (sec.shape === 'triple-script-witness' && sec.witnesses.length > 0) {
        return sec.witnesses[0].by;
      }
    }
    return '';
  })();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Top nav */}
        <nav className="mb-8 flex items-center gap-4 text-sm">
          <a href="/liturgy" className="text-emerald-400/80 hover:text-emerald-300">
            ← Liturgy
          </a>
          <span className="text-slate-600">·</span>
          <span className="text-slate-500">{TRADITION_LABELS[doc.tradition]}</span>
        </nav>

        {/* Title block */}
        <header className="mb-8">
          <h1 className="text-3xl font-serif text-slate-100 mb-2">{doc.title}</h1>
          {doc.subtitle && <p className="text-slate-400 italic">{doc.subtitle}</p>}
          {doc.context && <p className="text-slate-400 mt-4 leading-relaxed">{doc.context}</p>}
        </header>

        {/* Sources */}
        {doc.sources && (
          <div className="mb-8 text-sm text-slate-500 space-y-1">
            {doc.sources.canonical && doc.sources.canonical.length > 0 && (
              <div>
                <span className="text-slate-600">Canonical: </span>
                {doc.sources.canonical.map((s, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && <span className="text-slate-700"> · </span>}
                    {s.url ? (
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-400/70 hover:text-emerald-300"
                      >
                        {s.label}
                      </a>
                    ) : (
                      <span>{s.label}</span>
                    )}
                  </React.Fragment>
                ))}
              </div>
            )}
            {doc.sources.ritual && doc.sources.ritual.length > 0 && (
              <div>
                <span className="text-slate-600">Ritual provenance: </span>
                {doc.sources.ritual.map((s, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && <span className="text-slate-700"> · </span>}
                    <span>{s.label}</span>
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Preamble */}
        {doc.preamble && (
          <div className="mb-8 italic text-slate-400">
            <ProseBlock text={doc.preamble} className="space-y-3 italic text-slate-400" />
          </div>
        )}

        {/* Sections */}
        {doc.sections.map((section) => (
          <SectionRenderer
            key={section.id}
            section={section}
            primaryWitness={primaryWitness}
          />
        ))}

        {/* Postamble */}
        {doc.postamble && (
          <div className="mt-12 pt-8 border-t border-slate-800">
            <ProseBlock text={doc.postamble} className="space-y-3 text-slate-400 italic" />
          </div>
        )}

        {/* Curator note */}
        {doc.curator && (
          <div className="mt-12 text-xs text-slate-600 italic">{doc.curator}</div>
        )}
      </div>
    </div>
  );
};

export default LiturgyChantPage;

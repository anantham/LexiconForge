import React from 'react';
import type { LiturgyDoc } from '../../types/liturgy';
import { SectionRenderer } from './SectionRenderer';
import { ProseBlock } from './ProseBlock';
import { LiturgySettingsProvider, SettingsButton } from './LiturgySettings';

/**
 * Single-chant page.
 *
 * Layout philosophy (post-feedback 2026-05-15):
 *  - The opening section is the threshold; nothing competes with it above.
 *  - A thin nav strip at the very top (← Liturgy only).
 *  - Title + sources move to a quiet footer at the page bottom.
 *  - Sections flow continuously, the first one in `isOpening` mode (75vh).
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
  const primaryWitness = (() => {
    for (const sec of doc.sections) {
      if (sec.shape === 'triple-script-witness') {
        for (const seg of sec.segments) {
          if (seg.witnesses.length > 0) return seg.witnesses[0].by;
        }
      }
    }
    return '';
  })();

  return (
    <LiturgySettingsProvider>
      <div className="min-h-screen bg-slate-950 text-slate-100">
        {/* Thin nav at top, no big header — the Homage is the threshold */}
        <nav className="absolute top-4 left-6 text-xs z-10">
          <a
            href="/liturgy"
            className="text-emerald-400/80 hover:text-emerald-300 uppercase tracking-widest"
          >
            ← Liturgy
          </a>
        </nav>
        <SettingsButton />

      {/* Sections — first one gets `isOpening` for the big stone-marker layout */}
      {doc.sections.map((section, i) => (
        <SectionRenderer
          key={section.id}
          section={section}
          primaryWitness={primaryWitness}
          isOpening={i === 0}
        />
      ))}

      {/* Footer — quiet, after all chants */}
      <footer className="max-w-3xl mx-auto px-6 py-16 mt-8 border-t border-slate-900">
        <div className="text-center mb-6">
          <h2
            className="text-2xl text-slate-200 mb-2"
            style={{ fontFamily: "'Cardo', 'Gentium Plus', 'Noto Serif', serif" }}
          >
            {doc.title}
          </h2>
          {doc.subtitle && (
            <p className="text-slate-500 italic text-sm">{doc.subtitle}</p>
          )}
        </div>

        {doc.sources && (
          <div className="text-xs text-slate-600 space-y-2 text-center">
            {doc.sources.canonical && doc.sources.canonical.length > 0 && (
              <div>
                <span className="text-slate-700 uppercase tracking-widest text-[10px] mr-2">
                  Canonical
                </span>
                {doc.sources.canonical.map((s, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && <span className="text-slate-800 mx-1">·</span>}
                    {s.url ? (
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-400/60 hover:text-emerald-300"
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
                <span className="text-slate-700 uppercase tracking-widest text-[10px] mr-2">
                  Provenance
                </span>
                {doc.sources.ritual.map((s, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && <span className="text-slate-800 mx-1">·</span>}
                    <span>{s.label}</span>
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
        )}
      </footer>
      </div>
    </LiturgySettingsProvider>
  );
};

export default LiturgyChantPage;

import React, { useMemo, useState } from 'react';
import type { LiturgyDoc, Sangha, Witness } from '../../types/liturgy';
import { SectionRenderer } from './SectionRenderer';
import { ProseBlock } from './ProseBlock';
import { LiturgySettingsProvider, SettingsButton, useLiturgySettings } from './LiturgySettings';
import { WitnessDots } from './shapes/TripleScriptWitness';

/**
 * Gather every unique English-translation witness used across the doc.
 * Deduplicated by `by` name (so MAPLE appearing on every segment shows
 * once in the footer). Returned in order of first appearance so the
 * primary witness anchors first.
 */
function uniqueWitnesses(doc: LiturgyDoc): Witness[] {
  const seen = new Map<string, Witness>();
  for (const section of doc.sections) {
    if (section.shape !== 'triple-script-witness') continue;
    for (const seg of section.segments) {
      for (const w of seg.witnesses) {
        if (!seen.has(w.by)) seen.set(w.by, w);
      }
    }
  }
  return Array.from(seen.values());
}

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

export const LiturgyChantPage: React.FC<{ doc: LiturgyDoc; sangha?: Sangha }> = ({
  doc,
  sangha,
}) => {
  return (
    <LiturgySettingsProvider>
      <LiturgyChantPageBody doc={doc} sangha={sangha} />
    </LiturgySettingsProvider>
  );
};

const LiturgyChantPageBody: React.FC<{ doc: LiturgyDoc; sangha?: Sangha }> = ({
  doc,
  sangha,
}) => {
  const backHref = sangha ? `/liturgy/${sangha.slug}` : '/liturgy';
  const backLabel = sangha ? sangha.name : 'Liturgy';
  const witnesses = useMemo(() => uniqueWitnesses(doc), [doc]);
  const primaryWitness = witnesses[0]?.by ?? '';
  const { settings } = useLiturgySettings();

  // Page-level witness picker state. The dots row lives once at the top of
  // the chant body; every triple-script-witness section honors the same
  // selection. Sections that don't carry the active witness fall back to
  // their own first witness at the segment level (per SegmentRow).
  const [witnessIdx, setWitnessIdx] = useState(0);
  const preferredWitnessBy = witnesses[witnessIdx]?.by ?? primaryWitness;
  const cycleWitness = () => {
    if (witnesses.length <= 1) return;
    setWitnessIdx((w) => (w + 1) % witnesses.length);
  };

  return (
      <div
        className="min-h-screen bg-slate-950 text-slate-100"
        style={{ ['--liturgy-scale' as string]: settings.fontScale }}
      >
        {/* Thin nav at top — the chant artifact itself carries title-weight,
            either by way of a recognizable opening line (morning-chants'
            "Namo tassa...") or an explicit title-as-segment first section
            (enmei-jikku-kannon-gyo). */}
        <nav className="absolute top-4 left-6 text-xs z-10">
          <a
            href={backHref}
            className="text-emerald-400/80 hover:text-emerald-300 uppercase tracking-widest"
          >
            ← {backLabel}
          </a>
        </nav>
        <SettingsButton />

      {/* Page-level witness picker — one row of dots covering every
          translation used anywhere in the doc. Hidden when there's only
          one source (one dot is noise). Sits above the first section so
          the source choice anchors the whole page, not per-section. */}
      {witnesses.length > 1 && (
        <div className="pt-12 pb-2 flex justify-center">
          <WitnessDots
            witnesses={witnesses}
            activeIdx={witnessIdx}
            onSelect={setWitnessIdx}
          />
        </div>
      )}

      {/* Sections — first one gets `isOpening` for the big stone-marker layout */}
      {doc.sections.map((section, i) => (
        <SectionRenderer
          key={section.id}
          section={section}
          preferredWitnessBy={preferredWitnessBy}
          onCycleWitness={cycleWitness}
          isOpening={i === 0}
        />
      ))}

      {/* Footer — sources, links, attributions. Quiet, after all chants. */}
      <footer className="max-w-3xl mx-auto px-6 py-16 mt-8 border-t border-slate-900">
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

        {witnesses.length > 0 && (
          <div className="text-xs text-slate-600 space-y-2 text-center mt-2">
            <div>
              <span className="text-slate-700 uppercase tracking-widest text-[10px] mr-2">
                Translations
              </span>
              {witnesses.map((w, i) => (
                <React.Fragment key={w.by}>
                  {i > 0 && <span className="text-slate-800 mx-1">·</span>}
                  {w.url ? (
                    <a
                      href={w.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-400/60 hover:text-emerald-300"
                    >
                      {w.by}
                    </a>
                  ) : (
                    <span>{w.by}</span>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}
      </footer>
      </div>
  );
};

export default LiturgyChantPage;

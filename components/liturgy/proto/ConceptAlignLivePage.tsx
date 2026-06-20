import React from 'react';
import { ConceptInterlinear } from '../concept/ConceptInterlinear';
import { deriveAlignSegment } from '../concept/deriveAlignSegment';
import { getLiturgyDoc } from '../../../data/liturgy';

const SERIF = "'Cardo', 'Gentium Plus', 'Noto Serif', serif";

/**
 * LIVE-WIRING proof — the SHIPPED Heart Sutra (data/liturgy/heart-sutra.ts),
 * auto-aligned through the concept graph at render time, in the concept-aligned
 * reader. Mounted at /liturgy/_proto/live. Faint "(not aligned yet)" tokens are
 * the worklist the registry can't resolve on its own.
 */
export const ConceptAlignLivePage: React.FC = () => {
  const doc = getLiturgyDoc('maple', 'heart-sutra');
  const segments = (doc?.sections.flatMap((s: any) => s.segments ?? []) ?? [])
    .filter((seg: any) => Array.isArray(seg.scripts) && seg.scripts.length > 0)
    .map((seg: any) => deriveAlignSegment(seg));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-3xl mx-auto px-8 py-10">
        <a href="/liturgy" className="text-emerald-400/70 hover:text-emerald-300 text-sm">
          ← Liturgy
        </a>
        <p className="mt-14 mb-16 text-center text-sm text-slate-500 italic" style={{ fontFamily: SERIF }}>
          Heart Sutra — live data, auto-aligned from the concept graph
        </p>
        {segments.length ? (
          <ConceptInterlinear segments={segments} />
        ) : (
          <p className="text-center text-slate-500">No segments found.</p>
        )}
      </div>
    </div>
  );
};

export default ConceptAlignLivePage;

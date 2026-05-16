import React from 'react';
import type { Citation } from '../../types/suttaStudio';

/**
 * Small citation chip matching the Sutta Studio aesthetic
 * (components/sutta-studio/LensPanel.tsx). Same look so the two readers
 * feel of-a-piece, and so the grounding contract is visible across both.
 *
 * Ungrounded citations (id starts with `cite:ungrounded:`) render in amber
 * so the gap is foregrounded rather than hidden.
 */

export const CitationChip: React.FC<{ cite: Citation }> = ({ cite }) => {
  const isUngrounded = cite.id.startsWith('cite:ungrounded:');
  const label = cite.short;
  const tooltip = cite.detail ?? cite.excerpt ?? cite.id;

  const baseClass =
    'text-[10px] px-2 py-0.5 rounded border whitespace-nowrap transition-colors';
  const className = isUngrounded
    ? `${baseClass} border-amber-700/50 text-amber-300/80 hover:text-amber-200`
    : `${baseClass} border-slate-700 text-slate-400 hover:text-slate-100 hover:border-slate-500`;

  if (cite.url) {
    return (
      <a
        href={cite.url}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        title={tooltip}
      >
        {label} ↗
      </a>
    );
  }

  return (
    <span className={className} title={tooltip}>
      {label}
    </span>
  );
};

export default CitationChip;

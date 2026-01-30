import type { RelationType } from '../../types/suttaStudio';

export const RELATION_COLORS = {
  ownership: {
    color: '#F59E0B',
    tailwind: 'text-amber-500',
    border: 'border-amber-500',
    bg: 'bg-amber-500/10',
  },
  direction: {
    color: '#3B82F6',
    tailwind: 'text-blue-500',
    border: 'border-blue-500',
    bg: 'bg-blue-500/10',
  },
  location: {
    color: '#10B981',
    tailwind: 'text-emerald-500',
    border: 'border-emerald-500',
    bg: 'bg-emerald-500/10',
  },
  action: {
    color: '#F97316',
    tailwind: 'text-orange-500',
    border: 'border-orange-500',
    bg: 'bg-orange-500/10',
  },
} as const;

export const RELATION_GLYPHS: Record<RelationType, string> = {
  ownership: '●',
  direction: '→',
  location: '▢',
  action: '◆',
};

export const RELATION_HOOK: Record<RelationType, string> = {
  ownership: 'OF',
  direction: 'TO/FOR',
  location: 'IN/AT',
  action: 'BY/WITH',
};

// Refrain colors - for repeated formulas/phrases across phases
// Shows visual rhythm in study mode (as underline)
export const REFRAIN_COLORS: Record<string, { underline: string; bg: string }> = {
  bhikkhu: {
    underline: 'border-blue-400',
    bg: 'bg-blue-400/10',
  },
  bhagava: {
    underline: 'border-yellow-400',
    bg: 'bg-yellow-400/10',
  },
  'formula-ardent': {
    underline: 'border-green-400',
    bg: 'bg-green-400/10',
  },
  'formula-removing': {
    underline: 'border-purple-400',
    bg: 'bg-purple-400/10',
  },
  'four-objects': {
    underline: 'border-teal-400',
    bg: 'bg-teal-400/10',
  },
};

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

import type { PhaseView } from '../types/suttaStudio';

export const SUTTA_STUDIO_SKELETON_EXAMPLE = {
  phases: [
    {
      id: 'phase-1',
      title: '',
      segmentIds: ['mn10:1.1', 'mn10:1.2'],
    },
  ],
} as const;

export const SUTTA_STUDIO_PHASE_EXAMPLE: PhaseView = {
  id: 'phase-1',
  title: 'Example Only',
  layoutBlocks: [['p1', 'p2', 'p3']],
  paliWords: [
    {
      id: 'p1',
      color: 'text-emerald-400',
      segments: [
        {
          text: 'Ek',
          type: 'root',
          tooltips: ['Eka: One / Singular', 'Eka: Alone', 'Eka: Unified'],
        },
        { text: 'āyano', type: 'suffix', tooltips: ['Going / Way'] },
      ],
      senses: [
        { english: 'Direct', nuance: 'Linear' },
        { english: 'Solitary', nuance: 'Lonely' },
        {
          english: 'Convergence',
          nuance: 'Unifying',
          ripples: { ghost1: 'is the point of' },
        },
      ],
    },
    {
      id: 'p2',
      color: 'text-yellow-400',
      segments: [
        {
          text: 'satt',
          type: 'root',
          tooltips: ['√as: To be / Living', '√saj: To cling / Stick'],
        },
        {
          text: 'ānaṁ',
          type: 'suffix',
          tooltips: ['Function: Marks the Group/Owner'],
          relation: { targetId: 'p3', type: 'ownership', label: 'Belongs To', status: 'confirmed' },
          morph: { case: 'gen', number: 'pl', note: 'Marks belonging, plural (-ānaṁ)' },
        },
      ],
      senses: [
        { english: 'beings', nuance: 'Living entities' },
        { english: 'stuck ones', nuance: 'Attached' },
      ],
    },
    {
      id: 'p3',
      color: 'text-blue-400',
      segments: [
        { text: 'vi', type: 'prefix', tooltips: ['Intensive'] },
        { text: 'suddhi', type: 'root', tooltips: ['√sudh: Purity'] },
        { text: 'yā', type: 'suffix', tooltips: ['Function: For the purpose of'] },
      ],
      senses: [{ english: 'purification', nuance: 'Cleaning' }],
      isAnchor: true,
    },
  ],
  englishStructure: [
    { id: 'e1', linkedPaliId: 'p2' },
    { id: 'ghost1', label: 'is the', isGhost: true, ghostKind: 'required' },
    { id: 'e2', linkedPaliId: 'p1' },
    { id: 'g2', label: 'for the', isGhost: true, ghostKind: 'required' },
    { id: 'e3', linkedPaliId: 'p3' },
  ],
};

export const SUTTA_STUDIO_SKELETON_EXAMPLE_JSON = JSON.stringify(SUTTA_STUDIO_SKELETON_EXAMPLE, null, 2);
export const SUTTA_STUDIO_PHASE_EXAMPLE_JSON = JSON.stringify(SUTTA_STUDIO_PHASE_EXAMPLE, null, 2);

export const SUTTA_STUDIO_MORPH_EXAMPLE = {
  paliWords: [
    {
      id: 'p5',
      segments: [
        { text: 'satt', type: 'root', tooltips: ['√as: to be / living'] },
        {
          text: 'ānaṁ',
          type: 'suffix',
          tooltips: ['Belonging (plural) suffix'],
          morph: { case: 'gen', number: 'pl', note: 'Marks belonging, plural (-ānaṁ)' },
          relation: { targetId: 'p6', type: 'ownership', label: 'Belongs To', status: 'confirmed' },
        },
      ],
    },
  ],
} as const;

export const SUTTA_STUDIO_MORPH_EXAMPLE_JSON = JSON.stringify(SUTTA_STUDIO_MORPH_EXAMPLE, null, 2);

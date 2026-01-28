import type { DeepLoomPacket } from '../../types/suttaStudio';

export const DEMO_PACKET_MN10: DeepLoomPacket = {
  packetId: 'demo-mn10',
  source: { provider: 'suttacentral', workId: 'mn10' },
  canonicalSegments: [],
  citations: [],
  progress: {
    totalPhases: 7,
    readyPhases: 7,
    state: 'complete',
  },
  renderDefaults: {
    ghostOpacity: 0.3,
    englishVisible: true,
    studyToggleDefault: true,
  },
  compiler: {
    provider: 'openrouter',
    model: 'demo',
    promptVersion: 'demo-v1',
    createdAtISO: new Date().toISOString(),
    sourceDigest: 'demo',
  },
  phases: [
    {
      id: 'phase-1',
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
          color: 'text-slate-400',
          segments: [
            {
              text: 'ayaṁ',
              type: 'stem',
              tooltips: ["Roots: 'Iron' (Ayas) | 'Good Fortune' (Aya) | 'This' (Ima)"],
            },
          ],
          senses: [{ english: 'this', nuance: 'Pointer' }],
        },
        {
          id: 'p3',
          color: 'text-amber-400',
          segments: [
            { text: 'Bhikkh', type: 'root', tooltips: ['√bhikkh: To share / beg'] },
            { text: 'ave', type: 'suffix', tooltips: ['Function: Addressing the crowd'] },
          ],
          senses: [
            { english: 'Mendicants,', nuance: 'Alms-men' },
            { english: 'Monks,', nuance: 'Standard' },
            { english: 'Friends,', nuance: 'Soft' },
          ],
        },
        {
          id: 'p4',
          color: 'text-emerald-400',
          segments: [{ text: 'maggo', type: 'stem', tooltips: ['√magg: Tracking (Road/Method)'] }],
          senses: [{ english: 'path', nuance: 'Method' }],
        },
      ],
      englishStructure: [
        { id: 'e1', linkedPaliId: 'p3' },
        { id: 'e2', linkedPaliId: 'p2' },
        { id: 'ghost1', label: 'is the', isGhost: true, ghostKind: 'required' },
        { id: 'e3', linkedPaliId: 'p1' },
        { id: 'e4', linkedPaliId: 'p4' },
      ],
    },
    {
      id: 'phase-2',
      paliWords: [
        {
          id: 'p4_anchor',
          color: 'text-emerald-400',
          segments: [{ text: 'maggo', type: 'stem', tooltips: ['Context Anchor'] }],
          senses: [{ english: '(path)', nuance: '' }],
          isAnchor: true,
        },
        {
          id: 'p5',
          color: 'text-yellow-400',
          segments: [
            {
              text: 'satt',
              type: 'root',
              tooltips: [
                '√as: To be / Living',
                '√saj: To cling / Stick',
                'Satta: Seven (7) / Components',
              ],
            },
            {
              text: 'ānaṁ',
              type: 'suffix',
              tooltips: ['Function: Marks the Group/Owner'],
              relation: { targetId: 'p6', type: 'ownership', label: 'Belongs To' },
            },
          ],
          senses: [
            { english: 'beings', nuance: 'Living entities' },
            { english: 'stuck ones', nuance: 'Attached' },
            { english: 'seven types', nuance: 'Numerical' },
          ],
        },
        {
          id: 'p6',
          color: 'text-blue-400',
          segments: [
            { text: 'vi', type: 'prefix', tooltips: ['Intensive'] },
            { text: 'suddhi', type: 'root', tooltips: ['√sudh: Purity'] },
            { text: 'yā', type: 'suffix', tooltips: ['Function: For the purpose of'] },
          ],
          senses: [
            { english: 'purification', nuance: 'Cleaning' },
            { english: 'clarity', nuance: 'Clear seeing' },
          ],
        },
      ],
      englishStructure: [
        { id: 'g1', label: 'for the', isGhost: true, ghostKind: 'required' },
        { id: 'e5', linkedPaliId: 'p6' },
        { id: 'g2', label: 'of', isGhost: true, ghostKind: 'required' },
        { id: 'e6', linkedPaliId: 'p5' },
      ],
    },
    {
      id: 'phase-3',
      paliWords: [
        {
          id: 'p7',
          color: 'text-rose-400',
          segments: [
            { text: 'soka', type: 'root', tooltips: ['√suc: Burning / Dryness'] },
            { text: 'parideva', type: 'root', tooltips: ['Crying out all around'] },
            {
              text: 'ānaṁ',
              type: 'suffix',
              tooltips: ['Function: Marks the Object'],
              relation: { targetId: 'p8', type: 'direction', label: 'Target Of' },
            },
          ],
          senses: [
            { english: 'grief & lamentation', nuance: 'Literal' },
            { english: 'burning & crying', nuance: 'Etymological' },
          ],
        },
        {
          id: 'p8',
          color: 'text-blue-400',
          segments: [
            { text: 'sam', type: 'prefix', tooltips: ['Together'] },
            { text: 'ati', type: 'prefix', tooltips: ['Over / Beyond'] },
            { text: 'kkam', type: 'root', tooltips: ['√kam: Stepping'] },
            { text: 'āya', type: 'suffix', tooltips: ['Function: For the purpose of'] },
          ],
          senses: [
            { english: 'surmounting', nuance: 'Crossing over' },
            { english: 'transcending', nuance: 'Going beyond' },
          ],
        },
      ],
      englishStructure: [
        { id: 'g1', label: 'for the', isGhost: true, ghostKind: 'required' },
        { id: 'e7', linkedPaliId: 'p8' },
        { id: 'g2', label: 'of', isGhost: true, ghostKind: 'required' },
        { id: 'e8', linkedPaliId: 'p7' },
      ],
    },
    {
      id: 'phase-4',
      paliWords: [
        {
          id: 'p9',
          color: 'text-rose-400',
          segments: [
            { text: 'dukkha', type: 'root', tooltips: ['Du (Bad) + Kha (Axle space)'] },
            { text: 'domanass', type: 'root', tooltips: ['Mental Pain (Bad Mind)'] },
            {
              text: 'ānaṁ',
              type: 'suffix',
              tooltips: ['Function: Marks the Object'],
              relation: { targetId: 'p10', type: 'direction', label: 'Target Of' },
            },
          ],
          senses: [
            { english: 'pain & distress', nuance: 'Physical/Mental' },
            { english: 'suffering & sadness', nuance: 'Standard' },
          ],
        },
        {
          id: 'p10',
          color: 'text-blue-400',
          segments: [
            { text: 'atthaṅ', type: 'root', tooltips: ['Attha: Home / Setting'] },
            { text: 'gam', type: 'root', tooltips: ['Gama: Going'] },
            { text: 'āya', type: 'suffix', tooltips: ['Function: For the purpose of'] },
          ],
          senses: [
            { english: 'disappearance', nuance: 'Going home' },
            { english: 'ending', nuance: 'Setting down' },
            { english: 'extinguishing', nuance: 'Fading' },
          ],
        },
      ],
      englishStructure: [
        { id: 'g1', label: 'for the', isGhost: true, ghostKind: 'required' },
        { id: 'e9', linkedPaliId: 'p10' },
        { id: 'g2', label: 'of', isGhost: true, ghostKind: 'required' },
        { id: 'e10', linkedPaliId: 'p9' },
      ],
    },
    {
      id: 'phase-5',
      paliWords: [
        {
          id: 'p11',
          color: 'text-yellow-400',
          segments: [
            { text: 'ñāya', type: 'root', tooltips: ['Method / System / Truth'] },
            {
              text: 'ssa',
              type: 'suffix',
              tooltips: ['Function: Marks ownership'],
              relation: { targetId: 'p12', type: 'ownership', label: 'Belongs To' },
            },
          ],
          senses: [
            { english: 'of the true method', nuance: 'Systematic' },
            { english: 'of the truth', nuance: 'Ultimate' },
          ],
        },
        {
          id: 'p12',
          color: 'text-blue-400',
          segments: [
            { text: 'adhi', type: 'prefix', tooltips: ['Onto / Towards'] },
            { text: 'gam', type: 'root', tooltips: ['Gama: Going'] },
            { text: 'āya', type: 'suffix', tooltips: ['Function: For the purpose of'] },
          ],
          senses: [
            { english: 'attainment', nuance: 'Reaching' },
            { english: 'acquisition', nuance: 'Getting' },
          ],
        },
      ],
      englishStructure: [
        { id: 'g1', label: 'for the', isGhost: true, ghostKind: 'required' },
        { id: 'e11', linkedPaliId: 'p12' },
        { id: 'e12', linkedPaliId: 'p11' },
      ],
    },
    {
      id: 'phase-6',
      paliWords: [
        {
          id: 'p13',
          color: 'text-indigo-400',
          segments: [
            { text: 'nibbān', type: 'root', tooltips: ['Ni (Out) + Vana (Fire)'] },
            {
              text: 'assa',
              type: 'suffix',
              tooltips: ['Function: Marks the Object'],
              relation: { targetId: 'p14', type: 'direction', label: 'Target Of' },
            },
          ],
          senses: [
            { english: 'of Nibbana', nuance: 'Ultimate Goal' },
            { english: 'of Unbinding', nuance: 'Freedom' },
          ],
        },
        {
          id: 'p14',
          color: 'text-blue-400',
          segments: [
            { text: 'sacchi', type: 'root', tooltips: ['With eyes / Directly'] },
            { text: 'kiriy', type: 'root', tooltips: ['Karo: Making / Doing'] },
            { text: 'āya', type: 'suffix', tooltips: ['Function: For the purpose of'] },
          ],
          senses: [
            { english: 'realization', nuance: 'Making real' },
            { english: 'witnessing', nuance: 'Seeing directly' },
          ],
        },
      ],
      englishStructure: [
        { id: 'g1', label: 'for the', isGhost: true, ghostKind: 'required' },
        { id: 'e13', linkedPaliId: 'p14' },
        { id: 'e14', linkedPaliId: 'p13' },
      ],
    },
    {
      id: 'phase-7',
      paliWords: [
        {
          id: 'p15',
          color: 'text-slate-400',
          segments: [
            { text: 'yad', type: 'root', tooltips: ['Which'] },
            { text: 'idaṁ', type: 'root', tooltips: ['This'] },
          ],
          senses: [{ english: 'namely', nuance: 'Identity' }],
        },
        {
          id: 'p16',
          color: 'text-emerald-400',
          segments: [{ text: 'cattāro', type: 'stem', tooltips: ['Four (4)'] }],
          senses: [{ english: 'the four', nuance: 'Quantity' }],
        },
        {
          id: 'p17',
          color: 'text-emerald-400',
          segments: [
            { text: 'sati', type: 'root', tooltips: ['Memory / Presence'] },
            { text: 'paṭṭhānā', type: 'root', tooltips: ['Foundation / Establishing'] },
          ],
          senses: [
            { english: 'foundations of mindfulness', nuance: 'Standard' },
            { english: 'establishments of awareness', nuance: 'Active' },
          ],
        },
      ],
      englishStructure: [
        { id: 'e15', linkedPaliId: 'p15' },
        { id: 'e16', linkedPaliId: 'p16' },
        { id: 'e17', linkedPaliId: 'p17' },
      ],
    },
  ],
};

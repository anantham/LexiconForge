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
          wordClass: 'content',
          segments: [
            {
              id: 'p1s1',
              text: 'Ek',
              type: 'root',
              tooltips: ['Eka: One / Singular', 'Eka: Alone', 'Eka: Unified'],
            },
            { id: 'p1s2', text: 'āyano', type: 'suffix', tooltips: ['Going / Way'] },
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
          wordClass: 'function',
          segments: [
            {
              id: 'p2s1',
              text: 'ayaṁ',
              type: 'stem',
              tooltips: ["Roots: 'Iron' (Ayas) | 'Good Fortune' (Aya) | 'This' (Ima)"],
            },
          ],
          senses: [{ english: 'this', nuance: 'Pointer' }],
        },
        {
          id: 'p3',
          wordClass: 'content',
          segments: [
            { id: 'p3s1', text: 'Bhikkh', type: 'root', tooltips: ['√bhikkh: To share / beg'] },
            { id: 'p3s2', text: 'ave', type: 'suffix', tooltips: ['Function: Addressing the crowd'] },
          ],
          senses: [
            { english: 'Mendicants,', nuance: 'Alms-men' },
            { english: 'Monks,', nuance: 'Standard' },
            { english: 'Friends,', nuance: 'Soft' },
          ],
        },
        {
          id: 'p4',
          wordClass: 'content',
          segments: [{ id: 'p4s1', text: 'maggo', type: 'stem', tooltips: ['√magg: Tracking (Road/Method)'] }],
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
          wordClass: 'content',
          segments: [{ id: 'p4_anchors1', text: 'maggo', type: 'stem', tooltips: ['Context Anchor'] }],
          senses: [{ english: '(path)', nuance: '' }],
          isAnchor: true,
        },
        {
          id: 'p5',
          wordClass: 'content',
          segments: [
            {
              id: 'p5s1',
              text: 'satt',
              type: 'root',
              tooltips: [
                '√as: To be / Living',
                '√saj: To cling / Stick',
                'Satta: Seven (7) / Components',
              ],
            },
            {
              id: 'p5s2',
              text: 'ānaṁ',
              type: 'suffix',
              tooltips: ['Function: Marks the Group/Owner'],
              relation: { targetWordId: 'p6', type: 'ownership', label: 'Belongs To' },
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
          wordClass: 'content',
          segments: [
            { id: 'p6s1', text: 'vi', type: 'prefix', tooltips: ['Intensive'] },
            { id: 'p6s2', text: 'suddhi', type: 'root', tooltips: ['√sudh: Purity'] },
            { id: 'p6s3', text: 'yā', type: 'suffix', tooltips: ['Function: For the purpose of'] },
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
          wordClass: 'content',
          segments: [
            { id: 'p7s1', text: 'soka', type: 'root', tooltips: ['√suc: Burning / Dryness'] },
            { id: 'p7s2', text: 'parideva', type: 'root', tooltips: ['Crying out all around'] },
            {
              id: 'p7s3',
              text: 'ānaṁ',
              type: 'suffix',
              tooltips: ['Function: Marks the Object'],
              relation: { targetWordId: 'p8', type: 'direction', label: 'Target Of' },
            },
          ],
          senses: [
            { english: 'grief & lamentation', nuance: 'Literal' },
            { english: 'burning & crying', nuance: 'Etymological' },
          ],
        },
        {
          id: 'p8',
          wordClass: 'content',
          segments: [
            { id: 'p8s1', text: 'sam', type: 'prefix', tooltips: ['Together'] },
            { id: 'p8s2', text: 'ati', type: 'prefix', tooltips: ['Over / Beyond'] },
            { id: 'p8s3', text: 'kkam', type: 'root', tooltips: ['√kam: Stepping'] },
            { id: 'p8s4', text: 'āya', type: 'suffix', tooltips: ['Function: For the purpose of'] },
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
          wordClass: 'content',
          segments: [
            { id: 'p9s1', text: 'dukkha', type: 'root', tooltips: ['Du (Bad) + Kha (Axle space)'] },
            { id: 'p9s2', text: 'domanass', type: 'root', tooltips: ['Mental Pain (Bad Mind)'] },
            {
              id: 'p9s3',
              text: 'ānaṁ',
              type: 'suffix',
              tooltips: ['Function: Marks the Object'],
              relation: { targetWordId: 'p10', type: 'direction', label: 'Target Of' },
            },
          ],
          senses: [
            { english: 'pain & distress', nuance: 'Physical/Mental' },
            { english: 'suffering & sadness', nuance: 'Standard' },
          ],
        },
        {
          id: 'p10',
          wordClass: 'content',
          segments: [
            { id: 'p10s1', text: 'atthaṅ', type: 'root', tooltips: ['Attha: Home / Setting'] },
            { id: 'p10s2', text: 'gam', type: 'root', tooltips: ['Gama: Going'] },
            { id: 'p10s3', text: 'āya', type: 'suffix', tooltips: ['Function: For the purpose of'] },
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
          wordClass: 'content',
          segments: [
            { id: 'p11s1', text: 'ñāya', type: 'root', tooltips: ['Method / System / Truth'] },
            {
              id: 'p11s2',
              text: 'ssa',
              type: 'suffix',
              tooltips: ['Function: Marks ownership'],
              relation: { targetWordId: 'p12', type: 'ownership', label: 'Belongs To' },
            },
          ],
          senses: [
            { english: 'of the true method', nuance: 'Systematic' },
            { english: 'of the truth', nuance: 'Ultimate' },
          ],
        },
        {
          id: 'p12',
          wordClass: 'content',
          segments: [
            { id: 'p12s1', text: 'adhi', type: 'prefix', tooltips: ['Onto / Towards'] },
            { id: 'p12s2', text: 'gam', type: 'root', tooltips: ['Gama: Going'] },
            { id: 'p12s3', text: 'āya', type: 'suffix', tooltips: ['Function: For the purpose of'] },
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
          wordClass: 'content',
          segments: [
            { id: 'p13s1', text: 'nibbān', type: 'root', tooltips: ['Ni (Out) + Vana (Fire)'] },
            {
              id: 'p13s2',
              text: 'assa',
              type: 'suffix',
              tooltips: ['Function: Marks the Object'],
              relation: { targetWordId: 'p14', type: 'direction', label: 'Target Of' },
            },
          ],
          senses: [
            { english: 'of Nibbana', nuance: 'Ultimate Goal' },
            { english: 'of Unbinding', nuance: 'Freedom' },
          ],
        },
        {
          id: 'p14',
          wordClass: 'content',
          segments: [
            { id: 'p14s1', text: 'sacchi', type: 'root', tooltips: ['With eyes / Directly'] },
            { id: 'p14s2', text: 'kiriy', type: 'root', tooltips: ['Karo: Making / Doing'] },
            { id: 'p14s3', text: 'āya', type: 'suffix', tooltips: ['Function: For the purpose of'] },
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
          wordClass: 'function',
          segments: [
            { id: 'p15s1', text: 'yad', type: 'root', tooltips: ['Which'] },
            { id: 'p15s2', text: 'idaṁ', type: 'root', tooltips: ['This'] },
          ],
          senses: [{ english: 'namely', nuance: 'Identity' }],
        },
        {
          id: 'p16',
          wordClass: 'content',
          segments: [{ id: 'p16s1', text: 'cattāro', type: 'stem', tooltips: ['Four (4)'] }],
          senses: [{ english: 'the four', nuance: 'Quantity' }],
        },
        {
          id: 'p17',
          wordClass: 'content',
          segments: [
            { id: 'p17s1', text: 'sati', type: 'root', tooltips: ['Memory / Presence'] },
            { id: 'p17s2', text: 'paṭṭhānā', type: 'root', tooltips: ['Foundation / Establishing'] },
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

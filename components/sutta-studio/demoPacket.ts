import type { DeepLoomPacket } from '../../types/suttaStudio';

export const DEMO_PACKET_MN10: DeepLoomPacket = {
  packetId: 'demo-mn10',
  source: { provider: 'suttacentral', workId: 'mn10' },
  canonicalSegments: [],
  citations: [],
  progress: {
    totalPhases: 20,
    readyPhases: 20,
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
    // ============================================================
    // INTRO: Evaṁ me sutaṁ → Bhagavā etadavoca
    // ============================================================
    {
      id: 'phase-a',
      paliWords: [
        {
          id: 'a1',
          wordClass: 'function',
          segments: [
            { id: 'a1s1', text: 'Evaṁ', type: 'stem', tooltips: ['Eva: Thus / In this way', 'Indeclinable particle'] },
          ],
          senses: [{ english: 'Thus', nuance: 'Formulaic' }],
        },
        {
          id: 'a2',
          wordClass: 'function',
          segments: [
            { id: 'a2s1', text: 'me', type: 'stem', tooltips: ['"Me" — the narrator (Ānanda)', 'Marks who received the teaching'] },
          ],
          senses: [
            { english: 'by me', nuance: 'Instrumental' },
            { english: 'it was', nuance: 'Impersonal' },
          ],
        },
        {
          id: 'a3',
          wordClass: 'content',
          segments: [
            { id: 'a3s1', text: 'sut', type: 'root', tooltips: ['√su: To hear', '"Heard" — already happened'] },
            { id: 'a3s2', text: 'aṁ', type: 'suffix', tooltips: ['"The thing heard" — names what was received', 'Done and complete, not still happening'] },
          ],
          senses: [
            { english: 'heard', nuance: 'Standard' },
            { english: 'received', nuance: 'Transmitted' },
          ],
        },
      ],
      englishStructure: [
        { id: 'ea1', linkedPaliId: 'a1' },
        { id: 'ea2g', label: 'have', isGhost: true, ghostKind: 'required' },
        { id: 'ea2', linkedSegmentId: 'a2s1' },
        { id: 'ea3', linkedSegmentId: 'a3s1' },
      ],
    },
    {
      id: 'phase-b',
      paliWords: [
        {
          id: 'b1',
          wordClass: 'function',
          segments: [
            { id: 'b1s1', text: 'ekaṁ', type: 'stem', tooltips: ['Eka: One', 'Points to which occasion'] },
          ],
          senses: [{ english: 'one', nuance: 'Singular' }],
        },
        {
          id: 'b2',
          wordClass: 'content',
          segments: [
            { id: 'b2s1', text: 'sam', type: 'root', tooltips: ['√sam: To come together', 'Occasion / Meeting'] },
            { id: 'b2s2', text: 'ayaṁ', type: 'suffix', tooltips: ['Marks a point in time', '"At one time..."'] },
          ],
          senses: [
            { english: 'time', nuance: 'Occasion' },
            { english: 'occasion', nuance: 'Meeting' },
          ],
        },
        {
          id: 'b3',
          wordClass: 'content',
          segments: [
            { id: 'b3s1', text: 'Bhag', type: 'root', tooltips: ['√bhaj: To divide / Share', 'One who shares / Fortunate'] },
            { id: 'b3s2', text: 'avā', type: 'suffix', tooltips: ['The one doing the action', '-vant = "one who possesses" (fortune, blessings)'] },
          ],
          senses: [
            { english: 'the Blessed One', nuance: 'Standard' },
            { english: 'the Fortunate One', nuance: 'Good karma' },
            { english: 'the Buddha', nuance: 'Awakened' },
            { english: 'the Teacher', nuance: 'Role' },
            { english: 'the Sharer of Truth', nuance: 'Etymology: √bhaj' },
          ],
        },
      ],
      englishStructure: [
        { id: 'eb1g', label: 'At', isGhost: true, ghostKind: 'required' },
        { id: 'eb1', linkedPaliId: 'b1' },
        { id: 'eb2', linkedSegmentId: 'b2s1' },
        { id: 'eb3', linkedSegmentId: 'b3s1' },
      ],
    },
    {
      id: 'phase-c',
      paliWords: [
        {
          id: 'c1',
          wordClass: 'content',
          segments: [
            { id: 'c1s1', text: 'Kur', type: 'root', tooltips: ['Kuru: Name of a people/region', 'Ancient Indian clan'] },
            { id: 'c1s2', text: 'ūsu', type: 'suffix', tooltips: ['📍 "Among the..." — where it happened', 'Multiple people/places'] },
          ],
          senses: [
            { english: 'among the Kurus', nuance: 'Location' },
          ],
        },
        {
          id: 'c2',
          wordClass: 'content',
          segments: [
            { id: 'c2s1', text: 'vi', type: 'prefix', tooltips: ['Prefix: Apart / Special'] },
            { id: 'c2s2', text: 'har', type: 'root', tooltips: ['√hṛ: To carry / Hold', 'To dwell / Abide'] },
            { id: 'c2s3', text: 'ati', type: 'suffix', tooltips: ['He/she/it is doing this now', 'Ongoing action'] },
          ],
          senses: [
            { english: 'was dwelling', nuance: 'Residing' },
            { english: 'was staying', nuance: 'Temporary' },
            { english: 'was living', nuance: 'Abiding' },
          ],
        },
      ],
      englishStructure: [
        { id: 'ec2', linkedSegmentId: 'c2s2' },
        { id: 'ec1', linkedSegmentId: 'c1s1' },
      ],
    },
    {
      id: 'phase-d',
      paliWords: [
        {
          id: 'd1',
          wordClass: 'content',
          segments: [
            { id: 'd1s1', text: 'Kammāsa', type: 'root', tooltips: ['Spotted / Variegated / Speckled', 'Refers to King Kammāsapāda ("Speckled Foot")', 'A cannibal ogre-king in Jātaka legend'] },
            { id: 'd1s2', text: 'dhammaṁ', type: 'root', tooltips: ['DEBATE: Damma vs Dhamma', '• Damma (√dam): "Taming" - where the ogre was tamed', '• Dhamma: "Teaching" - the Kuru code of conduct', 'Both converge: taming accomplished through teaching', 'The -aṁ ending names the place'] },
          ],
          senses: [
            { english: 'Kammāsadhamma', nuance: 'Place of Taming' },
            { english: '"Where the Spotted One was Tamed"', nuance: 'Mythological' },
          ],
        },
        {
          id: 'd2',
          wordClass: 'function',
          segments: [
            { id: 'd2s1', text: 'nāma', type: 'stem', tooltips: ['Name / Called', 'Indeclinable'] },
          ],
          senses: [
            { english: 'named', nuance: 'Called' },
            { english: 'by name', nuance: 'Identity' },
          ],
        },
        {
          id: 'd3',
          wordClass: 'content',
          segments: [
            { id: 'd3s1', text: 'Kur', type: 'root', tooltips: ['Kuru: The people'] },
            { id: 'd3s2', text: 'ūnaṁ', type: 'suffix', tooltips: ['🔗 "Of the..." — belonging to the Kurus', 'Their town, their territory'] },
          ],
          senses: [
            { english: 'of the Kurus', nuance: 'Possession' },
          ],
        },
        {
          id: 'd4',
          wordClass: 'content',
          segments: [
            { id: 'd4s1', text: 'ni', type: 'prefix', tooltips: ['Down / Settled'] },
            { id: 'd4s2', text: 'gam', type: 'root', tooltips: ['√gam: To go', 'Settlement / Town'] },
            { id: 'd4s3', text: 'o', type: 'suffix', tooltips: ['The subject — "a town"'] },
          ],
          senses: [
            { english: 'a market town', nuance: 'Settlement' },
            { english: 'a town', nuance: 'Standard' },
          ],
        },
      ],
      englishStructure: [
        { id: 'ed1g', label: 'at', isGhost: true, ghostKind: 'required' },
        { id: 'ed4', linkedSegmentId: 'd4s2' },
        { id: 'ed3', linkedSegmentId: 'd3s1' },
        { id: 'ed2', linkedPaliId: 'd2' },
        { id: 'ed1', linkedPaliId: 'd1' },
      ],
    },
    {
      id: 'phase-e',
      paliWords: [
        {
          id: 'e1',
          wordClass: 'function',
          segments: [
            { id: 'e1s1', text: 'Tatra', type: 'stem', tooltips: ['There / In that place', '📍 Points to a location'] },
          ],
          senses: [{ english: 'There', nuance: 'Location' }],
        },
        {
          id: 'e2',
          wordClass: 'function',
          segments: [
            { id: 'e2s1', text: 'kho', type: 'stem', tooltips: ['Indeed / Emphatic particle', 'Khalu → kho'] },
          ],
          senses: [
            { english: 'indeed', nuance: 'Emphasis' },
            { english: '', nuance: 'Often untranslated' },
          ],
        },
        {
          id: 'e3',
          wordClass: 'content',
          segments: [
            { id: 'e3s1', text: 'Bhag', type: 'root', tooltips: ['√bhaj: To divide / Share'] },
            { id: 'e3s2', text: 'avā', type: 'suffix', tooltips: ['The one doing the action'] },
          ],
          senses: [{ english: 'the Blessed One', nuance: 'Subject' }],
        },
        {
          id: 'e4',
          wordClass: 'content',
          segments: [
            { id: 'e4s1', text: 'bhikkh', type: 'root', tooltips: ['√bhikkh: To beg / Share'] },
            { id: 'e4s2', text: 'ū', type: 'suffix', tooltips: ['👥 Them — the group being addressed', 'The ones receiving the teaching'] },
          ],
          senses: [
            { english: 'the bhikkhus', nuance: 'Object' },
            { english: 'the monks', nuance: 'Standard' },
          ],
        },
        {
          id: 'e5',
          wordClass: 'content',
          segments: [
            { id: 'e5s1', text: 'ā', type: 'prefix', tooltips: ['Ā: Towards / Intensifier', 'Augment coalesces with prefix (a + ā → ā)'] },
            { id: 'e5s2', text: 'mant', type: 'root', tooltips: ['√mant (Skt mantr): To counsel / Advise', 'Source of "mantra" (counsel/spell)', 'Causative/Class X stem implies deliberate initiation'] },
            { id: 'e5s3', text: 'esi', type: 'suffix', tooltips: ['Sigmatic Aorist: -e- (caus.) + -s- + -i', 'Pattern: deseti→desesi, katheti→kathesi'] },
          ],
          senses: [
            { english: 'addressed', nuance: 'Formally invited' },
            { english: 'counseled', nuance: 'Initiated teaching' },
            { english: 'called to', nuance: 'Summoned attention' },
          ],
        },
      ],
      englishStructure: [
        { id: 'ee1', linkedPaliId: 'e1' },
        { id: 'ee3', linkedSegmentId: 'e3s1' },
        { id: 'ee5', linkedSegmentId: 'e5s2' },
        { id: 'ee4', linkedSegmentId: 'e4s1' },
      ],
    },
    {
      id: 'phase-f',
      paliWords: [
        {
          id: 'f1',
          wordClass: 'content',
          segments: [
            { id: 'f1s1', text: 'Bhikkh', type: 'root', tooltips: ['√bhikkh: To share / beg'] },
            { id: 'f1s2', text: 'avo', type: 'suffix', tooltips: ['📢 "Hey you all!" — calling out to a group', 'Like saying "O monks!"'] },
          ],
          senses: [
            { english: 'Bhikkhus!', nuance: 'Call' },
            { english: 'Monks!', nuance: 'Standard' },
          ],
        },
        {
          id: 'f2',
          wordClass: 'function',
          segments: [
            { id: 'f2s1', text: 'ti', type: 'stem', tooltips: ['Iti: Quotation marker', 'End of speech'] },
          ],
          senses: [{ english: '"', nuance: 'Quote marker' }],
        },
      ],
      englishStructure: [
        { id: 'ef1', linkedSegmentId: 'f1s1' },
      ],
    },
    {
      id: 'phase-g',
      paliWords: [
        {
          id: 'g1',
          wordClass: 'content',
          segments: [
            { id: 'g1s1', text: 'Bhad', type: 'root', tooltips: ['Bhadra: Good / Auspicious'] },
            { id: 'g1s2', text: 'ante', type: 'suffix', tooltips: ['📢 "O Sir!" — respectfully calling one person', 'Like bowing while addressing'] },
          ],
          senses: [
            { english: 'Venerable sir', nuance: 'Respectful' },
            { english: 'Lord', nuance: 'Formal' },
          ],
        },
        {
          id: 'g2',
          wordClass: 'function',
          segments: [
            { id: 'g2s1', text: 'ti', type: 'stem', tooltips: ['Iti: Quotation marker'] },
          ],
          senses: [{ english: '"', nuance: 'Quote end' }],
        },
        {
          id: 'g3',
          wordClass: 'function',
          segments: [
            { id: 'g3s1', text: 'te', type: 'stem', tooltips: ['Those / They', 'The ones doing the action'] },
          ],
          senses: [{ english: 'those', nuance: 'Demonstrative' }],
        },
        {
          id: 'g4',
          wordClass: 'content',
          segments: [
            { id: 'g4s1', text: 'bhikkh', type: 'root', tooltips: ['√bhikkh: To share'] },
            { id: 'g4s2', text: 'ū', type: 'suffix', tooltips: ['👥 They — the group doing the action', 'The bhikkhus who replied'] },
          ],
          senses: [{ english: 'bhikkhus', nuance: 'Subject' }],
        },
        {
          id: 'g5',
          wordClass: 'content',
          segments: [
            { id: 'g5s1', text: 'Bhag', type: 'root', tooltips: ['The Blessed One'] },
            { id: 'g5s2', text: 'avato', type: 'suffix', tooltips: ['🎯 "To him" — receiving the reply', 'The one being addressed'] },
          ],
          senses: [
            { english: 'to the Blessed One', nuance: 'Dative' },
          ],
        },
        {
          id: 'g6',
          wordClass: 'content',
          segments: [
            { id: 'g6s1', text: 'pacc', type: 'prefix', tooltips: ['Paṭi → Pacc (sandhi: paṭi + a-augment → paty-a → pacc-a)', 'Back / In return / Towards'] },
            { id: 'g6s2', text: 'assosuṁ', type: 'root', tooltips: ['√su (Skt √śru): To hear', 'Sigmatic Aorist: su → so (guṇa) + s-marker', 'Geminated -ss- preserves weight of Skt śr cluster', 'Paṭi-su = "to hear back" → reply/assent'] },
          ],
          senses: [
            { english: 'replied', nuance: 'Responded' },
            { english: 'answered', nuance: 'Assented' },
            { english: 'heard back', nuance: 'Etymological' },
          ],
        },
      ],
      englishStructure: [
        { id: 'eg1', linkedSegmentId: 'g1s1' },
        { id: 'eg4', linkedSegmentId: 'g4s1' },
        { id: 'eg6', linkedSegmentId: 'g6s2' },
        { id: 'eg5g', label: 'to', isGhost: true, ghostKind: 'required' },
        { id: 'eg5', linkedSegmentId: 'g5s1' },
      ],
    },
    {
      id: 'phase-h',
      paliWords: [
        {
          id: 'h1',
          wordClass: 'content',
          segments: [
            { id: 'h1s1', text: 'Bhag', type: 'root', tooltips: ['The Blessed One'] },
            { id: 'h1s2', text: 'avā', type: 'suffix', tooltips: ['The one speaking'] },
          ],
          senses: [{ english: 'The Blessed One', nuance: 'Subject' }],
        },
        {
          id: 'h2',
          wordClass: 'function',
          segments: [
            { id: 'h2s1', text: 'etad', type: 'stem', tooltips: ['Eta: This', 'What was said — the teaching'] },
          ],
          senses: [{ english: 'this', nuance: 'Object' }],
        },
        {
          id: 'h3',
          wordClass: 'content',
          segments: [
            { id: 'h3s1', text: 'a', type: 'prefix', tooltips: ['Aorist prefix'] },
            { id: 'h3s2', text: 'voc', type: 'root', tooltips: ['√vac: To speak / Say'] },
            { id: 'h3s3', text: 'a', type: 'suffix', tooltips: ['He spoke (past, completed)'] },
          ],
          senses: [
            { english: 'said', nuance: 'Spoke' },
            { english: 'declared', nuance: 'Formal' },
          ],
        },
      ],
      englishStructure: [
        { id: 'eh1', linkedSegmentId: 'h1s1' },
        { id: 'eh3', linkedSegmentId: 'h3s2' },
        { id: 'eh2', linkedPaliId: 'h2' },
      ],
    },

    // ============================================================
    // MAIN DECLARATION: Ekāyano ayaṁ... satipaṭṭhānā (existing phases 1-7)
    // ============================================================
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
            { english: 'direct', nuance: 'No detours', ripples: { ghost1: 'is the' } },
            { english: 'one-way', nuance: 'Single track', ripples: { ghost1: 'is the' } },
            { english: 'solitary', nuance: 'Walk alone', ripples: { ghost1: 'is a' } },
            { english: 'convergent', nuance: 'All paths merge here', ripples: { ghost1: 'is the point of' } },
            { english: 'only', nuance: 'No alternative', ripples: { ghost1: 'is the' } },
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
            { id: 'p3s2', text: 'ave', type: 'suffix', tooltips: ['📢 "Hey friends!" — calling out to the group'] },
          ],
          senses: [
            { english: 'Mendicants,', nuance: 'Those who beg' },
            { english: 'Monks,', nuance: 'Standard' },
            { english: 'Sharers,', nuance: 'Those who share the path' },
            { english: 'Seekers,', nuance: 'Those who see danger' },
            { english: 'Friends,', nuance: 'Intimate' },
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
        { id: 'e1', linkedSegmentId: 'p3s1' },
        { id: 'e2', linkedSegmentId: 'p2s1' },
        { id: 'ghost1', label: 'is the', isGhost: true, ghostKind: 'required' },
        { id: 'e3', linkedSegmentId: 'p1s1' },
        { id: 'e4', linkedSegmentId: 'p4s1' },
      ],
    },
    {
      id: 'phase-2',
      paliWords: [
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
            { english: 'purification', nuance: 'Cleaning out' },
            { english: 'clarity', nuance: 'Seeing clearly' },
            { english: 'cleansing', nuance: 'Washing away' },
            { english: 'brightening', nuance: 'Light emerging' },
            { english: 'refinement', nuance: 'Polishing' },
          ],
        },
      ],
      englishStructure: [
        { id: 'g1', label: 'for the', isGhost: true, ghostKind: 'required' },
        { id: 'e5', linkedSegmentId: 'p6s2' },
        { id: 'g2', label: 'of', isGhost: true, ghostKind: 'required' },
        { id: 'e6', linkedSegmentId: 'p5s1' },
      ],
    },
    {
      id: 'phase-3',
      layoutBlocks: [['p7', 'p8']],
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
            { english: 'surmounting', nuance: 'Climbing over' },
            { english: 'transcending', nuance: 'Going beyond' },
            { english: 'overcoming', nuance: 'Getting past' },
            { english: 'crossing over', nuance: 'To the other shore' },
            { english: 'leaving behind', nuance: 'Moving on' },
          ],
        },
      ],
      englishStructure: [
        { id: 'g1', label: 'for the', isGhost: true, ghostKind: 'required' },
        { id: 'e7', linkedSegmentId: 'p8s3' },
        { id: 'g2', label: 'of', isGhost: true, ghostKind: 'required' },
        { id: 'e8', linkedSegmentId: 'p7s1' },
      ],
    },
    {
      id: 'phase-4',
      layoutBlocks: [['p9', 'p10']],
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
        { id: 'e9', linkedSegmentId: 'p10s1' },
        { id: 'g2', label: 'of', isGhost: true, ghostKind: 'required' },
        { id: 'e10', linkedSegmentId: 'p9s1' },
      ],
    },
    {
      id: 'phase-5',
      layoutBlocks: [['p11', 'p12']],
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
        { id: 'e11', linkedSegmentId: 'p12s2' },
        { id: 'e12', linkedSegmentId: 'p11s1' },
      ],
    },
    {
      id: 'phase-6',
      layoutBlocks: [['p13', 'p14']],
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
            { english: 'of Nibbana', nuance: 'The goal' },
            { english: 'of Unbinding', nuance: 'Freedom from' },
            { english: 'of extinguishing', nuance: 'Fire going out' },
            { english: 'of cooling', nuance: 'Peace' },
            { english: 'of liberation', nuance: 'Release' },
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
            { english: 'direct experience', nuance: 'First-hand' },
            { english: 'making visible', nuance: 'With own eyes' },
            { english: 'touching', nuance: 'Personal contact' },
          ],
        },
      ],
      englishStructure: [
        { id: 'g1', label: 'for the', isGhost: true, ghostKind: 'required' },
        { id: 'e13', linkedSegmentId: 'p14s1' },
        { id: 'e14', linkedSegmentId: 'p13s1' },
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
            { id: 'p17s1', text: 'sati', type: 'root', tooltips: ['√smṛ: Memory / Presence'] },
            { id: 'p17s2', text: 'paṭṭhānā', type: 'root', tooltips: ['Paṭi + √sthā: Establishing / Foundation'] },
          ],
          senses: [
            { english: 'foundations of mindfulness', nuance: 'Standard translation' },
            { english: 'establishments of awareness', nuance: 'Active placing' },
            { english: 'presencings of remembering', nuance: 'Memory aspect' },
            { english: 'ways of keeping present', nuance: 'Practice-oriented' },
            { english: 'lucid abodes', nuance: 'Clarity emphasis' },
          ],
        },
      ],
      englishStructure: [
        { id: 'e15', linkedPaliId: 'p15' },
        { id: 'e16', linkedSegmentId: 'p16s1' },
        { id: 'e17', linkedPaliId: 'p17' },
      ],
    },

    // ============================================================
    // CONCLUSION: Katame cattāro? ... abhijjhādomanassaṁ
    // ============================================================
    {
      id: 'phase-x',
      paliWords: [
        {
          id: 'x1',
          wordClass: 'function',
          segments: [
            { id: 'x1s1', text: 'Kat', type: 'root', tooltips: ['Ka: Interrogative stem'] },
            { id: 'x1s2', text: 'ame', type: 'suffix', tooltips: ['❓ "Which ones?" — asking about a group'] },
          ],
          senses: [
            { english: 'What', nuance: 'Interrogative' },
            { english: 'Which', nuance: 'Specific' },
          ],
        },
        {
          id: 'x2',
          wordClass: 'content',
          segments: [
            { id: 'x2s1', text: 'cattāro', type: 'stem', tooltips: ['Four (4)', 'The four things being named'] },
          ],
          senses: [{ english: 'four', nuance: 'Number' }],
        },
      ],
      englishStructure: [
        { id: 'ex1', linkedSegmentId: 'x1s1' },
        { id: 'ex1g', label: 'are the', isGhost: true, ghostKind: 'required' },
        { id: 'ex2', linkedPaliId: 'x2' },
      ],
    },
    {
      id: 'phase-y',
      paliWords: [
        {
          id: 'y1',
          wordClass: 'function',
          segments: [
            { id: 'y1s1', text: 'Idha', type: 'stem', tooltips: ['Here / In this teaching', '📍 Sets the context'] },
          ],
          senses: [
            { english: 'Here', nuance: 'In this teaching' },
            { english: 'In this case', nuance: 'Context' },
          ],
        },
        {
          id: 'y2',
          wordClass: 'content',
          segments: [
            { id: 'y2s1', text: 'bhikkh', type: 'root', tooltips: ['√bhikkh: To share'] },
            { id: 'y2s2', text: 'ave', type: 'suffix', tooltips: ['📢 Calling out to the group'] },
          ],
          senses: [{ english: 'bhikkhus', nuance: 'Address' }],
        },
        {
          id: 'y3',
          wordClass: 'content',
          segments: [
            { id: 'y3s1', text: 'bhikkh', type: 'root', tooltips: ['√bhikkh: To share'] },
            { id: 'y3s2', text: 'u', type: 'suffix', tooltips: ['One person — "a bhikkhu"', 'The practitioner being described'] },
          ],
          senses: [
            { english: 'a bhikkhu', nuance: 'Subject' },
            { english: 'a practitioner', nuance: 'Generic' },
          ],
        },
      ],
      englishStructure: [
        { id: 'ey1', linkedPaliId: 'y1' },
        { id: 'ey2', linkedSegmentId: 'y2s1' },
        { id: 'ey3', linkedSegmentId: 'y3s1' },
      ],
    },
    {
      id: 'phase-z',
      paliWords: [
        {
          id: 'z1',
          wordClass: 'content',
          segments: [
            { id: 'z1s1', text: 'kāy', type: 'root', tooltips: ['Kāya: Body / Collection / Heap'] },
            { id: 'z1s2', text: 'e', type: 'suffix', tooltips: ['📍 "In the..." — where attention rests', '"Body in body" = seeing body AS body', '• Not as "mine" or "self"', '• Not mixed with feelings or thoughts', '• Just the raw phenomenon'] },
          ],
          senses: [
            { english: 'in the body', nuance: 'Physical form' },
            { english: 'in this heap', nuance: 'Collection of parts' },
            { english: 'in this mass', nuance: 'Aggregate' },
            { english: 'body as body', nuance: 'Just phenomena' },
            { english: 'in what\'s assembled', nuance: 'Not-self view' },
          ],
        },
        {
          id: 'z2',
          wordClass: 'content',
          segments: [
            { id: 'z2s1', text: 'kāy', type: 'root', tooltips: ['Kāya: Body / Collection', 'Object of observation'] },
            { id: 'z2s2', text: 'ānu', type: 'prefix', tooltips: ['Anu: Along / Repeatedly / Closely', 'Implies sustained, close observation'] },
            { id: 'z2s3', text: 'pass', type: 'root', tooltips: ['√dṛś (Pali √pass): To see', 'Anupassati = observe repeatedly/closely'] },
            { id: 'z2s4', text: 'ī', type: 'suffix', tooltips: ['-ī = "one who does this"', 'Not just doing it now — it\'s who you ARE', 'Identity shift: you become an observer', '"One whose nature is body-observing"'] },
          ],
          senses: [
            { english: 'observing body', nuance: 'Action' },
            { english: 'a body-watcher', nuance: 'Identity' },
            { english: 'contemplating form', nuance: 'Sustained attention' },
            { english: 'tracking the physical', nuance: 'Following closely' },
            { english: 'seeing body as body', nuance: 'Phenomenological' },
          ],
        },
        {
          id: 'z3',
          wordClass: 'content',
          segments: [
            { id: 'z3s1', text: 'vi', type: 'prefix', tooltips: ['Apart / Special'] },
            { id: 'z3s2', text: 'har', type: 'root', tooltips: ['√hṛ: To carry / Dwell'] },
            { id: 'z3s3', text: 'ati', type: 'suffix', tooltips: ['He/she is doing this now'] },
          ],
          senses: [
            { english: 'dwells', nuance: 'Lives this way' },
            { english: 'abides', nuance: 'Rests here' },
            { english: 'remains', nuance: 'Stays put' },
            { english: 'lives', nuance: 'Way of being' },
            { english: 'keeps at it', nuance: 'Continuous practice' },
          ],
        },
      ],
      englishStructure: [
        { id: 'ez3', linkedSegmentId: 'z3s2' },
        { id: 'ez2', linkedPaliId: 'z2' },
        { id: 'ez1', linkedSegmentId: 'z1s1' },
      ],
    },
    {
      id: 'phase-aa',
      paliWords: [
        {
          id: 'aa1',
          wordClass: 'content',
          segments: [
            { id: 'aa1s1', text: 'ātāp', type: 'root', tooltips: ['√tap: To burn / Heat', 'Ardor / Energy'] },
            { id: 'aa1s2', text: 'ī', type: 'suffix', tooltips: ['Possessive: One who has...'] },
          ],
          senses: [
            { english: 'ardent', nuance: 'On fire' },
            { english: 'diligent', nuance: 'Steady effort' },
            { english: 'burning', nuance: 'Heat of practice' },
            { english: 'keen', nuance: 'Sharp attention' },
            { english: 'wholehearted', nuance: 'Full commitment' },
          ],
        },
        {
          id: 'aa2',
          wordClass: 'content',
          segments: [
            { id: 'aa2s1', text: 'sam', type: 'prefix', tooltips: ['Sam: Together / Completely / Thoroughly'] },
            { id: 'aa2s2', text: 'pa', type: 'prefix', tooltips: ['Pa/Pra: Forth / Forward / Fully'] },
            { id: 'aa2s3', text: 'jān', type: 'root', tooltips: ['√jñā (Pali √ñā): To know', 'Sampajañña = clear comprehension', 'Knowing the purpose, suitability, domain, reality'] },
            { id: 'aa2s4', text: 'o', type: 'suffix', tooltips: ['The one doing this — describes the practitioner', 'Quality of thorough knowing'] },
          ],
          senses: [
            { english: 'clearly knowing', nuance: 'Full awareness' },
            { english: 'understanding', nuance: 'Wisdom' },
            { english: 'alert', nuance: 'Sharp' },
            { english: 'discerning', nuance: 'Seeing clearly' },
            { english: 'fully aware', nuance: 'Nothing missed' },
          ],
        },
        {
          id: 'aa3',
          wordClass: 'content',
          segments: [
            { id: 'aa3s1', text: 'sati', type: 'root', tooltips: ['√smṛ (Pali sar): Memory / Mindfulness', 'The faculty of retention and presence'] },
            { id: 'aa3s2', text: 'mā', type: 'suffix', tooltips: ['-mant/-vant: Possessive suffix (Nom. -mā)', 'FACULTY: "equipped with" / "possessing"', 'Contrast with sato (actively mindful)', 'Satimā = having the capacity', 'Sato = deploying it actively'] },
          ],
          senses: [
            { english: 'mindful', nuance: 'Standard' },
            { english: 'remembering', nuance: 'Memory root' },
            { english: 'present', nuance: 'Here-now' },
            { english: 'lucid', nuance: 'Clear-minded' },
            { english: 'recollected', nuance: 'Gathered attention' },
          ],
        },
      ],
      englishStructure: [
        { id: 'eaa1', linkedSegmentId: 'aa1s1' },
        { id: 'eaa2', linkedSegmentId: 'aa2s3' },
        { id: 'eaa3', linkedSegmentId: 'aa3s1' },
      ],
    },
    {
      id: 'phase-ab',
      paliWords: [
        {
          id: 'ab1',
          wordClass: 'content',
          segments: [
            { id: 'ab1s1', text: 'vi', type: 'prefix', tooltips: ['Vi: Away / Out / Apart', 'Vineti = to lead away, remove, train'] },
            { id: 'ab1s2', text: 'ney', type: 'root', tooltips: ['√nī: To lead (vi-nī = lead away)', 'Present stem vine- influences form'] },
            { id: 'ab1s3', text: 'ya', type: 'suffix', tooltips: ['⚡ THIS CHANGES EVERYTHING:', '"Having removed" vs "Removing" vs "So as to remove"', '• "Already removed" → practice requires purity first', '• "Removing" → observation IS the removing', '• "So as to remove" → this is the purpose', '✓ Consensus: observation itself removes', 'You don\'t purify then practice — practice IS purification'] },
          ],
          senses: [
            { english: 'putting aside', nuance: 'Gentle' },
            { english: 'removing', nuance: 'Active' },
            { english: 'letting go of', nuance: 'Release' },
            { english: 'training away', nuance: 'Gradual' },
            { english: 'freeing from', nuance: 'Liberation' },
          ],
        },
        {
          id: 'ab2',
          wordClass: 'content',
          segments: [
            { id: 'ab2s1', text: 'lok', type: 'root', tooltips: ['Loka: World / Realm'] },
            { id: 'ab2s2', text: 'e', type: 'suffix', tooltips: ['📍 "In/regarding the..." — scope of action', 'What the removing applies to'] },
          ],
          senses: [
            { english: 'regarding the world', nuance: 'Scope' },
            { english: 'in the world', nuance: 'Location' },
          ],
        },
        {
          id: 'ab3',
          wordClass: 'content',
          segments: [
            { id: 'ab3s1', text: 'abhi', type: 'prefix', tooltips: ['Abhi: Towards / Intensely'] },
            { id: 'ab3s2', text: 'jjhā', type: 'root', tooltips: ['√jhā (related to √dhyai): Longing / Covetousness'] },
            { id: 'ab3s3', text: 'domanass', type: 'root', tooltips: ['Du + Manas: Bad-mind / Displeasure'] },
            { id: 'ab3s4', text: 'aṁ', type: 'suffix', tooltips: ['The thing being removed', 'Target of the "leading away"'] },
          ],
          senses: [
            { english: 'covetousness & displeasure', nuance: 'Compound' },
            { english: 'longing & aversion', nuance: 'Technical' },
          ],
        },
      ],
      englishStructure: [
        { id: 'eab1', linkedSegmentId: 'ab1s2' },
        { id: 'eab3', linkedPaliId: 'ab3' },
        { id: 'eab2g', label: 'regarding', isGhost: true, ghostKind: 'required' },
        { id: 'eab2', linkedSegmentId: 'ab2s1' },
      ],
    },
  ],
};

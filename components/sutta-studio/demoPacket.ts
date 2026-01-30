import type { DeepLoomPacket } from '../../types/suttaStudio';

export const DEMO_PACKET_MN10: DeepLoomPacket = {
  packetId: 'demo-mn10',
  source: { provider: 'suttacentral', workId: 'mn10' },
  canonicalSegments: [],
  citations: [],
  progress: {
    totalPhases: 39,
    readyPhases: 39,
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
            { id: 'a1s1', text: 'Evaṁ', type: 'stem', tooltips: ['📜 "Thus" / "In this way"', 'Indeclinable — never changes form'] },
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
            { id: 'a3s1', text: 'sut', type: 'root', tooltips: ['👂 √su: To hear', '"Heard" — already happened'] },
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
          refrainId: 'bhagava',
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
            { id: 'c2s1', text: 'vi', type: 'prefix', tooltips: ['Apart / Special'] },
            { id: 'c2s2', text: 'har', type: 'root', tooltips: ['🏠 √hṛ: To carry / Hold', 'To dwell / Abide'] },
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
            { id: 'd1s2', text: 'dhammaṁ', type: 'root', tooltips: ['⚖️ Damma or Dhamma?', '• Damma = "Taming" — where the ogre was tamed', '• Dhamma = "Teaching" — the Kuru way', 'Both work: taming through teaching'] },
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
            { id: 'd2s1', text: 'nāma', type: 'stem', tooltips: ['🏷️ "Named" / "Called"', 'Indeclinable — never changes form'] },
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
          refrainId: 'bhagava',
          segments: [
            { id: 'e3s1', text: 'Bhag', type: 'root', tooltips: ['√bhaj: To divide / Share'] },
            { id: 'e3s2', text: 'avā', type: 'suffix', tooltips: ['The one doing the action'] },
          ],
          senses: [{ english: 'the Blessed One', nuance: 'Subject' }],
        },
        {
          id: 'e4',
          wordClass: 'content',
          refrainId: 'bhikkhu',
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
            { id: 'e5s3', text: 'esi', type: 'suffix', tooltips: ['⏮️ Past tense — "he addressed"', 'The -s- sound marks completed action'] },
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
          refrainId: 'bhikkhu',
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
          refrainId: 'bhikkhu',
          segments: [
            { id: 'g4s1', text: 'bhikkh', type: 'root', tooltips: ['√bhikkh: To share'] },
            { id: 'g4s2', text: 'ū', type: 'suffix', tooltips: ['👥 They — the group doing the action', 'The bhikkhus who replied'] },
          ],
          senses: [{ english: 'bhikkhus', nuance: 'Subject' }],
        },
        {
          id: 'g5',
          wordClass: 'content',
          refrainId: 'bhagava',
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
            { id: 'g6s2', text: 'assosuṁ', type: 'root', tooltips: ['👂 √su: To hear', '⏮️ Past tense — "they replied"', 'Double -ss- from older Sanskrit sound', 'Paṭi + su = "hear back" → reply'] },
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
          refrainId: 'bhagava',
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
            { id: 'h3s1', text: 'a', type: 'prefix', tooltips: ['Marks past tense'] },
            { id: 'h3s2', text: 'voc', type: 'root', tooltips: ['🗣️ √vac: To speak / Say'] },
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
          refrainId: 'bhikkhu',
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
              tooltips: ['🔗 Shows who it belongs to'],
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
            { id: 'p6s2', text: 'suddhi', type: 'root', tooltips: ['✨ √sudh: Purity'] },
            { id: 'p6s3', text: 'yā', type: 'suffix', tooltips: ['🎯 "For the sake of..."'] },
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
            { id: 'p7s1', text: 'soka', type: 'root', tooltips: ['😢 √suc: Burning / Dryness'] },
            { id: 'p7s2', text: 'parideva', type: 'root', tooltips: ['😭 Crying out all around'] },
            {
              id: 'p7s3',
              text: 'ānaṁ',
              type: 'suffix',
              tooltips: ['🎯 Points to the target'],
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
            { id: 'p8s3', text: 'kkam', type: 'root', tooltips: ['🌊 √kam: Stepping / Crossing over'] },
            { id: 'p8s4', text: 'āya', type: 'suffix', tooltips: ['🎯 "For the sake of..."'] },
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
              tooltips: ['🎯 Points to the target'],
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
            { id: 'p10s3', text: 'āya', type: 'suffix', tooltips: ['🎯 "For the sake of..."'] },
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
              tooltips: ['🔗 Shows whose it is'],
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
            { id: 'p12s3', text: 'āya', type: 'suffix', tooltips: ['🎯 "For the sake of..."'] },
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
            { id: 'p13s1', text: 'nibbān', type: 'root', tooltips: ['🕯️ Ni (Out) + Vāna (Blowing)', 'Fire going out / Cooling'] },
            {
              id: 'p13s2',
              text: 'assa',
              type: 'suffix',
              tooltips: ['🎯 Points to the target'],
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
            { id: 'p14s1', text: 'sacchi', type: 'root', tooltips: ['👀 With own eyes / Directly'] },
            { id: 'p14s2', text: 'kiriy', type: 'root', tooltips: ['Karo: Making / Doing'] },
            { id: 'p14s3', text: 'āya', type: 'suffix', tooltips: ['🎯 "For the sake of..."'] },
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
            { id: 'p17s1', text: 'sati', type: 'root', tooltips: ['💭 √smṛ: Memory / Presence'] },
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
          refrainId: 'bhikkhu',
          segments: [
            { id: 'y2s1', text: 'bhikkh', type: 'root', tooltips: ['√bhikkh: To share'] },
            { id: 'y2s2', text: 'ave', type: 'suffix', tooltips: ['📢 Calling out to the group'] },
          ],
          senses: [{ english: 'bhikkhus', nuance: 'Address' }],
        },
        {
          id: 'y3',
          wordClass: 'content',
          refrainId: 'bhikkhu',
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
            { id: 'z2s3', text: 'pass', type: 'root', tooltips: ['👁️ √dṛś (Pali √pass): To see', 'Anupassati = observe repeatedly/closely'] },
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
            { id: 'z3s2', text: 'har', type: 'root', tooltips: ['🏠 √hṛ: To carry / Dwell'] },
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
          refrainId: 'formula-ardent',
          segments: [
            { id: 'aa1s1', text: 'ātāp', type: 'root', tooltips: ['🔥 √tap: To burn / Heat', 'Vedic tapas = ascetic heat', 'Buddhist inversion:', '• Not self-mortification', '• But burning of defilements', '= Right Effort (sammā-vāyāma)', 'The "fuel" of the practice'] },
            { id: 'aa1s2', text: 'ī', type: 'suffix', tooltips: ['Possessive: One who has ardor', 'Prevents sinking into lethargy'] },
          ],
          senses: [
            { english: 'ardent', nuance: 'Burning effort' },
            { english: 'with heat', nuance: 'Transformative fire' },
            { english: 'diligent', nuance: 'Steady energy' },
            { english: 'keen', nuance: 'Sharp attention' },
          ],
        },
        {
          id: 'aa2',
          wordClass: 'content',
          refrainId: 'formula-ardent',
          segments: [
            { id: 'aa2s1', text: 'sam', type: 'prefix', tooltips: ['Sam: Together / Completely'] },
            { id: 'aa2s2', text: 'pa', type: 'prefix', tooltips: ['Pa/Pra: Forth / Forward'] },
            { id: 'aa2s3', text: 'jān', type: 'root', tooltips: ['🧠 √jñā: To know', 'Sampajañña = Clear Comprehension', '📚 Four types (Visuddhimagga):', '1. Sātthaka: Purpose — is this beneficial?', '2. Sappāya: Suitability — right time/place?', '3. Gocara: Domain — not losing the object', '4. Asammoha: Non-delusion — seeing anattā'] },
            { id: 'aa2s4', text: 'o', type: 'suffix', tooltips: ['One who thoroughly knows', 'The wisdom aspect of the triad'] },
          ],
          senses: [
            { english: 'clearly knowing', nuance: 'Full awareness' },
            { english: 'with clear comprehension', nuance: 'Four types' },
            { english: 'discerning', nuance: 'Purpose-aware' },
            { english: 'fully aware', nuance: 'Context-aware' },
          ],
        },
        {
          id: 'aa3',
          wordClass: 'content',
          refrainId: 'formula-ardent',
          segments: [
            { id: 'aa3s1', text: 'sati', type: 'root', tooltips: ['💭 √smṛ: To remember', 'Sati = mindfulness / presence / retention', 'The "holding" function of mind'] },
            { id: 'aa3s2', text: 'mā', type: 'suffix', tooltips: ['-mant: Possessive suffix', '📝 Key distinction:', '• Satimā = POSSESSING the faculty', '  (foundational disposition)', '• Sato = APPLYING it moment-to-moment', '  (e.g., "sato va assasati")', 'Here: establishing the capacity'] },
          ],
          senses: [
            { english: 'possessing mindfulness', nuance: 'Faculty' },
            { english: 'mindful', nuance: 'Standard' },
            { english: 'equipped with awareness', nuance: 'Capacity' },
            { english: 'recollected', nuance: 'Gathered' },
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
          refrainId: 'formula-removing',
          segments: [
            { id: 'ab1s1', text: 'vi', type: 'prefix', tooltips: ['Vi: Away / Out / Apart', 'Same root as VINAYA (discipline)'] },
            { id: 'ab1s2', text: 'ney', type: 'root', tooltips: ['√nī: To lead (vi-nī = lead away)', 'Vineti = to discipline, remove, train'] },
            { id: 'ab1s3', text: 'ya', type: 'suffix', tooltips: ['⚖️ THE GREAT DEBATE:', '• "Having removed" (sequential):', '  → First jhāna, then insight', '  → Samatha-first approach', '• "While removing" (simultaneous):', '  → Mindfulness IS the removing', '  → Dry insight approach', '⚡ Both readings are grammatically valid'] },
          ],
          senses: [
            { english: 'putting aside', nuance: 'Simultaneous view' },
            { english: 'having removed', nuance: 'Sequential view' },
            { english: 'disciplining', nuance: 'Vinaya connection' },
            { english: 'training away', nuance: 'Gradual' },
            { english: 'freeing from', nuance: 'Liberation' },
          ],
        },
        {
          id: 'ab2',
          wordClass: 'content',
          refrainId: 'formula-removing',
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
          refrainId: 'formula-removing',
          segments: [
            { id: 'ab3s1', text: 'abhi', type: 'prefix', tooltips: ['Abhi: Towards / Intensely'] },
            { id: 'ab3s2', text: 'jjhā', type: 'root', tooltips: ['√jhā (√dhyai): Longing / Covetousness', '= First Hindrance (kāmacchanda)'] },
            { id: 'ab3s3', text: 'domanass', type: 'root', tooltips: ['Du + Manas: Bad-mind / Displeasure', '= Second Hindrance (byāpāda/ill-will)'] },
            { id: 'ab3s4', text: 'aṁ', type: 'suffix', tooltips: ['📝 SYNECDOCHE:', 'These two stand for ALL FIVE Hindrances:', '1. Sensory desire (abhijjhā)', '2. Ill-will (domanassa)', '3. Sloth & torpor', '4. Restlessness & remorse', '5. Doubt'] },
          ],
          senses: [
            { english: 'covetousness & displeasure', nuance: 'Literal pair' },
            { english: 'the five hindrances', nuance: 'Synecdoche' },
            { english: 'wanting & not-wanting', nuance: 'Craving poles' },
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

    // ============================================================
    // SECOND SATIPAṬṬHĀNA: Vedanānupassanā (mn10:3.3)
    // vedanāsu vedanānupassī viharati ātāpī sampajāno satimā,
    // vineyya loke abhijjhādomanassaṁ
    // ============================================================
    {
      id: 'phase-ac',
      paliWords: [
        {
          id: 'ac1',
          wordClass: 'content',
          segments: [
            { id: 'ac1s1', text: 'vedan', type: 'root', tooltips: ['💫 √vid: To know (same root as Veda)', 'Vedanā = "the knowing of the taste"', 'NOT emotion — strictly hedonic tone:', '• Pleasant (sukha)', '• Painful (dukkha)', '• Neutral (adukkhamasukha)', '⚡ The PIVOT in dependent origination:', 'Contact → Vedanā → [cut here] → Craving'] },
            { id: 'ac1s2', text: 'āsu', type: 'suffix', tooltips: ['📍 "Among the..." — locative plural', 'All three tones are the domain'] },
          ],
          senses: [
            { english: 'in feelings', nuance: 'Hedonic tones' },
            { english: 'regarding felt tones', nuance: 'Pleasant/painful/neutral' },
            { english: 'within sensations', nuance: 'Raw valence' },
          ],
        },
        {
          id: 'ac2',
          wordClass: 'content',
          segments: [
            { id: 'ac2s1', text: 'vedan', type: 'root', tooltips: ['Vedanā: The felt quality', 'Pleasant, painful, or neutral'] },
            { id: 'ac2s2', text: 'ānu', type: 'prefix', tooltips: ['Anu: Along / Repeatedly / Closely'] },
            { id: 'ac2s3', text: 'pass', type: 'root', tooltips: ['👁️ √dṛś (Pali √pass): To see'] },
            { id: 'ac2s4', text: 'ī', type: 'suffix', tooltips: ['-ī = "one who does this"', 'Identity: a feeling-observer'] },
          ],
          senses: [
            { english: 'observing feelings', nuance: 'Action' },
            { english: 'a feeling-watcher', nuance: 'Identity' },
            { english: 'tracking sensations', nuance: 'Following closely' },
            { english: 'seeing feeling as feeling', nuance: 'Phenomenological' },
          ],
        },
        {
          id: 'ac3',
          wordClass: 'content',
          segments: [
            { id: 'ac3s1', text: 'vi', type: 'prefix', tooltips: ['Apart / Special'] },
            { id: 'ac3s2', text: 'har', type: 'root', tooltips: ['🏠 √hṛ: To carry / Dwell'] },
            { id: 'ac3s3', text: 'ati', type: 'suffix', tooltips: ['He/she is doing this now'] },
          ],
          senses: [
            { english: 'dwells', nuance: 'Lives this way' },
            { english: 'abides', nuance: 'Rests here' },
          ],
        },
      ],
      englishStructure: [
        { id: 'eac3', linkedSegmentId: 'ac3s2' },
        { id: 'eac2', linkedPaliId: 'ac2' },
        { id: 'eac1', linkedSegmentId: 'ac1s1' },
      ],
    },
    {
      id: 'phase-ad',
      paliWords: [
        {
          id: 'ad1',
          wordClass: 'content',
          refrainId: 'formula-ardent',
          segments: [
            { id: 'ad1s1', text: 'ātāp', type: 'root', tooltips: ['🔥 √tap: To burn / Heat'] },
            { id: 'ad1s2', text: 'ī', type: 'suffix', tooltips: ['Possessive: One who has...'] },
          ],
          senses: [{ english: 'ardent', nuance: 'On fire' }],
        },
        {
          id: 'ad2',
          wordClass: 'content',
          refrainId: 'formula-ardent',
          segments: [
            { id: 'ad2s1', text: 'sam', type: 'prefix', tooltips: ['Together / Completely'] },
            { id: 'ad2s2', text: 'pa', type: 'prefix', tooltips: ['Forth / Forward'] },
            { id: 'ad2s3', text: 'jān', type: 'root', tooltips: ['🧠 √jñā: To know'] },
            { id: 'ad2s4', text: 'o', type: 'suffix', tooltips: ['The one doing this'] },
          ],
          senses: [{ english: 'clearly knowing', nuance: 'Full awareness' }],
        },
        {
          id: 'ad3',
          wordClass: 'content',
          refrainId: 'formula-ardent',
          segments: [
            { id: 'ad3s1', text: 'sati', type: 'root', tooltips: ['💭 √smṛ: Memory / Mindfulness'] },
            { id: 'ad3s2', text: 'mā', type: 'suffix', tooltips: ['-mant: Possessing the faculty'] },
          ],
          senses: [{ english: 'mindful', nuance: 'Present' }],
        },
      ],
      englishStructure: [
        { id: 'ead1', linkedSegmentId: 'ad1s1' },
        { id: 'ead2', linkedSegmentId: 'ad2s3' },
        { id: 'ead3', linkedSegmentId: 'ad3s1' },
      ],
    },
    {
      id: 'phase-ae',
      paliWords: [
        {
          id: 'ae1',
          wordClass: 'content',
          refrainId: 'formula-removing',
          segments: [
            { id: 'ae1s1', text: 'vi', type: 'prefix', tooltips: ['Away / Apart'] },
            { id: 'ae1s2', text: 'ney', type: 'root', tooltips: ['√nī: To lead'] },
            { id: 'ae1s3', text: 'ya', type: 'suffix', tooltips: ['⚡ Observing IS removing'] },
          ],
          senses: [{ english: 'putting aside', nuance: 'Releasing' }],
        },
        {
          id: 'ae2',
          wordClass: 'content',
          refrainId: 'formula-removing',
          segments: [
            { id: 'ae2s1', text: 'lok', type: 'root', tooltips: ['Loka: World'] },
            { id: 'ae2s2', text: 'e', type: 'suffix', tooltips: ['📍 "Regarding the..."'] },
          ],
          senses: [{ english: 'regarding the world', nuance: 'Scope' }],
        },
        {
          id: 'ae3',
          wordClass: 'content',
          refrainId: 'formula-removing',
          segments: [
            { id: 'ae3s1', text: 'abhijjhā', type: 'root', tooltips: ['Longing / Covetousness'] },
            { id: 'ae3s2', text: 'domanass', type: 'root', tooltips: ['Displeasure / Aversion'] },
            { id: 'ae3s3', text: 'aṁ', type: 'suffix', tooltips: ['The thing being removed'] },
          ],
          senses: [{ english: 'covetousness & displeasure', nuance: 'What is released' }],
        },
      ],
      englishStructure: [
        { id: 'eae1', linkedSegmentId: 'ae1s2' },
        { id: 'eae3', linkedPaliId: 'ae3' },
        { id: 'eae2g', label: 'regarding', isGhost: true, ghostKind: 'required' },
        { id: 'eae2', linkedSegmentId: 'ae2s1' },
      ],
    },

    // ============================================================
    // THIRD SATIPAṬṬHĀNA: Cittānupassanā (mn10:3.4)
    // citte cittānupassī viharati ātāpī sampajāno satimā,
    // vineyya loke abhijjhādomanassaṁ
    // ============================================================
    {
      id: 'phase-af',
      paliWords: [
        {
          id: 'af1',
          wordClass: 'content',
          segments: [
            { id: 'af1s1', text: 'citt', type: 'root', tooltips: ['🧠 Double etymology:', '• √cit: To perceive / To think', '• √ci: To accumulate / Heap up', 'Citta = "Heart-Mind"', '• Agent of cognition', '• Repository of kamma', 'Not thoughts — the STATE of consciousness', '(lustful, clear, contracted, exalted...)'] },
            { id: 'af1s2', text: 'e', type: 'suffix', tooltips: ['📍 "In the..." — locative singular', 'The 16 states: sarāga/vītarāga, sadosa/vītadosa...'] },
          ],
          senses: [
            { english: 'in the mind', nuance: 'Cognitive aspect' },
            { english: 'in the heart', nuance: 'Affective aspect' },
            { english: 'regarding consciousness', nuance: 'State-awareness' },
          ],
        },
        {
          id: 'af2',
          wordClass: 'content',
          segments: [
            { id: 'af2s1', text: 'citt', type: 'root', tooltips: ['Citta: Mind / Heart / Consciousness'] },
            { id: 'af2s2', text: 'ānu', type: 'prefix', tooltips: ['Anu: Along / Repeatedly'] },
            { id: 'af2s3', text: 'pass', type: 'root', tooltips: ['👁️ √dṛś (Pali √pass): To see'] },
            { id: 'af2s4', text: 'ī', type: 'suffix', tooltips: ['-ī = "one who does this"', 'Identity: a mind-observer'] },
          ],
          senses: [
            { english: 'observing mind', nuance: 'Action' },
            { english: 'a mind-watcher', nuance: 'Identity' },
            { english: 'tracking consciousness', nuance: 'Following closely' },
            { english: 'seeing mind as mind', nuance: 'Phenomenological' },
          ],
        },
        {
          id: 'af3',
          wordClass: 'content',
          segments: [
            { id: 'af3s1', text: 'vi', type: 'prefix', tooltips: ['Apart / Special'] },
            { id: 'af3s2', text: 'har', type: 'root', tooltips: ['🏠 √hṛ: To dwell'] },
            { id: 'af3s3', text: 'ati', type: 'suffix', tooltips: ['Ongoing action'] },
          ],
          senses: [{ english: 'dwells', nuance: 'Abides' }],
        },
      ],
      englishStructure: [
        { id: 'eaf3', linkedSegmentId: 'af3s2' },
        { id: 'eaf2', linkedPaliId: 'af2' },
        { id: 'eaf1', linkedSegmentId: 'af1s1' },
      ],
    },
    {
      id: 'phase-ag',
      paliWords: [
        {
          id: 'ag1',
          wordClass: 'content',
          refrainId: 'formula-ardent',
          segments: [
            { id: 'ag1s1', text: 'ātāp', type: 'root', tooltips: ['🔥 √tap: Ardor'] },
            { id: 'ag1s2', text: 'ī', type: 'suffix', tooltips: ['Possessive'] },
          ],
          senses: [{ english: 'ardent', nuance: 'Diligent' }],
        },
        {
          id: 'ag2',
          wordClass: 'content',
          refrainId: 'formula-ardent',
          segments: [
            { id: 'ag2s1', text: 'sampajān', type: 'root', tooltips: ['🧠 Clear comprehension'] },
            { id: 'ag2s2', text: 'o', type: 'suffix', tooltips: ['One who knows'] },
          ],
          senses: [{ english: 'clearly knowing', nuance: 'Alert' }],
        },
        {
          id: 'ag3',
          wordClass: 'content',
          refrainId: 'formula-ardent',
          segments: [
            { id: 'ag3s1', text: 'sati', type: 'root', tooltips: ['💭 Mindfulness'] },
            { id: 'ag3s2', text: 'mā', type: 'suffix', tooltips: ['Possessing'] },
          ],
          senses: [{ english: 'mindful', nuance: 'Present' }],
        },
      ],
      englishStructure: [
        { id: 'eag1', linkedSegmentId: 'ag1s1' },
        { id: 'eag2', linkedSegmentId: 'ag2s1' },
        { id: 'eag3', linkedSegmentId: 'ag3s1' },
      ],
    },
    {
      id: 'phase-ah',
      paliWords: [
        {
          id: 'ah1',
          wordClass: 'content',
          refrainId: 'formula-removing',
          segments: [
            { id: 'ah1s1', text: 'vineyya', type: 'stem', tooltips: ['Vi + √nī: Leading away', '⚡ Removing through observation'] },
          ],
          senses: [{ english: 'putting aside', nuance: 'Releasing' }],
        },
        {
          id: 'ah2',
          wordClass: 'content',
          refrainId: 'formula-removing',
          segments: [
            { id: 'ah2s1', text: 'loke', type: 'stem', tooltips: ['📍 World / Realm'] },
          ],
          senses: [{ english: 'regarding the world', nuance: 'Scope' }],
        },
        {
          id: 'ah3',
          wordClass: 'content',
          refrainId: 'formula-removing',
          segments: [
            { id: 'ah3s1', text: 'abhijjhā', type: 'root', tooltips: ['Covetousness'] },
            { id: 'ah3s2', text: 'domanassaṁ', type: 'root', tooltips: ['Displeasure'] },
          ],
          senses: [{ english: 'covetousness & displeasure', nuance: 'Released' }],
        },
      ],
      englishStructure: [
        { id: 'eah1', linkedPaliId: 'ah1' },
        { id: 'eah3', linkedPaliId: 'ah3' },
        { id: 'eah2g', label: 'regarding', isGhost: true, ghostKind: 'required' },
        { id: 'eah2', linkedPaliId: 'ah2' },
      ],
    },

    // ============================================================
    // FOURTH SATIPAṬṬHĀNA: Dhammānupassanā (mn10:3.5)
    // dhammesu dhammānupassī viharati ātāpī sampajāno satimā,
    // vineyya loke abhijjhādomanassaṁ
    // ============================================================
    {
      id: 'phase-ai',
      paliWords: [
        {
          id: 'ai1',
          wordClass: 'content',
          segments: [
            { id: 'ai1s1', text: 'dhamm', type: 'root', tooltips: ['⚖️ √dhṛ: To hold / Support / Sustain', 'Dhamma = "that which holds"', 'Here NOT "The Dhamma" (singular/Doctrine)', 'But "dhammas" (plural) = PATTERNS:', '1. Five Hindrances', '2. Five Aggregates', '3. Six Sense Bases', '4. Seven Awakening Factors', '5. Four Noble Truths', '🔬 Domain of Vipassanā — causal laws'] },
            { id: 'ai1s2', text: 'esu', type: 'suffix', tooltips: ['📍 "Among the..." — locative PLURAL', 'Not "in Dhamma" but "in dhammas"', 'Observing principles, not things'] },
          ],
          senses: [
            { english: 'in principles', nuance: 'Causal patterns' },
            { english: 'regarding phenomena', nuance: 'Mental factors' },
            { english: 'within the categories', nuance: 'The five sections' },
            { english: 'in the way things work', nuance: 'Laws of mind' },
          ],
        },
        {
          id: 'ai2',
          wordClass: 'content',
          segments: [
            { id: 'ai2s1', text: 'dhamm', type: 'root', tooltips: ['Dhamma: Phenomena / Principles'] },
            { id: 'ai2s2', text: 'ānu', type: 'prefix', tooltips: ['Anu: Along / Closely'] },
            { id: 'ai2s3', text: 'pass', type: 'root', tooltips: ['👁️ √dṛś (Pali √pass): To see'] },
            { id: 'ai2s4', text: 'ī', type: 'suffix', tooltips: ['-ī = "one who does this"', 'Identity: a dhamma-observer'] },
          ],
          senses: [
            { english: 'observing phenomena', nuance: 'Action' },
            { english: 'a dhamma-watcher', nuance: 'Identity' },
            { english: 'tracking principles', nuance: 'Following closely' },
            { english: 'seeing dhamma as dhamma', nuance: 'Phenomenological' },
          ],
        },
        {
          id: 'ai3',
          wordClass: 'content',
          segments: [
            { id: 'ai3s1', text: 'vi', type: 'prefix', tooltips: ['Apart / Special'] },
            { id: 'ai3s2', text: 'har', type: 'root', tooltips: ['🏠 √hṛ: To dwell'] },
            { id: 'ai3s3', text: 'ati', type: 'suffix', tooltips: ['Ongoing action'] },
          ],
          senses: [{ english: 'dwells', nuance: 'Abides' }],
        },
      ],
      englishStructure: [
        { id: 'eai3', linkedSegmentId: 'ai3s2' },
        { id: 'eai2', linkedPaliId: 'ai2' },
        { id: 'eai1', linkedSegmentId: 'ai1s1' },
      ],
    },
    {
      id: 'phase-aj',
      paliWords: [
        {
          id: 'aj1',
          wordClass: 'content',
          refrainId: 'formula-ardent',
          segments: [
            { id: 'aj1s1', text: 'ātāp', type: 'root', tooltips: ['🔥 √tap: Ardor'] },
            { id: 'aj1s2', text: 'ī', type: 'suffix', tooltips: ['Possessive'] },
          ],
          senses: [{ english: 'ardent', nuance: 'Diligent' }],
        },
        {
          id: 'aj2',
          wordClass: 'content',
          refrainId: 'formula-ardent',
          segments: [
            { id: 'aj2s1', text: 'sampajān', type: 'root', tooltips: ['🧠 Clear comprehension'] },
            { id: 'aj2s2', text: 'o', type: 'suffix', tooltips: ['One who knows'] },
          ],
          senses: [{ english: 'clearly knowing', nuance: 'Alert' }],
        },
        {
          id: 'aj3',
          wordClass: 'content',
          refrainId: 'formula-ardent',
          segments: [
            { id: 'aj3s1', text: 'sati', type: 'root', tooltips: ['💭 Mindfulness'] },
            { id: 'aj3s2', text: 'mā', type: 'suffix', tooltips: ['Possessing'] },
          ],
          senses: [{ english: 'mindful', nuance: 'Present' }],
        },
      ],
      englishStructure: [
        { id: 'eaj1', linkedSegmentId: 'aj1s1' },
        { id: 'eaj2', linkedSegmentId: 'aj2s1' },
        { id: 'eaj3', linkedSegmentId: 'aj3s1' },
      ],
    },
    {
      id: 'phase-ak',
      paliWords: [
        {
          id: 'ak1',
          wordClass: 'content',
          refrainId: 'formula-removing',
          segments: [
            { id: 'ak1s1', text: 'vineyya', type: 'stem', tooltips: ['Vi + √nī: Leading away', '⚡ Removing through observation'] },
          ],
          senses: [{ english: 'putting aside', nuance: 'Releasing' }],
        },
        {
          id: 'ak2',
          wordClass: 'content',
          refrainId: 'formula-removing',
          segments: [
            { id: 'ak2s1', text: 'loke', type: 'stem', tooltips: ['📍 World / Realm'] },
          ],
          senses: [{ english: 'regarding the world', nuance: 'Scope' }],
        },
        {
          id: 'ak3',
          wordClass: 'content',
          refrainId: 'formula-removing',
          segments: [
            { id: 'ak3s1', text: 'abhijjhā', type: 'root', tooltips: ['Covetousness'] },
            { id: 'ak3s2', text: 'domanassaṁ', type: 'root', tooltips: ['Displeasure'] },
          ],
          senses: [{ english: 'covetousness & displeasure', nuance: 'Released' }],
        },
      ],
      englishStructure: [
        { id: 'eak1', linkedPaliId: 'ak1' },
        { id: 'eak3', linkedPaliId: 'ak3' },
        { id: 'eak2g', label: 'regarding', isGhost: true, ghostKind: 'required' },
        { id: 'eak2', linkedPaliId: 'ak2' },
      ],
    },

    // ============================================================
    // UDDESA CONCLUSION (mn10:3.6)
    // Uddeso niṭṭhito.
    // ============================================================
    {
      id: 'phase-al',
      paliWords: [
        {
          id: 'al1',
          wordClass: 'content',
          segments: [
            { id: 'al1s1', text: 'Uddes', type: 'root', tooltips: ['Ud + √diś: To point out / Indicate', 'Uddesa = outline, summary, pointing out', 'The brief statement before detailed explanation'] },
            { id: 'al1s2', text: 'o', type: 'suffix', tooltips: ['The thing itself — "the outline"'] },
          ],
          senses: [
            { english: 'The outline', nuance: 'Summary' },
            { english: 'The overview', nuance: 'Introduction' },
            { english: 'The pointing-out', nuance: 'Etymological' },
          ],
        },
        {
          id: 'al2',
          wordClass: 'content',
          segments: [
            { id: 'al2s1', text: 'niṭṭhit', type: 'root', tooltips: ['Ni + √sthā: To stand / Be established', 'Niṭṭhita = finished, completed, concluded'] },
            { id: 'al2s2', text: 'o', type: 'suffix', tooltips: ['Masculine singular — describing the uddesa'] },
          ],
          senses: [
            { english: 'is complete', nuance: 'Finished' },
            { english: 'is concluded', nuance: 'Ended' },
            { english: 'stands established', nuance: 'Done' },
          ],
        },
      ],
      englishStructure: [
        { id: 'eal1', linkedSegmentId: 'al1s1' },
        { id: 'eal2', linkedSegmentId: 'al2s1' },
      ],
    },

    // ============================================================
    // ĀNĀPĀNAPABBA: Mindfulness of Breathing (mn10:4.1-4.7)
    // ============================================================

    // mn10:4.1 - Transition question
    // Kathañca, bhikkhave, bhikkhu kāye kāyānupassī viharati?
    {
      id: 'phase-am',
      paliWords: [
        {
          id: 'am1',
          wordClass: 'function',
          segments: [
            { id: 'am1s1', text: 'Kathañ', type: 'root', tooltips: ['Kathaṁ: How / In what way', '❓ Interrogative — asking for method'] },
            { id: 'am1s2', text: 'ca', type: 'suffix', tooltips: ['Ca: And (connective)', 'Sandhi: kathaṁ + ca → kathañca'] },
          ],
          senses: [
            { english: 'And how', nuance: 'Transition' },
            { english: 'In what way', nuance: 'Method question' },
          ],
        },
        {
          id: 'am2',
          wordClass: 'content',
          refrainId: 'bhikkhu',
          segments: [
            { id: 'am2s1', text: 'bhikkh', type: 'root', tooltips: ['√bhikkh: To share'] },
            { id: 'am2s2', text: 'ave', type: 'suffix', tooltips: ['📢 Vocative — addressing the group'] },
          ],
          senses: [{ english: 'bhikkhus', nuance: 'Address' }],
        },
        {
          id: 'am3',
          wordClass: 'content',
          refrainId: 'bhikkhu',
          segments: [
            { id: 'am3s1', text: 'bhikkh', type: 'root', tooltips: ['√bhikkh: To share'] },
            { id: 'am3s2', text: 'u', type: 'suffix', tooltips: ['Nominative singular — the practitioner'] },
          ],
          senses: [{ english: 'a bhikkhu', nuance: 'Subject' }],
        },
        {
          id: 'am4',
          wordClass: 'content',
          segments: [
            { id: 'am4s1', text: 'kāy', type: 'root', tooltips: ['Kāya: Body / Collection'] },
            { id: 'am4s2', text: 'e', type: 'suffix', tooltips: ['📍 "In the..."'] },
          ],
          senses: [{ english: 'in the body', nuance: 'Domain' }],
        },
        {
          id: 'am5',
          wordClass: 'content',
          segments: [
            { id: 'am5s1', text: 'kāy', type: 'root', tooltips: ['Kāya: Body'] },
            { id: 'am5s2', text: 'ānu', type: 'prefix', tooltips: ['Anu: Along / Closely'] },
            { id: 'am5s3', text: 'pass', type: 'root', tooltips: ['👁️ √pass: To see'] },
            { id: 'am5s4', text: 'ī', type: 'suffix', tooltips: ['One who does this'] },
          ],
          senses: [{ english: 'observing body', nuance: 'Action' }],
        },
        {
          id: 'am6',
          wordClass: 'content',
          segments: [
            { id: 'am6s1', text: 'vi', type: 'prefix', tooltips: ['Apart / Special'] },
            { id: 'am6s2', text: 'har', type: 'root', tooltips: ['🏠 √hṛ: To dwell'] },
            { id: 'am6s3', text: 'ati', type: 'suffix', tooltips: ['Ongoing action'] },
          ],
          senses: [{ english: 'dwell', nuance: 'Abide' }],
        },
      ],
      englishStructure: [
        { id: 'eam1', linkedPaliId: 'am1' },
        { id: 'eam1g', label: 'does', isGhost: true, ghostKind: 'required' },
        { id: 'eam3', linkedSegmentId: 'am3s1' },
        { id: 'eam6', linkedSegmentId: 'am6s2' },
        { id: 'eam5', linkedPaliId: 'am5' },
        { id: 'eam4', linkedSegmentId: 'am4s1' },
      ],
    },

    // mn10:4.2a - Going to wilderness, tree root, or empty hut
    // Idha, bhikkhave, bhikkhu araññagato vā rukkhamūlagato vā suññāgāragato vā
    {
      id: 'phase-an',
      paliWords: [
        {
          id: 'an1',
          wordClass: 'function',
          segments: [
            { id: 'an1s1', text: 'Idha', type: 'stem', tooltips: ['Here / In this teaching', '📍 Sets the context'] },
          ],
          senses: [{ english: 'Here', nuance: 'In this case' }],
        },
        {
          id: 'an2',
          wordClass: 'content',
          refrainId: 'bhikkhu',
          segments: [
            { id: 'an2s1', text: 'bhikkh', type: 'root', tooltips: ['√bhikkh: To share'] },
            { id: 'an2s2', text: 'ave', type: 'suffix', tooltips: ['📢 Vocative'] },
          ],
          senses: [{ english: 'bhikkhus', nuance: 'Address' }],
        },
        {
          id: 'an3',
          wordClass: 'content',
          refrainId: 'bhikkhu',
          segments: [
            { id: 'an3s1', text: 'bhikkh', type: 'root', tooltips: ['√bhikkh: To share'] },
            { id: 'an3s2', text: 'u', type: 'suffix', tooltips: ['Nominative singular'] },
          ],
          senses: [{ english: 'a bhikkhu', nuance: 'Subject' }],
        },
        {
          id: 'an4',
          wordClass: 'content',
          segments: [
            { id: 'an4s1', text: 'arañña', type: 'root', tooltips: ['🌲 Araṇya: Forest / Wilderness', 'From √ṛ: to go (remote, where one goes away)', 'Canonical: 500 bow-lengths from village', 'Space for undisturbed practice'] },
            { id: 'an4s2', text: 'gato', type: 'suffix', tooltips: ['√gam: Gone to', 'Past participle — having gone'] },
          ],
          senses: [
            { english: 'gone to the wilderness', nuance: 'Remote' },
            { english: 'forest-gone', nuance: 'Compound' },
          ],
        },
        {
          id: 'an5',
          wordClass: 'function',
          segments: [
            { id: 'an5s1', text: 'vā', type: 'stem', tooltips: ['Or — disjunctive particle', 'Presents alternatives'] },
          ],
          senses: [{ english: 'or', nuance: 'Alternative' }],
        },
        {
          id: 'an6',
          wordClass: 'content',
          segments: [
            { id: 'an6s1', text: 'rukkha', type: 'root', tooltips: ['🌳 Rukkha: Tree', 'From Sanskrit vṛkṣa'] },
            { id: 'an6s2', text: 'mūla', type: 'root', tooltips: ['Mūla: Root / Base / Foundation', 'The shaded spot at the base of a tree'] },
            { id: 'an6s3', text: 'gato', type: 'suffix', tooltips: ['Gone to'] },
          ],
          senses: [
            { english: 'gone to a tree root', nuance: 'Shelter' },
            { english: 'at the foot of a tree', nuance: 'Traditional spot' },
          ],
        },
        {
          id: 'an7',
          wordClass: 'content',
          segments: [
            { id: 'an7s1', text: 'suñña', type: 'root', tooltips: ['Suñña: Empty / Void', 'Same root as suññatā (emptiness)', 'Empty of disturbances/people'] },
            { id: 'an7s2', text: 'āgāra', type: 'root', tooltips: ['Āgāra: House / Building / Hut', 'A dwelling, shelter'] },
            { id: 'an7s3', text: 'gato', type: 'suffix', tooltips: ['Gone to'] },
          ],
          senses: [
            { english: 'gone to an empty hut', nuance: 'Solitude' },
            { english: 'in an empty building', nuance: 'Shelter' },
          ],
        },
      ],
      englishStructure: [
        { id: 'ean1', linkedPaliId: 'an1' },
        { id: 'ean3', linkedSegmentId: 'an3s1' },
        { id: 'ean1g', label: 'has', isGhost: true, ghostKind: 'required' },
        { id: 'ean4', linkedPaliId: 'an4' },
        { id: 'ean5', linkedPaliId: 'an5' },
        { id: 'ean6', linkedPaliId: 'an6' },
        { id: 'ean5b', linkedPaliId: 'an5' },
        { id: 'ean7', linkedPaliId: 'an7' },
      ],
    },

    // mn10:4.2b - Sitting posture
    // nisīdati pallaṅkaṁ ābhujitvā ujuṁ kāyaṁ paṇidhāya
    {
      id: 'phase-ao',
      paliWords: [
        {
          id: 'ao1',
          wordClass: 'content',
          segments: [
            { id: 'ao1s1', text: 'ni', type: 'prefix', tooltips: ['Ni: Down / Into'] },
            { id: 'ao1s2', text: 'sīd', type: 'root', tooltips: ['√sad: To sit', 'Ni + sad = sit down, settle'] },
            { id: 'ao1s3', text: 'ati', type: 'suffix', tooltips: ['Present tense — ongoing action'] },
          ],
          senses: [
            { english: 'sits down', nuance: 'Action' },
            { english: 'settles', nuance: 'Establishes' },
          ],
        },
        {
          id: 'ao2',
          wordClass: 'content',
          segments: [
            { id: 'ao2s1', text: 'pallaṅk', type: 'root', tooltips: ['Pallaṅka: Cross-legged posture', 'Paryaṅka in Sanskrit', '🧘 The meditation seat/throne', 'Can mean full lotus or seated posture'] },
            { id: 'ao2s2', text: 'aṁ', type: 'suffix', tooltips: ['Accusative — the object being adopted'] },
          ],
          senses: [
            { english: 'cross-legged', nuance: 'Posture' },
            { english: 'in lotus position', nuance: 'Traditional' },
          ],
        },
        {
          id: 'ao3',
          wordClass: 'content',
          segments: [
            { id: 'ao3s1', text: 'ā', type: 'prefix', tooltips: ['Ā: Towards / Completely'] },
            { id: 'ao3s2', text: 'bhuj', type: 'root', tooltips: ['√bhuj: To bend / Fold', 'Ābhujati = to bend, fold (legs)'] },
            { id: 'ao3s3', text: 'itvā', type: 'suffix', tooltips: ['Absolutive: "having done X"', 'Sequence: first bend, then...'] },
          ],
          senses: [
            { english: 'having folded', nuance: 'Legs crossed' },
            { english: 'having bent', nuance: 'Arranging limbs' },
          ],
        },
        {
          id: 'ao4',
          wordClass: 'content',
          segments: [
            { id: 'ao4s1', text: 'uju', type: 'root', tooltips: ['Uju: Straight / Upright / Direct', 'Sanskrit ṛju', '📐 Physical AND ethical straightness'] },
            { id: 'ao4s2', text: 'ṁ', type: 'suffix', tooltips: ['Accusative — describing what is made straight'] },
          ],
          senses: [
            { english: 'straight', nuance: 'Upright' },
            { english: 'erect', nuance: 'Aligned' },
          ],
        },
        {
          id: 'ao5',
          wordClass: 'content',
          segments: [
            { id: 'ao5s1', text: 'kāy', type: 'root', tooltips: ['Kāya: Body'] },
            { id: 'ao5s2', text: 'aṁ', type: 'suffix', tooltips: ['Accusative — the thing made straight'] },
          ],
          senses: [{ english: 'the body', nuance: 'Physical form' }],
        },
        {
          id: 'ao6',
          wordClass: 'content',
          segments: [
            { id: 'ao6s1', text: 'paṇi', type: 'prefix', tooltips: ['Pra + ni: Forth + down', 'Directed forward'] },
            { id: 'ao6s2', text: 'dhā', type: 'root', tooltips: ['√dhā: To place / Set / Establish', 'Paṇidhāya = having placed forward, having directed'] },
            { id: 'ao6s3', text: 'ya', type: 'suffix', tooltips: ['Absolutive: "having done X"'] },
          ],
          senses: [
            { english: 'having set up', nuance: 'Established' },
            { english: 'having directed', nuance: 'Oriented' },
          ],
        },
      ],
      englishStructure: [
        { id: 'eao1', linkedSegmentId: 'ao1s2' },
        { id: 'eao2', linkedPaliId: 'ao2' },
        { id: 'eao4', linkedPaliId: 'ao4' },
        { id: 'eao5', linkedSegmentId: 'ao5s1' },
        { id: 'eao6', linkedSegmentId: 'ao6s2' },
      ],
    },

    // mn10:4.2c - Establishing mindfulness in front
    // parimukhaṁ satiṁ upaṭṭhapetvā
    {
      id: 'phase-ap',
      paliWords: [
        {
          id: 'ap1',
          wordClass: 'content',
          segments: [
            { id: 'ap1s1', text: 'pari', type: 'prefix', tooltips: ['Pari: Around / Encompassing'] },
            { id: 'ap1s2', text: 'mukh', type: 'root', tooltips: ['Mukha: Face / Mouth / Front', '📍 INTERPRETIVE DEBATE:', '• "In front" — before the face', '• "Around the mouth" — nostrils', '• "Foremost" — primary, paramount', 'All three readings have support'] },
            { id: 'ap1s3', text: 'aṁ', type: 'suffix', tooltips: ['Accusative — describing where/how'] },
          ],
          senses: [
            { english: 'in front', nuance: 'Before the face' },
            { english: 'around the nostrils', nuance: 'Breath spot' },
            { english: 'as foremost', nuance: 'Primary focus' },
          ],
        },
        {
          id: 'ap2',
          wordClass: 'content',
          segments: [
            { id: 'ap2s1', text: 'sati', type: 'root', tooltips: ['💭 √smṛ: Mindfulness / Awareness', 'The thing being established'] },
            { id: 'ap2s2', text: 'ṁ', type: 'suffix', tooltips: ['Accusative — object of upaṭṭhapetvā'] },
          ],
          senses: [{ english: 'mindfulness', nuance: 'Awareness' }],
        },
        {
          id: 'ap3',
          wordClass: 'content',
          segments: [
            { id: 'ap3s1', text: 'upa', type: 'prefix', tooltips: ['Upa: Near / Towards'] },
            { id: 'ap3s2', text: 'ṭṭhap', type: 'root', tooltips: ['√sthā (Causative): To cause to stand', 'Upaṭṭhapeti = to establish, set up, make present'] },
            { id: 'ap3s3', text: 'etvā', type: 'suffix', tooltips: ['Absolutive: "having done X"', 'After this, the breathing begins'] },
          ],
          senses: [
            { english: 'having established', nuance: 'Set up' },
            { english: 'having made present', nuance: 'Activated' },
          ],
        },
      ],
      englishStructure: [
        { id: 'eap3', linkedSegmentId: 'ap3s2' },
        { id: 'eap2', linkedSegmentId: 'ap2s1' },
        { id: 'eap1', linkedPaliId: 'ap1' },
      ],
    },

    // mn10:4.3 - Mindful breathing
    // So satova assasati, satova passasati.
    {
      id: 'phase-aq',
      paliWords: [
        {
          id: 'aq1',
          wordClass: 'function',
          segments: [
            { id: 'aq1s1', text: 'So', type: 'stem', tooltips: ['Sa: He / That one', 'Refers back to the bhikkhu'] },
          ],
          senses: [{ english: 'He', nuance: 'That practitioner' }],
        },
        {
          id: 'aq2',
          wordClass: 'content',
          segments: [
            { id: 'aq2s1', text: 'sat', type: 'root', tooltips: ['💭 √smṛ: Memory / Mindfulness', '📝 KEY: Sato (not satimā)!', '• Satimā = POSSESSING the faculty', '• Sato = APPLYING it NOW', 'Active, moment-to-moment awareness', 'Here: mindfully doing the breathing'] },
            { id: 'aq2s2', text: 'o', type: 'suffix', tooltips: ['Nominative singular — describing "he"', 'Adverbial sense: "mindfully"'] },
          ],
          senses: [
            { english: 'mindfully', nuance: 'Adverbial' },
            { english: 'with awareness', nuance: 'Applied sati' },
            { english: 'recollected', nuance: 'Present' },
          ],
        },
        {
          id: 'aq3',
          wordClass: 'function',
          segments: [
            { id: 'aq3s1', text: 'va', type: 'stem', tooltips: ['Eva → va: Just / Only / Indeed', 'Emphatic particle', '"Just mindfully" — nothing else'] },
          ],
          senses: [{ english: 'just', nuance: 'Emphasis' }],
        },
        {
          id: 'aq4',
          wordClass: 'content',
          segments: [
            { id: 'aq4s1', text: 'assas', type: 'root', tooltips: ['🌬️ Ā + √śvas: To breathe in', 'Ā = towards, in-drawing', 'Assāsa = in-breath', '⚡ WHY IN-BREATH FIRST?', 'Debate on sequence significance'] },
            { id: 'aq4s2', text: 'ati', type: 'suffix', tooltips: ['Present tense — ongoing action'] },
          ],
          senses: [
            { english: 'breathes in', nuance: 'Inhalation' },
            { english: 'inhales', nuance: 'Standard' },
          ],
        },
        {
          id: 'aq5',
          wordClass: 'content',
          segments: [
            { id: 'aq5s1', text: 'passas', type: 'root', tooltips: ['🌬️ Pra + √śvas: To breathe out', 'Pra = forth, out-going', 'Passāsa = out-breath'] },
            { id: 'aq5s2', text: 'ati', type: 'suffix', tooltips: ['Present tense'] },
          ],
          senses: [
            { english: 'breathes out', nuance: 'Exhalation' },
            { english: 'exhales', nuance: 'Standard' },
          ],
        },
      ],
      englishStructure: [
        { id: 'eaq1', linkedPaliId: 'aq1' },
        { id: 'eaq3', linkedPaliId: 'aq3' },
        { id: 'eaq2', linkedSegmentId: 'aq2s1' },
        { id: 'eaq4', linkedSegmentId: 'aq4s1' },
        { id: 'eaq2b', linkedSegmentId: 'aq2s1' },
        { id: 'eaq5', linkedSegmentId: 'aq5s1' },
      ],
    },

    // mn10:4.4 - Long breath awareness
    // Dīghaṁ vā assasanto 'dīghaṁ assasāmī'ti pajānāti,
    // dīghaṁ vā passasanto 'dīghaṁ passasāmī'ti pajānāti.
    {
      id: 'phase-ar',
      paliWords: [
        {
          id: 'ar1',
          wordClass: 'content',
          segments: [
            { id: 'ar1s1', text: 'Dīgh', type: 'root', tooltips: ['Dīgha: Long (in space or time)', 'Sanskrit dīrgha', '🌬️ A long, slow breath', 'Not forced — just noticing duration'] },
            { id: 'ar1s2', text: 'aṁ', type: 'suffix', tooltips: ['Accusative adverbial — "long-ly"', 'Describing manner of breathing'] },
          ],
          senses: [
            { english: 'long', nuance: 'Duration' },
            { english: 'slowly', nuance: 'Manner' },
            { english: 'deeply', nuance: 'Extent' },
          ],
        },
        {
          id: 'ar2',
          wordClass: 'function',
          segments: [
            { id: 'ar2s1', text: 'vā', type: 'stem', tooltips: ['Or — disjunctive', 'Long OR short...'] },
          ],
          senses: [{ english: 'or', nuance: 'Alternative' }],
        },
        {
          id: 'ar3',
          wordClass: 'content',
          segments: [
            { id: 'ar3s1', text: 'assas', type: 'root', tooltips: ['Breathing in'] },
            { id: 'ar3s2', text: 'anto', type: 'suffix', tooltips: ['Present participle: "while doing"', 'Simultaneous action'] },
          ],
          senses: [{ english: 'breathing in', nuance: 'While inhaling' }],
        },
        {
          id: 'ar4',
          wordClass: 'content',
          segments: [
            { id: 'ar4s1', text: 'assas', type: 'root', tooltips: ['Breathing in'] },
            { id: 'ar4s2', text: 'āmī', type: 'suffix', tooltips: ['1st person singular: "I am doing"', 'Direct knowledge: knowing "I breathe"'] },
          ],
          senses: [{ english: 'I breathe in', nuance: 'Self-aware' }],
        },
        {
          id: 'ar5',
          wordClass: 'function',
          segments: [
            { id: 'ar5s1', text: 'ti', type: 'stem', tooltips: ['Iti: Quotation marker', 'End of inner speech'] },
          ],
          senses: [{ english: '—', nuance: 'Quote' }],
        },
        {
          id: 'ar6',
          wordClass: 'content',
          segments: [
            { id: 'ar6s1', text: 'pa', type: 'prefix', tooltips: ['Pa/Pra: Forth / Fully'] },
            { id: 'ar6s2', text: 'jān', type: 'root', tooltips: ['🧠 √jñā: To know', 'Pajānāti = clearly knows, understands', 'Direct experiential knowing'] },
            { id: 'ar6s3', text: 'āti', type: 'suffix', tooltips: ['Present tense: "knows"'] },
          ],
          senses: [
            { english: 'knows', nuance: 'Understands' },
            { english: 'clearly knows', nuance: 'Direct experience' },
            { english: 'discerns', nuance: 'Recognizes' },
          ],
        },
      ],
      englishStructure: [
        { id: 'ear3', linkedSegmentId: 'ar3s1' },
        { id: 'ear1', linkedSegmentId: 'ar1s1' },
        { id: 'ear6', linkedSegmentId: 'ar6s2' },
        { id: 'ear4g', label: '"I breathe in long"', isGhost: true, ghostKind: 'clarifying' },
      ],
    },

    // mn10:4.5 - Short breath awareness
    // Rassaṁ vā assasanto 'rassaṁ assasāmī'ti pajānāti,
    // rassaṁ vā passasanto 'rassaṁ passasāmī'ti pajānāti.
    {
      id: 'phase-as',
      paliWords: [
        {
          id: 'as1',
          wordClass: 'content',
          segments: [
            { id: 'as1s1', text: 'Rass', type: 'root', tooltips: ['Rassa: Short (in space or time)', 'Sanskrit hrasva', '🌬️ A short, quick breath', 'Natural variation — not controlled'] },
            { id: 'as1s2', text: 'aṁ', type: 'suffix', tooltips: ['Accusative adverbial'] },
          ],
          senses: [
            { english: 'short', nuance: 'Brief' },
            { english: 'quickly', nuance: 'Manner' },
            { english: 'lightly', nuance: 'Gentle' },
          ],
        },
        {
          id: 'as2',
          wordClass: 'function',
          segments: [
            { id: 'as2s1', text: 'vā', type: 'stem', tooltips: ['Or'] },
          ],
          senses: [{ english: 'or', nuance: 'Alternative' }],
        },
        {
          id: 'as3',
          wordClass: 'content',
          segments: [
            { id: 'as3s1', text: 'assas', type: 'root', tooltips: ['Breathing in'] },
            { id: 'as3s2', text: 'anto', type: 'suffix', tooltips: ['Present participle'] },
          ],
          senses: [{ english: 'breathing in', nuance: 'While inhaling' }],
        },
        {
          id: 'as4',
          wordClass: 'content',
          segments: [
            { id: 'as4s1', text: 'assas', type: 'root', tooltips: ['Breathing in'] },
            { id: 'as4s2', text: 'āmī', type: 'suffix', tooltips: ['1st person: "I am doing"'] },
          ],
          senses: [{ english: 'I breathe in', nuance: 'Self-aware' }],
        },
        {
          id: 'as5',
          wordClass: 'function',
          segments: [
            { id: 'as5s1', text: 'ti', type: 'stem', tooltips: ['Quote marker'] },
          ],
          senses: [{ english: '—', nuance: 'Quote' }],
        },
        {
          id: 'as6',
          wordClass: 'content',
          segments: [
            { id: 'as6s1', text: 'pajān', type: 'root', tooltips: ['🧠 √jñā: Clearly knows'] },
            { id: 'as6s2', text: 'āti', type: 'suffix', tooltips: ['Present tense'] },
          ],
          senses: [{ english: 'knows', nuance: 'Discerns' }],
        },
      ],
      englishStructure: [
        { id: 'eas3', linkedSegmentId: 'as3s1' },
        { id: 'eas1', linkedSegmentId: 'as1s1' },
        { id: 'eas6', linkedSegmentId: 'as6s1' },
        { id: 'eas4g', label: '"I breathe in short"', isGhost: true, ghostKind: 'clarifying' },
      ],
    },

    // mn10:4.6 - Whole body training
    // 'Sabbakāyapaṭisaṁvedī assasissāmī'ti sikkhati,
    // 'sabbakāyapaṭisaṁvedī passasissāmī'ti sikkhati.
    {
      id: 'phase-at',
      paliWords: [
        {
          id: 'at1',
          wordClass: 'content',
          segments: [
            { id: 'at1s1', text: 'Sabba', type: 'root', tooltips: ['Sabba: All / Entire / Whole', 'Complete, total'] },
            { id: 'at1s2', text: 'kāya', type: 'root', tooltips: ['⚡ MAJOR INTERPRETIVE DEBATE:', '🏛️ Commentarial: "breath-body"', '  = the whole breathing process', '  = complete in-out cycle', '📜 Sutta-only: "physical body"', '  = whole body pervaded', '  = full-body awareness', 'Both readings have merit'] },
            { id: 'at1s3', text: 'paṭi', type: 'prefix', tooltips: ['Paṭi: Towards / In response'] },
            { id: 'at1s4', text: 'saṁ', type: 'prefix', tooltips: ['Saṁ: Together / Fully'] },
            { id: 'at1s5', text: 'ved', type: 'root', tooltips: ['√vid: To know / Experience', 'Paṭisaṁvedī = fully experiencing'] },
            { id: 'at1s6', text: 'ī', type: 'suffix', tooltips: ['One who experiences'] },
          ],
          senses: [
            { english: 'experiencing the whole body', nuance: 'Physical body' },
            { english: 'experiencing the whole breath', nuance: 'Breath-body' },
            { english: 'sensitive to the entire form', nuance: 'Full awareness' },
          ],
        },
        {
          id: 'at2',
          wordClass: 'content',
          segments: [
            { id: 'at2s1', text: 'assas', type: 'root', tooltips: ['Breathing in'] },
            { id: 'at2s2', text: 'issāmī', type: 'suffix', tooltips: ['Future tense 1st person: "I will"', 'Intentional: setting up training'] },
          ],
          senses: [{ english: 'I will breathe in', nuance: 'Resolution' }],
        },
        {
          id: 'at3',
          wordClass: 'function',
          segments: [
            { id: 'at3s1', text: 'ti', type: 'stem', tooltips: ['Quote marker'] },
          ],
          senses: [{ english: '—', nuance: 'Quote' }],
        },
        {
          id: 'at4',
          wordClass: 'content',
          segments: [
            { id: 'at4s1', text: 'sikkh', type: 'root', tooltips: ['√śikṣ: To train / Practice / Learn', '📝 SHIFT from pajānāti to sikkhati!', '• Pajānāti = simple knowing (4.4-4.5)', '• Sikkhati = active TRAINING (4.6-4.7)', 'From observation → cultivation', 'This is deliberate practice'] },
            { id: 'at4s2', text: 'ati', type: 'suffix', tooltips: ['Present tense: "trains"'] },
          ],
          senses: [
            { english: 'trains', nuance: 'Practices' },
            { english: 'learns', nuance: 'Develops' },
            { english: 'cultivates', nuance: 'Active work' },
          ],
        },
      ],
      englishStructure: [
        { id: 'eat4', linkedSegmentId: 'at4s1' },
        { id: 'eat4g', label: ':', isGhost: true, ghostKind: 'required' },
        { id: 'eat1', linkedPaliId: 'at1' },
        { id: 'eat2g', label: 'I will', isGhost: true, ghostKind: 'required' },
        { id: 'eat2', linkedSegmentId: 'at2s1' },
      ],
    },

    // mn10:4.7 - Stilling the body-formation
    // 'Passambhayaṁ kāyasaṅkhāraṁ assasissāmī'ti sikkhati,
    // 'passambhayaṁ kāyasaṅkhāraṁ passasissāmī'ti sikkhati.
    {
      id: 'phase-au',
      paliWords: [
        {
          id: 'au1',
          wordClass: 'content',
          segments: [
            { id: 'au1s1', text: 'Passamb', type: 'root', tooltips: ['√śram (Pali √sambh): To become calm', 'Passambhati = stills, calms, tranquilizes', 'Related to passaddhi (tranquility)', '🧘 The breath naturally becomes subtle'] },
            { id: 'au1s2', text: 'hayaṁ', type: 'suffix', tooltips: ['Causative present participle', '"While causing to calm" / "stilling"', 'Active cultivation of tranquility'] },
          ],
          senses: [
            { english: 'stilling', nuance: 'Calming' },
            { english: 'tranquilizing', nuance: 'Pacifying' },
            { english: 'letting settle', nuance: 'Allowing calm' },
          ],
        },
        {
          id: 'au2',
          wordClass: 'content',
          segments: [
            { id: 'au2s1', text: 'kāya', type: 'root', tooltips: ['Kāya: Body'] },
            { id: 'au2s2', text: 'saṅkhār', type: 'root', tooltips: ['⚙️ Saṅkhāra: Formation / Fabrication', '√kṛ: To make/do + saṁ: together', 'Kāyasaṅkhāra = body-formation', '📜 DEFINED in suttas as:', '"The in-breath & out-breath are', 'kāyasaṅkhāra" (MN 44)', 'Breath = that which shapes/conditions', 'the physical body'] },
            { id: 'au2s3', text: 'aṁ', type: 'suffix', tooltips: ['Accusative — object of stilling'] },
          ],
          senses: [
            { english: 'the bodily formation', nuance: 'What conditions body' },
            { english: 'the breath', nuance: 'Sutta definition' },
            { english: 'physical fabrication', nuance: 'Conditioning factor' },
          ],
        },
        {
          id: 'au3',
          wordClass: 'content',
          segments: [
            { id: 'au3s1', text: 'assas', type: 'root', tooltips: ['Breathing in'] },
            { id: 'au3s2', text: 'issāmī', type: 'suffix', tooltips: ['Future 1st person'] },
          ],
          senses: [{ english: 'I will breathe in', nuance: 'Intention' }],
        },
        {
          id: 'au4',
          wordClass: 'function',
          segments: [
            { id: 'au4s1', text: 'ti', type: 'stem', tooltips: ['Quote marker'] },
          ],
          senses: [{ english: '—', nuance: 'Quote' }],
        },
        {
          id: 'au5',
          wordClass: 'content',
          segments: [
            { id: 'au5s1', text: 'sikkh', type: 'root', tooltips: ['√śikṣ: To train'] },
            { id: 'au5s2', text: 'ati', type: 'suffix', tooltips: ['Present tense'] },
          ],
          senses: [{ english: 'trains', nuance: 'Practices' }],
        },
      ],
      englishStructure: [
        { id: 'eau5', linkedSegmentId: 'au5s1' },
        { id: 'eau5g', label: ':', isGhost: true, ghostKind: 'required' },
        { id: 'eau1', linkedSegmentId: 'au1s1' },
        { id: 'eau2', linkedPaliId: 'au2' },
        { id: 'eau3g', label: 'I will', isGhost: true, ghostKind: 'required' },
        { id: 'eau3', linkedSegmentId: 'au3s1' },
      ],
    },
  ],
};

import type { DeepLoomPacket } from '../../types/suttaStudio';

export const DEMO_PACKET_MN10: DeepLoomPacket = {
  packetId: 'demo-mn10',
  source: { provider: 'suttacentral', workId: 'mn10' },
  canonicalSegments: [],
  citations: [],
  progress: {
    totalPhases: 51,
    readyPhases: 51,
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
      // mn10:1.1 — "Evaṁ me sutaṁ—"
      // Voice of Ven. Ānanda reciting at the First Council after Buddha's passing.
      // Literal: "Thus by me [it has been] heard." (Passive construction)
      // Implied: "I recite this exactly as I remember; I add nothing."
      id: 'phase-a',
      paliWords: [
        {
          id: 'a1',
          wordClass: 'function',
          segments: [
            { id: 'a1s1', text: 'eva', type: 'stem', tooltips: ['[Emphatic particle] "Just so"', 'Points back to the occasion'] },
            { id: 'a1s2', text: 'ṁ', type: 'suffix', tooltips: ['[Adverbial ending] Makes it "in this way"'] },
          ],
          senses: [{ english: 'Thus', nuance: 'Refers to what follows' }],
        },
        {
          id: 'a2',
          wordClass: 'function',
          segments: [
            { id: 'a2s1', text: 'me', type: 'stem', tooltips: ['Ānanda speaking: "by me"', '[Genitive/Agent] Form is "of me", function is "by me"'], relation: { targetWordId: 'a3', type: 'action', label: 'Heard BY' } },
          ],
          senses: [
            { english: 'by me', nuance: 'Agent in passive' },
          ],
        },
        {
          id: 'a3',
          wordClass: 'content',
          segments: [
            { id: 'a3s1', text: 'su', type: 'root', tooltips: ['√su: To hear (suṇāti)', 'The act of receiving teaching'] },
            { id: 'a3s2', text: 'ta', type: 'suffix', tooltips: ['[Past participle] Marks completed action: "heard"'] },
            { id: 'a3s3', text: 'ṁ', type: 'suffix', tooltips: ['[Neuter singular] "the thing that..."', 'Makes it the subject of the sentence'] },
          ],
          senses: [
            { english: 'heard', nuance: 'Past participle' },
            { english: 'what was heard', nuance: 'The teaching itself' },
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
      // mn10:1.2 (part 1) — "ekaṁ samayaṁ bhagavā..."
      // Standard sutta opening: "At one time the Blessed One..."
      // ekaṁ samayaṁ = Accusative of Time (adverbial phrase, not direct object)
      id: 'phase-b',
      paliWords: [
        {
          id: 'b1',
          wordClass: 'function',
          segments: [
            { id: 'b1s1', text: 'eka', type: 'stem', tooltips: ['[Adjective] One, a certain', 'Modifies samayaṁ'] },
            { id: 'b1s2', text: 'ṁ', type: 'suffix', tooltips: ['[Accusative of Time] "at/on"', 'Tells us when, not what'] },
          ],
          senses: [{ english: 'one', nuance: 'At one (time)' }],
        },
        {
          id: 'b2',
          wordClass: 'content',
          segments: [
            { id: 'b2s1', text: 'sam', type: 'prefix', tooltips: ['[Prefix] Together, completely', 'Not a root!'] },
            { id: 'b2s2', text: 'aya', type: 'root', tooltips: ['From √i: to go', 'aya = going, course', 'sam + aya = "a coming together"'] },
            { id: 'b2s3', text: 'ṁ', type: 'suffix', tooltips: ['[Accusative of Time] "At this occasion"'] },
          ],
          senses: [
            { english: 'occasion', nuance: 'A coming together' },
            { english: 'time', nuance: 'The specific event' },
          ],
        },
        {
          id: 'b3',
          wordClass: 'content',
          refrainId: 'bhagava',
          segments: [
            { id: 'b3s1', text: 'bhaga', type: 'root', tooltips: ['Fortune, good luck', 'From √bhaj: to share'] },
            { id: 'b3s2', text: 'vā', type: 'suffix', tooltips: ['[Possessive suffix] "One who has..."', 'The Fortunate One'] },
          ],
          senses: [
            { english: 'the Blessed One', nuance: 'Standard' },
            { english: 'the Fortunate One', nuance: 'Literal' },
          ],
        },
      ],
      englishStructure: [
        { id: 'eb1g', label: 'At', isGhost: true, ghostKind: 'required' },
        { id: 'eb1', linkedPaliId: 'b1' },
        { id: 'eb2', linkedSegmentId: 'b2s2' },
        { id: 'eb3', linkedSegmentId: 'b3s1' },
      ],
    },
    {
      // mn10:1.2 (part 2) — "...kurūsu viharati..."
      // "was dwelling among the Kurus" (historical present in Pali)
      id: 'phase-c',
      paliWords: [
        {
          id: 'c1',
          wordClass: 'content',
          segments: [
            { id: 'c1s1', text: 'kurū', type: 'stem', tooltips: ['[Stem] Kuru (the Kuru people)', 'Lengthened to kurū before -su', 'One of 16 Great Nations (mahājanapada)'] },
            { id: 'c1s2', text: 'su', type: 'suffix', tooltips: ['[Locative Plural] Where it happens', '"Among the..."'], relation: { targetWordId: 'c2', type: 'location', label: 'Dwelling IN' } },
          ],
          senses: [
            { english: 'among the Kurus', nuance: 'Location' },
          ],
        },
        {
          id: 'c2',
          wordClass: 'content',
          segments: [
            { id: 'c2s1', text: 'vi', type: 'prefix', tooltips: ['[Prefix] Apart, asunder', 'Changes √hṛ meaning', 'vi + hṛ = to dwell'] },
            { id: 'c2s2', text: 'har', type: 'root', tooltips: ['√hṛ: to carry, hold', 'With vi-: to dwell, abide', 'Also: to live, behave'] },
            { id: 'c2s3', text: 'a', type: 'suffix', tooltips: ['[Thematic vowel] Class I verb marker'] },
            { id: 'c2s4', text: 'ti', type: 'suffix', tooltips: ['[Present 3rd singular] He/she/it', 'Pali tells past events in present', 'Translates as: "was dwelling"'] },
          ],
          senses: [
            { english: 'was dwelling', nuance: 'Historical present' },
            { english: 'was staying', nuance: 'Sojourning' },
          ],
        },
      ],
      englishStructure: [
        { id: 'ec2', linkedSegmentId: 'c2s2' },
        { id: 'ec1', linkedSegmentId: 'c1s1' },
      ],
    },
    {
      // mn10:1.2 (part 3) — "...kammāsadhammaṁ nāma kurūnaṁ nigamo."
      // "a market town of the Kurus named Kammāsadhamma"
      id: 'phase-d',
      paliWords: [
        {
          id: 'd1',
          wordClass: 'content',
          segments: [
            { id: 'd1s1', text: 'Kammāsa', type: 'stem', tooltips: ['Spotted / Speckled', 'Name of a man-eating ogre (porisāda)', 'From Jātaka: King Kammāsapāda'] },
            { id: 'd1s2', text: 'dhamma', type: 'stem', tooltips: ['Likely from √dam: to tame', 'Where the ogre was "tamed"', 'Sanskritized spelling: dhamma'] },
            { id: 'd1s3', text: 'ṁ', type: 'suffix', tooltips: ['Name ending', 'Labels the town that follows'] },
          ],
          senses: [
            { english: 'Kammāsadhamma', nuance: 'Place name' },
            { english: '"Where the Spotted One was Tamed"', nuance: 'Etymology' },
          ],
        },
        {
          id: 'd2',
          wordClass: 'function',
          segments: [
            { id: 'd2s1', text: 'nāma', type: 'stem', tooltips: ['[Indeclinable] "named, by name"', 'Links proper name to common noun', '"X nāma Y" = "Y named X"'] },
          ],
          senses: [
            { english: 'named', nuance: 'Called' },
          ],
        },
        {
          id: 'd3',
          wordClass: 'content',
          segments: [
            { id: 'd3s1', text: 'kurū', type: 'stem', tooltips: ['[Stem] Kuru (the Kuru people)', 'Lengthened to kurū before -naṁ'] },
            { id: 'd3s2', text: 'naṁ', type: 'suffix', tooltips: ['[Genitive Plural] Possession', '"Of the Kurus" — their town'], relation: { targetWordId: 'd4', type: 'ownership', label: 'Town OF' } },
          ],
          senses: [
            { english: 'of the Kurus', nuance: 'Genitive Plural' },
          ],
        },
        {
          id: 'd4',
          wordClass: 'content',
          segments: [
            { id: 'd4s1', text: 'ni', type: 'prefix', tooltips: ['[Prefix] Down / Into', 'Where people go down to'] },
            { id: 'd4s2', text: 'gam', type: 'root', tooltips: ['√gam: to go', 'Place people resort to (for trade)'] },
            { id: 'd4s3', text: 'o', type: 'suffix', tooltips: ['[Nominative Singular] Subject marker', '"A town" — what we are talking about'] },
          ],
          senses: [
            { english: 'a market town', nuance: 'Larger than gāma (village)' },
            { english: 'a township', nuance: 'Smaller than nagara (city)' },
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
      // mn10:1.3 — "Tatra kho bhagavā bhikkhū āmantesi:"
      // "There the Blessed One addressed the bhikkhus:"
      id: 'phase-e',
      paliWords: [
        {
          id: 'e1',
          wordClass: 'function',
          segments: [
            { id: 'e1s1', text: 'ta', type: 'stem', tooltips: ['[Demonstrative] Stem: that', 'Points to the place just mentioned'] },
            { id: 'e1s2', text: 'tra', type: 'suffix', tooltips: ['[Locative suffix] "in that place"', 'ta + tra = tatra'] },
          ],
          senses: [{ english: 'There', nuance: 'At that place' }],
        },
        {
          id: 'e2',
          wordClass: 'function',
          segments: [
            { id: 'e2s1', text: 'kho', type: 'stem', tooltips: ['[Emphatic particle] "Indeed, surely"', 'From khalu', 'Marks narrative transition'] },
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
            { id: 'e3s1', text: 'bhaga', type: 'root', tooltips: ['Fortune, good luck', 'From √bhaj: to share'] },
            { id: 'e3s2', text: 'vā', type: 'suffix', tooltips: ['[Possessive suffix] "One who has..."', 'The Fortunate One'], relation: { targetWordId: 'e5', type: 'action', label: 'Addressed BY' } },
          ],
          senses: [{ english: 'the Blessed One', nuance: 'Subject' }],
        },
        {
          id: 'e4',
          wordClass: 'content',
          refrainId: 'bhikkhu',
          segments: [
            { id: 'e4s1', text: 'bhikkh', type: 'root', tooltips: ['√bhikkh: to beg', 'From √bhaj: to share', 'One who lives on alms'] },
            { id: 'e4s2', text: 'ū', type: 'suffix', tooltips: ['[Accusative Plural] Object', 'The ones being addressed'], relation: { targetWordId: 'e5', type: 'direction', label: 'Addressed TO' } },
          ],
          senses: [
            { english: 'the bhikkhus', nuance: 'Accusative object' },
            { english: 'the monks', nuance: 'Standard' },
          ],
        },
        {
          id: 'e5',
          wordClass: 'content',
          segments: [
            { id: 'e5s1', text: 'ā', type: 'prefix', tooltips: ['[Prefix] Towards', 'Intensifies the action'] },
            { id: 'e5s2', text: 'mant', type: 'root', tooltips: ['√mant: to counsel, advise', 'Source of "mantra"', '[Denominative verb] From noun "mantra"'] },
            { id: 'e5s3', text: 'e', type: 'suffix', tooltips: ['[Causative suffix] Makes it "to address"'] },
            { id: 'e5s4', text: 'si', type: 'suffix', tooltips: ['[Aorist 3rd singular] Past tense: he did this', '"He addressed"'] },
          ],
          senses: [
            { english: 'addressed', nuance: 'Aorist' },
            { english: 'summoned', nuance: 'Called to attention' },
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
            { id: 'f1s2', text: 'avo', type: 'suffix', tooltips: ['[Vocative Plural] 📢 "Hey you all!"', 'Calling out to a group', 'Like saying "O monks!"'] },
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
            { id: 'f2s1', text: 'ti', type: 'stem', tooltips: ['[Quotation marker] From iti', 'End of speech'] },
          ],
          senses: [{ english: '"', nuance: 'Quote marker' }],
        },
      ],
      englishStructure: [
        { id: 'ef1', linkedSegmentId: 'f1s1' },
      ],
    },
    {
      // mn10:1.5 — "Bhadante"ti te bhikkhū bhagavato paccassosuṁ.
      // "Venerable sir!" the bhikkhus replied to the Blessed One.
      id: 'phase-g',
      paliWords: [
        {
          id: 'g1',
          wordClass: 'content',
          segments: [
            { id: 'g1s1', text: 'Bhad', type: 'root', tooltips: ['√bhad: good, auspicious', 'Related to bhadra (fortunate)'] },
            { id: 'g1s2', text: 'ante', type: 'suffix', tooltips: ['[Vocative] Calling out: "O Sir!"', 'Respectful address'] },
          ],
          senses: [
            { english: 'Venerable sir!', nuance: 'Respectful reply' },
          ],
        },
        {
          id: 'g2',
          wordClass: 'function',
          segments: [
            { id: 'g2s1', text: 'ti', type: 'stem', tooltips: ['[Quotation marker] From iti', 'Marks the speech just ended'] },
          ],
          senses: [{ english: '"', nuance: 'Close quote' }],
        },
        {
          id: 'g3',
          wordClass: 'function',
          segments: [
            { id: 'g3s1', text: 'te', type: 'stem', tooltips: ['[Demonstrative Pronoun] Those, they', 'The ones who replied'] },
          ],
          senses: [{ english: 'those', nuance: 'Demonstrative' }],
        },
        {
          id: 'g4',
          wordClass: 'content',
          refrainId: 'bhikkhu',
          segments: [
            { id: 'g4s1', text: 'bhikkh', type: 'root', tooltips: ['√bhikkh: to beg, share', 'One who lives on alms'] },
            { id: 'g4s2', text: 'ū', type: 'suffix', tooltips: ['[Nominative Plural] They', 'The monks who replied'], relation: { targetWordId: 'g6', type: 'action', label: 'Replied BY' } },
          ],
          senses: [{ english: 'bhikkhus', nuance: 'Subject' }],
        },
        {
          id: 'g5',
          wordClass: 'content',
          refrainId: 'bhagava',
          segments: [
            { id: 'g5s1', text: 'bhaga', type: 'root', tooltips: ['Fortune, good luck', 'From √bhaj: to share'] },
            { id: 'g5s2', text: 'vato', type: 'suffix', tooltips: ['[Dative/Genitive] "To/of the Fortunate One"', 'Who they replied to'], relation: { targetWordId: 'g6', type: 'direction', label: 'Replied TO' } },
          ],
          senses: [
            { english: 'to the Blessed One', nuance: 'Dative' },
          ],
        },
        {
          id: 'g6',
          wordClass: 'content',
          segments: [
            { id: 'g6s1', text: 'pacc', type: 'prefix', tooltips: ['[Prefix] From paṭi: back, in return', 'Sandhi before vowel'] },
            { id: 'g6s2', text: 'assosuṁ', type: 'root', tooltips: ['√su: to hear', '[Aorist 3rd plural] "they heard back"', 'paṭi + su = to reply'] },
          ],
          senses: [
            { english: 'replied', nuance: 'Assented' },
            { english: 'answered', nuance: 'Responded' },
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
      // mn10:1.6 — "Bhagavā etadavoca:"
      // "The Blessed One said this:" — introduces the main teaching
      // Note: "etadavoca" is one word in manuscript (sandhi), split here for clarity
      id: 'phase-h',
      paliWords: [
        {
          id: 'h1',
          wordClass: 'content',
          refrainId: 'bhagava',
          segments: [
            { id: 'h1s1', text: 'Bhaga', type: 'root', tooltips: ['Fortune, good luck', 'From √bhaj: to share'] },
            { id: 'h1s2', text: 'vā', type: 'suffix', tooltips: ['[Possessive suffix] "One who has..."', '[Nominative] Subject — the speaker'], relation: { targetWordId: 'h3', type: 'action', label: 'Said BY' } },
          ],
          senses: [{ english: 'The Blessed One', nuance: 'Subject' }],
        },
        {
          id: 'h2',
          wordClass: 'function',
          segments: [
            { id: 'h2s1', text: 'etad', type: 'stem', tooltips: ['[Demonstrative Pronoun] "This"', '[Neuter Accusative] Points to what follows', 'More emphatic than "tad"'], relation: { targetWordId: 'h3', type: 'direction', label: 'Said WHAT' } },
          ],
          senses: [{ english: 'this', nuance: 'The teaching that follows' }],
        },
        {
          id: 'h3',
          wordClass: 'content',
          segments: [
            { id: 'h3s1', text: 'a', type: 'prefix', tooltips: ['[Augment] Marks past tense', 'Like "a-" in Greek aorist'] },
            { id: 'h3s2', text: 'voc', type: 'root', tooltips: ['√vac: To speak, say', 'Source of Latin "vox", English "voice"'] },
            { id: 'h3s3', text: 'a', type: 'suffix', tooltips: ['[Aorist 3rd singular] He spoke', 'Completed action in the past'] },
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
              tooltips: ['[Adjective] One, singular', 'Also: alone, unified'],
            },
            { id: 'p1s2', text: 'āyan', type: 'stem', tooltips: ['From √i: to go', 'āyana = going, way, goal'], relation: { targetWordId: 'p4', type: 'ownership', label: 'Way TO' } },
            { id: 'p1s3', text: 'o', type: 'suffix', tooltips: ['[Nominative Singular] Subject marker'] },
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
              tooltips: ['[Demonstrative Pronoun] "This"', '[Nominative Masculine Singular] From stem ima', 'Points to maggo (the path)'],
              relation: { targetWordId: 'p4', type: 'direction', label: 'This IS' },
            },
          ],
          senses: [{ english: 'this', nuance: 'Pointer to the path' }],
        },
        {
          id: 'p3',
          wordClass: 'content',
          refrainId: 'bhikkhu',
          segments: [
            { id: 'p3s1', text: 'Bhikkh', type: 'root', tooltips: ['√bhikkh: To share / beg', 'One who lives on alms'] },
            { id: 'p3s2', text: 'ave', type: 'suffix', tooltips: ['[Vocative Plural] 📢 "O monks!"', 'Calling out to the group'] },
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
          segments: [
            { id: 'p4s1', text: 'magg', type: 'root', tooltips: ['√magg: to track, seek', 'A road, way, path'] },
            { id: 'p4s2', text: 'o', type: 'suffix', tooltips: ['[Nominative Singular] Subject marker'] },
          ],
          senses: [{ english: 'path', nuance: 'The way' }],
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
                'From sat/sant: existing, being',
                'Also √saj: to cling (the "stuck" ones)',
                'Also satta: seven (7)',
              ],
            },
            {
              id: 'p5s2',
              text: 'ānaṁ',
              type: 'suffix',
              tooltips: ['[Genitive Plural] Of beings', '🔗 Shows who it belongs to'],
              relation: { targetWordId: 'p6', type: 'ownership', label: 'Purification OF' },
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
            { id: 'p6s1', text: 'vi', type: 'prefix', tooltips: ['[Prefix] Intensive / completely'] },
            { id: 'p6s2', text: 'suddhi', type: 'root', tooltips: ['√sudh: Purity, brightness', '✨ To be clean, clear'] },
            { id: 'p6s3', text: 'yā', type: 'suffix', tooltips: ['[Dative] For the sake of', '🎯 Purpose marker'] },
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
            { id: 'p7s1', text: 'soka', type: 'root', tooltips: ['√suc: Burning, drying up', '😢 Grief, sorrow'] },
            { id: 'p7s2', text: 'parideva', type: 'root', tooltips: ['[Compound] pari + deva', '😭 Crying out all around, lamentation'] },
            {
              id: 'p7s3',
              text: 'ānaṁ',
              type: 'suffix',
              tooltips: ['[Genitive Plural] Of grief & lamentation'],
              relation: { targetWordId: 'p8', type: 'ownership', label: 'Surmounting OF' },
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
            { id: 'p8s1', text: 'sam', type: 'prefix', tooltips: ['[Prefix] Together, completely'] },
            { id: 'p8s2', text: 'ati', type: 'prefix', tooltips: ['[Prefix] Over, beyond'] },
            { id: 'p8s3', text: 'kkam', type: 'root', tooltips: ['√kram: To step, stride', '🌊 Crossing over'] },
            { id: 'p8s4', text: 'āya', type: 'suffix', tooltips: ['[Dative] For the sake of', '🎯 Purpose marker'] },
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
            { id: 'p9s1', text: 'dukkha', type: 'root', tooltips: ['[Compound] du (bad) + kha (space)', 'Physical pain, suffering'] },
            { id: 'p9s2', text: 'domanass', type: 'root', tooltips: ['[Compound] du (bad) + manas (mind)', 'Mental distress, displeasure'] },
            {
              id: 'p9s3',
              text: 'ānaṁ',
              type: 'suffix',
              tooltips: ['[Genitive Plural] Of pain & distress'],
              relation: { targetWordId: 'p10', type: 'ownership', label: 'Ending OF' },
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
            { id: 'p10s1', text: 'atthaṅ', type: 'root', tooltips: ['From √as: to set (like the sun)', 'Home, setting, disappearing'] },
            { id: 'p10s2', text: 'gam', type: 'root', tooltips: ['√gam: to go', 'atthaṅgama = going to its setting'] },
            { id: 'p10s3', text: 'āya', type: 'suffix', tooltips: ['[Dative] For the sake of', '🎯 Purpose marker'] },
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
            { id: 'p11s1', text: 'ñāya', type: 'root', tooltips: ['√ñā: to know', 'Method, system, right way, truth'] },
            {
              id: 'p11s2',
              text: 'ssa',
              type: 'suffix',
              tooltips: ['[Genitive Singular] Of the method'],
              relation: { targetWordId: 'p12', type: 'ownership', label: 'Attainment OF' },
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
            { id: 'p12s1', text: 'adhi', type: 'prefix', tooltips: ['[Prefix] Onto, towards, over'] },
            { id: 'p12s2', text: 'gam', type: 'root', tooltips: ['√gam: to go', 'adhigama = reaching, attaining'] },
            { id: 'p12s3', text: 'āya', type: 'suffix', tooltips: ['[Dative] For the sake of', '🎯 Purpose marker'] },
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
            { id: 'p13s1', text: 'nibbān', type: 'root', tooltips: ['ni (out) + vāna (blowing)', '🕯️ Fire going out, cooling, peace'] },
            {
              id: 'p13s2',
              text: 'assa',
              type: 'suffix',
              tooltips: ['[Genitive Singular] Of Nibbana'],
              relation: { targetWordId: 'p14', type: 'ownership', label: 'Realization OF' },
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
            { id: 'p14s1', text: 'sacchi', type: 'root', tooltips: ['[Compound] sa + akkhi (with eyes)', '👀 Seeing directly, witnessing'] },
            { id: 'p14s2', text: 'kiriy', type: 'root', tooltips: ['√kṛ: to do, make', 'Making real, accomplishing'] },
            { id: 'p14s3', text: 'āya', type: 'suffix', tooltips: ['[Dative] For the sake of', '🎯 Purpose marker'] },
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
            { id: 'p15s1', text: 'yad', type: 'root', tooltips: ['[Relative Pronoun] Which, what'] },
            { id: 'p15s2', text: 'idaṁ', type: 'root', tooltips: ['[Demonstrative] This', 'yad + idaṁ = "namely, that is to say"'] },
          ],
          senses: [{ english: 'namely', nuance: 'Introduces what follows' }],
        },
        {
          id: 'p16',
          wordClass: 'content',
          segments: [{ id: 'p16s1', text: 'cattāro', type: 'stem', tooltips: ['[Numeral] Four (4)', '[Nominative Plural Masculine]'] }],
          senses: [{ english: 'the four', nuance: 'Quantity' }],
        },
        {
          id: 'p17',
          wordClass: 'content',
          segments: [
            { id: 'p17s1', text: 'sati', type: 'root', tooltips: ['√smṛ: to remember', '💭 Mindfulness, presence, awareness'] },
            { id: 'p17s2', text: 'paṭṭhānā', type: 'root', tooltips: ['[Compound] paṭi + √sthā: to stand', 'Establishing, foundation, setting up'] },
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
            { id: 'ap1s2', text: 'mukh', type: 'root', tooltips: ['Mukha: Face / Mouth / Front', '📍 THREE INTERPRETATIONS:', '🏛️ Vibhaṅga: Nose-tip (nāsikagge)', '  or upper lip (uttaroṭṭhe)', '  "Long-nosed man" = nostril tip', '  "Short-nosed man" = upper lip', '📖 Vinaya: "To the fore"', '  = mental priority, not location', '  (Cv.V.27.4 uses for "chest")', '🧘 Synthesis: Anchor → Expand', '  Face region → then sabbakāya'] },
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
            { id: 'aq4s1', text: 'assas', type: 'root', tooltips: ['🌬️ Ā + √śvas: To breathe in', 'Sanskrit āśvas → Pali assasati', 'Ā = towards (ad-spirare in Latin)', '⚡ WHY IN-BREATH FIRST?', '• Primacy of intake — receiving life', '• In-breath = arising, energizing', '• Out-breath = cessation, release', '📜 Note: Vinaya commentary INVERTS', '  these (assāsa = out), but Suttas', '  & etymology support in-first'] },
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
            { id: 'aq5s1', text: 'passas', type: 'root', tooltips: ['🌬️ Pra + √śvas: To breathe out', 'Sanskrit praśvas → Pali passasati', 'Pra = forth (pro-spirare in Latin)', '• Release phase of the cycle', '• Calming, letting go', '• Leads to passambhayaṁ (stilling)'] },
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
            { id: 'ar1s1', text: 'Dīgh', type: 'root', tooltips: ['Dīgha: Long (in space or time)', 'Sanskrit dīrgha', '🌬️ A long, slow breath', '🪵 TURNER SIMILE (bhamakāra):', 'Like a skilled lathe-turner who', '"making a long turn, knows I make', 'a long turn" — active, sensitive', 'knowing, not passive watching'] },
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
            { id: 'ar6s2', text: 'jān', type: 'root', tooltips: ['🧠 √jñā: To know', 'Pajānāti = discriminative knowing', '📝 DESCRIPTIVE MODE:', '• The breath IS moving', '• Meditator DISCERNS its quality', '• Foundation of vipassanā:', '  seeing anicca (change) in breath', '⚠️ Note: Steps 1-2 use pajānāti', '  Steps 3-4 shift to SIKKHATI'] },
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
        { id: 'ear4g', label: '"I breathe in long"', isGhost: true, ghostKind: 'interpretive' },
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
            { id: 'as1s1', text: 'Rass', type: 'root', tooltips: ['Rassa: Short (in space or time)', 'Sanskrit hrasva', '🌬️ A short, quick breath', '🪵 Turner "making a short turn"', 'Ancient reciprocating bow-lathe:', 'back-forth mirrors in-out breath', 'The turner knows through DOING'] },
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
        { id: 'eas4g', label: '"I breathe in short"', isGhost: true, ghostKind: 'interpretive' },
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
            { id: 'at1s2', text: 'kāya', type: 'root', tooltips: ['⚡ THREE TRADITIONS:', '🏛️ Visuddhimagga: "breath-body"', '  = whole breath at nostril', '  Purpose: nimitta for jhāna', '📜 Sutta (MN119): "physical body"', '  = body pervaded like bathman', '  kneading soap-ball with water', '📚 Sarvastivāda: "all bodies"', '  = mental + physical groups', 'Each has methodological merit'] },
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
            { id: 'at4s1', text: 'sikkh', type: 'root', tooltips: ['√śikṣ: To train / Practice / Learn', '📝 PRESCRIPTIVE MODE:', '• Pajānāti (4.4-4.5) = descriptive', '• Sikkhati (4.6-4.7) = prescriptive', '⚡ KEY INDICATORS:', '• Future tense (assasissāmī)', '• Intentional cultivation', '• Same verb as monastic precepts:', '  sikkhāpada = training rules', 'Active shaping, not just watching'] },
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
            { id: 'au1s1', text: 'Passamb', type: 'root', tooltips: ['√śram (Pali √sambh): To become calm', 'Passambhati = stills, tranquilizes', 'Related to passaddhi (tranquility)', '🧘 The breath naturally becomes subtle', '⚡ GOAL: As body relaxes,', 'breath requires less oxygen,', 'naturally slows → deep calm'] },
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
            { id: 'au2s2', text: 'saṅkhār', type: 'root', tooltips: ['⚙️ Saṅkhāra: Formation / Fabrication', '√kṛ: To make/do + saṁ: together', '📜 MN 44 Cūḷavedalla defines:', '"In-breaths & out-breaths are', 'kāyasaṅkhāra because they are', 'bodily, bound up with the body"', '🔄 FEEDBACK LOOP:', '• Calm attention → calm breath', '• Calm breath → calm body', '• Trajectory: 4th jhāna = breath', '  ceases entirely (niruddha)'] },
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

    // mn10:4.8-4.9 - Turner simile (bhamakāra upamā)
    // Seyyathāpi, bhikkhave, dakkho bhamakāro vā bhamakārantevāsī vā
    // dīghaṁ vā añchanto 'dīghaṁ añchāmī'ti pajānāti,
    // rassaṁ vā añchanto 'rassaṁ añchāmī'ti pajānāti;
    {
      id: 'phase-av',
      paliWords: [
        {
          id: 'av1',
          wordClass: 'function',
          segments: [
            { id: 'av1s1', text: 'Seyyathā', type: 'stem', tooltips: ['Seyyathā: Just as / Like', 'Introduces a simile (upamā)', 'Pedagogical device for meditation'] },
            { id: 'av1s2', text: 'pi', type: 'suffix', tooltips: ['Api: Also / Even', 'Emphatic particle'] },
          ],
          senses: [{ english: 'just as', nuance: 'Simile marker' }],
        },
        {
          id: 'av2',
          wordClass: 'function',
          segments: [
            { id: 'av2s1', text: 'bhikkha', type: 'root', tooltips: ['Bhikkhu: Monk'] },
            { id: 'av2s2', text: 've', type: 'suffix', tooltips: ['Vocative plural'] },
          ],
          senses: [{ english: 'monks', nuance: 'Address' }],
        },
        {
          id: 'av3',
          wordClass: 'content',
          segments: [
            { id: 'av3s1', text: 'dakkh', type: 'root', tooltips: ['Dakkha: Skilled / Expert', 'Sanskrit dakṣa', '📝 The turner is not a passive', 'observer — he is a craftsman', 'with developed sensitivity'] },
            { id: 'av3s2', text: 'o', type: 'suffix', tooltips: ['Nominative singular'] },
          ],
          senses: [
            { english: 'skilled', nuance: 'Expert' },
            { english: 'dexterous', nuance: 'Trained' },
          ],
        },
        {
          id: 'av4',
          wordClass: 'content',
          segments: [
            { id: 'av4s1', text: 'bhama', type: 'root', tooltips: ['🪵 Bhama: Lathe / Turning-wheel', 'From √bhram: to turn, rotate', 'Ancient reciprocating bow-lathe:', 'Turner pulls strap back-forth', 'to spin the wood — mirrors', 'the in-out rhythm of breath'] },
            { id: 'av4s2', text: 'kār', type: 'root', tooltips: ['√kṛ: Maker / Doer', 'Bhamakāra = "lathe-worker"', 'A turner who shapes wood'] },
            { id: 'av4s3', text: 'o', type: 'suffix', tooltips: ['Nominative singular'] },
          ],
          senses: [
            { english: 'turner', nuance: 'Craftsman' },
            { english: 'lathe-worker', nuance: 'Literal' },
          ],
        },
        {
          id: 'av5',
          wordClass: 'function',
          segments: [
            { id: 'av5s1', text: 'vā', type: 'stem', tooltips: ['Or'] },
          ],
          senses: [{ english: 'or', nuance: 'Alternative' }],
        },
        {
          id: 'av6',
          wordClass: 'content',
          segments: [
            { id: 'av6s1', text: 'bhama', type: 'root', tooltips: ['Lathe'] },
            { id: 'av6s2', text: 'kār', type: 'root', tooltips: ['Maker'] },
            { id: 'av6s3', text: 'ante', type: 'stem', tooltips: ['Anta: End / Near', 'Antevāsī = one who dwells near', '= apprentice (learning close by)'] },
            { id: 'av6s4', text: 'vās', type: 'root', tooltips: ['√vas: To dwell'] },
            { id: 'av6s5', text: 'ī', type: 'suffix', tooltips: ['Nominative singular'] },
          ],
          senses: [
            { english: "turner's apprentice", nuance: 'Student' },
            { english: 'trainee turner', nuance: 'Learning' },
          ],
        },
      ],
      englishStructure: [
        { id: 'eav1', linkedSegmentId: 'av1s1' },
        { id: 'eav3', linkedSegmentId: 'av3s1' },
        { id: 'eav4', linkedPaliId: 'av4' },
        { id: 'eav5', linkedSegmentId: 'av5s1' },
        { id: 'eav6g', label: 'his', isGhost: true, ghostKind: 'required' },
        { id: 'eav6', linkedPaliId: 'av6' },
      ],
    },

    // mn10:4.9 - Turner simile action
    // dīghaṁ vā añchanto 'dīghaṁ añchāmī'ti pajānāti
    {
      id: 'phase-aw',
      paliWords: [
        {
          id: 'aw1',
          wordClass: 'content',
          segments: [
            { id: 'aw1s1', text: 'dīgh', type: 'root', tooltips: ['Long'] },
            { id: 'aw1s2', text: 'aṁ', type: 'suffix', tooltips: ['Accusative adverbial'] },
          ],
          senses: [{ english: 'long', nuance: 'Duration' }],
        },
        {
          id: 'aw2',
          wordClass: 'function',
          segments: [
            { id: 'aw2s1', text: 'vā', type: 'stem', tooltips: ['Or'] },
          ],
          senses: [{ english: '—', nuance: 'Alternative' }],
        },
        {
          id: 'aw3',
          wordClass: 'content',
          segments: [
            { id: 'aw3s1', text: 'añch', type: 'root', tooltips: ['⚡ √añc/kṛṣ: To pull / Draw / Drag', 'The turner PULLS the strap', 'to rotate the lathe', '📝 ACTIVE AGENCY:', 'The turner MAKES the turn', '— not passive observation!', 'Knowing through doing'] },
            { id: 'aw3s2', text: 'anto', type: 'suffix', tooltips: ['Present participle: "while pulling"'] },
          ],
          senses: [
            { english: 'pulling', nuance: 'Action' },
            { english: 'drawing', nuance: 'Making turn' },
          ],
        },
        {
          id: 'aw4',
          wordClass: 'content',
          segments: [
            { id: 'aw4s1', text: 'dīgh', type: 'root', tooltips: ['Long'] },
            { id: 'aw4s2', text: 'aṁ', type: 'suffix', tooltips: ['Accusative'] },
          ],
          senses: [{ english: 'long', nuance: 'Duration' }],
        },
        {
          id: 'aw5',
          wordClass: 'content',
          segments: [
            { id: 'aw5s1', text: 'añch', type: 'root', tooltips: ['To pull'] },
            { id: 'aw5s2', text: 'āmī', type: 'suffix', tooltips: ['1st person: "I am pulling"'] },
          ],
          senses: [{ english: 'I pull', nuance: 'Self-aware action' }],
        },
        {
          id: 'aw6',
          wordClass: 'function',
          segments: [
            { id: 'aw6s1', text: 'ti', type: 'stem', tooltips: ['Quote marker'] },
          ],
          senses: [{ english: '—', nuance: 'Quote' }],
        },
        {
          id: 'aw7',
          wordClass: 'content',
          segments: [
            { id: 'aw7s1', text: 'pajān', type: 'root', tooltips: ['🧠 Knows / Discerns', '📝 The simile teaches:', 'The POINT OF COMPARISON is', 'the precision of knowing', 'The turner knows through MAKING', '→ meditator knows through', 'sensitive ENGAGEMENT'] },
            { id: 'aw7s2', text: 'āti', type: 'suffix', tooltips: ['Present tense'] },
          ],
          senses: [
            { english: 'knows', nuance: 'Understands' },
            { english: 'clearly knows', nuance: 'Direct' },
          ],
        },
      ],
      englishStructure: [
        { id: 'eaw3', linkedSegmentId: 'aw3s1' },
        { id: 'eaw1', linkedSegmentId: 'aw1s1' },
        { id: 'eaw7', linkedSegmentId: 'aw7s1' },
        { id: 'eaw5g', label: '"I pull long"', isGhost: true, ghostKind: 'interpretive' },
      ],
    },

    // mn10:4.10 - Simile application
    // evameva kho, bhikkhave, bhikkhu...
    {
      id: 'phase-ax',
      paliWords: [
        {
          id: 'ax1',
          wordClass: 'function',
          segments: [
            { id: 'ax1s1', text: 'Evam', type: 'stem', tooltips: ['Evam: Thus / In this way', 'Connects simile to practice'] },
            { id: 'ax1s2', text: 'eva', type: 'stem', tooltips: ['Eva: Just so / Exactly', 'Emphatic: "just so..."'] },
          ],
          senses: [{ english: 'just so', nuance: 'Application' }],
        },
        {
          id: 'ax2',
          wordClass: 'function',
          segments: [
            { id: 'ax2s1', text: 'kho', type: 'stem', tooltips: ['Kho: Indeed / Certainly', 'Emphatic particle'] },
          ],
          senses: [{ english: 'indeed', nuance: 'Emphasis' }],
        },
        {
          id: 'ax3',
          wordClass: 'function',
          segments: [
            { id: 'ax3s1', text: 'bhikkha', type: 'root', tooltips: ['Bhikkhu: Monk'] },
            { id: 'ax3s2', text: 've', type: 'suffix', tooltips: ['Vocative plural'] },
          ],
          senses: [{ english: 'monks', nuance: 'Address' }],
        },
        {
          id: 'ax4',
          wordClass: 'content',
          segments: [
            { id: 'ax4s1', text: 'bhikkhu', type: 'stem', tooltips: ['Bhikkhu: Monk / Practitioner', 'The one applying the simile'] },
          ],
          senses: [{ english: 'a monk', nuance: 'Practitioner' }],
        },
      ],
      englishStructure: [
        { id: 'eax1', linkedPaliId: 'ax1' },
        { id: 'eax4', linkedSegmentId: 'ax4s1' },
        { id: 'eax4g', label: 'practices', isGhost: true, ghostKind: 'interpretive' },
      ],
    },

    // mn10:4.11 - Internal/External refrain (THE REFRAIN begins)
    // Iti ajjhattaṁ vā kāye kāyānupassī viharati,
    // bahiddhā vā kāye kāyānupassī viharati,
    // ajjhattabahiddhā vā kāye kāyānupassī viharati.
    {
      id: 'phase-ay',
      paliWords: [
        {
          id: 'ay1',
          wordClass: 'function',
          segments: [
            { id: 'ay1s1', text: 'Iti', type: 'stem', tooltips: ['Iti: Thus / In this way', 'Marks transition to refrain', '🔁 THE REFRAIN BEGINS:', 'This formula repeats after', 'EVERY contemplation section'] },
          ],
          senses: [{ english: 'thus', nuance: 'Transition' }],
        },
        {
          id: 'ay2',
          wordClass: 'content',
          segments: [
            { id: 'ay2s1', text: 'ajjh', type: 'prefix', tooltips: ['Adhi: Over / Upon / Inner', 'Sanskrit adhyātma'] },
            { id: 'ay2s2', text: 'att', type: 'root', tooltips: ['Attan: Self', 'Ajjhatta = internal, within oneself', '📍 THREE SCOPES:', '• Ajjhattaṁ = one\'s own body', '• Bahiddhā = others\' bodies', '• Both = seeing universality'] },
            { id: 'ay2s3', text: 'aṁ', type: 'suffix', tooltips: ['Accusative adverbial: "internally"'] },
          ],
          senses: [
            { english: 'internally', nuance: 'Within oneself' },
            { english: 'in one\'s own', nuance: 'Personal' },
          ],
        },
        {
          id: 'ay3',
          wordClass: 'function',
          segments: [
            { id: 'ay3s1', text: 'vā', type: 'stem', tooltips: ['Or — alternative'] },
          ],
          senses: [{ english: 'or', nuance: 'Alternative' }],
        },
        {
          id: 'ay4',
          wordClass: 'content',
          segments: [
            { id: 'ay4s1', text: 'kāy', type: 'root', tooltips: ['Kāya: Body'] },
            { id: 'ay4s2', text: 'e', type: 'suffix', tooltips: ['Locative: "in the body"'] },
          ],
          senses: [{ english: 'in the body', nuance: 'Location' }],
        },
        {
          id: 'ay5',
          wordClass: 'content',
          segments: [
            { id: 'ay5s1', text: 'kāy', type: 'root', tooltips: ['Kāya: Body'] },
            { id: 'ay5s2', text: 'ānu', type: 'prefix', tooltips: ['Anu: Along / Following', 'Repeated contemplation'] },
            { id: 'ay5s3', text: 'pass', type: 'root', tooltips: ['√paś/dṛś: To see / Observe', 'Anupassī = repeatedly seeing'] },
            { id: 'ay5s4', text: 'ī', type: 'suffix', tooltips: ['Agent noun: "one who..."'] },
          ],
          senses: [
            { english: 'contemplating the body', nuance: 'Observing' },
            { english: 'body-observer', nuance: 'Agent' },
          ],
        },
        {
          id: 'ay6',
          wordClass: 'content',
          segments: [
            { id: 'ay6s1', text: 'vihar', type: 'root', tooltips: ['√hṛ + vi: To dwell / Abide', 'Viharati = lives, remains, abides', '📝 Not momentary but sustained', 'dwelling in the practice'] },
            { id: 'ay6s2', text: 'ati', type: 'suffix', tooltips: ['Present tense: "dwells"'] },
          ],
          senses: [
            { english: 'dwells', nuance: 'Abides' },
            { english: 'remains', nuance: 'Sustained' },
          ],
        },
      ],
      englishStructure: [
        { id: 'eay1', linkedSegmentId: 'ay1s1' },
        { id: 'eay1g', label: 'one', isGhost: true, ghostKind: 'required' },
        { id: 'eay6', linkedSegmentId: 'ay6s1' },
        { id: 'eay5', linkedPaliId: 'ay5' },
        { id: 'eay2', linkedPaliId: 'ay2' },
      ],
    },

    // mn10:4.11b - External contemplation
    // bahiddhā vā kāye kāyānupassī viharati
    {
      id: 'phase-az',
      paliWords: [
        {
          id: 'az1',
          wordClass: 'content',
          segments: [
            { id: 'az1s1', text: 'bahid', type: 'root', tooltips: ['Bahis: Outside / External', 'Sanskrit bahis'] },
            { id: 'az1s2', text: 'dhā', type: 'suffix', tooltips: ['Adverbial: "externally"', '📍 EXTERNAL SCOPE:', '• Others\' bodies (living beings)', '• Or: external aspects of one\'s', '  own body (skin, posture)', '🔗 Develops universal insight'] },
          ],
          senses: [
            { english: 'externally', nuance: 'Outside oneself' },
            { english: 'in others', nuance: 'Universal' },
          ],
        },
        {
          id: 'az2',
          wordClass: 'function',
          segments: [
            { id: 'az2s1', text: 'vā', type: 'stem', tooltips: ['Or'] },
          ],
          senses: [{ english: 'or', nuance: 'Alternative' }],
        },
        {
          id: 'az3',
          wordClass: 'content',
          segments: [
            { id: 'az3s1', text: 'kāye', type: 'stem', tooltips: ['In the body'] },
          ],
          senses: [{ english: 'in the body', nuance: 'Location' }],
        },
        {
          id: 'az4',
          wordClass: 'content',
          segments: [
            { id: 'az4s1', text: 'kāyānupassī', type: 'stem', tooltips: ['Body-contemplator'] },
          ],
          senses: [{ english: 'contemplating body', nuance: 'Observing' }],
        },
        {
          id: 'az5',
          wordClass: 'content',
          segments: [
            { id: 'az5s1', text: 'vihar', type: 'root', tooltips: ['Dwells'] },
            { id: 'az5s2', text: 'ati', type: 'suffix', tooltips: ['Present tense'] },
          ],
          senses: [{ english: 'dwells', nuance: 'Abides' }],
        },
      ],
      englishStructure: [
        { id: 'eaz1g', label: 'or', isGhost: true, ghostKind: 'required' },
        { id: 'eaz1', linkedPaliId: 'az1' },
        { id: 'eaz5', linkedSegmentId: 'az5s1' },
        { id: 'eaz4', linkedSegmentId: 'az4s1' },
      ],
    },

    // mn10:4.11c - Both internal and external
    // ajjhattabahiddhā vā kāye kāyānupassī viharati
    {
      id: 'phase-ba',
      paliWords: [
        {
          id: 'ba1',
          wordClass: 'content',
          segments: [
            { id: 'ba1s1', text: 'ajjhatta', type: 'stem', tooltips: ['Internal'] },
            { id: 'ba1s2', text: 'bahid', type: 'root', tooltips: ['External'] },
            { id: 'ba1s3', text: 'dhā', type: 'suffix', tooltips: ['⚡ BOTH TOGETHER:', 'Seeing the SAME patterns', 'in self and others', '→ Universality of experience', '→ Breaking self/other duality', '→ Foundation for compassion'] },
          ],
          senses: [
            { english: 'both internally and externally', nuance: 'Universal' },
            { english: 'in oneself and others', nuance: 'Complete' },
          ],
        },
        {
          id: 'ba2',
          wordClass: 'function',
          segments: [
            { id: 'ba2s1', text: 'vā', type: 'stem', tooltips: ['Or'] },
          ],
          senses: [{ english: 'or', nuance: 'Alternative' }],
        },
        {
          id: 'ba3',
          wordClass: 'content',
          segments: [
            { id: 'ba3s1', text: 'kāye', type: 'stem', tooltips: ['In the body'] },
          ],
          senses: [{ english: 'in the body', nuance: 'Location' }],
        },
        {
          id: 'ba4',
          wordClass: 'content',
          segments: [
            { id: 'ba4s1', text: 'kāyānupassī', type: 'stem', tooltips: ['Body-contemplator'] },
          ],
          senses: [{ english: 'contemplating body', nuance: 'Observing' }],
        },
        {
          id: 'ba5',
          wordClass: 'content',
          segments: [
            { id: 'ba5s1', text: 'viharati', type: 'stem', tooltips: ['Dwells'] },
          ],
          senses: [{ english: 'dwells', nuance: 'Abides' }],
        },
      ],
      englishStructure: [
        { id: 'eba1g', label: 'or', isGhost: true, ghostKind: 'required' },
        { id: 'eba1', linkedPaliId: 'ba1' },
        { id: 'eba5', linkedSegmentId: 'ba5s1' },
        { id: 'eba4', linkedSegmentId: 'ba4s1' },
      ],
    },

    // mn10:4.12 - Arising nature
    // Samudayadhammānupassī vā kāyasmiṁ viharati
    {
      id: 'phase-bb',
      paliWords: [
        {
          id: 'bb1',
          wordClass: 'content',
          segments: [
            { id: 'bb1s1', text: 'Sam', type: 'prefix', tooltips: ['Saṁ: Together / Completely'] },
            { id: 'bb1s2', text: 'udaya', type: 'root', tooltips: ['Ud + i: Rising up / Origin', 'Samudaya = arising, origination', '⚡ FIRST NOBLE TRUTH echo:', 'dukkhasamudaya = origin of suffering', 'Here: seeing HOW things arise'] },
            { id: 'bb1s3', text: 'dhamma', type: 'root', tooltips: ['Dhamma: Nature / Quality / Phenomenon', '"Arising-nature" = subject to arising'] },
            { id: 'bb1s4', text: 'ānu', type: 'prefix', tooltips: ['Anu: Following / Repeatedly'] },
            { id: 'bb1s5', text: 'pass', type: 'root', tooltips: ['√paś: Seeing'] },
            { id: 'bb1s6', text: 'ī', type: 'suffix', tooltips: ['Agent: "one who sees..."'] },
          ],
          senses: [
            { english: 'observing the arising nature', nuance: 'Origin' },
            { english: 'seeing how things come to be', nuance: 'Genesis' },
          ],
        },
        {
          id: 'bb2',
          wordClass: 'function',
          segments: [
            { id: 'bb2s1', text: 'vā', type: 'stem', tooltips: ['Or'] },
          ],
          senses: [{ english: 'or', nuance: 'Alternative' }],
        },
        {
          id: 'bb3',
          wordClass: 'content',
          segments: [
            { id: 'bb3s1', text: 'kāya', type: 'root', tooltips: ['Body'] },
            { id: 'bb3s2', text: 'smiṁ', type: 'suffix', tooltips: ['Locative: "in regard to body"'] },
          ],
          senses: [{ english: 'in regard to body', nuance: 'Location' }],
        },
        {
          id: 'bb4',
          wordClass: 'content',
          segments: [
            { id: 'bb4s1', text: 'viharati', type: 'stem', tooltips: ['Dwells'] },
          ],
          senses: [{ english: 'dwells', nuance: 'Abides' }],
        },
      ],
      englishStructure: [
        { id: 'ebb4', linkedSegmentId: 'bb4s1' },
        { id: 'ebb1', linkedPaliId: 'bb1' },
        { id: 'ebb3', linkedPaliId: 'bb3' },
      ],
    },

    // mn10:4.12b - Passing away nature
    // vayadhammānupassī vā kāyasmiṁ viharati
    {
      id: 'phase-bc',
      paliWords: [
        {
          id: 'bc1',
          wordClass: 'content',
          segments: [
            { id: 'bc1s1', text: 'vaya', type: 'root', tooltips: ['Vaya: Decay / Passing away / Cessation', 'From vi + i: going away', '⚡ ANICCA direct insight:', 'Everything that arises, passes', 'This is vipassanā proper'] },
            { id: 'bc1s2', text: 'dhamma', type: 'root', tooltips: ['Nature / Quality', '"Passing-nature" = subject to decay'] },
            { id: 'bc1s3', text: 'ānu', type: 'prefix', tooltips: ['Repeatedly'] },
            { id: 'bc1s4', text: 'pass', type: 'root', tooltips: ['Seeing'] },
            { id: 'bc1s5', text: 'ī', type: 'suffix', tooltips: ['Agent'] },
          ],
          senses: [
            { english: 'observing the passing nature', nuance: 'Decay' },
            { english: 'seeing how things cease', nuance: 'Impermanence' },
          ],
        },
        {
          id: 'bc2',
          wordClass: 'function',
          segments: [
            { id: 'bc2s1', text: 'vā', type: 'stem', tooltips: ['Or'] },
          ],
          senses: [{ english: 'or', nuance: 'Alternative' }],
        },
        {
          id: 'bc3',
          wordClass: 'content',
          segments: [
            { id: 'bc3s1', text: 'kāyasmiṁ', type: 'stem', tooltips: ['In regard to body'] },
          ],
          senses: [{ english: 'in regard to body', nuance: 'Location' }],
        },
        {
          id: 'bc4',
          wordClass: 'content',
          segments: [
            { id: 'bc4s1', text: 'viharati', type: 'stem', tooltips: ['Dwells'] },
          ],
          senses: [{ english: 'dwells', nuance: 'Abides' }],
        },
      ],
      englishStructure: [
        { id: 'ebc2g', label: 'or', isGhost: true, ghostKind: 'required' },
        { id: 'ebc4', linkedSegmentId: 'bc4s1' },
        { id: 'ebc1', linkedPaliId: 'bc1' },
        { id: 'ebc3', linkedSegmentId: 'bc3s1' },
      ],
    },

    // mn10:4.12c - Both arising and passing
    // samudayavayadhammānupassī vā kāyasmiṁ viharati
    {
      id: 'phase-bd',
      paliWords: [
        {
          id: 'bd1',
          wordClass: 'content',
          segments: [
            { id: 'bd1s1', text: 'samudaya', type: 'stem', tooltips: ['Arising'] },
            { id: 'bd1s2', text: 'vaya', type: 'root', tooltips: ['And passing', '⚡ COMPLETE ANICCA:', 'Seeing the FULL CYCLE', 'Arising-and-passing together', '→ Nothing to cling to', '→ Dependent origination direct'] },
            { id: 'bd1s3', text: 'dhamma', type: 'root', tooltips: ['Nature'] },
            { id: 'bd1s4', text: 'ānu', type: 'prefix', tooltips: ['Repeatedly'] },
            { id: 'bd1s5', text: 'pass', type: 'root', tooltips: ['Seeing'] },
            { id: 'bd1s6', text: 'ī', type: 'suffix', tooltips: ['Agent'] },
          ],
          senses: [
            { english: 'observing arising-and-passing nature', nuance: 'Complete cycle' },
            { english: 'seeing impermanence fully', nuance: 'Anicca' },
          ],
        },
        {
          id: 'bd2',
          wordClass: 'function',
          segments: [
            { id: 'bd2s1', text: 'vā', type: 'stem', tooltips: ['Or'] },
          ],
          senses: [{ english: 'or', nuance: 'Alternative' }],
        },
        {
          id: 'bd3',
          wordClass: 'content',
          segments: [
            { id: 'bd3s1', text: 'kāyasmiṁ', type: 'stem', tooltips: ['In regard to body'] },
          ],
          senses: [{ english: 'in regard to body', nuance: 'Location' }],
        },
        {
          id: 'bd4',
          wordClass: 'content',
          segments: [
            { id: 'bd4s1', text: 'viharati', type: 'stem', tooltips: ['Dwells'] },
          ],
          senses: [{ english: 'dwells', nuance: 'Abides' }],
        },
      ],
      englishStructure: [
        { id: 'ebd2g', label: 'or', isGhost: true, ghostKind: 'required' },
        { id: 'ebd4', linkedSegmentId: 'bd4s1' },
        { id: 'ebd1', linkedPaliId: 'bd1' },
        { id: 'ebd3', linkedSegmentId: 'bd3s1' },
      ],
    },

    // mn10:4.13 - "Atthi kāyo" establishment
    // 'Atthi kāyo'ti vā panassa sati paccupaṭṭhitā hoti
    {
      id: 'phase-be',
      paliWords: [
        {
          id: 'be1',
          wordClass: 'content',
          segments: [
            { id: 'be1s1', text: 'Atthi', type: 'stem', tooltips: ['Atthi: There is / Exists', 'From √as: to be', '📝 BARE KNOWING:', 'Just: "There is body"', 'No elaboration, no story', 'Pure presence of phenomenon'] },
          ],
          senses: [
            { english: 'there is', nuance: 'Existence' },
            { english: 'exists', nuance: 'Presence' },
          ],
        },
        {
          id: 'be2',
          wordClass: 'content',
          segments: [
            { id: 'be2s1', text: 'kāy', type: 'root', tooltips: ['Kāya: Body', 'Just "body" — no "my body"', 'Depersonalized awareness'] },
            { id: 'be2s2', text: 'o', type: 'suffix', tooltips: ['Nominative: subject'] },
          ],
          senses: [{ english: 'body', nuance: 'Phenomenon' }],
        },
        {
          id: 'be3',
          wordClass: 'function',
          segments: [
            { id: 'be3s1', text: 'ti', type: 'stem', tooltips: ['Quote marker: "..."'] },
          ],
          senses: [{ english: '—', nuance: 'Quote' }],
        },
        {
          id: 'be4',
          wordClass: 'function',
          segments: [
            { id: 'be4s1', text: 'vā', type: 'stem', tooltips: ['Or'] },
          ],
          senses: [{ english: 'or', nuance: 'Alternative' }],
        },
        {
          id: 'be5',
          wordClass: 'function',
          segments: [
            { id: 'be5s1', text: 'pan', type: 'stem', tooltips: ['Pana: Moreover / And / But', 'Connective particle'] },
            { id: 'be5s2', text: 'assa', type: 'suffix', tooltips: ['Assa: His / Of him', 'Genitive/Dative pronoun'] },
          ],
          senses: [{ english: 'moreover, his', nuance: 'Connection' }],
        },
        {
          id: 'be6',
          wordClass: 'content',
          segments: [
            { id: 'be6s1', text: 'sati', type: 'stem', tooltips: ['Sati: Mindfulness'] },
          ],
          senses: [{ english: 'mindfulness', nuance: 'Awareness' }],
        },
        {
          id: 'be7',
          wordClass: 'content',
          segments: [
            { id: 'be7s1', text: 'pacc', type: 'prefix', tooltips: ['Pati: Back / In response'] },
            { id: 'be7s2', text: 'upa', type: 'prefix', tooltips: ['Upa: Near'] },
            { id: 'be7s3', text: 'ṭṭhi', type: 'root', tooltips: ['√sthā: To stand', 'Paccupaṭṭhita = established, present'] },
            { id: 'be7s4', text: 'tā', type: 'suffix', tooltips: ['Past participle'] },
          ],
          senses: [
            { english: 'is established', nuance: 'Present' },
            { english: 'stands present', nuance: 'Available' },
          ],
        },
        {
          id: 'be8',
          wordClass: 'function',
          segments: [
            { id: 'be8s1', text: 'hoti', type: 'stem', tooltips: ['Is / Becomes'] },
          ],
          senses: [{ english: 'is', nuance: 'State' }],
        },
      ],
      englishStructure: [
        { id: 'ebe5g', label: 'Or moreover,', isGhost: true, ghostKind: 'required' },
        { id: 'ebe6', linkedSegmentId: 'be6s1' },
        { id: 'ebe7', linkedPaliId: 'be7' },
        { id: 'ebe7g', label: ':', isGhost: true, ghostKind: 'required' },
        { id: 'ebe1', linkedSegmentId: 'be1s1' },
        { id: 'ebe2', linkedSegmentId: 'be2s1' },
      ],
    },

    // mn10:4.14 - Non-clinging conclusion
    // yāvadeva ñāṇamattāya paṭissatimattāya,
    // anissito ca viharati, na ca kiñci loke upādiyati.
    {
      id: 'phase-bf',
      paliWords: [
        {
          id: 'bf1',
          wordClass: 'function',
          segments: [
            { id: 'bf1s1', text: 'yāvad', type: 'stem', tooltips: ['Yāva: As far as / To the extent'] },
            { id: 'bf1s2', text: 'eva', type: 'stem', tooltips: ['Eva: Just / Only', 'Yāvadeva = just to the extent'] },
          ],
          senses: [{ english: 'just to the extent', nuance: 'Limitation' }],
        },
        {
          id: 'bf2',
          wordClass: 'content',
          segments: [
            { id: 'bf2s1', text: 'ñāṇa', type: 'root', tooltips: ['Ñāṇa: Knowledge / Gnosis', 'From √jñā: to know'] },
            { id: 'bf2s2', text: 'matt', type: 'root', tooltips: ['Matta: Mere / Only / Just', '📝 JUST for knowledge\'s sake', 'Not for ego, not for becoming', 'Pure knowing without grasping'] },
            { id: 'bf2s3', text: 'āya', type: 'suffix', tooltips: ['Dative: "for the purpose of"'] },
          ],
          senses: [
            { english: 'for bare knowledge', nuance: 'Purpose' },
            { english: 'just for knowing', nuance: 'Minimal' },
          ],
        },
        {
          id: 'bf3',
          wordClass: 'content',
          segments: [
            { id: 'bf3s1', text: 'paṭi', type: 'prefix', tooltips: ['Paṭi: Back / Again'] },
            { id: 'bf3s2', text: 'ssati', type: 'root', tooltips: ['Sati: Mindfulness', 'Paṭissati = continued mindfulness'] },
            { id: 'bf3s3', text: 'matt', type: 'root', tooltips: ['Mere / Just'] },
            { id: 'bf3s4', text: 'āya', type: 'suffix', tooltips: ['Dative: "for"'] },
          ],
          senses: [
            { english: 'for bare mindfulness', nuance: 'Purpose' },
            { english: 'just for awareness', nuance: 'Minimal' },
          ],
        },
      ],
      englishStructure: [
        { id: 'ebf1', linkedPaliId: 'bf1' },
        { id: 'ebf1g', label: 'needed', isGhost: true, ghostKind: 'required' },
        { id: 'ebf2', linkedPaliId: 'bf2' },
        { id: 'ebf2g', label: 'and', isGhost: true, ghostKind: 'required' },
        { id: 'ebf3', linkedPaliId: 'bf3' },
      ],
    },

    // mn10:4.14b - Independence and non-clinging
    // anissito ca viharati, na ca kiñci loke upādiyati
    {
      id: 'phase-bg',
      paliWords: [
        {
          id: 'bg1',
          wordClass: 'content',
          segments: [
            { id: 'bg1s1', text: 'a', type: 'prefix', tooltips: ['A-: Not / Without (negative)'] },
            { id: 'bg1s2', text: 'nissit', type: 'root', tooltips: ['Nissita: Dependent / Leaning on', 'From ni + √śri: to lean', 'Anissita = INDEPENDENT', '⚡ KEY RESULT:', 'Not leaning on craving', 'Not leaning on views', 'Self-sufficient awareness'] },
            { id: 'bg1s3', text: 'o', type: 'suffix', tooltips: ['Nominative singular'] },
          ],
          senses: [
            { english: 'independent', nuance: 'Not leaning' },
            { english: 'not dependent', nuance: 'Free' },
          ],
        },
        {
          id: 'bg2',
          wordClass: 'function',
          segments: [
            { id: 'bg2s1', text: 'ca', type: 'stem', tooltips: ['And'] },
          ],
          senses: [{ english: 'and', nuance: 'Connection' }],
        },
        {
          id: 'bg3',
          wordClass: 'content',
          segments: [
            { id: 'bg3s1', text: 'vihar', type: 'root', tooltips: ['Dwells'] },
            { id: 'bg3s2', text: 'ati', type: 'suffix', tooltips: ['Present tense'] },
          ],
          senses: [{ english: 'dwells', nuance: 'Abides' }],
        },
        {
          id: 'bg4',
          wordClass: 'function',
          segments: [
            { id: 'bg4s1', text: 'na', type: 'stem', tooltips: ['Not'] },
          ],
          senses: [{ english: 'not', nuance: 'Negative' }],
        },
        {
          id: 'bg5',
          wordClass: 'function',
          segments: [
            { id: 'bg5s1', text: 'ca', type: 'stem', tooltips: ['And'] },
          ],
          senses: [{ english: 'and', nuance: 'Connection' }],
        },
        {
          id: 'bg6',
          wordClass: 'content',
          segments: [
            { id: 'bg6s1', text: 'kiñci', type: 'stem', tooltips: ['Kiñci: Anything / Something', 'Indefinite pronoun', 'With na = "not anything"'] },
          ],
          senses: [{ english: 'anything', nuance: 'Indefinite' }],
        },
        {
          id: 'bg7',
          wordClass: 'content',
          segments: [
            { id: 'bg7s1', text: 'lok', type: 'root', tooltips: ['Loka: World', '📍 In the world = in experience', 'All of saṁsāric existence'] },
            { id: 'bg7s2', text: 'e', type: 'suffix', tooltips: ['Locative: "in the world"'] },
          ],
          senses: [{ english: 'in the world', nuance: 'Experience' }],
        },
        {
          id: 'bg8',
          wordClass: 'content',
          segments: [
            { id: 'bg8s1', text: 'upa', type: 'prefix', tooltips: ['Upa: Towards / Near'] },
            { id: 'bg8s2', text: 'ādi', type: 'root', tooltips: ['√dā: To take', 'Upādāna = clinging, grasping', '⚡ THE GOAL:', 'Na upādiyati = does NOT cling', 'Freedom from the 4 upādānas:', '• Sensual clinging', '• View clinging', '• Rite/ritual clinging', '• Self-doctrine clinging'] },
            { id: 'bg8s3', text: 'yati', type: 'suffix', tooltips: ['Present tense: "clings"'] },
          ],
          senses: [
            { english: 'clings to', nuance: 'Grasps' },
            { english: 'takes up', nuance: 'Attaches' },
          ],
        },
      ],
      englishStructure: [
        { id: 'ebg1g', label: 'One', isGhost: true, ghostKind: 'required' },
        { id: 'ebg3', linkedSegmentId: 'bg3s1' },
        { id: 'ebg1', linkedPaliId: 'bg1' },
        { id: 'ebg4', linkedSegmentId: 'bg4s1' },
        { id: 'ebg8', linkedPaliId: 'bg8' },
        { id: 'ebg6', linkedSegmentId: 'bg6s1' },
        { id: 'ebg7', linkedPaliId: 'bg7' },
      ],
    },
  ],
};

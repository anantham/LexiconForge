import type { AnatomistPass, LexicographerPass, PhaseView, WeaverPass, TypesetterPass } from '../types/suttaStudio';

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton Example: Shows correct grouping patterns (mostly 1 segment per phase)
// KEY: Title block segments (collection + sutta name) go TOGETHER
// ─────────────────────────────────────────────────────────────────────────────
export const SUTTA_STUDIO_SKELETON_EXAMPLE = {
  phases: [
    {
      // Rule 1: Collection name + sutta title = ONE phase
      id: 'phase-1',
      title: 'Title Block',
      segmentIds: ['mn10:0.1', 'mn10:0.2'],  // "Majjhima Nikāya 10" + "Satipaṭṭhānasutta"
    },
    {
      // Rule 2: Opening formula = its own phase
      id: 'phase-2',
      title: 'Opening Formula',
      segmentIds: ['mn10:1.1'],  // "Evaṁ me sutaṁ—"
    },
    {
      // Rule 3: Setting stays as a single phase (do not split)
      id: 'phase-3',
      title: 'Setting',
      segmentIds: ['mn10:1.2'],  // "ekaṁ samayaṁ bhagavā..."
    },
    {
      // Rule 4: Speaker line is separate
      id: 'phase-4',
      title: 'Address',
      segmentIds: ['mn10:1.3'],  // "Tatra kho bhagavā bhikkhū āmantesi"
    },
    {
      // Rule 4b: Vocative stays separate
      id: 'phase-5',
      title: 'Vocative',
      segmentIds: ['mn10:1.4'],  // "bhikkhavo"ti
    },
    {
      // Response and transition are separate phases
      id: 'phase-6',
      title: 'Response',
      segmentIds: ['mn10:1.5'],  // "Bhadante"ti te bhikkhū ...
    },
    {
      id: 'phase-7',
      title: 'Transition',
      segmentIds: ['mn10:1.6'],  // "Bhagavā etadavoca:"
    },
    {
      // Main declaration line is its own phase
      id: 'phase-8',
      title: 'Main Declaration',
      segmentIds: ['mn10:2.1'],
    },
    {
      // Parallel benefit lines are separate phases
      id: 'phase-9',
      title: 'Benefit: Grief & Lamentation',
      segmentIds: ['mn10:2.2'],
    },
    {
      id: 'phase-10',
      title: 'Benefit: Pain & Sadness',
      segmentIds: ['mn10:2.3'],
    },
    {
      id: 'phase-11',
      title: 'Benefit: Attainment',
      segmentIds: ['mn10:2.4'],
    },
    {
      id: 'phase-12',
      title: 'Benefit: Realization',
      segmentIds: ['mn10:2.5'],
    },
    {
      id: 'phase-13',
      title: 'Conclusion',
      segmentIds: ['mn10:2.6'],
    },
  ],
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// PhaseView Example: Final rendered output with segment-level architecture
// ─────────────────────────────────────────────────────────────────────────────
export const SUTTA_STUDIO_PHASE_EXAMPLE: PhaseView = {
  id: 'phase-1',
  title: 'Example Only',
  layoutBlocks: [['p1', 'p2', 'p3']],
  paliWords: [
    {
      id: 'p1',
      wordClass: 'content',
      segments: [
        {
          id: 'p1s1',
          text: 'Ek',
          type: 'root',
          tooltips: ['√ek: One / Singular'],
          senses: [
            { english: 'One', nuance: 'numerical' },
            { english: 'Single', nuance: 'alone' },
          ],
        },
        {
          id: 'p1s2',
          text: 'āyano',
          type: 'suffix',
          tooltips: ['āyana: Going / Way / Path'],
          senses: [
            { english: 'path', nuance: 'direction' },
            { english: 'way', nuance: 'method' },
          ],
        },
      ],
      // Word-level senses as fallback (when segment cycling not needed)
      senses: [
        { english: 'Direct', nuance: 'Linear path' },
        { english: 'Solitary', nuance: 'One way only' },
        { english: 'Convergent', nuance: 'Unifying path', ripples: { ghost1: 'is the point of' } },
      ],
    },
    {
      id: 'p2',
      wordClass: 'content',
      segments: [
        {
          id: 'p2s1',
          text: 'satt',
          type: 'root',
          tooltips: ['√sat: To be / Living being'],
        },
        {
          id: 'p2s2',
          text: 'ānaṁ',
          type: 'suffix',
          tooltips: ['Genitive plural: of the (many)'],
          relation: { targetWordId: 'p3', type: 'ownership', label: 'Possessor of', status: 'confirmed' },
          morph: { case: 'gen', number: 'pl', note: 'Marks belonging, plural (-ānaṁ)' },
        },
      ],
      senses: [
        { english: 'beings', nuance: 'Living entities' },
        { english: 'creatures', nuance: 'Sentient life' },
      ],
    },
    {
      id: 'p3',
      wordClass: 'content',
      segments: [
        { id: 'p3s1', text: 'vi', type: 'prefix', tooltips: ['vi-: Intensive / Apart'] },
        { id: 'p3s2', text: 'suddhi', type: 'root', tooltips: ['√sudh: Purity / Cleansing'] },
        { id: 'p3s3', text: 'yā', type: 'suffix', tooltips: ['Dative: For the purpose of'] },
      ],
      senses: [{ english: 'purification', nuance: 'Spiritual cleansing' }],
      isAnchor: true,
    },
  ],
  englishStructure: [
    // Segment-level linking (preferred)
    { id: 'e1', linkedSegmentId: 'p2s1' },  // "beings" → satt segment
    { id: 'ghost1', label: 'is the', isGhost: true, ghostKind: 'required' },
    { id: 'e2', linkedPaliId: 'p1' },  // Word-level fallback when segments combine
    { id: 'g2', label: 'for the', isGhost: true, ghostKind: 'required' },
    { id: 'e3', linkedPaliId: 'p3' },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Compound Word Example: Satipaṭṭhānasutta - each segment has distinct meaning
// ─────────────────────────────────────────────────────────────────────────────
export const SUTTA_STUDIO_COMPOUND_EXAMPLE: PhaseView = {
  id: 'phase-compound',
  title: 'Satipaṭṭhānasutta',
  layoutBlocks: [['p1']],
  paliWords: [
    {
      id: 'p1',
      wordClass: 'content',
      segments: [
        {
          id: 'p1s1',
          text: 'Sati',
          type: 'stem',
          tooltips: ['√sar: To remember', 'Sati: Mindfulness / Memory / Awareness'],
          senses: [
            { english: 'Mindfulness', nuance: 'present-moment attention' },
            { english: 'Memory', nuance: 'recollection' },
            { english: 'Awareness', nuance: 'bare attention' },
          ],
          // Relation to next segment (compound structure)
          relation: { targetSegmentId: 'p1s2', type: 'ownership', label: 'Mindfulness of', status: 'confirmed' },
        },
        {
          id: 'p1s2',
          text: 'paṭṭhāna',
          type: 'stem',
          tooltips: ['pa + √ṭhā: To stand / Establish', 'Paṭṭhāna: Foundation / Establishment'],
          senses: [
            { english: 'Foundation', nuance: 'base, ground' },
            { english: 'Establishment', nuance: 'setting up' },
            { english: 'Application', nuance: 'putting into practice' },
          ],
        },
        {
          id: 'p1s3',
          text: 'sutta',
          type: 'stem',
          tooltips: ['√siv: To sew / Thread', 'Sutta: Discourse / Teaching / Thread'],
          senses: [
            { english: 'Discourse', nuance: 'formal teaching' },
            { english: 'Teaching', nuance: 'instruction' },
            { english: 'Thread', nuance: 'connected narrative' },
          ],
        },
      ],
      // Word-level fallback (combined meaning)
      senses: [
        { english: 'Discourse on the Foundations of Mindfulness', nuance: 'full title' },
      ],
    },
  ],
  englishStructure: [
    // Each English word links to its corresponding segment
    { id: 'e1', linkedSegmentId: 'p1s1' },  // "Mindfulness" → Sati
    { id: 'e2', linkedSegmentId: 'p1s2' },  // "Meditation" or "Foundation" → paṭṭhāna
    // Note: "sutta" often not translated in titles, or:
    // { id: 'e3', linkedSegmentId: 'p1s3' },  // "Discourse" → sutta
  ],
};

export const SUTTA_STUDIO_SKELETON_EXAMPLE_JSON = JSON.stringify(SUTTA_STUDIO_SKELETON_EXAMPLE, null, 2);
export const SUTTA_STUDIO_PHASE_EXAMPLE_JSON = JSON.stringify(SUTTA_STUDIO_PHASE_EXAMPLE, null, 2);
export const SUTTA_STUDIO_COMPOUND_EXAMPLE_JSON = JSON.stringify(SUTTA_STUDIO_COMPOUND_EXAMPLE, null, 2);

// ─────────────────────────────────────────────────────────────────────────────
// Anatomist Example: Segment-level output with IDs
// ─────────────────────────────────────────────────────────────────────────────
export const SUTTA_STUDIO_ANATOMIST_EXAMPLE: AnatomistPass = {
  id: 'phase-1',
  words: [
    // Surface forms should be clean (no punctuation): "Evaṁ," → "evaṁ"
    { id: 'p1', surface: 'evaṁ', wordClass: 'function', segmentIds: ['p1s1', 'p1s2'] },
    { id: 'p2', surface: 'me', wordClass: 'function', segmentIds: ['p2s1'] },
    { id: 'p3', surface: 'sutaṁ', wordClass: 'content', segmentIds: ['p3s1', 'p3s2', 'p3s3'], isAnchor: true },  // 3 segments!
    // Example with refrainId - bhagavā appears multiple times across phases
    { id: 'p4', surface: 'bhagavā', wordClass: 'content', segmentIds: ['p4s1', 'p4s2'], refrainId: 'bhagava' },
  ],
  segments: [
    // evaṁ = eva (stem) + ṁ (adverbial suffix) - SPLIT the -ṁ!
    { id: 'p1s1', wordId: 'p1', text: 'eva', type: 'stem', tooltips: ['[Emphatic particle] "Just so"', 'Points back to the occasion'] },
    { id: 'p1s2', wordId: 'p1', text: 'ṁ', type: 'suffix', tooltips: ['[Adverbial ending] Makes it "in this way"'] },
    // me = single stem
    { id: 'p2s1', wordId: 'p2', text: 'me', type: 'stem', morph: { case: 'ins', number: 'sg', note: 'Instrumental: by me' }, tooltips: ['Ānanda speaking: "by me"', '[Genitive/Agent] Form is "of me", function is "by me"'] },
    // sutaṁ = su (root) + ta (past participle) + ṁ (nominative) - SPLIT into 3!
    { id: 'p3s1', wordId: 'p3', text: 'su', type: 'root', tooltips: ['√su: To hear (suṇāti)', 'The act of receiving teaching'] },
    { id: 'p3s2', wordId: 'p3', text: 'ta', type: 'suffix', tooltips: ['[Past participle] Marks completed action: "heard"'] },
    { id: 'p3s3', wordId: 'p3', text: 'ṁ', type: 'suffix', morph: { case: 'nom', number: 'sg', note: 'Neuter singular nominative' }, tooltips: ['[Neuter singular] "the thing that..."', 'Makes it the subject of the sentence'] },
  ],
  relations: [
    // Segment-to-word relation: "me" (agent) acts on "sutaṁ" (what was heard)
    { id: 'r1', fromSegmentId: 'p2s1', targetWordId: 'p3', type: 'action', label: 'Heard BY', status: 'confirmed' },
  ],
  handoff: { confidence: 'high', notes: 'Granular segmentation: -ṁ split as separate suffix. Rich contextual tooltips.' },
};

// Anatomist example for compound words
export const SUTTA_STUDIO_ANATOMIST_COMPOUND_EXAMPLE: AnatomistPass = {
  id: 'phase-compound',
  words: [
    { id: 'p1', surface: 'Satipaṭṭhānasutta', wordClass: 'content', segmentIds: ['p1s1', 'p1s2', 'p1s3'], isAnchor: true },
  ],
  segments: [
    { id: 'p1s1', wordId: 'p1', text: 'Sati', type: 'stem', tooltips: ['√sar: To remember', 'Sati: Mindfulness / Memory'] },
    { id: 'p1s2', wordId: 'p1', text: 'paṭṭhāna', type: 'stem', tooltips: ['pa + √ṭhā: To establish', 'Paṭṭhāna: Foundation'] },
    { id: 'p1s3', wordId: 'p1', text: 'sutta', type: 'stem', tooltips: ['√siv: To sew', 'Sutta: Discourse / Thread'] },
  ],
  relations: [
    // Segment-to-segment: Sati relates to paṭṭhāna (mindfulness OF foundation)
    { id: 'r1', fromSegmentId: 'p1s1', targetSegmentId: 'p1s2', type: 'ownership', label: 'Mindfulness of', status: 'confirmed' },
    // paṭṭhāna relates to sutta (foundation IN discourse)
    { id: 'r2', fromSegmentId: 'p1s2', targetSegmentId: 'p1s3', type: 'location', label: 'Taught in', status: 'confirmed' },
  ],
  handoff: { confidence: 'high', notes: 'Compound word with 3 distinct segments, each needing separate English mapping.' },
};

export const SUTTA_STUDIO_ANATOMIST_EXAMPLE_JSON = JSON.stringify(SUTTA_STUDIO_ANATOMIST_EXAMPLE, null, 2);
export const SUTTA_STUDIO_ANATOMIST_COMPOUND_EXAMPLE_JSON = JSON.stringify(SUTTA_STUDIO_ANATOMIST_COMPOUND_EXAMPLE, null, 2);

// ─────────────────────────────────────────────────────────────────────────────
// Lexicographer Example: Segment-level senses for compounds
// ─────────────────────────────────────────────────────────────────────────────
export const SUTTA_STUDIO_LEXICO_EXAMPLE: LexicographerPass = {
  id: 'phase-1',
  senses: [
    {
      wordId: 'p1',
      wordClass: 'function',
      senses: [
        { english: 'Thus', nuance: 'narrative opener, formal' },
        { english: 'So', nuance: 'conversational, reporting' },
      ],
    },
    {
      wordId: 'p3',
      wordClass: 'content',
      senses: [
        { english: 'heard', nuance: 'auditory reception' },
        { english: 'learned', nuance: 'oral tradition, received teaching' },
        { english: 'received', nuance: 'transmission of wisdom' },
      ],
    },
  ],
  handoff: { confidence: 'medium', notes: 'Simple words, word-level senses sufficient.' },
};

// Lexicographer for compound: segment-level senses
export const SUTTA_STUDIO_LEXICO_COMPOUND_EXAMPLE: LexicographerPass = {
  id: 'phase-compound',
  senses: [
    {
      wordId: 'p1',
      wordClass: 'content',
      // Word-level fallback
      senses: [
        { english: 'Discourse on Mindfulness Foundations', nuance: 'full title translation' },
      ],
    },
  ],
  // Segment-level senses for cycling each part independently
  segmentSenses: [
    {
      segmentId: 'p1s1',  // Sati
      senses: [
        { english: 'Mindfulness', nuance: 'present-moment awareness' },
        { english: 'Memory', nuance: 'recollection, remembering' },
        { english: 'Awareness', nuance: 'bare attention' },
      ],
    },
    {
      segmentId: 'p1s2',  // paṭṭhāna
      senses: [
        { english: 'Foundation', nuance: 'base, ground' },
        { english: 'Establishment', nuance: 'setting up, arousing' },
        { english: 'Application', nuance: 'practical use' },
      ],
    },
    {
      segmentId: 'p1s3',  // sutta
      senses: [
        { english: 'Discourse', nuance: 'formal teaching' },
        { english: 'Teaching', nuance: 'instruction' },
        { english: 'Thread', nuance: 'connected narrative' },
      ],
    },
  ],
  handoff: { confidence: 'high', notes: 'Compound requires segment-level senses for independent cycling.' },
};

export const SUTTA_STUDIO_LEXICO_EXAMPLE_JSON = JSON.stringify(SUTTA_STUDIO_LEXICO_EXAMPLE, null, 2);
export const SUTTA_STUDIO_LEXICO_COMPOUND_EXAMPLE_JSON = JSON.stringify(SUTTA_STUDIO_LEXICO_COMPOUND_EXAMPLE, null, 2);

// ─────────────────────────────────────────────────────────────────────────────
// Weaver Example: Segment-level linking
// ─────────────────────────────────────────────────────────────────────────────
// Token indices: 0:Thus 2:have 4:I 6:heard (whitespace at 1,3,5; punctuation at 7)
export const SUTTA_STUDIO_WEAVER_EXAMPLE: WeaverPass = {
  id: 'phase-1',
  tokens: [
    { tokenIndex: 0, text: 'Thus', linkedSegmentId: 'p1s1', isGhost: false },  // Segment-level
    { tokenIndex: 2, text: 'have', isGhost: true, ghostKind: 'required' },     // English auxiliary, no Pali
    { tokenIndex: 4, text: 'I', linkedSegmentId: 'p2s1', isGhost: false },     // Segment-level
    { tokenIndex: 6, text: 'heard', linkedPaliId: 'p3', isGhost: false },      // Word-level (su+taṁ = heard)
  ],
  handoff: { confidence: 'high', notes: '"have" is English auxiliary with no Pali source.' },
};

// Weaver for compound: each English word → segment
export const SUTTA_STUDIO_WEAVER_COMPOUND_EXAMPLE: WeaverPass = {
  id: 'phase-compound',
  tokens: [
    { tokenIndex: 0, text: 'Mindfulness', linkedSegmentId: 'p1s1', isGhost: false },
    { tokenIndex: 2, text: 'Meditation', linkedSegmentId: 'p1s2', isGhost: false },
    // "sutta" often untranslated in titles, but if present:
    // { tokenIndex: 4, text: 'Discourse', linkedSegmentId: 'p1s3', isGhost: false },
  ],
  handoff: { confidence: 'high', notes: 'Compound segments map to individual English words.' },
};

export const SUTTA_STUDIO_WEAVER_EXAMPLE_JSON = JSON.stringify(SUTTA_STUDIO_WEAVER_EXAMPLE, null, 2);
export const SUTTA_STUDIO_WEAVER_COMPOUND_EXAMPLE_JSON = JSON.stringify(SUTTA_STUDIO_WEAVER_COMPOUND_EXAMPLE, null, 2);

// ─────────────────────────────────────────────────────────────────────────────
// Typesetter Example: Layout blocks
// Group words into semantic phrases: [[p1, p2, p3]] not [[p1], [p2], [p3]]
// ─────────────────────────────────────────────────────────────────────────────

export const SUTTA_STUDIO_TYPESETTER_EXAMPLE: TypesetterPass = {
  id: 'phase-1',
  layoutBlocks: [
    ['p1', 'p2', 'p3'],  // "Thus I heard" - keep opening phrase together
  ],
  handoff: { confidence: 'high', notes: 'Simple clause, kept as single block.' },
};

// Example with multiple semantic blocks (longer passage):
// layoutBlocks: [
//   ['p1', 'p2', 'p3'],     // "Thus I heard" (opening formula)
//   ['p4', 'p5', 'p6'],     // "at one time" (time phrase)
//   ['p7', 'p8'],           // "the Blessed One" (subject)
//   ['p9', 'p10', 'p11'],   // "was dwelling at..." (location phrase)
// ]
// Each block = semantic unit. Split at natural phrase boundaries.

export const SUTTA_STUDIO_TYPESETTER_EXAMPLE_JSON = JSON.stringify(SUTTA_STUDIO_TYPESETTER_EXAMPLE, null, 2);

// ─────────────────────────────────────────────────────────────────────────────
// Morph Example (deprecated, use Anatomist segment tooltips instead)
// ─────────────────────────────────────────────────────────────────────────────
export const SUTTA_STUDIO_MORPH_EXAMPLE = {
  paliWords: [
    {
      id: 'p5',
      segments: [
        { id: 'p5s1', text: 'satt', type: 'root', tooltips: ['√sat: To be / Living being'] },
        {
          id: 'p5s2',
          text: 'ānaṁ',
          type: 'suffix',
          tooltips: ['Genitive plural: of the (many)'],
          morph: { case: 'gen', number: 'pl', note: 'Marks possession/belonging, plural' },
          relation: { targetWordId: 'p6', type: 'ownership', label: 'Possessor of', status: 'confirmed' },
        },
      ],
    },
  ],
} as const;

export const SUTTA_STUDIO_MORPH_EXAMPLE_JSON = JSON.stringify(SUTTA_STUDIO_MORPH_EXAMPLE, null, 2);

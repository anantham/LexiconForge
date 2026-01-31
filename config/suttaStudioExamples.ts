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
// Anatomist Example: Phase-A from MN10 golden data (training phase)
// "Evaṁ me sutaṁ—" — Opening formula
// ─────────────────────────────────────────────────────────────────────────────
export const SUTTA_STUDIO_ANATOMIST_EXAMPLE: AnatomistPass = {
  id: 'phase-a',
  words: [
    // Surface forms should be clean (no punctuation): "Evaṁ" from "Evaṁ—"
    { id: 'a1', surface: 'Evaṁ', wordClass: 'function', segmentIds: ['a1s1', 'a1s2'] },
    { id: 'a2', surface: 'me', wordClass: 'function', segmentIds: ['a2s1'] },
    { id: 'a3', surface: 'sutaṁ', wordClass: 'content', segmentIds: ['a3s1', 'a3s2', 'a3s3'], isAnchor: true },
  ],
  segments: [
    // evaṁ = eva (stem) + ṁ (adverbial suffix)
    { id: 'a1s1', wordId: 'a1', text: 'Eva', type: 'stem', tooltips: ['[Emphatic particle] "Just so"', 'Points back to the occasion'] },
    { id: 'a1s2', wordId: 'a1', text: 'ṁ', type: 'suffix', tooltips: ['[Adverbial ending] Makes it "in this way"'] },
    // me = single stem (relation defined in relations array)
    { id: 'a2s1', wordId: 'a2', text: 'me', type: 'stem', tooltips: ['Ānanda speaking: "by me"', '[Genitive/Agent] Form is "of me", function is "by me"'] },
    // sutaṁ = su (root) + ta (past participle) + ṁ (nominative)
    { id: 'a3s1', wordId: 'a3', text: 'su', type: 'root', tooltips: ['√su: To hear (suṇāti)', 'The act of receiving teaching'] },
    { id: 'a3s2', wordId: 'a3', text: 'ta', type: 'suffix', tooltips: ['[Past participle] Marks completed action: "heard"'] },
    { id: 'a3s3', wordId: 'a3', text: 'ṁ', type: 'suffix', tooltips: ['[Neuter singular] "the thing that..."', 'Makes it the subject of the sentence'] },
  ],
  relations: [
    // Relation defined on segment a2s1 above, also listed here for clarity
    { id: 'r1', fromSegmentId: 'a2s1', targetWordId: 'a3', type: 'action', label: 'Heard BY', status: 'confirmed' },
  ],
  handoff: { confidence: 'high', notes: 'Golden example from MN10 phase-a. Granular segmentation with contextual tooltips.' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Anatomist Example 2: Phase-B from MN10 golden data (training phase)
// "ekaṁ samayaṁ bhagavā..." — Standard sutta opening
// ─────────────────────────────────────────────────────────────────────────────
export const SUTTA_STUDIO_ANATOMIST_EXAMPLE_B: AnatomistPass = {
  id: 'phase-b',
  words: [
    { id: 'b1', surface: 'ekaṁ', wordClass: 'function', segmentIds: ['b1s1', 'b1s2'] },
    { id: 'b2', surface: 'samayaṁ', wordClass: 'content', segmentIds: ['b2s1', 'b2s2', 'b2s3'] },
    { id: 'b3', surface: 'bhagavā', wordClass: 'content', segmentIds: ['b3s1', 'b3s2'], refrainId: 'bhagava' },
  ],
  segments: [
    // ekaṁ = eka (stem) + ṁ (accusative of time)
    { id: 'b1s1', wordId: 'b1', text: 'eka', type: 'stem', tooltips: ['[Adjective] One, a certain', 'Modifies samayaṁ'] },
    { id: 'b1s2', wordId: 'b1', text: 'ṁ', type: 'suffix', tooltips: ['[Accusative of Time] "at/on"', 'Tells us when, not what'], morph: { case: 'acc', number: 'sg', note: 'Accusative of time' } },
    // samayaṁ = sam (prefix) + aya (root) + ṁ (accusative)
    { id: 'b2s1', wordId: 'b2', text: 'sam', type: 'prefix', tooltips: ['[Prefix] Together, completely', 'Not a root!'] },
    { id: 'b2s2', wordId: 'b2', text: 'aya', type: 'root', tooltips: ['From √i: to go', 'aya = going, course', 'sam + aya = "a coming together"'] },
    { id: 'b2s3', wordId: 'b2', text: 'ṁ', type: 'suffix', tooltips: ['[Accusative of Time] "At this occasion"'], morph: { case: 'acc', number: 'sg', note: 'Accusative of time' } },
    // bhagavā = bhaga (root) + vā (possessive suffix)
    { id: 'b3s1', wordId: 'b3', text: 'bhaga', type: 'root', tooltips: ['Fortune, good luck', 'From √bhaj: to share'] },
    { id: 'b3s2', wordId: 'b3', text: 'vā', type: 'suffix', tooltips: ['[Possessive suffix] "One who has..."', 'The Fortunate One'], morph: { case: 'nom', number: 'sg', note: 'Nominative singular' } },
  ],
  relations: [
    { id: 'r1', fromSegmentId: 'b2s3', targetWordId: 'b3', type: 'location', label: 'Time WHEN', status: 'confirmed' },
  ],
  handoff: { confidence: 'high', notes: 'Golden example from MN10 phase-b. Shows morph on case-carrying suffixes.' },
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

// ─────────────────────────────────────────────────────────────────────────────
// Anatomist Example 3: Phase-AA - "ātāpī sampajāno satimā" refrain formula
// Shows refrain patterns that repeat across many phases
// ─────────────────────────────────────────────────────────────────────────────
export const SUTTA_STUDIO_ANATOMIST_EXAMPLE_REFRAIN: AnatomistPass = {
  id: 'phase-aa',
  words: [
    { id: 'aa1', surface: 'ātāpī', wordClass: 'content', segmentIds: ['aa1s1', 'aa1s2'], refrainId: 'formula-ardent' },
    { id: 'aa2', surface: 'sampajāno', wordClass: 'content', segmentIds: ['aa2s1', 'aa2s2', 'aa2s3', 'aa2s4'], refrainId: 'formula-ardent' },
    { id: 'aa3', surface: 'satimā', wordClass: 'content', segmentIds: ['aa3s1', 'aa3s2'], refrainId: 'formula-ardent' },
  ],
  segments: [
    // ātāpī = ātāp (root: heat/burning) + ī (possessive)
    { id: 'aa1s1', wordId: 'aa1', text: 'ātāp', type: 'root', tooltips: ['🔥 √tap: To burn, heat', 'Vedic tapas = ascetic heat', 'Buddhist: burning of defilements'] },
    { id: 'aa1s2', wordId: 'aa1', text: 'ī', type: 'suffix', tooltips: ['[Possessive suffix] One who has ardor'], morph: { case: 'nom', number: 'sg', note: 'Nominative singular, possessive -ī' } },
    // sampajāno = sam + pa + jān + o (complex compound)
    { id: 'aa2s1', wordId: 'aa2', text: 'sam', type: 'prefix', tooltips: ['[Prefix] Sam: together, completely'] },
    { id: 'aa2s2', wordId: 'aa2', text: 'pa', type: 'prefix', tooltips: ['[Prefix] Pa/Pra: forth, forward'] },
    { id: 'aa2s3', wordId: 'aa2', text: 'jān', type: 'root', tooltips: ['🧠 √jñā: To know', 'Sampajañña = Clear Comprehension'] },
    { id: 'aa2s4', wordId: 'aa2', text: 'o', type: 'suffix', tooltips: ['[Nominative Singular Masculine] One who knows'], morph: { case: 'nom', number: 'sg', note: 'Nominative singular' } },
    // satimā = sati (root) + mā (possessive)
    { id: 'aa3s1', wordId: 'aa3', text: 'sati', type: 'root', tooltips: ['💭 √smṛ: To remember', 'Sati = mindfulness / presence'] },
    { id: 'aa3s2', wordId: 'aa3', text: 'mā', type: 'suffix', tooltips: ['-mant → -mā: Possessive suffix', 'One who possesses mindfulness'], morph: { case: 'nom', number: 'sg', note: 'Nominative, possessive -mant contracted' } },
  ],
  relations: [],  // No cross-word relations in this phrase
  handoff: { confidence: 'high', notes: 'Golden example from MN10 phase-aa. Shows refrain pattern with refrainId for visual styling.' },
};

export const SUTTA_STUDIO_ANATOMIST_EXAMPLE_JSON = JSON.stringify(SUTTA_STUDIO_ANATOMIST_EXAMPLE, null, 2);
export const SUTTA_STUDIO_ANATOMIST_EXAMPLE_B_JSON = JSON.stringify(SUTTA_STUDIO_ANATOMIST_EXAMPLE_B, null, 2);
export const SUTTA_STUDIO_ANATOMIST_EXAMPLE_REFRAIN_JSON = JSON.stringify(SUTTA_STUDIO_ANATOMIST_EXAMPLE_REFRAIN, null, 2);
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
// Weaver Example: Segment-level linking (Phase-A from MN10 golden data)
// ─────────────────────────────────────────────────────────────────────────────
// Token indices: 0:Thus 2:have 4:I 6:heard (whitespace at 1,3,5; punctuation at 7)
export const SUTTA_STUDIO_WEAVER_EXAMPLE: WeaverPass = {
  id: 'phase-a',
  tokens: [
    { tokenIndex: 0, text: 'Thus', linkedPaliId: 'a1', isGhost: false },       // Word-level for simple words
    { tokenIndex: 2, text: 'have', isGhost: true, ghostKind: 'required' },     // English auxiliary, no Pali
    { tokenIndex: 4, text: 'I', linkedSegmentId: 'a2s1', isGhost: false },     // Segment-level
    { tokenIndex: 6, text: 'heard', linkedSegmentId: 'a3s1', isGhost: false }, // Links to root segment
  ],
  handoff: { confidence: 'high', notes: '"have" is English auxiliary with no Pali source.' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Weaver ANTI-PATTERN: Duplicate segment mappings (WRONG!)
// ─────────────────────────────────────────────────────────────────────────────
// This shows what NOT to do - same segment linked by multiple English tokens
export const SUTTA_STUDIO_WEAVER_ANTI_PATTERN = `
❌ WRONG - Duplicate mappings cause "marketplace marketplace" bugs:
tokens: [
  { tokenIndex: 0, text: 'land', linkedSegmentId: 'c1s1', isGhost: false },     // c1s1 = kurū
  { tokenIndex: 2, text: 'Kurus', linkedSegmentId: 'c1s1', isGhost: false },    // c1s1 = kurū AGAIN!
]
Result: Both "land" AND "Kurus" link to same segment, causing duplicate rendering.

✓ CORRECT - Each segment linked at most ONCE:
tokens: [
  { tokenIndex: 0, text: 'among', isGhost: true, ghostKind: 'required' },       // Ghost for English preposition
  { tokenIndex: 2, text: 'the', isGhost: true, ghostKind: 'required' },         // Ghost for English article
  { tokenIndex: 4, text: 'Kurus', linkedSegmentId: 'c1s1', isGhost: false },    // c1s1 linked ONCE
]

RULE: Each Pali segment can be linked by AT MOST ONE English token.
If multiple English words express one Pali segment, choose the PRIMARY meaning.
`;

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

/**
 * Morning Chants — Theravāda Devotional Sequence as chanted at MAPLE.
 *
 * Transcribed from the printed sheet (PXL_20250525_190125521.jpg).
 * Pronunciation respellings, root traces, and etymological breakdowns
 * follow Pāli grammar tradition. Each word carries citations grounding
 * the etymology + pronunciation in DPD / SC pronunciation guide.
 *
 * Pluralism principle: the Pāli is the MAPLE chant-sheet form; published
 * English witnesses (Buddharakkhita / Sujato / Thanissaro) surface under
 * click-to-cycle. The "AI" English is an AI-drafted working version, not
 * MAPLE's own — MAPLE's chant sheets carry the Pāli form. None canonical.
 */

import type { LiturgyDoc, WordGloss } from '../../types/liturgy';
import {
  dpdCitation,
  suttaCentralPronunciationCitation,
  ungroundedCitation,
} from './_groundingHelpers';

const pronCite = suttaCentralPronunciationCitation();

// ─────────────────────────────────────────────────────────────────────────────
// Word-data registries — shared by segments that repeat the same vocabulary
// (the Refuges + Dutiyampi/Tatiyampi blocks all share the same 3 word forms)
// ─────────────────────────────────────────────────────────────────────────────

// Plain-English morpheme glosses — no linguist jargon (no "dative", "accusative",
// "participle", "nominative singular masculine"). Each gloss says what the
// morpheme does to the MEANING, in language a chanter can use.
const HOMAGE_WORDS: WordGloss[] = [
  {
    form: 'namo', scriptAlt: 'नमो', pronunciation: 'nah-MOH', root: '√nam',
    etymology: '√nam "to bow"', gloss: 'homage, reverence',
    citations: [dpdCitation('namo'), pronCite],
    morphemes: [
      { text: 'nam', type: 'root', root: '√nam', gloss: 'to bow', pronunciation: 'nah', citations: [dpdCitation('namati')] },
      { text: 'o', type: 'suffix', gloss: 'turns "to bow" into "an act of homage" — the gesture itself', pronunciation: 'MOH' },
    ],
  },
  {
    form: 'tassa', scriptAlt: 'तस्स', pronunciation: 'TAH-sah',
    etymology: 'pointer word + "to him"',
    gloss: 'to him, to that one',
    citations: [dpdCitation('ta'), pronCite],
    morphemes: [
      { text: 'ta', type: 'stem', gloss: '"that one" — pointing at the one being honored', pronunciation: 'TAH', citations: [dpdCitation('ta')] },
      { text: 'ssa', type: 'suffix', gloss: '"to him" — marks who this homage is for', pronunciation: 'sah' },
    ],
  },
  {
    form: 'bhagavato', scriptAlt: 'भगवतो', pronunciation: 'bah-gah-VAH-toh',
    etymology: '*bhaga* "fortune" + *-vant* "possessing"',
    gloss: 'the Exalted, the Blessed, the Revered One',
    citations: [dpdCitation('bhagavant'), pronCite],
    morphemes: [
      { text: 'bhaga', type: 'stem', gloss: 'fortune, blessing', pronunciation: 'bah-gah', citations: [dpdCitation('bhaga')] },
      { text: 'va', type: 'suffix', gloss: 'possessing — "one who has [fortune]"', pronunciation: 'VAH' },
      { text: 'to', type: 'suffix', gloss: '"to him"', pronunciation: 'toh' },
    ],
  },
  {
    form: 'arahato', scriptAlt: 'अरहतो', pronunciation: 'ah-rah-HAH-toh',
    etymology: '*araha* "worthy" — the worthy one',
    gloss: 'the Worthy One; one free from defilements',
    citations: [
      dpdCitation('arahant'),
      pronCite,
      ungroundedCitation('commentarial reading "slayer of inner foes" needs PED check'),
    ],
    morphemes: [
      { text: 'araha', type: 'stem', gloss: 'worthy, deserving', pronunciation: 'ah-rah-HAH', citations: [dpdCitation('araha')] },
      { text: 'to', type: 'suffix', gloss: '"to the worthy one"', pronunciation: 'toh' },
    ],
  },
  {
    form: 'sammā', scriptAlt: 'सम्मा', pronunciation: 'sahm-MAH',
    etymology: 'fully, perfectly',
    gloss: 'perfectly, completely, rightly',
    citations: [dpdCitation('sammā'), pronCite],
    morphemes: [
      { text: 'sam', type: 'prefix', gloss: 'fully, completely', pronunciation: 'sahm', citations: [dpdCitation('saṁ')] },
      { text: 'mā', type: 'suffix', gloss: 'makes it "fully so" — perfectly', pronunciation: 'MAH' },
    ],
  },
  {
    // Dedicated entry for the surface token "sambuddhassa" in
    // "sammā-sambuddhassa". Longest-match wins over the short "sam-" entry.
    form: 'sambuddhassa', scriptAlt: 'सम्बुद्धस्स', pronunciation: 'sahm-BOO-dhah-sah',
    root: '√budh',
    etymology: '*sam* "self" + √budh "wake" + past-participle + "to him"',
    gloss: 'to the self-awakened one',
    citations: [dpdCitation('sambuddha'), pronCite],
    morphemes: [
      { text: 'sam', type: 'prefix', gloss: 'by himself, without a teacher', pronunciation: 'sahm', citations: [dpdCitation('saṁ')] },
      { text: 'buddh', type: 'root', root: '√budh', gloss: 'to wake, to know', pronunciation: 'BOO-dh', citations: [dpdCitation('bujjhati')] },
      { text: 'a', type: 'suffix', gloss: 'turns "wake" into "the awakened one"', pronunciation: 'ah' },
      { text: 'ssa', type: 'suffix', gloss: '"to him" — marks who is honored', pronunciation: 'sah' },
    ],
  },
];

const REFUGE_WORDS: WordGloss[] = [
  {
    form: 'buddhaṁ', scriptAlt: 'बुद्धं', pronunciation: 'BOO-dhang', root: '√budh',
    accent: 'sky',
    etymology: '√budh "to wake" → *buddha* + accusative ending',
    gloss: 'to the Buddha (the one I am going toward)',
    citations: [dpdCitation('buddha'), pronCite],
    morphemes: [
      { text: 'buddh', type: 'root', root: '√budh', gloss: 'to wake, to know', pronunciation: 'BOO-dh', citations: [dpdCitation('bujjhati')] },
      { text: 'a', type: 'suffix', gloss: 'turns "wake" into "the awakened one"', pronunciation: 'ah' },
      { text: 'ṁ', type: 'suffix', gloss: 'marks this as the destination — "to the Buddha"', pronunciation: 'ng' },
    ],
  },
  {
    form: 'dhammaṁ', scriptAlt: 'धम्मं', pronunciation: 'DHUM-mang', root: '√dhṛ',
    accent: 'amber',
    etymology: '√dhṛ "to hold" → *dhamma* + accusative ending',
    gloss: 'to the Dhamma — the teaching, truth, the way',
    citations: [dpdCitation('dhamma'), pronCite],
    morphemes: [
      { text: 'dhamm', type: 'root', root: '√dhṛ', gloss: 'that which holds, supports — teaching, truth, reality', pronunciation: 'DHUM-m', citations: [dpdCitation('dhamma')] },
      { text: 'a', type: 'suffix', gloss: 'noun form — "the Dhamma"', pronunciation: 'ah' },
      { text: 'ṁ', type: 'suffix', gloss: '"to the Dhamma"', pronunciation: 'ng' },
    ],
  },
  {
    form: 'saṅghaṁ', scriptAlt: 'सङ्घं', pronunciation: 'SUNG-hang',
    accent: 'rose',
    etymology: '*saṁ* "together" + √han "to bring" → "assembly"',
    gloss: 'to the Sangha — the community',
    citations: [dpdCitation('saṅgha'), pronCite],
    morphemes: [
      { text: 'saṅ', type: 'prefix', gloss: 'together', pronunciation: 'SUNG', citations: [dpdCitation('saṁ')] },
      { text: 'gh', type: 'root', gloss: 'bringing, coming — those who come together', pronunciation: 'h' },
      { text: 'a', type: 'suffix', gloss: 'noun form — "the assembly"', pronunciation: 'ah' },
      { text: 'ṁ', type: 'suffix', gloss: '"to the Sangha"', pronunciation: 'ng' },
    ],
  },
  {
    form: 'saraṇaṁ', scriptAlt: 'सरणं', pronunciation: 'SAH-rah-nang', root: '√śri',
    etymology: '√śri "to lean on" → *saraṇa* + accusative',
    gloss: 'refuge, shelter, protection',
    citations: [dpdCitation('saraṇa'), pronCite],
    morphemes: [
      { text: 'sar', type: 'root', root: '√śri', gloss: 'to lean on, to resort to', pronunciation: 'SAH-r', citations: [dpdCitation('saraṇa')] },
      { text: 'aṇa', type: 'suffix', gloss: 'turns "lean on" into "a place to lean" — refuge', pronunciation: 'ah-nah' },
      { text: 'ṁ', type: 'suffix', gloss: '"to refuge" — refuge as where I am going', pronunciation: 'ng' },
    ],
  },
  {
    form: 'gacchāmi', scriptAlt: 'गच्छामि', pronunciation: 'gah-CHAH-mee', root: '√gam',
    etymology: '√gam "to go" + 1st-person singular ending',
    gloss: 'I go to, I approach',
    citations: [dpdCitation('gacchati'), pronCite],
    morphemes: [
      { text: 'gacch', type: 'root', root: '√gam', gloss: 'to go, to move toward', pronunciation: 'gah-CH', citations: [dpdCitation('gacchati')] },
      { text: 'ā', type: 'stem', gloss: 'present-tense marker', pronunciation: 'AH' },
      { text: 'mi', type: 'suffix', gloss: '"I" — first-person singular', pronunciation: 'mee' },
    ],
  },
  {
    form: 'dutiyampi', scriptAlt: 'दुतियम्पि', pronunciation: 'doo-TEE-yam-pee',
    etymology: '*dutiya* "second" + *pi* "also"',
    gloss: 'for the second time also',
    citations: [dpdCitation('dutiya'), pronCite],
    morphemes: [
      { text: 'dutiyam', type: 'stem', gloss: 'second, the second time', pronunciation: 'doo-TEE-yam', citations: [dpdCitation('dutiya')] },
      { text: 'pi', type: 'suffix', gloss: 'also, too — "for this time too"', pronunciation: 'pee' },
    ],
  },
  {
    form: 'tatiyampi', scriptAlt: 'ततियम्पि', pronunciation: 'tah-TEE-yam-pee',
    etymology: '*tatiya* "third" + *pi* "also"',
    gloss: 'for the third time also',
    citations: [dpdCitation('tatiya'), pronCite],
    morphemes: [
      { text: 'tatiyam', type: 'stem', gloss: 'third, the third time', pronunciation: 'tah-TEE-yam', citations: [dpdCitation('tatiya')] },
      { text: 'pi', type: 'suffix', gloss: 'also, too', pronunciation: 'pee' },
    ],
  },
];

/**
 * Reusable alignment-array patterns. Each is keyed by witness text shape
 * (e.g., "I take refuge in the X" vs "I go for refuge to the X"). Reduces
 * boilerplate across the 9 Refuge segments.
 *
 * alignTo is parallel-indexed to the witness's whitespace-split words;
 * each entry is the surface-position of the Pāli word that English word
 * maps to (-1 = no alignment).
 */
const ALIGN: {
  refuge_simple: { maple: number[]; sujato: number[]; thanissaro: number[] };
  refuge_repeat: { maple: number[]; sujato: number[] };
} = {
  // Pāli: X(0) saraṇaṁ(1) gacchāmi(2). — 3 surface positions.
  refuge_simple: {
    // "I take refuge in the X." → I(0) take(1) refuge(2) in(3) the(4) X.(5)
    maple: [-1, 2, 1, -1, -1, 0],
    // "I go for refuge to the X." → I(0) go(1) for(2) refuge(3) to(4) the(5) X.(6)
    sujato: [-1, 2, -1, 1, -1, -1, 0],
    // "I go to the X for refuge." → I(0) go(1) to(2) the(3) X(4) for(5) refuge.(6)
    thanissaro: [-1, 2, -1, -1, 0, -1, 1],
  },
  // Pāli: Dutiyampi/Tatiyampi(0) X(1) saraṇaṁ(2) gacchāmi(3). — 4 surface positions.
  refuge_repeat: {
    // "For the second time, I take refuge in the X." → 10 English words
    maple: [-1, -1, 0, 0, -1, 3, 2, -1, -1, 1],
    // "For a second time, I go for refuge to the X." → 11 English words
    sujato: [-1, -1, 0, 0, -1, 3, -1, 2, -1, -1, 1],
  },
};

const PRECEPT_FORMULA_WORDS: WordGloss[] = [
  {
    form: 'veramaṇī', scriptAlt: 'वेरमणी', pronunciation: 'vay-rah-MAH-nee',
    etymology: '*vi-* (away) + √ram "to delight" → turning away from',
    gloss: 'abstention from, refraining from',
    citations: [dpdCitation('veramaṇī'), pronCite],
    morphemes: [
      { text: 've', type: 'prefix', gloss: 'away from', pronunciation: 'vay' },
      { text: 'ram', type: 'root', root: '√ram', gloss: 'to delight in', pronunciation: 'rah-m' },
      { text: 'aṇī', type: 'suffix', gloss: 'turns "delight in" into "turning away from delight in" — refraining', pronunciation: 'ah-NEE' },
    ],
    scriptMorphemes: {
      'pi-Deva': [
        { text: 'वे', type: 'prefix', pronunciation: 'vay', gloss: 'away from' },
        { text: 'र', type: 'root', pronunciation: 'rah', gloss: '√ram, to delight in' },
        { text: 'मणी', type: 'suffix', pronunciation: 'ah-NEE', gloss: 'turns the root into "refraining from"' },
      ],
    },
  },
  {
    form: 'sikkhāpadaṁ', scriptAlt: 'सिक्खापदं', pronunciation: 'sik-KHAH-pah-dang',
    etymology: '*sikkhā* "training" + *pada* "step"',
    gloss: 'training rule, "a step in training"',
    citations: [dpdCitation('sikkhāpada'), pronCite],
    morphemes: [
      { text: 'sikkhā', type: 'stem', gloss: 'training, learning, practice', pronunciation: 'sik-KHAH', citations: [dpdCitation('sikkhā')] },
      { text: 'pada', type: 'stem', gloss: 'step, foot, a step in the training', pronunciation: 'pah-dah', citations: [dpdCitation('pada')] },
      { text: 'ṁ', type: 'suffix', gloss: '"the training rule", what I am taking on', pronunciation: 'ng' },
    ],
    scriptMorphemes: {
      'pi-Deva': [
        { text: 'सिक्खा', type: 'stem', pronunciation: 'sik-KHAH', gloss: 'training, learning, practice' },
        { text: 'पद', type: 'stem', pronunciation: 'pah-dah', gloss: 'step, a step in the training' },
        { text: 'ं', type: 'suffix', pronunciation: 'ng', gloss: 'the case marker, "the training rule"' },
      ],
    },
  },
  {
    form: 'samādiyāmi', scriptAlt: 'समादियामि', pronunciation: 'sah-MAH-dee-YAH-mee',
    etymology: '*sam-* + *ā-* + √dā "to take" + "I", "I fully take this upon myself"',
    gloss: 'I undertake, I take upon myself',
    citations: [dpdCitation('samādiyati'), pronCite],
    morphemes: [
      { text: 'sam', type: 'prefix', gloss: 'fully, completely', pronunciation: 'sah-m' },
      { text: 'ā', type: 'prefix', gloss: 'toward myself', pronunciation: 'AH' },
      { text: 'di', type: 'root', root: '√dā', gloss: 'to take, to accept', pronunciation: 'dee' },
      { text: 'yā', type: 'stem', gloss: 'present-tense marker', pronunciation: 'YAH' },
      { text: 'mi', type: 'suffix', gloss: '"I", first-person singular', pronunciation: 'mee' },
    ],
    scriptMorphemes: {
      'pi-Deva': [
        { text: 'सम', type: 'prefix', pronunciation: 'sah-m', gloss: 'fully, completely' },
        { text: 'ा', type: 'prefix', pronunciation: 'ah', gloss: 'toward myself' },
        { text: 'दि', type: 'root', pronunciation: 'dee', gloss: '√dā, to take, to accept' },
        { text: 'या', type: 'stem', pronunciation: 'yah', gloss: 'present-tense marker' },
        { text: 'मि', type: 'suffix', pronunciation: 'mee', gloss: '"I", first-person singular' },
      ],
    },
  },
];

export const morningChants: LiturgyDoc = {
  slug: 'morning-chants',
  sangha: 'maple',
  order: 1,
  time: '4:35 AM',
  title: 'Morning Chants',
  subtitle: 'Threefold Refuge · Five Precepts · Ovāda Pāṭimokkha (Dhp 183)',
  tradition: 'theravada',
  sources: {
    canonical: [
      { label: 'Khp 1', url: 'https://suttacentral.net/kp1' },
      { label: 'Khp 2', url: 'https://suttacentral.net/kp2' },
      { label: 'Dhp 183', url: 'https://suttacentral.net/dhp183/en/sujato' },
    ],
    ritual: [{ label: 'MAPLE chant sheet, 2025-05-25' }],
  },
  sections: [
    // ───────────────────────────────────────────────────────────────────────
    // 1. Homage — one segment
    // ───────────────────────────────────────────────────────────────────────
    {
      id: 'homage',
      shape: 'triple-script-witness',
      repetitions: 3,
      segments: [
        {
          id: 'homage-1',
          pali: 'Namo tassa bhagavato arahato sammā-sambuddhassa.',
          paliDeva: 'नमो तस्स भगवतो अरहतो सम्मासम्बुद्धस्स ॥',
          witnesses: [
            {
              by: 'MAPLE chant text',
              text: 'Homage to the Exalted, noble, and Fully Self-Enlightened One.',
              // Surface Pāli positions: 0=Namo · 1=tassa · 2=bhagavato · 3=arahato · 4=sammā · 5=sambuddhassa
              // English words:           0=Homage 1=to 2=the 3=Exalted, 4=noble, 5=and 6=Fully 7=Self-Enlightened 8=One.
              alignTo: [0, 1, -1, 2, 3, -1, 4, 5, 5],
            },
            {
              by: 'Sujato (SuttaCentral)',
              text: 'Homage to the Blessed One, the perfected one, the fully awakened Buddha.',
              url: 'https://suttacentral.net/kp1/en/sujato',
              license: 'CC0',
              // English: 0=Homage 1=to 2=the 3=Blessed 4=One, 5=the 6=perfected 7=one, 8=the 9=fully 10=awakened 11=Buddha.
              alignTo: [0, 1, -1, 2, 2, -1, 3, 3, -1, 4, 5, 5],
            },
            {
              by: 'Thanissaro (Access to Insight)',
              text: 'Homage to the Blessed One, the Worthy One, the Rightly Self-awakened One.',
              url: 'https://www.accesstoinsight.org/lib/authors/thanissaro/index.html',
              license: 'CC BY-NC',
              // English: 0=Homage 1=to 2=the 3=Blessed 4=One, 5=the 6=Worthy 7=One, 8=the 9=Rightly 10=Self-awakened 11=One.
              alignTo: [0, 1, -1, 2, 2, -1, 3, 3, -1, 4, 5, 5],
            },
          ],
          words: HOMAGE_WORDS,
        },
      ],
      // Commentary removed (2026-05-16): the claim "chanted three times to
      // signify dedication of body, speech, and mind" is widely transmitted
      // across modern Buddhist teaching but I could not find a single
      // authoritative scriptural source linking the three-fold recitation
      // specifically to the body/speech/mind triad. The body/speech/mind
      // triad is canonical; the three-fold recitation is canonical; the
      // *mapping* between them is commentarial / teaching-tradition.
      // Per project ethos (better silent than ungrounded), removed.
    },

    // ───────────────────────────────────────────────────────────────────────
    // 2. Three Refuges — 9 segments (3 refuges × 3 cycles)
    // ───────────────────────────────────────────────────────────────────────
    {
      id: 'three-refuges',
      shape: 'triple-script-witness',
      segments: [
        // First time
        {
          id: 'refuge-buddha-1',
          pali: 'Buddhaṁ saraṇaṁ gacchāmi.',
          paliDeva: 'बुद्धं सरणं गच्छामि।',
          witnesses: [
            { by: 'MAPLE chant text', text: 'I take refuge in the Buddha.', alignTo: ALIGN.refuge_simple.maple },
            { by: 'Sujato (SuttaCentral)', text: 'I go for refuge to the Buddha.', url: 'https://suttacentral.net/kp1/en/sujato', license: 'CC0', alignTo: ALIGN.refuge_simple.sujato },
            { by: 'Thanissaro (Access to Insight)', text: 'I go to the Buddha for refuge.', url: 'https://www.accesstoinsight.org/lib/authors/thanissaro/index.html', license: 'CC BY-NC', alignTo: ALIGN.refuge_simple.thanissaro },
          ],
          words: REFUGE_WORDS,
        },
        {
          id: 'refuge-dhamma-1',
          pali: 'Dhammaṁ saraṇaṁ gacchāmi.',
          paliDeva: 'धम्मं सरणं गच्छामि।',
          witnesses: [
            { by: 'MAPLE chant text', text: 'I take refuge in the Dhamma.', alignTo: ALIGN.refuge_simple.maple },
            { by: 'Sujato (SuttaCentral)', text: 'I go for refuge to the teaching.', url: 'https://suttacentral.net/kp1/en/sujato', license: 'CC0', alignTo: ALIGN.refuge_simple.sujato },
            { by: 'Thanissaro (Access to Insight)', text: 'I go to the Dhamma for refuge.', url: 'https://www.accesstoinsight.org/lib/authors/thanissaro/index.html', license: 'CC BY-NC', alignTo: ALIGN.refuge_simple.thanissaro },
          ],
          words: REFUGE_WORDS,
        },
        {
          id: 'refuge-sangha-1',
          pali: 'Saṅghaṁ saraṇaṁ gacchāmi.',
          paliDeva: 'सङ्घं सरणं गच्छामि।',
          witnesses: [
            { by: 'MAPLE chant text', text: 'I take refuge in the Sangha.', alignTo: ALIGN.refuge_simple.maple },
            { by: 'Sujato (SuttaCentral)', text: 'I go for refuge to the Saṅgha.', url: 'https://suttacentral.net/kp1/en/sujato', license: 'CC0', alignTo: ALIGN.refuge_simple.sujato },
            { by: 'Thanissaro (Access to Insight)', text: 'I go to the Sangha for refuge.', url: 'https://www.accesstoinsight.org/lib/authors/thanissaro/index.html', license: 'CC BY-NC', alignTo: ALIGN.refuge_simple.thanissaro },
          ],
          words: REFUGE_WORDS,
        },
        // Second time
        {
          id: 'refuge-buddha-2',
          pali: 'Dutiyampi Buddhaṁ saraṇaṁ gacchāmi.',
          paliDeva: 'दुतियम्पि बुद्धं सरणं गच्छामि।',
          witnesses: [
            { by: 'MAPLE chant text', text: 'For the second time, I take refuge in the Buddha.', alignTo: ALIGN.refuge_repeat.maple },
            { by: 'Sujato (SuttaCentral)', text: 'For a second time, I go for refuge to the Buddha.', url: 'https://suttacentral.net/kp1/en/sujato', license: 'CC0', alignTo: ALIGN.refuge_repeat.sujato },
          ],
          words: REFUGE_WORDS,
        },
        {
          id: 'refuge-dhamma-2',
          pali: 'Dutiyampi Dhammaṁ saraṇaṁ gacchāmi.',
          paliDeva: 'दुतियम्पि धम्मं सरणं गच्छामि।',
          witnesses: [
            { by: 'MAPLE chant text', text: 'For the second time, I take refuge in the Dhamma.', alignTo: ALIGN.refuge_repeat.maple },
            { by: 'Sujato (SuttaCentral)', text: 'For a second time, I go for refuge to the teaching.', url: 'https://suttacentral.net/kp1/en/sujato', license: 'CC0', alignTo: ALIGN.refuge_repeat.sujato },
          ],
          words: REFUGE_WORDS,
        },
        {
          id: 'refuge-sangha-2',
          pali: 'Dutiyampi Saṅghaṁ saraṇaṁ gacchāmi.',
          paliDeva: 'दुतियम्पि सङ्घं सरणं गच्छामि।',
          witnesses: [
            { by: 'MAPLE chant text', text: 'For the second time, I take refuge in the Sangha.', alignTo: ALIGN.refuge_repeat.maple },
            { by: 'Sujato (SuttaCentral)', text: 'For a second time, I go for refuge to the Saṅgha.', url: 'https://suttacentral.net/kp1/en/sujato', license: 'CC0', alignTo: ALIGN.refuge_repeat.sujato },
          ],
          words: REFUGE_WORDS,
        },
        // Third time
        {
          id: 'refuge-buddha-3',
          pali: 'Tatiyampi Buddhaṁ saraṇaṁ gacchāmi.',
          paliDeva: 'ततियम्पि बुद्धं सरणं गच्छामि।',
          witnesses: [
            { by: 'MAPLE chant text', text: 'For the third time, I take refuge in the Buddha.', alignTo: ALIGN.refuge_repeat.maple },
            { by: 'Sujato (SuttaCentral)', text: 'For a third time, I go for refuge to the Buddha.', url: 'https://suttacentral.net/kp1/en/sujato', license: 'CC0', alignTo: ALIGN.refuge_repeat.sujato },
          ],
          words: REFUGE_WORDS,
        },
        {
          id: 'refuge-dhamma-3',
          pali: 'Tatiyampi Dhammaṁ saraṇaṁ gacchāmi.',
          paliDeva: 'ततियम्पि धम्मं सरणं गच्छामि।',
          witnesses: [
            { by: 'MAPLE chant text', text: 'For the third time, I take refuge in the Dhamma.', alignTo: ALIGN.refuge_repeat.maple },
            { by: 'Sujato (SuttaCentral)', text: 'For a third time, I go for refuge to the teaching.', url: 'https://suttacentral.net/kp1/en/sujato', license: 'CC0', alignTo: ALIGN.refuge_repeat.sujato },
          ],
          words: REFUGE_WORDS,
        },
        {
          id: 'refuge-sangha-3',
          pali: 'Tatiyampi Saṅghaṁ saraṇaṁ gacchāmi.',
          paliDeva: 'ततियम्पि सङ्घं सरणं गच्छामि।',
          witnesses: [
            { by: 'MAPLE chant text', text: 'For the third time, I take refuge in the Sangha.', alignTo: ALIGN.refuge_repeat.maple },
            { by: 'Sujato (SuttaCentral)', text: 'For a third time, I go for refuge to the Saṅgha.', url: 'https://suttacentral.net/kp1/en/sujato', license: 'CC0', alignTo: ALIGN.refuge_repeat.sujato },
          ],
          words: REFUGE_WORDS,
        },
      ],
      commentary:
        'Taking refuge in the **Buddha** = refuge in Siddhartha Gautama for his teaching, as proof that humans can awaken; in our own Buddha nature; in our teacher.\n\nTaking refuge in the **Dhamma** = the sutras, teachings, the Truth of Reality that it points to, the Dao, the path, the way, the practice, Nirvana the ultimate goal.\n\nTaking refuge in the **Sangha** = group mind; transmit and maintain teaching beyond generational timespans; support each other to reinforce commitment.',
    },

    // ───────────────────────────────────────────────────────────────────────
    // 3. Five Precepts — 5 segments
    // ───────────────────────────────────────────────────────────────────────
    {
      id: 'five-precepts',
      shape: 'triple-script-witness',
      segments: [
        {
          id: 'precept-1',
          pali: 'Pāṇātipātā veramaṇī sikkhāpadaṁ samādiyāmi.',
          paliDeva: 'पाणातिपाता वेरमणी सिक्खापदं समादियामि।',
          witnesses: [
            // Surface: Pāṇātipātā(0) veramaṇī(1) sikkhāpadaṁ(2) samādiyāmi.(3)
            // AI: I(0) undertake(1) the(2) practice(3) to(4) refrain(5) from(6) killing(7) living(8) beings.(9)
            { by: 'MAPLE chant text', text: 'I undertake the practice to refrain from killing living beings.', alignTo: [-1, 3, -1, 2, -1, 1, -1, 0, 0, 0] },
            // Sujato: I(0) undertake(1) the(2) training(3) rule(4) to(5) refrain(6) from(7) killing(8) living(9) creatures.(10)
            { by: 'Sujato (SuttaCentral)', text: 'I undertake the training rule to refrain from killing living creatures.', url: 'https://suttacentral.net/kp2/en/sujato', license: 'CC0', alignTo: [-1, 3, -1, 2, 2, -1, 1, -1, 0, 0, 0] },
            // Thanissaro: I(0) undertake(1) the(2) training(3) rule(4) to(5) refrain(6) from(7) taking(8) life.(9)
            { by: 'Thanissaro (Access to Insight)', text: 'I undertake the training rule to refrain from taking life.', url: 'https://www.accesstoinsight.org/lib/authors/thanissaro/index.html', license: 'CC BY-NC', alignTo: [-1, 3, -1, 2, 2, -1, 1, -1, 0, 0] },
          ],
          words: [
            {
              form: 'pāṇātipātā', scriptAlt: 'पाणातिपाता', pronunciation: 'PAH-nah-tee-PAH-tah',
              etymology: '*pāṇā* "living being with breath" + *atipāta* "striking down"',
              gloss: 'killing living beings — deliberately ending a breathing being\'s life',
              citations: [dpdCitation('pāṇātipāta'), pronCite],
              morphemes: [
                { text: 'pāṇā', type: 'stem', gloss: 'a living being, one that breathes', pronunciation: 'PAH-nah', citations: [dpdCitation('pāṇa')] },
                { text: 'ti', type: 'prefix', gloss: 'across, against', pronunciation: 'tee' },
                { text: 'pāt', type: 'root', gloss: 'falling, striking down', pronunciation: 'PAH-t' },
                { text: 'ā', type: 'suffix', gloss: '"from killing" — what I refrain from', pronunciation: 'ah' },
              ],
            },
            ...PRECEPT_FORMULA_WORDS,
          ],
          note: 'To kill is to block the flow of life, gross or subtle. The literal: slaughtering animals to eat them, stepping on a bug while walking. The environmental: damming a river. The internal: killing the part of yourself that wants to be alive in this moment, reacting from habit instead of presence, being inauthentic, blocking your own life-force. Machines are dead things; the precept asks us not to make ourselves into one.',
        },
        {
          id: 'precept-2',
          pali: 'Adinnādānā veramaṇī sikkhāpadaṁ samādiyāmi.',
          paliDeva: 'अदिन्नादाना वेरमणी सिक्खापदं समादियामि।',
          witnesses: [
            // Surface: Adinnādānā(0) veramaṇī(1) sikkhāpadaṁ(2) samādiyāmi.(3)
            // AI: I(0) undertake(1) the(2) practice(3) to(4) refrain(5) from(6) taking(7) what(8) is(9) not(10) given.(11)
            { by: 'MAPLE chant text', text: 'I undertake the practice to refrain from taking what is not given.', alignTo: [-1, 3, -1, 2, -1, 1, -1, 0, 0, 0, 0, 0] },
            // Sujato: I(0) undertake(1) the(2) training(3) rule(4) to(5) refrain(6) from(7) stealing.(8)
            { by: 'Sujato (SuttaCentral)', text: 'I undertake the training rule to refrain from stealing.', url: 'https://suttacentral.net/kp2/en/sujato', license: 'CC0', alignTo: [-1, 3, -1, 2, 2, -1, 1, -1, 0] },
            // Thanissaro: I(0) undertake(1) the(2) training(3) rule(4) to(5) refrain(6) from(7) taking(8) what(9) is(10) not(11) given.(12)
            { by: 'Thanissaro (Access to Insight)', text: 'I undertake the training rule to refrain from taking what is not given.', url: 'https://www.accesstoinsight.org/lib/authors/thanissaro/index.html', license: 'CC BY-NC', alignTo: [-1, 3, -1, 2, 2, -1, 1, -1, 0, 0, 0, 0, 0] },
          ],
          words: [
            {
              form: 'adinnādānā', scriptAlt: 'अदिन्नादाना', pronunciation: 'ah-deen-NAH-dah-nah',
              etymology: '*a-dinna* "not given" + *ādāna* "taking"',
              gloss: 'taking what is not given',
              citations: [dpdCitation('adinnādāna'), pronCite],
              morphemes: [
                { text: 'a', type: 'prefix', gloss: 'not (negation)', pronunciation: 'ah' },
                { text: 'dinnā', type: 'stem', gloss: 'given (past participle of "to give")', pronunciation: 'DEEN-nah' },
                { text: 'dānā', type: 'stem', gloss: 'taking, grasping', pronunciation: 'DAH-nah', citations: [dpdCitation('ādāna')] },
              ],
              scriptMorphemes: {
                'pi-Deva': [
                  { text: 'अ', type: 'prefix', pronunciation: 'ah', gloss: 'not, negation' },
                  { text: 'दिन्ना', type: 'stem', pronunciation: 'DEEN-nah', gloss: 'given (past participle of "to give")' },
                  { text: 'दाना', type: 'stem', pronunciation: 'DAH-nah', gloss: 'taking, grasping' },
                ],
              },
            },
            ...PRECEPT_FORMULA_WORDS,
          ],
          note: 'We are stewards rather than absolute owners; it reifies the self to buy into the sense of ownership.',
        },
        {
          id: 'precept-3',
          pali: 'Kāmesu micchācārā veramaṇī sikkhāpadaṁ samādiyāmi.',
          paliDeva: 'कामेसु मिच्छाचारा वेरमणी सिक्खापदं समादियामि।',
          witnesses: [
            // Surface: Kāmesu(0) micchācārā(1) veramaṇī(2) sikkhāpadaṁ(3) samādiyāmi.(4)
            // AI: I(0) undertake(1) the(2) practice(3) to(4) refrain(5) from(6) sexual(7) misconduct.(8)
            { by: 'MAPLE chant text', text: 'I undertake the practice to refrain from sexual misconduct.', alignTo: [-1, 4, -1, 3, -1, 2, -1, 0, 1] },
            // Sujato: I(0) undertake(1) the(2) training(3) rule(4) to(5) refrain(6) from(7) sexual(8) misconduct.(9)
            { by: 'Sujato (SuttaCentral)', text: 'I undertake the training rule to refrain from sexual misconduct.', url: 'https://suttacentral.net/kp2/en/sujato', license: 'CC0', alignTo: [-1, 4, -1, 3, 3, -1, 2, -1, 0, 1] },
            // Thanissaro: same as Sujato
            { by: 'Thanissaro (Access to Insight)', text: 'I undertake the training rule to refrain from sexual misconduct.', url: 'https://www.accesstoinsight.org/lib/authors/thanissaro/index.html', license: 'CC BY-NC', alignTo: [-1, 4, -1, 3, 3, -1, 2, -1, 0, 1] },
          ],
          words: [
            {
              form: 'kāmesu', scriptAlt: 'कामेसु', pronunciation: 'KAH-may-soo',
              etymology: '*kāma* "sensual pleasure" + "in"',
              gloss: 'in sensual pleasures, in sexual matters',
              citations: [dpdCitation('kāma'), pronCite],
              morphemes: [
                { text: 'kāma', type: 'stem', gloss: 'sensual pleasure, sense-desire — broader than sex; includes pleasures of taste, sound, sight, touch', pronunciation: 'KAH-mah', citations: [dpdCitation('kāma')] },
                { text: 'esu', type: 'suffix', gloss: '"in [these pleasures]" — locates the conduct', pronunciation: 'AY-soo' },
              ],
            },
            {
              form: 'micchācārā', scriptAlt: 'मिच्छाचारा', pronunciation: 'mee-CHAH-chah-rah',
              etymology: '*micchā* "wrong" + *cāra* "conduct"',
              gloss: 'wrong conduct, misconduct',
              citations: [dpdCitation('micchācāra'), pronCite],
              morphemes: [
                { text: 'micchā', type: 'prefix', gloss: 'wrong, false, off-the-path', pronunciation: 'meek-CHAH', citations: [dpdCitation('micchā')] },
                { text: 'cār', type: 'root', gloss: 'conduct, behavior, the way of walking', pronunciation: 'CHAH-r', citations: [dpdCitation('cāra')] },
                { text: 'ā', type: 'suffix', gloss: '"from wrong-conduct" — what I refrain from', pronunciation: 'ah' },
              ],
            },
            ...PRECEPT_FORMULA_WORDS,
          ],
          note: 'Sensual pleasures of flesh, tongue, ears, so broad. Misconduct = respecting past commitments, protected by relationship (no incest, or protected by law), context (time, place, methods).',
        },
        {
          id: 'precept-4',
          pali: 'Musāvādā veramaṇī sikkhāpadaṁ samādiyāmi.',
          paliDeva: 'मुसावादा वेरमणी सिक्खापदं समादियामि।',
          witnesses: [
            // Surface: Musāvādā(0) veramaṇī(1) sikkhāpadaṁ(2) samādiyāmi.(3)
            // AI: I(0) undertake(1) the(2) practice(3) to(4) refrain(5) from(6) false(7) speech.(8)
            { by: 'MAPLE chant text', text: 'I undertake the practice to refrain from false speech.', alignTo: [-1, 3, -1, 2, -1, 1, -1, 0, 0] },
            // Sujato: I(0) undertake(1) the(2) training(3) rule(4) to(5) refrain(6) from(7) lying.(8)
            { by: 'Sujato (SuttaCentral)', text: 'I undertake the training rule to refrain from lying.', url: 'https://suttacentral.net/kp2/en/sujato', license: 'CC0', alignTo: [-1, 3, -1, 2, 2, -1, 1, -1, 0] },
            // Thanissaro: I(0) undertake(1) the(2) training(3) rule(4) to(5) refrain(6) from(7) false(8) speech.(9)
            { by: 'Thanissaro (Access to Insight)', text: 'I undertake the training rule to refrain from false speech.', url: 'https://www.accesstoinsight.org/lib/authors/thanissaro/index.html', license: 'CC BY-NC', alignTo: [-1, 3, -1, 2, 2, -1, 1, -1, 0, 0] },
          ],
          words: [
            {
              form: 'musāvādā', scriptAlt: 'मुसावादा', pronunciation: 'moo-SAH-vah-dah',
              etymology: '*musā* "false" + *vāda* "speech"',
              gloss: 'false speech',
              citations: [dpdCitation('musāvāda'), pronCite],
              morphemes: [
                { text: 'musā', type: 'prefix', gloss: 'false, untrue', pronunciation: 'moo-SAH', citations: [dpdCitation('musā')] },
                { text: 'vād', type: 'root', gloss: 'to speak, to say', pronunciation: 'VAH-d', citations: [dpdCitation('vāda')] },
                { text: 'ā', type: 'suffix', gloss: '"from false speech"', pronunciation: 'ah' },
              ],
              scriptMorphemes: {
                'pi-Deva': [
                  { text: 'मुसा', type: 'prefix', pronunciation: 'moo-SAH', gloss: 'false, untrue' },
                  { text: 'वाद', type: 'root', pronunciation: 'VAH-d', gloss: 'to speak, to say' },
                  { text: 'ा', type: 'suffix', pronunciation: 'ah', gloss: '"from false speech"' },
                ],
              },
            },
            ...PRECEPT_FORMULA_WORDS,
          ],
          note: 'Honesty is the practice by which we cooperate. To lie to someone else is to lie to yourself. We are all in this together. It is like your hand lying to your other hand. The more you practice lying, the more you start to believe your own lies. Then you lose the faith needed to be present in the moment, to trust yourself, to cooperate with all beings. Speech is one of the most powerful actions we have. The precept asks us not to warp it.',
        },
        {
          id: 'precept-5',
          pali: 'Surāmerayamajjapamādaṭṭhānā veramaṇī sikkhāpadaṁ samādiyāmi.',
          paliDeva: 'सुरामेरयमज्जपमादट्ठाना वेरमणी सिक्खापदं समादियामि॥',
          witnesses: [
            // Surface: Surāmerayamajjapamādaṭṭhānā(0) veramaṇī(1) sikkhāpadaṁ(2) samādiyāmi.(3)
            // The long compound (0) packs "fermented liquor + distilled liquor + intoxicants + heedlessness + cause".
            // AI: I(0) undertake(1) the(2) practice(3) to(4) refrain(5) from(6) taking(7) intoxicants(8) which(9) cloud(10) the(11) mind(12) and(13) cause(14) heedlessness.(15)
            { by: 'MAPLE chant text', text: 'I undertake the practice to refrain from taking intoxicants which cloud the mind and cause heedlessness.', alignTo: [-1, 3, -1, 2, -1, 1, -1, 0, 0, -1, 0, -1, 0, -1, 0, 0] },
            // Sujato: I(0) undertake(1) the(2) training(3) rule(4) to(5) refrain(6) from(7) alcoholic(8) drinks(9) that(10) cause(11) negligence.(12)
            { by: 'Sujato (SuttaCentral)', text: 'I undertake the training rule to refrain from alcoholic drinks that cause negligence.', url: 'https://suttacentral.net/kp2/en/sujato', license: 'CC0', alignTo: [-1, 3, -1, 2, 2, -1, 1, -1, 0, 0, -1, 0, 0] },
            // Thanissaro: I(0) undertake(1) the(2) training(3) rule(4) to(5) refrain(6) from(7) fermented(8) drinks(9) that(10) cause(11) heedlessness.(12)
            { by: 'Thanissaro (Access to Insight)', text: 'I undertake the training rule to refrain from fermented drinks that cause heedlessness.', url: 'https://www.accesstoinsight.org/lib/authors/thanissaro/index.html', license: 'CC BY-NC', alignTo: [-1, 3, -1, 2, 2, -1, 1, -1, 0, 0, -1, 0, 0] },
          ],
          words: [
            {
              form: 'surāmerayamajjapamādaṭṭhānā', scriptAlt: 'सुरामेरयमज्जपमादट्ठाना', pronunciation: 'soo-RAH-may-rah-yah-MUH-jah-pah-MAH-dah-TTAH-nah',
              etymology: 'four nouns + compound ending — "the basis of heedlessness via [fermented liquor + distilled liquor + intoxicants]"',
              gloss: 'the basis-of-heedlessness from intoxicants — what I refrain from',
              citations: [dpdCitation('majjapamādaṭṭhāna'), pronCite],
              morphemes: [
                { text: 'surā', type: 'stem', gloss: 'fermented liquor (e.g. beer, wine)', pronunciation: 'soo-RAH', citations: [dpdCitation('surā')] },
                { text: 'meraya', type: 'stem', gloss: 'distilled liquor, spirits', pronunciation: 'may-rah-yah', citations: [dpdCitation('meraya')] },
                { text: 'majja', type: 'stem', gloss: 'intoxicants — anything that intoxicates', pronunciation: 'MUH-jah', citations: [dpdCitation('majja')] },
                { text: 'pamāda', type: 'stem', gloss: 'heedlessness — the opposite of attention; the Buddha\'s last word warned against this', pronunciation: 'pah-MAH-dah', citations: [dpdCitation('pamāda')] },
                { text: 'ṭṭhānā', type: 'suffix', gloss: 'basis, cause — what produces [heedlessness]', pronunciation: 'TTAH-nah', citations: [dpdCitation('ṭhāna')] },
              ],
            },
            ...PRECEPT_FORMULA_WORDS,
          ],
          note: 'The precept names the *basis* of heedlessness. [[appamāda]], heedfulness, paying attention to the present. The Buddha\'s last words: *appamādena sampādetha*, strive with heedfulness. The cultivation of mindfulness ([[sati]]) and its opposite, heedlessness (*pamāda*).',
        },
      ],
    },

    // ───────────────────────────────────────────────────────────────────────
    // 4. Ovāda Pāṭimokkha — 4 segments (one per line of the verse)
    // ───────────────────────────────────────────────────────────────────────
    {
      id: 'ovada-patimokkha',
      shape: 'triple-script-witness',
      repetitions: 3,
      segments: [
        {
          id: 'ovada-1',
          pali: 'Sabba pāpassa akaraṇaṁ,',
          paliDeva: 'सब्ब पापस्स अकरणं,',
          witnesses: [
            // Surface: Sabba(0) pāpassa(1) akaraṇaṁ,(2)
            // AI: To(0) do(1) no(2) evil,(3)
            { by: 'MAPLE chant text', text: 'To do no evil,', alignTo: [-1, 2, 2, 1] },
            // Sujato: Not(0) to(1) do(2) any(3) evil;(4)
            { by: 'Sujato (SuttaCentral)', text: 'Not to do any evil;', url: 'https://suttacentral.net/dhp183/en/sujato', license: 'CC0', alignTo: [2, -1, 2, 0, 1] },
            // Buddharakkhita: To(0) avoid(1) all(2) evil,(3)
            { by: 'Buddharakkhita (BPS)', text: 'To avoid all evil,', url: 'https://www.accesstoinsight.org/tipitaka/kn/dhp/dhp.14.budd.html', alignTo: [-1, 2, 0, 1] },
          ],
          words: [
            {
              form: 'sabba', scriptAlt: 'सब्ब', pronunciation: 'SUB-bah',
              etymology: '*sabba* — all, every',
              gloss: 'all, every, the entirety of',
              citations: [dpdCitation('sabba'), pronCite],
              morphemes: [
                { text: 'sabba', type: 'stem', gloss: 'all, every, the entirety of', pronunciation: 'SUB-bah', citations: [dpdCitation('sabba')] },
              ],
            },
            {
              form: 'pāpassa', scriptAlt: 'पापस्स', pronunciation: 'PAH-pah-sah',
              etymology: '*pāpa* "evil" + "of/from"',
              gloss: 'of evil, unwholesome, harmful',
              citations: [dpdCitation('pāpa'), pronCite],
              morphemes: [
                { text: 'pāp', type: 'root', gloss: 'evil, unwholesome, harmful', pronunciation: 'PAH-p', citations: [dpdCitation('pāpa')] },
                { text: 'assa', type: 'suffix', gloss: '"of [evil]" — marks the thing avoided', pronunciation: 'AH-sah' },
              ],
            },
            {
              form: 'akaraṇaṁ', scriptAlt: 'अकरणं', pronunciation: 'ah-KAH-rah-nang',
              etymology: '*a-* "not" + *karaṇa* "doing"',
              gloss: 'non-doing, abstention, avoidance',
              citations: [dpdCitation('akaraṇa'), pronCite],
              morphemes: [
                { text: 'a', type: 'prefix', gloss: 'not (negation)', pronunciation: 'ah' },
                { text: 'karaṇ', type: 'root', gloss: 'doing, action — from "to do"', pronunciation: 'KAH-rah-n', citations: [dpdCitation('karaṇa')] },
                { text: 'aṁ', type: 'suffix', gloss: '"the non-doing" — the act of not-doing as a thing', pronunciation: 'ang' },
              ],
            },
          ],
        },
        {
          id: 'ovada-2',
          pali: 'kusalassa upasampadā;',
          paliDeva: 'कुसलस्स उपसम्पदा;',
          witnesses: [
            // Surface: kusalassa(0) upasampadā;(1)
            // AI: to(0) practice(1) good,(2)
            { by: 'MAPLE chant text', text: 'to practice good,', alignTo: [-1, 1, 0] },
            // Sujato: to(0) embrace(1) the(2) good;(3)
            { by: 'Sujato (SuttaCentral)', text: 'to embrace the good;', url: 'https://suttacentral.net/dhp183/en/sujato', license: 'CC0', alignTo: [-1, 1, -1, 0] },
            // Buddharakkhita: to(0) cultivate(1) good,(2)
            { by: 'Buddharakkhita (BPS)', text: 'to cultivate good,', url: 'https://www.accesstoinsight.org/tipitaka/kn/dhp/dhp.14.budd.html', alignTo: [-1, 1, 0] },
          ],
          words: [
            {
              form: 'kusalassa', scriptAlt: 'कुसलस्स', pronunciation: 'koo-SAH-lah-sah',
              etymology: '*kusala* "skillful/wholesome" + "of"',
              gloss: 'of the wholesome, skillful, beneficial — actions skillfully aligned with reality; richer than English "good"',
              citations: [dpdCitation('kusala'), pronCite],
              morphemes: [
                { text: 'kusal', type: 'stem', gloss: 'skillful, wholesome — what conduces to awakening; not merely "good" in a moral sense but technically right, the way a craftsman\'s work is "kusala"', pronunciation: 'koo-SAH-l', citations: [dpdCitation('kusala')] },
                { text: 'assa', type: 'suffix', gloss: '"of the wholesome" — marks what is being cultivated', pronunciation: 'AH-sah' },
              ],
            },
            {
              form: 'upasampadā', scriptAlt: 'उपसम्पदा', pronunciation: 'oo-pah-sahm-PAH-dah',
              etymology: '*upa-* "toward" + *sam-* "fully" + *padā* "attainment"',
              gloss: 'undertaking, taking up — "approaching attainment"',
              citations: [dpdCitation('upasampadā'), pronCite],
              morphemes: [
                { text: 'upa', type: 'prefix', gloss: 'toward, near, approaching', pronunciation: 'oo-pah' },
                { text: 'sam', type: 'prefix', gloss: 'fully, completely', pronunciation: 'sahm' },
                { text: 'pad', type: 'root', gloss: 'step, attain — from "to set foot"', pronunciation: 'PAH-d', citations: [dpdCitation('padā')] },
                { text: 'ā', type: 'suffix', gloss: '"the attainment" — the noun form', pronunciation: 'AH' },
              ],
            },
          ],
        },
        {
          id: 'ovada-3',
          pali: 'sacittapariyodapanaṁ,',
          paliDeva: 'सचित्तपरियोदपनं,',
          witnesses: [
            // Surface: sacittapariyodapanaṁ,(0)  — one big compound word
            // AI: and(0) to(1) purify(2) one's(3) own(4) mind;(5)
            { by: 'MAPLE chant text', text: "and to purify one's own mind;", alignTo: [-1, -1, 0, 0, 0, 0] },
            // Sujato: to(0) purify(1) one's(2) mind:(3)
            { by: 'Sujato (SuttaCentral)', text: "to purify one's mind:", url: 'https://suttacentral.net/dhp183/en/sujato', license: 'CC0', alignTo: [-1, 0, 0, 0] },
            // Buddharakkhita: and(0) to(1) cleanse(2) one's(3) mind(4) —(5)
            { by: 'Buddharakkhita (BPS)', text: "and to cleanse one's mind —", url: 'https://www.accesstoinsight.org/tipitaka/kn/dhp/dhp.14.budd.html', alignTo: [-1, -1, 0, 0, 0, -1] },
          ],
          words: [
            {
              form: 'sacittapariyodapanaṁ', scriptAlt: 'सचित्तपरियोदपनं', pronunciation: 'sah-CHIT-tah-pah-ree-YO-dah-pah-nang',
              etymology: '*sa* "own" + *citta* "mind" + *pari-* "completely" + *ava-* "down" + √dā "cleanse"',
              gloss: 'the thorough purification of one\'s own mind',
              citations: [dpdCitation('pariyodapana'), pronCite],
              morphemes: [
                { text: 'sa', type: 'prefix', gloss: 'one\'s own', pronunciation: 'sah' },
                { text: 'citta', type: 'stem', gloss: 'mind, heart, awareness', pronunciation: 'CHIT-tah', citations: [dpdCitation('citta')] },
                { text: 'pari', type: 'prefix', gloss: 'completely, thoroughly, all around', pronunciation: 'pah-ree' },
                { text: 'yoda', type: 'stem', gloss: 'down, off — what is being removed', pronunciation: 'YO-dah' },
                { text: 'pan', type: 'root', root: '√dā', gloss: 'cleansing, purifying', pronunciation: 'PAH-n' },
                { text: 'aṁ', type: 'suffix', gloss: '"the cleansing" — the noun form', pronunciation: 'ang' },
              ],
            },
          ],
        },
        {
          id: 'ovada-4',
          pali: 'etaṁ buddhāna sāsanaṁ.',
          paliDeva: 'एतं बुद्धान सासनं॥',
          witnesses: [
            // Surface: etaṁ(0) buddhāna(1) sāsanaṁ.(2)
            // AI: this(0) is(1) the(2) teaching(3) of(4) the(5) Buddhas.(6)
            { by: 'MAPLE chant text', text: 'this is the teaching of the Buddhas.', alignTo: [0, -1, -1, 2, -1, -1, 1] },
            // Sujato: this(0) is(1) the(2) instruction(3) of(4) the(5) Buddhas.(6)
            { by: 'Sujato (SuttaCentral)', text: 'this is the instruction of the Buddhas.', url: 'https://suttacentral.net/dhp183/en/sujato', license: 'CC0', alignTo: [0, -1, -1, 2, -1, -1, 1] },
            // Buddharakkhita: same as MAPLE here
            { by: 'Buddharakkhita (BPS)', text: 'this is the teaching of the Buddhas.', url: 'https://www.accesstoinsight.org/tipitaka/kn/dhp/dhp.14.budd.html', alignTo: [0, -1, -1, 2, -1, -1, 1] },
          ],
          words: [
            {
              form: 'etaṁ', scriptAlt: 'एतं', pronunciation: 'AY-tang',
              etymology: '*eta-* "this" + accusative ending',
              gloss: 'this',
              citations: [dpdCitation('etaṁ'), pronCite],
              morphemes: [
                { text: 'eta', type: 'stem', gloss: 'this, this very one', pronunciation: 'AY-tah' },
                { text: 'ṁ', type: 'suffix', gloss: '"this [is]"', pronunciation: 'ng' },
              ],
            },
            {
              form: 'buddhāna', scriptAlt: 'बुद्धान', pronunciation: 'bood-DHAH-nah',
              root: '√budh',
              etymology: '*buddha* + plural "of"',
              gloss: 'of the Buddhas (across all time)',
              citations: [dpdCitation('buddha'), pronCite],
              morphemes: [
                { text: 'buddh', type: 'root', root: '√budh', gloss: 'to wake, to know', pronunciation: 'BOO-dh', citations: [dpdCitation('bujjhati')] },
                { text: 'āna', type: 'suffix', gloss: '"of the Buddhas" — plural across time', pronunciation: 'AH-nah' },
              ],
            },
            {
              form: 'sāsanaṁ', scriptAlt: 'सासनं', pronunciation: 'SAH-sah-nang',
              root: '√śās',
              etymology: '√śās "to instruct" + noun form',
              gloss: 'teaching, instruction, dispensation',
              citations: [dpdCitation('sāsana'), pronCite],
              morphemes: [
                { text: 'sās', type: 'root', root: '√śās', gloss: 'to instruct, to teach', pronunciation: 'SAH-s', citations: [dpdCitation('sāsana')] },
                { text: 'an', type: 'suffix', gloss: 'turns "to teach" into "teaching" (the noun)', pronunciation: 'ah-n' },
                { text: 'aṁ', type: 'suffix', gloss: '"the teaching" — what this is', pronunciation: 'ang' },
              ],
            },
          ],
        },
      ],
    },
  ],
};

export default morningChants;

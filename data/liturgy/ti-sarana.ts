/**
 * Ti-Sarana + Namo Tassa — Bodhi Sangha's Pali devotional opening.
 *
 * Two short Pali pieces from the Bodhi Sangha sutra booklet (May 2016):
 *   - Ti-Sarana: the Threefold Refuge formula plus the *Om Shanti* peace
 *     closing — a Pali / Sanskrit-Hindu hybrid the sangha uses to mark
 *     the threshold between formal chanting and silence.
 *   - Namo Tassa: the standard Theravāda homage to the Buddha, here
 *     placed at the close of *Shin-Jin-No-Mei* in the booklet but more
 *     naturally read as a discrete Pali piece.
 *
 * Bodhi Sangha is AMA Samy's Rinzai-Soto Zen community in Tamil Nadu,
 * India. The booklet's Pali pieces are a small Theravāda strand running
 * through an otherwise Japanese-Zen liturgy — the community's Indian
 * setting surfaces through these few lines.
 */

import type { LiturgyDoc, WordGloss } from '../../types/liturgy';
import {
  dpdCitation,
  suttaCentralPronunciationCitation,
  ungroundedCitation,
} from './_groundingHelpers';

const pronCite = suttaCentralPronunciationCitation();

const REFUGE_OBJECT_WORDS: { [key: string]: WordGloss } = {
  buddhaṁ: {
    form: 'Buddhaṁ', scriptAlt: 'बुद्धं', pronunciation: 'BUD-dahng', accent: 'amber',
    etymology: '√budh "to wake up" + past participle',
    gloss: 'the Awakened One — accusative (object of "I go to")',
    citations: [dpdCitation('buddha'), pronCite],
  },
  dhammaṁ: {
    form: 'Dhammaṁ', scriptAlt: 'धम्मं', pronunciation: 'DHAHM-mahng', accent: 'sky',
    etymology: '√dhṛ "to hold, support"',
    gloss: 'the Dharma — the teaching, the way things are',
    citations: [dpdCitation('dhamma'), pronCite],
  },
  saṅghaṁ: {
    form: 'Saṅghaṁ', scriptAlt: 'सङ्घं', pronunciation: 'SUNG-hahng', accent: 'rose',
    etymology: 'saṃ- "together" + √han "to come, strike"',
    gloss: 'the community of practitioners, especially the noble Sangha',
    citations: [dpdCitation('saṅgha'), pronCite],
  },
};

const SARANAM: WordGloss = {
  form: 'Saraṇaṁ', scriptAlt: 'सरणं', pronunciation: 'SAH-rah-nahng',
  etymology: '√śri "to take shelter, lean on"',
  gloss: 'refuge, shelter — accusative (the destination)',
  citations: [dpdCitation('saraṇa'), pronCite],
};

const GACCHAMI: WordGloss = {
  form: 'Gacchāmi', scriptAlt: 'गच्छामि', pronunciation: 'gahch-CHAH-mee',
  etymology: '√gam "to go" + present tense, first-person singular',
  gloss: 'I go — first-person, declarative',
  citations: [dpdCitation('gacchati'), pronCite],
};

export const tiSarana: LiturgyDoc = {
  slug: 'ti-sarana',
  sangha: 'bodhi-sangha',
  order: 1,
  title: 'Ti-Sarana + Namo Tassa',
  subtitle: 'Threefold Refuge and Homage to the Awakened One',
  tradition: 'theravada',
  context: 'Pali devotional pieces in Bodhi Sangha\'s otherwise Japanese-Zen liturgy — the Threefold Refuge (in Buddha, Dhamma, Sangha) and the homage formula *Namo tassa bhagavato arahato sammāsambuddhassa*.',
  sources: {
    canonical: [
      { label: 'Khp 1 (Saraṇagamana)', url: 'https://suttacentral.net/kp1/en/sujato' },
      { label: 'Iti-uttama gāthā (homage to the Buddha)', url: 'https://suttacentral.net/define/namo' },
    ],
    ritual: [
      { label: 'Bodhi Sangha Sutras booklet (May 2016)', url: 'https://bodhizendo.org' },
    ],
  },
  curator:
    'Curation by Aditya. Pali phrasing and the simple English glosses are from the Bodhi Sangha booklet (Notes page, May 2016). Word data follows the same DPD + SC-pronunciation grounding used elsewhere in this reader.',
  sections: [
    {
      id: 'ti-sarana',
      shape: 'triple-script-witness',
      repetitions: 3,
      large: true,
      segments: [
        {
          id: 'buddha-refuge',
          pali: 'Buddhaṁ saraṇaṁ gacchāmi.',
          paliDeva: 'बुद्धं सरणं गच्छामि।',
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'I take refuge in the Buddha.',
              alignTo: [2, 1, 1, -1, -1, 0],
              license: 'Bodhi Sangha booklet (Notes)',
            },
          ],
          words: [REFUGE_OBJECT_WORDS.buddhaṁ, SARANAM, GACCHAMI],
        },
        {
          id: 'dhamma-refuge',
          pali: 'Dhammaṁ saraṇaṁ gacchāmi.',
          paliDeva: 'धम्मं सरणं गच्छामि।',
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'I take refuge in the Dharma.',
              alignTo: [2, 1, 1, -1, -1, 0],
              license: 'Bodhi Sangha booklet (Notes)',
            },
          ],
          words: [REFUGE_OBJECT_WORDS.dhammaṁ, SARANAM, GACCHAMI],
        },
        {
          id: 'sangha-refuge',
          pali: 'Saṅghaṁ saraṇaṁ gacchāmi.',
          paliDeva: 'सङ्घं सरणं गच्छामि।',
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'I take refuge in the Sangha.',
              alignTo: [2, 1, 1, -1, -1, 0],
              license: 'Bodhi Sangha booklet (Notes)',
            },
          ],
          words: [REFUGE_OBJECT_WORDS.saṅghaṁ, SARANAM, GACCHAMI],
        },
      ],
      commentary:
        'The classical Threefold Refuge, taken three times. The structure (X saraṇaṁ gacchāmi) is identical across the three lines; only the object of refuge cycles — Buddha, Dhamma, Saṅgha. The accent colors here trace that cycle.',
    },
    {
      id: 'om-shanti',
      shape: 'triple-script-witness',
      segments: [
        {
          id: 'om-shanti-line',
          pali: 'Om Shanti Shanti Shanti',
          paliDeva: 'ॐ शान्ति शान्ति शान्ति',
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'Peace, Peace, Peace / Shalom, Shalom, Shalom.',
              alignTo: [1, 1, 1, -1, 1, 1, 1],
              license: 'Bodhi Sangha booklet (Notes)',
            },
          ],
          words: [
            {
              form: 'Om', scriptAlt: 'ॐ', pronunciation: 'AUM',
              gloss: 'The pre-Buddhist Vedic syllable, taken into Buddhist (and Hindu, Sikh, Jain) practice as the seed-sound of the absolute. Bodhi Sangha\'s use here is Indian-syncretic — *Om* is not a standard Pali Buddhist syllable but is woven into the sangha\'s setting.',
              citations: [ungroundedCitation('Om in syncretic Indo-Buddhist usage')],
            },
            {
              form: 'Shanti', scriptAlt: 'शान्ति', pronunciation: 'SHAHN-tee',
              etymology: '√śam "to be at peace, become still"',
              gloss: 'Peace, stillness, calm. Sanskrit (not Pali — Pali would be *santi*). Repeated three times for body, speech, mind.',
            },
          ],
          note: 'The booklet glosses this line "Peace, Peace, Peace / Shalom, Shalom, Shalom" — the Hebrew *shalom* pairing acknowledges that the threefold peace prayer crosses traditions and that the practice community can include Jewish practitioners.',
        },
      ],
    },
    {
      id: 'namo-tassa',
      shape: 'triple-script-witness',
      segments: [
        {
          id: 'namo-tassa-line',
          pali: 'Namo Tassa Bhagavato Arahato Sammā Sambuddhassa',
          paliDeva: 'नमो तस्स भगवतो अरहतो सम्मा सम्बुद्धस्स',
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'Veneration to the Blessed One, the Worthy, the Truly Awakened.',
              alignTo: [0, 1, -1, 2, 2, -1, 3, -1, 4, 5],
              license: 'Bodhi Sangha booklet (Notes)',
            },
          ],
          words: [
            {
              form: 'Namo', scriptAlt: 'नमो', pronunciation: 'nah-MOH', root: '√nam',
              etymology: '√nam "to bow"', gloss: 'homage, reverence',
              citations: [dpdCitation('namo'), pronCite],
              morphemes: [
                { text: 'nam', type: 'root', root: '√nam', gloss: 'to bow', pronunciation: 'nah', citations: [dpdCitation('namati')] },
                { text: 'o', type: 'suffix', gloss: 'turns "to bow" into "an act of homage"', pronunciation: 'MOH' },
              ],
            },
            {
              form: 'Tassa', scriptAlt: 'तस्स', pronunciation: 'TAH-sah',
              etymology: 'pointer word + "to him"', gloss: 'to him, to that one',
              citations: [dpdCitation('ta'), pronCite],
            },
            {
              form: 'Bhagavato', scriptAlt: 'भगवतो', pronunciation: 'bah-gah-VAH-toh',
              etymology: '*bhaga* "fortune" + *-vant* "possessing"',
              gloss: 'the Blessed One, the Exalted One',
              citations: [dpdCitation('bhagavant'), pronCite],
            },
            {
              form: 'Arahato', scriptAlt: 'अरहतो', pronunciation: 'ah-rah-HAH-toh',
              etymology: '*araha* "worthy"', gloss: 'the Worthy One; one free of defilements',
              citations: [dpdCitation('arahant'), pronCite],
            },
            {
              form: 'Sammā', scriptAlt: 'सम्मा', pronunciation: 'sahm-MAH',
              gloss: 'rightly, fully, perfectly',
              citations: [dpdCitation('sammā'), pronCite],
            },
            {
              form: 'Sambuddhassa', scriptAlt: 'सम्बुद्धस्स', pronunciation: 'sahm-bud-DHAH-sah',
              etymology: '*sam-* "fully" + *buddha* "awakened" + dative ending',
              gloss: 'to the fully self-awakened one',
              citations: [dpdCitation('sambuddha'), pronCite],
            },
          ],
        },
      ],
      commentary:
        'The standard Pali homage opening Theravāda recitation. The Bodhi Sangha booklet prints it after *Shin-Jin-No-Mei*, but it functions as a self-contained Theravāda formula — recited before any chant in the Pali stream of the sangha\'s practice.',
    },
  ],
};

export default tiSarana;

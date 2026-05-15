/**
 * Morning Chants — Theravāda Devotional Sequence as chanted at MAPLE.
 *
 * Transcribed from the printed sheet (PXL_20250525_190125521.jpg).
 * Pronunciation respellings, root traces, and etymological breakdowns
 * follow Pāli grammar tradition. Each word carries citations grounding
 * the etymology + pronunciation in DPD / SC pronunciation guide.
 *
 * Pluralism principle: MAPLE chants this version; Sujato (SC, CC0) and
 * Thanissaro (ATI, CC BY-NC) are alternative witnesses surfaced under
 * click-to-cycle. None is canonical.
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

const HOMAGE_WORDS: WordGloss[] = [
  {
    form: 'namo', scriptAlt: 'नमो', pronunciation: 'nah-MOH', root: '√nam',
    etymology: '√nam "to bow, to bend"', gloss: 'homage, reverence',
    citations: [dpdCitation('namo'), pronCite],
  },
  {
    form: 'tassa', scriptAlt: 'तस्स', pronunciation: 'TAH-sah',
    etymology: 'dative singular of *ta-* (demonstrative)',
    gloss: 'to him, to that one',
    citations: [dpdCitation('ta'), pronCite],
  },
  {
    form: 'bhagavato', scriptAlt: 'भगवतो', pronunciation: 'bah-gah-VAH-toh',
    etymology: '*bhaga* "fortune, share" + *-vant* "possessing"',
    gloss: 'the Exalted, the Blessed, the Revered One',
    citations: [dpdCitation('bhagavant'), pronCite],
  },
  {
    form: 'arahato', scriptAlt: 'अरहतो', pronunciation: 'ah-rah-HAH-toh',
    etymology: '*araha* "worthy" + *-ant* (participial). Traditional commentaries also derive arahat as *ari* "enemy" + *hata* "slain" — "slayer of inner foes".',
    gloss: 'the Worthy One; one free from defilements',
    citations: [
      dpdCitation('arahant'),
      pronCite,
      ungroundedCitation('commentarial etymology needs PED check'),
    ],
  },
  {
    form: 'sammā', scriptAlt: 'सम्मा', pronunciation: 'sahm-MAH',
    etymology: '*sam-* "complete" + *-ā* (adverbial)',
    gloss: 'perfectly, completely, rightly',
    citations: [dpdCitation('sammā'), pronCite],
  },
  {
    form: 'sam-', scriptAlt: 'सम्', pronunciation: 'sahm',
    etymology: 'prefix',
    gloss: 'self, by oneself (in *sammāsambuddha* compound)',
    citations: [dpdCitation('saṁ'), pronCite],
  },
  {
    form: 'buddhassa', scriptAlt: 'बुद्धस्स', pronunciation: 'boo-DHAH-sah',
    root: '√budh',
    etymology: '√budh "to wake, to know" → *buddha* (past participle) "awakened"; *-assa* dative',
    gloss: 'of the Awakened One',
    citations: [dpdCitation('buddha'), pronCite],
  },
];

const REFUGE_WORDS: WordGloss[] = [
  {
    form: 'buddhaṁ', scriptAlt: 'बुद्धं', pronunciation: 'BOO-dhang', root: '√budh',
    etymology: '√budh "to wake" → *buddha* "the Awakened One"; *-ṁ* accusative',
    gloss: 'to the Buddha (object of "go to")',
    citations: [dpdCitation('buddha'), pronCite],
  },
  {
    form: 'dhammaṁ', scriptAlt: 'धम्मं', pronunciation: 'DHUM-mang', root: '√dhṛ',
    etymology: '√dhṛ "to hold, to support" → *dhamma* "that which supports"; *-ṁ* accusative',
    gloss: 'to the Dhamma — the teaching, truth, way',
    citations: [dpdCitation('dhamma'), pronCite],
  },
  {
    form: 'saṅghaṁ', scriptAlt: 'सङ्घं', pronunciation: 'SUNG-hang',
    etymology: '*sam-* "together" + √han "to bring" → *saṅgha* "assembly"; *-ṁ* accusative',
    gloss: 'to the Sangha — the community',
    citations: [dpdCitation('saṅgha'), pronCite],
  },
  {
    form: 'saraṇaṁ', scriptAlt: 'सरणं', pronunciation: 'SAH-rah-nang', root: '√śri',
    etymology: '√śri "to lean on, to resort to" → *saraṇa*',
    gloss: 'refuge, shelter, protection',
    citations: [dpdCitation('saraṇa'), pronCite],
  },
  {
    form: 'gacchāmi', scriptAlt: 'गच्छामि', pronunciation: 'gah-CHAH-mee', root: '√gam',
    etymology: '√gam "to go" → *gacchati*; *-āmi* 1st person singular',
    gloss: 'I go to, I approach',
    citations: [dpdCitation('gacchati'), pronCite],
  },
  {
    form: 'dutiyampi', scriptAlt: 'दुतियम्पि', pronunciation: 'doo-TEE-yam-pee',
    etymology: '*dutiya* "second" + *pi* "also"',
    gloss: 'for the second time also',
    citations: [dpdCitation('dutiya'), pronCite],
  },
  {
    form: 'tatiyampi', scriptAlt: 'ततियम्पि', pronunciation: 'tah-TEE-yam-pee',
    etymology: '*tatiya* "third" + *pi* "also"',
    gloss: 'for the third time also',
    citations: [dpdCitation('tatiya'), pronCite],
  },
];

const PRECEPT_FORMULA_WORDS: WordGloss[] = [
  {
    form: 'veramaṇī', scriptAlt: 'वेरमणी', pronunciation: 'vay-rah-MAH-nee',
    etymology: '*vi-* (away) + √ram "to delight"',
    gloss: 'abstention from, refraining from',
    citations: [dpdCitation('veramaṇī'), pronCite],
  },
  {
    form: 'sikkhāpadaṁ', scriptAlt: 'सिक्खापदं', pronunciation: 'sik-KHAH-pah-dang',
    etymology: '*sikkhā* "training" + *pada* "step, foot"',
    gloss: 'training rule; literally "step in training"',
    citations: [dpdCitation('sikkhāpada'), pronCite],
  },
  {
    form: 'samādiyāmi', scriptAlt: 'समादियामि', pronunciation: 'sah-MAH-dee-YAH-mee',
    etymology: '*sam-* (together) + *ā-* (towards) + √dā "to take"',
    gloss: 'I undertake, I take upon myself',
    citations: [dpdCitation('samādiyati'), pronCite],
  },
];

export const morningChants: LiturgyDoc = {
  slug: 'morning-chants',
  title: 'Morning Chants',
  subtitle: 'Theravāda devotional sequence — chanted before breakfast at MAPLE',
  tradition: 'theravada',
  sources: {
    canonical: [
      { label: 'Khp 1', url: 'https://suttacentral.net/kp1' },
      { label: 'Khp 2', url: 'https://suttacentral.net/kp2' },
      { label: 'Dhp 183', url: 'https://suttacentral.net/dhp183-185' },
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
            { by: 'MAPLE', text: 'Homage to the Exalted, noble, and Fully Self-Enlightened One.' },
            {
              by: 'Sujato (SuttaCentral)',
              text: 'Homage to the Blessed One, the perfected one, the fully awakened Buddha.',
              url: 'https://suttacentral.net/kp1/en/sujato',
              license: 'CC0',
            },
            {
              by: 'Thanissaro (Access to Insight)',
              text: 'Homage to the Blessed One, the Worthy One, the Rightly Self-awakened One.',
              url: 'https://www.accesstoinsight.org/lib/authors/thanissaro/index.html',
              license: 'CC BY-NC',
            },
          ],
          words: HOMAGE_WORDS,
        },
      ],
      commentary: 'Chanted three times to signify dedication of body, speech, and mind.',
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
            { by: 'MAPLE', text: 'I take refuge in the Buddha.' },
            { by: 'Sujato (SuttaCentral)', text: 'I go for refuge to the Buddha.', url: 'https://suttacentral.net/kp1/en/sujato', license: 'CC0' },
            { by: 'Thanissaro (Access to Insight)', text: 'I go to the Buddha for refuge.', url: 'https://www.accesstoinsight.org/lib/authors/thanissaro/index.html', license: 'CC BY-NC' },
          ],
          words: REFUGE_WORDS,
        },
        {
          id: 'refuge-dhamma-1',
          pali: 'Dhammaṁ saraṇaṁ gacchāmi.',
          paliDeva: 'धम्मं सरणं गच्छामि।',
          witnesses: [
            { by: 'MAPLE', text: 'I take refuge in the Dhamma.' },
            { by: 'Sujato (SuttaCentral)', text: 'I go for refuge to the teaching.', url: 'https://suttacentral.net/kp1/en/sujato', license: 'CC0' },
            { by: 'Thanissaro (Access to Insight)', text: 'I go to the Dhamma for refuge.', url: 'https://www.accesstoinsight.org/lib/authors/thanissaro/index.html', license: 'CC BY-NC' },
          ],
          words: REFUGE_WORDS,
        },
        {
          id: 'refuge-sangha-1',
          pali: 'Saṅghaṁ saraṇaṁ gacchāmi.',
          paliDeva: 'सङ्घं सरणं गच्छामि।',
          witnesses: [
            { by: 'MAPLE', text: 'I take refuge in the Sangha.' },
            { by: 'Sujato (SuttaCentral)', text: 'I go for refuge to the Saṅgha.', url: 'https://suttacentral.net/kp1/en/sujato', license: 'CC0' },
            { by: 'Thanissaro (Access to Insight)', text: 'I go to the Sangha for refuge.', url: 'https://www.accesstoinsight.org/lib/authors/thanissaro/index.html', license: 'CC BY-NC' },
          ],
          words: REFUGE_WORDS,
        },
        // Second time
        {
          id: 'refuge-buddha-2',
          pali: 'Dutiyampi Buddhaṁ saraṇaṁ gacchāmi.',
          paliDeva: 'दुतियम्पि बुद्धं सरणं गच्छामि।',
          witnesses: [
            { by: 'MAPLE', text: 'For the second time, I take refuge in the Buddha.' },
            { by: 'Sujato (SuttaCentral)', text: 'For a second time, I go for refuge to the Buddha.', url: 'https://suttacentral.net/kp1/en/sujato', license: 'CC0' },
          ],
          words: REFUGE_WORDS,
        },
        {
          id: 'refuge-dhamma-2',
          pali: 'Dutiyampi Dhammaṁ saraṇaṁ gacchāmi.',
          paliDeva: 'दुतियम्पि धम्मं सरणं गच्छामि।',
          witnesses: [
            { by: 'MAPLE', text: 'For the second time, I take refuge in the Dhamma.' },
            { by: 'Sujato (SuttaCentral)', text: 'For a second time, I go for refuge to the teaching.', url: 'https://suttacentral.net/kp1/en/sujato', license: 'CC0' },
          ],
          words: REFUGE_WORDS,
        },
        {
          id: 'refuge-sangha-2',
          pali: 'Dutiyampi Saṅghaṁ saraṇaṁ gacchāmi.',
          paliDeva: 'दुतियम्पि सङ्घं सरणं गच्छामि।',
          witnesses: [
            { by: 'MAPLE', text: 'For the second time, I take refuge in the Sangha.' },
            { by: 'Sujato (SuttaCentral)', text: 'For a second time, I go for refuge to the Saṅgha.', url: 'https://suttacentral.net/kp1/en/sujato', license: 'CC0' },
          ],
          words: REFUGE_WORDS,
        },
        // Third time
        {
          id: 'refuge-buddha-3',
          pali: 'Tatiyampi Buddhaṁ saraṇaṁ gacchāmi.',
          paliDeva: 'ततियम्पि बुद्धं सरणं गच्छामि।',
          witnesses: [
            { by: 'MAPLE', text: 'For the third time, I take refuge in the Buddha.' },
            { by: 'Sujato (SuttaCentral)', text: 'For a third time, I go for refuge to the Buddha.', url: 'https://suttacentral.net/kp1/en/sujato', license: 'CC0' },
          ],
          words: REFUGE_WORDS,
        },
        {
          id: 'refuge-dhamma-3',
          pali: 'Tatiyampi Dhammaṁ saraṇaṁ gacchāmi.',
          paliDeva: 'ततियम्पि धम्मं सरणं गच्छामि।',
          witnesses: [
            { by: 'MAPLE', text: 'For the third time, I take refuge in the Dhamma.' },
            { by: 'Sujato (SuttaCentral)', text: 'For a third time, I go for refuge to the teaching.', url: 'https://suttacentral.net/kp1/en/sujato', license: 'CC0' },
          ],
          words: REFUGE_WORDS,
        },
        {
          id: 'refuge-sangha-3',
          pali: 'Tatiyampi Saṅghaṁ saraṇaṁ gacchāmi.',
          paliDeva: 'ततियम्पि सङ्घं सरणं गच्छामि।',
          witnesses: [
            { by: 'MAPLE', text: 'For the third time, I take refuge in the Sangha.' },
            { by: 'Sujato (SuttaCentral)', text: 'For a third time, I go for refuge to the Saṅgha.', url: 'https://suttacentral.net/kp1/en/sujato', license: 'CC0' },
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
            { by: 'MAPLE', text: 'I undertake the practice to refrain from killing living beings.' },
            { by: 'Sujato (SuttaCentral)', text: 'I undertake the training rule to refrain from killing living creatures.', url: 'https://suttacentral.net/kp2/en/sujato', license: 'CC0' },
            { by: 'Thanissaro (Access to Insight)', text: 'I undertake the training rule to refrain from taking life.', url: 'https://www.accesstoinsight.org/lib/authors/thanissaro/index.html', license: 'CC BY-NC' },
          ],
          words: [
            {
              form: 'pāṇātipātā', scriptAlt: 'पाणातिपाता', pronunciation: 'PAH-nah-tee-PAH-tah',
              etymology: '*pāṇā* "living being with breath" + *atipātā* "striking down"',
              gloss: 'killing living beings — deliberately ending a breathing being\'s life',
              citations: [dpdCitation('pāṇātipāta'), pronCite],
            },
            ...PRECEPT_FORMULA_WORDS,
          ],
        },
        {
          id: 'precept-2',
          pali: 'Adinnādānā veramaṇī sikkhāpadaṁ samādiyāmi.',
          paliDeva: 'अदिन्नादाना वेरमणी सिक्खापदं समादियामि।',
          witnesses: [
            { by: 'MAPLE', text: 'I undertake the practice to refrain from taking what is not given.' },
            { by: 'Sujato (SuttaCentral)', text: 'I undertake the training rule to refrain from stealing.', url: 'https://suttacentral.net/kp2/en/sujato', license: 'CC0' },
            { by: 'Thanissaro (Access to Insight)', text: 'I undertake the training rule to refrain from taking what is not given.', url: 'https://www.accesstoinsight.org/lib/authors/thanissaro/index.html', license: 'CC BY-NC' },
          ],
          words: [
            {
              form: 'adinnādānā', scriptAlt: 'अदिन्नादाना', pronunciation: 'ah-deen-NAH-dah-nah',
              etymology: '*a-dinna* "not given" + *ādāna* "taking, grasping"',
              gloss: 'taking what is not given',
              citations: [dpdCitation('adinnādāna'), pronCite],
            },
            ...PRECEPT_FORMULA_WORDS,
          ],
        },
        {
          id: 'precept-3',
          pali: 'Kāmesu micchācārā veramaṇī sikkhāpadaṁ samādiyāmi.',
          paliDeva: 'कामेसु मिच्छाचारा वेरमणी सिक्खापदं समादियामि।',
          witnesses: [
            { by: 'MAPLE', text: 'I undertake the practice to refrain from sexual misconduct.' },
            { by: 'Sujato (SuttaCentral)', text: 'I undertake the training rule to refrain from sexual misconduct.', url: 'https://suttacentral.net/kp2/en/sujato', license: 'CC0' },
            { by: 'Thanissaro (Access to Insight)', text: 'I undertake the training rule to refrain from sexual misconduct.', url: 'https://www.accesstoinsight.org/lib/authors/thanissaro/index.html', license: 'CC BY-NC' },
          ],
          words: [
            {
              form: 'kāmesu', scriptAlt: 'कामेसु', pronunciation: 'KAH-may-soo',
              etymology: 'locative plural of *kāma*',
              gloss: 'in sensual pleasures, in sexual matters',
              citations: [dpdCitation('kāma'), pronCite],
            },
            {
              form: 'micchācārā', scriptAlt: 'मिच्छाचारा', pronunciation: 'mee-CHAH-chah-rah',
              etymology: '*micchā* "wrong, false" + *cāra* "conduct, behavior"',
              gloss: 'wrong conduct, misconduct',
              citations: [dpdCitation('micchācāra'), pronCite],
            },
            ...PRECEPT_FORMULA_WORDS,
          ],
        },
        {
          id: 'precept-4',
          pali: 'Musāvādā veramaṇī sikkhāpadaṁ samādiyāmi.',
          paliDeva: 'मुसावादा वेरमणी सिक्खापदं समादियामि।',
          witnesses: [
            { by: 'MAPLE', text: 'I undertake the practice to refrain from false speech.' },
            { by: 'Sujato (SuttaCentral)', text: 'I undertake the training rule to refrain from lying.', url: 'https://suttacentral.net/kp2/en/sujato', license: 'CC0' },
            { by: 'Thanissaro (Access to Insight)', text: 'I undertake the training rule to refrain from false speech.', url: 'https://www.accesstoinsight.org/lib/authors/thanissaro/index.html', license: 'CC BY-NC' },
          ],
          words: [
            {
              form: 'musāvādā', scriptAlt: 'मुसावादा', pronunciation: 'moo-SAH-vah-dah',
              etymology: '*musā* "false, untrue" + *vāda* "speech, statement"',
              gloss: 'false speech',
              citations: [dpdCitation('musāvāda'), pronCite],
            },
            ...PRECEPT_FORMULA_WORDS,
          ],
        },
        {
          id: 'precept-5',
          pali: 'Surāmerayamajjapamādaṭṭhānā veramaṇī sikkhāpadaṁ samādiyāmi.',
          paliDeva: 'सुरामेरयमज्जपमादट्ठाना वेरमणी सिक्खापदं समादियामि॥',
          witnesses: [
            { by: 'MAPLE', text: 'I undertake the practice to refrain from taking intoxicants which cloud the mind and cause heedlessness.' },
            { by: 'Sujato (SuttaCentral)', text: 'I undertake the training rule to refrain from alcoholic drinks that cause negligence.', url: 'https://suttacentral.net/kp2/en/sujato', license: 'CC0' },
            { by: 'Thanissaro (Access to Insight)', text: 'I undertake the training rule to refrain from fermented drinks that cause heedlessness.', url: 'https://www.accesstoinsight.org/lib/authors/thanissaro/index.html', license: 'CC BY-NC' },
          ],
          words: [
            { form: 'surā', scriptAlt: 'सुरा', pronunciation: 'SOO-rah', etymology: 'noun', gloss: 'fermented liquor, alcohol', citations: [dpdCitation('surā'), pronCite] },
            { form: 'meraya', scriptAlt: 'मेरय', pronunciation: 'MAY-rah-yah', etymology: 'noun', gloss: 'distilled liquor, spirits', citations: [dpdCitation('meraya'), pronCite] },
            { form: 'majja', scriptAlt: 'मज्ज', pronunciation: 'MUH-jah', etymology: 'noun', gloss: 'intoxicants', citations: [dpdCitation('majja'), pronCite] },
            { form: 'pamāda', scriptAlt: 'पमाद', pronunciation: 'pah-MAH-dah', etymology: '*pa-* (intensive) + √mad "to be drunk, careless"', gloss: 'heedlessness, carelessness, negligence — opposite of *appamāda*', citations: [dpdCitation('pamāda'), pronCite] },
            { form: 'ṭhāna', scriptAlt: 'ठान', pronunciation: 'TTAH-nah', etymology: 'noun from √sthā "to stand"', gloss: 'basis, cause, foundation', citations: [dpdCitation('ṭhāna'), pronCite] },
            ...PRECEPT_FORMULA_WORDS,
          ],
        },
      ],
      commentary:
        'Precept 2 (*adinnādānā*): we are stewards rather than absolute owners; it reifies the self to buy into the sense of ownership.\n\nPrecept 3 (*kāmesu micchācārā*): sensual pleasures of flesh, tongue, ears — so broad. Misconduct = respecting past commitments, protected by relationship (no incest, or protected by law), context — time, place, methods.\n\nPrecept 5 (*surāmerayamajjapamādaṭṭhānā*): the precept names the *basis* of heedlessness. **[[appamāda]]** — heedfulness — paying attention to the present. The Buddha\'s last words: *appamādena sampādetha* — strive with heedfulness. The cultivation of mindfulness (**[[sati]]**) and its opposite, heedlessness (*pamāda*).',
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
            { by: 'MAPLE', text: 'To do no evil,' },
            { by: 'Sujato (SuttaCentral)', text: 'Not to do any evil;', url: 'https://suttacentral.net/dhp183-185/en/sujato', license: 'CC0' },
            { by: 'Buddharakkhita (BPS)', text: 'To avoid all evil,', url: 'https://www.accesstoinsight.org/tipitaka/kn/dhp/dhp.14.budd.html', license: 'BPS / cite + link' },
          ],
          words: [
            { form: 'sabba', scriptAlt: 'सब्ब', pronunciation: 'SUB-bah', etymology: 'adjective', gloss: 'all, every', citations: [dpdCitation('sabba'), pronCite] },
            { form: 'pāpassa', scriptAlt: 'पापस्स', pronunciation: 'PAH-pah-sah', etymology: 'genitive of *pāpa*', gloss: 'of evil, unwholesome, harmful', citations: [dpdCitation('pāpa'), pronCite] },
            { form: 'akaraṇaṁ', scriptAlt: 'अकरणं', pronunciation: 'ah-KAH-rah-nang', etymology: '*a-* (privative) + *karaṇa* "doing"', gloss: 'non-doing, abstention, avoidance', citations: [dpdCitation('akaraṇa'), pronCite] },
          ],
        },
        {
          id: 'ovada-2',
          pali: 'kusalassa upasampadā;',
          paliDeva: 'कुसलस्स उपसम्पदा;',
          witnesses: [
            { by: 'MAPLE', text: 'to practice good,' },
            { by: 'Sujato (SuttaCentral)', text: 'to embrace the good;', url: 'https://suttacentral.net/dhp183-185/en/sujato', license: 'CC0' },
            { by: 'Buddharakkhita (BPS)', text: 'to cultivate good,', url: 'https://www.accesstoinsight.org/tipitaka/kn/dhp/dhp.14.budd.html', license: 'BPS / cite + link' },
          ],
          words: [
            { form: 'kusalassa', scriptAlt: 'कुसलस्स', pronunciation: 'koo-SAH-lah-sah', etymology: 'genitive of *kusala*', gloss: 'of the wholesome, skillful, beneficial — actions skillfully aligned with reality and conducive to liberation; richer than English "good"', citations: [dpdCitation('kusala'), pronCite] },
            { form: 'upasampadā', scriptAlt: 'उपसम्पदा', pronunciation: 'oo-pah-sahm-PAH-dah', etymology: '*upa-* (towards, near) + *sampadā* (attainment, accomplishment)', gloss: 'undertaking, acquisition — "approaching attainment"', citations: [dpdCitation('upasampadā'), pronCite] },
          ],
        },
        {
          id: 'ovada-3',
          pali: 'sacittapariyodapanaṁ,',
          paliDeva: 'सचित्तपरियोदपनं,',
          witnesses: [
            { by: 'MAPLE', text: 'and to purify one\'s own mind;' },
            { by: 'Sujato (SuttaCentral)', text: 'to purify one\'s mind:', url: 'https://suttacentral.net/dhp183-185/en/sujato', license: 'CC0' },
            { by: 'Buddharakkhita (BPS)', text: 'and to cleanse one\'s mind —', url: 'https://www.accesstoinsight.org/tipitaka/kn/dhp/dhp.14.budd.html', license: 'BPS / cite + link' },
          ],
          words: [
            { form: 'sacitta', scriptAlt: 'सचित्त', pronunciation: 'sah-CHIT-tah', etymology: '*sa-* "one\'s own" + *citta* "mind, heart"', gloss: 'one\'s own mind', citations: [dpdCitation('citta'), pronCite] },
            { form: 'pariyodapanaṁ', scriptAlt: 'परियोदपनं', pronunciation: 'pah-ree-YO-dah-pah-nang', etymology: '*pari-* (completely) + *ava-* (down) + √dā "to cleanse"', gloss: 'thorough purification', citations: [dpdCitation('pariyodapana'), pronCite] },
          ],
        },
        {
          id: 'ovada-4',
          pali: 'etaṁ buddhāna sāsanaṁ.',
          paliDeva: 'एतं बुद्धान सासनं॥',
          witnesses: [
            { by: 'MAPLE', text: 'this is the teaching of the Buddhas.' },
            { by: 'Sujato (SuttaCentral)', text: 'this is the instruction of the Buddhas.', url: 'https://suttacentral.net/dhp183-185/en/sujato', license: 'CC0' },
            { by: 'Buddharakkhita (BPS)', text: 'this is the teaching of the Buddhas.', url: 'https://www.accesstoinsight.org/tipitaka/kn/dhp/dhp.14.budd.html', license: 'BPS / cite + link' },
          ],
          words: [
            { form: 'etaṁ', scriptAlt: 'एतं', pronunciation: 'AY-tang', etymology: 'demonstrative', gloss: 'this', citations: [dpdCitation('etaṁ'), pronCite] },
            { form: 'buddhāna', scriptAlt: 'बुद्धान', pronunciation: 'bood-DHAH-nah', etymology: 'genitive plural of *buddha*', gloss: 'of the Buddhas (across time)', citations: [dpdCitation('buddha'), pronCite] },
            { form: 'sāsanaṁ', scriptAlt: 'सासनं', pronunciation: 'SAH-sah-nang', etymology: '√śās "to instruct"', gloss: 'teaching, instruction, dispensation', citations: [dpdCitation('sāsana'), pronCite] },
          ],
        },
      ],
    },
  ],
};

export default morningChants;

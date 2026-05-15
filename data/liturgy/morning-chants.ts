/**
 * Morning Chants — Theravāda Devotional Sequence.
 *
 * As chanted at MAPLE (Monastic Academy for the Preservation of Life on
 * Earth). Transcribed from the printed sheet photographed 2025-05-25
 * (PXL_20250525_190125521.jpg) plus the curator's etymological notes.
 *
 * Pluralism principle: MAPLE chants this version. Other institutions chant
 * differently. We surface 2-3 well-attested institutional renderings per
 * phrase so the reader can compare and triangulate. None is "the" English.
 */

import type { LiturgyDoc } from '../../types/liturgy';

export const morningChants: LiturgyDoc = {
  slug: 'morning-chants',
  title: 'Morning Chants',
  subtitle: 'Theravāda devotional sequence — Homage, Refuges, Precepts, Ovāda Pāṭimokkha',
  tradition: 'theravada',
  context:
    'Chanted before breakfast at MAPLE. The sequence opens the day with a dedication of body, speech, and mind, takes refuge, undertakes the precepts, and recalls the heart of the Buddha\'s teaching.',
  sources: {
    canonical: [
      { label: 'Khp 1 (Three Refuges)', url: 'https://suttacentral.net/kp1' },
      { label: 'Khp 2 (Five Precepts)', url: 'https://suttacentral.net/kp2' },
      { label: 'Dhp 183 (Ovāda Pāṭimokkha)', url: 'https://suttacentral.net/dhp183-185' },
    ],
    ritual: [
      { label: 'MAPLE chant sheet (photographed 2025-05-25)' },
    ],
  },
  curator: 'Curated from MAPLE practice. Commentary in the curator\'s voice; word-by-word from Digital Pāli Dictionary lemma traces.',
  sections: [
    // ───────────────────────────────────────────────────────────────────────
    // Section 1 — Homage
    // ───────────────────────────────────────────────────────────────────────
    {
      id: 'homage',
      shape: 'triple-script-witness',
      pali: 'Namo tassa bhagavato arahato sammāsambuddhassa.',
      paliDeva: 'नमो तस्स भगवतो अरहतो सम्मासम्बुद्धस्स ॥',
      repetitions: 3,
      witnesses: [
        {
          by: 'MAPLE',
          text: 'Homage to the Exalted, noble, and Fully Self-Enlightened One.',
        },
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
      words: [
        { form: 'namo', scriptAlt: 'नमो', root: '√nam', gloss: '"homage", "reverence"; literally "I bow"' },
        { form: 'tassa', scriptAlt: 'तस्स', gloss: 'dative pronoun: "to him", "to that one"' },
        { form: 'bhagavato', scriptAlt: 'भगवतो', gloss: '"the Exalted, the Blessed One, the Revered One" (genitive/dative of bhagavat)' },
        { form: 'arahato', scriptAlt: 'अरहतो', gloss: '"the Worthy One"; one free from all defilements; from a-rahati "worthy of veneration"' },
        { form: 'sammā', scriptAlt: 'सम्मा', gloss: '"perfectly", "completely", "rightly"' },
        { form: 'sam-', gloss: 'prefix: "self", "by oneself"' },
        { form: 'buddha', scriptAlt: 'बुद्ध', root: '√budh', gloss: '"awakened", "one who knows"; past participle of budh "to wake"' },
      ],
      commentary:
        'Chanted three times to dedicate body, speech, and mind. The threefold repetition turns a verbal homage into a practice gesture — the speaker arrives in body and breath before the day\'s chanting begins. Note that *sammā-sam-buddha* literally compounds "perfectly + self + awakened" — the claim is not just that the Buddha was enlightened but that he reached this fully on his own, without a teacher.',
    },

    // ───────────────────────────────────────────────────────────────────────
    // Section 2 — Three Refuges (+ Dutiyampi / Tatiyampi repetitions)
    // ───────────────────────────────────────────────────────────────────────
    {
      id: 'three-refuges',
      shape: 'triple-script-witness',
      pali: [
        'Buddhaṁ saraṇaṁ gacchāmi.',
        'Dhammaṁ saraṇaṁ gacchāmi.',
        'Saṅghaṁ saraṇaṁ gacchāmi.',
        '',
        'Dutiyampi Buddhaṁ saraṇaṁ gacchāmi.',
        'Dutiyampi Dhammaṁ saraṇaṁ gacchāmi.',
        'Dutiyampi Saṅghaṁ saraṇaṁ gacchāmi.',
        '',
        'Tatiyampi Buddhaṁ saraṇaṁ gacchāmi.',
        'Tatiyampi Dhammaṁ saraṇaṁ gacchāmi.',
        'Tatiyampi Saṅghaṁ saraṇaṁ gacchāmi.',
      ].join('\n'),
      paliDeva: [
        'बुद्धं सरणं गच्छामि।',
        'धम्मं सरणं गच्छामि।',
        'सङ्घं सरणं गच्छामि।',
        '',
        'दुतियम्पि बुद्धं सरणं गच्छामि।',
        'दुतियम्पि धम्मं सरणं गच्छामि।',
        'दुतियम्पि सङ्घं सरणं गच्छामि।',
        '',
        'ततियम्पि बुद्धं सरणं गच्छामि।',
        'ततियम्पि धम्मं सरणं गच्छामि।',
        'ततियम्पि सङ्घं सरणं गच्छामि।',
      ].join('\n'),
      witnesses: [
        {
          by: 'MAPLE',
          text: 'I take refuge in the Buddha. I take refuge in the Dhamma. I take refuge in the Sangha.\n\nFor the second time… For the third time…',
        },
        {
          by: 'Sujato (SuttaCentral)',
          text: 'I go for refuge to the Buddha. I go for refuge to the teaching. I go for refuge to the Saṅgha.',
          url: 'https://suttacentral.net/kp1/en/sujato',
          license: 'CC0',
        },
        {
          by: 'Thanissaro (Access to Insight)',
          text: 'I go to the Buddha for refuge. I go to the Dhamma for refuge. I go to the Sangha for refuge.',
          url: 'https://www.accesstoinsight.org/lib/authors/thanissaro/index.html',
          license: 'CC BY-NC',
        },
      ],
      words: [
        { form: 'buddhaṁ', scriptAlt: 'बुद्धं', root: '√budh', gloss: '"the Awakened One" (accusative)' },
        { form: 'dhammaṁ', scriptAlt: 'धम्मं', root: '√dhṛ', gloss: '"the teaching, the Truth, the way" (accusative); from dhṛ "to hold, to support"' },
        { form: 'saṅghaṁ', scriptAlt: 'सङ्घं', root: '√han / sam-han', gloss: '"the assembly, the community" (accusative); from sam-han "to come together"' },
        { form: 'saraṇaṁ', scriptAlt: 'सरणं', root: '√śri', gloss: '"refuge, shelter, protection"; from śri "to lean on", "to resort to"' },
        { form: 'gacchāmi', scriptAlt: 'गच्छामि', root: '√gam', gloss: '"I go to", "I approach"; from gam "to go"' },
        { form: 'dutiyampi', scriptAlt: 'दुतियम्पि', gloss: '"for the second time also"' },
        { form: 'tatiyampi', scriptAlt: 'ततियम्पि', gloss: '"for the third time also"' },
      ],
      commentary:
        'The threefold refuge marks one as a Buddhist in every Theravāda tradition. *Saraṇaṁ gacchāmi* — "I go to refuge" — describes movement, not arrival; the practice is the going, repeatedly. Taking refuge in the **Buddha** points to Siddhartha Gautama as proof that humans can awaken, and through him to one\'s own Buddha-nature. Taking refuge in the **Dhamma** points to the teachings, the truth of reality they describe, the path, and Nibbāna as the ultimate goal. Taking refuge in the **Saṅgha** points to the community that transmits and embodies the teaching across generations — the mutual support that makes practice sustainable.\n\nThe Dutiyampi / Tatiyampi repetitions ("for the second/third time also") are doctrinally significant: refuge is not declared once but renewed. Three is the standard ceremonial multiplier, the same threefold structure that appears in dedication and the Brahmavihāras.',
    },

    // ───────────────────────────────────────────────────────────────────────
    // Section 3 — Five Precepts
    // ───────────────────────────────────────────────────────────────────────
    {
      id: 'five-precepts',
      shape: 'triple-script-witness',
      pali: [
        '1. Pāṇātipātā veramaṇī sikkhāpadaṁ samādiyāmi.',
        '2. Adinnādānā veramaṇī sikkhāpadaṁ samādiyāmi.',
        '3. Kāmesu micchācārā veramaṇī sikkhāpadaṁ samādiyāmi.',
        '4. Musāvādā veramaṇī sikkhāpadaṁ samādiyāmi.',
        '5. Surāmerayamajjapamādaṭṭhānā veramaṇī sikkhāpadaṁ samādiyāmi.',
      ].join('\n'),
      paliDeva: [
        '१. पाणातिपाता वेरमणी सिक्खापदं समादियामि।',
        '२. अदिन्नादाना वेरमणी सिक्खापदं समादियामि।',
        '३. कामेसु मिच्छाचारा वेरमणी सिक्खापदं समादियामि।',
        '४. मुसावादा वेरमणी सिक्खापदं समादियामि।',
        '५. सुरामेरयमज्जपमादट्ठाना वेरमणी सिक्खापदं समादियामि॥',
      ].join('\n'),
      witnesses: [
        {
          by: 'MAPLE',
          text:
            '1. I undertake the practice to refrain from killing living beings.\n' +
            '2. I undertake the practice to refrain from taking what is not given.\n' +
            '3. I undertake the practice to refrain from sexual misconduct.\n' +
            '4. I undertake the practice to refrain from false speech.\n' +
            '5. I undertake the practice to refrain from taking intoxicants which cloud the mind and cause heedlessness.',
        },
        {
          by: 'Sujato (SuttaCentral)',
          text:
            '1. I undertake the training rule to refrain from killing living creatures.\n' +
            '2. I undertake the training rule to refrain from stealing.\n' +
            '3. I undertake the training rule to refrain from sexual misconduct.\n' +
            '4. I undertake the training rule to refrain from lying.\n' +
            '5. I undertake the training rule to refrain from alcoholic drinks that cause negligence.',
          url: 'https://suttacentral.net/kp2/en/sujato',
          license: 'CC0',
        },
        {
          by: 'Thanissaro (Access to Insight)',
          text:
            '1. I undertake the training rule to refrain from taking life.\n' +
            '2. I undertake the training rule to refrain from taking what is not given.\n' +
            '3. I undertake the training rule to refrain from sexual misconduct.\n' +
            '4. I undertake the training rule to refrain from false speech.\n' +
            '5. I undertake the training rule to refrain from fermented drinks that cause heedlessness.',
          url: 'https://www.accesstoinsight.org/lib/authors/thanissaro/index.html',
          license: 'CC BY-NC',
        },
      ],
      words: [
        { form: 'pāṇātipātā', scriptAlt: 'पाणातिपाता', gloss: 'from *pāṇā* "living being with breath" + *atipātā* "striking down" — the deliberate ending of a breathing being\'s life' },
        { form: 'adinnādānā', scriptAlt: 'अदिन्नादाना', gloss: 'from *a-dinna* "what is not given" + *ādāna* "taking, grasping" — taking without consent' },
        { form: 'kāmesu micchācārā', scriptAlt: 'कामेसु मिच्छाचारा', gloss: '*kāmesu* "in sensual pleasures" (locative pl. of kāma) + *micchā* "wrong, false" + *cāra* "conduct"' },
        { form: 'musāvādā', scriptAlt: 'मुसावादा', gloss: '*musā* "false, untrue" + *vāda* "speech, statement"' },
        { form: 'surāmerayamajja-', scriptAlt: 'सुरामेरयमज्ज-', gloss: '*surā* fermented liquor + *meraya* distilled liquor + *majja* "intoxicants"' },
        { form: 'pamāda', scriptAlt: 'पमाद', gloss: '"heedlessness, carelessness, negligence" — the opposite of *appamāda*, the Buddha\'s last word' },
        { form: 'ṭhāna', scriptAlt: 'ट्ठान', gloss: '"basis, cause, foundation"' },
        { form: 'veramaṇī', scriptAlt: 'वेरमणी', gloss: '"abstention from, refraining from"' },
        { form: 'sikkhāpadaṁ', scriptAlt: 'सिक्खापदं', gloss: 'literally "step in training" — *sikkhā* "training" + *pada* "step, foot"; rendered "training rule" or "precept"' },
        { form: 'samādiyāmi', scriptAlt: 'समादियामि', gloss: '"I undertake", "I take upon myself"' },
      ],
      commentary:
        'The precepts are framed as **undertakings**, not commandments — *samādiyāmi* is first-person voluntary: "I take this up." Each is a *sikkhāpada* — a "step in training." The grammar matters: not "thou shalt not" but "I undertake to refrain from."\n\nThe third precept, *kāmesu micchācārā*, is often narrowed to "sexual misconduct" in English but the Pāli *kāmesu* is plural locative — "in the sensual pleasures" — and *micchācāra* is "wrong conduct" generally. The wider field is misconduct in the realm of sense-pleasure, of which sexual misconduct is the most-discussed example.\n\nThe fifth precept names *pamāda*-*ṭṭhāna* — "the basis of heedlessness." The Buddha\'s last recorded words were *appamādena sampādetha* — "strive with heedfulness." The precept is not anti-pleasure; it\'s anti-heedlessness.',
    },

    // ───────────────────────────────────────────────────────────────────────
    // Section 4 — Ovāda Pāṭimokkha
    // ───────────────────────────────────────────────────────────────────────
    {
      id: 'ovada-patimokkha',
      shape: 'triple-script-witness',
      pali: [
        'Sabba pāpassa akaraṇaṁ,',
        'kusalassa upasampadā;',
        'sacittapariyodapanaṁ,',
        'etaṁ buddhāna sāsanaṁ.',
      ].join('\n'),
      paliDeva: [
        'सब्ब पापस्स अकरणं,',
        'कुसलस्स उपसम्पदा;',
        'सचित्तपरियोदपनं,',
        'एतं बुद्धान सासनं॥',
      ].join('\n'),
      repetitions: 3,
      witnesses: [
        {
          by: 'MAPLE',
          text: 'To do no evil, to practice good, and to purify one\'s own mind; this is the teaching of the Buddhas.',
        },
        {
          by: 'Sujato (SuttaCentral)',
          text: 'Not to do any evil; to embrace the good; to purify one\'s mind: this is the instruction of the Buddhas.',
          url: 'https://suttacentral.net/dhp183-185/en/sujato',
          license: 'CC0',
        },
        {
          by: 'Buddharakkhita (Dhammapada, BPS)',
          text: 'To avoid all evil, to cultivate good, and to cleanse one\'s mind — this is the teaching of the Buddhas.',
          url: 'https://www.accesstoinsight.org/tipitaka/kn/dhp/dhp.14.budd.html',
          license: 'BPS / cite + link',
        },
      ],
      words: [
        { form: 'sabba', scriptAlt: 'सब्ब', gloss: '"all, every"' },
        { form: 'pāpassa', scriptAlt: 'पापस्स', gloss: 'genitive of *pāpa* "evil, unwholesome, harmful"' },
        { form: 'akaraṇaṁ', scriptAlt: 'अकरणं', gloss: '"non-doing, abstention" (a- privative + karaṇa "doing")' },
        { form: 'kusalassa', scriptAlt: 'कुसलस्स', gloss: 'genitive of *kusala* "wholesome, skillful, beneficial" — connotes actions skilfully aligned with reality, conducive to liberation; richer than English "good"' },
        { form: 'upasampadā', scriptAlt: 'उपसम्पदा', gloss: '"undertaking, acquisition, entering upon"; from *upa* "towards" + *sampadā* "attainment" — literally "approaching attainment"' },
        { form: 'sacitta', scriptAlt: 'सचित्त', gloss: '*sa* "one\'s own" + *citta* "mind, heart, consciousness"' },
        { form: 'pariyodapanaṁ', scriptAlt: 'परियोदपनं', gloss: '*pari* "completely" + *ava* "down" + *√dā* "to cleanse, purify" — the thorough purification of one\'s own mind' },
        { form: 'etaṁ', scriptAlt: 'एतं', gloss: '"this" (demonstrative)' },
        { form: 'buddhāna', scriptAlt: 'बुद्धान', gloss: 'genitive plural of *buddha* — "of the Buddhas" (referring to all Buddhas across time, not just Gautama)' },
        { form: 'sāsanaṁ', scriptAlt: 'सासनं', gloss: '"teaching, instruction, dispensation"; from *√śās* "to instruct"' },
      ],
      commentary:
        'This is the *Ovāda Pāṭimokkha* — the "exhortation summary" — said by tradition to have been the Buddha\'s instruction at the assembly of 1,250 arhats. Three lines hold the whole path: refrain from harm, cultivate skill, purify the mind. Each is a different verb of practice — *akaraṇa* (non-doing), *upasampadā* (taking up), *pariyodapana* (cleansing).\n\nThe word *kusala* deserves attention. English "good" suggests a moral category; *kusala* is closer to "skillful in a way that aligns with reality" — what conduces to liberation rather than to bondage. A *kusala* act is not just ethically correct but technically right, the way a craftsman\'s work is *kusala*. The same word names both ethical and meditative skill in Pāli.',
    },
  ],
  postamble:
    'These four pieces — Homage, Refuges, Precepts, Ovāda Pāṭimokkha — form a single ritual gesture: dedicate, take refuge, undertake, recall. They are short by design. The depth is in the doing, the repetition, and over years the words become transparent — what remains is the orientation they place the day in.',
};

export default morningChants;

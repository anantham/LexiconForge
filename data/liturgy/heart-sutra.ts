/**
 * Heart Sutra — Prajñāpāramitā Hṛdaya Sūtra.
 *
 * The shortest and most widely-chanted Mahāyāna sutra. The "heart" of the
 * vast Perfection-of-Wisdom corpus, distilled into something a community
 * can chant in a few minutes. First non-Theravāda chant in this reader
 * with a truly polyglot text: Sanskrit, Chinese (Xuanzang's 玄奘 7th-century
 * recension, T251), Tibetan, and Japanese (same kanji as Chinese, different
 * reading) all attested as living chanting traditions.
 *
 * Scope of this file (per scope-pass with curator):
 *   - Framing
 *   - Opening (Avalokiteśvara contemplating the five skandhas)
 *   - The form-emptiness identity (the canonical core)
 *   - The result section (no fear, nirvāṇa)
 *   - Dharani (sound-formula)
 *   - Closing caveat on translating the Heart Sutra
 *
 * Not yet authored: the full enumeration of dhātus, āyatanas, twelve
 * nidānas, four truths. Those are obvious follow-ups.
 *
 * Sourcing notes:
 *   - Sanskrit IAST + Devanāgarī follow Conze's 1948 critical edition
 *     (widely used standard short version).
 *   - Chinese is Xuanzang's T251 (the canonical East Asian text).
 *   - Tibetan is the short-form recension found in the Kangyur.
 *   - Several transliterations cite Wikipedia as a starting point and
 *     are tagged ungrounded where I'm not deeply confident.
 */

import type { LiturgyDoc } from '../../types/liturgy';
import {
  wikipediaCitation,
  ungroundedCitation,
} from './_groundingHelpers';

export const heartSutra: LiturgyDoc = {
  slug: 'heart-sutra',
  title: 'Prajñāpāramitā Hṛdaya Sūtra',
  subtitle: 'The Heart of Perfect Wisdom',
  tradition: 'mahayana',
  context: 'Chanted across Mahāyāna and Vajrayāna traditions worldwide.',
  sources: {
    canonical: [
      {
        label: 'Conze (1948) — Sanskrit critical edition',
        url: 'https://en.wikipedia.org/wiki/Heart_Sutra',
      },
      {
        label: 'Xuanzang (玄奘) — T251, Chinese Buddhist canon',
        url: 'https://en.wikipedia.org/wiki/Heart_Sutra#Chinese',
      },
    ],
    ritual: [
      { label: 'Chanted at MAPLE and at Zen/Chan/Tibetan/Pure Land centres worldwide' },
    ],
  },
  curator:
    "Curation by Aditya. Sanskrit follows Conze's short version; Chinese is Xuanzang's T251; Tibetan from the Kangyur short-form. English witnesses are MAPLE's chanting text (adapted from Master Sheng-yen, Chinese Chan lineage), followed by Conze (1958), Red Pine (2004), and Thich Nhat Hanh (2014). MAPLE is the primary witness — the version chanted in the community for whom this reader is built.",
  sections: [
    // ─────────────────────────────────────────────────────────────────────
    // 1. Framing
    // ─────────────────────────────────────────────────────────────────────
    {
      id: 'framing',
      shape: 'prose-commentary',
      body: 'The shortest and most widely-chanted Mahāyāna sutra. Out of the vast *Perfection-of-Wisdom* literature — some texts run to 100,000 verses — the Heart Sutra distills the teaching into a few minutes of chanting. It is the *hṛdaya* (heart, essence) of [[prajñāpāramitā]].\n\nThe canonical short form opens with the bodhisattva [[Avalokiteśvara]] contemplating the five [[skandhas]] (aggregates of experience) and seeing them as empty of inherent existence. He speaks his realisation to the elder Śāriputra, line by line: form is emptiness, emptiness is form. Every category by which we organise experience — the senses, their objects, consciousness itself, the chain of dependent arising, even the Four Noble Truths — is, from the standpoint of emptiness, empty. The bodhisattva is unafraid; this is nirvāṇa. The sutra ends with a mantra: *gate gate pāragate pārasaṃgate bodhi svāhā*.\n\nWe present the canonical core in four scripts (Sanskrit IAST + Devanāgarī, Chinese as transmitted by Xuanzang, and Tibetan from the Kangyur). English witnesses sample three reading lineages: Edward Conze (scholarly, 1958), Red Pine (poet-translator, 2004), and Thich Nhat Hanh (Plum Village, 2014). None is canonical; together they map the conversational territory.',
    },

    // ─────────────────────────────────────────────────────────────────────
    // 2. The body — Avalokiteśvara's vision + form-emptiness + result
    // ─────────────────────────────────────────────────────────────────────
    {
      id: 'heart-core',
      shape: 'triple-script-witness',
      segments: [
        // ── Opening: Avalokiteśvara contemplates the skandhas ──
        {
          id: 'opening',
          pali: 'Āryāvalokiteśvaro bodhisattvo gambhīrāṃ prajñāpāramitācaryāṃ caramāṇo vyavalokayati sma: pañca skandhāḥ tāṃś ca svabhāvaśūnyān paśyati sma.',
          paliDeva: 'आर्यावलोकितेश्वरो बोधिसत्त्वो गम्भीरां प्रज्ञापारमिताचर्यां चरमाणो व्यवलोकयति स्म: पञ्च स्कन्धास्तांश्च स्वभावशून्यान्पश्यति स्म॥',
          scripts: [
            {
              lang: 'sa-Latn',
              label: 'Sanskrit (IAST)',
              text: 'Āryāvalokiteśvaro bodhisattvo gambhīrāṃ prajñāpāramitācaryāṃ caramāṇo vyavalokayati sma: pañca skandhāḥ tāṃś ca svabhāvaśūnyān paśyati sma.',
              source: "Conze critical edition (short form)",
            },
            {
              lang: 'sa-Deva',
              label: 'Sanskrit (Devanāgarī)',
              text: 'आर्यावलोकितेश्वरो बोधिसत्त्वो गम्भीरां प्रज्ञापारमिताचर्यां चरमाणो व्यवलोकयति स्म: पञ्च स्कन्धास्तांश्च स्वभावशून्यान्पश्यति स्म॥',
            },
            {
              lang: 'zh-Hant',
              label: 'Chinese (Xuanzang)',
              text: '觀自在菩薩 行深般若波羅蜜多時 照見五蘊皆空 度一切苦厄',
              source: 'T251 玄奘譯 (Xuanzang, c. 649 CE)',
              tokens: ['觀自在', '菩薩', '行', '深', '般若', '波羅蜜多', '時', '照見', '五', '蘊', '皆', '空', '度', '一切', '苦厄'],
            },
            {
              lang: 'ja-Jpan',
              label: 'Japanese (Sino-Japanese reading)',
              text: '観自在菩薩 行深般若波羅蜜多時 照見五蘊皆空 度一切苦厄',
              source: 'Pronounced: Kanjizai bosatsu, gyō jin hannya haramita ji, shōken go un kai kū, do issai ku yaku',
              tokens: ['観自在', '菩薩', '行', '深', '般若', '波羅蜜多', '時', '照見', '五', '蘊', '皆', '空', '度', '一切', '苦厄'],
            },
            {
              lang: 'bo-Tibt',
              label: 'Tibetan',
              text: 'བྱང་ཆུབ་སེམས་དཔའ་འཕགས་པ་སྤྱན་རས་གཟིགས་དབང་ཕྱུག་ཟབ་མོ་ཤེས་རབ་ཀྱི་ཕ་རོལ་ཏུ་ཕྱིན་པའི་སྤྱོད་པ་ལ་སྤྱོད་པ་ན་ཕུང་པོ་ལྔ་པོ་དེ་དག་ལ་ཡང་རང་བཞིན་གྱིས་སྟོང་པར་རྣམ་པར་བལྟའོ།',
              source: 'Kangyur short-form recension',
            },
          ],
          witnesses: [
            // MAPLE's chanting text, adapted from Master Sheng-yen (Chinese
            // Chan lineage). Follows Xuanzang's Chinese tradition, which
            // appends 度一切苦厄 ("overcame all suffering") not present in
            // the Sanskrit — those tokens map to -1.
            {
              by: 'MAPLE (after Master Sheng-yen)',
              text: 'Avalokiteśvara Bodhisatva, while going deep into transcendent wisdom, clearly saw that all five skandhas are empty, and overcame all suffering.',
              alignTo: [0, 1, -1, 4, 2, -1, 3, 3, 5, 12, -1, -1, 7, 8, -1, 11, -1, -1, -1, -1],
              license: 'MAPLE liturgy sheet — adapted from Sheng-yen',
            },
            {
              by: 'Conze (1958)',
              text: 'Avalokita, the Holy Lord and Bodhisattva, was moving in the deep course of the Wisdom which has gone beyond. He looked down from on high, He beheld but five heaps, and He saw that in their own-being they were empty.',
              url: 'https://en.wikipedia.org/wiki/Heart_Sutra',
              license: 'Conze translation widely reproduced; full version PD-pending',
            },
            {
              by: 'Red Pine (2004)',
              text: 'The noble Avalokiteśvara, while practising the deep practice of Prajñāpāramitā, looked upon the five skandhas and seeing they were empty of self-existence …',
              url: 'https://www.counterpointpress.com/dd-product/the-heart-sutra/',
              license: 'Quoted with attribution',
            },
            {
              by: 'Thich Nhat Hanh (2014)',
              text: 'The Bodhisattva Avalokiteśvara, while practising deeply the Perfection of Understanding, suddenly discovered that all of the five Skandhas are equally empty …',
              url: 'https://plumvillage.org/sutra/the-other-shore',
              license: 'Plum Village translation, quoted with attribution',
            },
          ],
          words: [
            {
              form: 'Āryāvalokiteśvaro',
              scriptAlt: 'आर्यावलोकितेश्वरो',
              scriptAlts: { 'zh-Hant': '觀自在', 'ja-Jpan': '観自在' },
              scriptMorphemes: {
                'zh-Hant': [
                  { text: '觀', type: 'semantic', pronunciation: 'guān', gloss: 'observe, contemplate, perceive — translates *avalokita* ("looking down")' },
                  { text: '自', type: 'semantic', pronunciation: 'zì', gloss: 'self — paired with 在 to render *īśvara* ("sovereign")' },
                  { text: '在', type: 'semantic', pronunciation: 'zài', gloss: 'present, sovereign — 自在 together = "freely existing, sovereign"' },
                ],
                'ja-Jpan': [
                  { text: '観', type: 'semantic', pronunciation: 'kan', gloss: 'observe, contemplate — translates *avalokita*' },
                  { text: '自', type: 'semantic', pronunciation: 'ji', gloss: 'self — with 在 renders *īśvara* "sovereign"' },
                  { text: '在', type: 'semantic', pronunciation: 'zai', gloss: 'present, sovereign — 自在 ("jizai") = "freely existing"' },
                ],
              },
              pronunciation: 'AHR-yah-vah-loh-kee-TAYSH-vah-roh',
              etymology: '*ārya* "noble" + *avalokita* "looking down" + *īśvara* "lord"',
              gloss: 'the Noble Lord Avalokiteśvara — the bodhisattva of compassion',
              citations: [wikipediaCitation('Avalokiteśvara')],
              morphemes: [
                {
                  text: 'Ārya',
                  type: 'prefix',
                  gloss: 'noble — an honourific',
                  pronunciation: 'AHR-yah',
                  citations: [wikipediaCitation('Ārya')],
                },
                {
                  text: 'āvalokit',
                  type: 'stem',
                  gloss: 'one who looks down (with compassion) on the world',
                  pronunciation: 'ah-vah-loh-KEET',
                },
                {
                  text: 'eśvaro',
                  type: 'suffix',
                  gloss: 'lord — the title-ending',
                  pronunciation: 'AYSH-vah-roh',
                },
              ],
            },
            {
              form: 'bodhisattvo',
              scriptAlt: 'बोधिसत्त्वो',
              scriptAlts: { 'zh-Hant': '菩薩', 'ja-Jpan': '菩薩' },
              scriptMorphemes: {
                'zh-Hant': [
                  { text: '菩', type: 'phonetic', pronunciation: 'pú', gloss: 'phonetic: transliterates "bo-" (from 菩提 *bodhi*); not a semantic character here' },
                  { text: '薩', type: 'phonetic', pronunciation: 'sà', gloss: 'phonetic: transliterates "-(sa)ttva" (from 薩埵 *sattva*); 菩薩 is the abbreviation of the full 菩提薩埵' },
                ],
                'ja-Jpan': [
                  { text: '菩', type: 'phonetic', pronunciation: 'bo', gloss: 'phonetic: transliterates "bo-" (*bodhi*)' },
                  { text: '薩', type: 'phonetic', pronunciation: 'satsu', gloss: 'phonetic: transliterates "-(sa)ttva"; 菩薩 (*bosatsu*) abbreviates 菩提薩埵' },
                ],
              },
              pronunciation: 'boh-dee-SAHT-voh',
              etymology: '*bodhi* "awakening" + *sattva* "being"',
              gloss: 'awakening-being; one bound for full awakening but staying to liberate others',
              citations: [wikipediaCitation('Bodhisattva')],
              morphemes: [
                {
                  text: 'bodhi',
                  type: 'stem',
                  root: '√budh',
                  gloss: 'awakening, enlightenment',
                  pronunciation: 'BOH-dee',
                },
                {
                  text: 'sattvo',
                  type: 'suffix',
                  gloss: 'being, sentient one',
                  pronunciation: 'SAHT-voh',
                },
              ],
            },
            {
              form: 'prajñāpāramitācaryāṃ',
              scriptAlt: 'प्रज्ञापारमिताचर्यां',
              scriptAlts: { 'zh-Hant': '般若', 'ja-Jpan': '般若' },
              scriptMorphemes: {
                'zh-Hant': [
                  { text: '般', type: 'phonetic', pronunciation: 'bān', gloss: 'phonetic: transliterates "pra-" — chosen for sound, the character\'s usual meaning ("kind of, sort") is unrelated' },
                  { text: '若', type: 'phonetic', pronunciation: 'ruò', gloss: 'phonetic: transliterates "-jñā" — the character\'s usual meaning ("if, like") is unrelated' },
                ],
                'ja-Jpan': [
                  { text: '般', type: 'phonetic', pronunciation: 'han', gloss: 'phonetic: transliterates "pra-" — read as "han" in 般若 (*hannya*)' },
                  { text: '若', type: 'phonetic', pronunciation: 'nya', gloss: 'phonetic: transliterates "-jñā" — read as "nya" in 般若' },
                ],
              },
              pronunciation: 'prahj-NYAH-pah-rah-mee-TAH-chahr-yahm',
              etymology: '*prajñā* "wisdom" + *pāramitā* "gone-beyond" + *caryā* "practice"',
              gloss: 'the practice of the perfection of wisdom — the activity that *is* this awakening',
              citations: [wikipediaCitation('Prajñāpāramitā')],
              morphemes: [
                {
                  text: 'prajñā',
                  type: 'stem',
                  gloss: 'wisdom — the kind that sees how things actually are',
                  pronunciation: 'prahj-NYAH',
                  citations: [wikipediaCitation('Prajñā_(Buddhism)')],
                },
                {
                  text: 'pāramitā',
                  type: 'stem',
                  gloss: 'perfection — literally "gone-to-the-other-shore"',
                  pronunciation: 'pah-rah-mee-TAH',
                  citations: [wikipediaCitation('Pāramitā')],
                },
                {
                  text: 'caryāṃ',
                  type: 'suffix',
                  gloss: 'the practice (of [...])',
                  pronunciation: 'chahr-YAHM',
                },
              ],
            },
            // pāramitā as its own WordGloss — Sanskrit's compound is one
            // word but Xuanzang's Chinese gives it 4 characters (波羅蜜多)
            // that deserve their own hover. The phonetic decomposition
            // below shows how each Chinese character borrows one syllable
            // of Sanskrit's *pāramitā*.
            {
              form: 'pāramitā',
              scriptAlt: 'पारमिता',
              scriptAlts: { 'zh-Hant': '波羅蜜多', 'ja-Jpan': '波羅蜜多' },
              scriptMorphemes: {
                'zh-Hant': [
                  { text: '波', type: 'phonetic', pronunciation: 'bō', gloss: 'phonetic: transliterates "pā-"; usually means "wave"' },
                  { text: '羅', type: 'phonetic', pronunciation: 'luó', gloss: 'phonetic: transliterates "-ra-"; usually means "net, gauze"' },
                  { text: '蜜', type: 'phonetic', pronunciation: 'mì', gloss: 'phonetic: transliterates "-mi-"; usually means "honey"' },
                  { text: '多', type: 'phonetic', pronunciation: 'duō', gloss: 'phonetic: transliterates "-tā"; usually means "many, much"' },
                ],
                'ja-Jpan': [
                  { text: '波', type: 'phonetic', pronunciation: 'ha', gloss: 'phonetic: transliterates "pā-" (read *ha* in 波羅蜜多 *haramita*)' },
                  { text: '羅', type: 'phonetic', pronunciation: 'ra', gloss: 'phonetic: transliterates "-ra-"' },
                  { text: '蜜', type: 'phonetic', pronunciation: 'mi', gloss: 'phonetic: transliterates "-mi-"' },
                  { text: '多', type: 'phonetic', pronunciation: 'ta', gloss: 'phonetic: transliterates "-tā"' },
                ],
              },
              pronunciation: 'pah-rah-mee-TAH',
              etymology: 'Sanskrit *pāram-itā* — "gone to the other shore"',
              gloss: 'perfection — literally "gone-to-the-other-shore"',
              citations: [wikipediaCitation('Pāramitā')],
              morphemes: [
                { text: 'pāram', type: 'stem', gloss: 'the other shore — what awakening looks like from this shore', pronunciation: 'PAH-rahm' },
                { text: 'itā', type: 'suffix', gloss: 'gone (past participle, feminine) — turning the noun into "having gone"', pronunciation: 'ee-TAH' },
              ],
            },
            {
              form: 'pañca',
              scriptAlt: 'पञ्च',
              scriptAlts: { 'zh-Hant': '五', 'ja-Jpan': '五' },
              pronunciation: 'PAHN-chah',
              etymology: 'Sanskrit *pañca* — "five"',
              gloss: 'five',
            },
            {
              form: 'skandhāḥ',
              scriptAlt: 'स्कन्धाः',
              scriptAlts: { 'zh-Hant': '蘊', 'ja-Jpan': '蘊' },
              pronunciation: 'SKAHN-dhah-h',
              etymology: 'Sanskrit *skandha* — literally "heap, aggregate"',
              gloss: 'the five aggregates that compose experience: form, feeling, perception, mental formations, consciousness',
              citations: [wikipediaCitation('Skandha')],
            },
            {
              form: 'svabhāvaśūnyān',
              scriptAlt: 'स्वभावशून्यान्',
              scriptAlts: { 'zh-Hant': '空', 'ja-Jpan': '空' },
              pronunciation: 'svah-BAH-vah-SHOON-yahn',
              etymology: '*svabhāva* "own-being" + *śūnya* "empty"',
              gloss: 'empty of own-being — having no fixed, inherent self-existence',
              accent: 'sky',
              morphemes: [
                {
                  text: 'sva',
                  type: 'prefix',
                  gloss: 'self, own',
                  pronunciation: 'svah',
                },
                {
                  text: 'bhāva',
                  type: 'stem',
                  gloss: 'being, nature',
                  pronunciation: 'BAH-vah',
                },
                {
                  text: 'śūnyān',
                  type: 'suffix',
                  gloss: 'empty (of) — qualifying the aggregates',
                  pronunciation: 'SHOON-yahn',
                  citations: [wikipediaCitation('Śūnyatā')],
                },
              ],
            },
            {
              form: 'gambhīrāṃ',
              scriptAlt: 'गम्भीरां',
              scriptAlts: { 'zh-Hant': '深', 'ja-Jpan': '深' },
              pronunciation: 'gahm-BHEE-rahm',
              etymology: 'Sanskrit *gambhīra* — "deep, profound"',
              gloss: 'deep, profound — qualifying the practice as not surface-level',
            },
            {
              form: 'caramāṇo',
              scriptAlt: 'चरमाणो',
              scriptAlts: { 'zh-Hant': '行', 'ja-Jpan': '行' },
              pronunciation: 'chah-rah-MAH-noh',
              etymology: '√car "to move, practise" + middle present participle',
              gloss: 'practising, moving in — the bodhisattva is *doing* this, not just thinking it',
              morphemes: [
                {
                  text: 'cara',
                  type: 'root',
                  root: '√car',
                  gloss: 'to move, walk, practise',
                  pronunciation: 'CHAH-rah',
                },
                {
                  text: 'māṇo',
                  type: 'suffix',
                  gloss: 'middle present participle — the one doing [the moving] for themselves',
                  pronunciation: 'MAH-noh',
                },
              ],
            },
            {
              form: 'vyavalokayati',
              scriptAlt: 'व्यवलोकयति',
              scriptAlts: { 'zh-Hant': '照見', 'ja-Jpan': '照見' },
              scriptMorphemes: {
                'zh-Hant': [
                  { text: '照', type: 'semantic', pronunciation: 'zhào', gloss: 'illuminate, shine upon — the *avalok* "look down" with light' },
                  { text: '見', type: 'semantic', pronunciation: 'jiàn', gloss: 'see, perceive — Xuanzang fuses *vyavalokayati* and *paśyati* into 照見' },
                ],
                'ja-Jpan': [
                  { text: '照', type: 'semantic', pronunciation: 'shō', gloss: 'illuminate, shine upon' },
                  { text: '見', type: 'semantic', pronunciation: 'ken', gloss: 'see, perceive — together 照見 (*shōken*) = "illuminate-and-see"' },
                ],
              },
              pronunciation: 'vyah-vah-loh-KAH-yah-tee',
              etymology: '*vi-* + *ava-* + √lok "look" — to look down/over carefully',
              gloss: 'examines closely, looks-down-upon — same √lok root as in *Avalokita*',
              morphemes: [
                {
                  text: 'vy',
                  type: 'prefix',
                  gloss: 'thorough, distinguishing',
                  pronunciation: 'vy',
                },
                {
                  text: 'avalok',
                  type: 'stem',
                  gloss: 'look down upon (with attention)',
                  pronunciation: 'ah-vah-LOHK',
                },
                {
                  text: 'ayati',
                  type: 'suffix',
                  gloss: 'present-tense 3rd-person — "he/she examines"',
                  pronunciation: 'ah-YAH-tee',
                },
              ],
            },
            {
              form: 'sma',
              scriptAlt: 'स्म',
              pronunciation: 'smah',
              etymology: 'Sanskrit particle',
              gloss: '*sma* — a particle that gives a present-tense verb a past-tense flavour ("was practising / did see")',
            },
            {
              form: 'pañca',
              scriptAlt: 'पञ्च',
              pronunciation: 'PAHN-chah',
              etymology: 'Sanskrit *pañca* — "five"',
              gloss: 'five',
            },
            {
              form: 'tāṃś',
              scriptAlt: 'तांश्',
              pronunciation: 'TAHM-sh',
              etymology: '*tān* (accusative plural masculine of *tad*) + sandhi *-ś*',
              gloss: 'those — refers back to the five skandhas',
            },
            {
              form: 'ca',
              scriptAlt: 'च',
              pronunciation: 'chah',
              etymology: 'Sanskrit enclitic *ca*',
              gloss: 'and (a conjunction that always follows the word it joins)',
            },
            {
              form: 'paśyati',
              scriptAlt: 'पश्यति',
              pronunciation: 'PAHSH-yah-tee',
              etymology: '√paś / √dṛś "to see"',
              gloss: 'sees — the second seeing-verb, after *vyavalokayati*: he looks, and then he sees',
              morphemes: [
                {
                  text: 'paś',
                  type: 'root',
                  root: '√paś',
                  gloss: 'to see — the present-stem of √dṛś',
                  pronunciation: 'PAHSH',
                },
                {
                  text: 'yati',
                  type: 'suffix',
                  gloss: 'present-tense 3rd-person',
                  pronunciation: 'YAH-tee',
                },
              ],
            },
          ],
          note: 'The opening establishes the *who* (Avalokiteśvara), the *what* (the practice of perfect wisdom), and the *finding* (the five skandhas are empty of own-being). Notice the doctrinal precision: skandhas are not denied — only their *inherent self-existence*. The form is here, feeling is here; what is empty is the idea that any of them stands on its own.',
        },

        // ── The form-emptiness identity ──
        {
          id: 'form-emptiness',
          pali: 'Rūpaṃ śūnyatā, śūnyataiva rūpaṃ. Rūpān na pṛthak śūnyatā, śūnyatāyā na pṛthag rūpaṃ. Yad rūpaṃ sā śūnyatā, yā śūnyatā tad rūpaṃ.',
          paliDeva: 'रूपं शून्यता, शून्यतैव रूपम्। रूपान्न पृथक्शून्यता, शून्यताया न पृथग्रूपम्। यद्रूपं सा शून्यता, या शून्यता तद्रूपम्॥',
          scripts: [
            {
              lang: 'sa-Latn',
              label: 'Sanskrit (IAST)',
              text: 'Rūpaṃ śūnyatā, śūnyataiva rūpaṃ. Rūpān na pṛthak śūnyatā, śūnyatāyā na pṛthag rūpaṃ. Yad rūpaṃ sā śūnyatā, yā śūnyatā tad rūpaṃ.',
            },
            {
              lang: 'sa-Deva',
              label: 'Sanskrit (Devanāgarī)',
              text: 'रूपं शून्यता, शून्यतैव रूपम्। रूपान्न पृथक्शून्यता, शून्यताया न पृथग्रूपम्। यद्रूपं सा शून्यता, या शून्यता तद्रूपम्॥',
            },
            {
              lang: 'zh-Hant',
              label: 'Chinese (Xuanzang)',
              text: '色不異空 空不異色 色即是空 空即是色',
              source: 'T251',
              tokens: ['色', '不', '異', '空', '空', '不', '異', '色', '色', '即', '是', '空', '空', '即', '是', '色'],
            },
            {
              lang: 'ja-Jpan',
              label: 'Japanese (Sino-Japanese)',
              text: '色不異空 空不異色 色即是空 空即是色',
              source: 'Pronounced: Shiki fu i kū, kū fu i shiki, shiki soku ze kū, kū soku ze shiki',
              tokens: ['色', '不', '異', '空', '空', '不', '異', '色', '色', '即', '是', '空', '空', '即', '是', '色'],
            },
            {
              lang: 'bo-Tibt',
              label: 'Tibetan',
              text: 'གཟུགས་སྟོང་པའོ། སྟོང་པ་ཉིད་གཟུགས་སོ། གཟུགས་ལས་སྟོང་པ་ཉིད་གཞན་མ་ཡིན།',
              source: 'Kangyur',
            },
          ],
          witnesses: [
            // Surface: Rūpaṃ(0) śūnyatā,(1) śūnyataiva(2) rūpaṃ.(3) Rūpān(4) na(5) pṛthak(6) śūnyatā,(7) śūnyatāyā(8) na(9) pṛthag(10) rūpaṃ.(11) Yad(12) rūpaṃ(13) sā(14) śūnyatā,(15) yā(16) śūnyatā(17) tad(18) rūpaṃ.(19) — 20 words
            // Conze: "Form is emptiness, emptiness is form. Form does not differ from emptiness, emptiness does not differ from form. Whatever is form, that is emptiness; whatever is emptiness, that is form."
            // Conze tokens: Form(0) is(1) emptiness,(2) emptiness(3) is(4) form.(5) Form(6) does(7) not(8) differ(9) from(10) emptiness,(11) emptiness(12) does(13) not(14) differ(15) from(16) form.(17) Whatever(18) is(19) form,(20) that(21) is(22) emptiness;(23) whatever(24) is(25) emptiness,(26) that(27) is(28) form.(29) — 30 tokens
            // Aligning Conze's 30 tokens to Sanskrit 20:
            //   "Form(0) is(1) emptiness,(2)" → rūpaṃ(0) -1 śūnyatā(1)
            //   "emptiness(3) is(4) form.(5)" → śūnyataiva(2) -1 rūpaṃ(3)
            //   "Form(6) does(7) not(8) differ(9) from(10) emptiness,(11)" → rūpān(4) -1 na(5) pṛthak(6) -1 śūnyatā(7)
            //   "emptiness(12) does(13) not(14) differ(15) from(16) form.(17)" → śūnyatāyā(8) -1 na(9) pṛthag(10) -1 rūpaṃ(11)
            //   "Whatever(18) is(19) form,(20)" → yad(12) -1 rūpaṃ(13)
            //   "that(21) is(22) emptiness;(23)" → sā(14) -1 śūnyatā(15)
            //   "whatever(24) is(25) emptiness,(26)" → yā(16) -1 śūnyatā(17)
            //   "that(27) is(28) form.(29)" → tad(18) -1 rūpaṃ(19)
            // MAPLE follows the Xuanzang Chinese order: "not different from"
            // BEFORE the "is" identity. Sanskrit IAST has the reverse order,
            // so MAPLE's alignment arrows cross visibly — that's the
            // cross-tradition reordering made visual.
            // The "preference / information / patterning / consciousness"
            // tail extends to the other skandhas, which our truncated
            // Sanskrit doesn't include — those tokens map to -1.
            {
              by: 'MAPLE (after Master Sheng-yen)',
              text: 'Śāriputra, appearance is not different from emptiness. Emptiness is not different from appearance. Appearance itself is emptiness. Emptiness itself is appearance. So also are preference, information, patterning and consciousness.',
              alignTo: [-1, 4, -1, 5, 6, -1, 7, 8, -1, 9, 10, -1, 11, 0, -1, -1, 1, 2, 2, -1, 3, -1, -1, -1, -1, -1, -1, -1, -1],
              license: 'MAPLE liturgy sheet — adapted from Sheng-yen',
            },
            {
              by: 'Conze (1958)',
              text: 'Form is emptiness, emptiness is form. Form does not differ from emptiness, emptiness does not differ from form. Whatever is form, that is emptiness; whatever is emptiness, that is form.',
              alignTo: [0, -1, 1, 2, -1, 3, 4, -1, 5, 6, -1, 7, 8, -1, 9, 10, -1, 11, 12, -1, 13, 14, -1, 15, 16, -1, 17, 18, -1, 19],
              url: 'https://en.wikipedia.org/wiki/Heart_Sutra',
              license: 'Conze translation widely reproduced',
            },
            {
              by: 'Red Pine (2004)',
              text: 'Form is emptiness, emptiness is form; form is not separate from emptiness, emptiness is not separate from form; whatever is form is emptiness, whatever is emptiness is form.',
              url: 'https://www.counterpointpress.com/dd-product/the-heart-sutra/',
              license: 'Quoted with attribution',
            },
            {
              by: 'Thich Nhat Hanh (2014)',
              text: 'This Body itself is Emptiness, and Emptiness itself is this Body. This Body is not other than Emptiness, and Emptiness is not other than this Body.',
              url: 'https://plumvillage.org/sutra/the-other-shore',
              license: 'Plum Village translation, quoted with attribution',
            },
          ],
          words: [
            {
              form: 'rūpaṃ',
              scriptAlt: 'रूपम्',
              scriptAlts: { 'zh-Hant': '色', 'ja-Jpan': '色' },
              pronunciation: 'ROO-pahm',
              etymology: 'Sanskrit *rūpa* — "form, appearance, body"',
              gloss: 'form — the first of the five skandhas; visible/material appearance',
              accent: 'amber',
              citations: [wikipediaCitation('Rūpa')],
            },
            {
              form: 'śūnyatā',
              scriptAlt: 'शून्यता',
              scriptAlts: { 'zh-Hant': '空', 'ja-Jpan': '空' },
              pronunciation: 'SHOON-yah-TAH',
              etymology: '*śūnya* "empty" + abstract noun suffix *-tā*',
              gloss: 'emptiness — not nothingness, but absence of inherent existence; the dependently-arisen nature of all things',
              accent: 'sky',
              citations: [wikipediaCitation('Śūnyatā')],
              morphemes: [
                {
                  text: 'śūnya',
                  type: 'stem',
                  gloss: 'empty, void',
                  pronunciation: 'SHOON-yah',
                },
                {
                  text: 'tā',
                  type: 'suffix',
                  gloss: 'turns "empty" into "emptiness" — the abstract quality',
                  pronunciation: 'TAH',
                },
              ],
            },
            {
              form: 'śūnyataiva',
              scriptAlt: 'शून्यतैव',
              scriptAlts: { 'zh-Hant': '空', 'ja-Jpan': '空' },
              pronunciation: 'SHOON-yah-TIE-vah',
              etymology: '*śūnyatā* + *eva* (intensifier)',
              gloss: 'emptiness itself — the emphatic "the very emptiness"',
              accent: 'sky',
            },
            {
              form: 'pṛthak',
              scriptAlt: 'पृथक्',
              scriptAlts: { 'zh-Hant': '異', 'ja-Jpan': '異' },
              pronunciation: 'PRTH-ahk',
              etymology: 'Sanskrit *pṛthak* — "apart, separate, distinct"',
              gloss: 'separate, distinct (from)',
            },
            {
              form: 'pṛthag',
              scriptAlt: 'पृथग्',
              scriptAlts: { 'zh-Hant': '異', 'ja-Jpan': '異' },
              pronunciation: 'PRTH-ahg',
              etymology: 'Sandhi variant of *pṛthak* before voiced consonants',
              gloss: 'separate, distinct (from) — same word as pṛthak, different sandhi form',
            },
            {
              form: 'Rūpān',
              scriptAlt: 'रूपान्',
              scriptAlts: { 'zh-Hant': '色', 'ja-Jpan': '色' },
              pronunciation: 'ROO-pahn',
              etymology: '*rūpa* "form" + ablative ending',
              gloss: 'from form — "X is not different *from* form"',
              accent: 'amber',
            },
            {
              form: 'śūnyatāyā',
              scriptAlt: 'शून्यताया',
              scriptAlts: { 'zh-Hant': '空', 'ja-Jpan': '空' },
              pronunciation: 'SHOON-yah-TAH-yah',
              etymology: '*śūnyatā* "emptiness" + genitive/ablative ending',
              gloss: 'of/from emptiness — "X is not different from *emptiness*"',
              accent: 'sky',
            },
            {
              form: 'na',
              scriptAlt: 'न',
              scriptAlts: { 'zh-Hant': '不', 'ja-Jpan': '不' },
              pronunciation: 'nah',
              etymology: 'Sanskrit negation particle',
              gloss: 'not',
            },
            {
              form: 'Yad',
              scriptAlt: 'यद्',
              pronunciation: 'yahd',
              etymology: 'Sanskrit relative pronoun *yad* (neuter)',
              gloss: 'what, whatever — opens the "whatever is form, that is emptiness" relative clause',
            },
            {
              form: 'yā',
              scriptAlt: 'या',
              pronunciation: 'yah',
              etymology: 'Sanskrit relative pronoun *yā* (feminine)',
              gloss: 'whatever (feminine) — agrees with the feminine noun *śūnyatā*',
            },
            {
              form: 'sā',
              scriptAlt: 'सा',
              pronunciation: 'sah',
              etymology: 'Sanskrit demonstrative pronoun *sā* (feminine)',
              gloss: 'that (feminine) — the demonstrative answering the relative *yā*',
            },
            {
              form: 'tad',
              scriptAlt: 'तद्',
              pronunciation: 'tahd',
              etymology: 'Sanskrit demonstrative pronoun *tad* (neuter)',
              gloss: 'that (neuter) — agrees with the neuter noun *rūpaṃ*',
            },
          ],
          note: 'The mathematical centre of the sutra. Two assertions, both bidirectional:\n\n— *Form is not other than emptiness; emptiness is not other than form.*\n— *Whatever is form, that is emptiness; whatever is emptiness, that is form.*\n\nThe Chinese is sharper still: 色即是空, 空即是色 — *form-just-is-emptiness, emptiness-just-is-form*. Thich Nhat Hanh translates *rūpa* not as "form" but as "this Body" — naming the bodily, lived encounter with the doctrine rather than treating it abstractly.',
        },

        // ── Result: no fear, nirvāṇa ──
        {
          id: 'result',
          pali: 'Cittāvaraṇa nāstitvād atrasto viparyāsātikrānto niṣṭhānirvāṇaḥ.',
          paliDeva: 'चित्तावरणनास्तित्वादत्रस्तो विपर्यासातिक्रान्तो निष्ठानिर्वाणः॥',
          scripts: [
            {
              lang: 'sa-Latn',
              label: 'Sanskrit (IAST)',
              text: 'Cittāvaraṇa nāstitvād atrasto viparyāsātikrānto niṣṭhānirvāṇaḥ.',
            },
            {
              lang: 'sa-Deva',
              label: 'Sanskrit (Devanāgarī)',
              text: 'चित्तावरणनास्तित्वादत्रस्तो विपर्यासातिक्रान्तो निष्ठानिर्वाणः॥',
            },
            {
              lang: 'zh-Hant',
              label: 'Chinese (Xuanzang)',
              text: '心無罣礙 無罣礙故 無有恐怖 遠離顛倒夢想 究竟涅槃',
              source: 'T251',
              tokens: ['心', '無', '罣礙', '無', '罣礙', '故', '無', '有', '恐怖', '遠離', '顛倒', '夢想', '究竟', '涅槃'],
            },
            {
              lang: 'ja-Jpan',
              label: 'Japanese (Sino-Japanese)',
              text: '心無罣礙 無罣礙故 無有恐怖 遠離顛倒夢想 究竟涅槃',
              source: 'Pronounced: Shin mu kege, mu kege ko, mu u kufu, on ri ten dō mu sō, ku kyō ne han',
              tokens: ['心', '無', '罣礙', '無', '罣礙', '故', '無', '有', '恐怖', '遠離', '顛倒', '夢想', '究竟', '涅槃'],
            },
          ],
          witnesses: [
            // MAPLE's result-section text spans much more Sanskrit than our
            // truncated segment — the "Bodhisattvasya prajñāpāramitām
            // āśritya viharati …" opening and the "Tryadhvavyavasthitāḥ
            // sarvabuddhāḥ …" closing are both omitted in our pali field.
            // alignTo maps only the load-bearing centre (cittāvaraṇa →
            // niṣṭhānirvāṇaḥ); the rest is -1.
            {
              by: 'MAPLE (after Master Sheng-yen)',
              text: 'Bodhisatvas rely on transcendent wisdom and their minds have no obstruction; with no obstruction there is no fear. Passing far beyond confusion and delusion, they reach ultimate nirvana. All Buddhas of the past, present and future rely on transcendent wisdom, and attain unexcelled, perfect, complete enlightenment.',
              alignTo: [-1, -1, -1, -1, -1, -1, -1, 0, -1, 1, 0, -1, -1, -1, -1, -1, 2, 2, 3, 3, 3, 3, -1, 3, -1, 4, 4, 4, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
              license: 'MAPLE liturgy sheet — adapted from Sheng-yen',
            },
            {
              by: 'Conze (1958)',
              text: 'With no mental obstructions, he has no fears. He has overcome what can upset, and reaches in the end to Nirvāṇa.',
              url: 'https://en.wikipedia.org/wiki/Heart_Sutra',
            },
            {
              by: 'Red Pine (2004)',
              text: 'Without obstructions in their minds they have no fears. Far beyond all distorted views they reach final nirvāṇa.',
              url: 'https://www.counterpointpress.com/dd-product/the-heart-sutra/',
              license: 'Quoted with attribution',
            },
            {
              by: 'Thich Nhat Hanh (2014)',
              text: 'There are no more obstacles in their mind, and because there are no more obstacles in their mind, they can overcome all fear, destroy all wrong perceptions and realize Perfect Nirvāṇa.',
              url: 'https://plumvillage.org/sutra/the-other-shore',
              license: 'Plum Village translation, quoted with attribution',
            },
          ],
          words: [
            {
              form: 'cittāvaraṇa',
              scriptAlt: 'चित्तावरण',
              scriptAlts: { 'zh-Hant': '罣礙', 'ja-Jpan': '罣礙' },
              scriptMorphemes: {
                'zh-Hant': [
                  { text: '罣', type: 'semantic', pronunciation: 'guà', gloss: 'snare, catch — obstruct in the sense of "caught on something"' },
                  { text: '礙', type: 'semantic', pronunciation: 'ài', gloss: 'block, hinder — paired doublet with 罣 for emphasis' },
                ],
                'ja-Jpan': [
                  { text: '罣', type: 'semantic', pronunciation: 'ke', gloss: 'snare, catch (read *ke* in 罣礙 *kege*)' },
                  { text: '礙', type: 'semantic', pronunciation: 'ge', gloss: 'block, hinder — doublet with 罣 = "obstruction"' },
                ],
              },
              pronunciation: 'CHEET-tah-VAH-rah-nah',
              etymology: '*citta* "mind" + *āvaraṇa* "obscuration, covering"',
              gloss: 'mental obscurations — the veils that hide things as they are',
              morphemes: [
                { text: 'citta', type: 'stem', gloss: 'mind', pronunciation: 'CHEET-tah' },
                { text: 'āvaraṇa', type: 'suffix', gloss: 'obscuration, cover', pronunciation: 'AH-vah-rah-nah' },
              ],
            },
            {
              form: 'atrasto',
              scriptAlt: 'अत्रस्तो',
              scriptAlts: { 'zh-Hant': '恐怖', 'ja-Jpan': '恐怖' },
              scriptMorphemes: {
                'zh-Hant': [
                  { text: '恐', type: 'semantic', pronunciation: 'kǒng', gloss: 'fear, dread — the affective recoil' },
                  { text: '怖', type: 'semantic', pronunciation: 'bù', gloss: 'terror — doublet with 恐 (Chinese often pairs near-synonyms for emphasis)' },
                ],
                'ja-Jpan': [
                  { text: '恐', type: 'semantic', pronunciation: 'ku', gloss: 'fear (read *ku* in 恐怖 *kufu*)' },
                  { text: '怖', type: 'semantic', pronunciation: 'fu', gloss: 'terror — doublet with 恐' },
                ],
              },
              pronunciation: 'ah-TRAHS-toh',
              etymology: '*a-* (negation) + *trasta* "afraid"',
              gloss: 'unafraid, fearless',
              accent: 'emerald',
              morphemes: [
                { text: 'a', type: 'prefix', gloss: 'not — the negation', pronunciation: 'ah' },
                { text: 'trasto', type: 'stem', gloss: 'afraid (past participle)', pronunciation: 'TRAHS-toh' },
              ],
            },
            {
              form: 'niṣṭhānirvāṇaḥ',
              scriptAlt: 'निष्ठानिर्वाणः',
              scriptAlts: { 'zh-Hant': '涅槃', 'ja-Jpan': '涅槃' },
              scriptMorphemes: {
                'zh-Hant': [
                  { text: '涅', type: 'phonetic', pronunciation: 'niè', gloss: 'phonetic: transliterates "nir-"; the character\'s usual meaning ("black mud, dye") is unrelated' },
                  { text: '槃', type: 'phonetic', pronunciation: 'pán', gloss: 'phonetic: transliterates "-vāṇa"; usual meaning ("plate, dish") is unrelated' },
                ],
                'ja-Jpan': [
                  { text: '涅', type: 'phonetic', pronunciation: 'ne', gloss: 'phonetic: transliterates "nir-" (read *ne* in 涅槃 *nehan*)' },
                  { text: '槃', type: 'phonetic', pronunciation: 'han', gloss: 'phonetic: transliterates "-vāṇa"' },
                ],
              },
              pronunciation: 'neesh-TAH-near-VAH-nah-h',
              etymology: '*niṣṭhā* "completion, end" + *nirvāṇa* "extinguishing"',
              gloss: 'final/complete nirvāṇa — the extinguishing of grasping that is the end of suffering',
              accent: 'violet',
              citations: [wikipediaCitation('Nirvana_(Buddhism)')],
            },
            {
              form: 'nāstitvād',
              scriptAlt: 'नास्तित्वाद्',
              pronunciation: 'NAHS-teet-vahd',
              etymology: '*na* "not" + *asti* "is" + *-tva* "-ness" + *-ād* ablative ending',
              gloss: 'due to the absence (of) — literally "from the not-being-ness of"',
              morphemes: [
                { text: 'nā', type: 'prefix', gloss: 'not (the negation)', pronunciation: 'nah' },
                { text: 'sti', type: 'stem', gloss: 'being (root √as "to be")', pronunciation: 'STEE' },
                { text: 'tvād', type: 'suffix', gloss: '"-ness, from" — forms the abstract noun and marks ablative ("due to")', pronunciation: 'TVAHD' },
              ],
            },
            {
              form: 'viparyāsātikrānto',
              scriptAlt: 'विपर्यासातिक्रान्तो',
              scriptAlts: { 'zh-Hant': '顛倒', 'ja-Jpan': '顛倒' },
              scriptMorphemes: {
                'zh-Hant': [
                  { text: '顛', type: 'semantic', pronunciation: 'diān', gloss: 'overturn, topple — having the right-side-up tipped over' },
                  { text: '倒', type: 'semantic', pronunciation: 'dǎo', gloss: 'upside-down, fallen — doublet with 顛 = "inverted"' },
                ],
                'ja-Jpan': [
                  { text: '顛', type: 'semantic', pronunciation: 'ten', gloss: 'overturn — read *ten* in 顛倒 (*tendō*)' },
                  { text: '倒', type: 'semantic', pronunciation: 'dō', gloss: 'upside-down — doublet with 顛' },
                ],
              },
              pronunciation: 'vee-pahr-YAH-sah-tee-KRAHN-toh',
              etymology: '*viparyāsa* "inverted view" + *atikrānta* "crossed beyond"',
              gloss: 'having crossed beyond inverted views — past the four distortions (taking the impure as pure, the impermanent as permanent, etc.)',
              accent: 'emerald',
              morphemes: [
                {
                  text: 'viparyāsa',
                  type: 'stem',
                  gloss: 'inverted view — seeing things upside-down (impermanent as permanent, suffering as pleasure, etc.)',
                  pronunciation: 'vee-pahr-YAH-sah',
                  citations: [wikipediaCitation('Viparyasa')],
                },
                {
                  text: 'atikrānto',
                  type: 'suffix',
                  gloss: 'having crossed beyond, transcended',
                  pronunciation: 'ah-tee-KRAHN-toh',
                },
              ],
            },
          ],
          note: 'The pivot from analysis to result. Having seen everything as empty, the bodhisattva is *unobstructed* — *atrasto*, unafraid. The Chinese 心無罣礙 (*shin mu kege* in Japanese reading) — "mind without obstruction" — is one of the most-quoted lines in East Asian Buddhism.',
        },
      ],
      commentary:
        "The body of the sutra continues with a detailed enumeration of what is empty — the six senses and their objects, the eighteen dhātus, the twelve nidānas, the Four Noble Truths — none are denied as conventional designations; all are seen through as devoid of own-being. Not yet authored in this reader; the canonical short version is c. 260 syllables in Sanskrit and the elided passages are well-attested in the cited canonical sources above.",
    },

    // ─────────────────────────────────────────────────────────────────────
    // 3. The dharani — sound-formula
    // ─────────────────────────────────────────────────────────────────────
    {
      id: 'dharani',
      shape: 'sound-formula',
      framing: 'The sutra ends not with a translation but with a mantra. *Tadyathā gate gate pāragate pārasaṃgate bodhi svāhā* — "thus: gone, gone, gone-beyond, fully-gone-beyond, awakening, hail."\n\nBut the mantra is more than its semantic content. Chanting it *is* the practice. The sounds carry the entire teaching — every step of *prajñāpāramitā* is enacted in the going-beyond that the syllables describe.',
      phonemes: 'gate gate pāragate pārasaṃgate bodhi svāhā',
      native: 'गते गते पारगते पारसंगते बोधि स्वाहा',
      scripts: [
        {
          lang: 'sa-Latn',
          label: 'Sanskrit (IAST)',
          text: 'gate gate pāragate pārasaṃgate bodhi svāhā',
        },
        {
          lang: 'sa-Deva',
          label: 'Sanskrit (Devanāgarī)',
          text: 'गते गते पारगते पारसंगते बोधि स्वाहा',
        },
        {
          lang: 'zh-Hant',
          label: 'Chinese (Xuanzang)',
          text: '揭諦揭諦 波羅揭諦 波羅僧揭諦 菩提薩婆訶',
          source: 'T251',
        },
        {
          lang: 'ja-Jpan',
          label: 'Japanese (Sino-Japanese)',
          text: '羯諦 羯諦 波羅羯諦 波羅僧羯諦 菩提 薩婆訶',
          source: 'Pronounced: Gyate gyate haragyate harasōgyate boji sowaka',
        },
        {
          lang: 'bo-Tibt',
          label: 'Tibetan',
          text: 'ག་ཏེ་ག་ཏེ་པཱ་ར་ག་ཏེ་པཱ་ར་སཾ་ག་ཏེ་བོ་དྷི་སྭཱ་ཧཱ',
        },
      ],
      reconstruction: 'Read literally: *gate* "gone" (locative or vocative of *gata*, past participle), repeated; *pāragate* "gone to the beyond"; *pārasaṃgate* "completely gone to the beyond"; *bodhi* "awakening"; *svāhā* an exclamation of completion (familiar from Vedic ritual). The repetition enacts the journey it describes.',
    },

    // ─────────────────────────────────────────────────────────────────────
    // 4. On translating the Heart Sutra
    // ─────────────────────────────────────────────────────────────────────
    {
      id: 'on-translation',
      shape: 'prose-commentary',
      heading: 'On translating the Heart Sutra',
      body: 'No two English Heart Sutras are alike. MAPLE\'s chanting text — adapted by Soryu from Master Sheng-yen — translates *rūpa* as "appearance", *vedanā* as "preference", *saṃjñā* as "information", *saṃskāra* as "patterning". Each of those choices is a doctrinal claim. *Appearance* foregrounds the phenomenological — not "form" out there but what shows up. *Preference* names the affective skandha as the leaning-toward / leaning-away that precedes thought. *Information* and *patterning* read the cognitive skandhas in language a meditation practitioner can ground in lived experience. The mantra at the end is, in MAPLE\'s text, a "great spell" — preserving the magical-formula register that English typically tames.\n\nConze\'s "form is emptiness" reads philosophical; Red Pine\'s reads liturgical; Thich Nhat Hanh\'s "this Body itself is Emptiness" reads phenomenological. The Chinese 色即是空 is sharper than any English can be — *just is*, with no copula gap, no preposition. The Tibetan introduces its own scholastic clarifications. Each tradition has been chanting this for over a thousand years; each has put its hand on the text and shaped it.\n\nThe witnesses above are sampled, not exhausted. Karl Brunnhölzl\'s *The Heart Attack Sutra* (2012) offers a careful Tibetan-tradition scholarly reading; Mu Soeng\'s *The Heart of the Universe* (2010) reads it through Zen; H.H. the Dalai Lama\'s commentaries integrate the Tibetan exegetical tradition; the Buddhist Text Translation Society\'s edition follows the Hsuan Hua lineage. All of them are correct and none of them are.\n\nThe instruction the sutra gives, however, is not to translate it — but to chant it, and through chanting, to *go*: *gate gate*.',
    },
  ],
};

export default heartSutra;

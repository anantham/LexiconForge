/**
 * Sho Sai Myō Kichijō Darani — 消災妙吉祥陀羅尼
 *
 * "The Marvelous Auspicious Dharani for Eliminating Disasters" — also
 * called Namu Samando (after its opening words). A sound-formula
 * (dharani) chanted 3× after the Enmē Jikku Kannon Gyō in the MAPLE
 * morning service.
 *
 * Like all dharanis, the practice is the sound, not the meaning. The
 * Sanskrit reconstruction (opening: *namaḥ samanta-buddhānāṃ
 * apratihata-śāsanānām* — "homage to all the buddhas whose teaching is
 * unimpeded") is offered as scholarly background, but the chanted form
 * has been a Sino-Japanese phonetic transmission for over a millennium
 * and is not used as translatable text.
 *
 * Reader treatment: `sound-formula` shape — monumental centred
 * phonemes, no inline English. Two scripts (Sino-Japanese phonetic +
 * Hanzi). Reconstruction in the aside.
 */

import type { LiturgyDoc } from '../../types/liturgy';

export const shoSaiMyoKichijoDarani: LiturgyDoc = {
  slug: 'sho-sai-myo-kichijo-darani',
  sangha: 'maple',
  order: 3,
  title: 'Sho Sai Myō Kichijō Darani',
  subtitle: 'The Marvelous Auspicious Dharani for Eliminating Disasters — 消災妙吉祥陀羅尼',
  tradition: 'mahayana',
  context: 'A Sanskrit *dharani* — protection-and-averting-of-disasters formula — preserved in Sino-Japanese kanji as phonetic carriers. Title 消災 = "extinguish disaster", 妙吉祥 = "marvelous auspicious".',
  sources: {
    canonical: [
      {
        label: 'Soto Zen morning service tradition',
        url: 'https://en.wikipedia.org/wiki/Dharani',
      },
    ],
    ritual: [
      { label: 'MAPLE morning service sheet' },
    ],
  },
  curator:
    'Curation by Aditya. Sino-Japanese phonetic + Hanzi forms transcribed directly from the MAPLE chant sheet. Sanskrit reconstruction follows standard scholarly readings (Inagaki, Yokoyama).',
  sections: [
    {
      id: 'dharani',
      shape: 'triple-script-witness',
      segments: [

        // ── Line 1: namaḥ samanta-buddhānāṃ ──
        {
          id: 'shosai-l1',
          pali: 'namaḥ samanta-buddhānāṃ',
          paliDeva: 'नमः समन्त बुद्धानां',
          scripts: [
            { lang: 'sa-Latn', label: 'Sanskrit (IAST)', text: 'namaḥ samanta-buddhānāṃ' },
            { lang: 'sa-Deva', label: 'Sanskrit (Devanāgarī)', text: 'नमः समन्त बुद्धानां', transliteration: 'namaḥ samanta-buddhānāṃ' },
            {
              lang: 'ja-Jpan',
              label: 'Sino-Japanese (chant)',
              text: 'Na mu sa man da mo to nan',
              source: 'MAPLE chant sheet',
              tokens: ['Na mu', 'sa man da', 'mo to nan'],
            },
            {
              lang: 'zh-Hant',
              label: 'Hanzi (phonetic carriers)',
              text: '曩謨 三滿哆 母䭾喃',
              source: 'Phonetic transliteration — kanji are sound-carriers, not semantic.',
              tokens: ['曩謨', '三滿哆', '母䭾喃'],
              transliteration: 'nǎng-mó sān-mǎn-duō mǔ-tuó-nán  (Mandarin pinyin)',
            },
          ],
          witnesses: [
            {
              by: 'Literal Sanskrit gloss',
              text: 'homage to all the buddhas',
              alignTo: [0, -1, 1, -1, 2],
            },
          ],
          words: [
            {
              form: 'namaḥ',
              scriptAlt: 'नमः',
              scriptAlts: { 'ja-Jpan': 'Na mu', 'zh-Hant': '曩謨' },
              scriptMorphemes: {
                'zh-Hant': [
                  { text: '曩', type: 'phonetic', pronunciation: 'nǎng', gloss: 'phonetic: transliterates *na* (kanji semantic meaning "long ago" is unrelated to the chant)' },
                  { text: '謨', type: 'phonetic', pronunciation: 'mó', gloss: 'phonetic: transliterates *maḥ*' },
                ],
              },
              pronunciation: 'NAH-mah(s)',
              etymology: 'Sanskrit *namaḥ* "homage, devotion" — the standard opening of devotional invocations.',
              gloss: 'homage, devotion — same root as the *namo* in *namo tassa*',
            },
            {
              form: 'samanta',
              scriptAlt: 'समन्त',
              scriptAlts: { 'ja-Jpan': 'sa man da', 'zh-Hant': '三滿哆' },
              scriptMorphemes: {
                'zh-Hant': [
                  { text: '三', type: 'phonetic', pronunciation: 'sān', gloss: 'phonetic: transliterates *sa* (NOT the semantic meaning "three")' },
                  { text: '滿', type: 'phonetic', pronunciation: 'mǎn', gloss: 'phonetic: transliterates *man*' },
                  { text: '哆', type: 'phonetic', pronunciation: 'duō', gloss: 'phonetic: transliterates *ta*' },
                ],
              },
              pronunciation: 'sah-MAHN-tah',
              etymology: '*sam-* "together, fully" + *-anta* "extent"',
              gloss: 'universal, all-encompassing',
            },
            {
              form: 'buddhānāṃ',
              scriptAlt: 'बुद्धानां',
              scriptAlts: { 'ja-Jpan': 'mo to nan', 'zh-Hant': '母䭾喃' },
              scriptMorphemes: {
                'zh-Hant': [
                  { text: '母', type: 'phonetic', pronunciation: 'mǔ', gloss: 'phonetic: transliterates *bu*/*mu* (semantic "mother" unrelated)' },
                  { text: '䭾', type: 'phonetic', pronunciation: 'tuó', gloss: 'phonetic: transliterates *dhā*' },
                  { text: '喃', type: 'phonetic', pronunciation: 'nán', gloss: 'phonetic: transliterates *nāṃ* (genitive plural ending)' },
                ],
              },
              pronunciation: 'bood-DHAH-nahm',
              etymology: '*buddha* "awakened one" + *-ānāṃ* (genitive plural)',
              gloss: 'of the buddhas (genitive plural)',
            },
          ],
        },

        // ── Line 2: apratihata-śāsanānām ──
        {
          id: 'shosai-l2',
          pali: 'apratihata-śāsanānām',
          paliDeva: 'अप्रतिहत शासनानाम्',
          scripts: [
            { lang: 'sa-Latn', label: 'Sanskrit (IAST)', text: 'apratihata-śāsanānām' },
            { lang: 'sa-Deva', label: 'Sanskrit (Devanāgarī)', text: 'अप्रतिहत शासनानाम्', transliteration: 'apratihata-śāsanānām' },
            {
              lang: 'ja-Jpan',
              label: 'Sino-Japanese (chant)',
              text: 'O ha ra chi ko to sha so no nan',
              source: 'MAPLE chant sheet',
              tokens: ['O ha ra chi', 'ko to sha', 'so no nan'],
            },
            {
              lang: 'zh-Hant',
              label: 'Hanzi (phonetic carriers)',
              text: '阿盋囉底 賀多舍 娑曩喃',
              source: 'Phonetic transliteration',
              tokens: ['阿盋囉底', '賀多舍', '娑曩喃'],
              transliteration: 'ā-bō-luó-dǐ hè-duō-shě suō-nǎng-nán  (Mandarin pinyin)',
            },
          ],
          witnesses: [
            {
              by: 'Literal Sanskrit gloss',
              text: 'whose teaching is unimpeded',
              alignTo: [-1, -1, 1, 0],
            },
          ],
          words: [
            {
              form: 'apratihata',
              scriptAlt: 'अप्रतिहत',
              scriptAlts: { 'ja-Jpan': 'O ha ra chi', 'zh-Hant': '阿盋囉底' },
              scriptMorphemes: {
                'zh-Hant': [
                  { text: '阿', type: 'phonetic', pronunciation: 'ā', gloss: 'phonetic: transliterates *a-* (the negation)' },
                  { text: '盋', type: 'phonetic', pronunciation: 'bō', gloss: 'phonetic: transliterates *pra-*' },
                  { text: '囉', type: 'phonetic', pronunciation: 'luó', gloss: 'phonetic: transliterates *-(t)i-*' },
                  { text: '底', type: 'phonetic', pronunciation: 'dǐ', gloss: 'phonetic: transliterates *-hata*' },
                ],
              },
              pronunciation: 'ah-prah-tee-HAH-tah',
              etymology: '*a-* "not" + *prati-* "against" + *hata* "struck" (past participle of √han)',
              gloss: 'unimpeded, unobstructed — literally "not struck against"',
              morphemes: [
                { text: 'a', type: 'prefix', gloss: 'not', pronunciation: 'ah' },
                { text: 'prati', type: 'prefix', gloss: 'against, toward', pronunciation: 'prah-tee' },
                { text: 'hata', type: 'stem', root: '√han', gloss: 'struck (past participle)', pronunciation: 'HAH-tah' },
              ],
            },
            {
              form: 'śāsanānām',
              scriptAlt: 'शासनानाम्',
              scriptAlts: { 'ja-Jpan': 'ko to sha so no nan', 'zh-Hant': '賀多舍 娑曩喃' },
              scriptMorphemes: {
                'zh-Hant': [
                  { text: '賀', type: 'phonetic', pronunciation: 'hè', gloss: 'phonetic: transliterates *śā-*' },
                  { text: '多', type: 'phonetic', pronunciation: 'duō', gloss: 'phonetic: transliterates *-sa-*' },
                  { text: '舍', type: 'phonetic', pronunciation: 'shě', gloss: 'phonetic: transliterates *-na-*' },
                  { text: '娑', type: 'phonetic', pronunciation: 'suō', gloss: 'phonetic: transliterates *(śā)sa-*' },
                  { text: '曩', type: 'phonetic', pronunciation: 'nǎng', gloss: 'phonetic: transliterates *-nā-*' },
                  { text: '喃', type: 'phonetic', pronunciation: 'nán', gloss: 'phonetic: transliterates *-nām* (genitive plural)' },
                ],
              },
              pronunciation: 'shah-sah-NAH-nahm',
              etymology: '*śās* "to teach, instruct" → *śāsana* "teaching" + *-ānām* (genitive plural)',
              gloss: 'of the teachings — together: "of-those-with-unimpeded-teachings"',
              morphemes: [
                { text: 'śās', type: 'root', root: '√śās', gloss: 'to teach, instruct', pronunciation: 'shahs' },
                { text: 'an', type: 'suffix', gloss: 'noun-forming — yields *śāsana* "teaching" (the suffix is *-ana*; its final vowel merges into the ending that follows)', pronunciation: 'ah-nah' },
                { text: 'ānām', type: 'suffix', gloss: 'the "-ānām" tail marks "of those …" — a possessive plural', pronunciation: 'AH-nahm' },
              ],
            },
          ],
        },

        // ── Line 3: tadyathā oṃ kha kha khāhi khāhi ──
        {
          id: 'shosai-l3',
          pali: 'tadyathā oṃ kha kha khāhi khāhi',
          paliDeva: 'तद्यथा ओं ख ख खाहि खाहि',
          scripts: [
            { lang: 'sa-Latn', label: 'Sanskrit (IAST)', text: 'tadyathā oṃ kha kha khāhi khāhi' },
            { lang: 'sa-Deva', label: 'Sanskrit (Devanāgarī)', text: 'तद्यथा ओं ख ख खाहि खाहि', transliteration: 'tadyathā oṃ kha kha khāhi khāhi' },
            {
              lang: 'ja-Jpan',
              label: 'Sino-Japanese (chant)',
              text: 'To ji to en gya gya gya ki gya ki',
              source: 'MAPLE chant sheet',
              tokens: ['To ji to', 'en', 'gya gya', 'gya ki gya ki'],
            },
            {
              lang: 'zh-Hant',
              label: 'Hanzi (phonetic carriers)',
              text: '怛姪他 唵 佉佉 佉呬 佉呬',
              source: 'Phonetic transliteration',
              tokens: ['怛姪他', '唵', '佉佉', '佉呬', '佉呬'],
              transliteration: 'dá-zhí-tā ǎn qū-qū qū-xì qū-xì  (Mandarin pinyin)',
            },
          ],
          witnesses: [
            {
              by: 'Literal Sanskrit gloss',
              text: 'thus: oṃ, sound, sound, sound, sound',
              alignTo: [0, 1, 2, 3, 4, 5],
            },
          ],
          words: [
            {
              form: 'tadyathā',
              scriptAlt: 'तद्यथा',
              scriptAlts: { 'ja-Jpan': 'To ji to', 'zh-Hant': '怛姪他' },
              scriptMorphemes: {
                'zh-Hant': [
                  { text: '怛', type: 'phonetic', pronunciation: 'dá', gloss: 'phonetic: transliterates *tad-*' },
                  { text: '姪', type: 'phonetic', pronunciation: 'zhí', gloss: 'phonetic: transliterates *-ya-*' },
                  { text: '他', type: 'phonetic', pronunciation: 'tā', gloss: 'phonetic: transliterates *-thā*' },
                ],
              },
              pronunciation: 'tahd-yah-THAH',
              etymology: '*tat* "that" + *yathā* "as" — "as that, namely, thus"',
              gloss: 'thus, namely — the formula introducing the mantra proper',
            },
            {
              form: 'oṃ',
              scriptAlt: 'ओं',
              scriptAlts: { 'ja-Jpan': 'en', 'zh-Hant': '唵' },
              pronunciation: 'OHM',
              etymology: 'The most universal Vedic / Buddhist seed-syllable.',
              gloss: 'oṃ — the primal sound-syllable that opens many mantras',
            },
            { form: 'kha', scriptAlt: 'ख', scriptAlts: { 'zh-Hant': '佉' }, pronunciation: 'KHAH', gloss: 'ritual sound-syllable (no semantic content; functions as a protection-mantra particle)' },
            { form: 'kha', scriptAlt: 'ख', pronunciation: 'KHAH', gloss: '(repetition for emphasis)' },
            { form: 'khāhi', scriptAlt: 'खाहि', scriptAlts: { 'zh-Hant': '佉呬' }, pronunciation: 'KHAH-hee', gloss: 'ritual sound-syllable' },
            { form: 'khāhi', scriptAlt: 'खाहि', pronunciation: 'KHAH-hee', gloss: '(repetition)' },
          ],
        },

        // ── Line 4: hūṃ hūṃ jvala jvala ──
        {
          id: 'shosai-l4',
          pali: 'hūṃ hūṃ jvala jvala',
          paliDeva: 'हूं हूं ज्वल ज्वल',
          scripts: [
            { lang: 'sa-Latn', label: 'Sanskrit (IAST)', text: 'hūṃ hūṃ jvala jvala' },
            { lang: 'sa-Deva', label: 'Sanskrit (Devanāgarī)', text: 'हूं हूं ज्वल ज्वल', transliteration: 'hūṃ hūṃ jvala jvala' },
            {
              lang: 'ja-Jpan',
              label: 'Sino-Japanese (chant)',
              text: 'Un nun shi fu ra shi fu ra',
              source: 'MAPLE chant sheet',
              tokens: ['Un nun', 'shi fu ra', 'shi fu ra'],
            },
            {
              lang: 'zh-Hant',
              label: 'Hanzi (phonetic carriers)',
              text: '吽吽 入嚩囉 入嚩囉',
              source: 'Phonetic transliteration',
              tokens: ['吽吽', '入嚩囉', '入嚩囉'],
              transliteration: 'hōng-hōng rù-fú-luó rù-fú-luó  (Mandarin pinyin)',
            },
          ],
          witnesses: [
            {
              by: 'Literal Sanskrit gloss',
              text: 'hūṃ hūṃ, blaze, blaze',
              alignTo: [0, 1, 2, 3],
            },
          ],
          words: [
            {
              form: 'hūṃ',
              scriptAlt: 'हूं',
              scriptAlts: { 'ja-Jpan': 'Un', 'zh-Hant': '吽' },
              pronunciation: 'HOOM',
              etymology: 'Sanskrit seed-syllable (*bīja*). One of the most universal mantra-syllables, associated with transformation and breaking through obstruction.',
              gloss: '*hūṃ* — seed-syllable of wrathful transformation',
            },
            { form: 'hūṃ', scriptAlt: 'हूं', scriptAlts: { 'ja-Jpan': 'nun', 'zh-Hant': '吽' }, pronunciation: 'HOOM', gloss: '(repetition)' },
            {
              form: 'jvala',
              scriptAlt: 'ज्वल',
              scriptAlts: { 'ja-Jpan': 'shi fu ra', 'zh-Hant': '入嚩囉' },
              scriptMorphemes: {
                'zh-Hant': [
                  { text: '入', type: 'phonetic', pronunciation: 'rù', gloss: 'phonetic: transliterates *j-* (semantic "enter" unrelated)' },
                  { text: '嚩', type: 'phonetic', pronunciation: 'fú', gloss: 'phonetic: transliterates *-va-*' },
                  { text: '囉', type: 'phonetic', pronunciation: 'luó', gloss: 'phonetic: transliterates *-la*' },
                ],
              },
              pronunciation: 'JVAH-lah',
              etymology: '√jval "to blaze, burn"',
              gloss: 'blaze, flame — the fire-of-wisdom register',
            },
            { form: 'jvala', scriptAlt: 'ज्वल', pronunciation: 'JVAH-lah', gloss: '(repetition)' },
          ],
        },

        // ── Line 5: prajvala prajvala ──
        {
          id: 'shosai-l5',
          pali: 'prajvala prajvala',
          paliDeva: 'प्रज्वल प्रज्वल',
          scripts: [
            { lang: 'sa-Latn', label: 'Sanskrit (IAST)', text: 'prajvala prajvala' },
            { lang: 'sa-Deva', label: 'Sanskrit (Devanāgarī)', text: 'प्रज्वल प्रज्वल', transliteration: 'prajvala prajvala' },
            {
              lang: 'ja-Jpan',
              label: 'Sino-Japanese (chant)',
              text: 'Ha ra shi fu ra ha ra shi fu ra',
              source: 'MAPLE chant sheet',
              tokens: ['Ha ra shi fu ra', 'ha ra shi fu ra'],
            },
            {
              lang: 'zh-Hant',
              label: 'Hanzi (phonetic carriers)',
              text: '盋囉入嚩囉 盋囉入嚩囉',
              source: 'Phonetic transliteration',
              tokens: ['盋囉入嚩囉', '盋囉入嚩囉'],
              transliteration: 'bō-luó-rù-fú-luó bō-luó-rù-fú-luó  (Mandarin pinyin)',
            },
          ],
          witnesses: [
            {
              by: 'Literal Sanskrit gloss',
              text: 'blaze forth, blaze forth',
              alignTo: [0, 0, 1, 1],
            },
          ],
          words: [
            {
              form: 'prajvala',
              scriptAlt: 'प्रज्वल',
              scriptAlts: { 'ja-Jpan': 'Ha ra shi fu ra', 'zh-Hant': '盋囉入嚩囉' },
              scriptMorphemes: {
                'zh-Hant': [
                  { text: '盋', type: 'phonetic', pronunciation: 'bō', gloss: 'phonetic: transliterates *pra-*' },
                  { text: '囉', type: 'phonetic', pronunciation: 'luó', gloss: 'phonetic: transliterates *-(j)-*' },
                  { text: '入', type: 'phonetic', pronunciation: 'rù', gloss: 'phonetic: transliterates *(j)v-*' },
                  { text: '嚩', type: 'phonetic', pronunciation: 'fú', gloss: 'phonetic: transliterates *-a-*' },
                  { text: '囉', type: 'phonetic', pronunciation: 'luó', gloss: 'phonetic: transliterates *-la*' },
                ],
              },
              pronunciation: 'prah-JVAH-lah',
              etymology: '*pra-* "forth, forward" + *jvala* "blaze"',
              gloss: 'blaze forth — the intensified form of *jvala*',
              morphemes: [
                { text: 'pra', type: 'prefix', gloss: 'forth, forward', pronunciation: 'prah' },
                { text: 'jvala', type: 'stem', root: '√jval', gloss: 'blaze', pronunciation: 'JVAH-lah' },
              ],
            },
            { form: 'prajvala', scriptAlt: 'प्रज्वल', scriptAlts: { 'ja-Jpan': 'ha ra shi fu ra', 'zh-Hant': '盋囉入嚩囉' }, pronunciation: 'prah-JVAH-lah', gloss: '(repetition)' },
          ],
        },

        // ── Line 6: tiṣṭha tiṣṭha ──
        {
          id: 'shosai-l6',
          pali: 'tiṣṭha tiṣṭha',
          paliDeva: 'तिष्ठ तिष्ठ',
          scripts: [
            { lang: 'sa-Latn', label: 'Sanskrit (IAST)', text: 'tiṣṭha tiṣṭha' },
            { lang: 'sa-Deva', label: 'Sanskrit (Devanāgarī)', text: 'तिष्ठ तिष्ठ', transliteration: 'tiṣṭha tiṣṭha' },
            {
              lang: 'ja-Jpan',
              label: 'Sino-Japanese (chant)',
              text: 'Chi shu sa chi shu sa',
              source: 'MAPLE chant sheet',
              tokens: ['Chi shu sa', 'chi shu sa'],
            },
            {
              lang: 'zh-Hant',
              label: 'Hanzi (phonetic carriers)',
              text: '底瑟姹 底瑟姹',
              source: 'Phonetic transliteration',
              tokens: ['底瑟姹', '底瑟姹'],
              transliteration: 'dǐ-sè-chà dǐ-sè-chà  (Mandarin pinyin)',
            },
          ],
          witnesses: [
            {
              by: 'Literal Sanskrit gloss',
              text: 'stand, stand (be established)',
              alignTo: [0, 1, -1, -1],
            },
          ],
          words: [
            {
              form: 'tiṣṭha',
              scriptAlt: 'तिष्ठ',
              scriptAlts: { 'ja-Jpan': 'Chi shu sa', 'zh-Hant': '底瑟姹' },
              scriptMorphemes: {
                'zh-Hant': [
                  { text: '底', type: 'phonetic', pronunciation: 'dǐ', gloss: 'phonetic: transliterates *ti-*' },
                  { text: '瑟', type: 'phonetic', pronunciation: 'sè', gloss: 'phonetic: transliterates *-ṣṭh-*' },
                  { text: '姹', type: 'phonetic', pronunciation: 'chà', gloss: 'phonetic: transliterates *-a*' },
                ],
              },
              pronunciation: 'TISH-thah',
              etymology: '√sthā "to stand" — imperative *tiṣṭha* "stand!"',
              gloss: 'stand! be established! (imperative)',
            },
            { form: 'tiṣṭha', scriptAlt: 'तिष्ठ', scriptAlts: { 'ja-Jpan': 'chi shu sa', 'zh-Hant': '底瑟姹' }, pronunciation: 'TISH-thah', gloss: '(repetition)' },
          ],
        },

        // ── Line 7: ṣṭri ṣṭri ──
        {
          id: 'shosai-l7',
          pali: 'ṣṭri ṣṭri',
          paliDeva: 'ष्ट्रि ष्ट्रि',
          scripts: [
            { lang: 'sa-Latn', label: 'Sanskrit (IAST)', text: 'ṣṭri ṣṭri' },
            { lang: 'sa-Deva', label: 'Sanskrit (Devanāgarī)', text: 'ष्ट्रि ष्ट्रि', transliteration: 'ṣṭri ṣṭri' },
            {
              lang: 'ja-Jpan',
              label: 'Sino-Japanese (chant)',
              text: 'Shi shu ri shi shu ri',
              source: 'MAPLE chant sheet',
              tokens: ['Shi shu ri', 'shi shu ri'],
            },
            {
              lang: 'zh-Hant',
              label: 'Hanzi (phonetic carriers)',
              text: '瑟緻哩 瑟緻哩',
              source: 'Phonetic transliteration',
              tokens: ['瑟緻哩', '瑟緻哩'],
              transliteration: 'sè-zhì-lǐ sè-zhì-lǐ  (Mandarin pinyin)',
            },
          ],
          witnesses: [
            {
              by: 'Literal Sanskrit gloss',
              text: '(ritual sound)',
              alignTo: [-1, -1],
            },
          ],
          words: [
            { form: 'ṣṭri', scriptAlt: 'ष्ट्रि', scriptAlts: { 'ja-Jpan': 'Shi shu ri', 'zh-Hant': '瑟緻哩' }, pronunciation: 'SHTREE', gloss: 'ritual sound-syllable (no clear semantic content; functions as a protection-mantra particle)' },
            { form: 'ṣṭri', scriptAlt: 'ष्ट्रि', scriptAlts: { 'ja-Jpan': 'shi shu ri', 'zh-Hant': '瑟緻哩' }, pronunciation: 'SHTREE', gloss: '(repetition)' },
          ],
        },

        // ── Line 8: sphaṭ sphaṭ ──
        {
          id: 'shosai-l8',
          pali: 'sphaṭ sphaṭ',
          paliDeva: 'स्फट् स्फट्',
          scripts: [
            { lang: 'sa-Latn', label: 'Sanskrit (IAST)', text: 'sphaṭ sphaṭ' },
            { lang: 'sa-Deva', label: 'Sanskrit (Devanāgarī)', text: 'स्फट् स्फट्', transliteration: 'sphaṭ sphaṭ' },
            {
              lang: 'ja-Jpan',
              label: 'Sino-Japanese (chant)',
              text: 'So ha ja so ha ja',
              source: 'MAPLE chant sheet',
              tokens: ['So ha ja', 'so ha ja'],
            },
            {
              lang: 'zh-Hant',
              label: 'Hanzi (phonetic carriers)',
              text: '娑發吒 娑發吒',
              source: 'Phonetic transliteration',
              tokens: ['娑發吒', '娑發吒'],
              transliteration: 'suō-fā-zhà suō-fā-zhà  (Mandarin pinyin)',
            },
          ],
          witnesses: [
            {
              by: 'Literal Sanskrit gloss',
              text: '(ritual sound)',
              alignTo: [-1, -1],
            },
          ],
          words: [
            { form: 'sphaṭ', scriptAlt: 'स्फट्', scriptAlts: { 'ja-Jpan': 'So ha ja', 'zh-Hant': '娑發吒' }, pronunciation: 'SPHAHT', gloss: 'ritual sound — onomatopoeic, often glossed as a sharp-breaking sound; functions as a wrathful-protection particle' },
            { form: 'sphaṭ', scriptAlt: 'स्फट्', scriptAlts: { 'ja-Jpan': 'so ha ja', 'zh-Hant': '娑發吒' }, pronunciation: 'SPHAHT', gloss: '(repetition)' },
          ],
        },

        // ── Line 9: śāntika śrīye svāhā ──
        {
          id: 'shosai-l9',
          pali: 'śāntika śrīye svāhā',
          paliDeva: 'शान्तिक श्रीये स्वाहा',
          scripts: [
            { lang: 'sa-Latn', label: 'Sanskrit (IAST)', text: 'śāntika śrīye svāhā' },
            { lang: 'sa-Deva', label: 'Sanskrit (Devanāgarī)', text: 'शान्तिक श्रीये स्वाहा', transliteration: 'śāntika śrīye svāhā' },
            {
              lang: 'ja-Jpan',
              label: 'Sino-Japanese (chant)',
              text: 'Se chi gya shi ri ē so mo ko',
              source: 'MAPLE chant sheet',
              tokens: ['Se chi gya', 'shi ri ē', 'so mo ko'],
            },
            {
              lang: 'zh-Hant',
              label: 'Hanzi (phonetic carriers)',
              text: '扇底迦 室哩曳 娑婆訶',
              source: 'Phonetic transliteration',
              tokens: ['扇底迦', '室哩曳', '娑婆訶'],
              transliteration: 'shàn-dǐ-jiā shì-lǐ-yè suō-pó-hē  (Mandarin pinyin)',
            },
          ],
          witnesses: [
            {
              by: 'Literal Sanskrit gloss',
              text: 'for peace, for prosperity, svāhā',
              alignTo: [-1, 0, -1, 1, 2],
            },
          ],
          words: [
            {
              form: 'śāntika',
              scriptAlt: 'शान्तिक',
              scriptAlts: { 'ja-Jpan': 'Se chi gya', 'zh-Hant': '扇底迦' },
              scriptMorphemes: {
                'zh-Hant': [
                  { text: '扇', type: 'phonetic', pronunciation: 'shàn', gloss: 'phonetic: transliterates *śān-*' },
                  { text: '底', type: 'phonetic', pronunciation: 'dǐ', gloss: 'phonetic: transliterates *-ti-*' },
                  { text: '迦', type: 'phonetic', pronunciation: 'jiā', gloss: 'phonetic: transliterates *-ka*' },
                ],
              },
              pronunciation: 'SHAHN-tee-kah',
              etymology: '*śānti* "peace" + *-ka* (deriving an adjective)',
              gloss: 'for peace, peace-bringing — names *Sho Sai* (eliminating disaster)',
            },
            {
              form: 'śrīye',
              scriptAlt: 'श्रीये',
              scriptAlts: { 'ja-Jpan': 'shi ri ē', 'zh-Hant': '室哩曳' },
              scriptMorphemes: {
                'zh-Hant': [
                  { text: '室', type: 'phonetic', pronunciation: 'shì', gloss: 'phonetic: transliterates *śrī-*' },
                  { text: '哩', type: 'phonetic', pronunciation: 'lǐ', gloss: 'phonetic: transliterates *-(r)i-*' },
                  { text: '曳', type: 'phonetic', pronunciation: 'yè', gloss: 'phonetic: transliterates *-ye* (dative ending)' },
                ],
              },
              pronunciation: 'SHREE-yay',
              etymology: 'dative of *śrī* "prosperity, splendor"',
              gloss: 'for prosperity, for splendor — names *Myō Kichijō* (marvelous auspicious)',
            },
            {
              form: 'svāhā',
              scriptAlt: 'स्वाहा',
              scriptAlts: { 'ja-Jpan': 'so mo ko', 'zh-Hant': '娑婆訶' },
              scriptMorphemes: {
                'zh-Hant': [
                  { text: '娑', type: 'phonetic', pronunciation: 'suō', gloss: 'phonetic: transliterates *svā-*' },
                  { text: '婆', type: 'phonetic', pronunciation: 'pó', gloss: 'phonetic: transliterates *-hā-*' },
                  { text: '訶', type: 'phonetic', pronunciation: 'hē', gloss: 'phonetic: transliterates *-hā*' },
                ],
              },
              pronunciation: 'svah-HAH',
              etymology: 'Standard Vedic ritual exclamation marking the completion of an offering.',
              gloss: 'svāhā — "so be it", "thus completed" — closes dharanis and ritual invocations',
            },
          ],
        },

      ],
    },
  ],
};

export default shoSaiMyoKichijoDarani;

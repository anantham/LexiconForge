/**
 * Heart Sutra — Prajñāpāramitā Hṛdaya Sūtra.
 *
 * The shortest and most widely-chanted Mahāyāna sutra. The "heart" of the
 * vast Perfection-of-Wisdom corpus, distilled into something a community
 * can chant in a few minutes.
 *
 * Scope of this file:
 *   - Framing
 *   - Opening (3 segments: Avalokiteśvara · the deep practice · the seeing)
 *   - The form-emptiness identity (4 segments — the canonical chiastic quatrain)
 *   - The result section (5 segments — one per Xuanzang chant-line)
 *   - Dharani (sound-formula)
 *   - Closing caveat on translating the Heart Sutra
 *
 * Segment granularity: each `triple-script-witness` segment matches **one
 * Xuanzang four-character chant-line** rather than a whole paragraph. That
 * is the natural rhythmic unit — what a chanting community hits as one
 * stroke of the *moktak*. The English witnesses are sliced into the
 * corresponding sub-phrase per segment.
 *
 * Sourcing:
 *   - Sanskrit IAST + Devanāgarī follow Conze's 1948 critical edition.
 *   - Chinese is Xuanzang's T251 (the canonical East Asian text).
 *   - Tibetan is the short-form recension found in the Kangyur.
 */

import type { LiturgyDoc } from '../../types/liturgy';
import {
  wikipediaCitation,
} from './_groundingHelpers';

export const heartSutra: LiturgyDoc = {
  slug: 'heart-sutra',
  sangha: 'maple',
  order: 4,
  title: 'The Scripture on the Heart of Transcendent Wisdom',
  subtitle: 'Prajñāpāramitā Hṛdaya Sūtra · MAPLE chant text (after Sheng-yen)',
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
    "Curation by Aditya. The primary English witness is the MAPLE community chant sheet, titled \"The Scripture on the Heart of Transcendent Wisdom — Adapted from the translation by Master Sheng-yen.\" Sanskrit follows Conze's short version; Chinese is Xuanzang's T251; Tibetan from the Kangyur short-form. The other witnesses (Conze 1958, Red Pine 2004, Thich Nhat Hanh 2014) come from their published translations, sliced per Xuanzang chant-line for comparison.",
  sections: [
    // ─────────────────────────────────────────────────────────────────────
    // The body — broken into chant-line segments
    // ─────────────────────────────────────────────────────────────────────
    {
      id: 'heart-core',
      shape: 'triple-script-witness',
      segments: [

        // ══════════════════════════════════════════════════════════════
        // OPENING — Avalokiteśvara contemplating the skandhas
        // ══════════════════════════════════════════════════════════════

        // ── 觀自在菩薩 — Avalokiteśvara Bodhisattva ──
        {
          id: 'opening-avalokita',
          pali: 'Āryāvalokiteśvaro bodhisattvo',
          paliDeva: 'आर्यावलोकितेश्वरो बोधिसत्त्वो',
          scripts: [
            { lang: 'sa-Latn', label: 'Sanskrit (IAST)', text: 'Āryāvalokiteśvaro bodhisattvo' },
            {
              lang: 'sa-Deva',
              label: 'Sanskrit (Devanāgarī)',
              text: 'आर्यावलोकितेश्वरो बोधिसत्त्वो',
              transliteration: 'Āryāvalokiteśvaro bodhisattvo',
            },
            {
              lang: 'zh-Hant',
              label: 'Chinese (Xuanzang)',
              text: '觀自在菩薩',
              source: 'T251 玄奘譯',
              tokens: ['觀自在', '菩薩'],
              transliteration: 'guān-zì-zài  pú-sà  (Mandarin pinyin)',
            },
            {
              lang: 'ja-Jpan',
              label: 'Japanese (Sino-Japanese)',
              text: '観自在菩薩',
              source: 'Hannya Shingyō',
              tokens: ['観自在', '菩薩'],
              transliteration: 'Kanjizai bosatsu  (Sino-Japanese kanbun-yomi)',
            },
            {
              lang: 'bo-Tibt',
              label: 'Tibetan',
              text: 'བྱང་ཆུབ་སེམས་དཔའ་འཕགས་པ་སྤྱན་རས་གཟིགས་དབང་ཕྱུག',
              source: 'Kangyur short-form recension',
              transliteration: "jang-chub sem-pa pak-pa chen-ré-zig wang-chuk  (Lhasa Tibetan)",
              tokens: ['བྱང་ཆུབ་སེམས་དཔའ', 'འཕགས་པ་སྤྱན་རས་གཟིགས་དབང་ཕྱུག'],
            },
          ],
          witnesses: [
            {
              by: 'MAPLE chant sheet (after Sheng-yen)',
              text: 'Avalokiteśvara Bodhisatva,',
              alignTo: [0, 1],
              license: 'MAPLE community chant sheet, adapted from Master Sheng-yen\'s translation',
            },
            {
              by: 'Conze (1958)',
              text: 'Avalokita, the Holy Lord and Bodhisattva,',
              alignTo: [0, -1, 0, 0, -1, 1],
              url: 'https://en.wikipedia.org/wiki/Heart_Sutra',
            },
            {
              by: 'Red Pine (2004)',
              text: 'The noble Avalokiteśvara,',
              alignTo: [-1, 0, 0],
              url: 'https://www.counterpointpress.com/dd-product/the-heart-sutra/',
              license: 'Quoted with attribution',
            },
            {
              by: 'Thich Nhat Hanh (2014)',
              text: 'The Bodhisattva Avalokiteśvara,',
              alignTo: [-1, 1, 0],
              url: 'https://plumvillage.org/sutra/the-other-shore',
              license: 'Plum Village translation, quoted with attribution',
            },
          ],
          words: [
            {
              form: 'Āryāvalokiteśvaro',
              scriptAlt: 'आर्यावलोकितेश्वरो',
              scriptAlts: { 'zh-Hant': '觀自在', 'ja-Jpan': '観自在', 'bo-Tibt': 'འཕགས་པ་སྤྱན་རས་གཟིགས་དབང་ཕྱུག' },
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
                'bo-Tibt': [
                  { text: 'འཕགས་པ་', type: 'semantic', pronunciation: 'phags pa', gloss: 'noble, exalted — renders Sanskrit *ārya*' },
                  { text: 'སྤྱན་', type: 'semantic', pronunciation: 'spyan', gloss: 'eye (honorific) — same root as Chenrezig\'s name' },
                  { text: 'རས་', type: 'semantic', pronunciation: 'ras', gloss: 'with, attended-by — the relational particle of the name' },
                  { text: 'གཟིགས་', type: 'semantic', pronunciation: 'gzigs', gloss: 'gazes, regards (honorific) — together སྤྱན་རས་གཟིགས = "the compassionate gazer" = *avalokita*' },
                  { text: 'དབང་', type: 'semantic', pronunciation: 'dbang', gloss: 'power, sovereignty' },
                  { text: 'ཕྱུག', type: 'semantic', pronunciation: 'phyug', gloss: 'rich, abundant — together དབང་ཕྱུག = "sovereign" = *īśvara*' },
                ],
              },
              pronunciation: 'AHR-yah-vah-loh-kee-TAYSH-vah-roh',
              etymology: '*ārya* "noble" + *avalokita* "looking down" + *īśvara* "lord"',
              gloss: 'the Noble Lord Avalokiteśvara — the bodhisattva of compassion',
              citations: [wikipediaCitation('Avalokiteśvara')],
              morphemes: [
                { text: 'Ārya', type: 'prefix', gloss: 'noble — an honourific', pronunciation: 'AHR-yah', citations: [wikipediaCitation('Ārya')] },
                { text: 'āvalokit', type: 'stem', gloss: 'one who looks down (with compassion) on the world', pronunciation: 'ah-vah-loh-KEET' },
                { text: 'eśvaro', type: 'suffix', gloss: 'lord — the title-ending', pronunciation: 'AYSH-vah-roh' },
              ],
            },
            {
              form: 'bodhisattvo',
              scriptAlt: 'बोधिसत्त्वो',
              scriptAlts: { 'zh-Hant': '菩薩', 'ja-Jpan': '菩薩', 'bo-Tibt': 'བྱང་ཆུབ་སེམས་དཔའ' },
              scriptMorphemes: {
                'zh-Hant': [
                  { text: '菩', type: 'phonetic', pronunciation: 'pú', gloss: 'phonetic: transliterates "bo-" (from 菩提 *bodhi*)' },
                  { text: '薩', type: 'phonetic', pronunciation: 'sà', gloss: 'phonetic: transliterates "-(sa)ttva" (from 薩埵 *sattva*); 菩薩 abbreviates 菩提薩埵' },
                ],
                'ja-Jpan': [
                  { text: '菩', type: 'phonetic', pronunciation: 'bo', gloss: 'phonetic: transliterates "bo-" (*bodhi*)' },
                  { text: '薩', type: 'phonetic', pronunciation: 'satsu', gloss: 'phonetic: transliterates "-(sa)ttva"; 菩薩 (*bosatsu*) abbreviates 菩提薩埵' },
                ],
                'bo-Tibt': [
                  { text: 'བྱང་', type: 'semantic', pronunciation: 'byang', gloss: 'purified, cleansed' },
                  { text: 'ཆུབ་', type: 'semantic', pronunciation: 'chub', gloss: 'perfected — together བྱང་ཆུབ = "fully purified" = *bodhi* (awakening)' },
                  { text: 'སེམས་', type: 'semantic', pronunciation: 'sems', gloss: 'mind' },
                  { text: 'དཔའ', type: 'semantic', pronunciation: "dpa'", gloss: 'hero — together སེམས་དཔའ = "mind-hero" = *sattva* (an awakening-being)' },
                ],
              },
              pronunciation: 'boh-dee-SAHT-voh',
              etymology: '*bodhi* "awakening" + *sattva* "being"',
              gloss: 'awakening-being; one bound for full awakening but staying to liberate others',
              citations: [wikipediaCitation('Bodhisattva')],
              morphemes: [
                { text: 'bodhi', type: 'stem', root: '√budh', gloss: 'awakening, enlightenment', pronunciation: 'BOH-dee' },
                { text: 'sattvo', type: 'suffix', gloss: 'being, sentient one', pronunciation: 'SAHT-voh' },
              ],
            },
          ],
        },

        // ── 行深般若波羅蜜多時 — going deep into transcendent wisdom ──
        {
          id: 'opening-practice',
          pali: 'gambhīrāṃ prajñāpāramitācaryāṃ caramāṇo',
          paliDeva: 'गम्भीरां प्रज्ञापारमिताचर्यां चरमाणो',
          scripts: [
            { lang: 'sa-Latn', label: 'Sanskrit (IAST)', text: 'gambhīrāṃ prajñāpāramitācaryāṃ caramāṇo' },
            {
              lang: 'sa-Deva',
              label: 'Sanskrit (Devanāgarī)',
              text: 'गम्भीरां प्रज्ञापारमिताचर्यां चरमाणो',
              transliteration: 'gambhīrāṃ prajñāpāramitācaryāṃ caramāṇo',
            },
            {
              lang: 'zh-Hant',
              label: 'Chinese (Xuanzang)',
              text: '行深般若波羅蜜多時',
              source: 'T251',
              tokens: ['行', '深', '般若', '波羅蜜多', '時'],
              transliteration: 'xíng  shēn  bō-rě  bō-luó-mì-duō  shí  (Mandarin pinyin)',
            },
            {
              lang: 'ja-Jpan',
              label: 'Japanese (Sino-Japanese)',
              text: '行深般若波羅蜜多時',
              source: 'Hannya Shingyō',
              tokens: ['行', '深', '般若', '波羅蜜多', '時'],
              transliteration: 'gyō jin hannya haramita ji  (Sino-Japanese kanbun-yomi)',
            },
            {
              lang: 'bo-Tibt',
              label: 'Tibetan',
              text: 'ཟབ་མོ་ཤེས་རབ་ཀྱི་ཕ་རོལ་ཏུ་ཕྱིན་པའི་སྤྱོད་པ་ལ་སྤྱོད་པ་ན',
              source: 'Kangyur',
              transliteration: "zab-mo she-rab kyi pa-rol-tu chin-pé chö-pa la chö-pa na  (Lhasa Tibetan)",
              tokens: ['ཟབ་མོ', 'ཤེས་རབ', 'ཀྱི', 'ཕ་རོལ་ཏུ་ཕྱིན་པ', 'འི', 'སྤྱོད་པ', 'ལ', 'སྤྱོད་པ', 'ན'],
            },
          ],
          witnesses: [
            {
              by: 'MAPLE chant sheet (after Sheng-yen)',
              text: 'while going deep into transcendent wisdom,',
              alignTo: [-1, 2, 0, -1, 1, 1],
              license: 'MAPLE community chant sheet, adapted from Master Sheng-yen\'s translation',
            },
            {
              by: 'Conze (1958)',
              text: 'was moving in the deep course of the Wisdom which has gone beyond.',
              alignTo: [-1, 2, -1, -1, 0, 2, -1, -1, 1, -1, -1, 1, 1],
              url: 'https://en.wikipedia.org/wiki/Heart_Sutra',
            },
            {
              by: 'Red Pine (2004)',
              text: 'while practising the deep practice of Prajñāpāramitā,',
              alignTo: [-1, 2, -1, 0, 2, -1, 1],
              url: 'https://www.counterpointpress.com/dd-product/the-heart-sutra/',
              license: 'Quoted with attribution',
            },
            {
              by: 'Thich Nhat Hanh (2014)',
              text: 'while practising deeply the Perfection of Understanding,',
              alignTo: [-1, 2, 0, -1, 1, -1, 1],
              url: 'https://plumvillage.org/sutra/the-other-shore',
              license: 'Plum Village translation, quoted with attribution',
            },
          ],
          words: [
            {
              form: 'gambhīrāṃ',
              scriptAlt: 'गम्भीरां',
              scriptAlts: { 'zh-Hant': '深', 'ja-Jpan': '深', 'bo-Tibt': 'ཟབ་མོ' },
              scriptMorphemes: {
                'bo-Tibt': [
                  { text: 'ཟབ་', type: 'semantic', pronunciation: 'zab', gloss: 'deep, profound' },
                  { text: 'མོ', type: 'semantic', pronunciation: 'mo', gloss: 'feminine suffix — *gambhīrāṃ* is grammatically feminine, agreeing with *caryāṃ*' },
                ],
              },
              pronunciation: 'gahm-BHEE-rahm',
              etymology: 'Sanskrit *gambhīra* — "deep, profound"',
              gloss: 'deep, profound — qualifying the practice as not surface-level',
              conceptIds: ['concept.deep-gambhira'],
            },
            {
              form: 'prajñāpāramitācaryāṃ',
              scriptAlt: 'प्रज्ञापारमिताचर्यां',
              scriptAlts: { 'zh-Hant': '般若', 'ja-Jpan': '般若', 'bo-Tibt': 'ཤེས་རབ' },
              scriptMorphemes: {
                'zh-Hant': [
                  { text: '般', type: 'phonetic', pronunciation: 'bān', gloss: 'phonetic: transliterates "pra-"; usual meaning ("kind of") unrelated' },
                  { text: '若', type: 'phonetic', pronunciation: 'ruò', gloss: 'phonetic: transliterates "-jñā"; usual meaning ("if, like") unrelated' },
                ],
                'ja-Jpan': [
                  { text: '般', type: 'phonetic', pronunciation: 'han', gloss: 'phonetic: transliterates "pra-" — read as "han" in 般若 (*hannya*)' },
                  { text: '若', type: 'phonetic', pronunciation: 'nya', gloss: 'phonetic: transliterates "-jñā" — read as "nya" in 般若' },
                ],
                'bo-Tibt': [
                  { text: 'ཤེས་', type: 'semantic', pronunciation: 'shes', gloss: 'to know, knowledge' },
                  { text: 'རབ', type: 'semantic', pronunciation: 'rab', gloss: 'supreme, excellent — together ཤེས་རབ = "supreme knowing" = *prajñā* (wisdom)' },
                ],
              },
              pronunciation: 'prahj-NYAH-pah-rah-mee-TAH-chahr-yahm',
              etymology: '*prajñā* "wisdom" + *pāramitā* "gone-beyond" + *caryā* "practice"',
              gloss: 'the practice of the perfection of wisdom — the activity that *is* this awakening',
              citations: [wikipediaCitation('Prajñāpāramitā')],
              morphemes: [
                { text: 'prajñā', type: 'stem', gloss: 'wisdom — the kind that sees how things actually are', pronunciation: 'prahj-NYAH', citations: [wikipediaCitation('Prajñā_(Buddhism)')], conceptIds: ['concept.wisdom-prajna'] },
                { text: 'pāramitā', type: 'stem', gloss: 'perfection — literally "gone-to-the-other-shore"', pronunciation: 'pah-rah-mee-TAH', citations: [wikipediaCitation('Pāramitā')], conceptIds: ['concept.perfection-paramita'] },
                { text: 'caryāṃ', type: 'suffix', gloss: 'the practice (of [...])', pronunciation: 'chahr-YAHM', conceptIds: ['concept.practice-carya'] },
              ],
            },
            {
              form: 'pāramitā',
              scriptAlt: 'पारमिता',
              scriptAlts: { 'zh-Hant': '波羅蜜多', 'ja-Jpan': '波羅蜜多', 'bo-Tibt': 'ཕ་རོལ་ཏུ་ཕྱིན་པ' },
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
                'bo-Tibt': [
                  { text: 'ཕ་', type: 'semantic', pronunciation: 'pha', gloss: 'the far' },
                  { text: 'རོལ་', type: 'semantic', pronunciation: 'rol', gloss: 'shore, side — together ཕ་རོལ = "the other shore" (= Sanskrit *pāram*)' },
                  { text: 'ཏུ་', type: 'semantic', pronunciation: 'tu', gloss: 'to, towards — directional particle' },
                  { text: 'ཕྱིན་', type: 'semantic', pronunciation: 'phyin', gloss: 'gone (past) — together ཕྱིན་པ = "having gone" (= Sanskrit *itā*)' },
                  { text: 'པ', type: 'semantic', pronunciation: 'pa', gloss: 'nominaliser — turns the verb into a noun-phrase' },
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
              form: 'caramāṇo',
              scriptAlt: 'चरमाणो',
              scriptAlts: { 'zh-Hant': '行', 'ja-Jpan': '行', 'bo-Tibt': 'སྤྱོད་པ' },
              pronunciation: 'chah-rah-MAH-noh',
              etymology: '√car "to move, practise" + middle present participle',
              gloss: 'practising, moving in — the bodhisattva is *doing* this, not just thinking it',
              morphemes: [
                { text: 'cara', type: 'root', root: '√car', gloss: 'to move, walk, practise', pronunciation: 'CHAH-rah', conceptIds: ['concept.practice-carya'] },
                { text: 'māṇo', type: 'suffix', gloss: 'middle present participle — the one doing [the moving] for themselves', pronunciation: 'MAH-noh' },
              ],
            },
          ],
        },

        // ── 照見五蘊皆空 度一切苦厄 — saw five skandhas empty; overcame all suffering ──
        {
          id: 'opening-seeing',
          pali: 'vyavalokayati sma: pañca skandhāḥ tāṃś ca svabhāvaśūnyān paśyati sma.',
          paliDeva: 'व्यवलोकयति स्म: पञ्च स्कन्धास्तांश्च स्वभावशून्यान्पश्यति स्म॥',
          scripts: [
            { lang: 'sa-Latn', label: 'Sanskrit (IAST)', text: 'vyavalokayati sma: pañca skandhāḥ tāṃś ca svabhāvaśūnyān paśyati sma.' },
            {
              lang: 'sa-Deva',
              label: 'Sanskrit (Devanāgarī)',
              text: 'व्यवलोकयति स्म: पञ्च स्कन्धास्तांश्च स्वभावशून्यान्पश्यति स्म॥',
              transliteration: 'vyavalokayati sma: pañca skandhāḥ tāṃś ca svabhāvaśūnyān paśyati sma.',
            },
            {
              lang: 'zh-Hant',
              label: 'Chinese (Xuanzang)',
              text: '照見五蘊皆空 度一切苦厄',
              source: 'T251 (the 度一切苦厄 line is Xuanzang\'s addition, not in canonical Sanskrit)',
              tokens: ['照見', '五', '蘊', '皆', '空', '度', '一切', '苦厄'],
              transliteration: 'zhào-jiàn  wǔ  yùn  jiē  kōng  ·  dù  yī-qiè  kǔ-è  (Mandarin pinyin)',
            },
            {
              lang: 'ja-Jpan',
              label: 'Japanese (Sino-Japanese)',
              text: '照見五蘊皆空 度一切苦厄',
              source: 'Hannya Shingyō',
              tokens: ['照見', '五', '蘊', '皆', '空', '度', '一切', '苦厄'],
              transliteration: 'shōken go un kai kū  ·  do issai ku yaku  (Sino-Japanese kanbun-yomi)',
            },
            {
              lang: 'bo-Tibt',
              label: 'Tibetan',
              text: 'ཕུང་པོ་ལྔ་པོ་དེ་དག་ལ་ཡང་རང་བཞིན་གྱིས་སྟོང་པར་རྣམ་པར་བལྟའོ།',
              source: 'Kangyur (Tibetan omits Xuanzang\'s 度一切苦厄 addition — follows Sanskrit)',
              transliteration: "phung-po nga-po dé-dak la yang  rang-zhin gyi tong-par nam-par ta'o.  (Lhasa Tibetan)",
              tokens: ['ཕུང་པོ', 'ལྔ་པོ', 'དེ་དག', 'ལ', 'ཡང', 'རང་བཞིན', 'གྱིས', 'སྟོང་པར', 'རྣམ་པར་བལྟའོ'],
            },
          ],
          witnesses: [
            {
              by: 'MAPLE chant sheet (after Sheng-yen)',
              text: 'clearly saw that all five skandhas are empty, and overcame all suffering.',
              alignTo: [0, 7, -1, -1, 2, 3, -1, 6, -1, -1, -1, -1],
              license: 'MAPLE community chant sheet, adapted from Master Sheng-yen\'s translation',
            },
            {
              by: 'Conze (1958)',
              text: 'He looked down from on high, He beheld but five heaps, and He saw that in their own-being they were empty.',
              alignTo: [-1, 0, 0, -1, -1, -1, -1, 0, -1, 2, 3, -1, -1, 7, -1, -1, -1, 6, -1, -1, 6],
              url: 'https://en.wikipedia.org/wiki/Heart_Sutra',
            },
            {
              by: 'Red Pine (2004)',
              text: 'looked upon the five skandhas and seeing they were empty of self-existence …',
              alignTo: [0, -1, -1, 2, 3, -1, 7, -1, -1, 6, -1, 6, -1],
              url: 'https://www.counterpointpress.com/dd-product/the-heart-sutra/',
              license: 'Quoted with attribution',
            },
            {
              by: 'Thich Nhat Hanh (2014)',
              text: 'suddenly discovered that all of the five Skandhas are equally empty …',
              alignTo: [-1, 7, -1, -1, -1, -1, 2, 3, -1, -1, 6, -1],
              url: 'https://plumvillage.org/sutra/the-other-shore',
              license: 'Plum Village translation, quoted with attribution',
            },
          ],
          words: [
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
                { text: 'vy', type: 'prefix', gloss: 'thorough, distinguishing', pronunciation: 'vy' },
                { text: 'avalok', type: 'stem', gloss: 'look down upon (with attention)', pronunciation: 'ah-vah-LOHK' },
                { text: 'ayati', type: 'suffix', gloss: 'present-tense 3rd-person — "he/she examines"', pronunciation: 'ah-YAH-tee' },
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
              scriptAlts: { 'zh-Hant': '五', 'ja-Jpan': '五', 'bo-Tibt': 'ལྔ' },
              pronunciation: 'PAHN-chah',
              etymology: 'Sanskrit *pañca* — "five"',
              gloss: 'five',
            },
            {
              form: 'skandhāḥ',
              scriptAlt: 'स्कन्धाः',
              scriptAlts: { 'zh-Hant': '蘊', 'ja-Jpan': '蘊', 'bo-Tibt': 'ཕུང་པོ' },
              scriptMorphemes: {
                'bo-Tibt': [
                  { text: 'ཕུང་', type: 'semantic', pronunciation: 'phung', gloss: 'heap, mass — the literal "aggregate"' },
                  { text: 'པོ', type: 'semantic', pronunciation: 'po', gloss: 'nominal/masculine suffix' },
                ],
              },
              pronunciation: 'SKAHN-dhah-h',
              etymology: 'Sanskrit *skandha* — literally "heap, aggregate"',
              gloss: 'the five aggregates that compose experience: form, feeling, perception, mental formations, consciousness',
              citations: [wikipediaCitation('Skandha')],
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
              form: 'svabhāvaśūnyān',
              scriptAlt: 'स्वभावशून्यान्',
              scriptAlts: { 'zh-Hant': '空', 'ja-Jpan': '空', 'bo-Tibt': 'རང་བཞིན' },
              scriptMorphemes: {
                'bo-Tibt': [
                  { text: 'རང་', type: 'semantic', pronunciation: 'rang', gloss: 'self, own' },
                  { text: 'བཞིན', type: 'semantic', pronunciation: 'bzhin', gloss: 'nature, manner — together རང་བཞིན = "self-nature" = *svabhāva* (own-being)' },
                ],
              },
              pronunciation: 'svah-BAH-vah-SHOON-yahn',
              etymology: '*svabhāva* "own-being" + *śūnya* "empty"',
              gloss: 'empty of own-being — having no fixed, inherent self-existence',
              accent: 'sky',
              morphemes: [
                { text: 'sva', type: 'prefix', gloss: 'self, own', pronunciation: 'svah' },
                { text: 'bhāva', type: 'stem', gloss: 'being, nature', pronunciation: 'BAH-vah' },
                { text: 'śūnyān', type: 'suffix', gloss: 'empty (of) — qualifying the aggregates', pronunciation: 'SHOON-yahn', citations: [wikipediaCitation('Śūnyatā')] },
              ],
            },
            {
              form: 'paśyati',
              scriptAlt: 'पश्यति',
              pronunciation: 'PAHSH-yah-tee',
              etymology: '√paś / √dṛś "to see"',
              gloss: 'sees — the second seeing-verb, after *vyavalokayati*: he looks, and then he sees',
              morphemes: [
                { text: 'paś', type: 'root', root: '√paś', gloss: 'to see — the present-stem of √dṛś', pronunciation: 'PAHSH' },
                { text: 'yati', type: 'suffix', gloss: 'present-tense 3rd-person', pronunciation: 'YAH-tee' },
              ],
            },
            {
              form: 'sma',
              scriptAlt: 'स्म',
              pronunciation: 'smah',
              etymology: 'Sanskrit particle',
              gloss: '*sma* — the past-tense flavour particle, repeated to bracket both verbs',
            },
          ],
          note: 'Xuanzang appends a fifth Chinese line — 度一切苦厄 *dù yī-qiè kǔ-è*, "and overcame all suffering" — that has no Sanskrit original. It became canonical in East Asian recitation. The Tibetan and Sanskrit traditions don\'t include it. AI\'s witness preserves it; Conze, Red Pine, and Thich Nhat Hanh follow the Sanskrit and end at "empty."',
        },

        // ══════════════════════════════════════════════════════════════
        // FORM-EMPTINESS — the canonical chiastic quatrain
        // Chant order: 色不異空 · 空不異色 · 色即是空 · 空即是色
        // ══════════════════════════════════════════════════════════════

        // ── 色不異空 — Form is not different from emptiness ──
        {
          id: 'form-not-different-emptiness',
          pali: 'Rūpān na pṛthak śūnyatā',
          paliDeva: 'रूपान्न पृथक्शून्यता',
          scripts: [
            { lang: 'sa-Latn', label: 'Sanskrit (IAST)', text: 'Rūpān na pṛthak śūnyatā' },
            {
              lang: 'sa-Deva',
              label: 'Sanskrit (Devanāgarī)',
              text: 'रूपान्न पृथक्शून्यता',
              transliteration: 'Rūpān na pṛthak śūnyatā',
            },
            {
              lang: 'zh-Hant',
              label: 'Chinese (Xuanzang)',
              text: '色不異空',
              source: 'T251',
              tokens: ['色', '不', '異', '空'],
              transliteration: 'sè bù yì kōng  (Mandarin pinyin)',
            },
            {
              lang: 'ja-Jpan',
              label: 'Japanese (Sino-Japanese)',
              text: '色不異空',
              source: 'Hannya Shingyō',
              tokens: ['色', '不', '異', '空'],
              transliteration: 'shiki fu i kū  (Sino-Japanese)',
            },
            {
              lang: 'bo-Tibt',
              label: 'Tibetan',
              text: 'གཟུགས་ལས་སྟོང་པ་ཉིད་གཞན་མ་ཡིན།',
              source: 'Kangyur',
              transliteration: "zuk lé tong-pa-nyi shen ma yin  (Lhasa Tibetan)",
              tokens: ['གཟུགས', 'ལས', 'སྟོང་པ་ཉིད', 'གཞན', 'མ', 'ཡིན'],
            },
          ],
          witnesses: [
            {
              by: 'MAPLE chant sheet (after Sheng-yen)',
              text: 'Śāriputra, appearance is not different from emptiness.',
              alignTo: [-1, 0, -1, 1, 2, -1, 3],
              license: 'MAPLE community chant sheet, adapted from Master Sheng-yen\'s translation',
            },
            {
              by: 'Conze (1958)',
              text: 'Form does not differ from emptiness,',
              alignTo: [0, -1, 1, 2, -1, 3],
              url: 'https://en.wikipedia.org/wiki/Heart_Sutra',
            },
            {
              by: 'Red Pine (2004)',
              text: 'form is not separate from emptiness,',
              alignTo: [0, -1, 1, 2, -1, 3],
              url: 'https://www.counterpointpress.com/dd-product/the-heart-sutra/',
              license: 'Quoted with attribution',
            },
            {
              by: 'Thich Nhat Hanh (2014)',
              text: 'This Body is not other than Emptiness,',
              alignTo: [-1, 0, -1, 1, 2, 2, 3],
              url: 'https://plumvillage.org/sutra/the-other-shore',
              license: 'Plum Village translation, quoted with attribution',
            },
          ],
          words: [
            {
              form: 'Rūpān',
              scriptAlt: 'रूपान्',
              scriptAlts: { 'zh-Hant': '色', 'ja-Jpan': '色', 'bo-Tibt': 'གཟུགས' },
              pronunciation: 'ROO-pahn',
              etymology: '*rūpa* "form" + ablative ending',
              gloss: 'from form — "X is not different *from* form"',
              accent: 'amber',
              citations: [wikipediaCitation('Rūpa')],
            },
            {
              form: 'na',
              scriptAlt: 'न',
              scriptAlts: { 'zh-Hant': '不', 'ja-Jpan': '不', 'bo-Tibt': 'མ' },
              pronunciation: 'nah',
              etymology: 'Sanskrit negation particle',
              gloss: 'not',
            },
            {
              form: 'pṛthak',
              scriptAlt: 'पृथक्',
              scriptAlts: { 'zh-Hant': '異', 'ja-Jpan': '異', 'bo-Tibt': 'གཞན' },
              pronunciation: 'PRTH-ahk',
              etymology: 'Sanskrit *pṛthak* — "apart, separate, distinct"',
              gloss: 'separate, distinct (from)',
            },
            {
              form: 'śūnyatā',
              scriptAlt: 'शून्यता',
              scriptAlts: { 'zh-Hant': '空', 'ja-Jpan': '空', 'bo-Tibt': 'སྟོང་པ' },
              scriptMorphemes: {
                'bo-Tibt': [
                  { text: 'སྟོང་', type: 'semantic', pronunciation: 'stong', gloss: 'empty, void' },
                  { text: 'པ', type: 'semantic', pronunciation: 'pa', gloss: 'nominaliser — turns "empty" into "an empty thing"' },
                ],
              },
              pronunciation: 'SHOON-yah-TAH',
              etymology: '*śūnya* "empty" + abstract noun suffix *-tā*',
              gloss: 'emptiness — not nothingness, but absence of inherent existence; the dependently-arisen nature of all things',
              accent: 'sky',
              citations: [wikipediaCitation('Śūnyatā')],
              morphemes: [
                { text: 'śūnya', type: 'stem', gloss: 'empty, void', pronunciation: 'SHOON-yah' },
                { text: 'tā', type: 'suffix', gloss: 'turns "empty" into "emptiness" — the abstract quality', pronunciation: 'TAH' },
              ],
            },
          ],
        },

        // ── 空不異色 — Emptiness is not different from form ──
        {
          id: 'emptiness-not-different-form',
          pali: 'śūnyatāyā na pṛthag rūpaṃ.',
          paliDeva: 'शून्यताया न पृथग्रूपम्।',
          scripts: [
            { lang: 'sa-Latn', label: 'Sanskrit (IAST)', text: 'śūnyatāyā na pṛthag rūpaṃ.' },
            {
              lang: 'sa-Deva',
              label: 'Sanskrit (Devanāgarī)',
              text: 'शून्यताया न पृथग्रूपम्।',
              transliteration: 'śūnyatāyā na pṛthag rūpaṃ.',
            },
            {
              lang: 'zh-Hant',
              label: 'Chinese (Xuanzang)',
              text: '空不異色',
              source: 'T251',
              tokens: ['空', '不', '異', '色'],
              transliteration: 'kōng bù yì sè  (Mandarin pinyin)',
            },
            {
              lang: 'ja-Jpan',
              label: 'Japanese (Sino-Japanese)',
              text: '空不異色',
              source: 'Hannya Shingyō',
              tokens: ['空', '不', '異', '色'],
              transliteration: 'kū fu i shiki  (Sino-Japanese)',
            },
            {
              lang: 'bo-Tibt',
              label: 'Tibetan',
              text: 'སྟོང་པ་ཉིད་ལས་ཀྱང་གཟུགས་གཞན་མ་ཡིན།',
              source: 'Kangyur',
              transliteration: "tong-pa-nyi lé kyang zuk shen ma yin  (Lhasa Tibetan)",
              tokens: ['སྟོང་པ་ཉིད', 'ལས', 'ཀྱང', 'གཟུགས', 'གཞན', 'མ', 'ཡིན'],
            },
          ],
          witnesses: [
            {
              by: 'MAPLE chant sheet (after Sheng-yen)',
              text: 'Emptiness is not different from appearance.',
              alignTo: [0, -1, 1, 2, -1, 3],
              license: 'MAPLE community chant sheet, adapted from Master Sheng-yen\'s translation',
            },
            {
              by: 'Conze (1958)',
              text: 'emptiness does not differ from form.',
              alignTo: [0, -1, 1, 2, -1, 3],
              url: 'https://en.wikipedia.org/wiki/Heart_Sutra',
            },
            {
              by: 'Red Pine (2004)',
              text: 'emptiness is not separate from form;',
              alignTo: [0, -1, 1, 2, -1, 3],
              url: 'https://www.counterpointpress.com/dd-product/the-heart-sutra/',
              license: 'Quoted with attribution',
            },
            {
              by: 'Thich Nhat Hanh (2014)',
              text: 'and Emptiness is not other than this Body.',
              alignTo: [-1, 0, -1, 1, 2, 2, -1, 3],
              url: 'https://plumvillage.org/sutra/the-other-shore',
              license: 'Plum Village translation, quoted with attribution',
            },
          ],
          words: [
            {
              form: 'śūnyatāyā',
              scriptAlt: 'शून्यताया',
              scriptAlts: { 'zh-Hant': '空', 'ja-Jpan': '空', 'bo-Tibt': 'སྟོང་པ' },
              pronunciation: 'SHOON-yah-TAH-yah',
              etymology: '*śūnyatā* "emptiness" + ablative ending',
              gloss: 'from emptiness — "X is not different from *emptiness*"',
              accent: 'sky',
            },
            {
              form: 'na',
              scriptAlt: 'न',
              scriptAlts: { 'zh-Hant': '不', 'ja-Jpan': '不', 'bo-Tibt': 'མ' },
              pronunciation: 'nah',
              etymology: 'Sanskrit negation particle',
              gloss: 'not',
            },
            {
              form: 'pṛthag',
              scriptAlt: 'पृथग्',
              scriptAlts: { 'zh-Hant': '異', 'ja-Jpan': '異', 'bo-Tibt': 'གཞན' },
              pronunciation: 'PRTH-ahg',
              etymology: 'Sandhi variant of *pṛthak* before voiced consonants',
              gloss: 'separate, distinct (from) — same word as pṛthak, different sandhi form',
            },
            {
              form: 'rūpaṃ',
              scriptAlt: 'रूपम्',
              scriptAlts: { 'zh-Hant': '色', 'ja-Jpan': '色', 'bo-Tibt': 'གཟུགས' },
              pronunciation: 'ROO-pahm',
              etymology: 'Sanskrit *rūpa* — "form, appearance, body"',
              gloss: 'form — visible/material appearance, the first skandha',
              accent: 'amber',
            },
          ],
        },

        // ── 色即是空 — Form itself is emptiness ──
        {
          id: 'form-is-emptiness',
          pali: 'Rūpaṃ śūnyatā · yad rūpaṃ sā śūnyatā,',
          paliDeva: 'रूपं शून्यता ॥ यद्रूपं सा शून्यता,',
          scripts: [
            { lang: 'sa-Latn', label: 'Sanskrit (IAST)', text: 'Rūpaṃ śūnyatā · yad rūpaṃ sā śūnyatā,' },
            {
              lang: 'sa-Deva',
              label: 'Sanskrit (Devanāgarī)',
              text: 'रूपं शून्यता ॥ यद्रूपं सा शून्यता,',
              transliteration: 'Rūpaṃ śūnyatā · yad rūpaṃ sā śūnyatā,',
            },
            {
              lang: 'zh-Hant',
              label: 'Chinese (Xuanzang)',
              text: '色即是空',
              source: 'T251',
              tokens: ['色', '即', '是', '空'],
              transliteration: 'sè jí shì kōng  (Mandarin pinyin)',
            },
            {
              lang: 'ja-Jpan',
              label: 'Japanese (Sino-Japanese)',
              text: '色即是空',
              source: 'Hannya Shingyō',
              tokens: ['色', '即', '是', '空'],
              transliteration: 'shiki soku ze kū  (Sino-Japanese)',
            },
            {
              lang: 'bo-Tibt',
              label: 'Tibetan',
              text: 'གཟུགས་སྟོང་པའོ།',
              source: 'Kangyur',
              transliteration: "zuk tong-pa'o  (Lhasa Tibetan)",
              tokens: ['གཟུགས', 'སྟོང་པ', 'འོ'],
            },
          ],
          witnesses: [
            {
              by: 'MAPLE chant sheet (after Sheng-yen)',
              text: 'Appearance itself is emptiness.',
              alignTo: [0, -1, -1, 1],
              license: 'MAPLE community chant sheet, adapted from Master Sheng-yen\'s translation',
            },
            {
              by: 'Conze (1958)',
              text: 'Form is emptiness; whatever is form, that is emptiness;',
              alignTo: [0, -1, 1, 2, -1, 3, 4, -1, 5],
              url: 'https://en.wikipedia.org/wiki/Heart_Sutra',
            },
            {
              by: 'Red Pine (2004)',
              text: 'form is emptiness — whatever is form is emptiness,',
              alignTo: [0, -1, 1, -1, 2, -1, 3, -1, 5],
              url: 'https://www.counterpointpress.com/dd-product/the-heart-sutra/',
              license: 'Quoted with attribution',
            },
            {
              by: 'Thich Nhat Hanh (2014)',
              text: 'This Body itself is Emptiness,',
              alignTo: [-1, 0, -1, -1, 1],
              url: 'https://plumvillage.org/sutra/the-other-shore',
              license: 'Plum Village translation, quoted with attribution',
            },
          ],
          words: [
            {
              form: 'Rūpaṃ',
              scriptAlt: 'रूपम्',
              scriptAlts: { 'zh-Hant': '色', 'ja-Jpan': '色', 'bo-Tibt': 'གཟུགས' },
              pronunciation: 'ROO-pahm',
              etymology: 'Sanskrit *rūpa* — "form, appearance, body"',
              gloss: 'form — visible/material appearance, the first skandha',
              accent: 'amber',
            },
            {
              form: 'śūnyatā',
              scriptAlt: 'शून्यता',
              scriptAlts: { 'zh-Hant': '空', 'ja-Jpan': '空', 'bo-Tibt': 'སྟོང་པ' },
              pronunciation: 'SHOON-yah-TAH',
              etymology: '*śūnya* "empty" + abstract noun suffix *-tā*',
              gloss: 'emptiness',
              accent: 'sky',
            },
            {
              form: 'yad',
              scriptAlt: 'यद्',
              pronunciation: 'yahd',
              etymology: 'Sanskrit relative pronoun *yad* (neuter)',
              gloss: 'what, whatever — opens the "whatever is form, that is emptiness" relative clause',
            },
            {
              form: 'rūpaṃ',
              scriptAlt: 'रूपम्',
              scriptAlts: { 'zh-Hant': '色', 'ja-Jpan': '色', 'bo-Tibt': 'གཟུགས' },
              pronunciation: 'ROO-pahm',
              etymology: 'Sanskrit *rūpa* — "form"',
              gloss: 'form — the relative-clause echo of the opening *rūpaṃ*',
              accent: 'amber',
            },
            {
              form: 'sā',
              scriptAlt: 'सा',
              pronunciation: 'sah',
              etymology: 'Sanskrit demonstrative pronoun *sā* (feminine)',
              gloss: 'that (feminine) — the demonstrative answering the relative *yā*',
            },
            {
              form: 'śūnyatā',
              scriptAlt: 'शून्यता',
              scriptAlts: { 'zh-Hant': '空', 'ja-Jpan': '空', 'bo-Tibt': 'སྟོང་པ' },
              pronunciation: 'SHOON-yah-TAH',
              etymology: '*śūnya* "empty" + abstract noun suffix *-tā*',
              gloss: 'emptiness — the answering term',
              accent: 'sky',
            },
          ],
        },

        // ── 空即是色 — Emptiness itself is form ──
        {
          id: 'emptiness-is-form',
          pali: 'śūnyataiva rūpaṃ · yā śūnyatā tad rūpaṃ.',
          paliDeva: 'शून्यतैव रूपम् ॥ या शून्यता तद्रूपम्॥',
          scripts: [
            { lang: 'sa-Latn', label: 'Sanskrit (IAST)', text: 'śūnyataiva rūpaṃ · yā śūnyatā tad rūpaṃ.' },
            {
              lang: 'sa-Deva',
              label: 'Sanskrit (Devanāgarī)',
              text: 'शून्यतैव रूपम् ॥ या शून्यता तद्रूपम्॥',
              transliteration: 'śūnyataiva rūpaṃ · yā śūnyatā tad rūpaṃ.',
            },
            {
              lang: 'zh-Hant',
              label: 'Chinese (Xuanzang)',
              text: '空即是色',
              source: 'T251',
              tokens: ['空', '即', '是', '色'],
              transliteration: 'kōng jí shì sè  (Mandarin pinyin)',
            },
            {
              lang: 'ja-Jpan',
              label: 'Japanese (Sino-Japanese)',
              text: '空即是色',
              source: 'Hannya Shingyō',
              tokens: ['空', '即', '是', '色'],
              transliteration: 'kū soku ze shiki  (Sino-Japanese)',
            },
            {
              lang: 'bo-Tibt',
              label: 'Tibetan',
              text: 'སྟོང་པ་ཉིད་གཟུགས་སོ།',
              source: 'Kangyur',
              transliteration: "tong-pa-nyi zuk so  (Lhasa Tibetan)",
              tokens: ['སྟོང་པ་ཉིད', 'གཟུགས', 'སོ'],
            },
          ],
          witnesses: [
            {
              by: 'MAPLE chant sheet (after Sheng-yen)',
              text: 'Emptiness itself is appearance. So also are preference, information, patterning and consciousness.',
              alignTo: [0, -1, -1, 1, -1, -1, -1, -1, -1, -1, -1, -1],
              license: 'MAPLE community chant sheet, adapted from Master Sheng-yen\'s translation',
            },
            {
              by: 'Conze (1958)',
              text: 'whatever is emptiness, that is form.',
              alignTo: [2, -1, 3, 4, -1, 5],
              url: 'https://en.wikipedia.org/wiki/Heart_Sutra',
            },
            {
              by: 'Red Pine (2004)',
              text: 'whatever is emptiness is form.',
              alignTo: [2, -1, 3, -1, 5],
              url: 'https://www.counterpointpress.com/dd-product/the-heart-sutra/',
              license: 'Quoted with attribution',
            },
            {
              by: 'Thich Nhat Hanh (2014)',
              text: 'and Emptiness itself is this Body.',
              alignTo: [-1, 0, -1, -1, -1, 1],
              url: 'https://plumvillage.org/sutra/the-other-shore',
              license: 'Plum Village translation, quoted with attribution',
            },
          ],
          words: [
            {
              form: 'śūnyataiva',
              scriptAlt: 'शून्यतैव',
              scriptAlts: { 'zh-Hant': '空', 'ja-Jpan': '空', 'bo-Tibt': 'སྟོང་པ' },
              pronunciation: 'SHOON-yah-TIE-vah',
              etymology: '*śūnyatā* + *eva* (intensifier)',
              gloss: 'emptiness itself — the emphatic "the very emptiness"',
              accent: 'sky',
            },
            {
              form: 'rūpaṃ',
              scriptAlt: 'रूपम्',
              scriptAlts: { 'zh-Hant': '色', 'ja-Jpan': '色', 'bo-Tibt': 'གཟུགས' },
              pronunciation: 'ROO-pahm',
              etymology: 'Sanskrit *rūpa* — "form"',
              gloss: 'form',
              accent: 'amber',
            },
            {
              form: 'yā',
              scriptAlt: 'या',
              pronunciation: 'yah',
              etymology: 'Sanskrit relative pronoun *yā* (feminine)',
              gloss: 'whatever (feminine) — agrees with the feminine noun *śūnyatā*',
            },
            {
              form: 'śūnyatā',
              scriptAlt: 'शून्यता',
              scriptAlts: { 'zh-Hant': '空', 'ja-Jpan': '空', 'bo-Tibt': 'སྟོང་པ' },
              pronunciation: 'SHOON-yah-TAH',
              etymology: '*śūnya* "empty" + abstract noun suffix *-tā*',
              gloss: 'emptiness',
              accent: 'sky',
            },
            {
              form: 'tad',
              scriptAlt: 'तद्',
              pronunciation: 'tahd',
              etymology: 'Sanskrit demonstrative pronoun *tad* (neuter)',
              gloss: 'that (neuter) — agrees with the neuter noun *rūpaṃ*',
            },
            {
              form: 'rūpaṃ',
              scriptAlt: 'रूपम्',
              scriptAlts: { 'zh-Hant': '色', 'ja-Jpan': '色', 'bo-Tibt': 'གཟུགས' },
              pronunciation: 'ROO-pahm',
              etymology: 'Sanskrit *rūpa* — "form"',
              gloss: 'form — the closing term of the chiasmus',
              accent: 'amber',
            },
          ],
          note: 'The mathematical centre of the sutra, now visible as four breaths instead of one paragraph. The Chinese fuses the two relations 即是 ("just-is") with no copula gap, no preposition — sharper than any English. The MAPLE chant extends past the Sanskrit to the other skandhas ("preference, information, patterning, consciousness"), naming what the sutra elaborates next.',
        },
      ],
    },

    // ─────────────────────────────────────────────────────────────────────
    // 2b. MAPLE prose — Śāriputra, all dharmas are characterized by emptiness
    // ─────────────────────────────────────────────────────────────────────
    {
      id: 'maple-all-dharmas',
      shape: 'prose-commentary',
      body: 'Śāriputra, all dharmas are characterized by emptiness that does not arise, is not destroyed, is not defiled, is not pure, does not increase, does not decrease.\n\n*MAPLE chant text. Chinese: 舍利子 是諸法空相 不生不滅 不垢不淨 不增不減 — the "six negations" passage. Not yet broken into per-line segments in this reader.*',
    },

    // ─────────────────────────────────────────────────────────────────────
    // 2c. MAPLE prose — Therefore in emptiness, the long enumeration
    // ─────────────────────────────────────────────────────────────────────
    {
      id: 'maple-no-eye-no-ear',
      shape: 'prose-commentary',
      body: 'Therefore, in emptiness there is no appearance. There is no preference, information, patterning or consciousness; no eye, ear, nose, tongue, body, or mind; no sight, sound, smell, taste, touch, or thought; there is no realm of the eye, through to no realm of mental cognition; there is no ignorance and no end of ignorance, through to no aging and death and no end of aging and death; there is no suffering, no arising, no cessation, and no path; there is no attainment and no realization — by practicing no apprehension.\n\n*MAPLE chant text. Chinese: 是故空中無色 無受想行識 無眼耳鼻舌身意 無色聲香味觸法 無眼界 乃至無意識界 無無明 亦無無明盡 乃至無老死 亦無老死盡 無苦集滅道 無智亦無得 以無所得故 — emptying the five skandhas, six āyatanas, eighteen dhātus, twelve nidānas, and Four Noble Truths in turn.*',
    },

    // ─────────────────────────────────────────────────────────────────────
    // 2d. The result-section — no fear, ultimate nirvāṇa
    // ─────────────────────────────────────────────────────────────────────
    {
      id: 'heart-result',
      shape: 'triple-script-witness',
      segments: [

        // ══════════════════════════════════════════════════════════════
        // RESULT — no fear, nirvāṇa (one segment per Xuanzang chant-line)
        // ══════════════════════════════════════════════════════════════

        // ── 心無罣礙 — Mind has no obstruction ──
        {
          id: 'result-no-obstruction',
          pali: 'Cittāvaraṇa',
          paliDeva: 'चित्तावरण',
          scripts: [
            { lang: 'sa-Latn', label: 'Sanskrit (IAST)', text: 'Cittāvaraṇa-' },
            { lang: 'sa-Deva', label: 'Sanskrit (Devanāgarī)', text: 'चित्तावरण-', transliteration: 'Cittāvaraṇa-' },
            {
              lang: 'zh-Hant',
              label: 'Chinese (Xuanzang)',
              text: '心無罣礙',
              source: 'T251',
              tokens: ['心', '無', '罣礙'],
              transliteration: 'xīn wú guà-ài  (Mandarin pinyin)',
            },
            {
              lang: 'ja-Jpan',
              label: 'Japanese (Sino-Japanese)',
              text: '心無罣礙',
              source: 'Hannya Shingyō',
              tokens: ['心', '無', '罣礙'],
              transliteration: 'shin mu kege  (Sino-Japanese)',
            },
            {
              lang: 'bo-Tibt',
              label: 'Tibetan',
              text: 'སེམས་ལ་སྒྲིབ་པ་མེད་',
              source: 'Kangyur',
              transliteration: "sem la drib-pa mé  (Lhasa Tibetan)",
              tokens: ['སེམས', 'ལ', 'སྒྲིབ་པ', 'མེད'],
            },
          ],
          witnesses: [
            {
              by: 'MAPLE chant sheet (after Sheng-yen)',
              text: 'Bodhisatvas rely on transcendent wisdom and their minds have no obstruction;',
              alignTo: [-1, -1, -1, -1, -1, -1, -1, 0, -1, -1, 0],
              license: 'MAPLE community chant sheet, adapted from Master Sheng-yen\'s translation',
            },
            {
              by: 'Conze (1958)',
              text: 'With no mental obstructions,',
              alignTo: [-1, -1, 0, 0],
              url: 'https://en.wikipedia.org/wiki/Heart_Sutra',
            },
            {
              by: 'Red Pine (2004)',
              text: 'Without obstructions in their minds',
              alignTo: [-1, 0, -1, -1, 0],
              url: 'https://www.counterpointpress.com/dd-product/the-heart-sutra/',
              license: 'Quoted with attribution',
            },
            {
              by: 'Thich Nhat Hanh (2014)',
              text: 'There are no more obstacles in their mind,',
              alignTo: [-1, -1, -1, -1, 0, -1, -1, 0],
              url: 'https://plumvillage.org/sutra/the-other-shore',
              license: 'Plum Village translation, quoted with attribution',
            },
          ],
          words: [
            {
              form: 'cittāvaraṇa',
              scriptAlt: 'चित्तावरण',
              scriptAlts: { 'zh-Hant': '罣礙', 'ja-Jpan': '罣礙', 'bo-Tibt': 'སྒྲིབ་པ' },
              scriptMorphemes: {
                'zh-Hant': [
                  { text: '罣', type: 'semantic', pronunciation: 'guà', gloss: 'snare, catch — obstruct in the sense of "caught on something"' },
                  { text: '礙', type: 'semantic', pronunciation: 'ài', gloss: 'block, hinder — paired doublet with 罣 for emphasis' },
                ],
                'ja-Jpan': [
                  { text: '罣', type: 'semantic', pronunciation: 'ke', gloss: 'snare, catch (read *ke* in 罣礙 *kege*)' },
                  { text: '礙', type: 'semantic', pronunciation: 'ge', gloss: 'block, hinder — doublet with 罣 = "obstruction"' },
                ],
                'bo-Tibt': [
                  { text: 'སྒྲིབ་', type: 'semantic', pronunciation: 'sgrib', gloss: 'to obstruct, to obscure (verb root)' },
                  { text: 'པ', type: 'semantic', pronunciation: 'pa', gloss: 'nominaliser — turns the verb into "obstruction"' },
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
          ],
        },

        // ── 無罣礙故 — Because of no obstruction ──
        {
          id: 'result-because-no-obstruction',
          pali: 'nāstitvād',
          paliDeva: 'नास्तित्वाद्',
          scripts: [
            { lang: 'sa-Latn', label: 'Sanskrit (IAST)', text: 'nāstitvād' },
            { lang: 'sa-Deva', label: 'Sanskrit (Devanāgarī)', text: 'नास्तित्वाद्', transliteration: 'nāstitvād' },
            {
              lang: 'zh-Hant',
              label: 'Chinese (Xuanzang)',
              text: '無罣礙故',
              source: 'T251',
              tokens: ['無', '罣礙', '故'],
              transliteration: 'wú guà-ài gù  (Mandarin pinyin)',
            },
            {
              lang: 'ja-Jpan',
              label: 'Japanese (Sino-Japanese)',
              text: '無罣礙故',
              source: 'Hannya Shingyō',
              tokens: ['無', '罣礙', '故'],
              transliteration: 'mu kege ko  (Sino-Japanese)',
            },
            {
              lang: 'bo-Tibt',
              label: 'Tibetan',
              text: 'པས་',
              source: 'Kangyur (the "because" particle absorbed into the preceding clause)',
              transliteration: "pé  (Lhasa Tibetan)",
              tokens: ['པས'],
            },
          ],
          witnesses: [
            {
              by: 'MAPLE chant sheet (after Sheng-yen)',
              text: 'with no obstruction',
              alignTo: [0, -1, 0],
              license: 'MAPLE community chant sheet, adapted from Master Sheng-yen\'s translation',
            },
            {
              by: 'Conze (1958)',
              text: '',
              alignTo: [],
              url: 'https://en.wikipedia.org/wiki/Heart_Sutra',
              license: 'Conze fuses this into the preceding clause — no separate fragment here',
            },
            {
              by: 'Red Pine (2004)',
              text: '',
              alignTo: [],
              url: 'https://www.counterpointpress.com/dd-product/the-heart-sutra/',
              license: 'Red Pine fuses this into the preceding clause',
            },
            {
              by: 'Thich Nhat Hanh (2014)',
              text: 'and because there are no more obstacles in their mind,',
              alignTo: [-1, 0, -1, -1, -1, -1, -1, -1, -1, -1],
              url: 'https://plumvillage.org/sutra/the-other-shore',
              license: 'Plum Village translation, quoted with attribution',
            },
          ],
          words: [
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
          ],
          note: 'Sanskrit binds *Cittāvaraṇa* and *nāstitvād* into a single compound — "because-of-the-absence-of-mental-obstruction." Xuanzang\'s Chinese splits this into two breaths, 心無罣礙 then 無罣礙故, repeating the obstruction word to underline the causal hinge. Conze and Red Pine fuse the two lines in English; Thich Nhat Hanh preserves both.',
        },

        // ── 無有恐怖 — No fear ──
        {
          id: 'result-no-fear',
          pali: 'atrasto',
          paliDeva: 'अत्रस्तो',
          scripts: [
            { lang: 'sa-Latn', label: 'Sanskrit (IAST)', text: 'atrasto' },
            { lang: 'sa-Deva', label: 'Sanskrit (Devanāgarī)', text: 'अत्रस्तो', transliteration: 'atrasto' },
            {
              lang: 'zh-Hant',
              label: 'Chinese (Xuanzang)',
              text: '無有恐怖',
              source: 'T251',
              tokens: ['無', '有', '恐怖'],
              transliteration: 'wú yǒu kǒng-bù  (Mandarin pinyin)',
            },
            {
              lang: 'ja-Jpan',
              label: 'Japanese (Sino-Japanese)',
              text: '無有恐怖',
              source: 'Hannya Shingyō',
              tokens: ['無', '有', '恐怖'],
              transliteration: 'mu u kufu  (Sino-Japanese)',
            },
            {
              lang: 'bo-Tibt',
              label: 'Tibetan',
              text: 'སྐྲག་པ་མེད་དེ།',
              source: 'Kangyur',
              transliteration: "trak-pa mé-dé  (Lhasa Tibetan)",
              tokens: ['སྐྲག་པ', 'མེད་དེ'],
            },
          ],
          witnesses: [
            {
              by: 'MAPLE chant sheet (after Sheng-yen)',
              text: 'there is no fear.',
              alignTo: [-1, -1, 0, 0],
              license: 'MAPLE community chant sheet, adapted from Master Sheng-yen\'s translation',
            },
            {
              by: 'Conze (1958)',
              text: 'he has no fears.',
              alignTo: [-1, -1, 0, 0],
              url: 'https://en.wikipedia.org/wiki/Heart_Sutra',
            },
            {
              by: 'Red Pine (2004)',
              text: 'they have no fears.',
              alignTo: [-1, -1, 0, 0],
              url: 'https://www.counterpointpress.com/dd-product/the-heart-sutra/',
              license: 'Quoted with attribution',
            },
            {
              by: 'Thich Nhat Hanh (2014)',
              text: 'they can overcome all fear,',
              alignTo: [-1, -1, 0, -1, 0],
              url: 'https://plumvillage.org/sutra/the-other-shore',
              license: 'Plum Village translation, quoted with attribution',
            },
          ],
          words: [
            {
              form: 'atrasto',
              scriptAlt: 'अत्रस्तो',
              scriptAlts: { 'zh-Hant': '恐怖', 'ja-Jpan': '恐怖', 'bo-Tibt': 'སྐྲག་པ' },
              scriptMorphemes: {
                'zh-Hant': [
                  { text: '恐', type: 'semantic', pronunciation: 'kǒng', gloss: 'fear, dread — the affective recoil' },
                  { text: '怖', type: 'semantic', pronunciation: 'bù', gloss: 'terror — doublet with 恐 (Chinese often pairs near-synonyms for emphasis)' },
                ],
                'ja-Jpan': [
                  { text: '恐', type: 'semantic', pronunciation: 'ku', gloss: 'fear (read *ku* in 恐怖 *kufu*)' },
                  { text: '怖', type: 'semantic', pronunciation: 'fu', gloss: 'terror — doublet with 恐' },
                ],
                'bo-Tibt': [
                  { text: 'སྐྲག་', type: 'semantic', pronunciation: 'skrag', gloss: 'to fear, be afraid (verb root)' },
                  { text: 'པ', type: 'semantic', pronunciation: 'pa', gloss: 'nominaliser — turns the verb into "fear" (noun)' },
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
          ],
        },

        // ── 遠離顛倒夢想 — Far from inverted dreams ──
        {
          id: 'result-far-from-inversion',
          pali: 'viparyāsātikrānto',
          paliDeva: 'विपर्यासातिक्रान्तो',
          scripts: [
            { lang: 'sa-Latn', label: 'Sanskrit (IAST)', text: 'viparyāsātikrānto' },
            { lang: 'sa-Deva', label: 'Sanskrit (Devanāgarī)', text: 'विपर्यासातिक्रान्तो', transliteration: 'viparyāsātikrānto' },
            {
              lang: 'zh-Hant',
              label: 'Chinese (Xuanzang)',
              text: '遠離顛倒夢想',
              source: 'T251',
              tokens: ['遠離', '顛倒', '夢想'],
              transliteration: 'yuǎn-lí diān-dǎo mèng-xiǎng  (Mandarin pinyin)',
            },
            {
              lang: 'ja-Jpan',
              label: 'Japanese (Sino-Japanese)',
              text: '遠離顛倒夢想',
              source: 'Hannya Shingyō',
              tokens: ['遠離', '顛倒', '夢想'],
              transliteration: 'on-ri ten-dō mu-sō  (Sino-Japanese)',
            },
            {
              lang: 'bo-Tibt',
              label: 'Tibetan',
              text: 'ཕྱིན་ཅི་ལོག་ལས་ཤིན་ཏུ་འདས་ནས་',
              source: 'Kangyur',
              transliteration: "chin-chi-lok lé shin-tu dé né  (Lhasa Tibetan)",
              tokens: ['ཕྱིན་ཅི་ལོག', 'ལས', 'ཤིན་ཏུ་འདས', 'ནས'],
            },
          ],
          witnesses: [
            {
              by: 'MAPLE chant sheet (after Sheng-yen)',
              text: 'Passing far beyond confusion and delusion,',
              alignTo: [0, 0, 0, 0, -1, 0],
              license: 'MAPLE community chant sheet, adapted from Master Sheng-yen\'s translation',
            },
            {
              by: 'Conze (1958)',
              text: 'He has overcome what can upset,',
              alignTo: [-1, -1, 0, -1, -1, 0],
              url: 'https://en.wikipedia.org/wiki/Heart_Sutra',
            },
            {
              by: 'Red Pine (2004)',
              text: 'Far beyond all distorted views',
              alignTo: [0, 0, -1, 0, 0],
              url: 'https://www.counterpointpress.com/dd-product/the-heart-sutra/',
              license: 'Quoted with attribution',
            },
            {
              by: 'Thich Nhat Hanh (2014)',
              text: 'destroy all wrong perceptions',
              alignTo: [0, -1, 0, 0],
              url: 'https://plumvillage.org/sutra/the-other-shore',
              license: 'Plum Village translation, quoted with attribution',
            },
          ],
          words: [
            {
              form: 'viparyāsātikrānto',
              scriptAlt: 'विपर्यासातिक्रान्तो',
              scriptAlts: { 'zh-Hant': '顛倒', 'ja-Jpan': '顛倒', 'bo-Tibt': 'ཕྱིན་ཅི་ལོག' },
              scriptMorphemes: {
                'zh-Hant': [
                  { text: '顛', type: 'semantic', pronunciation: 'diān', gloss: 'overturn, topple — having the right-side-up tipped over' },
                  { text: '倒', type: 'semantic', pronunciation: 'dǎo', gloss: 'upside-down, fallen — doublet with 顛 = "inverted"' },
                ],
                'ja-Jpan': [
                  { text: '顛', type: 'semantic', pronunciation: 'ten', gloss: 'overturn — read *ten* in 顛倒 (*tendō*)' },
                  { text: '倒', type: 'semantic', pronunciation: 'dō', gloss: 'upside-down — doublet with 顛' },
                ],
                'bo-Tibt': [
                  { text: 'ཕྱིན་', type: 'semantic', pronunciation: 'phyin', gloss: 'gone (here: a "going", a direction)' },
                  { text: 'ཅི་', type: 'semantic', pronunciation: 'ci', gloss: 'what (interrogative; used here as a binding particle in the compound)' },
                  { text: 'ལོག', type: 'semantic', pronunciation: 'log', gloss: 'reversed, wrong — together ཕྱིན་ཅི་ལོག = "the going-gone-wrong" = an inverted view (*viparyāsa*)' },
                ],
              },
              pronunciation: 'vee-pahr-YAH-sah-tee-KRAHN-toh',
              etymology: '*viparyāsa* "inverted view" + *atikrānta* "crossed beyond"',
              gloss: 'having crossed beyond inverted views — past the four distortions (taking the impure as pure, the impermanent as permanent, etc.)',
              accent: 'emerald',
              morphemes: [
                { text: 'viparyāsa', type: 'stem', gloss: 'inverted view — seeing things upside-down (impermanent as permanent, suffering as pleasure, etc.)', pronunciation: 'vee-pahr-YAH-sah', citations: [wikipediaCitation('Viparyasa')] },
                { text: 'atikrānto', type: 'suffix', gloss: 'having crossed beyond, transcended', pronunciation: 'ah-tee-KRAHN-toh' },
              ],
            },
          ],
        },

        // ── 究竟涅槃 — Ultimate nirvāṇa ──
        {
          id: 'result-ultimate-nirvana',
          pali: 'niṣṭhānirvāṇaḥ.',
          paliDeva: 'निष्ठानिर्वाणः॥',
          scripts: [
            { lang: 'sa-Latn', label: 'Sanskrit (IAST)', text: 'niṣṭhānirvāṇaḥ.' },
            { lang: 'sa-Deva', label: 'Sanskrit (Devanāgarī)', text: 'निष्ठानिर्वाणः॥', transliteration: 'niṣṭhānirvāṇaḥ.' },
            {
              lang: 'zh-Hant',
              label: 'Chinese (Xuanzang)',
              text: '究竟涅槃',
              source: 'T251',
              tokens: ['究竟', '涅槃'],
              transliteration: 'jiū-jìng niè-pán  (Mandarin pinyin)',
            },
            {
              lang: 'ja-Jpan',
              label: 'Japanese (Sino-Japanese)',
              text: '究竟涅槃',
              source: 'Hannya Shingyō',
              tokens: ['究竟', '涅槃'],
              transliteration: 'ku-kyō ne-han  (Sino-Japanese)',
            },
            {
              lang: 'bo-Tibt',
              label: 'Tibetan',
              text: 'མྱ་ངན་ལས་འདས་པའི་མཐར་ཕྱིན་ཏོ།',
              source: 'Kangyur',
              transliteration: "nya-ngen lé dé-pé tar-chin to  (Lhasa Tibetan)",
              tokens: ['མྱ་ངན་ལས་འདས་པ', 'འི', 'མཐར་ཕྱིན', 'ཏོ'],
            },
          ],
          witnesses: [
            {
              by: 'MAPLE chant sheet (after Sheng-yen)',
              text: 'they reach ultimate nirvana.',
              alignTo: [-1, -1, 0, 0],
              license: 'MAPLE community chant sheet, adapted from Master Sheng-yen\'s translation',
            },
            {
              by: 'Conze (1958)',
              text: 'and reaches in the end to Nirvāṇa.',
              alignTo: [-1, -1, -1, -1, -1, -1, 0],
              url: 'https://en.wikipedia.org/wiki/Heart_Sutra',
            },
            {
              by: 'Red Pine (2004)',
              text: 'they reach final nirvāṇa.',
              alignTo: [-1, -1, 0, 0],
              url: 'https://www.counterpointpress.com/dd-product/the-heart-sutra/',
              license: 'Quoted with attribution',
            },
            {
              by: 'Thich Nhat Hanh (2014)',
              text: 'and realize Perfect Nirvāṇa.',
              alignTo: [-1, -1, 0, 0],
              url: 'https://plumvillage.org/sutra/the-other-shore',
              license: 'Plum Village translation, quoted with attribution',
            },
          ],
          words: [
            {
              form: 'niṣṭhānirvāṇaḥ',
              scriptAlt: 'निष्ठानिर्वाणः',
              scriptAlts: { 'zh-Hant': '涅槃', 'ja-Jpan': '涅槃', 'bo-Tibt': 'མྱ་ངན་ལས་འདས་པ' },
              scriptMorphemes: {
                'zh-Hant': [
                  { text: '涅', type: 'phonetic', pronunciation: 'niè', gloss: 'phonetic: transliterates "nir-"; the character\'s usual meaning ("black mud, dye") is unrelated' },
                  { text: '槃', type: 'phonetic', pronunciation: 'pán', gloss: 'phonetic: transliterates "-vāṇa"; usual meaning ("plate, dish") is unrelated' },
                ],
                'ja-Jpan': [
                  { text: '涅', type: 'phonetic', pronunciation: 'ne', gloss: 'phonetic: transliterates "nir-" (read *ne* in 涅槃 *nehan*)' },
                  { text: '槃', type: 'phonetic', pronunciation: 'han', gloss: 'phonetic: transliterates "-vāṇa"' },
                ],
                'bo-Tibt': [
                  { text: 'མྱ་', type: 'semantic', pronunciation: 'mya', gloss: 'ill, afflicted' },
                  { text: 'ངན་', type: 'semantic', pronunciation: 'ngan', gloss: 'bad — together མྱ་ངན ("mya ngan") = "sorrow, grief, affliction"' },
                  { text: 'ལས་', type: 'semantic', pronunciation: 'las', gloss: 'from, beyond (ablative particle)' },
                  { text: 'འདས་པ', type: 'semantic', pronunciation: "'das pa", gloss: 'having passed beyond — together: "passed-beyond sorrow" = *nirvāṇa*' },
                ],
              },
              pronunciation: 'neesh-TAH-near-VAH-nah-h',
              etymology: '*niṣṭhā* "completion, end" + *nirvāṇa* "extinguishing"',
              gloss: 'final/complete nirvāṇa — the extinguishing of grasping that is the end of suffering',
              accent: 'violet',
              citations: [wikipediaCitation('Nirvana_(Buddhism)')],
            },
          ],
          note: 'The pivot from analysis to result. Having seen everything as empty, the bodhisattva is *unobstructed* — *atrasto*, unafraid. The Chinese 心無罣礙 (*shin mu kege* in Japanese reading) — "mind without obstruction" — is one of the most-quoted lines in East Asian Buddhism.',
        },
      ],
    },

    // ─────────────────────────────────────────────────────────────────────
    // 2e. MAPLE prose — All Buddhas of the past, present and future
    // ─────────────────────────────────────────────────────────────────────
    {
      id: 'maple-all-buddhas',
      shape: 'prose-commentary',
      body: 'All Buddhas of the past, present and future rely on transcendent wisdom, and attain unexcelled, perfect, complete enlightenment.\n\n*MAPLE chant text. Chinese: 三世諸佛 依般若波羅蜜多故 得阿耨多羅三藐三菩提 — the *anuttarā samyaksaṃbodhi* formula. Sanskrit: "Tryadhvavyavasthitāḥ sarvabuddhāḥ prajñāpāramitām āśrityānuttarāṃ samyaksaṃbodhim abhisaṃbuddhāḥ."*',
    },

    // ─────────────────────────────────────────────────────────────────────
    // 2f. MAPLE prose — Therefore know: the great spell · into the mantra
    // ─────────────────────────────────────────────────────────────────────
    {
      id: 'maple-great-spell',
      shape: 'prose-commentary',
      body: 'Therefore know: transcendent wisdom is the great spell, the great knowledge, the supreme knowledge, the unequalled knowledge. It can remove all suffering. It is true, not false.\n\nTherefore recite the mantra of transcendent wisdom as follows:\n\n*MAPLE chant text. Chinese: 故知般若波羅蜜多 是大神咒 是大明咒 是無上咒 是無等等咒 能除一切苦 真實不虛 故說般若波羅蜜多咒 即說咒曰 — the praise of prajñāpāramitā as itself a mantra, leading into the gate gate dharani below.*',
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
        { lang: 'sa-Latn', label: 'Sanskrit (IAST)', text: 'gate gate pāragate pārasaṃgate bodhi svāhā' },
        { lang: 'sa-Deva', label: 'Sanskrit (Devanāgarī)', text: 'गते गते पारगते पारसंगते बोधि स्वाहा', transliteration: 'gate gate pāragate pārasaṃgate bodhi svāhā' },
        {
          lang: 'zh-Hant',
          label: 'Chinese (Xuanzang)',
          text: '揭諦揭諦 波羅揭諦 波羅僧揭諦 菩提薩婆訶',
          source: 'T251',
          transliteration: 'jiē-dì jiē-dì  bō-luó jiē-dì  bō-luó-sēng jiē-dì  pú-tí sà-pó-hē  (Mandarin pinyin)',
        },
        {
          lang: 'ja-Jpan',
          label: 'Japanese (Sino-Japanese)',
          text: '羯諦 羯諦 波羅羯諦 波羅僧羯諦 菩提 薩婆訶',
          source: 'Hannya Shingyō dharani',
          transliteration: 'Gyate gyate  haragyate  harasōgyate  boji  sowaka  (Sino-Japanese)',
        },
        {
          lang: 'bo-Tibt',
          label: 'Tibetan',
          text: 'ག་ཏེ་ག་ཏེ་པཱ་ར་ག་ཏེ་པཱ་ར་སཾ་ག་ཏེ་བོ་དྷི་སྭཱ་ཧཱ',
          transliteration: 'gate gate  pāragate  pārasaṃgate  bodhi  svāhā  (Sanskrit chanted in Tibetan)',
        },
      ],
      reconstruction: 'Read literally: *gate* "gone" (locative or vocative of *gata*, past participle), repeated; *pāragate* "gone to the beyond"; *pārasaṃgate* "completely gone to the beyond"; *bodhi* "awakening"; *svāhā* an exclamation of completion (familiar from Vedic ritual). The repetition enacts the journey it describes.',
    },

    // ─────────────────────────────────────────────────────────────────────
    // 3b. Longer Japanese recitation — MAPLE practice repeats the dharani
    //     in Sino-Japanese kanbun-yomi after the Sanskrit
    // ─────────────────────────────────────────────────────────────────────
    {
      id: 'dharani-japanese-extended',
      shape: 'sound-formula',
      framing: 'At MAPLE the Sanskrit dharani is chanted once; the assembly then continues in a longer Sino-Japanese (kanbun-yomi) recitation, syllabified one mora per beat. The kanji are Xuanzang\'s 7th-century phonetic transliterations of the Sanskrit — themselves an attempt to capture the original sound in Chinese characters. Reading them again in Japanese on-yomi adds another layer of phonetic drift, but the *gate / pāragate / pārasaṃgate* skeleton remains audible underneath.',
      phonemes: 'Gya tē gya tē ha ra gya tē  /  Hara sō gya tē bo ji sowa ka',
      native: '羯諦羯諦波羅羯諦 / 波羅僧羯諦菩提薩婆訶',
      scripts: [
        {
          lang: 'ja-Jpan',
          label: 'Japanese (Sino-Japanese, chant-syllabified)',
          text: '羯諦羯諦波羅羯諦  /  波羅僧羯諦菩提薩婆訶',
          source: 'MAPLE chant sheet — kanbun-yomi syllabified for the longer recitation',
          transliteration: 'Gya tē gya tē ha ra gya tē  /  Hara sō gya tē bo ji sowa ka  (Sino-Japanese, one syllable per beat)',
        },
        {
          lang: 'zh-Hant',
          label: 'Chinese (Xuanzang) — same kanji, Mandarin reading',
          text: '羯諦羯諦波羅羯諦 / 波羅僧羯諦菩提薩婆訶',
          source: 'T251 (same characters as Japanese; Mandarin reading shown for comparison)',
          transliteration: 'jiē-dì jiē-dì bō-luó jiē-dì  /  bō-luó-sēng jiē-dì pú-tí sà-pó-hē  (Mandarin pinyin)',
        },
      ],
      reconstruction: 'Mapping back: 羯諦 *gya-tē* ↔ *gate*; 波羅 *ha-ra* ↔ *pāra-*; 波羅僧 *Ha-ra-sō* ↔ *pārasaṃ-*; 菩提 *bo-ji* ↔ *bodhi*; 薩婆訶 *sowa ka* ↔ *svāhā*. The Japanese form preserves the Sanskrit consonant-vowel skeleton through two layers of phonetic carry-over.',
    },

    // ─────────────────────────────────────────────────────────────────────
    // 4. On translating the Heart Sutra
    // ─────────────────────────────────────────────────────────────────────
    {
      id: 'on-translation',
      shape: 'prose-commentary',
      heading: 'On translating the Heart Sutra',
      body: 'No two English Heart Sutras are alike. Conze\'s "form is emptiness" reads philosophical; Red Pine\'s reads liturgical; Thich Nhat Hanh\'s "this Body itself is Emptiness" reads phenomenological. The Chinese 色即是空 is sharper than any English can be, *just is*, with no copula gap, no preposition. The Tibetan introduces its own scholastic clarifications. Each tradition has been chanting this for over a thousand years; each has put its hand on the text and shaped it.\n\nThe witnesses above are sampled, not exhausted. Karl Brunnhölzl\'s *The Heart Attack Sutra* (2012) offers a careful Tibetan-tradition scholarly reading; Mu Soeng\'s *The Heart of the Universe* (2010) reads it through Zen; H.H. the Dalai Lama\'s commentaries integrate the Tibetan exegetical tradition; the Buddhist Text Translation Society\'s edition follows the Hsuan Hua lineage. All of them are correct and none of them are.\n\nThe instruction the sutra gives, however, is not to translate it but to chant it, and through chanting, to *go*: *gate gate*.',
    },
  ],
};

export default heartSutra;

/**
 * Maha Prajna Paramita Hrdaya Sutra — Bodhi Sangha rendering.
 *
 * The same Heart Sutra that lives under /liturgy/maple/heart-sutra,
 * chanted at Bodhi Sangha in the Aitken-Rochester / Diamond Sangha
 * English recension. The Sanskrit / Devanāgarī / Chinese Xuanzang /
 * Sino-Japanese / Tibetan canonical scripts and all word-level
 * morpheme data are identical to the MAPLE version — concept-graph
 * auto-resolves from the same registry. The differentiator is the
 * English: Bodhi's witness sits first; Conze / Red Pine / Thich Nhat
 * Hanh remain available for comparison via the witness-dots.
 *
 * Bodhi text source: Bodhi Sangha Sutras booklet (May 2016), p.3.
 */

import type { LiturgyDoc } from '../../types/liturgy';
import {
  wikipediaCitation,
} from './_groundingHelpers';

export const bodhiHeartSutra: LiturgyDoc = {
  slug: 'heart-sutra',
  sangha: 'bodhi-sangha',
  order: 3,
  title: 'Maha Prajna Paramita Hrdaya Sutra',
  subtitle: 'The Heart Sutra — Bodhi Sangha (Aitken-Rochester / Diamond Sangha line)',
  tradition: 'mahayana',
  context: 'Bodhi\'s English recension reads close to the Aitken-Rochester / Diamond Sangha line used across Zen centres in the Yamada Roshi / Sanbo Kyodan tradition.',
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
      { label: 'Bodhi Sangha Sutras booklet (May 2016), p.3' },
    ],
  },
  curator:
    "Curation by Aditya. The primary English witness is the MAPLE community chant sheet, titled \"The Scripture on the Heart of Transcendent Wisdom — Adapted from the translation by Master Sheng-yen.\" Sanskrit follows Conze's short version; Chinese is Xuanzang's T251; Tibetan from the Kangyur short-form. The other witnesses (Conze 1958, Red Pine 2004, Thich Nhat Hanh 2014) come from their published translations, sliced per Xuanzang chant-line for comparison.",
  sections: [
    // ─────────────────────────────────────────────────────────────────────
    // The body — broken into chant-line segments
    // ─────────────────────────────────────────────────────────────────────
    {
      id: 'bodhi-heart-core',
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
    // 2b. The six negations + long enumeration — MAPLE chants two further
    //     passages between the form-emptiness chiasmus and the result-section.
    //     Each Xuanzang four-character line as its own breath.
    // ─────────────────────────────────────────────────────────────────────
    {
      id: 'bodhi-heart-middle',
      shape: 'triple-script-witness',
      segments: [

        // ══════════════════════════════════════════════════════════════
        // SIX NEGATIONS — 舍利子 是諸法空相 不生不滅 不垢不淨 不增不減
        // ══════════════════════════════════════════════════════════════

        // ── 舍利子 — Śāriputra, addressee ──
        {
          id: 'middle-shariputra',
          pali: 'Iha Śāriputra',
          paliDeva: 'इह शारिपुत्र',
          scripts: [
            { lang: 'sa-Latn', label: 'Sanskrit (IAST)', text: 'Iha Śāriputra' },
            { lang: 'sa-Deva', label: 'Sanskrit (Devanāgarī)', text: 'इह शारिपुत्र', transliteration: 'Iha Śāriputra' },
            {
              lang: 'zh-Hant',
              label: 'Chinese (Xuanzang)',
              text: '舍利子',
              source: 'T251',
              tokens: ['舍利子'],
              transliteration: 'shè-lì-zǐ  (Mandarin pinyin)',
            },
            {
              lang: 'ja-Jpan',
              label: 'Japanese (Sino-Japanese)',
              text: '舍利子',
              source: 'Hannya Shingyō',
              tokens: ['舍利子'],
              transliteration: 'Sharishi  (Sino-Japanese)',
            },
            {
              lang: 'bo-Tibt',
              label: 'Tibetan',
              text: 'ཤཱ་རིའི་བུ',
              source: 'Kangyur',
              transliteration: "shā-ri'i bu  (Lhasa Tibetan)",
            },
          ],
          witnesses: [
            {
              by: 'MAPLE chant sheet (after Sheng-yen)',
              text: 'Śāriputra,',
              alignTo: [1],
              license: 'MAPLE community chant sheet, adapted from Master Sheng-yen\'s translation',
            },
            {
              by: 'Conze (1958)',
              text: 'Here, O Śāriputra,',
              alignTo: [0, -1, 1],
              url: 'https://en.wikipedia.org/wiki/Heart_Sutra',
            },
            {
              by: 'Red Pine (2004)',
              text: 'Here, Shariputra,',
              alignTo: [0, 1],
              url: 'https://www.counterpointpress.com/dd-product/the-heart-sutra/',
              license: 'Quoted with attribution',
            },
            {
              by: 'Thich Nhat Hanh (2014)',
              text: 'Listen Shariputra,',
              alignTo: [-1, 1],
              url: 'https://plumvillage.org/sutra/the-other-shore',
              license: 'Plum Village translation, quoted with attribution',
            },
          ],
          words: [
            {
              form: 'Iha',
              scriptAlt: 'इह',
              pronunciation: 'EE-hah',
              gloss: 'here — i.e. in this context, in this teaching',
            },
            {
              form: 'Śāriputra',
              scriptAlt: 'शारिपुत्र',
              scriptAlts: { 'zh-Hant': '舍利子', 'ja-Jpan': '舍利子', 'bo-Tibt': 'ཤཱ་རིའི་བུ' },
              scriptMorphemes: {
                'zh-Hant': [
                  { text: '舍利', type: 'phonetic', pronunciation: 'shè-lì', gloss: 'phonetic: transliterates *śāri* (the proper name)' },
                  { text: '子', type: 'semantic', pronunciation: 'zǐ', gloss: 'child, son — calques Sanskrit *putra* ("son")' },
                ],
                'ja-Jpan': [
                  { text: '舍利', type: 'phonetic', pronunciation: 'shari', gloss: 'phonetic: *śāri*' },
                  { text: '子', type: 'semantic', pronunciation: 'shi', gloss: 'child — calques *putra*' },
                ],
                'bo-Tibt': [
                  { text: 'ཤཱ་རི', type: 'phonetic', pronunciation: 'shā-ri', gloss: 'phonetic: *śāri* (the mother\'s name)' },
                  { text: 'འི', type: 'semantic', pronunciation: "'i", gloss: 'genitive — "of"' },
                  { text: 'བུ', type: 'semantic', pronunciation: 'bu', gloss: 'son — together: "son of Śāri"' },
                ],
              },
              pronunciation: 'SHAH-ree-poo-trah',
              etymology: '*Śāri* (his mother) + *putra* "son"',
              gloss: 'son of Śāri — the elder disciple to whom Avalokiteśvara speaks',
              accent: 'rose',
            },
          ],
        },

        // ── 是諸法空相 — all dharmas characterized by emptiness ──
        {
          id: 'middle-all-dharmas-empty',
          pali: 'sarvadharmāḥ śūnyatālakṣaṇāḥ',
          paliDeva: 'सर्वधर्माः शून्यतालक्षणाः',
          scripts: [
            { lang: 'sa-Latn', label: 'Sanskrit (IAST)', text: 'sarvadharmāḥ śūnyatālakṣaṇāḥ' },
            { lang: 'sa-Deva', label: 'Sanskrit (Devanāgarī)', text: 'सर्वधर्माः शून्यतालक्षणाः', transliteration: 'sarvadharmāḥ śūnyatālakṣaṇāḥ' },
            {
              lang: 'zh-Hant',
              label: 'Chinese (Xuanzang)',
              text: '是諸法空相',
              source: 'T251',
              tokens: ['是', '諸法', '空', '相'],
              transliteration: 'shì zhū-fǎ kōng xiàng  (Mandarin pinyin)',
            },
            {
              lang: 'ja-Jpan',
              label: 'Japanese (Sino-Japanese)',
              text: '是諸法空相',
              source: 'Hannya Shingyō',
              tokens: ['是', '諸法', '空', '相'],
              transliteration: 'ze sho-hō kū-sō  (Sino-Japanese)',
            },
            {
              lang: 'bo-Tibt',
              label: 'Tibetan',
              text: 'ཆོས་ཐམས་ཅད་སྟོང་པ་ཉིད་དེ་མཚན་ཉིད་མེད་པ',
              source: 'Kangyur',
              transliteration: 'chö-tham-ché tong-pa nyi-dé tsen-nyi mé-pa  (Lhasa Tibetan)',
            },
          ],
          witnesses: [
            {
              by: 'MAPLE chant sheet (after Sheng-yen)',
              text: 'all dharmas are characterized by emptiness',
              alignTo: [0, 0, -1, -1, -1, 1],
              license: 'MAPLE community chant sheet, adapted from Master Sheng-yen\'s translation',
            },
            {
              by: 'Conze (1958)',
              text: 'all dharmas are marked with emptiness;',
              alignTo: [0, 0, -1, -1, -1, 1],
              url: 'https://en.wikipedia.org/wiki/Heart_Sutra',
            },
            {
              by: 'Red Pine (2004)',
              text: 'all dharmas are defined by emptiness,',
              alignTo: [0, 0, -1, -1, -1, 1],
              url: 'https://www.counterpointpress.com/dd-product/the-heart-sutra/',
              license: 'Quoted with attribution',
            },
            {
              by: 'Thich Nhat Hanh (2014)',
              text: 'all phenomena bear the mark of Emptiness;',
              alignTo: [0, 0, -1, -1, -1, 1, 1],
              url: 'https://plumvillage.org/sutra/the-other-shore',
              license: 'Plum Village translation, quoted with attribution',
            },
          ],
          words: [
            {
              form: 'sarvadharmāḥ',
              scriptAlt: 'सर्वधर्माः',
              scriptAlts: { 'zh-Hant': '諸法', 'ja-Jpan': '諸法', 'bo-Tibt': 'ཆོས་ཐམས་ཅད' },
              scriptMorphemes: {
                'zh-Hant': [
                  { text: '諸', type: 'semantic', pronunciation: 'zhū', gloss: 'all, every — calques *sarva*' },
                  { text: '法', type: 'semantic', pronunciation: 'fǎ', gloss: 'dharma — phenomenon, teaching, factor' },
                ],
                'ja-Jpan': [
                  { text: '諸', type: 'semantic', pronunciation: 'sho', gloss: 'all — calques *sarva*' },
                  { text: '法', type: 'semantic', pronunciation: 'hō', gloss: 'dharma — phenomenon' },
                ],
              },
              pronunciation: 'sahr-vah-DHAR-mah',
              etymology: '*sarva* "all" + *dharmāḥ* "phenomena" (plural)',
              gloss: 'all phenomena, all dharmas',
              morphemes: [
                { text: 'sarva', type: 'prefix', gloss: 'all, every', pronunciation: 'SAHR-vah' },
                { text: 'dharmāḥ', type: 'stem', gloss: 'phenomena, factors of experience', pronunciation: 'DHAR-mah' },
              ],
            },
            {
              form: 'śūnyatālakṣaṇāḥ',
              scriptAlt: 'शून्यतालक्षणाः',
              scriptAlts: { 'zh-Hant': '空相', 'ja-Jpan': '空相', 'bo-Tibt': 'སྟོང་པ་ཉིད' },
              scriptMorphemes: {
                'zh-Hant': [
                  { text: '空', type: 'semantic', pronunciation: 'kōng', gloss: 'empty — calques *śūnya*' },
                  { text: '相', type: 'semantic', pronunciation: 'xiàng', gloss: 'mark, characteristic — calques *lakṣaṇa*' },
                ],
                'ja-Jpan': [
                  { text: '空', type: 'semantic', pronunciation: 'kū', gloss: 'emptiness — calques *śūnyatā*' },
                  { text: '相', type: 'semantic', pronunciation: 'sō', gloss: 'mark, characteristic — calques *lakṣaṇa*' },
                ],
              },
              pronunciation: 'SHOON-yah-tah-LAHK-shah-nah',
              etymology: '*śūnyatā* "emptiness" + *lakṣaṇa* "mark, characteristic" — compound: "having emptiness as their mark"',
              gloss: 'characterized by emptiness — emptiness is their defining mark',
              accent: 'sky',
              morphemes: [
                { text: 'śūnyatā', type: 'stem', root: '√śū', gloss: 'emptiness', pronunciation: 'SHOON-yah-tah' },
                { text: 'lakṣaṇāḥ', type: 'suffix', gloss: 'marks, characteristics', pronunciation: 'LAHK-shah-nah' },
              ],
            },
          ],
        },

        // ── 不生不滅 — neither arising nor ceasing ──
        {
          id: 'middle-no-arise-no-cease',
          pali: 'anutpannā aniruddhā',
          paliDeva: 'अनुत्पन्ना अनिरुद्धा',
          scripts: [
            { lang: 'sa-Latn', label: 'Sanskrit (IAST)', text: 'anutpannā aniruddhā' },
            { lang: 'sa-Deva', label: 'Sanskrit (Devanāgarī)', text: 'अनुत्पन्ना अनिरुद्धा', transliteration: 'anutpannā aniruddhā' },
            {
              lang: 'zh-Hant',
              label: 'Chinese (Xuanzang)',
              text: '不生不滅',
              source: 'T251',
              tokens: ['不', '生', '不', '滅'],
              transliteration: 'bù shēng bù miè  (Mandarin pinyin)',
            },
            {
              lang: 'ja-Jpan',
              label: 'Japanese (Sino-Japanese)',
              text: '不生不滅',
              source: 'Hannya Shingyō',
              tokens: ['不', '生', '不', '滅'],
              transliteration: 'fu-shō fu-metsu  (Sino-Japanese)',
            },
            {
              lang: 'bo-Tibt',
              label: 'Tibetan',
              text: 'མ་སྐྱེས་པ་མ་འགགས་པ',
              source: 'Kangyur',
              transliteration: 'ma-kyé-pa ma-gak-pa  (Lhasa Tibetan)',
            },
          ],
          witnesses: [
            {
              by: 'MAPLE chant sheet (after Sheng-yen)',
              text: 'that does not arise, is not destroyed,',
              alignTo: [-1, -1, -1, 0, -1, -1, 1],
              license: 'MAPLE community chant sheet, adapted from Master Sheng-yen\'s translation',
            },
            {
              by: 'Conze (1958)',
              text: 'they are not produced or stopped,',
              alignTo: [-1, -1, -1, 0, -1, 1],
              url: 'https://en.wikipedia.org/wiki/Heart_Sutra',
            },
            {
              by: 'Red Pine (2004)',
              text: 'not by birth or destruction,',
              alignTo: [-1, -1, 0, -1, 1],
              url: 'https://www.counterpointpress.com/dd-product/the-heart-sutra/',
              license: 'Quoted with attribution',
            },
            {
              by: 'Thich Nhat Hanh (2014)',
              text: 'no Birth no Death,',
              alignTo: [-1, 0, -1, 1],
              url: 'https://plumvillage.org/sutra/the-other-shore',
              license: 'Plum Village translation, quoted with attribution',
            },
          ],
          words: [
            {
              form: 'anutpannā',
              scriptAlt: 'अनुत्पन्ना',
              scriptAlts: { 'zh-Hant': '不生', 'ja-Jpan': '不生', 'bo-Tibt': 'མ་སྐྱེས་པ' },
              pronunciation: 'ah-noot-PAHN-nah',
              etymology: '*a-* (not) + *utpannā* "arisen" (past participle of √pad)',
              gloss: 'unarisen, not having come into being',
              morphemes: [
                { text: 'an', type: 'prefix', gloss: 'not — the negation', pronunciation: 'ahn' },
                { text: 'utpannā', type: 'stem', root: '√pad', gloss: 'arisen, come into being', pronunciation: 'oot-PAHN-nah' },
              ],
            },
            {
              form: 'aniruddhā',
              scriptAlt: 'अनिरुद्धा',
              scriptAlts: { 'zh-Hant': '不滅', 'ja-Jpan': '不滅', 'bo-Tibt': 'མ་འགགས་པ' },
              pronunciation: 'ah-nee-ROOD-dhah',
              etymology: '*a-* (not) + *niruddhā* "stopped, ceased" (past participle of √rudh)',
              gloss: 'unceased, not stopped',
              morphemes: [
                { text: 'a', type: 'prefix', gloss: 'not', pronunciation: 'ah' },
                { text: 'niruddhā', type: 'stem', root: '√rudh', gloss: 'stopped, ceased', pronunciation: 'nee-ROOD-dhah' },
              ],
            },
          ],
        },

        // ── 不垢不淨 — neither defiled nor pure ──
        {
          id: 'middle-no-defile-no-pure',
          pali: 'amalā na vimalā',
          paliDeva: 'अमला न विमला',
          scripts: [
            { lang: 'sa-Latn', label: 'Sanskrit (IAST)', text: 'amalā na vimalā' },
            { lang: 'sa-Deva', label: 'Sanskrit (Devanāgarī)', text: 'अमला न विमला', transliteration: 'amalā na vimalā' },
            {
              lang: 'zh-Hant',
              label: 'Chinese (Xuanzang)',
              text: '不垢不淨',
              source: 'T251',
              tokens: ['不', '垢', '不', '淨'],
              transliteration: 'bù gòu bù jìng  (Mandarin pinyin)',
            },
            {
              lang: 'ja-Jpan',
              label: 'Japanese (Sino-Japanese)',
              text: '不垢不淨',
              source: 'Hannya Shingyō',
              tokens: ['不', '垢', '不', '淨'],
              transliteration: 'fu-ku fu-jō  (Sino-Japanese)',
            },
            {
              lang: 'bo-Tibt',
              label: 'Tibetan',
              text: 'དྲི་མ་མེད་པ་དྲི་མ་དང་བྲལ་བ་མེད་པ',
              source: 'Kangyur',
              transliteration: 'dri-ma mé-pa dri-ma dang dral-wa mé-pa  (Lhasa Tibetan)',
            },
          ],
          witnesses: [
            {
              by: 'MAPLE chant sheet (after Sheng-yen)',
              text: 'is not defiled, is not pure,',
              alignTo: [-1, -1, 0, -1, -1, 2],
              license: 'MAPLE community chant sheet, adapted from Master Sheng-yen\'s translation',
            },
            {
              by: 'Conze (1958)',
              text: 'not defiled or immaculate,',
              alignTo: [-1, 0, -1, 2],
              url: 'https://en.wikipedia.org/wiki/Heart_Sutra',
            },
            {
              by: 'Red Pine (2004)',
              text: 'purity or defilement,',
              alignTo: [2, -1, 0],
              url: 'https://www.counterpointpress.com/dd-product/the-heart-sutra/',
              license: 'Quoted with attribution',
            },
            {
              by: 'Thich Nhat Hanh (2014)',
              text: 'no Defilement no Purity,',
              alignTo: [-1, 0, -1, 2],
              url: 'https://plumvillage.org/sutra/the-other-shore',
              license: 'Plum Village translation, quoted with attribution',
            },
          ],
          words: [
            {
              form: 'amalā',
              scriptAlt: 'अमला',
              scriptAlts: { 'zh-Hant': '不垢', 'ja-Jpan': '不垢', 'bo-Tibt': 'དྲི་མ་མེད་པ' },
              pronunciation: 'ah-MAH-lah',
              etymology: '*a-* (not) + *mala* "stain, defilement"',
              gloss: 'undefiled, without stain',
              morphemes: [
                { text: 'a', type: 'prefix', gloss: 'not', pronunciation: 'ah' },
                { text: 'malā', type: 'stem', gloss: 'stain, defilement', pronunciation: 'MAH-lah' },
              ],
            },
            {
              form: 'na',
              scriptAlt: 'न',
              pronunciation: 'nah',
              gloss: 'not',
            },
            {
              form: 'vimalā',
              scriptAlt: 'विमला',
              scriptAlts: { 'zh-Hant': '不淨', 'ja-Jpan': '不淨', 'bo-Tibt': 'དྲི་མ་དང་བྲལ་བ' },
              pronunciation: 'vee-MAH-lah',
              etymology: '*vi-* "apart from" + *mala* "stain" — "free of stain, pure"',
              gloss: 'free of defilement, immaculate',
              morphemes: [
                { text: 'vi', type: 'prefix', gloss: 'apart from, free of', pronunciation: 'vee' },
                { text: 'malā', type: 'stem', gloss: 'stain', pronunciation: 'MAH-lah' },
              ],
            },
          ],
        },

        // ── 不增不減 — neither increasing nor decreasing ──
        {
          id: 'middle-no-increase-no-decrease',
          pali: 'anūnā na paripūrṇāḥ',
          paliDeva: 'अनूना न परिपूर्णाः',
          scripts: [
            { lang: 'sa-Latn', label: 'Sanskrit (IAST)', text: 'anūnā na paripūrṇāḥ' },
            { lang: 'sa-Deva', label: 'Sanskrit (Devanāgarī)', text: 'अनूना न परिपूर्णाः', transliteration: 'anūnā na paripūrṇāḥ' },
            {
              lang: 'zh-Hant',
              label: 'Chinese (Xuanzang)',
              text: '不增不減',
              source: 'T251',
              tokens: ['不', '增', '不', '減'],
              transliteration: 'bù zēng bù jiǎn  (Mandarin pinyin)',
            },
            {
              lang: 'ja-Jpan',
              label: 'Japanese (Sino-Japanese)',
              text: '不增不減',
              source: 'Hannya Shingyō',
              tokens: ['不', '增', '不', '減'],
              transliteration: 'fu-zō fu-gen  (Sino-Japanese)',
            },
            {
              lang: 'bo-Tibt',
              label: 'Tibetan',
              text: 'བྲི་བ་མེད་པ་གང་བ་མེད་པའོ',
              source: 'Kangyur',
              transliteration: 'dri-wa mé-pa gang-wa mé-pa\'o  (Lhasa Tibetan)',
            },
          ],
          witnesses: [
            {
              by: 'MAPLE chant sheet (after Sheng-yen)',
              text: 'does not increase, does not decrease.',
              alignTo: [-1, -1, 2, -1, -1, 0],
              license: 'MAPLE community chant sheet, adapted from Master Sheng-yen\'s translation',
            },
            {
              by: 'Conze (1958)',
              text: 'not deficient or complete.',
              alignTo: [-1, 0, -1, 2],
              url: 'https://en.wikipedia.org/wiki/Heart_Sutra',
            },
            {
              by: 'Red Pine (2004)',
              text: 'completeness or deficiency.',
              alignTo: [2, -1, 0],
              url: 'https://www.counterpointpress.com/dd-product/the-heart-sutra/',
              license: 'Quoted with attribution',
            },
            {
              by: 'Thich Nhat Hanh (2014)',
              text: 'no Increasing no Decreasing.',
              alignTo: [-1, 2, -1, 0],
              url: 'https://plumvillage.org/sutra/the-other-shore',
              license: 'Plum Village translation, quoted with attribution',
            },
          ],
          words: [
            {
              form: 'anūnā',
              scriptAlt: 'अनूना',
              scriptAlts: { 'zh-Hant': '不減', 'ja-Jpan': '不減', 'bo-Tibt': 'བྲི་བ་མེད་པ' },
              pronunciation: 'ah-NOO-nah',
              etymology: '*a-* (not) + *ūna* "deficient, lacking"',
              gloss: 'not deficient, not lacking',
              morphemes: [
                { text: 'a', type: 'prefix', gloss: 'not', pronunciation: 'ah' },
                { text: 'nūnā', type: 'stem', gloss: 'deficient', pronunciation: 'NOO-nah' },
              ],
            },
            {
              form: 'na',
              scriptAlt: 'न',
              pronunciation: 'nah',
              gloss: 'not',
            },
            {
              form: 'paripūrṇāḥ',
              scriptAlt: 'परिपूर्णाः',
              scriptAlts: { 'zh-Hant': '不增', 'ja-Jpan': '不增', 'bo-Tibt': 'གང་བ' },
              pronunciation: 'pah-ree-POOR-nah',
              etymology: '*pari-* "around, completely" + *pūrṇa* "filled"',
              gloss: 'completely full, complete',
              morphemes: [
                { text: 'pari', type: 'prefix', gloss: 'completely, around', pronunciation: 'PAH-ree' },
                { text: 'pūrṇāḥ', type: 'stem', root: '√pṛ', gloss: 'filled, complete', pronunciation: 'POOR-nah' },
              ],
            },
          ],
        },

        // ══════════════════════════════════════════════════════════════
        // LONG ENUMERATION — what emptiness empties
        // ══════════════════════════════════════════════════════════════

        // ── 是故空中無色 — therefore in emptiness no form ──
        {
          id: 'middle-emptiness-no-form',
          pali: 'Tasmāc Chāriputra śūnyatāyāṃ na rūpaṃ',
          paliDeva: 'तस्माच्छारिपुत्र शून्यतायां न रूपम्',
          scripts: [
            { lang: 'sa-Latn', label: 'Sanskrit (IAST)', text: 'Tasmāc Chāriputra śūnyatāyāṃ na rūpaṃ' },
            { lang: 'sa-Deva', label: 'Sanskrit (Devanāgarī)', text: 'तस्माच्छारिपुत्र शून्यतायां न रूपम्', transliteration: 'Tasmāc Chāriputra śūnyatāyāṃ na rūpaṃ' },
            {
              lang: 'zh-Hant',
              label: 'Chinese (Xuanzang)',
              text: '是故空中無色',
              source: 'T251',
              tokens: ['是故', '空', '中', '無', '色'],
              transliteration: 'shì-gù kōng-zhōng wú sè  (Mandarin pinyin)',
            },
            {
              lang: 'ja-Jpan',
              label: 'Japanese (Sino-Japanese)',
              text: '是故空中無色',
              source: 'Hannya Shingyō',
              tokens: ['是故', '空', '中', '無', '色'],
              transliteration: 'ze-ko kū-chū mu shiki  (Sino-Japanese)',
            },
            {
              lang: 'bo-Tibt',
              label: 'Tibetan',
              text: 'དེ་ལྟ་བས་ན་སྟོང་པ་ཉིད་ལ་གཟུགས་མེད་པ',
              source: 'Kangyur',
              transliteration: 'dé-ta wé-na tong-pa nyi-la zuk mé-pa  (Lhasa Tibetan)',
            },
          ],
          witnesses: [
            {
              by: 'MAPLE chant sheet (after Sheng-yen)',
              text: 'Therefore, in emptiness there is no appearance.',
              alignTo: [0, -1, 2, -1, -1, -1, 4],
              license: 'MAPLE community chant sheet, adapted from Master Sheng-yen\'s translation',
            },
            {
              by: 'Conze (1958)',
              text: 'Therefore, O Śāriputra, in emptiness there is no form,',
              alignTo: [0, -1, 1, -1, 2, -1, -1, -1, 4],
              url: 'https://en.wikipedia.org/wiki/Heart_Sutra',
            },
            {
              by: 'Red Pine (2004)',
              text: 'Therefore, Shariputra, in emptiness there is no form,',
              alignTo: [0, 1, -1, 2, -1, -1, -1, 4],
              url: 'https://www.counterpointpress.com/dd-product/the-heart-sutra/',
              license: 'Quoted with attribution',
            },
            {
              by: 'Thich Nhat Hanh (2014)',
              text: 'That is why in Emptiness, Body, Feelings, Perceptions, Mental Formations and Consciousness are not separate self entities.',
              alignTo: [0, 0, -1, -1, 2, 4, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
              url: 'https://plumvillage.org/sutra/the-other-shore',
              license: 'Plum Village translation, quoted with attribution',
            },
          ],
          words: [
            {
              form: 'Tasmāc',
              scriptAlt: 'तस्माच्',
              scriptAlts: { 'zh-Hant': '是故', 'ja-Jpan': '是故', 'bo-Tibt': 'དེ་ལྟ་བས་ན' },
              pronunciation: 'tahs-MAHCH',
              etymology: 'ablative of *tat* "that" — "from that", "therefore"',
              gloss: 'therefore — drawing the consequence from what came before',
            },
            {
              form: 'Chāriputra',
              scriptAlt: 'छारिपुत्र',
              pronunciation: 'CHAH-ree-poo-trah',
              gloss: 'Śāriputra (sandhi form after *tasmāc*)',
            },
            {
              form: 'śūnyatāyāṃ',
              scriptAlt: 'शून्यतायाम्',
              scriptAlts: { 'zh-Hant': '空', 'ja-Jpan': '空', 'bo-Tibt': 'སྟོང་པ་ཉིད' },
              pronunciation: 'shoon-yah-TAH-yahm',
              etymology: 'locative of *śūnyatā* "emptiness" — "in emptiness"',
              gloss: 'in emptiness',
              accent: 'sky',
            },
            {
              form: 'na',
              scriptAlt: 'न',
              scriptAlts: { 'zh-Hant': '無', 'ja-Jpan': '無', 'bo-Tibt': 'མེད་པ' },
              pronunciation: 'nah',
              gloss: 'not, no — the great negation that this whole passage hammers',
            },
            {
              form: 'rūpaṃ',
              scriptAlt: 'रूपम्',
              scriptAlts: { 'zh-Hant': '色', 'ja-Jpan': '色', 'bo-Tibt': 'གཟུགས' },
              pronunciation: 'ROO-pahm',
              etymology: '*rūpa* "form, appearance" (nominative neuter)',
              gloss: 'form, appearance — the first of the five skandhas',
              accent: 'amber',
            },
          ],
        },

        // ── 無受想行識 — no feeling, perception, formation, consciousness ──
        {
          id: 'middle-no-other-skandhas',
          pali: 'na vedanā na saṃjñā na saṃskārāḥ na vijñānam',
          paliDeva: 'न वेदना न संज्ञा न संस्काराः न विज्ञानम्',
          scripts: [
            { lang: 'sa-Latn', label: 'Sanskrit (IAST)', text: 'na vedanā na saṃjñā na saṃskārāḥ na vijñānam' },
            { lang: 'sa-Deva', label: 'Sanskrit (Devanāgarī)', text: 'न वेदना न संज्ञा न संस्काराः न विज्ञानम्', transliteration: 'na vedanā na saṃjñā na saṃskārāḥ na vijñānam' },
            {
              lang: 'zh-Hant',
              label: 'Chinese (Xuanzang)',
              text: '無受想行識',
              source: 'T251',
              tokens: ['無', '受', '想', '行', '識'],
              transliteration: 'wú shòu xiǎng xíng shì  (Mandarin pinyin)',
            },
            {
              lang: 'ja-Jpan',
              label: 'Japanese (Sino-Japanese)',
              text: '無受想行識',
              source: 'Hannya Shingyō',
              tokens: ['無', '受', '想', '行', '識'],
              transliteration: 'mu ju sō gyō shiki  (Sino-Japanese)',
            },
            {
              lang: 'bo-Tibt',
              label: 'Tibetan',
              text: 'ཚོར་བ་མེད་འདུ་ཤེས་མེད་འདུ་བྱེད་མེད་རྣམ་པར་ཤེས་པ་མེད',
              source: 'Kangyur',
              transliteration: 'tsor-wa mé du-shé mé du-jé mé nam-par shé-pa mé  (Lhasa Tibetan)',
            },
          ],
          witnesses: [
            {
              by: 'MAPLE chant sheet (after Sheng-yen)',
              text: 'There is no preference, information, patterning or consciousness;',
              alignTo: [-1, -1, 0, 2, 4, -1, 6, 7],
              license: 'MAPLE community chant sheet, adapted from Master Sheng-yen\'s translation',
            },
            {
              by: 'Conze (1958)',
              text: 'no feeling, no perception, no impulse, no consciousness;',
              alignTo: [0, 2, 0, 4, 0, 6, 0, 7],
              url: 'https://en.wikipedia.org/wiki/Heart_Sutra',
            },
            {
              by: 'Red Pine (2004)',
              text: 'no sensation, no perception, no memory, and no consciousness;',
              alignTo: [0, 2, 0, 4, 0, 6, -1, 0, 7],
              url: 'https://www.counterpointpress.com/dd-product/the-heart-sutra/',
              license: 'Quoted with attribution',
            },
            {
              by: 'Thich Nhat Hanh (2014)',
              text: 'no Feelings, no Perceptions, no Mental Formations, no Consciousness',
              alignTo: [0, 2, 0, 4, 0, -1, 6, 0, 7],
              url: 'https://plumvillage.org/sutra/the-other-shore',
              license: 'Plum Village translation, quoted with attribution',
            },
          ],
          words: [
            { form: 'na', scriptAlt: 'न', pronunciation: 'nah', gloss: 'no' },
            {
              form: 'vedanā',
              scriptAlt: 'वेदना',
              scriptAlts: { 'zh-Hant': '受', 'ja-Jpan': '受', 'bo-Tibt': 'ཚོར་བ' },
              pronunciation: 'vay-dah-NAH',
              etymology: '√vid "to feel, know" → *vedanā* "feeling, sensation"',
              gloss: 'feeling, sensation — the affective tone (pleasant / unpleasant / neutral) attached to experience; the second skandha',
            },
            { form: 'na', scriptAlt: 'न', pronunciation: 'nah', gloss: 'no' },
            {
              form: 'saṃjñā',
              scriptAlt: 'संज्ञा',
              scriptAlts: { 'zh-Hant': '想', 'ja-Jpan': '想', 'bo-Tibt': 'འདུ་ཤེས' },
              pronunciation: 'sahm-GYAH',
              etymology: '*saṃ-* "together" + √jñā "to know" — "co-cognition, identification"',
              gloss: 'perception, recognition — the act of naming/identifying; the third skandha',
            },
            { form: 'na', scriptAlt: 'न', pronunciation: 'nah', gloss: 'no' },
            {
              form: 'saṃskārāḥ',
              scriptAlt: 'संस्काराः',
              scriptAlts: { 'zh-Hant': '行', 'ja-Jpan': '行', 'bo-Tibt': 'འདུ་བྱེད' },
              pronunciation: 'sahm-SKAH-rah',
              etymology: '*saṃ-* "together" + √kṛ "to make" — "co-construction, formation"',
              gloss: 'mental formations — volitional patterns, dispositions, karmic seeds; the fourth skandha',
            },
            { form: 'na', scriptAlt: 'न', pronunciation: 'nah', gloss: 'no' },
            {
              form: 'vijñānam',
              scriptAlt: 'विज्ञानम्',
              scriptAlts: { 'zh-Hant': '識', 'ja-Jpan': '識', 'bo-Tibt': 'རྣམ་པར་ཤེས་པ' },
              pronunciation: 'veej-NYAH-nahm',
              etymology: '*vi-* "discriminating" + √jñā "to know" — "discriminating knowing"',
              gloss: 'consciousness — discriminating awareness, the fifth skandha',
            },
          ],
        },

        // ── 無眼耳鼻舌身意 — no eye, ear, nose, tongue, body, mind ──
        {
          id: 'middle-no-six-faculties',
          pali: 'na cakṣur na śrotraṃ na ghrāṇaṃ na jihvā na kāyo na manaḥ',
          paliDeva: 'न चक्षुर्न श्रोत्रं न घ्राणं न जिह्वा न कायो न मनः',
          scripts: [
            { lang: 'sa-Latn', label: 'Sanskrit (IAST)', text: 'na cakṣur na śrotraṃ na ghrāṇaṃ na jihvā na kāyo na manaḥ' },
            { lang: 'sa-Deva', label: 'Sanskrit (Devanāgarī)', text: 'न चक्षुर्न श्रोत्रं न घ्राणं न जिह्वा न कायो न मनः', transliteration: 'na cakṣur na śrotraṃ na ghrāṇaṃ na jihvā na kāyo na manaḥ' },
            {
              lang: 'zh-Hant',
              label: 'Chinese (Xuanzang)',
              text: '無眼耳鼻舌身意',
              source: 'T251',
              tokens: ['無', '眼', '耳', '鼻', '舌', '身', '意'],
              transliteration: 'wú yǎn ěr bí shé shēn yì  (Mandarin pinyin)',
            },
            {
              lang: 'ja-Jpan',
              label: 'Japanese (Sino-Japanese)',
              text: '無眼耳鼻舌身意',
              source: 'Hannya Shingyō',
              tokens: ['無', '眼', '耳', '鼻', '舌', '身', '意'],
              transliteration: 'mu gen ni bi zes shin i  (Sino-Japanese)',
            },
            {
              lang: 'bo-Tibt',
              label: 'Tibetan',
              text: 'མིག་མེད་རྣ་བ་མེད་སྣ་མེད་ལྕེ་མེད་ལུས་མེད་ཡིད་མེད',
              source: 'Kangyur',
              transliteration: 'mik mé na-wa mé na mé ché mé lü mé yi mé  (Lhasa Tibetan)',
            },
          ],
          witnesses: [
            {
              by: 'MAPLE chant sheet (after Sheng-yen)',
              text: 'no eye, ear, nose, tongue, body, or mind;',
              alignTo: [0, 1, 3, 5, 7, 9, -1, 11],
              license: 'MAPLE community chant sheet, adapted from Master Sheng-yen\'s translation',
            },
            {
              by: 'Conze (1958)',
              text: 'no eye, ear, nose, tongue, body, mind;',
              alignTo: [0, 1, 3, 5, 7, 9, 11],
              url: 'https://en.wikipedia.org/wiki/Heart_Sutra',
            },
            {
              by: 'Red Pine (2004)',
              text: 'no eye, no ear, no nose, no tongue, no body, no mind;',
              alignTo: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
              url: 'https://www.counterpointpress.com/dd-product/the-heart-sutra/',
              license: 'Quoted with attribution',
            },
            {
              by: 'Thich Nhat Hanh (2014)',
              text: 'no Eye, no Ear, no Nose, no Tongue, no Body, no Mind;',
              alignTo: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
              url: 'https://plumvillage.org/sutra/the-other-shore',
              license: 'Plum Village translation, quoted with attribution',
            },
          ],
          words: [
            { form: 'na', scriptAlt: 'न', pronunciation: 'nah', gloss: 'no' },
            { form: 'cakṣur', scriptAlt: 'चक्षुर्', scriptAlts: { 'zh-Hant': '眼', 'ja-Jpan': '眼', 'bo-Tibt': 'མིག' }, pronunciation: 'CHAHK-shoor', gloss: 'eye' },
            { form: 'na', scriptAlt: 'न', pronunciation: 'nah', gloss: 'no' },
            { form: 'śrotraṃ', scriptAlt: 'श्रोत्रम्', scriptAlts: { 'zh-Hant': '耳', 'ja-Jpan': '耳', 'bo-Tibt': 'རྣ་བ' }, pronunciation: 'SHROH-trahm', gloss: 'ear' },
            { form: 'na', scriptAlt: 'न', pronunciation: 'nah', gloss: 'no' },
            { form: 'ghrāṇaṃ', scriptAlt: 'घ्राणम्', scriptAlts: { 'zh-Hant': '鼻', 'ja-Jpan': '鼻', 'bo-Tibt': 'སྣ' }, pronunciation: 'GHRAH-nahm', gloss: 'nose' },
            { form: 'na', scriptAlt: 'न', pronunciation: 'nah', gloss: 'no' },
            { form: 'jihvā', scriptAlt: 'जिह्वा', scriptAlts: { 'zh-Hant': '舌', 'ja-Jpan': '舌', 'bo-Tibt': 'ལྕེ' }, pronunciation: 'JEEH-vah', gloss: 'tongue' },
            { form: 'na', scriptAlt: 'न', pronunciation: 'nah', gloss: 'no' },
            { form: 'kāyo', scriptAlt: 'कायो', scriptAlts: { 'zh-Hant': '身', 'ja-Jpan': '身', 'bo-Tibt': 'ལུས' }, pronunciation: 'KAH-yoh', gloss: 'body' },
            { form: 'na', scriptAlt: 'न', pronunciation: 'nah', gloss: 'no' },
            { form: 'manaḥ', scriptAlt: 'मनः', scriptAlts: { 'zh-Hant': '意', 'ja-Jpan': '意', 'bo-Tibt': 'ཡིད' }, pronunciation: 'MAH-nah', gloss: 'mind — the sixth sense-faculty in the Indian schema (along with the five senses)' },
          ],
        },

        // ── 無色聲香味觸法 — no sight, sound, smell, taste, touch, thought ──
        {
          id: 'middle-no-six-objects',
          pali: 'na rūpaṃ na śabdo na gandho na raso na spraṣṭavyaṃ na dharmāḥ',
          paliDeva: 'न रूपं न शब्दो न गन्धो न रसो न स्प्रष्टव्यं न धर्माः',
          scripts: [
            { lang: 'sa-Latn', label: 'Sanskrit (IAST)', text: 'na rūpaṃ na śabdo na gandho na raso na spraṣṭavyaṃ na dharmāḥ' },
            { lang: 'sa-Deva', label: 'Sanskrit (Devanāgarī)', text: 'न रूपं न शब्दो न गन्धो न रसो न स्प्रष्टव्यं न धर्माः', transliteration: 'na rūpaṃ na śabdo na gandho na raso na spraṣṭavyaṃ na dharmāḥ' },
            {
              lang: 'zh-Hant',
              label: 'Chinese (Xuanzang)',
              text: '無色聲香味觸法',
              source: 'T251',
              tokens: ['無', '色', '聲', '香', '味', '觸', '法'],
              transliteration: 'wú sè shēng xiāng wèi chù fǎ  (Mandarin pinyin)',
            },
            {
              lang: 'ja-Jpan',
              label: 'Japanese (Sino-Japanese)',
              text: '無色聲香味觸法',
              source: 'Hannya Shingyō',
              tokens: ['無', '色', '聲', '香', '味', '觸', '法'],
              transliteration: 'mu shiki shō kō mi soku hō  (Sino-Japanese)',
            },
            {
              lang: 'bo-Tibt',
              label: 'Tibetan',
              text: 'གཟུགས་མེད་སྒྲ་མེད་དྲི་མེད་རོ་མེད་རེག་བྱ་མེད་ཆོས་མེད',
              source: 'Kangyur',
              transliteration: 'zuk mé dra mé dri mé ro mé reg-ja mé chö mé  (Lhasa Tibetan)',
            },
          ],
          witnesses: [
            {
              by: 'MAPLE chant sheet (after Sheng-yen)',
              text: 'no sight, sound, smell, taste, touch, or thought;',
              alignTo: [0, 1, 3, 5, 7, 9, -1, 11],
              license: 'MAPLE community chant sheet, adapted from Master Sheng-yen\'s translation',
            },
            {
              by: 'Conze (1958)',
              text: 'no forms, sounds, smells, tastes, touchables or objects of mind;',
              alignTo: [0, 1, 3, 5, 7, 9, -1, 11, -1, -1],
              url: 'https://en.wikipedia.org/wiki/Heart_Sutra',
            },
            {
              by: 'Red Pine (2004)',
              text: 'no shape, no sound, no smell, no taste, no feeling, and no thought;',
              alignTo: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, -1, 10, 11],
              url: 'https://www.counterpointpress.com/dd-product/the-heart-sutra/',
              license: 'Quoted with attribution',
            },
            {
              by: 'Thich Nhat Hanh (2014)',
              text: 'no Form, no Sound, no Smell, no Taste, no Touch, no Object of Mind;',
              alignTo: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, -1, -1, 11],
              url: 'https://plumvillage.org/sutra/the-other-shore',
              license: 'Plum Village translation, quoted with attribution',
            },
          ],
          words: [
            { form: 'na', scriptAlt: 'न', pronunciation: 'nah', gloss: 'no' },
            { form: 'rūpaṃ', scriptAlt: 'रूपम्', scriptAlts: { 'zh-Hant': '色', 'ja-Jpan': '色', 'bo-Tibt': 'གཟུགས' }, pronunciation: 'ROO-pahm', gloss: 'visible form, sight' },
            { form: 'na', scriptAlt: 'न', pronunciation: 'nah', gloss: 'no' },
            { form: 'śabdo', scriptAlt: 'शब्दो', scriptAlts: { 'zh-Hant': '聲', 'ja-Jpan': '聲', 'bo-Tibt': 'སྒྲ' }, pronunciation: 'SHAHB-doh', gloss: 'sound' },
            { form: 'na', scriptAlt: 'न', pronunciation: 'nah', gloss: 'no' },
            { form: 'gandho', scriptAlt: 'गन्धो', scriptAlts: { 'zh-Hant': '香', 'ja-Jpan': '香', 'bo-Tibt': 'དྲི' }, pronunciation: 'GAHN-dhoh', gloss: 'smell, scent' },
            { form: 'na', scriptAlt: 'न', pronunciation: 'nah', gloss: 'no' },
            { form: 'raso', scriptAlt: 'रसो', scriptAlts: { 'zh-Hant': '味', 'ja-Jpan': '味', 'bo-Tibt': 'རོ' }, pronunciation: 'RAH-soh', gloss: 'taste, flavour' },
            { form: 'na', scriptAlt: 'न', pronunciation: 'nah', gloss: 'no' },
            { form: 'spraṣṭavyaṃ', scriptAlt: 'स्प्रष्टव्यम्', scriptAlts: { 'zh-Hant': '觸', 'ja-Jpan': '觸', 'bo-Tibt': 'རེག་བྱ' }, pronunciation: 'sprahsh-TAHV-yahm', gloss: 'touch — that which can be touched (gerundive of √spṛś)' },
            { form: 'na', scriptAlt: 'न', pronunciation: 'nah', gloss: 'no' },
            { form: 'dharmāḥ', scriptAlt: 'धर्माः', scriptAlts: { 'zh-Hant': '法', 'ja-Jpan': '法', 'bo-Tibt': 'ཆོས' }, pronunciation: 'DHAR-mah', gloss: 'mental objects, dharmas — the objects of the mind-faculty, sixth in the sense-object schema' },
          ],
        },

        // ── 無眼界 乃至 無意識界 — no eye-realm... to no mind-consciousness-realm ──
        {
          id: 'middle-no-dhatus',
          pali: 'na cakṣurdhātur yāvan na manovijñānadhātuḥ',
          paliDeva: 'न चक्षुर्धातुर्यावन्न मनोविज्ञानधातुः',
          scripts: [
            { lang: 'sa-Latn', label: 'Sanskrit (IAST)', text: 'na cakṣurdhātur yāvan na manovijñānadhātuḥ' },
            { lang: 'sa-Deva', label: 'Sanskrit (Devanāgarī)', text: 'न चक्षुर्धातुर्यावन्न मनोविज्ञानधातुः', transliteration: 'na cakṣurdhātur yāvan na manovijñānadhātuḥ' },
            {
              lang: 'zh-Hant',
              label: 'Chinese (Xuanzang)',
              text: '無眼界 乃至 無意識界',
              source: 'T251',
              tokens: ['無', '眼界', '乃至', '無', '意識界'],
              transliteration: 'wú yǎn-jiè nǎi-zhì wú yì-shì-jiè  (Mandarin pinyin)',
            },
            {
              lang: 'ja-Jpan',
              label: 'Japanese (Sino-Japanese)',
              text: '無眼界 乃至 無意識界',
              source: 'Hannya Shingyō',
              tokens: ['無', '眼界', '乃至', '無', '意識界'],
              transliteration: 'mu gen-kai nai-shi mu i-shiki-kai  (Sino-Japanese)',
            },
            {
              lang: 'bo-Tibt',
              label: 'Tibetan',
              text: 'མིག་གི་ཁམས་མེད་པ་ནས་ཡིད་ཀྱི་རྣམ་པར་ཤེས་པའི་ཁམས་མེད་པའི་བར་དུ',
              source: 'Kangyur',
              transliteration: 'mik-gi kham mé-pa né yi-kyi nam-par shé-pé kham mé-pé bar-du  (Lhasa Tibetan)',
            },
          ],
          witnesses: [
            {
              by: 'MAPLE chant sheet (after Sheng-yen)',
              text: 'there is no realm of the eye, through to no realm of mental cognition;',
              alignTo: [-1, -1, 0, -1, -1, -1, 1, 2, 2, 3, -1, -1, 4, 4],
              license: 'MAPLE community chant sheet, adapted from Master Sheng-yen\'s translation',
            },
            {
              by: 'Conze (1958)',
              text: 'no sight-organ element, and so forth, until we come to: no mind-consciousness element;',
              alignTo: [0, 1, 1, 2, 2, 2, 2, 2, 2, 2, 3, 4, 4],
              url: 'https://en.wikipedia.org/wiki/Heart_Sutra',
            },
            {
              by: 'Red Pine (2004)',
              text: 'no element of perception, from eye to conceptual consciousness;',
              alignTo: [0, 1, -1, 1, 2, 1, 2, 4, 4],
              url: 'https://www.counterpointpress.com/dd-product/the-heart-sutra/',
              license: 'Quoted with attribution',
            },
            {
              by: 'Thich Nhat Hanh (2014)',
              text: 'The Eighteen Realms of Phenomena which are the six Sense Organs, the six Sense Objects, and the six Consciousnesses do not exist as separate self entities;',
              alignTo: [-1, -1, 1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 4, 0, 0, -1, -1, -1, -1, -1],
              url: 'https://plumvillage.org/sutra/the-other-shore',
              license: 'Plum Village translation, quoted with attribution',
            },
          ],
          words: [
            { form: 'na', scriptAlt: 'न', pronunciation: 'nah', gloss: 'no' },
            {
              form: 'cakṣurdhātur',
              scriptAlt: 'चक्षुर्धातुः',
              scriptAlts: { 'zh-Hant': '眼界', 'ja-Jpan': '眼界', 'bo-Tibt': 'མིག་གི་ཁམས' },
              pronunciation: 'CHAHK-shoor-DHAH-toor',
              etymology: '*cakṣur* "eye" + *dhātu* "element, realm"',
              gloss: 'eye-realm — the first of the eighteen dhātus',
              morphemes: [
                { text: 'cakṣur', type: 'stem', gloss: 'eye', pronunciation: 'CHAHK-shoor' },
                { text: 'dhātur', type: 'suffix', gloss: 'realm, element', pronunciation: 'DHAH-toor' },
              ],
            },
            { form: 'yāvan', scriptAlt: 'यावन्', scriptAlts: { 'zh-Hant': '乃至', 'ja-Jpan': '乃至', 'bo-Tibt': 'བར་དུ' }, pronunciation: 'YAH-vahn', gloss: 'up to, as far as — the "etcetera" particle marking the elided middle of the eighteen' },
            { form: 'na', scriptAlt: 'न', pronunciation: 'nah', gloss: 'no' },
            {
              form: 'manovijñānadhātuḥ',
              scriptAlt: 'मनोविज्ञानधातुः',
              scriptAlts: { 'zh-Hant': '意識界', 'ja-Jpan': '意識界', 'bo-Tibt': 'ཡིད་ཀྱི་རྣམ་པར་ཤེས་པའི་ཁམས' },
              pronunciation: 'mah-noh-veej-NYAH-nah-DHAH-too',
              etymology: '*manas* "mind" + *vijñāna* "consciousness" + *dhātu* "realm"',
              gloss: 'mind-consciousness-realm — the last of the eighteen dhātus',
              morphemes: [
                { text: 'mano', type: 'prefix', gloss: 'mind', pronunciation: 'MAH-noh' },
                { text: 'vijñāna', type: 'stem', gloss: 'consciousness', pronunciation: 'veej-NYAH-nah' },
                { text: 'dhātuḥ', type: 'suffix', gloss: 'realm', pronunciation: 'DHAH-too' },
              ],
            },
          ],
        },

        // ── 無無明 亦無無明盡 — no ignorance and no end of ignorance ──
        {
          id: 'middle-no-ignorance',
          pali: 'na avidyā na avidyākṣayo',
          paliDeva: 'न अविद्या न अविद्याक्षयो',
          scripts: [
            { lang: 'sa-Latn', label: 'Sanskrit (IAST)', text: 'na avidyā na avidyākṣayo' },
            { lang: 'sa-Deva', label: 'Sanskrit (Devanāgarī)', text: 'न अविद्या न अविद्याक्षयो', transliteration: 'na avidyā na avidyākṣayo' },
            {
              lang: 'zh-Hant',
              label: 'Chinese (Xuanzang)',
              text: '無無明 亦無無明盡',
              source: 'T251',
              tokens: ['無', '無明', '亦', '無', '無明', '盡'],
              transliteration: 'wú wú-míng yì wú wú-míng jìn  (Mandarin pinyin)',
            },
            {
              lang: 'ja-Jpan',
              label: 'Japanese (Sino-Japanese)',
              text: '無無明 亦無無明盡',
              source: 'Hannya Shingyō',
              tokens: ['無', '無明', '亦', '無', '無明', '盡'],
              transliteration: 'mu mu-myō yaku mu mu-myō jin  (Sino-Japanese)',
            },
            {
              lang: 'bo-Tibt',
              label: 'Tibetan',
              text: 'མ་རིག་པ་མེད་མ་རིག་པ་ཟད་པ་མེད་པ',
              source: 'Kangyur',
              transliteration: 'ma-rig-pa mé ma-rig-pa zé-pa mé-pa  (Lhasa Tibetan)',
            },
          ],
          witnesses: [
            {
              by: 'MAPLE chant sheet (after Sheng-yen)',
              text: 'there is no ignorance and no end of ignorance,',
              alignTo: [-1, -1, -1, 1, -1, -1, -1, -1, 1],
              license: 'MAPLE community chant sheet, adapted from Master Sheng-yen\'s translation',
            },
            {
              by: 'Conze (1958)',
              text: 'no ignorance, no extinction of ignorance,',
              alignTo: [0, 1, 0, -1, -1, 1],
              url: 'https://en.wikipedia.org/wiki/Heart_Sutra',
            },
            {
              by: 'Red Pine (2004)',
              text: 'no ignorance or end of ignorance,',
              alignTo: [0, 1, -1, -1, -1, 1],
              url: 'https://www.counterpointpress.com/dd-product/the-heart-sutra/',
              license: 'Quoted with attribution',
            },
            {
              by: 'Thich Nhat Hanh (2014)',
              text: 'there is no Ignorance, and no End of Ignorance,',
              alignTo: [-1, -1, 0, 1, -1, -1, -1, -1, 1],
              url: 'https://plumvillage.org/sutra/the-other-shore',
              license: 'Plum Village translation, quoted with attribution',
            },
          ],
          words: [
            { form: 'na', scriptAlt: 'न', pronunciation: 'nah', gloss: 'no' },
            {
              form: 'avidyā',
              scriptAlt: 'अविद्या',
              scriptAlts: { 'zh-Hant': '無明', 'ja-Jpan': '無明', 'bo-Tibt': 'མ་རིག་པ' },
              pronunciation: 'ah-VEED-yah',
              etymology: '*a-* "not" + *vidyā* "knowledge"',
              gloss: 'ignorance — the first link of the twelve nidānas of dependent origination',
              morphemes: [
                { text: 'a', type: 'prefix', gloss: 'not', pronunciation: 'ah' },
                { text: 'vidyā', type: 'stem', root: '√vid', gloss: 'knowledge', pronunciation: 'VEED-yah' },
              ],
            },
            { form: 'na', scriptAlt: 'न', pronunciation: 'nah', gloss: 'no' },
            {
              form: 'avidyākṣayo',
              scriptAlt: 'अविद्याक्षयो',
              scriptAlts: { 'zh-Hant': '無明盡', 'ja-Jpan': '無明盡', 'bo-Tibt': 'མ་རིག་པ་ཟད་པ' },
              pronunciation: 'ah-VEED-yah-KSHAH-yoh',
              etymology: '*avidyā* "ignorance" + *kṣaya* "ending, exhaustion"',
              gloss: 'end of ignorance — both the cause and its cessation are negated',
            },
          ],
        },

        // ── 乃至 無老死 亦無老死盡 — through to no aging-death and no end of aging-death ──
        {
          id: 'middle-no-aging-death',
          pali: 'yāvan na jarāmaraṇaṃ na jarāmaraṇakṣayaḥ',
          paliDeva: 'यावन्न जरामरणं न जरामरणक्षयः',
          scripts: [
            { lang: 'sa-Latn', label: 'Sanskrit (IAST)', text: 'yāvan na jarāmaraṇaṃ na jarāmaraṇakṣayaḥ' },
            { lang: 'sa-Deva', label: 'Sanskrit (Devanāgarī)', text: 'यावन्न जरामरणं न जरामरणक्षयः', transliteration: 'yāvan na jarāmaraṇaṃ na jarāmaraṇakṣayaḥ' },
            {
              lang: 'zh-Hant',
              label: 'Chinese (Xuanzang)',
              text: '乃至 無老死 亦無老死盡',
              source: 'T251',
              tokens: ['乃至', '無', '老死', '亦', '無', '老死', '盡'],
              transliteration: 'nǎi-zhì wú lǎo-sǐ yì wú lǎo-sǐ jìn  (Mandarin pinyin)',
            },
            {
              lang: 'ja-Jpan',
              label: 'Japanese (Sino-Japanese)',
              text: '乃至 無老死 亦無老死盡',
              source: 'Hannya Shingyō',
              tokens: ['乃至', '無', '老死', '亦', '無', '老死', '盡'],
              transliteration: 'nai-shi mu rō-shi yaku mu rō-shi jin  (Sino-Japanese)',
            },
            {
              lang: 'bo-Tibt',
              label: 'Tibetan',
              text: 'རྒ་ཤི་མེད་ཅིང་རྒ་ཤི་ཟད་པ་མེད་པའི་བར་དུ',
              source: 'Kangyur',
              transliteration: 'ga-shi mé-ching ga-shi zé-pa mé-pé bar-du  (Lhasa Tibetan)',
            },
          ],
          witnesses: [
            {
              by: 'MAPLE chant sheet (after Sheng-yen)',
              text: 'through to no aging and death and no end of aging and death;',
              alignTo: [0, 0, 1, 2, 2, 2, -1, 3, 4, 4, 4, 4, 4],
              license: 'MAPLE community chant sheet, adapted from Master Sheng-yen\'s translation',
            },
            {
              by: 'Conze (1958)',
              text: 'and so forth, until we come to: no decay and death, no extinction of decay and death,',
              alignTo: [0, 0, 0, 0, 0, 0, 0, 1, 2, 2, 2, 3, 4, 4, 4, 4, 4],
              url: 'https://en.wikipedia.org/wiki/Heart_Sutra',
            },
            {
              by: 'Red Pine (2004)',
              text: 'and so forth until no old age and death or end of old age and death;',
              alignTo: [0, 0, 0, 0, 1, 2, 2, 2, 2, -1, 4, 4, 4, 4, 4, 4],
              url: 'https://www.counterpointpress.com/dd-product/the-heart-sutra/',
              license: 'Quoted with attribution',
            },
            {
              by: 'Thich Nhat Hanh (2014)',
              text: 'all the way to no Old Age and Death, and no End of Old Age and Death;',
              alignTo: [-1, -1, -1, -1, -1, 2, -1, 2, -1, -1, -1, -1, -1, -1, 2, -1, -1],
              url: 'https://plumvillage.org/sutra/the-other-shore',
              license: 'Plum Village translation, quoted with attribution',
            },
          ],
          words: [
            { form: 'yāvan', scriptAlt: 'यावन्', scriptAlts: { 'zh-Hant': '乃至', 'ja-Jpan': '乃至' }, pronunciation: 'YAH-vahn', gloss: 'up to, as far as — marking the elided middle of the twelve nidānas' },
            { form: 'na', scriptAlt: 'न', pronunciation: 'nah', gloss: 'no' },
            {
              form: 'jarāmaraṇaṃ',
              scriptAlt: 'जरामरणम्',
              scriptAlts: { 'zh-Hant': '老死', 'ja-Jpan': '老死', 'bo-Tibt': 'རྒ་ཤི' },
              pronunciation: 'jah-RAH-mah-RAH-nahm',
              etymology: '*jarā* "aging" + *maraṇa* "death" — the final, twelfth link of dependent origination',
              gloss: 'aging-and-death — the final link in the twelve nidānas of dependent origination',
              morphemes: [
                { text: 'jarā', type: 'stem', gloss: 'aging', pronunciation: 'jah-RAH' },
                { text: 'maraṇaṃ', type: 'suffix', gloss: 'death', pronunciation: 'mah-RAH-nahm' },
              ],
            },
            { form: 'na', scriptAlt: 'न', pronunciation: 'nah', gloss: 'no' },
            {
              form: 'jarāmaraṇakṣayaḥ',
              scriptAlt: 'जरामरणक्षयः',
              scriptAlts: { 'zh-Hant': '老死盡', 'ja-Jpan': '老死盡' },
              pronunciation: 'jah-RAH-mah-RAH-nah-KSHAH-yah',
              etymology: '*jarā-maraṇa* "aging-death" + *kṣaya* "ending"',
              gloss: 'end of aging-and-death — both the chain and its cessation are negated',
            },
          ],
        },

        // ── 無苦集滅道 — no suffering, arising, cessation, path ──
        {
          id: 'middle-no-four-truths',
          pali: 'na duḥkha-samudaya-nirodha-mārgāḥ',
          paliDeva: 'न दुःखसमुदयनिरोधमार्गाः',
          scripts: [
            { lang: 'sa-Latn', label: 'Sanskrit (IAST)', text: 'na duḥkha-samudaya-nirodha-mārgāḥ' },
            { lang: 'sa-Deva', label: 'Sanskrit (Devanāgarī)', text: 'न दुःखसमुदयनिरोधमार्गाः', transliteration: 'na duḥkha-samudaya-nirodha-mārgāḥ' },
            {
              lang: 'zh-Hant',
              label: 'Chinese (Xuanzang)',
              text: '無苦集滅道',
              source: 'T251',
              tokens: ['無', '苦', '集', '滅', '道'],
              transliteration: 'wú kǔ jí miè dào  (Mandarin pinyin)',
            },
            {
              lang: 'ja-Jpan',
              label: 'Japanese (Sino-Japanese)',
              text: '無苦集滅道',
              source: 'Hannya Shingyō',
              tokens: ['無', '苦', '集', '滅', '道'],
              transliteration: 'mu ku shū metsu dō  (Sino-Japanese)',
            },
            {
              lang: 'bo-Tibt',
              label: 'Tibetan',
              text: 'སྡུག་བསྔལ་མེད་ཀུན་འབྱུང་མེད་འགོག་པ་མེད་ལམ་མེད',
              source: 'Kangyur',
              transliteration: 'duk-ngal mé kün-jung mé gok-pa mé lam mé  (Lhasa Tibetan)',
            },
          ],
          witnesses: [
            {
              by: 'MAPLE chant sheet (after Sheng-yen)',
              text: 'there is no suffering, no arising, no cessation, and no path;',
              alignTo: [-1, -1, 0, 1, 0, 2, 0, 3, -1, 0, 4],
              license: 'MAPLE community chant sheet, adapted from Master Sheng-yen\'s translation',
            },
            {
              by: 'Conze (1958)',
              text: 'there is no suffering, no origination, no stopping, no path,',
              alignTo: [-1, -1, 0, 1, 0, 2, 0, 3, 0, 4],
              url: 'https://en.wikipedia.org/wiki/Heart_Sutra',
            },
            {
              by: 'Red Pine (2004)',
              text: 'no suffering, no source, no relief, no path;',
              alignTo: [-1, 1, -1, 2, -1, 3, -1, 4],
              url: 'https://www.counterpointpress.com/dd-product/the-heart-sutra/',
              license: 'Quoted with attribution',
            },
            {
              by: 'Thich Nhat Hanh (2014)',
              text: 'neither is there Ill-being, nor a Cause of Ill-being, nor the End of Ill-being, nor a Path which leads to the End of Ill-being.',
              alignTo: [-1, -1, -1, 1, -1, -1, 2, -1, -1, -1, -1, 3, -1, -1, -1, -1, 4, -1, -1, -1, -1, -1, -1, -1],
              url: 'https://plumvillage.org/sutra/the-other-shore',
              license: 'Plum Village translation, quoted with attribution',
            },
          ],
          words: [
            { form: 'na', scriptAlt: 'न', pronunciation: 'nah', gloss: 'no' },
            { form: 'duḥkha', scriptAlt: 'दुःख', scriptAlts: { 'zh-Hant': '苦', 'ja-Jpan': '苦', 'bo-Tibt': 'སྡུག་བསྔལ' }, pronunciation: 'DOOH-khah', gloss: 'suffering — the First Noble Truth' },
            { form: 'samudaya', scriptAlt: 'समुदय', scriptAlts: { 'zh-Hant': '集', 'ja-Jpan': '集', 'bo-Tibt': 'ཀུན་འབྱུང' }, pronunciation: 'sah-MOO-dah-yah', gloss: 'arising, origin — the Second Noble Truth (the cause of suffering)' },
            { form: 'nirodha', scriptAlt: 'निरोध', scriptAlts: { 'zh-Hant': '滅', 'ja-Jpan': '滅', 'bo-Tibt': 'འགོག་པ' }, pronunciation: 'nee-ROH-dhah', gloss: 'cessation — the Third Noble Truth' },
            { form: 'mārgāḥ', scriptAlt: 'मार्गाः', scriptAlts: { 'zh-Hant': '道', 'ja-Jpan': '道', 'bo-Tibt': 'ལམ' }, pronunciation: 'MAHR-gah', gloss: 'path — the Fourth Noble Truth, the eightfold path' },
          ],
        },

        // ── 無智亦無得 — no wisdom no attainment ──
        {
          id: 'middle-no-wisdom-no-attainment',
          pali: 'na jñānaṃ na prāptiḥ',
          paliDeva: 'न ज्ञानं न प्राप्तिः',
          scripts: [
            { lang: 'sa-Latn', label: 'Sanskrit (IAST)', text: 'na jñānaṃ na prāptiḥ' },
            { lang: 'sa-Deva', label: 'Sanskrit (Devanāgarī)', text: 'न ज्ञानं न प्राप्तिः', transliteration: 'na jñānaṃ na prāptiḥ' },
            {
              lang: 'zh-Hant',
              label: 'Chinese (Xuanzang)',
              text: '無智亦無得',
              source: 'T251',
              tokens: ['無', '智', '亦', '無', '得'],
              transliteration: 'wú zhì yì wú dé  (Mandarin pinyin)',
            },
            {
              lang: 'ja-Jpan',
              label: 'Japanese (Sino-Japanese)',
              text: '無智亦無得',
              source: 'Hannya Shingyō',
              tokens: ['無', '智', '亦', '無', '得'],
              transliteration: 'mu chi yaku mu toku  (Sino-Japanese)',
            },
            {
              lang: 'bo-Tibt',
              label: 'Tibetan',
              text: 'ཡེ་ཤེས་མེད་ཐོབ་པ་མེད',
              source: 'Kangyur',
              transliteration: 'yé-shé mé top-pa mé  (Lhasa Tibetan)',
            },
          ],
          witnesses: [
            {
              by: 'MAPLE chant sheet (after Sheng-yen)',
              text: 'there is no attainment and no realization',
              alignTo: [-1, -1, -1, 3, -1, -1, 1],
              license: 'MAPLE community chant sheet, adapted from Master Sheng-yen\'s translation',
            },
            {
              by: 'Conze (1958)',
              text: 'there is no cognition, no attainment',
              alignTo: [-1, -1, -1, 1, -1, 3],
              url: 'https://en.wikipedia.org/wiki/Heart_Sutra',
            },
            {
              by: 'Red Pine (2004)',
              text: 'no knowledge and no attainment.',
              alignTo: [0, 1, -1, 0, 3],
              url: 'https://www.counterpointpress.com/dd-product/the-heart-sutra/',
              license: 'Quoted with attribution',
            },
            {
              by: 'Thich Nhat Hanh (2014)',
              text: 'Whoever can see this no longer needs anything to attain.',
              alignTo: [-1, -1, 1, -1, 0, -1, -1, 3, -1, 3],
              url: 'https://plumvillage.org/sutra/the-other-shore',
              license: 'Plum Village translation, quoted with attribution',
            },
          ],
          words: [
            { form: 'na', scriptAlt: 'न', pronunciation: 'nah', gloss: 'no' },
            {
              form: 'jñānaṃ',
              scriptAlt: 'ज्ञानम्',
              scriptAlts: { 'zh-Hant': '智', 'ja-Jpan': '智', 'bo-Tibt': 'ཡེ་ཤེས' },
              pronunciation: 'GYAH-nahm',
              etymology: '√jñā "to know" → *jñāna* "knowledge"',
              gloss: 'wisdom, knowledge — pristine awareness, distinct from prajñā (the path-faculty)',
            },
            { form: 'na', scriptAlt: 'न', pronunciation: 'nah', gloss: 'no' },
            {
              form: 'prāptiḥ',
              scriptAlt: 'प्राप्तिः',
              scriptAlts: { 'zh-Hant': '得', 'ja-Jpan': '得', 'bo-Tibt': 'ཐོབ་པ' },
              pronunciation: 'PRAHP-tee',
              etymology: '*pra-* + √āp "to obtain" → *prāpti* "attainment"',
              gloss: 'attainment — the soteriological goal, here negated',
            },
          ],
        },

        // ── 以無所得故 — because there is nothing to attain ──
        {
          id: 'middle-because-no-attainment',
          pali: 'tasmād aprāptitvāt',
          paliDeva: 'तस्मादप्राप्तित्वात्',
          scripts: [
            { lang: 'sa-Latn', label: 'Sanskrit (IAST)', text: 'tasmād aprāptitvāt' },
            { lang: 'sa-Deva', label: 'Sanskrit (Devanāgarī)', text: 'तस्मादप्राप्तित्वात्', transliteration: 'tasmād aprāptitvāt' },
            {
              lang: 'zh-Hant',
              label: 'Chinese (Xuanzang)',
              text: '以無所得故',
              source: 'T251',
              tokens: ['以', '無所得', '故'],
              transliteration: 'yǐ wú-suǒ-dé gù  (Mandarin pinyin)',
            },
            {
              lang: 'ja-Jpan',
              label: 'Japanese (Sino-Japanese)',
              text: '以無所得故',
              source: 'Hannya Shingyō',
              tokens: ['以', '無所得', '故'],
              transliteration: 'i mu-sho-toku ko  (Sino-Japanese)',
            },
            {
              lang: 'bo-Tibt',
              label: 'Tibetan',
              text: 'ཐོབ་པ་མེད་པའི་ཕྱིར',
              source: 'Kangyur',
              transliteration: 'top-pa mé-pé chir  (Lhasa Tibetan)',
            },
          ],
          witnesses: [
            {
              by: 'MAPLE chant sheet (after Sheng-yen)',
              text: '— by practicing no apprehension.',
              alignTo: [-1, -1, 1, -1, 1],
              license: 'MAPLE community chant sheet, adapted from Master Sheng-yen\'s translation',
            },
            {
              by: 'Conze (1958)',
              text: 'because there is nothing to be attained.',
              alignTo: [0, -1, -1, -1, -1, -1, 1],
              url: 'https://en.wikipedia.org/wiki/Heart_Sutra',
            },
            {
              by: 'Red Pine (2004)',
              text: 'And since they have nothing to attain,',
              alignTo: [-1, -1, -1, -1, -1, 1, -1],
              url: 'https://www.counterpointpress.com/dd-product/the-heart-sutra/',
              license: 'Quoted with attribution',
            },
          ],
          words: [
            { form: 'tasmād', scriptAlt: 'तस्माद्', scriptAlts: { 'zh-Hant': '故', 'ja-Jpan': '故' }, pronunciation: 'tahs-MAHD', gloss: 'therefore (ablative of *tat* "that")' },
            {
              form: 'aprāptitvāt',
              scriptAlt: 'अप्राप्तित्वात्',
              scriptAlts: { 'zh-Hant': '無所得', 'ja-Jpan': '無所得', 'bo-Tibt': 'ཐོབ་པ་མེད་པ' },
              pronunciation: 'ah-PRAHP-teet-vaht',
              etymology: '*a-* "not" + *prāpti* "attainment" + *-tva* "-ness" + *-āt* (ablative) — "from-the-not-being-of-attainment"',
              gloss: 'due to non-attainment — because there is nothing to attain',
              morphemes: [
                { text: 'a', type: 'prefix', gloss: 'not', pronunciation: 'ah' },
                { text: 'prāpti', type: 'stem', gloss: 'attainment', pronunciation: 'PRAHP-tee' },
                { text: 'tvāt', type: 'suffix', gloss: '-ness, due to (ablative)', pronunciation: 'TVAHT' },
              ],
            },
          ],
        },
      ],
    },

    // ─────────────────────────────────────────────────────────────────────
    // 2d. The result-section — no fear, ultimate nirvāṇa
    // ─────────────────────────────────────────────────────────────────────
    {
      id: 'bodhi-heart-result',
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
      id: 'bodhi-all-buddhas',
      shape: 'prose-commentary',
      body: 'All Buddhas past, present, and future\nlive by Prajna Paramita,\nattaining Anuttara Samyak Sambodhi.',
    },

    // ─────────────────────────────────────────────────────────────────────
    // 2f. MAPLE prose — Therefore know: the great spell · into the mantra
    // ─────────────────────────────────────────────────────────────────────
    {
      id: 'bodhi-great-mantra',
      shape: 'prose-commentary',
      body: 'Therefore know that Prajna Paramita is the great mantra, the wisdom mantra,\nthe unsurpassed mantra, the supreme mantra,\nwhich completely removes all suffering.\nThis is truth, not mere formality.\nTherefore set forth the Prajna Paramita mantra,\nset forth this mantra and proclaim:',
    },

    // ─────────────────────────────────────────────────────────────────────
    // 3. The dharani — sound-formula
    // ─────────────────────────────────────────────────────────────────────
    {
      id: 'dharani',
      shape: 'sound-formula',
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
        {
          lang: 'en',
          label: 'Plain English',
          text: 'gone, gone, gone-beyond, fully-gone-beyond — awakening, svāhā',
        },
      ],
    },


  ],
};

export default bodhiHeartSutra;

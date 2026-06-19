/**
 * PROTOTYPE DATA — the Heart Sutra opening-practice phrase, modeled in the
 * concept-aligned shape (`types/liturgyAlign.ts`).
 *
 * Source phrase (the one diagnosed as 63%-dead in Tibetan under the shipped
 * renderer):
 *   Sanskrit: gambhīrāṃ prajñāpāramitācaryāṃ caramāṇo
 *   Tibetan:  ཟབ་མོ་ཤེས་རབ་ཀྱི་ཕ་རོལ་ཏུ་ཕྱིན་པའི་སྤྱོད་པ་ལ་སྤྱོད་པ་ན
 *   Chinese:  行深般若波羅蜜多時  (Xuanzang, T251)
 *   English:  "while going deep into transcendent wisdom" (MAPLE, after Sheng-yen)
 *
 * Unit ids point into the live concept registry (data/concepts/heart-sutra.ts)
 * via `conceptId` where a global concept exists. Note: `u-practice` and
 * `u-practising` are DISTINCT units (distinct positions) that share ONE global
 * concept (`concept.practice-carya`) — the doubled √car the registry already
 * intentionally unifies. The ghost units (`u-of1/u-of2/u-in/u-while`) are
 * grammatical glue Tibetan/English supply and the Sanskrit compound omits.
 */

import type { AlignSegment } from '../../../types/liturgyAlign';

export const openingPracticeAligned: AlignSegment = {
  id: 'heart-sutra/opening-practice',
  gloss: 'while practising the deep practice of the perfection of wisdom',
  units: [
    { id: 'u-deep', gloss: 'deep, profound', conceptId: 'concept.deep-gambhira' },
    { id: 'u-wisdom', gloss: 'wisdom', conceptId: 'concept.wisdom-prajna' },
    { id: 'u-of1', gloss: 'of', ghost: true },
    { id: 'u-perfection', gloss: 'perfection — gone to the far shore', conceptId: 'concept.perfection-paramita' },
    { id: 'u-of2', gloss: 'of', ghost: true },
    { id: 'u-practice', gloss: 'the practice', conceptId: 'concept.practice-carya' },
    { id: 'u-in', gloss: 'engaged in', ghost: true },
    { id: 'u-practising', gloss: 'practising — actively moving in it', conceptId: 'concept.practice-carya' },
    { id: 'u-while', gloss: 'while, when', ghost: true },
  ],
  renderings: [
    {
      // Sanskrit shown in its own script (Devanāgarī); IAST is the pronunciation line (ɑ).
      lang: 'sa-Deva',
      label: 'Sanskrit',
      tokens: [
        { text: 'गम्भीरां', units: ['u-deep'], relation: 'semantic', pronunciation: 'gambhīrāṃ', segments: [
          { text: 'ग', pronunciation: 'ga', akshara: true },
          { text: 'म्भी', pronunciation: 'mbhī', akshara: true },
          { text: 'रां', pronunciation: 'rāṃ', akshara: true },
        ] },
        // One compound, three meanings — each akshara carries the morpheme it belongs to.
        {
          text: 'प्रज्ञापारमिताचर्यां', units: ['u-wisdom', 'u-perfection', 'u-practice'], relation: 'semantic',
          pronunciation: 'prajñāpāramitācaryāṃ',
          note: 'One compound: wisdom + perfection + practice, the "of" relations folded in.',
          segments: [
            { text: 'प्र', pronunciation: 'pra', akshara: true, units: ['u-wisdom'] },
            { text: 'ज्ञा', pronunciation: 'jñā', akshara: true, units: ['u-wisdom'] },
            { text: 'पा', pronunciation: 'pā', akshara: true, units: ['u-perfection'] },
            { text: 'र', pronunciation: 'ra', akshara: true, units: ['u-perfection'] },
            { text: 'मि', pronunciation: 'mi', akshara: true, units: ['u-perfection'] },
            { text: 'ता', pronunciation: 'tā', akshara: true, units: ['u-perfection'] },
            { text: 'च', pronunciation: 'ca', akshara: true, units: ['u-practice'] },
            { text: 'र्यां', pronunciation: 'ryāṃ', akshara: true, units: ['u-practice'] },
          ],
        },
        { text: 'चरमाणो', units: ['u-practising'], relation: 'semantic', pronunciation: 'caramāṇo', segments: [
          { text: 'च', pronunciation: 'ca', akshara: true },
          { text: 'र', pronunciation: 'ra', akshara: true },
          { text: 'मा', pronunciation: 'mā', akshara: true },
          { text: 'णो', pronunciation: 'ṇo', akshara: true },
        ] },
      ],
    },
    {
      lang: 'bo-Tibt',
      label: 'Tibetan',
      tokens: [
        { text: 'ཟབ་མོ', units: ['u-deep'], relation: 'semantic', pronunciation: 'zab-mo', segments: [
          { text: 'ཟབ', pronunciation: 'zab', gloss: 'deep' },
          { text: 'མོ', pronunciation: 'mo', gloss: 'makes it match "practice"', faint: true },
        ] },
        { text: 'ཤེས་རབ', units: ['u-wisdom'], relation: 'calque', pronunciation: 'she-rap', segments: [
          { text: 'ཤེས', pronunciation: 'shes', gloss: 'knowing' },
          { text: 'རབ', pronunciation: 'rap', gloss: 'supreme' },
        ] },
        { text: 'ཀྱི', units: ['u-of1'], relation: 'ghost', pronunciation: 'kyi' },
        { text: 'ཕ་རོལ་ཏུ་ཕྱིན་པ', units: ['u-perfection'], relation: 'calque', pronunciation: 'pa-rol-tu-chin-pa', segments: [
          { text: 'ཕ', pronunciation: 'pa', gloss: 'far' },
          { text: 'རོལ', pronunciation: 'rol', gloss: 'shore' },
          { text: 'ཏུ', pronunciation: 'tu', gloss: 'to', faint: true },
          { text: 'ཕྱིན', pronunciation: 'chin', gloss: 'gone' },
          { text: 'པ', pronunciation: 'pa', gloss: 'makes it a noun', faint: true },
        ] },
        { text: 'འི', units: ['u-of2'], relation: 'ghost', pronunciation: 'i' },
        { text: 'སྤྱོད་པ', units: ['u-practice'], relation: 'semantic', pronunciation: 'chö-pa', segments: [
          { text: 'སྤྱོད', pronunciation: 'chö', gloss: 'practice' },
          { text: 'པ', pronunciation: 'pa', gloss: 'makes it a noun', faint: true },
        ] },
        { text: 'ལ', units: ['u-in'], relation: 'ghost', pronunciation: 'la' },
        { text: 'སྤྱོད་པ', units: ['u-practising'], relation: 'semantic', pronunciation: 'chö-pa', segments: [
          { text: 'སྤྱོད', pronunciation: 'chö', gloss: 'practising' },
          { text: 'པ', pronunciation: 'pa', gloss: 'makes it a verb form', faint: true },
        ] },
        { text: 'ན', units: ['u-while'], relation: 'ghost', pronunciation: 'na' },
      ],
    },
    {
      // Chinese and Japanese share the SAME Han glyphs — only the reading differs.
      // One row, two readings shown together: 中 Mandarin · 日 Sino-Japanese.
      lang: 'zh-Hant',
      label: 'Chinese · Japanese',
      tokens: [
        // Chinese fronts the verb — reordering the 1:1 model can't follow.
        { text: '行', units: ['u-practising'], relation: 'semantic', readings: { zh: 'xíng', ja: 'gyō' } },
        { text: '深', units: ['u-deep'], relation: 'semantic', readings: { zh: 'shēn', ja: 'jin' } },
        { text: '般若', units: ['u-wisdom'], relation: 'transliteration', segments: [
          { text: '般', gloss: 'pra', phonetic: true, readings: { zh: 'bān', ja: 'han' } },
          { text: '若', gloss: 'jñā', phonetic: true, readings: { zh: 'ruò', ja: 'nya' } },
        ] },
        { text: '波羅蜜多', units: ['u-perfection'], relation: 'transliteration', segments: [
          { text: '波', gloss: 'pā', phonetic: true, readings: { zh: 'bō', ja: 'ha' } },
          { text: '羅', gloss: 'ra', phonetic: true, readings: { zh: 'luó', ja: 'ra' } },
          { text: '蜜', gloss: 'mi', phonetic: true, readings: { zh: 'mì', ja: 'mi' } },
          { text: '多', gloss: 'tā', phonetic: true, readings: { zh: 'duō', ja: 'ta' } },
        ] },
        { text: '時', units: ['u-while'], relation: 'semantic', readings: { zh: 'shí', ja: 'ji' } },
      ],
    },
    {
      lang: 'en',
      label: 'English',
      by: 'MAPLE chant sheet (after Sheng-yen)',
      tokens: [
        { text: 'while', units: ['u-while'], relation: 'interpretive' },
        { text: 'going', units: ['u-practising'], relation: 'interpretive', note: 'MAPLE renders caramāṇo as "going" to keep the movement metaphor.' },
        { text: 'deep', units: ['u-deep'], relation: 'semantic' },
        { text: 'into', units: ['u-in'], relation: 'ghost' },
        { text: 'transcendent', units: ['u-perfection'], relation: 'interpretive' },
        { text: 'wisdom', units: ['u-wisdom'], relation: 'interpretive' },
      ],
    },
  ],
};

// ── Phrase 1: Āryāvalokiteśvaro bodhisattvo — "the noble Avalokiteśvara, the bodhisattva" ──
const invocation: AlignSegment = {
  id: 'heart-sutra/opening-invocation',
  gloss: 'the noble Avalokiteśvara, the bodhisattva',
  units: [
    { id: 'u-noble', gloss: 'noble — an honorific' },
    { id: 'u-avalokita', gloss: 'Avalokiteśvara — who looks down with compassion', conceptId: 'concept.avalokita-bodhisattva' },
    { id: 'u-bodhisattva', gloss: 'bodhisattva — an awakening-being', conceptId: 'concept.bodhisattva' },
  ],
  renderings: [
    {
      lang: 'sa-Deva', label: 'Sanskrit',
      tokens: [
        // Aksharas recombine to the surface, so the sandhi spelling stays correct.
        { text: 'आर्यावलोकितेश्वरो', units: ['u-noble', 'u-avalokita'], relation: 'semantic', pronunciation: 'Āryāvalokiteśvaro', segments: [
          { text: 'आ', pronunciation: 'ā', akshara: true, units: ['u-noble'] },
          { text: 'र्या', pronunciation: 'ryā', akshara: true, units: ['u-noble'] },
          { text: 'व', pronunciation: 'va', akshara: true, units: ['u-avalokita'] },
          { text: 'लो', pronunciation: 'lo', akshara: true, units: ['u-avalokita'] },
          { text: 'कि', pronunciation: 'ki', akshara: true, units: ['u-avalokita'] },
          { text: 'ते', pronunciation: 'te', akshara: true, units: ['u-avalokita'] },
          { text: 'श्व', pronunciation: 'śva', akshara: true, units: ['u-avalokita'] },
          { text: 'रो', pronunciation: 'ro', akshara: true, units: ['u-avalokita'] },
        ] },
        { text: 'बोधिसत्त्वो', units: ['u-bodhisattva'], relation: 'semantic', pronunciation: 'bodhisattvo', segments: [
          { text: 'बो', pronunciation: 'bo', akshara: true },
          { text: 'धि', pronunciation: 'dhi', akshara: true },
          { text: 'स', pronunciation: 'sa', akshara: true },
          { text: 'त्त्वो', pronunciation: 'ttvo', akshara: true },
        ] },
      ],
    },
    {
      lang: 'bo-Tibt', label: 'Tibetan',
      tokens: [
        { text: 'བྱང་ཆུབ་སེམས་དཔའ', units: ['u-bodhisattva'], relation: 'calque', pronunciation: 'jang-chub sem-pa', segments: [
          { text: 'བྱང་', pronunciation: 'jang', gloss: 'purified' },
          { text: 'ཆུབ་', pronunciation: 'chub', gloss: 'perfected — together: awakening' },
          { text: 'སེམས་', pronunciation: 'sem', gloss: 'mind' },
          { text: 'དཔའ', pronunciation: "dpa'", gloss: 'hero — together: an awakening-being' },
        ] },
        { text: 'འཕགས་པ', units: ['u-noble'], relation: 'semantic', pronunciation: 'phak-pa', segments: [
          { text: 'འཕགས་', pronunciation: 'phak', gloss: 'noble, exalted' },
          { text: 'པ', pronunciation: 'pa', gloss: 'makes it a noun', faint: true },
        ] },
        { text: 'སྤྱན་རས་གཟིགས་དབང་ཕྱུག', units: ['u-avalokita'], relation: 'calque', pronunciation: 'chen-ré-zig wang-chuk', segments: [
          { text: 'སྤྱན་', pronunciation: 'chen', gloss: 'eye (honorific)' },
          { text: 'རས་', pronunciation: 'ré', gloss: 'with' },
          { text: 'གཟིགས་', pronunciation: 'zig', gloss: 'gazes — together: the compassionate gazer' },
          { text: 'དབང་', pronunciation: 'wang', gloss: 'power' },
          { text: 'ཕྱུག', pronunciation: 'chuk', gloss: 'abundant — together: sovereign' },
        ] },
      ],
    },
    {
      lang: 'zh-Hant', label: 'Chinese · Japanese',
      tokens: [
        { text: '觀自在', units: ['u-noble', 'u-avalokita'], relation: 'calque', segments: [
          { text: '觀', gloss: 'observe — renders "looks down"', readings: { zh: 'guān', ja: 'kan' } },
          { text: '自', gloss: 'self', readings: { zh: 'zì', ja: 'ji' } },
          { text: '在', gloss: 'present — 自在 together: freely existing, sovereign', readings: { zh: 'zài', ja: 'zai' } },
        ] },
        { text: '菩薩', units: ['u-bodhisattva'], relation: 'transliteration', segments: [
          { text: '菩', gloss: 'bo-', phonetic: true, readings: { zh: 'pú', ja: 'bo' } },
          { text: '薩', gloss: 'sattva', phonetic: true, readings: { zh: 'sà', ja: 'satsu' } },
        ] },
      ],
    },
    {
      lang: 'en', label: 'English', by: 'MAPLE chant sheet (after Sheng-yen)',
      tokens: [
        { text: 'Avalokiteśvara', units: ['u-noble', 'u-avalokita'], relation: 'interpretive' },
        { text: 'Bodhisatva,', units: ['u-bodhisattva'], relation: 'interpretive' },
      ],
    },
  ],
};

// ── Phrase 3: vyavalokayati sma… — "clearly saw the five skandhas empty; overcame all suffering" ──
const seeing: AlignSegment = {
  id: 'heart-sutra/opening-seeing',
  gloss: 'clearly saw the five skandhas empty of own-being, and overcame all suffering',
  units: [
    { id: 'u-saw', gloss: 'looked closely — the continuous gaze', conceptId: 'concept.seeing-vyavalokita' },
    { id: 'u-five', gloss: 'five' },
    { id: 'u-skandhas', gloss: 'skandhas — the five parts of experience', conceptId: 'concept.skandha-aggregate' },
    { id: 'u-those', gloss: 'those (the skandhas)', ghost: true },
    { id: 'u-own-being', gloss: 'own-being — inherent existence, what is absent', conceptId: 'concept.svabhava-own-being' },
    { id: 'u-empty', gloss: 'empty of', conceptId: 'concept.emptiness-sunyata' },
    { id: 'u-saw2', gloss: 'saw — the moment of insight', conceptId: 'concept.seeing-vyavalokita' },
    { id: 'u-overcame', gloss: 'crossed over, overcame' },
    { id: 'u-all', gloss: 'all, every' },
    { id: 'u-suffering', gloss: 'suffering, distress', conceptId: 'concept.suffering-duhkha' },
  ],
  renderings: [
    {
      lang: 'sa-Deva', label: 'Sanskrit',
      tokens: [
        { text: 'व्यवलोकयति', units: ['u-saw'], relation: 'semantic', pronunciation: 'vyavalokayati', segments: [
          { text: 'व्य', pronunciation: 'vya', akshara: true },
          { text: 'व', pronunciation: 'va', akshara: true },
          { text: 'लो', pronunciation: 'lo', akshara: true },
          { text: 'क', pronunciation: 'ka', akshara: true },
          { text: 'य', pronunciation: 'ya', akshara: true },
          { text: 'ति', pronunciation: 'ti', akshara: true },
        ] },
        { text: 'स्म', units: [], relation: 'ghost', gloss: 'marks it as already done (past)', pronunciation: 'sma' },
        { text: 'पञ्च', units: ['u-five'], relation: 'semantic', pronunciation: 'pañca', segments: [
          { text: 'प', pronunciation: 'pa', akshara: true },
          { text: 'ञ्च', pronunciation: 'ñca', akshara: true },
        ] },
        { text: 'स्कन्धाः', units: ['u-skandhas'], relation: 'semantic', pronunciation: 'skandhāḥ', segments: [
          { text: 'स्क', pronunciation: 'ska', akshara: true },
          { text: 'न्धाः', pronunciation: 'ndhāḥ', akshara: true },
        ] },
        { text: 'तांश्च', units: ['u-those'], relation: 'ghost', pronunciation: 'tāṃś ca' },
        { text: 'स्वभावशून्यान्', units: ['u-own-being', 'u-empty'], relation: 'semantic', pronunciation: 'svabhāvaśūnyān', segments: [
          { text: 'स्व', pronunciation: 'sva', akshara: true, units: ['u-own-being'] },
          { text: 'भा', pronunciation: 'bhā', akshara: true, units: ['u-own-being'] },
          { text: 'व', pronunciation: 'va', akshara: true, units: ['u-own-being'] },
          { text: 'शू', pronunciation: 'śū', akshara: true, units: ['u-empty'] },
          { text: 'न्या', pronunciation: 'nyā', akshara: true, units: ['u-empty'] },
          { text: 'न्', pronunciation: 'n', akshara: true, units: ['u-empty'] },
        ] },
        { text: 'पश्यति', units: ['u-saw2'], relation: 'semantic', pronunciation: 'paśyati', segments: [
          { text: 'प', pronunciation: 'pa', akshara: true },
          { text: 'श्य', pronunciation: 'śya', akshara: true },
          { text: 'ति', pronunciation: 'ti', akshara: true },
        ] },
        { text: 'स्म', units: [], relation: 'ghost', gloss: 'marks it as already done (past)', pronunciation: 'sma' },
      ],
    },
    {
      lang: 'bo-Tibt', label: 'Tibetan',
      tokens: [
        { text: 'ཕུང་པོ', units: ['u-skandhas'], relation: 'semantic', pronunciation: 'phung-po', segments: [
          { text: 'ཕུང་', pronunciation: 'phung', gloss: 'heap, mass' },
          { text: 'པོ', pronunciation: 'po', gloss: 'makes it a noun', faint: true },
        ] },
        { text: 'ལྔ་པོ', units: ['u-five'], relation: 'semantic', pronunciation: 'nga-po', segments: [
          { text: 'ལྔ་', pronunciation: 'nga', gloss: 'five' },
          { text: 'པོ', pronunciation: 'po', gloss: 'makes it "the five"', faint: true },
        ] },
        { text: 'དེ་དག', units: ['u-those'], relation: 'ghost', pronunciation: 'dé-dak' },
        { text: 'ལ', units: [], relation: 'ghost', gloss: 'regarding', pronunciation: 'la' },
        { text: 'ཡང', units: [], relation: 'ghost', gloss: 'even, also', pronunciation: 'yang' },
        { text: 'རང་བཞིན', units: ['u-own-being'], relation: 'semantic', pronunciation: 'rang-zhin', segments: [
          { text: 'རང་', pronunciation: 'rang', gloss: 'own, self' },
          { text: 'བཞིན', pronunciation: 'zhin', gloss: 'nature — together: own-nature' },
        ] },
        { text: 'གྱིས', units: [], relation: 'ghost', gloss: 'in terms of', pronunciation: 'gyi' },
        { text: 'སྟོང་པར', units: ['u-empty'], relation: 'semantic', pronunciation: 'tong-par', segments: [
          { text: 'སྟོང་', pronunciation: 'tong', gloss: 'empty, void' },
          { text: 'པར', pronunciation: 'par', gloss: 'makes it "as empty"', faint: true },
        ] },
        { text: 'རྣམ་པར་བལྟའོ', units: ['u-saw', 'u-saw2'], relation: 'semantic', pronunciation: "nam-par ta'o", segments: [
          { text: 'རྣམ་པར་', pronunciation: 'nam-par', gloss: 'thoroughly' },
          { text: 'བལྟ', pronunciation: 'ta', gloss: 'looked, saw' },
          { text: 'འོ', pronunciation: "'o", gloss: 'ends the sentence', faint: true },
        ] },
      ],
    },
    {
      lang: 'zh-Hant', label: 'Chinese · Japanese',
      tokens: [
        { text: '照見', units: ['u-saw', 'u-saw2'], relation: 'semantic', segments: [
          { text: '照', gloss: 'illuminate — the continuous gaze', readings: { zh: 'zhào', ja: 'shō' } },
          { text: '見', gloss: 'see — the moment of insight', readings: { zh: 'jiàn', ja: 'ken' } },
        ] },
        { text: '五', units: ['u-five'], relation: 'semantic', readings: { zh: 'wǔ', ja: 'go' } },
        { text: '蘊', units: ['u-skandhas'], relation: 'semantic', readings: { zh: 'yùn', ja: 'un' } },
        { text: '皆', units: ['u-all'], relation: 'semantic', readings: { zh: 'jiē', ja: 'kai' } },
        { text: '空', units: ['u-empty'], relation: 'semantic', readings: { zh: 'kōng', ja: 'kū' } },
        { text: '度', units: ['u-overcame'], relation: 'semantic', readings: { zh: 'dù', ja: 'do' } },
        { text: '一切', units: ['u-all'], relation: 'semantic', readings: { zh: 'yīqiè', ja: 'issai' } },
        { text: '苦厄', units: ['u-suffering'], relation: 'semantic', segments: [
          { text: '苦', gloss: 'suffering', readings: { zh: 'kǔ', ja: 'ku' } },
          { text: '厄', gloss: 'distress', readings: { zh: 'è', ja: 'yaku' } },
        ] },
      ],
    },
    {
      lang: 'en', label: 'English', by: 'MAPLE chant sheet (after Sheng-yen)',
      tokens: [
        { text: 'clearly', units: ['u-saw'], relation: 'interpretive' },
        { text: 'saw', units: ['u-saw', 'u-saw2'], relation: 'interpretive' },
        { text: 'that', units: ['u-those'], relation: 'ghost' },
        { text: 'all', units: ['u-all'], relation: 'semantic' },
        { text: 'five', units: ['u-five'], relation: 'semantic' },
        { text: 'skandhas', units: ['u-skandhas'], relation: 'interpretive' },
        { text: 'are', units: [], relation: 'ghost', gloss: 'is / are' },
        { text: 'empty,', units: ['u-empty'], relation: 'interpretive' },
        { text: 'and', units: [], relation: 'ghost', gloss: 'and' },
        { text: 'overcame', units: ['u-overcame'], relation: 'interpretive' },
        { text: 'all', units: ['u-all'], relation: 'semantic' },
        { text: 'suffering.', units: ['u-suffering'], relation: 'interpretive' },
      ],
    },
  ],
};

// ── Phrase 4: Rūpaṃ śūnyatā… — "form is emptiness; whatever is form, that is emptiness" ──
const formEmptiness: AlignSegment = {
  id: 'heart-sutra/form-is-emptiness',
  gloss: 'form is emptiness; whatever is form, that is emptiness',
  units: [
    { id: 'u-form', gloss: 'form — matter, body, what appears', conceptId: 'concept.form-rupa' },
    { id: 'u-is', gloss: 'is', ghost: true },
    { id: 'u-empty', gloss: 'emptiness', conceptId: 'concept.emptiness-sunyata' },
    { id: 'u-what', gloss: 'whatever — opens the clause', ghost: true },
    { id: 'u-form2', gloss: 'form — echoed in the clause', conceptId: 'concept.form-rupa' },
    { id: 'u-that', gloss: 'that — answers it', ghost: true },
    { id: 'u-empty2', gloss: 'emptiness — the answer', conceptId: 'concept.emptiness-sunyata' },
  ],
  renderings: [
    {
      lang: 'sa-Deva', label: 'Sanskrit',
      tokens: [
        { text: 'रूपं', units: ['u-form'], relation: 'semantic', pronunciation: 'rūpaṃ', segments: [
          { text: 'रू', pronunciation: 'rū', akshara: true },
          { text: 'पं', pronunciation: 'paṃ', akshara: true },
        ] },
        { text: 'शून्यता', units: ['u-empty'], relation: 'semantic', pronunciation: 'śūnyatā', segments: [
          { text: 'शू', pronunciation: 'śū', akshara: true },
          { text: 'न्य', pronunciation: 'nya', akshara: true },
          { text: 'ता', pronunciation: 'tā', akshara: true },
        ] },
        { text: 'यद्', units: ['u-what'], relation: 'ghost', gloss: 'whatever', pronunciation: 'yad' },
        { text: 'रूपं', units: ['u-form2'], relation: 'semantic', pronunciation: 'rūpaṃ', segments: [
          { text: 'रू', pronunciation: 'rū', akshara: true },
          { text: 'पं', pronunciation: 'paṃ', akshara: true },
        ] },
        { text: 'सा', units: ['u-that'], relation: 'ghost', gloss: 'that', pronunciation: 'sā' },
        { text: 'शून्यता', units: ['u-empty2'], relation: 'semantic', pronunciation: 'śūnyatā', segments: [
          { text: 'शू', pronunciation: 'śū', akshara: true },
          { text: 'न्य', pronunciation: 'nya', akshara: true },
          { text: 'ता', pronunciation: 'tā', akshara: true },
        ] },
      ],
    },
    {
      lang: 'bo-Tibt', label: 'Tibetan',
      tokens: [
        { text: 'གཟུགས', units: ['u-form'], relation: 'semantic', pronunciation: 'zuk' },
        { text: 'སྟོང་པ', units: ['u-empty'], relation: 'calque', pronunciation: 'tong-pa', segments: [
          { text: 'སྟོང་', pronunciation: 'tong', gloss: 'empty, void' },
          { text: 'པ', pronunciation: 'pa', gloss: 'makes it "emptiness"', faint: true },
        ] },
        { text: 'འོ', units: [], relation: 'ghost', gloss: 'ends the sentence', pronunciation: "'o" },
      ],
    },
    {
      lang: 'zh-Hant', label: 'Chinese · Japanese',
      tokens: [
        { text: '色', units: ['u-form'], relation: 'semantic', readings: { zh: 'sè', ja: 'shiki' } },
        { text: '即', units: ['u-is'], relation: 'ghost', readings: { zh: 'jí', ja: 'soku' } },
        { text: '是', units: ['u-is'], relation: 'ghost', readings: { zh: 'shì', ja: 'ze' } },
        { text: '空', units: ['u-empty'], relation: 'semantic', readings: { zh: 'kōng', ja: 'kū' } },
      ],
    },
    {
      lang: 'en', label: 'English', by: 'MAPLE chant sheet (after Sheng-yen)',
      tokens: [
        { text: 'Appearance', units: ['u-form'], relation: 'interpretive' },
        { text: 'itself', units: ['u-what', 'u-that'], relation: 'ghost' },
        { text: 'is', units: ['u-is'], relation: 'ghost' },
        { text: 'emptiness.', units: ['u-empty'], relation: 'interpretive' },
      ],
    },
  ],
};

// ── Phrase 5: śūnyataiva rūpaṃ… — "emptiness itself is form; whatever is emptiness, that is form" ──
const emptinessForm: AlignSegment = {
  id: 'heart-sutra/emptiness-is-form',
  gloss: 'emptiness itself is form; whatever is emptiness, that is form',
  units: [
    { id: 'u-empty', gloss: 'emptiness itself', conceptId: 'concept.emptiness-sunyata' },
    { id: 'u-is', gloss: 'is', ghost: true },
    { id: 'u-form', gloss: 'form — matter, what appears', conceptId: 'concept.form-rupa' },
    { id: 'u-what', gloss: 'whatever — opens the clause', ghost: true },
    { id: 'u-empty2', gloss: 'emptiness — echoed', conceptId: 'concept.emptiness-sunyata' },
    { id: 'u-that', gloss: 'that — answers it', ghost: true },
    { id: 'u-form2', gloss: 'form — the answer', conceptId: 'concept.form-rupa' },
  ],
  renderings: [
    {
      lang: 'sa-Deva', label: 'Sanskrit',
      tokens: [
        { text: 'शून्यतैव', units: ['u-empty'], relation: 'semantic', pronunciation: 'śūnyataiva', segments: [
          { text: 'शू', pronunciation: 'śū', akshara: true },
          { text: 'न्य', pronunciation: 'nya', akshara: true },
          { text: 'तै', pronunciation: 'tai', akshara: true },
          { text: 'व', pronunciation: 'va', akshara: true },
        ] },
        { text: 'रूपम्', units: ['u-form'], relation: 'semantic', pronunciation: 'rūpam', segments: [
          { text: 'रू', pronunciation: 'rū', akshara: true },
          { text: 'पम्', pronunciation: 'pam', akshara: true },
        ] },
        { text: 'या', units: ['u-what'], relation: 'ghost', gloss: 'whatever', pronunciation: 'yā' },
        { text: 'शून्यता', units: ['u-empty2'], relation: 'semantic', pronunciation: 'śūnyatā', segments: [
          { text: 'शू', pronunciation: 'śū', akshara: true },
          { text: 'न्य', pronunciation: 'nya', akshara: true },
          { text: 'ता', pronunciation: 'tā', akshara: true },
        ] },
        { text: 'तद्', units: ['u-that'], relation: 'ghost', gloss: 'that', pronunciation: 'tad' },
        { text: 'रूपम्', units: ['u-form2'], relation: 'semantic', pronunciation: 'rūpam', segments: [
          { text: 'रू', pronunciation: 'rū', akshara: true },
          { text: 'पम्', pronunciation: 'pam', akshara: true },
        ] },
      ],
    },
    {
      lang: 'bo-Tibt', label: 'Tibetan',
      tokens: [
        { text: 'སྟོང་པ་ཉིད', units: ['u-empty'], relation: 'calque', pronunciation: 'tong-pa-nyi', segments: [
          { text: 'སྟོང་', pronunciation: 'tong', gloss: 'empty, void' },
          { text: 'པ', pronunciation: 'pa', gloss: 'makes it a noun', faint: true },
          { text: 'ཉིད', pronunciation: 'nyi', gloss: 'itself (emphasis)', faint: true },
        ] },
        { text: 'གཟུགས', units: ['u-form'], relation: 'semantic', pronunciation: 'zuk' },
        { text: 'སོ', units: [], relation: 'ghost', gloss: 'ends the sentence', pronunciation: 'so' },
      ],
    },
    {
      lang: 'zh-Hant', label: 'Chinese · Japanese',
      tokens: [
        { text: '空', units: ['u-empty'], relation: 'semantic', readings: { zh: 'kōng', ja: 'kū' } },
        { text: '即', units: ['u-is'], relation: 'ghost', readings: { zh: 'jí', ja: 'soku' } },
        { text: '是', units: ['u-is'], relation: 'ghost', readings: { zh: 'shì', ja: 'ze' } },
        { text: '色', units: ['u-form'], relation: 'semantic', readings: { zh: 'sè', ja: 'shiki' } },
      ],
    },
    {
      lang: 'en', label: 'English', by: 'MAPLE chant sheet (after Sheng-yen)',
      tokens: [
        { text: 'Emptiness', units: ['u-empty'], relation: 'interpretive' },
        { text: 'itself', units: ['u-what', 'u-that'], relation: 'ghost' },
        { text: 'is', units: ['u-is'], relation: 'ghost' },
        { text: 'appearance.', units: ['u-form'], relation: 'interpretive' },
      ],
    },
  ],
};

/** The first five phrases of the Heart Sutra, in reading order. */
export const OPENING_PHRASES: AlignSegment[] = [invocation, openingPracticeAligned, seeing, formEmptiness, emptinessForm];

export default openingPracticeAligned;

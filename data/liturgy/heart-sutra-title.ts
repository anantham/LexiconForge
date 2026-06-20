import type { AlignSegment } from '../../types/liturgyAlign';

/**
 * The sutra's TITLE as a concept-aligned segment — its name in each tradition,
 * the same wisdom·perfection·heart·scripture spine running across all of them.
 * Prepended to the Heart Sutra body so it inherits the language toggles and the
 * cross-script threads (hover "Wisdom" → Prajñā ↔ 般若 ↔ ཤེས་རབ).
 *
 * Content notes (sacred text — kept accurate, flagged where a choice was made):
 *  - Sanskrit: Prajñā·pāramitā·hṛdaya — "Heart of the Perfection of Wisdom."
 *  - Han row shows the FULL formal title 般若波羅蜜多心經 (read in both Mandarin
 *    and Japanese); the colloquial Japanese abbreviation is 般若心経 (Hannya Shingyō).
 *  - 般若 / 波羅蜜多 are phonetic transliterations of prajñā / pāramitā (dotted);
 *    心 (heart) and 經 (scripture) are semantic.
 *  - Tibetan gives the three content words of ཤེས་རབ་ཀྱི་ཕ་རོལ་ཏུ་ཕྱིན་པའི་སྙིང་པོ.
 *  - English shows the MAPLE title wording ("The Heart of Transcendent Wisdom").
 */
export const heartSutraTitle: AlignSegment = {
  id: 'heart-sutra-title',
  title: true,
  units: [
    { id: 'concept.wisdom-prajna', gloss: 'wisdom (prajñā)', conceptId: 'concept.wisdom-prajna' },
    { id: 'concept.perfection-paramita', gloss: 'perfection · gone-beyond (pāramitā)', conceptId: 'concept.perfection-paramita' },
    { id: 'u-heart', gloss: 'heart · essence (hṛdaya)' },
    { id: 'u-scripture', gloss: 'scripture (sūtra)' },
  ],
  renderings: [
    {
      lang: 'sa-Deva',
      label: 'Sanskrit (Devanāgarī)',
      tokens: [
        {
          text: 'प्रज्ञा', units: ['concept.wisdom-prajna'], relation: 'semantic', pronunciation: 'prajñā',
          segments: [
            { text: 'प्र', pronunciation: 'pra', akshara: true, units: ['concept.wisdom-prajna'] },
            { text: 'ज्ञा', pronunciation: 'jñā', akshara: true, units: ['concept.wisdom-prajna'] },
          ],
        },
        {
          text: 'पारमिता', units: ['concept.perfection-paramita'], relation: 'semantic', pronunciation: 'pāramitā',
          segments: [
            { text: 'पा', pronunciation: 'pā', akshara: true, units: ['concept.perfection-paramita'] },
            { text: 'र', pronunciation: 'ra', akshara: true, units: ['concept.perfection-paramita'] },
            { text: 'मि', pronunciation: 'mi', akshara: true, units: ['concept.perfection-paramita'] },
            { text: 'ता', pronunciation: 'tā', akshara: true, units: ['concept.perfection-paramita'] },
          ],
        },
        {
          text: 'हृदय', units: ['u-heart'], relation: 'semantic', pronunciation: 'hṛdaya',
          segments: [
            { text: 'हृ', pronunciation: 'hṛ', akshara: true, units: ['u-heart'] },
            { text: 'द', pronunciation: 'da', akshara: true, units: ['u-heart'] },
            { text: 'य', pronunciation: 'ya', akshara: true, units: ['u-heart'] },
          ],
        },
      ],
    },
    {
      lang: 'zh-Hant',
      label: 'Chinese · Japanese',
      tokens: [
        {
          text: '般若', units: ['concept.wisdom-prajna'], relation: 'transliteration', readings: { zh: 'bō-rě', ja: 'hannya' },
          segments: [
            { text: '般', readings: { zh: 'bō', ja: 'han' } },
            { text: '若', readings: { zh: 'rě', ja: 'nya' } },
          ],
        },
        {
          text: '波羅蜜多', units: ['concept.perfection-paramita'], relation: 'transliteration', readings: { zh: 'bō-luó-mì-duō', ja: 'haramita' },
          segments: [
            { text: '波', readings: { zh: 'bō', ja: 'ha' } },
            { text: '羅', readings: { zh: 'luó', ja: 'ra' } },
            { text: '蜜', readings: { zh: 'mì', ja: 'mi' } },
            { text: '多', readings: { zh: 'duō', ja: 'ta' } },
          ],
        },
        { text: '心', units: ['u-heart'], relation: 'semantic', readings: { zh: 'xīn', ja: 'shin' } },
        { text: '經', units: ['u-scripture'], relation: 'semantic', readings: { zh: 'jīng', ja: 'gyō' } },
      ],
    },
    {
      lang: 'bo-Tibt',
      label: 'Tibetan',
      tokens: [
        { text: 'ཤེས་རབ', units: ['concept.wisdom-prajna'], relation: 'semantic', pronunciation: 'she-rab' },
        { text: 'ཕ་རོལ་ཏུ་ཕྱིན་པ', units: ['concept.perfection-paramita'], relation: 'semantic', pronunciation: 'pa-rol-tu chin-pa' },
        { text: 'སྙིང་པོ', units: ['u-heart'], relation: 'semantic', pronunciation: 'nying-po' },
      ],
    },
    {
      lang: 'en',
      label: 'English',
      by: 'title',
      tokens: [
        { text: 'The', units: [], relation: 'ghost', gloss: 'the' },
        { text: 'Heart', units: ['u-heart'], relation: 'interpretive' },
        { text: 'of', units: [], relation: 'ghost', gloss: 'of' },
        { text: 'Transcendent', units: ['concept.perfection-paramita'], relation: 'interpretive' },
        { text: 'Wisdom', units: ['concept.wisdom-prajna'], relation: 'interpretive' },
      ],
    },
  ],
};

/**
 * Four Great Vows — Shi-gu Sei-gan-mon (四弘誓願).
 *
 * The pan-Mahāyāna bodhisattva vow formula. Four parallel four-syllable
 * lines, each pairing a measureless field with the vow to engage it:
 *   - beings without limit → vow to free them
 *   - afflictions without end → vow to cut them off
 *   - dharma-gates without measure → vow to study them
 *   - the Buddha way unsurpassable → vow to fulfill it
 *
 * Chanted at MAPLE three times after every meal (Breakfast 7:30 AM,
 * Lunch 12 PM). Transcribed from the MAPLE loving-kindness practice
 * sheet: Sino-Japanese phonetic + Hanzi + English. The English on the
 * sheet is the rendering MAPLE uses in practice.
 *
 * Closing line on the same sheet: "Mitákuye Oyás'iŋ" — a Lakota prayer
 * phrase ("all my relations") that closes the meal liturgy. Included
 * here as the final section so the meal sequence stays whole.
 */

import type { LiturgyDoc } from '../../types/liturgy';
import { wikipediaCitation, ungroundedCitation } from './_groundingHelpers';

export const vows: LiturgyDoc = {
  slug: 'vows',
  sangha: 'maple',
  order: 7,
  time: 'After every meal',
  frequency: 'daily',
  title: 'Four Great Vows',
  subtitle: 'Shi-gu Sei-gan-mon (四弘誓願)',
  tradition: 'mahayana',
  context: 'The Four Great Vows of the bodhisattva — sentient beings, defilements, dharma-gates, the Buddha-way — in Sino-Japanese. The MAPLE rendering closes with the Lakota phrase *Mitákuye Oyás\'iŋ* ("all my relations").',
  sources: {
    canonical: [
      {
        label: 'Four Great Vows (pan-Mahāyāna formula)',
        url: 'https://en.wikipedia.org/wiki/Four_Great_Vows',
      },
    ],
    ritual: [
      { label: 'MAPLE loving-kindness practice sheet' },
    ],
  },
  curator:
    'Curation by Aditya. Sino-Japanese phonetic + Hanzi + English transcribed directly from the MAPLE practice sheet (all three scripts authored together on the sheet). The Lakota closing "Mitákuye Oyás\'iŋ" is also on the same sheet, recited once at the end of the meal liturgy.',
  sections: [
    {
      id: 'four-vows',
      shape: 'triple-script-witness',
      repetitions: 3,
      large: true,
      segments: [
        {
          id: 'vow-1-shujo',
          pali: 'Shujō muhen sē gan do',
          scripts: [
            {
              lang: 'ja-Jpan',
              label: 'Sino-Japanese',
              text: 'Shujō muhen sē gan do',
              tokens: ['Shujō', 'muhen', 'sē gan', 'do'],
            },
            {
              lang: 'zh-Hant',
              label: 'Hanzi',
              text: '衆生無邊誓願度',
              tokens: ['衆生', '無邊', '誓願', '度'],
              transliteration: 'Shujō  muhen  sē gan  do  (zhòng shēng wú biān shì yuàn dù in Mandarin)',
            },
          ],
          witnesses: [
            {
              by: 'MAPLE',
              text: 'Myriad lives without number, vow to free them.',
              alignTo: [0, 0, 1, 1, 2, 2, 3, -1],
              license: 'MAPLE practice sheet',
            },
          ],
          words: [
            {
              form: 'Shujō',
              scriptAlts: { 'zh-Hant': '衆生' },
              gloss: 'All sentient beings, literally "many beings" or "the myriad lives". The first measureless field, the *who* of the vow.',
              accent: 'rose',
            },
            {
              form: 'muhen',
              scriptAlts: { 'zh-Hant': '無邊' },
              gloss: 'Boundless, without limit. *無* "no" + *邊* "edge". Names the inexhaustibility of the field, no horizon at which the vow stops.',
            },
            {
              form: 'sē gan',
              scriptAlts: { 'zh-Hant': '誓願' },
              gloss: 'Vow, solemn pledge. *誓* "oath" + *願* "wish, aspiration". The same compound across all four vows.',
              accent: 'amber',
            },
            {
              form: 'do',
              scriptAlts: { 'zh-Hant': '度' },
              gloss: 'To ferry across, save, liberate. Same character as the perfection *pāramitā* (波羅蜜多) in its Chinese sense of "crossing over to the other shore". The action verb of vow 1.',
            },
          ],
        },
        {
          id: 'vow-2-bonno',
          pali: 'Bonnō mujin sē gan dan',
          scripts: [
            {
              lang: 'ja-Jpan',
              label: 'Sino-Japanese',
              text: 'Bonnō mujin sē gan dan',
              tokens: ['Bonnō', 'mujin', 'sē gan', 'dan'],
            },
            {
              lang: 'zh-Hant',
              label: 'Hanzi',
              text: '煩惱無盡誓願斷',
              tokens: ['煩惱', '無盡', '誓願', '斷'],
              transliteration: 'Bonnō  mujin  sē gan  dan  (fán nǎo wú jìn shì yuàn duàn in Mandarin)',
            },
          ],
          witnesses: [
            {
              by: 'MAPLE',
              text: 'Greed and hate without limit, vow to end them.',
              alignTo: [0, -1, 0, -1, -1, 1, -1, 2, 3],
              license: 'MAPLE practice sheet',
            },
          ],
          words: [
            {
              form: 'Bonnō',
              scriptAlts: { 'zh-Hant': '煩惱' },
              gloss: '*Kleśa* in Sanskrit, the mental afflictions or defilements: greed, hate, delusion and their thousand forms. MAPLE\'s "greed and hate" is the canonical short form. *煩* "vex" + *惱* "distress".',
              accent: 'rose',
            },
            {
              form: 'mujin',
              scriptAlts: { 'zh-Hant': '無盡' },
              gloss: 'Inexhaustible, without end. *無* "no" + *盡* "end". Names the affliction-field as inexhaustible; no last kleśa to vanquish.',
            },
            {
              form: 'sē gan',
              scriptAlts: { 'zh-Hant': '誓願' },
              gloss: 'Vow, solemn pledge.',
              accent: 'amber',
            },
            {
              form: 'dan',
              scriptAlts: { 'zh-Hant': '斷' },
              gloss: 'To cut off, sever. The action verb of vow 2: the afflictions are cut, not killed or denied.',
            },
          ],
        },
        {
          id: 'vow-3-homon',
          pali: 'Hōmon muryō sē gan gaku',
          scripts: [
            {
              lang: 'ja-Jpan',
              label: 'Sino-Japanese',
              text: 'Hōmon muryō sē gan gaku',
              tokens: ['Hōmon', 'muryō', 'sē gan', 'gaku'],
            },
            {
              lang: 'zh-Hant',
              label: 'Hanzi',
              text: '法門無量誓願學',
              tokens: ['法門', '無量', '誓願', '學'],
              transliteration: 'Hōmon  muryō  sē gan  gaku  (fǎ mén wú liàng shì yuàn xué in Mandarin)',
            },
          ],
          witnesses: [
            {
              by: 'MAPLE',
              text: 'Gates of truth without measure, vow to know them.',
              alignTo: [0, 0, 0, 1, 1, 2, 2, 3, -1],
              license: 'MAPLE practice sheet',
            },
          ],
          words: [
            {
              form: 'Hōmon',
              scriptAlts: { 'zh-Hant': '法門' },
              gloss: 'Dharma-gates. *法* "Dharma" + *門* "gate, door". Every teaching, every practice, every authentic encounter is a gate. The vow recognises the plurality of the path.',
              accent: 'sky',
            },
            {
              form: 'muryō',
              scriptAlts: { 'zh-Hant': '無量' },
              gloss: 'Immeasurable. *無* "no" + *量* "measure, amount". Same word as in the four *brahmavihāras* (四無量 = "four immeasurables"). Names the dharma-field as without quantitative limit.',
            },
            {
              form: 'sē gan',
              scriptAlts: { 'zh-Hant': '誓願' },
              gloss: 'Vow, solemn pledge.',
              accent: 'amber',
            },
            {
              form: 'gaku',
              scriptAlts: { 'zh-Hant': '學' },
              gloss: 'To study, learn, train in. The action verb of vow 3: not "master" but *study* — the relationship to teachings is continuous, never finished.',
            },
          ],
        },
        {
          id: 'vow-4-butsudo',
          pali: 'Butsudō mujō sē gan jō',
          scripts: [
            {
              lang: 'ja-Jpan',
              label: 'Sino-Japanese',
              text: 'Butsudō mujō sē gan jō',
              tokens: ['Butsudō', 'mujō', 'sē gan', 'jō'],
            },
            {
              lang: 'zh-Hant',
              label: 'Hanzi',
              text: '佛道無上誓願成',
              tokens: ['佛道', '無上', '誓願', '成'],
              transliteration: 'Butsudō  mujō  sē gan  jō  (fó dào wú shàng shì yuàn chéng in Mandarin)',
            },
          ],
          witnesses: [
            {
              by: 'MAPLE',
              text: 'Awakened way without compare, vow to fulfill it.',
              alignTo: [0, 0, 1, 1, 2, 2, 3, -1],
              license: 'MAPLE practice sheet',
            },
          ],
          words: [
            {
              form: 'Butsudō',
              scriptAlts: { 'zh-Hant': '佛道' },
              gloss: 'The Buddha way. *佛* "Buddha" + *道* "way, path, Tao". Same *道* / *dao* as in Taoism, here the buddhic path.',
              accent: 'amber',
            },
            {
              form: 'mujō',
              scriptAlts: { 'zh-Hant': '無上' },
              gloss: 'Unsurpassed, without anything above it. *無* "no" + *上* "above". The same *anuttara* as in *anuttarā samyaksaṃbodhi* (the unsurpassed perfect awakening).',
            },
            {
              form: 'sē gan',
              scriptAlts: { 'zh-Hant': '誓願' },
              gloss: 'Vow, solemn pledge.',
              accent: 'amber',
            },
            {
              form: 'jō',
              scriptAlts: { 'zh-Hant': '成' },
              gloss: 'To accomplish, complete, become. The action verb of vow 4: the way is realised, not merely sought.',
            },
          ],
        },
      ],
      commentary:
        'The four parallel lines hold a tension worth noticing. The fields are each declared limitless (boundless beings, inexhaustible afflictions, immeasurable gates, unsurpassed way) — yet the vow engages each one anyway. To free *all* sentient beings; to cut *all* afflictions; to know *all* dharma-gates; to fulfill the *unsurpassed* way. The vow is structurally impossible at the level the language operates on, and that\'s the practice: the impossibility is what keeps the heart open.',
    },
    {
      id: 'mitakuye-oyasin',
      shape: 'triple-script-witness',
      segments: [
        {
          id: 'mitakuye-segment',
          pali: 'Mitákuye Oyás\'iŋ',
          scripts: [
            {
              lang: 'lkt-Latn',
              label: 'Lakota',
              text: 'Mitákuye Oyás\'iŋ',
              tokens: ['Mitákuye', 'Oyás\'iŋ'],
              transliteration: 'mee-TAH-koo-yay  oh-YAH-seen',
            },
          ],
          witnesses: [
            {
              by: 'MAPLE',
              text: 'All my relations.',
              alignTo: [0, 0, 1],
              license: 'MAPLE practice sheet',
            },
          ],
          words: [
            {
              form: 'Mitákuye',
              pronunciation: 'mee-TAH-koo-yay',
              gloss: '"My relatives". The acknowledgment is first-person, not generic: *my* kin, *my* relations. Names the speaker\'s placement inside the web, not outside it.',
              accent: 'rose',
            },
            {
              form: 'Oyás\'iŋ',
              pronunciation: 'oh-YAH-seen',
              gloss: '"All, the entirety". The relations include not only human kin but every being, plant, stone, river, ancestor, descendant. A Lakota prayer-closing recognising universal kinship.',
              accent: 'sky',
              citations: [ungroundedCitation('Lakota prayer-phrase tradition; canonical written sources vary in spelling (Mitakuye Oyasin, Mitákuye Oyás\'iŋ)')],
            },
          ],
        },
      ],
      commentary:
        'A Lakota prayer-closing on the MAPLE meal sheet. Standard at the end of every formal Lakota prayer, recognising the speaker as embedded in the web of all life. Chanted once, after the four vows.',
    },
  ],
};

export default vows;

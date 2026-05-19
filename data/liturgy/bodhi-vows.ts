/**
 * Four Great Vows — Bodhi Sangha rendering.
 *
 * Same Sino-Japanese + Hanzi as the MAPLE version (the four parallel
 * lines are the pan-Mahāyāna formula 四弘誓願). The English here is the
 * Bodhi Sangha booklet's own translation — softer, more contemplative
 * than MAPLE's pithy "vow to free them" / "vow to end them": *I vow to
 * save them all*, *I vow to turn them around*, *I vow to realize it in
 * full*, *I vow to walk along all the Way*.
 *
 * Transcribed from the Bodhi Sangha Sutras booklet (May 2016), p.2.
 */

import type { LiturgyDoc } from '../../types/liturgy';

export const bodhiVows: LiturgyDoc = {
  slug: 'four-great-vows',
  sangha: 'bodhi-sangha',
  order: 2,
  title: 'Four Great Vows',
  subtitle: 'Shi-gu Sei-gan-mon (四弘誓願)',
  tradition: 'zen',
  context: 'The pan-Mahāyāna bodhisattva vow formula in Sino-Japanese pronunciation, with Bodhi Sangha\'s English rendering.',
  sources: {
    canonical: [
      { label: 'Four Great Vows (pan-Mahāyāna formula)', url: 'https://en.wikipedia.org/wiki/Four_Great_Vows' },
    ],
    ritual: [
      { label: 'Bodhi Sangha Sutras booklet (May 2016), p.2' },
    ],
  },
  curator:
    'Curation by Aditya. Sino-Japanese phonetic + Hanzi + English transcribed directly from the Bodhi Sangha booklet. The same Hanzi (and same Sino-Japanese reading) the MAPLE practice sheet uses; the English differs — Bodhi\'s rendering frames each vow as "Though X, I vow to Y", honouring the field\'s inexhaustibility before naming the engagement.',
  sections: [
    {
      id: 'four-vows',
      shape: 'triple-script-witness',
      large: true,
      segments: [
        {
          id: 'vow-1-shujo',
          pali: 'Shujō muhen sē gan do',
          scripts: [
            { lang: 'ja-Jpan', label: 'Sino-Japanese', text: 'Shujō muhen sē gan do', tokens: ['Shujō', 'muhen', 'sē gan', 'do'] },
            { lang: 'zh-Hant', label: 'Hanzi', text: '衆生無邊誓願度', tokens: ['衆生', '無邊', '誓願', '度'], transliteration: 'zhòng shēng wú biān shì yuàn dù  (Mandarin pinyin)' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'Though the many beings are numberless, I vow to save them all.',
              alignTo: [-1, 0, 0, -1, -1, -1, -1, 2, 2, 3, -1, -1],
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'Shujō', scriptAlts: { 'zh-Hant': '衆生' }, gloss: 'All sentient beings, "the many lives". The first measureless field — the *who* of the vow.', accent: 'rose' },
            { form: 'muhen', scriptAlts: { 'zh-Hant': '無邊' }, gloss: 'Boundless, without limit. *無* "no" + *邊* "edge". The field has no horizon at which the vow stops.' },
            { form: 'sē gan', scriptAlts: { 'zh-Hant': '誓願' }, gloss: 'Vow, solemn pledge. *誓* "oath" + *願* "wish". The same compound across all four vows.', accent: 'amber' },
            { form: 'do', scriptAlts: { 'zh-Hant': '度' }, gloss: 'To ferry across, save, liberate. Same character as *pāramitā* (波羅蜜多) in its Chinese sense of "crossing over". The action verb of vow 1.' },
          ],
        },
        {
          id: 'vow-2-bonno',
          pali: 'Bonnō mujin sē gan dan',
          scripts: [
            { lang: 'ja-Jpan', label: 'Sino-Japanese', text: 'Bonnō mujin sē gan dan', tokens: ['Bonnō', 'mujin', 'sē gan', 'dan'] },
            { lang: 'zh-Hant', label: 'Hanzi', text: '煩惱無盡誓願斷', tokens: ['煩惱', '無盡', '誓願', '斷'], transliteration: 'fán nǎo wú jìn shì yuàn duàn  (Mandarin pinyin)' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'Though delusive passions and thoughts rise endlessly, I vow to turn them around.',
              alignTo: [-1, 0, 0, 0, 0, 1, 1, -1, 2, 2, 3, -1, 3],
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'Bonnō', scriptAlts: { 'zh-Hant': '煩惱' }, gloss: '*Kleśa* in Sanskrit — the mental afflictions: greed, hate, delusion in their thousand forms. *煩* "vex" + *惱* "distress". Bodhi\'s "delusive passions and thoughts" reads the field broadly.', accent: 'rose' },
            { form: 'mujin', scriptAlts: { 'zh-Hant': '無盡' }, gloss: 'Inexhaustible, without end. *無* "no" + *盡* "end". No last kleśa to vanquish.' },
            { form: 'sē gan', scriptAlts: { 'zh-Hant': '誓願' }, gloss: 'Vow, solemn pledge.', accent: 'amber' },
            { form: 'dan', scriptAlts: { 'zh-Hant': '斷' }, gloss: 'To cut off, sever. Bodhi\'s "turn them around" reads *dan* psychologically — the energy of affliction is redirected rather than killed.' },
          ],
        },
        {
          id: 'vow-3-homon',
          pali: 'Hōmon muryō sē gan gaku',
          scripts: [
            { lang: 'ja-Jpan', label: 'Sino-Japanese', text: 'Hōmon muryō sē gan gaku', tokens: ['Hōmon', 'muryō', 'sē gan', 'gaku'] },
            { lang: 'zh-Hant', label: 'Hanzi', text: '法門無量誓願學', tokens: ['法門', '無量', '誓願', '學'], transliteration: 'fǎ mén wú liàng shì yuàn xué  (Mandarin pinyin)' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'Though the Dharma is vast and fathomless, I vow to realize it in full.',
              alignTo: [-1, 0, 0, 1, 1, 1, 1, -1, 2, 2, 3, -1, -1, 3],
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'Hōmon', scriptAlts: { 'zh-Hant': '法門' }, gloss: 'Dharma-gates. *法* "Dharma" + *門* "gate". Bodhi\'s rendering compresses this to "the Dharma" — the gates and the field they open onto are read as one.', accent: 'sky' },
            { form: 'muryō', scriptAlts: { 'zh-Hant': '無量' }, gloss: 'Immeasurable. *無* "no" + *量* "measure". The same word as in the four *brahmavihāras* (四無量).' },
            { form: 'sē gan', scriptAlts: { 'zh-Hant': '誓願' }, gloss: 'Vow, solemn pledge.', accent: 'amber' },
            { form: 'gaku', scriptAlts: { 'zh-Hant': '學' }, gloss: 'To study, learn, train in. Bodhi reads this as "realize" — the study reaches its completion.' },
          ],
        },
        {
          id: 'vow-4-butsudo',
          pali: 'Butsudō mujō sē gan jō',
          scripts: [
            { lang: 'ja-Jpan', label: 'Sino-Japanese', text: 'Butsudō mujō sē gan jō', tokens: ['Butsudō', 'mujō', 'sē gan', 'jō'] },
            { lang: 'zh-Hant', label: 'Hanzi', text: '佛道無上誓願成', tokens: ['佛道', '無上', '誓願', '成'], transliteration: 'fó dào wú shàng shì yuàn chéng  (Mandarin pinyin)' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'Though the Way of the Awakened is unsurpassed, I vow to walk along all the Way.',
              alignTo: [-1, 0, 0, 0, 0, 0, -1, 1, -1, -1, 2, 2, 3, -1, -1, 0],
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'Butsudō', scriptAlts: { 'zh-Hant': '佛道' }, gloss: 'The Buddha way. *佛* "Buddha" + *道* "way, path, Tao". Same *道* as in Taoism, here the buddhic path.', accent: 'amber' },
            { form: 'mujō', scriptAlts: { 'zh-Hant': '無上' }, gloss: 'Unsurpassed, without anything above it. *無* "no" + *上* "above". Same *anuttara* as in *anuttarā samyaksaṃbodhi*.' },
            { form: 'sē gan', scriptAlts: { 'zh-Hant': '誓願' }, gloss: 'Vow, solemn pledge.', accent: 'amber' },
            { form: 'jō', scriptAlts: { 'zh-Hant': '成' }, gloss: 'To accomplish, complete, become. Bodhi reads this as "walk along" — the way is realised in walking, not in arrival.' },
          ],
        },
      ],
      commentary:
        'The same Mahāyāna formula as MAPLE\'s rendering, in the same Sino-Japanese. The Bodhi English differs in temperament: each line begins *Though X* (acknowledging the field\'s inexhaustibility) before *I vow to Y* (declaring the engagement anyway). The grammatical concession holds the impossibility open as part of the vow rather than papering over it.',
    },
  ],
};

export default bodhiVows;

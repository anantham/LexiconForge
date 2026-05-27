/**
 * Bodhisattva Vow — Tōrei Zenji.
 *
 * Composed by Tōrei Enji (1721-1792), Hakuin Ekaku's principal Dharma
 * heir and the co-systematizer of modern Rinzai Zen. *Bodhisattva's
 * Vow* (sometimes called *Universal Vow*) is one of the most
 * distinctive Rinzai compositions — a sustained meditation on
 * universal gratitude and reverence that pushes the bodhisattva ideal
 * into concrete relational practice.
 *
 * The Bodhi Sangha booklet (p.13) presents the vow preceded by the
 * short *Purification* gātha — the standard Sange-mon (懺悔文), a
 * well-attested pan-Mahāyāna confession formula with surviving Chinese
 * source (T. Tripitaka, multiple texts). The vow itself is presented
 * here in the Sanbo Kyodan / Diamond Sangha English lineage. The
 * Japanese original of Tōrei's vow exists but I haven't authored it at
 * depth — the chant happens in English at Bodhi Sangha.
 */

import type { LiturgyDoc } from '../../types/liturgy';

export const bodhisattvaVowTorei: LiturgyDoc = {
  slug: 'bodhisattva-vow',
  sangha: 'bodhi-sangha',
  order: 8,
  title: 'Bodhisattva Vow',
  subtitle: 'Tōrei Zenji (1721-1792)',
  tradition: 'zen',
  context: 'Composed by Tōrei Enji, Hakuin\'s principal Dharma heir, in late 18th-century Japan. The vow extends the bodhisattva ideal into concrete imagery — even the persecutor is the merciful avatar of Buddha.',
  sources: {
    canonical: [
      { label: 'Tōrei Enji (1721-1792)', url: 'https://en.wikipedia.org/wiki/T%C5%8Drei_Enji' },
      { label: 'Sange-mon (懺悔文) — pan-Mahāyāna confession formula' },
    ],
    ritual: [
      { label: 'Bodhi Sangha Sutras booklet (May 2016), p.13' },
    ],
  },
  curator:
    'Curation by Aditya. Text transcribed from the Bodhi Sangha booklet. The Purification gātha (Sange-mon, 懺悔文) is presented at depth with its Sino-Japanese kanji and pan-Mahāyāna pedigree; the vow itself uses the Sanbo Kyodan / Diamond Sangha English lineage but the Japanese original is not authored here — Bodhi chants this in English.',
  sections: [
    {
      id: 'framing',
      shape: 'prose-commentary',
      body: '*Tōrei Enji* (1721-1792) was Hakuin Ekaku\'s principal Dharma heir and the co-systematizer of modern Rinzai Zen. His *Bodhisattva Vow* is a sustained meditation on universal gratitude and reverence that pushes the bodhisattva ideal into concrete relational practice: *if any chance such a person should turn against us, …we should sincerely bow down with humble language, in reverent belief that he or she is the merciful avatar of Buddha*.\n\nThe Bodhi Sangha booklet pairs the vow with a brief *Purification* gātha (the *Sange-mon* 懺悔文) that precedes it — the standard pattern across Rinzai liturgy.',
    },

    // ── Purification — Sange-mon 懺悔文 ──
    {
      id: 'purification',
      shape: 'triple-script-witness',
      large: true,
      segments: [
        {
          id: 'sange-mon',
          pali: 'Ga shaku shō zō sho aku gō / Kai yū mu shi ton jin chi / Jū shin go i shi sho shō / Issai ga kon kai san ge',
          scripts: [
            {
              lang: 'zh-Hant',
              label: 'Chinese (canonical)',
              text: '我昔所造諸惡業\n皆由無始貪瞋癡\n從身語意之所生\n一切我今皆懺悔',
              tokens: ['我', '昔', '所造', '諸', '惡業', '皆由', '無始', '貪瞋癡', '從', '身語意', '之所生', '一切', '我今', '皆', '懺悔'],
              transliteration: 'wǒ xī suǒ-zào zhū è-yè / jiē-yóu wú-shǐ tān-chēn-chī / cóng shēn-yǔ-yì zhī-suǒ-shēng / yī-qiè wǒ-jīn jiē chàn-huǐ  (Mandarin pinyin)',
            },
            {
              lang: 'ja-Jpan',
              label: 'Sino-Japanese (chant)',
              text: 'Ga shaku shō zō sho aku gō\nKai yū mu shi ton jin chi\nJū shin go i shi sho shō\nIssai ga kon kai san ge',
              source: 'Standard Rinzai / Sōtō Zen chanting form',
            },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'All the evil karma, ever committed by me since of old, On account of my beginningless greed, hatred and ignorance, Born of my conduct, speech, and thought, now I confess and repent.',
              license: 'Bodhi Sangha Sutras booklet',
            },
            {
              by: 'Sanbo Kyodan',
              text: 'All evil karma ever committed by me since of old, on account of my beginningless greed, anger, and ignorance, born of my body, mouth, and thought — now I atone for it all.',
              url: 'https://terebess.hu/zen/mester/Sanbo-Kyodan-Sutra.pdf',
              license: 'Public Sanbo Kyodan chanting text',
            },
          ],
          words: [
            { form: 'Ga', scriptAlts: { 'zh-Hant': '我' }, gloss: '"I, me". The chanter speaks in the first person — confession is personal, not abstract.' },
            { form: 'shaku', scriptAlts: { 'zh-Hant': '昔' }, gloss: '"Of old, formerly". The accumulated weight of past actions, not just recent ones.' },
            { form: 'aku gō', scriptAlts: { 'zh-Hant': '惡業' }, gloss: '*Evil karma*. *Aku* = bad/evil; *gō* = karma, action-with-consequence. Together: the harm-producing actions that follow one across lives.', accent: 'amber' },
            { form: 'ton jin chi', scriptAlts: { 'zh-Hant': '貪瞋癡' }, gloss: 'The Three Poisons: *ton* (greed, lust), *jin* (anger, hatred), *chi* (delusion, ignorance). The taproot of all evil karma.', accent: 'rose' },
            { form: 'shin go i', scriptAlts: { 'zh-Hant': '身語意' }, gloss: 'Body, speech, mind — the three doors through which karma is produced. The standard Buddhist triple.' },
            { form: 'san ge', scriptAlts: { 'zh-Hant': '懺悔' }, gloss: '*Repentance, confession*. *San* = confess (phonetic loan from Sanskrit *kṣama*); *ge* = repent. Together: not just verbal admission but heart-turning.', accent: 'sky' },
          ],
        },
      ],
      commentary: 'The Sange-mon (懺悔文) is a four-line pan-Mahāyāna confession formula. It appears in slightly varying forms across Chinese, Korean, Japanese, and Vietnamese Buddhist liturgy. The version above is the standard Rinzai / Sōtō Zen recitation. The chant identifies the structural cause of evil karma (the Three Poisons) and the three doors through which it manifests (body, speech, mind) — a complete diagnostic in four lines.',
    },

    // ── The Vow proper ──
    {
      id: 'vow-form-of-universe',
      shape: 'prose-commentary',
      heading: 'The real form of the universe',
      body: 'When I look at the real form of the universe,\nall is the never-failing manifestation of the mysterious truth of [[Tathāgata]].\nIn any event, in any moment, and in any place,\nnone can be other than the marvelous revelation of its glorious light.',
    },
    {
      id: 'vow-founders',
      shape: 'prose-commentary',
      heading: 'Why the founders extended care',
      body: 'This realization made our founding teachers and virtuous Zen leaders\nextend tender care, with the heart of worshipping,\nto animals and birds, and indeed to all beings.',
    },
    {
      id: 'vow-daily-offerings',
      shape: 'prose-commentary',
      heading: 'Daily offerings as Buddha\'s flesh',
      body: 'This realization teaches us that our daily food, drink, clothes\nand protections of life\nare the warm flesh and blood, the merciful incarnation of Buddha.',
    },
    {
      id: 'vow-gratitude',
      shape: 'prose-commentary',
      heading: 'Who can be ungrateful?',
      body: 'Who can be ungrateful or not respectful to each and everything\nas well as to human beings!\nEven though someone may be a fool,\nlet\'s be warm and compassionate.',
    },
    {
      id: 'vow-sworn-enemy',
      shape: 'prose-commentary',
      heading: 'The sworn enemy as merciful avatar',
      body: 'If by any chance such a person should turn against us,\nbecome a sworn enemy and abuse and persecute us,\nwe should sincerely bow down with humble language, in reverent belief\nthat he or she is the merciful avatar of Buddha,\nwho uses devices to emancipate us from sinful karma\nthat has been produced and accumulated upon ourselves\nby our own egoistic delusion and attachment\nthrough countless cycles of [[kalpas]].',
    },
    {
      id: 'vow-lotus-on-each-thought',
      shape: 'prose-commentary',
      heading: 'A lotus on each thought',
      body: 'Then on each moment\'s flash of our thought\nthere will grow a lotus flower,\nand on each lotus flower will be revealed a Buddha.',
    },
    {
      id: 'vow-pure-land',
      shape: 'prose-commentary',
      heading: 'Glorifying the Pure Land',
      body: 'These Buddhas will glorify [[Sukhāvati]], the Pure Land,\nevery moment and everywhere.\nMay we extend this mind over all beings\nso that we and the world together\nmay attain maturity in Buddha\'s wisdom.',
    },
  ],
};

export default bodhisattvaVowTorei;

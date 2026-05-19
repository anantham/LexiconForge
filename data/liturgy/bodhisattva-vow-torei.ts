/**
 * Bodhisattva Vow — Tōrei Zenji.
 *
 * Composed by Tōrei Enji (1721-1792), Hakuin Ekaku\'s principal Dharma
 * heir and the co-systematizer of modern Rinzai Zen. *Bodhisattva\'s
 * Vow* (sometimes called *Universal Vow* or *Tōrei\'s Vow*) is one of
 * the most distinctive Rinzai compositions — a long meditation on the
 * gratitude and reverence owed to all beings, including those who turn
 * against us.
 *
 * Bodhi Sangha\'s booklet (p.13) presents the vow preceded by the short
 * *Purification* gātha. Both pieces are foundational ceremonial material
 * across Rinzai Zen.
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
      { label: 'Bodhisattva Vow (Tōrei Zenji)' },
    ],
    ritual: [
      { label: 'Bodhi Sangha Sutras booklet (May 2016), p.13' },
    ],
  },
  curator:
    'Curation by Aditya. Text transcribed from the Bodhi Sangha booklet, which uses the standard English rendering used across Sanbo Kyodan / Diamond Sangha / Bodhi Zendō lineages. The image of *the sworn enemy* being honored as the merciful avatar of Buddha is the vow\'s most-cited line and the test of its commitment.',
  sections: [
    {
      id: 'framing',
      shape: 'prose-commentary',
      body: '*Tōrei Enji* (1721-1792) was Hakuin Ekaku\'s principal Dharma heir and the co-systematizer of modern Rinzai Zen. His *Bodhisattva\'s Vow* is one of the most distinctive Rinzai compositions — a sustained meditation on universal gratitude and reverence that pushes the bodhisattva ideal into concrete relational practice: *if any chance such a person should turn against us, …we should sincerely bow down with humble language, in reverent belief that he or she is the merciful avatar of Buddha*.\n\nThe Bodhi Sangha booklet pairs the vow with a brief *Purification* gātha that precedes it — the standard pattern across Rinzai liturgy.',
    },
    {
      id: 'purification',
      shape: 'prose-commentary',
      heading: 'Purification',
      body: 'All the evil karma, ever committed by me since of old,\nOn account of my beginningless greed, hatred and ignorance,\nBorn of my conduct, speech, and thought,\nnow I confess and repent.',
    },
    {
      id: 'vow-opening',
      shape: 'prose-commentary',
      heading: 'The vow opens',
      body: 'When I look at the real form of the universe,\nall is the never-failing manifestation of the mysterious truth of Tathāgata.\nIn any event, in any moment, and in any place,\nnone can be other than the marvelous revelation of its glorious light.\nThis realization made our founding teachers and virtuous Zen leaders\nextend tender care, with the heart of worshipping\nto animals and birds, and indeed to all beings.\nThis realization teaches us that our daily food, drink, clothes and protections of life\nare the warm flesh and blood, the merciful incarnation of Buddha.',
    },
    {
      id: 'who-can-be-ungrateful',
      shape: 'prose-commentary',
      heading: 'Reverence',
      body: 'Who can be ungrateful or not respectful to each and everything\nas well as to human beings!\nEven though someone may be a fool,\nlet\'s be warm and compassionate.\nIf by any chance such a person should turn against us,\nbecome a sworn enemy and abuse and persecute us,\nwe should sincerely bow down with humble language, in reverent belief\nthat he or she is the merciful avatar of Buddha,\nwho uses devices to emancipate us from sinful karma\nthat has been produced and accumulated upon ourselves\nby our own egoistic delusion and attachment\nthrough countless cycles of kalpas.',
    },
    {
      id: 'lotus-and-pure-land',
      shape: 'prose-commentary',
      heading: 'Lotus and Pure Land',
      body: 'Then on each moment\'s flash of our thought there will grow a lotus flower,\nand on each lotus flower will be revealed a Buddha.\nThese Buddhas will glorify Sukhāvati, the Pure Land,\nevery moment and everywhere.\nMay we extend this mind over all beings\nso that we and the world together\nmay attain maturity in Buddha\'s wisdom.',
    },
  ],
};

export default bodhisattvaVowTorei;

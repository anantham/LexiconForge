/**
 * Song of Zazen — Hakuin Zenji\'s *Zazen Wasan* (坐禅和讃).
 *
 * Hakuin Ekaku (1685-1768), the great reformer of Japanese Rinzai Zen,
 * composed the *Zazen Wasan* — *Song in Praise of Zazen* — as a
 * vernacular Japanese text meant for laypeople. Its argument: zazen
 * is not a preparation for awakening; *this very body, the Buddha* is
 * the present-tense realization that sitting practice opens onto.
 *
 * Bodhi Sangha booklet, p.14.
 */

import type { LiturgyDoc } from '../../types/liturgy';

export const songOfZazen: LiturgyDoc = {
  slug: 'song-of-zazen',
  sangha: 'bodhi-sangha',
  order: 9,
  title: 'Song of Zazen',
  subtitle: 'Hakuin Zenji — Zazen Wasan (坐禅和讃)',
  tradition: 'zen',
  context: 'Composed by Hakuin Ekaku (1685-1768) for lay practitioners. Recited at Bodhi Sangha as a meditation on zazen practice. The closing image — *This very place is the Lotus Land! This very body, the Buddha!* — is the chant\'s defining declaration.',
  sources: {
    canonical: [
      { label: 'Hakuin Ekaku (1685-1768)', url: 'https://en.wikipedia.org/wiki/Hakuin_Ekaku' },
      { label: 'Zazen Wasan (坐禅和讃)', url: 'https://en.wikipedia.org/wiki/Hakuin_Ekaku#Works' },
    ],
    ritual: [
      { label: 'Bodhi Sangha Sutras booklet (May 2016), p.14' },
    ],
  },
  curator:
    'Curation by Aditya. Text transcribed from the Bodhi Sangha booklet — standard English rendering used across Rinzai-derived Zen centres in the West. The references to *Six Worlds*, *Paramitas*, *Nembutsu*, *Fourfold Wisdom* are unpacked in the booklet\'s closing notes (see [[ti-sarana]]\'s curator note for the booklet\'s glossary page).',
  sections: [
    {
      id: 'framing',
      shape: 'prose-commentary',
      body: 'Hakuin\'s *Zazen Wasan* opens with the canonical declaration: *All beings by nature are Buddha. As ice by nature is water.* The argument is then drawn out: people search far when the truth is near; a wealthy child wanders lost among the poor; the Six Worlds are traversed only because we have forgotten the home we never left.\n\nThe text moves through the praises of zazen as the source of all *paramitas* and practices, then arrives at the chant\'s heart: when you turn your eyes inwards and bear witness to Self-Nature, the path is *beyond not-two and not-three*. The closing images are present-tense affirmations: *this very place is the Lotus Land; this very body, the Buddha*.\n\nHakuin composed the text in vernacular Japanese (*wasan*) explicitly for lay chanting — unlike the heavily Sino-Japanese sutra texts that monastics had access to. It is the most-chanted Japanese Zen text composed in Japanese rather than translated from Sanskrit or Chinese.',
    },
    {
      id: 'all-beings',
      shape: 'prose-commentary',
      heading: 'Ice and water',
      body: 'All beings by nature are Buddha,\nAs ice by nature is water.\nApart from water there is no ice;\nApart from beings, no Buddha.\nHow sad that people ignore the near\nAnd search for truth afar;\nLike someone in the midst of water crying out in thirst;\nLike a child of a wealthy home lost among the poor\nWandering through the Six Worlds\nFrom dark path to dark path,\nlost in the darkness of ignorance:\nWhen shall we be freed from birth-and-death?',
    },
    {
      id: 'praise-of-zazen',
      shape: 'prose-commentary',
      heading: 'In praise of zazen',
      body: 'Oh, the Zazen of Mahayana!\nIt can never be praised enough!\nThe many Paramitas of dana, sila, Nembutsu,\nRepentance, sadhana and so on\nAll have their source in Zazen.\nThe One Practice of Zazen erases numberless sins:\nWhere are then all the hells?\nThe Pure Land itself cannot be far away!\nOnce you hear this precious Dharma,\nTreasure it and delight in it,\nYou enter into eternal happiness.',
    },
    {
      id: 'self-nature',
      shape: 'prose-commentary',
      heading: 'Self-nature',
      body: 'When you truly turn your eyes inwards\nAnd bear witness to Self-Nature,\nSelf-Nature that is no-nature\nYou will have gone beyond meaningless debates:\nThe gate of oneness of cause and effect opens,\nThe path is beyond not-two and not-three.\nEntering the form of no-form,\nYour going and coming is nowhere else;\nEntering the thought of no-thought,\nYour singing and dancing is the voice of Dharma.',
    },
    {
      id: 'this-very-body',
      shape: 'prose-commentary',
      heading: 'This very place',
      body: 'How boundless and free is the sky of Samadhi,\nHow bright the Moon of the Fourfold Wisdom!\nAt this moment what are you seeking?\nNirvana is right here before your eyes:\nThis very place is the Lotus Land!\nThis very body, the Buddha!',
    },
  ],
};

export default songOfZazen;

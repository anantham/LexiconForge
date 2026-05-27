/**
 * Bodhi Sangha Precepts.
 *
 * The booklet (pp.10-12) presents the precepts as a single ceremonial
 * sequence:
 *   1. *Teaching of the Seven Buddhas* — the Dhammapada 183 verse that
 *      grounds the whole tradition\'s ethical vision.
 *   2. *Three Pure Precepts* — the Mahāyāna triple summary.
 *   3. *Ten Grave Precepts* — each given in two voices: Bodhidharma\'s
 *      and Dōgen Zenji\'s, plus the precept-name in plain English.
 *   4. *Closing* — "All the precepts come to this ONE: Love your
 *      neighbour as yourself…"
 *
 * Bodhidharma\'s voicings (the *one-mind precepts* lineage) read each
 * precept from the perspective of the absolute — *In the realm of X
 * Dharma…*. Dōgen\'s voicings (Sōtō / Eihei lineage) read the same
 * precept from the perspective of practice — *do not destroy life*,
 * *the gate of liberation is open*.
 */

import type { LiturgyDoc } from '../../types/liturgy';

export const precepts: LiturgyDoc = {
  slug: 'precepts',
  sangha: 'bodhi-sangha',
  order: 7,
  title: 'The Precepts',
  subtitle: 'Seven Buddhas + Three Pure + Ten Grave Precepts',
  tradition: 'zen',
  context: 'The two-voice format (Bodhidharma + Dōgen Zenji) is the standard Sōtō / Zen liturgical presentation, paired with Dhammapada 183 — the Teaching of the Seven Buddhas.',
  sources: {
    canonical: [
      { label: 'Dhammapada 183 — Teaching of the Seven Buddhas', url: 'https://suttacentral.net/dhp179-196/en/sujato' },
      { label: 'The Sixteen Bodhisattva Precepts', url: 'https://en.wikipedia.org/wiki/Bodhisattva_Precepts' },
    ],
    ritual: [
      { label: 'Bodhi Sangha Sutras booklet (May 2016), pp.10-13' },
    ],
  },
  curator:
    'Curation by Aditya. Text transcribed from the Bodhi Sangha booklet. The Bodhidharma voicings come from the Chan precept-lineage (the *one-mind precepts* line); the Dōgen voicings are from his *Kyōjukaimon* (教授戒文, *Teaching and Bestowing the Precepts*). Both voicings are pan-Sōtō standard.',
  sections: [
    {
      id: 'framing',
      shape: 'prose-commentary',
      body: 'The Bodhisattva Precepts are not negative prohibitions in the Zen reading — they are the natural expression of the awakened mind. Each of the Ten Grave Precepts is presented in two voices.\n\n*Bodhidharma\'s voicing* opens "Self-nature is subtle and mysterious, in the realm of X Dharma…" — it reads the precept from the standpoint of the absolute, where *not killing* is not an injunction but a description of how reality already is.\n\n*Dōgen Zenji\'s voicing* gives the precept-in-practice, the body-and-action form of the same teaching. The two voices together hold the precept as both ground and gesture.',
    },
    {
      id: 'seven-buddhas',
      shape: 'prose-commentary',
      heading: 'The Teaching of the Seven Buddhas',
      body: 'Not to do harm\nAlways to do good\nAnd to keep one\'s heart-mind pure.\nThis is the teaching of all the Buddhas.\n\n*The same verse is Dhammapada 183 — the most-quoted single verse in early Buddhist literature, and the ethical signature shared across all schools.*',
    },
    {
      id: 'three-pure',
      shape: 'prose-commentary',
      heading: 'The Three Pure Precepts',
      body: 'Do not violate the precepts.\nPractice all good Dharma.\nSave the many beings.',
    },
    {
      id: 'precept-1',
      shape: 'prose-commentary',
      heading: '1. Do not kill.',
      body: '**Bodhidharma:** Self-nature is subtle and mysterious. In the realm of everlasting Dharma, not giving rise to the notion of extinction is the Precept of Not Killing.\n\n**Dōgen Zenji:** The Buddha-seed grows in accordance with not-taking life. This is the way into the Buddha\'s wisdom. Do not destroy life.',
    },
    {
      id: 'precept-2',
      shape: 'prose-commentary',
      heading: '2. Do not steal.',
      body: '**Bodhidharma:** Self-nature is subtle and mysterious. In the realm of the Dharma where nothing can be gained, not giving rise to thoughts of gain and loss is called the Precept of Not Stealing.\n\n**Dōgen Zenji:** When the self and things are not discriminated they are just as they are. The gate of liberation is open.',
    },
    {
      id: 'precept-3',
      shape: 'prose-commentary',
      heading: '3. Do not misuse sex.',
      body: '**Bodhidharma:** Self-nature is subtle and mysterious. In the realm of the Dharma of non-attachment, not giving rise to thoughts of attachment is called the Precept of Not Misusing Sex.\n\n**Dōgen Zenji:** The Three Wheels are pure and clear. When you have nothing to desire, you follow the way of all the Buddhas.',
    },
    {
      id: 'precept-4',
      shape: 'prose-commentary',
      heading: '4. Do not lie.',
      body: '**Bodhidharma:** Self-nature is subtle and mysterious. In the realm of the Dharma that is beyond all expression, not preaching a single word is called the Precept Not to Lie.\n\n**Dōgen Zenji:** The Wheel of Dharma turns from the beginning. There is neither surplus nor lack. The whole universe is moistened with nectar, obtaining truth, obtaining fact.',
    },
    {
      id: 'precept-5',
      shape: 'prose-commentary',
      heading: '5. Do not misuse intoxicants.',
      body: '**Bodhidharma:** Self-nature is subtle and mysterious. In the realm of intrinsically pure and bright Dharma, not giving rise to delusions is the Precept of Not Misusing Intoxicants.\n\n**Dōgen Zenji:** Don\'t introduce intoxicants. Do not make others defile themselves. This is indeed the great light.',
    },
    {
      id: 'precept-6',
      shape: 'prose-commentary',
      heading: '6. Do not indulge in speaking the faults of others.',
      body: '**Bodhidharma:** Self-nature is subtle and mysterious. In the realm of the flawless Dharma, not expounding upon others\' errors is called the Precept of Not Indulging in Speaking the Faults of Others.\n\n**Dōgen Zenji:** In the Buddha Dharma there is one path, one dharma, one realization, one practice. Do not permit fault-finding. Do not cause others to be led astray.',
    },
    {
      id: 'precept-7',
      shape: 'prose-commentary',
      heading: '7. Do not praise yourself while abusing others.',
      body: '**Bodhidharma:** Self-nature is subtle and mysterious. In the realm of equitable Dharma, not dwelling upon I against you is the Precept of Not Praising yourself while Abusing Others.\n\n**Dōgen Zenji:** Buddhas and Ancestral Teachers have realized the Emptiness of the vast sky and the great earth. When they manifest the great body, they are like the sky without inside or outside. When they manifest the Dharma body, there is not even an inch of ground on earth.',
    },
    {
      id: 'precept-8',
      shape: 'prose-commentary',
      heading: '8. Do not begrudge the Dharma assets.',
      body: '**Bodhidharma:** Self-nature is subtle and mysterious. In the realm of the Dharma of all pervading Suchness, when not one thing is greedily clung to, is called the Precept of Not Begrudging the Dharma Assets.\n\n**Dōgen Zenji:** One word, one phrase, that is the ten thousand things and one hundred grasses. One dharma, one realization, that is all the Buddhas and Ancestral Teachers. From the beginning there is nothing to be begrudged.',
    },
    {
      id: 'precept-9',
      shape: 'prose-commentary',
      heading: '9. Do not indulge in anger.',
      body: '**Bodhidharma:** Self-nature is subtle and mysterious. In the realm of the Dharma of no-self, not postulating a self is called the Precept of Not Indulging in Anger.\n\n**Dōgen Zenji:** Not advancing, not retreating. Not real, not empty. There is a sea of bright clouds, there is a sea of solemn clouds.',
    },
    {
      id: 'precept-10',
      shape: 'prose-commentary',
      heading: '10. Do not defame the Three Treasures.',
      body: '**Bodhidharma:** Self-nature is subtle and mysterious. In the realm of the One, not holding dualistic concepts of ordinary beings and Buddhas is called the Precept of Not Defaming the Three Treasures.\n\n**Dōgen Zenji:** To expound the Dharma with this body is the harbour and weir of this world. This is the most important thing in the world. Its virtue finds its home in the ocean of essential nature. It is beyond explanation. Wholeheartedly revere and serve it.',
    },
    {
      id: 'one-precept',
      shape: 'prose-commentary',
      heading: 'All the precepts come to This ONE',
      body: 'LOVE YOUR NEIGHBOUR AS YOURSELF.\nLove all beings.\nLove is your self-nature.\n\n*The booklet\'s closing line — phrased in language pulled from the Sermon on the Mount, AMA Samy\'s community being Indian Catholic-and-Buddhist syncretic in its formation. The instruction sits as the final synthesis of all ten precepts.*',
    },
  ],
};

export default precepts;

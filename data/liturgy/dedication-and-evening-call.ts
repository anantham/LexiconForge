/**
 * Dedication + Evening Call — Bodhi Sangha\'s ceremonial closing.
 *
 * The two pieces that close the day\'s formal chanting in the Bodhi
 * Sangha booklet (p.15):
 *   - *Dedication* — the merits of *sesshin* and recitation are offered
 *     to all teachers past-present-future and to all beings.
 *   - *Evening Call* — the traditional Zen *Han* call before sleep:
 *     life-and-death is of supreme importance, time passes swiftly.
 *
 * Together they mark the threshold between formal liturgy and silence
 * (and, for the evening, between this day and rest).
 *
 * Booklet ends with "The Spirit and Bride say, \'Come!\'" — a line from
 * Revelation 22:17. AMA Samy\'s Bodhi Sangha is a Christian-Buddhist
 * dialogue community; the closing line acknowledges that context.
 */

import type { LiturgyDoc } from '../../types/liturgy';

export const dedicationAndEveningCall: LiturgyDoc = {
  slug: 'dedication-and-evening-call',
  sangha: 'bodhi-sangha',
  order: 11,
  title: 'Dedication + Evening Call',
  subtitle: 'Ceremonial closing',
  tradition: 'zen',
  context: 'The *Dedication* offers merit to all teachers and beings; the *Evening Call* — traditional in Zen monastic life — names the urgency of practice before rest.',
  sources: {
    canonical: [
      { label: 'Zen *Evening Call* / *Han* gātha (traditional)' },
      { label: 'Bodhisattva merit-dedication formula (pan-Mahāyāna)' },
    ],
    ritual: [
      { label: 'Bodhi Sangha Sutras booklet (May 2016), p.15' },
    ],
  },
  curator:
    'Curation by Aditya. Text transcribed from the Bodhi Sangha booklet. The Bodhi-Christian *Spirit and Bride* closing line — from Revelation 22:17 — reflects AMA Samy\'s community as a Buddhist-Catholic dialogue space in Tamil Nadu, not a standard Zen formula.',
  sections: [
    {
      id: 'dedication',
      shape: 'prose-commentary',
      heading: 'Dedication',
      body: 'In the purity and clarity of the Dharmakaya\nIn the fullness and perfection of the Sambhogakaya,\nIn the infinite variety of the Nirmanakaya,\nWe dedicate the virtues of our sesshin and our recitations\nTo the Ancient Seven Buddhas, Dai Osho,\nShakyamuni Buddha, Dai Osho\nAll Founding Teachers, past, present, future, Dai Osho;\nAnd for the enlightenment of bushes and grasses\nAnd all the many beings of the world;\nIn grateful thanks to all our many guides along the Ancient Way,\nAll Buddhas throughout space and time,\nAll Bodhisattvas, Mahasattvas,\nThe Great Prajnaparamita.',
    },
    {
      id: 'dedication-gloss',
      shape: 'prose-commentary',
      body: '*Dai Osho* (大和尚) — "great teacher", a title of address for senior masters in the Sōtō / Rinzai transmission. The dedication threads the lineage forward (Seven Buddhas → Shakyamuni → all founding teachers) and outward (to all bushes, grasses, and beings), grounding the chant\'s merit in the widest possible field.\n\n*Three Bodies of the Buddha:*\n  - *Dharmakaya* — the truth-body, the absolute.\n  - *Sambhogakaya* — the enjoyment-body, the buddha-as-vision.\n  - *Nirmanakaya* — the manifestation-body, the historical Buddha and every awakened presence in the world.',
    },
    {
      id: 'evening-call',
      shape: 'prose-commentary',
      heading: 'Evening Call',
      body: 'I beg to urge you everyone:\nLife-and-death is of supreme importance,\nTime passes swiftly and opportunity is lost.\nAwake, realize your true self,\nAwake to your Buddha-Nature.',
    },
    {
      id: 'evening-call-gloss',
      shape: 'prose-commentary',
      body: '*Traditional Zen monastic *han* gātha — chanted (or struck on a wooden board, the *han*) at the end of the day. The point is not melancholy but urgency: this body, this day, this moment is enough.*\n\nThe closing line of the booklet — *"The Spirit and Bride say, \'Come!\'"* — comes from Revelation 22:17. AMA Samy\'s Bodhi Sangha is a Buddhist-Catholic dialogue community in Tamil Nadu; the closing acknowledges that the Zen liturgy is held inside a larger interfaith conversation. The line is left as it stands in the booklet, not as a doctrinal claim but as a marker of the community\'s actual rhythm.',
    },
  ],
};

export default dedicationAndEveningCall;

/**
 * Maha Prajna Paramita Hrdaya Sutra — Bodhi Sangha rendering.
 *
 * The same Heart Sutra that lives under /liturgy/maple/heart-sutra, but
 * chanted at Bodhi Sangha in a specific English recension — the
 * Aitken-Rochester / Diamond Sangha lineage rendering (or close to it)
 * that AMA Samy\'s community uses. This file presents Bodhi\'s text as
 * it appears in their booklet rather than re-doing the multi-script
 * canonical analysis (which is parked under the MAPLE doc).
 *
 * Source: Bodhi Sangha Sutras booklet (May 2016), p.3.
 */

import type { LiturgyDoc } from '../../types/liturgy';

export const bodhiHeartSutra: LiturgyDoc = {
  slug: 'heart-sutra',
  sangha: 'bodhi-sangha',
  order: 3,
  title: 'Maha Prajna Paramita Hrdaya Sutra',
  subtitle: 'The Heart Sutra',
  tradition: 'mahayana',
  context: 'Chanted at Bodhi Sangha during formal sutra service. Bodhi\'s English recension reads close to the Aitken-Rochester / Diamond Sangha line used across Zen centres in the Yamada Roshi / Sanbo Kyodan tradition.',
  sources: {
    canonical: [
      { label: 'Prajñāpāramitā Hṛdaya — multi-script analysis at /liturgy/maple/heart-sutra' },
      { label: 'Heart Sutra (overview)', url: 'https://en.wikipedia.org/wiki/Heart_Sutra' },
    ],
    ritual: [
      { label: 'Bodhi Sangha Sutras booklet (May 2016), p.3' },
    ],
  },
  curator:
    'Curation by Aditya. The Sanskrit / Chinese / Tibetan canonical analysis lives at /liturgy/maple/heart-sutra — this page presents Bodhi Sangha\'s specific English rendering as chanted in the booklet, with light commentary on where the wording differs from other lineages.',
  sections: [
    {
      id: 'framing',
      shape: 'prose-commentary',
      body: 'The shortest Mahāyāna sutra, chanted across Zen, Tibetan, and Pure Land traditions worldwide. Bodhi Sangha\'s English recension is close to the Aitken-Rochester / Diamond Sangha line — *clearly saw* (not "perceived"), *transforming all suffering and distress* (not "and was saved from all anguish"), the spare *Gaté, Gaté, Paragaté* mantra in the closing.\n\nFor the multi-script canonical analysis (Sanskrit IAST + Devanāgarī, Chinese Xuanzang T251, Tibetan Kangyur short form) and the comparative survey of English witnesses (Conze, Red Pine, Thich Nhat Hanh), see [[heart-sutra]] under MAPLE. This page presents Bodhi\'s specific English form intact.',
    },
    {
      id: 'opening',
      shape: 'prose-commentary',
      heading: 'Opening',
      body: 'Avalokiteshvara Bodhisattva,\npracticing deep Prajna Paramita\nclearly saw that all five skandhas are empty,\ntransforming all suffering and distress.',
    },
    {
      id: 'form-emptiness',
      shape: 'prose-commentary',
      heading: 'Form and emptiness',
      body: 'Shariputra, form is no other than emptiness,\nemptiness no other than form;\nform is emptiness, emptiness is form;\nfeeling, perception, mental reaction, consciousness\nare also like this.',
    },
    {
      id: 'no-marks',
      shape: 'prose-commentary',
      heading: 'No marks',
      body: 'Shariputra, all dharmas are essentially empty:\nnot born, not destroyed;\nnot stained, not pure, without loss, without gain.\nTherefore in emptiness there is no form, no feeling,\nno perception, mental reaction, consciousness;\nno eye, ear, nose, tongue, body, mind;\nno colour, sound, smell, taste, touch, objects of mind;\nno seeing and so on to no thinking;\nno ignorance and also no ending of ignorance\nand so on to no old age and death,\nand also no ending of old age and death;\nno suffering, cause of suffering, cessation, path;\nno wisdom and no attainment.',
    },
    {
      id: 'no-attainment',
      shape: 'prose-commentary',
      heading: 'The bodhisattva\'s freedom',
      body: 'Since there is nothing to attain,\nthe Bodhisattva lives by Prajna Paramita\nwith no hindrance in the mind; no hindrance, thus no fear;\nfar beyond delusive thinking right here is Nirvana.\nAll Buddhas past, present, and future\nlive by Prajna Paramita,\nattaining Anuttara Samyak Sambodhi.',
    },
    {
      id: 'mantra',
      shape: 'prose-commentary',
      heading: 'The great mantra',
      body: 'Therefore know that Prajna Paramita is the great mantra, the wisdom mantra,\nthe unsurpassed mantra, the supreme mantra,\nwhich completely removes all suffering.\nThis is truth, not mere formality.\nTherefore set forth the Prajna Paramita mantra\nset forth this mantra and proclaim:\n\n*Gaté, Gaté, Paragaté, Parasamgaté.*\n*Bodhi Swaha.*',
    },
    {
      id: 'mantra-gloss',
      shape: 'prose-commentary',
      heading: 'On the mantra',
      body: 'Standard analysis: *gate* (gone), *pāragate* (gone beyond), *pārasaṃgate* (gone altogether beyond), *bodhi svāhā* (awakening — so be it). The grammatical form is feminine vocative singular — addressing the Goddess Prajñāpāramitā herself. The mantra is not translated in chanting practice; the syllables themselves carry the freight.',
    },
  ],
};

export default bodhiHeartSutra;

/**
 * Dedication + Evening Call — Bodhi Sangha's ceremonial closing.
 *
 * The two pieces that close the day's formal chanting in the Bodhi
 * Sangha booklet (p.15):
 *   - *Dedication* — the merits of *sesshin* and recitation are offered
 *     to all teachers past-present-future and to all beings.
 *   - *Evening Call* (Han Gātha 板偈) — the traditional Zen wooden-block
 *     call before sleep: life-and-death is of supreme importance, time
 *     passes swiftly.
 *
 * Together they mark the threshold between formal liturgy and silence
 * (and, for the evening, between this day and rest).
 *
 * Booklet ends with "The Spirit and Bride say, 'Come!'" — a line from
 * Revelation 22:17. AMA Samy's Bodhi Sangha is a Christian-Buddhist
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
      { label: 'Han Gātha (板偈) — traditional Zen monastic evening-call formula' },
      { label: 'Three Bodies (Trikāya) doctrine — pan-Mahāyāna' },
    ],
    ritual: [
      { label: 'Bodhi Sangha Sutras booklet (May 2016), p.15' },
    ],
  },
  curator:
    'Curation by Aditya. Text transcribed from the Bodhi Sangha booklet. The *Evening Call* is the canonical Han Gātha (板偈), well-attested across Zen monasteries — authored here with Sino-Japanese kanji + reading + multi-witness English. The *Dedication* is in the Diamond Sangha / Sanbo Kyodan English lineage (kept as prose, with word-glosses for the Sanskrit technical terms — Dharmakāya, Saṃbhogakāya, Nirmāṇakāya, Dai Oshō, Prajñāpāramitā). The Bodhi-Christian *Spirit and Bride* closing line (Revelation 22:17) reflects AMA Samy\'s community as a Buddhist-Catholic dialogue space in Tamil Nadu, not a standard Zen formula.',
  sections: [

    // ── Dedication ──
    {
      id: 'dedication',
      shape: 'prose-commentary',
      heading: 'Dedication',
      body: 'In the purity and clarity of the [[Dharmakāya]],\nIn the fullness and perfection of the [[Saṃbhogakāya]],\nIn the infinite variety of the [[Nirmāṇakāya]],\nWe dedicate the virtues of our *sesshin* and our recitations\nTo the Ancient Seven Buddhas, *Dai Oshō* (大和尚),\nShākyamuni Buddha, *Dai Oshō*,\nAll Founding Teachers, past, present, future, *Dai Oshō*;\nAnd for the enlightenment of bushes and grasses\nAnd all the many beings of the world;\nIn grateful thanks to all our many guides along the Ancient Way,\nAll Buddhas throughout space and time,\nAll Bodhisattvas, *Mahāsattvas*,\nThe Great [[Prajñāpāramitā]].',
    },
    {
      id: 'dedication-gloss',
      shape: 'prose-commentary',
      body: '*Dai Oshō* (大和尚) — "great teacher", a title of address for senior masters in the Sōtō / Rinzai transmission. The dedication threads the lineage forward (Seven Buddhas → Shākyamuni → all founding teachers) and outward (to all bushes, grasses, and beings), grounding the chant\'s merit in the widest possible field.\n\n*Three Bodies of the Buddha* (Trikāya, 三身):\n  - **Dharmakāya** (法身) — the truth-body, the absolute. *Dharma* + *kāya* "body".\n  - **Saṃbhogakāya** (報身) — the enjoyment-body, the buddha-as-vision. *Saṃbhoga* "enjoyment, fruition".\n  - **Nirmāṇakāya** (応身) — the manifestation-body, the historical Buddha and every awakened presence in the world. *Nirmāṇa* "construction, formation".\n\n*Mahāsattva* (摩訶薩) — "great being", an honorific for advanced bodhisattvas. *Mahā* "great" + *sattva* "being".\n\n*Prajñāpāramitā* — the Perfection of Wisdom; the same heart of [[heart-sutra]].',
    },

    // ── Evening Call — Han Gātha 板偈 ──
    {
      id: 'evening-call',
      shape: 'triple-script-witness',
      large: true,
      segments: [
        {
          id: 'han-gatha',
          pali: 'Shō ji ji dai · Mu jō jin soku · Kaku gi sei kaku · Shin motsu hō itsu',
          scripts: [
            {
              lang: 'zh-Hant',
              label: 'Chinese (canonical)',
              text: '生死事大\n無常迅速\n各宜醒覺\n慎勿放逸',
              tokens: ['生死', '事大', '無常', '迅速', '各宜', '醒覺', '慎', '勿', '放逸'],
              transliteration: 'shēng-sǐ shì-dà / wú-cháng xùn-sù / gè-yí xǐng-jué / shèn wù fàng-yì  (Mandarin pinyin)',
            },
            {
              lang: 'ja-Jpan',
              label: 'Sino-Japanese (chant)',
              text: 'Shō ji ji dai\nMu jō jin soku\nKaku gi sei kaku\nShin motsu hō itsu',
              source: 'Standard Rinzai / Sōtō Zen Han-gātha (板偈)',
            },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'I beg to urge you everyone: Life-and-death is of supreme importance, Time passes swiftly and opportunity is lost. Awake, realize your true self, Awake to your Buddha-Nature.',
              license: 'Bodhi Sangha Sutras booklet',
            },
            {
              by: 'San Francisco Zen Center',
              text: 'Let me respectfully remind you, life and death are of supreme importance. Time swiftly passes by, and opportunity is lost. Each of us should strive to awaken. Awaken! Take heed: do not squander your life.',
              url: 'https://sfzc.org',
              license: 'Suzuki-Roshi lineage Han Gātha rendering',
            },
            {
              by: 'Sanbo Kyodan',
              text: 'Life and death are of grave concern; impermanence is swift. Each of you, wake up! Wake up! Do not waste this life.',
              url: 'https://terebess.hu/zen/mester/Sanbo-Kyodan-Sutra.pdf',
              license: 'Public Sanbo Kyodan chanting text',
            },
          ],
          words: [
            { form: 'Shō ji', scriptAlts: { 'zh-Hant': '生死' }, gloss: '*Life-and-death*, birth-and-death. The fundamental fact of saṃsāra and the urgency of the path.', accent: 'rose' },
            { form: 'ji dai', scriptAlts: { 'zh-Hant': '事大' }, gloss: '*Of supreme importance*. *Ji* (事) = matter, affair; *dai* (大) = great. Together: "this is the great matter".' },
            { form: 'Mu jō', scriptAlts: { 'zh-Hant': '無常' }, gloss: '*Impermanence*. The First Mark of existence in Buddhist teaching — nothing endures. Same compound that opens Hakuin\'s *Song of Zazen* via 無常迅速.', accent: 'amber' },
            { form: 'jin soku', scriptAlts: { 'zh-Hant': '迅速' }, gloss: '*Swift, rapid*. Time passes faster than the chanter realizes. Pairs with *mu jō* to mean "impermanence is swift".' },
            { form: 'Kaku gi', scriptAlts: { 'zh-Hant': '各宜' }, gloss: '*Each one should*. *Kaku* (各) = each; *gi* (宜) = ought, should. The chant turns from observation to imperative.' },
            { form: 'sei kaku', scriptAlts: { 'zh-Hant': '醒覺' }, gloss: '*Awaken, be alert*. *Sei* (醒) = wake from sleep; *kaku* (覺) = awaken, the same character as in *Buddha* (覚者 "the awakened one"). The instruction: wake up to your nature now.', accent: 'sky' },
            { form: 'Shin', scriptAlts: { 'zh-Hant': '慎' }, gloss: '*Take heed, be cautious*. A warning particle.' },
            { form: 'motsu', scriptAlts: { 'zh-Hant': '勿' }, gloss: '*Do not*. The negative imperative.' },
            { form: 'hō itsu', scriptAlts: { 'zh-Hant': '放逸' }, gloss: '*Negligence, heedlessness, dissipation*. *Hō* (放) = release, let go; *itsu* (逸) = stray, deviate. Together: the squandering of practice-time. The same *pamāda* against which the Pāli suttas constantly warn.', accent: 'amber' },
          ],
        },
      ],
      commentary: 'The Han Gātha (板偈) is the verse traditionally struck on the wooden *han* board outside the zendō at the end of the day. The point is not melancholy but urgency — this body, this day, this moment is enough. Variants exist across Zen lineages; the four-line form above is the standard.',
    },

    // ── Closing line (Bodhi-Christian dialogue context) ──
    {
      id: 'closing-line',
      shape: 'prose-commentary',
      heading: 'Closing',
      body: '*"The Spirit and Bride say, \'Come!\'"* — Revelation 22:17.\n\nAMA Samy\'s Bodhi Sangha is a Buddhist-Catholic dialogue community in Tamil Nadu. The closing line of the booklet acknowledges that the Zen liturgy is held inside a larger interfaith conversation. The line is left as it stands in the booklet — not as a doctrinal claim but as a marker of the community\'s actual rhythm.',
    },
  ],
};

export default dedicationAndEveningCall;

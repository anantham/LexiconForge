/**
 * Oṃ Maṇi Padme Hūṃ — the heart-mantra of Avalokiteśvara.
 *
 * Most widely-chanted mantra in the Buddhist world. Vajrayāna origin
 * (rooted in the *Kāraṇḍavyūha Sūtra*); spread from Sanskrit through Tibet
 * into China, Japan, Mongolia, Korea, and Vietnam. Each tradition reads it
 * slightly differently — both in pronunciation and in interpretation.
 *
 * Curation note: where the morning chants ground in DPD (Pāli), this mantra
 * spans languages no single dictionary covers. Etymology citations point
 * to Wikipedia as a starting reference. The Dalai Lama's commentary is
 * cited where his exegetical framework is invoked. Donald Lopez's caveat
 * about over-translating mantras is honoured in the framing.
 */

import type { LiturgyDoc } from '../../types/liturgy';
import {
  ungroundedCitation,
  wikipediaCitation,
  dalaiLamaCitation,
} from './_groundingHelpers';

export const omManiPadmeHum: LiturgyDoc = {
  slug: 'om-mani-padme-hum',
  sangha: 'maple',
  order: 8,
  time: 'evening, before sleep',
  title: 'Oṃ Maṇi Padme Hūṃ',
  subtitle: 'The heart-mantra of Avalokiteśvara',
  tradition: 'vajrayana',
  context: 'The six-syllable mantra of Avalokiteśvara (Tibetan: Chenrezig), the bodhisattva of compassion. Recited across Tibetan Buddhism as one of the most pervasive practices in the tradition.',
  sources: {
    canonical: [
      {
        label: 'Kāraṇḍavyūha Sūtra (Mahāyāna)',
        url: 'https://en.wikipedia.org/wiki/K%C4%81ra%E1%B9%87%E1%B8%8Davy%C5%ABha_S%C5%ABtra',
      },
      {
        label: 'H.H. the Dalai Lama — On the Meaning of OM MANI PADME HUM',
        url: 'https://www.dalailama.com/messages/buddhism/om-mani-padme-hum',
      },
    ],
    ritual: [
      { label: 'MAPLE evening practice' },
    ],
  },
  curator: 'Curation by Aditya. Per-syllable readings cite the Dalai Lama\'s framework where invoked; the Sanskrit literal reading follows Monier-Williams (via Wikipedia).',
  sections: [
    // ─────────────────────────────────────────────────────────────────────
    // 1. The mantra — multi-script, hover for per-syllable readings
    // ─────────────────────────────────────────────────────────────────────
    {
      id: 'sanskrit-mantra',
      shape: 'triple-script-witness',
      repetitions: 108,
      segments: [
        {
          id: 'mantra-main',
          pali: 'Oṃ maṇi padme hūṃ',
          paliDeva: 'ॐ मणि पद्मे हूँ',
          scripts: [
            { lang: 'sa-Latn', label: 'Sanskrit (IAST)', text: 'Oṃ maṇi padme hūṃ' },
            {
              lang: 'sa-Deva',
              label: 'Sanskrit (Devanāgarī)',
              text: 'ॐ मणि पद्मे हूँ',
              transliteration: 'Oṃ maṇi padme hūṃ',
            },
            {
              lang: 'bo-Tibt',
              label: 'Tibetan',
              text: 'ཨོཾ་མ་ཎི་པདྨེ་ཧཱུྃ',
              source: 'Tibetan transmission via the Kāraṇḍavyūha Sūtra lineage',
              tokens: ['ཨོཾ', 'མ་ཎི', 'པདྨེ', 'ཧཱུྃ'],
              transliteration: 'Om ma-ṇi pe-me hung  (Lhasa Tibetan phonetic)',
            },
            {
              lang: 'zh-Hant',
              label: 'Chinese (Hanzi)',
              text: '唵嘛呢叭咪吽',
              source: 'Han Buddhism phonetic transliteration',
              tokens: ['唵', '嘛呢', '叭咪', '吽'],
              transliteration: 'ǎn  má-ní  bā-mī  hōng  (Mandarin pinyin)',
            },
            {
              lang: 'ja-Jpan',
              label: 'Japanese (Shingon)',
              text: '唵嘛呢叭咪吽',
              source: 'Shingon esoteric tradition',
              tokens: ['唵', '嘛呢', '叭咪', '吽'],
              transliteration: 'On  ma-ni  pa-do-me  un  (Sino-Japanese)',
            },
          ],
          witnesses: [
            // Surface: Oṃ(0) maṇi(1) padme(2) hūṃ(3)
            // Locative: Om,(0) the(1) jewel(2) in(3) the(4) lotus,(5) Hum.(6)
            {
              by: 'Sanskrit (literal, locative)',
              text: 'Om, the jewel in the lotus, Hum.',
              alignTo: [0, -1, 1, -1, -1, 2, 3],
            },
            // Vocative reading — addressing Avalokiteśvara. No alignTo; the
            // compound "Jewel-Lotus One" doesn't split cleanly word-by-word.
            {
              by: 'Sanskrit (literal, vocative)',
              text: 'Om — O Jewel-Lotus One — Hum.',
            },
            // Tibetan exegetical reading — interpretive, not literal.
            {
              by: 'H.H. the Dalai Lama (exegesis)',
              text: 'Om — purity of body, speech, and mind through the path of method-and-wisdom — Hum.',
              url: 'https://www.dalailama.com/messages/buddhism/om-mani-padme-hum',
              license: 'Public address, quoted with attribution',
            },
          ],
          words: [
            {
              form: 'Oṃ',
              scriptAlt: 'ॐ',
              scriptAlts: { 'bo-Tibt': 'ཨོཾ', 'zh-Hant': '唵', 'ja-Jpan': '唵' },
              pronunciation: 'ohm',
              etymology: '*praṇava* — the primordial sound; sometimes written A-U-M',
              gloss: 'the sacred opening syllable; encompasses body, speech, and mind of all buddhas — Tibetan reading: purifies the body of all buddhas',
              accent: 'amber',
              citations: [
                wikipediaCitation('Om'),
                dalaiLamaCitation('messages/buddhism/om-mani-padme-hum', 'On the Meaning of OM MANI PADME HUM'),
              ],
            },
            {
              form: 'maṇi',
              scriptAlt: 'मणि',
              scriptAlts: { 'bo-Tibt': 'མ་ཎི', 'zh-Hant': '嘛呢', 'ja-Jpan': '嘛呢' },
              scriptMorphemes: {
                // Tibetan: maṇi spans two tsek-separated syllables — ma + ṇi.
                // The trailing tsek is grouped with the first morpheme so the
                // morpheme concatenation reproduces the surface "མ་ཎི".
                'bo-Tibt': [
                  { text: 'མ་', type: 'phonetic', pronunciation: 'ma', gloss: 'Ma — Tibetan tradition: ethics (*śīla*); purifies pride' },
                  { text: 'ཎི', type: 'phonetic', pronunciation: 'ṇi', gloss: 'Ṇi — Tibetan tradition: patience (*kṣānti*); purifies attachment' },
                ],
                'zh-Hant': [
                  { text: '嘛', type: 'phonetic', pronunciation: 'mā', gloss: 'Ma — phonetic char for the syllable ma' },
                  { text: '呢', type: 'phonetic', pronunciation: 'ní', gloss: 'Ṇi — phonetic char for the syllable ṇi' },
                ],
                'ja-Jpan': [
                  { text: '嘛', type: 'phonetic', pronunciation: 'ma', gloss: 'Ma — phonetic; Tibetan exegesis: ethics, purifies pride' },
                  { text: '呢', type: 'phonetic', pronunciation: 'ni', gloss: 'Ṇi — phonetic; Tibetan exegesis: patience, purifies attachment' },
                ],
              },
              pronunciation: 'MAH-nee',
              etymology: 'Sanskrit *maṇi* — "jewel, gem"',
              gloss: 'jewel — represents *method*, compassion, the awakening mind ([[bodhicitta]])',
              accent: 'rose',
              citations: [
                wikipediaCitation('Om mani padme hum'),
                ungroundedCitation('Monier-Williams Sanskrit dictionary lookup'),
              ],
            },
            {
              form: 'padme',
              scriptAlt: 'पद्मे',
              scriptAlts: { 'bo-Tibt': 'པདྨེ', 'zh-Hant': '叭咪', 'ja-Jpan': '叭咪' },
              scriptMorphemes: {
                // Tibetan: padme is written as one stacked syllable (pad with
                // subjoined ma + e vowel), can't cleanly split orthographically
                // — leave whole-token hover, no sub-morphemes for bo-Tibt.
                'zh-Hant': [
                  { text: '叭', type: 'phonetic', pronunciation: 'bā', gloss: 'Pad — Tibetan tradition: diligence (*vīrya*); purifies ignorance' },
                  { text: '咪', type: 'phonetic', pronunciation: 'mī', gloss: 'Me — Tibetan tradition: concentration (*samādhi*); purifies greed' },
                ],
                'ja-Jpan': [
                  { text: '叭', type: 'phonetic', pronunciation: 'pa', gloss: 'Pad — Tibetan exegesis: diligence, purifies ignorance' },
                  { text: '咪', type: 'phonetic', pronunciation: 'me', gloss: 'Me — Tibetan exegesis: concentration, purifies greed' },
                ],
              },
              pronunciation: 'PUHD-meh',
              etymology: '*padma* "lotus" + the *-e* ending — which can mean either "in the …" or "O …!" (addressing)',
              gloss: '"in the lotus" — or, read as a call, "O Lotus One" — represents *wisdom* ([[prajñā]])',
              accent: 'sky',
              morphemes: [
                {
                  text: 'padm',
                  type: 'root',
                  gloss: 'lotus — the flower that grows in mud but is not soiled by it; symbol of awakened mind arising in saṁsāra',
                  pronunciation: 'PUHD-m',
                  root: '√pad',
                  citations: [wikipediaCitation('Padma_(attribute)')],
                },
                {
                  text: 'e',
                  type: 'suffix',
                  gloss: 'the *-e* ending — either "in the [lotus]" or, read as a call, "O [Lotus One]!". Sanskrit grammars allow both readings',
                  pronunciation: 'eh',
                  citations: [ungroundedCitation('Sanskrit case morphology — needs grammar reference')],
                },
              ],
            },
            {
              form: 'hūṃ',
              scriptAlt: 'हूँ',
              scriptAlts: { 'bo-Tibt': 'ཧཱུྃ', 'zh-Hant': '吽', 'ja-Jpan': '吽' },
              pronunciation: 'hoong',
              etymology: '*bīja* — a "seed" syllable; mantric, not lexical',
              gloss: 'the sacred closing seed-syllable; indivisibility of method and wisdom — Tibetan reading: wisdom (*prajñā*); purifies aggression',
              accent: 'violet',
              citations: [
                wikipediaCitation('Bīja'),
                ungroundedCitation('hūṃ as seed syllable in Vajrayāna — needs textual reference'),
              ],
            },
          ],
          note: 'The widely-taught syllable-by-syllable interpretation maps the six syllables onto the *six pāramitās* (perfections) and the *six realms* of saṁsāra. The mapping is from the [[Kāraṇḍavyūha Sūtra]], elaborated by Tibetan masters including H.H. the Dalai Lama:\n\n— **Oṃ**: body, speech, mind of all buddhas\n— **Ma**: ethics (*śīla*) — purifies pride\n— **Ṇi**: patience (*kṣānti*) — purifies attachment\n— **Pad**: diligence (*vīrya*) — purifies ignorance\n— **Me**: concentration (*samādhi*) — purifies greed\n— **Hūṃ**: wisdom (*prajñā*) — purifies aggression\n\nThis is *one* lens among many. The mantra is chanted, not analysed; the analysis is teaching scaffolding.',
        },
      ],
      commentary:
        'Traditionally chanted 108 times (one *mālā* — string of beads). Practice may be silent, whispered, or aloud, alone or in chorus. In Tibetan tradition, prayer wheels and prayer flags inscribed with the mantra extend its presence beyond the moment of saying it.',
    },

  ],
};

export default omManiPadmeHum;

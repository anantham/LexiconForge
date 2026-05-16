/**
 * Sho Sai Myō Kichijō Darani — 消災妙吉祥陀羅尼
 *
 * "The Marvelous Auspicious Dharani for Eliminating Disasters" — also
 * called Namu Samando (after its opening words). A sound-formula
 * (dharani) chanted 3× after the Enmē Jikku Kannon Gyō in the MAPLE
 * morning service.
 *
 * Like all dharanis, the practice is the sound, not the meaning. The
 * Sanskrit reconstruction (opening: *namaḥ samanta-buddhānāṃ
 * apratihata-śāsanānām* — "homage to all the buddhas whose teaching is
 * unimpeded") is offered as scholarly background, but the chanted form
 * has been a Sino-Japanese phonetic transmission for over a millennium
 * and is not used as translatable text.
 *
 * Reader treatment: `sound-formula` shape — monumental centred
 * phonemes, no inline English. Two scripts (Sino-Japanese phonetic +
 * Hanzi). Reconstruction in the aside.
 */

import type { LiturgyDoc } from '../../types/liturgy';

export const shoSaiMyoKichijoDarani: LiturgyDoc = {
  slug: 'sho-sai-myo-kichijo-darani',
  sangha: 'maple',
  order: 3,
  title: 'Sho Sai Myō Kichijō Darani',
  subtitle: 'The Marvelous Auspicious Dharani for Eliminating Disasters — 消災妙吉祥陀羅尼',
  tradition: 'mahayana',
  context: 'Chanted 3× after the Enmē Jikku Kannon Gyō in the MAPLE morning service.',
  sources: {
    canonical: [
      {
        label: 'Soto Zen morning service tradition',
        url: 'https://en.wikipedia.org/wiki/Dharani',
      },
    ],
    ritual: [
      { label: 'MAPLE morning service sheet' },
    ],
  },
  curator:
    'Curation by Aditya. Sino-Japanese phonetic + Hanzi forms transcribed directly from the MAPLE chant sheet. Sanskrit reconstruction follows standard scholarly readings (Inagaki, Yokoyama).',
  sections: [
    {
      id: 'framing',
      shape: 'prose-commentary',
      body: 'A *dharani* — a sound-formula, not a translatable phrase. The Sanskrit ancestor reads roughly "Homage to all the buddhas, whose teaching is unimpeded. So: oṃ kha kha khāhi khāhi hūṃ hūṃ jvala jvala prajvala prajvala, stand stand, sphaṭ sphaṭ, for peace and prosperity, svāhā." But the chant is not the translation. The chant is the sound, and the sound is the practice.\n\nThe MAPLE community knows this chant as **Namu Samando** — after its opening words. It\'s recited 3× as a protection / averting of calamities, in the position the Soto Zen tradition reserves for it: after the Enmē Jikku Kannon Gyō, before the Heart Sutra.',
    },
    {
      id: 'dharani',
      shape: 'sound-formula',
      framing:
        'Sound-formula. Each line, three times. The "meaning" is the sounding.',
      phonemes:
        'Na mu sa man da mo to nan\nO ha ra chi ko to sha so no nan\nTo ji to en gya gya gya ki gya ki\nUn nun shi fu ra shi fu ra\nHa ra shi fu ra ha ra shi fu ra\nChi shu sa chi shu sa\nShi shu ri shi shu ri\nSo ha ja so ha ja\nSe chi gya shi ri ē so mo ko',
      native:
        '曩謨三滿哆 母䭾喃\n阿盋囉底 賀多舍 娑曩喃\n怛姪他 唵 佉佉 佉呬 佉呬\n吽吽 入嚩囉 入嚩囉\n盋囉入嚩囉 盋囉入嚩囉\n底瑟姹 底瑟姹\n瑟緻哩 瑟緻哩\n娑發吒 娑發吒\n扇底迦 室哩曳 娑婆訶',
      scripts: [
        {
          lang: 'ja-Jpan',
          label: 'Sino-Japanese (phonetic)',
          text: 'Na mu sa man da mo to nan\nO ha ra chi ko to sha so no nan\nTo ji to en gya gya gya ki gya ki\nUn nun shi fu ra shi fu ra\nHa ra shi fu ra ha ra shi fu ra\nChi shu sa chi shu sa\nShi shu ri shi shu ri\nSo ha ja so ha ja\nSe chi gya shi ri ē so mo ko',
        },
        {
          lang: 'zh-Hant',
          label: 'Hanzi (phonetic carriers)',
          text: '曩謨三滿哆 母䭾喃\n阿盋囉底 賀多舍 娑曩喃\n怛姪他 唵 佉佉 佉呬 佉呬\n吽吽 入嚩囉 入嚩囉\n盋囉入嚩囉 盋囉入嚩囉\n底瑟姹 底瑟姹\n瑟緻哩 瑟緻哩\n娑發吒 娑發吒\n扇底迦 室哩曳 娑婆訶',
          source: 'Sino-Japanese kanji are PHONETIC carriers — chosen for sound, not meaning. The semantic meaning of each character (e.g. 曩 "long ago", 謨 "plan") is unrelated to the chant.',
          transliteration:
            'Na mu sa man da mo to nan / O ha ra chi ko to sha so no nan / To ji to en gya gya gya ki gya ki / Un nun shi fu ra shi fu ra / Ha ra shi fu ra ha ra shi fu ra / Chi shu sa chi shu sa / Shi shu ri shi shu ri / So ha ja so ha ja / Se chi gya shi ri ē so mo ko',
        },
      ],
      reconstruction:
        'Sanskrit reading (Inagaki / Yokoyama): *namaḥ samanta-buddhānāṃ apratihata-śāsanānām. tadyathā: oṃ kha kha khāhi khāhi hūṃ hūṃ jvala jvala prajvala prajvala tiṣṭha tiṣṭha ṣṭri ṣṭri sphaṭ sphaṭ śāntika śrīye svāhā.*\n\nLiterally: "Homage to all the buddhas whose teaching is unimpeded. So: oṃ kha kha (sound) khāhi khāhi (sound) hūṃ hūṃ (seed-syllable) blaze blaze, blaze-forth blaze-forth, stand stand, sphaṭ sphaṭ (sound), for peace and prosperity, svāhā." A protection dharani; the *jvala* ("blaze") imagery is the standard fire-of-wisdom register, and *śāntika śrīye* ("for peace, for prosperity") names the purpose — *Sho Sai* (eliminating disaster), *Myō Kichijō* (marvelous auspicious).',
    },
    {
      id: 'why-namu-samando',
      shape: 'prose-commentary',
      heading: 'Why "Namu Samando"',
      body: 'In Zen practice, dharanis are often called by their opening words rather than their full title. **Namu Samando Moto Nan** is the opening line ("homage to all the buddhas"), and the chant takes its colloquial name from there.\n\nThe full doctrinal title *Sho Sai Myō Kichijō Darani* (消災妙吉祥陀羅尼) names the function:\n— **Sho** (消) — *to extinguish, dispel*\n— **Sai** (災) — *calamity, disaster*\n— **Myō** (妙) — *marvelous*\n— **Kichijō** (吉祥) — *auspicious*\n— **Darani** (陀羅尼) — *dharani* (a sound-formula)\n\nA shorter colloquial name **Sho Sai Shu** (消災主) also appears in some lineages — *shu* (主) = "master / lord", giving "Master of Eliminating Disasters". The chant is traditionally associated with protection and the dispelling of obstacles.',
    },
    {
      id: 'sanskrit-etymology',
      shape: 'prose-commentary',
      heading: 'Sanskrit traces',
      body: 'Each Sino-Japanese cluster preserves the *sound* of a Sanskrit syllable. Some of the recoverable Sanskrit elements:\n\n— **NA MU SA MAN DA** ← *namaḥ samanta* — "homage to the universal / all-encompassing". *Namaḥ* = homage / devotion (same root as Namu in line 2 of the Enmē Jikku Kannon Gyō). *Samanta* = universal, all-encompassing.\n— **MO TO NAN** ← *buddhānāṃ* — "of the buddhas" (genitive plural). Together with the opening, *namaḥ samanta-buddhānāṃ* = "homage to all the buddhas".\n— **UN** / **UN NUN** ← *hūṃ* — the powerful [[bīja]] (seed) syllable associated with transformation, breaking through obstruction.\n— **GYA GYA / GYA KI** ← *kha kha* / *khāhi khāhi* — ritual sound-syllables (no semantic meaning, function as protection-mantras).\n— **SHI FU RA** ← *jvala* — "blaze, flame" (the fire of wisdom imagery). Repeated as *jvala jvala prajvala prajvala* — "blaze, blaze; blaze-forth, blaze-forth".\n— **CHI SHU SA** ← *tiṣṭha tiṣṭha* — "stand, stand" (be established).\n— **SO HA JA** ← *sphaṭ sphaṭ* — ritual sound (or possibly *svāhā*, the offering completion).\n— **SE CHI GYA / SHI RI** ← *śāntika śrīye* — "for peace, for prosperity" (the *purpose* of the dharani).\n— **SO MO KO** ← *svāhā* — standard dharani-closing formula meaning "so be it" / "thus completed".\n\nBut: this isn\'t how the chant is *used*. The Sanskrit is offered here as scholarly context; the practice is the sounds.',
    },
  ],
};

export default shoSaiMyoKichijoDarani;

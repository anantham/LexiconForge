/**
 * Hōkyō Zanmai — *Song of the Jewel Mirror Awareness* (寶鏡三昧, Baojing Sanmei).
 *
 * Composed by Dongshan Liangjie (807-869, Jp. Tōzan Ryōkai), founder of
 * the Caodong (Sōtō) line. Four-character verse text (94 lines / 376
 * characters) handing down the *Five Ranks* (五位, go-i) teaching of
 * relative-absolute integration that anchors Sōtō Zen dialectic.
 *
 * Bodhi Sangha booklet (pp.8-10) gives Thomas Cleary\'s translation
 * from *Timeless Spring: A Soto Zen Anthology* (1980). This file pairs
 * Chinese stanzas with the matching Cleary English so source and
 * rendering are visible together. Sino-Japanese on-yomi reading is the
 * form used in Japanese Zen chanting.
 *
 * Source: Chinese text from worldofmastermind.com transcription of the
 * canonical Hōkyō Zanmai, cross-checked against the standard Sōtō
 * recension.
 */

import type { LiturgyDoc } from '../../types/liturgy';
import { wikipediaCitation } from './_groundingHelpers';

export const hokyoZanmai: LiturgyDoc = {
  slug: 'hokyo-zanmai',
  sangha: 'bodhi-sangha',
  order: 6,
  title: 'Song of the Jewel Mirror Awareness',
  subtitle: 'Hōkyō Zanmai (寶鏡三昧) — Dongshan Liangjie / Tōzan Ryōkai',
  tradition: 'zen',
  context: 'One of the Sōtō Zen tradition\'s foundational verse texts, attributed to Dongshan Liangjie (Jp. Tōzan Ryōkai, 807-869), founder of the Caodong / Sōtō line. The Bodhi Sangha booklet uses Thomas Cleary\'s translation. The text contains the *Five Ranks* teaching at its heart — relative and absolute as integrated, not opposed.',
  sources: {
    canonical: [
      { label: 'Hōkyō Zanmai / Baojing Sanmei (寶鏡三昧)', url: 'https://en.wikipedia.org/wiki/Song_of_the_Precious_Mirror_Samadhi' },
      { label: 'Dongshan Liangjie (Tōzan Ryōkai, 807-869)', url: 'https://en.wikipedia.org/wiki/Dongshan_Liangjie' },
      { label: 'Chinese text — 寶鏡三昧 正解', url: 'https://www.worldofmastermind.com/?p=4739' },
    ],
    ritual: [
      { label: 'Bodhi Sangha Sutras booklet (May 2016), pp.8-10' },
      { label: 'Thomas Cleary, *Timeless Spring: A Soto Zen Anthology* (1980)' },
    ],
  },
  curator:
    'Curation by Aditya. Chinese text follows the canonical Sōtō recension. Sino-Japanese on-yomi reading is the form used in Japanese Zen chanting. English from the Bodhi booklet (Thomas Cleary). Segments group ~2 couplets of Chinese against the matching English block — alignment is by sense rather than per-word, since Cleary\'s verse and the Chinese four-character lines do not map one-to-one.',
  sections: [
    {
      id: 'framing',
      shape: 'prose-commentary',
      body: 'Dongshan\'s *Song of the Jewel Mirror Awareness* hands down the *Five Ranks* (五位, go-i) — the dialectic of how the relative and absolute, the apparent and real, mutually penetrate. The opening image: filling a silver bowl with snow, hiding a heron in the moonlight. Each is itself + a slight asymmetry within itself. The relative is not separate from the absolute; their integration is the Way.\n\nIn the Sōtō tradition, the Hōkyō Zanmai is chanted alongside the *Sandōkai* (參同契) and *Five Ranks* commentaries as the trio of foundational Caodong verse texts. The Bodhi booklet includes only the Hōkyō Zanmai.',
    },
    {
      id: 'teaching-of-thusness',
      shape: 'triple-script-witness',
      large: true,
      segments: [
        {
          id: 'nyoze-no-hō',
          pali: 'Nyoze no hō, busso mippu',
          scripts: [
            { lang: 'zh-Hant', label: 'Chinese', text: '如是之法 佛祖密付', tokens: ['如是', '之法', '佛祖', '密付'], transliteration: 'Nyoze no hō, busso mippu (rú shì zhī fǎ, fó zǔ mì fù)' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'The teaching of thusness has been intimately communicated by buddhas and patriarchs;',
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'nyoze', scriptAlts: { 'zh-Hant': '如是' }, gloss: '"Thus" — same *evaṃ* / *tathā* that opens every sutra. *如* "thus, like" + *是* "this, is". *Tathatā* in a different grammatical mood.', accent: 'rose' },
            { form: 'busso', scriptAlts: { 'zh-Hant': '佛祖' }, gloss: 'Buddhas and ancestors. *佛* "Buddha" + *祖* "ancestor, patriarch". The lineage of transmission.', accent: 'amber' },
            { form: 'mippu', scriptAlts: { 'zh-Hant': '密付' }, gloss: 'Intimate transmission. *密* "secret, intimate" + *付* "entrust". The Sōtō technical term for mind-to-mind transmission outside the scriptures.', accent: 'sky' },
          ],
        },
        {
          id: 'ginwan-jōsetsu',
          pali: 'Ginwan jōsetsu, meigetsu zōro',
          scripts: [
            { lang: 'zh-Hant', label: 'Chinese', text: '銀碗盛雪 明月藏鷺', tokens: ['銀碗', '盛雪', '明月', '藏鷺'], transliteration: 'Ginwan jōsetsu, meigetsu zōro' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'Filling a silver bowl with snow, Hiding a heron in the moonlight —',
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'ginwan jōsetsu', scriptAlts: { 'zh-Hant': '銀碗盛雪' }, gloss: 'A silver bowl filled with snow. White-on-white. The first of two parallel images of the relative-and-absolute as same-yet-different.', accent: 'rose' },
            { form: 'meigetsu zōro', scriptAlts: { 'zh-Hant': '明月藏鷺' }, gloss: 'A heron hidden in the moonlight. White on white again. Both images carry the same dialectical move: same color, distinct beings.', accent: 'amber' },
          ],
          note: 'These two images — silver bowl + snow, moon + heron — are the most-cited four lines from the Hōkyō Zanmai. Each names a relative entity (snow, heron) inside an absolute background (bowl, moonlight), where the two are the same in color but distinguishable in being. The Five Ranks teaching in two images.',
        },
        {
          id: 'rui-shi-fusei',
          pali: 'Rui shi fusei, kon soku chisho',
          scripts: [
            { lang: 'zh-Hant', label: 'Chinese', text: '類之弗齊 混則知處', tokens: ['類之', '弗齊', '混則', '知處'], transliteration: 'Rui shi fusei, kon soku chisho' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'When you array them, they\'re not the same When you mix them, you know where they are.',
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'fusei', scriptAlts: { 'zh-Hant': '弗齊' }, gloss: 'Not the same, uneven. *弗* "not" + *齊* "uniform, level".', accent: 'rose' },
            { form: 'kon', scriptAlts: { 'zh-Hant': '混' }, gloss: 'To mix, blend. *混* "mix, confuse". When mixed (relative and absolute integrated), each is recognized in its place.', accent: 'amber' },
          ],
        },
      ],
    },
    {
      id: 'jewel-mirror',
      shape: 'triple-script-witness',
      segments: [
        {
          id: 'i-fuzai-gen',
          pali: 'I fu zai gen, rai ki yaku fu',
          scripts: [
            { lang: 'zh-Hant', label: 'Chinese', text: '意不在言 來機亦赴', tokens: ['意不', '在言', '來機', '亦赴'], transliteration: 'I fu zai gen, rai ki yaku fu' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'The meaning is not in the words Yet it responds to the inquiring impulse.',
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'i', scriptAlts: { 'zh-Hant': '意' }, gloss: 'Meaning, intention, mind. *意* — same character as in *yī* (intention) of Sino-Japanese Buddhist terms.', accent: 'rose' },
            { form: 'rai-ki', scriptAlts: { 'zh-Hant': '來機' }, gloss: '"Arriving impulse" — the inquiring movement. *來* "come" + *機* "trigger, occasion". The chant responds to whatever genuinely asks.', accent: 'amber' },
          ],
        },
        {
          id: 'nyo-rin-hōkyō',
          pali: 'Nyo rin hōkyō, gyōyō sō to',
          scripts: [
            { lang: 'zh-Hant', label: 'Chinese', text: '如臨寶鏡 形影相睹', tokens: ['如臨', '寶鏡', '形影', '相睹'], transliteration: 'Nyo rin hōkyō, gyōyō sō to' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'It is like facing a jewel mirror; Form and image behold each other —',
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'hōkyō', scriptAlts: { 'zh-Hant': '寶鏡' }, gloss: 'Jewel mirror — the chant\'s title compound. *寶* "treasure" + *鏡* "mirror". The mirror is *zanmai* (三昧, samādhi).', accent: 'rose' },
            { form: 'gyōyō', scriptAlts: { 'zh-Hant': '形影' }, gloss: 'Form and image, body and shadow. *形* "form" + *影* "shadow, reflection". The dialectical pair the chant turns on.', accent: 'amber' },
          ],
        },
        {
          id: 'nyo-fuze-kyo',
          pali: 'Nyo fu ze kyo, kyo shō ze nyo',
          scripts: [
            { lang: 'zh-Hant', label: 'Chinese', text: '汝不是渠 渠正是汝', tokens: ['汝不', '是渠', '渠正', '是汝'], transliteration: 'Nyo fu ze kyo, kyo shō ze nyo' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'You are not it It actually is you.',
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'nyo', scriptAlts: { 'zh-Hant': '汝' }, gloss: '"You". The familiar second-person pronoun of classical Chinese.', accent: 'rose' },
            { form: 'kyo', scriptAlts: { 'zh-Hant': '渠' }, gloss: '"It / he". A third-person pronoun. The asymmetry of the line is exactly the Sōtō point: *you ≠ it, but it = you*.', accent: 'amber' },
          ],
          note: '*Nyo fu ze kyo, kyo shō ze nyo* — *you are not it, it is precisely you*. One of the most quoted couplets in the Hōkyō Zanmai. The asymmetry between the two halves *is* the teaching: the relative does not exhaust the absolute, but the absolute is exhaustively expressed *as* the relative.',
        },
      ],
    },
    {
      id: 'integration',
      shape: 'triple-script-witness',
      segments: [
        {
          id: 'tenshin-myo',
          pali: 'Tenshin ji myō, fu zoku mei go',
          scripts: [
            { lang: 'zh-Hant', label: 'Chinese', text: '天真而妙 不屬迷悟', tokens: ['天真', '而妙', '不屬', '迷悟'], transliteration: 'Tenshin ji myō, fu zoku mei go' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'Naturally real yet inconceivable, It is not within the province of delusion or enlightenment',
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'tenshin', scriptAlts: { 'zh-Hant': '天真' }, gloss: '"Heavenly-true" — naturally real, innately so. *天* "heaven" + *真* "true". The unspoiled original.', accent: 'rose' },
            { form: 'mei go', scriptAlts: { 'zh-Hant': '迷悟' }, gloss: 'Delusion and enlightenment. *迷* + *悟*. Same pair as in [[shin-jin-no-mei]] — Dongshan says this absolute is *outside* both categories.', accent: 'amber' },
          ],
        },
        {
          id: 'gō-kotsu-shisa',
          pali: 'Gō-kotsu shisa, fu ō rishou',
          scripts: [
            { lang: 'zh-Hant', label: 'Chinese', text: '毫忽之差 不應律呂', tokens: ['毫忽', '之差', '不應', '律呂'], transliteration: 'Gō-kotsu shisa, fu ō rishou' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'A hairbreadth\'s deviation Will fail to accord with the proper attunement.',
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'gō-kotsu', scriptAlts: { 'zh-Hant': '毫忽' }, gloss: 'A hair\'s breadth, an infinitesimal. Same *gō* (毫) as in [[shin-jin-no-mei]] *gōri* (毫釐) — the smallest unit. Same teaching: even a tiny deviation breaks the Way.', accent: 'rose' },
            { form: 'rishou', scriptAlts: { 'zh-Hant': '律呂' }, gloss: 'Musical pitch standards. *律* and *呂* are the two classical Chinese pitch-pipe sets — *yang* and *yin*. The image is musical attunement.', accent: 'sky' },
          ],
        },
      ],
    },
    {
      id: 'colt-and-rat',
      shape: 'triple-script-witness',
      segments: [
        {
          id: 'gai-jaku-chū-yō',
          pali: 'Gai-jaku chū-yō, kei-ku fukuso',
          scripts: [
            { lang: 'zh-Hant', label: 'Chinese', text: '外寂中搖 係駒伏鼠', tokens: ['外寂', '中搖', '係駒', '伏鼠'], transliteration: 'Gai-jaku chū-yō, kei-ku fuku-so' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'Outwardly still while inwardly moving, Like a tethered colt, a trapped rat —',
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'gai-jaku chū-yō', scriptAlts: { 'zh-Hant': '外寂中搖' }, gloss: 'Outside still, inside moving. *外* "outside" + *寂* "still" + *中* "middle" + *搖* "shake". A description of mistaken zazen — looking calm but inwardly agitated.', accent: 'rose' },
            { form: 'kei-ku fukuso', scriptAlts: { 'zh-Hant': '係駒伏鼠' }, gloss: 'A tethered colt and a hiding rat. *係* "tied" + *駒* "colt" + *伏* "hide" + *鼠* "rat". The two animal images — bound horse, hidden mouse — for restless inner movement masked by outward stillness.', accent: 'amber' },
          ],
        },
        {
          id: 'butsudō-suijō',
          pali: 'Butsudō suijō, jukkō kanju',
          scripts: [
            { lang: 'zh-Hant', label: 'Chinese', text: '佛道垂成 十劫觀樹', tokens: ['佛道', '垂成', '十劫', '觀樹'], transliteration: 'Butsudō suijō, jukkō kanju' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'When about to fulfill the way of buddhahood, One gazed at a tree for ten aeons,',
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'butsudō', scriptAlts: { 'zh-Hant': '佛道' }, gloss: 'The Buddha way. Same *佛道* as in [[bodhi-sangha/four-great-vows]] vow 4.', accent: 'rose' },
            { form: 'jukkō', scriptAlts: { 'zh-Hant': '十劫' }, gloss: 'Ten *kalpas*. *十* "ten" + *劫* "kalpa". Vast cosmic time. Refers to the *Mahāvairocana* tradition: Mahāvairocana spent ten kalpas gazing at the Bodhi tree before fulfilling buddhahood.', accent: 'amber' },
          ],
        },
      ],
    },
    {
      id: 'wooden-man',
      shape: 'triple-script-witness',
      segments: [
        {
          id: 'boku-jin-hō-ka',
          pali: 'Bokujin hōka, sekijo kibu',
          scripts: [
            { lang: 'zh-Hant', label: 'Chinese', text: '木人方歌 石女起舞', tokens: ['木人', '方歌', '石女', '起舞'], transliteration: 'Bokujin hōka, sekijo kibu' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'When the wooden man begins to sing, The stone woman gets up to dance;',
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'bokujin', scriptAlts: { 'zh-Hant': '木人' }, gloss: 'Wooden man. *木* "wood" + *人* "person". A Chan koan image — what cannot speak, sings.', accent: 'rose' },
            { form: 'sekijo', scriptAlts: { 'zh-Hant': '石女' }, gloss: 'Stone woman. *石* "stone" + *女* "woman". The matching impossible image — what cannot move, dances. The chant\'s most-quoted twin metaphor for awakening as impossible-fact.', accent: 'amber' },
          ],
          note: '*Bokujin hōka, sekijo kibu* — *the wooden man sings, the stone woman dances*. The signature paradox of the Hōkyō Zanmai. What is inanimate enacts what only the animate could; what cannot do something, does it. Awakening as the impossible becoming actual through the very absence of its possibility.',
        },
        {
          id: 'sen-gyō-mitsu-yō',
          pali: 'Sengyō mitsu-yō, nyo gu jaku ro',
          scripts: [
            { lang: 'zh-Hant', label: 'Chinese', text: '潛行密用 如愚若魯', tokens: ['潛行', '密用', '如愚', '若魯'], transliteration: 'Sengyō mitsu-yō, nyo gu jaku ro' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'Practice secretly, working within, As though a fool, like an idiot —',
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'sengyō', scriptAlts: { 'zh-Hant': '潛行' }, gloss: 'Hidden practice, secret going. *潛* "hidden, submerged" + *行* "practice, walk".', accent: 'rose' },
            { form: 'nyo-gu', scriptAlts: { 'zh-Hant': '如愚' }, gloss: '"Like a fool". *如* "like" + *愚* "fool". The Daoist *zhuangzi* virtue and a recurring Chan move — the awakened one appears as no one in particular.', accent: 'amber' },
          ],
        },
        {
          id: 'tan-nō-sōzoku',
          pali: 'Tannō sōzoku, myō shu chū shu',
          scripts: [
            { lang: 'zh-Hant', label: 'Chinese', text: '但能相續 名主中主', tokens: ['但能', '相續', '名主', '中主'], transliteration: 'Tannō sōzoku, myō shu chū shu' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'If you can achieve continuity, This is called the host within the host.',
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'sōzoku', scriptAlts: { 'zh-Hant': '相續' }, gloss: 'Continuity, succession. *相* "mutual" + *續* "continue". The unbroken flow of practice.', accent: 'amber' },
            { form: 'shu chū shu', scriptAlts: { 'zh-Hant': '主中主' }, gloss: '"Host within the host". *主* "host, master" — the technical Caodong term for the inmost rank of realization (the deepest *go-i*). The chant closes by naming where the integration arrives.', accent: 'rose' },
          ],
          note: 'The closing phrase. *主中主* (shu chū shu) — *the host within the host* — is the deepest of the Caodong / Sōtō *Five Ranks*: the position in which the absolute fully knows itself, knowing no distinction. Dongshan ends the chant by naming this place — the destination of continuity.',
        },
      ],
    },
    {
      id: 'cleary-notes',
      shape: 'prose-commentary',
      heading: 'Cleary\'s translation notes',
      body: 'From the Bodhi Sangha booklet (reproducing Cleary):\n\nDongshan Liangjie (Tung-shan Liang-chieh, Jp. Tōzan Ryōkai, 807-869). Samādhi — concentration, meditation, trance, absorption — here rendered *awareness* "because of convenience, to avoid any suggestion of paranormality."\n\nThe relative and absolute, or partial and true, are also called *minister and ruler*, *son and father*, *light and darkness*. Caoshan called the relative the world of myriad forms and the absolute the realm of emptiness; the relative is also called the *phenomenal* and the absolute the *principle*.\n\nThe absolute is always being expressed in the relative — this is the true absolute, but it is not always seen. Perfect comprehension of the relative grounded on experience of the absolute culminates in simultaneous realization of knowledge and complete peace and calm. At this point, Dongshan said, "one comes back to sit among the ashes" — living this life as a wayfarer, expressing one\'s solidarity with the world in the vow to realize perfect enlightenment with all beings.\n\nThe five flavored herb and diamond thunderbolt are images of *five in one*; these so-called ranks or positions, the set of five being the ultimate paradigm of dialectic and an illustration of meditational stages, are all from the same source — hence the association of *five in one*.',
    },
  ],
};

export default hokyoZanmai;

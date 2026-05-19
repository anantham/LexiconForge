/**
 * Shin-Jin-No-Mei — *On Trust in the Heart-Mind* (Xinxin Ming, 信心銘).
 *
 * Composed by Sengcan (Jp. Sōsan, d. 606), Third Chinese Chan
 * Patriarch. 146 four-character lines in classical literary Chinese
 * — one of the foundational verse texts of Northern Buddhist
 * tradition.
 *
 * Bodhi Sangha booklet (pp.4-7) gives Richard B. Clarke\'s English with
 * modifications. This file pairs each Chinese stanza with the matching
 * Bodhi English so the reader can see source and rendering side by
 * side. Sino-Japanese on-yomi reading provided for those used to
 * Japanese Zen chanting (the same characters are read both ways).
 *
 * Source: Chinese text from siddham / shanshuge transcriptions of the
 * canonical Xinxin Ming; cross-checked against the Wikipedia ja entry.
 */

import type { LiturgyDoc } from '../../types/liturgy';
import { wikipediaCitation } from './_groundingHelpers';

export const shinJinNoMei: LiturgyDoc = {
  slug: 'shin-jin-no-mei',
  sangha: 'bodhi-sangha',
  order: 5,
  title: 'On Trust in the Heart-Mind',
  subtitle: 'Shin-Jin-No-Mei (信心銘) — Sengcan, Third Chan Patriarch',
  tradition: 'zen',
  context: 'Sengcan\'s *Xinxin Ming* (信心銘) is the foundational articulation of non-duality in the Chan / Zen tradition; nearly every later Zen text quotes it.',
  sources: {
    canonical: [
      { label: 'Xinxin Ming / Shinjin no Mei (信心銘)', url: 'https://en.wikipedia.org/wiki/Xinxin_Ming' },
      { label: 'Sengcan (Sōsan, d. 606)', url: 'https://en.wikipedia.org/wiki/Sengcan' },
      { label: 'Chinese text — 信心銘 全文', url: 'https://sites.google.com/site/shanshuge/%E7%B7%9A%E4%B8%8A%E9%96%B1%E8%AE%80/%E7%A6%AA%E5%AE%97%E6%9B%B8%E7%B1%8D/%E4%BF%A1%E5%BF%83%E9%8A%98%E5%85%A8%E6%96%87' },
    ],
    ritual: [
      { label: 'Bodhi Sangha Sutras booklet (May 2016), pp.4-7' },
    ],
  },
  curator:
    'Curation by Aditya. Chinese text follows the canonical 146-line transmission. Sino-Japanese on-yomi reading is the form used in Japanese Zen chanting practice. Pinyin (Mandarin) reading given for reference — different Chinese diaspora communities chant in different vernacular readings; both transmissions descend from this single character text. English from the Bodhi booklet (Richard B. Clarke base + modifications). Segments group ~2-4 couplets of Chinese against the matching English block — alignment is by sense rather than per-word.',
  sections: [
    {
      id: 'framing',
      shape: 'prose-commentary',
      body: 'Sengcan (Jp. Sōsan) was the Third Chinese Chan Patriarch — the lineage from Bodhidharma → Huike → Sengcan → Daoxin → Hongren → Huineng that grounds the Chan / Zen self-understanding. Almost nothing biographical survives; what survives is this short verse text, *Xinxin Ming* (信心銘) — *Inscription on Trust in the Heart-Mind*.\n\nThe text\'s logic is consistently negative-dialectical: every assertion calls forth its complement, and the practice instruction is to neither cling to the assertion nor cling to its complement. *The Great Way is not difficult / for those who have no preferences.* The non-preferring mind is not indifference — it is the mind that does not seize any of its contents as ultimate.\n\nBodhi Sangha\'s booklet introduces the text: "Traditionally said to be composed by the Third Patriarch, Seng-ts\'an, Jap. Sōsan; d. 606. The basic translation is by Richard B. Clarke. Modifications have been made in the translation and in the text to convey the meaning better."',
    },
    {
      id: 'opening',
      shape: 'triple-script-witness',
      large: true,
      segments: [
        {
          id: 'shidō-munan',
          pali: 'Shidō munan, yui ken kenjaku',
          scripts: [
            { lang: 'zh-Hant', label: 'Chinese', text: '至道無難 唯嫌揀擇', tokens: ['至道', '無難', '唯嫌', '揀擇'], transliteration: 'Shidō munan, yui ken kenjaku (zhì dào wú nán, wéi xián jiǎn zé)' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'The Great Way is not difficult for those who have no preferences.',
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'Shidō', scriptAlts: { 'zh-Hant': '至道' }, gloss: 'Supreme Way / Great Way. *至* "ultimate, perfect" + *道* "way, path, Tao". Same *道* (dào) as in Taoism; this line is Sengcan stating that the highest Way is not Daoist in flavor but Buddhist in destination.', accent: 'rose' },
            { form: 'munan', scriptAlts: { 'zh-Hant': '無難' }, gloss: 'Not difficult, without difficulty. *無* "no" + *難* "hard".' },
            { form: 'kenjaku', scriptAlts: { 'zh-Hant': '揀擇' }, gloss: 'Picking and choosing, preferring. *揀* "select" + *擇* "choose". The single word the whole text turns on.', accent: 'sky' },
          ],
        },
        {
          id: 'tan-mo',
          pali: 'Tan mo zōai, dōnen myōhaku',
          scripts: [
            { lang: 'zh-Hant', label: 'Chinese', text: '但莫憎愛 洞然明白', tokens: ['但莫', '憎愛', '洞然', '明白'], transliteration: 'Tan mo zōai, dōnen myōhaku' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'When craving and hatred are both absent everything becomes clear and undisguised.',
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'zōai', scriptAlts: { 'zh-Hant': '憎愛' }, gloss: 'Hate and love. *憎* "hate" + *愛* "love". The polar pair of *kenjaku*: when craving and hatred fall away, the choosing impulse falls with them.', accent: 'rose' },
            { form: 'myōhaku', scriptAlts: { 'zh-Hant': '明白' }, gloss: 'Clear and bright, manifest. Same characters used in modern Mandarin for "understand, be clear".', accent: 'sky' },
          ],
        },
        {
          id: 'gouri-yusa',
          pali: 'Gōri uri sa, tenchi kenkaku',
          scripts: [
            { lang: 'zh-Hant', label: 'Chinese', text: '毫釐有差 天地懸隔', tokens: ['毫釐', '有差', '天地', '懸隔'], transliteration: 'Gōri uri sa, tenchi kenkaku' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'Cling to an attachment even the smallest, and heaven and earth are set infinitely apart.',
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'gōri', scriptAlts: { 'zh-Hant': '毫釐' }, gloss: 'A hair\'s breadth. *毫* "fine hair" + *釐* "tiny measure". The smallest unit — an attachment of even this size suffices.', accent: 'sky' },
            { form: 'tenchi', scriptAlts: { 'zh-Hant': '天地' }, gloss: 'Heaven and earth. *天* "heaven" + *地* "earth". The classical Chinese cosmic pair.', accent: 'rose' },
            { form: 'kenkaku', scriptAlts: { 'zh-Hant': '懸隔' }, gloss: 'Set infinitely apart. *懸* "suspend" + *隔* "separate".' },
          ],
        },
        {
          id: 'yoku-toku',
          pali: 'Yoku toku genzen, makuzon junnyaku',
          scripts: [
            { lang: 'zh-Hant', label: 'Chinese', text: '欲得現前 莫存順逆', tokens: ['欲得', '現前', '莫存', '順逆'], transliteration: 'Yoku toku genzen, makuzon junnyaku' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'If you wish to see the truth then cling to no opinion for or against.',
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'genzen', scriptAlts: { 'zh-Hant': '現前' }, gloss: 'Manifest, appearing before one. The truth appearing here-and-now.', accent: 'amber' },
            { form: 'junnyaku', scriptAlts: { 'zh-Hant': '順逆' }, gloss: 'Going-with and going-against. *順* "follow, agree" + *逆* "oppose". The pro/con polarity.', accent: 'rose' },
          ],
        },
        {
          id: 'ijun-sōsō',
          pali: 'Ijun sōsō, ze i shinbyō',
          scripts: [
            { lang: 'zh-Hant', label: 'Chinese', text: '違順相爭 是為心病', tokens: ['違順', '相爭', '是為', '心病'], transliteration: 'Ijun sōsō, ze i shinbyō' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'The struggle of what one likes and what one dislikes is the disease of the mind.',
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'shinbyō', scriptAlts: { 'zh-Hant': '心病' }, gloss: 'Mind-sickness, disease of mind. *心* "mind, heart" + *病* "illness". The technical name for the preference-impulse.', accent: 'rose' },
          ],
        },
      ],
    },
    {
      id: 'vast-space',
      shape: 'triple-script-witness',
      segments: [
        {
          id: 'en-dō-taikyō',
          pali: 'En dō taikyō, muken muyo',
          scripts: [
            { lang: 'zh-Hant', label: 'Chinese', text: '圓同太虛 無欠無餘', tokens: ['圓同', '太虛', '無欠', '無餘'], transliteration: 'En dō taikyō, muken muyo' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'The Way is perfect like vast space where nothing is lacking and nothing is in excess.',
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'en', scriptAlts: { 'zh-Hant': '圓' }, gloss: 'Round, perfect, complete. The technical term for *paripūrṇa* (perfectly full).', accent: 'amber' },
            { form: 'taikyō', scriptAlts: { 'zh-Hant': '太虛' }, gloss: 'Great void / vast space. *太* "great" + *虛* "empty, void". The Daoist cosmological term that Sengcan borrows for śūnyatā.', accent: 'rose' },
            { form: 'muken muyo', scriptAlts: { 'zh-Hant': '無欠無餘' }, gloss: 'Not lacking, not in excess. The signature phrase of *en* — perfect fullness has no deficit and no overflow.', accent: 'sky' },
          ],
        },
        {
          id: 'ryōyū-shusha',
          pali: 'Ryōyū shusha, shoi furyo',
          scripts: [
            { lang: 'zh-Hant', label: 'Chinese', text: '良由取捨 所以不如', tokens: ['良由', '取捨', '所以', '不如'], transliteration: 'Ryōyū shusha, shoi furyo' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'Indeed, it is due to our choosing to accept or reject that we do not see the true nature of things.',
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'shusha', scriptAlts: { 'zh-Hant': '取捨' }, gloss: 'Grasping and rejecting. *取* "grasp, take" + *捨* "discard". The same pair *kenjaku* names from a different angle — the action form of preferring.', accent: 'rose' },
          ],
        },
        {
          id: 'maku-chiku-uen',
          pali: 'Maku chiku uen, motsujū kūnin',
          scripts: [
            { lang: 'zh-Hant', label: 'Chinese', text: '莫逐有緣 勿住空忍', tokens: ['莫逐', '有緣', '勿住', '空忍'], transliteration: 'Maku chiku uen, motsujū kūnin' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'Live neither in the entanglements of outer things nor in inner feeling of emptiness.',
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'uen', scriptAlts: { 'zh-Hant': '有緣' }, gloss: 'Conditioned existence, having karmic relation. The "outer things" of the English.', accent: 'amber' },
            { form: 'kūnin', scriptAlts: { 'zh-Hant': '空忍' }, gloss: 'Emptiness-acceptance. The dead-end form of *śūnyatā* where one rests in emptiness as a thing.', accent: 'rose' },
          ],
        },
      ],
    },
    {
      id: 'single-way',
      shape: 'triple-script-witness',
      segments: [
        {
          id: 'isshu-futsū',
          pali: 'Isshu futsū, ryōsho shikkō',
          scripts: [
            { lang: 'zh-Hant', label: 'Chinese', text: '一種不通 兩處失功', tokens: ['一種', '不通', '兩處', '失功'], transliteration: 'Isshu futsū, ryōsho shikkō' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'Those who do not live in the single Way fail in both activity and passivity, assertion and denial.',
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'isshu', scriptAlts: { 'zh-Hant': '一種' }, gloss: 'The "one kind" — the single Way. *一* "one" + *種* "kind, type".', accent: 'rose' },
            { form: 'ryōsho', scriptAlts: { 'zh-Hant': '兩處' }, gloss: 'The two places / two extremes. Failing in both poles of every duality.', accent: 'sky' },
          ],
        },
        {
          id: 'tagon-tagyo',
          pali: 'Tagon tagyo, ten fu sōō',
          scripts: [
            { lang: 'zh-Hant', label: 'Chinese', text: '多言多慮 轉不相應', tokens: ['多言', '多慮', '轉不', '相應'], transliteration: 'Tagon tagyo, ten fu sōō' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'The more you talk and think about it, the further astray you wander from the truth.',
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'tagon tagyo', scriptAlts: { 'zh-Hant': '多言多慮' }, gloss: 'Much speech, much thinking. *多* "many" + *言* "speech" + *慮* "consideration".', accent: 'rose' },
          ],
        },
        {
          id: 'kikon-tokushi',
          pali: 'Kikon tokushi, zuishō shisshū',
          scripts: [
            { lang: 'zh-Hant', label: 'Chinese', text: '歸根得旨 隨照失宗', tokens: ['歸根', '得旨', '隨照', '失宗'], transliteration: 'Kikon tokushi, zuishō shisshū' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'To return to the root to find the meaning, but to pursue appearances is to miss the source.',
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'kikon', scriptAlts: { 'zh-Hant': '歸根' }, gloss: 'Return to the root. *歸* "return" + *根* "root, base".', accent: 'rose' },
            { form: 'shisshū', scriptAlts: { 'zh-Hant': '失宗' }, gloss: 'Miss the source, lose the lineage. *失* "lose" + *宗* "source, ancestor".', accent: 'sky' },
          ],
        },
      ],
    },
    {
      id: 'duality-dissolves',
      shape: 'triple-script-witness',
      segments: [
        {
          id: 'isshin-fushō',
          pali: 'Isshin fushō, manbō muku',
          scripts: [
            { lang: 'zh-Hant', label: 'Chinese', text: '一心不生 萬法無咎', tokens: ['一心', '不生', '萬法', '無咎'], transliteration: 'Isshin fushō, manbō muku' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'Although all dualities come from the mind, do not be attached even to this Oneness.',
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'isshin', scriptAlts: { 'zh-Hant': '一心' }, gloss: 'One mind, single mind. The Mahāyāna *eka-citta* — also the title of major Yogācāra and Huayan teachings.', accent: 'rose' },
            { form: 'manbō', scriptAlts: { 'zh-Hant': '萬法' }, gloss: 'The ten thousand dharmas — *sarva-dharma*. Same *法* (Dharma) as in the Refuges.', accent: 'amber' },
            { form: 'muku', scriptAlts: { 'zh-Hant': '無咎' }, gloss: 'Without fault, blameless.' },
          ],
        },
        {
          id: 'nō-zui-kyō-metsu',
          pali: 'Nō zui kyō metsu, kyō chiku nō chin',
          scripts: [
            { lang: 'zh-Hant', label: 'Chinese', text: '能隨境滅 境逐能沉', tokens: ['能隨', '境滅', '境逐', '能沉'], transliteration: 'Nō zui kyō metsu, kyō chiku nō chin' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'When thought-objects vanish, the thinking subject vanishes; as when the mind vanishes, objects vanish.',
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'nō', scriptAlts: { 'zh-Hant': '能' }, gloss: 'Subject, agent — *grāhaka* in Sanskrit. The "able-knower".', accent: 'sky' },
            { form: 'kyō', scriptAlts: { 'zh-Hant': '境' }, gloss: 'Object, field of experience — *viṣaya*. The classical Yogācāra subject/object pair.', accent: 'rose' },
          ],
        },
      ],
    },
    {
      id: 'unified-mind',
      shape: 'triple-script-witness',
      segments: [
        {
          id: 'daido-taikan',
          pali: 'Daidō taikan, muyi munan',
          scripts: [
            { lang: 'zh-Hant', label: 'Chinese', text: '大道體寬 無易無難', tokens: ['大道', '體寬', '無易', '無難'], transliteration: 'Daidō taikan, muyi munan' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'To live in the Great Way is neither easy nor difficult,',
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'daidō', scriptAlts: { 'zh-Hant': '大道' }, gloss: 'Great Way. *大* "great" + *道* "way, path". Same *daidō* mentioned across Chan / Zen literature.', accent: 'rose' },
          ],
        },
        {
          id: 'ninjō-gōdō',
          pali: 'Ninjō gōdō, shōyō zetsunō',
          scripts: [
            { lang: 'zh-Hant', label: 'Chinese', text: '任性合道 逍遙絕惱', tokens: ['任性', '合道', '逍遙', '絕惱'], transliteration: 'Ninjō gōdō, shōyō zetsunō' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'Just let things be in their own way and there will be neither coming nor going. Obey the nature of things, and you will walk freely and undisturbed.',
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'ninjō', scriptAlts: { 'zh-Hant': '任性' }, gloss: 'Follow nature, let-be. *任* "entrust, let" + *性* "nature".', accent: 'rose' },
            { form: 'shōyō', scriptAlts: { 'zh-Hant': '逍遙' }, gloss: 'Free wandering. The same *xiāoyáo* of Zhuangzi\'s "Free and Easy Wandering" chapter — Sengcan borrows Daoist vocabulary.', accent: 'sky' },
          ],
        },
      ],
    },
    {
      id: 'one-dharma',
      shape: 'triple-script-witness',
      segments: [
        {
          id: 'hō-mu-i-hō',
          pali: 'Hō mu i hō, mōji aijaku',
          scripts: [
            { lang: 'zh-Hant', label: 'Chinese', text: '法無異法 妄自愛著', tokens: ['法無', '異法', '妄自', '愛著'], transliteration: 'Hō mu i hō, mōji aijaku' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'There is one Dharma, not many; attachments arise from the clinging needs of the ignorant.',
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'hō', scriptAlts: { 'zh-Hant': '法' }, gloss: 'Dharma. Same *法* across all Chinese Buddhist texts.', accent: 'rose' },
            { form: 'aijaku', scriptAlts: { 'zh-Hant': '愛著' }, gloss: 'Clinging-attachment. *愛* "love, crave" + *著* "stick, attach". *Tṛṣṇā-upādāna*.', accent: 'amber' },
          ],
        },
      ],
    },
    {
      id: 'rest-and-unrest',
      shape: 'triple-script-witness',
      segments: [
        {
          id: 'mei-shō-jakuran',
          pali: 'Mei shō jakuran, go mu kō o',
          scripts: [
            { lang: 'zh-Hant', label: 'Chinese', text: '迷生寂亂 悟無好惡', tokens: ['迷生', '寂亂', '悟無', '好惡'], transliteration: 'Mei shō jakuran, go mu kō o' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'Rest and unrest derive from illusion; with enlightenment there is no attachment to liking and disliking.',
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'mei', scriptAlts: { 'zh-Hant': '迷' }, gloss: 'Delusion, confusion. The standard Mahāyāna antonym of *satori* (悟).', accent: 'rose' },
            { form: 'go', scriptAlts: { 'zh-Hant': '悟' }, gloss: '*Satori* — awakening, realization. The character that names the whole tradition.', accent: 'amber' },
            { form: 'kō o', scriptAlts: { 'zh-Hant': '好惡' }, gloss: 'Liking and disliking. The same preference pair *kenjaku* names — now from a different angle.', accent: 'sky' },
          ],
        },
        {
          id: 'mugen-kūge',
          pali: 'Mugen kūge, ka rō haka',
          scripts: [
            { lang: 'zh-Hant', label: 'Chinese', text: '夢幻空華 何勞把捉', tokens: ['夢幻', '空華', '何勞', '把捉'], transliteration: 'Mugen kūge, ka rō haka' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'They are like dreams or flowers in the air: the foolish try to grasp them.',
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'mugen', scriptAlts: { 'zh-Hant': '夢幻' }, gloss: 'Dreams and illusions. The same *māyā* (illusion) named in the Diamond Sutra ending verse.', accent: 'rose' },
            { form: 'kūge', scriptAlts: { 'zh-Hant': '空華' }, gloss: 'Flowers in the sky / flowers in the air. *空* "sky / empty" + *華* "flower". A standard Yogācāra image for false perception.', accent: 'sky' },
          ],
        },
        {
          id: 'manbō-ichinyo',
          pali: 'Shin nyaku fui, manbō ichinyo',
          scripts: [
            { lang: 'zh-Hant', label: 'Chinese', text: '心若不異 萬法一如', tokens: ['心若', '不異', '萬法', '一如'], transliteration: 'Shin nyaku fui, manbō ichinyo' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'If the mind makes no discriminations, the ten thousand things are as they are, of single Essence.',
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'ichinyo', scriptAlts: { 'zh-Hant': '一如' }, gloss: 'One-suchness. *一* "one" + *如* "thus, suchness". *Tathatā* — the Yogācāra term for things as they are.', accent: 'rose' },
          ],
        },
      ],
    },
    {
      id: 'trusting-mind',
      shape: 'triple-script-witness',
      segments: [
        {
          id: 'shinmyō-jishō',
          pali: 'Komyō jishō, furō shinriki',
          scripts: [
            { lang: 'zh-Hant', label: 'Chinese', text: '虛明自照 不勞心力', tokens: ['虛明', '自照', '不勞', '心力'], transliteration: 'Komyō jishō, furō shinriki' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'All is empty, clear, self-illuminating, with no exertion of the mind\'s power.',
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'komyō', scriptAlts: { 'zh-Hant': '虛明' }, gloss: 'Empty-bright. *虛* "empty, void" + *明* "bright, clear". One of the most-cited Chan / Zen self-descriptions of awakened mind.', accent: 'rose' },
            { form: 'jishō', scriptAlts: { 'zh-Hant': '自照' }, gloss: 'Self-illuminating. *自* "self" + *照* "shine, illumine".', accent: 'amber' },
          ],
        },
        {
          id: 'shinnyo-hōkai',
          pali: 'Shinnyo hōkai, muta muji',
          scripts: [
            { lang: 'zh-Hant', label: 'Chinese', text: '真如法界 無他無自', tokens: ['真如', '法界', '無他', '無自'], transliteration: 'Shinnyo hōkai, muta muji' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'In this world of Suchness there is neither self nor other than self.',
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'shinnyo', scriptAlts: { 'zh-Hant': '真如' }, gloss: '*Tathatā* — Suchness, things-as-they-are. *真* "true" + *如* "thus".', accent: 'rose' },
            { form: 'hōkai', scriptAlts: { 'zh-Hant': '法界' }, gloss: '*Dharmadhātu* — Dharma-realm, the Mahāyāna term for the totality of reality. *法* "Dharma" + *界* "realm".', accent: 'amber' },
          ],
        },
        {
          id: 'fuji-kaidō',
          pali: 'Fuji kaidō, mufu hōyō',
          scripts: [
            { lang: 'zh-Hant', label: 'Chinese', text: '不二皆同 無不包容', tokens: ['不二', '皆同', '無不', '包容'], transliteration: 'Fuji kaidō, mufu hōyō' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'In this \'not-two\' nothing is separate, nothing is excluded.',
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'fuji', scriptAlts: { 'zh-Hant': '不二' }, gloss: 'Not-two. *不* "not" + *二* "two". *Advaita* — the cardinal non-dual term. The phrase the chant returns to at its close.', accent: 'rose' },
          ],
        },
      ],
    },
    {
      id: 'no-yesterday',
      shape: 'triple-script-witness',
      segments: [
        {
          id: 'shinjin-fuji',
          pali: 'Shinjin fuji, fuji shinjin',
          scripts: [
            { lang: 'zh-Hant', label: 'Chinese', text: '信心不二 不二信心', tokens: ['信心', '不二', '不二', '信心'], transliteration: 'Shinjin fuji, fuji shinjin' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'To live in this faith is the road to non-duality because the non-dual is one with the trusting Mind.',
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'shinjin', scriptAlts: { 'zh-Hant': '信心' }, gloss: 'Trust-mind, faith-mind. *信* "trust" + *心* "heart, mind". The two characters that give the chant its title.', accent: 'rose' },
            { form: 'fuji', scriptAlts: { 'zh-Hant': '不二' }, gloss: 'Not-two. The chiastic phrasing — *shinjin fuji, fuji shinjin* — performs the non-duality it names.', accent: 'amber' },
          ],
          note: 'The chiasmus *shinjin fuji / fuji shinjin* is the chant\'s closing signature: trust-mind is non-dual, non-dual is trust-mind. The two phrases mirror each other across the line break; the mirror is the teaching.',
        },
        {
          id: 'gengo-dōdan',
          pali: 'Gengo dōdan, hi ko rai kon',
          scripts: [
            { lang: 'zh-Hant', label: 'Chinese', text: '言語道斷 非去來今', tokens: ['言語', '道斷', '非去', '來今'], transliteration: 'Gengo dōdan, hi ko rai kon' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'Words! The Way is beyond dualistic language, for in it there is no yesterday, no tomorrow, no today.',
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'gengo-dōdan', scriptAlts: { 'zh-Hant': '言語道斷' }, gloss: 'The way of words is cut off. *言語* "speech" + *道* "way" + *斷* "cut". The standard Chan / Zen phrase for what is beyond conceptual articulation.', accent: 'rose' },
            { form: 'ko rai kon', scriptAlts: { 'zh-Hant': '去來今' }, gloss: 'Past, future, present. *去* "gone, past" + *來* "come, future" + *今* "now, present". The three times; the closing *hi ko rai kon* negates all three.', accent: 'sky' },
          ],
        },
      ],
    },
    {
      id: 'closing-note',
      shape: 'prose-commentary',
      heading: 'On the text',
      body: 'The booklet credits the basic English to Richard B. Clarke (1973, *Hsin-Hsin Ming: Verses on the Faith-Mind*). Bodhi Sangha\'s rendering makes line-level changes to fit chanting cadence and clarify meaning. The Chinese text is the canonical 146-line transmission preserved in *Jingde chuandeng lu* and across the Chinese Buddhist canon (T.2076).\n\nThis page presents *segments* of the Chinese rather than the full 146 lines — the four-character lines proceed in tight pairs and the Bodhi English flows across them in sense-units rather than line-by-line; we paired by sense.\n\nThe closing image (*no yesterday, no tomorrow, no today*) is the standard Chinese *hi ko rai kon* (非去來今) closing — Sengcan or his redactors used it to mark the chant\'s threshold back into silence.',
    },
  ],
};

export default shinJinNoMei;

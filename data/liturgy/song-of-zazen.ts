/**
 * Song of Zazen — Hakuin Zenji\'s *Zazen Wasan* (坐禅和讃).
 *
 * Hakuin Ekaku (1685-1768), the great reformer of Japanese Rinzai Zen,
 * composed the *Zazen Wasan* — *Song in Praise of Zazen* — as a
 * vernacular Japanese text (a *wasan*, meaning a hymn in Japanese
 * rather than Sino-Japanese). Its argument: zazen is not preparation
 * for awakening; *this very body, the Buddha* is the present-tense
 * realization that sitting practice opens onto.
 *
 * The booklet (Bodhi Sangha Sutras, p.14) prints only the English. The
 * Japanese here is fetched from Hakuin\'s canonical text as preserved
 * in Sōtō and Rinzai recensions (sourced from sybrma.sakura.ne.jp,
 * cross-checked against the Wikipedia ja entry and koufukuji.yokohama).
 * Aligned to the Bodhi English line by line.
 */

import type { LiturgyDoc } from '../../types/liturgy';
import { wikipediaCitation, ungroundedCitation } from './_groundingHelpers';

export const songOfZazen: LiturgyDoc = {
  slug: 'song-of-zazen',
  sangha: 'bodhi-sangha',
  order: 9,
  title: 'Song of Zazen',
  subtitle: 'Hakuin Zenji — Zazen Wasan (坐禅和讃)',
  tradition: 'zen',
  context: 'Composed by Hakuin Ekaku (1685-1768) for lay practitioners. The closing image — *This very place is the Lotus Land! This very body, the Buddha!* — is the chant\'s defining declaration.',
  sources: {
    canonical: [
      { label: 'Hakuin Ekaku (1685-1768)', url: 'https://en.wikipedia.org/wiki/Hakuin_Ekaku' },
      { label: 'Zazen Wasan (坐禅和讃) — Japanese text', url: 'https://ja.wikipedia.org/wiki/%E5%9D%90%E7%A6%85%E5%92%8C%E8%AE%83' },
      { label: 'sybrma archive of Hakuin\'s Zazen Wasan', url: 'http://sybrma.sakura.ne.jp/470hakuin.zazenwasan.html' },
    ],
    ritual: [
      { label: 'Bodhi Sangha Sutras booklet (May 2016), p.14' },
    ],
  },
  curator:
    'Curation by Aditya. Japanese text from sybrma.sakura.ne.jp cross-checked against the Wikipedia ja article on 坐禅和讃. Romaji follows Hepburn with macrons where the text uses long vowels (Shujō, kōri). The English alignment is to the Bodhi booklet rendering — not a literal interlinear; reads as a verse-by-verse pairing of source and witness.',
  sections: [
    {
      id: 'framing',
      shape: 'prose-commentary',
      body: 'Hakuin\'s *Zazen Wasan* is one of the most-chanted Japanese Zen texts composed in *Japanese* (a *wasan*, vernacular hymn) rather than translated from Sanskrit or Chinese. Hakuin wrote it explicitly for laypeople — at a time when monastics had access to the heavy Sino-Japanese sutra texts but lay practitioners did not.\n\nThe argument: *all beings by nature are Buddha, as ice by nature is water*. The lost are not far from home; they have forgotten the home they never left. People search far when the truth is near. Zazen — formal sitting — is not separate from this realization; it is its mode of expression. The closing images are present-tense affirmations: *this very place is the Lotus Land; this very body, the Buddha*.\n\nIn this page, each Japanese line is paired with the Bodhi booklet\'s English. Hover any kanji compound for a gloss.',
    },
    {
      id: 'all-beings',
      shape: 'triple-script-witness',
      large: true,
      segments: [
        {
          id: 'shujo-honrai',
          pali: 'Shujō honrai hotoke nari',
          scripts: [
            { lang: 'ja-Jpan', label: 'Japanese', text: '衆生本来仏なり', tokens: ['衆生', '本来', '仏', 'なり'], transliteration: 'Shujō honrai hotoke nari' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'All beings by nature are Buddha,',
              alignTo: [0, 0, 1, 1, -1, 2],
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'Shujō', scriptAlts: { 'ja-Jpan': '衆生' }, gloss: 'All sentient beings — *many lives*. Same Sino-Japanese compound used in [[vows]] (vow 1).', accent: 'rose' },
            { form: 'honrai', scriptAlts: { 'ja-Jpan': '本来' }, gloss: 'Originally, by nature, from the very source. *本* "root" + *来* "come". The claim is ontological, not aspirational.', accent: 'amber' },
            { form: 'hotoke', scriptAlts: { 'ja-Jpan': '仏' }, gloss: 'Buddha (in vernacular Japanese reading). The same character as in [[vows]] (*Butsu* in Sino-Japanese reading); here the *kun-yomi* native reading *hotoke* is used because Hakuin is writing for lay chanters, not monks.', accent: 'sky' },
            { form: 'nari', scriptAlts: { 'ja-Jpan': 'なり' }, gloss: 'Is, exists as (classical Japanese copula).' },
          ],
        },
        {
          id: 'mizu-kori',
          pali: 'Mizu to kōri no gotoku nite',
          scripts: [
            { lang: 'ja-Jpan', label: 'Japanese', text: '水と氷のごとくにて', tokens: ['水', 'と', '氷', 'の', 'ごとく', 'にて'], transliteration: 'Mizu to kōri no gotoku nite' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'As ice by nature is water.',
              alignTo: [4, 2, -1, -1, -1, 0],
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'Mizu', scriptAlts: { 'ja-Jpan': '水' }, gloss: 'Water. The substance.', accent: 'sky' },
            { form: 'kōri', scriptAlts: { 'ja-Jpan': '氷' }, gloss: 'Ice. The form. The pair *mizu* / *kōri* is Hakuin\'s most-quoted image: water and ice are not two substances but one in different states.', accent: 'rose' },
            { form: 'gotoku', scriptAlts: { 'ja-Jpan': 'ごとく' }, gloss: 'Like, just as. The comparison particle.' },
          ],
        },
        {
          id: 'mizu-hanarete',
          pali: 'Mizu o hanarete kōri naku',
          scripts: [
            { lang: 'ja-Jpan', label: 'Japanese', text: '水を離れて氷なく', tokens: ['水', 'を', '離れて', '氷', 'なく'], transliteration: 'Mizu o hanarete kōri naku' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'Apart from water there is no ice;',
              alignTo: [2, 2, 0, -1, -1, 4, 3],
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'hanarete', scriptAlts: { 'ja-Jpan': '離れて' }, gloss: '"Separated from, apart from". From *hanareru* (離れる) — to leave, depart from.' },
            { form: 'naku', scriptAlts: { 'ja-Jpan': 'なく' }, gloss: '"Not, none, without". Classical negative form.' },
          ],
        },
        {
          id: 'shujo-no-hoka',
          pali: 'Shujō no hoka ni hotoke nashi',
          scripts: [
            { lang: 'ja-Jpan', label: 'Japanese', text: '衆生の外に仏なし', tokens: ['衆生', 'の', '外', 'に', '仏', 'なし'], transliteration: 'Shujō no hoka ni hotoke nashi' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'Apart from beings, no Buddha.',
              alignTo: [2, 2, 0, -1, 4],
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'hoka', scriptAlts: { 'ja-Jpan': '外' }, gloss: '"Outside, other than". *外* "outside" — the same character used in *gaijin* (外人, "outside person").' },
            { form: 'nashi', scriptAlts: { 'ja-Jpan': 'なし' }, gloss: '"There is none". Classical literary negation.' },
          ],
        },
      ],
      commentary:
        'The opening couplet declares Hakuin\'s thesis: beings and Buddha are not two substances but one substance in different states. The ice-water image holds the whole sutta. Every line that follows expounds this opening.',
    },
    {
      id: 'searching-near',
      shape: 'triple-script-witness',
      segments: [
        {
          id: 'shujo-chikaki',
          pali: 'Shujō chikaki o shirazushite',
          scripts: [
            { lang: 'ja-Jpan', label: 'Japanese', text: '衆生近きを不知して', tokens: ['衆生', '近き', 'を', '不知', 'して'], transliteration: 'Shujō chikaki o shirazushite' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'How sad that people ignore the near',
              alignTo: [-1, -1, -1, 0, 3, -1, 1],
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'chikaki', scriptAlts: { 'ja-Jpan': '近き' }, gloss: '"The near, the close-at-hand". From *chikai* (近い) "near".', accent: 'sky' },
            { form: 'shirazu', scriptAlts: { 'ja-Jpan': '不知' }, gloss: 'Not knowing, ignorance of. *不* "not" + *知* "know".' },
          ],
        },
        {
          id: 'toku-motomuru',
          pali: 'Tōku motomuru hakanasa yo',
          scripts: [
            { lang: 'ja-Jpan', label: 'Japanese', text: '遠く求むるはかなさよ', tokens: ['遠く', '求むる', 'はかなさ', 'よ'], transliteration: 'Tōku motomuru hakanasa yo' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'And search for truth afar;',
              alignTo: [-1, 1, -1, -1, 0],
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'Tōku', scriptAlts: { 'ja-Jpan': '遠く' }, gloss: '"Far, distant". The opposite of *chikaki* in the previous line — the structure pivots on this near/far contrast.', accent: 'sky' },
            { form: 'motomuru', scriptAlts: { 'ja-Jpan': '求むる' }, gloss: 'To seek, search for. Classical form of *motomeru* (求める).' },
            { form: 'hakanasa', scriptAlts: { 'ja-Jpan': 'はかなさ' }, gloss: '"Vanity, futility, fleeting sadness". One of Japanese aesthetics\' load-bearing words — the recognition of impermanence as bittersweet.', accent: 'rose' },
          ],
        },
        {
          id: 'tatoeba-mizu',
          pali: 'Tatoeba mizu no naka ni ite',
          scripts: [
            { lang: 'ja-Jpan', label: 'Japanese', text: '譬ば水の中に居て', tokens: ['譬ば', '水', 'の', '中', 'に', '居て'], transliteration: 'Tatoeba mizu no naka ni ite' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'Like someone in the midst of water crying out in thirst;',
              alignTo: [0, -1, -1, -1, 3, -1, 1, -1, -1, -1, -1],
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'Tatoeba', scriptAlts: { 'ja-Jpan': '譬ば' }, gloss: '"For example, like, as if". The simile particle.' },
            { form: 'naka', scriptAlts: { 'ja-Jpan': '中' }, gloss: '"Middle, inside, midst". *Mizu no naka ni ite* = "being in the midst of water".' },
            { form: 'ite', scriptAlts: { 'ja-Jpan': '居て' }, gloss: 'Being, existing (animate). Classical form of *iru*.' },
          ],
        },
        {
          id: 'chouja-ie',
          pali: 'Chōja no ie no ko to narite',
          scripts: [
            { lang: 'ja-Jpan', label: 'Japanese', text: '長者の家の子となりて', tokens: ['長者', 'の', '家', 'の', '子', 'と', 'なりて'], transliteration: 'Chōja no ie no ko to narite' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'Like a child of a wealthy home lost among the poor',
              alignTo: [-1, -1, 4, -1, -1, 0, 2, -1, -1, -1, -1],
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'Chōja', scriptAlts: { 'ja-Jpan': '長者' }, gloss: '"Elder, wealthy householder". A standard term from Buddhist parables — the elder in the *Lotus Sūtra*\'s parable of the lost son.', accent: 'amber' },
            { form: 'ie', scriptAlts: { 'ja-Jpan': '家' }, gloss: '"House, home".', accent: 'sky' },
            { form: 'ko', scriptAlts: { 'ja-Jpan': '子' }, gloss: '"Child, son". The figure of the *prodigal* — Hakuin alludes to the Lotus Sūtra Chapter 4 parable.', accent: 'rose' },
          ],
          note: 'The "long-lost son" image is from *Saddharma-puṇḍarīka* (Lotus Sūtra) Chapter 4 — a wealthy father\'s son wanders for years, forgetting his inheritance, until he stumbles back into his own father\'s house. Hakuin folds this canonical Mahāyāna parable into his vernacular hymn.',
        },
      ],
      commentary:
        'The two great Hakuin similes for ignorance: someone drowning while crying out from thirst, and the wealthy heir wandering as a beggar through the slums. Both name the same mistake — *not knowing what you already have*.',
    },
    {
      id: 'six-worlds',
      shape: 'triple-script-witness',
      segments: [
        {
          id: 'rokushu-rinne',
          pali: 'Rokushu rinne no innen wa',
          scripts: [
            { lang: 'ja-Jpan', label: 'Japanese', text: '六趣輪廻の因縁は', tokens: ['六趣', '輪廻', 'の', '因縁', 'は'], transliteration: 'Rokushu rinne no innen wa' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'Wandering through the Six Worlds',
              alignTo: [1, -1, -1, 0, 0],
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'Rokushu', scriptAlts: { 'ja-Jpan': '六趣' }, gloss: 'The Six Realms / Six Worlds — *gods, asuras, humans, animals, hungry ghosts, hell-beings*. The six destinations of rebirth in Buddhist cosmology. Same as *roku-dō* (六道).', accent: 'rose' },
            { form: 'rinne', scriptAlts: { 'ja-Jpan': '輪廻' }, gloss: '*Saṃsāra* — the wheel of rebirth. *輪* "wheel" + *廻* "turn".', accent: 'amber' },
            { form: 'innen', scriptAlts: { 'ja-Jpan': '因縁' }, gloss: 'Causes and conditions — *hetu-pratyaya*. The *yīn-yuán* compound that also appears in [[enmei-jikku-kannon-gyo]] (lines 3-4).' },
          ],
        },
        {
          id: 'guchi-yamiji',
          pali: 'Onoga guchi no yamiji nari',
          scripts: [
            { lang: 'ja-Jpan', label: 'Japanese', text: '己が愚痴の闇路なり', tokens: ['己', 'が', '愚痴', 'の', '闇路', 'なり'], transliteration: 'Onoga guchi no yamiji nari' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'From dark path to dark path,',
              alignTo: [-1, -1, 4, -1, -1, 4],
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'Onoga', scriptAlts: { 'ja-Jpan': '己' }, gloss: '"One\'s own" — *onore*. The first-person possessive form.' },
            { form: 'guchi', scriptAlts: { 'ja-Jpan': '愚痴' }, gloss: '*Moha* — delusion, stupidity. One of the *Three Poisons* (三毒) alongside greed and hate.', accent: 'rose' },
            { form: 'yamiji', scriptAlts: { 'ja-Jpan': '闇路' }, gloss: 'Dark path. *闇* "darkness" + *路* "road". The image repeats — *闇路にやみぢを踏みそへて* — adding dark to dark.', accent: 'sky' },
          ],
        },
        {
          id: 'yamiji-itsuka',
          pali: 'Itsuka shōji o hanarubeki',
          scripts: [
            { lang: 'ja-Jpan', label: 'Japanese', text: 'いつか生死をはなるべき', tokens: ['いつか', '生死', 'を', 'はなる', 'べき'], transliteration: 'Itsuka shōji o hanarubeki' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'lost in the darkness of ignorance: When shall we be freed from birth-and-death?',
              alignTo: [-1, -1, -1, -1, -1, -1, 0, -1, -1, -1, 3, -1, 1],
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'Itsuka', scriptAlts: { 'ja-Jpan': 'いつか' }, gloss: '"When, someday, ever". The note of longing in the question.' },
            { form: 'shōji', scriptAlts: { 'ja-Jpan': '生死' }, gloss: 'Birth-and-death — *jāti-maraṇa*. The samsaric cycle of becoming.', accent: 'rose' },
            { form: 'hanaru', scriptAlts: { 'ja-Jpan': 'はなる' }, gloss: 'To leave, depart from — same root as *hanarete* (離れて) earlier.' },
          ],
        },
      ],
    },
    {
      id: 'praise-of-zazen',
      shape: 'triple-script-witness',
      segments: [
        {
          id: 'makaen-zenjo',
          pali: 'Sore makaen no zenjō wa',
          scripts: [
            { lang: 'ja-Jpan', label: 'Japanese', text: '夫れ摩訶衍の禅定は', tokens: ['夫れ', '摩訶衍', 'の', '禅定', 'は'], transliteration: 'Sore makaen no zenjō wa' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'Oh, the Zazen of Mahayana!',
              alignTo: [-1, -1, 2, -1, 1],
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'Sore', scriptAlts: { 'ja-Jpan': '夫れ' }, gloss: '"That, well now" — a classical opening exclamation.' },
            { form: 'makaen', scriptAlts: { 'ja-Jpan': '摩訶衍' }, gloss: '*Mahāyāna* — phonetic transcription. *摩訶* "great" (*mahā*) + *衍* "vehicle / extend".', accent: 'amber' },
            { form: 'zenjō', scriptAlts: { 'ja-Jpan': '禅定' }, gloss: '*Dhyāna-samādhi* — meditative concentration. *禅* "zen, meditation" + *定* "settled, fixed". Same *禅* (chán / zen) that names the whole tradition.', accent: 'rose' },
          ],
        },
        {
          id: 'shotan-suru',
          pali: 'Shōtan suru ni amari ari',
          scripts: [
            { lang: 'ja-Jpan', label: 'Japanese', text: '称歎するに余りあり', tokens: ['称歎', 'する', 'に', '余り', 'あり'], transliteration: 'Shōtan suru ni amari ari' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'It can never be praised enough!',
              alignTo: [-1, -1, -1, 0, -1, 3],
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'Shōtan', scriptAlts: { 'ja-Jpan': '称歎' }, gloss: 'Praise, extol. *称* "name" + *歎* "lament / praise".', accent: 'sky' },
            { form: 'amari', scriptAlts: { 'ja-Jpan': '余り' }, gloss: '"Excess, more than". Hakuin says praise *余りあり* — has overflow, exceeds what can be said.' },
          ],
        },
        {
          id: 'fuse-jikai',
          pali: 'Fuse ya jikai no shoharamitsu',
          scripts: [
            { lang: 'ja-Jpan', label: 'Japanese', text: '布施や持戒の諸波羅蜜', tokens: ['布施', 'や', '持戒', 'の', '諸', '波羅蜜'], transliteration: 'Fuse ya jikai no shoharamitsu' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'The many Paramitas of dana, sila, Nembutsu,',
              alignTo: [-1, 4, 4, -1, 0, 2, -1],
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'Fuse', scriptAlts: { 'ja-Jpan': '布施' }, gloss: '*Dāna* — generosity, giving. First of the Six Pāramitās.', accent: 'rose' },
            { form: 'jikai', scriptAlts: { 'ja-Jpan': '持戒' }, gloss: '*Śīla* — keeping the precepts. Second of the Six Pāramitās. *持* "hold" + *戒* "precept".', accent: 'rose' },
            { form: 'haramitsu', scriptAlts: { 'ja-Jpan': '波羅蜜' }, gloss: '*Pāramitā* — perfection, "crossing over". Phonetic loan. Same *波羅* as in *pāragate* (波羅) in the [[heart-sutra]] mantra.', accent: 'amber' },
          ],
        },
        {
          id: 'nenbutsu-sange',
          pali: 'Nenbutsu sange shugyō tō',
          scripts: [
            { lang: 'ja-Jpan', label: 'Japanese', text: '念仏懺悔修行等', tokens: ['念仏', '懺悔', '修行', '等'], transliteration: 'Nenbutsu sange shugyō tō' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'Repentance, sadhana and so on',
              alignTo: [1, 2, -1, -1, 3],
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'Nenbutsu', scriptAlts: { 'ja-Jpan': '念仏' }, gloss: '*Buddha-recollection* — *念* "mindfulness" + *仏* "Buddha". In Pure Land schools, recitation of *namu-amida-butsu*. The booklet glosses *Nembutsu* as "invocation of the Buddha\'s name".', accent: 'rose' },
            { form: 'sange', scriptAlts: { 'ja-Jpan': '懺悔' }, gloss: 'Repentance, confession of past wrongs.' },
            { form: 'shugyō', scriptAlts: { 'ja-Jpan': '修行' }, gloss: 'Practice, religious training. The general Japanese Buddhist term for spiritual cultivation.', accent: 'sky' },
          ],
        },
        {
          id: 'mina-kono-uchi',
          pali: 'Mina kono uchi ni kisuru nari',
          scripts: [
            { lang: 'ja-Jpan', label: 'Japanese', text: '皆この中に帰するなり', tokens: ['皆', 'この', '中', 'に', '帰する', 'なり'], transliteration: 'Mina kono uchi ni kisuru nari' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'All have their source in Zazen.',
              alignTo: [0, -1, 4, -1, -1, 2],
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'Mina', scriptAlts: { 'ja-Jpan': '皆' }, gloss: '"All, everyone". The sweeping inclusive.', accent: 'amber' },
            { form: 'kisuru', scriptAlts: { 'ja-Jpan': '帰する' }, gloss: 'To return to, find their root in. *帰* "return". All practices return *home* to zazen.', accent: 'rose' },
          ],
        },
        {
          id: 'ichiza-no-ko',
          pali: 'Ichiza no kō o nasu hito mo',
          scripts: [
            { lang: 'ja-Jpan', label: 'Japanese', text: '一座の功をなす人も', tokens: ['一座', 'の', '功', 'を', 'なす', '人', 'も'], transliteration: 'Ichiza no kō o nasu hito mo' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'The One Practice of Zazen erases numberless sins:',
              alignTo: [-1, 0, 0, -1, -1, -1, -1, -1],
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'Ichiza', scriptAlts: { 'ja-Jpan': '一座' }, gloss: '"One sitting" — a single zazen session. *一* "one" + *座* "seat, sitting". Hakuin\'s most famous tight image: a *single* period of zazen has the merit of all good works.', accent: 'rose' },
            { form: 'kō', scriptAlts: { 'ja-Jpan': '功' }, gloss: 'Merit, achievement, efficacy.' },
          ],
        },
        {
          id: 'tsumishi-muryo',
          pali: 'Tsumishi muryō no tsumi horobu',
          scripts: [
            { lang: 'ja-Jpan', label: 'Japanese', text: '積し無量の罪ほろぶ', tokens: ['積し', '無量', 'の', '罪', 'ほろぶ'], transliteration: 'Tsumishi muryō no tsumi horobu' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'Where are then all the hells?',
              alignTo: [-1, -1, -1, -1, -1, -1],
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'muryō', scriptAlts: { 'ja-Jpan': '無量' }, gloss: 'Immeasurable. Same *無量* as in [[vows]] (vow 3 *muryō*).', accent: 'amber' },
            { form: 'tsumi', scriptAlts: { 'ja-Jpan': '罪' }, gloss: 'Sin, transgression, karmic guilt.', accent: 'rose' },
            { form: 'horobu', scriptAlts: { 'ja-Jpan': 'ほろぶ' }, gloss: 'To perish, be destroyed.' },
          ],
          note: 'Literal: "the immeasurable accumulated sins are destroyed". The Bodhi English reframes as a rhetorical question ("Where are then all the hells?") — same point, different rhetorical handle.',
        },
        {
          id: 'jodo-tokarazu',
          pali: 'Jōdo sunawachi tōkarazu',
          scripts: [
            { lang: 'ja-Jpan', label: 'Japanese', text: '浄土即ち遠からず', tokens: ['浄土', '即ち', '遠からず'], transliteration: 'Jōdo sunawachi tōkarazu' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'The Pure Land itself cannot be far away!',
              alignTo: [-1, 0, 0, 1, 2, 2, 2, 2],
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'Jōdo', scriptAlts: { 'ja-Jpan': '浄土' }, gloss: 'The Pure Land — *Sukhāvati*. *浄* "pure" + *土* "land".', accent: 'rose' },
            { form: 'sunawachi', scriptAlts: { 'ja-Jpan': '即ち' }, gloss: '"Then, precisely, namely" — the *therefore* of classical Japanese. Hakuin uses this same particle in the closing *toujo sunawachi*, *kono mi sunawachi*.', accent: 'amber' },
            { form: 'tōkarazu', scriptAlts: { 'ja-Jpan': '遠からず' }, gloss: '"Not far". *遠* "far" + classical negative. Echoes *Tōku motomuru* earlier — the truth that seemed far is here.', accent: 'sky' },
          ],
        },
      ],
      commentary:
        'Hakuin\'s defence of zazen — not against other Buddhist practices (he names them all: *dāna, śīla, nenbutsu, sange, shugyō*) but as their root. *Ichiza no kō* — one sitting\'s merit — gathers all the perfections into itself.',
    },
    {
      id: 'self-nature',
      shape: 'triple-script-witness',
      segments: [
        {
          id: 'jiki-jisho',
          pali: 'Jiki ni jishō o shōsureba',
          scripts: [
            { lang: 'ja-Jpan', label: 'Japanese', text: '直に自性を証すれば', tokens: ['直に', '自性', 'を', '証すれば'], transliteration: 'Jiki ni jishō o shōsureba' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'When you truly turn your eyes inwards / And bear witness to Self-Nature,',
              alignTo: [0, 0, 0, 0, 0, -1, -1, 3, -1, -1, 3, -1, 1],
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'Jiki', scriptAlts: { 'ja-Jpan': '直に' }, gloss: '"Directly, immediately, without mediation". Hakuin\'s Rinzai emphasis: *direct* seeing into nature.', accent: 'amber' },
            { form: 'jishō', scriptAlts: { 'ja-Jpan': '自性' }, gloss: '*Svabhāva* — self-nature, intrinsic nature. The technical Mahāyāna term for what one is in oneself.', accent: 'rose' },
            { form: 'shōsureba', scriptAlts: { 'ja-Jpan': '証すれば' }, gloss: 'To realize, attest to, verify. *証* same character as the *shō* of *shōmon* / *shōgyō*. "If you realize…".' },
          ],
        },
        {
          id: 'jisho-musho',
          pali: 'Jishō sunawachi mushō nite',
          scripts: [
            { lang: 'ja-Jpan', label: 'Japanese', text: '自性即ち無性にて', tokens: ['自性', '即ち', '無性', 'にて'], transliteration: 'Jishō sunawachi mushō nite' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'Self-Nature that is no-nature',
              alignTo: [0, -1, -1, 2],
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'Jishō', scriptAlts: { 'ja-Jpan': '自性' }, gloss: 'Self-nature.', accent: 'rose' },
            { form: 'mushō', scriptAlts: { 'ja-Jpan': '無性' }, gloss: '*Niḥsvabhāva* — no-nature, the absence of intrinsic nature. The Madhyamaka turn: self-nature IS no-nature. Hakuin makes the Mahāyāna paradox explicit.', accent: 'sky' },
          ],
          note: 'The Madhyamaka equation in two words. *Jishō* (svabhāva, intrinsic nature) and *mushō* (niḥsvabhāva, emptiness of intrinsic nature) are presented as the same thing — the same realization seen from two directions.',
        },
        {
          id: 'muso-no-so',
          pali: 'Musō no sō o sō to shite',
          scripts: [
            { lang: 'ja-Jpan', label: 'Japanese', text: '無相の相を相として', tokens: ['無相', 'の', '相', 'を', '相', 'として'], transliteration: 'Musō no sō o sō to shite' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'Entering the form of no-form,',
              alignTo: [6, -1, 2, -1, 0],
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'Musō', scriptAlts: { 'ja-Jpan': '無相' }, gloss: 'Formlessness, no-mark. *無* "no" + *相* "mark, sign, form". Same *相* as in *animitta* — the marks of conceptual identification.', accent: 'amber' },
            { form: 'sō', scriptAlts: { 'ja-Jpan': '相' }, gloss: '"Mark, sign, form". Hakuin\'s wordplay: *the no-mark mark as mark* — practice within forms while not bound by forms.', accent: 'rose' },
          ],
        },
        {
          id: 'munen-no-nen',
          pali: 'Munen no nen o nen to shite',
          scripts: [
            { lang: 'ja-Jpan', label: 'Japanese', text: '無念の念を念として', tokens: ['無念', 'の', '念', 'を', '念', 'として'], transliteration: 'Munen no nen o nen to shite' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'Entering the thought of no-thought,',
              alignTo: [6, -1, 2, -1, 0],
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'Munen', scriptAlts: { 'ja-Jpan': '無念' }, gloss: 'No-thought. *無* "no" + *念* "thought". Same *念* as *nen* in [[enmei-jikku-kannon-gyo]] (line 7 *chō nen kanzeon*).', accent: 'amber' },
            { form: 'nen', scriptAlts: { 'ja-Jpan': '念' }, gloss: 'Thought, mindful instant.', accent: 'rose' },
          ],
        },
        {
          id: 'utau-mau',
          pali: 'Utau mo mau mo nori no koe',
          scripts: [
            { lang: 'ja-Jpan', label: 'Japanese', text: '謡うも舞ふも法の声', tokens: ['謡うも', '舞ふも', '法', 'の', '声'], transliteration: 'Utau mo mau mo nori no koe' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'Your singing and dancing is the voice of Dharma.',
              alignTo: [-1, 0, -1, 2, -1, -1, 6, -1, 4],
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'utau', scriptAlts: { 'ja-Jpan': '謡うも' }, gloss: 'To sing (especially nō chanting). *謡* same character as *noh-utai*.', accent: 'sky' },
            { form: 'mau', scriptAlts: { 'ja-Jpan': '舞ふも' }, gloss: 'To dance. *舞* same character as *bugaku*.', accent: 'sky' },
            { form: 'nori', scriptAlts: { 'ja-Jpan': '法' }, gloss: 'Dharma (vernacular reading). Same *法* (*hō* in Sino-Japanese reading) as in [[vows]] vow 3 *Hōmon*.', accent: 'rose' },
            { form: 'koe', scriptAlts: { 'ja-Jpan': '声' }, gloss: 'Voice, sound.' },
          ],
        },
      ],
    },
    {
      id: 'this-very-body',
      shape: 'triple-script-witness',
      segments: [
        {
          id: 'sanmai-muge',
          pali: 'Sanmai muge no sora hiroku',
          scripts: [
            { lang: 'ja-Jpan', label: 'Japanese', text: '三昧無碍の空ひろく', tokens: ['三昧', '無碍', 'の', '空', 'ひろく'], transliteration: 'Sanmai muge no sora hiroku' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'How boundless and free is the sky of Samadhi,',
              alignTo: [-1, 4, -1, 1, -1, -1, 3, -1, 0],
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'Sanmai', scriptAlts: { 'ja-Jpan': '三昧' }, gloss: '*Samādhi* — concentration. Phonetic loan: *三* "three" + *昧* "obscure" — phonetic only.', accent: 'rose' },
            { form: 'muge', scriptAlts: { 'ja-Jpan': '無碍' }, gloss: '"Unobstructed, free of hindrance". Same *無碍* as in the Heart Sutra\'s *xin wu guai-ai* (心無罣礙) — "no hindrance in the mind".', accent: 'amber' },
            { form: 'sora', scriptAlts: { 'ja-Jpan': '空' }, gloss: 'Sky / emptiness. Same *空* that means *śūnyatā*. The pun is deliberate: the *sky* of samādhi IS *emptiness*.', accent: 'sky' },
          ],
        },
        {
          id: 'shichi-enmyo',
          pali: 'Shichi enmyō no tsuki saen',
          scripts: [
            { lang: 'ja-Jpan', label: 'Japanese', text: '四智円明の月さえん', tokens: ['四智', '円明', 'の', '月', 'さえん'], transliteration: 'Shichi enmyō no tsuki saen' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'How bright the Moon of the Fourfold Wisdom!',
              alignTo: [-1, 1, -1, 3, -1, -1, 0, 0],
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'Shichi', scriptAlts: { 'ja-Jpan': '四智' }, gloss: 'The Four Wisdoms of Yogācāra Buddhology — *Mirror Wisdom, Equality Wisdom, Discriminating Wisdom, All-Accomplishing Wisdom*. Mentioned in the booklet glossary.', accent: 'rose' },
            { form: 'enmyō', scriptAlts: { 'ja-Jpan': '円明' }, gloss: '"Perfect-bright". *円* "round, perfect" + *明* "bright".', accent: 'amber' },
            { form: 'tsuki', scriptAlts: { 'ja-Jpan': '月' }, gloss: 'Moon. The classical Zen image: mind as the moon.', accent: 'sky' },
          ],
        },
        {
          id: 'tojo-rengekoku',
          pali: 'Tōjo sunawachi rengekoku',
          scripts: [
            { lang: 'ja-Jpan', label: 'Japanese', text: '当所即ち蓮華国', tokens: ['当所', '即ち', '蓮華国'], transliteration: 'Tōjo sunawachi rengekoku' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'This very place is the Lotus Land!',
              alignTo: [0, 0, 0, 1, -1, 2, 2],
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'Tōjo', scriptAlts: { 'ja-Jpan': '当所' }, gloss: '"This very place, right here". *当* "this present" + *所* "place".', accent: 'rose' },
            { form: 'sunawachi', scriptAlts: { 'ja-Jpan': '即ち' }, gloss: '"Precisely, *is*". The classical equational *=*.', accent: 'amber' },
            { form: 'rengekoku', scriptAlts: { 'ja-Jpan': '蓮華国' }, gloss: 'Lotus Land. *蓮華* "lotus flower" + *国* "land". The Pure Land of the Lotus Sūtra.', accent: 'sky' },
          ],
        },
        {
          id: 'kono-mi-hotoke',
          pali: 'Kono mi sunawachi hotoke nari',
          scripts: [
            { lang: 'ja-Jpan', label: 'Japanese', text: '此身即ち仏なり', tokens: ['此身', '即ち', '仏', 'なり'], transliteration: 'Kono mi sunawachi hotoke nari' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'This very body, the Buddha!',
              alignTo: [0, 0, 1, -1, 3],
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'Kono mi', scriptAlts: { 'ja-Jpan': '此身' }, gloss: 'This body. *此* "this" + *身* "body". Hakuin lands the chant on the body — *here, this flesh*.', accent: 'rose' },
            { form: 'sunawachi', scriptAlts: { 'ja-Jpan': '即ち' }, gloss: '"Is precisely, namely, equals". Same particle as in the preceding line.', accent: 'amber' },
            { form: 'hotoke', scriptAlts: { 'ja-Jpan': '仏' }, gloss: 'Buddha. The vernacular *kun-yomi* reading — same character that opened the chant as *hotoke* in line 1. The chant closes the circle: the *hotoke* who was always already we are, in this very body, now.', accent: 'sky' },
          ],
          note: 'The closing couplet — *toujo sunawachi rengekoku, kono mi sunawachi hotoke nari* — is one of the most-cited declarations in Japanese Zen. The grammatical *sunawachi* (即ち, *is precisely*) does the load-bearing work: *this place is precisely the Lotus Land, this body is precisely the Buddha*. Not *will become*, not *resembles*, not *symbolizes*. *Is*.',
          citations: [ungroundedCitation('Hakuin\'s Zazen Wasan closing couplet — multiple translations consulted; reading and gloss are well-established but no single canonical reference cited')],
        },
      ],
    },
  ],
};

export default songOfZazen;

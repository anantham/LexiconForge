/**
 * Enmē Jikku Kannon Gyō, 延命十句觀音經
 *
 * "The Ten-Phrase Kannon Sutra for Prolonging Life", a very short
 * (10-line) Mahāyāna-style devotional chant invoking Kannon /
 * Avalokiteśvara. Each line is 3-5 syllables in Sino-Japanese, with
 * matching Chinese-character (kanji) form. Chanted 3× in the MAPLE
 * morning service, between the Theravāda devotional sequence and the
 * Sho Sai Myō Kichijō Darani.
 *
 * Origin: composed in China; popularized in Japan via the Edo-period
 * Rinzai master Hakuin Ekaku, who taught it widely. Its compactness
 * is the point, ten phrases, one breath, the bodhisattva of
 * compassion held in mind morning and evening.
 *
 * Reader treatment: 10 segments (one per line), each with Sino-Japanese
 * phonetic + Hanzi script. Per-character scriptMorphemes decompose each
 * compound (觀世音 = "perceiver-world-sound" = Avalokiteśvara, 常樂我淨 =
 * "permanent-joy-self-pure" = the four virtues of nirvāṇa).
 */

import type { LiturgyDoc } from '../../types/liturgy';
import { wikipediaCitation } from './_groundingHelpers';

export const enmeiJikkuKannonGyo: LiturgyDoc = {
  slug: 'enmei-jikku-kannon-gyo',
  sangha: 'maple',
  order: 2,
  title: 'Enmē Jikku Kannon Gyō',
  subtitle: 'The Ten-Verse Sutra of Boundless Compassion (延命十句觀音經)',
  tradition: 'mahayana',
  context: 'Ten short phrases invoking Kanzeon (Avalokiteśvara). The title 延命 ("life-extending") names its traditional use as a protection-and-longevity chant in East Asian Buddhism.',
  sources: {
    canonical: [
      {
        label: 'Enmē Jikku Kannon Gyō, Hakuin Ekaku\'s teaching tradition',
        url: 'https://en.wikipedia.org/wiki/Ten_Verse_Kannon_Sutra',
      },
    ],
    ritual: [
      { label: 'MAPLE morning service sheet' },
    ],
  },
  curator:
    'Curation by Aditya. Sino-Japanese phonetic + Hanzi forms transcribed directly from the MAPLE chant sheet (which carries no English). The "AI" English is an AI-drafted working version, not from a specific publication; "Soto Zen" and "Red Cedar Zen" translations come from the linked sources below.',
  sections: [
    {
      id: 'title',
      shape: 'triple-script-witness',
      compactOpening: true,
      segments: [
        {
          id: 'title-segment',
          pali: 'Enmē Jikku Kannon Gyō',
          scripts: [
            {
              lang: 'ja-Jpan',
              label: 'Sino-Japanese',
              text: 'Enmē Jikku Kannon Gyō',
              tokens: ['Enmē', 'Jikku', 'Kannon', 'Gyō'],
            },
            {
              lang: 'zh-Hant',
              label: 'Hanzi',
              text: '延命十句觀音經',
              tokens: ['延命', '十句', '觀音', '經'],
              transliteration: 'Enmē  Jikku  Kannon  Gyō  (yán mìng shí jù guān yīn jīng in Mandarin)',
            },
          ],
          witnesses: [
            {
              by: 'AI',
              text: 'The Ten-Verse Sutra of Boundless Compassion',
            },
            {
              by: 'Soto Zen',
              text: 'Ten-Line Kannon Sutra',
              url: 'https://www.sotozen.com/eng/library/glossary/individual.html?key=ten_line_kannon_sutra',
            },
            {
              by: 'Red Cedar Zen',
              text: 'The Ten-Verse Kannon Sutra for Protecting Life',
              url: 'https://www.redcedarzen.org/Enmei-Jukku-Kannon-Gyo',
            },
          ],
          words: [
            {
              form: 'Enmē',
              scriptAlts: { 'zh-Hant': '延命' },
              gloss: 'Usually rendered "prolonging life" per the Hakuin tradition (延命). The alternative writing 円明 reads as "endless dimensions" or "boundlessness", the limitless nature of awakened compassion. Two chanting lineages, one practice.',
            },
            {
              form: 'Jikku',
              scriptAlts: { 'zh-Hant': '十句' },
              gloss: 'Ten phrases. Ten verses. Each line short enough to hold in one breath.',
            },
            {
              form: 'Kannon',
              scriptAlts: { 'zh-Hant': '觀音' },
              gloss: 'Avalokiteśvara, the bodhisattva of compassion. Literally "the perceiver of world-sounds". Invoked not as an external figure in a Buddha-heaven, but as the spirit of compassion within ourselves.',
              accent: 'rose',
              citations: [wikipediaCitation('Avalokiteśvara')],
            },
            {
              form: 'Gyō',
              scriptAlts: { 'zh-Hant': '經' },
              gloss: 'Sutra, from the Sanskrit *sūtra* ("thread, suture"), the weaving together of the Buddha\'s teachings.',
            },
          ],
        },
      ],
    },
    {
      id: 'ten-phrases',
      shape: 'triple-script-witness',
      repetitions: 3,
      large: true,
      segments: [
        {
          id: 'line-1-kan-ze-on',
          pali: 'Kan ze on',
          scripts: [
            {
              lang: 'ja-Jpan',
              label: 'Sino-Japanese',
              text: 'Kan ze on',
              tokens: ['Kan ze on'],
            },
            {
              lang: 'zh-Hant',
              label: 'Hanzi',
              text: '觀世音',
              tokens: ['觀世音'],
              transliteration: 'Kan ze on  (guān shì yīn in Mandarin)',
            },
          ],
          witnesses: [
            {
              by: 'AI',
              text: 'Kanzeon!',
              alignTo: [0],
            },
            {
              by: 'Soto Zen',
              text: 'Kanzeon',
              alignTo: [0],
              url: 'https://www.sotozen.com/eng/library/glossary/individual.html?key=ten_line_kannon_sutra',
            },
            {
              by: 'Red Cedar Zen',
              text: 'Kanzeon!',
              alignTo: [0],
              url: 'https://www.redcedarzen.org/Enmei-Jukku-Kannon-Gyo',
            },
          ],
          words: [
            {
              form: 'Kan ze on',
              scriptAlts: { 'zh-Hant': '觀世音' },
              etymology: '*kan* "perceive" + *ze* "world" + *on* "sound", semantic translation of Sanskrit *Avalokiteśvara* ("the lord who looks down [on the world\'s cries]")',
              gloss: 'Kannon / Avalokiteśvara, invoked not as an external figure in a Buddha-heaven but as the spirit of compassion within ourselves; our compassionate heart',
              accent: 'rose',
              scriptMorphemes: {
                'zh-Hant': [
                  { text: '觀', type: 'semantic', pronunciation: 'kan / guān', gloss: 'perceive / contemplate, with a sense of penetrating awareness; not just looking, but listening so deeply we are saturated to the core' },
                  { text: '世', type: 'semantic', pronunciation: 'ze / shì', gloss: 'the world, the field of cries that needs hearing' },
                  { text: '音', type: 'semantic', pronunciation: 'on / yīn', gloss: 'sound, voice, together 觀世音 = "the perceiver of world-sounds". To "listen" here means more than hearing with the ears, being actively present to the world and to ourselves' },
                ],
              },
              citations: [wikipediaCitation('Avalokiteśvara')],
            },
          ],
          note: 'We begin the sutra by invoking Kanzeon, *understood not as an external figure in a Buddha heaven but as the spirit of compassion within ourselves. It is our compassionate heart.*\n\nHere, listening is more than just hearing with the ears. It is being so open to a sound or a cry that we are saturated to the core of our being. Another way of putting it: this kind of listening means to be actively present to the world and ourselves. This is also an expression of what we do when we sit quietly; we become attentively present to ourselves.',
        },
        {
          id: 'line-2-namu-butsu',
          pali: 'Na mu butsu',
          scripts: [
            {
              lang: 'ja-Jpan',
              label: 'Sino-Japanese',
              text: 'Na mu butsu',
              tokens: ['Na mu', 'butsu'],
            },
            {
              lang: 'zh-Hant',
              label: 'Hanzi',
              text: '南無佛',
              tokens: ['南無', '佛'],
              transliteration: 'Na mu  butsu  (homage to the Buddha)',
            },
          ],
          witnesses: [
            {
              by: 'AI',
              text: 'Veneration to the Buddha',
              alignTo: [0, -1, -1, 1],
            },
            {
              by: 'Soto Zen',
              text: 'Paying homage to Buddha',
              alignTo: [0, 0, 0, 1],
              url: 'https://www.sotozen.com/eng/library/glossary/individual.html?key=ten_line_kannon_sutra',
            },
            {
              by: 'Red Cedar Zen',
              text: 'I venerate the Buddha',
              alignTo: [-1, 0, -1, 1],
              url: 'https://www.redcedarzen.org/Enmei-Jukku-Kannon-Gyo',
            },
          ],
          words: [
            {
              form: 'Na mu',
              scriptAlts: { 'zh-Hant': '南無' },
              etymology: 'Phonetic loan: transliterates Sanskrit *namaḥ* ("homage, salutation")',
              gloss: 'literally "pay homage to", but in Zen the deeper reading is **at one with**. We are at one with Buddha. Our original nature is Buddha Nature. There is nothing outside our original nature; this is paying homage to the deepest part of ourselves.',
              scriptMorphemes: {
                'zh-Hant': [
                  { text: '南', type: 'phonetic', pronunciation: 'na / nán', gloss: 'phonetic: transliterates "na-"' },
                  { text: '無', type: 'phonetic', pronunciation: 'mu / mó', gloss: 'phonetic: transliterates "-maḥ"' },
                ],
              },
            },
            {
              form: 'butsu',
              scriptAlts: { 'zh-Hant': '佛' },
              etymology: 'Phonetic loan from Sanskrit *buddha*, also semantically "awakened one"',
              gloss: 'Buddha, the awakened one',
              accent: 'amber',
              citations: [wikipediaCitation('Buddha')],
            },
          ],
          note: '*Namu* literally means "pay homage to," but the Zen reading is "at one with." We are one with Buddha. Our original nature IS Buddha Nature. There is nothing outside of our original nature, no Buddhas or bodhisattvas or sentient beings beyond it. So here we are paying homage to the deepest part of ourselves.',
        },
        {
          id: 'line-3-yo-butsu-u-in',
          pali: 'Yo butsu u in',
          scripts: [
            {
              lang: 'ja-Jpan',
              label: 'Sino-Japanese',
              text: 'Yo butsu u in',
              tokens: ['Yo', 'butsu', 'u', 'in'],
            },
            {
              lang: 'zh-Hant',
              label: 'Hanzi',
              text: '與佛有因',
              tokens: ['與', '佛', '有', '因'],
              transliteration: 'Yo  butsu  u  in  (with-Buddha-have-cause)',
            },
          ],
          witnesses: [
            {
              by: 'AI',
              text: 'We are one with the Buddha in cause',
              alignTo: [-1, -1, -1, 0, -1, 1, -1, 3],
            },
            {
              by: 'Soto Zen',
              text: 'Forged a causal connection with Buddha',
              alignTo: [3, -1, 3, 2, 0, 1],
              url: 'https://www.sotozen.com/eng/library/glossary/individual.html?key=ten_line_kannon_sutra',
            },
            {
              by: 'Red Cedar Zen',
              text: 'Buddha is my source',
              alignTo: [1, 2, -1, 3],
              url: 'https://www.redcedarzen.org/Enmei-Jukku-Kannon-Gyo',
            },
          ],
          words: [
            { form: 'Yo', scriptAlts: { 'zh-Hant': '與' }, gloss: 'with, together with' },
            { form: 'butsu', scriptAlts: { 'zh-Hant': '佛' }, gloss: 'Buddha', accent: 'amber' },
            { form: 'u', scriptAlts: { 'zh-Hant': '有' }, gloss: 'have, exist' },
            {
              form: 'in',
              scriptAlts: { 'zh-Hant': '因' },
              gloss: '**direct cause** or **seed**, the karmic root, the inherent capacity. Distinguished from *en* (indirect cause / supporting conditions) in the next line',
              accent: 'sky',
            },
          ],
          note: 'Our original nature or true self is not some special, mystical state; it is not something external to get or develop. *It is already here.* When we take our seats in meditation and let go of everything that arises, we are left with our true self.',
        },
        {
          id: 'line-4-yo-butsu-u-en',
          pali: 'Yo butsu u en',
          scripts: [
            {
              lang: 'ja-Jpan',
              label: 'Sino-Japanese',
              text: 'Yo butsu u en',
              tokens: ['Yo', 'butsu', 'u', 'en'],
            },
            {
              lang: 'zh-Hant',
              label: 'Hanzi',
              text: '與佛有緣',
              tokens: ['與', '佛', '有', '緣'],
              transliteration: 'Yo  butsu  u  en  (with-Buddha-have-connection)',
            },
          ],
          witnesses: [
            {
              by: 'AI',
              text: 'We are one with the Buddha in karmic connection',
              alignTo: [-1, -1, -1, 0, 1, -1, 3, -1, 3],
            },
            {
              by: 'Soto Zen',
              text: 'A karmic affinity with Buddha',
              alignTo: [-1, 3, 3, 0, 1],
              url: 'https://www.sotozen.com/eng/library/glossary/individual.html?key=ten_line_kannon_sutra',
            },
            {
              by: 'Red Cedar Zen',
              text: 'Buddha is my affinity',
              alignTo: [1, 2, -1, 3],
              url: 'https://www.redcedarzen.org/Enmei-Jukku-Kannon-Gyo',
            },
          ],
          words: [
            { form: 'Yo', scriptAlts: { 'zh-Hant': '與' }, gloss: 'with' },
            { form: 'butsu', scriptAlts: { 'zh-Hant': '佛' }, gloss: 'Buddha', accent: 'amber' },
            { form: 'u', scriptAlts: { 'zh-Hant': '有' }, gloss: 'have' },
            {
              form: 'en',
              scriptAlts: { 'zh-Hant': '緣' },
              gloss: '**indirect cause** / **supporting conditions**, the sunshine and water that let the seed (*in*, line 3) sprout. Where *in* is karmic root, *en* is the relational field around it',
              accent: 'sky',
            },
          ],
          note: 'If our Buddha Nature is the *seed* (*in*, line 3), this verse acknowledges the necessity of proper *conditions* (*en*) for its growth, like sunshine and water for a plant. This points to the importance of spiritual practice and cultivation.\n\nThis creates a bridge between the *inherent* (Buddha-nature is already present) and the *cultivated* (practice is necessary to reveal it), resolving a potential contradiction in Buddhist teaching.',
        },
        {
          id: 'line-5-buppo-so-en',
          pali: 'Bup pō sō en',
          scripts: [
            {
              lang: 'ja-Jpan',
              label: 'Sino-Japanese',
              text: 'Bup pō sō en',
              tokens: ['Bup', 'pō', 'sō', 'en'],
            },
            {
              lang: 'zh-Hant',
              label: 'Hanzi',
              text: '佛法僧緣',
              tokens: ['佛', '法', '僧', '緣'],
              transliteration: 'Bup  pō  sō  en  (Buddha-Dharma-Sangha-connection)',
            },
          ],
          witnesses: [
            {
              by: 'AI',
              text: 'Connected to Buddha, Dharma, Sangha',
              alignTo: [-1, 0, 1, 2, 3],
            },
            {
              by: 'Soto Zen',
              text: 'A karmic affinity with Buddha, Dharma, and Sangha',
              alignTo: [-1, 3, 3, -1, 0, 1, -1, 2],
              url: 'https://www.sotozen.com/eng/library/glossary/individual.html?key=ten_line_kannon_sutra',
            },
            {
              by: 'Red Cedar Zen',
              text: 'Affinity with Buddha, Dharma, Sangha',
              alignTo: [3, -1, 0, 1, 2],
              url: 'https://www.redcedarzen.org/Enmei-Jukku-Kannon-Gyo',
            },
          ],
          words: [
            { form: 'Bup', scriptAlts: { 'zh-Hant': '佛' }, gloss: 'Buddha (shortened from *Butsu*)', accent: 'amber' },
            { form: 'pō', scriptAlts: { 'zh-Hant': '法' }, gloss: 'Dharma, the teaching', accent: 'sky' },
            { form: 'sō', scriptAlts: { 'zh-Hant': '僧' }, gloss: 'Sangha, the community', accent: 'rose' },
            { form: 'en', scriptAlts: { 'zh-Hant': '緣' }, gloss: 'indirect cause / connection, same character as line 4, here naming the karmic link to all Three Treasures' },
          ],
          note: 'The Three Treasures (Buddha, Dharma, Sangha) serve as both the *context* for understanding our true nature and *different expressions* of it. Awakening isn\'t an isolated individual achievement; it occurs within the field of teachings and community.',
        },
        {
          id: 'line-6-jo-raku-ga-jo',
          pali: 'Jō raku ga jō',
          scripts: [
            {
              lang: 'ja-Jpan',
              label: 'Sino-Japanese',
              text: 'Jō raku ga jō',
              tokens: ['Jō', 'raku', 'ga', 'jō'],
            },
            {
              lang: 'zh-Hant',
              label: 'Hanzi',
              text: '常樂我淨',
              tokens: ['常', '樂', '我', '淨'],
              transliteration: 'Jō  raku  ga  jō  (eternal-joy-self-pure)',
            },
          ],
          witnesses: [
            {
              by: 'AI',
              text: 'Eternity, Joy, Self, Purity',
              alignTo: [0, 1, 2, 3],
            },
            {
              by: 'Soto Zen',
              text: 'Thus attaining permanence, ease, selfhood, and purity',
              alignTo: [-1, -1, 0, 1, 2, -1, 3],
              url: 'https://www.sotozen.com/eng/library/glossary/individual.html?key=ten_line_kannon_sutra',
            },
            {
              by: 'Red Cedar Zen',
              text: 'Constancy, ease, assurance, purity',
              alignTo: [0, 1, 2, 3],
              url: 'https://www.redcedarzen.org/Enmei-Jukku-Kannon-Gyo',
            },
          ],
          words: [
            { form: 'Jō', scriptAlts: { 'zh-Hant': '常' }, gloss: 'permanent / eternal, also read as **"endless dimension"**; first of the four virtues' },
            { form: 'raku', scriptAlts: { 'zh-Hant': '樂' }, gloss: 'happiness, joy, second of the four virtues' },
            { form: 'ga', scriptAlts: { 'zh-Hant': '我' }, gloss: 'self, third virtue; the *true* self, not the ego' },
            { form: 'jō', scriptAlts: { 'zh-Hant': '淨' }, gloss: 'pure, fourth virtue. Together 常樂我淨 are the four virtues of nirvāṇa per the Mahāyāna Nirvāṇa Sūtra' },
          ],
          note: 'The four virtues (*nityatā, sukha, ātman, śuddhi*) are the Mahāyāna re-reading of nirvāṇa, contrasting with the Three Marks (impermanence, suffering, non-self) of earlier Buddhism.\n\nBut the "endless dimensions of joy" and "purity" described here are not emotional states. They are *qualities of awareness itself* when unobscured by defilements. Connects directly to the Pāli *pariyodapanaṃ* (purification of mind) in the Ovāda Pāṭimokkha: when the mind is purified, its natural qualities of joy and clarity emerge.',
        },
        {
          id: 'line-7-cho-nen-kan-ze-on',
          pali: 'Chō nen kan ze on',
          scripts: [
            {
              lang: 'ja-Jpan',
              label: 'Sino-Japanese',
              text: 'Chō nen kan ze on',
              tokens: ['Chō', 'nen', 'kan ze on'],
            },
            {
              lang: 'zh-Hant',
              label: 'Hanzi',
              text: '朝念觀世音',
              tokens: ['朝', '念', '觀世音'],
              transliteration: 'Chō  nen  kan ze on  (morning-thought-Kannon)',
            },
          ],
          witnesses: [
            {
              by: 'AI',
              text: 'Morning thought, Kanzeon',
              alignTo: [0, 1, 2],
            },
            {
              by: 'Soto Zen',
              text: 'In the morning think of Kanzeon',
              alignTo: [-1, -1, 0, 1, -1, 2],
              url: 'https://www.sotozen.com/eng/library/glossary/individual.html?key=ten_line_kannon_sutra',
            },
            {
              by: 'Red Cedar Zen',
              text: 'Morning my thought is Kanzeon',
              alignTo: [0, -1, 1, -1, 2],
              url: 'https://www.redcedarzen.org/Enmei-Jukku-Kannon-Gyo',
            },
          ],
          words: [
            { form: 'Chō', scriptAlts: { 'zh-Hant': '朝' }, gloss: 'morning, dawn' },
            { form: 'nen', scriptAlts: { 'zh-Hant': '念' }, gloss: 'mind / thought / individual consciousness, the same *nen* as Japanese *nenbutsu* (Buddha-recollection)' },
            { form: 'kan ze on', scriptAlts: { 'zh-Hant': '觀世音' }, gloss: 'Kannon / Avalokiteśvara', accent: 'rose' },
          ],
          note: 'Remember compassion as the *first* thought of the morning. The instruction is structural, let the day start there.',
        },
        {
          id: 'line-8-bo-nen-kan-ze-on',
          pali: 'Bo nen kan ze on',
          scripts: [
            {
              lang: 'ja-Jpan',
              label: 'Sino-Japanese',
              text: 'Bo nen kan ze on',
              tokens: ['Bo', 'nen', 'kan ze on'],
            },
            {
              lang: 'zh-Hant',
              label: 'Hanzi',
              text: '暮念觀世音',
              tokens: ['暮', '念', '觀世音'],
              transliteration: 'Bo  nen  kan ze on  (evening-thought-Kannon)',
            },
          ],
          witnesses: [
            {
              by: 'AI',
              text: 'Evening thought, Kanzeon',
              alignTo: [0, 1, 2],
            },
            {
              by: 'Soto Zen',
              text: 'In the evening think of Kanzeon',
              alignTo: [-1, -1, 0, 1, -1, 2],
              url: 'https://www.sotozen.com/eng/library/glossary/individual.html?key=ten_line_kannon_sutra',
            },
            {
              by: 'Red Cedar Zen',
              text: 'Evening my thought is Kanzeon',
              alignTo: [0, -1, 1, -1, 2],
              url: 'https://www.redcedarzen.org/Enmei-Jukku-Kannon-Gyo',
            },
          ],
          words: [
            { form: 'Bo', scriptAlts: { 'zh-Hant': '暮' }, gloss: 'evening, dusk, paired with *chō* (morning) in lines 7-8 to mark "always, all day"' },
            { form: 'nen', scriptAlts: { 'zh-Hant': '念' }, gloss: 'mind / thought / individual consciousness' },
            { form: 'kan ze on', scriptAlts: { 'zh-Hant': '觀世音' }, gloss: 'Kannon / Avalokiteśvara', accent: 'rose' },
          ],
          note: 'The pair (morning + evening) creates a *complete daily practice structure*: begin and end with Kannon. The middle takes care of itself.',
        },
        {
          id: 'line-9-nen-nen-ju-shin-ki',
          pali: 'Nen nen jū shin ki',
          scripts: [
            {
              lang: 'ja-Jpan',
              label: 'Sino-Japanese',
              text: 'Nen nen jū shin ki',
              tokens: ['Nen nen', 'jū', 'shin', 'ki'],
            },
            {
              lang: 'zh-Hant',
              label: 'Hanzi',
              text: '念念從心起',
              tokens: ['念念', '從', '心', '起'],
              transliteration: 'Nen nen  jū  shin  ki  (thought-after-thought  from  mind  arise)',
            },
          ],
          witnesses: [
            {
              by: 'AI',
              text: 'Thought after thought arises in the heart-mind',
              alignTo: [0, 0, 0, 3, -1, -1, 2],
            },
            {
              by: 'Soto Zen',
              text: 'Thought after thought arises from mind',
              alignTo: [0, 0, 0, 3, 1, 2],
              url: 'https://www.sotozen.com/eng/library/glossary/individual.html?key=ten_line_kannon_sutra',
            },
            {
              by: 'Red Cedar Zen',
              text: 'Thought after thought arises in the mind',
              alignTo: [0, 0, 0, 3, -1, -1, 2],
              url: 'https://www.redcedarzen.org/Enmei-Jukku-Kannon-Gyo',
            },
          ],
          words: [
            { form: 'Nen nen', scriptAlts: { 'zh-Hant': '念念' }, gloss: 'thought after thought, reduplication intensifies; "moment by moment". The *small-mind* / conditioned [[saṃskāra]] formations of consciousness' },
            { form: 'jū', scriptAlts: { 'zh-Hant': '從' }, gloss: 'follow, follow-from, each thought succeeds the previous' },
            { form: 'shin', scriptAlts: { 'zh-Hant': '心' }, gloss: '**big mind**, the heart-mind, *cittam* in Sanskrit, the same *xīn / shin* as in *Hṛdaya* Sūtra (Heart Sutra). The unconditioned awareness from which thoughts arise', accent: 'sky' },
            { form: 'ki', scriptAlts: { 'zh-Hant': '起' }, gloss: 'arise / rise up. Some readings give 機 (*ki* = "opportunity / mechanism"): "each thought is an opportunity of the mind"' },
          ],
          note: 'A teaching on the **non-dual relationship between conditioned thought (small mind) and unconditioned awareness (big mind)**.\n\n*"Each thought following the preceding thought is big mind."* Our ordinary thinking isn\'t separate from Buddha-nature. It *is* Buddha-nature\'s expression. The [[saṃskāra]] of mental formations and the *citta* of awareness aren\'t two things.',
        },
        {
          id: 'line-10-nen-nen-fu-ri-shin',
          pali: 'Nen nen fu ri shin',
          scripts: [
            {
              lang: 'ja-Jpan',
              label: 'Sino-Japanese',
              text: 'Nen nen fu ri shin',
              tokens: ['Nen nen', 'fu', 'ri', 'shin'],
            },
            {
              lang: 'zh-Hant',
              label: 'Hanzi',
              text: '念念不離心',
              tokens: ['念念', '不', '離', '心'],
              transliteration: 'Nen nen  fu  ri  shin  (thought-after-thought  not  separate-from  mind)',
            },
          ],
          witnesses: [
            {
              by: 'AI',
              text: 'Thought after thought, not separate from the heart-mind',
              alignTo: [0, 0, 0, 1, 2, -1, -1, 3],
            },
            {
              by: 'Soto Zen',
              text: 'Thought after thought is not separate from mind',
              alignTo: [0, 0, 0, -1, 1, 2, -1, 3],
              url: 'https://www.sotozen.com/eng/library/glossary/individual.html?key=ten_line_kannon_sutra',
            },
            {
              by: 'Red Cedar Zen',
              text: 'Thought after thought is not separate from mind',
              alignTo: [0, 0, 0, -1, 1, 2, -1, 3],
              url: 'https://www.redcedarzen.org/Enmei-Jukku-Kannon-Gyo',
            },
          ],
          words: [
            { form: 'Nen nen', scriptAlts: { 'zh-Hant': '念念' }, gloss: 'thought after thought' },
            { form: 'fu', scriptAlts: { 'zh-Hant': '不' }, gloss: 'not, negation' },
            { form: 'ri', scriptAlts: { 'zh-Hant': '離' }, gloss: 'separate, depart. Together *fu ri* = "not separate"' },
            { form: 'shin', scriptAlts: { 'zh-Hant': '心' }, gloss: 'big-mind / heart-mind', accent: 'sky' },
          ],
          note: 'The chant\'s pivot: thoughts arise *from* the big-mind (line 9), and never leave it (line 10). *"Thought after thought arises from big mind; our thoughts are not separate from big mind."* The same non-dual reality, said twice from two angles.\n\nThe heart-mind isn\'t something we have or don\'t have; every thought is already its expression. Kanzeon, the bodhisattva of compassion, is not separate from us, because our thinking is not separate from the heart that is also hers.',
        },
      ],
      commentary:
        'Hakuin Ekaku taught this chant widely in 18th-century Japan. The "ten phrases for prolonging life" framing comes from the legend that recitation extends a chanter\'s lifespan, but the operative work is the binding of every thought to compassion, morning and evening, moment after moment.',
    },
  ],
};

export default enmeiJikkuKannonGyo;

/**
 * En-mei Jikku Kan-non Gyō — Bodhi Sangha rendering.
 *
 * The "Ten-Phrase Life-Prolonging Kannon Sutra". Same source text as
 * MAPLE's version (the canonical Sino-Japanese Sōtō / Rinzai Zen
 * formula), with Bodhi Sangha's own English. The Bodhi rendering reads
 * the relationship between the chanter and Kannon as direct identity:
 * "I'm one with the Awaken'd One" / "I'm bound" — closer to Hakuin's
 * teacher Tōrei's gloss than to Sōtō Zen Center's "salutation" style.
 *
 * Source: Bodhi Sangha Sutras booklet (May 2016), p.4.
 */

import type { CommunityChant } from '../../types/liturgy';
import { ungroundedCitation } from './_groundingHelpers';

export const bodhiEnmeiJikkuKannonGyo: CommunityChant = {
  // Same chant as MAPLE's (contentId), so English witnesses pool across both
  // — a Bodhi reader can cycle MAPLE's Literal/Soto/Red Cedar renderings, but
  // Bodhi's own reading leads. See docs/sutta-studio/COMMUNITY_CHANT_MODEL.md.
  contentId: 'enmei-jikku-kannon-gyo',
  defaultWitnessBy: 'Bodhi Sangha',
  slug: 'enmei-jikku-kannon-gyo',
  sangha: 'bodhi-sangha',
  order: 4,
  title: 'En-mei Jikku Kan-non Gyō',
  subtitle: 'Ten-Phrase Life-Prolonging Kannon Sutra (延命十句觀音經)',
  tradition: 'zen',
  context: 'Ten short phrases invoking Kanzeon (Avalokiteśvara), in Sino-Japanese. The same chant as MAPLE\'s, with Bodhi Sangha\'s English rendering.',
  sources: {
    canonical: [
      { label: 'En-mei Jikku Kannon Gyō (延命十句觀音經)', url: 'https://en.wikipedia.org/wiki/Ten_Verse_Kannon_Sutra_for_Timeless_Life' },
    ],
    ritual: [
      { label: 'Bodhi Sangha Sutras booklet (May 2016), p.4' },
    ],
  },
  curator:
    'Curation by Aditya. Sino-Japanese + Hanzi are the canonical text shared with MAPLE\'s version. The Bodhi English is transcribed from the booklet. The final line ("Thought after thought not separate from…") was partially obscured on the source page; "the heart" follows the booklet\'s parallel use of "heart" in the previous phrase. Where the booklet uses *Awaken\'d One* it follows Tōrei Zenji\'s Rinzai reading of *butsu* as personal address rather than impersonal noun.',
  sections: [
    {
      id: 'ten-phrases',
      shape: 'triple-script-witness',
      large: true,
      segments: [
        {
          id: 'kanzeon',
          phraseId: 'kan-ze-on',
          pali: 'Kan-ze-on',
          scripts: [
            { lang: 'ja-Jpan', label: 'Sino-Japanese', text: 'Kan-ze-on', tokens: ['Kan', 'ze', 'on'] },
            { lang: 'zh-Hant', label: 'Hanzi', text: '觀世音', tokens: ['觀', '世', '音'], transliteration: 'Kan ze on  (guān shì yīn in Mandarin)' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'Kanzeon!',
              alignTo: [0],
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'Kan', scriptAlts: { 'zh-Hant': '觀' }, gloss: 'To observe, contemplate, perceive. The bodhisattva\'s mode of attention.', accent: 'sky' },
            { form: 'ze', scriptAlts: { 'zh-Hant': '世' }, gloss: 'World, generation, age. The field she attends to.', accent: 'amber' },
            { form: 'on', scriptAlts: { 'zh-Hant': '音' }, gloss: 'Sound, voice, cry. Together: "the one who perceives the cries of the world" — Avalokiteśvara as compassion that hears.', accent: 'rose' },
          ],
        },
        {
          id: 'namu-butsu',
          phraseId: 'namu-butsu',
          pali: 'Na-mu but-su',
          scripts: [
            { lang: 'ja-Jpan', label: 'Sino-Japanese', text: 'Na-mu but-su', tokens: ['Na-mu', 'but-su'] },
            { lang: 'zh-Hant', label: 'Hanzi', text: '南無佛', tokens: ['南無', '佛'], transliteration: 'Na-mu  but-su  (ná mó fó in Mandarin)' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'Salutation to the Awaken\'d One!',
              alignTo: [0, -1, -1, 1, 1],
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'Na-mu', scriptAlts: { 'zh-Hant': '南無' }, gloss: 'Transliteration of Sanskrit *namo* — "homage, I bow to". The opening phrase is the same homage word as the Pali *Namo Tassa*.', accent: 'amber' },
            { form: 'but-su', scriptAlts: { 'zh-Hant': '佛' }, gloss: 'Buddha. *佛* phonetic loan for *buddha*; in Bodhi\'s rendering, *the Awaken\'d One* — personal, not impersonal.', accent: 'sky' },
          ],
        },
        {
          id: 'yo-butsu-u-in',
          phraseId: 'yo-butsu-u-in',
          pali: 'yo but-su u in',
          scripts: [
            { lang: 'ja-Jpan', label: 'Sino-Japanese', text: 'yo but-su u in', tokens: ['yo', 'but-su', 'u', 'in'] },
            { lang: 'zh-Hant', label: 'Hanzi', text: '與佛有因', tokens: ['與', '佛', '有', '因'], transliteration: 'yo  but-su  u  in  (yǔ fó yǒu yīn)' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'With the Awaken\'d One I\'m one in cause,',
              alignTo: [0, -1, 1, 1, -1, -1, 0, 3],
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'yo', scriptAlts: { 'zh-Hant': '與' }, gloss: 'With, together with. The chanter and Kannon enter shared ground.' },
            { form: 'but-su', scriptAlts: { 'zh-Hant': '佛' }, gloss: 'Buddha — here functioning as the addressed one.', accent: 'sky' },
            { form: 'u', scriptAlts: { 'zh-Hant': '有' }, gloss: 'To have, possess. The chanter holds something in common with the Buddha.' },
            { form: 'in', scriptAlts: { 'zh-Hant': '因' }, gloss: 'Cause, primary condition. The first member of the *yīn-yuán* (cause-effect) pair that structures the next two lines.', accent: 'rose' },
          ],
        },
        {
          id: 'yo-butsu-u-en',
          phraseId: 'yo-butsu-u-en',
          pali: 'yo but-su u en',
          scripts: [
            { lang: 'ja-Jpan', label: 'Sino-Japanese', text: 'yo but-su u en', tokens: ['yo', 'but-su', 'u', 'en'] },
            { lang: 'zh-Hant', label: 'Hanzi', text: '與佛有緣', tokens: ['與', '佛', '有', '緣'], transliteration: 'yo  but-su  u  en  (yǔ fó yǒu yuán)' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'In the Awaken\'d One I\'m one with effect,',
              alignTo: [0, -1, 1, 1, -1, -1, 0, 3],
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'yo', scriptAlts: { 'zh-Hant': '與' }, gloss: 'With.' },
            { form: 'but-su', scriptAlts: { 'zh-Hant': '佛' }, gloss: 'Buddha.', accent: 'sky' },
            { form: 'u', scriptAlts: { 'zh-Hant': '有' }, gloss: 'Have.' },
            { form: 'en', scriptAlts: { 'zh-Hant': '緣' }, gloss: 'Conditioning circumstance, *pratyaya*. The second member of *yīn-yuán* — the supporting condition that brings cause to fruition. Bodhi reads it as "effect" — the same relational pole.', accent: 'rose' },
          ],
        },
        {
          id: 'buppo-so-en',
          phraseId: 'buppo-so-en',
          pali: 'bup-pō sō en',
          scripts: [
            { lang: 'ja-Jpan', label: 'Sino-Japanese', text: 'bup-pō sō en', tokens: ['bup-pō', 'sō', 'en'] },
            { lang: 'zh-Hant', label: 'Hanzi', text: '佛法僧緣', tokens: ['佛', '法', '僧', '緣'], transliteration: 'bup-pō  sō  en  (fó fǎ sēng yuán)' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'With the Awaken\'d One, Dharma and Sangha I\'m bound;',
              alignTo: [-1, 0, 0, 0, 0, 1, 1, -1, 2],
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'bup-pō', scriptAlts: { 'zh-Hant': '佛' }, gloss: 'Buddha — though here the Hanzi compounds bup ("Buddha") + pō ("Dharma") in the next character. The booklet reading collapses them.', accent: 'sky' },
            { form: 'sō', scriptAlts: { 'zh-Hant': '僧' }, gloss: 'Saṅgha — community of practitioners. *僧* is the Chinese phonetic loan for Sanskrit *saṃgha*.', accent: 'rose' },
            { form: 'en', scriptAlts: { 'zh-Hant': '緣' }, gloss: 'Conditioning bond. The chanter binds to all three jewels through karmic *yuán*.' },
          ],
        },
        {
          id: 'joraku-gajo',
          phraseId: 'joraku-gajo',
          pali: 'jō-raku ga jō',
          scripts: [
            { lang: 'ja-Jpan', label: 'Sino-Japanese', text: 'jō-raku ga jō', tokens: ['jō', 'raku', 'ga', 'jō'] },
            { lang: 'zh-Hant', label: 'Hanzi', text: '常樂我淨', tokens: ['常', '樂', '我', '淨'], transliteration: 'jō raku ga jō  (cháng lè wǒ jìng)' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'Eternal, Joyous, Pure.',
              alignTo: [0, 1, 3],
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'jō', scriptAlts: { 'zh-Hant': '常' }, gloss: 'Eternal, constant, permanent. The first of the *Four Inverted Views* turned right: where ordinary mind sees impermanence as suffering, awakening sees the unchanging.', accent: 'sky' },
            { form: 'raku', scriptAlts: { 'zh-Hant': '樂' }, gloss: 'Joyous, blissful. The opposite of the *dukkha* that drives ordinary samsāra; in awakening, *raku*.', accent: 'amber' },
            { form: 'ga', scriptAlts: { 'zh-Hant': '我' }, gloss: '"Self" — but in this Mahāyāna context, the True Self (大我, dai-ga), not the *anātman* ego.' },
            { form: 'jō', scriptAlts: { 'zh-Hant': '淨' }, gloss: 'Pure. Different character from the first *jō* (常); here *淨* = "clean, purified".', accent: 'rose' },
          ],
          note: 'The Four Virtues of Nirvāṇa from the *Mahāparinirvāṇa Sūtra* — eternal, joyous, *self* (paradoxically), pure. Bodhi\'s booklet omits the third (*ga*) in English; the trio "Eternal, Joyous, Pure" is the standard contracted form.',
        },
        {
          id: 'cho-nen-kanzeon',
          phraseId: 'cho-nen-kanzeon',
          pali: 'chō nen kan-ze-on',
          scripts: [
            { lang: 'ja-Jpan', label: 'Sino-Japanese', text: 'chō nen kan-ze-on', tokens: ['chō', 'nen', 'kan-ze-on'] },
            { lang: 'zh-Hant', label: 'Hanzi', text: '朝念觀世音', tokens: ['朝', '念', '觀世音'], transliteration: 'chō  nen  kan-ze-on  (zhāo niàn guān shì yīn)' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'Mornings my thought is Kanzeon.',
              alignTo: [0, -1, 1, -1, 2],
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'chō', scriptAlts: { 'zh-Hant': '朝' }, gloss: 'Morning, dawn. Same character as in *chōkō* (morning chanting).', accent: 'sky' },
            { form: 'nen', scriptAlts: { 'zh-Hant': '念' }, gloss: 'Thought, mindful attention, recollection. *念* is the same character used for *mindfulness* in *sati* / *smṛti*.', accent: 'amber' },
            { form: 'kan-ze-on', scriptAlts: { 'zh-Hant': '觀世音' }, gloss: 'Avalokiteśvara, bodhisattva of compassion. The object of recollection.', accent: 'rose' },
          ],
        },
        {
          id: 'bo-nen-kanzeon',
          phraseId: 'bo-nen-kanzeon',
          pali: 'bō nen kan-ze-on',
          scripts: [
            { lang: 'ja-Jpan', label: 'Sino-Japanese', text: 'bō nen kan-ze-on', tokens: ['bō', 'nen', 'kan-ze-on'] },
            { lang: 'zh-Hant', label: 'Hanzi', text: '暮念觀世音', tokens: ['暮', '念', '觀世音'], transliteration: 'bō  nen  kan-ze-on  (mù niàn guān shì yīn)' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'Evenings my thought is Kanzeon.',
              alignTo: [0, -1, 1, -1, 2],
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'bō', scriptAlts: { 'zh-Hant': '暮' }, gloss: 'Evening, twilight. Pair to *chō* — the practice spans the whole day.', accent: 'sky' },
            { form: 'nen', scriptAlts: { 'zh-Hant': '念' }, gloss: 'Mindful recollection.', accent: 'amber' },
            { form: 'kan-ze-on', scriptAlts: { 'zh-Hant': '觀世音' }, gloss: 'Avalokiteśvara.', accent: 'rose' },
          ],
        },
        {
          id: 'nen-nen-ju-shin-ki',
          phraseId: 'nen-nen-ju-shin-ki',
          pali: 'nen nen jū shin ki',
          scripts: [
            { lang: 'ja-Jpan', label: 'Sino-Japanese', text: 'nen nen jū shin ki', tokens: ['nen', 'nen', 'jū', 'shin', 'ki'] },
            { lang: 'zh-Hant', label: 'Hanzi', text: '念念從心起', tokens: ['念', '念', '從', '心', '起'], transliteration: 'nen  nen  jū  shin  ki  (niàn niàn cóng xīn qǐ)' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'Thought after thought arises in the heart;',
              alignTo: [0, -1, 1, 4, -1, -1, 3],
              license: 'Bodhi Sangha booklet',
            },
          ],
          words: [
            { form: 'nen', scriptAlts: { 'zh-Hant': '念' }, gloss: 'Thought, moment-of-attention. Repeated to mark continuous mental flow.', accent: 'amber' },
            { form: 'jū', scriptAlts: { 'zh-Hant': '從' }, gloss: 'From, out of. The grammatical particle holding the next two characters in relation.' },
            { form: 'shin', scriptAlts: { 'zh-Hant': '心' }, gloss: 'Heart, mind. The Mahāyāna *citta* — the source from which thoughts arise. Bodhi\'s "heart" preserves the affective register.', accent: 'rose' },
            { form: 'ki', scriptAlts: { 'zh-Hant': '起' }, gloss: 'To arise, originate. Completes the line: *nen-nen* (thought after thought) *jū* (from) *shin* (the heart) *ki* (arises).' },
          ],
        },
        {
          id: 'nen-nen-fu-ri-shin',
          phraseId: 'nen-nen-fu-ri-shin',
          pali: 'nen nen fu ri shin',
          scripts: [
            { lang: 'ja-Jpan', label: 'Sino-Japanese', text: 'nen nen fu ri shin', tokens: ['nen', 'nen', 'fu', 'ri', 'shin'] },
            { lang: 'zh-Hant', label: 'Hanzi', text: '念念不離心', tokens: ['念', '念', '不', '離', '心'], transliteration: 'nen  nen  fu  ri  shin  (niàn niàn bù lí xīn)' },
          ],
          witnesses: [
            {
              by: 'Bodhi Sangha',
              text: 'Thought after thought not separate from the heart.',
              alignTo: [0, -1, 1, 2, 3, -1, -1, 4],
              license: 'Bodhi Sangha booklet',
              // booklet end-of-line obscured on source; "the heart" parallels prior phrase
            },
          ],
          words: [
            { form: 'nen', scriptAlts: { 'zh-Hant': '念' }, gloss: 'Thought, moment-of-attention.', accent: 'amber' },
            { form: 'fu', scriptAlts: { 'zh-Hant': '不' }, gloss: 'Not. Negation particle.' },
            { form: 'ri', scriptAlts: { 'zh-Hant': '離' }, gloss: 'To separate, leave, depart.' },
            { form: 'shin', scriptAlts: { 'zh-Hant': '心' }, gloss: 'Heart, mind. The same *shin* the previous line names as origin — now named as inseparable.', accent: 'rose', citations: [ungroundedCitation('booklet text obscured at end of line; "from the heart" inferred from parallelism with previous line')] },
          ],
          note: 'The pair (line 9 + 10) is the chant\'s contemplative summary: every thought arises from the heart, and no thought is ever apart from the heart. The doubling *nen-nen* lets the mind notice itself thinking.',
        },
      ],
      commentary:
        'Bodhi Sangha\'s rendering of the En-mei Jikku Kannon Gyō reads the relationship between chanter and Kannon as direct, personal, and binding: *I\'m one in cause* / *one with effect* / *I\'m bound*. The first-person contraction softens the formal Sino-Japanese into something the chanter speaks rather than recites. The Awaken\'d One spelling (with the elided *e*) preserves the booklet\'s nineteenth-century English flavor — likely passed down from Reverend D.T. Suzuki\'s era of Zen translation.',
    },
  ],
};

export default bodhiEnmeiJikkuKannonGyo;

/**
 * Bodhicitta Dedication — four-line Tibetan dedication chanted 3×.
 *
 * "byang chub sems mchog rin po che / ma skyes pa rnams skye gyur cig /
 *  skyes pa nyams pa med pa yang / gong nas gong du 'phel bar shog"
 *
 * "May supreme and precious bodhicitta arise where it has not yet arisen.
 *  Where it has arisen, may it never decline but increase forever more."
 *
 * Canonical Tibetan bodhicitta-aspiration verse, recited across lineages
 * (Kagyu, Gelug, Nyingma, Sakya). Chanted at MAPLE 3× as a dedication
 * after practice.
 *
 * Curation note: the chant is pre-Sanskrit (composed in Tibetan, not
 * translated from Sanskrit). Primary script is bo-Latn (phonetic) since
 * that's what most chanters read from; the Tibetan-script form is the
 * second script. Per-syllable scriptMorphemes on bo-Tibt let the user
 * decompose each Tibetan compound into its native semantic morphemes
 * (byang "purified" + chub "perfected" = bodhi/awakening; sems mchog =
 * "supreme mind" = bodhicitta; rin po che = "precious one" = rinpoche).
 */

import type { LiturgyDoc } from '../../types/liturgy';
import { wikipediaCitation, ungroundedCitation } from './_groundingHelpers';

export const bodhicittaDedication: LiturgyDoc = {
  slug: 'bodhicitta-dedication',
  sangha: 'maple',
  frequency: 'weekly',
  time: 'Sunday night, before Monday self-practice day',
  title: 'Bodhicitta Dedication',
  subtitle: 'May supreme and precious bodhicitta arise…',
  tradition: 'vajrayana',
  context: 'Recited 3× at MAPLE on Sunday nights, before Monday — the free self-practice day. Not part of the daily morning service.',
  sources: {
    canonical: [
      {
        label: 'Tibetan bodhicitta-aspiration verse (pan-lineage)',
        url: 'https://en.wikipedia.org/wiki/Bodhicitta',
      },
    ],
    ritual: [
      { label: 'MAPLE practice sheet' },
    ],
  },
  curator:
    'Curation by Aditya. Tibetan phonetic transliteration follows the MAPLE practice sheet (Lhasa-pronunciation style). Tibetan-script form as commonly attested across Tibetan lineages.',
  sections: [
    {
      id: 'framing',
      shape: 'prose-commentary',
      body: 'A four-line Tibetan dedication, recited three times. The aspiration is that [[bodhicitta]] — the heart-mind of awakening, the determination to attain Buddhahood for the sake of all beings — arises in those in whom it has not yet awakened, and in those in whom it has, continues to grow without decline.\n\nThe verse appears across Tibetan lineages (Kagyu, Gelug, Nyingma, Sakya) as a standard dedication formula. Unlike most chants in this reader, it was composed *in Tibetan* — not translated from Sanskrit — so the primary script is the Tibetan phonetic (what chanters read from), with the Tibetan script as the second script.',
    },
    {
      id: 'dedication',
      shape: 'triple-script-witness',
      repetitions: 3,
      segments: [
        // Line 1: chang chub sem chok rin po ché → May supreme and precious bodhicitta
        {
          id: 'line-1',
          pali: 'chang chub sem chok rin po ché',
          scripts: [
            {
              lang: 'bo-Latn',
              label: 'Tibetan (phonetic)',
              text: 'chang chub sem chok rin po ché',
              tokens: ['chang chub', 'sem', 'chok', 'rin po ché'],
            },
            {
              lang: 'bo-Tibt',
              label: 'Tibetan (Uchen)',
              text: 'བྱང་ཆུབ་སེམས་མཆོག་རིན་པོ་ཆེ།',
              tokens: ['བྱང་ཆུབ', 'སེམས', 'མཆོག', 'རིན་པོ་ཆེ'],
              transliteration: 'chang chub  sem  chok  rin po ché',
            },
          ],
          witnesses: [
            // Tokens hint groups bo-Latn into 4 conceptual units; alignTo
            // values reference those 4 token positions, not the 7
            // whitespace-words. The audit's paliWordCount upper bound (7)
            // is still satisfied.
            // English: May(0) supreme(1) and(2) precious(3) bodhicitta(4)
            // → 5 tokens
            {
              by: 'MAPLE',
              text: 'May supreme and precious bodhicitta',
              alignTo: [-1, 2, -1, 3, 0],
            },
          ],
          words: [
            {
              form: 'chang chub',
              scriptAlts: { 'bo-Tibt': 'བྱང་ཆུབ' },
              etymology: 'Tibetan calque of Sanskrit *bodhi* ("awakening")',
              gloss: 'awakening (bodhi) — literally "purified-perfected"',
              accent: 'amber',
              scriptMorphemes: {
                'bo-Tibt': [
                  { text: 'བྱང་', type: 'semantic', pronunciation: 'byang', gloss: 'purified, cleansed' },
                  { text: 'ཆུབ', type: 'semantic', pronunciation: 'chub', gloss: 'perfected, complete — together = *bodhi* (awakening)' },
                ],
              },
              citations: [wikipediaCitation('Bodhi')],
            },
            {
              form: 'sem',
              scriptAlts: { 'bo-Tibt': 'སེམས' },
              etymology: 'Tibetan *sems* — calque of Sanskrit *citta*',
              gloss: 'mind (citta) — together with *chang chub* = bodhicitta (the heart-mind of awakening)',
              accent: 'rose',
            },
            {
              form: 'chok',
              scriptAlts: { 'bo-Tibt': 'མཆོག' },
              etymology: 'Tibetan *mchog* — "supreme, foremost"',
              gloss: 'supreme — qualifying bodhicitta as the supreme aspiration',
            },
            {
              form: 'rin po ché',
              scriptAlts: { 'bo-Tibt': 'རིན་པོ་ཆེ' },
              etymology: 'Tibetan *rin po che* — the famous title "rinpoche"',
              gloss: 'precious one — literally "great-precious"; same word used as honorific for revered teachers',
              accent: 'sky',
              scriptMorphemes: {
                'bo-Tibt': [
                  { text: 'རིན་', type: 'semantic', pronunciation: 'rin', gloss: 'value, worth, price' },
                  { text: 'པོ་', type: 'semantic', pronunciation: 'po', gloss: 'nominal/honorific suffix' },
                  { text: 'ཆེ', type: 'semantic', pronunciation: 'ché', gloss: 'great — together: "the great-valuable one" = "precious"' },
                ],
              },
            },
          ],
        },

        // Line 2: ma kyé pa nam kyé gyur chik → Arise where it has not yet arisen
        {
          id: 'line-2',
          pali: 'ma kyé pa nam kyé gyur chik',
          scripts: [
            {
              lang: 'bo-Latn',
              label: 'Tibetan (phonetic)',
              text: 'ma kyé pa nam kyé gyur chik',
              tokens: ['ma', 'kyé pa', 'nam', 'kyé', 'gyur', 'chik'],
            },
            {
              lang: 'bo-Tibt',
              label: 'Tibetan (Uchen)',
              text: 'མ་སྐྱེས་པ་རྣམས་སྐྱེ་གྱུར་ཅིག།',
              tokens: ['མ', 'སྐྱེས་པ', 'རྣམས', 'སྐྱེ', 'གྱུར', 'ཅིག'],
              transliteration: 'ma  kyé pa  nam  kyé  gyur  chik',
            },
          ],
          witnesses: [
            // English: Arise(0) where(1) it(2) has(3) not(4) yet(5) arisen(6) → 7 tokens
            {
              by: 'MAPLE',
              text: 'Arise where it has not yet arisen',
              alignTo: [3, -1, -1, -1, 0, -1, 1],
            },
          ],
          words: [
            {
              form: 'ma',
              scriptAlts: { 'bo-Tibt': 'མ' },
              etymology: 'Tibetan negation particle',
              gloss: 'not — prefixed negator (parallel to Sanskrit *a-*)',
            },
            {
              form: 'kyé pa',
              scriptAlts: { 'bo-Tibt': 'སྐྱེས་པ' },
              etymology: 'Tibetan *skyes pa* — past participle of *skye* "arise"',
              gloss: 'having arisen, the arisen one — together with *ma* = "not-arisen"',
            },
            {
              form: 'nam',
              scriptAlts: { 'bo-Tibt': 'རྣམས' },
              etymology: 'Tibetan plural marker',
              gloss: 'plural marker — "the [unarisen] ones, those in whom it has not arisen"',
            },
            {
              form: 'kyé',
              scriptAlts: { 'bo-Tibt': 'སྐྱེ' },
              etymology: 'Tibetan *skye* — "to arise, to be born"',
              gloss: 'arise — present-stem; what we want bodhicitta to do',
              accent: 'emerald',
            },
            {
              form: 'gyur',
              scriptAlts: { 'bo-Tibt': 'གྱུར' },
              etymology: 'Tibetan *gyur* — "become" (auxiliary)',
              gloss: 'become — together with *skye* = "become arisen" = "may [it] arise"',
            },
            {
              form: 'chik',
              scriptAlts: { 'bo-Tibt': 'ཅིག' },
              etymology: 'Tibetan imperative particle',
              gloss: 'imperative particle — "may [it]" / "let [it]"',
            },
          ],
        },

        // Line 3: kyé pa nyam pa me pa yang → Where it has arisen, may it never decline
        {
          id: 'line-3',
          pali: 'kyé pa nyam pa me pa yang',
          scripts: [
            {
              lang: 'bo-Latn',
              label: 'Tibetan (phonetic)',
              text: 'kyé pa nyam pa me pa yang',
              tokens: ['kyé pa', 'nyam pa', 'me pa', 'yang'],
            },
            {
              lang: 'bo-Tibt',
              label: 'Tibetan (Uchen)',
              text: 'སྐྱེས་པ་ཉམས་པ་མེད་པ་ཡང།',
              tokens: ['སྐྱེས་པ', 'ཉམས་པ', 'མེད་པ', 'ཡང'],
              transliteration: 'kyé pa  nyam pa  me pa  yang',
            },
          ],
          witnesses: [
            // English: Where(0) it(1) has(2) arisen,(3) may(4) it(5) never(6) decline(7) → 8 tokens
            {
              by: 'MAPLE',
              text: 'Where it has arisen, may it never decline',
              alignTo: [-1, -1, -1, 0, -1, -1, 2, 1],
            },
          ],
          words: [
            {
              form: 'kyé pa',
              scriptAlts: { 'bo-Tibt': 'སྐྱེས་པ' },
              gloss: 'the arisen — same form as in line 2, but here positive (no *ma* before it)',
            },
            {
              form: 'nyam pa',
              scriptAlts: { 'bo-Tibt': 'ཉམས་པ' },
              etymology: 'Tibetan *nyams pa* — "to decline, deteriorate"',
              gloss: 'decline, deteriorate — what we want bodhicitta NOT to do',
            },
            {
              form: 'me pa',
              scriptAlts: { 'bo-Tibt': 'མེད་པ' },
              etymology: 'Tibetan *med pa* — "non-existence" / negation of existence',
              gloss: 'not exist — together with *nyam pa* = "decline-not-existing" = "without decline"',
            },
            {
              form: 'yang',
              scriptAlts: { 'bo-Tibt': 'ཡང' },
              etymology: 'Tibetan *yang* — "and, also, moreover"',
              gloss: 'and / moreover — connecting line 3 to line 4',
            },
          ],
        },

        // Line 4: gong né gong du phel war shok → But increase forever more
        {
          id: 'line-4',
          pali: 'gong né gong du phel war shok',
          scripts: [
            {
              lang: 'bo-Latn',
              label: 'Tibetan (phonetic)',
              text: 'gong né gong du phel war shok',
              tokens: ['gong', 'né', 'gong', 'du', 'phel', 'war', 'shok'],
            },
            {
              lang: 'bo-Tibt',
              label: 'Tibetan (Uchen)',
              text: 'གོང་ནས་གོང་དུ་འཕེལ་བར་ཤོག།',
              tokens: ['གོང', 'ནས', 'གོང', 'དུ', 'འཕེལ', 'བར', 'ཤོག'],
              transliteration: 'gong  né  gong  du  phel  war  shok',
            },
          ],
          witnesses: [
            // English: But(0) increase(1) forever(2) more(3) → 4 tokens
            // (Tight English; the Tibetan "gong né gong du" = "from-higher-to-higher" is idiomatic for "ever-increasing")
            {
              by: 'MAPLE',
              text: 'But increase forever more',
              alignTo: [-1, 4, 0, 2],
            },
          ],
          words: [
            {
              form: 'gong',
              scriptAlts: { 'bo-Tibt': 'གོང' },
              etymology: 'Tibetan *gong* — "higher, above"',
              gloss: 'higher, above — appears twice in *gong né gong du* = "from-higher to-higher"',
            },
            {
              form: 'né',
              scriptAlts: { 'bo-Tibt': 'ནས' },
              etymology: 'Tibetan ablative particle *nas* — "from"',
              gloss: 'from — *gong né* = "from higher"',
            },
            {
              form: 'du',
              scriptAlts: { 'bo-Tibt': 'དུ' },
              etymology: 'Tibetan directional particle',
              gloss: 'to — *gong du* = "to higher"; idiom *gong né gong du* = "ever onward, ever-increasing"',
            },
            {
              form: 'phel',
              scriptAlts: { 'bo-Tibt': 'འཕེལ' },
              etymology: "Tibetan *'phel* — \"increase, grow, spread\"",
              gloss: 'increase, spread, grow — the verb of the aspiration',
              accent: 'emerald',
            },
            {
              form: 'war',
              scriptAlts: { 'bo-Tibt': 'བར' },
              etymology: 'Tibetan *bar* — connecting/relativising particle',
              gloss: 'that, until — links the verb to the imperative *shok*',
            },
            {
              form: 'shok',
              scriptAlts: { 'bo-Tibt': 'ཤོག' },
              etymology: 'Tibetan imperative particle — "may [it]"',
              gloss: 'may [it] — imperative; the dedication\'s final wish',
              accent: 'violet',
            },
          ],
        },
      ],
      commentary:
        'The verse is structured as a chiasmus across the four lines: line 1 names the object (bodhicitta), line 2 asks for it to arise in those without, line 3 asks it not decline in those with, line 4 asks it to increase. Recited 3× as the standard dedication formula.',
    },
  ],
};

export default bodhicittaDedication;

/**
 * Three Pure Precepts — Sariputta Ambedkar Monastery.
 *
 * On the monastery's chant sheet this heading sits over the Pali Ovāda
 * Pāṭimokkha verse (Dhammapada 183 / Dīgha Nikāya 14): *Sabba pāpassa
 * akaraṇaṃ, kusalassa upasampadā, sacittapariyodapanaṃ, etaṃ Buddhāna
 * sāsanaṃ.* The Zen "Three Pure Precepts" (refrain from evil, do good,
 * do good for others / purify the mind) and this canonical Pali summary
 * of "the teaching of the Buddhas" are the same threefold shape — which
 * is why this Theravāda-Zen community files the verse under that name.
 *
 * The sheet gives only the Pali (with diacritics); the English here is a
 * working gloss plus a published rendering, kept distinct via witnesses.
 * Transcribed from chants/rinzai zen chants/ (PXL_20260530_141420478).
 */

import type { LiturgyDoc } from '../../types/liturgy';
import { dpdCitation, suttaCentralPronunciationCitation } from './_groundingHelpers';

const pronCite = suttaCentralPronunciationCitation();

export const sariputtaThreePurePrecepts: LiturgyDoc = {
  slug: 'three-pure-precepts',
  sangha: 'sariputta-ambedkar',
  title: 'Three Pure Precepts',
  subtitle: 'Ovāda Pāṭimokkha — the teaching of all Buddhas (Dhammapada 183)',
  tradition: 'theravada',
  context:
    'A four-line Pali verse the tradition takes as the heart of the precepts: avoid all evil, cultivate the good, purify the mind. At Sariputta Ambedkar Monastery it is chanted under the Zen heading "Three Pure Precepts", binding the Pali Ovāda Pāṭimokkha to the Mahāyāna bodhisattva-precept frame.',
  sources: {
    canonical: [
      { label: 'Dhammapada 183 (Buddhavagga)', url: 'https://suttacentral.net/dhp179-196/en/sujato' },
      { label: 'Mahāpadāna Sutta, DN 14 (the verse of the seven Buddhas)', url: 'https://suttacentral.net/dn14/en/sujato' },
    ],
    ritual: [{ label: 'Sariputta Ambedkar Monastery chant sheet' }],
  },
  curator:
    'Curation by Aditya. Pali transcribed verbatim from the monastery sheet (which carries the diacritics shown). The "Literal gloss" is a word-faithful working translation; Buddharakkhita (1985) is a published rendering kept for comparison. Word data follows the DPD + SuttaCentral-pronunciation grounding used elsewhere in this reader.',
  sections: [
    {
      id: 'ovada-patimokkha',
      shape: 'triple-script-witness',
      large: true,
      segments: [
        {
          id: 'avoid-evil',
          pali: 'Sabba pāpassa akaraṇaṃ,',
          paliDeva: 'सब्ब पापस्स अकरणं,',
          witnesses: [
            {
              by: 'Literal gloss',
              text: 'the non-doing of all evil,',
              alignTo: [-1, 2, -1, 0, 1],
            },
            {
              by: 'Buddharakkhita (1985)',
              text: 'To avoid all evil,',
              alignTo: [-1, 2, 0, 1],
              url: 'https://www.accesstoinsight.org/tipitaka/kn/dhp/dhp.14.budd.html',
              license: 'Buddharakkhita translation, quoted with attribution',
            },
          ],
          words: [
            {
              form: 'Sabba', scriptAlt: 'सब्ब', pronunciation: 'SUB-buh',
              etymology: 'Pali *sabba* "all, every" (Skt *sarva*)',
              gloss: 'all, every — qualifies *pāpa* (evil)',
              citations: [dpdCitation('sabba'), pronCite],
            },
            {
              form: 'pāpassa', scriptAlt: 'पापस्स', pronunciation: 'PAH-pus-suh',
              etymology: '*pāpa* "evil, bad, harmful"; the *-assa* ending makes it "of evil"',
              gloss: 'of evil — what the "non-doing" applies to',
              citations: [dpdCitation('pāpa'), pronCite],
            },
            {
              form: 'akaraṇaṃ', scriptAlt: 'अकरणं', pronunciation: 'uh-KAH-rah-nahng',
              etymology: 'privative *a-* "not" + *karaṇa* "doing, making" (√kṛ "to do")',
              gloss: 'the not-doing, the leaving-undone — abstaining',
              citations: [dpdCitation('karaṇa'), pronCite],
            },
          ],
        },
        {
          id: 'cultivate-good',
          pali: 'kusalassa upasampadā,',
          paliDeva: 'कुसलस्स उपसम्पदा,',
          witnesses: [
            {
              by: 'Literal gloss',
              text: 'the undertaking of the wholesome,',
              alignTo: [-1, 1, -1, -1, 0],
            },
            {
              by: 'Buddharakkhita (1985)',
              text: 'to cultivate good,',
              alignTo: [-1, 1, 0],
              url: 'https://www.accesstoinsight.org/tipitaka/kn/dhp/dhp.14.budd.html',
              license: 'Buddharakkhita translation, quoted with attribution',
            },
          ],
          words: [
            {
              form: 'kusalassa', scriptAlt: 'कुसलस्स', pronunciation: 'koo-SAH-lus-suh',
              etymology: '*kusala* "wholesome, skilful, good"; the *-assa* ending makes it "of the wholesome"',
              gloss: 'of the wholesome — that which is skilful and leads to welfare',
              citations: [dpdCitation('kusala'), pronCite],
            },
            {
              form: 'upasampadā', scriptAlt: 'उपसम्पदा', pronunciation: 'oo-pah-SUM-pah-dah',
              etymology: '*upa-* "toward" + *saṃ-* "fully" + *√pad* "to step, attain" — "taking fully upon oneself"',
              gloss: 'the undertaking, acquiring, taking-on (the same word as monastic "full ordination")',
              citations: [dpdCitation('upasampadā'), pronCite],
            },
          ],
        },
        {
          id: 'purify-mind',
          pali: 'sacittapariyodapanaṃ,',
          paliDeva: 'सचित्तपरियोदपनं,',
          witnesses: [
            {
              by: 'Literal gloss',
              text: 'the purifying of one’s own mind,',
              alignTo: [-1, 0, -1, 0, 0, 0],
            },
            {
              by: 'Buddharakkhita (1985)',
              text: 'to purify the mind —',
              alignTo: [-1, 0, -1, 0, -1],
              url: 'https://www.accesstoinsight.org/tipitaka/kn/dhp/dhp.14.budd.html',
              license: 'Buddharakkhita translation, quoted with attribution',
            },
          ],
          words: [
            {
              form: 'sacittapariyodapanaṃ', scriptAlt: 'सचित्तपरियोदपनं', pronunciation: 'sah-CHIT-tah-pah-ree-yoh-DAH-pah-nahng',
              etymology: '*sa-* "one’s own" + *citta* "mind, heart" + *pariyodapana* "thorough cleansing" (*pari-* "around, completely" + *√dā/dav* "to cleanse")',
              gloss: 'the complete purification of one’s own mind — the same *pariyodapana* that names the mind’s natural luminosity when defilements fall away',
              morphemes: [
                { text: 'sa', type: 'prefix', gloss: 'one’s own', pronunciation: 'sah' },
                { text: 'citta', type: 'stem', gloss: 'mind, heart — the *citta* of the Heart Sutra’s *hṛdaya* lineage', pronunciation: 'CHIT-tah', citations: [dpdCitation('citta')] },
                { text: 'pariyodapana', type: 'stem', gloss: 'thorough cleansing, brightening', pronunciation: 'pah-ree-yoh-DAH-pah-nah', citations: [dpdCitation('pariyodapeti')] },
                { text: 'ṃ', type: 'suffix', gloss: 'the "-ṃ" ending that marks the word as the object' },
              ],
              citations: [pronCite],
            },
          ],
        },
        {
          id: 'teaching-of-buddhas',
          pali: 'etaṃ Buddhāna sāsanaṃ.',
          paliDeva: 'एतं बुद्धान सासनं।',
          witnesses: [
            {
              by: 'Literal gloss',
              text: 'this is the teaching of the Buddhas.',
              alignTo: [0, -1, -1, 2, -1, -1, 1],
            },
            {
              by: 'Buddharakkhita (1985)',
              text: 'this is the teaching of the Buddhas.',
              alignTo: [0, -1, -1, 2, -1, -1, 1],
              url: 'https://www.accesstoinsight.org/tipitaka/kn/dhp/dhp.14.budd.html',
              license: 'Buddharakkhita translation, quoted with attribution',
            },
          ],
          words: [
            {
              form: 'etaṃ', scriptAlt: 'एतं', pronunciation: 'EH-tahng',
              etymology: '*eta* "this" + the "-ṃ" object ending',
              gloss: 'this — pointing back to the three preceding lines',
              citations: [dpdCitation('eta'), pronCite],
            },
            {
              form: 'Buddhāna', scriptAlt: 'बुद्धान', pronunciation: 'bood-DHAH-nah', accent: 'amber',
              etymology: '*buddha* "awakened one" (√budh); the *-āna* ending makes it "of the Buddhas"',
              gloss: 'of the Buddhas — all the awakened ones across time share this one instruction',
              citations: [dpdCitation('buddha'), pronCite],
            },
            {
              form: 'sāsanaṃ', scriptAlt: 'सासनं', pronunciation: 'SAH-sah-nahng',
              etymology: '*√sās* "to instruct, teach" + *-ana* + the "-ṃ" object ending — "that which is taught"',
              gloss: 'the teaching, instruction, dispensation — the *sāsana* itself, summed in three lines',
              citations: [dpdCitation('sāsana'), pronCite],
            },
          ],
          note: 'The verse is ascribed to all seven Buddhas of the past (DN 14) and so reads as the irreducible core of *what a Buddha teaches*: not-doing harm, doing good, purifying the mind. Sariputta Ambedkar Monastery chants it as the Zen **Three Pure Precepts** — the Pali Ovāda Pāṭimokkha standing in for the bodhisattva precept triad.',
        },
      ],
      commentary:
        'The shortest possible Dharma: three trainings and their source. Where the Zen Three Pure Precepts phrase them as vows (I vow to refrain from evil, to do good, to do good for all beings), the Pali states them as the standing instruction of every Buddha — *etaṃ Buddhāna sāsanaṃ*.',
    },
  ],
};

export default sariputtaThreePurePrecepts;

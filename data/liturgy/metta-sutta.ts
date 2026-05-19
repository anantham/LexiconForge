/**
 * Karaṇīya Metta Sutta — Khp 9 / Snp 1.8.
 *
 * "The Buddha's Words on Loving-Kindness". One of the most widely
 * chanted suttas in the Theravāda world. Ten verses laying out the
 * inner posture of one who would cultivate boundless metta, then the
 * practice itself: radiating goodwill in every direction, in every
 * posture, without attachment to fixed views.
 *
 * Chanted at MAPLE before every meal (Breakfast 7:30 AM, Lunch 12 PM).
 * The English on the MAPLE loving-kindness sheet is the Amaravati
 * Sangha rendering, the translation widely used in Western Buddhist
 * monasteries and Insight communities. Followed by the Four Great Vows
 * recited after the meal.
 *
 * Authoring scope (per scope-pass):
 *   - Pāli per-verse (10 verses, suttafriends recension)
 *   - One English witness: Amaravati Sangha (matches the MAPLE sheet)
 *   - No word-level alignment authoring — the verses are short enough
 *     that arrows would crowd more than help; the user can hover Pāli
 *     words for tooltips where words[] is populated.
 *
 * Not yet authored: Devanāgarī, additional witnesses (Sujato,
 * Thanissaro), full per-word glosses on every verse. Sparse word data
 * on key concepts (metta, mettā, sabbe sattā) only.
 */

import type { LiturgyDoc } from '../../types/liturgy';
import { dpdCitation, ungroundedCitation } from './_groundingHelpers';

const AMARAVATI_URL =
  'https://www.accesstoinsight.org/tipitaka/kn/snp/snp.1.08.amar.html';

export const mettaSutta: LiturgyDoc = {
  slug: 'metta-sutta',
  sangha: 'maple',
  order: 6,
  time: 'Before every meal',
  frequency: 'daily',
  title: 'Karaṇīya Metta Sutta',
  subtitle: 'The Buddha\'s Words on Loving-Kindness',
  tradition: 'theravada',
  context: 'The Buddha\'s teaching on cultivating loving-kindness (*mettā*) toward all beings, without exception. From the *Khuddakapāṭha* (Khp 9) and the *Suttanipāta* (Sn 1.8).',
  sources: {
    canonical: [
      { label: 'Khp 9 / Snp 1.8 (Karaṇīya Metta Sutta)', url: 'https://suttafriends.org/sutta/khp9/' },
    ],
    ritual: [
      { label: 'MAPLE loving-kindness practice sheet' },
    ],
  },
  curator:
    'Curation by Aditya. Pāli verses from the Khuddakapāṭha 9 / Suttanipāta 1.8 recension (suttafriends.org transcription). English witness is the Amaravati Sangha translation — the version printed on the MAPLE practice sheet, widely used across Theravāda monasteries. Per-word glosses are sparse and authored only on a few key terms.',
  sections: [
    {
      id: 'verses',
      shape: 'triple-script-witness',
      large: true,
      segments: [
        // ── v1a: karaṇīyam-attha-kusalena ──
        {
          id: 'v1a-karaniya',
          pali: 'karaṇīyam-attha-kusalena',
          scripts: [
            { lang: 'pi-Latn', label: 'Pāli', text: 'karaṇīyam-attha-kusalena' },
          ],
          witnesses: [
            {
              by: 'Amaravati',
              text: 'This is what should be done by one who is skilled in goodness,',
              alignTo: [0, 0, 0, 0, 0, 0, -1, 2, -1, -1, 2, -1, 1],
              url: AMARAVATI_URL,
            },
            {
              by: 'Sujato (SuttaCentral)',
              text: 'This is what should be done by one skilled in the good',
              alignTo: [0, 0, 0, 0, 0, 0, -1, 2, 2, -1, -1, 1],
              url: 'https://suttacentral.net/snp1.8/en/sujato',
              license: 'CC0',
            },
            {
              by: 'Thanissaro (Access to Insight)',
              text: 'This is to be done by one skilled in aims',
              alignTo: [0, 0, 0, 0, 0, -1, 2, 2, -1, 1],
              url: 'https://www.accesstoinsight.org/tipitaka/kn/snp/snp.1.08.than.html',
              license: 'CC BY-NC',
            },
          ],
          words: [
            {
              form: 'karaṇīyam',
              pronunciation: 'kah-rah-NEE-yahm',
              etymology: 'from the verb meaning "to do, make" — turned into "what ought to be done"',
              gloss: 'should be done — the opening word frames the whole sutta as instruction: "Here is what you do."',
              morphemes: [
                { text: 'karaṇī', type: 'root', root: '√kṛ', gloss: 'from the verb "to do, make" — same root that gives English speakers *karma* (literally "the doing")', pronunciation: 'kah-rah-NEE' },
                { text: 'yam', type: 'suffix', gloss: 'the "-yam" tail turns the verb "do" into "should be done". Similar to English adding "-able" to make "doable", but with a *must* flavour rather than a *can*.', pronunciation: 'yahm' },
              ],
              citations: [dpdCitation('karaṇīya')],
            },
            {
              form: 'attha',
              pronunciation: 'AHT-tah',
              etymology: 'one of the most range-y Pāli nouns — covers everything from "the good" to "what something means"',
              gloss: 'benefit, welfare, good, purpose, aim, meaning — a single word holding all these senses at once. Here: "the good", the worthwhile aim that the skilled person is pursuing.',
              accent: 'amber',
              citations: [dpdCitation('attha')],
            },
            {
              form: 'kusalena',
              pronunciation: 'koo-sah-LAY-nah',
              etymology: '*kusala* "skilful, wholesome" — the stem\'s final "a" merges with the "-ena" ending',
              gloss: 'by one who is skilled. *Kusala* is the same word Buddhist texts use for "wholesome" states of mind — skilfulness is moral as well as practical.',
              morphemes: [
                { text: 'kusal', type: 'stem', gloss: 'skilful, wholesome — the same word Pāli texts use to mark a "good" mind-state (the opposite of *akusala*, "unwholesome").', pronunciation: 'koo-SAHL' },
                { text: 'ena', type: 'suffix', gloss: 'the "-ena" tail marks the *doer* of the action — "by this person". English wedges in the word "by" to do the same job; Pāli changes the tail of the word itself.', pronunciation: 'AY-nah' },
              ],
              citations: [dpdCitation('kusala')],
            },
          ],
        },
        // ── v1b: yaṁ taṁ santaṁ padaṁ abhisamecca ──
        {
          id: 'v1b-santam-padam',
          pali: 'yaṁ taṁ santaṁ padaṁ abhisamecca',
          scripts: [
            { lang: 'pi-Latn', label: 'Pāli', text: 'yaṁ taṁ santaṁ padaṁ abhisamecca' },
          ],
          witnesses: [
            {
              by: 'Amaravati',
              text: 'and who knows the path of peace:',
              alignTo: [-1, -1, 4, -1, 3, -1, 2],
              url: AMARAVATI_URL,
            },
            {
              by: 'Sujato (SuttaCentral)',
              text: 'who has comprehended the state of peace.',
              alignTo: [-1, 4, 4, -1, 3, -1, 2],
              url: 'https://suttacentral.net/snp1.8/en/sujato',
              license: 'CC0',
            },
            {
              by: 'Thanissaro (Access to Insight)',
              text: 'who wants to break through to the state of peace:',
              alignTo: [-1, -1, -1, 4, 4, -1, -1, 3, -1, 2],
              url: 'https://www.accesstoinsight.org/tipitaka/kn/snp/snp.1.08.than.html',
              license: 'CC BY-NC',
            },
          ],
          words: [
            { form: 'yaṁ', pronunciation: 'yahm', gloss: 'which, that — a pointer word; in this verse it points to *padaṁ* ("the state") coming up' },
            { form: 'taṁ', pronunciation: 'tahm', gloss: 'that one — pairs with *yaṁ* the way English pairs "which" with "that"' },
            {
              form: 'santaṁ',
              pronunciation: 'SAHN-tahm',
              etymology: 'from a verb root meaning "to calm, quiet down"',
              gloss: 'peaceful, calmed — describes the *padaṁ* ("state") that comes next. The same root *√śam* gives the word *śamatha* (tranquility meditation).',
              accent: 'sky',
              morphemes: [
                { text: 'sant', type: 'root', root: '√śam', gloss: 'from the verb "to calm, quiet". *Sant* is the form for something that has been calmed — like English "settled" or "stilled".', pronunciation: 'sahnt' },
                { text: 'aṁ', type: 'suffix', gloss: 'the "-aṁ" tail flags this word as the *thing being acted on* — here, the "peaceful state" that\'s being comprehended. Pronounced as a soft nasal close, like "um" in English "hum".', pronunciation: 'ahm' },
              ],
              citations: [dpdCitation('santa')],
            },
            {
              form: 'padaṁ',
              pronunciation: 'PAH-dahm',
              etymology: 'literally "foot, step", broadened to "foothold, place, state, condition" — like English "footing" or "standing"',
              gloss: 'state, ground, footing — what the commentaries take as *nibbāna*, the peaceful destination. Same root gives English speakers the *-pad* in compound words like *quadruped*.',
              citations: [dpdCitation('pada')],
            },
            {
              form: 'abhisamecca',
              pronunciation: 'ah-bhee-sah-MAYCH-cha',
              etymology: 'three pieces: *abhi-* (toward) + *sam-* (together, fully) + *√i* (to go) — "having gone all the way to it"',
              gloss: 'having come to fully understand it — literally "having gone right up to" the peaceful state. The word frames understanding as a journey completed, not a thought entertained.',
              morphemes: [
                { text: 'abhi', type: 'prefix', gloss: 'a prefix meaning "toward, up to" — adds a reaching-for flavour to whatever follows', pronunciation: 'ah-bhee' },
                { text: 'sam', type: 'prefix', gloss: 'a prefix meaning "together, fully". Combined with *abhi-* it intensifies into "going all the way".', pronunciation: 'sahm' },
                { text: 'ecca', type: 'suffix', root: '√i', gloss: 'from the verb "to go". The tail of the word means "having Xed" — so *abhi-sam-ecca* = "having gone fully up to [it]", i.e. having grasped it completely.', pronunciation: 'AYCH-cha' },
              ],
            },
          ],
        },
        // ── v1c: sakko ujū ca suhujū ca ──
        {
          id: 'v1c-sakko-uju',
          pali: 'sakko ujū ca suhujū ca',
          scripts: [
            { lang: 'pi-Latn', label: 'Pāli', text: 'sakko ujū ca suhujū ca' },
          ],
          witnesses: [
            {
              by: 'Amaravati',
              text: 'let them be able and upright,',
              alignTo: [-1, -1, -1, 0, -1, 1],
              url: AMARAVATI_URL,
            },
            {
              by: 'Sujato (SuttaCentral)',
              text: 'They\'d be capable, sincere, and upright,',
              alignTo: [-1, -1, 0, 3, -1, 1],
              url: 'https://suttacentral.net/snp1.8/en/sujato',
              license: 'CC0',
            },
            {
              by: 'Thanissaro (Access to Insight)',
              text: 'Be capable, upright, and straightforward,',
              alignTo: [-1, 0, 1, -1, 3],
              url: 'https://www.accesstoinsight.org/tipitaka/kn/snp/snp.1.08.than.html',
              license: 'CC BY-NC',
            },
          ],
          words: [
            {
              form: 'sakko',
              pronunciation: 'SAHK-koh',
              etymology: 'from the verb *√śak* "to be able" — the first of the worker-of-goodness\'s inner qualities',
              gloss: 'able, capable — having the strength to follow through',
              citations: [dpdCitation('sakka')],
            },
            {
              form: 'ujū',
              pronunciation: 'OO-joo',
              etymology: 'plain meaning "straight" — both bodily (straight posture) and morally (straight conduct)',
              gloss: 'upright, straight — neither bent in posture nor crooked in dealings',
              citations: [dpdCitation('uju')],
            },
            { form: 'ca', pronunciation: 'chah', gloss: 'and' },
            {
              form: 'suhujū',
              pronunciation: 'SOO-hoo-joo',
              etymology: '*su-* (the prefix "well, properly") + *uju* (straight). The *s* + *u* combination triggers a soft *h-* in front of *uju* — sound-smoothing.',
              gloss: 'really, properly straight — *ujū* doubled down. Fully sincere, with no hidden crookedness.',
              morphemes: [
                { text: 'su', type: 'prefix', gloss: 'a prefix meaning "well, easily, properly". Like English "well-" in "well-spoken".', pronunciation: 'soo' },
                { text: 'hujū', type: 'stem', gloss: '*uju* "straight" — with an *h-* added in front to smooth the join with *su-*. Same word as the previous *ujū*, just intensified by the prefix.', pronunciation: 'HOO-joo' },
              ],
            },
            { form: 'ca', pronunciation: 'chah', gloss: 'and' },
          ],
        },
        // ── v1d: suvaco c'assa mudu anatimānī ──
        {
          id: 'v1d-suvaco-mudu',
          pali: 'suvaco c\'assa mudu anatimānī',
          scripts: [
            // tokens hint keeps the sandhi compound c'assa as one hover unit;
            // without it the default Latin tokenizer splits on the apostrophe.
            { lang: 'pi-Latn', label: 'Pāli', text: 'suvaco c\'assa mudu anatimānī', tokens: ['suvaco', "c'assa", 'mudu', 'anatimānī'] },
          ],
          witnesses: [
            {
              by: 'Amaravati',
              text: 'straightforward and gentle in speech, humble and not conceited.',
              alignTo: [-1, -1, 2, -1, 0, 3, -1, 3, 3],
              url: AMARAVATI_URL,
            },
            {
              by: 'Sujato (SuttaCentral)',
              text: 'easy to speak to, gentle, and not proud,',
              alignTo: [0, 0, 0, 0, 2, -1, 3, 3],
              url: 'https://suttacentral.net/snp1.8/en/sujato',
              license: 'CC0',
            },
            {
              by: 'Thanissaro (Access to Insight)',
              text: 'easy to instruct, gentle, and not conceited,',
              alignTo: [0, 0, 0, 2, -1, 3, 3],
              url: 'https://www.accesstoinsight.org/tipitaka/kn/snp/snp.1.08.than.html',
              license: 'CC BY-NC',
            },
          ],
          words: [
            {
              form: 'suvaco',
              pronunciation: 'SOO-vah-choh',
              etymology: '*su-* "well" + *vaca* "speech" (root *√vac*) — "easily-spoken-to"',
              gloss: 'easy to speak to, amenable to correction',
              morphemes: [
                { text: 'su', type: 'prefix', gloss: 'well, easily', pronunciation: 'soo' },
                { text: 'vaco', type: 'stem', root: '√vac', gloss: '*vaca* "speech" + nominative — "spoken-to"', pronunciation: 'VAH-choh' },
              ],
              citations: [dpdCitation('suvaca')],
            },
            {
              form: "c'assa",
              pronunciation: 'CHAHS-sah',
              etymology: '*ca* "and" + *assa* "(may) be" — sandhi contraction (3sg optative of *√as*)',
              gloss: 'and may [one] be — the optative carries through the next several verses',
            },
            {
              form: 'mudu',
              pronunciation: 'MOO-doo',
              etymology: 'Pāli *mudu* "soft, gentle" (Skt *mṛdu*)',
              gloss: 'gentle, soft, mild',
              citations: [dpdCitation('mudu')],
            },
            {
              form: 'anatimānī',
              pronunciation: 'ah-nah-tee-MAH-nee',
              etymology: '*an-* "not" + *ati-* "over, excessive" + *māna* "pride" + *-ī* possessive — "not having excessive pride"',
              gloss: 'not arrogant, not conceited — the opposite of *atimāna* (excessive self-regard)',
              morphemes: [
                { text: 'an', type: 'prefix', gloss: 'not (assimilated *a-* before vowel)', pronunciation: 'ahn' },
                { text: 'ati', type: 'prefix', gloss: 'over, beyond, excessive', pronunciation: 'AH-tee' },
                { text: 'mānī', type: 'stem', root: '√man', gloss: 'one having pride (*māna* + possessive *-ī*)', pronunciation: 'MAH-nee' },
              ],
              citations: [dpdCitation('māna')],
            },
          ],
        },
        // ── v2a: santussako ca subharo ca ──
        {
          id: 'v2a-santussako',
          pali: 'santussako ca subharo ca',
          scripts: [
            { lang: 'pi-Latn', label: 'Pāli', text: 'santussako ca subharo ca' },
          ],
          witnesses: [
            { by: 'Amaravati', text: 'Contented and easily satisfied,', alignTo: [0, -1, 2, -1], url: AMARAVATI_URL },
            { by: 'Sujato (SuttaCentral)', text: 'content and unburdensome,', alignTo: [0, -1, 2], url: 'https://suttacentral.net/snp1.8/en/sujato', license: 'CC0' },
            { by: 'Thanissaro (Access to Insight)', text: 'content and easy to support,', alignTo: [0, -1, 2, 2, 2], url: 'https://www.accesstoinsight.org/tipitaka/kn/snp/snp.1.08.than.html', license: 'CC BY-NC' },
          ],
          words: [
            {
              form: 'santussako',
              pronunciation: 'sahn-TOOS-sah-koh',
              etymology: '*saṁ* (fully) + *tussako* (one who is pleased — from the verb *√tuṣ* "to be pleased, satisfied"). Same *√tuṣ* gives English *santosha* (contentment) in popular usage.',
              gloss: 'easily contented — pleased with what one has; the temperament of one not chasing more',
              accent: 'amber',
              morphemes: [
                { text: 'san', type: 'prefix', gloss: 'the prefix *saṁ-* "fully, together" (the *ṁ* assimilates to *n* before *t*)', pronunciation: 'sahn' },
                { text: 'tussako', type: 'stem', root: '√tuṣ', gloss: 'one who is pleased — from the verb "to be satisfied". The full word means "fully content, easily pleased".', pronunciation: 'TOOS-sah-koh' },
              ],
            },
            { form: 'ca', pronunciation: 'chah', gloss: 'and' },
            {
              form: 'subharo',
              pronunciation: 'SOO-bah-roh',
              etymology: '*su-* (easily) + *bhara* (carrying, supporting — from *√bhṛ* "to bear, carry")',
              gloss: 'easy to support — needing little from those who give. Used of monastics who don\'t make a fuss about food, robes, lodging.',
              morphemes: [
                { text: 'su', type: 'prefix', gloss: 'a prefix meaning "well, easily". Same prefix as in *suvaco* (verse 1).', pronunciation: 'soo' },
                { text: 'bharo', type: 'stem', root: '√bhṛ', gloss: 'from the verb "to bear, carry". *Subharo* = "easy to carry, easy to support" — undemanding.', pronunciation: 'BAH-roh' },
              ],
            },
            { form: 'ca', pronunciation: 'chah', gloss: 'and' },
          ],
        },
        // ── v2b: appakicco ca sallahukavutti ──
        {
          id: 'v2b-appakicco',
          pali: 'appakicco ca sallahukavutti',
          scripts: [
            { lang: 'pi-Latn', label: 'Pāli', text: 'appakicco ca sallahukavutti' },
          ],
          witnesses: [
            { by: 'Amaravati', text: 'unburdened with duties and frugal in their ways.', alignTo: [-1, 0, -1, 0, 2, 2, -1, -1], url: AMARAVATI_URL },
            { by: 'Sujato (SuttaCentral)', text: 'living lightly with few duties,', alignTo: [2, 2, -1, 0, 0], url: 'https://suttacentral.net/snp1.8/en/sujato', license: 'CC0' },
            { by: 'Thanissaro (Access to Insight)', text: 'with few duties, living lightly,', alignTo: [-1, 0, 0, 2, 2], url: 'https://www.accesstoinsight.org/tipitaka/kn/snp/snp.1.08.than.html', license: 'CC BY-NC' },
          ],
          words: [
            {
              form: 'appakicco',
              pronunciation: 'AHP-pah-keech-choh',
              etymology: '*appa* (little, few) + *kicca* (duty, what should be done — from the same verb *√kṛ* as *karaṇīyam* in verse 1)',
              gloss: 'having few duties — light schedule, few external obligations',
              morphemes: [
                { text: 'appa', type: 'prefix', gloss: 'a stem meaning "little, few". Used as a first member of compounds to negate or minimise.', pronunciation: 'AHP-pah' },
                { text: 'kicco', type: 'stem', root: '√kṛ', gloss: 'duty, what should be done — same verb-root as *karaṇīyam* in verse 1. *Appa-kicco* = "few-duties".', pronunciation: 'KEECH-choh' },
              ],
            },
            { form: 'ca', pronunciation: 'chah', gloss: 'and' },
            {
              form: 'sallahukavutti',
              pronunciation: 'sahl-LAH-hoo-kah-VOOT-tee',
              etymology: '*sallahuka* (very light — *sa(ṁ)* intensifier + *lahuka* "light") + *vutti* (mode of life, conduct — from *√vṛt* "to turn, go on")',
              gloss: 'living lightly — way-of-life with little baggage, easy of habits',
              morphemes: [
                { text: 'sallahuka', type: 'stem', gloss: 'very light, easy — *sa-* intensifies *lahuka* "light" (related to English "light" through Indo-European cousins)', pronunciation: 'sahl-LAH-hoo-kah' },
                { text: 'vutti', type: 'stem', root: '√vṛt', gloss: 'conduct, way of going on — from a verb meaning "to turn, proceed". Same root as English *vortex*.', pronunciation: 'VOOT-tee' },
              ],
            },
          ],
        },
        // ── v2c: santindriyo ca nipako ca ──
        {
          id: 'v2c-santindriyo',
          pali: 'santindriyo ca nipako ca',
          scripts: [
            { lang: 'pi-Latn', label: 'Pāli', text: 'santindriyo ca nipako ca' },
          ],
          witnesses: [
            { by: 'Amaravati', text: 'Peaceful and calm and wise and skillful,', alignTo: [0, -1, 0, -1, 2, -1, 2], url: AMARAVATI_URL },
            { by: 'Sujato (SuttaCentral)', text: 'sensible and prudent,', alignTo: [0, -1, 2], url: 'https://suttacentral.net/snp1.8/en/sujato', license: 'CC0' },
            { by: 'Thanissaro (Access to Insight)', text: 'with peaceful faculties, masterful,', alignTo: [-1, 0, 0, 2], url: 'https://www.accesstoinsight.org/tipitaka/kn/snp/snp.1.08.than.html', license: 'CC BY-NC' },
          ],
          words: [
            {
              form: 'santindriyo',
              pronunciation: 'sahn-TEEN-dree-yoh',
              etymology: '*santa* (peaceful — same *santaṁ* as verse 1) + *indriya* (faculty — the senses, plus mind, treated as a sixth)',
              gloss: 'with calmed senses — eyes, ears, mind etc. all at peace; not yanked around by sense-impressions',
              accent: 'sky',
              morphemes: [
                { text: 'sant', type: 'root', root: '√śam', gloss: 'calmed, at peace — the same root as *santaṁ* in verse 1', pronunciation: 'sahnt' },
                { text: 'indriyo', type: 'stem', gloss: 'the senses (sight, hearing, smell, taste, touch, plus mind treated as a sixth). Literally "belonging to Indra" — the powers of the lord of the senses.', pronunciation: 'EEN-dree-yoh' },
              ],
            },
            { form: 'ca', pronunciation: 'chah', gloss: 'and' },
            {
              form: 'nipako',
              pronunciation: 'NEE-pah-koh',
              etymology: 'related to *√pac* "to mature, ripen" — a person whose understanding has fully ripened',
              gloss: 'wise, prudent — the kind of wisdom that comes from maturity, not book-learning',
            },
            { form: 'ca', pronunciation: 'chah', gloss: 'and' },
          ],
        },
        // ── v2d: appagabbho kulesu ananugiddho ──
        {
          id: 'v2d-appagabbho',
          pali: 'appagabbho kulesu ananugiddho',
          scripts: [
            { lang: 'pi-Latn', label: 'Pāli', text: 'appagabbho kulesu ananugiddho' },
          ],
          witnesses: [
            { by: 'Amaravati', text: 'not proud or demanding in nature.', alignTo: [0, 0, -1, 0, -1, -1], url: AMARAVATI_URL },
            { by: 'Sujato (SuttaCentral)', text: 'not arrogant or fawning over families.', alignTo: [0, 0, -1, 2, -1, 1], url: 'https://suttacentral.net/snp1.8/en/sujato', license: 'CC0' },
            { by: 'Thanissaro (Access to Insight)', text: 'modest, and no greed for supporters.', alignTo: [0, -1, 2, 2, -1, 1], url: 'https://www.accesstoinsight.org/tipitaka/kn/snp/snp.1.08.than.html', license: 'CC BY-NC' },
          ],
          words: [
            {
              form: 'appagabbho',
              pronunciation: 'AHP-pah-GAHB-bho',
              etymology: '*appa* (little, not) + *gabbha* (impudent, rude — from a different sense of the word that also means "womb, interior")',
              gloss: 'not impudent — not pushy with families, not putting on airs',
              morphemes: [
                { text: 'appa', type: 'prefix', gloss: 'a stem meaning "little, not" — same prefix as in *appakicco*', pronunciation: 'AHP-pah' },
                { text: 'gabbho', type: 'stem', gloss: 'impudent, forward, intrusive. *Appa-gabbho* = "not-pushy".', pronunciation: 'GAHB-bho' },
              ],
            },
            {
              form: 'kulesu',
              pronunciation: 'koo-LAY-soo',
              etymology: '*kula* (family, clan, household) — the "-esu" tail means "in/among"',
              gloss: 'in/among families — i.e., the lay families a monastic visits for alms',
              morphemes: [
                { text: 'kul', type: 'stem', gloss: 'family, household. *Kula* covers the extended sense — clan, lineage, the people in a house.', pronunciation: 'kool' },
                { text: 'esu', type: 'suffix', gloss: 'the "-esu" tail marks "in/among" with a plural — like English saying "in those families".', pronunciation: 'AY-soo' },
              ],
            },
            {
              form: 'ananugiddho',
              pronunciation: 'ah-nah-noo-GEED-dho',
              etymology: '*an-* (not) + *anu-* (along, after) + *giddha* (greedy, attached — from *√gṛdh* "to be greedy")',
              gloss: 'not running-after with greed — not chasing the families for what they can give',
              morphemes: [
                { text: 'an', type: 'prefix', gloss: 'a prefix meaning "not"', pronunciation: 'ahn' },
                { text: 'anu', type: 'prefix', gloss: 'a prefix meaning "along, after" — adds a "chasing after" flavour', pronunciation: 'AH-noo' },
                { text: 'giddho', type: 'stem', root: '√gṛdh', gloss: 'greedy, attached — from a verb meaning "to be greedy". *An-anu-giddho* = "not chasing-after-greedily".', pronunciation: 'GEED-dho' },
              ],
            },
          ],
        },
        {
          id: 'verse-3',
          pali: 'Na ca khuddhaṁ samācare kiñci, yena viññū pare upavadeyyuṁ; sukhino vā khemino hontu, sabbe sattā bhavantu sukhitattā.',
          scripts: [
            {
              lang: 'pi-Latn',
              label: 'Pāli',
              text: 'Na ca khuddhaṁ samācare kiñci, yena viññū pare upavadeyyuṁ; sukhino vā khemino hontu, sabbe sattā bhavantu sukhitattā.',
            },
          ],
          witnesses: [
            {
              by: 'Amaravati',
              text: 'Let them not do the slightest thing that the wise would later reprove. Wishing: in gladness and in safety, may all beings be at ease.',
              url: AMARAVATI_URL,
            },
            {
              by: 'Sujato (SuttaCentral)',
              text: 'They\'d not do the slightest thing that others might blame them for. Their thought is: \'May all beings be happy and safe! May all beings be happy!\'',
              url: 'https://suttacentral.net/snp1.8/en/sujato',
              license: 'CC0',
            },
            {
              by: 'Thanissaro (Access to Insight)',
              text: 'Do not do the slightest thing that the wise would later censure. Think: Happy, at rest, may all beings be happy at heart.',
              url: 'https://www.accesstoinsight.org/tipitaka/kn/snp/snp.1.08.than.html',
              license: 'CC BY-NC',
            },
          ],
          words: [
            {
              form: 'sabbe',
              gloss: 'All, every. The first appearance of the universalising move that runs through the sutta.',
              accent: 'rose',
            },
            {
              form: 'sattā',
              gloss: 'Beings, sentient creatures. *sabbe sattā* = "all beings", the recurring address of the metta wish.',
              accent: 'rose',
              citations: [dpdCitation('satta')],
            },
          ],
        },
        {
          id: 'verse-4',
          pali: 'Ye keci pāṇabhūtatthī, tasā vā thāvarā vā anavasesā; dīghā vā ye mahantā vā, majjhimā rassakāṇukathūlā.',
          scripts: [
            {
              lang: 'pi-Latn',
              label: 'Pāli',
              text: 'Ye keci pāṇabhūtatthī, tasā vā thāvarā vā anavasesā; dīghā vā ye mahantā vā, majjhimā rassakāṇukathūlā.',
            },
          ],
          witnesses: [
            {
              by: 'Amaravati',
              text: 'Whatever living beings there may be, whether they are weak or strong, omitting none, the great and the mighty, medium, short or small.',
              url: AMARAVATI_URL,
            },
            {
              by: 'Sujato (SuttaCentral)',
              text: 'Whatever creatures there are— none excepted, weak or strong, long or large, medium-sized, short, slender or thick,',
              url: 'https://suttacentral.net/snp1.8/en/sujato',
              license: 'CC0',
            },
            {
              by: 'Thanissaro (Access to Insight)',
              text: 'Whatever beings there may be, weak or strong, without exception, long, large, middling, short, subtle, blatant,',
              url: 'https://www.accesstoinsight.org/tipitaka/kn/snp/snp.1.08.than.html',
              license: 'CC BY-NC',
            },
          ],
        },
        {
          id: 'verse-5',
          pali: 'Diṭṭhā vā yeva addiṭṭhā, ye ca dūre vasanti avidūre; bhūtā vā sambhavesī vā, sabbe sattā bhavantu sukhitattā.',
          scripts: [
            {
              lang: 'pi-Latn',
              label: 'Pāli',
              text: 'Diṭṭhā vā yeva addiṭṭhā, ye ca dūre vasanti avidūre; bhūtā vā sambhavesī vā, sabbe sattā bhavantu sukhitattā.',
            },
          ],
          witnesses: [
            {
              by: 'Amaravati',
              text: 'The seen and the unseen, those living near and far away, those born and to-be-born. May all beings be at ease!',
              url: AMARAVATI_URL,
            },
            {
              by: 'Sujato (SuttaCentral)',
              text: 'those who are seen or unseen, those living far or near, those born or to be born— may all beings be happy!',
              url: 'https://suttacentral.net/snp1.8/en/sujato',
              license: 'CC0',
            },
            {
              by: 'Thanissaro (Access to Insight)',
              text: 'seen or unseen, near or far, born or seeking birth: May all beings be happy at heart.',
              url: 'https://www.accesstoinsight.org/tipitaka/kn/snp/snp.1.08.than.html',
              license: 'CC BY-NC',
            },
          ],
          words: [
            {
              form: 'sambhavesī',
              gloss: '"Those still seeking birth", those yet to be born. Paired with *bhūtā* "already become" — the wish covers both the born and the yet-to-be-born.',
              accent: 'sky',
            },
          ],
        },
        {
          id: 'verse-6',
          pali: 'Na paro paraṁ nikubbetha, nātimaññetha katthaci naṁ kanci; byārosanā paṭighasaññā, nāññamaññassa dukkhamiccheyya.',
          scripts: [
            {
              lang: 'pi-Latn',
              label: 'Pāli',
              text: 'Na paro paraṁ nikubbetha, nātimaññetha katthaci naṁ kanci; byārosanā paṭighasaññā, nāññamaññassa dukkhamiccheyya.',
            },
          ],
          witnesses: [
            {
              by: 'Amaravati',
              text: 'Let none deceive another, or despise any being in any state. Let none through anger or ill-will wish harm upon another.',
              url: AMARAVATI_URL,
            },
            {
              by: 'Sujato (SuttaCentral)',
              text: 'Let none deceive another, nor despise anyone anywhere, nor wish harm for one another out of anger or hostility.',
              url: 'https://suttacentral.net/snp1.8/en/sujato',
              license: 'CC0',
            },
            {
              by: 'Thanissaro (Access to Insight)',
              text: 'Let no one deceive another or despise anyone anywhere, or through anger or irritation wish for another to suffer.',
              url: 'https://www.accesstoinsight.org/tipitaka/kn/snp/snp.1.08.than.html',
              license: 'CC BY-NC',
            },
          ],
        },
        {
          id: 'verse-7',
          pali: 'Mātā yathā niyaṁ puttaṁ, āyusā ekaputtamanurakkhe; evampi sabbabhūtesu, mānasaṁ bhāvaye aparimāṇaṁ.',
          scripts: [
            {
              lang: 'pi-Latn',
              label: 'Pāli',
              text: 'Mātā yathā niyaṁ puttaṁ, āyusā ekaputtamanurakkhe; evampi sabbabhūtesu, mānasaṁ bhāvaye aparimāṇaṁ.',
            },
          ],
          witnesses: [
            {
              by: 'Amaravati',
              text: 'Even as a mother protects with her life her child, her only child, so should one protect the boundless heart that loves all beings.',
              url: AMARAVATI_URL,
            },
            {
              by: 'Sujato (SuttaCentral)',
              text: 'As a mother would protect with her life her one and only child, so they\'d cultivate a heart of love without limit for all sentient beings.',
              url: 'https://suttacentral.net/snp1.8/en/sujato',
              license: 'CC0',
            },
            {
              by: 'Thanissaro (Access to Insight)',
              text: 'As a mother would risk her life to protect her child, her only child, even so should one cultivate the heart limitlessly with regard to all beings.',
              url: 'https://www.accesstoinsight.org/tipitaka/kn/snp/snp.1.08.than.html',
              license: 'CC BY-NC',
            },
          ],
          words: [
            {
              form: 'mānasaṁ',
              gloss: '"The heart-mind". *manas* + accusative. The thing to be cultivated boundlessly.',
              accent: 'sky',
              citations: [dpdCitation('manas')],
            },
            {
              form: 'bhāvaye',
              gloss: '"Let one cultivate, let one bring into being". Optative of *√bhū* "to be", causative — to *cause to become*. The technical term for meditative cultivation.',
              accent: 'amber',
              citations: [dpdCitation('bhāveti')],
            },
          ],
        },
        {
          id: 'verse-8',
          pali: 'Mettañca sabbalokasmiṁ, mānasaṁ bhāvaye aparimāṇaṁ; uddhaṁ adho ca tiriyañca, asambādhaṁ averaṁ asapattaṁ.',
          scripts: [
            {
              lang: 'pi-Latn',
              label: 'Pāli',
              text: 'Mettañca sabbalokasmiṁ, mānasaṁ bhāvaye aparimāṇaṁ; uddhaṁ adho ca tiriyañca, asambādhaṁ averaṁ asapattaṁ.',
            },
          ],
          witnesses: [
            {
              by: 'Amaravati',
              text: 'Radiating kindness over the entire world: spreading upwards to the skies, and downwards to the depths; outwards and unbounded, freed from hatred and ill-will.',
              url: AMARAVATI_URL,
            },
            {
              by: 'Sujato (SuttaCentral)',
              text: 'With love for the whole world, they\'d cultivate a heart that\'s limitless, upwards, downwards and side-to-side, unbounded, free of enmity and hate.',
              url: 'https://suttacentral.net/snp1.8/en/sujato',
              license: 'CC0',
            },
            {
              by: 'Thanissaro (Access to Insight)',
              text: 'With good will for the entire cosmos, cultivate a limitless heart: above, below, & all around, unobstructed, without enmity or hate.',
              url: 'https://www.accesstoinsight.org/tipitaka/kn/snp/snp.1.08.than.html',
              license: 'CC BY-NC',
            },
          ],
          words: [
            {
              form: 'Mettañca',
              gloss: '*mettā* + *ca* "and". *Mettā* is loving-kindness, friendliness; not affection or warmth alone but a goodwill toward all beings without exception. The name-virtue of the sutta.',
              accent: 'rose',
              citations: [dpdCitation('mettā')],
            },
          ],
        },
        {
          id: 'verse-9',
          pali: 'Tiṭṭhaṁ caraṁ nisinno vā, sayāno vā yāvat\'assa vigatamiddho; etaṁ satiṁ adhiṭṭheyya, brahmametaṁ vihāraṁ idhamāhu.',
          scripts: [
            {
              lang: 'pi-Latn',
              label: 'Pāli',
              text: 'Tiṭṭhaṁ caraṁ nisinno vā, sayāno vā yāvat\'assa vigatamiddho; etaṁ satiṁ adhiṭṭheyya, brahmametaṁ vihāraṁ idhamāhu.',
            },
          ],
          witnesses: [
            {
              by: 'Amaravati',
              text: 'Whether standing or walking, seated or lying down, free from drowsiness, one should sustain this recollection. This is said to be the sublime abiding.',
              url: AMARAVATI_URL,
            },
            {
              by: 'Sujato (SuttaCentral)',
              text: 'Standing, walking, sitting, or lying down— as long as they\'re not drowsy— they would commit to this kind of mindfulness; this is what they call a divine meditation in this life.',
              url: 'https://suttacentral.net/snp1.8/en/sujato',
              license: 'CC0',
            },
            {
              by: 'Thanissaro (Access to Insight)',
              text: 'Whether standing, walking, sitting, or lying down, as long as one is alert, one should be resolved on this mindfulness. This is called a sublime abiding here & now.',
              url: 'https://www.accesstoinsight.org/tipitaka/kn/snp/snp.1.08.than.html',
              license: 'CC BY-NC',
            },
          ],
          words: [
            {
              form: 'brahmametaṁ',
              gloss: '*brahma* + *etaṁ* "this is divine". The *brahmavihāra* — divine abiding — is the meditator\'s dwelling-place. *Brahma* here doesn\'t name the deity but the highest, sublime register.',
              accent: 'sky',
            },
          ],
        },
        {
          id: 'verse-10',
          pali: 'Diṭṭhiñca anupaggamma, sīlavā dassanena sampanno; kāmesu vineyya gedhaṁ, na hi jātuggabbhaseyya puna retīti.',
          scripts: [
            {
              lang: 'pi-Latn',
              label: 'Pāli',
              text: 'Diṭṭhiñca anupaggamma, sīlavā dassanena sampanno; kāmesu vineyya gedhaṁ, na hi jātuggabbhaseyya puna retīti.',
            },
          ],
          witnesses: [
            {
              by: 'Amaravati',
              text: 'By not holding to fixed views, the pure-hearted one, having clarity of vision, being freed from all sense desires, is not born again into this world.',
              url: AMARAVATI_URL,
            },
            {
              by: 'Sujato (SuttaCentral)',
              text: 'Avoiding wrong views, ethical, attaining vision, having removed desire for sensual pleasures, they would never come to lie in a womb again.',
              url: 'https://suttacentral.net/snp1.8/en/sujato',
              license: 'CC0',
            },
            {
              by: 'Thanissaro (Access to Insight)',
              text: 'Not taken with views, but virtuous & consummate in vision, having subdued desire for sensual pleasures, one never again will lie in the womb.',
              url: 'https://www.accesstoinsight.org/tipitaka/kn/snp/snp.1.08.than.html',
              license: 'CC BY-NC',
            },
          ],
          words: [
            {
              form: 'Diṭṭhiñca',
              gloss: '*diṭṭhi* + *ca*. *Diṭṭhi* is "view" — most often *wrong* view in technical Pāli: a fixed position, a doctrine clung to. Letting go of clinging to views is the closing instruction.',
              accent: 'amber',
              citations: [dpdCitation('diṭṭhi')],
            },
          ],
        },
      ],
    },
  ],
};

export default mettaSutta;

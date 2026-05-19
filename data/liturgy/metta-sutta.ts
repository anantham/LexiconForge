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
        // ── v3a: na ca khuddhaṁ samācare kiñci ──
        {
          id: 'v3a-na-khuddham',
          pali: 'na ca khuddhaṁ samācare kiñci',
          scripts: [
            { lang: 'pi-Latn', label: 'Pāli', text: 'na ca khuddhaṁ samācare kiñci' },
          ],
          witnesses: [
            { by: 'Amaravati', text: 'Let them not do the slightest thing', alignTo: [-1, -1, 0, 3, -1, 2, 4], url: AMARAVATI_URL },
            { by: 'Sujato (SuttaCentral)', text: "They'd not do the slightest thing", alignTo: [-1, 0, 3, -1, 2, 4], url: 'https://suttacentral.net/snp1.8/en/sujato', license: 'CC0' },
            { by: 'Thanissaro (Access to Insight)', text: 'Do not do the slightest thing', alignTo: [3, 0, 3, -1, 2, 4], url: 'https://www.accesstoinsight.org/tipitaka/kn/snp/snp.1.08.than.html', license: 'CC BY-NC' },
          ],
          words: [
            { form: 'na', pronunciation: 'nah', gloss: '"not". Combines with the next verb to negate the whole sentence.' },
            { form: 'ca', pronunciation: 'chah', gloss: 'and. Here it links this verse to the qualities listed in verse 2.' },
            {
              form: 'khuddhaṁ',
              pronunciation: 'KHOOD-dahm',
              etymology: '*khudda* "small, petty, mean" + the *-ṁ* tail marking it as the object of the action',
              gloss: 'anything petty or mean — not just small in size, but small-minded',
            },
            {
              form: 'samācare',
              pronunciation: 'sah-MAH-chah-ray',
              etymology: '*saṁ-* (together, fully) + *ā-* (toward) + *√car* (to walk, go, act). The whole verb means "to conduct oneself, behave".',
              gloss: 'should do, should conduct oneself in. The ending makes it "let one do" — a gentle imperative.',
              morphemes: [
                { text: 'sam', type: 'prefix', gloss: 'a prefix meaning "fully, together" (the *ṁ* assimilates to *m* before a vowel)', pronunciation: 'sahm' },
                { text: 'ā', type: 'prefix', gloss: 'a prefix meaning "toward, at"', pronunciation: 'ah' },
                { text: 'care', type: 'root', root: '√car', gloss: 'from the verb "to walk, conduct oneself, behave". Same root as *caryā* (practice, conduct).', pronunciation: 'CHAH-ray' },
              ],
            },
            { form: 'kiñci', pronunciation: 'KEEN-chee', gloss: '"anything (at all)". Pairs with the negation *na* — "not anything", i.e. "nothing".' },
          ],
        },
        // ── v3b: yena viññū pare upavadeyyuṁ ──
        {
          id: 'v3b-yena-vinnu',
          pali: 'yena viññū pare upavadeyyuṁ',
          scripts: [
            { lang: 'pi-Latn', label: 'Pāli', text: 'yena viññū pare upavadeyyuṁ' },
          ],
          witnesses: [
            { by: 'Amaravati', text: 'that the wise would later reprove.', alignTo: [0, -1, 1, -1, -1, 3], url: AMARAVATI_URL },
            { by: 'Sujato (SuttaCentral)', text: 'that others might blame them for.', alignTo: [0, 2, -1, 3, -1, -1], url: 'https://suttacentral.net/snp1.8/en/sujato', license: 'CC0' },
            { by: 'Thanissaro (Access to Insight)', text: 'that the wise would later censure.', alignTo: [0, -1, 1, -1, -1, 3], url: 'https://www.accesstoinsight.org/tipitaka/kn/snp/snp.1.08.than.html', license: 'CC BY-NC' },
          ],
          words: [
            {
              form: 'yena',
              pronunciation: 'YAY-nah',
              gloss: 'by which, on account of which. A pointer back to the petty thing in 3a — "[the thing] on account of which the wise would reprove".',
            },
            {
              form: 'viññū',
              pronunciation: 'VEEN-yoo',
              etymology: '*vi-* (apart, fully) + *√jñā* (to know) — "one who fully discerns"',
              gloss: 'the wise — specifically, those with discerning knowledge. Same *√jñā* as English *gnostic*, *recognise*.',
              accent: 'sky',
              morphemes: [
                { text: 'vi', type: 'prefix', gloss: 'a prefix meaning "apart, fully" — adds a discerning, analytical flavour', pronunciation: 'vee' },
                { text: 'ññū', type: 'root', root: '√jñā', gloss: 'from the verb "to know". *Viññū* = "one who discerns, the wise".', pronunciation: 'NYOO' },
              ],
            },
            {
              form: 'pare',
              pronunciation: 'PAH-ray',
              gloss: 'others — the other people, the rest of the community. (Plural of *para* "other".)',
            },
            {
              form: 'upavadeyyuṁ',
              pronunciation: 'oo-pah-vah-DAYY-oom',
              etymology: '*upa-* (near, against) + *√vad* (to speak) — "to speak against, reprove". The "-eyyuṁ" tail makes it "they would speak against".',
              gloss: 'would reprove, would blame — the conditional "would" plus a plural "they".',
              morphemes: [
                { text: 'upa', type: 'prefix', gloss: 'a prefix meaning "near, against" — adds a "speaking-against" flavour to the verb that follows', pronunciation: 'OO-pah' },
                { text: 'vad', type: 'root', root: '√vad', gloss: 'from the verb "to speak". Same root as English *vow* via Indo-European cousins.', pronunciation: 'vahd' },
                { text: 'eyyuṁ', type: 'suffix', gloss: 'the "-eyyuṁ" tail says "they would (do this)". A conditional plural — *vad-eyyuṁ* = "they would speak".', pronunciation: 'AYY-oom' },
              ],
            },
          ],
        },
        // ── v3c: sukhino vā khemino hontu ──
        {
          id: 'v3c-sukhino-khemino',
          pali: 'sukhino vā khemino hontu',
          scripts: [
            { lang: 'pi-Latn', label: 'Pāli', text: 'sukhino vā khemino hontu' },
          ],
          witnesses: [
            { by: 'Amaravati', text: 'Wishing: in gladness and in safety,', alignTo: [3, -1, 0, 1, -1, 2], url: AMARAVATI_URL },
            { by: 'Sujato (SuttaCentral)', text: "'May all beings be happy and safe!", alignTo: [3, -1, -1, 3, 0, 1, 2], url: 'https://suttacentral.net/snp1.8/en/sujato', license: 'CC0' },
            { by: 'Thanissaro (Access to Insight)', text: 'Happy, at rest,', alignTo: [0, -1, 2], url: 'https://www.accesstoinsight.org/tipitaka/kn/snp/snp.1.08.than.html', license: 'CC BY-NC' },
          ],
          words: [
            {
              form: 'sukhino',
              pronunciation: 'SOO-khee-noh',
              etymology: '*sukha* (happiness, ease) + *-in* (possessive) — "having happiness"',
              gloss: 'happy ones, those-with-ease. *Sukha* is the everyday opposite of *dukkha* (suffering) — it just means "the good kind of feeling".',
              accent: 'amber',
            },
            { form: 'vā', pronunciation: 'vah', gloss: 'or — though here it almost reads "and" in the listing.' },
            {
              form: 'khemino',
              pronunciation: 'KHAY-mee-noh',
              etymology: '*khema* (safety, security) + *-in* (possessive) — "having safety"',
              gloss: 'safe ones, those-out-of-danger. *Khema* is the word for the safety of a city behind walls, or a mind out of reach of harm.',
              accent: 'sky',
            },
            {
              form: 'hontu',
              pronunciation: 'HOHN-too',
              etymology: 'from *√hū / √bhū* "to be". The "-ntu" tail makes it "may they be" — a wish or invocation.',
              gloss: 'may [they] be. The wishing voice — the heart of the metta sutta starts here.',
            },
          ],
        },
        // ── v3d: sabbe sattā bhavantu sukhitattā ──
        {
          id: 'v3d-sabbe-satta',
          pali: 'sabbe sattā bhavantu sukhitattā',
          scripts: [
            { lang: 'pi-Latn', label: 'Pāli', text: 'sabbe sattā bhavantu sukhitattā' },
          ],
          witnesses: [
            { by: 'Amaravati', text: 'may all beings be at ease.', alignTo: [-1, 0, 1, 2, -1, -1], url: AMARAVATI_URL },
            { by: 'Sujato (SuttaCentral)', text: "May all beings be happy!'", alignTo: [-1, 0, 1, 2, 3], url: 'https://suttacentral.net/snp1.8/en/sujato', license: 'CC0' },
            { by: 'Thanissaro (Access to Insight)', text: 'may all beings be happy at heart.', alignTo: [-1, 0, 1, 2, 3, -1, 3], url: 'https://www.accesstoinsight.org/tipitaka/kn/snp/snp.1.08.than.html', license: 'CC BY-NC' },
          ],
          words: [
            {
              form: 'sabbe',
              pronunciation: 'SAHB-bay',
              etymology: 'plural of *sabba* "all, every" (Skt *sarva*)',
              gloss: 'all, every. The first appearance of the universalising move — the wish covers *everyone*, with no exception.',
              accent: 'rose',
            },
            {
              form: 'sattā',
              pronunciation: 'SAHT-tah',
              etymology: 'plural of *satta* "being, sentient creature" — from *√as* "to be", literally "those who are"',
              gloss: 'beings, sentient creatures. *Sabbe sattā* = "all beings" is the recurring address of the metta wish.',
              accent: 'rose',
              citations: [dpdCitation('satta')],
            },
            {
              form: 'bhavantu',
              pronunciation: 'bah-VAHN-too',
              etymology: 'from *√bhū* "to be, become" — the "-ntu" tail makes it "may they be"',
              gloss: 'may [they] be. Same wishing voice as *hontu* in 3c; the verb just changes register.',
              morphemes: [
                { text: 'bhav', type: 'root', root: '√bhū', gloss: 'from the verb "to be, become". Same root that gives English *be* through Indo-European cousins.', pronunciation: 'bahv' },
                { text: 'antu', type: 'suffix', gloss: 'the "-antu" tail says "may they (be)". A wishing form — *bhav-antu* = "may they be".', pronunciation: 'AHN-too' },
              ],
            },
            {
              form: 'sukhitattā',
              pronunciation: 'soo-khee-TAHT-tah',
              etymology: '*sukhita* (made-happy) + *-attā* (state, condition — from *attan* "self")',
              gloss: 'happy of heart, in a state of happiness. The "-attā" tail names it as an inner state, not just a passing feeling.',
              accent: 'amber',
              morphemes: [
                { text: 'sukhit', type: 'stem', gloss: '"made happy" — from *sukha* (happiness) with a participle ending', pronunciation: 'soo-KHEET' },
                { text: 'attā', type: 'suffix', gloss: 'the "-attā" tail names the inner state. *Sukhit-attā* = "happy-of-self", happy from the inside.', pronunciation: 'AHT-tah' },
              ],
            },
          ],
        },
        // ── v4a: ye keci pāṇabhūtatthī ──
        {
          id: 'v4a-ye-keci',
          pali: 'ye keci pāṇabhūtatthī',
          scripts: [
            { lang: 'pi-Latn', label: 'Pāli', text: 'ye keci pāṇabhūtatthī' },
          ],
          witnesses: [
            { by: 'Amaravati', text: 'Whatever living beings there may be,', alignTo: [0, 2, 2, -1, -1, -1], url: AMARAVATI_URL },
            { by: 'Sujato (SuttaCentral)', text: 'Whatever creatures there are—', alignTo: [0, 2, -1, -1], url: 'https://suttacentral.net/snp1.8/en/sujato', license: 'CC0' },
            { by: 'Thanissaro (Access to Insight)', text: 'Whatever beings there may be,', alignTo: [0, 2, -1, -1, -1], url: 'https://www.accesstoinsight.org/tipitaka/kn/snp/snp.1.08.than.html', license: 'CC BY-NC' },
          ],
          words: [
            { form: 'ye', pronunciation: 'yay', gloss: 'which (plural) — pointer word, paired with *keci* below to sweep "whoever".' },
            { form: 'keci', pronunciation: 'KAY-chee', gloss: '"some, any (plural)". Together *ye keci* = "whoever there is", a sweeping inclusion.' },
            {
              form: 'pāṇabhūtatthī',
              pronunciation: 'PAH-nah-boo-TAHT-thee',
              etymology: '*pāṇa* (living being, breath) + *bhūta* (existing) + *atthī* (one who is). A piled-up compound emphasising "every kind of being that breathes and exists".',
              gloss: 'every kind of breathing, existing being — Pāli triples the synonym to leave no creature uncovered',
              accent: 'rose',
              morphemes: [
                { text: 'pāṇa', type: 'stem', gloss: 'living being, breath. From *√pan* "to breathe". Same root as English *pneumatic*.', pronunciation: 'PAH-nah' },
                { text: 'bhūt', type: 'root', root: '√bhū', gloss: '"having become, existing" — past form of the verb "to be". Same root as *bhavantu*.', pronunciation: 'BOOT' },
                { text: 'atthī', type: 'suffix', gloss: '"one who is" — adds "the being-one" sense. Final word means "every breathing-existing-being-er".', pronunciation: 'AHT-thee' },
              ],
            },
          ],
        },
        // ── v4b: tasā vā thāvarā vā anavasesā ──
        {
          id: 'v4b-tasa-thavara',
          pali: 'tasā vā thāvarā vā anavasesā',
          scripts: [
            { lang: 'pi-Latn', label: 'Pāli', text: 'tasā vā thāvarā vā anavasesā' },
          ],
          witnesses: [
            { by: 'Amaravati', text: 'whether they are weak or strong, omitting none,', alignTo: [-1, -1, -1, 0, 1, 2, 4, 4], url: AMARAVATI_URL },
            { by: 'Sujato (SuttaCentral)', text: 'none excepted, weak or strong,', alignTo: [4, 4, 0, 1, 2], url: 'https://suttacentral.net/snp1.8/en/sujato', license: 'CC0' },
            { by: 'Thanissaro (Access to Insight)', text: 'weak or strong, without exception,', alignTo: [0, 1, 2, -1, 4], url: 'https://www.accesstoinsight.org/tipitaka/kn/snp/snp.1.08.than.html', license: 'CC BY-NC' },
          ],
          words: [
            { form: 'tasā', pronunciation: 'TAH-sah', gloss: 'tremblers — beings that startle, the still-frightened (creatures still subject to fear). Sometimes rendered "weak".' },
            { form: 'vā', pronunciation: 'vah', gloss: 'or' },
            { form: 'thāvarā', pronunciation: 'TAH-vah-rah', gloss: 'standfast — beings firm, stable, no longer trembling. The pair *tasā / thāvarā* sweeps "the still-fearful and the unshaken".' },
            { form: 'vā', pronunciation: 'vah', gloss: 'or' },
            {
              form: 'anavasesā',
              pronunciation: 'ah-NAH-vah-SAY-sah',
              etymology: '*an-* (not) + *avasesa* (remainder, what is left over)',
              gloss: 'with-no-remainder — leaving none out. Like saying "every last one" in English.',
              morphemes: [
                { text: 'an', type: 'prefix', gloss: 'a prefix meaning "not"', pronunciation: 'ahn' },
                { text: 'avasesā', type: 'stem', gloss: '"remainder, leftover" — *an-avasesā* = "without leftover, with nothing left out"', pronunciation: 'ah-vah-SAY-sah' },
              ],
            },
          ],
        },
        // ── v4c: dīghā vā ye mahantā vā ──
        {
          id: 'v4c-digha-mahanta',
          pali: 'dīghā vā ye mahantā vā',
          scripts: [
            { lang: 'pi-Latn', label: 'Pāli', text: 'dīghā vā ye mahantā vā' },
          ],
          witnesses: [
            { by: 'Amaravati', text: 'the great and the mighty,', alignTo: [-1, 0, -1, -1, 3], url: AMARAVATI_URL },
            { by: 'Sujato (SuttaCentral)', text: 'long or large,', alignTo: [0, 1, 3], url: 'https://suttacentral.net/snp1.8/en/sujato', license: 'CC0' },
            { by: 'Thanissaro (Access to Insight)', text: 'long, large,', alignTo: [0, 3], url: 'https://www.accesstoinsight.org/tipitaka/kn/snp/snp.1.08.than.html', license: 'CC BY-NC' },
          ],
          words: [
            { form: 'dīghā', pronunciation: 'DEE-gah', gloss: 'long ones. Pāli *dīgha* "long" gives the *Dīgha Nikāya* (the Long Discourses) its name.' },
            { form: 'vā', pronunciation: 'vah', gloss: 'or' },
            { form: 'ye', pronunciation: 'yay', gloss: 'which (plural) — opens a new "those who are…" clause' },
            {
              form: 'mahantā',
              pronunciation: 'mah-HAHN-tah',
              etymology: '*mahā* "great" (Skt and Pāli) + *-nt* participle ending — "the great-being ones"',
              gloss: 'great ones, large. Same *mahā-* as in *mahāmantraḥ* in the Heart Sutra.',
            },
            { form: 'vā', pronunciation: 'vah', gloss: 'or' },
          ],
        },
        // ── v4d: majjhimā rassakāṇukathūlā ──
        {
          id: 'v4d-majjhima',
          pali: 'majjhimā rassakāṇukathūlā',
          scripts: [
            { lang: 'pi-Latn', label: 'Pāli', text: 'majjhimā rassakāṇukathūlā' },
          ],
          witnesses: [
            { by: 'Amaravati', text: 'medium, short or small.', alignTo: [0, 1, -1, 1], url: AMARAVATI_URL },
            { by: 'Sujato (SuttaCentral)', text: 'medium-sized, short, slender or thick,', alignTo: [0, 1, 1, -1, 1], url: 'https://suttacentral.net/snp1.8/en/sujato', license: 'CC0' },
            { by: 'Thanissaro (Access to Insight)', text: 'middling, short, subtle, blatant,', alignTo: [0, 1, 1, 1], url: 'https://www.accesstoinsight.org/tipitaka/kn/snp/snp.1.08.than.html', license: 'CC BY-NC' },
          ],
          words: [
            { form: 'majjhimā', pronunciation: 'MAHJ-jhee-mah', gloss: 'middling ones. *Majjhima* is "middle" — gives the *Majjhima Nikāya* (the Middle-Length Discourses) its name. Same idea as "medium".' },
            {
              form: 'rassakāṇukathūlā',
              pronunciation: 'RAHS-sah-KAH-noo-kah-THOO-lah',
              etymology: 'a three-part compound: *rassakā* (short) + *aṇukā* (fine, subtle — same word as in *aṇuvīhī*, "atomic") + *thūlā* (gross, coarse). The whole compound sweeps short-fine-thick — every size.',
              gloss: 'short ones, fine-subtle ones, thick-coarse ones — three sizes piled together to leave none uncovered',
              morphemes: [
                { text: 'rassakā', type: 'stem', gloss: 'short, brief. Plural ending makes it "the short ones".', pronunciation: 'RAHS-sah-kah' },
                { text: 'ṇukā', type: 'stem', gloss: 'subtle, fine, minute. *Aṇu-* gives English speakers *atomic* through Indo-European cousins (Sanskrit *aṇu* = atom).', pronunciation: 'noo-kah' },
                { text: 'thūlā', type: 'stem', gloss: 'gross, thick, coarse — the opposite of *aṇukā*. Together *aṇu-thūla* covers the whole subtle-to-gross axis.', pronunciation: 'THOO-lah' },
              ],
            },
          ],
        },
        // ── v5a: diṭṭhā vā yeva addiṭṭhā ──
        {
          id: 'v5a-dittha-adittha',
          pali: 'diṭṭhā vā yeva addiṭṭhā',
          scripts: [
            { lang: 'pi-Latn', label: 'Pāli', text: 'diṭṭhā vā yeva addiṭṭhā' },
          ],
          witnesses: [
            { by: 'Amaravati', text: 'The seen and the unseen,', alignTo: [-1, 0, 1, -1, 3], url: AMARAVATI_URL },
            { by: 'Sujato (SuttaCentral)', text: 'those who are seen or unseen,', alignTo: [-1, -1, -1, 0, 1, 3], url: 'https://suttacentral.net/snp1.8/en/sujato', license: 'CC0' },
            { by: 'Thanissaro (Access to Insight)', text: 'seen or unseen,', alignTo: [0, 1, 3], url: 'https://www.accesstoinsight.org/tipitaka/kn/snp/snp.1.08.than.html', license: 'CC BY-NC' },
          ],
          words: [
            {
              form: 'diṭṭhā',
              pronunciation: 'DEET-tah',
              etymology: 'past form of *√dṛś* "to see" — "the seen ones" (creatures we can directly perceive)',
              gloss: 'the seen — visible beings we can point to. Same root that gives *dassana* (vision, view) later in the sutta.',
              morphemes: [
                { text: 'diṭ', type: 'root', root: '√dṛś', gloss: 'from the verb "to see"', pronunciation: 'deet' },
                { text: 'ṭhā', type: 'suffix', gloss: 'the "-ṭhā" tail makes the verb into "the seen ones" (plural past form)', pronunciation: 'tah' },
              ],
            },
            { form: 'vā', pronunciation: 'vah', gloss: 'or' },
            { form: 'yeva', pronunciation: 'YAY-vah', gloss: '"just, indeed" — emphasis particle, like English "also" or "as well".' },
            {
              form: 'addiṭṭhā',
              pronunciation: 'AHD-deet-tah',
              etymology: '*a-* (not) + *diṭṭhā* (seen) — "the unseen ones"',
              gloss: 'the unseen — creatures hidden from us (insects in the earth, beings in other realms). The pair *diṭṭhā / addiṭṭhā* sweeps "everything we see and everything we don\'t".',
              morphemes: [
                { text: 'ad', type: 'prefix', gloss: 'the prefix "not" (assimilated *a-* before *d*)', pronunciation: 'ahd' },
                { text: 'diṭṭhā', type: 'stem', root: '√dṛś', gloss: 'same "seen" stem as the previous word — paired here with the negation prefix', pronunciation: 'DEET-tah' },
              ],
            },
          ],
        },
        // ── v5b: ye ca dūre vasanti avidūre ──
        {
          id: 'v5b-dure-avidure',
          pali: 'ye ca dūre vasanti avidūre',
          scripts: [
            { lang: 'pi-Latn', label: 'Pāli', text: 'ye ca dūre vasanti avidūre' },
          ],
          witnesses: [
            { by: 'Amaravati', text: 'those living near and far away,', alignTo: [0, 3, 4, 1, 2, -1], url: AMARAVATI_URL },
            { by: 'Sujato (SuttaCentral)', text: 'those living far or near,', alignTo: [0, 3, 2, 1, 4], url: 'https://suttacentral.net/snp1.8/en/sujato', license: 'CC0' },
            { by: 'Thanissaro (Access to Insight)', text: 'near or far,', alignTo: [4, 1, 2], url: 'https://www.accesstoinsight.org/tipitaka/kn/snp/snp.1.08.than.html', license: 'CC BY-NC' },
          ],
          words: [
            { form: 'ye', pronunciation: 'yay', gloss: 'which (plural) — opens "those who…"' },
            { form: 'ca', pronunciation: 'chah', gloss: 'and' },
            { form: 'dūre', pronunciation: 'DOO-ray', gloss: 'far away (locative). Same word as Skt *dūra*, related to English *durable* through "lasting/distant" semantics.' },
            {
              form: 'vasanti',
              pronunciation: 'vah-SAHN-tee',
              etymology: 'from *√vas* "to dwell, live" — "they dwell"',
              gloss: 'they dwell, they live. The "-anti" tail makes it "they (do)".',
              morphemes: [
                { text: 'vas', type: 'root', root: '√vas', gloss: 'from the verb "to dwell, live in a place"', pronunciation: 'vahs' },
                { text: 'anti', type: 'suffix', gloss: 'the "-anti" tail says "they (do this)" — plural present', pronunciation: 'AHN-tee' },
              ],
            },
            {
              form: 'avidūre',
              pronunciation: 'ah-vee-DOO-ray',
              etymology: '*a-* (not) + *vi-* (apart, away) + *dūre* (far) — "not-far-away"',
              gloss: 'nearby — literally "not-far-away". The double negation gives a softer "near" than a direct word.',
            },
          ],
        },
        // ── v5c: bhūtā vā sambhavesī vā ──
        {
          id: 'v5c-bhuta-sambhavesi',
          pali: 'bhūtā vā sambhavesī vā',
          scripts: [
            { lang: 'pi-Latn', label: 'Pāli', text: 'bhūtā vā sambhavesī vā' },
          ],
          witnesses: [
            { by: 'Amaravati', text: 'those born and to-be-born.', alignTo: [-1, 0, 1, 2], url: AMARAVATI_URL },
            { by: 'Sujato (SuttaCentral)', text: 'those born or to be born—', alignTo: [-1, 0, 1, -1, -1, 2], url: 'https://suttacentral.net/snp1.8/en/sujato', license: 'CC0' },
            { by: 'Thanissaro (Access to Insight)', text: 'born or seeking birth:', alignTo: [0, 1, 2, 2], url: 'https://www.accesstoinsight.org/tipitaka/kn/snp/snp.1.08.than.html', license: 'CC BY-NC' },
          ],
          words: [
            {
              form: 'bhūtā',
              pronunciation: 'BOO-tah',
              etymology: 'past form of *√bhū* "to become" — "those who have become, the existing ones"',
              gloss: 'those who have come into being. *Bhū* gives English speakers *be* through Indo-European cousins.',
              accent: 'sky',
            },
            { form: 'vā', pronunciation: 'vah', gloss: 'or' },
            {
              form: 'sambhavesī',
              pronunciation: 'sahm-BAH-vay-see',
              etymology: '*saṁ-* (together, fully) + *bhava* (being, coming-to-be) + *-esī* (one-who-seeks, from *√iṣ* "to seek")',
              gloss: 'those still seeking to come-into-being — beings yet to be born. Paired with *bhūtā* "already become" — the wish covers both the born and the yet-to-be-born.',
              accent: 'sky',
              morphemes: [
                { text: 'sam', type: 'prefix', gloss: 'the prefix "fully, together" (the *ṁ* assimilates to *m*)', pronunciation: 'sahm' },
                { text: 'bhav', type: 'root', root: '√bhū', gloss: '"becoming, coming-to-be" — same root as *bhūtā*', pronunciation: 'bahv' },
                { text: 'esī', type: 'suffix', root: '√iṣ', gloss: 'from the verb "to seek". *Sam-bhav-esī* = "one who is seeking-to-come-into-being".', pronunciation: 'AY-see' },
              ],
            },
            { form: 'vā', pronunciation: 'vah', gloss: 'or' },
          ],
        },
        // ── v5d: sabbe sattā bhavantu sukhitattā (refrain — same as v3d) ──
        {
          id: 'v5d-sabbe-satta',
          pali: 'sabbe sattā bhavantu sukhitattā',
          scripts: [
            { lang: 'pi-Latn', label: 'Pāli', text: 'sabbe sattā bhavantu sukhitattā' },
          ],
          witnesses: [
            { by: 'Amaravati', text: 'May all beings be at ease!', alignTo: [-1, 0, 1, 2, -1, -1], url: AMARAVATI_URL },
            { by: 'Sujato (SuttaCentral)', text: 'may all beings be happy!', alignTo: [-1, 0, 1, 2, 3], url: 'https://suttacentral.net/snp1.8/en/sujato', license: 'CC0' },
            { by: 'Thanissaro (Access to Insight)', text: 'May all beings be happy at heart.', alignTo: [-1, 0, 1, 2, 3, -1, 3], url: 'https://www.accesstoinsight.org/tipitaka/kn/snp/snp.1.08.than.html', license: 'CC BY-NC' },
          ],
          words: [
            { form: 'sabbe', pronunciation: 'SAHB-bay', gloss: 'all, every — same word as v3d, the refrain that recurs through the sutta.', accent: 'rose' },
            { form: 'sattā', pronunciation: 'SAHT-tah', gloss: 'beings — same word as v3d. *sabbe sattā* is the metta sutta\'s recurring address.', accent: 'rose', citations: [dpdCitation('satta')] },
            { form: 'bhavantu', pronunciation: 'bah-VAHN-too', gloss: 'may [they] be — the wishing voice from v3d, repeated here as the refrain closes the stanza.' },
            { form: 'sukhitattā', pronunciation: 'soo-khee-TAHT-tah', gloss: 'happy of heart, happy from the inside — same word as v3d.', accent: 'amber' },
          ],
        },
        // ── v6a: na paro paraṁ nikubbetha ──
        {
          id: 'v6a-na-paro-param',
          pali: 'na paro paraṁ nikubbetha',
          scripts: [
            { lang: 'pi-Latn', label: 'Pāli', text: 'na paro paraṁ nikubbetha' },
          ],
          witnesses: [
            { by: 'Amaravati', text: 'Let none deceive another,', alignTo: [-1, 0, 3, 2], url: AMARAVATI_URL },
            { by: 'Sujato (SuttaCentral)', text: 'Let none deceive another,', alignTo: [-1, 0, 3, 2], url: 'https://suttacentral.net/snp1.8/en/sujato', license: 'CC0' },
            { by: 'Thanissaro (Access to Insight)', text: 'Let no one deceive another', alignTo: [-1, 0, 1, 3, 2], url: 'https://www.accesstoinsight.org/tipitaka/kn/snp/snp.1.08.than.html', license: 'CC BY-NC' },
          ],
          words: [
            { form: 'na', pronunciation: 'nah', gloss: 'not. Negates the verb at the end of the line.' },
            { form: 'paro', pronunciation: 'PAH-roh', gloss: 'one person, "the other one" (subject form). *Para* = "other" — same root as English *par* / *peer*.' },
            {
              form: 'paraṁ',
              pronunciation: 'PAH-rahm',
              etymology: '*para* "other" + *-ṁ* (object-of-the-action ending)',
              gloss: '"the other one" (object form). Pāli repeats *paro/paraṁ* — "one-person, the-other-person" — instead of saying "anyone…anyone".',
            },
            {
              form: 'nikubbetha',
              pronunciation: 'nee-KOOB-bay-tah',
              etymology: '*ni-* (down, against) + *√kub* (a verb of crookedness, "to cheat") + the "-etha" tail (third-person "let him/her"). Together: "let one deceive".',
              gloss: 'should deceive, should cheat. With *na* in front: "let no one deceive".',
              morphemes: [
                { text: 'ni', type: 'prefix', gloss: 'a prefix meaning "down, against" — adds an against-someone flavour', pronunciation: 'nee' },
                { text: 'kubb', type: 'root', root: '√kub', gloss: 'from a verb meaning "to be crooked, to cheat"', pronunciation: 'KOOB' },
                { text: 'etha', type: 'suffix', gloss: 'the "-etha" tail says "let one (do this)" — a gentle command', pronunciation: 'AY-tah' },
              ],
            },
          ],
        },
        // ── v6b: nātimaññetha katthaci naṁ kanci ──
        {
          id: 'v6b-natimannetha',
          pali: 'nātimaññetha katthaci naṁ kanci',
          scripts: [
            { lang: 'pi-Latn', label: 'Pāli', text: 'nātimaññetha katthaci naṁ kanci' },
          ],
          witnesses: [
            { by: 'Amaravati', text: 'or despise any being in any state.', alignTo: [-1, 0, 3, 3, -1, 1, 1], url: AMARAVATI_URL },
            { by: 'Sujato (SuttaCentral)', text: 'nor despise anyone anywhere,', alignTo: [-1, 0, 3, 1], url: 'https://suttacentral.net/snp1.8/en/sujato', license: 'CC0' },
            { by: 'Thanissaro (Access to Insight)', text: 'or despise anyone anywhere,', alignTo: [-1, 0, 3, 1], url: 'https://www.accesstoinsight.org/tipitaka/kn/snp/snp.1.08.than.html', license: 'CC BY-NC' },
          ],
          words: [
            {
              form: 'nātimaññetha',
              pronunciation: 'NAH-tee-MAHN-yay-tah',
              etymology: '*na* (not) + *ati-* (over, excessive) + *maññetha* (one should think/regard — from *√man* "to think"). The whole verb: "should not think-down-upon", "should not despise".',
              gloss: '"should not despise" — should not regard someone as less than oneself. The same *ati-māna* "excessive self-regard" we met in v1 as *anatimānī*, but now phrased as an action.',
              morphemes: [
                { text: 'na', type: 'prefix', gloss: 'the negation "not" — runs together with the verb', pronunciation: 'nah' },
                { text: 'ati', type: 'prefix', gloss: 'over, excessive — same prefix as in *anatimānī* (v1)', pronunciation: 'AH-tee' },
                { text: 'maññetha', type: 'stem', root: '√man', gloss: 'from the verb "to think, regard". The "-etha" tail makes it "let one think/regard".', pronunciation: 'MAHN-yay-tah' },
              ],
            },
            { form: 'katthaci', pronunciation: 'KAHT-tah-chee', gloss: '"anywhere" (the *-ci* suffix makes pronouns sweeping — like English "-ever" in "wherever").' },
            { form: 'naṁ', pronunciation: 'nahm', gloss: 'him (object form of "this one"). Refers back to the *paro* introduced in 6a.' },
            { form: 'kanci', pronunciation: 'KAHN-chee', gloss: '"anyone" — *ka* "who" + *-ci* sweeping. Together with *katthaci*: "anywhere, anyone".' },
          ],
        },
        // ── v6c: byārosanā paṭighasaññā ──
        {
          id: 'v6c-byarosana-patighasanna',
          pali: 'byārosanā paṭighasaññā',
          scripts: [
            { lang: 'pi-Latn', label: 'Pāli', text: 'byārosanā paṭighasaññā' },
          ],
          witnesses: [
            { by: 'Amaravati', text: 'Let none through anger or ill-will', alignTo: [-1, -1, -1, 0, 1, 1], url: AMARAVATI_URL },
            { by: 'Sujato (SuttaCentral)', text: 'out of anger or hostility.', alignTo: [-1, -1, 0, 1, 1], url: 'https://suttacentral.net/snp1.8/en/sujato', license: 'CC0' },
            { by: 'Thanissaro (Access to Insight)', text: 'or through anger or irritation', alignTo: [-1, -1, 0, 1, 1], url: 'https://www.accesstoinsight.org/tipitaka/kn/snp/snp.1.08.than.html', license: 'CC BY-NC' },
          ],
          words: [
            {
              form: 'byārosanā',
              pronunciation: 'byah-ROH-sah-nah',
              etymology: '*vi-* (apart) + *ā-* (toward) + *√ruṣ* "to be angry" — "anger turned against someone"',
              gloss: 'out of anger — the hot kind of anger that flares outward toward a specific target',
            },
            {
              form: 'paṭighasaññā',
              pronunciation: 'pah-TEE-gah-SAHN-yah',
              etymology: '*paṭi-* (back, against) + *gha* (striking — from *√han* "to strike") + *saññā* (perception, sense)',
              gloss: 'with a sense of resistance — the cold pushed-back-against feeling of ill-will, distinct from hot anger. *Paṭigha* is the technical term for aversion in Buddhist psychology.',
              morphemes: [
                { text: 'paṭi', type: 'prefix', gloss: 'a prefix meaning "back, against" — adds a "pushing-back" flavour', pronunciation: 'pah-TEE' },
                { text: 'gha', type: 'stem', root: '√han', gloss: 'from the verb "to strike". *Paṭi-gha* = "strike-back" — the recoiling, push-back of aversion.', pronunciation: 'gah' },
                { text: 'saññā', type: 'stem', gloss: 'perception, sense, recognising. Adds an "experiencing-as" flavour — *paṭighasaññā* = "the experience of pushing-back".', pronunciation: 'SAHN-yah' },
              ],
            },
          ],
        },
        // ── v6d: nāññamaññassa dukkhamiccheyya ──
        {
          id: 'v6d-aniccheyya',
          pali: 'nāññamaññassa dukkhamiccheyya',
          scripts: [
            { lang: 'pi-Latn', label: 'Pāli', text: 'nāññamaññassa dukkhamiccheyya' },
          ],
          witnesses: [
            { by: 'Amaravati', text: 'wish harm upon another.', alignTo: [1, 1, -1, 0], url: AMARAVATI_URL },
            { by: 'Sujato (SuttaCentral)', text: 'nor wish harm for one another', alignTo: [-1, 1, 1, -1, 0, 0], url: 'https://suttacentral.net/snp1.8/en/sujato', license: 'CC0' },
            { by: 'Thanissaro (Access to Insight)', text: 'wish for another to suffer.', alignTo: [1, -1, 0, -1, 1], url: 'https://www.accesstoinsight.org/tipitaka/kn/snp/snp.1.08.than.html', license: 'CC BY-NC' },
          ],
          words: [
            {
              form: 'nāññamaññassa',
              pronunciation: 'NAHN-yah-MAHN-yahs-sah',
              etymology: '*na* (not) + *aññamañña* "one-another" (the Pāli word for reciprocity) + *-assa* (object marker, "to/for")',
              gloss: '"not for one-another" — the line\'s subject. *Aññamañña* literally pairs two "other"s: "this-other and that-other", i.e. reciprocally.',
              morphemes: [
                { text: 'na', type: 'prefix', gloss: 'the negation "not"', pronunciation: 'nah' },
                { text: 'aññamañña', type: 'stem', gloss: 'the Pāli word for reciprocity — *añña* "other" doubled to mean "one-another, mutually"', pronunciation: 'AHN-yah-MAHN-yah' },
                { text: 'ssa', type: 'suffix', gloss: 'the "-(a)ssa" tail marks "to" or "for" — *aññamaññassa* = "for one another"', pronunciation: 'sah' },
              ],
            },
            {
              form: 'dukkhamiccheyya',
              pronunciation: 'DOOK-kah-meech-CHAYY-yah',
              etymology: '*dukkha* (suffering — the First Noble Truth term) + *iccheyya* (one should wish — from *√iṣ* "to wish, desire")',
              gloss: 'should wish suffering — the verb the line negates with *na*. Together: "should not wish suffering for one-another".',
              morphemes: [
                { text: 'dukkham', type: 'stem', gloss: 'suffering — the First Noble Truth term. The "-am" tail marks it as the object of the wishing.', pronunciation: 'DOOK-kahm' },
                { text: 'iccheyya', type: 'stem', root: '√iṣ', gloss: 'from the verb "to wish, desire". The "-eyya" tail says "should/would wish".', pronunciation: 'eech-CHAYY-yah' },
              ],
            },
          ],
        },
        // ── v7a: mātā yathā niyaṁ puttaṁ ──
        {
          id: 'v7a-mata-yatha',
          pali: 'mātā yathā niyaṁ puttaṁ',
          scripts: [
            { lang: 'pi-Latn', label: 'Pāli', text: 'mātā yathā niyaṁ puttaṁ' },
          ],
          witnesses: [
            { by: 'Amaravati', text: 'Even as a mother', alignTo: [-1, 1, -1, 0], url: AMARAVATI_URL },
            { by: 'Sujato (SuttaCentral)', text: 'As a mother', alignTo: [1, -1, 0], url: 'https://suttacentral.net/snp1.8/en/sujato', license: 'CC0' },
            { by: 'Thanissaro (Access to Insight)', text: 'As a mother', alignTo: [1, -1, 0], url: 'https://www.accesstoinsight.org/tipitaka/kn/snp/snp.1.08.than.html', license: 'CC BY-NC' },
          ],
          words: [
            {
              form: 'mātā',
              pronunciation: 'MAH-tah',
              etymology: 'Pāli *mātā* "mother". Same root that gives English *mother*, Latin *mater*, Greek *meter* through Indo-European cousins.',
              gloss: 'a mother — the subject of the line. The simile that the next three lines unpack.',
            },
            {
              form: 'yathā',
              pronunciation: 'yah-TAH',
              gloss: '"as, like" — the simile word. *Yathā… evampi…* = "as… even so…" frames the whole verse.',
            },
            {
              form: 'niyaṁ',
              pronunciation: 'NEE-yahm',
              gloss: '"own, of-one\'s-own". Same root as Skt *nija* "innate". Emphasises that the child is the mother\'s own.',
            },
            {
              form: 'puttaṁ',
              pronunciation: 'POOT-tahm',
              etymology: 'Pāli *putta* "son, child" + the *-ṁ* tail (object of the action)',
              gloss: 'a child, a son (object form). Same root as Skt *putra*.',
            },
          ],
        },
        // ── v7b: āyusā ekaputtamanurakkhe ──
        {
          id: 'v7b-ayusa-ekaputta',
          pali: 'āyusā ekaputtamanurakkhe',
          scripts: [
            { lang: 'pi-Latn', label: 'Pāli', text: 'āyusā ekaputtamanurakkhe' },
          ],
          witnesses: [
            { by: 'Amaravati', text: 'protects with her life her child, her only child,', alignTo: [1, -1, 0, 0, 1, 1, 1, 1, 1], url: AMARAVATI_URL },
            { by: 'Sujato (SuttaCentral)', text: 'would protect with her life her one and only child,', alignTo: [-1, 1, -1, 0, 0, 1, 1, -1, 1, 1], url: 'https://suttacentral.net/snp1.8/en/sujato', license: 'CC0' },
            { by: 'Thanissaro (Access to Insight)', text: 'would risk her life to protect her child, her only child,', alignTo: [-1, -1, 0, 0, -1, 1, 1, 1, -1, 1, 1], url: 'https://www.accesstoinsight.org/tipitaka/kn/snp/snp.1.08.than.html', license: 'CC BY-NC' },
          ],
          words: [
            {
              form: 'āyusā',
              pronunciation: 'AH-yoo-sah',
              etymology: '*āyu* "life, lifespan" + *-sā* (ending marking "by means of" — "with her life")',
              gloss: '"with her life" — the cost the mother pays. *Āyu* is the same word in *Āyurveda* ("knowledge of life").',
            },
            {
              form: 'ekaputtamanurakkhe',
              pronunciation: 'AY-kah-POOT-tah-mah-noo-RAHK-khay',
              etymology: '*eka* (one) + *putta* (child) + *anurakkhe* (would protect — *anu-* "along, after" + *√rakṣ* "to protect")',
              gloss: '"would protect her one-and-only child". A four-piece compound: *one* + *child* + *along-with* + *protect*. The whole verse pivots on this image — the limit-case of love.',
              accent: 'amber',
              morphemes: [
                { text: 'eka', type: 'prefix', gloss: '"one, only" — emphasises the only-child framing', pronunciation: 'AY-kah' },
                { text: 'putta', type: 'stem', gloss: '"child, son" — same word as *puttaṁ* in 7a', pronunciation: 'POOT-tah' },
                { text: 'manu', type: 'prefix', gloss: 'sandhi form of *anu-* ("along, after") — the *m* at the join is a sound-bridging consonant', pronunciation: 'mah-noo' },
                { text: 'rakkhe', type: 'root', root: '√rakṣ', gloss: 'from the verb "to protect, guard". The "-e" tail makes it "would protect" — the wishful voice.', pronunciation: 'RAHK-khay' },
              ],
            },
          ],
        },
        // ── v7c: evampi sabbabhūtesu ──
        {
          id: 'v7c-evampi-sabbabhuta',
          pali: 'evampi sabbabhūtesu',
          scripts: [
            { lang: 'pi-Latn', label: 'Pāli', text: 'evampi sabbabhūtesu' },
          ],
          witnesses: [
            { by: 'Amaravati', text: 'so should one protect the boundless heart that loves all beings.', alignTo: [0, -1, -1, -1, -1, -1, -1, -1, -1, 1, 1], url: AMARAVATI_URL },
            { by: 'Sujato (SuttaCentral)', text: "so they'd cultivate a heart of love without limit for all sentient beings.", alignTo: [0, -1, -1, -1, -1, -1, -1, -1, -1, -1, 1, 1, 1], url: 'https://suttacentral.net/snp1.8/en/sujato', license: 'CC0' },
            { by: 'Thanissaro (Access to Insight)', text: 'even so should one cultivate the heart limitlessly with regard to all beings.', alignTo: [0, 0, -1, -1, -1, -1, -1, -1, -1, -1, -1, 1, 1], url: 'https://www.accesstoinsight.org/tipitaka/kn/snp/snp.1.08.than.html', license: 'CC BY-NC' },
          ],
          words: [
            {
              form: 'evampi',
              pronunciation: 'AY-vahm-pee',
              etymology: '*evaṁ* "thus, in this way" + *pi* "too, also"',
              gloss: '"even so", "in just this way too". The simile-pivot — *yathā* in 7a was "as"; *evampi* here completes "as… so too…".',
              morphemes: [
                { text: 'evam', type: 'stem', gloss: '"thus, in this way" — Pāli\'s pointer-back word', pronunciation: 'AY-vahm' },
                { text: 'pi', type: 'suffix', gloss: '"too, also" — emphasises the parallel: "even so, just so"', pronunciation: 'pee' },
              ],
            },
            {
              form: 'sabbabhūtesu',
              pronunciation: 'SAHB-bah-BOO-tay-soo',
              etymology: '*sabba* (all) + *bhūta* (being, existing — same word as v5c) + *-esu* (plural "in/among")',
              gloss: '"in/toward all beings" — the wide target of the cultivation. The "-esu" tail marks plural location: like English "among all beings".',
              accent: 'rose',
              morphemes: [
                { text: 'sabba', type: 'stem', gloss: '"all, every" — same root as *sabbe* in v3d', pronunciation: 'SAHB-bah' },
                { text: 'bhūt', type: 'root', root: '√bhū', gloss: '"being, having become" — same root as *bhūtā* in v5c', pronunciation: 'BOOT' },
                { text: 'esu', type: 'suffix', gloss: 'the "-esu" tail marks "among/in" with a plural — "among all beings"', pronunciation: 'AY-soo' },
              ],
            },
          ],
        },
        // ── v7d: mānasaṁ bhāvaye aparimāṇaṁ ──
        {
          id: 'v7d-manasam-bhavaye',
          pali: 'mānasaṁ bhāvaye aparimāṇaṁ',
          scripts: [
            { lang: 'pi-Latn', label: 'Pāli', text: 'mānasaṁ bhāvaye aparimāṇaṁ' },
          ],
          witnesses: [
            { by: 'Amaravati', text: 'so should one protect the boundless heart that loves all beings.', alignTo: [-1, -1, -1, -1, -1, 2, 0, -1, -1, -1, -1], url: AMARAVATI_URL },
            { by: 'Sujato (SuttaCentral)', text: 'cultivate a heart of love without limit', alignTo: [1, -1, 0, -1, -1, -1, 2], url: 'https://suttacentral.net/snp1.8/en/sujato', license: 'CC0' },
            { by: 'Thanissaro (Access to Insight)', text: 'cultivate the heart limitlessly', alignTo: [1, -1, 0, 2], url: 'https://www.accesstoinsight.org/tipitaka/kn/snp/snp.1.08.than.html', license: 'CC BY-NC' },
          ],
          words: [
            {
              form: 'mānasaṁ',
              pronunciation: 'MAH-nah-sahm',
              etymology: '*manas* (mind, heart-mind) + the *-aṁ* tail (object form). The thing-to-be-cultivated.',
              gloss: 'the heart-mind — *manas* covers what English splits into "mind" + "heart". The thing the line says to cultivate.',
              accent: 'sky',
              citations: [dpdCitation('manas')],
            },
            {
              form: 'bhāvaye',
              pronunciation: 'BAH-vah-yay',
              etymology: 'wishing form of the verb *bhāveti* "to cultivate, bring into being". *Bhāveti* is the same root *√bhū* "to be", in its causative form: "to *cause to become*".',
              gloss: '"let one cultivate, let one bring into being". The technical term for meditative cultivation — *bhāvanā* (development) shares this root. Whatever the action is here, it\'s a *bringing into being*, not just a feeling.',
              accent: 'amber',
              morphemes: [
                { text: 'bhāv', type: 'root', root: '√bhū', gloss: 'from the verb "to be, become" — same root as *bhavantu* in v3d. Here in causative: "to make-become, to cultivate".', pronunciation: 'bahv' },
                { text: 'aye', type: 'suffix', gloss: 'the "-aye" tail says "would/should (do this)" — a wish or gentle instruction', pronunciation: 'AH-yay' },
              ],
              citations: [dpdCitation('bhāveti')],
            },
            {
              form: 'aparimāṇaṁ',
              pronunciation: 'ah-PAH-ree-MAH-nahm',
              etymology: '*a-* (not) + *parimāṇa* (measure, limit — from *pari-* "around" + *√mā* "to measure")',
              gloss: '"limitless, without measure" — describing the *mānasaṁ* (heart-mind) the line says to cultivate. Same root *√mā* gives English speakers *measure* through Indo-European cousins.',
              accent: 'rose',
              morphemes: [
                { text: 'a', type: 'prefix', gloss: '"not"', pronunciation: 'ah' },
                { text: 'pari', type: 'prefix', gloss: '"around, all-around" — adds an enclosing flavour to the next part', pronunciation: 'PAH-ree' },
                { text: 'māṇaṁ', type: 'stem', root: '√mā', gloss: 'from the verb "to measure". *Pari-māṇa* = "all-around-measure" = limit. *A-pari-māṇa* = "without limit, boundless".', pronunciation: 'MAH-nahm' },
              ],
            },
          ],
        },
        // ── v8a: mettañca sabbalokasmiṁ ──
        {
          id: 'v8a-metta-sabbaloka',
          pali: 'mettañca sabbalokasmiṁ',
          scripts: [
            { lang: 'pi-Latn', label: 'Pāli', text: 'mettañca sabbalokasmiṁ' },
          ],
          witnesses: [
            { by: 'Amaravati', text: 'Radiating kindness over the entire world:', alignTo: [-1, 0, -1, -1, 1, 1], url: AMARAVATI_URL },
            { by: 'Sujato (SuttaCentral)', text: 'With love for the whole world,', alignTo: [-1, 0, -1, -1, 1, 1], url: 'https://suttacentral.net/snp1.8/en/sujato', license: 'CC0' },
            { by: 'Thanissaro (Access to Insight)', text: 'With good will for the entire cosmos,', alignTo: [-1, 0, 0, -1, -1, 1, 1], url: 'https://www.accesstoinsight.org/tipitaka/kn/snp/snp.1.08.than.html', license: 'CC BY-NC' },
          ],
          words: [
            {
              form: 'mettañca',
              pronunciation: 'MAYT-tahn-chah',
              etymology: '*mettā* (loving-kindness, friendliness) + *ca* "and" — the consonant clusters together for chant rhythm',
              gloss: 'and loving-kindness. *Mettā* is the name-virtue of the sutta — not affection or warmth alone, but a steady goodwill toward every being without exception. Related to *mitta* "friend".',
              accent: 'rose',
              citations: [dpdCitation('mettā')],
              morphemes: [
                { text: 'mettañ', type: 'stem', gloss: '*mettā* "loving-kindness" — the sutta\'s name-virtue. Sound-merged with the next word *ca*.', pronunciation: 'MAYT-tahn' },
                { text: 'ca', type: 'suffix', gloss: '"and" — same word as elsewhere; here joined to the previous word by chant rhythm', pronunciation: 'chah' },
              ],
            },
            {
              form: 'sabbalokasmiṁ',
              pronunciation: 'SAHB-bah-LOH-kah-smeem',
              etymology: '*sabba* (all) + *loka* (world) + *-smiṁ* (the "in/at" ending)',
              gloss: '"in the whole world" — the wide target. *Loka* is "world" in the cosmological sense, covering all realms of existence.',
              morphemes: [
                { text: 'sabba', type: 'stem', gloss: '"all, every" — same root as *sabbe* in v3d, v5d', pronunciation: 'SAHB-bah' },
                { text: 'loka', type: 'stem', gloss: '"world, realm" — covers all the realms of existence in Buddhist cosmology', pronunciation: 'LOH-kah' },
                { text: 'smiṁ', type: 'suffix', gloss: 'the "-smiṁ" tail says "in/at" — *sabba-loka-smiṁ* = "in the whole world"', pronunciation: 'smeem' },
              ],
            },
          ],
        },
        // ── v8b: mānasaṁ bhāvaye aparimāṇaṁ (refrain — same as v7d) ──
        {
          id: 'v8b-manasam-bhavaye',
          pali: 'mānasaṁ bhāvaye aparimāṇaṁ',
          scripts: [
            { lang: 'pi-Latn', label: 'Pāli', text: 'mānasaṁ bhāvaye aparimāṇaṁ' },
          ],
          witnesses: [
            { by: 'Amaravati', text: 'spreading upwards to the skies,', alignTo: [-1, -1, -1, -1, -1], url: AMARAVATI_URL },
            { by: 'Sujato (SuttaCentral)', text: "they'd cultivate a heart that's limitless,", alignTo: [-1, 1, -1, 0, -1, 2], url: 'https://suttacentral.net/snp1.8/en/sujato', license: 'CC0' },
            { by: 'Thanissaro (Access to Insight)', text: 'cultivate a limitless heart:', alignTo: [1, -1, 2, 0], url: 'https://www.accesstoinsight.org/tipitaka/kn/snp/snp.1.08.than.html', license: 'CC BY-NC' },
          ],
          words: [
            { form: 'mānasaṁ', pronunciation: 'MAH-nah-sahm', gloss: 'the heart-mind — same word as v7d. The refrain returns: cultivate this thing, boundlessly.', accent: 'sky', citations: [dpdCitation('manas')] },
            { form: 'bhāvaye', pronunciation: 'BAH-vah-yay', gloss: 'let one cultivate — same wishing form as v7d. The technical term for meditative cultivation.', accent: 'amber', citations: [dpdCitation('bhāveti')] },
            { form: 'aparimāṇaṁ', pronunciation: 'ah-PAH-ree-MAH-nahm', gloss: 'boundless, without measure — same word as v7d. The line completes the refrain.', accent: 'rose' },
          ],
        },
        // ── v8c: uddhaṁ adho ca tiriyañca ──
        {
          id: 'v8c-uddham-adho',
          pali: 'uddhaṁ adho ca tiriyañca',
          scripts: [
            { lang: 'pi-Latn', label: 'Pāli', text: 'uddhaṁ adho ca tiriyañca' },
          ],
          witnesses: [
            { by: 'Amaravati', text: 'and downwards to the depths;', alignTo: [2, 1, -1, -1, 1], url: AMARAVATI_URL },
            { by: 'Sujato (SuttaCentral)', text: 'upwards, downwards and side-to-side,', alignTo: [0, 1, 2, 3], url: 'https://suttacentral.net/snp1.8/en/sujato', license: 'CC0' },
            { by: 'Thanissaro (Access to Insight)', text: 'above, below, & all around,', alignTo: [0, 1, 2, 3, 3], url: 'https://www.accesstoinsight.org/tipitaka/kn/snp/snp.1.08.than.html', license: 'CC BY-NC' },
          ],
          words: [
            { form: 'uddhaṁ', pronunciation: 'OOD-dahm', gloss: 'upward — the direction-word for "above". The radiating-out begins.' },
            { form: 'adho', pronunciation: 'AH-doh', gloss: 'downward — paired with *uddhaṁ* "upward". Vertical sweep.' },
            { form: 'ca', pronunciation: 'chah', gloss: 'and' },
            {
              form: 'tiriyañca',
              pronunciation: 'TEE-ree-yahn-chah',
              etymology: '*tiriyaṁ* "across, horizontally" + *ca* "and" — sound-merged together',
              gloss: '"and across" — completing the three-axis sweep: up + down + sideways. *Tiriya* is "transverse, horizontal" — the metta covers all directions.',
              morphemes: [
                { text: 'tiriyañ', type: 'stem', gloss: '"across, horizontally" — the third axis, completing up + down + side', pronunciation: 'TEE-ree-yahn' },
                { text: 'ca', type: 'suffix', gloss: '"and" — joined to the previous word', pronunciation: 'chah' },
              ],
            },
          ],
        },
        // ── v8d: asambādhaṁ averaṁ asapattaṁ ──
        {
          id: 'v8d-asambadham-averam',
          pali: 'asambādhaṁ averaṁ asapattaṁ',
          scripts: [
            { lang: 'pi-Latn', label: 'Pāli', text: 'asambādhaṁ averaṁ asapattaṁ' },
          ],
          witnesses: [
            { by: 'Amaravati', text: 'outwards and unbounded, freed from hatred and ill-will.', alignTo: [-1, -1, 0, -1, -1, 1, -1, 2], url: AMARAVATI_URL },
            { by: 'Sujato (SuttaCentral)', text: 'unbounded, free of enmity and hate.', alignTo: [0, 1, 1, 2, -1, 1], url: 'https://suttacentral.net/snp1.8/en/sujato', license: 'CC0' },
            { by: 'Thanissaro (Access to Insight)', text: 'unobstructed, without enmity or hate.', alignTo: [0, 1, 1, -1, 2], url: 'https://www.accesstoinsight.org/tipitaka/kn/snp/snp.1.08.than.html', license: 'CC BY-NC' },
          ],
          words: [
            {
              form: 'asambādhaṁ',
              pronunciation: 'ah-sahm-BAH-dahm',
              etymology: '*a-* (not) + *sambādha* (crowded, narrow, constricted)',
              gloss: '"uncrowded, unconstricted" — the metta-heart has no walls penning it in. *Sambādha* is "narrow", *asambādha* is "wide open".',
              morphemes: [
                { text: 'a', type: 'prefix', gloss: '"not"', pronunciation: 'ah' },
                { text: 'sambādhaṁ', type: 'stem', gloss: '"narrow, constricted, crowded". *A-sambādhaṁ* = "without constriction, wide-open".', pronunciation: 'sahm-BAH-dahm' },
              ],
            },
            {
              form: 'averaṁ',
              pronunciation: 'ah-VAY-rahm',
              etymology: '*a-* (not) + *vera* (hatred, enmity)',
              gloss: '"without hate". *Vera* is the technical term for enmity that perpetuates itself across lifetimes — the kind of grudge that won\'t let go. *A-vera* is the heart with no grudge.',
              accent: 'sky',
              morphemes: [
                { text: 'a', type: 'prefix', gloss: '"not"', pronunciation: 'ah' },
                { text: 'veraṁ', type: 'stem', gloss: '"hatred, enmity, grudge" — the technical Buddhist term for hate that perpetuates itself. *A-vera* = "without grudge".', pronunciation: 'VAY-rahm' },
              ],
            },
            {
              form: 'asapattaṁ',
              pronunciation: 'ah-sah-PAHT-tahm',
              etymology: '*a-* (not) + *sapatta* (enemy, rival)',
              gloss: '"without enemy" — without anyone the heart sets itself against. *Sapatta* is "rival, adversary" — *asapatta* is the heart with no adversary.',
              morphemes: [
                { text: 'a', type: 'prefix', gloss: '"not"', pronunciation: 'ah' },
                { text: 'sapattaṁ', type: 'stem', gloss: '"rival, enemy". *A-sapatta* = "with no rival, with no one to oppose".', pronunciation: 'sah-PAHT-tahm' },
              ],
            },
          ],
        },
        // ── v9a: tiṭṭhaṁ caraṁ nisinno vā ──
        {
          id: 'v9a-tittham-caram',
          pali: 'tiṭṭhaṁ caraṁ nisinno vā',
          scripts: [
            { lang: 'pi-Latn', label: 'Pāli', text: 'tiṭṭhaṁ caraṁ nisinno vā' },
          ],
          witnesses: [
            { by: 'Amaravati', text: 'Whether standing or walking, seated', alignTo: [-1, 0, 3, 1, 2], url: AMARAVATI_URL },
            { by: 'Sujato (SuttaCentral)', text: 'Standing, walking, sitting,', alignTo: [0, 1, 2], url: 'https://suttacentral.net/snp1.8/en/sujato', license: 'CC0' },
            { by: 'Thanissaro (Access to Insight)', text: 'Whether standing, walking, sitting,', alignTo: [-1, 0, 1, 2], url: 'https://www.accesstoinsight.org/tipitaka/kn/snp/snp.1.08.than.html', license: 'CC BY-NC' },
          ],
          words: [
            {
              form: 'tiṭṭhaṁ',
              pronunciation: 'TEET-tahm',
              etymology: 'present-form of *√sthā* "to stand" — "standing, while-standing"',
              gloss: 'standing — the first of the four postures. Same *√sthā* gives English speakers *stand* through Indo-European cousins.',
            },
            {
              form: 'caraṁ',
              pronunciation: 'CHAH-rahm',
              etymology: 'present-form of *√car* "to walk, go" — same root as *samācare* in v3a',
              gloss: 'walking — the second posture.',
            },
            {
              form: 'nisinno',
              pronunciation: 'nee-SEEN-noh',
              etymology: '*ni-* (down) + past form of *√sad* "to sit" — "sat down"',
              gloss: 'seated — the third posture. The *ni-* prefix adds "down".',
              morphemes: [
                { text: 'ni', type: 'prefix', gloss: '"down" — same prefix as in *nikubbetha* in v6a', pronunciation: 'nee' },
                { text: 'sinno', type: 'root', root: '√sad', gloss: 'from the verb "to sit". Same root that gives English *settle* and *sediment* through Indo-European cousins.', pronunciation: 'SEEN-noh' },
              ],
            },
            { form: 'vā', pronunciation: 'vah', gloss: 'or' },
          ],
        },
        // ── v9b: sayāno vā yāvat'assa vigatamiddho ──
        {
          id: 'v9b-sayano-vigatamiddho',
          pali: "sayāno vā yāvat'assa vigatamiddho",
          scripts: [
            { lang: 'pi-Latn', label: 'Pāli', text: "sayāno vā yāvat'assa vigatamiddho", tokens: ['sayāno', 'vā', "yāvat'assa", 'vigatamiddho'] },
          ],
          witnesses: [
            { by: 'Amaravati', text: 'or lying down, free from drowsiness,', alignTo: [1, 0, 0, -1, -1, 3], url: AMARAVATI_URL },
            { by: 'Sujato (SuttaCentral)', text: "or lying down— as long as they're not drowsy—", alignTo: [1, 0, 0, -1, 2, 2, -1, -1, 3], url: 'https://suttacentral.net/snp1.8/en/sujato', license: 'CC0' },
            { by: 'Thanissaro (Access to Insight)', text: 'or lying down, as long as one is alert,', alignTo: [1, 0, 0, 2, 2, 2, -1, -1, 3], url: 'https://www.accesstoinsight.org/tipitaka/kn/snp/snp.1.08.than.html', license: 'CC BY-NC' },
          ],
          words: [
            { form: 'sayāno', pronunciation: 'sah-YAH-noh', etymology: 'from *√śī* "to lie down"', gloss: 'lying down — the fourth posture. Together with the three above, the verse covers every bodily state.' },
            { form: 'vā', pronunciation: 'vah', gloss: 'or' },
            { form: "yāvat'assa", pronunciation: 'YAH-vaht-AHS-sah', gloss: '"as long as [one] is" — a clause-opener. *Yāvat* "as long as" + *assa* "would be".' },
            {
              form: 'vigatamiddho',
              pronunciation: 'vee-GAH-tah-MEED-doh',
              etymology: '*vi-* (away) + *gata* (gone) + *middha* (drowsiness, torpor)',
              gloss: '"with drowsiness gone away" — alert, free of the sluggish-mind state. *Middha* is one of the five hindrances (drowsiness) in Buddhist psychology.',
              morphemes: [
                { text: 'vigata', type: 'prefix', gloss: '"gone away, departed" — *vi-* "away" + *gata* "gone"', pronunciation: 'vee-GAH-tah' },
                { text: 'middho', type: 'stem', gloss: '"drowsiness, torpor" — one of the five hindrances. *Vi-gata-middho* = "the one whose drowsiness has departed".', pronunciation: 'MEED-doh' },
              ],
            },
          ],
        },
        // ── v9c: etaṁ satiṁ adhiṭṭheyya ──
        {
          id: 'v9c-etam-satim',
          pali: 'etaṁ satiṁ adhiṭṭheyya',
          scripts: [
            { lang: 'pi-Latn', label: 'Pāli', text: 'etaṁ satiṁ adhiṭṭheyya' },
          ],
          witnesses: [
            { by: 'Amaravati', text: 'one should sustain this recollection.', alignTo: [-1, -1, 2, 0, 1], url: AMARAVATI_URL },
            { by: 'Sujato (SuttaCentral)', text: 'they would commit to this kind of mindfulness;', alignTo: [-1, 2, 2, -1, 0, -1, -1, 1], url: 'https://suttacentral.net/snp1.8/en/sujato', license: 'CC0' },
            { by: 'Thanissaro (Access to Insight)', text: 'one should be resolved on this mindfulness.', alignTo: [-1, 2, -1, 2, -1, 0, 1], url: 'https://www.accesstoinsight.org/tipitaka/kn/snp/snp.1.08.than.html', license: 'CC BY-NC' },
          ],
          words: [
            { form: 'etaṁ', pronunciation: 'AY-tahm', gloss: 'this (object form) — refers back to the cultivated heart-mind from v8.' },
            {
              form: 'satiṁ',
              pronunciation: 'SAH-teem',
              etymology: '*sati* (mindfulness, remembering) + *-ṁ* (object form). From *√smṛ* "to remember".',
              gloss: 'mindfulness, recollection (object). The central Buddhist faculty — keeping something in present awareness. Same root as Skt *smṛti*.',
              accent: 'sky',
            },
            {
              form: 'adhiṭṭheyya',
              pronunciation: 'ah-DEET-tay-yah',
              etymology: '*adhi-* (over, upon) + *√sthā* (to stand) — "to stand upon, take a firm stand on, resolve". The "-eyya" tail says "should/would".',
              gloss: '"should be resolved on, should stand-firmly-on". *Adhiṭṭhāna* (resolve, determination) is one of the ten *pāramī* (perfections).',
              accent: 'amber',
              morphemes: [
                { text: 'adhi', type: 'prefix', gloss: '"over, upon" — adds a "standing-upon" flavour to the verb', pronunciation: 'AH-dee' },
                { text: 'ṭṭheyya', type: 'root', root: '√sthā', gloss: 'from the verb "to stand". *Adhi-ṭṭha* = "stand-upon, resolve". Same root as *tiṭṭhaṁ* (standing) in 9a.', pronunciation: 'TAY-yah' },
              ],
            },
          ],
        },
        // ── v9d: brahmametaṁ vihāraṁ idhamāhu ──
        {
          id: 'v9d-brahma-vihara',
          pali: 'brahmametaṁ vihāraṁ idhamāhu',
          scripts: [
            { lang: 'pi-Latn', label: 'Pāli', text: 'brahmametaṁ vihāraṁ idhamāhu' },
          ],
          witnesses: [
            { by: 'Amaravati', text: 'This is said to be the sublime abiding.', alignTo: [0, -1, 2, -1, -1, -1, 0, 1], url: AMARAVATI_URL },
            { by: 'Sujato (SuttaCentral)', text: 'this is what they call a divine meditation in this life.', alignTo: [0, -1, -1, 2, 2, -1, 0, 1, 2, -1, -1], url: 'https://suttacentral.net/snp1.8/en/sujato', license: 'CC0' },
            { by: 'Thanissaro (Access to Insight)', text: 'This is called a sublime abiding here & now.', alignTo: [0, -1, 2, -1, 0, 1, 2, -1, 2], url: 'https://www.accesstoinsight.org/tipitaka/kn/snp/snp.1.08.than.html', license: 'CC BY-NC' },
          ],
          words: [
            {
              form: 'brahmametaṁ',
              pronunciation: 'BRAH-mah-MAY-tahm',
              etymology: '*brahma* (divine, supreme) + *etaṁ* "this" — sound-merged together',
              gloss: '"this divine [one]". The *brahmavihāra* — divine abiding — names the meditator\'s dwelling-place. *Brahma* here doesn\'t name the deity but the highest, sublime register.',
              accent: 'sky',
              morphemes: [
                { text: 'brahma', type: 'stem', gloss: '"divine, supreme, highest" — same word in Skt and Pāli. *Brahmavihāra* is the technical term for the four sublime states (loving-kindness, compassion, joy, equanimity).', pronunciation: 'BRAH-mah' },
                { text: 'metaṁ', type: 'stem', gloss: '*etaṁ* "this" — joined to *brahma* by chant rhythm. The whole word means "this divine-state".', pronunciation: 'MAY-tahm' },
              ],
            },
            {
              form: 'vihāraṁ',
              pronunciation: 'vee-HAH-rahm',
              etymology: '*vi-* (apart) + *√hṛ* "to carry, dwell" — "dwelling, abiding"',
              gloss: 'an abiding, a dwelling-place. *Vihāra* gives the word for a monastery (the place one dwells), and in compounds names the four sublime abidings (*brahmavihāra*).',
            },
            {
              form: 'idhamāhu',
              pronunciation: 'EE-dah-MAH-hoo',
              etymology: '*idha* "here" + *āhu* "they say, it is said"',
              gloss: '"here they call [it]" — closes the verse with the traditional formula *iti āhu* "thus they say". The community\'s naming of the state.',
              morphemes: [
                { text: 'idha', type: 'stem', gloss: '"here, in this place" — anchors the divine abiding in *this* life, not a future heaven', pronunciation: 'EE-dah' },
                { text: 'māhu', type: 'stem', gloss: '*āhu* "they say, it is said" — the traditional Pāli formula that closes a teaching with "thus they say"', pronunciation: 'MAH-hoo' },
              ],
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

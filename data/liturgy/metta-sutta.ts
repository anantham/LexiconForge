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
        {
          id: 'verse-1',
          pali: 'Karaṇīyamatthakusalena, yaṁ taṁ santaṁ padaṁ abhisamecca; sakko ujū ca suhujū ca, suvaco c\'assa mudu anatimānī.',
          scripts: [
            {
              lang: 'pi-Latn',
              label: 'Pāli',
              text: 'Karaṇīyamatthakusalena, yaṁ taṁ santaṁ padaṁ abhisamecca; sakko ujū ca suhujū ca, suvaco c\'assa mudu anatimānī.',
            },
          ],
          witnesses: [
            {
              by: 'Amaravati',
              text: 'This is what should be done by one who is skilled in goodness, and who knows the path of peace: let them be able and upright, straightforward and gentle in speech, humble and not conceited.',
              url: AMARAVATI_URL,
            },
            {
              by: 'Sujato (SuttaCentral)',
              text: 'This is what should be done by one skilled in the good who has comprehended the state of peace. They\'d be capable, sincere, and upright, easy to speak to, gentle, and not proud,',
              url: 'https://suttacentral.net/snp1.8/en/sujato',
              license: 'CC0',
            },
            {
              by: 'Thanissaro (Access to Insight)',
              text: 'This is to be done by one skilled in aims who wants to break through to the state of peace: Be capable, upright, and straightforward, easy to instruct, gentle, and not conceited,',
              url: 'https://www.accesstoinsight.org/tipitaka/kn/snp/snp.1.08.than.html',
              license: 'CC BY-NC',
            },
          ],
          words: [
            {
              form: 'santaṁ',
              gloss: 'Peaceful, calmed. From *√śam* "to calm, quiet". The "path of peace" the worker of goodness is heading toward.',
              accent: 'sky',
              citations: [dpdCitation('santa')],
            },
          ],
        },
        {
          id: 'verse-2',
          pali: 'Santussako ca subharo ca, appakicco ca sallahukavutti; santindriyo ca nipako ca, appagabbho kulesu ananugiddho.',
          scripts: [
            {
              lang: 'pi-Latn',
              label: 'Pāli',
              text: 'Santussako ca subharo ca, appakicco ca sallahukavutti; santindriyo ca nipako ca, appagabbho kulesu ananugiddho.',
            },
          ],
          witnesses: [
            {
              by: 'Amaravati',
              text: 'Contented and easily satisfied, unburdened with duties and frugal in their ways. Peaceful and calm and wise and skillful, not proud or demanding in nature.',
              url: AMARAVATI_URL,
            },
            {
              by: 'Sujato (SuttaCentral)',
              text: 'content and unburdensome, living lightly with few duties, sensible and prudent, not arrogant or fawning over families.',
              url: 'https://suttacentral.net/snp1.8/en/sujato',
              license: 'CC0',
            },
            {
              by: 'Thanissaro (Access to Insight)',
              text: 'content and easy to support, with few duties, living lightly, with peaceful faculties, masterful, modest, and no greed for supporters.',
              url: 'https://www.accesstoinsight.org/tipitaka/kn/snp/snp.1.08.than.html',
              license: 'CC BY-NC',
            },
          ],
          words: [
            {
              form: 'Santussako',
              gloss: 'Easily content, satisfied with little. *sam* "fully" + *√tuṣ* "be pleased". A core monastic virtue.',
              accent: 'amber',
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

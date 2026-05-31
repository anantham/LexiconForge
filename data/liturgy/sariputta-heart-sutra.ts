/**
 * Maha Prajna Paramita Hridaya Sutra — Sariputta Ambedkar Monastery rendering.
 *
 * The same Heart Sutra chanted at /liturgy/maple/heart-sutra and
 * /liturgy/bodhi-sangha/heart-sutra, in the English recension used at
 * Sariputta Ambedkar Monastery — the Rochester Zen Center / Kapleau line
 * ("Avalokiteshvara Bodhisattva, when practicing deeply the Prajna
 * Paramita…"). Transcribed from the monastery's chant sheet.
 *
 * The Sanskrit / Chinese / Japanese / Tibetan scripts and word-by-word
 * morphemes are the shared body (data/liturgy/heart-sutra-content.ts) — this
 * file overlays only Sariputta's English. Their rendering leads here; the
 * other communities' translations pool in (cyclable) via the resolver.
 *
 * Word-level alignment (alignTo) is deliberately not yet authored — the
 * translation shows as a plain line until per-word alignment is curated.
 * See docs/sutta-studio/COMMUNITY_CHANT_MODEL.md.
 */

import type { CommunityChant } from '../../types/liturgy';
import { overlayHeartBody } from './heart-sutra-content';

const WITNESS_BY = 'Sariputta Ambedkar';
const WITNESS_META = {
  url: 'https://en.wikipedia.org/wiki/Heart_Sutra#English_translations',
  license:
    'Sariputta Ambedkar Monastery chant sheet (Rochester Zen Center / Kapleau line) — transcribed with attribution',
};

/**
 * Sariputta's English per shared `phraseId`. The Rochester recension's clause
 * "The same is true of feelings, perceptions, impulses, consciousness" has no
 * separate Sanskrit segment in this recension, so it rides on `emptiness-is-form`.
 */
const SARIPUTTA_TEXTS: Record<string, string> = {
  // core
  'opening-avalokita': 'Avalokiteshvara Bodhisattva,',
  'opening-practice': 'when practicing deeply the Prajna Paramita,',
  'opening-seeing':
    'perceived that all five skandhas in their own being are empty and was saved from all suffering.',
  'form-not-different-emptiness': 'O Shariputra, form does not differ from emptiness,',
  'emptiness-not-different-form': 'emptiness does not differ from form.',
  'form-is-emptiness': 'That which is form is emptiness,',
  'emptiness-is-form':
    'that which is emptiness, form. The same is true of feelings, perceptions, impulses, consciousness.',
  // middle
  'middle-shariputra': 'O Shariputra,',
  'middle-all-dharmas-empty': 'all dharmas are marked with emptiness.',
  'middle-no-arise-no-cease': 'They are without birth or death;',
  'middle-no-defile-no-pure': 'are not tainted nor pure,',
  'middle-no-increase-no-decrease': 'do not increase nor decrease.',
  'middle-emptiness-no-form': 'Therefore, in emptiness: no form,',
  'middle-no-other-skandhas': 'no feelings, no perceptions, no impulses, no consciousness;',
  'middle-no-six-faculties': 'no eyes, no ears, no nose, no tongue, no body, no mind;',
  'middle-no-six-objects': 'no color, no sound, no smell, no taste, no touch, no object of mind;',
  'middle-no-dhatus': 'no world of eyes through to no world of mind consciousness.',
  'middle-no-ignorance': 'No ignorance and also no extinction of it',
  'middle-no-aging-death': 'through to no old age and death and also no extinction of it.',
  'middle-no-four-truths': 'No suffering, no origination, no stopping, no path,',
  'middle-no-wisdom-no-attainment': 'no cognition, also no attainment,',
  'middle-because-no-attainment': 'with nothing to attain.',
  // result
  'result-no-obstruction': 'The Bodhisattvas depend on Prajna Paramita and their mind is no hindrance.',
  'result-because-no-obstruction': 'Without any hindrance,',
  'result-no-fear': 'no fears exist.',
  'result-far-from-inversion': 'Far apart from every deluded view',
  'result-ultimate-nirvana': 'they dwell in Nirvana.',
};

// Overlay Sariputta's English onto the shared body. Validates that every key
// in SARIPUTTA_TEXTS names a real shared phrase (a typo throws at module load).
const SARIPUTTA_BODY = overlayHeartBody(WITNESS_BY, SARIPUTTA_TEXTS, WITNESS_META);

export const sariputtaHeartSutra: CommunityChant = {
  contentId: 'heart-sutra',
  defaultWitnessBy: WITNESS_BY,
  slug: 'heart-sutra',
  sangha: 'sariputta-ambedkar',
  title: 'Maha Prajna Paramita Hridaya Sutra',
  subtitle: 'The Heart Sutra — Sariputta Ambedkar Monastery (Rochester / Kapleau line)',
  tradition: 'mahayana',
  context:
    'The Heart Sutra in the Rochester Zen Center / Kapleau English recension, as chanted at Sariputta Ambedkar Monastery. The Sanskrit and East-Asian scripts are shared with the MAPLE and Bodhi Sangha versions; the witness-dots cycle every community\'s translation.',
  sources: {
    canonical: [
      { label: 'Conze (1948) — Sanskrit critical edition', url: 'https://en.wikipedia.org/wiki/Heart_Sutra' },
      { label: 'Xuanzang (玄奘) — T251, Chinese Buddhist canon', url: 'https://en.wikipedia.org/wiki/Heart_Sutra#Chinese' },
    ],
    ritual: [{ label: 'Sariputta Ambedkar Monastery chant sheet' }],
  },
  curator:
    'Curation by Aditya. Sariputta\'s English is transcribed from the monastery chant sheet (the Rochester Zen Center / Kapleau line); the canonical scripts and word-level morphemes are the shared Heart Sutra body. Per-word alignment for the Sariputta rendering is not yet authored.',
  sections: [
    {
      id: 'sariputta-heart-core',
      shape: 'triple-script-witness',
      segments: SARIPUTTA_BODY.core,
    },
    {
      id: 'sariputta-heart-middle',
      shape: 'triple-script-witness',
      segments: SARIPUTTA_BODY.middle,
    },
    {
      id: 'sariputta-heart-result',
      shape: 'triple-script-witness',
      segments: SARIPUTTA_BODY.result,
    },
    {
      id: 'sariputta-all-buddhas',
      shape: 'prose-commentary',
      body: 'In the Three Worlds all Buddhas depend on Prajna Paramita and attain unsurpassed, complete, perfect Enlightenment.',
    },
    {
      id: 'sariputta-great-mantra',
      shape: 'prose-commentary',
      body: 'Therefore know: the Prajna Paramita is the great transcendent mantra, is the great bright mantra, is the utmost mantra, is the supreme mantra, which is able to relieve all suffering and is true, not false. So proclaim the Prajna Paramita mantra, proclaim the mantra that says:',
    },
    {
      id: 'sariputta-dharani',
      shape: 'sound-formula',
      phonemes: 'Gyate, gyate, paragyate, parasam gyate, bodhi svaha!',
      framing:
        'The mantra is left untranslated — it is chanted as sound. "Gone, gone, gone beyond, gone wholly beyond — awakening, hail!"',
    },
  ],
};

export default sariputtaHeartSutra;

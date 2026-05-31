/**
 * Vandana, Trisaraṇam, Pañcasīl — the Sariputta Ambedkar Monastery's
 * opening Pali devotion: Homage, Threefold Refuge, and Five Precepts.
 *
 * Three classical Theravāda formulas chanted in sequence at the start of a
 * sitting:
 *   - Vandanā: the homage *Namo tassa bhagavato arahato sammāsambuddhassa*,
 *     recited three times.
 *   - Tisaraṇa: going for refuge in the Buddha, the Dhamma, and the Saṅgha —
 *     each line repeated again "Dutiyampi…" (a second time) and "Tatiyampi…"
 *     (a third time).
 *   - Pañcasīla: the Five Precepts, the lay training-rules undertaken with
 *     "*… sikkhāpadaṃ samādiyāmi*" — "I undertake the training-rule …".
 *
 * The Sariputta Ambedkar Monastery is part of the modern Indian Buddhist
 * revival; these Pali formulas are the shared bedrock of the whole
 * Theravāda world and open the monastery's daily practice.
 *
 * Reader treatment: `triple-script-witness` throughout — Pali (Roman) +
 * Devanāgarī + a plain English witness, with full word-by-word glosses,
 * etymology, pronunciation respelling, and grounding citations.
 *
 * The chant sheet writes the nasal ending with a dot-BELOW the m (ṃ) — e.g.
 * *Buddhaṃ*, *sikkhāpadaṃ* — and that exact spelling is preserved here
 * rather than normalised to the dot-above *ṁ* some editions use.
 */

import type { LiturgyDoc, WordGloss } from '../../types/liturgy';
import {
  dpdCitation,
  suttaCentralPronunciationCitation,
} from './_groundingHelpers';

const pronCite = suttaCentralPronunciationCitation();

// ── Shared refuge words ──────────────────────────────────────────────────────
// The refuge object cycles Buddha → Dhamma → Saṅgha; *saraṇaṃ gacchāmi* stays
// fixed across all three lines, so those two words are authored once and reused.

const REFUGE_OBJECT_WORDS: { [key: string]: WordGloss } = {
  buddhaṃ: {
    form: 'Buddhaṃ', scriptAlt: 'बुद्धं', pronunciation: 'BUD-dahng', accent: 'amber',
    root: '√budh',
    etymology: '√budh "to wake up" — *buddha* is the "woken-up" form of that verb',
    gloss: 'the Awakened One — here it is what one goes to: the thing "I go to"',
    citations: [dpdCitation('buddha'), pronCite],
    morphemes: [
      { text: 'buddha', type: 'stem', root: '√budh', gloss: 'awakened — the "X-ed" form of √budh "to wake up"', pronunciation: 'BUD-dah', citations: [dpdCitation('buddha')] },
      { text: 'ṃ', type: 'suffix', gloss: 'the object ending — marks Buddha as the thing being gone-to', pronunciation: 'ng' },
    ],
  },
  dhammaṃ: {
    form: 'Dhammaṃ', scriptAlt: 'धम्मं', pronunciation: 'DHAHM-mahng', accent: 'sky',
    root: '√dhṛ',
    etymology: '√dhṛ "to hold, support" — that which holds true',
    gloss: 'the Dhamma — the teaching, the way things are',
    citations: [dpdCitation('dhamma'), pronCite],
    morphemes: [
      { text: 'dhamma', type: 'stem', root: '√dhṛ', gloss: 'the teaching, the truth that holds', pronunciation: 'DHAHM-mah', citations: [dpdCitation('dhamma')] },
      { text: 'ṃ', type: 'suffix', gloss: 'the object ending — marks the Dhamma as the thing being gone-to', pronunciation: 'ng' },
    ],
  },
  saṅghaṃ: {
    form: 'Saṅghaṃ', scriptAlt: 'सङ्घं', pronunciation: 'SUNG-hahng', accent: 'rose',
    etymology: 'saṃ- "together" + √han here in the sense "come together" (√han usually means "strike"; the coming-together sense yields *saṅgha*)',
    gloss: 'the community of practitioners, especially the noble Saṅgha',
    citations: [dpdCitation('saṅgha'), pronCite],
    morphemes: [
      { text: 'saṅgha', type: 'stem', gloss: 'the gathered community — "together" + "to come"', pronunciation: 'SUNG-hah', citations: [dpdCitation('saṅgha')] },
      { text: 'ṃ', type: 'suffix', gloss: 'the object ending — marks the Saṅgha as the thing being gone-to', pronunciation: 'ng' },
    ],
  },
};

const SARANAM: WordGloss = {
  form: 'saraṇaṃ', scriptAlt: 'सरणं', pronunciation: 'SAH-rah-nahng',
  root: '√śri',
  etymology: '√śri "to take shelter, lean on"',
  gloss: 'refuge, shelter — the destination one goes to',
  citations: [dpdCitation('saraṇa'), pronCite],
  morphemes: [
    { text: 'saraṇa', type: 'stem', root: '√śri', gloss: 'shelter, refuge — a place one leans on', pronunciation: 'SAH-rah-nah', citations: [dpdCitation('saraṇa')] },
    { text: 'ṃ', type: 'suffix', gloss: 'the object ending — refuge as the thing being gone-to', pronunciation: 'ng' },
  ],
};

const GACCHAMI: WordGloss = {
  form: 'gacchāmi', scriptAlt: 'गच्छामि', pronunciation: 'gahch-CHAH-mee',
  root: '√gam',
  etymology: '√gam "to go" — *gacchāmi* is the "I … now" form',
  gloss: 'I go — said of oneself, here and now',
  citations: [dpdCitation('gacchati'), pronCite],
  morphemes: [
    { text: 'gacch', type: 'root', root: '√gam', gloss: 'to go', pronunciation: 'gahch', citations: [dpdCitation('gacchati')] },
    { text: 'āmi', type: 'suffix', gloss: 'the "I … now" ending — "I go"', pronunciation: 'AH-mee' },
  ],
};

// ── Shared precept words ─────────────────────────────────────────────────────
// Each of the Five Precepts ends with the same two words: *veramaṇī*
// ("abstaining") and *sikkhāpadaṃ samādiyāmi* ("I undertake the training-rule").
// Only the opening compound — what is being abstained from — changes.

const VERAMANI: WordGloss = {
  form: 'veramaṇī', scriptAlt: 'वेरमणी', pronunciation: 'vay-rah-MAH-nee',
  etymology: 've- (the strengthened form of vi- "away from") + √ram + -aṇī. The bare root √ram means "to delight, rest, dwell"; under the ve-/vi- prefix (*viramati*) it flips to "turn away, desist, abstain" — hence "abstaining from"',
  gloss: 'abstaining from, turning away from',
  citations: [dpdCitation('veramaṇī'), pronCite],
  morphemes: [
    { text: 've', type: 'prefix', gloss: 'away from (the strengthened form of *vi-*). NOTE: this is NOT the separate Pali word *vera* "hatred" — they only look alike.', pronunciation: 'vay' },
    { text: 'ram', type: 'root', root: '√ram', gloss: '√ram "delight, rest, dwell" on its own; under the *ve-/vi-* prefix (as in *viramati*) it means "turn away, desist, abstain"', pronunciation: 'rah' },
    { text: 'aṇī', type: 'suffix', gloss: 'the ending that turns it into "an abstaining-from"', pronunciation: 'mah-NEE' },
  ],
};

const SIKKHAPADAM: WordGloss = {
  form: 'sikkhāpadaṃ', scriptAlt: 'सिक्खापदं', pronunciation: 'sik-KHAH-pah-dahng',
  etymology: '*sikkhā* "training" + *pada* "step, base" — a "training-step"',
  gloss: 'the training-rule, the precept',
  citations: [dpdCitation('sikkhāpada'), pronCite],
  morphemes: [
    { text: 'sikkhā', type: 'stem', gloss: 'training, schooling', pronunciation: 'sik-KHAH', citations: [dpdCitation('sikkhā')] },
    { text: 'pada', type: 'stem', gloss: 'step, base, footing', pronunciation: 'PAH-dah', citations: [dpdCitation('pada')] },
    { text: 'ṃ', type: 'suffix', gloss: 'the object ending — the rule as the thing undertaken', pronunciation: 'ng' },
  ],
};

const SAMADIYAMI: WordGloss = {
  form: 'samādiyāmi', scriptAlt: 'समादियामि', pronunciation: 'sah-mah-dee-YAH-mee',
  etymology: 'saṃ- "fully" + ā- "toward" + √dā "to give" — with the ā- prefix (*ā+dā*) the sense flips to "take up, receive", so "I take fully upon myself"',
  gloss: 'I undertake, I take on (of myself, here and now)',
  citations: [dpdCitation('samādiyati'), pronCite],
  morphemes: [
    { text: 'sam', type: 'prefix', gloss: 'fully, completely', pronunciation: 'sah' },
    { text: 'ā', type: 'prefix', gloss: 'toward, onto oneself', pronunciation: 'ah' },
    { text: 'diy', type: 'root', root: '√dā', gloss: '√dā "to give"; with the *ā-* prefix (*ā+dā*) it means "take up, receive"', pronunciation: 'dee-y' },
    { text: 'āmi', type: 'suffix', gloss: 'the "I … now" ending — "I undertake"', pronunciation: 'AH-mee' },
  ],
};

export const sariputtaRefugesAndPrecepts: LiturgyDoc = {
  slug: 'refuges-and-precepts',
  sangha: 'sariputta-ambedkar',
  title: 'Vandana, Trisaraṇam, Pañcasīl',
  subtitle: 'Homage, the Threefold Refuge, the Five Precepts, and the Buddha recollection (Itipiso)',
  tradition: 'theravada',
  context:
    'The Pali opening of the Sariputta Ambedkar Monastery\'s daily practice: the homage to the Buddha (*Namo tassa…*, three times), going for refuge in the Buddha, Dhamma, and Saṅgha (each line repeated a second and a third time), the undertaking of the Five Precepts, and the recollection of the Buddha (the *Itipiso*, headed "Buddha Vandana" on the sheet).',
  sources: {
    canonical: [
      { label: 'Khp 1–2 (Saraṇagamana + Dasasikkhāpada)', url: 'https://suttacentral.net/kp1/en/sujato' },
      { label: 'Homage formula (namo tassa…)', url: 'https://suttacentral.net/define/namo' },
    ],
    ritual: [
      { label: 'Sariputta Ambedkar Monastery chant sheet' },
    ],
  },
  curator:
    'Curation by Aditya. The Pali (`pali` fields) is transcribed verbatim from the Sariputta Ambedkar Monastery chant sheet (block headed "Vandana, Trisaraṇam, Pañcasīl"), preserving the sheet\'s dot-below nasal spelling (ṃ). The sheet is Pali-only: the English (witness "Literal gloss") and the Devanāgarī (`paliDeva`) are the curator\'s, NOT on the sheet — attributed as such rather than to the monastery. Word data follows the same DPD + SuttaCentral-pronunciation grounding used elsewhere in this reader.',
  sections: [
    // ── Homage ──────────────────────────────────────────────────────────────
    {
      id: 'vandana',
      shape: 'triple-script-witness',
      repetitions: 3,
      large: true,
      segments: [
        {
          id: 'namo-tassa-line',
          pali: 'Namo tassa bhagavato arahato sammāsambuddhassa.',
          paliDeva: 'नमो तस्स भगवतो अरहतो सम्मासम्बुद्धस्स।',
          witnesses: [
            {
              by: 'Literal gloss',
              text: 'Homage to the Blessed One, the Worthy One, the Fully Self-Awakened One.',
              alignTo: [0, -1, -1, 2, 2, -1, 3, 3, -1, 4, 4, 4],            },
          ],
          words: [
            {
              form: 'Namo', scriptAlt: 'नमो', pronunciation: 'nah-MOH', root: '√nam',
              etymology: '√nam "to bow"', gloss: 'homage, reverence',
              citations: [dpdCitation('namo'), pronCite],
              morphemes: [
                { text: 'nam', type: 'root', root: '√nam', gloss: 'to bow', pronunciation: 'nah', citations: [dpdCitation('namati')] },
                { text: 'o', type: 'suffix', gloss: 'turns "to bow" into "an act of homage"', pronunciation: 'MOH' },
              ],
            },
            {
              form: 'tassa', scriptAlt: 'तस्स', pronunciation: 'TAH-sah',
              etymology: 'pointer word + the "to him" ending', gloss: 'to him, to that one',
              citations: [dpdCitation('ta'), pronCite],
            },
            {
              form: 'bhagavato', scriptAlt: 'भगवतो', pronunciation: 'bah-gah-VAH-toh',
              etymology: '*bhaga* "fortune, blessing" + *-vant* "possessing"',
              gloss: 'the Blessed One, the Fortunate One',
              citations: [dpdCitation('bhagavant'), pronCite],
            },
            {
              form: 'arahato', scriptAlt: 'अरहतो', pronunciation: 'ah-rah-HAH-toh',
              etymology: '*araha* "worthy" — from √arh "to deserve, be worthy"',
              gloss: 'the Worthy One; one free of all defilement',
              citations: [dpdCitation('arahant'), pronCite],
            },
            {
              form: 'sammāsambuddhassa', scriptAlt: 'सम्मासम्बुद्धस्स', pronunciation: 'sahm-MAH-sahm-bud-DHAH-sah',
              root: '√budh',
              etymology: '*sammā* "rightly, fully" + *saṃ-* "self, complete" + *buddha* "awakened"',
              gloss: 'to the Fully Self-Awakened One — awakened rightly and on his own',
              citations: [dpdCitation('sammāsambuddha'), pronCite],
              morphemes: [
                { text: 'sammā', type: 'prefix', gloss: 'rightly, fully, perfectly', pronunciation: 'sahm-MAH', citations: [dpdCitation('sammā')] },
                { text: 'sam', type: 'prefix', gloss: 'self, completely — awakened on his own', pronunciation: 'sahm' },
                { text: 'buddha', type: 'stem', root: '√budh', gloss: 'awakened — the "X-ed" form of √budh "to wake up"', pronunciation: 'BUD-dah', citations: [dpdCitation('buddha')] },
                { text: 'ssa', type: 'suffix', gloss: 'the "to/of him" ending — homage is offered to him', pronunciation: 'sah' },
              ],
            },
          ],
        },
      ],
      commentary:
        'The standard homage that opens Theravāda recitation everywhere, chanted three times. *Namo tassa* — "homage to him" — and then three titles of the one being honoured: the Blessed One, the Worthy One, the Fully Self-Awakened One. The accent marks the Buddha title that closes the line.',
    },

    // ── Threefold Refuge ──────────────────────────────────────────────────────
    {
      id: 'trisaranam',
      shape: 'triple-script-witness',
      segments: [
        {
          id: 'buddha-refuge',
          pali: 'Buddhaṃ saraṇaṃ gacchāmi,',
          paliDeva: 'बुद्धं सरणं गच्छामि,',
          witnesses: [
            {
              by: 'Literal gloss',
              text: 'I go to the Buddha for refuge,',
              alignTo: [-1, 2, -1, -1, 0, -1, 1],            },
          ],
          words: [REFUGE_OBJECT_WORDS.buddhaṃ, SARANAM, GACCHAMI],
        },
        {
          id: 'dhamma-refuge',
          pali: 'Dhammaṃ saraṇaṃ gacchāmi,',
          paliDeva: 'धम्मं सरणं गच्छामि,',
          witnesses: [
            {
              by: 'Literal gloss',
              text: 'I go to the Dhamma for refuge,',
              alignTo: [-1, 2, -1, -1, 0, -1, 1],            },
          ],
          words: [REFUGE_OBJECT_WORDS.dhammaṃ, SARANAM, GACCHAMI],
        },
        {
          id: 'sangha-refuge',
          pali: 'Saṅghaṃ saraṇaṃ gacchāmi.',
          paliDeva: 'सङ्घं सरणं गच्छामि।',
          witnesses: [
            {
              by: 'Literal gloss',
              text: 'I go to the Saṅgha for refuge.',
              alignTo: [-1, 2, -1, -1, 0, -1, 1],            },
          ],
          words: [REFUGE_OBJECT_WORDS.saṅghaṃ, SARANAM, GACCHAMI],
        },
        {
          id: 'dutiyampi',
          pali: 'Dutiyampi... (for each line above)',
          paliDeva: 'दुतियम्पि... (बुद्धं सरणं गच्छामि ...)',
          witnesses: [
            {
              by: 'Literal gloss',
              text: 'For a second time… (each refuge line above is repeated)',
              alignTo: [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1],            },
          ],
          words: [
            {
              form: 'Dutiyampi', scriptAlt: 'दुतियम्पि', pronunciation: 'doo-tee-YAHM-pee',
              etymology: '*dutiyaṃ* "a second time" (the adverb form of *dutiya* "second") + *-pi* "also, even"; the *-ṃ* is written *m* before *p*',
              gloss: 'for a second time as well — the cue to chant all three refuge lines again',
              citations: [dpdCitation('dutiya'), pronCite],
              morphemes: [
                { text: 'dutiya', type: 'stem', gloss: 'second', pronunciation: 'doo-TEE-yah', citations: [dpdCitation('dutiya')] },
                { text: 'm', type: 'suffix', gloss: 'the "-ṃ" adverb ending (of *dutiyaṃ* / *tatiyaṃ*, "a … time"), written *m* before *p*', pronunciation: 'm' },
                { text: 'pi', type: 'suffix', gloss: 'also, even, too', pronunciation: 'pee', citations: [dpdCitation('pi')] },
              ],
            },
          ],
          note: 'The sheet prints only "Dutiyampi… (for each line above)": the cue to repeat all three refuge lines a second time, each now opening with *Dutiyampi* — "for a second time too, I go to the Buddha for refuge", and so on.',
        },
        {
          id: 'tatiyampi',
          pali: 'Tatiyampi... (for each line above)',
          paliDeva: 'ततियम्पि... (बुद्धं सरणं गच्छामि ...)',
          witnesses: [
            {
              by: 'Literal gloss',
              text: 'For a third time… (each refuge line above is repeated)',
              alignTo: [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1],            },
          ],
          words: [
            {
              form: 'Tatiyampi', scriptAlt: 'ततियम्पि', pronunciation: 'tah-tee-YAHM-pee',
              etymology: '*tatiyaṃ* "a third time" (the adverb form of *tatiya* "third") + *-pi* "also, even"; the *-ṃ* is written *m* before *p*',
              gloss: 'for a third time as well — the cue to chant all three refuge lines a final time',
              citations: [dpdCitation('tatiya'), pronCite],
              morphemes: [
                { text: 'tatiya', type: 'stem', gloss: 'third', pronunciation: 'tah-TEE-yah', citations: [dpdCitation('tatiya')] },
                { text: 'm', type: 'suffix', gloss: 'the "-ṃ" adverb ending (of *dutiyaṃ* / *tatiyaṃ*, "a … time"), written *m* before *p*', pronunciation: 'm' },
                { text: 'pi', type: 'suffix', gloss: 'also, even, too', pronunciation: 'pee', citations: [dpdCitation('pi')] },
              ],
            },
          ],
          note: 'And a third round, each refuge line opening with *Tatiyampi* — "for a third time too, I go to the Buddha for refuge". Going for refuge three times over is the classical way the commitment is sealed.',
        },
      ],
      commentary:
        'The Threefold Refuge — the formula by which one becomes a Buddhist. The frame *saraṇaṃ gacchāmi* ("I go for refuge") stays fixed; only the refuge cycles — Buddha, Dhamma, Saṅgha — and the accent colours trace that cycle. The whole set is chanted three times: plain, then with *Dutiyampi* (a second time), then with *Tatiyampi* (a third time).',
    },

    // ── Five Precepts ──────────────────────────────────────────────────────────
    {
      id: 'pancasil',
      shape: 'triple-script-witness',
      segments: [
        {
          id: 'precept-1-panatipata',
          pali: 'Pāṇātipātā veramaṇī sikkhāpadaṃ samādiyāmi.',
          paliDeva: 'पाणातिपाता वेरमणी सिक्खापदं समादियामि।',
          witnesses: [
            {
              by: 'Literal gloss',
              text: 'I undertake the training-rule to abstain from killing living beings.',
              alignTo: [3, 3, 2, 2, -1, 1, 0, 0, 0, 0],            },
          ],
          words: [
            {
              form: 'Pāṇātipātā', scriptAlt: 'पाणातिपाता', pronunciation: 'PAH-nah-tee-PAH-tah',
              etymology: '*pāṇa* "breathing thing, living being" + *atipāta* "striking down, slaughter"',
              gloss: 'from killing living beings — what one abstains from',
              citations: [dpdCitation('pāṇātipāta'), pronCite],
              morphemes: [
                { text: 'pāṇ', type: 'stem', gloss: 'a breathing thing, a living being (*pāṇa*, its final vowel merged into what follows)', pronunciation: 'PAHN', citations: [dpdCitation('pāṇa')] },
                { text: 'ātipātā', type: 'stem', gloss: 'striking down, slaughter — from "from the act of …"', pronunciation: 'AH-tee-PAH-tah', citations: [dpdCitation('atipāta')] },
              ],
            },
            VERAMANI, SIKKHAPADAM, SAMADIYAMI,
          ],
          note: 'The first precept. *Pāṇa* is anything that breathes; *atipāta* is striking it down. Together: abstaining from taking the life of any living being.',
        },
        {
          id: 'precept-2-adinnadana',
          pali: 'Adinnādānā veramaṇī sikkhāpadaṃ samādiyāmi.',
          paliDeva: 'अदिन्नादाना वेरमणी सिक्खापदं समादियामि।',
          witnesses: [
            {
              by: 'Literal gloss',
              text: 'I undertake the training-rule to abstain from taking what is not given.',
              alignTo: [3, 3, 2, 2, -1, 1, 0, 0, 0, 0, 0, 0],            },
          ],
          words: [
            {
              form: 'Adinnādānā', scriptAlt: 'अदिन्नादाना', pronunciation: 'ah-din-NAH-dah-nah',
              etymology: '*a-* "not" + *dinna* "given" + *ādāna* "taking"',
              gloss: 'from taking what is not given — what one abstains from',
              citations: [dpdCitation('adinnādāna'), pronCite],
              morphemes: [
                { text: 'a', type: 'prefix', gloss: 'not', pronunciation: 'ah' },
                { text: 'dinn', type: 'stem', root: '√dā', gloss: 'given — the "X-ed" form of √dā "to give" (*dinna*, its final vowel merged into what follows)', pronunciation: 'DIN', citations: [dpdCitation('dinna')] },
                { text: 'ādānā', type: 'stem', gloss: 'taking, seizing — from "from the act of …"', pronunciation: 'AH-dah-nah', citations: [dpdCitation('ādāna')] },
              ],
            },
            VERAMANI, SIKKHAPADAM, SAMADIYAMI,
          ],
          note: 'The second precept: abstaining from taking what has not been given — theft in its widest sense.',
        },
        {
          id: 'precept-3-kamesu-micchacara',
          pali: 'Kāmesu micchācārā veramaṇī sikkhāpadaṃ samādiyāmi.',
          paliDeva: 'कामेसु मिच्छाचारा वेरमणी सिक्खापदं समादियामि।',
          witnesses: [
            {
              by: 'Literal gloss',
              text: 'I undertake the training-rule to abstain from wrong conduct in sensual pleasures.',
              alignTo: [4, 4, 3, 3, -1, 2, 1, 1, 1, 0, 0, 0],            },
          ],
          words: [
            {
              form: 'Kāmesu', scriptAlt: 'कामेसु', pronunciation: 'KAH-may-soo',
              etymology: '*kāma* "sense-desire, sensual pleasure" + the "among/in …" ending',
              gloss: 'among sensual pleasures — the domain the conduct concerns',
              citations: [dpdCitation('kāma'), pronCite],
              morphemes: [
                { text: 'kām', type: 'stem', gloss: 'sense-desire, sensual pleasure', pronunciation: 'KAHM', citations: [dpdCitation('kāma')] },
                { text: 'esu', type: 'suffix', gloss: 'the "among/in those" ending — among the pleasures', pronunciation: 'AY-soo' },
              ],
            },
            {
              form: 'micchācārā', scriptAlt: 'मिच्छाचारा', pronunciation: 'mich-CHAH-chah-rah',
              etymology: '*micchā* "wrong, wrongly" + *cāra* "conduct, going about"',
              gloss: 'from wrong conduct — what one abstains from',
              citations: [dpdCitation('micchācāra'), pronCite],
              morphemes: [
                { text: 'micchā', type: 'prefix', gloss: 'wrong, wrongly', pronunciation: 'mich-CHAH', citations: [dpdCitation('micchā')] },
                { text: 'cārā', type: 'stem', gloss: 'conduct, behaviour — from "from the act of …"', pronunciation: 'CHAH-rah', citations: [dpdCitation('cāra')] },
              ],
            },
            VERAMANI, SIKKHAPADAM, SAMADIYAMI,
          ],
          note: 'The third precept: abstaining from misconduct in sensual pleasures — chiefly sexual misconduct.',
        },
        {
          id: 'precept-4-musavada',
          pali: 'Musāvādā veramaṇī sikkhāpadaṃ samādiyāmi.',
          paliDeva: 'मुसावादा वेरमणी सिक्खापदं समादियामि।',
          witnesses: [
            {
              by: 'Literal gloss',
              text: 'I undertake the training-rule to abstain from false speech.',
              alignTo: [3, 3, 2, 2, -1, 1, 0, 0, 0],            },
          ],
          words: [
            {
              form: 'Musāvādā', scriptAlt: 'मुसावादा', pronunciation: 'moo-SAH-vah-dah',
              etymology: '*musā* "falsely, a lie" + *vāda* "speech, saying" — from √vad "to speak"',
              gloss: 'from false speech — what one abstains from',
              citations: [dpdCitation('musāvāda'), pronCite],
              morphemes: [
                { text: 'musā', type: 'prefix', gloss: 'falsely, a lie', pronunciation: 'moo-SAH', citations: [dpdCitation('musā')] },
                { text: 'vādā', type: 'stem', root: '√vad', gloss: 'speech, saying — from "from the act of …"', pronunciation: 'VAH-dah', citations: [dpdCitation('vāda')] },
              ],
            },
            VERAMANI, SIKKHAPADAM, SAMADIYAMI,
          ],
          note: 'The fourth precept: abstaining from lying and false speech.',
        },
        {
          id: 'precept-5-suramerayamajja',
          pali: 'Surāmerayamajjapamādaṭṭhānā veramaṇī sikkhāpadaṃ samādiyāmi.',
          paliDeva: 'सुरामेरयमज्जपमादट्ठाना वेरमणी सिक्खापदं समादियामि।',
          witnesses: [
            {
              by: 'Literal gloss',
              text: 'I undertake the training-rule to abstain from wines, liquors, and intoxicants that are a basis for heedlessness.',
              alignTo: [3, 3, 2, 2, -1, 1, 0, 0, 0, -1, 0, 0, 0, 0, 0, -1, 0],            },
          ],
          words: [
            {
              form: 'Surāmerayamajjapamādaṭṭhānā', scriptAlt: 'सुरामेरयमज्जपमादट्ठाना', pronunciation: 'soo-RAH-may-rah-yah-MAJ-jah-pah-MAH-dah-T-TAH-nah',
              etymology: '*surā* "distilled liquor" + *meraya* "fermented drink" + *majja* "intoxicant" + *pamāda* "heedlessness" + *ṭhāna* "ground, basis"',
              gloss: 'from liquor, fermented drink, and intoxicants that are a basis for heedlessness — what one abstains from',
              citations: [dpdCitation('surāmerayamajjapamādaṭṭhāna'), pronCite],
              morphemes: [
                { text: 'surā', type: 'stem', gloss: 'distilled liquor, strong drink', pronunciation: 'soo-RAH', citations: [dpdCitation('surā')] },
                { text: 'meraya', type: 'stem', gloss: 'fermented drink, wine', pronunciation: 'MAY-rah-yah', citations: [dpdCitation('meraya')] },
                { text: 'majja', type: 'stem', gloss: 'intoxicant, that which makes one drunk', pronunciation: 'MAJ-jah', citations: [dpdCitation('majja')] },
                { text: 'pamāda', type: 'stem', gloss: 'heedlessness, negligence', pronunciation: 'pah-MAH-dah', citations: [dpdCitation('pamāda')] },
                { text: 'ṭṭhānā', type: 'stem', gloss: 'ground, basis, occasion — from "from the basis of …"', pronunciation: 'T-TAH-nah', citations: [dpdCitation('ṭhāna')] },
              ],
            },
            VERAMANI, SIKKHAPADAM, SAMADIYAMI,
          ],
          note: 'The fifth precept: abstaining from intoxicants — *surā* (distilled liquor), *meraya* (fermented drink), and *majja* (intoxicants generally) — which the formula names as a *pamādaṭṭhāna*, "a basis for heedlessness". One abstains from the intoxicants themselves precisely because they are an occasion for heedlessness.',
        },
      ],
      commentary:
        'The Five Precepts (*Pañcasīla*), the basic training the laity take on. Every line shares the same closing: *… veramaṇī sikkhāpadaṃ samādiyāmi* — "I undertake the training-rule to abstain from …". Only the opening compound, the thing abstained from, changes line to line. They are undertaken — *samādiyāmi*, "I take this on myself" — not commanded.',
    },

    // ── Buddha Vandana (Itipiso) ───────────────────────────────────────────────
    {
      id: 'buddha-vandana',
      shape: 'triple-script-witness',
      segments: [
        {
          id: 'itipiso-line-1',
          pali: 'Itipo so bhagava araham samma sambuddho',
          witnesses: [
            {
              by: 'Literal gloss',
              text: 'Thus indeed he, the Blessed One, is worthy, fully self-awakened.',
              alignTo: [0, 0, 1, -1, 2, 2, -1, 3, 4, 5],
            },
          ],
          words: [
            { form: 'Itipo', pronunciation: 'ee-TEE-poh', etymology: 'sheet spelling of *iti pi* "thus indeed"', gloss: 'thus, in this way (the sheet writes *Itipo*; the standard form is *iti pi so*)', citations: [pronCite] },
            { form: 'so', pronunciation: 'soh', gloss: 'he, that one — the Buddha being recollected', citations: [pronCite] },
            { form: 'bhagava', pronunciation: 'bah-gah-VAH', etymology: '*bhaga* "fortune, blessing" + *-vant* "possessing" (sheet *bhagava*; standard *bhagavā*)', gloss: 'the Blessed One, the Fortunate One', citations: [dpdCitation('bhagavant'), pronCite] },
            { form: 'araham', pronunciation: 'AH-rah-hahng', etymology: 'from √arh "to be worthy" (sheet *araham*; standard *arahaṃ*)', gloss: 'worthy; one free of all defilement', citations: [dpdCitation('arahant'), pronCite] },
            { form: 'samma', pronunciation: 'SAHM-mah', gloss: 'rightly, fully (sheet *samma*; standard *sammā*)', citations: [dpdCitation('sammā'), pronCite] },
            { form: 'sambuddho', pronunciation: 'sahm-BUD-dhoh', root: '√budh', etymology: '*saṃ-* "fully, self" + *buddha* "awakened" (√budh)', gloss: 'fully self-awakened — the Buddha', citations: [dpdCitation('sambuddha'), pronCite] },
          ],
        },
        {
          id: 'itipiso-line-2',
          pali: 'Vijja charan sampanno sugato loko vidhu',
          witnesses: [
            {
              by: 'Literal gloss',
              text: 'accomplished in knowledge and conduct, well-gone, knower of worlds,',
              alignTo: [2, -1, 0, -1, 1, 3, 5, -1, 4],
            },
          ],
          words: [
            { form: 'Vijja', pronunciation: 'VIJ-jah', gloss: 'knowledge, the higher knowings (sheet *Vijja*; standard *vijjā*)', citations: [dpdCitation('vijjā'), pronCite] },
            { form: 'charan', pronunciation: 'CHAH-rahn', gloss: 'conduct, practice (sheet *charan*; standard *caraṇa*)', citations: [dpdCitation('caraṇa'), pronCite] },
            { form: 'sampanno', pronunciation: 'sahm-PAHN-noh', gloss: 'endowed with, accomplished in', citations: [dpdCitation('sampanna'), pronCite] },
            { form: 'sugato', pronunciation: 'soo-GAH-toh', etymology: '*su-* "well" + *gata* "gone"', gloss: 'the Well-Gone One, the Fortunate One', citations: [dpdCitation('sugata'), pronCite] },
            { form: 'loko', pronunciation: 'LOH-koh', gloss: 'world, the world(s)', citations: [dpdCitation('loka'), pronCite] },
            { form: 'vidhu', pronunciation: 'VEE-doo', gloss: 'knower (sheet *vidhu*; standard *vidū*, "one who knows") — together *loko vidhu* = "knower of worlds"', citations: [dpdCitation('vidū'), pronCite] },
          ],
        },
        // Itipiso continuation + the recollection-homage stanza — transcribed
        // from the top of the following sheet photo (PXL_20260530_141420478).
        // Faithful Pali + working English; word-by-word depth still to be curated.
        {
          id: 'itipiso-line-3',
          pali: 'Anuttaro purisa dhamma sarathi',
          witnesses: [{ by: 'Literal gloss', text: 'the unsurpassed guide for those to be tamed,' }],
        },
        {
          id: 'itipiso-line-4',
          pali: 'Satthadeva manussanam Buddho Bhagawati',
          witnesses: [{ by: 'Literal gloss', text: 'teacher of gods and humans, the Awakened One, the Blessed One.' }],
        },
        {
          id: 'buddha-homage-1',
          pali: 'Buddham jivita pariyantam sarnam gacchami',
          witnesses: [{ by: 'Literal gloss', text: 'To the Buddha I go for refuge as long as life lasts.' }],
        },
        {
          id: 'buddha-homage-2',
          pali: 'Ye cha Buddha atitacha ye cha Buddha anagata',
          witnesses: [{ by: 'Literal gloss', text: 'Whatever Buddhas there have been, and Buddhas yet to come,' }],
        },
        {
          id: 'buddha-homage-3',
          pali: 'Pacchupanna cha ye Buddha, aham vandaami sabbada',
          witnesses: [{ by: 'Literal gloss', text: 'and the Buddhas of the present — I revere them always.' }],
        },
        {
          id: 'buddha-homage-4',
          pali: 'Natthi me saranam ayyam, Buddho me saranam varam',
          witnesses: [{ by: 'Literal gloss', text: 'No other refuge have I; the Buddha is my supreme refuge.' }],
        },
        {
          id: 'buddha-homage-5',
          pali: 'Yetena saccha vajjena hotu me jaya mangalam',
          witnesses: [{ by: 'Literal gloss', text: 'By this utterance of truth, may the blessing of victory be mine.' }],
        },
        {
          id: 'buddha-homage-6',
          pali: 'Uttamangena vandcham padpanshu varuttamam',
          witnesses: [{ by: 'Literal gloss', text: 'With my head I revere the dust of his most excellent feet.' }],
        },
        {
          id: 'buddha-homage-7',
          pali: 'Buddhe yo khalito to doso, Buddho khamtu tam mamam',
          witnesses: [{ by: 'Literal gloss', text: 'Whatever wrong I have done toward the Buddha, may the Buddha forgive it.' }],
        },
      ],
      commentary:
        'Buddha Vandana — the recollection of the Buddha (*Buddhānussati*), the "Itipiso", recited across the Theravāda world, followed by the recollection-homage stanza (*Buddhaṃ jīvitapariyantaṃ saraṇaṃ gacchāmi…*). Transcribed verbatim from the monastery sheets — the block spans the bottom of PXL_20260530_141418331 and the top of PXL_20260530_141420478 — preserving the sheet\'s simplified romanization (*Itipo* for *iti pi so*, *araham* for *arahaṃ*, *charan* for *caraṇa*, *vidhu* for *vidū*, *ayyam* for *aññaṃ*). The first two lines carry full word-by-word data; the continuation is faithful Pali + a working English gloss, with per-word depth still to be curated.',
    },
  ],
};

export default sariputtaRefugesAndPrecepts;

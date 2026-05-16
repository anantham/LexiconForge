/**
 * The Way of Compassion — Karaṇīya Metta Sutta in E.A. Burtt\'s rendering.
 *
 * The same Sutta-Nipāta 1.8 / Khuddakapāṭha 9 *loving-kindness* text
 * that lives under [[metta-sutta]] (MAPLE / Amaravati English), here in
 * a different translation: Edwin Arthur Burtt\'s rendering from *The
 * Teachings of the Compassionate Buddha* (Mentor Books, 1955). Burtt\'s
 * English is more lyrical and Victorian than Amaravati\'s — "let all-
 * embracing thoughts for all that lives be thine, an all-embracing love
 * for all the universe…"
 *
 * Bodhi Sangha booklet, p.15. Followed in the booklet by the *Om Tat
 * Sat* closing — a Vedic / Hindu mantra acknowledging the Indian
 * setting of AMA Samy\'s community.
 */

import type { LiturgyDoc } from '../../types/liturgy';
import { ungroundedCitation } from './_groundingHelpers';

export const wayOfCompassion: LiturgyDoc = {
  slug: 'way-of-compassion',
  sangha: 'bodhi-sangha',
  order: 10,
  title: 'The Way of Compassion',
  subtitle: 'Karaṇīya Metta Sutta (Sn 1.8) — Burtt\'s rendering',
  tradition: 'theravada',
  context: 'Recited at Bodhi Sangha as the loving-kindness contemplation. Edwin Arthur Burtt\'s English rendering of the *Karaṇīya Metta Sutta*, from his 1955 anthology *The Teachings of the Compassionate Buddha*. Closes with *Om Tat Sat* — a Vedic mantra acknowledging the sangha\'s Indian setting.',
  sources: {
    canonical: [
      { label: 'Sn 1.8 — Karaṇīya Metta Sutta', url: 'https://suttacentral.net/snp1.8/en/sujato' },
      { label: 'Multi-script Pali version at /liturgy/maple/metta-sutta' },
      { label: 'E.A. Burtt, *The Teachings of the Compassionate Buddha* (1955)' },
    ],
    ritual: [
      { label: 'Bodhi Sangha Sutras booklet (May 2016), p.15' },
    ],
  },
  curator:
    'Curation by Aditya. The English here is Burtt\'s translation as transcribed from the Bodhi Sangha booklet. For the Pali source text + Amaravati English rendering used at MAPLE, see [[metta-sutta]]. The closing *Om Tat Sat* mantra is from Bhagavad Gītā 17.23 — a Vedic affirmation, here used as Indo-syncretic closing in the Tamil-Nadu sangha\'s context.',
  sections: [
    {
      id: 'framing',
      shape: 'prose-commentary',
      body: 'The *Karaṇīya Metta Sutta* (Sn 1.8 / Khp 9) is the canonical Theravāda loving-kindness text. It opens with the formula for one who would do good — peaceful, content, restrained — then turns to the wish: *that all beings be at ease*, extending without limit through all categories of life.\n\nBodhi Sangha chants this in E.A. Burtt\'s 1955 English rendering — written in a lyric register that reads aloud well: *Just as with her own life / a mother shields from hurt / her own, her only, child, / let all-embracing thoughts / for all that lives be thine, / an all-embracing love / for all the universe…*\n\nThe Pali source + a more contemporary English (Amaravati Sangha) live under [[metta-sutta]] in MAPLE\'s liturgy. This page presents Bodhi\'s alternative.',
    },
    {
      id: 'opening',
      shape: 'prose-commentary',
      heading: 'May all beings be blessed',
      body: 'May creatures all abound in weal and peace;\nmay all be blessed with peace always;\nall creatures weak or strong,\nall creatures great and small;\ncreatures unseen or seen,\ndwelling afar or near,\nborn or awaiting birth,\nmay all be blessed with peace!',
    },
    {
      id: 'no-harm',
      shape: 'prose-commentary',
      heading: 'No harm',
      body: 'Let none cajole or flout\nhis fellow anywhere;\nlet none wish others harm\nin dudgeon or in hate.',
    },
    {
      id: 'mother-child',
      shape: 'prose-commentary',
      heading: 'As a mother shields her child',
      body: 'Just as with her own life\na mother shields from hurt\nher own, her only, child,\nlet all-embracing thoughts\nfor all that lives be thine,\nan all-embracing love\nfor all the universe\nin all its heights and depths\nand breadth, unstinted love,\nunmarred by hate within,\nnot rousing enmity.',
    },
    {
      id: 'state-divine',
      shape: 'prose-commentary',
      heading: 'A state divine',
      body: 'So, as you stand or walk,\nor sit, or lie, reflect\nwith all your might on this;\n\'tis deemed "a state divine."\n\n*(Sutta-Nipāta 1.8)*',
    },
    {
      id: 'om-tat-sat',
      shape: 'prose-commentary',
      heading: 'Om Tat Sat',
      body: '**Om Tat Sat.**\n\n*Booklet glossary: "Om, That is the Reality." From Bhagavad Gītā 17.23. AMA Samy\'s sangha closes the loving-kindness contemplation with this Vedic affirmation — the same syllable Bodhi opens with at the end of [[ti-sarana]] (*Om Shanti*), now in its conceptual form: not peace alone, but the That-which-is.*',
    },
  ],
};

export default wayOfCompassion;

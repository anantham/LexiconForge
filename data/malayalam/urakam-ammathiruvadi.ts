/**
 * ഊരകത്ത് അമ്മതിരുവടി — Aithihyamala ch. 64 (Kottarathil Sankunni, 1909).
 * Source: ml.wikisource.org/wiki/ഐതിഹ്യമാല/ഊരകത്ത്_അമ്മതിരുവടി — PUBLIC DOMAIN
 * (published 1909–1934; author d. 1937).
 *
 * PILOT: sentence 1 of ~30 paragraphs, curated as AlignSegments — one segment
 * per CLAUSE (breath-group), so the prose cadence is visible as lines.
 *
 * Design decisions embodied here (see WORKLOG / discussion 2026-07-11):
 *  - Malayalam pieces are SANDHI-RESOLVED MORPHEMES (കണക്ക് · എഴുത്ത് · ഉം …),
 *    not graphical slices of the fused surface; the token `note` always
 *    carries the exact written form so the fusion is taught, not hidden.
 *  - Romanization is PRACTICAL (Mozhi-flavoured: zha/th/kk), aimed at a
 *    heritage speaker relearning the script — not ISO 15919 (that can come
 *    back as a facet later).
 *  - English is a WITNESS rendering (by: 'opus-draft'), our translation, off
 *    by default in the page; supplied words ("the", "he") bind to no unit and
 *    say so.
 *
 * Curation status: DRAFTED BY OPUS — native review pending (Aditya).
 */

import type { AlignSegment } from '../../types/liturgyAlign';

export const URAKAM_SENTENCE_1: AlignSegment[] = [
  // ── ഊരകത്ത് അമ്മതിരുവടിക്ഷേത്രത്തിൽ ──────────────────────────────
  {
    id: 'urk-s1c1',
    gloss: 'At the Ammathiruvadi temple in Urakam',
    units: [
      { id: 'u-urakam', gloss: 'Urakam (the village)', conceptId: 'concept.urakam' },
      { id: 'u-in-a', gloss: 'in / at', ghost: false },
      { id: 'u-amma', gloss: 'mother' },
      { id: 'u-thiruvadi', gloss: 'holy feet (honorific)', conceptId: 'concept.thiruvadi' },
      { id: 'u-temple', gloss: 'temple', conceptId: 'concept.kshetram' },
      { id: 'u-in-b', gloss: 'in' },
    ],
    renderings: [
      {
        lang: 'ml-Mlym',
        label: 'Malayalam',
        tokens: [
          {
            text: 'ഊരകത്ത്',
            units: ['u-urakam', 'u-in-a'],
            note: 'Written ഊരകത്ത് — the place-name ഊരകം with its -ം melting into the "at" ending.',
            segments: [
              {
                text: 'ഊരക',
                pronunciation: 'ooraka',
                gloss: 'Urakam — ūru "village" + akam "inside": the village-heart',
                units: ['u-urakam'],
              },
              {
                text: 'ത്ത്',
                pronunciation: 'thu',
                gloss: 'at / in — the ending that places you somewhere',
                units: ['u-in-a'],
                faint: true,
              },
            ],
          },
          {
            text: 'അമ്മതിരുവടിക്ഷേത്രത്തിൽ',
            units: ['u-amma', 'u-thiruvadi', 'u-temple', 'u-in-b'],
            note: 'One written word, four ideas: mother + holy-feet + temple + in. Malayalam stacks; English unstacks.',
            segments: [
              { text: 'അമ്മ', pronunciation: 'amma', gloss: 'mother', units: ['u-amma'] },
              {
                text: 'തിരുവടി',
                pronunciation: 'thiruvadi',
                gloss: 'holy feet — reverence addresses the goddess through her feet',
                units: ['u-thiruvadi'],
              },
              {
                text: 'ക്ഷേത്ര',
                pronunciation: 'kshethra',
                gloss: 'temple — Sanskrit kṣetra "field", borrowed whole (a tatsama: see the conjunct ക്ഷ)',
                units: ['u-temple'],
              },
              {
                text: 'ത്തിൽ',
                pronunciation: 'thil',
                gloss: 'in',
                units: ['u-in-b'],
                faint: true,
              },
            ],
          },
        ],
      },
      {
        lang: 'en',
        label: 'English',
        by: 'opus-draft',
        tokens: [
          { text: 'At', units: ['u-in-b'] },
          { text: 'the', units: [], gloss: 'supplied by English — Malayalam has no "the"' },
          { text: 'Ammathiruvadi', units: ['u-amma', 'u-thiruvadi'], relation: 'transliteration' },
          { text: 'temple', units: ['u-temple'] },
          { text: 'in', units: ['u-in-a'] },
          { text: 'Urakam', units: ['u-urakam'], relation: 'transliteration' },
        ],
      },
    ],
  },

  // ── പണ്ടൊരു കാലത്തു ──────────────────────────────────────────────
  {
    id: 'urk-s1c2',
    gloss: 'once, long ago',
    units: [
      { id: 'u-longago', gloss: 'long ago' },
      { id: 'u-a', gloss: 'one / a' },
      { id: 'u-time', gloss: 'time' },
    ],
    renderings: [
      {
        lang: 'ml-Mlym',
        label: 'Malayalam',
        tokens: [
          {
            text: 'പണ്ടൊരു',
            units: ['u-longago', 'u-a'],
            note: 'Two words fused by sandhi: paṇḍu + oru → paṇḍoru. The -u melts before the o-.',
            segments: [
              { text: 'പണ്ട്', pronunciation: 'pandu', gloss: 'long ago, in old times', units: ['u-longago'] },
              { text: 'ഒരു', pronunciation: 'oru', gloss: 'one, a', units: ['u-a'] },
            ],
          },
          {
            text: 'കാലത്തു',
            units: ['u-time'],
            segments: [
              {
                text: 'കാല',
                pronunciation: 'kaala',
                gloss: 'time — Sanskrit kāla, the same word in kālachakra',
                units: ['u-time'],
              },
              { text: 'ത്തു', pronunciation: 'thu', gloss: 'in', units: ['u-time'], faint: true },
            ],
          },
        ],
      },
      {
        lang: 'en',
        label: 'English',
        by: 'opus-draft',
        tokens: [
          {
            text: 'Once upon a time,',
            units: ['u-longago', 'u-a', 'u-time'],
            relation: 'interpretive',
            note: 'One English idiom absorbs all three Malayalam pieces.',
          },
        ],
      },
    ],
  },

  // ── വാഴപ്പിള്ളി മേനോന്മാരിൽ ഒരാൾക്ക് ─────────────────────────────
  {
    id: 'urk-s1c3',
    gloss: 'one of the Vazhappilly Menons',
    units: [
      { id: 'u-vazhappilly', gloss: 'Vazhappilly (family name)' },
      { id: 'u-menons', gloss: 'the Menons', conceptId: 'concept.menon' },
      { id: 'u-among', gloss: 'among' },
      { id: 'u-one-man', gloss: 'one person' },
      {
        id: 'u-to',
        gloss: 'to (him) — Malayalam gives possession with "to": "to him there was"',
        ghost: false,
      },
    ],
    renderings: [
      {
        lang: 'ml-Mlym',
        label: 'Malayalam',
        tokens: [
          {
            text: 'വാഴപ്പിള്ളി',
            units: ['u-vazhappilly'],
            note: 'House name of the temple\'s hereditary staff. Read it syllable by syllable — it carries the zha.',
            segments: [
              { text: 'വാ', pronunciation: 'vaa', akshara: true, gloss: 'the sound vaa' },
              {
                text: 'ഴ',
                pronunciation: 'zha',
                akshara: true,
                gloss: 'the sound zha — Malayalam\'s signature ḻ, tongue curled back; the sound in Kozhikode',
              },
              { text: 'പ്പി', pronunciation: 'ppi', akshara: true, gloss: 'the sound ppi — doubled p' },
              { text: 'ള്ളി', pronunciation: 'lli', akshara: true, gloss: 'the sound lli — doubled retroflex ḷ' },
            ],
          },
          {
            text: 'മേനോന്മാരിൽ',
            units: ['u-menons', 'u-among'],
            note: 'Title + plural + "among", one written word: mēnōn + mār + il.',
            segments: [
              {
                text: 'മേനോൻ',
                pronunciation: 'menon',
                gloss: 'Menon — a Nair title; the writers and account-keepers',
                units: ['u-menons'],
              },
              { text: 'മാർ', pronunciation: 'maar', gloss: 'plural (for people)', units: ['u-menons'], faint: true },
              { text: 'ഇൽ', pronunciation: 'il', gloss: 'among / in', units: ['u-among'], faint: true },
            ],
          },
          {
            text: 'ഒരാൾക്ക്',
            units: ['u-one-man', 'u-to'],
            note: 'oru + āḷ fuse to orāḷ ("one person" — ends in the chillu ൾ), then -kku: "to one person". With the sentence-final "there was", this is how Malayalam says he HAD.',
            segments: [
              {
                text: 'ഒരാൾ',
                pronunciation: 'oraal',
                gloss: 'one person — oru + āḷ fused; āḷ "person" ends in the chillu ൾ',
                units: ['u-one-man'],
              },
              {
                text: 'ക്ക്',
                pronunciation: 'kku',
                gloss: 'to / for — possession in Malayalam: "to X there is" = X has',
                units: ['u-to'],
                faint: true,
              },
            ],
          },
        ],
      },
      {
        lang: 'en',
        label: 'English',
        by: 'opus-draft',
        tokens: [
          { text: 'one man', units: ['u-one-man'] },
          { text: 'among', units: ['u-among'] },
          { text: 'the', units: [], gloss: 'supplied by English — Malayalam has no "the"' },
          { text: 'Vazhappilly', units: ['u-vazhappilly'], relation: 'transliteration' },
          {
            text: 'Menons',
            units: ['u-menons'],
            relation: 'transliteration',
            note: 'The "to him" (ഒരാൾക്ക്) surfaces in English only inside "had" — see the last line.',
          },
        ],
      },
    ],
  },

  // ── ആദ്യം നടകാവലും ───────────────────────────────────────────────
  {
    id: 'urk-s1c4',
    gloss: 'first held the gate-watch',
    units: [
      { id: 'u-first', gloss: 'first' },
      { id: 'u-gate', gloss: 'the shrine door (nada)' },
      { id: 'u-watch', gloss: 'guard duty' },
      { id: 'u-and-a', gloss: 'and (first of the pair "both…and")' },
    ],
    renderings: [
      {
        lang: 'ml-Mlym',
        label: 'Malayalam',
        tokens: [
          {
            text: 'ആദ്യം',
            units: ['u-first'],
            pronunciation: 'aadyam',
            gloss: 'first — Sanskrit ādya, "the beginning one"',
          },
          {
            text: 'നടകാവലും',
            units: ['u-gate', 'u-watch', 'u-and-a'],
            note: 'naṭa + kāval + um. The paired -um…-um ("both…and") sets up the next line.',
            segments: [
              {
                text: 'നട',
                pronunciation: 'nada',
                gloss: 'the shrine door / steps — where deity and devotee meet; the word in "nada thurakkal", the opening of the shrine',
                units: ['u-gate'],
              },
              {
                text: 'കാവൽ',
                pronunciation: 'kaaval',
                gloss: 'watch, guarding — old Dravidian; Tamil kāval is the same word',
                units: ['u-watch'],
              },
              {
                text: 'ഉം',
                pronunciation: 'um',
                gloss: 'and — first of the pair um…um, "both…and"',
                units: ['u-and-a'],
                faint: true,
              },
            ],
          },
        ],
      },
      {
        lang: 'en',
        label: 'English',
        by: 'opus-draft',
        tokens: [
          { text: 'first', units: ['u-first'] },
          { text: 'the', units: [], gloss: 'supplied by English' },
          { text: 'gate-watch', units: ['u-gate', 'u-watch'] },
          { text: 'and', units: ['u-and-a'] },
        ],
      },
    ],
  },

  // ── പിന്നീടു കണക്കെഴുത്തുമുണ്ടായിരുന്നു ──────────────────────────
  {
    id: 'urk-s1c5',
    gloss: 'and later the accounts-writing too',
    units: [
      { id: 'u-later', gloss: 'later, afterwards' },
      { id: 'u-accounts', gloss: 'the accounts' },
      { id: 'u-writing', gloss: 'writing' },
      { id: 'u-and-b', gloss: 'also (second of the pair)' },
      { id: 'u-had', gloss: 'there was — with "to him" above: he had' },
    ],
    renderings: [
      {
        lang: 'ml-Mlym',
        label: 'Malayalam',
        tokens: [
          { text: 'പിന്നീടു', units: ['u-later'], pronunciation: 'pinneedu', gloss: 'later, afterwards' },
          {
            text: 'കണക്കെഴുത്തുമുണ്ടായിരുന്നു',
            units: ['u-accounts', 'u-writing', 'u-and-b', 'u-had'],
            note: 'One written word = an English clause. kaṇakku + ezhuthu + um + uṇḍāyirunnu, every seam fused by sandhi: kk+e→kke, u+u→u, m+u→mu.',
            segments: [
              {
                text: 'കണക്ക്',
                pronunciation: 'kanakku',
                gloss: 'count, account — Dravidian; Tamil kaṇakku is the same word',
                units: ['u-accounts'],
              },
              {
                text: 'എഴുത്ത്',
                pronunciation: 'ezhuthu',
                gloss: 'writing — the word in Ezhuthachan, "father of writing"; carries the zha',
                units: ['u-writing'],
              },
              {
                text: 'ഉം',
                pronunciation: 'um',
                gloss: 'also — closing the pair opened by നടകാവലും',
                units: ['u-and-b'],
                faint: true,
              },
              {
                text: 'ഉണ്ടായിരുന്നു',
                pronunciation: 'undaayirunnu',
                gloss: 'there-was: uṇḍu "exists" + āyi "became" + irunnu "stayed" — an auxiliary chain English says as one word, "had"',
                units: ['u-had'],
              },
            ],
          },
        ],
      },
      {
        lang: 'en',
        label: 'English',
        by: 'opus-draft',
        tokens: [
          { text: 'and later', units: ['u-later', 'u-and-b'] },
          {
            text: 'he had',
            units: ['u-had'],
            relation: 'interpretive',
            note: 'Malayalam has no verb "to have" — possession is "to X, there is". The dative ഒരാൾക്ക് two lines up completes this verb.',
          },
          { text: 'the', units: [], gloss: 'supplied by English' },
          { text: 'accounts-writing', units: ['u-accounts', 'u-writing'] },
        ],
      },
    ],
  },
];

export default URAKAM_SENTENCE_1;

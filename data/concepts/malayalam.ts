/**
 * Malayalam concept registry — pilot entries for the Aithihyamala reader
 * (`/malayalam`). Same ConceptNode model as the Heart Sutra registry;
 * merged into the runtime index in `lookup.ts`.
 *
 * Curation status: DRAFTED BY OPUS (2026-07-11) from general knowledge +
 * the legend text itself. Native-speaker review pending (Aditya). Every
 * definition that rests on my knowledge rather than a checked source uses
 * `ungroundedCitation` so the UI's audit panel shows the honest flag.
 */

import type { ConceptRegistry } from '../../types/conceptGraph';
import { ungroundedCitation } from '../liturgy/_groundingHelpers';

export const MALAYALAM_CONCEPTS: ConceptRegistry = {
  'concept.urakam': {
    id: 'concept.urakam',
    preferredLabel: 'Urakam',
    attestations: [
      { language: 'ml', script: 'Mlym', text: 'ഊരകം' },
      { language: 'ml', script: 'Mlym', text: 'ഊരക' },
      { language: 'en', script: 'Latn', text: 'Urakam', relation: 'transliteration' },
    ],
    definition:
      'A village about 10 km south of Thrissur town, home of the Ammathiruvadi temple whose goddess this legend accounts for. ' +
      'The name itself decomposes: ūru "village" + akam "inside" — the place is named "village-heart". ' +
      'Urakam sits in the Peruvanam orbit, the oldest pooram country in Kerala; the Ammathiruvadi is counted among the deities of the Arattupuzha Pooram gathering.',
    citations: [
      ungroundedCitation('Opus general knowledge; Thrissur-district geography and pooram membership need local verification'),
    ],
    notes: 'Reader is staying ~10 km from here (Muttichur) — the geography facet is the point, not a footnote.',
  },

  'concept.thiruvadi': {
    id: 'concept.thiruvadi',
    preferredLabel: 'Thiruvadi (holy feet)',
    attestations: [
      { language: 'ml', script: 'Mlym', text: 'തിരുവടി' },
      { language: 'en', script: 'Latn', text: 'Thiruvadi', relation: 'transliteration' },
    ],
    definition:
      'Literally "holy feet" — tiru (sacred, the Dravidian honorific answering Sanskrit śrī) + aṭi (foot). ' +
      'Addressing a deity or sovereign through their feet is the classical Dravidian gesture of reverence; ' +
      '"Ammathiruvadi" names the Urakam goddess as "the Mother of the Sacred Feet".',
    citations: [
      ungroundedCitation('Opus general knowledge; tiru↔śrī relationship is scholarly consensus but uncited here'),
    ],
  },

  'concept.kshetram': {
    id: 'concept.kshetram',
    preferredLabel: 'kṣetra → ക്ഷേത്രം',
    attestations: [
      { language: 'ml', script: 'Mlym', text: 'ക്ഷേത്രം' },
      { language: 'ml', script: 'Mlym', text: 'ക്ഷേത്ര' },
      { language: 'sa', script: 'Latn', text: 'kṣetra' },
    ],
    definition:
      'Sanskrit kṣetra "field, ground, domain" — in Kerala usage, a temple: the deity\'s cultivated ground. ' +
      'A tatsama: Sanskrit taken into Malayalam whole, conjuncts intact (ക്ഷ), unlike tadbhava words worn smooth by the mouth. ' +
      'The same root gives kṣetrajña "knower of the field" in the Gita — a temple is a field where presence is farmed.',
    citations: [
      ungroundedCitation('Opus general knowledge; kṣetra etymology is standard but uncited here'),
    ],
  },

  'concept.menon': {
    id: 'concept.menon',
    preferredLabel: 'Menon',
    attestations: [
      { language: 'ml', script: 'Mlym', text: 'മേനോൻ' },
      { language: 'en', script: 'Latn', text: 'Menon', relation: 'transliteration' },
      { language: 'en', script: 'Latn', text: 'Menons', relation: 'transliteration' },
    ],
    definition:
      'A title among Nairs, historically the writers and account-keepers of temples and chiefly households — ' +
      'the traditional derivation is mēl "above" + avan "he", the overseer. ' +
      'In this legend the Vazhappilly Menons hold exactly that hereditary office: gate-watch, then the account books — which one of them burns.',
    contested: true,
    citations: [
      ungroundedCitation('Opus general knowledge; the mēl+avan derivation is traditional and contested among etymologists'),
    ],
  },
};

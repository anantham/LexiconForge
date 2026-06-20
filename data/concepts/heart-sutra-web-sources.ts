import type { Citation } from '../../types/suttaStudio';
import { wiktionaryEntryCitation, dpdCitation } from '../liturgy/_groundingHelpers';

/**
 * Free, clickable, *verified* dictionary citations layered onto the Heart Sutra
 * concept registry — Wiktionary (the actual glyph the reader sees) + the Digital
 * Pāli Dictionary (Pāli lemma). These reduce reliance on the login-walled DDB and
 * the print-only, unverifiable Princeton page numbers.
 *
 * EVERY Wiktionary title below was confirmed to resolve via the Wiktionary API
 * (action=query existence check) before being added — 17 candidate titles that
 * 404'd (negation compounds, proper-noun gaps, Han phrases) were dropped, and
 * IAST romanizations were excluded entirely (they collide with English words —
 * e.g. "gate"). Native script only. Concepts with no verifiable free source
 * (six-faculties, four-truths, mental-obstruction, inverted-view, fearless,
 * dhāraṇī) are simply absent — we add only what we can stand behind.
 *
 * DPD entries are honest search deep-links over a comprehensive Pāli dictionary;
 * the lemmas are standard canonical vocabulary.
 */
const SA = 'Sanskrit';
const ZH = 'Chinese';

// concept id → { wikt: [title, scriptLabel][], dpd?: Pāli lemma }
const W: Record<string, { wikt?: [string, string][]; dpd?: string }> = {
  'concept.wisdom-prajna': { wikt: [['प्रज्ञा', SA], ['般若', ZH]], dpd: 'paññā' },
  'concept.perfection-paramita': { wikt: [['波羅蜜多', ZH]], dpd: 'pāramī' },
  'concept.practice-carya': { wikt: [['चर्या', SA], ['行', ZH]], dpd: 'cariyā' },
  'concept.deep-gambhira': { wikt: [['गम्भीर', SA], ['深', ZH]], dpd: 'gambhīra' },
  'concept.avalokita-bodhisattva': { wikt: [['觀自在', ZH]] },
  'concept.bodhisattva': { wikt: [['बोधिसत्त्व', SA], ['菩薩', ZH]], dpd: 'bodhisatta' },
  'concept.skandha-aggregate': { wikt: [['स्कन्ध', SA], ['蘊', ZH]], dpd: 'khandha' },
  'concept.form-rupa': { wikt: [['रूप', SA], ['色', ZH]], dpd: 'rūpa' },
  'concept.svabhava-own-being': { wikt: [['स्वभाव', SA]], dpd: 'sabhāva' },
  'concept.emptiness-sunyata': { wikt: [['शून्यता', SA], ['空', ZH]], dpd: 'suññatā' },
  'concept.seeing-vyavalokita': { dpd: 'passati' },
  'concept.suffering-duhkha': { wikt: [['दुःख', SA], ['苦', ZH]], dpd: 'dukkha' },
  'concept.sariputra-addressee': { wikt: [['舍利子', ZH]], dpd: 'Sāriputta' },
  'concept.dharma-phenomena': { wikt: [['धर्म', SA], ['法', ZH]], dpd: 'dhamma' },
  'concept.unarisen-anutpada': { dpd: 'anuppāda' },
  'concept.realm-dhatu': { wikt: [['धातु', SA], ['界', ZH]], dpd: 'dhātu' },
  'concept.ignorance-avidya': { wikt: [['अविद्या', SA], ['無明', ZH]], dpd: 'avijjā' },
  'concept.aging-death-jaramarana': { wikt: [['老死', ZH]], dpd: 'jarāmaraṇa' },
  'concept.knowledge-jnana': { wikt: [['ज्ञान', SA], ['智', ZH]], dpd: 'ñāṇa' },
  'concept.attainment-prapti': { wikt: [['प्राप्ति', SA], ['得', ZH]], dpd: 'patti' },
  'concept.nirvana-extinguishing': { wikt: [['निर्वाण', SA], ['究竟涅槃', ZH]], dpd: 'nibbāna' },
  'concept.three-times-tryadhva': { wikt: [['三世', ZH]] },
  'concept.mantra-vidya': { wikt: [['咒', ZH]] },
  'concept.heart-sutra-work': { wikt: [['般若波羅蜜多心經', ZH]] },
};

/** concept id → verified free-source citations to merge into the registry. */
export const WEB_SOURCES: Record<string, Citation[]> = Object.fromEntries(
  Object.entries(W).map(([id, x]) => [
    id,
    [
      ...(x.wikt ?? []).map(([title, script]) => wiktionaryEntryCitation(title, script)),
      ...(x.dpd ? [dpdCitation(x.dpd)] : []),
    ],
  ]),
);

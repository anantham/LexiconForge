import type { AlignSegment, AlignUnit, AlignRendering, AlignToken, AlignRelation } from '../../../types/liturgyAlign';
import { conceptsForToken, getConcept } from '../../../data/concepts/lookup';

/**
 * LIVE-WIRING increment 1 — make the concept graph load-bearing.
 *
 * Turns a shipped `triple-script-witness` segment (from data/liturgy/*.ts) into
 * the concept-aligned model by asking `conceptsForToken()` what each token
 * attests. Where the registry resolves a token, it carries that concept as a
 * unit (so the cross-script alignment threads light up); where it doesn't, the
 * token is left visibly "not aligned yet" — the honest worklist for the
 * hand-fill pass (compounds, inflected forms, particles the lemma-level
 * registry can't match).
 *
 * Deliberately coarse for now: word-level (no akshara split), one English
 * witness, CJK kept as separate rows, Devanāgarī skipped (the shipped line
 * isn't word-tokenized). Those are the next increments.
 */

const CJK = /[㐀-鿿豈-﫿]/;
const langSub = (l: string) => l.split('-')[0];
const scrSub = (l: string) => l.split('-')[1] ?? 'Latn';

function tokenize(text: string, tokens: string[] | undefined, script: string): string[] {
  if (tokens && tokens.length) return tokens;
  if (script === 'Tibt') return text.split(/[་༌།༎\s]+/).filter(Boolean);
  if (script === 'Hant' || script === 'Jpan') return [...text].filter((c) => CJK.test(c));
  return text.split(/\s+/).filter(Boolean);
}
const clean = (t: string) => t.replace(/་$/, '').replace(/[.,;:!?"'()\[\]।॥—–]+$/u, '');

/**
 * Chant-surface → concept bindings: the inflected/compound forms the
 * lemma-level registry can't match on its own (the hand-fill that closes the
 * alignment gaps). Keyed by the cleaned surface token; grows segment by
 * segment. A compound surface binds to several concepts at once.
 */
const BIND: Record<string, string[]> = {
  // Sanskrit (IAST) — inflected forms + compounds
  bodhisattvo: ['concept.bodhisattva'],
  gambhīrāṃ: ['concept.deep-gambhira'],
  prajñāpāramitācaryāṃ: ['concept.wisdom-prajna', 'concept.perfection-paramita', 'concept.practice-carya'],
  caramāṇo: ['concept.practice-carya'],
  vyavalokayati: ['concept.seeing-vyavalokita'],
  paśyati: ['concept.seeing-vyavalokita'],
  skandhāḥ: ['concept.skandha-aggregate'],
  svabhāvaśūnyān: ['concept.svabhava-own-being', 'concept.emptiness-sunyata'],
  // Tibetan — the shipped line carries the whole name (with the ārya- prefix) as one token
  'འཕགས་པ་སྤྱན་རས་གཟིགས་དབང་ཕྱུག': ['concept.avalokita-bodhisattva'],

  // ── Heart Sutra body (Sonnet-drafted, reviewed; ambiguous/no-concept surfaces left unbound) ──
  // Sanskrit (IAST)
  śūnyatālakṣaṇāḥ: ['concept.emptiness-sunyata'],
  śūnyatāyāṃ: ['concept.emptiness-sunyata'],
  anutpannā: ['concept.unarisen-anutpada'],
  aniruddhā: ['concept.unarisen-anutpada'],
  Chāriputra: ['concept.sariputra-addressee'],
  vedanā: ['concept.skandha-aggregate'],
  saṃjñā: ['concept.skandha-aggregate'],
  saṃskārāḥ: ['concept.skandha-aggregate'],
  vijñānam: ['concept.skandha-aggregate'],
  cakṣur: ['concept.six-faculties'],
  śrotraṃ: ['concept.six-faculties'],
  ghrāṇaṃ: ['concept.six-faculties'],
  kāyo: ['concept.six-faculties'],
  manaḥ: ['concept.six-faculties'],
  dharmāḥ: ['concept.dharma-phenomena'],
  cakṣurdhātur: ['concept.realm-dhatu'],
  manovijñānadhātuḥ: ['concept.realm-dhatu'],
  avidyākṣayo: ['concept.ignorance-avidya'],
  jarāmaraṇaṃ: ['concept.aging-death-jaramarana'],
  jarāmaraṇakṣayaḥ: ['concept.aging-death-jaramarana'],
  'duḥkha-samudaya-nirodha-mārgāḥ': ['concept.four-truths'],
  jñānaṃ: ['concept.knowledge-jnana'],
  jñātavyaṃ: ['concept.knowledge-jnana'],
  prāptiḥ: ['concept.attainment-prapti'],
  aprāptitvāt: ['concept.attainment-prapti'],
  'Cittāvaraṇa-': ['concept.obstruction-cittavarana'],
  viparyāsātikrānto: ['concept.inverted-view-viparyasa'],
  Tryadhvavyavasthitāḥ: ['concept.three-times-tryadhva'],
  prajñāpāramitām: ['concept.wisdom-prajna', 'concept.perfection-paramita'],
  prajñāpāramitā: ['concept.wisdom-prajna', 'concept.perfection-paramita'],
  prajñāpāramitāyām: ['concept.wisdom-prajna', 'concept.perfection-paramita'],
  mahāmantraḥ: ['concept.mantra-vidya'],
  mahāvidyāmantraḥ: ['concept.mantra-vidya'],
  anuttaramantraḥ: ['concept.mantra-vidya'],
  asamasamamantraḥ: ['concept.mantra-vidya'],
  mantraḥ: ['concept.mantra-vidya'],
  sarvaduḥkhapraśamanaḥ: ['concept.suffering-duhkha'],
  // Chinese · Japanese (shared Han characters; keyed by surface)
  '諸法': ['concept.dharma-phenomena'],
  '生': ['concept.unarisen-anutpada'],
  '滅': ['concept.unarisen-anutpada'],
  '受': ['concept.skandha-aggregate'],
  '想': ['concept.skandha-aggregate'],
  '識': ['concept.skandha-aggregate'],
  '眼': ['concept.six-faculties'],
  '耳': ['concept.six-faculties'],
  '鼻': ['concept.six-faculties'],
  '舌': ['concept.six-faculties'],
  '身': ['concept.six-faculties'],
  '意': ['concept.six-faculties'],
  '眼界': ['concept.realm-dhatu'],
  '意識界': ['concept.realm-dhatu'],
  '集': ['concept.four-truths'],
  '道': ['concept.four-truths'],
  '心': ['concept.obstruction-cittavarana'],
  '罣礙': ['concept.obstruction-cittavarana'],
  '恐怖': ['concept.fearless-atrasta'],
  '顛倒': ['concept.inverted-view-viparyasa'],
  '涅槃': ['concept.nirvana-extinguishing'],
  '知': ['concept.knowledge-jnana'],
  '般若波羅蜜多': ['concept.wisdom-prajna', 'concept.perfection-paramita'],
  '大神': ['concept.mantra-vidya'],
  '大明': ['concept.mantra-vidya'],
  '無上': ['concept.mantra-vidya'],
  '無等等': ['concept.mantra-vidya'],
  '咒': ['concept.mantra-vidya'],
  '苦厄': ['concept.suffering-duhkha'],
  '三世': ['concept.three-times-tryadhva'],
  '舍利子': ['concept.sariputra-addressee'],
  // Tibetan (syllable tokens)
  'སྟོང་པ': ['concept.emptiness-sunyata'],
  'སྐྱེས': ['concept.unarisen-anutpada'],
  'འགགས': ['concept.unarisen-anutpada'],
  'ཚོར': ['concept.skandha-aggregate'],
  'འདུ': ['concept.skandha-aggregate'],
  'མིག': ['concept.six-faculties'],
  'རྣ': ['concept.six-faculties'],
  'སྣ': ['concept.six-faculties'],
  'ལྕེ': ['concept.six-faculties'],
  'ལུས': ['concept.six-faculties'],
  'ཡིད': ['concept.six-faculties'],
  'གཟུགས': ['concept.form-rupa'],
  'ཁམས': ['concept.realm-dhatu'],
  'རིག': ['concept.mantra-vidya'],
  'རྒ': ['concept.aging-death-jaramarana'],
  'ཤི': ['concept.aging-death-jaramarana'],
  'སྡུག': ['concept.suffering-duhkha'],
  'བསྔལ': ['concept.suffering-duhkha'],
  'ཀུན': ['concept.four-truths'],
  'འབྱུང': ['concept.four-truths'],
  'འགོག': ['concept.four-truths'],
  'ལམ': ['concept.four-truths'],
  'ཡེ': ['concept.knowledge-jnana'],
  'ཐོབ': ['concept.attainment-prapti'],
  'སེམས': ['concept.obstruction-cittavarana'],
  'སྒྲིབ་པ': ['concept.obstruction-cittavarana'],
  'སྐྲག་པ': ['concept.fearless-atrasta'],
  'ཤེས་རབ': ['concept.wisdom-prajna'],
};
const resolve = (lang: string, script: string, t: string): string[] =>
  BIND[t] ?? conceptsForToken(lang as any, script as any, t);

export function deriveAlignSegment(seg: any, witnessIndex = 0): AlignSegment {
  const units = new Map<string, AlignUnit>();
  const useUnit = (cid: string) => {
    if (!units.has(cid)) {
      const node = getConcept(cid);
      units.set(cid, { id: cid, gloss: node?.preferredLabel ?? cid, conceptId: cid });
    }
    return cid;
  };

  const renderings: AlignRendering[] = [];
  for (const sv of seg.scripts ?? []) {
    const lang = langSub(sv.lang);
    const script = scrSub(sv.lang);
    if (lang === 'en' || script === 'Deva') continue; // English handled below; Devanāgarī not word-tokenized yet
    const tokens: AlignToken[] = tokenize(sv.text, sv.tokens, script).map((t) => {
      const cids = resolve(lang, script, clean(t));
      cids.forEach(useUnit);
      return cids.length
        ? ({ text: t, units: cids, relation: 'semantic' as AlignRelation })
        : ({ text: t, units: [], gloss: '(not aligned yet)' });
    });
    renderings.push({ lang: sv.lang, label: sv.label, tokens });
  }

  const w = seg.witnesses?.[witnessIndex] ?? seg.witnesses?.[0];
  if (w) {
    const tokens: AlignToken[] = String(w.text).split(/\s+/).filter(Boolean).map((t: string) => {
      const cids = conceptsForToken('en', 'Latn', clean(t), w.by);
      cids.forEach(useUnit);
      return cids.length
        ? ({ text: t, units: cids, relation: 'interpretive' as AlignRelation })
        : ({ text: t, units: [], relation: 'ghost' as AlignRelation, gloss: t.toLowerCase() });
    });
    renderings.push({ lang: 'en', label: 'English', by: w.by, tokens });
  }

  return { id: seg.id, gloss: w?.text, units: [...units.values()], renderings };
}

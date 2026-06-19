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

/**
 * English surface → concept fallback, consulted only when the registry has no
 * attestation for a witness's word. Lets witnesses that keep the Sanskrit terms
 * untranslated (Bodhi Sangha, Sariputta Ambedkar — "Prajna", "skandhas") and the
 * shared content words light up like MAPLE/Conze do. Keyed lowercase.
 * Deliberately conservative: words that name two different concepts depending on
 * context ("death" — the unarisen pair vs. aging-and-death) are left out.
 */
const EN_BIND: Record<string, string[]> = {
  // names + untranslated Sanskrit
  avalokiteshvara: ['concept.avalokita-bodhisattva'],
  bodhisattva: ['concept.bodhisattva'],
  bodhisattvas: ['concept.bodhisattva'],
  shariputra: ['concept.sariputra-addressee'],
  prajna: ['concept.wisdom-prajna'],
  paramita: ['concept.perfection-paramita'],
  skandhas: ['concept.skandha-aggregate'],
  dharmas: ['concept.dharma-phenomena'],
  nirvana: ['concept.nirvana-extinguishing'],
  // shared content words
  practicing: ['concept.practice-carya'],
  practising: ['concept.practice-carya'],
  deep: ['concept.deep-gambhira'],
  deeply: ['concept.deep-gambhira'],
  wisdom: ['concept.wisdom-prajna'],
  empty: ['concept.emptiness-sunyata'],
  emptiness: ['concept.emptiness-sunyata'],
  form: ['concept.form-rupa'],
  suffering: ['concept.suffering-duhkha'],
  distress: ['concept.suffering-duhkha'],
  saw: ['concept.seeing-vyavalokita'],
  perceived: ['concept.seeing-vyavalokita'],
  born: ['concept.unarisen-anutpada'],
  destroyed: ['concept.unarisen-anutpada'],
  // the five skandhas in English
  feeling: ['concept.skandha-aggregate'],
  feelings: ['concept.skandha-aggregate'],
  perception: ['concept.skandha-aggregate'],
  perceptions: ['concept.skandha-aggregate'],
  reaction: ['concept.skandha-aggregate'],
  impulses: ['concept.skandha-aggregate'],
  consciousness: ['concept.skandha-aggregate'],
  // the six faculties
  eye: ['concept.six-faculties'],
  eyes: ['concept.six-faculties'],
  ear: ['concept.six-faculties'],
  ears: ['concept.six-faculties'],
  nose: ['concept.six-faculties'],
  tongue: ['concept.six-faculties'],
  body: ['concept.six-faculties'],
  mind: ['concept.six-faculties'],
  // origination chain + four truths + aging-death
  ignorance: ['concept.ignorance-avidya'],
  age: ['concept.aging-death-jaramarana'],
  path: ['concept.four-truths'],
  cessation: ['concept.four-truths'],
  origination: ['concept.four-truths'],
  stopping: ['concept.four-truths'],
  cognition: ['concept.knowledge-jnana'],
  // mind-states near the end
  attainment: ['concept.attainment-prapti'],
  attain: ['concept.attainment-prapti'],
  hindrance: ['concept.obstruction-cittavarana'],
  fear: ['concept.fearless-atrasta'],
  fears: ['concept.fearless-atrasta'],
};

export function deriveAlignSegment(seg: any, preferredWitnessBy?: string): AlignSegment {
  const units = new Map<string, AlignUnit>();
  const useUnit = (cid: string) => {
    if (!units.has(cid)) {
      const node = getConcept(cid);
      units.set(cid, { id: cid, gloss: node?.preferredLabel ?? cid, conceptId: cid });
    }
    return cid;
  };

  const tokenFor = (lang: string, script: string, t: string, readings?: Record<string, string>, pron?: string): AlignToken => {
    const cids = resolve(lang, script, clean(t));
    cids.forEach(useUnit);
    const base: AlignToken = cids.length
      ? { text: t, units: cids, relation: 'semantic' as AlignRelation }
      : { text: t, units: [], gloss: '(not aligned yet)' };
    if (readings && Object.keys(readings).length) base.readings = readings;
    else if (pron) base.pronunciation = pron;
    return base;
  };
  // Per-token readings from the whole-line transliteration (drop the trailing
  // "(label)" and · phrase-breaks); trusted only when the count matches the tokens.
  const parseReads = (tr: string | undefined, n: number): string[] => {
    if (!tr) return [];
    const parts = tr.replace(/\s*\([^)]*\)\s*$/, '').trim().split(/\s+/).filter((p) => p && p !== '·' && p !== ':');
    return parts.length === n ? parts : [];
  };

  // Non-English script variants (Devanāgarī skipped — the shipped line isn't
  // word-tokenized; that depth is the overlay's job).
  const svs = (seg.scripts ?? [])
    .filter((sv: any) => langSub(sv.lang) !== 'en' && scrSub(sv.lang) !== 'Deva')
    .map((sv: any) => {
      const script = scrSub(sv.lang);
      const toks = tokenize(sv.text, sv.tokens, script);
      return { lang: sv.lang as string, label: sv.label as string, script, toks, reads: parseReads(sv.transliteration, toks.length) };
    });
  const zh = svs.find((s: any) => s.script === 'Hant');
  const ja = svs.find((s: any) => s.script === 'Jpan');
  const canMerge = !!(zh && ja && zh.toks.length === ja.toks.length); // same glyphs, only readings differ

  const renderings: AlignRendering[] = [];
  const done = new Set<string>();
  for (const sv of svs) {
    if (done.has(sv.lang)) continue;
    if ((sv.script === 'Hant' || sv.script === 'Jpan') && canMerge) {
      done.add(zh!.lang);
      done.add(ja!.lang);
      const tokens = zh!.toks.map((t: string, i: number) => {
        const readings: Record<string, string> = {};
        if (zh!.reads[i]) readings.zh = zh!.reads[i];
        if (ja!.reads[i]) readings.ja = ja!.reads[i];
        return tokenFor('zh', 'Hant', t, readings);
      });
      renderings.push({ lang: 'zh-Hant', label: 'Chinese · Japanese', tokens });
      continue;
    }
    done.add(sv.lang);
    const tokens = sv.toks.map((t: string, i: number) => tokenFor(langSub(sv.lang), sv.script, t, undefined, sv.reads[i]));
    renderings.push({ lang: sv.lang, label: sv.label, tokens });
  }

  // Select the witness by name (witnesses aren't index-aligned across
  // segments — some carry only a subset); fall back to the first available.
  const w =
    (preferredWitnessBy && seg.witnesses?.find((x: any) => x.by === preferredWitnessBy)) ||
    seg.witnesses?.[0];
  if (w) {
    const tokens: AlignToken[] = String(w.text).split(/\s+/).filter(Boolean).map((t: string) => {
      const reg = conceptsForToken('en', 'Latn', clean(t), w.by);
      const cids = reg.length ? reg : EN_BIND[clean(t).toLowerCase()] ?? [];
      cids.forEach(useUnit);
      return cids.length
        ? ({ text: t, units: cids, relation: 'interpretive' as AlignRelation })
        : ({ text: t, units: [], relation: 'ghost' as AlignRelation, gloss: t.toLowerCase() });
    });
    renderings.push({ lang: 'en', label: 'English', by: w.by, tokens });
  }

  return { id: seg.id, gloss: w?.text, units: [...units.values()], renderings };
}

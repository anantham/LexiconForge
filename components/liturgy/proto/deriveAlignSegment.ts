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

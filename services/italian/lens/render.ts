/**
 * render(facts, lens=italian) -> reader-facing tooltip copy.
 *
 * The law (docs/reader/LENSES.md): the pipeline's internal vocabulary — lemma,
 * POS, "Mood=Ind|Number=Sing" — are INPUTS here, never shown. Every facet answers
 * a question an English-speaking reader of Italian actually has: what does this
 * mean, who is doing it, is it a trap, how is it built. Meaning first.
 *
 * Deterministic throughout (spaCy morph + Wiktionary gloss + the curated tables).
 * No LLM. The genuinely new layer LENSES.md said was missing.
 */
import { COGNATES, FALSE_FRIENDS, AFFIXES } from './tables';

export type ItalianFacts = {
  surface: string;
  lemma?: string;
  upos?: string;
  morph?: string;
  senses?: string[];
};

export type LensFacet = { text: string; note?: string; kind?: 'meaning' | 'who' | 'cognate' | 'build' | 'warn' };

function parseMorph(m?: string): Record<string, string> {
  const out: Record<string, string> = {};
  (m || '').split('|').forEach((kv) => {
    const [k, v] = kv.split('=');
    if (k && v) out[k] = v;
  });
  return out;
}

const SUBJECT: Record<string, string> = {
  '1Sing': 'I', '2Sing': 'you', '3Sing': 'he/she/it',
  '1Plur': 'we', '2Plur': 'you all', '3Plur': 'they',
};

// Just enough to render fused prepositions/articles in plain English.
const PREP: Record<string, string> = {
  di: 'of', a: 'to/at', da: 'from/by', in: 'in', con: 'with', su: 'on', per: 'for',
  tra: 'between', fra: 'between', il: 'the', lo: 'the', la: 'the', i: 'the',
  gli: 'the', le: 'the', un: 'a', uno: 'a', una: 'a', "l'": 'the',
};

// spaCy Tense/Mood -> plain "when", and the honest naming of the book tense.
function whenPhrase(f: Record<string, string>): string {
  if (f.Mood === 'Imp') return 'a command';
  if (f.VerbForm === 'Ger') return 'the -ing form';
  if (f.VerbForm === 'Inf') return 'the base (to …) form';
  if (f.VerbForm === 'Part') return f.Tense === 'Past' ? 'the -ed / done form' : 'a participle';
  if (f.Mood === 'Cnd') return 'would … (conditional)';
  if (f.Mood === 'Sub') return 'subjunctive (maybe / wished-for)';
  if (f.Tense === 'Pres') return 'now (present)';
  if (f.Tense === 'Imp') return 'was …ing / used to (imperfect)';
  if (f.Tense === 'Past') return 'the story-telling past — the tense books use (passato remoto)';
  if (f.Tense === 'Fut') return 'will … (future)';
  return '';
}

// Turn a gloss like "to stay, remain" into a bare verb phrase "stay, remain".
function bareVerb(senses?: string[]): string {
  const g = (senses || []).find((s) => /^to /.test(s)) || (senses || [])[0] || '';
  return g.replace(/^to /, '').replace(/;.*/, '').trim();
}

function meaningNoun(senses?: string[], lemma?: string): string {
  const g = (senses || [])[0] || '';
  return g.replace(/;.*/, '').replace(/\(.*?\)/g, '').trim() || (lemma || '');
}

export function renderItalian(facts: ItalianFacts): LensFacet[] {
  const lemma = (facts.lemma || facts.surface).toLowerCase();
  const upos = facts.upos || '';
  const f = parseMorph(facts.morph);
  const out: LensFacet[] = [];

  // 0. FUSED preposition/article (surface law): spaCy hands back the split lemma
  // ("nel" -> "in il", "dell'" -> "di il"). Show the seam in plain words.
  if ((upos === 'ADP' || upos === 'DET') && lemma.includes(' ')) {
    const parts = lemma.split(' ').map((p) => `${p} (${PREP[p] || '…'})`).join(' + ');
    return [{ text: `${facts.surface} = ${parts}`, note: 'two words fused', kind: 'build' }];
  }

  // 1. FALSE FRIEND — fires first and loud; the meaning it warns toward IS the answer.
  if (FALSE_FRIENDS[lemma]) {
    out.push({ text: FALSE_FRIENDS[lemma], note: 'false friend', kind: 'warn' });
  }

  // 2. MEANING / WHO-ACTS (the primary answer)
  if ((upos === 'VERB' || upos === 'AUX')) {
    const verb = bareVerb(facts.senses) || lemma;
    if (f.Mood === 'Imp') {
      out.push({ text: `${verb}! — a command (to you)`, note: lemma, kind: 'who' });
    } else if (f.VerbForm === 'Inf') {
      out.push({ text: `to ${verb}`, note: lemma, kind: 'who' });
    } else if (f.VerbForm === 'Ger') {
      out.push({ text: `${verb}-ing`, note: `${lemma} · the -ing form`, kind: 'who' });
    } else if (f.Person && f.Number) {
      const subj = SUBJECT[f.Person + f.Number] || '';
      const when = whenPhrase(f);
      out.push({ text: `${subj} ${verb}`.trim(), note: `${lemma}${when ? ' · ' + when : ''}`, kind: 'who' });
    } else {
      out.push({ text: verb, note: lemma, kind: 'who' });
    }
  } else if (!FALSE_FRIENDS[lemma]) {
    const meaning = meaningNoun(facts.senses, lemma);
    if (meaning) {
      const note = lemma !== facts.surface.toLowerCase() ? lemma : undefined;
      out.push({ text: meaning, note, kind: 'meaning' });
    }
  }

  // 3. COGNATE ANCHOR — the register-inverted memory hook
  const cog = COGNATES[lemma];
  if (cog) out.push({ text: `kin to English ${cog}`, note: 'cognate', kind: 'cognate' });

  // 4. WORD-BUILDING — the vocabulary multiplier
  for (const a of AFFIXES) {
    if (a.re.test(lemma) && lemma.length > 4) { out.push({ text: a.note, kind: 'build' }); break; }
  }

  // Dedupe by text; guarantee at least one facet.
  const seen = new Set<string>();
  const facets = out.filter((x) => x.text && !seen.has(x.text) && seen.add(x.text));
  return facets.length ? facets : [{ text: facts.senses?.[0] || facts.surface, kind: 'meaning' }];
}

// A word is worth a tooltip only if the lens produces something beyond its own surface.
export function isGrounded(facts: ItalianFacts): boolean {
  const facets = renderItalian(facts);
  return facets.length > 0 && !(facets.length === 1 && facets[0].text.toLowerCase() === facts.surface.toLowerCase());
}

// Common function words an anglophone doesn't already own — kept short for the
// interlinear gloss line (content words get their gloss from Wiktionary senses).
const FUNCTION_GLOSS: Record<string, string> = {
  di: 'of', a: 'to', da: 'from', in: 'in', con: 'with', su: 'on', per: 'for',
  tra: 'among', fra: 'among', e: 'and', ma: 'but', o: 'or', né: 'nor',
  che: 'that/which', chi: 'who', non: 'not', se: 'if', come: 'as/like',
  più: 'more', meno: 'less', molto: 'very', poco: 'little', anche: 'also',
  ancora: 'still', già: 'already', sempre: 'always', mai: 'never', qui: 'here',
  là: 'there', lì: 'there', ora: 'now', poi: 'then', quando: 'when', dove: 'where',
  mentre: 'while', perché: 'because', così: 'so', dopo: 'after', prima: 'before',
  senza: 'without', sotto: 'under', sopra: 'above', dentro: 'inside', fuori: 'outside',
  il: 'the', lo: 'the', la: 'the', i: 'the', gli: 'the', le: 'the', un: 'a', uno: 'a', una: 'a',
  mi: 'me', ti: 'you', si: '-self', ci: 'us', vi: 'you', ne: 'of-it',
  questo: 'this', quello: 'that', ogni: 'every', tutto: 'all', altro: 'other',
};

// A SHORT gloss for the interlinear line under each word. Meaning first, terse.
export function glossWord(facts: ItalianFacts): string {
  const lemma = (facts.lemma || facts.surface).toLowerCase();
  const f = parseMorph(facts.morph);
  if ((facts.upos === 'ADP' || facts.upos === 'DET') && lemma.includes(' ')) {
    return lemma.split(' ').map((p) => PREP[p] || FUNCTION_GLOSS[p] || p).join(' ');
  }
  const s = (facts.senses || [])[0];
  if (s) {
    const g = s.replace(/^to /, '').split(/[;,(]/)[0].trim();
    // for a verb, prefix the person so the ending is legible ("you stay")
    if ((facts.upos === 'VERB' || facts.upos === 'AUX') && f.Person && f.Number && f.Mood !== 'Imp' && f.VerbForm === 'Fin') {
      const subj = SUBJECT[f.Person + f.Number];
      if (subj) return `${subj} ${g}`;
    }
    return g;
  }
  return FUNCTION_GLOSS[lemma] || '';
}

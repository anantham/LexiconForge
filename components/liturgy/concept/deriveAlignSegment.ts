import type { AlignSegment, AlignUnit, AlignRendering, AlignToken, AlignRelation } from '../../../types/liturgyAlign';
import type { TripleScriptWitnessSegment, ScriptVariant, Witness } from '../../../types/liturgy';
import { conceptsForToken, getConcept } from '../../../data/concepts/lookup';
import { BIND, EN_BIND, SPLIT, EXTRA_DEVA, CHAR_JA, SEGMENT_BIND } from '../../../data/liturgy/heart-sutra-bindings';
import { aksharasOf, romanizationMatches } from './devanagari';

/**
 * Make the concept graph load-bearing: turn a shipped `triple-script-witness`
 * segment into the concept-aligned model by asking `conceptsForToken()` (plus the
 * curated BIND/EN_BIND overrides in data/liturgy/heart-sutra-bindings.ts) what
 * each token attests. Tokens that resolve carry their concept(s) as units (so the
 * cross-script threads light up); unresolved script tokens are left visibly
 * "not aligned yet".
 *
 * The per-segment unit spine is built FROM the tokens (via `useUnit`), so every
 * `token.units` id is guaranteed present in `segment.units`. The contract test
 * (conceptReader.test.ts) asserts that invariant for both derived segments and
 * the hand-authored title, plus a coverage floor that catches binding drift.
 *
 * The Sanskrit row renders as Devanāgarī aksharas (each akshara carrying its
 * sound + its morpheme's concept) when every token's Devanāgarī romanizes back
 * to the authoritative IAST; otherwise that segment falls back to IAST.
 */

const CJK = /[㐀-鿿豈-﫿]/;
const langSub = (l: string) => l.split('-')[0];
const scrSub = (l: string) => l.split('-')[1] ?? 'Latn';

function tokenize(text: string, tokens: string[] | undefined, script: string): string[] {
  if (tokens && tokens.length) return tokens;
  if (script === 'Tibt') return groupTibetan(text.split(/[་༌།༎\s]+/).filter(Boolean));
  if (script === 'Hant' || script === 'Jpan') return [...text].filter((c) => CJK.test(c));
  return text.split(/\s+/).filter(Boolean);
}
const clean = (t: string) => t.replace(/་$/, '').replace(/[.,;:!?"'()\[\]।॥—–]+$/u, '');

// Tibetan binds at the WORD level, but rows without a token hint arrive as bare
// tsheg syllables. Rejoin consecutive syllables that EXACTLY form a multi-syllable
// BIND key (curated, longest-first) so words like སྟོང་པ་ཉིད / ཤཱ་རིའི་བུ / ཡེ་ཤེས
// bind instead of fragmenting. Only curated keys group — single-syllable bindings
// (སྡུག, བསྔལ…) are never regrouped, so nothing already-correct can shift.
const TIBETAN_WORDS = Object.keys(BIND)
  .filter((k) => /[ༀ-࿿]/.test(k) && k.split('་').filter(Boolean).length >= 2)
  .sort((a, b) => b.split('་').filter(Boolean).length - a.split('་').filter(Boolean).length);
function groupTibetan(syl: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < syl.length; ) {
    let n = 0;
    for (const w of TIBETAN_WORDS) {
      const len = w.split('་').filter(Boolean).length;
      if (i + len <= syl.length && syl.slice(i, i + len).map(clean).join('་') === w) { n = len; break; }
    }
    if (n) { out.push(syl.slice(i, i + n).join('་')); i += n; } else { out.push(syl[i]); i += 1; }
  }
  return out;
}

const resolve = (lang: string, script: string, t: string): string[] =>
  BIND[t] ?? conceptsForToken(lang as any, script as any, t);

// Split a Tibetan word into tsheg-separated syllables, each paired with its
// per-syllable Lhasa sound from the concept's curated bo attestation (e.g.
// "pa-rol-tu chin-pa", which IS syllable-aligned). Only paired when the syllable
// counts match — otherwise the syllable shows no sound (and the whole-line Lhasa
// beneath still carries the pronunciation). No guessing on sacred text.
const lhasaOf = (p?: string): string | undefined =>
  p ? (p.match(/([^;(]+?)\s*\(Lhasa\)/)?.[1] ?? p.replace(/\s*\([^)]*\)/g, '')).trim() : undefined;
const tibetanSegments = (token: string) => {
  const key = clean(token);
  const syls = key.split(/(?<=་)/).filter(Boolean);
  let roms: string[] | undefined;
  for (const cid of resolve('bo', 'Tibt', key)) {
    const att = getConcept(cid)?.attestations?.find(
      (a: any) => a.language === 'bo' && a.script === 'Tibt' && clean(a.text) === key,
    );
    const lhasa = lhasaOf(att?.pronunciation);
    if (lhasa) {
      const r = lhasa.split(/[-\s]+/).filter(Boolean);
      if (r.length === syls.length) { roms = r; break; }
    }
  }
  return syls.map((s, i) => ({ text: s, pronunciation: roms?.[i], akshara: true }));
};

// English grammar glue (no concept). An unbound word NOT in this set is treated
// as content — rendered normally with no tooltip — rather than mislabeled as
// "grammar this language adds". Deliberately conservative (clear function words
// only), so a content word is never dimmed or mislabeled.
const EN_FUNCTION = new Set([
  'the', 'a', 'an', 'of', 'and', 'or', 'is', 'are', 'was', 'were', 'be', 'been', 'am', 'in', 'on', 'at',
  'to', 'into', 'onto', 'upon', 'that', 'this', 'these', 'those', 'it', 'its', 'they', 'their', 'them',
  'he', 'his', 'she', 'her', 'who', 'whom', 'with', 'as', 'by', 'for', 'from', 'not', 'no', 'nor', 'but',
  'than', 'then', 'so', 'do', 'does', 'did', 'has', 'have', 'had', 'which', 'what', 'when', 'where',
  'while', 'through', 'here', 'there', 'all', 'any', 'every', 'both', 'each', 'o', 'oh', 'if', 'also',
]);

export function deriveAlignSegment(
  seg: TripleScriptWitnessSegment,
  preferredWitnessBy?: string,
): AlignSegment {
  const units = new Map<string, AlignUnit>();
  const useUnit = (cid: string) => {
    if (!units.has(cid)) {
      const node = getConcept(cid);
      units.set(cid, { id: cid, gloss: node?.preferredLabel ?? cid, conceptId: cid });
    }
    return cid;
  };

  // Context-scoped overrides for this segment (homograph collisions), consulted
  // before the global BIND / conceptsForToken. A key present with [] means the
  // token is deliberately unbound HERE (a verb/particle), not "not aligned yet".
  const segBind = SEGMENT_BIND[seg.id];
  const resolveLocal = (lang: string, script: string, t: string): string[] =>
    segBind && t in segBind ? segBind[t] : resolve(lang, script, t);

  const tokenFor = (lang: string, script: string, t: string, readings?: Record<string, string>, pron?: string): AlignToken => {
    const key = clean(t);
    let base: AlignToken;
    const split = SPLIT[key];
    if (split) {
      // Compound → one piece per morpheme, each bound to its single concept
      // (the "minimal cut": hovering a concept lights only its slice of the word,
      // like the separate words the other scripts already show — 般若 / ཤེས་རབ).
      split.forEach((p) => p.concepts.forEach(useUnit));
      base = {
        text: t,
        units: split.flatMap((p) => p.concepts),
        relation: 'semantic' as AlignRelation,
        segments: split.map((p) => ({ text: p.text, units: p.concepts })),
      };
    } else {
      const cids = resolveLocal(lang, script, key);
      cids.forEach(useUnit);
      // Unresolved or deliberately-unbound tokens carry no concept and no gloss —
      // a function word (故, na, particles) gets no tooltip rather than a misleading
      // "(not aligned yet)" label. The token still renders; it just makes no claim.
      base = cids.length
        ? { text: t, units: cids, relation: 'semantic' as AlignRelation }
        : { text: t, units: [] };
    }
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

  // Devanāgarī for this segment's Sanskrit words (form → scriptAlt) + the
  // EXTRA_DEVA fallback for compounds the registry didn't carry.
  const devaIdx = new Map<string, string>();
  for (const word of seg.words ?? []) if (word.scriptAlt) devaIdx.set(String(word.form).toLowerCase(), word.scriptAlt);

  // Render a Sanskrit token row as Devanāgarī aksharas — each akshara carrying
  // its sound + its morpheme's concept — or return null if any token can't be
  // shown in Devanāgarī, so the whole row falls back to IAST (keeping the rail
  // consistent). A Devanāgarī source is used only when its romanization
  // reproduces the authoritative IAST (self-validation; no guessed sounds).
  const devaTokensFor = (toks: string[]): AlignToken[] | null => {
    const out: AlignToken[] = [];
    for (const t of toks) {
      const key = clean(t);
      if (!key || /^[·:।॥.,;]+$/u.test(key)) { out.push({ text: t, units: [] }); continue; } // separator
      const deva = devaIdx.get(key.toLowerCase()) ?? EXTRA_DEVA[key];
      if (!deva || !romanizationMatches(deva, key)) return null;
      const ak = aksharasOf(deva);
      const split = SPLIT[key];
      let perAkshara: (string[] | undefined)[];
      if (split) {
        // Assign each akshara to the morpheme (and concept) its sound falls in.
        const bounds: { start: number; end: number; concepts: string[] }[] = [];
        let p = 0;
        for (const m of split) { bounds.push({ start: p, end: p + m.text.length, concepts: m.concepts }); p += m.text.length; }
        let cur = 0;
        perAkshara = ak.map((a) => {
          const mid = cur + a.rom.length / 2;
          cur += a.rom.length;
          return (bounds.find((b) => mid >= b.start && mid < b.end) ?? bounds[bounds.length - 1]).concepts;
        });
      } else {
        const cids = resolveLocal('sa', 'Latn', key);
        perAkshara = ak.map(() => (cids.length ? cids : undefined));
      }
      const all = [...new Set(perAkshara.flatMap((u) => u ?? []))];
      all.forEach(useUnit);
      const tok: AlignToken = {
        text: deva,
        units: all,
        pronunciation: key,
        segments: ak.map((a, i) => ({ text: a.text, pronunciation: a.rom, akshara: true, units: perAkshara[i] })),
      };
      if (all.length) tok.relation = 'semantic';
      out.push(tok);
    }
    return out;
  };

  // Non-English script variants (Devanāgarī built from the Sanskrit row below).
  const svs = (seg.scripts ?? [])
    .filter((sv: ScriptVariant) => langSub(sv.lang) !== 'en' && scrSub(sv.lang) !== 'Deva')
    .map((sv: ScriptVariant) => {
      const script = scrSub(sv.lang);
      const toks = tokenize(sv.text, sv.tokens, script);
      const translit = sv.transliteration?.replace(/\s*\([^)]*\)\s*$/, '').trim();
      // Tibetan: never pair per-token (its Lhasa rom doesn't align 1:1 with the
      // word tokens even when counts coincide) — fall through to the whole line.
      const reads = script === 'Tibt' ? [] : parseReads(sv.transliteration, toks.length);
      return { lang: sv.lang, label: sv.label ?? sv.lang, script, toks, reads, translit };
    });
  const zh = svs.find((s) => s.script === 'Hant');
  const ja = svs.find((s) => s.script === 'Jpan');
  const canMerge = !!(zh && ja && zh.toks.length === ja.toks.length); // same glyphs, only readings differ

  const renderings: AlignRendering[] = [];
  const done = new Set<string>();
  for (const sv of svs) {
    if (done.has(sv.lang)) continue;
    if ((sv.script === 'Hant' || sv.script === 'Jpan') && canMerge) {
      done.add(zh!.lang);
      done.add(ja!.lang);
      const tokens = zh!.toks.map((t, i) => {
        const readings: Record<string, string> = {};
        if (zh!.reads[i]) readings.zh = zh!.reads[i];
        if (ja!.reads[i]) readings.ja = ja!.reads[i];
        const base = tokenFor('zh', 'Hant', t, readings);
        // Per-character pieces so etymology mode isolates a single Han character.
        // Per-char readings: split each whole-word reading on separators when it
        // has one syllable per character (Mandarin always does; a phonetic-loan
        // on'yomi like "haramita" doesn't, so its per-char reading is omitted
        // rather than mis-split).
        const chars = [...t];
        if (chars.length > 1) {
          const perChar = (s?: string) => {
            const p = (s ?? '').split(/[-\s·]+/).filter(Boolean);
            return p.length === chars.length ? p : null;
          };
          const zc = perChar(readings.zh);
          const jc = perChar(readings.ja);
          base.segments = chars.map((c, k) => {
            const r: Record<string, string> = {};
            if (zc) r.zh = zc[k];
            const jaC = jc ? jc[k] : CHAR_JA[c]; // per-char on'yomi for unsplit loans
            if (jaC) r.ja = jaC;
            return { text: c, readings: Object.keys(r).length ? r : undefined };
          });
        }
        return base;
      });
      renderings.push({ lang: 'zh-Hant', label: 'Chinese · Japanese', tokens });
      continue;
    }
    done.add(sv.lang);
    if (sv.lang === 'sa-Latn') {
      const deva = devaTokensFor(sv.toks);
      if (deva) {
        renderings.push({ lang: 'sa-Deva', label: 'Sanskrit (Devanāgarī)', tokens: deva });
        continue;
      }
    }
    if (sv.script === 'Tibt') {
      // Break each Tibetan word into tsheg syllables (fine-grained, hoverable),
      // with per-syllable Lhasa where reliable. Two sources, both gated by count:
      //   1) the row's whole-line transliteration split per syllable, when its
      //      count matches the row's total syllables (covers words like the
      //      Avalokiteśvara name that have no citation attestation);
      //   2) else the concept's curated bo attestation, per word.
      const tokSyls = sv.toks.map((t) => clean(t).split(/(?<=་)/).filter(Boolean));
      const total = tokSyls.reduce((n, s) => n + s.length, 0);
      const rowRoms = (sv.translit ?? '').split(/[-\s]+/).filter(Boolean);
      const positional = rowRoms.length === total;
      let cur = 0;
      const tokens = sv.toks.map((t, ti) => {
        const base = tokenFor('bo', 'Tibt', t);
        const syls = tokSyls[ti];
        const perWord = positional ? null : tibetanSegments(t);
        base.segments = syls.map((s, si) => ({
          text: s,
          pronunciation: positional ? rowRoms[cur + si] : perWord?.[si]?.pronunciation,
          akshara: true,
        }));
        cur += syls.length;
        return base;
      });
      renderings.push({ lang: sv.lang, label: sv.label, tokens, transliteration: sv.translit });
      continue;
    }
    const tokens = sv.toks.map((t, i) => tokenFor(langSub(sv.lang), sv.script, t, undefined, sv.reads[i]));
    renderings.push({ lang: sv.lang, label: sv.label, tokens, transliteration: sv.translit });
  }

  // Select the witness by name (witnesses aren't index-aligned across segments —
  // some carry only a subset); fall back to the first available.
  const w =
    (preferredWitnessBy && seg.witnesses?.find((x: Witness) => x.by === preferredWitnessBy)) ||
    seg.witnesses?.[0];
  if (w) {
    const tokens: AlignToken[] = String(w.text).split(/\s+/).filter(Boolean).map((t) => {
      const k = clean(t);
      const ov = segBind?.[k.toLowerCase()] ?? segBind?.[k]; // context override (incl. [] = unbind here)
      const reg = conceptsForToken('en', 'Latn', k, w.by);
      const cids = ov ?? (reg.length ? reg : EN_BIND[k.toLowerCase()] ?? []);
      cids.forEach(useUnit);
      if (cids.length) return { text: t, units: cids, relation: 'interpretive' as AlignRelation };
      // Grammar glue dims (ghost) and shows no tooltip; an unbound content word
      // renders normally with no gloss — we don't claim a meaning we don't have.
      return EN_FUNCTION.has(clean(t).toLowerCase())
        ? ({ text: t, units: [], relation: 'ghost' as AlignRelation })
        : ({ text: t, units: [] });
    });
    renderings.push({ lang: 'en', label: 'English', by: w.by, tokens });
  }

  return { id: seg.id, gloss: w?.text, units: [...units.values()], renderings };
}

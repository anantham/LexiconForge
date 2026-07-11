/**
 * Malayalam grapheme lens — deterministic akshara decomposition from Unicode.
 *
 * The ETYMOLOGY mode of the interlinear reaches INWARD into the script. For
 * Malayalam that means showing how each letter-cluster is ASSEMBLED: that
 * മ്മ is മ + ് + മ (the chandrakkala silences the first ma and welds the
 * doubled mma), that ക്ഷേ is a ക+ഷ stack wearing a vowel sign, that ൾ is a
 * chillu — a consonant's vowel-less final form fused into one letter.
 *
 * This is PURE Unicode structure — no dictionary, no model, no network.
 * Malayalam encodes its own construction: every conjunct, gemination, and
 * vowel change is literally present in the codepoint sequence. We just name
 * the parts in plain words (CURATION_PROTOCOL: no grammar jargon).
 */

type Kind =
  | 'consonant'
  | 'vowel' // independent vowel letter (word-initial അ ആ ഇ …)
  | 'vowel-sign' // dependent sign that changes a consonant's built-in a
  | 'virama' // ് chandrakkala
  | 'chillu'
  | 'anusvara'
  | 'visarga'
  | 'join' // ZWJ/ZWNJ
  | 'other';

const CONSONANTS: Record<string, string> = {
  ക: 'ka', ഖ: 'kha', ഗ: 'ga', ഘ: 'gha', ങ: 'nga',
  ച: 'cha', ഛ: 'chha', ജ: 'ja', ഝ: 'jha', ഞ: 'nja',
  ട: 'ta', ഠ: 'tta', ഡ: 'da', ഢ: 'dda', ണ: 'na',
  ത: 'tha', ഥ: 'thha', ദ: 'dha', ധ: 'ddha', ന: 'na',
  പ: 'pa', ഫ: 'pha', ബ: 'ba', ഭ: 'bha', മ: 'ma',
  യ: 'ya', ര: 'ra', ല: 'la', വ: 'va',
  ശ: 'sha', ഷ: 'sha', സ: 'sa', ഹ: 'ha',
  ള: 'la', ഴ: 'zha', റ: 'ra',
};

/** Where two consonants share a practical sound, the hint tells them apart. */
const CONSONANT_HINTS: Record<string, string> = {
  ഴ: 'the Malayalam zha — tongue curled far back; the sound in Kozhikode',
  ള: 'retroflex la — tongue curled back (vs. plain ല)',
  ണ: 'retroflex na — tongue curled back (vs. plain ന)',
  ട: 'hard retroflex ta (vs. soft dental ത)',
  ത: 'soft dental tha — tongue on the teeth (vs. hard ട)',
  റ: 'trilled/hard ra (vs. soft ര)',
  ശ: 'palatal sha (vs. retroflex ഷ)',
  ഷ: 'retroflex sha (vs. palatal ശ)',
};

const VOWELS: Record<string, string> = {
  അ: 'a', ആ: 'aa', ഇ: 'i', ഈ: 'ee', ഉ: 'u', ഊ: 'oo',
  ഋ: 'ru', എ: 'e', ഏ: 'ae', ഐ: 'ai', ഒ: 'o', ഓ: 'oa', ഔ: 'au',
};

const VOWEL_SIGNS: Record<string, { sound: string; note?: string }> = {
  'ാ': { sound: 'aa' },
  'ി': { sound: 'i' },
  'ീ': { sound: 'ee' },
  'ു': { sound: 'u' },
  'ൂ': { sound: 'oo' },
  'ൃ': { sound: 'ru' },
  'െ': { sound: 'e', note: 'written BEFORE its consonant, spoken after it' },
  'േ': { sound: 'e (long)', note: 'written BEFORE its consonant, spoken after it' },
  'ൈ': { sound: 'ai', note: 'written BEFORE its consonant, spoken after it' },
  'ൊ': { sound: 'o', note: 'two pieces hugging the consonant — one before, one after' },
  'ോ': { sound: 'o (long)', note: 'two pieces hugging the consonant — one before, one after' },
  'ൌ': { sound: 'au', note: 'two pieces hugging the consonant — one before, one after' },
  'ൗ': { sound: 'au' },
};

const CHILLUS: Record<string, { sound: string; base: string }> = {
  ൺ: { sound: 'n', base: 'ണ' },
  ൻ: { sound: 'n', base: 'ന' },
  ർ: { sound: 'r', base: 'ര' },
  ൽ: { sound: 'l', base: 'ല' },
  ൾ: { sound: 'l', base: 'ള' },
  ൿ: { sound: 'k', base: 'ക' },
};

function kindOf(ch: string): Kind {
  if (CONSONANTS[ch]) return 'consonant';
  if (VOWELS[ch]) return 'vowel';
  if (VOWEL_SIGNS[ch]) return 'vowel-sign';
  if (ch === '്') return 'virama';
  if (CHILLUS[ch]) return 'chillu';
  if (ch === 'ം') return 'anusvara';
  if (ch === 'ഃ') return 'visarga';
  if (ch === '‍' || ch === '‌') return 'join';
  return 'other';
}

/**
 * Split Malayalam text into letter-clusters (aksharas) — the units a reader's
 * eye takes in. A cluster grows while codepoints attach: vowel signs, the
 * chandrakkala, anusvara/visarga always attach; a consonant attaches when the
 * previous codepoint was the chandrakkala (a conjunct in progress).
 */
export function clustersOf(text: string): string[] {
  const cps = Array.from(text);
  const out: string[] = [];
  let cur = '';
  for (let i = 0; i < cps.length; i++) {
    const ch = cps[i];
    const k = kindOf(ch);
    if (!cur) { cur = ch; continue; }
    const prev = cps[i - 1];
    const attaches =
      k === 'vowel-sign' || k === 'virama' || k === 'anusvara' || k === 'visarga' || k === 'join' ||
      kindOf(prev) === 'virama' || kindOf(prev) === 'join';
    if (attaches) { cur += ch; continue; }
    out.push(cur);
    cur = ch;
  }
  if (cur) out.push(cur);
  return out;
}

/** One codepoint, named in plain words. */
function describe(ch: string): { label: string; note?: string } {
  switch (kindOf(ch)) {
    case 'consonant':
      return { label: `${ch} (${CONSONANTS[ch]})`, note: CONSONANT_HINTS[ch] };
    case 'vowel':
      return { label: `${ch} (${VOWELS[ch]})`, note: 'a vowel standing on its own — word-initial form' };
    case 'vowel-sign':
      return {
        label: `${ch} (${VOWEL_SIGNS[ch].sound})`,
        note: VOWEL_SIGNS[ch].note ?? `changes the consonant's built-in a to ${VOWEL_SIGNS[ch].sound}`,
      };
    case 'virama':
      return {
        label: '് (chandrakkala)',
        note: 'the vowel-killer: silences the built-in a. Between consonants it welds them; at word-end it whispers the half-u',
      };
    case 'chillu':
      return {
        label: `${ch} (${CHILLUS[ch].sound})`,
        note: `a chillu — ${CHILLUS[ch].base}'s vowel-less form, fused into a single final letter`,
      };
    case 'anusvara':
      return { label: 'ം (m)', note: 'the final m-hum (anusvaram)' };
    case 'visarga':
      return { label: 'ഃ (h)', note: 'a breathed echo (visargam) — rare, Sanskrit loans only' };
    case 'join':
      return { label: '(invisible joiner)' };
    default:
      return { label: ch };
  }
}

/**
 * The one-line story of how a cluster is assembled.
 *
 * Honest about visibility: an INTERNAL ് (between two consonants) is typed
 * but never drawn — the fusion swallows the crescent (മ്മ shows no ്). Only
 * a TRAILING ് is the crescent the reader can actually see (ഊരകത്ത്). The
 * assembly line lists what the eye can find; the hidden weld lives in the note.
 */
function clusterStory(cluster: string): { assembly: string; note?: string } {
  const cps = Array.from(cluster).filter((c) => kindOf(c) !== 'join');
  if (cps.length === 1) {
    const d = describe(cps[0]);
    return { assembly: d.label, note: d.note };
  }
  const isInternalVirama = (c: string, i: number) =>
    c === '്' && i < cps.length - 1 && kindOf(cps[i + 1]) === 'consonant';
  const visible = cps.filter((c, i) => !isInternalVirama(c, i));
  const assembly = visible
    .map((c) => (c === '്' ? '് (chandrakkala — the crescent you can see)' : describe(c).label))
    .join(' + ');

  const cons = cps.filter((c) => kindOf(c) === 'consonant');
  const weld = cps.some((c, i) => isInternalVirama(c, i));
  const endsVirama = cps[cps.length - 1] === '്';
  const notes: string[] = [];
  if (weld && cons.length >= 2 && cons[0] === cons[1]) {
    const s = CONSONANTS[cons[0]];
    notes.push(
      `doubled — the two ${cons[0]} fuse into one sign, pressed and held (${s.replace(/a$/, '')}${s}). The weld is typed as ് but the fusion swallows the crescent — nothing extra is drawn`,
    );
  } else if (weld) {
    notes.push(
      'a koottaksharam — an invisible ് silences the first consonant\'s vowel and stacks it onto the next (the fusion swallows the crescent)',
    );
  }
  if (endsVirama) {
    notes.push('the final ് IS visible — it cuts the vowel, and at word-end whispers a half-u');
  }
  const sign = cps.find((c) => kindOf(c) === 'vowel-sign');
  if (sign) {
    const vs = VOWEL_SIGNS[sign];
    if (vs.note) notes.push(`${sign} (${vs.sound}): ${vs.note}`);
    else if (!weld && !endsVirama) notes.push(`${sign} changes the built-in a to ${vs.sound}`);
  }
  return { assembly, note: notes.join(' · ') || undefined };
}

export type ClusterPart = { glyph: string; sound: string };
export type EtymFacet = { primary: string; secondary: string; parts?: ClusterPart[] };

/**
 * The cluster EXPLODED into its typed symbols, each drawable in isolation —
 * the per-symbol inspection running text cannot offer (splitting a combining
 * sequence into DOM spans breaks shaping; ligature parts have no separate
 * ink). Drawn alone, combining marks get the standard dotted circle — the
 * script's own way of saying "I attach to something".
 */
export function clusterParts(cluster: string): ClusterPart[] {
  return Array.from(cluster)
    .filter((c) => kindOf(c) !== 'join')
    .map((c) => {
      switch (kindOf(c)) {
        case 'consonant': return { glyph: c, sound: CONSONANTS[c] };
        case 'vowel': return { glyph: c, sound: VOWELS[c] };
        case 'vowel-sign': return { glyph: c, sound: VOWEL_SIGNS[c].sound };
        case 'virama': return { glyph: c, sound: 'weld' };
        case 'chillu': return { glyph: c, sound: CHILLUS[c].sound };
        case 'anusvara': return { glyph: c, sound: 'm' };
        case 'visarga': return { glyph: c, sound: 'h' };
        default: return { glyph: c, sound: '' };
      }
    });
}

/** Unvoiced stops that Malayalam speech often softens after a vowel. */
const SOFTENED: Record<string, string> = { ക: 'ga', ച: 'ja', ട: 'da', ത: 'dha', പ: 'ba' };

/** Does this cluster END in a vowel sound? (consonant = inherent a; chillu/ം/് = no) */
export function endsVocalic(cluster: string): boolean {
  const cps = Array.from(cluster).filter((c) => kindOf(c) !== 'join');
  const last = cps[cps.length - 1];
  const k = kindOf(last);
  return k === 'consonant' || k === 'vowel' || k === 'vowel-sign';
}

/**
 * Split a practical romanization into per-cluster syllable slices, so the
 * sound line can light up with its glyph (hover ടി → "di" glows too).
 * Onset-maximizing vowel-run split: each slice is consonants + the vowel run
 * that follows (thi·ru·va·di). A consonant-only leftover (chillu ൻ → "n")
 * becomes its own final slice when that makes the counts meet. Returns null
 * when the slice count can't be reconciled — caller falls back to the
 * un-sliced line rather than guessing a wrong pairing.
 */
export function syllabify(rom: string, clusterCount: number): string[] | null {
  if (!rom || clusterCount < 1) return null;
  const runs = rom.match(/[^aeiou]*[aeiou]+/gi);
  if (!runs) return clusterCount === 1 ? [rom] : null;
  const sylls = [...runs];
  const leftover = rom.slice(runs.join('').length);
  if (leftover) {
    if (sylls.length + 1 === clusterCount) sylls.push(leftover);
    else sylls[sylls.length - 1] += leftover;
  }
  return sylls.length === clusterCount ? sylls : null;
}

/**
 * The hover tooltip for ONE letter-cluster — used by the interlinear's
 * etymology mode, where each cluster is its own hover target (no cycling).
 *
 * `afterVowel`: the cluster before this one ends in a vowel sound. Malayalam
 * speech often softens a single unvoiced stop there (ട ta → "da" — why the
 * sound line under തിരുവടി says di while the letter says ta). Geminates
 * (ക്ക etc.) never soften. The tooltip names the rule instead of leaving the
 * letter-vs-sound mismatch silent.
 */
export function clusterTip(cluster: string, afterVowel = false): EtymFacet {
  const story = clusterStory(cluster);
  const cps = Array.from(cluster).filter((c) => kindOf(c) !== 'join');
  const single = cps.length === 1;
  let secondary = story.note ?? '';
  const c0 = cps[0];
  if (afterVowel && kindOf(c0) === 'consonant' && SOFTENED[c0] && cps[1] !== '്') {
    const soft = `the letter says ${CONSONANTS[c0]}, but after a vowel the mouth often softens it toward ${SOFTENED[c0]} — the sound line follows the mouth`;
    secondary = secondary ? `${secondary} · ${soft}` : soft;
  }
  return {
    primary: single ? story.assembly : `${cluster} = ${story.assembly}`,
    secondary,
    // Exploded per-symbol view for multi-symbol clusters — the renderer shows
    // this INSTEAD of the primary text line (same information, drawn not told).
    parts: single ? undefined : clusterParts(cluster),
  };
}

/**
 * Facets for the etymology tooltip: first the cluster map of the whole piece,
 * then one facet per cluster telling its assembly story. Single-cluster pieces
 * skip the map and go straight to the story.
 */
export function malayalamEtymFacets(text: string): EtymFacet[] {
  const clusters = clustersOf(text).filter((c) => Array.from(c).some((ch) => kindOf(ch) !== 'other'));
  if (clusters.length === 0) return [];
  const out: EtymFacet[] = [];
  if (clusters.length > 1) {
    out.push({
      primary: clusters.join(' · '),
      secondary: `${clusters.length} letter-clusters — click through each`,
    });
  }
  for (const cl of clusters) {
    const story = clusterStory(cl);
    const single = Array.from(cl).filter((c) => kindOf(c) !== 'join').length === 1;
    out.push({
      primary: single ? `${story.assembly}` : `${cl} = ${story.assembly}`,
      secondary: story.note ?? '',
    });
  }
  const seen = new Set<string>();
  return out.filter((f) => (seen.has(f.primary) ? false : (seen.add(f.primary), true)));
}

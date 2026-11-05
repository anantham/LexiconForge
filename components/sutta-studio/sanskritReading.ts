import { aksharasOf } from '../liturgy/concept/devanagari';

const consonants: Record<string, string> = {
  k: 'क', kh: 'ख', g: 'ग', gh: 'घ', ṅ: 'ङ', c: 'च', ch: 'छ', j: 'ज', jh: 'झ', ñ: 'ञ',
  ṭ: 'ट', ṭh: 'ठ', ḍ: 'ड', ḍh: 'ढ', ṇ: 'ण', t: 'त', th: 'थ', d: 'द', dh: 'ध', n: 'न',
  p: 'प', ph: 'फ', b: 'ब', bh: 'भ', m: 'म', y: 'य', r: 'र', l: 'ल', v: 'व', ś: 'श', ṣ: 'ष', s: 'स', h: 'ह',
};
const vowels: Record<string, [string, string]> = {
  a: ['अ', ''], ā: ['आ', 'ा'], i: ['इ', 'ि'], ī: ['ई', 'ी'], u: ['उ', 'ु'], ū: ['ऊ', 'ू'],
  ṛ: ['ऋ', 'ृ'], ṝ: ['ॠ', 'ॄ'], ḷ: ['ऌ', 'ॢ'], ḹ: ['ॡ', 'ॣ'], e: ['ए', 'े'], ai: ['ऐ', 'ै'], o: ['ओ', 'ो'], au: ['औ', 'ौ'],
};
const signs: Record<string, string> = { 'ṃ': 'ं', 'ḥ': 'ः', "'": 'ऽ' };
export type SanskritReading = { devanagari: string; units: Array<{ text: string; rom: string }> };

/** Display transliteration of one written IAST token, never a source replacement.
 * Reuse the existing akshara romanizer but require an EXACT reverse match:
 * no final-r/s/visarga or m/anusvara folding. Unsupported input stays in IAST.
 * Units are orthographic aksharas, not morphemes or spoken/metrical syllables.
 */
export function sanskritReading(iast: string): SanskritReading | null {
  const source = iast.normalize('NFC');
  let devanagari = '';
  let consonantPending = false;
  for (let i = 0; i < source.length;) {
    const pair = source.slice(i, i + 2);
    const token = consonants[pair] || vowels[pair] ? pair : source[i];
    i += token.length;
    if (consonants[token]) {
      if (consonantPending) devanagari += '्';
      devanagari += consonants[token];
      consonantPending = true;
    } else if (vowels[token]) {
      devanagari += vowels[token][consonantPending ? 1 : 0];
      consonantPending = false;
    } else if (signs[token]) {
      if (consonantPending) devanagari += '्';
      devanagari += signs[token];
      consonantPending = false;
    } else return null;
  }
  if (consonantPending) devanagari += '्';
  // Avagraha is a silent elision marker, kept separate from sounded aksharas.
  const units = devanagari.split('ऽ').flatMap((part, i) => [
    ...(i > 0 ? [{ text: 'ऽ', rom: "'" }] : []), ...aksharasOf(part),
  ]);
  if (!units.length || units.map(u => u.rom).join('') !== source) return null;
  return { devanagari, units };
}

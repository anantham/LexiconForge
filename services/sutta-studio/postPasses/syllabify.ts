/**
 * Deterministic Pāli syllabifier + stress placer.
 *
 * Produces a pronunciation hint string like "vi · SUD · dhi · yā" from a
 * surface form like "visuddhiyā". No LLM cost; rules-based; runs in <1ms
 * per word. Designed to be the Tier-1 baseline pronunciation populator
 * in the metadata-filler post-pass module (A3).
 *
 * RULES
 *
 * Phoneme tokenization:
 *   Aspirated consonants (kh, gh, ch, jh, ṭh, ḍh, th, dh, ph, bh) are
 *   ONE phoneme written with two characters. Recognize and group them
 *   before syllabification.
 *
 * Syllabification (CV(C) target):
 *   - Walk left-to-right. Each syllable is (Onset?) + Nucleus + (Coda?).
 *   - Onset: zero or more consonants up to the next vowel.
 *   - Nucleus: one vowel.
 *   - Coda determined by what comes after:
 *       VC#       → C closes the syllable (word-final)
 *       V.CV      → single intervocalic C goes with the FOLLOWING syllable
 *       V.CCV     → first C closes this syllable, second C onsets the next
 *                   (covers both geminates and clusters)
 *       V.CCCV+   → first C closes; the rest are onset of next
 *   - Niggahīta (ṁ) is a consonant and always closes its syllable.
 *
 * Stress (Latin-style penult rule):
 *   - 1 syllable:  stress it.
 *   - 2 syllables: stress the first.
 *   - 3+ syllables: stress the penult IF heavy (long vowel OR closed),
 *                   else stress the antepenult.
 *   - A syllable is HEAVY if it contains a long vowel (ā ē ī ō ū) or
 *     ends in a consonant. The diphthongs e/o count as long.
 *
 * OUTPUT format: syllables joined with " · ", stressed syllable in UPPERCASE.
 *   "visuddhiyā" → "vi · SUD · dhi · yā"
 *   "bhagavā"    → "BHA · ga · vā"
 *
 * Known limitations (NOT covered by this Tier-1 deterministic pass):
 *   - "Rhymes with X" English-analog hints — judgment, needs curator or LLM.
 *   - Sandhi alternations across word boundaries — out of scope here.
 *   - Stress traditions vary by region/school; we pick the Latin-penult
 *     teaching convention. Curator can override per-word in
 *     PaliWord.pronunciation if needed.
 */

// ── Phoneme inventory ────────────────────────────────────────────────────

const SHORT_VOWELS = new Set(['a', 'i', 'u']);
const LONG_VOWELS = new Set(['ā', 'ī', 'ū', 'e', 'o', 'ē', 'ō']);
const VOWELS = new Set([...SHORT_VOWELS, ...LONG_VOWELS]);

const ASPIRATED_DIGRAPHS = ['kh', 'gh', 'ch', 'jh', 'ṭh', 'ḍh', 'th', 'dh', 'ph', 'bh'];

const isVowel = (phoneme: string): boolean => VOWELS.has(phoneme.toLowerCase());
const isLongVowel = (phoneme: string): boolean => LONG_VOWELS.has(phoneme.toLowerCase());

// ── Tokenization ─────────────────────────────────────────────────────────

/**
 * Split a Pāli word into phonemes, treating aspirated digraphs (kh, dh, etc.)
 * as single units.
 */
export function tokenizePaliPhonemes(word: string): string[] {
  const result: string[] = [];
  let i = 0;
  const lower = word.toLowerCase();
  while (i < lower.length) {
    const twoChar = lower.slice(i, i + 2);
    if (ASPIRATED_DIGRAPHS.includes(twoChar)) {
      result.push(twoChar);
      i += 2;
    } else {
      result.push(lower[i]);
      i += 1;
    }
  }
  return result;
}

// ── Syllabification ──────────────────────────────────────────────────────

/**
 * Split a word into syllables.
 */
export function syllabify(word: string): string[] {
  const phonemes = tokenizePaliPhonemes(word);
  const syllables: string[] = [];
  let i = 0;

  while (i < phonemes.length) {
    let syl = '';

    // Onset: consume consonants up to the next vowel
    while (i < phonemes.length && !isVowel(phonemes[i])) {
      syl += phonemes[i];
      i++;
    }

    if (i >= phonemes.length) {
      // Word ends in consonants with no following vowel; attach to last syl
      if (syl.length > 0) {
        if (syllables.length > 0) {
          syllables[syllables.length - 1] += syl;
        } else {
          syllables.push(syl);
        }
      }
      break;
    }

    // Nucleus: one vowel
    syl += phonemes[i];
    i++;

    // Look ahead: count consonants until next vowel (or end of word)
    let j = i;
    const followingConsonants: string[] = [];
    while (j < phonemes.length && !isVowel(phonemes[j])) {
      followingConsonants.push(phonemes[j]);
      j++;
    }

    if (j >= phonemes.length) {
      // End of word — all trailing consonants close this syllable
      syl += followingConsonants.join('');
      syllables.push(syl);
      i = j;
      break;
    }

    if (followingConsonants.length === 0) {
      // VV — boundary right after nucleus
      syllables.push(syl);
    } else if (followingConsonants.length === 1) {
      // V.CV — single intervocalic C goes with NEXT syllable
      syllables.push(syl);
      // i stays where it is; next iteration will pick up the consonant as onset
    } else {
      // V.CCV+ — first C closes this syllable, rest onset the next
      syl += followingConsonants[0];
      syllables.push(syl);
      i += 1;
    }
  }

  return syllables;
}

// ── Stress placement ─────────────────────────────────────────────────────

/**
 * Determine whether a syllable is HEAVY by Pāli prosody rules:
 *   - Contains a long vowel (ā ī ū) OR diphthong (e o), OR
 *   - Ends in a consonant (closed syllable).
 */
export function isHeavySyllable(syllable: string): boolean {
  const phonemes = tokenizePaliPhonemes(syllable);
  // Long vowel?
  if (phonemes.some(isLongVowel)) return true;
  // Closed (ends in consonant)?
  const last = phonemes[phonemes.length - 1];
  if (last && !isVowel(last)) return true;
  return false;
}

/**
 * Returns the index of the stressed syllable in the syllable list.
 *
 * Rule: Latin-style penult / antepenult.
 *   - 1 syl: 0
 *   - 2 syls: 0 (initial stress)
 *   - 3+ syls: penult if heavy, else antepenult
 */
export function pickStressIndex(syllables: string[]): number {
  const n = syllables.length;
  if (n <= 1) return 0;
  if (n === 2) return 0;
  const penultIdx = n - 2;
  if (isHeavySyllable(syllables[penultIdx])) return penultIdx;
  return n - 3;
}

// ── Public formatter ─────────────────────────────────────────────────────

/**
 * Generate a pronunciation hint string for a Pāli surface form.
 * Format: syllables joined with " · ", stressed syllable in UPPERCASE.
 *
 *   syllabifyPaliWord("visuddhiyā") → "vi · SUD · dhi · yā"
 *   syllabifyPaliWord("bhagavā")    → "BHA · ga · vā"
 *
 * Preserves the original casing on the non-stressed syllables (lowercased
 * input → lowercased output non-stress). The stressed syllable is uppercased
 * to make it pop visually.
 */
export function syllabifyPaliWord(surface: string): string {
  // Strip any whitespace; if input is empty, return empty
  const clean = surface.trim();
  if (clean.length === 0) return '';

  // Syllabify on lowercased form (tokenizer normalises anyway), then
  // re-apply case at the end based on whether the original was capitalized.
  const originalIsCapitalized = clean[0] === clean[0].toUpperCase() && clean[0] !== clean[0].toLowerCase();

  const syllables = syllabify(clean);
  if (syllables.length === 0) return clean;

  const stressIdx = pickStressIndex(syllables);

  const formatted = syllables.map((syl, i) => (i === stressIdx ? syl.toUpperCase() : syl));

  // If original was capitalized (proper noun, sentence start), reflect that
  // on the first syllable IF it isn't already the stressed one.
  if (originalIsCapitalized && stressIdx !== 0 && formatted[0].length > 0) {
    formatted[0] = formatted[0][0].toUpperCase() + formatted[0].slice(1);
  }

  return formatted.join(' · ');
}

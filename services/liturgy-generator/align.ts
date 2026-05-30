import type { WordGloss } from '../../types/liturgy';
import type {
  AlignmentHint,
  AlignmentResult,
  LiturgyGeneratorDiagnostic,
  LiturgyGeneratorTripleScriptSegmentInput,
  LiturgyGeneratorWitnessInput,
} from './types';
import { normalizeToken, tokenizeSourceText, tokenizeWitnessText, wordsFromText } from './tokenize';

const STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'be',
  'been',
  'being',
  'by',
  'for',
  'from',
  'in',
  'into',
  'is',
  'of',
  'or',
  'that',
  'the',
  'this',
  'to',
  'with',
]);

type CandidateIndex = {
  wordTerms: Array<Set<string>>;
  morphemeTerms: Array<Array<Set<string>>>;
};

function addTerms(target: Set<string>, text: string | undefined): void {
  if (!text) return;
  for (const word of wordsFromText(text)) {
    if (word.length > 0) target.add(word);
  }
}

function addWordTerms(target: Set<string>, word: WordGloss): void {
  addTerms(target, word.form);
  addTerms(target, word.scriptAlt);
  addTerms(target, word.root);
  addTerms(target, word.gloss);
  addTerms(target, word.etymology);
  addTerms(target, word.note);
  for (const alt of Object.values(word.scriptAlts ?? {})) addTerms(target, alt);
}

function buildCandidateIndex(
  words: WordGloss[],
  hints: AlignmentHint[] | undefined
): CandidateIndex {
  const wordTerms = words.map((word) => {
    const terms = new Set<string>();
    addWordTerms(terms, word);
    for (const morpheme of word.morphemes ?? []) {
      addTerms(terms, morpheme.text);
      addTerms(terms, morpheme.root);
      addTerms(terms, morpheme.gloss);
      addTerms(terms, morpheme.note);
    }
    return terms;
  });

  const morphemeTerms = words.map((word) =>
    (word.morphemes ?? []).map((morpheme) => {
      const terms = new Set<string>();
      addTerms(terms, morpheme.text);
      addTerms(terms, morpheme.root);
      addTerms(terms, morpheme.gloss);
      addTerms(terms, morpheme.note);
      return terms;
    })
  );

  for (const hint of hints ?? []) {
    const wordSet = wordTerms[hint.wordIndex];
    if (!wordSet) continue;
    for (const term of hint.terms) addTerms(wordSet, term);
    for (const morphemeHint of hint.morphemes ?? []) {
      const morphemeSet = morphemeTerms[hint.wordIndex]?.[morphemeHint.morphemeIndex];
      if (!morphemeSet) continue;
      for (const term of morphemeHint.terms) addTerms(morphemeSet, term);
    }
  }

  return { wordTerms, morphemeTerms };
}

function sourceWordsForSegment(segment: LiturgyGeneratorTripleScriptSegmentInput): WordGloss[] {
  if (segment.words && segment.words.length > 0) return segment.words;
  return tokenizeSourceText(segment.pali).map((form) => ({ form, gloss: form }));
}

function findUniqueWordMatch(token: string, wordTerms: Array<Set<string>>): number {
  const matches: number[] = [];
  wordTerms.forEach((terms, index) => {
    if (terms.has(token)) matches.push(index);
  });
  return matches.length === 1 ? matches[0] : -1;
}

function findUniqueMorphemeMatch(
  token: string,
  wordIndex: number,
  morphemeTerms: Array<Array<Set<string>>>
): number | null {
  const termsForWord = morphemeTerms[wordIndex] ?? [];
  const matches: number[] = [];
  termsForWord.forEach((terms, index) => {
    if (terms.has(token)) matches.push(index);
  });
  return matches.length === 1 ? matches[0] : null;
}

export function inferWitnessAlignment(params: {
  sectionId: string;
  segment: LiturgyGeneratorTripleScriptSegmentInput;
  witness: LiturgyGeneratorWitnessInput;
}): AlignmentResult {
  const { sectionId, segment, witness } = params;
  const sourceWords = sourceWordsForSegment(segment);
  const candidates = buildCandidateIndex(sourceWords, segment.alignmentHints);
  const witnessTokens = tokenizeWitnessText(witness.text);
  const diagnostics: LiturgyGeneratorDiagnostic[] = [];
  const alignTo: number[] = [];
  const morphemeAlignTo: (number | null)[] = [];
  let unmappedTokenCount = 0;
  let morphemeMatchCount = 0;
  let contentTokenCount = 0;

  witnessTokens.forEach((rawToken, tokenIndex) => {
    const token = normalizeToken(rawToken);
    if (!token || STOPWORDS.has(token)) {
      alignTo.push(-1);
      morphemeAlignTo.push(null);
      return;
    }
    contentTokenCount += 1;

    const wordIndex = findUniqueWordMatch(token, candidates.wordTerms);
    alignTo.push(wordIndex);

    if (wordIndex < 0) {
      morphemeAlignTo.push(null);
      unmappedTokenCount++;
      diagnostics.push({
        level: 'warn',
        code: 'liturgy_generator.unmapped_witness_token',
        stage: 'alignment',
        sectionId,
        segmentId: segment.id,
        witnessBy: witness.by,
        path: `witnesses.${witness.by}.text[${tokenIndex}]`,
        message: `inferWitnessAlignment: token "${rawToken}" in witness "${witness.by}" did not uniquely match a source word in segment "${segment.id}".`,
      });
      return;
    }

    const morphemeIndex = findUniqueMorphemeMatch(token, wordIndex, candidates.morphemeTerms);
    morphemeAlignTo.push(morphemeIndex);
    if (morphemeIndex !== null) morphemeMatchCount++;
  });

  // Coverage tripwire. The matcher only maps a content word when it UNIQUELY
  // matches one source word's term set; real chants with sentence-length
  // glosses collide constantly, so most content words fall to -1 and render as
  // un-arrowed glue. When fewer than COVERAGE_FLOOR of content words mapped,
  // inference is unreliable for this witness — say so loudly instead of
  // emitting a confident-looking but mostly-empty alignment.
  const COVERAGE_FLOOR = 0.6;
  if (contentTokenCount > 0) {
    const mappedContentCount = contentTokenCount - unmappedTokenCount;
    const coverage = mappedContentCount / contentTokenCount;
    if (coverage < COVERAGE_FLOOR) {
      diagnostics.push({
        level: 'warn',
        code: 'liturgy_generator.low_alignment_coverage',
        stage: 'alignment',
        sectionId,
        segmentId: segment.id,
        witnessBy: witness.by,
        path: `witnesses.${witness.by}.text`,
        message: `inferWitnessAlignment: only ${mappedContentCount}/${contentTokenCount} content words in witness "${witness.by}" matched a source word (${Math.round(
          coverage * 100
        )}%); the rest render as un-arrowed glue. Inference is unreliable here — author alignTo by hand.`,
      });
    }
  }

  const hasAnyMorphemeData = sourceWords.some((word) => (word.morphemes ?? []).length > 0);

  return {
    alignTo,
    morphemeAlignTo: hasAnyMorphemeData ? morphemeAlignTo : undefined,
    diagnostics,
    unmappedTokenCount,
    morphemeMatchCount,
  };
}

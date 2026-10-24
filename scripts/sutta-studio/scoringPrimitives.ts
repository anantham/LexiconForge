import type { AnatomistPass } from '../../types/suttaStudio';

const SENSE_STOP = new Set([
  'the', 'and', 'for', 'with', 'are', 'here', 'part', 'name', 'meaning', 'sense',
  'word', 'term', 'its', 'this', 'that', 'not', 'but', 'than', 'from', 'one',
  'what', 'about', 'marks', 'mark', 'used', 'refers', 'form', 'where', 'which',
  'into', 'place', 'thing', 'something', 'usual', 'like', 'etc',
]);

/** Lowercase, strip punctuation (keep Pāli diacritics + √ root marker), drop stopwords/short. */
export const tokenize = (text: string | undefined | null): string[] => {
  if (!text) return [];
  return text
    .normalize('NFC') // Preserve decomposed diacritics before removing punctuation.
    .toLowerCase()
    .replace(/[^a-zĀ-ſḀ-ỿ√]+/g, ' ')
    .split(/\s+/)
    .map(t => t.trim())
    .filter(t => (t.length > 2 || t.startsWith('√')) && !SENSE_STOP.has(t));
};

/** Normalized surface key for cross-pass word alignment (lowercase + Unicode NFC). */
export const normSurface = (s: string | undefined): string => (s || '').toLowerCase().normalize('NFC');

/**
 * Match normalized surfaces via longest common subsequence, returning ordered
 * [goldenIndex, modelIndex] pairs. Dropped repeated words leave only one unmatched instance.
 */
export const alignWords = (
  gold: AnatomistPass['words'],
  model: AnatomistPass['words']
): Array<[number, number]> => {
  const G = (gold || []).map(w => normSurface(w.surface));
  const M = (model || []).map(w => normSurface(w.surface));
  const n = G.length, m = M.length;
  if (n === 0 || m === 0) return [];
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] = G[i - 1] === M[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  const pairs: Array<[number, number]> = [];
  let i = n, j = m;
  while (i > 0 && j > 0) {
    if (G[i - 1] === M[j - 1]) { pairs.push([i - 1, j - 1]); i--; j--; }
    else if (dp[i - 1][j] >= dp[i][j - 1]) i--;
    else j--;
  }
  return pairs.reverse();
};

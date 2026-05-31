const PALI_WORD_RE = /[A-Za-zĀāĪīŪūṚṛṂṃṄṅÑñṬṭḌḍṆṇŚśṢṣḤḥṁÀ-ɏ]+/g;
const DIACRITIC_RE = /\p{Diacritic}/gu;
const EDGE_PUNCT_RE = /^[^\p{Letter}\p{Number}]+|[^\p{Letter}\p{Number}]+$/gu;
const INNER_PUNCT_RE = /[.,;:!?'"()[\]{}]/g;

export function tokenizeSourceText(text: string): string[] {
  return text.match(PALI_WORD_RE) ?? [];
}

export function tokenizeWitnessText(text: string): string[] {
  return text.split(/\s+/).filter((token) => token.length > 0);
}

export function normalizeToken(token: string): string {
  return token
    .normalize('NFD')
    .replace(DIACRITIC_RE, '')
    .replace(EDGE_PUNCT_RE, '')
    .replace(INNER_PUNCT_RE, '')
    .toLowerCase();
}

export function wordsFromText(text: string): string[] {
  return text
    .split(/[\s/|,;:.!?()[\]{}"'`*]+/)
    .map(normalizeToken)
    .filter((word) => word.length > 0);
}

export function stableExportName(slug: string): string {
  const parts = slug
    .split(/[^a-zA-Z0-9]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return 'generatedLiturgyDoc';
  const [first, ...rest] = parts;
  return [
    first.charAt(0).toLowerCase() + first.slice(1),
    ...rest.map((part) => part.charAt(0).toUpperCase() + part.slice(1)),
  ].join('');
}

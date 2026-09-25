/**
 * Single source of truth for the illustration placement marker, e.g. `[ILLUSTRATION-1]`
 * or `[ILLUSTRATION-2b]`.
 *
 * This pattern was previously copy-pasted across prompt assembly, the Claude adapter and
 * the response validators. Two of the three copies had an over-escaped `\\[` / `\\d`, which
 * in a regex literal matches a literal backslash rather than a bracket — so they silently
 * never matched a marker. Keep exactly one definition.
 */
/** The marker body without brackets, for callers that need their own capture group. */
export const ILLUSTRATION_MARKER_INNER = String.raw`ILLUSTRATION-\d+[A-Za-z]*`;

const MARKER_SOURCE = String.raw`\[` + ILLUSTRATION_MARKER_INNER + String.raw`\]`;

/** Raw pattern source, for callers composing a larger regex (e.g. marker renumbering). */
export const ILLUSTRATION_MARKER_PATTERN = MARKER_SOURCE;

/**
 * A global regex is stateful (`lastIndex` persists across `.test`/`.exec`), so hand out a
 * fresh one per call rather than sharing a module-level instance between callers.
 */
export const illustrationMarkerRegex = (): RegExp => new RegExp(MARKER_SOURCE, 'g');

/** Every illustration marker in `text`, in order of appearance (duplicates included). */
export const findIllustrationMarkers = (text: string): string[] =>
  text.match(illustrationMarkerRegex()) ?? [];

/** Count of illustration markers in `text`. */
export const countIllustrationMarkers = (text: string): number =>
  findIllustrationMarkers(text).length;

const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Insert ` ${marker}` right after the reader's `selection` in a translation.
 *
 * The selection is plain text from the rendered view while the translation is
 * HTML, so tags may sit between any two characters ("The knight" must match
 * "The <em>knight</em>"). Falls back to an exact replace; returns the input
 * unchanged when the selection cannot be found.
 */
export const insertMarkerAfterSelection = (translation: string, selection: string, marker: string): string => {
  const htmlTagPattern = '(?:<[^>]*>)*';
  const chars = selection.split('');
  const pattern = chars
    .map((char, i) => (i < chars.length - 1 ? escapeRegex(char) + htmlTagPattern : escapeRegex(char)))
    .join('');

  try {
    const match = translation.match(new RegExp(`(${pattern})`, 'i'));
    if (match && match.index !== undefined) {
      const end = match.index + match[0].length;
      return `${translation.slice(0, end)} ${marker}${translation.slice(end)}`;
    }
  } catch {
    // An unrepresentable selection falls through to the exact replace.
  }
  return translation.replace(selection, `${selection} ${marker}`);
};

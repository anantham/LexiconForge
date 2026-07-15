/**
 * Single source of truth for the illustration placement marker, e.g. `[ILLUSTRATION-1]`
 * or `[ILLUSTRATION-2b]`.
 *
 * This pattern was previously copy-pasted across prompt assembly, the Claude adapter and
 * the response validators. Two of the three copies had an over-escaped `\\[` / `\\d`, which
 * in a regex literal matches a literal backslash rather than a bracket — so they silently
 * never matched a marker. Keep exactly one definition.
 */
const MARKER_SOURCE = String.raw`\[ILLUSTRATION-\d+[A-Za-z]*\]`;

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

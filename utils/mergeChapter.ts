/**
 * Merge a freshly-fetched chapter into the existing in-memory chapter,
 * preserving any in-memory-only fields that the incoming version has
 * null/undefined for.
 *
 * Why this exists: chapters in the store can have fields that aren't yet
 * persisted to IDB — e.g. a `fanTranslation` attached by the library-search
 * flow when the user picks a fan source, or a `translationResult` from an
 * in-flight translation. When the same chapter is re-resolved (navigation,
 * IDB hydration, web fetch), the new copy doesn't have those fields, and
 * a blanket `{...incoming}` spread silently wipes them.
 *
 * The rule:
 *   - For each key in either object, take incoming's value if it's defined
 *     and not null.
 *   - Otherwise (incoming has null or undefined), keep existing's value.
 *   - Empty strings / empty arrays count as "defined" — they're explicit
 *     clears, not absent values.
 *
 * Callers explicitly opt into this rather than getting it for free on every
 * Map.set, because some operations (chapter delete, replacement with a
 * known-cleared version) genuinely want a full overwrite.
 */
export function mergeChapter<T extends object>(existing: T, incoming: T): T {
  const merged: any = { ...existing, ...incoming };
  // Walk every key from the existing object and restore the existing value
  // when the spread above replaced it with null/undefined.
  for (const key of Object.keys(existing) as Array<keyof T>) {
    const incomingVal = (incoming as any)[key];
    const existingVal = (existing as any)[key];
    if (
      (incomingVal === null || incomingVal === undefined) &&
      existingVal !== null &&
      existingVal !== undefined
    ) {
      merged[key] = existingVal;
    }
  }
  return merged as T;
}

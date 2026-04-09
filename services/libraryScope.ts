const LIBRARY_SCOPE_DELIMITER = '::';
const LIBRARY_STORAGE_PREFIX = 'lf-library://';
const LIBRARY_STABLE_ID_PREFIX = 'lf-library:';

export const buildLibraryScopeKey = (
  novelId: string,
  libraryVersionId: string | null | undefined
): string => {
  return libraryVersionId ? `${novelId}${LIBRARY_SCOPE_DELIMITER}${libraryVersionId}` : novelId;
};

export const buildLibraryBookshelfKey = (
  novelId: string,
  libraryVersionId: string | null | undefined
): string => {
  return buildLibraryScopeKey(novelId, libraryVersionId);
};

export const isScopedStableId = (stableId: string | null | undefined): boolean => {
  return typeof stableId === 'string' && stableId.startsWith(LIBRARY_STABLE_ID_PREFIX);
};

export const parseScopedStableId = (
  stableId: string
): { scopeKey: string; novelId: string; libraryVersionId: string | null; baseStableId: string } | null => {
  if (!isScopedStableId(stableId)) {
    return null;
  }

  const remainder = stableId.slice(LIBRARY_STABLE_ID_PREFIX.length);
  const delimiterIndex = remainder.indexOf(':');
  if (delimiterIndex === -1) {
    throw new Error(
      `[libraryScope] Malformed scoped stableId "${stableId}": missing scope delimiter after prefix.`
    );
  }

  const encodedScopeKey = remainder.slice(0, delimiterIndex);
  const baseStableId = remainder.slice(delimiterIndex + 1);
  if (!baseStableId) {
    throw new Error(
      `[libraryScope] Malformed scoped stableId "${stableId}": missing base stableId payload.`
    );
  }

  const scopeKey = decodeURIComponent(encodedScopeKey);
  const [novelId, ...versionParts] = scopeKey.split(LIBRARY_SCOPE_DELIMITER);
  if (!novelId) {
    throw new Error(
      `[libraryScope] Malformed scoped stableId "${stableId}": decoded scope is missing novelId.`
    );
  }

  return {
    scopeKey,
    novelId,
    libraryVersionId: versionParts.length > 0 ? versionParts.join(LIBRARY_SCOPE_DELIMITER) : null,
    baseStableId,
  };
};

export const buildScopedStableId = (
  stableId: string,
  novelId: string,
  libraryVersionId: string | null | undefined
): string => {
  if (isScopedStableId(stableId)) {
    const parsed = parseScopedStableId(stableId);
    const requestedScope = buildLibraryScopeKey(novelId, libraryVersionId);
    const existingScope = parsed?.scopeKey ?? 'unknown';
    throw new Error(
      `[libraryScope] buildScopedStableId received an already scoped stableId. ` +
      `existingScope="${existingScope}", requestedScope="${requestedScope}", stableId="${stableId}". ` +
      `Callers must pass an unscoped base stableId or explicitly preserve the existing scoped identity.`
    );
  }

  const scopeKey = encodeURIComponent(buildLibraryScopeKey(novelId, libraryVersionId));
  return `${LIBRARY_STABLE_ID_PREFIX}${scopeKey}:${stableId}`;
};

export const buildScopedStorageUrl = (
  stableId: string,
  novelId: string,
  libraryVersionId: string | null | undefined
): string => {
  const scopeKey = encodeURIComponent(buildLibraryScopeKey(novelId, libraryVersionId));
  return `${LIBRARY_STORAGE_PREFIX}${scopeKey}/${encodeURIComponent(stableId)}`;
};

export const isLibraryStorageUrl = (url: string | null | undefined): boolean => {
  return typeof url === 'string' && url.startsWith(LIBRARY_STORAGE_PREFIX);
};

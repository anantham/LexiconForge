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

export const buildScopedStableId = (
  stableId: string,
  novelId: string,
  libraryVersionId: string | null | undefined
): string => {
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

/**
 * Regression tests for the EPUB image-version resolution order (P1: EPUB
 * exports the wrong image version after reload).
 *
 * Pre-fix bug: exportEpub picked the version from the SESSION-MEMORY maps
 * (activeImageVersion || imageVersions || 1). Those maps hydrate lazily per
 * visited chapter, so after a reload they are empty and every image fell back
 * to v1 — even though the persisted choice (imageVersionState[marker]
 * .activeVersion) was already being read for the caption on the next line.
 */

import { describe, expect, it } from 'vitest';
import { resolveExportedImageVersion } from '../../../store/slices/exportSlice';

describe('resolveExportedImageVersion', () => {
  it('after a reload (empty memory maps) the PERSISTED activeVersion wins — not v1', () => {
    // The reported bug: persisted choice v3, memory empty → must embed v3.
    expect(resolveExportedImageVersion(undefined, undefined, 3)).toBe(3);
  });

  it('mid-session, the memory active version wins over the persisted record', () => {
    // Memory is fresher: version navigation updates it synchronously while
    // persistence is async and can fail.
    expect(resolveExportedImageVersion(2, 3, 3)).toBe(2);
  });

  it('falls back to the memory latest-version map when no explicit active exists', () => {
    expect(resolveExportedImageVersion(undefined, 2, 3)).toBe(2);
  });

  it('legacy images with no version tracking anywhere resolve to 1', () => {
    expect(resolveExportedImageVersion(undefined, undefined, undefined)).toBe(1);
    expect(resolveExportedImageVersion(undefined, undefined, null)).toBe(1);
  });
});

/**
 * Unit tests for maintenance.ts module-level helpers (exported for tests).
 *
 * Covers two verified integrity-scan findings:
 *
 * 1. UNSATISFIABLE BACKFILL — backfillSummaryNovelIds extracted novelId via
 *    `stableId.split(':')` then `parts[1].includes('::')`; split(':') output
 *    can never contain ':', so the condition was false for EVERY input and
 *    the migration backfilled 0 summaries while recording success (since
 *    2026-04-09). The replacement, extractNovelIdFromStableId, must handle
 *    BOTH the encoded (%3A%3A) and raw (::) scope-delimiter forms.
 *
 * 2. PARSER WEDGE — parseScopedStableId THROWS on malformed lf-library ids.
 *    peelAllScopes guarded the call, but getScopedStableIdDepth and
 *    collapseScopedStableId called it bare, so ONE malformed row made the V4
 *    migration throw on every boot forever (caught as "non-fatal" upstream,
 *    flag never set, full rescan every launch).
 */
import { describe, expect, it } from 'vitest';
import {
  collapseScopedStableId,
  extractNovelIdFromStableId,
  getScopedStableIdDepth,
} from '../../../services/db/operations/maintenance';
import { parseScopedStableId } from '../../../services/libraryScope';

describe('extractNovelIdFromStableId (summary novelId backfill)', () => {
  it('extracts novelId from the ENCODED scope-delimiter form (%3A%3A)', () => {
    expect(
      extractNovelIdFromStableId('lf-library:forty-millenniums%3A%3Av1-enhanced:ch1_ab_cd')
    ).toBe('forty-millenniums');
  });

  it('extracts novelId from the RAW scope-delimiter form (::)', () => {
    expect(
      extractNovelIdFromStableId('lf-library:forty-millenniums::v1-enhanced:ch1_ab_cd')
    ).toBe('forty-millenniums');
  });

  it('falls back to the regex when the canonical parser throws (corrupted id)', () => {
    // Missing base payload after the scope → parseScopedStableId throws;
    // the regex fallback still recovers the novelId.
    expect(() =>
      parseScopedStableId('lf-library:forty-millenniums%3A%3Av1-enhanced:')
    ).toThrow();
    expect(
      extractNovelIdFromStableId('lf-library:forty-millenniums%3A%3Av1-enhanced:')
    ).toBe('forty-millenniums');
  });

  it('returns null for unscoped, empty, and unrecoverable ids', () => {
    expect(extractNovelIdFromStableId('ch1_ab_cd')).toBeNull();
    expect(extractNovelIdFromStableId('')).toBeNull();
    expect(extractNovelIdFromStableId(null)).toBeNull();
    expect(extractNovelIdFromStableId(undefined)).toBeNull();
    // Scoped prefix but no scope delimiter anywhere → nothing to extract.
    expect(extractNovelIdFromStableId('lf-library:no-second-delimiter')).toBeNull();
  });

  it('red-proof: the pre-fix split(":") extraction was unsatisfiable on BOTH forms', () => {
    // Verbatim port of the old backfillSummaryNovelIds extraction block.
    // split(':') output can never contain ':', so `includes('::')` is false
    // for every input — this is the bug the helper above replaces.
    const oldExtract = (stableId: string): string | null => {
      let novelId: string | null = null;
      const parts = stableId.split(':');
      if (parts.length >= 2) {
        const scopePart = parts[1];
        if (scopePart.includes('::')) {
          novelId = scopePart.split('::')[0];
        }
      }
      return novelId;
    };
    expect(oldExtract('lf-library:forty-millenniums%3A%3Av1-enhanced:ch1_ab_cd')).toBeNull();
    expect(oldExtract('lf-library:forty-millenniums::v1-enhanced:ch1_ab_cd')).toBeNull();
  });
});

describe('malformed scoped stableIds must not wedge the migrations', () => {
  const malformed = 'lf-library:no-second-delimiter';

  it('parseScopedStableId throws on the malformed id (the hazard being guarded)', () => {
    expect(() => parseScopedStableId(malformed)).toThrow();
  });

  it('getScopedStableIdDepth does not throw — reports the depth counted so far', () => {
    expect(() => getScopedStableIdDepth(malformed)).not.toThrow();
    expect(getScopedStableIdDepth(malformed)).toBe(0);
  });

  it('collapseScopedStableId does not throw — returns the input unchanged', () => {
    expect(() => collapseScopedStableId(malformed, 'some-novel', 'v1')).not.toThrow();
    expect(collapseScopedStableId(malformed, 'some-novel', 'v1')).toBe(malformed);
  });

  it('well-formed ids still parse to the expected depth/collapse results', () => {
    const clean = 'lf-library:forty-millenniums%3A%3Av1-enhanced:ch1_ab_cd';
    expect(getScopedStableIdDepth(clean)).toBe(1);
    expect(
      collapseScopedStableId(clean, 'forty-millenniums', 'v1-enhanced')
    ).toBe(clean);
  });
});

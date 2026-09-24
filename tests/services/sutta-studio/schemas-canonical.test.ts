/**
 * Contract test for the canonical schemas at services/sutta-studio/schemas.ts.
 *
 * All 7 response schemas live in one place (CONSOLIDATION.md Phase 2c); the
 * legacy re-export shims are retired in Phase 4.
 *
 * This test locks in two invariants:
 *   1. Every pass schema is exported from the canonical module.
 *   2. The canonical schemas include wordRange and refrainId — the
 *      production-needed fields that production schemas used to lack.
 *      If anyone strips these during a future refactor, this fails
 *      and forces a conscious product decision.
 */
import { describe, it, expect } from 'vitest';

import * as canonical from '../../../services/sutta-studio/schemas';

const schemaNames = [
  'skeletonResponseSchema',
  'anatomistResponseSchema',
  'lexicographerResponseSchema',
  'weaverResponseSchema',
  'typesetterResponseSchema',
  'phaseResponseSchema',
  'morphResponseSchema',
] as const;

describe('schemas canonical reconciliation (PR A / Phase 2c)', () => {
  describe('canonical module exports every pass schema', () => {
    for (const name of schemaNames) {
      it(`${name} is exported`, () => {
        expect((canonical as Record<string, unknown>)[name]).toBeDefined();
      });
    }
  });

  describe('production gap-close: wordRange and refrainId are present', () => {
    it('skeletonResponseSchema phases include wordRange (for sub-segment splitting)', () => {
      const phaseItem = (canonical.skeletonResponseSchema as any).properties.phases.items;
      expect(phaseItem.properties.wordRange).toBeDefined();
      expect(phaseItem.properties.wordRange.type).toBe('array');
      expect(phaseItem.properties.wordRange.minItems).toBe(2);
      expect(phaseItem.properties.wordRange.maxItems).toBe(2);
    });

    it('anatomistResponseSchema words include refrainId (for recurring-phrase styling)', () => {
      const wordItem = (canonical.anatomistResponseSchema as any).properties.words.items;
      expect(wordItem.properties.refrainId).toBeDefined();
      expect(wordItem.properties.refrainId.type).toBe('string');
    });
  });
});

/**
 * Contract test for the canonical schemas at services/sutta-studio/schemas.ts.
 *
 * After PR A (Phase 2c of CONSOLIDATION.md), all 7 response schemas live in
 * one place. The two legacy locations (services/compiler/schemas.ts and the
 * schema section of services/suttaStudioPassPrompts.ts) are now thin
 * re-export shims that forward to the canonical file.
 *
 * This test locks in two invariants:
 *   1. All three locations export THE SAME object (referentially === ).
 *      If anyone duplicates a schema definition in a legacy file, this
 *      test catches the re-divergence before it ships.
 *   2. The canonical schemas include wordRange and refrainId — the
 *      production-needed fields that production schemas used to lack.
 *      If anyone strips these during a future refactor, this fails
 *      and forces a conscious product decision.
 */
import { describe, it, expect } from 'vitest';

import * as canonical from '../../../services/sutta-studio/schemas';
import * as compilerLegacy from '../../../services/compiler/schemas';
import * as passPromptsLegacy from '../../../services/suttaStudioPassPrompts';

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
  describe('legacy locations re-export canonical objects', () => {
    for (const name of schemaNames) {
      it(`${name} is the same object across all three locations`, () => {
        const canonicalRef = (canonical as Record<string, unknown>)[name];
        const compilerRef = (compilerLegacy as Record<string, unknown>)[name];
        const passPromptsRef = (passPromptsLegacy as Record<string, unknown>)[name];

        expect(canonicalRef).toBeDefined();
        expect(compilerRef).toBe(canonicalRef);
        expect(passPromptsRef).toBe(canonicalRef);
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

/**
 * Re-export shim — utilities moved to services/sutta-studio/utils.ts per
 * CONSOLIDATION.md Phase 2a.
 *
 * Existing consumers (services/compiler/index.ts, services/compiler/skeleton.ts,
 * tests/services/compiler/utils.test.ts) continue to import from this path
 * without changes. Phase 4 cleanup will delete this shim once all consumers
 * are updated.
 */

export * from '../sutta-studio/utils';

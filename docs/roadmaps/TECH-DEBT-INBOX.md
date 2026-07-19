# TECH-DEBT-INBOX

Append-only raw debt receipts discovered during implementation.

[DEBT][COMPAT][2026-04-09 10:26 EDT] Temporary novel-library migration compatibility layer
- Files:
  - `services/registryService.ts`
  - `services/importService.ts`
  - `store/bootstrap/initializeStore.ts`
  - `components/NovelLibrary.tsx`
  - `types/novel.ts`
- Symptom:
  - Legacy deep links/bookshelf entries still referenced removed version ids such as `v1-composite`.
  - Some library `session.json` assets resolved through `raw.githubusercontent.com`, which returned Git LFS pointer text instead of the real JSON payload.
- Temporary compatibility added:
  - Legacy version resolution via `legacyVersionIds` plus single-version fallback.
  - Session artifact normalization from raw GitHub to media GitHub.
  - Explicit Git LFS pointer detection in import.
- Follow-up:
  - Remove version-id fallback logic once all active library metadata and saved links/bookmarks have been migrated to canonical version ids.
  - Re-evaluate whether raw→media session URL rewriting is still needed once all published metadata uses canonical artifact URLs directly.
  - Keep or remove the Git LFS pointer guard intentionally; it may still be worth keeping as a defensive diagnostic even after migration cleanup.
- Suggested exit criteria:
  - All registry novels use canonical version ids with no remaining legacy aliases needed.
  - Existing user-facing deep links/bookmarks have either been migrated or are no longer supported by policy.
  - Published metadata points directly at final session artifact URLs without importer-side rewriting.

[DEBT][TEST][2026-07-13 10:02 IST] Node 26 experimental Web Storage shadows jsdom localStorage
- Files:
  - `vitest.config.ts`
  - `tests/setup.ts`
  - `package.json` / the eventual Node-version or test-command policy
- Symptom:
  - On Node `v26.0.0`, the experimental global `localStorage` accessor exists but yields `undefined` without `--localstorage-file`.
  - This shadows jsdom's storage in tests that access the global directly, causing 71 unrelated UI tests to fail before their assertions.
  - `NODE_OPTIONS=--no-experimental-webstorage` restores jsdom ownership and the full 8,797-test suite passes.
- Suggested follow-up:
  - Pin a supported Node version, or make the Vitest command/setup explicitly disable or replace Node's experimental Web Storage global.
  - Keep this separate from database transaction changes so verification-environment policy receives its own review.
- Exit criteria:
  - `npm test -- --run` passes on the documented Node version without an undocumented shell flag.
[DEBT][TEST][2026-07-16 10:52 IST] Node 26 disables the test DOM's `localStorage`
- Files:
  - `vitest.config.ts`
  - `tests/setup.ts`
  - `package.json`
  - `.github/workflows/test.yml`
- Symptom:
  - A full `vitest run` under the locally active Node 26.0.0 reports `localStorage is not available because --localstorage-file was not provided`, then 115 tests fail because `localStorage` is undefined.
  - A representative failure reproduces unchanged on `main`; export-focused suites that do not exercise local storage remain green.
  - CI is pinned to Node 20, so the issue does not currently invalidate the pull-request gate.
- Friction:
  - Local full-suite validation looks like a broad product regression even when the changed code is unrelated, and the repository does not declare a supported local Node range.
- Suggested follow-up:
  - Decide whether to declare and enforce Node 20/22 for local development or make test setup explicitly replace Node 26's experimental storage global with the Happy DOM implementation.
  - Add a small environment preflight so an unsupported runtime fails once with a descriptive message instead of cascading into hundreds of tests.

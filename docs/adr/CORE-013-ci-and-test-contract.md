# CORE-013 — CI and Test Contract

**Status:** Accepted
**Date:** 2026-08-22
**Group:** Infrastructure / verification

## Context

The pre-#150 workflow ran integrity, typecheck, lint, build, security scanning,
unit tests, and corpus validation as one serial job with unstable implicit
meaning ("quality gates"). #149 committed conflict markers to `main` while every
existing check stayed green, and the follow-up (#150) gate relied on a shallow
three-dot merge-base assumption. Coverage does not run in CI at all; test
ownership between Vitest/Playwright is undocumented (TEST_MANIFEST.md admits
staleness); hermetic and external E2E are mixed. Merges are not actually gated:
`main` has no branch protection, so advisory checks cannot block anything.

This ADR is part of a staged programme (2026-08-22 review). PR 1 defines the
contract; later PRs make coverage truthful (PR 2), isolate test environments
(PR 3), separate Playwright lanes (PR 4), and enable repository rulesets that
require these checks (PR 5).

## Decision

CI is composed of **five stable named jobs**, each wrapping exactly one named
npm script. The names below are public contracts: renaming one requires an ADR
amendment, and PR 5 will require them by name.

| Job | npm contract | Meaning |
|-----|--------------|---------|
| `repository-integrity` | `npm run verify:integrity` | No conflict markers; no whitespace errors across the exact-base-SHA two-tree diff on PRs |
| `static-analysis` | `npm run verify:static` | TypeScript + ESLint |
| `build-security` | `npm run verify:build-security` | Production build + built-client credential scan |
| `unit-coverage` | `npm run verify:test` | Unit/integration suite (coverage enforcement arrives in PR 2 under this same job name) |
| `domain-invariants` | `npm run verify:invariants` | Malayalam surface-law validator |

Rules:

1. CI invokes **only** the `verify:*` scripts; every command is runnable
   locally by any peer.
2. Integrity uses the pull-request event's exact `base.sha` and compares the
   two trees directly (`git diff --check <base-sha> <head>`) — never a
   merge-base guess on a shallow clone. Push events run repo-wide marker grep
   (the PR gate already covered diffs).
3. Jobs run in parallel; each owns its own checkout. Fail-fast belongs to the
   concurrency group, not to cross-job coupling.
4. Status `Accepted`, not `Implemented`: until PR 5 makes these checks required,
   the contract exists but nothing enforces it.

## Consequences

- Adding a check = adding a named script + wiring it into exactly one job;
  anything else is scope creep for that PR.
- Renaming or repurposing a job breaks the future ruleset and is therefore an
  ADR-amending event.
- Local/CI parity is aspirational until PR 3 isolates environments: today some
  suites fail identically-but-only locally under Node 26 (documented webstorage
  class); CI's Node 24 result remains authoritative for `verify:test`.
- Later stages must not lower thresholds or hide failures to reach green
  (programme-level rule from the same review).

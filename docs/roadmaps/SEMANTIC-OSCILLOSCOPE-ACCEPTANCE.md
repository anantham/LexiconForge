# Semantic oscilloscope delivery and acceptance

Requested 2026-09-05. Source, review, CI, merge, deployment and live acceptance
are separate. Private operator records are maintained outside this repository.

## 1. Repair and review PR #160

- [x] Verify #159 merged at `655af01` and retarget #160 to main.
- [x] Merge current main without rewriting history and resolve conflicts.
- [x] Review hydrated corpus verification, streamed imports, full/quick exports,
      book/version resets, cached reopening and FMoC-only legacy fallback.
- [x] Fix all six review findings; run 68 focused tests on Node 24.19.0.
- [x] Verify TypeScript, build, integrity and fresh CI on repaired source.
- [x] Verify production offline export/reimport and cached reopening on desktop
      Chromium, Pixel 7 Chromium emulation and iPhone 13 WebKit emulation.
- [x] Correct the PR's backend dependency claims and keep its handoff public-safe.

Source repairs: `c7e3b9d`, `47f06c1`; main merge `9029313`. CI run
`33945802280` passed all five jobs and Vercel on records head `be2bcbe`.
Privacy cleanup from PR #174 is merged into this branch without rewriting history.
The combined source passes the same 68 focused tests and TypeScript; current-head CI
is linked from the PR and must pass before merge.

## 2. Recover the backend implementation

- [x] Compare the earlier unmerged implementation with current backend code.
- [x] Recover and locally test corpus hashes, pinned embedding/scoring contracts,
      capability checks and strict response validation.
- [x] Run focused backend and authorization tests (86 passing).
- [ ] Complete independent review of final recovery changes.
- [ ] Resolve backend publication prerequisites and create replacement PRs.

Backend source is recovered locally; it is not a deployed dependency. Private
commit/runtime inventories and operator release prerequisites stay in private records.

## 3. Inspect and deploy the private backend

- [x] Inspect checkout state, concurrent work, services, models and index locations.
- [ ] Verify HTTPS, owner authorization and exact-origin CORS end to end.
- [ ] Review a compatible browser connection path with existing access controls.
- [ ] Confirm exact deployment scope, reviewed commits, index destination and rollback.
- [ ] Deploy within that scope, preserving dirty/concurrent work.
- [ ] Independently verify the running version, health, authorization and routes.

## 4. Prove the complete feature

- [ ] Select the novel and translation; verify full chapter count and corpus hash.
- [ ] Build or verify a complete matching immutable index.
- [ ] Run a real owner capability check and full-book scan; record latency.
- [ ] Export its scalar graph and reopen it offline.
- [ ] Verify book and translation changes invalidate mismatched graphs.
- [ ] Exercise desktop behavior with the real backend, including unavailability.
- [ ] Exercise physical mobile admission, scan, touch/scroll and offline reopening.

Synthetic desktop/mobile-emulation checks pass. They do not prove a complete
novel scan, offline cold app launch, physical-device behavior or live scan latency.

## 5. Close the records

- [ ] Mark FEAT-006 Implemented only after live acceptance passes.
- [ ] Record merged source versions and public-safe acceptance evidence in WORKLOG;
      keep deployment identities, hostnames and operational evidence private.

The latency work remains tracked in PR #173 and its Issues.md pickup queue.

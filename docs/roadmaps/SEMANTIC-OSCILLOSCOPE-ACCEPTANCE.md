# Semantic oscilloscope delivery and acceptance

Requested 2026-09-05. Source, review, CI, merge, deployment and live acceptance
are separate. Private operator records are maintained outside this repository.

## 1. Repair and review PR #160

- [x] Verify #159 merged at `655af01` and retarget #160 to main.
- [x] Merge current main without rewriting history and resolve conflicts.
- [x] Review hydrated corpus verification, streamed imports, full/quick exports,
      book/version resets, cached reopening and removal of unverified legacy fallback.
- [x] Correct reviewed findings with storage, import-race and graph-navigation regressions; run 131 focused tests on Node 24.19.0.
- [x] Verify TypeScript, build and integrity on repaired source.
- [x] Obtain fresh CI; each corrective push runs the required checks again.
- [ ] Complete independent review of the final corrected head; the Codex reviewer reported a usage limit on the refreshed stack.
- [x] Verify production offline exported-file upload, graph navigation and cached
      reopening on desktop Chromium and Pixel 7 Chromium emulation.
- [ ] Verify native offline file upload on Safari; pinned WebKit file I/O fails
      without app code. Earlier in-memory graph restoration passed in WebKit.
- [x] Correct the PR's backend dependency claims and keep its handoff public-safe.

Earlier source repairs: `c7e3b9d`, `47f06c1`; main merge `9029313`.
The current correction addresses four further Codex findings with actual storage
round trips: normal portable version scope, nullable default selection, scoped
quick/publish/fork export and graph invalidation after chapter deletion. It also
removes a duplicate invalid IndexedDB query and prevents delayed imports from
replacing a newer reader selection. Further review corrections guard streamed and
first-batch/cache hydration and restrict graph clicks to the selected book/version.
Node 24.19.0: 131 focused tests pass. A full backup containing three corpus scopes
preserves all six chapters and navigates within the selected graph offline.
The production browser fixture now uses the ordinary portable format, without
artificial top-level scope fields. Current-head CI/review is linked from #160;
source and emulated-device checks do not close live acceptance. Pasted session URLs now use ordinary import to establish parsed scope before storage; registry imports retain progressive loading. Unscoped streaming is rejected before download or persistence. The unverified legacy loader is deleted; file, streamed and cached graph tooltips derive titles from selected reader chapters rather than global import state.

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

Synthetic desktop and Pixel file-upload checks pass. WebKit in-memory restoration
passed earlier, but native offline file I/O currently fails in the pinned browser.
These checks do not prove a complete novel scan, offline cold app launch,
physical-device behavior or live scan latency. See Issues.md 20.

## 5. Close the records

- [ ] Mark FEAT-006 Implemented only after live acceptance passes.
- [ ] Record merged source versions and public-safe acceptance evidence in WORKLOG;
      keep deployment identities, hostnames and operational evidence private.

Startup latency is tracked in PR #173, reader subscription reduction in #175,
and production QA setup in #176. Public configuration cleanup is #174. Their
Issues.md pickup queues retain deferred work and acceptance limits.

# Semantic oscilloscope delivery and acceptance

Requested by Aditya, 2026-09-05. Keep these tasks open until their evidence is
recorded; source, CI, merge, deployment, and device acceptance are separate.

## 1. Repair and review LexiconForge PR #160 — in progress

- [x] Freshly verify #159 merged: `655af01f5dfccc3376115688625eae75f9e39f54`.
- [x] Retarget #160 from `feat/codex-oscilloscope-private-client` to `main`.
- [ ] Merge current main into its published branch without rewriting history.
- [x] Resolve conflicts while preserving both sides' independent changes.
- [x] Review corpus verification, book/version changes, frozen graph import/export,
      and FMoC-only legacy fallback, including delayed completion races.
- [ ] Run focused tests on Node 24.19.0; fix findings and obtain fresh CI.
- [ ] Correct stale backend dependency and verification claims in the PR body.

Review worktree: `/private/tmp/LexiconForge.worktrees/codex-pr160-review`.
Local branch: `fix/codex-pr160-review`; publication target is the existing
`feat/codex-semantic-oscilloscope` branch and PR #160.

Local repair: merge `9029313`, Node 24.19.0 focused suite, TypeScript and production
build pass. Production Chromium verifies a synthetic two-chapter graph exported
and reimported with network offline; readable translation and invalidation pass.
This is not a real scan or an offline cold-launch test.

## 2. Recover the backend implementation

- [x] Confirm TemporalCoordination #345 and #346 are closed **unmerged**.
- [ ] Compare their exact patches with freshly fetched backend main.
- [ ] Recover only missing implementation into focused replacement PRs.
- [ ] Verify cross-language corpus hashes, embedding model/dimension contracts,
      scoring, capability checks, and strict response validation.
- [ ] Run focused backend and authorization tests; record exact reviewed heads.

## 3. Inspect and deploy on Asus

- [ ] Inspect checkout SHA, dirty work, concurrent changes, services/listeners,
      scheduled tasks, available embedding models, and existing indexes read-only.
- [ ] Verify HTTPS, existing owner/Tailscale authorization, and exact-origin CORS
      for `https://read.adityaarpitha.com`; do not replace or relax access controls.
- [ ] Present exact deployment scope, reviewed commits, affected service/config,
      data/index destination, and rollback before requesting deployment confirmation.
- [ ] Deploy only within the confirmed scope; preserve dirty/concurrent work.
- [ ] Independently verify the running version, health, authorization, and routes.

## 4. Prove the complete feature

- [ ] Record the chosen novel, translation/version, full chapter count and corpus hash.
- [ ] Build or verify one complete matching immutable index.
- [ ] Run a real owner capability check and full-book semantic scan; record latency.
- [ ] Export the resulting scalar graph with provenance and reopen it offline.
- [ ] Verify book and selected-translation changes invalidate mismatched graphs.
- [ ] Exercise desktop behavior here, including unavailable private service.
- [ ] Exercise mobile behavior; identify the exact owner-device check that cannot
      be performed from this workstation and retain it as pending until observed.

## 5. Close the records

- [ ] Mark FEAT-006 Implemented only after its required live acceptance passes.
- [ ] Record merged commits, deployed versions, corpus/index identity, test evidence,
      scan latency, desktop/mobile results, and remaining limitations in WORKLOG.

## Boundaries and related work

The user authorized repairing/publishing #160, recovering reviewable backend PRs,
and read-only Asus inspection. Deployment scope still requires confirmation.
No novel/index or mobile result is assumed. No paid/external embedding fallback.

The deletion-first latency work remains tracked in PR #173 and its Issues.md
pickup queue. The reader deep-link diagnostic branch has no source changes;
that investigation is queued behind this explicitly requested feature repair.

# Semantic oscilloscope delivery and acceptance

Requested by Aditya, 2026-09-05. Keep these tasks open until their evidence is
recorded; source, CI, merge, deployment, and device acceptance are separate.

## 1. Repair and review LexiconForge PR #160 — source repair complete

- [x] Freshly verify #159 merged: `655af01f5dfccc3376115688625eae75f9e39f54`.
- [x] Retarget #160 from `feat/codex-oscilloscope-private-client` to `main`.
- [x] Merge current main into its published branch without rewriting history.
- [x] Resolve conflicts while preserving both sides' independent changes.
- [x] Review corpus verification, book/version changes, frozen graph import/export,
      and FMoC-only legacy fallback, including delayed completion races.
- [x] Run focused tests on Node 24.19.0; fix findings and obtain fresh CI.
- [x] Correct stale backend dependency and verification claims in the PR body.

Review worktree: `/private/tmp/LexiconForge.worktrees/codex-pr160-review`.
Local branch: `fix/codex-pr160-review`; publication target is the existing
`feat/codex-semantic-oscilloscope` branch and PR #160.

Local repair: merge `9029313`, Node 24.19.0 focused suite, TypeScript and production
build pass. Production Chromium verifies a synthetic two-chapter graph exported
and reimported with network offline; readable translation and invalidation pass.
Fresh CI on `c7e3b9d`: all five jobs and Vercel passed (run `33942600655`).
Review follow-up `47f06c1` adds multi-book backup scoping and verified cached graph
reopening; 68 focused tests pass. All five fresh CI jobs and Vercel pass on that
source (run `33943265818`). Production offline flows pass on desktop Chromium,
Pixel 7 Chromium emulation and iPhone 13 WebKit emulation. This is not a real scan or offline cold-launch test.

## 2. Recover the backend implementation

- [x] Confirm TemporalCoordination #345 and #346 are closed **unmerged**.
- [x] Compare their exact patches with freshly fetched backend main.
- [ ] Recover only missing implementation into focused replacement PRs.
- [x] Verify cross-language corpus hashes, embedding model/dimension contracts,
      scoring, capability checks, and strict response validation.
- [ ] Run focused backend and authorization tests; record exact reviewed heads.

Local index recovery: `56087e8b`, branch `feat/codex-recover-semantic-index`.
Local API recovery: `0399fc32`, branch `feat/codex-recover-semantic-api`.
Python 3.9.6 focused gate: 86/86; ruff and builder help pass. The index received
independent tools-off MiMo review; its scoring correction and the API still need
independent review. Automatic approval review rejected the follow-up packet;
explicit task-wide review authorization is pending. No backend branch was pushed:
GitHub reports `anantham/TemporalCoordination` archived and rejected push/PR creation.
A writable publication target is required. Local patches: `/private/tmp/semantic-recovery/`.

## 3. Inspect and deploy on Asus

- [ ] Inspect checkout SHA, dirty work, concurrent changes, services/listeners,
      scheduled tasks, available embedding models, and existing indexes read-only.
- [ ] Verify HTTPS, existing owner/Tailscale authorization, and exact-origin CORS
      for `https://read.adityaarpitha.com`; do not replace or relax access controls.
- [ ] Present exact deployment scope, reviewed commits, affected service/config,
      data/index destination, and rollback before requesting deployment confirmation.
- [ ] Deploy only within the confirmed scope; preserve dirty/concurrent work.
- [ ] Independently verify the running version, health, authorization, and routes.

Read-only snapshot: Asus `55ddc94a`, branch `codex/runtime-contention-option-b`,
144 tracked modifications preserved. HTTPS and protected owner JSON route respond.
Reader-origin CORS preflight succeeds; unrelated origin is rejected. No semantic
module/index at the inspected default path. M5 inventories both Qwen3 8B and 0.6B.
No model or service was started. Current Asus lacks main's CSRF module.

**Deployment blocker:** current backend main requires paired browser CSRF proof
with a Strict same-site cookie. The public reader omits credentials/proof; cross-site
cookies cannot solve this unchanged. An approved compatible browser path and exact
isolated deployment plan are required. Do not disable CSRF or publish an owner token.

## 4. Prove the complete feature

- [ ] Record the chosen novel, translation/version, full chapter count and corpus hash.
- [ ] Build or verify one complete matching immutable index.
- [ ] Run a real owner capability check and full-book semantic scan; record latency.
- [ ] Export the resulting scalar graph with provenance and reopen it offline.
- [ ] Verify book and selected-translation changes invalidate mismatched graphs.
- [ ] Exercise desktop behavior here, including unavailable private service.
- [ ] Exercise mobile behavior; identify the exact owner-device check that cannot
      be performed from this workstation and retain it as pending until observed.

Synthetic desktop and Android/iPhone emulator offline checks passed. Real private
scan, cold offline app launch and physical owner device checks remain pending.
The physical check must cover Tailscale/HTTPS admission, the selected scan connection
path, graph touch/scroll behavior and reopening the exported graph offline.
Published candidate metadata: FMoC `v1-st-enhanced` has 3521 raw / 3273 translated
chapters; Dungeon Defense `v1-primary` has 509 raw / 283 translated. Both translations
are marked In Progress. Verify actual artifact completeness and selected-text fallback
counts before choosing or claiming a complete translation index.

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

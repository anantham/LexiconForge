# CORE-015 — Exact-Head Cross-Family PR Review Gate

**Status:** Accepted; implementation proposed in this PR, ruleset activation pending

**Date:** 2026-08-25

**Group:** Infrastructure / review integrity

## Issue

LexiconForge already calls for cross-model review in selected sacred-text work,
but the instruction is scoped, prose-only, and cannot distinguish current-head
approval from stale or self-authored evidence. A provider outage, incomplete
response, or green CI job can therefore be mistaken for independent approval.

The repository needs one review contract for every PR that preserves the human
gate, excludes conflicts of interest, binds evidence to the exact current head,
and fails closed without running untrusted PR code in a privileged workflow.

## Assumptions

- Agent-prefixed branches usually identify their principal AI author family.
- A trusted repository collaborator can faithfully submit an external model's
  review output as a formal GitHub PR review.
- GitHub repository rulesets can require a named commit-status context.
- Model-provider identity is process metadata, not cryptographic attestation.

## Constraints

- Private diffs may leave the repository only with explicit user authorization.
- Same-family sessions do not count as independent review.
- Any material repair makes that model family an author for the new head.
- The gate must not check out or execute attacker-controlled PR code with a
  privileged `pull_request_target` token.
- Reviewer refusal, quota, timeout, partial output, network failure, or missing
  verdict must not turn green.
- AI review does not replace sacred-text, privacy, identity, security, release,
  or other human/domain gates.

## Positions considered

### A. Standing prose instruction only

Low effort and easy to reverse, but it can be skipped, cannot reject stale
evidence, and offers no branch-protection signal.

### B. Commit a receipt inside the reviewed PR

Easy for ordinary CI to read, but committing the receipt changes the PR head.
The receipt can never bind to the commit containing itself without inventing a
weaker tree-exclusion rule. This position was rejected as structurally stale.

### C. Formal PR review receipt plus exact-head commit status — selected

A trusted collaborator submits the external review as a formal GitHub review.
The receipt and GitHub review object both name the current head. A workflow
running trusted default-branch code evaluates reviews and writes a dedicated
status directly onto that head.

This adds ceremony and depends on honest provenance metadata, but makes stale,
same-family, failed, and revise evidence mechanically visible and blockable.

### D. Invoke a fixed external reviewer automatically in CI

Strong automation, but requires provider credentials, transmits every private
diff without a per-use privacy decision, creates unbounded cost/availability
coupling, and fails when that fixed provider authored the PR. Rejected.

## Decision

Adopt position C with these invariants:

1. Every PR declares all human/AI author families, inferred from standard branch
   prefixes when unambiguous and explicit in the PR body otherwise.
2. The reviewer family must be absent from every family that authored or
   materially repaired the current head.
3. The formal review receipt and GitHub `commit_id` must both equal the PR's
   exact current 40-character head SHA.
4. Only a trusted `OWNER`, `MEMBER`, or `COLLABORATOR` review with status
   `completed`, verdict `APPROVE`, and zero blocking findings passes.
5. A metadata-only receipt cannot pass: visible adversarial evidence and its
   final verdict must agree with both the receipt and GitHub review state.
6. The newest admissible review for a head controls. A later `REVISE` overrides
   an earlier approval; a later completed approval may supersede a prior revise
   on the same unchanged head.
7. Missing, malformed, stale, same-family, failed, inconclusive, or revise
   evidence fails closed with descriptive diagnostics.
8. The workflow posts `pending` before fetching reviews, then writes `success`,
   `failure`, or `error` to `cross-family-adversarial-review` on the exact head.
9. The privileged workflow checks out only the default branch and never executes
   PR code.
10. Repository rulesets must require the named status before this mechanism is
   described as enforced.

## Consequences

- Any new commit invalidates approval automatically because it has a new SHA.
- Mixed-family repairs may require a third family for final review.
- Tool availability can block a merge; the fallback is another non-author
  family or waiting, never lowering the gate silently.
- Trusted collaborators remain accountable for receipt provenance because the
  mechanism cannot cryptographically prove which model produced pasted text.
- The existing five CORE-013 test jobs remain unchanged. This is a separate
  event controller and commit-status contract, not a sixth test job.
- Fork PR behavior must be verified during rollout; if GitHub refuses status
  writes to fork-network commits, enforcement remains blocked until a Check Run
  implementation is reviewed.

## Implementation notes

- `scripts/ci/cross-family-review-gate.mjs` parses authorship and review receipts,
  fetches paginated formal reviews, evaluates the gate, and posts head status.
- `.github/workflows/cross-family-review.yml` supplies the trusted event and
  least-privilege boundary.
- `tests/scripts/ci/crossFamilyReviewGate.test.mjs` proves positive and negative
  paths, including stale SHA, same-family, untrusted, malformed, failed,
  inconclusive, and revise evidence.
- `docs/guides/CROSS_FAMILY_PR_REVIEWS.md` defines the operator contract and
  receipt format.
- `AGENTS.md` makes the gate a standing instruction for every PR.

## Activation and after-action review

1. Independently review and merge this implementation PR under the manual form
   of this policy.
2. Verify the workflow posts failure on a test PR with no receipt and success
   only after an exact-head cross-family approval.
3. Enable the repository ruleset requiring
   `cross-family-adversarial-review`.
4. Revisit after one month: count blocked stale/self reviews, reviewer outages,
   false blocks, average review latency/cost, and any provenance disputes.

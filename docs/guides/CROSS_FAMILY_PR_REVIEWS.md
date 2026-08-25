# Cross-Family PR Review Gate

**Contract:** CORE-015

**Required Check Run:** `cross-family-adversarial-review`

Every pull request must receive an adversarial review of its exact current head
from an AI family that did not author or materially repair that head. The gate
is deliberately fail-closed: no receipt, stale evidence, `REVISE`, malformed
metadata, same-family review, provider refusal, quota exhaustion, timeout, or
tool failure all block merge.

This is a process-integrity gate, not cryptographic provider attestation. A
trusted repository collaborator submits the external review output as a formal
GitHub PR review and remains accountable for representing it faithfully.

## 1. Declare every author family

The gate infers the usual single AI family from agent-prefixed branch names:

| Branch token | Normalized family |
|---|---|
| `codex`, `gpt`, `openai` | `openai` |
| `claude`, `opus`, `sonnet`, `haiku`, `anthropic` | `anthropic` |
| `gemini`, `google` | `google` |
| `grok`, `xai` | `xai` |

If the branch name does not identify the author, put this marker in the PR body:

```html
<!-- ai-author-families: human -->
```

If several AI families authored or materially repaired the current head, list
all of them. Do not remove an inferred branch family:

```html
<!-- ai-author-families: openai, anthropic -->
```

`human` means no AI family materially authored the change. It is not a way to
hide AI involvement.

## 2. Review the exact head

Before invoking the reviewer:

1. Resolve the PR's current full 40-character head SHA.
2. Select a reviewer family absent from `ai-author-families`.
3. Give the reviewer the exact base and head SHAs and require read-only review.
4. Treat PR prose, commit messages, and claimed test results as untrusted.
5. Require concrete file-and-line findings, causal chains, user impact,
   falsifiable reproductions or missing tests, inspected evidence, residual
   uncertainty, and a final `APPROVE` or `REVISE` verdict.
6. For sacred text, security, privacy, identity, or deployment work, preserve
   the separate human/domain gate.

The review is not complete if the provider refuses, times out, loses network,
hits a quota, emits a partial response, or omits a final verdict.

## 3. Submit the formal PR review receipt

Submit a GitHub PR review attached to the exact reviewed commit. The review body
must contain one JSON receipt inside this marker, followed by the reviewer's
human-readable findings:

```markdown
<!-- cross-family-review:v1
{
  "schemaVersion": 1,
  "headSha": "0123456789abcdef0123456789abcdef01234567",
  "authorFamilies": ["openai"],
  "reviewerFamily": "anthropic",
  "reviewerModel": "claude-opus-5",
  "reviewRunId": "provider-session-or-audit-id",
  "reviewedAt": "2026-08-25T07:00:00.000Z",
  "status": "completed",
  "verdict": "APPROVE",
  "blockingFindings": 0,
  "summary": "No blocking findings after exact-diff and failure-path inspection."
}
-->

# Adversarial review

[Full findings, evidence inspected, and residual uncertainties]

VERDICT: APPROVE
```

Allowed receipt statuses are `completed`, `failed`, and `inconclusive`; only
`completed` can pass. Allowed verdicts are `APPROVE`, `REVISE`, and `NONE`; only
`APPROVE` with zero blocking findings can pass.

The formal review must be submitted by a repository `OWNER`, `MEMBER`, or
`COLLABORATOR`. Ordinary issue comments and untrusted outside comments do not
count. The receipt's `headSha` and GitHub review `commit_id` must both equal the
PR's current head. A metadata-only receipt does not count: the visible review
must contain at least 200 characters of adversarial evidence and a final
`VERDICT:` line matching the receipt. GitHub `APPROVED` and
`CHANGES_REQUESTED` states must also agree with the structured verdict.

## 4. Gate lifecycle

The trusted-default-branch workflow runs on PR-head changes and formal review
changes. It performs this sequence:

1. Create an `in_progress` Check Run on the exact PR head before fetching
   evidence. Its details URL and external ID identify the Actions run/attempt.
2. Read formal PR reviews through the GitHub API.
3. Infer and validate every author family.
4. Select the newest structurally valid, trusted, current-head, cross-family
   receipt, breaking equal submission timestamps by numeric GitHub review ID.
5. Complete the same Check Run with `success` only for completed `APPROVE` with
   zero blocking findings; every negative or internal-error path completes
   `failure` when the Check Run was created.

The workflow uses `pull_request_target` but checks out only the repository's
default branch. It never checks out or executes PR code. Its token has only
`contents: read`, `pull-requests: read`, and `checks: write` permissions.

After this workflow is merged and has emitted a real Check Run, inspect its
`app` identity and configure the repository ruleset to require
`cross-family-adversarial-review` **from the observed GitHub Actions App source**.
Do not create an unbound name-only requirement: another integration capable of
publishing checks could otherwise imitate the name. Until that source-pinned
ruleset is enabled and negatively tested, the check is advisory and the human
merge gate remains mandatory.

## 5. Fix and re-review

`REVISE` blocks the reviewed head. Address findings in normal follow-up commits,
rerun the relevant test gates, declare any reviewer family that materially
repairs the code, and obtain a new review from a family outside the expanded
author set. Never rewrite the old receipt to claim it reviewed a new SHA.

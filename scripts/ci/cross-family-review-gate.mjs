#!/usr/bin/env node
/**
 * Fail-closed cross-family PR review gate (CORE-015).
 *
 * The workflow runs this file from the trusted default branch. It never checks
 * out or executes pull-request code. A formal PR review contains a structured
 * receipt bound to both the current head SHA and the GitHub review commit.
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const REVIEW_MARKER = 'cross-family-review:v1';
export const CHECK_NAME = 'cross-family-adversarial-review';

const FAMILY_ALIASES = new Map([
  ['human', 'human'],
  ['openai', 'openai'],
  ['codex', 'openai'],
  ['gpt', 'openai'],
  ['anthropic', 'anthropic'],
  ['claude', 'anthropic'],
  ['opus', 'anthropic'],
  ['sonnet', 'anthropic'],
  ['haiku', 'anthropic'],
  ['google', 'google'],
  ['gemini', 'google'],
  ['xai', 'xai'],
  ['grok', 'xai'],
]);
const TRUSTED_ASSOCIATIONS = new Set(['OWNER', 'MEMBER', 'COLLABORATOR']);
const SHA_PATTERN = /^[0-9a-f]{40}$/;
const AUTHOR_MARKER = /<!--\s*ai-author-families:\s*([^>]+?)\s*-->/gi;
const RECEIPT_PATTERN = /<!--\s*cross-family-review:v1\s*([\s\S]*?)-->/gi;

const uniqueSorted = (values) => [...new Set(values)].sort();
const sameValues = (a, b) => JSON.stringify(uniqueSorted(a)) === JSON.stringify(uniqueSorted(b));

function numericReviewId(value) {
  const text = String(value ?? '');
  return /^\d+$/.test(text) ? BigInt(text) : null;
}

export function compareReviewCandidates(a, b) {
  const timestampDelta = Date.parse(a.review.submitted_at) - Date.parse(b.review.submitted_at);
  if (timestampDelta !== 0) return timestampDelta;
  const aId = numericReviewId(a.review.id);
  const bId = numericReviewId(b.review.id);
  if (aId === bId) return 0;
  if (aId === null) return -1;
  if (bId === null) return 1;
  return aId < bId ? -1 : 1;
}

export function normalizeFamily(value) {
  return FAMILY_ALIASES.get(String(value ?? '').trim().toLowerCase()) ?? null;
}

export function inferBranchFamily(headRef) {
  const tokens = String(headRef ?? '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  return tokens.map(normalizeFamily).find((family) => family && family !== 'human') ?? null;
}

export function resolveAuthorFamilies(pr) {
  const declared = [];
  for (const match of String(pr.body ?? '').matchAll(AUTHOR_MARKER)) {
    declared.push(...match[1].split(',').map(normalizeFamily));
  }
  if (declared.some((family) => !family)) {
    return { families: [], error: 'PR author-family marker contains an unknown family.' };
  }

  const explicit = uniqueSorted(declared.filter(Boolean));
  const inferred = inferBranchFamily(pr.head?.ref);
  if (explicit.length && inferred && !explicit.includes(inferred)) {
    return {
      families: [],
      error: `PR author-family marker omits branch-inferred family ${inferred}.`,
    };
  }
  if (explicit.length) return { families: explicit, error: null };
  if (inferred) return { families: [inferred], error: null };
  return {
    families: [],
    error: 'Cannot infer AI authorship. Add <!-- ai-author-families: human|openai|anthropic|google|xai --> to the PR body.',
  };
}

export function parseReviewReceipts(reviews) {
  const parsed = [];
  for (const review of reviews) {
    const body = String(review.body ?? '');
    for (const match of body.matchAll(RECEIPT_PATTERN)) {
      try {
        parsed.push({ review, receipt: JSON.parse(match[1].trim()), parseError: null });
      } catch (error) {
        parsed.push({ review, receipt: null, parseError: `Review ${review.id}: invalid receipt JSON (${error.message}).` });
      }
    }
  }
  return parsed;
}

function validateCandidate(entry, headSha, authorFamilies) {
  const { review, receipt } = entry;
  const problems = [];
  const reviewState = String(review.state ?? '').toUpperCase();
  const visibleReview = String(review.body ?? '').replace(RECEIPT_PATTERN, '').trim();
  const visibleVerdicts = [...visibleReview.matchAll(/\bVERDICT:\s*(APPROVE|REVISE|NONE)\b/gi)];
  const visibleVerdict = visibleVerdicts.at(-1)?.[1]?.toUpperCase();
  const reviewerFamily = normalizeFamily(receipt?.reviewerFamily);
  const receiptAuthors = Array.isArray(receipt?.authorFamilies)
    ? receipt.authorFamilies.map(normalizeFamily)
    : [];

  if (receipt?.schemaVersion !== 1) problems.push('schemaVersion must be 1');
  if (review.state === 'DISMISSED') problems.push('GitHub review has been dismissed');
  if (!['COMMENTED', 'APPROVED', 'CHANGES_REQUESTED'].includes(reviewState)) {
    problems.push('GitHub review state is not submitted');
  }
  if (numericReviewId(review.id) === null) problems.push('GitHub review has no valid numeric id');
  if (!Number.isFinite(Date.parse(review.submitted_at))) problems.push('GitHub review has no valid submission time');
  if (receipt?.headSha !== headSha) problems.push('receipt headSha is stale');
  if (review.commit_id !== headSha) problems.push('GitHub review is attached to a stale commit');
  if (!receiptAuthors.length || receiptAuthors.some((family) => !family)) {
    problems.push('authorFamilies must contain known families');
  } else if (!sameValues(receiptAuthors, authorFamilies)) {
    problems.push('authorFamilies do not match the PR authorship declaration');
  }
  if (!reviewerFamily || reviewerFamily === 'human') {
    problems.push('reviewerFamily must name a known AI family');
  } else if (authorFamilies.includes(reviewerFamily)) {
    problems.push(`reviewer family ${reviewerFamily} also authored or repaired this head`);
  }
  if (!String(receipt?.reviewerModel ?? '').trim()) problems.push('reviewerModel is required');
  if (!String(receipt?.reviewRunId ?? '').trim()) problems.push('reviewRunId is required');
  if (!String(receipt?.summary ?? '').trim() || String(receipt.summary).trim().length < 20) {
    problems.push('summary must contain at least 20 characters');
  }
  if (visibleReview.length < 200) problems.push('visible adversarial review must contain at least 200 characters');
  if (visibleVerdict !== receipt?.verdict) problems.push('visible VERDICT does not match the receipt');
  if (!Number.isInteger(receipt?.blockingFindings) || receipt.blockingFindings < 0) {
    problems.push('blockingFindings must be a non-negative integer');
  }
  if (!['completed', 'failed', 'inconclusive'].includes(receipt?.status)) {
    problems.push('status must be completed, failed, or inconclusive');
  }
  if (!['APPROVE', 'REVISE', 'NONE'].includes(receipt?.verdict)) {
    problems.push('verdict must be APPROVE, REVISE, or NONE');
  }
  if (!Number.isFinite(Date.parse(receipt?.reviewedAt))) problems.push('reviewedAt must be an ISO timestamp');
  if (receipt?.status === 'completed' && receipt?.verdict === 'APPROVE' && receipt?.blockingFindings !== 0) {
    problems.push('APPROVE cannot carry blocking findings');
  }
  if (reviewState === 'APPROVED' && receipt?.verdict !== 'APPROVE') {
    problems.push('GitHub APPROVED state conflicts with receipt verdict');
  }
  if (reviewState === 'CHANGES_REQUESTED' && receipt?.verdict !== 'REVISE') {
    problems.push('GitHub CHANGES_REQUESTED state conflicts with receipt verdict');
  }
  return { problems, reviewerFamily };
}

export function evaluateReviewGate({ pr, reviews }) {
  const headSha = String(pr?.head?.sha ?? '').toLowerCase();
  const failures = [];
  if (!SHA_PATTERN.test(headSha)) failures.push('PR head SHA is missing or malformed.');

  const authorship = resolveAuthorFamilies(pr ?? {});
  if (authorship.error) failures.push(authorship.error);
  const authorFamilies = authorship.families;
  const entries = parseReviewReceipts(reviews ?? []);
  const malformed = entries.filter((entry) => entry.parseError && TRUSTED_ASSOCIATIONS.has(entry.review.author_association));
  const candidates = entries
    .filter((entry) => entry.receipt && TRUSTED_ASSOCIATIONS.has(entry.review.author_association))
    .filter((entry) => entry.receipt.headSha === headSha || entry.review.commit_id === headSha)
    .map((entry) => ({ ...entry, ...validateCandidate(entry, headSha, authorFamilies) }))
    .filter((entry) => entry.problems.length === 0)
    .sort(compareReviewCandidates);

  if (!candidates.length) {
    failures.push('No trusted, structurally valid cross-family receipt exists for the current head.');
    failures.push(...malformed.map((entry) => entry.parseError));
  } else {
    const latest = candidates.at(-1);
    if (latest.receipt.status !== 'completed') {
      failures.push(`Latest review status is ${latest.receipt.status}, not completed.`);
    }
    if (latest.receipt.verdict !== 'APPROVE') {
      failures.push(`Latest review verdict is ${latest.receipt.verdict}, not APPROVE.`);
    }
    if (latest.receipt.blockingFindings !== 0) {
      failures.push(`Latest review has ${latest.receipt.blockingFindings} blocking finding(s).`);
    }
  }

  return {
    ok: failures.length === 0,
    headSha,
    authorFamilies,
    acceptedReceipt: candidates.at(-1)?.receipt ?? null,
    failures,
    diagnostics: {
      reviewsSeen: reviews?.length ?? 0,
      receiptsSeen: entries.length,
      trustedCurrentCandidates: candidates.length,
    },
  };
}

async function githubRequest(path, token, options = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...options.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`GitHub ${options.method ?? 'GET'} ${path} failed: ${response.status} ${await response.text()}`);
  }
  return response.status === 204 ? null : response.json();
}

async function fetchAllReviews(repository, prNumber, token) {
  const reviews = [];
  for (let page = 1; page <= 10; page += 1) {
    const batch = await githubRequest(`/repos/${repository}/pulls/${prNumber}/reviews?per_page=100&page=${page}`, token);
    reviews.push(...batch);
    if (batch.length < 100) return reviews;
  }
  throw new Error('Review pagination exceeded 1,000 entries; refusing a partial gate decision.');
}

function actionsRunMetadata(repository, overrides = {}) {
  const serverUrl = overrides.serverUrl ?? process.env.GITHUB_SERVER_URL ?? 'https://github.com';
  const runId = String(overrides.runId ?? process.env.GITHUB_RUN_ID ?? '').trim();
  const runAttempt = String(overrides.runAttempt ?? process.env.GITHUB_RUN_ATTEMPT ?? '1').trim();
  if (!runId) throw new Error('GITHUB_RUN_ID is required to bind the Check Run to its Actions run.');
  return {
    detailsUrl: `${serverUrl}/${repository}/actions/runs/${runId}`,
    externalId: `${CHECK_NAME}:${runId}:${runAttempt}`,
  };
}

export async function createReviewCheckRun(repository, headSha, token, overrides = {}) {
  const metadata = actionsRunMetadata(repository, overrides);
  const created = await githubRequest(`/repos/${repository}/check-runs`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: CHECK_NAME,
      head_sha: headSha,
      status: 'in_progress',
      details_url: metadata.detailsUrl,
      external_id: metadata.externalId,
      output: {
        title: 'Cross-family review pending',
        summary: 'Checking exact-head, trusted, cross-family adversarial-review evidence.',
      },
    }),
  });
  if (numericReviewId(created?.id) === null) {
    throw new Error('GitHub created a Check Run without a valid numeric id; refusing an untrackable result.');
  }
  return created.id;
}

export async function completeReviewCheckRun(
  repository,
  checkRunId,
  token,
  conclusion,
  title,
  summary,
  overrides = {}
) {
  if (!['success', 'failure'].includes(conclusion)) {
    throw new Error(`Unsupported Check Run conclusion: ${conclusion}`);
  }
  await githubRequest(`/repos/${repository}/check-runs/${checkRunId}`, token, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'completed',
      conclusion,
      completed_at: overrides.completedAt ?? new Date().toISOString(),
      output: {
        title: String(title).slice(0, 255),
        summary: String(summary).slice(0, 6000),
      },
    }),
  });
}

async function runCli() {
  const fixturePath = process.env.REVIEW_GATE_FIXTURE_PATH;
  if (fixturePath) {
    const result = evaluateReviewGate(JSON.parse(readFileSync(fixturePath, 'utf8')));
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.ok ? 0 : 1;
    return;
  }

  const repository = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!repository || !token || !eventPath) {
    throw new Error('GITHUB_REPOSITORY, GITHUB_TOKEN, and GITHUB_EVENT_PATH are required.');
  }
  const event = JSON.parse(readFileSync(eventPath, 'utf8'));
  const pr = event.pull_request;
  if (!pr?.number || !SHA_PATTERN.test(String(pr.head?.sha ?? '').toLowerCase())) {
    throw new Error('Workflow event does not contain a pull request number and exact head SHA.');
  }

  const headSha = pr.head.sha.toLowerCase();
  let checkRunId = null;
  try {
    checkRunId = await createReviewCheckRun(repository, headSha, token);
    const reviews = await fetchAllReviews(repository, pr.number, token);
    const result = evaluateReviewGate({ pr, reviews });
    console.log(JSON.stringify(result, null, 2));
    await completeReviewCheckRun(
      repository,
      checkRunId,
      token,
      result.ok ? 'success' : 'failure',
      result.ok ? 'Independent cross-family review approved' : 'Cross-family review blocked',
      result.ok
        ? `A trusted independent reviewer approved exact head ${headSha}.`
        : result.failures.join('\n'),
    );
    process.exitCode = result.ok ? 0 : 1;
  } catch (error) {
    console.error(`cross-family review gate failed: ${error.stack ?? error.message}`);
    if (checkRunId !== null) {
      try {
        await completeReviewCheckRun(
          repository,
          checkRunId,
          token,
          'failure',
          'Cross-family review gate errored',
          `The gate failed before it could establish approval: ${error.message}`,
        );
      } catch (completionError) {
        console.error(`could not complete failed Check Run ${checkRunId}: ${completionError.stack ?? completionError.message}`);
      }
    }
    process.exitCode = 1;
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  runCli().catch((error) => {
    console.error(`cross-family review gate could not start: ${error.stack ?? error.message}`);
    process.exitCode = 1;
  });
}

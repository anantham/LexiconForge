import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  completeReviewCheckRun,
  createReviewCheckRun,
  evaluateReviewGate,
  inferBranchFamily,
  parseReviewReceipts,
  resolveAuthorFamilies,
} from '../../../scripts/ci/cross-family-review-gate.mjs';

afterEach(() => {
  vi.unstubAllGlobals();
});

const HEAD = 'a'.repeat(40);
const OLD_HEAD = 'b'.repeat(40);

const receipt = (overrides = {}) => ({
  schemaVersion: 1,
  headSha: HEAD,
  authorFamilies: ['openai'],
  reviewerFamily: 'anthropic',
  reviewerModel: 'claude-opus-5',
  reviewRunId: 'review-session-123',
  reviewedAt: '2026-08-25T06:30:00.000Z',
  status: 'completed',
  verdict: 'APPROVE',
  blockingFindings: 0,
  summary: 'No blocking findings after inspecting the exact diff and failure paths.',
  ...overrides,
});

const review = (value = receipt(), overrides = {}) => ({
  id: 10,
  body: `<!-- cross-family-review:v1\n${JSON.stringify(value)}\n-->

# Adversarial review

I inspected the complete exact-base to exact-head diff, the relevant call sites,
the failure paths, and the tests. The implementation preserves the documented
boundary under the reviewed fixtures. Residual uncertainty: live GitHub status
delivery is verified only after the trusted workflow reaches the default branch.

VERDICT: ${value.verdict}`,
  commit_id: HEAD,
  author_association: 'OWNER',
  submitted_at: '2026-08-25T06:31:00.000Z',
  state: 'COMMENTED',
  ...overrides,
});

const pr = (overrides = {}) => ({
  number: 161,
  body: '',
  head: { sha: HEAD, ref: 'fix/codex-exact-head-gate' },
  ...overrides,
});

describe('cross-family review gate', () => {
  it('accepts a trusted exact-head review from a different AI family', () => {
    const result = evaluateReviewGate({ pr: pr(), reviews: [review()] });
    expect(result.ok).toBe(true);
    expect(result.authorFamilies).toEqual(['openai']);
    expect(result.acceptedReceipt?.reviewerFamily).toBe('anthropic');
  });

  it.each([
    ['missing receipt', [], 'No trusted'],
    ['stale receipt SHA', [review(receipt({ headSha: OLD_HEAD }))], 'No trusted'],
    ['stale GitHub review commit', [review(receipt(), { commit_id: OLD_HEAD })], 'No trusted'],
    ['untrusted commenter', [review(receipt(), { author_association: 'CONTRIBUTOR' })], 'No trusted'],
    ['dismissed review', [review(receipt(), { state: 'DISMISSED' })], 'No trusted'],
    ['unsubmitted review', [review(receipt(), { submitted_at: null })], 'No trusted'],
    ['same-family reviewer', [review(receipt({ reviewerFamily: 'codex' }))], 'No trusted'],
    ['failed reviewer', [review(receipt({ status: 'failed', verdict: 'NONE' }))], 'status is failed'],
    ['inconclusive reviewer', [review(receipt({ status: 'inconclusive', verdict: 'NONE' }))], 'status is inconclusive'],
    ['revise verdict', [review(receipt({ verdict: 'REVISE', blockingFindings: 2 }))], 'verdict is REVISE'],
  ])('fails closed for %s', (_name, reviews, message) => {
    const result = evaluateReviewGate({ pr: pr(), reviews });
    expect(result.ok).toBe(false);
    expect(result.failures.join(' ')).toContain(message);
  });

  it('rejects an internally inconsistent approval', () => {
    const result = evaluateReviewGate({
      pr: pr(),
      reviews: [review(receipt({ verdict: 'APPROVE', blockingFindings: 1 }))],
    });
    expect(result.ok).toBe(false);
    expect(result.failures).toContain('No trusted, structurally valid cross-family receipt exists for the current head.');
  });

  it('rejects a receipt with no visible adversarial review', () => {
    const value = receipt();
    const result = evaluateReviewGate({
      pr: pr(),
      reviews: [review(value, {
        body: `<!-- cross-family-review:v1\n${JSON.stringify(value)}\n-->`,
      })],
    });
    expect(result.ok).toBe(false);
    expect(result.failures).toContain('No trusted, structurally valid cross-family receipt exists for the current head.');
  });

  it('rejects a visible verdict that contradicts the receipt', () => {
    const contradictory = review(receipt(), {
      body: `${review().body.replace('VERDICT: APPROVE', 'VERDICT: REVISE')}`,
    });
    expect(evaluateReviewGate({ pr: pr(), reviews: [contradictory] }).ok).toBe(false);
  });

  it('rejects a GitHub review state that contradicts the receipt', () => {
    const result = evaluateReviewGate({
      pr: pr(),
      reviews: [review(receipt(), { state: 'CHANGES_REQUESTED' })],
    });
    expect(result.ok).toBe(false);
  });

  it('lets a later approval supersede an earlier revise on the same unchanged head', () => {
    const revise = review(receipt({ verdict: 'REVISE', blockingFindings: 1 }), {
      id: 10,
      submitted_at: '2026-08-25T06:31:00.000Z',
    });
    const approve = review(receipt(), {
      id: 11,
      submitted_at: '2026-08-25T06:40:00.000Z',
    });
    expect(evaluateReviewGate({ pr: pr(), reviews: [revise, approve] }).ok).toBe(true);
  });

  it('makes a later revise override an earlier approval on the same head', () => {
    const approve = review(receipt(), {
      id: 10,
      submitted_at: '2026-08-25T06:31:00.000Z',
    });
    const revise = review(receipt({ verdict: 'REVISE', blockingFindings: 1 }), {
      id: 11,
      submitted_at: '2026-08-25T06:40:00.000Z',
    });
    const result = evaluateReviewGate({ pr: pr(), reviews: [approve, revise] });
    expect(result.ok).toBe(false);
    expect(result.failures).toContain('Latest review verdict is REVISE, not APPROVE.');
  });

  it('uses numeric review ID as the deterministic same-timestamp tie-breaker', () => {
    const submittedAt = '2026-08-25T06:40:00.000Z';
    const approve = review(receipt(), {
      id: '9007199254740993',
      submitted_at: submittedAt,
    });
    const revise = review(receipt({ verdict: 'REVISE', blockingFindings: 1 }), {
      id: '9007199254740994',
      submitted_at: submittedAt,
    });

    const result = evaluateReviewGate({ pr: pr(), reviews: [revise, approve] });
    expect(result.ok).toBe(false);
    expect(result.failures).toContain('Latest review verdict is REVISE, not APPROVE.');
  });

  it('fails loudly on malformed trusted receipt JSON', () => {
    const malformed = review(receipt(), {
      body: '<!-- cross-family-review:v1\n{"schemaVersion":\n-->',
    });
    const result = evaluateReviewGate({ pr: pr(), reviews: [malformed] });
    expect(result.ok).toBe(false);
    expect(result.failures.join(' ')).toContain('invalid receipt JSON');
  });

  it('requires explicit authorship when the branch family is unknown', () => {
    const result = evaluateReviewGate({
      pr: pr({ head: { sha: HEAD, ref: 'fix/human-readable-name' } }),
      reviews: [review(receipt({ authorFamilies: ['human'] }))],
    });
    expect(result.ok).toBe(false);
    expect(result.failures.join(' ')).toContain('Cannot infer AI authorship');
  });

  it('accepts explicit human authorship and a known AI reviewer', () => {
    const humanPr = pr({
      body: '<!-- ai-author-families: human -->',
      head: { sha: HEAD, ref: 'fix/human-readable-name' },
    });
    const result = evaluateReviewGate({
      pr: humanPr,
      reviews: [review(receipt({ authorFamilies: ['human'] }))],
    });
    expect(result.ok).toBe(true);
  });

  it('requires every materially involved family to be declared', () => {
    const mixedPr = pr({ body: '<!-- ai-author-families: openai, anthropic -->' });
    const googleReview = review(receipt({
      authorFamilies: ['openai', 'anthropic'],
      reviewerFamily: 'google',
      reviewerModel: 'gemini-3.1-pro',
    }));
    expect(evaluateReviewGate({ pr: mixedPr, reviews: [googleReview] }).ok).toBe(true);
  });

  it('rejects a declaration that hides the branch-inferred family', () => {
    const result = resolveAuthorFamilies(pr({ body: '<!-- ai-author-families: anthropic -->' }));
    expect(result.error).toContain('omits branch-inferred family openai');
  });

  it('normalizes known branch aliases and exposes receipt parse errors', () => {
    expect(inferBranchFamily('feat/opus-review')).toBe('anthropic');
    expect(inferBranchFamily('fix/gemini-parser')).toBe('google');
    expect(inferBranchFamily('feat/grok-audit')).toBe('xai');
    expect(parseReviewReceipts([review()])).toHaveLength(1);
  });

  it('creates and completes an exact-head GitHub Actions Check Run', async () => {
    const requests = [];
    vi.stubGlobal('fetch', vi.fn(async (url, options) => {
      requests.push({ url, options, body: JSON.parse(options.body) });
      return {
        ok: true,
        status: requests.length === 1 ? 201 : 200,
        json: async () => (requests.length === 1 ? { id: 321 } : {}),
      };
    }));

    const checkRunId = await createReviewCheckRun('owner/repo', HEAD, 'token', {
      serverUrl: 'https://github.example',
      runId: '456',
      runAttempt: '2',
    });
    await completeReviewCheckRun(
      'owner/repo',
      checkRunId,
      'token',
      'success',
      'Independent review approved',
      `Approved exact head ${HEAD}.`,
      { completedAt: '2026-08-25T07:00:00.000Z' }
    );

    expect(checkRunId).toBe(321);
    expect(requests[0]).toMatchObject({
      url: 'https://api.github.com/repos/owner/repo/check-runs',
      options: { method: 'POST' },
      body: {
        name: 'cross-family-adversarial-review',
        head_sha: HEAD,
        status: 'in_progress',
        details_url: 'https://github.example/owner/repo/actions/runs/456',
        external_id: 'cross-family-adversarial-review:456:2',
      },
    });
    expect(requests[1]).toMatchObject({
      url: 'https://api.github.com/repos/owner/repo/check-runs/321',
      options: { method: 'PATCH' },
      body: {
        status: 'completed',
        conclusion: 'success',
        completed_at: '2026-08-25T07:00:00.000Z',
      },
    });
  });

  it('reports a descriptive Check Run API failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 403,
      text: async () => 'GitHub App lacks checks permission',
    })));

    await expect(
      createReviewCheckRun('owner/repo', HEAD, 'token', { runId: '456' })
    ).rejects.toThrow(
      'GitHub POST /repos/owner/repo/check-runs failed: 403 GitHub App lacks checks permission'
    );
  });

  it('grants Check Run permission without retaining legacy status permission', () => {
    const workflow = readFileSync('.github/workflows/cross-family-review.yml', 'utf8');
    expect(workflow).toContain('checks: write');
    expect(workflow).not.toContain('statuses: write');
  });
});

/**
 * Regression tests for the full-session export silent feedback drop (P2).
 *
 * Pre-fix bug: exportFullSessionToJson swallowed read failures for
 * user-authored data (feedback, prompt templates, amendment logs) with
 * `.catch(() => [])` — a backup that silently omits data the user typed, with
 * no telemetry and no marker in the export itself. Post-fix the export still
 * completes, but it SAYS SO: metadata completeness flags + a warnings array
 * (mirroring the image-collection pattern) plus telemetry.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { exportFullSessionToJson } from '../../../services/db/operations/export';
import { telemetryService } from '../../../services/telemetryService';

const makeDeps = (overrides: Partial<Record<string, any>> = {}) => ({
  getSettings: vi.fn().mockResolvedValue({ fontSize: 16 }),
  getAllUrlMappings: vi.fn().mockResolvedValue([]),
  getAllNovels: vi.fn().mockResolvedValue([]),
  getAllChapters: vi.fn().mockResolvedValue([
    {
      stableId: 'ch-1',
      url: 'https://example.com/ch1',
      canonicalUrl: 'https://example.com/ch1',
      title: 'Chapter 1',
      content: '<p>Body</p>',
    },
  ]),
  getSetting: vi.fn().mockResolvedValue(null),
  getAllDiffResults: vi.fn().mockResolvedValue([]),
  getUrlMappingForUrl: vi.fn().mockResolvedValue(null),
  getTranslationVersionsByStableId: vi.fn().mockResolvedValue([]),
  getTranslationVersions: vi.fn().mockResolvedValue([]),
  getFeedback: vi.fn().mockResolvedValue([]),
  getPromptTemplates: vi.fn().mockResolvedValue([]),
  getAmendmentLogs: vi.fn().mockResolvedValue([]),
  ...overrides,
});

describe('exportFullSessionToJson — completeness accounting', () => {
  let warningSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warningSpy = vi.spyOn(telemetryService, 'captureWarning').mockImplementation(() => {});
  });

  it('a clean export declares itself complete', async () => {
    const result = await exportFullSessionToJson(makeDeps() as any, {
      includeImages: false,
      includeTelemetry: false,
    });

    expect(result.metadata.feedbackComplete).toBe(true);
    expect(result.metadata.promptTemplatesComplete).toBe(true);
    expect(result.metadata.amendmentLogsComplete).toBe(true);
    expect(result.metadata.warnings).toEqual([]);
  });

  it('a failed feedback read still exports, but flags the omission and emits telemetry', async () => {
    const deps = makeDeps({
      getFeedback: vi.fn().mockRejectedValue(new Error('feedback store corrupted')),
    });

    const result = await exportFullSessionToJson(deps as any, {
      includeImages: false,
      includeTelemetry: false,
    });

    // The backup completes (partial beats nothing)…
    expect(result.chapters).toHaveLength(1);
    expect(result.chapters[0].feedback).toEqual([]);
    // …but never silently: the export itself carries the marker…
    expect(result.metadata.feedbackComplete).toBe(false);
    expect(result.metadata.warnings).toEqual([
      expect.objectContaining({ scope: 'feedback' }),
    ]);
    // …and telemetry records it.
    expect(warningSpy).toHaveBeenCalledWith(
      'export-feedback',
      expect.stringContaining('omits'),
      expect.objectContaining({ error: 'feedback store corrupted' })
    );
  });

  it('failed prompt-template and amendment-log reads are flagged independently', async () => {
    const deps = makeDeps({
      getPromptTemplates: vi.fn().mockRejectedValue(new Error('templates read failed')),
      getAmendmentLogs: vi.fn().mockRejectedValue(new Error('logs read failed')),
    });

    const result = await exportFullSessionToJson(deps as any, {
      includeImages: false,
      includeTelemetry: false,
    });

    expect(result.metadata.feedbackComplete).toBe(true);
    expect(result.metadata.promptTemplatesComplete).toBe(false);
    expect(result.metadata.amendmentLogsComplete).toBe(false);
    const scopes = result.metadata.warnings.map((w: any) => w.scope).sort();
    expect(scopes).toEqual(['amendmentLogs', 'promptTemplates']);
    expect(result.promptTemplates).toEqual([]);
    expect(result.amendmentLogs).toEqual([]);
  });
});

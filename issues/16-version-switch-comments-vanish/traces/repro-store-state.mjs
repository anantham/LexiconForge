#!/usr/bin/env node
/**
 * Live repro for issue #16. Observes the store state across:
 *   1. Initial chapter load (chapter.feedback should be [])
 *   2. submitFeedback()              (chapter.feedback should have 1 item)
 *   3. setActiveTranslationVersion(other)  (does chapter.feedback survive?)
 *   4. setActiveTranslationVersion(original)  (and on the way back?)
 *   5. window.location.reload()      (does the comment persist?)
 *
 * Uses window.useAppStore (exposed at store/index.ts:60) for programmatic state access.
 * No UI clicking needed — testing the data layer directly.
 */
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const RESULT = resolve(HERE, 'repro-store-state-result.json');
const TARGET = 'http://localhost:5180/?novel=forty-millenniums-of-cultivation&version=v1-composite&chapter=lexiconforge%3A%2F%2Fforty-millenniums-of-cultivation%2Fchapter%2F339';

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();

const observations = [];
const consoleErrors = [];

page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 200));
});
page.on('pageerror', (err) => consoleErrors.push('pageerror: ' + err.message.slice(0, 200)));

console.log('[repro16] navigate');
try {
  await page.goto(TARGET, { waitUntil: 'load', timeout: 120_000 });
} catch (e) {
  console.log('[repro16] goto error:', e.message);
}

// Wait for store to be exposed AND for something to load
await page.waitForFunction(() => typeof window.useAppStore !== 'undefined', { timeout: 30_000 }).catch(() => null);
await page.waitForTimeout(8_000);  // give init time

// Helper to capture relevant store state
const snapshot = async (label) => {
  const data = await page.evaluate(() => {
    const s = window.useAppStore?.getState();
    if (!s) return { error: 'no store' };
    const chapterId = s.currentChapterId;
    const chapter = chapterId ? s.chapters?.get?.(chapterId) : null;
    const feedbackHistory = s.feedbackHistory?.[chapterId] || [];
    const activeTranslation = chapter?.translationResult;
    return {
      chapterId,
      hasChapter: !!chapter,
      chapterFeedbackCount: chapter?.feedback?.length ?? 0,
      chapterFeedbackIds: (chapter?.feedback ?? []).map(f => f.id).slice(0, 5),
      feedbackHistoryCount: feedbackHistory.length,
      feedbackHistoryIds: feedbackHistory.map(f => f.id).slice(0, 5),
      hasTranslation: !!activeTranslation,
      translationProvider: activeTranslation?.usageMetrics?.provider,
      translationModel: activeTranslation?.usageMetrics?.model,
      translationLength: activeTranslation?.translation?.length || 0,
      activeVersionId: s.activeVersionId,
      viewMode: s.viewMode,
    };
  });
  console.log(`[repro16] ${label}:`, JSON.stringify(data));
  observations.push({ label, data, ts: Date.now() });
};

await snapshot('1_after_initial_load');

// Step 2: try submitFeedback
const submitResult = await page.evaluate(() => {
  const s = window.useAppStore?.getState();
  if (!s) return { error: 'no store' };
  const chapterId = s.currentChapterId;
  if (!chapterId) return { error: 'no current chapter' };
  if (!s.submitFeedback) return { error: 'no submitFeedback action' };
  // Use a selection that's likely in the translation
  const chapter = s.chapters?.get?.(chapterId);
  const text = chapter?.translationResult?.translation || '';
  const selection = text.slice(50, 80) || 'TEST_SELECTION_MARKER';
  s.submitFeedback(chapterId, {
    selection,
    type: '👍',
    comment: 'repro16-test-comment',
  });
  return { ok: true, selection: selection.slice(0, 40) };
});
console.log('[repro16] submitFeedback result:', JSON.stringify(submitResult));
await page.waitForTimeout(500);
await snapshot('2_after_submitFeedback');

// Step 3: list available translation versions
const versions = await page.evaluate(async () => {
  const s = window.useAppStore?.getState();
  const chapterId = s.currentChapterId;
  if (!chapterId || !s.fetchTranslationVersions) return { error: 'no fetch action' };
  try {
    const list = await s.fetchTranslationVersions(chapterId);
    return { count: list.length, versions: list.map(v => ({ version: v.version, isActive: v.isActive, model: v.model, provider: v.provider })) };
  } catch (e) {
    return { error: String(e) };
  }
});
console.log('[repro16] versions:', JSON.stringify(versions));
observations.push({ label: 'available_versions', data: versions, ts: Date.now() });

// Step 4: if 2+ versions, switch to a non-active one
if (versions.count > 1) {
  const target = versions.versions.find(v => !v.isActive);
  if (target) {
    const switchResult = await page.evaluate(async (targetVersion) => {
      const s = window.useAppStore?.getState();
      const chapterId = s.currentChapterId;
      try {
        await s.setActiveTranslationVersion(chapterId, targetVersion);
        return { ok: true };
      } catch (e) { return { error: String(e) }; }
    }, target.version);
    console.log('[repro16] switchToOther:', JSON.stringify(switchResult));
    await page.waitForTimeout(500);
    await snapshot(`3_after_switch_to_v${target.version}`);

    // switch back
    const original = versions.versions.find(v => v.isActive);
    if (original) {
      const backResult = await page.evaluate(async (v) => {
        const s = window.useAppStore?.getState();
        const chapterId = s.currentChapterId;
        try {
          await s.setActiveTranslationVersion(chapterId, v);
          return { ok: true };
        } catch (e) { return { error: String(e) }; }
      }, original.version);
      console.log('[repro16] switchBack:', JSON.stringify(backResult));
      await page.waitForTimeout(500);
      await snapshot(`4_after_switch_back_to_v${original.version}`);
    }
  } else {
    console.log('[repro16] no inactive version to switch to');
  }
} else {
  console.log('[repro16] only 1 version available — cannot test switch behavior in this session');
}

// Step 5: reload and check persistence
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => typeof window.useAppStore !== 'undefined', { timeout: 30_000 }).catch(() => null);
await page.waitForTimeout(8_000);
await snapshot('5_after_reload');

writeFileSync(RESULT, JSON.stringify({ observations, consoleErrors, capturedAt: new Date().toISOString() }, null, 2));
console.log(`[repro16] wrote ${RESULT}`);

await ctx.close();
await browser.close();

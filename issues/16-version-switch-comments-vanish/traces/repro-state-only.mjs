#!/usr/bin/env node
/**
 * In-memory state lifecycle test for issue #16.
 *
 * Hypothesis (from code reading):
 *   - submitFeedback updates chapter.feedback (in memory).
 *   - setActiveTranslationVersion → updateChapter({ translationResult }), shallow-merges,
 *     so chapter.feedback should be preserved.
 *
 * If hypothesis holds, the bug is downstream in the rendering layer (InlineCommentMarkers
 * position recompute, conditional render flap, etc.). If it doesn't, something is
 * clearing chapter.feedback during the switch and that's the bug.
 *
 * This script bypasses the failing deep-link import by:
 *   - Opening / (no ?novel=, so no import path)
 *   - Injecting a chapter via store.importChapter()
 *   - Directly invoking submitFeedback + updateChapter to simulate the lifecycle
 *
 * It can't fully exercise setActiveTranslationVersion (needs real IDB-stored translations),
 * but it CAN exercise updateChapter, which is what setActiveTranslationVersion uses.
 */
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const RESULT = resolve(HERE, 'repro-state-only-result.json');

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message.slice(0, 200)));

console.log('[repro16-state] navigate to /');
await page.goto('http://localhost:5180/', { waitUntil: 'load', timeout: 60_000 });
await page.waitForFunction(() => typeof window.useAppStore !== 'undefined', { timeout: 30_000 }).catch(() => null);
// wait for init
await page.waitForFunction(() => window.useAppStore?.getState()?.isInitialized === true, { timeout: 30_000 }).catch(() => null);
await page.waitForTimeout(2_000);

const result = await page.evaluate(async () => {
  const s = window.useAppStore.getState();
  const log = [];
  const cap = (label) => {
    const st = window.useAppStore.getState();
    const id = 'test-chapter-issue16';
    const ch = st.chapters?.get?.(id);
    log.push({
      label,
      hasChapter: !!ch,
      feedbackCount: ch?.feedback?.length ?? 0,
      feedbackIds: (ch?.feedback ?? []).map(f => f.id),
      translationLength: ch?.translationResult?.translation?.length ?? 0,
      translationFirst20: (ch?.translationResult?.translation || '').slice(0, 20),
    });
  };

  // 1. Inject a synthetic chapter
  const chapterId = 'test-chapter-issue16';
  const fakeChapter = {
    id: chapterId,
    stableId: chapterId,
    novelId: null,
    libraryVersionId: null,
    url: 'test://issue16/chapter/1',
    title: 'Test Chapter',
    content: 'Original raw content here.',
    originalUrl: 'test://issue16/chapter/1',
    canonicalUrl: 'test://issue16/chapter/1',
    nextUrl: null,
    prevUrl: null,
    chapterNumber: 1,
    sourceUrls: ['test://issue16/chapter/1'],
    importSource: { originalUrl: 'test://issue16/chapter/1', importDate: new Date(), sourceFormat: 'json' },
    fanTranslation: null,
    suttaStudio: null,
    translationResult: {
      translatedTitle: 'Test Chapter (English)',
      translation: 'This is the English translation A. The fox jumps over the lazy dog.',
      proposal: null,
      footnotes: [],
      suggestedIllustrations: [],
      usageMetrics: { totalTokens: 0, promptTokens: 0, completionTokens: 0, estimatedCost: 0, requestTime: 0, provider: 'OpenRouter', model: 'translation-A' },
    },
    feedback: [],
  };
  s.importChapter(fakeChapter);
  // set as current
  window.useAppStore.setState({ currentChapterId: chapterId });
  cap('1_after_inject');

  // 2. submitFeedback with a selection that exists in translation A
  const selection = 'fox jumps over';
  s.submitFeedback(chapterId, { selection, type: '👍', comment: 'comment-A' });
  await new Promise(r => setTimeout(r, 200));
  cap('2_after_submit');

  // 3. Mimic translation switch: updateChapter with a NEW translationResult (different text)
  s.updateChapter(chapterId, {
    translationResult: {
      ...fakeChapter.translationResult,
      translation: 'Different translation B. The cat hides under the porch.',
      usageMetrics: { ...fakeChapter.translationResult.usageMetrics, model: 'translation-B' },
    },
  });
  await new Promise(r => setTimeout(r, 200));
  cap('3_after_switch_to_B');

  // 4. Mimic switch back
  s.updateChapter(chapterId, {
    translationResult: {
      ...fakeChapter.translationResult,
      // back to A's text
      translation: 'This is the English translation A. The fox jumps over the lazy dog.',
      usageMetrics: { ...fakeChapter.translationResult.usageMetrics, model: 'translation-A' },
    },
  });
  await new Promise(r => setTimeout(r, 200));
  cap('4_after_switch_back_to_A');

  return { observations: log };
});

writeFileSync(RESULT, JSON.stringify({ ...result, errors, capturedAt: new Date().toISOString() }, null, 2));
for (const obs of result.observations) {
  console.log(`[repro16-state] ${obs.label}: feedback=${obs.feedbackCount} (ids=${obs.feedbackIds.length}) trans="${obs.translationFirst20}…" model=match`);
}
console.log(`[repro16-state] wrote ${RESULT}`);

await ctx.close();
await browser.close();

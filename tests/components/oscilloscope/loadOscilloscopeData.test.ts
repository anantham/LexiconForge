import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { loadOscilloscopeData } from '../../../components/oscilloscope/loadOscilloscopeData';
import { useAppStore } from '../../../store';

// Test intent: a delayed legacy download cannot replace another book or a verified graph.
beforeEach(() => {
  useAppStore.getState().resetOscilloscope();
  useAppStore.setState({ activeNovelId: 'forty-millenniums-of-cultivation', activeVersionId: 'v1' });
});
afterEach(() => vi.unstubAllGlobals());

it.each(['book', 'version', 'verified graph'])('discards a delayed legacy graph after changing %s', async (change) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  vi.stubGlobal('fetch', vi.fn(async () => {
    await gate;
    return { ok: true, json: async () => ({}) };
  }));
  const pending = loadOscilloscopeData('/data/_all_meta.json', '/data/_character_threads.json', 3457);
  if (change === 'book') useAppStore.getState().openNovel('other-book', 'v1');
  if (change === 'version') useAppStore.getState().openNovel('forty-millenniums-of-cultivation', 'v2');
  if (change === 'verified graph') useAppStore.getState().initializeOscilloscope({
    corpusId: 'forty-millenniums-of-cultivation', versionId: 'v1', chapterCount: 2,
    contentHash: `sha256:${'a'.repeat(64)}`,
  });
  release();
  await pending;
  expect(useAppStore.getState().totalChapters).toBe(change === 'verified graph' ? 2 : 0);
  expect(useAppStore.getState().threads.size).toBe(0);
});

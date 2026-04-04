/**
 * loadOscilloscopeData - Fetches and loads all oscilloscope thread data into the store.
 *
 * Loads pre-computed analysis JSON files from public/oscilloscope-data/:
 * - _all_meta.json (word count, dialogue ratio per chapter)
 * - _character_threads.json (20 characters)
 * - _location_threads.json (13 locations)
 * - _faction_threads.json (8 factions)
 * - _entity_threads.json (10 entities/artifacts)
 * - _tone_threads.json (6 tone dimensions)
 */

import { useAppStore } from '../../store';

async function fetchJSON(url: string): Promise<Record<string, any>> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Failed to fetch ${url}: ${r.status}`);
  return r.json();
}

export async function loadOscilloscopeData(
  metaJsonUrl: string,
  characterThreadsUrl: string,
  totalChapters: number,
): Promise<void> {
  const store = useAppStore.getState();
  const basePath = metaJsonUrl.substring(0, metaJsonUrl.lastIndexOf('/'));

  // Fetch all data files in parallel
  const [metaResp, charResp, locResp, facResp, entResp, toneResp] = await Promise.all([
    fetchJSON(metaJsonUrl),
    fetchJSON(characterThreadsUrl),
    fetchJSON(`${basePath}/_location_threads.json`).catch(() => ({})),
    fetchJSON(`${basePath}/_faction_threads.json`).catch(() => ({})),
    fetchJSON(`${basePath}/_entity_threads.json`).catch(() => ({})),
    fetchJSON(`${basePath}/_tone_threads.json`).catch(() => ({})),
  ]);

  // Load chapter titles for tooltip display
  const titlesResp = await fetchJSON(`${basePath}/_chapter_titles.json`).catch(() => ({}));

  // Load base data (meta + characters)
  store.loadFromJSON(metaResp, charResp, totalChapters);

  // Store titles in a simple lookup the graph can access
  (window as any).__oscilloscopeChapterTitles = titlesResp;

  // Add additional thread categories
  const categoryColors: Record<string, string> = {
    location: '#22c55e',
    faction: '#f97316',
    entity: '#8b5cf6',
    tone: '#ef4444',
  };

  const addThreads = (
    data: Record<string, Record<string, number>>,
    category: 'location' | 'faction' | 'entity' | 'tone',
  ) => {
    const palette = [
      '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4',
      '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#a855f7',
    ];
    let colorIdx = 0;

    for (const [name, chapterScores] of Object.entries(data)) {
      const values = new Array(totalChapters).fill(0);
      for (const [chNum, score] of Object.entries(chapterScores)) {
        const idx = parseInt(chNum, 10) - 1;
        if (idx >= 0 && idx < totalChapters) {
          values[idx] = score;
        }
      }

      store.addThread({
        threadId: `${category}:${name}`,
        category,
        label: name,
        color: palette[colorIdx % palette.length],
        values,
        totalChapters,
      });
      colorIdx++;
    }
  };

  addThreads(locResp, 'location');
  addThreads(facResp, 'faction');
  addThreads(entResp, 'entity');
  addThreads(toneResp, 'tone');
}

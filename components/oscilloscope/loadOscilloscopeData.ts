/**
 * loadOscilloscopeData - Fetches and loads oscilloscope thread data into the store.
 *
 * Loads pre-computed analysis JSON files (_all_meta.json, _character_threads.json)
 * and calls the store's loadFromJSON action. For development, data files should be
 * in public/oscilloscope-data/. In production, they come from session import.
 */

import { useAppStore } from '../../store';

export async function loadOscilloscopeData(
  metaJsonUrl: string,
  characterThreadsUrl: string,
  totalChapters: number,
): Promise<void> {
  const store = useAppStore.getState();

  const [metaResp, charResp] = await Promise.all([
    fetch(metaJsonUrl).then((r) => {
      if (!r.ok) throw new Error(`Failed to fetch meta data: ${r.status} ${r.statusText}`);
      return r.json();
    }),
    fetch(characterThreadsUrl).then((r) => {
      if (!r.ok) throw new Error(`Failed to fetch character threads: ${r.status} ${r.statusText}`);
      return r.json();
    }),
  ]);

  store.loadFromJSON(metaResp, charResp, totalChapters);
}

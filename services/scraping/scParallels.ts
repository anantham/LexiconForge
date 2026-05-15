import { ParallelInfo, ParallelType } from '../../types/suttaStudio';

const SC_PROXY_BASE = '/api/fetch-proxy?url=';

type RawParallelsEntry = {
  to?: {
    uid?: string;
    root_lang?: string;
    acronym?: string;
  };
  type?: string;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const normalizeType = (value: unknown): ParallelType => {
  if (value === 'full' || value === 'resembling' || value === 'mention') return value;
  return 'full';
};

const fetchJson = async (url: string) => {
  const proxied = `${SC_PROXY_BASE}${encodeURIComponent(url)}`;
  const response = await fetch(proxied, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) {
    throw new Error(`Failed to fetch SuttaCentral resource (${response.status}) from ${url}`);
  }
  return response.json();
};

export async function fetchParallels(uid: string): Promise<ParallelInfo[]> {
  const normalizedUid = uid.trim().toLowerCase();
  if (!normalizedUid) return [];

  const data = await fetchJson(`https://suttacentral.net/api/parallels/${normalizedUid}`);
  const collected: ParallelInfo[] = [];

  if (isObject(data)) {
    for (const entries of Object.values(data)) {
      if (!Array.isArray(entries)) continue;
      for (const rawEntry of entries) {
        if (!isObject(rawEntry)) continue;
        const entry = rawEntry as RawParallelsEntry;
        const to = isObject(entry.to) ? entry.to : null;
        if (!to || typeof to.uid !== 'string' || !to.uid.trim()) continue;

        const rootLang = typeof to.root_lang === 'string' ? to.root_lang.trim().toLowerCase() : 'unknown';
        collected.push({
          uid: to.uid.trim().toLowerCase(),
          rootLang,
          type: normalizeType(entry.type),
          acronym: typeof to.acronym === 'string' ? to.acronym.trim() : undefined,
          isPali: rootLang === 'pli' || rootLang === 'pi',
        });
      }
    }
  }

  const deduped = new Map<string, ParallelInfo>();
  for (const item of collected) {
    const key = `${item.uid}::${item.rootLang}::${item.type}`;
    if (!deduped.has(key)) deduped.set(key, item);
  }

  return Array.from(deduped.values()).sort((a, b) => a.uid.localeCompare(b.uid, undefined, { numeric: true }));
}

export async function fetchParallelText(uid: string): Promise<string> {
  const normalizedUid = uid.trim().toLowerCase();
  if (!normalizedUid) return '';

  const data = await fetchJson(`https://suttacentral.net/api/suttas/${normalizedUid}`);
  const rootText = isObject(data)
    ? (isObject(data.root_text)
      ? data.root_text
      : (isObject(data.bilara_root_text) ? data.bilara_root_text : null))
    : null;

  if (!rootText) {
    throw new Error(`Parallel text for ${normalizedUid} has no root text payload.`);
  }

  const keys = Object.keys(rootText).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return keys.map((key) => String(rootText[key] ?? '').trim()).filter(Boolean).join('\n\n');
}

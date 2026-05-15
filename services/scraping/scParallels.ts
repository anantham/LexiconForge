import { ParallelInfo, ParallelType } from '../../types/suttaStudio';

const SC_PROXY_BASE = '/api/fetch-proxy?url=';

type RawParallelNode = {
  uid?: string;
  root_lang?: string;
  type?: string;
  acronym?: string;
  [key: string]: unknown;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const normalizeType = (value: unknown): ParallelType => {
  if (value === 'full' || value === 'resembling' || value === 'mention') return value;
  return 'full';
};

const walkParallels = (input: unknown, acc: ParallelInfo[]) => {
  if (Array.isArray(input)) {
    input.forEach((entry) => walkParallels(entry, acc));
    return;
  }
  if (!isObject(input)) return;

  const leaf = input as RawParallelNode;
  if (typeof leaf.uid === 'string' && leaf.uid.trim()) {
    const rootLang = typeof leaf.root_lang === 'string' ? leaf.root_lang.trim().toLowerCase() : 'unknown';
    acc.push({
      uid: leaf.uid.trim().toLowerCase(),
      rootLang,
      type: normalizeType(leaf.type),
      acronym: typeof leaf.acronym === 'string' ? leaf.acronym.trim() : undefined,
      isPali: rootLang === 'pli' || rootLang === 'pi',
    });
  }

  Object.values(input).forEach((entry) => {
    if (entry !== input) walkParallels(entry, acc);
  });
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
  walkParallels(data, collected);

  const deduped = new Map<string, ParallelInfo>();
  for (const item of collected) {
    const key = `${item.uid}::${item.rootLang}::${item.type}`;
    if (!deduped.has(key)) deduped.set(key, item);
  }

  return Array.from(deduped.values()).sort((a, b) => a.uid.localeCompare(b.uid, undefined, { numeric: true }));
}

export async function fetchParallelText(uid: string, author = 'sujato'): Promise<string> {
  const normalizedUid = uid.trim().toLowerCase();
  if (!normalizedUid) return '';

  const data = await fetchJson(`https://suttacentral.net/api/bilarasuttas/${normalizedUid}/${author}`);
  const rootText = isObject(data) && isObject(data.root_text) ? data.root_text : null;
  if (!rootText) {
    throw new Error(`Parallel text for ${normalizedUid} has no root_text payload.`);
  }
  const keys = Object.keys(rootText).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return keys.map((key) => String(rootText[key] ?? '').trim()).filter(Boolean).join('\n\n');
}

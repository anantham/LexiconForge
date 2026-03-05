import { PROXIES } from '../scraping/proxy';
import { logPipelineEvent } from '../suttaStudioPipelineLog';
import { getTimeoutSignal } from './utils';

const log = (message: string, ...args: any[]) =>
  console.log(`[SuttaStudioCompiler] ${message}`, ...args);
const warn = (message: string, ...args: any[]) =>
  console.warn(`[SuttaStudioCompiler] ${message}`, ...args);

const DICTIONARY_LOOKUP_BASE = 'https://suttacentral.net/api/dictionary_full/';

const dictionaryCache = new Map<string, unknown>();

const normalizeDictionaryQuery = (surface: string): string => {
  return surface.trim().replace(/^[\s"'`.,;:!?()]+|[\s"'`.,;:!?()]+$/g, '');
};

export const fetchJsonViaProxies = async (url: string, signal?: AbortSignal): Promise<any> => {
  const timeoutMs = 12000;
  const errors: string[] = [];

  // Try direct fetch FIRST (SuttaCentral allows CORS from localhost)
  try {
    log(`Direct fetch: ${url}`);
    const resp = await fetch(url, { signal: getTimeoutSignal(timeoutMs, signal) });
    if (!resp.ok) throw new Error(`Direct fetch responded ${resp.status}`);
    const text = await resp.text();
    return JSON.parse(text);
  } catch (e: any) {
    const msg = e?.message || String(e);
    errors.push(`Direct: ${msg}`);
    warn(`Direct fetch failed for ${url}: ${msg}, trying proxies...`);
  }

  // Fall back to proxies if direct fails
  for (const proxy of PROXIES) {
    let fetchUrl = proxy.type === 'param'
      ? `${proxy.url}${encodeURIComponent(url)}`
      : `${proxy.url}${url}`;

    try {
      const proxyName = new URL(proxy.url).hostname;
      log(`Proxy fetch via ${proxyName}: ${url}`);
      const resp = await fetch(fetchUrl, { signal: getTimeoutSignal(timeoutMs, signal) });
      if (!resp.ok) {
        throw new Error(`Proxy ${proxyName} responded ${resp.status}`);
      }

      if (proxy.responseFormat === 'json') {
        const json = await resp.json();
        const payload = proxy.contentKey && json && typeof json === 'object'
          ? json[proxy.contentKey]
          : json;

        if (typeof payload === 'string') {
          try {
            return JSON.parse(payload);
          } catch (e) {
            throw new Error(`Proxy ${proxyName} returned non-JSON payload string`);
          }
        }
        return payload;
      }

      const text = await resp.text();
      return JSON.parse(text);
    } catch (e: any) {
      const msg = e?.message || String(e);
      errors.push(msg);
      warn(`Proxy failed for ${url}: ${msg}`);
      continue;
    }
  }

  throw new Error(`All fetch attempts failed for ${url}. Errors: ${errors.join(' | ')}`);
};

export const fetchDictionaryEntry = async (params: {
  surface: string;
  wordId: string;
  phaseId: string;
  signal?: AbortSignal;
  throttle?: (signal?: AbortSignal) => Promise<void>;
}): Promise<unknown | null> => {
  const { surface, wordId, phaseId, signal, throttle } = params;
  const query = normalizeDictionaryQuery(surface);
  if (!query) {
    logPipelineEvent({
      level: 'warn',
      stage: 'lexicographer',
      phaseId,
      message: 'dictionary.skip',
      data: { wordId, surface, reason: 'empty_query' },
    });
    return null;
  }
  if (dictionaryCache.has(query)) {
    logPipelineEvent({
      level: 'info',
      stage: 'lexicographer',
      phaseId,
      message: 'dictionary.cache_hit',
      data: { wordId, surface, query },
    });
    return dictionaryCache.get(query) ?? null;
  }
  const url = `${DICTIONARY_LOOKUP_BASE}${encodeURIComponent(query)}`;
  logPipelineEvent({
    level: 'info',
    stage: 'lexicographer',
    phaseId,
    message: 'dictionary.request',
    data: { wordId, surface, query, url },
  });
  try {
    await throttle?.(signal);
    const response = await fetchJsonViaProxies(url, signal);
    dictionaryCache.set(query, response);
    logPipelineEvent({
      level: 'info',
      stage: 'lexicographer',
      phaseId,
      message: 'dictionary.response',
      data: { wordId, surface, query, response },
    });
    return response;
  } catch (e: any) {
    logPipelineEvent({
      level: 'warn',
      stage: 'lexicographer',
      phaseId,
      message: 'dictionary.error',
      data: { wordId, surface, query, error: e?.message || String(e) },
    });
    return null;
  }
};

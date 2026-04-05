/**
 * fetchAndParseUrl — main entry point for fetching a web novel chapter.
 * Rotates through CORS proxies with health-based sorting and exponential backoff.
 */

import { Chapter } from '../../types';
import { SuttaCentralAdapter, getAdapter } from './siteAdapters';
import {
  PROXIES,
  PLAYWRIGHT_PROXY_URL,
  initializeProxyHealth,
  updateProxyHealth,
  getProxyHealthMap,
  getProxyDiagnostics,
} from './proxy';
import { deriveChapterNumber } from './chapterNumber';
import { AppError } from '../appError';

export const fetchAndParseUrl = async (
  url: string,
  proxyScores: Record<string, number> = {},
  updateProxyScore: (proxyUrl: string, successful: boolean) => void = () => {}
): Promise<Chapter> => {
  let targetUrl: URL;
  try {
    targetUrl = new URL(url);
  } catch {
    throw new AppError({
      code: 'FETCH_INVALID_URL',
      userMessage: 'The provided URL is not valid. Please enter a full web address (for example, "https://...").',
      developerMessage: `Invalid fetch URL: ${url}`,
      retryable: false,
      details: { url },
    });
  }

  const isSuttaCentral = targetUrl.hostname.endsWith('suttacentral.net');
  const suttaAdapter = isSuttaCentral
    ? new SuttaCentralAdapter(url, new DOMParser().parseFromString('', 'text/html'))
    : null;
  if (suttaAdapter) {
    console.log('[Fetch] SuttaCentral URL detected; using API fetch path.');
  }

  let lastError: Error | null = null;
  const MAX_RETRIES = 2;
  const proxyHealthMap = getProxyHealthMap();

  // Initialize health for all proxies and sort by reliability
  PROXIES.forEach((proxy) => initializeProxyHealth(proxy.url));
  const sortedProxies = [...PROXIES].sort((a, b) => {
    const healthA = proxyHealthMap.get(a.url)!;
    const healthB = proxyHealthMap.get(b.url)!;
    if (healthA.isHealthy !== healthB.isHealthy) return healthA.isHealthy ? -1 : 1;
    const successRateA = healthA.success / (healthA.success + healthA.failures || 1);
    const successRateB = healthB.success / (healthB.success + healthB.failures || 1);
    return successRateB - successRateA;
  });

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    for (const proxy of sortedProxies) {
      const fetchUrl =
        proxy.type === 'param'
          ? `${proxy.url}${encodeURIComponent(url)}`
          : `${proxy.url}${url}`;

      const proxyName = new URL(proxy.url).hostname;
      const startTime = Date.now();
      console.log(`[Fetch] Attempt ${attempt}/${MAX_RETRIES} via ${proxyName} for: ${url}`);

      try {
        if (suttaAdapter) {
          const proxyFetcher = async (apiUrl: string) => {
            const innerUrl =
              proxy.type === 'param'
                ? `${proxy.url}${encodeURIComponent(apiUrl)}`
                : `${proxy.url}${apiUrl}`;
            const innerResp = await fetch(innerUrl, { signal: AbortSignal.timeout(10000) });
            if (!innerResp.ok)
              throw new Error(`Proxy failed to fetch API: ${innerResp.status}`);
            if (proxy.responseFormat === 'json') {
              const json = await innerResp.json();
              return json[proxy.contentKey || 'contents'];
            }
            return await innerResp.text();
          };

          const result = await suttaAdapter.fetchSutta(proxyFetcher);
          const suttaResponseTime = Date.now() - startTime;
          updateProxyScore(proxy.url, true);
          updateProxyHealth(proxy.url, true, suttaResponseTime);
          console.log(`[Fetch] ✅ Success via ${proxyName} (${suttaResponseTime}ms)`);
          return result;
        }

        const response = await fetch(fetchUrl, { signal: AbortSignal.timeout(15000) });
        const responseTime = Date.now() - startTime;

        if (!response.ok) {
          const detailedError = buildHttpError(proxyName, response.status);
          throw new Error(detailedError);
        }

        const htmlString = await readResponseBody(response, url, proxy);
        if (!htmlString) throw new Error(`Proxy ${proxyName} returned an empty response.`);

        const doc = new DOMParser().parseFromString(htmlString, 'text/html');
        const adapter = getAdapter(url, doc);
        if (!adapter)
          throw new Error(
            `This website (${targetUrl.hostname}) is not supported. No adapter found.`
          );

        const title = adapter.extractTitle();
        const content = adapter.extractContent();
        if (!title || !content) {
          throw new Error(
            `Failed to extract title or content from ${targetUrl.hostname}. The page might not be a valid chapter, or the website's layout has changed.`
          );
        }

        const chapterNumber = deriveChapterNumber(url, title);
        updateProxyScore(proxy.url, true);
        updateProxyHealth(proxy.url, true, responseTime);
        console.log(`[Fetch] ✅ Success via ${proxyName} (${responseTime}ms)`);
        return {
          title,
          content,
          originalUrl: url,
          nextUrl: adapter.getNextLink(),
          prevUrl: adapter.getPrevLink(),
          chapterNumber,
        };
      } catch (error: any) {
        const responseTime = Date.now() - startTime;
        lastError = error;
        updateProxyScore(proxy.url, false);
        updateProxyHealth(proxy.url, false, responseTime, error.message);
        console.warn(`[Fetch] ❌ Proxy ${proxyName} failed (${responseTime}ms): ${error.message}`);
      }
    }

    if (attempt < MAX_RETRIES) {
      const delay = 1000 * Math.pow(2, attempt - 1);
      console.log(`[Fetch] All proxies failed. Retrying in ${delay / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // Heavyweight fallback: Playwright proxy on VPS (real headless browser)
  console.log(`[Fetch] Playwright fallback: fetching via headless browser for: ${url}`);
  try {
    const playwrightUrl = `${PLAYWRIGHT_PROXY_URL}?url=${encodeURIComponent(url)}`;
    const startTime = Date.now();
    const response = await fetch(playwrightUrl, { signal: AbortSignal.timeout(30000) });
    const elapsed = Date.now() - startTime;

    if (!response.ok) {
      throw new Error(`Playwright proxy returned ${response.status}`);
    }

    const htmlString = await response.text();
    if (!htmlString) throw new Error('Playwright proxy returned empty response');

    if (suttaAdapter) {
      // For SuttaCentral, re-parse through the adapter
      const doc = new DOMParser().parseFromString(htmlString, 'text/html');
      const adapter = new SuttaCentralAdapter(url, doc);
      const result = await adapter.fetchSutta(async () => htmlString);
      console.log(`[Fetch] ✅ Playwright fallback succeeded (${elapsed}ms)`);
      return result;
    }

    const doc = new DOMParser().parseFromString(htmlString, 'text/html');
    const adapter = getAdapter(url, doc);
    if (!adapter) throw new Error(`No adapter for ${targetUrl.hostname}`);

    const title = adapter.extractTitle();
    const content = adapter.extractContent();
    if (!title || !content) throw new Error(`Failed to extract content via Playwright`);

    const chapterNumber = deriveChapterNumber(url, title);
    console.log(`[Fetch] ✅ Playwright fallback succeeded (${elapsed}ms)`);
    return {
      title,
      content,
      originalUrl: url,
      nextUrl: adapter.getNextLink(),
      prevUrl: adapter.getPrevLink(),
      chapterNumber,
    };
  } catch (playwrightError: any) {
    console.warn(`[Fetch] Playwright fallback failed: ${playwrightError.message}`);
    lastError = playwrightError;
  }

  // Final fallback: attempt direct fetch (may fail due to CORS)
  console.log(`[Fetch] Final fallback: attempting direct fetch for: ${url}`);
  try {
    if (suttaAdapter) {
      const directFetcher = async (apiUrl: string) => {
        const innerResp = await fetch(apiUrl, { signal: AbortSignal.timeout(10000) });
        if (!innerResp.ok)
          throw new Error(`Direct fetch failed to fetch API: ${innerResp.status}`);
        return await innerResp.text();
      };
      const result = await suttaAdapter.fetchSutta(directFetcher);
      console.log(`[Fetch] Direct fetch succeeded for: ${url}`);
      return result;
    }

    const response = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      mode: 'cors',
    });
    if (!response.ok)
      throw new Error(`Direct fetch failed with status ${response.status}`);

    const htmlString = await readResponseBody(response, url, null);
    if (!htmlString) throw new Error(`Direct fetch returned empty response`);

    const doc = new DOMParser().parseFromString(htmlString, 'text/html');
    const adapter = getAdapter(url, doc);
    if (!adapter)
      throw new Error(
        `This website (${targetUrl.hostname}) is not supported. No adapter found.`
      );

    const title = adapter.extractTitle();
    const content = adapter.extractContent();
    if (!title || !content) {
      throw new Error(
        `Failed to extract title or content from ${targetUrl.hostname}. The page might not be a valid chapter, or the website's layout has changed.`
      );
    }

    const chapterNumber = deriveChapterNumber(url, title);
    console.log(`[Fetch] Direct fetch succeeded for: ${url}`);
    return {
      title,
      content,
      originalUrl: url,
      nextUrl: adapter.getNextLink(),
      prevUrl: adapter.getPrevLink(),
      chapterNumber,
    };
  } catch (directFetchError: any) {
    console.warn(`[Fetch] Direct fetch failed: ${directFetchError.message}`);
    const diagnostics = getProxyDiagnostics();
    console.group(`[Fetch] All attempts failed for: ${url}`);
    console.log(diagnostics);
    console.groupEnd();

    const developerMessage =
      `Failed to fetch from ${url} after ${MAX_RETRIES} attempts with all proxies and direct fetch.\n\n` +
      `${diagnostics}\n\n` +
      `Last proxy error: ${lastError?.message || 'Unknown proxy error'}\n` +
      `Direct fetch error: ${directFetchError.message}\n\n` +
      `Troubleshooting tips:\n` +
      `• Try again in a few minutes (proxies may be rate-limited)\n` +
      `• Check if the target website is accessible directly\n` +
      `• Some proxies may be temporarily down - the system will learn and adapt\n` +
      `• If all proxies consistently fail, the target site may have enhanced anti-bot protection`;

    throw new AppError({
      code: 'FETCH_ALL_PROXIES_FAILED',
      userMessage: `Couldn't load that chapter from ${targetUrl.hostname} right now. The site or our fetch proxies may be blocking access. Try again later.`,
      developerMessage,
      diagnostics,
      retryable: true,
      cause: directFetchError,
      details: {
        url,
        hostname: targetUrl.hostname,
        retries: MAX_RETRIES,
        lastProxyError: lastError?.message || 'Unknown proxy error',
        directFetchError: directFetchError.message,
      },
    });
  }
};

// --- HELPERS ---

function buildHttpError(proxyName: string, status: number): string {
  const base = `Proxy ${proxyName} responded with status ${status}`;
  switch (status) {
    case 403: return `Access Forbidden (403). ${base}. This proxy may be blocking requests to this domain or has rate limits.`;
    case 429: return `Rate Limited (429). ${base}. This proxy is receiving too many requests. Try again later.`;
    case 502: return `Bad Gateway (502). ${base}. The proxy cannot reach the target website.`;
    case 503: return `Service Unavailable (503). ${base}. The proxy service is temporarily down.`;
    case 504: return `Gateway Timeout (504). ${base}. The proxy timed out waiting for the target website.`;
    default:  return `HTTP ${status}. ${base}. This may indicate the target site is blocking requests or the proxy is misconfigured.`;
  }
}

async function readResponseBody(
  response: Response,
  url: string,
  proxy: { responseFormat: 'html' | 'json'; contentKey?: string; url?: string } | null
): Promise<string> {
  if (proxy?.responseFormat === 'json') {
    const jsonData = await response.json();
    if (!proxy.contentKey || !jsonData[proxy.contentKey]) {
      const proxyName = proxy.url ? new URL(proxy.url).hostname : 'proxy';
      throw new Error(
        `Proxy ${proxyName} returned JSON but the content key '${proxy.contentKey}' was missing.`
      );
    }
    return jsonData[proxy.contentKey];
  }

  // Special GBK encoding for certain Chinese sites
  if (url.includes('kanunu8.com') || url.includes('kanunu.net')) {
    const buffer = await response.arrayBuffer();
    return new TextDecoder('gbk').decode(buffer);
  }

  return await response.text();
}

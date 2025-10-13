import { Chapter } from '../types';
import { SUPPORTED_WEBSITES } from '../config/constants';

// --- ADAPTERS ---

abstract class BaseAdapter {
    protected url: string;
    protected doc: Document;

    constructor(url: string, doc: Document) {
        this.url = url;
        this.doc = doc;
    }

    abstract extractTitle(): string | null;
    abstract extractContent(): string | null;
    abstract getNextLink(): string | null;
    abstract getPrevLink(): string | null;
}

class KakuyomuAdapter extends BaseAdapter {
    extractTitle = () => {
        const fullTitle = this.doc.querySelector('title')?.textContent ?? '';
        // Format: "第二十話　最強の陰陽師、墓穴を掘る - [series title] - カクヨム"
        // We want the first part.
        return fullTitle.split(' - ')[0].trim() || null;
    };

    extractContent = () => {
        const contentEl = this.doc.querySelector('div.widget-episodeBody');
        if (!contentEl) return null;
        
        // Remove furigana (phonetic readings in <rt> tags) to avoid duplicate text for the AI
        contentEl.querySelectorAll('rt').forEach(el => el.remove());
        
        return contentEl.textContent?.trim() ?? null;
    };

    private getLinkByRel = (rel: 'prev' | 'next') => {
        const linkTag = this.doc.querySelector(`link[rel="${rel}"]`);
        const href = linkTag?.getAttribute('href');
        return href ? new URL(href, this.url).href : null;
    }

    getPrevLink = () => this.getLinkByRel('prev');
    getNextLink = () => this.getLinkByRel('next');
}


class DxmwxAdapter extends BaseAdapter {
    extractTitle = () => this.doc.querySelector("#ChapterTitle")?.textContent?.trim() ?? null;
    extractContent = () => {
        const contentEl = this.doc.querySelector("#Lab_Contents");
        if (!contentEl) return null;
        contentEl.querySelectorAll('script, a').forEach(el => el.remove());
        return contentEl.textContent?.trim() ?? null;
    };
    private getLinkByText = (text: RegExp) => {
        const link = Array.from(this.doc.querySelectorAll('a')).find(a => text.test(a.textContent ?? ''));
        return link?.getAttribute('href') ? new URL(link.getAttribute('href')!, this.url).href : null;
    }
    getPrevLink = () => this.getLinkByText(/上一章/);
    getNextLink = () => this.getLinkByText(/下一章/);
}

class KanunuAdapter extends BaseAdapter {
    extractTitle = () => this.doc.querySelector('h1')?.textContent?.trim() ?? null;
    extractContent = () => {
        const contentEl = this.doc.querySelector('div#neirong');
        if (!contentEl) return null;
        const paragraphs = contentEl.querySelectorAll('p');
        if (paragraphs.length > 1) paragraphs[paragraphs.length - 1].remove();
        return contentEl.textContent?.trim() ?? null;
    }
    private getLinkByText = (text: RegExp) => {
        const link = Array.from(this.doc.querySelectorAll('a')).find(a => text.test(a.textContent ?? ''));
        return link?.getAttribute('href') ? new URL(link.getAttribute('href')!, this.url).href : null;
    }
    getPrevLink = () => this.getLinkByText(/上一章/);
    getNextLink = () => this.getLinkByText(/下一章/);
}

class NovelcoolAdapter extends BaseAdapter {
    extractTitle = () => this.doc.querySelector('h2.chapter-title')?.textContent?.trim() ?? null;
    extractContent = () => {
        const contentEl = this.doc.querySelector('div.chapter-reading-section-list');
        if (!contentEl) return null;
        contentEl.querySelectorAll('div.mangaread-ad-box, script').forEach(el => el.remove());
        return contentEl.textContent?.trim() ?? null;
    }
    private getLinkByText = (text: RegExp) => {
        const links = Array.from(this.doc.querySelectorAll('.chapter-reading-pagination a, .chapter-reading-pageitem a'));
        const link = links.find(a => text.test(a.textContent?.toLowerCase() ?? ''));
        return link?.getAttribute('href') ? new URL(link.getAttribute('href')!, this.url).href : null;
    }
    getPrevLink = () => this.getLinkByText(/prev|previous/);
    getNextLink = () => this.getLinkByText(/next/);
}

class SyosetuAdapter extends BaseAdapter {
    extractTitle = () => {
        const titleEl = this.doc.querySelector('h1.p-novel__title');
        return titleEl?.textContent?.trim() ?? null;
    };

    extractContent = () => {
        const contentEl = this.doc.querySelector('.js-novel-text.p-novel__text');
        if (!contentEl) return null;
        
        // Remove any script tags and ads that might be embedded
        contentEl.querySelectorAll('script, .c-ad').forEach(el => el.remove());
        
        return contentEl.textContent?.trim() ?? null;
    };

    getPrevLink = () => {
        const prevLink = this.doc.querySelector('.c-pager__item--before');
        const href = prevLink?.getAttribute('href');
        return href ? new URL(href, this.url).href : null;
    };

    getNextLink = () => {
        const nextLink = this.doc.querySelector('.c-pager__item--next');
        const href = nextLink?.getAttribute('href');
        return href ? new URL(href, this.url).href : null;
    };
}

const getAdapter = (url: string, doc: Document): BaseAdapter | null => {
    if (url.includes('kakuyomu.jp')) return new KakuyomuAdapter(url, doc);
    if (url.includes('dxmwx.org')) return new DxmwxAdapter(url, doc);
    if (url.includes('kanunu8.com') || url.includes('kanunu.net')) return new KanunuAdapter(url, doc);
    if (url.includes('novelcool.com')) return new NovelcoolAdapter(url, doc);
    if (url.includes('ncode.syosetu.com')) return new SyosetuAdapter(url, doc);
    return null;
}

// --- URL VALIDATION UTILITIES ---

/**
 * Check if a URL is supported by any adapter
 */
export const isUrlSupported = (url: string): boolean => {
    try {
        return SUPPORTED_WEBSITES.some(site => url.includes(site));
    } catch {
        return false;
    }
};

/**
 * Get information about all supported sites
 */
export interface SupportedSiteInfo {
    domain: string;
    example: string;
    status: 'active';
}

export const getSupportedSiteInfo = (): SupportedSiteInfo[] => {
    return SUPPORTED_WEBSITES.map(site => ({
        domain: site,
        example: getExampleUrl(site),
        status: 'active' as const
    }));
};

/**
 * Generate example URLs for each supported site
 */
const getExampleUrl = (domain: string): string => {
    const examples: Record<string, string> = {
        'kakuyomu.jp': 'https://kakuyomu.jp/works/1234567890/episodes/1',
        'dxmwx.org': 'https://www.dxmwx.org/chapter/12345',
        'kanunu8.com': 'https://www.kanunu8.com/book/12345/123456.html',
        'novelcool.com': 'https://www.novelcool.com/chapter/Novel-Name-Chapter-1/12345',
        'ncode.syosetu.com': 'https://ncode.syosetu.com/n1234ab/1/',
    };
    
    return examples[domain] || `https://${domain}/example-chapter-url`;
};


// --- PROXY & FETCHING LOGIC ---

interface ProxyConfig {
    url: string;
    type: 'param' | 'path';
    /** The format of the response from the proxy. 'html' is raw text/html, 'json' means we need to parse JSON and find the content. */
    responseFormat: 'html' | 'json';
    /** If responseFormat is 'json', this is the key in the JSON object that holds the HTML content. */
    contentKey?: string;
}

interface ProxyHealthStatus {
    url: string;
    success: number;
    failures: number;
    lastError?: string;
    lastErrorTime?: Date;
    lastSuccessTime?: Date;
    avgResponseTime?: number;
    isHealthy: boolean;
}

// Global proxy health tracking
const proxyHealthMap = new Map<string, ProxyHealthStatus>();

const initializeProxyHealth = (proxyUrl: string): ProxyHealthStatus => {
    if (!proxyHealthMap.has(proxyUrl)) {
        proxyHealthMap.set(proxyUrl, {
            url: proxyUrl,
            success: 0,
            failures: 0,
            isHealthy: true,
        });
    }
    return proxyHealthMap.get(proxyUrl)!;
};

const updateProxyHealth = (proxyUrl: string, successful: boolean, responseTime?: number, error?: string) => {
    const health = initializeProxyHealth(proxyUrl);
    
    if (successful) {
        health.success++;
        health.lastSuccessTime = new Date();
        if (responseTime) {
            health.avgResponseTime = health.avgResponseTime 
                ? (health.avgResponseTime + responseTime) / 2 
                : responseTime;
        }
        // Consider proxy healthy if it has recent successes
        health.isHealthy = true;
    } else {
        health.failures++;
        health.lastError = error;
        health.lastErrorTime = new Date();
        // Mark as unhealthy if failure rate is high
        const totalAttempts = health.success + health.failures;
        const failureRate = health.failures / totalAttempts;
        health.isHealthy = totalAttempts < 3 || failureRate < 0.8; // Unhealthy if >80% failure rate after 3+ attempts
    }
    
    console.log(`[Proxy Health] ${new URL(proxyUrl).hostname}: ${health.success}✓ ${health.failures}✗ (${health.isHealthy ? 'healthy' : 'unhealthy'})`);
};

const getProxyDiagnostics = (): string => {
    const diagnostics = Array.from(proxyHealthMap.values())
        .sort((a, b) => {
            // Sort by health status first, then by success rate
            if (a.isHealthy !== b.isHealthy) return a.isHealthy ? -1 : 1;
            const aSuccessRate = a.success / (a.success + a.failures || 1);
            const bSuccessRate = b.success / (b.success + b.failures || 1);
            return bSuccessRate - aSuccessRate;
        })
        .map(h => {
            const hostname = new URL(h.url).hostname;
            const successRate = h.success + h.failures > 0 ? (h.success / (h.success + h.failures) * 100).toFixed(0) : '0';
            const status = h.isHealthy ? '🟢' : '🔴';
            const lastError = h.lastError ? ` (${h.lastError})` : '';
            return `${status} ${hostname}: ${successRate}% success (${h.success}✓/${h.failures}✗)${lastError}`;
        })
        .join('\n');
    
    return `Proxy Health Status:\n${diagnostics}`;
};

/**
 * A curated list of CORS proxies based on recent research to improve reliability.
 * The list is dynamically sorted based on past performance before each fetch attempt.
 */
const PROXIES: ProxyConfig[] = [
    // --- Tier 1: Modern & Obscure (Highest Priority Start) ---
    { url: 'https://test.cors.workers.dev/', type: 'path', responseFormat: 'html' },
    { url: 'https://proxy.cors.sh/', type: 'path', responseFormat: 'html' },
    { url: 'https://api.codetabs.com/v1/proxy?quest=', type: 'param', responseFormat: 'html' },
    { url: 'https://api.cors.lol/?url=', type: 'param', responseFormat: 'html' },
    
    // --- Tier 2: Existing & Community Proxies (Mid Priority) ---
    { url: 'https://everyorigin.jwvbremen.nl/?url=', type: 'param', responseFormat: 'json', contentKey: 'contents' },
    { url: 'https://cors-anywhere.com/', type: 'path', responseFormat: 'html' },
    { url: 'https://crossorigin.me/', type: 'path', responseFormat: 'html' },
    { url: 'https://cors.x2u.in/', type: 'path', responseFormat: 'html' },
    
    // --- Tier 3: Old Fallbacks (Lowest Priority) ---
    { url: 'https://thingproxy.freeboard.io/fetch/', type: 'path', responseFormat: 'html' },
    { url: 'https://api.allorigins.win/get?url=', type: 'param', responseFormat: 'json', contentKey: 'contents' },
];


/**
 * Get current proxy health diagnostics for debugging
 */
export const getProxyHealthDiagnostics = getProxyDiagnostics;

export const fetchAndParseUrl = async (
    url: string,
    proxyScores: Record<string, number> = {},
    updateProxyScore: (proxyUrl: string, successful: boolean) => void = () => {}
): Promise<Chapter> => {
    let targetUrl;
    try {
        targetUrl = new URL(url);
    } catch (e) {
        throw new Error(`The provided URL is not valid. Please enter a full web address (e.g., "https://...").`);
    }

    let lastError: Error | null = null;
    const MAX_RETRIES = 2;

    // Initialize health for all proxies and sort by health status
    PROXIES.forEach(proxy => initializeProxyHealth(proxy.url));
    const sortedProxies = [...PROXIES].sort((a, b) => {
        const healthA = proxyHealthMap.get(a.url)!;
        const healthB = proxyHealthMap.get(b.url)!;
        
        // Prioritize healthy proxies
        if (healthA.isHealthy !== healthB.isHealthy) {
            return healthA.isHealthy ? -1 : 1;
        }
        
        // Then sort by success rate
        const successRateA = healthA.success / (healthA.success + healthA.failures || 1);
        const successRateB = healthB.success / (healthB.success + healthB.failures || 1);
        
        return successRateB - successRateA;
    });

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        for (const proxy of sortedProxies) {
            let fetchUrl: string;
            if (proxy.type === 'param') {
                fetchUrl = `${proxy.url}${encodeURIComponent(url)}`;
            } else {
                fetchUrl = `${proxy.url}${url}`;
            }

            const proxyName = new URL(proxy.url).hostname;
            const startTime = Date.now();
            console.log(`[Fetch] Attempt ${attempt}/${MAX_RETRIES} via ${proxyName} for: ${url}`);
            
            try {
                const response = await fetch(fetchUrl, { 
                    signal: AbortSignal.timeout(15000) // 15s timeout
                });

                const responseTime = Date.now() - startTime;

                if (!response.ok) {
                    let errorMessage = `HTTP ${response.status}`;
                    let detailedError = `Proxy ${proxyName} responded with status ${response.status}`;
                    
                    // Categorize common HTTP errors
                    switch (response.status) {
                        case 403:
                            errorMessage = 'Access Forbidden (403)';
                            detailedError += '. This proxy may be blocking requests to this domain or has rate limits.';
                            break;
                        case 429:
                            errorMessage = 'Rate Limited (429)';
                            detailedError += '. This proxy is receiving too many requests. Try again later.';
                            break;
                        case 502:
                            errorMessage = 'Bad Gateway (502)';
                            detailedError += '. The proxy cannot reach the target website.';
                            break;
                        case 503:
                            errorMessage = 'Service Unavailable (503)';
                            detailedError += '. The proxy service is temporarily down.';
                            break;
                        case 504:
                            errorMessage = 'Gateway Timeout (504)';
                            detailedError += '. The proxy timed out waiting for the target website.';
                            break;
                        default:
                            detailedError += '. This may indicate the target site is blocking requests or the proxy is misconfigured.';
                    }
                    
                    throw new Error(detailedError);
                }
                
                let htmlString: string;

                if (proxy.responseFormat === 'json') {
                    const jsonData = await response.json();
                    if (!proxy.contentKey || !jsonData[proxy.contentKey]) {
                        throw new Error(`Proxy ${proxyName} returned JSON but the content key '${proxy.contentKey}' was missing.`);
                    }
                    htmlString = jsonData[proxy.contentKey];
                } else { // Handle raw 'html' response
                    // Special handling for GBK encoding on certain sites
                    if (url.includes('kanunu8.com') || url.includes('kanunu.net')) {
                        const buffer = await response.arrayBuffer();
                        htmlString = new TextDecoder('gbk').decode(buffer);
                    } else {
                        htmlString = await response.text();
                    }
                }
                
                if (!htmlString) {
                    throw new Error(`Proxy ${proxyName} returned an empty response.`);
                }

                const doc = new DOMParser().parseFromString(htmlString, 'text/html');
                const adapter = getAdapter(url, doc);
                if (!adapter) throw new Error(`This website (${targetUrl.hostname}) is not supported. No adapter found.`);

                const title = adapter.extractTitle();
                const content = adapter.extractContent();
                
                if (!title || !content) {
                    throw new Error(`Failed to extract title or content from ${targetUrl.hostname}. The page might not be a valid chapter, or the website's layout has changed.`);
                }
                
                const chapterNumber = deriveChapterNumber(url, title);
                updateProxyScore(proxy.url, true);
                updateProxyHealth(proxy.url, true, responseTime);
                console.log(`[Fetch] ✅ Success via ${proxyName} (${responseTime}ms)`);
                return { title, content, originalUrl: url, nextUrl: adapter.getNextLink(), prevUrl: adapter.getPrevLink(), chapterNumber };

            } catch (error: any) {
                const responseTime = Date.now() - startTime;
                lastError = error;
                updateProxyScore(proxy.url, false);
                updateProxyHealth(proxy.url, false, responseTime, error.message);
                console.warn(`[Fetch] ❌ Proxy ${proxyName} failed (${responseTime}ms): ${error.message}`);
                // If one proxy fails, the inner loop will try the next one automatically.
            }
        }
        // If all proxies fail in one attempt, wait before the next full retry.
        if (attempt < MAX_RETRIES) {
            const delay = 1000 * Math.pow(2, attempt - 1); // Exponential backoff
            console.log(`[Fetch] All proxies failed on this attempt. Retrying in ${delay / 1000}s...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    // Final fallback: attempt direct fetch (may fail due to CORS but worth trying)
    console.log(`[Fetch] Final fallback: attempting direct fetch for: ${url}`);
    try {
        const response = await fetch(url, { 
            signal: AbortSignal.timeout(15000),
            mode: 'cors' // Explicit CORS mode
        });

        if (!response.ok) {
            throw new Error(`Direct fetch failed with status ${response.status}`);
        }
        
        let htmlString: string;
        
        // Special handling for GBK encoding on certain sites
        if (url.includes('kanunu8.com') || url.includes('kanunu.net')) {
            const buffer = await response.arrayBuffer();
            htmlString = new TextDecoder('gbk').decode(buffer);
        } else {
            htmlString = await response.text();
        }
        
        if (!htmlString) {
            throw new Error(`Direct fetch returned empty response`);
        }

        const doc = new DOMParser().parseFromString(htmlString, 'text/html');
        const adapter = getAdapter(url, doc);
        if (!adapter) throw new Error(`This website (${targetUrl.hostname}) is not supported. No adapter found.`);

        const title = adapter.extractTitle();
        const content = adapter.extractContent();
        
        if (!title || !content) {
            throw new Error(`Failed to extract title or content from ${targetUrl.hostname}. The page might not be a valid chapter, or the website's layout has changed.`);
        }
        
        const chapterNumber = deriveChapterNumber(url, title);
        console.log(`[Fetch] Direct fetch succeeded for: ${url}`);
        return { title, content, originalUrl: url, nextUrl: adapter.getNextLink(), prevUrl: adapter.getPrevLink(), chapterNumber };

    } catch (directFetchError: any) {
        console.warn(`[Fetch] Direct fetch failed: ${directFetchError.message}`);
        
        // Generate comprehensive error with proxy diagnostics
        const diagnostics = getProxyDiagnostics();
        console.group(`[Fetch] All attempts failed for: ${url}`);
        console.log(diagnostics);
        console.groupEnd();
        
        const errorMessage = `Failed to fetch from ${url} after ${MAX_RETRIES} attempts with all proxies and direct fetch.

${diagnostics}

Last proxy error: ${lastError?.message || 'Unknown proxy error'}
Direct fetch error: ${directFetchError.message}

Troubleshooting tips:
• Try again in a few minutes (proxies may be rate-limited)
• Check if the target website is accessible directly
• Some proxies may be temporarily down - the system will learn and adapt
• If all proxies consistently fail, the target site may have enhanced anti-bot protection`;
        
        throw new Error(errorMessage);
    }
};

// --- CHAPTER NUMBER DERIVATION ---

/**
 * Attempt to derive a numeric chapter number from URL and/or title text.
 * Supports Arabic numerals and common CJK patterns like "第百四十八話" or "第十二章".
 */
function deriveChapterNumber(sourceUrl: string, title: string | null | undefined): number | null {
  const url = sourceUrl || '';
  const t = title || '';

  // 1) Domain-specific URL heuristics
  // Syosetu: https://ncode.syosetu.com/n1234ab/1/
  if (/ncode\.syosetu\.com/.test(url)) {
    const m = url.match(/\/([0-9]+)\/?$/);
    if (m) return parseInt(m[1], 10);
  }

  // NovelCool: path often contains "chapter-<num>"
  if (/novelcool\.com/.test(url)) {
    const m = url.match(/chapter[-_\s]?([0-9]+)/i);
    if (m) return parseInt(m[1], 10);
  }

  // dxmwx: /chapter/<num>
  if (/dxmwx\.org/.test(url)) {
    const m = url.match(/\/chapter\/(\d+)/i);
    if (m) return parseInt(m[1], 10);
  }

  // Kakuyomu/Kanunu: URLs don’t expose a clean sequence → rely on title

  // 2) Title-based Arabic numerals: e.g., "Chapter 148", "第 148 話"
  {
    const m = t.match(/(?:chapter|chap\.|ch\.|第)\s*(\d{1,6})\s*(?:話|章|回)?/i);
    if (m) return parseInt(m[1], 10);
  }

  // 3) Title-based CJK numerals: 第百四十八話 / 第十二章 / 第一回
  {
    const m = t.match(/第\s*([一二三四五六七八九十百千〇零]+)\s*(話|章|回)/);
    if (m) {
      const n = kanjiToNumber(m[1]);
      if (n > 0) return n;
    }
  }

  // 4) Fallback: any first Arabic number in title
  {
    const m = t.match(/(\d{1,6})/);
    if (m) return parseInt(m[1], 10);
  }

  return null;
}

/**
 * Convert simple Japanese/Chinese numerals (一二三四五六七八九十百千〇零) to an integer.
 * Handles compositions like 百四十八 (148), 二十 (20), 十 (10), 千二百三 (1203).
 */
function kanjiToNumber(kanji: string): number {
  const digits: Record<string, number> = {
    '零': 0, '〇': 0,
    '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
    '六': 6, '七': 7, '八': 8, '九': 9,
  };
  const units: Record<string, number> = { '十': 10, '百': 100, '千': 1000 };

  let total = 0;
  let current = 0;
  for (const ch of kanji) {
    if (ch in units) {
      const unit = units[ch];
      const val = current === 0 ? 1 : current; // e.g., 十 => 10, 二十 => 20
      total += val * unit;
      current = 0;
    } else if (ch in digits) {
      current = digits[ch];
    } else {
      // Unknown char; stop early to avoid mis-parse
      break;
    }
  }
  total += current;
  return total;
}

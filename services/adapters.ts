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

class BookTokiAdapter extends BaseAdapter {
    extractTitle = () => {
        const fullTitle = this.doc.querySelector('title')?.textContent?.trim() ?? '';
        // Format example: "던전 디펜스-2화 | 북토끼 - 웹소설 자료실"
        const match = fullTitle.match(/([^|]+?-\s*\d+\s*화)/);
        if (match) return match[1].trim();

        const h1Title = this.doc.querySelector('h1')?.textContent?.trim();
        if (h1Title) return h1Title;

        const h2Title = this.doc.querySelector('h2')?.textContent?.trim();
        if (h2Title) return h2Title;

        return fullTitle.split('|')[0]?.trim() || null;
    };

    extractContent = () => {
        const contentContainer = this.doc.querySelector('#novel_content');
        if (!contentContainer) return null;

        const contentRoot =
            contentContainer.querySelector('div.f9e99a33513') ?? contentContainer;

        const paragraphs = Array.from(contentRoot.querySelectorAll('p'))
            .map((p) => (p.textContent ?? '').trim())
            .filter((text) => text.length > 0 && !this.isSkippableLine(text));

        const content = paragraphs.length > 0 ? paragraphs.join('\n\n') : (contentRoot.textContent ?? '').trim();
        return content.length > 0 ? content : null;
    };

    private isSkippableLine(text: string): boolean {
        const trimmed = text.trim();
        if (trimmed.length < 2) return true;
        const invalidPatterns = [
            /^={5,}/, // separator lines
            /^\d{5,}\s/, // large numeric markers
            /^https?:\/\//i,
            /^www\./i,
        ];
        return invalidPatterns.some((pattern) => pattern.test(trimmed));
    }

    private extractChapterIdFromUrl(url: string): number | null {
        const match = url.match(/\/novel\/(\d+)/);
        if (!match) return null;
        const parsed = parseInt(match[1], 10);
        return Number.isFinite(parsed) ? parsed : null;
    }

    private getLinkByDirection(isNext: boolean): string | null {
        const currentChapterId = this.extractChapterIdFromUrl(this.url);
        if (currentChapterId == null) return null;

        const navLinks = Array.from(this.doc.querySelectorAll('a[href*="/novel/"]')) as HTMLAnchorElement[];

        const candidates = navLinks
            .map((link) => {
                const href = link.getAttribute('href');
                if (!href) return null;
                const abs = new URL(href, this.url).href;
                const id = this.extractChapterIdFromUrl(abs);
                if (id == null || id === currentChapterId) return null;
                return { url: abs, chapterId: id };
            })
            .filter((c): c is { url: string; chapterId: number } => Boolean(c))
            .sort((a, b) => a.chapterId - b.chapterId);

        if (candidates.length === 0) return null;

        if (isNext) {
            return candidates.find((c) => c.chapterId > currentChapterId)?.url ?? null;
        }

        for (let i = candidates.length - 1; i >= 0; i -= 1) {
            if (candidates[i].chapterId < currentChapterId) return candidates[i].url;
        }
        return null;
    }

    getPrevLink = () => this.getLinkByDirection(false);
    getNextLink = () => this.getLinkByDirection(true);
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

/**
 * SuttaCentral Adapter - Handles API-driven fetching for Suttas
 * This adapter is unique as it doesn't parse the HTML but provides 
 * its own fetch logic to hit the JSON APIs.
 */
class SuttaCentralAdapter extends BaseAdapter {
    private suttaUid: string | null = null;
    private authorUid: string | null = null;
    private languageUid: string | null = null;

    constructor(url: string, doc: Document) {
        super(url, doc);
        this.parseUrlMetadata(url);
    }

    private parseUrlMetadata(url: string) {
        try {
            const urlObj = new URL(url);
            const queryLangRaw = urlObj.searchParams.get('lang');
            const queryLang = queryLangRaw ? queryLangRaw.toLowerCase() : null;
            // Expected format: https://suttacentral.net/{sutta_uid}/{lang}/{author_uid}
            // Example: https://suttacentral.net/mn10/en/sujato
            const parts = urlObj.pathname.split('/').filter(Boolean);
            if (parts.length >= 1) {
                this.suttaUid = parts[0];
            }
            if (parts.length >= 3) {
                this.languageUid = queryLang ?? parts[1];
                this.authorUid = parts[2];
            } else if (parts.length === 2) {
                if (queryLang) {
                    this.languageUid = queryLang;
                    this.authorUid = parts[1];
                } else if (this.isLikelyLanguage(parts[1])) {
                    this.languageUid = parts[1];
                } else {
                    this.authorUid = parts[1];
                }
            } else if (queryLang) {
                this.languageUid = queryLang;
            }
            if (!this.languageUid) {
                this.languageUid = 'en';
            }
        } catch (e) {
            console.error('[SuttaCentral] Failed to parse URL metadata:', e);
        }
    }

    private isLikelyLanguage(segment: string): boolean {
        const normalized = segment.toLowerCase();
        if (!/^[a-z]+$/.test(normalized)) {
            return false;
        }
        const known = new Set([
            'en', 'de', 'fr', 'es', 'it', 'pt', 'ru', 'zh', 'ja', 'ko',
            'pli', 'pi', 'sa', 'hi', 'id', 'th', 'vi'
        ]);
        return known.has(normalized) || normalized.length <= 3;
    }

    private getLanguageUid(): string {
        return this.languageUid || 'en';
    }

    private getAuthorUid(): string {
        return this.authorUid || 'sujato';
    }

    private parseSuttaUid(uid: string): { prefix: string; parts: number[] } | null {
        const match = uid.match(/^([a-z]+)(\d+(?:\.\d+)*)$/i);
        if (!match) return null;
        const parts = match[2].split('.').map((part) => parseInt(part, 10));
        if (parts.some((part) => Number.isNaN(part))) return null;
        return { prefix: match[1], parts };
    }

    private buildSiblingLink(delta: number): string | null {
        if (!this.suttaUid) return null;
        const parsed = this.parseSuttaUid(this.suttaUid);
        if (!parsed) return null;
        const nextParts = [...parsed.parts];
        const lastIndex = nextParts.length - 1;
        nextParts[lastIndex] = nextParts[lastIndex] + delta;
        if (nextParts[lastIndex] <= 0) return null;
        const nextUid = `${parsed.prefix}${nextParts.join('.')}`;
        return `https://suttacentral.net/${nextUid}/${this.getLanguageUid()}/${this.getAuthorUid()}`;
    }

    extractTitle = () => {
        // Fallback title in case API fails
        return this.suttaUid ? `Sutta ${this.suttaUid.toUpperCase()}` : 'Sutta';
    };

    extractContent = () => {
        // Content will be handled by the specialized fetch logic
        return 'Loading Sutta content...';
    };

    getPrevLink = () => {
        return this.buildSiblingLink(-1);
    };

    getNextLink = () => {
        return this.buildSiblingLink(1);
    };

    /**
     * Specialized fetcher for SuttaCentral that uses SuttaPlex and Bilara APIs
     */
    async fetchSutta(fetchFn: (url: string) => Promise<string>): Promise<Chapter> {
        if (!this.suttaUid) throw new Error('Could not identify Sutta UID from URL.');
        const author = this.getAuthorUid();
        const lang = this.getLanguageUid();

        console.log(`[SuttaCentral] Fetching Sutta: ${this.suttaUid} (Lang: ${lang}, Author: ${author})`);

        // 1. Fetch Metadata (SuttaPlex)
        let suttaplexData: any = null;
        try {
            const plexUrl = `https://suttacentral.net/api/suttaplex/${this.suttaUid}`;
            const plexResponse = await fetchFn(plexUrl);
            const plexJson = JSON.parse(plexResponse);
            // SuttaPlex API returns an array of matches, we want the first one
            suttaplexData = Array.isArray(plexJson) ? plexJson[0] : plexJson;
        } catch (e) {
            console.warn('[SuttaCentral] Failed to fetch SuttaPlex metadata:', e);
        }

        // 2. Fetch Content (Bilara)
        const bilaraUrl = `https://suttacentral.net/api/bilarasuttas/${this.suttaUid}/${author}`;
        const bilaraResponse = await fetchFn(bilaraUrl);
        const bilaraJson = JSON.parse(bilaraResponse);

        if (!bilaraJson || !bilaraJson.root_text) {
            throw new Error(`The Sutta ${this.suttaUid} by ${author} was not found or has no text.`);
        }

        // 3. Process Content
        const rootText = bilaraJson.root_text;
        const translationText = bilaraJson.translation_text || {};
        
        // Sort keys to ensure correct sequence (mn10:1.1, mn10:1.2, etc.)
        const keys = Object.keys(rootText).sort((a, b) => {
            // Natural sort for segment IDs
            return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
        });

        // Separate Title segments (0.x) from body segments
        const titleSegments: string[] = [];
        const bodySegments: string[] = [];
        const fanSegments: string[] = [];

        keys.forEach(key => {
            const isTitle = key.includes(':0.');
            const pali = rootText[key] || '';
            const eng = translationText[key] || '';

            if (isTitle) {
                // Collect title parts for a clean title
                if (eng) titleSegments.push(eng);
                else if (pali) titleSegments.push(pali);
            } else {
                bodySegments.push(pali);
                fanSegments.push(eng);
            }
        });

        // Construct final chapter object
        const finalTitle = suttaplexData?.translated_title || suttaplexData?.original_title || titleSegments.join(' - ') || this.extractTitle();
        const blurb = typeof suttaplexData?.blurb === 'string' ? suttaplexData.blurb.trim() : null;
        const content = bodySegments.join('\n\n');
        const fanTranslation = fanSegments.join('\n\n');

        return {
            title: finalTitle,
            content: content,
            fanTranslation: fanTranslation.length > 0 ? fanTranslation : null,
            blurb: blurb && blurb.length > 0 ? blurb : null,
            sourceLanguage: 'Pali',
            targetLanguage: lang,
            originalUrl: this.url,
            nextUrl: this.getNextLink(),
            prevUrl: this.getPrevLink(),
            chapterNumber: parseInt(this.suttaUid.match(/\d+/)?.[0] || '0', 10)
        };
    }
}

const getAdapter = (url: string, doc: Document): BaseAdapter | null => {
    if (url.includes('kakuyomu.jp')) return new KakuyomuAdapter(url, doc);
    if (url.includes('dxmwx.org')) return new DxmwxAdapter(url, doc);
    if (url.includes('kanunu8.com') || url.includes('kanunu.net')) return new KanunuAdapter(url, doc);
    if (url.includes('novelcool.com')) return new NovelcoolAdapter(url, doc);
    if (url.includes('ncode.syosetu.com')) return new SyosetuAdapter(url, doc);
    if (url.includes('booktoki468.com')) return new BookTokiAdapter(url, doc);
    if (url.includes('suttacentral.net')) return new SuttaCentralAdapter(url, doc);
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
        'booktoki468.com': 'https://booktoki468.com/novel/3913764',
        'suttacentral.net': 'https://suttacentral.net/mn10/en/sujato',
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
export const PROXIES: ProxyConfig[] = [
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

    const isSuttaCentral = targetUrl.hostname.endsWith('suttacentral.net');
    const suttaAdapter = isSuttaCentral
        ? new SuttaCentralAdapter(url, new DOMParser().parseFromString('', 'text/html'))
        : null;
    if (suttaAdapter) {
        console.log('[Fetch] SuttaCentral URL detected; using API fetch path.');
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
                if (suttaAdapter) {
                    const proxyFetcher = async (apiUrl: string) => {
                        let innerUrl: string;
                        if (proxy.type === 'param') {
                            innerUrl = `${proxy.url}${encodeURIComponent(apiUrl)}`;
                        } else {
                            innerUrl = `${proxy.url}${apiUrl}`;
                        }

                        const innerResp = await fetch(innerUrl, { signal: AbortSignal.timeout(10000) });
                        if (!innerResp.ok) throw new Error(`Proxy failed to fetch API: ${innerResp.status}`);

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
        if (suttaAdapter) {
            const directFetcher = async (apiUrl: string) => {
                const innerResp = await fetch(apiUrl, { signal: AbortSignal.timeout(10000) });
                if (!innerResp.ok) {
                    throw new Error(`Direct fetch failed to fetch API: ${innerResp.status}`);
                }
                return await innerResp.text();
            };
            const result = await suttaAdapter.fetchSutta(directFetcher);
            console.log(`[Fetch] Direct fetch succeeded for: ${url}`);
            return result;
        }

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

import { Chapter } from '../types';
import { SUPPORTED_WEBSITES } from '../constants';

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


export const fetchAndParseUrl = async (
    url: string,
    proxyScores: Record<string, number>,
    updateProxyScore: (proxyUrl: string, successful: boolean) => void
): Promise<Chapter> => {
    let targetUrl;
    try {
        targetUrl = new URL(url);
    } catch (e) {
        throw new Error(`The provided URL is not valid. Please enter a full web address (e.g., "https://...").`);
    }

    let lastError: Error | null = null;
    const MAX_RETRIES = 2;

    const sortedProxies = [...PROXIES].sort((a, b) => {
        const scoreA = proxyScores[a.url] || 0;
        const scoreB = proxyScores[b.url] || 0;
        return scoreB - scoreA;
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
            console.log(`[Fetch] Attempt ${attempt}/${MAX_RETRIES} via ${proxyName} for: ${url}`);
            
            try {
                const response = await fetch(fetchUrl, { 
                    signal: AbortSignal.timeout(15000) // 15s timeout
                });

                if (!response.ok) {
                    throw new Error(`Failed to fetch content from the source (${targetUrl.hostname}). Proxy ${proxyName} responded with status ${response.status}.`);
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
                
                updateProxyScore(proxy.url, true);
                return { title, content, originalUrl: url, nextUrl: adapter.getNextLink(), prevUrl: adapter.getPrevLink() };

            } catch (error: any) {
                lastError = error;
                updateProxyScore(proxy.url, false);
                console.warn(`[Fetch] Proxy ${proxyName} failed: ${error.message}`);
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

    throw new Error(`Failed to fetch from ${url} after ${MAX_RETRIES} attempts with all proxies. Last error: ${lastError?.message || 'Unknown fetch error'}`);
};
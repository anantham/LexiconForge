/**
 * CORS proxy configuration and health tracking.
 * Maintains per-proxy success/failure stats and sorts by reliability.
 */

export interface ProxyConfig {
  url: string;
  type: 'param' | 'path';
  /** 'html' = raw text/html response; 'json' = parse JSON and extract content */
  responseFormat: 'html' | 'json';
  /** If responseFormat is 'json', the key in the JSON object holding the HTML content */
  contentKey?: string;
}

export interface ProxyHealthStatus {
  url: string;
  success: number;
  failures: number;
  lastError?: string;
  lastErrorTime?: Date;
  lastSuccessTime?: Date;
  avgResponseTime?: number;
  isHealthy: boolean;
}

/**
 * A curated list of CORS proxies sorted by reliability tier.
 * Dynamically re-sorted before each fetch attempt based on past performance.
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

// Global proxy health tracking (module-level singleton)
const proxyHealthMap = new Map<string, ProxyHealthStatus>();

export function initializeProxyHealth(proxyUrl: string): ProxyHealthStatus {
  if (!proxyHealthMap.has(proxyUrl)) {
    proxyHealthMap.set(proxyUrl, {
      url: proxyUrl,
      success: 0,
      failures: 0,
      isHealthy: true,
    });
  }
  return proxyHealthMap.get(proxyUrl)!;
}

export function updateProxyHealth(
  proxyUrl: string,
  successful: boolean,
  responseTime?: number,
  error?: string
): void {
  const health = initializeProxyHealth(proxyUrl);

  if (successful) {
    health.success++;
    health.lastSuccessTime = new Date();
    if (responseTime) {
      health.avgResponseTime = health.avgResponseTime
        ? (health.avgResponseTime + responseTime) / 2
        : responseTime;
    }
    health.isHealthy = true;
  } else {
    health.failures++;
    health.lastError = error;
    health.lastErrorTime = new Date();
    const totalAttempts = health.success + health.failures;
    const failureRate = health.failures / totalAttempts;
    health.isHealthy = totalAttempts < 3 || failureRate < 0.8;
  }

  console.log(
    `[Proxy Health] ${new URL(proxyUrl).hostname}: ${health.success}✓ ${health.failures}✗ (${health.isHealthy ? 'healthy' : 'unhealthy'})`
  );
}

export function getProxyHealthMap(): Map<string, ProxyHealthStatus> {
  return proxyHealthMap;
}

export function getProxyDiagnostics(): string {
  const diagnostics = Array.from(proxyHealthMap.values())
    .sort((a, b) => {
      if (a.isHealthy !== b.isHealthy) return a.isHealthy ? -1 : 1;
      const aSuccessRate = a.success / (a.success + a.failures || 1);
      const bSuccessRate = b.success / (b.success + b.failures || 1);
      return bSuccessRate - aSuccessRate;
    })
    .map((h) => {
      const hostname = new URL(h.url).hostname;
      const successRate =
        h.success + h.failures > 0
          ? ((h.success / (h.success + h.failures)) * 100).toFixed(0)
          : '0';
      const status = h.isHealthy ? '🟢' : '🔴';
      const lastError = h.lastError ? ` (${h.lastError})` : '';
      return `${status} ${hostname}: ${successRate}% success (${h.success}✓/${h.failures}✗)${lastError}`;
    })
    .join('\n');

  return `Proxy Health Status:\n${diagnostics}`;
}

/** Exported alias used by external callers */
export const getProxyHealthDiagnostics = getProxyDiagnostics;
